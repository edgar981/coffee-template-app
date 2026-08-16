import { z } from 'zod';
import type { LucideIcon } from 'lucide-react';
import {
  Bell, Package, CreditCard, BarChart2, UserX, CheckCircle,
  Wallet, Truck, Sunrise, ShoppingBag, HandCoins, PackageX,
} from 'lucide-react';
import { STAT_CHIP } from '@/constants/stat-chip';
import { POR_COBRAR_QUERY_PEDIDOS } from '@duna/core/metrics/order-stat-filters';
import { RUTA_REPONER } from '@/lib/productos/filtros';
import { HORAS_ENTREGA_SIN_COBRO } from '@/lib/automations/reglas';

// ─── Registry de automatizaciones ────────────────────────────────────────────
// EL catálogo. Todo lo que define una automatización —nombre, canal, disparador,
// plantilla, y los DEFAULTS de su configuración— vive aquí, en el código. La DB
// (AutomationSetting) guarda SOLO la decisión del owner: encendida/apagada y los
// overrides. Mismo patrón que constants/dashboard-widgets.ts.
//
// PURO + CLIENT-SAFE: zod, lucide y strings. Sin Prisma, sin `server-only`, sin
// next/headers — la página de Automatizaciones lo importa desde un componente
// cliente. La EJECUCIÓN (a quién le toca, qué datos lleva) vive en
// lib/automations/handlers.ts, del lado servidor, junto a los datos.
// (`lib/automations/reglas` cumple la misma condición y por eso puede importarse
// desde aquí: es sólo predicados y constantes, sin una sola dependencia.)
//
// `key` es el identificador estable que se persiste (AutomationSetting.key y
// AutomationRun.automationKey). Renombrar una key es un cambio ROMPEDOR: la
// configuración y el historial de la vieja quedan huérfanos. Las 6 keys originales
// reusan a propósito los `tipo` de la tabla `Automation` retirada, para que la
// copia de toggles de la migración calzara.
//
// COSTURA MULTITENANT (documentada, NO construida — igual que los widgets): cuando
// exista modelo de tienda/vertical, (a) cada AutomationDef gana un filtro por
// vertical, (b) AutomationSetting gana la clave de tienda y su PK pasa a compuesta
// (storeId + key), y (c) `defaultActivo` se vuelve un set por vertical. La FORMA
// (registry + settings + runs) ya es genérica del template "Comercio Digital"; el
// CONTENIDO (estas 9) es de esta vertical.

export type AutomationCanal = 'interno' | 'email' | 'whatsapp';

/**
 * REGLA DE `defaultActivo` — la decide el DESTINATARIO del canal, no el gusto de
 * quien agrega la automatización. Así una automatización futura se clasifica sola
 * y nadie tiene que recordar la política:
 *
 *   canal `interno` (la campana, le habla al OPERADOR) → nace ENCENDIDA.
 *     Es información sobre su propio negocio, en su propio panel, sin costo por
 *     mensaje, sin terceros y sin consentimiento de nadie. Una campana que hay
 *     que configurar antes de que sirva es una campana que nadie enciende.
 *
 *   canales `whatsapp` / `email` (le hablan al CLIENTE o salen de la casa) →
 *     nacen APAGADAS, con opt-in explícito del owner. Cuestan plata por mensaje,
 *     dependen de credenciales de terceros (Meta, Resend) y pueden quemar la
 *     reputación del número. Que el owner decida enviar es parte del producto,
 *     no una fricción a eliminar.
 *
 * `defaultActivo` es solo el ARRANQUE: una fila en AutomationSetting (el toggle
 * de la página) siempre manda sobre esto. Apagar una interna es una decisión que
 * se respeta igual.
 */

/** `evento`: la dispara un cambio del negocio. `programada`: la dispara el cron. */
export type AutomationTipo = 'evento' | 'programada';

/**
 * A quién le habla — DECIDE LA IDENTIDAD DEL REMITENTE, no es decorativo:
 * `cliente` sale con la identidad de la tienda (siteConfig.tienda), `equipo` con
 * la del panel. Ver lib/automations/channels/email.ts.
 */
