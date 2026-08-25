import prisma from '@duna/core';
import { formatCOP } from '@duna/core/utils';
import { toWhatsappNumber } from '@duna/core/whatsapp-link';
import { BUSINESS_TZ, zonedIsoWeekday } from '@duna/core/timezone';
import { POR_COBRAR_WHERE, ORDENES_REALES } from '@duna/core/metrics/prisma-scopes';
import { PENDING_ESTADO } from '@duna/core/metrics/order-stat-filters';
import { AUTOMATION_HREF, hrefOrden, hrefOrdenOLista } from '@/constants/automations';
import {
  HORAS_ENTREGA_SIN_COBRO, corteEntregaISO, entregaVencidaSinCobro, horasDesdeEntrega,
} from '../reglas';
import { parseRecipients } from '../channels/email';
import { nombreCorto } from './eventos';
import { construirReporteSemanal, construirResumenDiario } from '../reportes';
import type { ScheduledHandler, Objetivo } from '../types';

// Handlers PROGRAMADOS: devuelven todos los targets que hoy cumplen la condición.
// El motor ya filtró por activo y por hora; aquí sólo vive el "quiénes".
//
// TOPE POR BARRIDO: los que pueden devolver muchos targets están acotados. Un
// barrido que despacha 800 mensajes de golpe agota el rate limit del canal y deja
// medio lote en FALLIDO (que, por la política actual, no se reintenta). Lo que no
// entra en este barrido entra en el siguiente — son automatizaciones diarias, no
// tiempo real.
const TOPE_POR_BARRIDO = 50;

const dias = (n: number) => n * 86_400_000;
const horas = (n: number) => n * 3_600_000;


/** Ids que ya tienen run para esta automatización — pre-filtro barato. El gate duro
 *  sigue siendo el unique al escribir; esto sólo evita trabajo inútil. */
async function yaAtendidos(automationKey: string): Promise<Set<string>> {
  const runs = await prisma.automationRun.findMany({
    where:  { automationKey },
    select: { targetId: true },
  });
  return new Set(runs.map(r => r.targetId));
}

// ── 3. Recordatorio de Pago ──────────────────────────────────────────────────
// SÓLO órdenes ANTICIPADAS: una contraentrega se paga al recibir, así que
// recordarle el pago a ese cliente es molestarlo por algo que no debe todavía.
export const recordatorioPago: ScheduledHandler = async ({ config, now }) => {
  const espera = Number(config.horasEspera ?? 24);
  const corte  = new Date(now.getTime() - horas(espera));

  // Piso de FRESCURA: una orden vieja sin pagar ya no se cobra por WhatsApp — se
  // cancela o se llama. Se OMITE con la razón visible en vez de filtrarse en el
  // `where`, para que el owner vea en la card que la orden existió y por qué no se
  // le escribió; una orden que desaparece en silencio del barrido no es
  // información. Además el run cierra el caso: no vuelve a evaluarse cada día.
  const maxEdad = Number(config.maxEdadDias ?? 7);
  const pisoEdad = new Date(now.getTime() - dias(maxEdad));

  const atendidas = await yaAtendidos('recordatorio_pago');

  const ordenes = await prisma.order.findMany({
    where: {
      // `pendiente` ya excluye canceladas y pagadas por sí solo — no se compone con
      // NOT_CANCELLED (ambos escriben `estado` y el spread pisaría el filtro).
      estado:         PENDING_ESTADO,
      condicion_pago: 'ANTICIPADO',
      ...ORDENES_REALES,     // excluye la data de demo SN-
      createdAt:      { lt: corte },
    },
    select:  { id: true, numero_orden: true, cliente_nombre: true, cliente_telefono: true, total: true, createdAt: true },
    orderBy: { createdAt: 'desc' },  // las recordables (más recientes) primero
    take:    TOPE_POR_BARRIDO * 2,   // margen para descartar las ya atendidas
  });

  const objetivos: Objetivo[] = [];
  for (const o of ordenes) {
    if (atendidas.has(o.id)) continue;
    if (objetivos.length >= TOPE_POR_BARRIDO) break;

    if (o.createdAt < pisoEdad) {
      const edad = Math.floor((now.getTime() - o.createdAt.getTime()) / dias(1));
      objetivos.push({
        targetId: o.id,
        omitir:   `la orden tiene ${edad} días (límite: ${maxEdad}) — demasiado vieja para recordarla por WhatsApp`,
      });
      continue;
    }

    const to = toWhatsappNumber(o.cliente_telefono);
    objetivos.push(to
      ? {
          targetId: o.id,
          dispatch: {
            canal: 'whatsapp', to: `+${to}`, templateKey: 'recordatorio_pago',
            variables: [nombreCorto(o.cliente_nombre), o.numero_orden, formatCOP(o.total)],
          },
        }
      : { targetId: o.id, omitir: 'la orden no tiene un celular colombiano válido' });
  }
  return objetivos;
};

