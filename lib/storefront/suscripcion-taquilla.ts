import { decidirMolienda, normalizarOpciones, type DecisionMolienda } from '@duna/core/moliendas-opciones';
import { formatCOP } from '@duna/core/utils';
import { celdaDe, type MatrizTaquilla } from '@/lib/tienda/taquilla';
import type { FrecuenciaEnvio } from './casillas-frecuencia';
import type { SuscripcionPlanesContent } from '../config/site-content-defaults';
import type { Product } from '@/types/product';

// LA TAQUILLA DE SUSCRIPCIÓN (§ ONIX-SUSCRIPCION-TAQUILLA-1). PURO (capa 1): sin red, sin DOM. Arma
// el resumen, la referencia de precio y el mensaje de WhatsApp del pedido de suscripción, sobre el
// MISMO producto (una celda de la matriz derivada del catálogo, § lib/tienda/taquilla.ts) que ya
// elige la Taquilla de /tienda — nunca un segundo modelo de producto.
//
// LA MOLIENDA SIGUE `decidirMolienda` (packages/core/src/moliendas-opciones.ts), la MISMA regla que
// ya gobierna el catálogo y el checkout — nunca una copia. La maqueta de Onix hardcodea
// `pres==='molido'` para decidir si hay fila de molienda (su demo sólo declara moliendas en el
// producto "molido"); acá el gate es el PRODUCTO elegido —`decidirMolienda` sobre SU
// `moliendasOpciones`—, no el nombre de su categoría: una categoría cualquiera puede o no declarar
// opciones, y es ese dato el que decide si hay algo que elegir, no su etiqueta.

/** Las frecuencias configuradas, en orden — lista plana compacta (1-4 slots): sólo las NO vacías. */
export function frecuenciasDeTaquilla(slots: readonly string[]): string[] {
  return slots.filter((s) => s.trim() !== '');
}

/** Cuántas bolsas ofrecer: 1..max (§ el spec: "máximo de bolsas, 1-5"). `max` inválido o menor a 1
 *  cae a 1 — siempre hay al menos una bolsa que pedir. */
export function bolsasDeTaquilla(max: number): number[] {
  const n = Number.isFinite(max) && max >= 1 ? Math.floor(max) : 1;
  return Array.from({ length: n }, (_, i) => i + 1);
}

/**
 * El segmento de molienda del resumen/mensaje, o `null` si no aplica — ninguna fila que mostrar,
 * nada que decirle al mensajero. `nombreSeleccionado` sólo importa en modo 'eleccion' (la fila con
 * las opciones disponibles); en 'automatica' la única opción manda sola, sin fila que elegir.
 */
export function segmentoMolienda(decision: DecisionMolienda, nombreSeleccionado: string | null): string | null {
  if (decision.modo === 'automatica') return `Molienda ${decision.nombre}`;
  if (decision.modo === 'eleccion' && nombreSeleccionado) return `Molienda ${nombreSeleccionado}`;
  return null; // 'ninguna' y 'agotada': nada que decidir, nada que decir
}

/**
 * «Café Molido, Molienda Media» / «Café en Grano» — el segmento de PRESENTACIÓN del resumen/mensaje
 * (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 4). `presentacion` es la CATEGORÍA elegida tal cual
 * (`activa.categoria` de la matriz, p. ej. "Café en Grano" / "Café Molido") — NUNCA una palabra
 * hardcodeada ("molido"/"grano"): la taxonomía la deriva el catálogo (§ CLAUDE.md, "La taxonomía se
 * DERIVA del catálogo"), así que esta función no puede suponer su forma. Si hay molienda que
 * declarar, se anexa a la MISMA frase ("Café Molido, Molienda Media"); si no, la presentación sola.
 */
function segmentoPresentacion(presentacion: string, segMolienda: string | null): string {
  return segMolienda ? `${presentacion}, ${segMolienda}` : presentacion;
}

