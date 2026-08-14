import { formatFecha } from '@duna/core/format-fecha';
import { hasScheduleData, isScheduledShipping } from '@/constants/shippings';
import { isPorCobrar } from '@duna/core/metrics/order-stat-filters';
import type { SemaphoreTone } from '@/components/ui/StatusBadge';

// ─── El estado de entrega COMPUESTO ──────────────────────────────────────────
//
// `Shipping.estado` crudo no distingue una orden programada con fecha y mensajero
// de una que nadie ha tocado: las dos dicen "Preparando". El dato para separarlas
// ya existía —`hasScheduleData` / `isScheduledShipping`, los predicados del board
// de Entregas—; la columna de Órdenes simplemente no lo consumía.
//
// Esta función COMPONE ese estado y no lo redefine: `isScheduledShipping` es EL
// gate de despacho (UI + servidor) y acá se llama, jamás se reimplementa. Si
// alguna vez esta función decidiera por su cuenta qué es "lista para despacho",
// la lista y el botón podrían discrepar — que es el modo de falla que el board
// evitó desde el principio.
//
// Es pura y vive en `lib/` para poder afirmarse en la capa 1 (`npm test`): la
// decisión de producto de esta tanda ES el vocabulario, y un `if` de plural
// cambiado dentro de un componente rompería la respuesta a "¿dónde va este
// pedido?" sin que nada lo notara.

export type EstadoEntregaKey =
  | 'ninguno'        // no hay nada que mostrar (orden cancelada / entrega anulada)
  | 'sin_programar'
  | 'programada'
  | 'falta_fecha'
  | 'lista'
  | 'en_ruta'
  | 'entregada'
  | 'fallida';

export interface EstadoEntrega {
  key: EstadoEntregaKey;
  /** Texto del badge. Vacío sólo para `ninguno`. */
  etiqueta: string;
  /** Tono del semáforo único (components/ui/StatusBadge) — nunca un mapa propio. */
  tono: SemaphoreTone;
  /**
   * El matiz que NO merece una palabra en la columna, pero sí existe para
   * diagnóstico: va como `title` del badge. Es lo que separa "la orden no tiene
   * registro de envío" de "el envío existe y está vacío" sin gastar vocabulario
   * en una distinción que no cambia ninguna decisión desde la lista.
   */
  detalle: string;
  /**
   * Contraentrega despachada sin cobro — la plata está en la calle. Es la ÚNICA
   * excepción de pago que se etiqueta en la columna: el default (Anticipado,
   * Contraentrega aún no despachada) no lleva badge, por la misma regla que
   * mantiene la lista de Órdenes sin la píldora "Contraentrega".
   */
  porCobrar: boolean;
}

/** Lo mínimo que la función necesita de una orden — no `Order` entero, para que
 *  el test declare exactamente el caso que afirma. */
export interface OrdenParaEntrega {
  estado: string;
  condicion_pago?: string | null;
  shipping?: {
    estado:            string;
    mensajero?:        string | null;
    fecha_programada?: string | null;
    fecha_entrega?:    string | null;
  } | null;
}

const vacio = (detalle: string): EstadoEntrega => ({
  key: 'ninguno', etiqueta: '', tono: 'neutral', detalle, porCobrar: false,
});

export function estadoEntrega(orden: OrdenParaEntrega): EstadoEntrega {
  const s = orden.shipping;
  const porCobrar = isPorCobrar(orden);

  // Sin registro de envío: o no hay nada que programar (orden cancelada), o está
  // todo por hacer. Las dos comparten etiqueta con el envío creado-y-vacío de
  // abajo; lo que las separa es el `detalle`.
  if (!s) {
    return orden.estado === 'cancelado'
      ? vacio('La orden está cancelada: no hay entrega que programar.')
      : {
          key: 'sin_programar', etiqueta: 'Sin programar', tono: 'neutral',
          detalle: 'La orden todavía no tiene registro de envío.', porCobrar,
        };
  }

  // Entrega anulada = la orden se canceló. El estado de la orden ya lo dice en su
  // columna; repetirlo acá sería el mismo hecho dos veces en la misma fila.
  if (s.estado === 'cancelado') {
    return vacio('La entrega fue anulada al cancelar la orden.');
  }

  if (s.estado === 'entregado') {
    return {
      key: 'entregada',
      etiqueta: 'Entregada',
      tono: 'ok',
      detalle: porCobrar
        ? 'Entregada, pero el pago contraentrega todavía no se ha registrado.'
        : 'La entrega se completó.',
      porCobrar,
    };
  }

  if (s.estado === 'fallido') {
    return {
      key: 'fallida', etiqueta: 'Fallida', tono: 'danger',
      detalle: 'La entrega falló. Puede reprogramarse desde la orden o desde Entregas.',
      porCobrar,
    };
  }

  if (s.estado === 'en_ruta') {
    return {
      key: 'en_ruta', etiqueta: 'En ruta', tono: 'info',
      detalle: s.fecha_programada?.trim()
        ? `Despachada. Programada para el ${formatFecha(s.fecha_programada)}.`
        : 'Despachada.',
      porCobrar,
    };
  }

  if (s.estado === 'preparando') {
    // El gate de despacho, CONSUMIDO. Único caso que puede pasar a En Ruta.
    if (isScheduledShipping(s)) {
      return {
        key: 'lista', etiqueta: 'Lista para despacho',
        tono: 'info', detalle: 'Mensajero y fecha asignados: ya puede despacharse.',
        porCobrar,
      };
    }
    if (!hasScheduleData(s)) {
      return {
        key: 'sin_programar', etiqueta: 'Sin programar', tono: 'neutral',
        detalle: 'El envío está creado, pero sin mensajero ni fecha.',
        porCobrar,
      };
    }
    // Datos PARCIALES. Las dos mitades no son intercambiables: con fecha ya hay
    // un compromiso con el cliente y se imprime; sin fecha no hay nada que
    // prometerle, así que la etiqueta nombra lo que falta en vez de fingir una
    // programación.
    if (s.fecha_programada?.trim()) {
      return {
        key: 'programada', etiqueta: 'Programada',
        tono: 'warn', detalle: 'Falta asignar mensajero para poder despachar.',
        porCobrar,
      };
    }
    return {
      key: 'falta_fecha', etiqueta: 'Falta fecha', tono: 'warn',
      detalle: 'Hay mensajero asignado; falta la fecha programada para poder despachar.',
      porCobrar,
    };
  }

  // Inalcanzable con el enum actual (los cinco estados están cubiertos). Se
  // prefiere callar a inventar: un estado desconocido rotulado "Sin programar"
  // mandaría al operador a programar algo que quizá ya salió.
  return vacio(`Estado de entrega no reconocido: ${s.estado}`);
}
