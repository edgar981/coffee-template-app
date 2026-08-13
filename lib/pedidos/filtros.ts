import { isPorCobrar, isCountableOrder } from '@duna/core/metrics/order-stat-filters';
import { BUSINESS_TZ, zonedDayKey } from '@duna/core/timezone';
import { necesitaAtencion, type OrdenParaAtencion } from './atencion';
import type { OrderStatus, CondicionPago } from '@/types/order';
import type { ShippingEstado } from '@/types/shipping';

// ─── LOS FILTROS DE PEDIDOS · un registro, no ifs en el JSX ──────────────────
//
// Siete carriles, y el conjunto ES la decisión: el operador filtra por DÓNDE está
// el pedido en su camino, no por su estado de cobro. Los filtros de cobro
// (pendiente/pagado) que tenía la lista vieja desaparecen — el cobro pasó a ser
// una propiedad que se VE en cada fila (el badge), no un carril por el que se
// entra. Los dos que sobreviven del eje de plata son los que sí son un carril de
// trabajo: "Por cobrar" (hay que ir a cobrar) y "Cancelado" (que es un destino).
//
// Registro y no una cadena de `if` en la pantalla, por lo de siempre: el
// predicado de cada carril tiene que poder afirmarse en la capa 1, y agregar un
// carril tiene que ser una entrada más y no tocar el render.

export type FiltroKey =
  | 'todos' | 'atencion' | 'preparacion' | 'camino' | 'entregados' | 'por_cobrar' | 'cancelado';

/** Lo que un filtro necesita mirar. Une lo de atención con los dos ejes. */
export interface OrdenParaFiltro extends OrdenParaAtencion {
  estado: OrderStatus;
  /** De quién es el pedido. La FK, no el snapshot — ver `filtrarPorCliente`. */
  cliente_id?: string | null;
  /** Cuándo se creó (ISO). El campo que filtra el rango — ver `filtrarPorRango`. */
  createdAt?: string;
  /** `CN-` real o `SN-` de demo — ver `soloOrdenesReales`. */
  numero_orden?: string;
  condicion_pago?: CondicionPago | null;
  shipping?: {
    estado: ShippingEstado | string;
    mensajero?: string | null;
    fecha_programada?: string | null;
  } | null;
}

export interface FiltroPedidos {
  key: FiltroKey;
  label: string;
  /** `undefined` = no filtra (Todos). Se distingue de "filtra y no matchea nada". */
  aplica?: (orden: OrdenParaFiltro) => boolean;
}

// Un pedido CANCELADO no aparece en los carriles de fulfillment aunque su envío
// conserve un estado: al cancelar, el envío pasa a `cancelado`, así que la
// exclusión es automática. Se afirma en el test igual — depender de un efecto
// lateral de otra parte del sistema sin decirlo es cómo se rompe callado.
const enEtapa = (etapa: ShippingEstado) => (o: OrdenParaFiltro) => o.shipping?.estado === etapa;

export const FILTROS_PEDIDOS: FiltroPedidos[] = [
  // "TODOS" EXCLUYE LAS CANCELADAS, y no es un recorte escondido: es la
  // definición única de orden contable del repo (`isCountableOrder`), la misma
  // que ya usan el "N pedidos" de un cliente, la métrica de recurrentes y el
  // widget "Órdenes del mes". Antes este carril tenía una SEGUNDA opinión sobre
  // qué orden cuenta, y por eso el widget del mes tenía que enumerar estados en
  // su enlace (`estado=pendiente,pagado`) para no contar de más.
  //
  // Una cancelada no desaparece: tiene su propio carril, que es su destino. Lo
  // que deja de pasar es que engorde el conteo de "Todos" sin decirlo.
  { key: 'todos',       label: 'Todos',              aplica: (o) => isCountableOrder(o.estado) },
  { key: 'atencion',    label: 'Necesitan atención', aplica: necesitaAtencion },
  { key: 'preparacion', label: 'En preparación',     aplica: enEtapa('preparando') },
  { key: 'camino',      label: 'En camino',          aplica: enEtapa('en_ruta') },
  { key: 'entregados',  label: 'Entregados',         aplica: enEtapa('entregado') },
  // Se consume `isPorCobrar` de core: la misma definición que la tarjeta del
  // dashboard y la lista de Órdenes. Un recorte propio acá haría que dos pantallas
  // contaran distinto la misma plata.
  { key: 'por_cobrar',  label: 'Por cobrar',         aplica: isPorCobrar },
  { key: 'cancelado',   label: 'Cancelado',          aplica: (o) => o.estado === 'cancelado' },
];