// ── 4. Reporte Semanal de Ventas ─────────────────────────────────────────────
// El motor comprueba la HORA; el DÍA es parte de la definición de esta
// automatización y vive aquí. Lunes = 1 en el reloj de Bogotá.
export const reporteSemanal: ScheduledHandler = async ({ config, now }) => {
  if (zonedIsoWeekday(now, BUSINESS_TZ) !== 1) return [];

  const email = await construirReporteSemanal(now);
  const to = await parseRecipients(config.destinatarios);
  return [{
    targetId: 'global',
    dispatch: { canal: 'email', audiencia: 'equipo', to, email },
  }];
};

// ── 5. Reactivación de Clientes ──────────────────────────────────────────────
// "Inactivo" = tuvo al menos una orden PAGADA y la última fue hace más de N días.
// Quien nunca compró no es un cliente a reactivar (es otra campaña, otra
// automatización). El cooldown por cliente lo aplica el motor.
export const clienteInactivo: ScheduledHandler = async ({ config, now }) => {
  const corte = new Date(now.getTime() - dias(Number(config.diasInactividad ?? 45)));
  const promo = String(config.textoPromo ?? '');

  // Última compra por cliente. `groupBy` + `_max` en vez de cargar todas las
  // órdenes: la lista de clientes crece, la de órdenes crece mucho más rápido.
  const ultimaCompra = await prisma.order.groupBy({
    by:    ['cliente_id'],
    where: { estado: 'pagado', cliente_id: { not: null }, ...ORDENES_REALES },
    _max:  { createdAt: true },
  });

  const inactivos = ultimaCompra
    .filter(g => g.cliente_id && g._max.createdAt && g._max.createdAt < corte)
    .map(g => g.cliente_id as string);
  if (inactivos.length === 0) return [];

  const clientes = await prisma.customer.findMany({
    where:  { id: { in: inactivos }, activo: true, telefono: { not: null } },
    select: { id: true, nombre: true, telefono: true },
    take:   TOPE_POR_BARRIDO,
  });

  return clientes.map<Objetivo>(c => {
    const to = toWhatsappNumber(c.telefono);
    return to
      ? {
          targetId: c.id,
          dispatch: {
            canal: 'whatsapp', to: `+${to}`, templateKey: 'cliente_inactivo',
            variables: [nombreCorto(c.nombre), promo],
          },
        }
      : { targetId: c.id, omitir: 'el cliente no tiene un celular colombiano válido' };
  });
};

// ── 7. Contraentrega sin cobrar ──────────────────────────────────────────────
// La plata que lleva días en la calle. `stock_descontado_at` es el instante real
// del despacho (se estampa en la transacción de despacho), no la fecha programada.
export const contraentregaSinCobrar: ScheduledHandler = async ({ config, now }) => {
  const diasLimite = Number(config.diasDespachada ?? 3);
  const corte      = new Date(now.getTime() - dias(diasLimite));

  const ordenes = await prisma.order.findMany({
    where: {
      ...POR_COBRAR_WHERE,
      shipping: { ...POR_COBRAR_WHERE.shipping, stock_descontado_at: { lt: corte } },
    },
    select: { id: true, numero_orden: true, total: true, shipping: { select: { stock_descontado_at: true } } },
    take:   TOPE_POR_BARRIDO,
  });

  return ordenes.map<Objetivo>(o => {
    const desde = o.shipping?.stock_descontado_at;
    const antiguedad = desde ? Math.floor((now.getTime() - desde.getTime()) / dias(1)) : diasLimite;
    return {
      targetId: o.id,
      dispatch: {
        canal:   'interno',
        tipo:    'contraentrega_sin_cobrar',
        titulo:  'Contraentrega sin cobrar',
        mensaje: `Tienes ${formatCOP(o.total)} en la calle hace ${antiguedad} día${antiguedad === 1 ? '' : 's'} (orden ${o.numero_orden}).`,
        href:    AUTOMATION_HREF.porCobrar,
      },
    };
  });
};

