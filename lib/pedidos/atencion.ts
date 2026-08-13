import { isPorCobrar } from '@duna/core/metrics/order-stat-filters';
import { hasScheduleData, isScheduledShipping, missingToDispatch } from '@/constants/shippings';
import { cuantosSinVerificar } from '@/lib/comprobante';
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

export type MotivoTipo =
  | 'por_cobrar' | 'programacion_a_medias' | 'entrega_fallida' | 'comprobante_sin_verificar';

/**
 * Un motivo, CON EL DATO QUE LO CAUSÓ.
 *
 * ── POR QUÉ NO ES UN UNION DE STRINGS ───────────────────────────────────────
 *
 * Lo era, y por eso la pantalla podía decir QUÉ pedidos piden atención pero no POR
 * QUÉ. El owner lo descubrió operando: una orden seguía marcada después de
 * registrar el pago porque tenía un SEGUNDO comprobante sin verificar, y tuvo que
 * irse a la pantalla vieja a averiguarlo. Un aviso que no dice qué lo causó obliga
 * a investigar — lo contrario de lo que "Necesita tu atención" promete.
 *
 * ── Y POR QUÉ ES UNIÓN DISCRIMINADA Y NO `{ tipo, cantidad? }` ─────────────
 *
 * Porque `cantidad?` no puede cargar el `falta` de la programación a medias, y ese
 * motivo sin decir CUÁL de los dos falta tiene exactamente el mismo defecto:
 * manda a abrir el modal para averiguarlo. Con la unión, además, el compilador
 * EXIGE el dato — no se puede escribir la redacción de `comprobante_sin_verificar`
 * sin su `cantidad`. Es la misma clase de garantía que la ausencia del tono azul
 * en `BadgeTone`: no depende de que alguien se acuerde.
 *
 * Los otros dos son binarios de verdad: "despachada sin cobrar" y "la entrega
 * falló" no admiten un número ni un matiz que cambie qué hacer.
 */
export type MotivoAtencion =
  /** Contraentrega despachada sin cobro: la plata está en la calle. */
  | { tipo: 'por_cobrar' }
  /** La entrega salió y no llegó. */
  | { tipo: 'entrega_fallida' }
  /** Se empezó a programar y quedó a medias. `falta` dice cuál de los dos. */
  | { tipo: 'programacion_a_medias'; falta: 'mensajero' | 'fecha' }
  /** Llegaron soportes y `cantidad` de ellos siguen sin mirar. */
  | { tipo: 'comprobante_sin_verificar'; cantidad: number };

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

  if (isPorCobrar(orden)) motivos.push({ tipo: 'por_cobrar' });

  // A MEDIAS = empezó a programarse y NO está lista para despachar. Se componen
  // los dos predicados que ya gatean el despacho; sin `hasScheduleData` esto
  // marcaría toda entrega recién creada, que es el estado normal y no una brecha.
  if (hasScheduleData(envio) && !isScheduledShipping(envio)) {
    // CUÁL falta lo dice `missingToDispatch`, que ya lo calcula para el board de
    // Entregas, la fila de Órdenes y el modal. No puede devolver null acá —hay
    // datos parciales y el envío está en `preparando`, que son justo sus
    // condiciones— pero el `?? 'mensajero'` evita que un cambio futuro en ese
    // helper rompa el tipo en silencio. Mismo recurso que en `entrega-estado`.
    motivos.push({ tipo: 'programacion_a_medias', falta: missingToDispatch(envio) ?? 'mensajero' });
  }

  if (envio?.estado === 'fallido') motivos.push({ tipo: 'entrega_fallida' });

  // El CONTEO, no el booleano: es el dato que el motivo necesita para decir "1
  // comprobante sin verificar" y no "comprobante sin verificar" a secas. Sale de
  // `cuantosSinVerificar`, la definición base de la que `tienePendienteDeVerificar`
  // ahora se deriva — una sola opinión sobre qué es "sin verificar".
  const sinVerificar = cuantosSinVerificar(orden.comprobantes ?? []);
  if (sinVerificar > 0) motivos.push({ tipo: 'comprobante_sin_verificar', cantidad: sinVerificar });

  return motivos;
}

// ─── LA REDACCIÓN ────────────────────────────────────────────────────────────
//
// Vive acá, al lado de la regla, y no en el componente: es el estilo de la casa y
// tiene su razón —`lib/entrega-estado.ts` y `etiquetaTransicion` hacen lo mismo—
// porque el VOCABULARIO es la decisión de producto y así se puede afirmar en la
// capa 1. Un `if` de plural cambiado dentro del JSX rompería el texto sin que nada
// lo notara.
//
// Son HECHOS, no instrucciones: "La entrega falló", no "…y hay que reprogramarla".
// Misma regla que los insights. El motivo dice qué pasa; qué hacer lo decide el
// operador, que para eso está en el detalle.

/** El texto de un motivo, con su número y su plural ya resueltos. */
export function textoDeMotivo(motivo: MotivoAtencion): string {
  switch (motivo.tipo) {
    // "Contraentrega" NO se repite acá: ya está en el badge de cobro del mismo
    // detalle, y decirlo otra vez sería la tercera vez en la pantalla.
    case 'por_cobrar':     return 'Despachada sin cobrar';
    case 'entrega_fallida': return 'La entrega falló';
    case 'programacion_a_medias':
      return motivo.falta === 'mensajero'
        ? 'Falta el mensajero para despachar'
        : 'Falta la fecha para despachar';
    case 'comprobante_sin_verificar':
      return `${motivo.cantidad} ${motivo.cantidad === 1 ? 'comprobante' : 'comprobantes'} sin verificar`;
  }
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