export interface ResumenTaquillaInput {
  bolsas: number;
  peso: number;
  /** La categoría elegida — § `segmentoPresentacion`. */
  presentacion: string;
  segmentoMolienda: string | null;
  frecuenciaEtiqueta: string;
}

/**
 * «2 × 250 G · CAFÉ MOLIDO, MOLIENDA MEDIA · CADA MES» — el texto YA en mayúscula (la serif
 * mayúscula del resumen es tipografía, § refero-onix-paginas.md; este helper no depende de que el
 * CSS la ponga, para que el test afirme el texto final sin levantar DOM). Antes el resumen NUNCA
 * nombraba la presentación elegida — sólo bolsas/peso/molienda/frecuencia, § ONIX-PAGINAS-
 * FIDELIDAD-1, el spec item 4 ("hoy dicen sólo «1 bolsa de 250 g, cada 15 días»").
 */
export function resumenTaquilla({ bolsas, peso, presentacion, segmentoMolienda: seg, frecuenciaEtiqueta }: ResumenTaquillaInput): string {
  const partes = [
    `${bolsas} × ${peso} G`,
    segmentoPresentacion(presentacion, seg).toUpperCase(),
    `CADA ${frecuenciaEtiqueta.toUpperCase()}`,
  ];
  return partes.join(' · ');
}

/**
 * «Referencia: 2 × $20.000, precio de tienda por bolsa.» — el multiplicador sólo aparece con más de
 * una bolsa (§ la maqueta de Onix: el `n>1?` de su `pintar()`); con una sola bolsa, el precio solo.
 */
export function referenciaPrecioTaquilla(bolsas: number, precioUnitario: number): string {
  const multiplicador = bolsas > 1 ? `${bolsas} × ` : '';
  return `Referencia: ${multiplicador}${formatCOP(precioUnitario)}, precio de tienda por bolsa.`;
}

export interface MensajeTaquillaInput {
  nombreProducto: string;
  bolsas: number;
  peso: number;
  /** La categoría elegida — § `segmentoPresentacion`. */
  presentacion: string;
  segmentoMolienda: string | null;
  frecuenciaEtiqueta: string;
}

/** El mensaje EXACTO que se manda por WhatsApp — el texto que el botón promete, impreso debajo
 *  (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 4, la línea «Se envía: "…"»). Antes no nombraba la
 *  presentación elegida; ahora sí, en la MISMA cláusula que la molienda si aplica. */
export function mensajeTaquilla({ nombreProducto, bolsas, peso, presentacion, segmentoMolienda: seg, frecuenciaEtiqueta }: MensajeTaquillaInput): string {
  const partes = [
    `${bolsas} ${bolsas > 1 ? 'bolsas' : 'bolsa'} de ${peso} g`,
    segmentoPresentacion(presentacion, seg).toLowerCase(),
    `cada ${frecuenciaEtiqueta.toLowerCase()}`,
  ];
  return `Hola, quiero suscribirme a ${nombreProducto}: ${partes.join(', ')}.`;
}

/** Los créditos del trato, cardinalidad FIJA 4 (§ el docstring de `SuscripcionPlanesContent`). Sólo
 *  las filas CON etiqueta y valor — una fila a medias no se muestra (mismo criterio que
 *  `creditosVisibles`/`filasCompletas`, lib/tienda/creditos.ts). */
export function creditosDeTaquilla(p: SuscripcionPlanesContent): { etiqueta: string; valor: string }[] {
  return [
    { etiqueta: p.credito1Etiqueta, valor: p.credito1Valor },
    { etiqueta: p.credito2Etiqueta, valor: p.credito2Valor },
    { etiqueta: p.credito3Etiqueta, valor: p.credito3Valor },
    { etiqueta: p.credito4Etiqueta, valor: p.credito4Valor },
  ].filter((c) => c.etiqueta.trim() !== '' && c.valor.trim() !== '');
}

/** Re-exportado para que los consumidores de este módulo no necesiten importar `decidirMolienda`
 *  de `@duna/core` por separado sólo para tipar su resultado. */
