// LA COMPOSICIÓN «COMPRA» de `featured` («Selección del mes») — § NAYOLI-HOME-COMPRA-1. PURO
// (capa 1): sin red, sin DOM. Reusa la MATRIZ de la Taquilla (`derivarMatrizTaquilla`,
// `lib/tienda/taquilla.ts`, sin modificarla) — filas = presentación (categoria), columnas = tamaño
// (peso_gramos) — y decide, por celda, lo que el componente necesita para pintar los dos selectores
// independientes y la nota de precio por 100 g. El componente
// (`components/storefront/home/FeaturedProductsCompra.tsx`) es quien monta React; este archivo sólo
// las reglas, para poder afirmarlas en un test sin levantar el DOM.
//
// SIN MATRIZ VÁLIDA, la composición cae SOLA a la canónica (`cuadricula`) — mismo patrón que
// «Taquilla»/«Láminas» caen a «Actual» en `TiendaCatalogo.tsx`: `debeCaerAComposicionPorDefecto`
// nombra esa misma pregunta (`derivarMatrizTaquilla(catalogo) === null`) para que el componente no
// repita el criterio a mano.

import type { Product } from '@/types/product';
import { derivarMatrizTaquilla, celdaDe, type MatrizTaquilla } from '@/lib/tienda/taquilla';

/** El precio por 100 g, redondeado — `Math.round((precio / pesoGramos) * 100)`. Un peso ausente o
 *  no positivo no puede dividir: devuelve 0 en vez de `NaN`/`Infinity`, que el componente nunca
 *  debe mostrar. */
export function precioPor100Gramos(precio: number, pesoGramos: number): number {
  if (!Number.isFinite(precio) || !Number.isFinite(pesoGramos) || pesoGramos <= 0) return 0;
  return Math.round((precio / pesoGramos) * 100);
}

/** La etiqueta del primer eje (presentación) — el LITERAL de `categoria`, la MISMA regla que la
 *  fila de la Taquilla de /tienda (`TiendaTaquilla.tsx`, `CeldaFila`: `{categoria}` a secas). */
export function etiquetaEje1(categoria: string): string {
  return categoria;
}

/** La etiqueta del segundo eje (tamaño) — `"{peso} g"`, la MISMA regla que la columna de la
 *  Taquilla de /tienda (`TablaTaquilla`: `{peso} g`). */
export function etiquetaEje2(pesoGramos: number): string {
  return `${pesoGramos} g`;
}

/** La leyenda de "qué se está viendo" (pie de foto / barra fija) — `"{peso} g · {categoria}"`,
 *  compuesta de los dos ejes, en ESE orden (el de la maqueta aprobada). */
export function captionSeleccion(pesoGramos: number, categoria: string): string {
  return `${etiquetaEje2(pesoGramos)} · ${etiquetaEje1(categoria)}`;
}

/** El ÍCONO declarado para una opción del primer eje — set cerrado `'grano'|'molido'`, cualquier
 *  otro valor (vacío, basura, `'ninguno'`) es "sin ícono". SOFT: nunca lanza. */
export function iconoDeOpcion(valor: string | undefined): 'grano' | 'molido' | null {
  return valor === 'grano' || valor === 'molido' ? valor : null;
}

/** La línea de ayuda de la opción `indiceFila` del primer eje — posicional (§ el spec: "en el
 *  orden en que la matriz las muestra"): una fila sin su propia ayuda no hereda la de otra ni
 *  corre las demás, simplemente no muestra línea. */
export function ayudaParaFila(ayudas: readonly (string | undefined)[], indiceFila: number): string | undefined {
  const v = ayudas[indiceFila];
  return v && v.trim() !== '' ? v : undefined;
}

export interface FilaDatoCompra {
  rotulo: string;
  valor: string;
}

/** Una fila de datos se muestra SÓLO con rótulo Y valor presentes — una de las dos cosas sueltas
 *  no dice nada (un rótulo sin valor, o un valor sin rótulo que lo explique). */
export function filaDatoVisible(rotulo: string | undefined, valor: string | undefined): boolean {
  return !!rotulo?.trim() && !!valor?.trim();
}

/** Las filas de datos VISIBLES, en el mismo orden que llegaron — hasta 3, pero el filtro no asume
 *  un largo fijo. */
export function filasDeDatosVisibles(filas: readonly { rotulo?: string; valor?: string }[]): FilaDatoCompra[] {
  return filas
    .filter((f) => filaDatoVisible(f.rotulo, f.valor))
    .map((f) => ({ rotulo: f.rotulo!, valor: f.valor! }));
}

/** ¿Esta composición cae SOLA a la canónica? — la MISMA pregunta que ya resuelve
 *  `derivarMatrizTaquilla(catalogo) !== null`, nombrada para el componente (mismo criterio que
 *  `taquillaActiva`, `lib/tienda/taquilla.ts`: una sola función, no un segundo chequeo igual). */
export function debeCaerAComposicionPorDefecto(catalogo: readonly Product[]): boolean {
  return derivarMatrizTaquilla(catalogo) === null;
}

export interface OpcionEje1 {
  categoria: string;
  /** Agotada = el producto de esta categoría, CRUZADO con el peso activo, no está disponible. */
  agotada: boolean;
}

/** Las opciones del primer eje (presentación), cruzadas contra el PESO activo — cada botón
 *  pregunta "¿este café, en el tamaño que ya elegiste, está disponible?" (mismo criterio que la
 *  Taquilla de suscripción: agotado = tachado y no elegible, no un botón oculto). */
export function opcionesEje1(matriz: MatrizTaquilla, pesoActivo: number): OpcionEje1[] {
  return matriz.filas.map((categoria) => ({
    categoria,
    agotada: !matriz.celdas.get(celdaDe(categoria, pesoActivo))!.disponible,
  }));
}

export interface OpcionEje2 {
  peso: number;
  precio: number;
  agotada: boolean;
}

/** Las opciones del segundo eje (tamaño), cruzadas contra la CATEGORÍA activa — gemela de
 *  `opcionesEje1`, con el precio de la celda (lo que cada fila de tamaño muestra). */
export function opcionesEje2(matriz: MatrizTaquilla, categoriaActiva: string): OpcionEje2[] {
  return matriz.columnas.map((peso) => {
    const p = matriz.celdas.get(celdaDe(categoriaActiva, peso))!;
    return { peso, precio: p.precio, agotada: !p.disponible };
  });
}