export type AutomationAudiencia = 'cliente' | 'equipo';

/** Qué fila apunta el run (AutomationRun.targetType). */
export type AutomationTarget = 'order' | 'product' | 'customer' | 'shipping' | 'global';

/**
 * Cómo se evita el duplicado. Determina la forma de `AutomationRun.periodo` y
 * QUIÉN es el gate real — ver el comentario del modelo en prisma/schema.prisma.
 *
 *   una_vez  → periodo 'evt'        · el unique de la tabla ES el gate
 *   diaria   → periodo '2026-07-27' · el unique ES el gate
 *   semanal  → periodo '2026-W31'   · el unique ES el gate
 *   cooldown → periodo = instante   · el unique NO aplica; el gate es la consulta
 *              de la última corrida dentro de `config.cooldownHoras`
 */
export type AutomationIdempotencia = 'una_vez' | 'diaria' | 'semanal' | 'cooldown';

/**
 * Qué tan grave es lo que avisa una notificación de campana. ÚNICO consumidor: el
 * tono del badge del bell — Amber Minimal dice que el color es información, así
 * que el rojo tiene que significar algo y no ser el color de "hay algo".
 *
 *   `alerta` → algo salió mal o hay plata en riesgo (stock agotado, entrega
 *     fallida, dinero entregado sin cobrar). Es el mismo rojo que la card de
 *     Alertas de Stock: si aparece, hay que hacer algo.
 *   `info` (default cuando no se declara) → algo bueno o esperado pasó (entró una
 *     orden). Badge en el primario, no en rojo.
 *
 * El badge pinta rojo solo si alguna NO LEÍDA es `alerta`; tres órdenes nuevas no
 * ponen la campana en rojo.
 */
export type AutomationSeveridad = 'alerta' | 'info';

// ─── Plantillas de WhatsApp (gramática Meta) ─────────────────────────────────
// Escritas para ser APROBABLES TAL CUAL por Meta, no para leerse bonito aquí:
//   · variables POSICIONALES {{1}}, {{2}}… — nunca texto libre por mensaje;
//   · el cuerpo NO empieza ni termina en variable, y no hay dos variables
//     adyacentes (Meta rechaza las tres cosas);
//   · UTILITY = transaccional (dispara por una acción del cliente); MARKETING =
//     promocional (requiere opt-in y tiene otro costo). Categorizar mal es la
//     causa #1 de rechazo.
// El día que llegue la API, `nombre` es el template name registrado y `variables`
// documenta el binding posicional. Ver lib/automations/channels/whatsapp.ts.

export interface WhatsappTemplate {
  /** Template name tal como se registra en Meta: snake_case, minúsculas. */
  nombre: string;
  categoria: 'UTILITY' | 'MARKETING';
  idioma: 'es';
  /** Cuerpo con variables posicionales. Texto FIJO — lo único variable son las {{n}}. */
  cuerpo: string;
  /** Qué es cada variable, en orden posicional. Documenta el contrato del handler. */
  variables: string[];
}

/** Sustituye {{1}}, {{2}}… por los valores dados (1-indexado). */
export function renderWhatsappTemplate(tpl: WhatsappTemplate, variables: string[]): string {
  return tpl.cuerpo.replace(/\{\{(\d+)\}\}/g, (match, n) => variables[Number(n) - 1] ?? match);
}

// ─── Campos de configuración (metadata de UI) ────────────────────────────────
// El Dialog "Configurar" se genera de ESTA lista, no introspeccionando el zod: el
// schema sabe validar pero no sabe que `cooldownHoras` se dice "Esperar antes de
// volver a avisar" ni que va en horas. Van declarados juntos y el zod valida lo
// que el formulario produce, así que no pueden divergir sin romper el parseo.

export type ConfigCampo =
  | { name: string; tipo: 'numero'; label: string; ayuda?: string; sufijo?: string; min: number; max: number }
  | { name: string; tipo: 'hora';   label: string; ayuda?: string }
  | { name: string; tipo: 'texto';  label: string; ayuda?: string; maxLength: number }
  | { name: string; tipo: 'emails'; label: string; ayuda?: string };

