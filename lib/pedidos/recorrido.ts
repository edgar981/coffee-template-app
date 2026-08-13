import type { OrderStatus, OrderStatusTransition } from '@/types/order';
import type { ShippingEstado } from '@/types/shipping';

// ─── EL RECORRIDO DEL PEDIDO ─────────────────────────────────────────────────
//
// Convierte el libro de transiciones (append-only, los DOS ejes) en la lista de
// hechos que el detalle pinta. Puro y en `lib/` por el criterio de siempre: el
// VOCABULARIO es la decisión de producto de esta pantalla, y un `if` cambiado
// dentro de un componente rompería la respuesta a "¿qué pasó con este pedido?"
// sin que nada lo notara. Mismo lugar y mismo motivo que `lib/entrega-estado.ts`.
//
// No vive en @duna/core: las etiquetas son PRESENTACIÓN (y están en español).
// Core es agnóstico de tenant y de presentación.

/** Un hecho del recorrido, ya resuelto para la primitiva `Timeline` del DS. */
export interface PasoRecorrido {
  titulo: string;
  /** ISO. Quien renderiza lo formatea (el DS no formatea fechas). */
  cuando: string;
  /** `null` = sin humano detrás, o —si es derivado— no consta quién. */
  actor: string | null;
  /**
   * `undefined` a propósito: no todo hecho tiene posición en una secuencia.
   * Ver la regla del `now` más abajo.
   */
  estado?: 'done' | 'now';
  /**
   * `true` = NO salió del libro; se dedujo de un timestamp que la orden ya tenía
   * (§ grandfathering). Lo expone la regla para que la pantalla pueda decirlo —
   * un recorrido corto porque no hay registro no es lo mismo que uno corto porque
   * no pasó nada, y el operador no puede distinguirlos si nadie se lo dice.
   */
  derivado: boolean;
}

// ─── VOCABULARIO ─────────────────────────────────────────────────────────────
//
// La etiqueta depende de los TRES datos, no sólo del estado nuevo: `null→pendiente`
// es "Pedido creado" y `pagado→pendiente` es "Pago revertido"; `null→preparando`
// es "Envío creado" y `fallido→preparando` es "Entrega reprogramada". Colapsarlo a
// un mapa por estado destino diría lo mismo para hechos opuestos.
//
// Los mapas se tipan `Record<OrderStatus,…>` y `Record<ShippingEstado,…>` para que
// agregar un estado al dominio SIN etiqueta no compile. Es la única forma de que
// esto no se desincronice en silencio: el libro guarda strings (cada eje tiene su
// vocabulario, por eso no son enums), así que sin este acople el compilador no
// tendría de dónde agarrarse.

const COBRO: Record<OrderStatus, string> = {
  pendiente: 'Pago revertido',   // sólo se alcanza con un `from` no nulo (ver abajo)
  pagado:    'Pago registrado',
  cancelado: 'Pedido cancelado',
};

const FULFILLMENT: Record<ShippingEstado, string> = {
  preparando: 'Envío en preparación',
  en_ruta:    'Despachado',
  entregado:  'Entregado',
  fallido:    'Entrega fallida',
  cancelado:  'Envío anulado',
};

/** Etiquetas de los hechos que la derivación honesta puede afirmar. Son LAS MISMAS
 *  que las del libro a propósito: es el mismo hecho, y decirlo con otras palabras
 *  haría creer que es otra cosa. */
export const TITULO_CREADO   = 'Pedido creado';
export const TITULO_PAGADO   = COBRO.pagado;
export const TITULO_ENTREGADO = FULFILLMENT.entregado;

/**
 * Etiqueta de UN asiento. Un valor fuera del vocabulario conocido —imposible hoy,
 * porque los cinco escritores sólo producen los de arriba— se muestra CRUDO en
 * vez de omitirse: un recorrido al que le falta un hecho miente por omisión, y eso
 * es peor que una etiqueta fea. Es la asimetría opuesta a la de `estadoEntrega`,
 * donde callar era lo correcto porque el fallback habría sido un CONSEJO errado;
 * acá el fallback es un HECHO, y un hecho feo sigue siendo cierto.
 */
export function etiquetaTransicion(t: Pick<OrderStatusTransition, 'eje' | 'estado_anterior' | 'estado_nuevo'>): string {
  if (t.eje === 'cobro') {
    if (t.estado_anterior === null) return TITULO_CREADO;
    return COBRO[t.estado_nuevo as OrderStatus] ?? t.estado_nuevo;
  }
  if (t.estado_anterior === null)      return 'Envío creado';
  if (t.estado_anterior === 'fallido' && t.estado_nuevo === 'preparando') return 'Entrega reprogramada';
  return FULFILLMENT[t.estado_nuevo as ShippingEstado] ?? t.estado_nuevo;
}

