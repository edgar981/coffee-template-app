import { isPorCobrar } from '@duna/core/metrics/order-stat-filters';
import { hasScheduleData, isScheduledShipping } from '@/constants/shippings';
import { tienePendienteDeVerificar } from '@/lib/comprobante';
import type { OrderStatus, CondicionPago } from '@/types/order';
import type { ShippingEstado } from '@/types/shipping';
import type { ComprobanteEstado } from '@/types/comprobante';

// ─── "NECESITAN ATENCIÓN" · UNA definición, DOS consumidores ─────────────────
//
// La consumen el pill de la lista y el PUNTO SOL del nav lateral. Que sea una
// sola función no es economía de código: si pudieran discrepar, el operador vería
// un punto de atención en el rail y al entrar no encontraría qué lo causó — un
// aviso que no se puede resolver es peor que ninguno. Una fuente, dos lecturas.
//
// ── EL CRITERIO, para clasificar un caso nuevo sin reabrir la discusión ──────
//
// Entra acá lo que es ACCIONABLE: algo que el operador puede hacer HOY sobre ese
// pedido. Es lo que le da sentido al sol bajo la doctrina de color —"esto necesita
// tu atención ahora"— y lo que impide que la categoría se llene de estados que
// sólo son informativos. Un pedido esperando pago anticipado no entra: no hay nada
// que hacer más que esperar.
//
// Los cuatro motivos REUSAN predicados que ya existen; ninguno se reimplementa.
// El día que una copia se desincronizara, el pill y la vista de origen (Entregas,
// Pagos, el dashboard) dejarían de reconciliar — que es el modo de falla que este
// repo ya pagó con `razonDelServidor` y `cruzoMinimo` duplicados.

export type MotivoAtencion =
  /** Contraentrega despachada sin cobro: la plata está en la calle. */
  | 'por_cobrar'
  /** El operador empezó a programar y quedó a medias (falta mensajero o fecha). */
  | 'programacion_a_medias'
  /** La entrega salió y no llegó: hay que reprogramarla. */
  | 'entrega_fallida'
  /** Llegó un soporte y nadie lo ha mirado. */
  | 'comprobante_sin_verificar';

export interface OrdenParaAtencion {
  estado: OrderStatus;
  condicion_pago?: CondicionPago | null;
  shipping?: {
    estado: ShippingEstado | string;
    mensajero?: string | null;
    fecha_programada?: string | null;
  } | null;
  comprobantes?: { estado: ComprobanteEstado }[] | null;
}

/**
 * Por qué este pedido pide acción. Lista vacía = no pide nada.
 *
 * Devuelve los MOTIVOS y no un booleano porque el booleano se deriva de ellos y
 * no al revés: así el pill puede contar, un tooltip puede decir por qué, y el test
 * puede afirmar cuál de los cuatro disparó en vez de sólo que algo disparó.
 */
export function motivosDeAtencion(orden: OrdenParaAtencion): MotivoAtencion[] {
  // CANCELADO es terminal y no pide nada, aunque arrastre un soporte sin mirar o
  // una programación a medias: no hay acción que tomar sobre un pedido anulado, y
  // el sol tiene que significar SIEMPRE lo mismo. Va primero para que ninguno de
  // los cuatro pueda encenderlo por su cuenta.
  if (orden.estado === 'cancelado') return [];

  const motivos: MotivoAtencion[] = [];
  const envio = orden.shipping;

  if (isPorCobrar(orden)) motivos.push('por_cobrar');

  // A MEDIAS = empezó a programarse y NO está lista para despachar. Se componen
  // los dos predicados que ya gatean el despacho; sin `hasScheduleData` esto
  // marcaría toda entrega recién creada, que es el estado normal y no una brecha.
  if (hasScheduleData(envio) && !isScheduledShipping(envio)) motivos.push('programacion_a_medias');

  if (envio?.estado === 'fallido') motivos.push('entrega_fallida');

  if (tienePendienteDeVerificar(orden.comprobantes ?? [])) motivos.push('comprobante_sin_verificar');

  return motivos;
}

/** ¿Este pedido pide acción? El pill de "Necesitan atención" filtra con esto. */
export const necesitaAtencion = (orden: OrdenParaAtencion): boolean =>
  motivosDeAtencion(orden).length > 0;

/**
 * ¿La sección Pedidos tiene algo que atender? Enciende el punto sol del nav.
 *
 * Es la MISMA definición que el pill, recorrida sobre la lista — no un conteo
 * paralelo. Y no existe un estado "apagado": si nada pide acción, el punto no se
 * renderiza (§ `.duna-nav-dot`).
 */
export const hayPedidosPorAtender = (ordenes: OrdenParaAtencion[]): boolean =>
  ordenes.some(necesitaAtencion);