export interface AutomationDef {
  key: string;
  nombre: string;
  descripcion: string;
  canal: AutomationCanal;
  tipo: AutomationTipo;
  audiencia: AutomationAudiencia;
  /** Disparador en español, tal cual se muestra en la card. */
  disparador: string;
  idempotencia: AutomationIdempotencia;
  targetType: AutomationTarget;
  /** Defaults incluidos: `schema.parse({})` devuelve la configuración por defecto. */
  configSchema: z.ZodType<Record<string, unknown>>;
  campos: ConfigCampo[];
  /** Encendida de fábrica. NO se decide caso por caso — ver la regla por canal
   *  documentada en AutomationCanal (interno → true, externos → false). */
  defaultActivo: boolean;
  /** Solo para `canal: 'interno'`: tono del badge de la campana. Default `info`. */
  severidad?: AutomationSeveridad;
  icono: LucideIcon;
  color: string;
  plantilla?: WhatsappTemplate;
}

// Campo compartido: la hora local (Bogotá) a la que corre un barrido. El cron es
// horario, así que cada programada declara SU hora y el motor compara contra el
// reloj de Bogotá (lib/timezone.zonedHour) — nunca contra UTC.
const horaCampo = (label = 'Hora de ejecución'): ConfigCampo => ({
  name: 'hora', tipo: 'hora', label, ayuda: 'Hora de Colombia (America/Bogotá).',
});

const destinatariosCampo: ConfigCampo = {
  name: 'destinatarios', tipo: 'emails', label: 'Destinatarios',
  ayuda: 'Separados por coma. Vacío = el correo del admin principal (ADMIN_EMAIL).',
};