// ── 8. Envío estancado ───────────────────────────────────────────────────────
// Captura las dos cosas a la vez: entregas con problema real y entregas ya hechas
// que nadie marcó. Ambas se resuelven en el mismo sitio (el tablero de Entregas).
export const envioEstancado: ScheduledHandler = async ({ config, now }) => {
  const diasLimite = Number(config.diasEnRuta ?? 2);
  const corte      = new Date(now.getTime() - dias(diasLimite));

  const envios = await prisma.shipping.findMany({
    where:  { estado: 'en_ruta', stock_descontado_at: { lt: corte } },
    select: {
      id: true, mensajero: true, stock_descontado_at: true,
      order: { select: { numero_orden: true } },
    },
    take: TOPE_POR_BARRIDO,
  });

  return envios.map<Objetivo>(s => {
    const desde = s.stock_descontado_at;
    const antiguedad = desde ? Math.floor((now.getTime() - desde.getTime()) / dias(1)) : diasLimite;
    const quien = s.mensajero?.trim() ? ` · ${s.mensajero.trim()}` : '';
    return {
      targetId: s.id,
      dispatch: {
        canal:   'interno',
        tipo:    'envio_estancado',
        titulo:  'Envío estancado',
        mensaje: `La orden ${s.order?.numero_orden ?? '—'} lleva ${antiguedad} día${antiguedad === 1 ? '' : 's'} en ruta${quien}.`,
        // Al PEDIDO que la notificación nombra, no al board (§ hrefOrden): una
        // notificación que nombra la orden y lleva a una lista obliga a buscarla a mano.
        href:    hrefOrdenOLista(s.order?.numero_orden),
      },
    };
  });
};

// ── 11. Entregado sin cobrar — campana del operador ──────────────────────────
// ESCALADA de `contraentrega_sin_cobrar`, no un duplicado suyo: aquella mide
// desde el DESPACHO en días ("la plata está en la calle"), esta desde la ENTREGA
// en horas ("el mensajero volvió y no liquidó"). Ver la nota de solapes
// deliberados al final de constants/automations.ts.
//
// No se filtra por CONTRAENTREGA aunque en la práctica toda orden aquí lo sea (un
// despacho sin pago flipea la condición): la condición de este aviso es
// literalmente "entregada y sin pago", y hacerla depender de ese invariante la
// volvería silenciosamente vacía el día que el invariante cambie.
export const entregaSinCobro: ScheduledHandler = async ({ config, now }) => {
  const horasLimite = Number(config.horasEntrega ?? HORAS_ENTREGA_SIN_COBRO);
  const atendidas   = await yaAtendidos('entrega_sin_cobro');

  const ordenes = await prisma.order.findMany({
    where: {
      // `pendiente` ya significa "sin pago registrado" — excluye pagadas y
      // canceladas por sí solo.
      estado:   PENDING_ESTADO,
      ...ORDENES_REALES,          // excluye la data de demo SN-
      shipping: {
        estado:        'entregado',
        // Pre-filtro barato sobre una columna de TEXTO; la decisión real la toma
        // `entregaVencidaSinCobro` abajo. Ver el comentario de `corteEntregaISO`.
        fecha_entrega: { lt: corteEntregaISO(horasLimite, now) },
      },
    },
    select:  {
      id: true, numero_orden: true, total: true,
      shipping: { select: { fecha_entrega: true } },
    },
    orderBy: { createdAt: 'desc' },
    take:    TOPE_POR_BARRIDO * 2,  // margen para descartar las ya atendidas
  });

  const objetivos: Objetivo[] = [];
  for (const o of ordenes) {
    if (atendidas.has(o.id)) continue;
    if (objetivos.length >= TOPE_POR_BARRIDO) break;
    // Re-verificación en JS: el `lt` de arriba es lexicográfico sobre texto.
    if (!entregaVencidaSinCobro(o.shipping ?? {}, horasLimite, now)) continue;

    const horas = horasDesdeEntrega(o.shipping ?? {}, now) ?? horasLimite;
    objetivos.push({
      targetId: o.id,
      dispatch: {
        canal:   'interno',
        tipo:    'entrega_sin_cobro',
        titulo:  'Entregado sin cobrar',
        mensaje: `La orden ${o.numero_orden} se entregó hace ${horas} horas y no hay pago registrado (${formatCOP(o.total)}).`,
        href:    hrefOrden(o.numero_orden),
      },
    });
  }
  return objetivos;
};

// ── 9. Resumen diario ────────────────────────────────────────────────────────
export const resumenDiario: ScheduledHandler = async ({ config, now }) => {
  const email = await construirResumenDiario(now);
  const to = await parseRecipients(config.destinatarios);
  return [{
    targetId: 'global',
    dispatch: { canal: 'email', audiencia: 'equipo', to, email },
  }];
};
