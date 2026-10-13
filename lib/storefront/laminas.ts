// LA COMPOSICIÓN «LÁMINAS» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3/§5 — "Láminas: escenas
// en formato álbum, de 3 a 6, con foto o ilustración y esquineros opcionales. Nuevas, elegibles por
// otras tiendas"). PURA (capa 1): sin red, sin DOM, sin fecha. Es la lógica de LAYOUT que la variante
// «Álbum» de `nosotrosEscenas` (§ NosotrosEscenasAlbum.tsx) necesita y que ninguna otra pieza del
// repo ya resuelve — distinta de `lib/tienda/laminas.ts` (el color por café de la composición
// «Láminas» de /tienda, un nombre compartido por coincidencia de la maqueta, no por el mismo concepto).
//
// AGNÓSTICA DEL ÍTEM: las tres funciones de abajo no conocen `foto`/`titulo`/`descripcion` — reciben
// un array genérico `T` con sólo el campo que cada una necesita filtrar (`foto`), así que sirven igual
// a una futura sección de /tienda o /suscripciones que adopte esta misma composición.

/** El tope de láminas que la composición dibuja (§ el spec: "de 3 a 6") — el PISO de 3 es una guía de
 *  contenido para la maqueta, no una validación: con 1 ó 2 láminas visibles la sección se muestra
 *  igual (mismo criterio que cualquier repeater, "lo que hay se muestra"); nunca más de 6. */
export const LAMINAS_MAX = 6;

/** Las láminas que SÍ se dibujan: filtra las sin foto (§ el criterio ya establecido por
 *  `NosotrosEscenas.tsx` — "sin foto, la escena no se muestra") y recorta al tope. El recorte se
 *  aplica DESPUÉS del filtro: una fila vacía entre dos llenas nunca "gasta" un cupo del tope. */
export function laminasVisibles<T extends { foto: string }>(
  items: readonly T[],
  max: number = LAMINAS_MAX,
): T[] {
  return items.filter((it) => it.foto.trim() !== '').slice(0, max);
}

/** El contador "02/05" del carrusel móvil (§ el spec, punto 3: "se asoma la siguiente y hay contador
 *  «02/05»"). `indiceVisible` es 0-based (la posición ENTRE LAS VISIBLES, no el slot original — mismo
 *  criterio que el número "01"/"02" de cada lámina); `total` es la cantidad de láminas visibles. Cada
 *  parte se rellena a DOS dígitos siempre, incluso con un total de un solo dígito ("01/03"), porque la
 *  maqueta fija el ancho en dos cifras para que el contador no salte de ancho al avanzar. */
export function contadorLamina(indiceVisible: number, total: number): string {
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${dosDigitos(indiceVisible + 1)}/${dosDigitos(total)}`;
}

/** El reparto en DOS páginas del álbum de escritorio (§ el spec, punto 3: "doble página de álbum (3 +
 *  2) con lomo punteado al centro"). La página IZQUIERDA se lleva el excedente cuando el total es
 *  impar (`Math.ceil`) — así 5 láminas dan 3+2, como la maqueta, y 3 dan 2+1 en vez de 1+2 (la página
 *  de apertura de un álbum nunca va más vacía que la de cierre). Con 0 ítems, las dos páginas quedan
 *  vacías; el llamador decide si eso oculta la sección entera (vía `laminasVisibles`, arriba). */
export function repartoPaginasLaminas<T>(items: readonly T[]): { izquierda: T[]; derecha: T[] } {
  const mitad = Math.ceil(items.length / 2);
  return { izquierda: items.slice(0, mitad), derecha: items.slice(mitad) };
}