// ─── GRANDFATHERING · sólo lo que EXISTE ─────────────────────────────────────
//
// Las órdenes anteriores al libro no tienen asientos y NO se backfillean con datos
// fabricados. De ellas sólo se pueden afirmar tres hechos, cada uno respaldado por
// un timestamp REAL que la orden ya tenía:
//
//   Creado    ← Order.createdAt          (siempre)
//   Pagado    ← Payment.fecha            (sólo si hay Payment)
//   Entregado ← Shipping.fecha_entrega   (sólo si está entregado)
//
// NO derivable y por tanto NO se muestra: confirmado, preparando, en_ruta,
// cancelado. No hay timestamp real de ninguno. Mentirle al operador sobre su
// propio negocio es peor que mostrarle menos.
//
// ── LA DERIVACIÓN NO ES "SI NO HAY ASIENTOS", ES "DONDE EL LIBRO CALLA" ──────
//
// El encargo la planteaba como el caso de una orden SIN asientos, y eso deja un
// agujero que además está garantizado: una orden anterior al libro que alguien
// CANCELE hoy pasa a tener un asiento —el de la cancelación— y con la regla
// "¿tiene asientos?" su recorrido mostraría "Pedido cancelado" y NADA MÁS,
// escondiendo su propia creación. Se derivan por tanto los hechos que el libro no
// cubre, hecho por hecho. Cada uno sigue saliendo de un timestamp real; lo único
// que cambia es que la ausencia se evalúa por HECHO y no por orden.

/** Lo mínimo que la regla necesita de una orden. Estructural, no el tipo entero:
 *  así el test arma casos sin inventar veinte campos que no mira nadie. */
export interface OrdenParaRecorrido {
  createdAt: string;
  transiciones?: OrderStatusTransition[] | null;
  payments?: { fecha: string }[] | null;
  shipping?: { estado: ShippingEstado | string; fecha_entrega?: string | null } | null;
  /** Eje de cobro, para saber si el pedido sigue en curso (ver la regla del `now`). */
  estado: OrderStatus;
}

const tieneCobro = (ts: OrderStatusTransition[], to: OrderStatus) =>
  ts.some(t => t.eje === 'cobro' && t.estado_nuevo === to);

const esFecha = (v?: string | null): boolean => !!v && !Number.isNaN(Date.parse(v));

