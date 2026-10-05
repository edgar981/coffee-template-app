// ─── EL MENSAJE DE WHATSAPP SEGÚN EL MOMENTO DEL PEDIDO ──────────────────────
//
// Antes, los TRES lugares del panel que abren WhatsApp al cliente —el detalle
// del pedido, el modal de agendar entrega y la ficha del cliente— armaban el
// mismo texto fijo a mano: "Hola {nombre completo}, te escribimos de {tienda}
// por tu pedido {número}". Ese texto no cambiaba si el pago ya se confirmó, si
// el pedido va en camino o si ya se entregó — y usaba el nombre completo, no
// sólo el primero.
//
// Este módulo es la ÚNICA fuente del texto: PURO (sin DOM, sin fetch), para que
// los tres llamadores arranquen del mismo lugar y no puedan divergir. No manda
// nada — sólo arma el STRING que el llamador mete en `customerWhatsappHref`
// (packages/core/src/whatsapp-link.ts), que abre `wa.me` con el texto como
// query param. Sin Meta, sin costo: abre WhatsApp y la tienda envía.
//
// Las plantillas viven como texto con HUECOS CON NOMBRE (`{nombre}`, `{tienda}`,
// `{pedido}`, `{rastreo}`, `{pago}`) para que el futuro slice de mensajes
// EDITABLES (PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1) pueda leerlas desde
// configuración sin tocar a ninguno de los tres llamadores — ellos siguen
// pidiendo "el mensaje de este momento", no un texto concreto.
//
// ─── MENSAJES EDITABLES (PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1) ─────────────
//
// El dueño/administrador puede reemplazar CINCO de las plantillas de arriba desde
// Configuración › «Mensajes al cliente»: los CUATRO momentos del pedido que tienen
// sentido para el cliente ('otro' queda FIJO — una orden cancelada/fallida no
// necesita un mensaje que alguien redacte) más el saludo sin pedido de la ficha del
// cliente. El override vive en `SiteSetting.mensajesWhatsapp` (JSON, § schema.prisma),
// y se pasa a `mensajeWhatsappPedido`/`mensajeWhatsappCliente` como tercer argumento
// — AUSENTE o vacío en una clave = el texto de fábrica de esta misma plantilla. Los
// tres llamadores no cambiaron de forma: siguen pidiendo "el mensaje de este
// momento", ahora con la config de por medio.

/**
 * Lo mínimo del pedido que decide el MOMENTO del mensaje. Son strings sueltos
 * —no `OrderStatus`/`ShippingEstado`— a propósito: el llamador que sólo tiene
 * el `Shipping` (sin el pago anidado, como `ScheduleDeliveryModal`) puede pasar
 * sólo `shippingEstado` y dejar `estado` afuera; el llamador que sólo tiene la
 * orden sin envío (el pedido recién creado) puede pasar sólo `estado`. Atarlo a
 * los tipos de dominio obligaría a los dos a fabricar el campo que no tienen.
 */
export interface PedidoParaMensaje {
  /** `OrderStatus`: 'pendiente' | 'pagado' | 'cancelado' (como string suelto). */
  estado?: string | null;
  /** `ShippingEstado`: 'preparando' | 'en_ruta' | 'entregado' | 'fallido' | 'cancelado'. */
  shippingEstado?: string | null;
}

export type MomentoPedido =
  | 'pago_pendiente'
  | 'pago_confirmado'
  | 'en_camino'
  | 'entregado'
  | 'otro';

/**
 * El MOMENTO se decide por el envío primero, y por el pago después — un envío
 * que ya avanzó (en camino, entregado) manda sobre la pregunta de si se cobró,
 * porque una orden CONTRAENTREGA puede estar despachada y seguir `pendiente` de
 * pago: ahí el mensaje correcto es "va en camino", no "falta el pago".
 *
 * `cancelado` (de la orden) gana sobre todo lo demás: una orden cancelada no
 * tiene "pago pendiente" ni "en camino" que ofrecer.
 */
export function momentoDePedido(pedido: PedidoParaMensaje): MomentoPedido {
  if (pedido.estado === 'cancelado') return 'otro';
  if (pedido.shippingEstado === 'entregado') return 'entregado';
  if (pedido.shippingEstado === 'en_ruta') return 'en_camino';
  if (pedido.shippingEstado === 'fallido' || pedido.shippingEstado === 'cancelado') return 'otro';
  // Shipping existente (preparando) implica que ya hay pago o que la orden es
  // contraentrega en curso — en ambos casos el mensaje de "ya lo preparamos" es
  // el correcto, no "falta pagar".
  if (pedido.estado === 'pagado' || pedido.shippingEstado === 'preparando') return 'pago_confirmado';
  return 'pago_pendiente';
}