export const AUTOMATIONS: AutomationDef[] = [
  // ── 1. Nueva orden ─────────────────────────────────────────────────────────
  {
    key: 'nueva_orden',
    nombre: 'Notificación Nueva Orden',
    descripcion: 'Confirma al cliente por WhatsApp en cuanto su orden queda pagada.',
    canal: 'whatsapp', tipo: 'evento', audiencia: 'cliente',
    disparador: 'Cuando una orden cambia a estado "pagado"',
    idempotencia: 'una_vez', targetType: 'order',
    configSchema: z.object({}),
    campos: [],
    defaultActivo: false,
    icono: Bell, color: STAT_CHIP.blue,
    plantilla: {
      nombre: 'orden_confirmada', categoria: 'UTILITY', idioma: 'es',
      cuerpo:
        'Hola {{1}}, confirmamos tu orden {{2}} por un total de {{3}}. ' +
        'Ya estamos preparándola y te avisamos apenas salga a ruta. ' +
        'Gracias por comprar en Café Nayoli.',
      variables: ['nombre del cliente', 'número de orden', 'total formateado en COP'],
    },
  },

  // ── 2. Stock bajo ──────────────────────────────────────────────────────────
  {
    key: 'stock_bajo',
    nombre: 'Alerta de Stock Bajo',
    descripcion: 'Avisa al equipo en la campana cuando un producto cruza su stock mínimo.',
    canal: 'interno', tipo: 'evento', audiencia: 'equipo',
    disparador: 'Cuando un producto CRUZA su mínimo (al despachar o al ajustar)',
    idempotencia: 'cooldown', targetType: 'product',
    configSchema: z.object({
      cooldownHoras: z.coerce.number().int().min(1).max(720).default(24),
    }),
    campos: [
      { name: 'cooldownHoras', tipo: 'numero', label: 'Esperar antes de repetir el aviso',
        sufijo: 'horas', min: 1, max: 720,
        ayuda: 'Por producto. Evita una lluvia de avisos por el mismo producto en un día de ventas.' },
    ],
    // Canal interno → encendida de fábrica (regla en AutomationCanal). Estaba en
    // false y por eso la campana no mostraba nada pese a estar implementada.
    defaultActivo: true,
    severidad: 'alerta',
    icono: Package, color: STAT_CHIP.alert,
  },

  // ── 3. Recordatorio de pago ────────────────────────────────────────────────
  {
    key: 'recordatorio_pago',
    nombre: 'Recordatorio de Pago',
    descripcion: 'Recuerda por WhatsApp una orden anticipada que sigue sin pagar.',
    canal: 'whatsapp', tipo: 'programada', audiencia: 'cliente',
    disparador: 'Órdenes anticipadas sin pagar tras el tiempo configurado',
    idempotencia: 'una_vez', targetType: 'order',
    configSchema: z.object({
      horasEspera:  z.coerce.number().int().min(1).max(720).default(24),
      maxEdadDias:  z.coerce.number().int().min(1).max(365).default(7),
      hora:         z.coerce.number().int().min(0).max(23).default(10),
    }),
    campos: [
      { name: 'horasEspera', tipo: 'numero', label: 'Esperar desde que se creó la orden',
        sufijo: 'horas', min: 1, max: 720,
        ayuda: 'Solo órdenes ANTICIPADAS. Las contraentrega se pagan al recibir: nunca se les recuerda.' },
      { name: 'maxEdadDias', tipo: 'numero', label: 'No recordar órdenes más viejas que',
        sufijo: 'días', min: 1, max: 365,
        ayuda: 'Una orden vieja sin pagar ya no se cobra por WhatsApp: se cancela o se llama. Las que superan este límite quedan registradas como omitidas, con la razón visible.' },
      horaCampo('Hora del barrido'),
    ],
    defaultActivo: false,
    icono: CreditCard, color: STAT_CHIP.orange,
    plantilla: {
      nombre: 'recordatorio_pago', categoria: 'UTILITY', idioma: 'es',
      cuerpo:
        'Hola {{1}}, tu orden {{2}} por {{3}} sigue pendiente de pago. ' +
        'Si ya lo hiciste, ignora este mensaje. ' +
        'Si necesitas ayuda para completarlo, respóndenos por aquí.',
      variables: ['nombre del cliente', 'número de orden', 'total formateado en COP'],
    },
  },

  // ── 4. Reporte semanal ─────────────────────────────────────────────────────
  {
    key: 'reporte_semanal',
    nombre: 'Reporte Semanal de Ventas',
    descripcion: 'Resumen de la semana al equipo por correo: ventas, órdenes, por cobrar y top producto.',
    canal: 'email', tipo: 'programada', audiencia: 'equipo',
    disparador: 'Cada lunes a la hora configurada',
    idempotencia: 'semanal', targetType: 'global',
    configSchema: z.object({
      hora:          z.coerce.number().int().min(0).max(23).default(8),
      destinatarios: z.string().trim().default(''),
    }),
    campos: [horaCampo('Hora del envío (lunes)'), destinatariosCampo],
    defaultActivo: false,
    icono: BarChart2, color: STAT_CHIP.violet,
  },

  // ── 5. Reactivación de clientes ────────────────────────────────────────────
  {
    key: 'cliente_inactivo',
    nombre: 'Reactivación de Clientes',
    descripcion: 'Envía una promoción por WhatsApp a quienes llevan tiempo sin comprar.',
    canal: 'whatsapp', tipo: 'programada', audiencia: 'cliente',
    disparador: 'Clientes sin órdenes pagadas en el periodo configurado',
    idempotencia: 'cooldown', targetType: 'customer',
    configSchema: z.object({
      diasInactividad: z.coerce.number().int().min(7).max(730).default(45),
      cooldownHoras:   z.coerce.number().int().min(24).max(8760).default(60 * 24),
      textoPromo:      z.string().trim().min(1).max(200)
                        .default('un 10% de descuento en tu próximo pedido'),
      hora:            z.coerce.number().int().min(0).max(23).default(10),
    }),
    campos: [
      { name: 'diasInactividad', tipo: 'numero', label: 'Sin comprar hace más de',
        sufijo: 'días', min: 7, max: 730 },
      { name: 'cooldownHoras', tipo: 'numero', label: 'No volver a contactar antes de',
        sufijo: 'horas', min: 24, max: 8760, ayuda: 'Por cliente. 1440 horas = 60 días.' },
      { name: 'textoPromo', tipo: 'texto', label: 'Promoción que se ofrece', maxLength: 200,
        ayuda: 'Va dentro de la plantilla aprobada, como variable. Ej.: "un 10% de descuento en tu próximo pedido".' },
      horaCampo('Hora del barrido'),
    ],
    defaultActivo: false,
    icono: UserX, color: STAT_CHIP.pink,
    plantilla: {
      nombre: 'reactivacion_cliente', categoria: 'MARKETING', idioma: 'es',
      cuerpo:
        'Hola {{1}}, hace un tiempo no pasas por Café Nayoli y queremos verte de vuelta. ' +
        'Tenemos para ti {{2}} en tu próxima compra. ' +
        'Respóndenos por aquí y te ayudamos con el pedido.',
      variables: ['nombre del cliente', 'texto de la promoción (config)'],
    },
  },

  // ── 6. Confirmación de entrega ─────────────────────────────────────────────
  {
    key: 'orden_entregada',
    nombre: 'Confirmación de Entrega',
    descripcion: 'Agradece al cliente por WhatsApp cuando su pedido queda entregado.',
    canal: 'whatsapp', tipo: 'evento', audiencia: 'cliente',
    disparador: 'Cuando una entrega cambia a estado "entregado"',
    idempotencia: 'una_vez', targetType: 'order',
    configSchema: z.object({}),
    campos: [],
    defaultActivo: false,
    icono: CheckCircle, color: STAT_CHIP.emerald,
    plantilla: {
      nombre: 'orden_entregada', categoria: 'UTILITY', idioma: 'es',
      cuerpo:
        'Hola {{1}}, tu orden {{2}} fue entregada. ' +
        'Gracias por elegir Café Nayoli, esperamos que la disfrutes. ' +
        'Si algo no salió bien, respóndenos por aquí y lo resolvemos.',
      variables: ['nombre del cliente', 'número de orden'],
    },
  },

  // ── 7–9. Sugeridas por el asesor — llegan APAGADAS ─────────────────────────
  // Existen en el catálogo para que el owner las descubra y las encienda cuando
  // quiera; ninguna corre hasta que él lo decida (defaultActivo: false, y sin fila
  // en AutomationSetting tampoco corren).

  {
    key: 'contraentrega_sin_cobrar',
    nombre: 'Contraentrega sin cobrar',
    descripcion: 'Avisa cuánta plata llevas en la calle: contraentregas despachadas que siguen sin cobrarse.',
    canal: 'interno', tipo: 'programada', audiencia: 'equipo',
    disparador: 'Órdenes por cobrar despachadas hace más de los días configurados',
    idempotencia: 'semanal', targetType: 'order',
    configSchema: z.object({
      diasDespachada: z.coerce.number().int().min(1).max(90).default(3),
      hora:           z.coerce.number().int().min(0).max(23).default(9),
    }),
    campos: [
      { name: 'diasDespachada', tipo: 'numero', label: 'Despachada hace más de',
        sufijo: 'días', min: 1, max: 90 },
      horaCampo('Hora del barrido'),
    ],
    defaultActivo: true, // canal interno — ver la regla en AutomationCanal
    severidad: 'alerta',
    icono: Wallet, color: STAT_CHIP.amber,
  },

  {
    key: 'envio_estancado',
    nombre: 'Envío estancado',
    descripcion: 'Detecta entregas que llevan demasiado en ruta — problema real u olvido de marcarlas.',
    canal: 'interno', tipo: 'programada', audiencia: 'equipo',
    disparador: 'Entregas en ruta hace más de los días configurados',
    idempotencia: 'diaria', targetType: 'shipping',
    configSchema: z.object({
      diasEnRuta: z.coerce.number().int().min(1).max(60).default(2),
      hora:       z.coerce.number().int().min(0).max(23).default(9),
    }),
    campos: [
      { name: 'diasEnRuta', tipo: 'numero', label: 'En ruta hace más de',
        sufijo: 'días', min: 1, max: 60 },
      horaCampo('Hora del barrido'),
    ],
    defaultActivo: true, // canal interno — ver la regla en AutomationCanal
    severidad: 'alerta',
    icono: Truck, color: STAT_CHIP.sky,
  },

  {
    key: 'resumen_diario',
    nombre: 'Resumen diario',
    descripcion: 'Correo al equipo cada mañana con lo de ayer y los despachos programados para hoy.',
    canal: 'email', tipo: 'programada', audiencia: 'equipo',
    disparador: 'Todos los días a la hora configurada',
    idempotencia: 'diaria', targetType: 'global',
    configSchema: z.object({
      hora:          z.coerce.number().int().min(0).max(23).default(7),
      destinatarios: z.string().trim().default(''),
    }),
    campos: [horaCampo('Hora del envío'), destinatariosCampo],
    defaultActivo: false,
    icono: Sunrise, color: STAT_CHIP.orange,
  },

  // ── 10–12. Campana del operador (v1 de notificaciones internas) ────────────
  // Las tres son canal `interno`: le hablan al operador en su propio panel, así
  // que nacen encendidas (regla en AutomationCanal). No cuestan un peso ni
  // dependen de Meta — el aviso ES el producto.

  {
    key: 'orden_recibida',
    nombre: 'Orden nueva en la tienda',
    descripcion: 'Avisa en la campana cuando entra una orden que nadie tecleó: del storefront o de cualquier canal de entrada futuro.',
    canal: 'interno', tipo: 'evento', audiencia: 'equipo',
    disparador: 'Cuando se crea una orden desde fuera del admin',
    idempotencia: 'una_vez', targetType: 'order',
    configSchema: z.object({}),
    campos: [],
    defaultActivo: true,
    // Una venta no es una alarma: badge en primario, no en rojo.
    severidad: 'info',
    icono: ShoppingBag, color: STAT_CHIP.emerald,
  },

  {
    key: 'entrega_sin_cobro',
    nombre: 'Entregado sin cobrar',
    descripcion: 'La orden llegó a su destino pero el dinero no entró. Avisa una sola vez por orden, pasadas las horas configuradas.',
    canal: 'interno', tipo: 'programada', audiencia: 'equipo',
    disparador: 'Órdenes entregadas sin pago registrado tras las horas configuradas',
    idempotencia: 'una_vez', targetType: 'order',
    configSchema: z.object({
      horasEntrega: z.coerce.number().int().min(1).max(720).default(HORAS_ENTREGA_SIN_COBRO),
    }),
    campos: [
      { name: 'horasEntrega', tipo: 'numero', label: 'Avisar cuando la entrega lleve',
        sufijo: 'horas', min: 1, max: 720,
        ayuda: 'Desde el momento en que se marcó entregada. Un aviso por orden: cuando el mensajero liquide, deja de importar.' },
    ],
    // SIN campo `hora`: es un umbral en HORAS, así que se evalúa en cada corrida
    // del cron horario. Ponerle hora fija lo volvería un barrido diario y el
    // umbral de 24h se convertiría en "entre 24 y 48h", según cuándo cayera.
    defaultActivo: true,
    severidad: 'alerta',
    icono: HandCoins, color: STAT_CHIP.alert,
  },

  {
    key: 'entrega_fallida',
    nombre: 'Entrega fallida',
    descripcion: 'El pedido volvió: nadie recibió, dirección mala o el cliente rechazó. Requiere decidir qué se hace con esa orden.',
    canal: 'interno', tipo: 'evento', audiencia: 'equipo',
    disparador: 'Cuando una entrega cambia a estado "fallido"',
    idempotencia: 'cooldown', targetType: 'shipping',
    configSchema: z.object({
      // Una entrega fallida se reprograma (fallido → preparando) y puede volver a
      // fallar: cada intento fallido ES noticia, así que NO se usa `una_vez`. El
      // cooldown corto solo absorbe un doble PATCH del mismo intento.
      cooldownHoras: z.coerce.number().int().min(1).max(720).default(6),
    }),
    campos: [
      { name: 'cooldownHoras', tipo: 'numero', label: 'Esperar antes de repetir el aviso',
        sufijo: 'horas', min: 1, max: 720,
        ayuda: 'Por entrega. Un reintento que vuelve a fallar más tarde sí avisa de nuevo: cada intento perdido es plata y tiempo.' },
    ],
    defaultActivo: true,
    severidad: 'alerta',
    icono: PackageX, color: STAT_CHIP.alert,
  },
];

