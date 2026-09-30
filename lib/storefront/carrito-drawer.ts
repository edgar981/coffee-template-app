// lib/storefront/carrito-drawer.ts — § CARRITO-Y-MENU-MOVIL-CAFEONE-1
//
// Las clases del cajón del carrito bajo la composición FLOTANTE (`carrito.variante`, § MUESTRARIO-
// CARRITO-COMPOSICION-1), MISMO patrón que `lib/storefront/pdp-botones.ts` (`clasesBotonesCompra`):
// un eje de tema de 2 valores -> un bundle de clases, PURO, sin JSX -- `CartDrawer.tsx` sólo las
// aplica. AUSENTE/`'anclado'` es BYTE-IDÉNTICO a lo que el JSX ya traía antes de este slice; nada
// de esa rama cambia.
//
// `MUESTRARIO-CARRITO-COMPOSICION-1` (2026-09-26) ya resolvió la posición/color/radio del cajón y
// el tamaño de su título (`CartTitulo`, que se queda donde está -- sigue viviendo en
// `CartDrawer.tsx` porque es JSX, § su propio docstring: el carril no puede montar `<CartDrawer/>`
// entero sin `CartProvider`, así que lo que SÍ depende de JSX se afirma por render en
// `cromo-carrito.test.ts`, fuera de `touches:` de este slice). Ese slice dejó fuera, A PROPÓSITO,
// la fila Nota|Descuento y la nota de impuestos (pedido explícito del owner) -- las dos SIGUEN
// fuera acá, por la misma razón, reafirmada por el owner en este slice.
//
// Este archivo completa el RESTO de la composición que quedó pendiente: el estado vacío, la caja
// de cantidad, y el CTA del pie.

export type ClaveCarritoVariante = 'anclado' | 'flotante';

export interface ComposicionCarrito {
  /** El texto del CTA primario del pie. AUSENTE/`'anclado'`: "Ir al Checkout", el de HOY.
   *  `'flotante'`: "Pagar" -- el texto que el owner pidió explícitamente para el botón primario,
   *  distinto tanto del "Finalizar compra" del prototipo local como del "Ir al Checkout" de hoy. */
  ctaLabel: string;
  /** ¿Se muestra un botón secundario "Ver carrito"? Sólo si HAY una página real a la que apuntar
   *  -- hoy el storefront no declara `/carrito` (`app/(storefront)/`), así que el llamador
   *  siempre pasa `paginaCarritoExiste=false` (§ el porqué es un parámetro y no una constante,
   *  abajo) y esto da `false` siempre. El día que esa página exista, cambia el LLAMADOR, no esta
   *  función -- el owner fue explícito: "si no existe, sólo el primario, no inventes rutas". */
  mostrarBotonSecundario: boolean;
  /** El ícono de la ilustración del carrito vacío. AUSENTE/`'anclado'`: `--sf-tostado`, el tono
   *  de HOY. `'flotante'`: `--sf-acento-texto` -- el MISMO rol que ya pinta el ícono de la bolsa
   *  en la cabecera del cajón (`CartDrawer.tsx`, la línea de arriba de este mismo componente), no
   *  un tercer tono nuevo. El defecto que esto cierra: `--sf-tostado` es la mezcla cálida-y-CLARA
   *  del acento (§ RIEL-SCROLL-Y-BADGE-DORADO-1, `#d8a378` para CORTE) -- un tono crema/caramelo
   *  que el owner señaló como "todavía se siente Nayoli" incluso con el carrito vacío. */
  claseIconoVacio: string;
  /** El título "Tu carrito está vacío". AUSENTE/`'anclado'`: `font-medium`, la fuente de CUERPO
   *  de HOY. `'flotante'`: la fuente de TÍTULO (`font-playfair`), como el resto de los titulares
   *  del cajón bajo esta variante (`CartTitulo`). */
  claseTituloVacio: string;
  /** La caja de cantidad (−/cantidad/+). AUSENTE/`'anclado'`: píldora RELLENA
   *  (`bg-[var(--sf-superficie)]`), el tratamiento de HOY. `'flotante'`: caja con BORDE, sin
   *  relleno -- medido contra `.qty` del prototipo (`docs/prototipos/cafeone/css/
   *  app.css:758-761`, `border:1px solid var(--border-strong)`); "no nested cards" es la nota de
   *  diseño del cajón entero (`.drawer`, DS de Cafeone, § el comentario de cabecera de esa clase
   *  en el prototipo), y una píldora rellena dentro de una fila ya es una tarjeta anidada. El
   *  radio REUSA `--sf-radio-lg` (el rol de "chips/controles pequeños" que `formas.ts` YA conecta)
   *  en vez de un token nuevo -- el prototipo mide `--radius-sm` (4px) para esta caja, un valor
   *  DISTINTO del que `radioLg` ya declara (2px en 'recta'); la aproximación se reporta en el
   *  asiento de este slice (`open_followups`) en vez de agregar un rol nuevo sin verificación
   *  visual del owner. */
  claseCajaCantidad: string;
}

/**
 * La composición del cajón del carrito para una variante dada.
 *
 * `paginaCarritoExiste` es un parámetro EXPLÍCITO, no una constante interna: esta función no debe
 * saber qué rutas existen (eso es del router, no de una decisión de tema) -- el llamador (hoy,
 * `CartDrawer.tsx`) mide la existencia de `/carrito` y pasa el resultado. Hoy esa ruta NO existe,
 * así que el llamador pasa `false` siempre; el día que exista, el cambio va en el llamador, no acá.
 */
export function composicionCarrito(
  variante: ClaveCarritoVariante,
  paginaCarritoExiste: boolean,
): ComposicionCarrito {
  if (variante !== 'flotante') {
    return {
      ctaLabel: 'Ir al Checkout',
      mostrarBotonSecundario: false,
      claseIconoVacio: 'text-[var(--sf-tostado)]',
      claseTituloVacio: 'font-medium',
      claseCajaCantidad: 'bg-[var(--sf-superficie)]',
    };
  }
  return {
    ctaLabel: 'Pagar',
    mostrarBotonSecundario: paginaCarritoExiste,
    claseIconoVacio: 'text-[var(--sf-acento-texto)]',
    claseTituloVacio: 'font-playfair font-normal text-lg',
    claseCajaCantidad: 'sf-borde border-[var(--sf-linea)]',
  };
}
