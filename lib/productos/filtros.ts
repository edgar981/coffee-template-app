import { isLowStock, type StockRef } from '@duna/core/metrics/inventory-filters';
import { conteosDeCola, type CarrilBase, type ConteosDeCola } from '@/lib/carriles';

// ─── LOS CARRILES DE PRODUCTOS · un registro, no ifs en el JSX ───────────────
//
// Mismo criterio que `lib/pedidos/filtros.ts` y `lib/clientes/filtros.ts`: el
// predicado de cada carril tiene que poder afirmarse en la capa 1, y agregar un
// carril tiene que ser una entrada más sin tocar el render.
//
// SON CUATRO, y el conjunto es la decisión.

/** Lo mínimo que los filtros de esta vertical necesitan de un producto. */
export interface ProductoParaFiltro extends StockRef {
  nombre?: string | null;
  sku?:    string | null;
  categoria?: string | null;
}

export type CarrilKey = 'todos' | 'reponer' | 'agotados' | 'sin_publicar';

export interface CarrilProductos extends CarrilBase<CarrilKey> {
  /** `undefined` = no filtra (Todos). Distinto de "filtra y no matchea nada". */
  aplica?: (p: ProductoParaFiltro) => boolean;
}

/**
 * POR REPONER · la alerta, y NO una definición nueva.
 *
 * Es `isLowStock` tal cual: la MISMA función que cuenta la card "Alertas de
 * Stock" del dashboard, que enciende el punto sol del nav y que —vía
 * `cruzoMinimo`— dispara la automatización `stock_bajo`. Y este carril ES, desde
 * el retiro de la Inventario vieja, LA vista de stock bajo del panel (antes vivía
 * en `/admin/inventario?stock=bajo-minimo`). Un recorte propio acá haría que esas
 * superficies contaran distinto el mismo hecho.
 *
 * Excluye los INACTIVOS por dentro, y eso es del predicado, no de este carril: un
 * producto despublicado no es una reposición pendiente.
 */
export const porReponer = (p: ProductoParaFiltro): boolean => isLowStock(p);

/**
 * AGOTADOS ⊂ POR REPONER, y la contención es por CONSTRUCCIÓN.
 *
 * Un producto en cero cumple `isLowStock` siempre (`0 <= cualquier mínimo`), así
 * que este carril es un RECORTE del anterior y no un conjunto aparte. Se DERIVA
 * en vez de escribirse como `p.stock === 0` suelto, por el mismo motivo por el que
 * `alternativaAlEliminar` se deriva de `accionEstadoProducto`: así la contención
 * es una propiedad del código y no una convención que haya que recordar — y,
 * sobre todo, el trato de `activo` no puede divergir entre los dos.
 *
 * Con `p.stock === 0` a secas, un producto INACTIVO y en cero aparecería en
 * "Agotados" pero no en "Por reponer", y la contención dejaría de ser cierta sin
 * que nada avisara.
 *
 * Es el mismo par que "Por cobrar" ⊂ "pendiente" (§ CLAUDE.md), que ya tiene su
 * sección explicando por qué dos carriles que se solapan no se contradicen.
 */
export const agotados = (p: ProductoParaFiltro): boolean => porReponer(p) && p.stock === 0;

/**
 * SIN PUBLICAR · `activo === false`.
 *
 * ACUMULADOR, y por eso NO lleva número (§ lib/carriles). No es una cola: un
 * producto despublicado es una decisión deliberada del operador, no trabajo
 * esperando — no se vacía sola y no pide nada. La maqueta lo dibuja con conteo
 * ("Sin publicar · 1"); no se la sigue, y es la sexta vez que su alcance no se
 * adopta.
 *
 * Y por lo mismo NO toca el punto sol del nav: el registro de atención sólo
 * consume `isLowStock`.
 */
export const sinPublicar = (p: ProductoParaFiltro): boolean => p.activo === false;

export const CARRILES_PRODUCTOS: CarrilProductos[] = [
  // "Todos" es TODO el catálogo, publicados e inactivos. No excluye nada: a
  // diferencia de Pedidos —donde "Todos" deja fuera las canceladas porque existe
  // una definición única de orden contable— acá no hay un equivalente. Un producto
  // inactivo sigue siendo un producto del catálogo, y tiene su propio carril.
  { key: 'todos',        label: 'Todos',        tipo: 'acumulador' },
  { key: 'reponer',      label: 'Por reponer',  tipo: 'cola',       aplica: porReponer },
  { key: 'agotados',     label: 'Agotados',     tipo: 'cola',       aplica: agotados },
  { key: 'sin_publicar', label: 'Sin publicar', tipo: 'acumulador', aplica: sinPublicar },
];