/**
 * La primera palabra del nombre, con mayúscula inicial y el resto en minúscula
 * — así «CAMILO moya» da «Camilo», no «CAMILO». Sin nombre, string vacío (el
 * llamador decide qué hacer con el hueco vacío; ver `interpolar`).
 */
export function primerNombre(nombreCompleto: string | null | undefined): string {
  const palabra = (nombreCompleto ?? '').trim().split(/\s+/)[0] ?? '';
  if (!palabra) return '';
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

const PLANTILLAS: Record<MomentoPedido, string> = {
  pago_pendiente:
    'Hola {nombre}, te escribimos de {tienda} por tu pedido {pedido}. Quedó pendiente el pago; si necesitas ayuda para completarlo, respóndenos por aquí.',
  pago_confirmado:
    'Hola {nombre}, confirmamos el pago de tu pedido {pedido} en {tienda}. Ya lo estamos preparando.',
  en_camino:
    'Hola {nombre}, tu pedido {pedido} de {tienda} va en camino. Puedes seguirlo aquí: {rastreo}',
  entregado:
    'Hola {nombre}, ¿cómo te llegó tu pedido {pedido}? Gracias por comprar en {tienda}.',
  otro:
    'Hola {nombre}, te escribimos de {tienda} por tu pedido {pedido}.',
};

const PLANTILLA_SIN_PEDIDO = 'Hola {nombre}, te escribimos de {tienda}.';

/**
 * Los CINCO momentos que Configuración deja editar — los cuatro momentos del
 * pedido con mensaje propio ('otro' queda FIJO: una orden cancelada o con envío
 * fallido/cancelado no tiene un hecho positivo que anunciar) más el saludo sin
 * pedido de la ficha del cliente.
 */
export const MOMENTOS_EDITABLES = ['pago_pendiente', 'pago_confirmado', 'en_camino', 'entregado', 'saludo_cliente'] as const;
export type MomentoEditable = typeof MOMENTOS_EDITABLES[number];

/** El nombre EN PALABRAS de cada momento editable, para el campo de Configuración. */
export const MOMENTO_EDITABLE_LABEL: Record<MomentoEditable, string> = {
  pago_pendiente:  'Pago pendiente',
  pago_confirmado: 'Pago confirmado',
  en_camino:       'En camino',
  entregado:       'Entregado',
  saludo_cliente:  'Saludo en la ficha del cliente',
};

/** `SiteSetting.mensajesWhatsapp` ya resuelto: un override PARCIAL — la clave ausente
 *  (o con texto vacío) cae a la plantilla de fábrica de ese mismo momento. */
export type MensajesWhatsappGuardados = Partial<Record<MomentoEditable, string>>;

/** Tope de caracteres de un mensaje editable — "razonable" para un mensaje de WhatsApp.
 *  Ningún texto de fábrica llega ni a la mitad; vive ACÁ (no en el schema de validación)
 *  porque es la misma regla que corren el aviso temprano del panel y el PATCH que manda —
 *  una sola definición, dos alcances, como `MIN_ORDENES_INSIGHT`. */
export const MAX_LARGO_MENSAJE_WHATSAPP = 600;

/** La plantilla de FÁBRICA de un momento editable — la fuente única que tanto el
 *  renderer (abajo) como el editor de Configuración (para "Restaurar el texto por
 *  defecto") deben leer, para que las dos superficies no puedan divergir sobre cuál
 *  es "el texto por defecto". */
export function plantillaPorDefecto(momento: MomentoEditable): string {
  return momento === 'saludo_cliente' ? PLANTILLA_SIN_PEDIDO : PLANTILLAS[momento];
}

/**
 * SOFT: nunca lanza (§ CLAUDE.md, `parseMetodosPago` es el mismo criterio). Una fila
 * con JSON ajeno —manual, corrupto, de una versión futura— no debe tumbar el loader:
 * se descartan las claves que no son uno de los `MOMENTOS_EDITABLES`, y los valores
 * que no son un string no-vacío.
 */
export function parseMensajesWhatsapp(valor: unknown): MensajesWhatsappGuardados {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {};
  const out: MensajesWhatsappGuardados = {};
  for (const momento of MOMENTOS_EDITABLES) {
    const v = (valor as Record<string, unknown>)[momento];
    if (typeof v === 'string' && v.trim()) out[momento] = v;
  }
  return out;
}

/**
 * Sustituye `{clave}` por su valor y limpia el residuo de un hueco vacío: un
 * espacio que quedó pegado a una coma ("Hola , te escribimos") o un espacio doble.
 * Sin esto, un pedido sin nombre de cliente leería el hueco como un espacio
 * huérfano en vez de desaparecer limpio.
 *
 * Un hueco CONOCIDO-PERO-SIN-VALOR (la clave está en `huecos`, con '') sustituye
 * por vacío — es el caso de `{rastreo}` fuera del momento "en camino". Un hueco
 * DESCONOCIDO (la clave NO está en `huecos` — un nombre que no es ninguno de los
 * cinco que este módulo declara, típicamente un typo del dueño al editar) se deja
 * LITERAL: `{foo}` queda `{foo}` en el mensaje, para que el error se note en la
 * vista previa en vez de desaparecer en silencio.
 */
export function interpolar(plantilla: string, huecos: Record<string, string>): string {
  return plantilla
    .replace(/\{(\w+)\}/g, (match, clave: string) =>
      Object.prototype.hasOwnProperty.call(huecos, clave) ? huecos[clave] : match)
    .replace(/ +,/g, ',')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** La plantilla a usar para el momento `momento` del PEDIDO: el override guardado si
 *  existe y no está vacío, la de fábrica si no. `'otro'` NUNCA mira `overrides` — no es
 *  uno de los `MOMENTOS_EDITABLES`, así que no tiene override que ofrecer. */
function plantillaPedido(momento: MomentoPedido, overrides?: MensajesWhatsappGuardados): string {
  if (momento === 'otro') return PLANTILLAS.otro;
  const custom = overrides?.[momento];
  return custom && custom.trim() ? custom : PLANTILLAS[momento];
}

/**
 * El mensaje para un pedido concreto, en el momento que `momentoDePedido`
 * decida. `rastreo` y `pago` son opcionales: hoy no existe un enlace de pago
 * que compartir (no hay pasarela que genere uno para una orden pendiente), así
 * que ese hueco queda sin usar en las plantillas de hoy — está declarado para
 * que el slice de mensajes editables pueda ofrecerlo sin tocar este módulo ni
 * a sus llamadores.
 *
 * `overrides` es `SiteSetting.mensajesWhatsapp` ya resuelto (§ `parseMensajesWhatsapp`) —
 * opcional para no romper a nadie que todavía no lo tenga a mano (ningún llamador de
 * PEDIDOS-WHATSAPP-MENSAJES-1 lo pasaba).
 */
export function mensajeWhatsappPedido(
  pedido: PedidoParaMensaje,
  datos: {
    nombreCompleto?: string | null;
    tienda: string;
    numeroOrden: string;
    /** El enlace público de rastreo — requerido sólo para el momento "en camino". */
    rastreo?: string | null;
    /** Reservado para el enlace de pago, cuando exista (ver comentario arriba). */
    pago?: string | null;
  },
  overrides?: MensajesWhatsappGuardados,
): string {
  const momento = momentoDePedido(pedido);
  return interpolar(plantillaPedido(momento, overrides), {
    nombre: primerNombre(datos.nombreCompleto),
    tienda: datos.tienda,
    pedido: datos.numeroOrden,
    rastreo: datos.rastreo ?? '',
    pago: datos.pago ?? '',
  });
}

/** El saludo sin pedido de por medio — la ficha del cliente. `overrides`, igual que en
 *  `mensajeWhatsappPedido`. */
export function mensajeWhatsappCliente(
  nombreCompleto: string | null | undefined,
  tienda: string,
  overrides?: MensajesWhatsappGuardados,
): string {
  const custom = overrides?.saludo_cliente;
  const plantilla = custom && custom.trim() ? custom : PLANTILLA_SIN_PEDIDO;
  return interpolar(plantilla, { nombre: primerNombre(nombreCompleto), tienda });
}

/**
 * El enlace público de rastreo (`/rastrear-pedido`), que el momento "en camino"
 * necesita. `origen` lo trae el llamador (`window.location.origin` en el
 * cliente) — este módulo es puro y no toca `window`. Con `email`, la página de
 * rastreo precarga los dos campos y consulta sola; sin él, el cliente escribe
 * su correo a mano (sigue siendo un enlace válido).
 */
export function rastreoUrl(origen: string, numeroOrden: string, email?: string | null): string {
  const qs = new URLSearchParams({ orden: numeroOrden });
  if (email) qs.set('email', email);
  return `${origen}/rastrear-pedido?${qs.toString()}`;
}