export { decidirMolienda };
export type { DecisionMolienda };

// ─── LA COMPOSICIÓN «CASILLAS» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4) ──────
//
// «Arma tu pedido» ES la Taquilla, con trato Chamisas (§ el spec, item 2: "la «Taquilla» de Onix con
// trato Chamisas"): el MISMO catálogo real, derivado con la MISMA `derivarMatrizTaquilla`
// (lib/tienda/taquilla.ts) — nunca un segundo modelo de producto. La diferencia es de CARDINALIDAD
// de selección: Taquilla elige UNA celda (un café, una presentación); Casillas elige VARIOS cafés
// a la vez, cada uno con su cantidad — las `matriz.filas` dejan de ser "la presentación elegida" y
// pasan a ser "la lista de cafés que el comprador puede sumar".
//
// LA MATRIZ GARANTIZA COMPLETITUD, ASÍ QUE "PRECIO POR CONFIRMAR" NO APLICA ACÁ: `derivarMatrizTaquilla`
// exige que TODA combinación fila×columna tenga su producto, o devuelve `null` entero (§ su
// docstring: "la validez es BINARIA… un catálogo con huecos... cae ENTERO a «Actual»"). La maqueta
// aprobada modela un caso de catálogo PARCIAL (sólo 340 g cargado, 500 g "por confirmar") que esta
// derivación no puede representar — con un catálogo parcial de verdad, `derivarMatrizTaquilla`
// devuelve `null` y la sección entera cae a «Tarjetas» (§ el spec, item 2: "sin catálogo que alcance,
// la sección cae a la composición por defecto"), no a una Casillas con huecos. Por eso
// `ItemCasilla.producto` abajo es NO-opcional: si `categoria` viene de `matriz.filas` y `peso` de
// `matriz.columnas`, el producto SIEMPRE existe.

export interface ItemCasilla {
  categoria: string;
  cantidad: number;
  producto: Product;
}

/** Las cantidades elegidas, por café (`categoria` de la matriz) — el estado que monta
 *  `SuscripcionCasillas.tsx`. Un café ausente del mapa cuenta como 0. */
export type CantidadesCasillas = Record<string, number>;

/** Tope de unidades por café (§ el spec: "contador − 0 + de 44 px", refero-chamisas.md §4 — sin un
 *  tope declarado por la maqueta más allá de evitar un contador sin fin; se fija en 9, el mismo
 *  tope del prototipo aprobado). Acotado también por `producto.maxCompra` si el catálogo lo declara
 *  — nunca por encima del tope que el resto del storefront ya respeta para esa línea. */
export const MAX_UNIDADES_CASILLA = 9;

/** El tope real para UN café — el menor entre `MAX_UNIDADES_CASILLA` y su `maxCompra` (si el
 *  catálogo lo declara). */
export function topeUnidadesCasilla(producto: Product): number {
  return producto.maxCompra != null ? Math.min(MAX_UNIDADES_CASILLA, producto.maxCompra) : MAX_UNIDADES_CASILLA;
}

/** Los cafés con cantidad > 0, en el orden de `matriz.filas` (§ el spec: "mezclar cafés" — el orden
 *  del catálogo, no el de selección, para que la nota y la barra fija no reordenen al comprador). */
export function itemsCasillas(matriz: MatrizTaquilla, cantidades: CantidadesCasillas, peso: number): ItemCasilla[] {
  return matriz.filas
    .map((categoria) => ({
      categoria,
      cantidad: cantidades[categoria] ?? 0,
      producto: matriz.celdas.get(celdaDe(categoria, peso))!,
    }))
    .filter((it) => it.cantidad > 0);
}

/** El total de bolsas del pedido (para la barra fija del celular: "N bolsas · …"). */
export function bolsasCasillas(items: readonly ItemCasilla[]): number {
  return items.reduce((a, it) => a + it.cantidad, 0);
}