// ─── EL CLIENTE ES UN ALCANCE, NO UN CARRIL ──────────────────────────────────
//
// Los siete carriles son excluyentes entre sí y responden "¿dónde está este
// pedido?". El cliente responde otra cosa —"¿de quién son estos pedidos?"— y se
// combina con cualquiera de los siete. Por eso no entra a `FILTROS_PEDIDOS`: un
// octavo pill apagaría al que estuviera puesto.
//
// Se aplica ANTES que el carril, y eso decide también los CONTEOS: con un cliente
// puesto, "Necesitan atención · 5" tiene que decir cinco DE ESE CLIENTE. Contar
// sobre la lista entera dejaría un número que al hacer clic muestra otro — que es
// justo lo que la regla de "el contador cuadra con lo que hay debajo" prohíbe.
//
// Existe porque el sol de la fila de un cliente TIENE que llevar a sus pedidos.
// Un punto de atención que no se puede seguir manda al operador a buscar a mano
// cuál de todos era.
export function filtrarPorCliente<T extends { cliente_id?: string | null }>(
  ordenes: T[],
  clienteId: string | null,
): T[] {
  // Sin cliente no filtra — se distingue de "filtra y no matchea nada". Y una
  // orden sin `cliente_id` nunca entra a un alcance de cliente: no consta de
  // quién es (misma regla que `pedidosPorAtenderPorCliente`).
  return clienteId ? ordenes.filter(o => o.cliente_id === clienteId) : ordenes;
}

// ─── EL RANGO Y EL COBRO son ALCANCES, como el cliente ───────────────────────
//
// Tres cosas acotan la lista sin ser carriles, y las tres se combinan entre sí y
// con cualquiera de los siete: DE QUIÉN son (cliente), DE CUÁNDO (rango) y SI
// ESTÁN COBRADOS (estado).
//
// ── POR QUÉ EL COBRO VUELVE, Y POR QUÉ NO CONTRADICE HABERLO RETIRADO ────────
//
// El cobro se retiró como CARRIL, y la razón escrita fue "un octavo pill apagaría
// al que estuviera puesto". Ese argumento es contra el PILL, no contra el filtro:
// un alcance no ocupa un pill, no apaga nada y se compone. El cobro sigue sin ser
// un carril —no se entra por él— pero un enlace profundo puede acotar por él, que
// es lo que necesitan los tres buckets de cartera ("¿cuánta plata está en la
// calle?" ES una pregunta de cobro) y lo que la pantalla vieja expresaba con el
// mismo parámetro `estado`.
//
// Conservar ese NOMBRE no es nostalgia: `queryDelBucket` (lib/metrics/cartera) ya
// emite `estado=pendiente&desde=…&hasta=…`, y `cartera.test.ts` afirma que ese
// query contiene exactamente las edades de su bucket. Renombrarlo obligaría a
// tocar el test que existe justamente para que el enlace no mienta.

/** Día de Bogotá (`YYYY-MM-DD`) en que se creó la orden. */
const diaDeOrden = (createdAt: string): string => zonedDayKey(new Date(createdAt), BUSINESS_TZ);

/**
 * Acota por FECHA DE CREACIÓN, en day keys de America/Bogota e inclusivo por los
 * dos extremos — exactamente lo que hace la pantalla vieja, y lo que los cinco
 * enlaces del panel ya asumen.
 *
 * Se compara como STRING a propósito: `YYYY-MM-DD` ordena lexicográficamente, así
 * que comparar texto ES comparar fechas, sin construir un `Date` por fila ni
 * arrastrar la zona horaria del navegador a la decisión.
 *
 * Cada extremo es independiente: sólo `desde` es "de acá en adelante" y sólo
 * `hasta` es "hasta acá" — los buckets de cartera usan las dos formas abiertas.
 */
export function filtrarPorRango<T extends { createdAt?: string }>(
  ordenes: T[],
  desde: string | null,
  hasta: string | null,
): T[] {
  if (!desde && !hasta) return ordenes;
  return ordenes.filter(o => {
    // Sin fecha no se puede afirmar que caiga en el rango, y meterla sería
    // engordar el conteo con algo que no consta. Mismo criterio que una orden sin
    // `cliente_id` frente a un alcance de cliente.
    if (!o.createdAt) return false;
    const dia = diaDeOrden(o.createdAt);
    return (!desde || dia >= desde) && (!hasta || dia <= hasta);
  });
}