/**
 * La URL del carril "Por reponer" — EL hogar de la cola de reposición desde que
 * Inventario se encogió a auditoría (la cola no se portó; § retiro de Inventario).
 * La comparten TRES sitios: la card "Alertas de Stock" del dashboard, la
 * automatización `stock_bajo` (`AUTOMATION_HREF.stockBajo`) y el redirect de la
 * Inventario vieja (`/admin/inventario?stock=bajo-minimo` cae acá). Una sola
 * fuente: es lo que hace que card=lista (el conteo de la card = las filas de este
 * carril, los dos por `isLowStock`), y el día que la key `reponer` cambie, cambia
 * en un solo lugar en vez de en tres literales que divergen.
 */
export const RUTA_REPONER = '/admin/productos?f=reponer';

/** `null` para una key que no existe — no se cae a "todos" en silencio: un
 *  parámetro de URL basura debe ser visible, no interpretado. */
export const carrilPorKey = (key: string): CarrilProductos | null =>
  CARRILES_PRODUCTOS.find(c => c.key === key) ?? null;

export function aplicarCarril<T extends ProductoParaFiltro>(productos: T[], key: CarrilKey): T[] {
  const carril = carrilPorKey(key);
  return carril?.aplica ? productos.filter(carril.aplica) : productos;
}

/**
 * Conteo de las COLAS, para el número del pill. Los acumuladores no traen número
 * y por eso no se cuentan (§ lib/carriles).
 *
 * Sobre la MISMA lista que se muestra: un contador que no cuadra con lo que hay
 * debajo es peor que ninguno.
 */
export const conteosProductos = <T extends ProductoParaFiltro>(productos: T[]): ConteosDeCola<CarrilKey> =>
  conteosDeCola(CARRILES_PRODUCTOS, productos);

// ─── LA CATEGORÍA ES UN ALCANCE, NO UN CARRIL ────────────────────────────────
//
// Los cuatro carriles son excluyentes entre sí y responden "¿cómo está este
// producto?". La categoría responde otra cosa —"¿de qué tipo es?"— y se combina
// con cualquiera de los cuatro. Por eso no entra a `CARRILES_PRODUCTOS`: sería un
// quinto pill que apaga al que estuviera puesto, y con seis categorías la fila
// pasaría a diez.
//
// Es el mismo reparto que el alcance por cliente en Pedidos, y como allá se
// aplica ANTES que el carril — lo que decide también los CONTEOS: con una
// categoría puesta, "Por reponer · 2" tiene que decir dos DE ESA CATEGORÍA.

/** `null`/vacío = no filtra. Distinto de "filtra y no matchea nada". */
export function aplicarCategoria<T extends ProductoParaFiltro>(
  productos: T[],
  categoria: string | null,
): T[] {
  if (!categoria) return productos;
  return productos.filter(p => p.categoria === categoria);
}

// ─── LA BÚSQUEDA · qué significa "empatar" para un producto ──────────────────
//
// Vive acá y no en el `SearchField` del design-system, que es el CAMPO y no sabe
// qué se busca. Empatar contra un producto es dominio.

/**
 * ¿Este producto empata con lo tecleado? Nombre o SKU, los dos por substring
 * y sin distinguir mayúsculas — que es lo que la pantalla vieja ya hacía.
 *
 * El SKU se compara ADEMÁS sin separadores: se teclea "SN001" o "sn 001" para un
 * `SN-001` igual de seguido que con el guion, y el operador lo lee de una caja o
 * de una factura, no del formato en que quedó guardado. Es el mismo problema que
 * el teléfono en Clientes, con otro separador — y se resuelve igual, comparando
 * los dos lados normalizados en vez de tocar el dato.
 *
 * Consulta vacía = empata con todos (no filtrar es distinto de no encontrar).
 */
export function coincideProducto(p: ProductoParaFiltro, consulta: string): boolean {
  const q = consulta.trim().toLowerCase();
  if (!q) return true;
  if (p.nombre?.toLowerCase().includes(q)) return true;
  if (!p.sku) return false;

  const soloAlnum = (s: string) => s.replace(/[^a-z0-9]/g, '');
  const qAlnum = soloAlnum(q);
  // LA GUARDA VA ANTES DE LAS DOS COMPARACIONES, no sólo de la normalizada.
  // Estaba puesta únicamente en la segunda y el agujero seguía abierto en la
  // primera: `'sn-001'.includes('-')` es verdadero, así que teclear un guion
  // empataba con todo SKU que llevara uno — que en este catálogo son todos. Lo
  // encontró el test, no la lectura del código.
  //
  // Sin alfanuméricos no hay consulta de SKU posible: "-" no es una búsqueda,
  // es un separador suelto. Con al menos uno ("sn-", "001") las dos
  // comparaciones vuelven a servir.
  if (!qAlnum) return false;

  const sku = p.sku.toLowerCase();
  return sku.includes(q) || soloAlnum(sku).includes(qAlnum);
}

export function buscarProductos<T extends ProductoParaFiltro>(productos: T[], consulta: string): T[] {
  return productos.filter(p => coincideProducto(p, consulta));
}