// ─── Solapes DELIBERADOS del catálogo ────────────────────────────────────────
// Una MISMA orden contraentrega puede disparar `contraentrega_sin_cobrar` y
// `entrega_sin_cobro`, y eso NO es un duplicado que haya que arreglar: son dos
// momentos distintos del mismo dinero, y el segundo es una ESCALADA del primero.
//
//   contraentrega_sin_cobrar → despachada hace N días y aún sin cobrar. La plata
//     está EN LA CALLE. Mide desde `stock_descontado_at` (el despacho), en días,
//     y se repite semanalmente mientras el saldo siga vivo.
//   entrega_sin_cobro → YA SE ENTREGÓ hace N horas y el dinero no entró. El
//     mensajero volvió con la mercancía entregada y sin liquidar: es más grave y
//     más urgente. Mide desde `fecha_entrega`, en horas, una sola vez por orden.
//
// Silenciar una porque "ya avisó la otra" perdería justo la señal de la escalada.
// Si al owner le sobra ruido, la respuesta es apagar UNA en su toggle, no
// fusionarlas.

// ─── Acceso ──────────────────────────────────────────────────────────────────

export const AUTOMATION_MAP: Record<string, AutomationDef> = Object.fromEntries(
  AUTOMATIONS.map(a => [a.key, a]),
);