/**
 * Acota por estado de COBRO. Lista vacía = sin alcance (no "ninguno").
 */
export function filtrarPorEstado<T extends { estado: OrderStatus }>(
  ordenes: T[],
  estados: OrderStatus[],
): T[] {
  return estados.length ? ordenes.filter(o => estados.includes(o.estado)) : ordenes;
}

/** Los estados que existen, para validar lo que llega por la URL. */
const ESTADOS_VALIDOS: OrderStatus[] = ['pendiente', 'pagado', 'cancelado'];

/**
 * Lee `?estado=pendiente,pagado` con la MISMA tolerancia que la pantalla vieja:
 * los tokens desconocidos se descartan en vez de invalidar el parámetro entero,
 * así que `?estado=pendiente,basura` sigue acotando a pendiente. Sin duplicados y
 * en el orden en que llegaron.
 */
export function parseEstados(raw: string | null): OrderStatus[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(',').map(s => s.trim())
       .filter((s): s is OrderStatus => (ESTADOS_VALIDOS as string[]).includes(s)),
  )];
}

/**
 * EL SCOPE DE LA PANTALLA, que no es un filtro del operador: las `SN-` son
 * FIXTURES DE DEMO del seed (`prisma/seed.ts`), no pedidos.
 *
 * Ningún camino de runtime las produce — el único generador de número de orden
 * emite siempre `CN-` ("Every real order (checkout AND admin) uses the CN-
 * series", `packages/core/src/orders.ts`) — y ya están excluidas de la gráfica
 * del dashboard, de la actividad semanal, de Analítica, de los reportes y de las
 * automatizaciones. La lista era la última superficie que las mostraba, y por eso
 * el widget "Pedidos de hoy" podía decir 3 mientras la lista mostraba 4.
 *
 * No vacía la pantalla en desarrollo: el seed crea ADEMÁS ~90 días de órdenes
 * `CN-9#####`, deliberadamente de la serie real para que la gráfica funcione.
 *
 * Sin número no se descarta: una orden que no dice cómo se llama no es demo
 * demostrada, y esconderla sería peor que mostrarla.
 */
export const soloOrdenesReales = <T extends { numero_orden?: string }>(ordenes: T[]): T[] =>
  ordenes.filter(o => !o.numero_orden?.startsWith('SN-'));

/** Los tres alcances juntos. Se aplican ANTES del carril, y sobre su resultado se
 *  calculan los conteos de los pills. */
export interface AlcancePedidos {
  cliente: string | null;
  desde:   string | null;
  hasta:   string | null;
  estados: OrderStatus[];
}

/** ¿Hay algún alcance puesto? Lo consume el aviso que los muestra y los quita. */
export const hayAlcance = (a: AlcancePedidos): boolean =>
  Boolean(a.cliente || a.desde || a.hasta || a.estados.length);

/**
 * Aplica los tres. El ORDEN entre ellos no cambia el resultado —son
 * intersecciones— pero se dejan en el mismo orden en que se leen en pantalla.
 */
export function aplicarAlcance<T extends OrdenParaFiltro>(ordenes: T[], a: AlcancePedidos): T[] {
  return filtrarPorEstado(
    filtrarPorRango(filtrarPorCliente(ordenes, a.cliente), a.desde, a.hasta),
    a.estados,
  );
}

/** `null` para una key que no existe — no se cae a "todos" en silencio: un
 *  parámetro de URL basura debe ser visible, no interpretado. */
export const filtroPorKey = (key: string): FiltroPedidos | null =>
  FILTROS_PEDIDOS.find(f => f.key === key) ?? null;

export function aplicarFiltro<T extends OrdenParaFiltro>(ordenes: T[], key: FiltroKey): T[] {
  const filtro = filtroPorKey(key);
  return filtro?.aplica ? ordenes.filter(filtro.aplica) : ordenes;
}

/** Conteo por carril, para el número del pill. Se calcula sobre la MISMA lista
 *  que se muestra: un contador que no cuadra con lo que hay debajo es peor que
 *  ninguno. */
export function conteos<T extends OrdenParaFiltro>(ordenes: T[]): Record<FiltroKey, number> {
  return FILTROS_PEDIDOS.reduce((acc, f) => {
    acc[f.key] = f.aplica ? ordenes.filter(f.aplica).length : ordenes.length;
    return acc;
  }, {} as Record<FiltroKey, number>);
}
