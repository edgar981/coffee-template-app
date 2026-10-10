// EL CATÁLOGO · COMPOSICIÓN «TAQUILLA» (§ TIENDA-ONIX-CARTELERA-1). PURO (capa 1): sin red, sin DOM.
// Deriva la matriz presentación × tamaño DIRECTO del catálogo real — "No requiere backend" (§ el
// spec, item 2): filas por `categoria`, columnas por `peso_gramos`, cada celda un producto EXISTENTE.
// Sin set cerrado nuevo, sin campo de SiteContent que mapee celda→producto: el catálogo YA es la
// fuente, como `colorDeLamina` deriva de `catalogo[i]` en vez de un mapa a mano.
//
// LA VALIDEZ ES BINARIA (matriz completa o no), nunca parcial — un catálogo con huecos no "llena lo
// que puede": cae ENTERO a «Actual» (§ TiendaCatalogo.tsx, el mismo patrón que «Láminas» cae a
// «Actual» con más de 6 productos). Mostrar una matriz con una celda en blanco sería peor que no
// mostrar matriz: invita a pensar que falta stock, no que falta dato.

import type { Product } from '@/types/product';

export interface MatrizTaquilla {
  /** Las categorías, una fila cada una — orden ALFABÉTICO es-CO (mismo criterio que
   *  `categoriasDelCatalogo`: estable, no se reordena solo con el tráfico). */
  filas: string[];
  /** Los pesos (gramos), una columna cada uno — orden ASCENDENTE (250 antes que 500, como en la
   *  referencia aprobada). */
  columnas: number[];
  /** Una celda por combinación fila×columna, SIEMPRE llena si la matriz es válida — `derivarMatriz`
   *  nunca devuelve una matriz con huecos. */
  celdas: Map<string, Product>;
}

function claveCelda(categoria: string, peso: number): string {
  // U+0000 como separador: ni una categoría ni un peso en gramos pueden contenerlo, así que no hay
  // colisión posible entre `"A|1"+"2"` y `"A"+"|1"+"2"` que un separador visible (" · ", "|") sí
  // arriesgaría con nombres de categoría que ya traigan ese carácter.
  return `${categoria}\u0000${peso}`;
}

/** La celda de un producto, para quien ya tiene la matriz y necesita ubicar uno. */
export function celdaDe(categoria: string, peso: number): string {
  return claveCelda(categoria, peso);
}

/** El tope de valores DISTINTOS por eje (§ el spec: "más de 3 valores por eje" invalida) — una
 *  matriz de 4×4 o más deja de leerse como "un café, pocas presentaciones" y se vuelve una grilla
 *  disfrazada, que es exactamente lo que Taquilla existe para NO ser. */
export const MAX_VALORES_POR_EJE = 3;

/** Deriva la matriz filas(categoria)×columnas(peso_gramos) del catálogo, o `null` si no se puede:
 *  menos de dos productos, un hueco en `categoria`/`peso_gramos`, dos productos en la MISMA celda
 *  (duplicado), más de `MAX_VALORES_POR_EJE` valores en cualquier eje, o la matriz NO queda completa
 *  (filas × columnas ≠ cantidad de productos — un hueco real, no sólo un dato faltante). */
export function derivarMatrizTaquilla(catalogo: readonly Product[]): MatrizTaquilla | null {
  if (catalogo.length < 2) return null;

  const filas: string[] = [];
  const columnas: number[] = [];
  const celdas = new Map<string, Product>();

  for (const p of catalogo) {
    if (!p.categoria || p.peso_gramos == null) return null;
    const clave = claveCelda(p.categoria, p.peso_gramos);
    if (celdas.has(clave)) return null; // dos productos reclaman la misma celda
    celdas.set(clave, p);
    if (!filas.includes(p.categoria)) filas.push(p.categoria);
    if (!columnas.includes(p.peso_gramos)) columnas.push(p.peso_gramos);
  }

  if (filas.length > MAX_VALORES_POR_EJE || columnas.length > MAX_VALORES_POR_EJE) return null;
  // La matriz tiene que quedar COMPLETA: toda combinación fila×columna debe tener su producto. Si
  // hubiera un hueco, el conteo de celdas llenas sería menor que filas.length × columnas.length —
  // nunca mayor, porque el chequeo de duplicado de arriba ya impide que una celda cuente dos veces.
  if (filas.length * columnas.length !== catalogo.length) return null;

  filas.sort((a, b) => a.localeCompare(b, 'es-CO'));
  columnas.sort((a, b) => a - b);
  return { filas, columnas, celdas };
}

/** El PRODUCTO BASE, sin el sufijo de presentación (§ el r2, "los nombres solo cambian después de la
 *  raya"). "Café Onix — En grano 500 g" → "Café Onix": lo que identifica al CAFÉ, no a la celda.
 *  Sin el separador " — ", el nombre completo es el nombre base (nada que cortar). */
export function nombreBaseProducto(nombre: string): string {
  const i = nombre.indexOf(' — ');
  return i === -1 ? nombre.trim() : nombre.slice(0, i).trim();
}