/** El total de un envío — `null` sin ítems elegidos (nada que sumar; § "Elige un café y estas
 *  casillas se llenan con su sticker", refero-chamisas.md, la línea `#tot` de la maqueta en su
 *  estado vacío). Con ítems, la matriz ya garantiza precio (ver el docstring de cabecera): nunca
 *  "por confirmar" acá. */
export function totalPorEnvioCasillas(items: readonly ItemCasilla[]): number | null {
  if (items.length === 0) return null;
  return items.reduce((a, it) => a + it.producto.precio * it.cantidad, 0);
}

/** Las opciones de molienda válidas para TODO el pedido de Casillas — una sola elección aplica a
 *  cada café que se vaya a despachar (§ el spec, item 2: "Aplica a todo el pedido"), así que la
 *  opción ofrecida tiene que estar DISPONIBLE en cada producto elegido: la INTERSECCIÓN de nombres
 *  `disponible` entre los productos recibidos. `[]` cuando algún producto no declara ninguna opción
 *  disponible, o cuando los conjuntos no comparten ningún nombre — ahí el chooser de molienda no
 *  tiene nada honesto que ofrecer y la sección lo omite (§ el componente). Sin productos (nada
 *  elegido todavía), compara contra EL CATÁLOGO ENTERO a la bolsa activa, para que los chips ya se
 *  vean antes de elegir — como la maqueta aprobada. */
export function moliendasCasillas(productos: readonly Product[]): string[] {
  if (productos.length === 0) return [];
  const conjuntos = productos.map(
    (p) => new Set(normalizarOpciones(p.moliendasOpciones).filter((o) => o.disponible).map((o) => o.nombre)),
  );
  return [...conjuntos[0]].filter((nombre) => conjuntos.every((s) => s.has(nombre)));
}

/** EL MAPEO POSICIONAL slot→estructura de calendario, convención PROPIA de la composición
 *  «Casillas» — no de `lib/storefront/casillas-frecuencia.ts` (que es agnóstico de "slot"; ver su
 *  docstring de cabecera). `SuscripcionPlanesContent.frecuencia1..4` son ETIQUETAS libres sin
 *  semántica adjunta (§ CLAUDE.md: "una lista corta… por defecto «15 días», «Mes», «2 meses»"), así
 *  que esta función asume la MISMA convención que ya rige esos defaults: las frecuencias se
 *  declaran de la MÁS frecuente a la MENOS frecuente, slot 1 a slot 4. Con esa convención:
 *    slot 1 → quincenal (2 envíos/mes, todos los meses)
 *    slot 2 → mensual   (1 envío/mes, todos los meses)
 *    slot 3 → bimestral (1 envío/mes, de 2 en 2 meses)
 *    slot 4 → trimestral (1 envío/mes, de 3 en 3 meses)
 *  LÍMITE DECLARADO: un dueño que reordenara sus frecuencias fuera de ese orden (p. ej. "2 meses" en
 *  el slot 1) rompería la calendarización de "Casillas de frecuencia" sin que el editor lo avise —
 *  no hay hoy un campo estructurado que capture "cada cuántos días" por fuera del texto libre. Es
 *  la misma clase de simplificación DECLARADA que ya acepta `S02` en `lib/movimiento/catalogo.ts`
 *  ("generaliza… sin ramas por paso"); si algún día un dueño necesita un orden distinto, la salida es
 *  dar a `frecuencia1..4` una estructura propia, no ensanchar este mapeo con más casos.
 */
export function frecuenciaEstructuraPorSlot(slot: 1 | 2 | 3 | 4): FrecuenciaEnvio {
  switch (slot) {
    case 1:
      return { enviosPorMes: 2, cadaNMeses: 1 };
    case 2:
      return { enviosPorMes: 1, cadaNMeses: 1 };
    case 3:
      return { enviosPorMes: 1, cadaNMeses: 2 };
    case 4:
      return { enviosPorMes: 1, cadaNMeses: 3 };
  }
}
