// ─── El COPY de las confirmaciones de una orden ──────────────────────────────
//
// Vivía dentro de `app/(admin)/admin/ordenes/page.tsx`, sin exportar. Sale acá
// porque `/admin/pedidos` ofrece las mismas dos confirmaciones y copiarlas habría
// dejado dos versiones del mismo texto — y en estos dos casos el TEXTO ES LA
// DECISIÓN, no decoración: es lo único que le dice al operador qué va a pasar
// antes de que pase. Dos copias divergiendo significan que una de las dos
// pantallas empieza a mentir sobre las consecuencias.
//
// Cada una ya era "copy ÚNICO" dentro de su pantalla, compartido entre la fila y
// el detalle. Esto extiende esa misma regla a la segunda pantalla.

/**
 * Cancelar orden.
 *
 * `cancelado` es la otra cara de `Order.estado` —la de CANCELACIÓN, no la de
 * cobro— y sí es una transición legítima que el server acepta.
 *
 * Qué le pasa al Payment al cancelar: NADA. `transitionOrder` anula el envío y
 * reintegra el stock despachado, pero no toca el pago. La decisión de negocio de
 * "pagos sobre canceladas" es una conversación aparte; acá sólo se conserva y se
 * declara el comportamiento actual.
 */
export const CANCELAR_ORDEN_COPY = {
  title:        'Cancelar orden',
  consequence:  'La orden se marca como CANCELADA (no se elimina: es un registro auditable). Si tiene un envío, se anula y el stock ya despachado se reintegra. Un pago registrado, si lo hubiera, NO se modifica aquí.',
  confirmLabel: 'Cancelar orden',
  busyLabel:    'Cancelando…',
} as const;

/**
 * Rechazar comprobante.
 *
 * El copy es lo que vuelve DESCUBRIBLE que rechazar no borra y que se puede
 * adjuntar el correcto: el mecanismo de corrección existía y nada lo decía, así
 * que era invisible justo cuando hace falta. Va con `confirmKind: 'default'`
 * (ámbar, no rojo) porque no destruye nada.
 */
export const RECHAZAR_COMPROBANTE_COPY = {
  title:        'Rechazar comprobante',
  consequence:  'Quedará marcado como rechazado y NO se elimina: el archivo se conserva como constancia de que se revisó. Podrás adjuntar el comprobante correcto en esta misma orden.',
  confirmLabel: 'Rechazar comprobante',
} as const;
