// LAS FILAS DE «CASILLAS» SON POR CAFÉ, NO POR CATEGORÍA (§ CHAMISAS-CASILLAS-POR-CAFE-1). PURA
// (capa 1): sin red, sin DOM.
//
// EL DEFECTO: `SuscripcionCasillas.tsx` nació reusando `derivarMatrizTaquilla`
// (lib/tienda/taquilla.ts) — la MISMA derivación que usa «Taquilla», donde la fila es la
// PRESENTACIÓN («En grano»/«Molido») y la columna el peso. Esa matriz exige una celda POR
// combinación categoría×peso y cae a `null` entera si dos productos reclaman la misma celda
// (§ su docstring: "LA VALIDEZ ES BINARIA"). El catálogo público de Las Chamisas (3 cafés —
// Bourbon Rosado, Pacamara, Papayo — los tres bajo la categoría «Café de especialidad», los tres
// a 340 g) hace que los TRES productos reclamen la MISMA celda: no es un catálogo con huecos, es
// un catálogo donde `categoria` nunca fue el eje que distingue un café de otro. `derivarMatriz
// Taquilla` devuelve `null`, y la sección cae en silencio a «Tarjetas» aunque el owner haya
// elegido y publicado «Casillas» (§ CHAMISAS-CASILLAS-POR-CAFE-1, el reporte observado).
//
// EL MODELO CORRECTO (§ la maqueta aprobada, `.scratch/chamisas-paginas/nosotros-suscripciones.
// html`: UNA FILA POR CAFÉ): el café es la fila, no la categoría. Se identifica con
// `nombreBaseProducto` (lib/tienda/taquilla.ts) — el MISMO recorte que ya usa Taquilla para el
// nombre ANTES del separador " — "; si el nombre no lleva separador (el caso común cuando el
// catálogo sólo declara UN tamaño de bolsa, como el de Las Chamisas), el nombre completo YA ES
// el café. `categoria` no interviene en esta derivación — dos cafés que comparten categoría
// siguen siendo DOS filas.
//
// SPARSE, A PROPÓSITO (§ el spec: "no rompe la composición"): a diferencia de la matriz de
// Taquilla (binaria, todo o nada), acá un café sin producto para un tamaño de bolsa dado queda
// DESHABILITADO en su fila — no invalida la composición entera. El único umbral de invalidez es
// CERO cafés con al menos un producto con `peso_gramos` declarado (§ el spec: "menos de un café
// activo").

import type { Product } from '@/types/product';
import { nombreBaseProducto } from '@/lib/tienda/taquilla';

export interface MatrizCasillasCafes {
  /** Los cafés, en el orden en que aparecen en el catálogo — no alfabético: es el orden del
   *  catálogo (mismo criterio que `itemsCasillas`, suscripcion-taquilla.ts, ya ordenaba así). */
  cafes: string[];
  /** Los tamaños de bolsa (`peso_gramos`) que el catálogo declara, orden ASCENDENTE. Casi
   *  siempre uno solo — § el spec: "uno solo es válido: el selector de bolsa no se muestra o
   *  queda fijo". */
  pesos: number[];
  /** Un producto por combinación café×peso — SPARSE: no toda combinación existe. */
  celdas: Map<string, Product>;
}

function clave(cafe: string, peso: number): string {
  // U+0000 como separador, mismo criterio que `lib/tienda/taquilla.ts` (`claveCelda`): ni un
  // nombre de café ni un peso en gramos pueden contenerlo.
  return `${cafe}\u0000${peso}`;
}

/** La clave de celda de un café a un peso dado, para quien ya tiene la matriz y necesita ubicar
 *  un producto. */
export function celdaCafeDe(cafe: string, peso: number): string {
  return clave(cafe, peso);
}

/** Deriva la matriz café×peso del catálogo, o `null` si no hay ningún café activo. Un producto
 *  sin `peso_gramos` no puede ubicarse en ninguna columna y se OMITE — no invalida la
 *  composición (sparse, al revés del todo-o-nada de `derivarMatrizTaquilla`). Dos productos del
 *  MISMO café reclamando el MISMO peso: el ÚLTIMO del catálogo gana — caso no esperado en un
 *  catálogo real (un café no debería repetir su propio tamaño de bolsa); se documenta en vez de
 *  invalidar la composición entera por un duplicado que ninguna otra regla de este archivo trata
 *  como error. */
export function derivarCasillasCafes(catalogo: readonly Product[]): MatrizCasillasCafes | null {
  const cafes: string[] = [];
  const pesos: number[] = [];
  const celdas = new Map<string, Product>();

  for (const p of catalogo) {
    if (p.peso_gramos == null) continue;
    const cafe = nombreBaseProducto(p.nombre);
    celdas.set(clave(cafe, p.peso_gramos), p);
    if (!cafes.includes(cafe)) cafes.push(cafe);
    if (!pesos.includes(p.peso_gramos)) pesos.push(p.peso_gramos);
  }

  if (cafes.length === 0) return null;

  pesos.sort((a, b) => a - b);
  return { cafes, pesos, celdas };
}

/** ¿«Casillas» se MUESTRA con este catálogo? — la MISMA pregunta que resuelve
 *  `derivarCasillasCafes(catalogo) !== null`, nombrada para que `SuscripcionPlanes.tsx` y el
 *  aviso del editor (`TiendaSeccionEditor.tsx`) no repitan el criterio a mano (§ CLAUDE.md #39:
 *  dos voces del mismo umbral es cómo divergen). */
export function casillasCafesActivo(catalogo: readonly Product[]): boolean {
  return derivarCasillasCafes(catalogo) !== null;
}

/** El producto REPRESENTATIVO de un café — el de `pesoPreferido` si existe esa combinación; si
 *  no, el de MENOR peso disponible para ese café (siempre hay al menos uno: un café sin ningún
 *  producto con peso no entra a `cafes`, § `derivarCasillasCafes`). Para datos que NO dependen
 *  del tamaño elegido — color, imagen, notas de cata —, nunca para precio/stock (eso sigue el
 *  peso ACTIVO exacto, vía `celdaCafeDe` directo: un café deshabilitado para ese peso no tiene
 *  precio que mostrar). */
export function productoDelCafe(matriz: MatrizCasillasCafes, cafe: string, pesoPreferido: number): Product {
  const directo = matriz.celdas.get(clave(cafe, pesoPreferido));
  if (directo) return directo;
  for (const peso of matriz.pesos) {
    const p = matriz.celdas.get(clave(cafe, peso));
    if (p) return p;
  }
  // Invariante: un café en `matriz.cafes` SIEMPRE tiene al menos un producto — `derivarCasillasCafes`
  // sólo agrega un café cuando encuentra uno. Si esto lanza, la invariante se rompió en otro lado.
  throw new Error(`casillas-cafes: "${cafe}" no tiene ningún producto — invariante rota`);
}

/** Un producto CUALQUIERA a un peso dado — el primero, en el orden de `cafes`, que SÍ lo tenga.
 *  Para el selector de tamaño de bolsa (la miniatura es del TAMAÑO, no de un café en
 *  particular); siempre existe uno, porque `peso` viene de `matriz.pesos`, que sólo contiene
 *  tamaños con ≥1 producto. */
export function productoDePeso(matriz: MatrizCasillasCafes, peso: number): Product {
  for (const cafe of matriz.cafes) {
    const p = matriz.celdas.get(clave(cafe, peso));
    if (p) return p;
  }
  throw new Error(`casillas-cafes: el peso ${peso} no tiene ningún producto — invariante rota`);
}