export function recorridoDelPedido(orden: OrdenParaRecorrido): PasoRecorrido[] {
  const libro = orden.transiciones ?? [];

  const pasos: PasoRecorrido[] = libro.map(t => ({
    titulo:   etiquetaTransicion(t),
    cuando:   t.occurred_at,
    actor:    t.actor_nombre,
    derivado: false,
  }));

  // ── Derivados, sólo donde el libro calla ──────────────────────────────────
  // "Creado": el asiento de creación es el único con `estado_anterior === null`
  // en el eje de cobro. Si no está, `createdAt` lo afirma igual — y esa columna
  // no es una deducción, es cuándo se creó la fila.
  if (!libro.some(t => t.eje === 'cobro' && t.estado_anterior === null)) {
    pasos.push({ titulo: TITULO_CREADO, cuando: orden.createdAt, actor: null, derivado: true });
  }
  // "Pagado": lo respalda la EXISTENCIA de un Payment, que es la definición misma
  // de que la plata entró. Se toma el primero (los pagos vienen ascendentes).
  const primerPago = orden.payments?.[0];
  if (primerPago && !tieneCobro(libro, 'pagado')) {
    pasos.push({ titulo: TITULO_PAGADO, cuando: primerPago.fecha, actor: null, derivado: true });
  }
  // "Entregado": exige las DOS cosas — el envío entregado Y una fecha real que se
  // pueda PARSEAR. `Shipping.fecha_entrega` es una columna de TEXTO; hoy la
  // escribe siempre el servidor con `toISOString()`, pero el criterio del repo con
  // ese campo ya está fijado (§ `entregaVencidaSinCobro`): sin fecha o con una
  // impareseable, no se afirma nada. Un hecho sin su momento, en una línea de
  // tiempo, es justamente el dato fabricado que esta regla existe para no producir.
  const env = orden.shipping;
  if (env?.estado === 'entregado' && esFecha(env.fecha_entrega)
      && !libro.some(t => t.eje === 'fulfillment' && t.estado_nuevo === 'entregado')) {
    pasos.push({ titulo: TITULO_ENTREGADO, cuando: env.fecha_entrega!, actor: null, derivado: true });
  }

  // ── ORDEN: el más reciente ARRIBA ─────────────────────────────────────────
  // La pregunta del operador es "¿qué pasó con este pedido?", y la respuesta más
  // valiosa es la última; el recorrido cronológico se lee bajando. Es además la
  // forma del HTML de referencia del sistema.
  //
  // Se compara PARSEANDO, no como texto. Los ISO comparan bien entre sí sólo si
  // todos traen la misma precisión: `…:18.464Z` vs `…:18Z` se ordenan al revés
  // como strings, porque el '.' va antes que la 'Z'. Y acá se mezclan tres
  // fuentes distintas (el libro, `Payment.fecha` y la columna de TEXTO
  // `fecha_entrega`), así que la uniformidad no es algo que esta función pueda
  // asumir. El desempate por título mantiene la salida estable cuando dos hechos
  // comparten momento — que en el libro no pasa (medido), pero sí puede pasar
  // entre un derivado y un asiento.
  pasos.sort((a, b) =>
    Date.parse(b.cuando) - Date.parse(a.cuando) || a.titulo.localeCompare(b.titulo));

  // ── EL `now` ──────────────────────────────────────────────────────────────
  // Todo lo que está en la lista OCURRIÓ, así que todo va `done`. El `now` —el
  // punto con el anillo del sol— marca "acá está el pedido AHORA", y eso sólo se
  // puede afirmar con dos condiciones:
  //
  //   · el pedido NO terminó (ver `terminado`), y
  //   · el hecho más reciente salió DEL LIBRO.
  //
  // La segunda es la que no es obvia y es la que sostiene la honestidad del
  // grandfathering: en una orden anterior al libro, que "Pedido creado" sea el
  // último hecho DERIVABLE no significa que sea el último que pasó — significa que
  // no hay registro de lo demás. Marcarlo `now` afirmaría que el pedido está ahí
  // parado, que es exactamente el tipo de cosa que no consta.
  const primero = pasos[0];
  return pasos.map((p, i) => ({
    ...p,
    estado: i === 0 && !terminado(orden) && primero && !primero.derivado ? 'now' : 'done',
  }));
}

/**
 * ¿El pedido TERMINÓ? Hace falta mirar LOS DOS EJES.
 *
 * ── EL BUG QUE LO INSTAURA ──────────────────────────────────────────────────
 *
 * Esto era `orden.estado !== 'cancelado'`: un solo eje (cobro) y uno solo de sus
 * tres valores. Nunca preguntaba si el fulfillment había terminado, así que
 * CUALQUIER orden no cancelada era "en curso" para siempre y su hecho más reciente
 * se llevaba el anillo del sol.
 *
 * El bug era de toda orden terminada, no de un caso raro. En una ANTICIPADO pagada
 * y entregada el último asiento es "Entregado" y el sol cae ahí: se ve plausible.
 * Lo hizo visible una CONTRAENTREGA, donde el pago llega DESPUÉS de la entrega y el
 * sol quedaba sobre "Pago registrado" — un pedido cerrado anunciándose como el
 * lugar donde hay algo pasando.
 *
 * Lo delataba también que `pasosDelPedido` sí trataba `entregado` como terminal
 * (`done: true`): la card decía terminado y la timeline decía en curso, sobre el
 * mismo pedido. Dos vistas del mismo hecho discrepando es la señal de que una de
 * las dos usa una definición incompleta.
 *
 * ── LA DEFINICIÓN ───────────────────────────────────────────────────────────
 *
 * Un pedido terminó si está CANCELADO (aborto, terminal por sí solo), o si la
 * mercancía llegó Y la plata entró. Las dos mitades, porque los ejes son
 * ortogonales: entregado sin cobrar SIGUE pidiendo algo —es literalmente el motivo
 * de atención "Despachada sin cobrar"— y pagado sin entregar también.
 *
 * Se lee `Order.estado === 'pagado'` y no la existencia de un Payment porque ese
 * campo ES el espejo del cobro y su único escritor es el path de dinero (§ El eje
 * de COBRO se escribe una sola vez): fiel por construcción.
 */
function terminado(orden: OrdenParaRecorrido): boolean {
  if (orden.estado === 'cancelado') return true;
  return orden.shipping?.estado === 'entregado' && orden.estado === 'pagado';
}

/** ¿El recorrido tiene algún hecho deducido? La pantalla lo usa para decirlo: un
 *  recorrido corto porque falta registro no es uno corto porque no pasó nada. */
export const tieneDerivados = (pasos: PasoRecorrido[]) => pasos.some(p => p.derivado);