export const AUTOMATION_KEYS: string[] = AUTOMATIONS.map(a => a.key);

/** Una key es válida sólo si el registry la reconoce. Gate de toda entrada externa. */
export function isAutomationKey(key: unknown): key is string {
  return typeof key === 'string' && key in AUTOMATION_MAP;
}

/**
 * Configuración efectiva de una automatización: defaults del registry con los
 * overrides guardados encima. Un JSON viejo, incompleto o corrupto NO rompe el
 * barrido — degrada a los defaults. Gate ÚNICO de lectura de config; nadie lee
 * `AutomationSetting.config` crudo.
 */
export function parseAutomationConfig(def: AutomationDef, stored: unknown): Record<string, unknown> {
  const parsed = def.configSchema.safeParse(stored ?? {});
  if (parsed.success) return parsed.data;
  return def.configSchema.parse({});
}

/** Enlaces profundos de las notificaciones internas — reusan los helpers compartidos. */
export const AUTOMATION_HREF = {
  // "Stock bajo" pregunta "¿qué repongo?", y esa cola vive en el carril "Por
  // reponer" de Productos desde que Inventario se encogió a auditoría (que no puede
  // filtrar por bajo-mínimo). Las notificaciones NUEVAS llevan este href directo;
  // las viejas —congeladas en `Notification.href` como `/admin/inventario?stock=…`—
  // las traduce `redirect-inventario` al MISMO destino.
  stockBajo:  RUTA_REPONER,
  porCobrar:  `/admin/pedidos?${POR_COBRAR_QUERY_PEDIDOS}`,
  entregas:   '/admin/entregas',
} as const;

/**
 * Enlace al detalle de UN pedido. `/admin/pedidos` abre su panel con
 * `?pedido=<numero_orden>` — por NÚMERO, no por id. Una notificación que no lleva
 * a la fila de la que habla obliga a buscarla a mano, que es justo el trabajo que
 * la campana debería ahorrar.
 *
 * ESTA FUNCIÓN ES UNA FÁBRICA DE DATOS, no un enlace más: lo que devuelve se
 * CONGELA en `Notification.href` al escribir la fila. Cambiarla sólo arregla las
 * notificaciones NUEVAS; las ya escritas siguen apuntando a `/admin/ordenes?order=`
 * para siempre, y de ésas se encarga el redirect de `proxy.ts` (§ lib/redirect-ordenes).
 * Son dos mecanismos para dos poblaciones, y hacen falta los dos.
 */
export function hrefOrden(numeroOrden: string): string {
  return `/admin/pedidos?pedido=${encodeURIComponent(numeroOrden)}`;
}
