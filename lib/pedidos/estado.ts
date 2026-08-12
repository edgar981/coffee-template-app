import { progress, type Progress, type BadgeTone } from '@duna/design-system/status';
import { isPorCobrar } from '@duna/core/metrics/order-stat-filters';
import type { OrderStatus, CondicionPago } from '@/types/order';
import type { ShippingEstado } from '@/types/shipping';

// ─── CÓMO SE LEE UNA ORDEN · las DOS mitades de una sola decisión ────────────
//
// Un pedido tiene dos ejes ortogonales y cada uno tiene su vehículo:
//
//   FULFILLMENT (¿dónde va?)  → los STEPS. Es una posición en una secuencia.
//   COBRO       (¿está pago?) → el BADGE. Son estados en REPOSO.
//
// Van juntas en un archivo porque son una sola decisión leída de dos lados: el
// badge puede limitarse a estados de reposo PRECISAMENTE porque el progreso vive
// en los steps. El sistema lo hace imposible de romper —`BadgeTone` no tiene un
// tono "en curso"— pero la razón por la que esa ausencia no deja un hueco es
// ésta, y conviene tenerla en un solo sitio.

// ─── STEPS · la secuencia canónica ───────────────────────────────────────────
//
// CUATRO etapas, y son de FULFILLMENT solamente. El pago NO es una de ellas, y
// eso no es una simplificación: meterlo rompería en CONTRAENTREGA, donde la plata
// entra DESPUÉS de la entrega. Una secuencia "Recibido → Pagado → Preparando →
// …" pondría el pago antes del despacho para un caso que es de primera clase en
// este negocio. Los dos ejes son ortogonales; forzarlos en una línea hace mentir
// a la línea.
export const ETAPAS_PEDIDO = ['Recibido', 'Preparando', 'En camino', 'Entregado'] as const;

/** Lo mínimo que estas reglas necesitan. Estructural, no el tipo entero. */
export interface OrdenParaEstado {
  estado: OrderStatus;
  condicion_pago: CondicionPago;
  shipping?: { estado: ShippingEstado | string } | null;
}

/**
 * Posición del pedido en la secuencia de fulfillment.
 *
 * `null` para una orden CANCELADA, y es la decisión más consecuente de acá: un
 * pedido cancelado no tiene progreso que mostrar. Su recorrido se anuló —el envío
 * pasa a `cancelado` y el stock despachado se reintegra— así que una barra de
 * progreso ahí invita a leerlo como vivo. "Cancelado" es un DESTINO, no una etapa,
 * y por eso el encargo lo lista como su propio filtro y no como parte del camino.
 *
 * Y hay una razón dura además de la de producto: una vez cancelada, `Shipping.estado`
 * ES `cancelado` y la etapa que había alcanzado se PERDIÓ de la fila. Vive sólo en el
 * `estado_anterior` del asiento de anulación, que la LISTA no carga. O sea que ni
 * siquiera se podría dibujar una barra "detenida en donde llegó" sin pedir el libro
 * de cada orden — que es justo lo que el payload evita.
 */
export function pasosDelPedido(orden: OrdenParaEstado): Progress | null {
  if (orden.estado === 'cancelado') return null;

  const envio = orden.shipping;
  // Sin envío todavía: la orden existe y nada más. Es el estado normal de una
  // ANTICIPADO sin pagar (el envío se auto-crea al cobrar), no una anomalía.
  if (!envio) return progress(ETAPAS_PEDIDO, 0);

  switch (envio.estado) {
    case 'preparando': return progress(ETAPAS_PEDIDO, 1);
    // Una entrega FALLIDA se queda en la etapa donde falló: salió y no llegó. No
    // retrocede a "Preparando" — eso sólo pasa al reprogramarla, que es un acto
    // del operador y mueve el estado de verdad. Que además pide atención lo dice
    // `motivosDeAtencion`, no los steps: el camino y la alarma son cosas distintas.
    case 'en_ruta':
    case 'fallido':    return progress(ETAPAS_PEDIDO, 2);
    case 'entregado':  return progress(ETAPAS_PEDIDO, ETAPAS_PEDIDO.length - 1, true);
    // Envío anulado con la orden viva: no debería existir (anular es efecto de
    // cancelar la orden), pero si aparece se trata como lo que es — un recorrido
    // sin camino que mostrar. Preferir callar a dibujar un progreso inventado.
    case 'cancelado':  return null;
    // Estado desconocido: mismo criterio. Un progreso equivocado dice dónde está
    // el pedido, y decirlo mal es peor que no decirlo.
    default:           return null;
  }
}

// ─── BADGE DE COBRO · sólo estados en REPOSO ─────────────────────────────────

export interface BadgeCobro {
  label: string;
  tone: BadgeTone;
}

/**
 * El estado de COBRO como badge. Nunca puede decir "en camino": `BadgeTone` no
 * tiene ese tono y el progreso vive en `pasosDelPedido`.
 *
 * ── EL ÁMBAR ES LA EXCEPCIÓN, NO EL DEFAULT ─────────────────────────────────
 *
 * "Sin acreditar" y "Contraentrega" van NEUTROS. Son el estado NORMAL de un
 * pedido recién creado, y pintarlos de ámbar teñiría la lista entera — que es
 * exactamente lo que Amber Minimal prohíbe (mismo argumento por el que "Sin
 * programar" es neutro en la columna de Entrega). El sol significa una cosa sola:
 * esto necesita tu atención AHORA.
 *
 * El único cobro que sí la necesita es la contraentrega YA DESPACHADA sin cobrar
 * —la plata está en la calle—, y ése escala a "Por cobrar" en ámbar. Se consume
 * `isPorCobrar` de core, jamás se reimplementa: si esta pantalla tuviera su propia
 * idea de qué es una cuenta por cobrar, dejaría de cuadrar con la tarjeta del
 * dashboard y con la lista de Órdenes.
 *
 * ── Y SÓLO ESCALA EN LA LISTA ───────────────────────────────────────────────
 *
 * En el DETALLE, "Saldo pendiente" y la condición de pago ya están dichos en la
 * sección de Pago: el chip sería una tercera forma de decir lo mismo. Etiquetar la
 * excepción sirve donde no hay contexto; donde lo hay, es ruido. Es la decisión
 * del owner del 2026-08-06, aplicada a la pantalla nueva — no una inconsistencia
 * entre las dos vistas.
 */
export function badgeCobro(orden: OrdenParaEstado, vista: 'lista' | 'detalle'): BadgeCobro {
  // Terminal y primero: una orden cancelada no es "sin acreditar", está muerta.
  if (orden.estado === 'cancelado') return { label: 'Cancelado', tone: 'problem' };
  if (orden.estado === 'pagado')    return { label: 'Pagado',    tone: 'ok' };

  if (vista === 'lista' && isPorCobrar(orden)) {
    return { label: 'Por cobrar', tone: 'attention' };
  }
  return orden.condicion_pago === 'CONTRAENTREGA'
    ? { label: 'Contraentrega', tone: 'neutral' }
    : { label: 'Sin acreditar', tone: 'neutral' };
}
