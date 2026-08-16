import { ADMIN_NAV } from '@/constants/admin-nav';

// ─── QUÉ SECCIONES PIDEN ATENCIÓN · el registro que reemplaza a la constante ──
//
// El punto sol nació con UNA sección, así que era una constante en dos archivos:
//
//   const RUTA_CON_ATENCION = '/admin/pedidos';   // Sidebar.tsx y MobileNav.tsx
//
// y su comentario dejaba escrito el disparador: "cuando una segunda sección tenga
// la suya, esto se vuelve un mapa y el endpoint devuelve una bandera por sección
// — no antes: generalizar con un solo caso es inventar la forma equivocada con la
// mitad de la información". Productos es esa segunda sección, así que se cumple.
//
// ── LA SEGUNDA SECCIÓN ES PRODUCTOS, Y SU REGLA YA EXISTÍA ──────────────────
//
// No se inventa un criterio: es `isLowStock`, la MISMA definición que ya cuenta
// la card "Alertas de Stock" del dashboard, la que recorta el carril "Por reponer"
// de Productos y —vía `cruzoMinimo`— la que dispara la automatización `stock_bajo`.
// Un criterio propio acá haría que el punto y la card contaran distinto lo mismo.
//
// ── DOS NOTAS QUE HAY QUE TENER ESCRITAS (owner) ────────────────────────────
//
// 1 · EL PUNTO Y LA CAMPANA HABLAN DEL MISMO HECHO, Y NO SE CONTRADICEN.
//     La campana notifica el CRUCE del mínimo (`cruzoMinimo`: estaba por encima y
//     quedó por debajo) — un EVENTO, que pasa una vez. El punto refleja el ESTADO
//     VIGENTE (`isLowStock`) — un SALDO, que sigue siendo cierto hasta que alguien
//     repone. Son el asiento y el saldo del mismo libro, no dos opiniones.
//     Sin esto escrito, en dos meses alguien ve "la campana avisó una vez y el
//     punto sigue encendido" y lo reporta como defecto.
//
// 2 · AGOTADO ⊂ STOCK BAJO. Un producto en cero cumple `isLowStock` siempre, así
//     que si algún día hay dos carriles, el segundo es un RECORTE del primero y no
//     un conjunto aparte. Es el mismo par que "Por cobrar" ⊂ "pendiente", que ya
//     tiene su sección explicando por qué se ven contradictorios y no lo son.
//
// ── LO QUE NO ES ATENCIÓN, Y TAMBIÉN VA DICHO ───────────────────────────────
//
// `!activo` (un producto sin publicar) NO entra. Es una decisión deliberada del
// operador, no una cola: no se vacía sola y no pide nada. Por § `lib/carriles.ts`
// es un ACUMULADOR — merece carril si filtrar sirve, sin número, y no toca el sol.
// La maqueta lo dibuja con número ("Sin publicar · 1"); no se la sigue.

/** Una sección del panel que puede pedir atención. */
export interface SeccionConAtencion {
  /** Clave estable, snake_case — la que viaja en el payload del endpoint. */
  key: string;
  /** La ruta del NAV que lleva el punto. Tiene que existir en `ADMIN_NAV`. */
  path: string;
}

/**
 * EL registro. Agregar una sección es una entrada acá y un contador en el
 * endpoint; nada más. Las dos mitades están amarradas por los tests de este
 * archivo, así que ninguna puede quedarse a medias en silencio.
 */
export const SECCIONES_CON_ATENCION: readonly SeccionConAtencion[] = [
  { key: 'pedidos',   path: '/admin/pedidos' },
  // La ruta es la de la SECCIÓN, no la de una implementación: mientras el
  // rediseño conviva en una ruta con sufijo, el punto sigue viviendo en la
  // entrada del menú, que es la que el operador ve.
  { key: 'productos', path: '/admin/productos' },
];

/** Lo que el endpoint reporta de UNA sección. */
export interface ConteoAtencion {
  hay:   boolean;
  total: number;
}

/**
 * El mapa completo, por clave de sección.
 *
 * `Partial` a propósito, igual que `ConteosDeCola`: una sección puede faltar
 * —porque su contador falló, o porque el cliente habla con un servidor viejo— y
 * el tipo obliga a tratar la ausencia en vez de leer un cero inventado.
 */
export type MapaAtencion = Partial<Record<string, ConteoAtencion>>;

/**
 * ¿La sección de esta ruta del nav pide atención?
 *
 * La búsqueda es por RUTA porque es lo que el nav tiene en la mano al pintar cada
 * fila. Una ruta sin sección registrada devuelve `false` —no `undefined`— porque
 * la pregunta del nav es binaria: el punto se pinta o no. No existe un punto
 * "apagado" (§ `.duna-nav-dot`: si no hay nada que atender, no se renderiza).
 */
export function atencionDeRuta(mapa: MapaAtencion, path: string): boolean {
  const seccion = SECCIONES_CON_ATENCION.find(s => s.path === path);
  if (!seccion) return false;
  return mapa[seccion.key]?.hay === true;
}

/** Las rutas del registro, para que el nav no tenga que conocer las claves. */
export function rutasConAtencion(): string[] {
  return SECCIONES_CON_ATENCION.map(s => s.path);
}

/**
 * ¿Toda sección registrada apunta a una ruta que el menú de verdad tiene?
 *
 * Existe para el test, y el test existe porque el modo de falla es MUDO: una
 * ruta mal tecleada acá no rompe nada — el `find` no matchea, `atencionDeRuta`
 * devuelve `false`, y el punto simplemente no se enciende nunca. Es exactamente
 * la clase de defecto que nadie reporta porque nada se ve roto.
 */
export function rutasHuerfanas(): string[] {
  const delMenu = new Set(ADMIN_NAV.map(i => i.path));
  return SECCIONES_CON_ATENCION.filter(s => !delMenu.has(s.path)).map(s => s.path);
}
