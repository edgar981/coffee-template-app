import { formatFecha } from '@duna/core/format-fecha';
import { hasScheduleData, isScheduledShipping, missingToDispatch } from '@/constants/shippings';
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

// ─── La acción ÚNICA de la fila ──────────────────────────────────────────────
//
// La fila de Órdenes no ofrece un menú de fulfillment: ofrece EL siguiente paso.
// "Editar entrega" murió al montar el centro de mando — editar una programación
// ya hecha, reprogramar una fallida y cualquier caso raro viven en el detalle,
// que es donde está el contexto para decidirlos. Lo que queda en la fila es la
// transición que el estado permite, y sólo una.
//
// Es una función pura y no un `if` en el JSX por lo de siempre: qué acción se
// ofrece en cada estado es la decisión, y dentro de un componente una condición
// cambiada la rompería sin que nada lo notara.
//
// `despachar_bloqueado` NO es un caso aparte inventado acá: es el mismo gate de
// `isScheduledShipping` que aplican el board, el detalle y el servidor. Se
// muestra deshabilitado DICIENDO qué falta en vez de esconderse, porque una
// acción ausente manda al operador a buscarla en otra pantalla — y lo que falta
// se completa en el detalle.
export type AccionFilaEntrega =
  | { tipo: 'ninguna' }
  | { tipo: 'programar' }
  | { tipo: 'despachar' }
  | { tipo: 'despachar_bloqueado'; falta: 'mensajero' | 'fecha' }
  | { tipo: 'entregar' };

export function accionFilaEntrega(orden: OrdenParaEntrega): AccionFilaEntrega {
  if (orden.estado === 'cancelado') return { tipo: 'ninguna' };

  const s = orden.shipping;
  // Sin registro de envío: el primer paso es programarlo (el Shipping lo crea el
  // servidor al abrir el modal, idempotente).
  if (!s) return { tipo: 'programar' };

  if (s.estado === 'preparando') {
    if (isScheduledShipping(s)) return { tipo: 'despachar' };
    if (hasScheduleData(s)) {
      // `missingToDispatch` no puede devolver null acá (hay datos parciales y el
      // estado es preparando), pero el fallback evita que un refactor de ese
      // predicado deje la fila sin acción en silencio.
      return { tipo: 'despachar_bloqueado', falta: missingToDispatch(s) ?? 'mensajero' };
    }
    return { tipo: 'programar' };
  }

  if (s.estado === 'en_ruta') return { tipo: 'entregar' };

  // fallido (reprogramar), entregado y cancelado: la fila calla. Reprogramar es
  // una decisión que necesita ver por qué falló, y eso está en el detalle.
  return { tipo: 'ninguna' };
}

// ─── La fecha de la ENTREGA, para su propia columna ──────────────────────────
//
// El chip dice el ESTADO y la columna dice el CUÁNDO: dos preguntas, dos sitios.
// Colgar la fecha del chip la hacía crecer distinto en cada fila y obligaba a
// leer una etiqueta entera para encontrar un dato que se escanea en vertical.
//
// Qué fecha es depende del estado, y no es un detalle: una entrega ya hecha se
// mide por cuándo LLEGÓ (`fecha_entrega`, que estampa el servidor), y una que no
// por cuándo se PROMETIÓ (`fecha_programada`). Mostrar la programada de algo ya
// entregado diría la fecha equivocada justo en la fila que alguien va a citar.
// Es el mismo criterio de la columna del board de Entregas.
//
// La fecha de CREACIÓN ya no vive en la lista: es dato del detalle. Ojo — el
// filtro de rango del encabezado sigue filtrando por creación, que ahora es una
// columna invisible.
export function fechaEntrega(orden: OrdenParaEntrega): string {
  const s = orden.shipping;
  if (!s || s.estado === 'cancelado' || orden.estado === 'cancelado') return '—';
  // `formatFecha` ya devuelve '—' para vacío/nulo.
  return s.estado === 'entregado'
    ? formatFecha(s.fecha_entrega)
    : formatFecha(s.fecha_programada);
}
