// lib/storefront/galeria.ts — § FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1
//
// La aritmética PURA de navegar la galería de la ficha con las flechas (`components/storefront/pdp/
// GaleriaProducto.tsx`). Separada de `lib/storefront/pdp-galeria.ts` a propósito: ese archivo resuelve
// OTRO problema — qué `initial` le pasa a framer-motion para que la imagen principal nunca dependa de
// una animación para hacerse visible, y a qué imagen cae `imgIdx` si queda fuera de rango tras
// navegar client-side entre productos — mientras que este archivo sólo decide EL ÍNDICE SIGUIENTE al
// pulsar una flecha. Mezclar los dos en un archivo habría acoplado dos decisiones que cambian por
// razones distintas.
//
// EN BUCLE, no deshabilitado en los extremos — MISMO criterio que ya usa `Spotlight.tsx`
// (`irAVista`, `(indiceActual + direccion + vistas.length) % vistas.length`): una ficha de producto
// rara vez trae más de 3-4 fotos, y deshabilitar la flecha en el extremo (obligando a usar la otra
// flecha para volver) es más fricción que ganancia en una lista corta. La referencia del gate
// (`cafeone-pdp-galeria-flechas.png`) tampoco muestra un estado deshabilitado — las dos flechas están
// siempre activas.

export type DireccionGaleria = 1 | -1;

/**
 * El índice siguiente al pulsar una flecha de la galería. Bucle: pasar la última foto lleva a la
 * primera, y viceversa. Con `total <= 1` no hay a dónde navegar — devuelve el mismo índice recibido
 * (el llamador ya no debe mostrar flechas con una sola foto o ninguna; esta función es segura aunque
 * lo hiciera).
 */
export function siguienteIndiceGaleria(actual: number, total: number, direccion: DireccionGaleria): number {
  if (total <= 1) return actual;
  return (actual + direccion + total) % total;
}
