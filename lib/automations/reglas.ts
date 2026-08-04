// Las reglas PURAS de los disparadores de la campana. Sin Prisma, sin
// `server-only`, sin fechas implícitas: todo lo que decide "esto se avisa o no"
// vive aquí para poder testearse sin base de datos (mismo criterio que
// lib/metrics/insights.ts). Los handlers hacen las consultas y llaman a esto.
//
// El cruce del mínimo (disparador 2) NO está aquí a propósito: vive en
// lib/metrics/inventory-filters (`cruzoMinimo`), junto al `isLowStock` que pinta
// la card de Alertas de Stock. Separarlo de su predicado sería exactamente la
// divergencia que esa card no puede permitirse.

// ─── Disparador 1: orden nueva de canal NO-admin ─────────────────────────────

/**
 * QUIÉN creó el registro de la orden. NO es `Order.canal`, y la distinción es la
 * razón de que este tipo exista: `Order.canal` es el canal de VENTA (cómo llegó
 * el cliente: whatsapp, instagram, directo, referido) y el admin puede elegir
 * `directo` en Nueva Orden — exactamente el mismo valor que escribe el checkout
 * del storefront. Filtrar por `canal` no distingue una cosa de la otra.
 *
 * El origen es el CODE PATH, no un dato del formulario, así que lo declara quien
 * crea la orden y no se puede falsear desde el navegador. Sin columna nueva: no
 * se persiste porque nadie lo consume después del evento.
 */
export type OrderOrigen = 'storefront' | 'admin';

/**
 * La campana avisa de las órdenes que ENTRARON solas; nunca de las que el
 * operador acaba de teclear. Avisarle de lo que él mismo creó es ruido, y ruido
 * en la campana entrena a ignorarla entera.
 *
 * Expresado como "todo lo que no es admin" y no como "solo storefront" para que
 * un canal de entrada futuro (un bot de WhatsApp, un marketplace) notifique de
 * fábrica: el silencio debe ser la excepción explícita, no el default.
 */
export function esOrigenNotificable(origen: OrderOrigen): boolean {
  return origen !== 'admin';
}

// ─── Disparador 3: entregado sin cobrar ──────────────────────────────────────

/**
 * Horas entre la entrega y el aviso de que esa plata no entró.
 *
 * TODO(cliente): 24h es un placeholder — el umbral real sale de la sesión con el
 * cliente (punto 2 de la pendiente). Es el DEFAULT del `configSchema`, así que el
 * owner puede ajustarlo desde "Configurar" sin tocar código; cambiar esta
 * constante solo mueve el arranque de una tienda nueva.
 */
export const HORAS_ENTREGA_SIN_COBRO = 24;

/** Forma mínima que la regla necesita de la entrega. */
export interface EntregaRef {
  /** ISO-8601 estampado server-side en la transición a `entregado`. */
  fecha_entrega?: string | null;
}

/**
 * ¿La entrega ocurrió hace más de `horas` y sigue sin cobrarse?
 *
 * Recibe la orden YA filtrada a "pendiente + entregada" — esta función decide
 * únicamente lo temporal. Devuelve `false` ante una fecha ausente o impareseable
 * en vez de asumir el peor caso: sin instante de entrega no hay reloj que corra,
 * y un aviso fabricado sobre un dato roto es peor que ninguno.
 */
export function entregaVencidaSinCobro(
  entrega: EntregaRef,
  horas: number,
  now: Date,
): boolean {
  const t = Date.parse(entrega.fecha_entrega ?? '');
  if (Number.isNaN(t)) return false;
  return now.getTime() - t >= horas * 3_600_000;
}

/**
 * Instante de corte para el pre-filtro en DB. `fecha_entrega` es una columna de
 * TEXTO, no un DateTime: la comparación `lt` sobre el ISO funciona porque los
 * ISO-8601 en UTC ordenan igual lexicográficamente que cronológicamente, y todo
 * valor lo escribe el servidor con `toISOString()` (la UI nunca lo manda).
 *
 * Aun así es un pre-filtro, no la decisión: quien decide es
 * `entregaVencidaSinCobro` sobre las filas ya cargadas. Un valor heredado con
 * otro formato entra al lote y se evalúa de verdad en JS.
 */
export function corteEntregaISO(horas: number, now: Date): string {
  return new Date(now.getTime() - horas * 3_600_000).toISOString();
}

/** Horas enteras transcurridas desde la entrega — para el texto del aviso. */
export function horasDesdeEntrega(entrega: EntregaRef, now: Date): number | null {
  const t = Date.parse(entrega.fecha_entrega ?? '');
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 3_600_000);
}
