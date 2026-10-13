// EL MECANISMO de condición-por-campo (§ EDITOR-ORDEN-Y-LIENZO-1, item 4). PURO, capa 1: no monta
// nada, no sabe de React — `TiendaSeccionEditor.tsx` lo consume para avisar, DENTRO del campo, por
// qué un valor que el dueño ya escribió no se ve hoy en la tienda, con la salida accionable.
//
// EL DEFECTO QUE ESTO CIERRA (reporte del owner, 2026-10-12): "Etiqueta de la fila de molienda" no
// se muestra si en la tienda no hay configurados otros tipos de molienda, y quien usa el panel no
// sabe por qué. El hint estático ("Sólo con la composición 'Taquilla', y sólo si el producto ofrece
// elegir molienda") explica la CONDICIÓN pero no dice si HOY se cumple — el dueño tiene que adivinar
// si su catálogo la satisface. Esta función la EVALÚA contra el catálogo real que el panel ya carga.
//
// `CampoTexto.condicion` (tienda-secciones.ts) es un SET CERRADO de claves — nunca una función: el
// config cruza server→client como prop (serializable), igual que `opcionesDinamicas`/`seMuestraSiCampo`
// ya lo son por la misma razón.

import { decidirMolienda } from '@duna/core/moliendas-opciones';
import { creditosVisibles, type CreditoItem } from '@/lib/tienda/creditos';
import type { Product } from '@/types/product';

export type CondicionCampo = 'molienda-multiple';

/**
 * El CUARTO motivo de `noSeMuestra` (§ EDITOR-ORDEN-Y-LIENZO-2, item 5 — "secciones sin foto o sin
 * titular", extendido al PISO de `tiendaCreditos`). EXTRAÍDO para poder afirmarlo en un test —
 * `TiendaSeccionEditor.tsx` no se puede montar (este repo no usa React Testing Library para render
 * con interacción).
 *
 * `repeaterVacio` (`items.length === 0`) NO cubre el piso de `creditosVisibles` (3 filas COMPLETAS):
 * una lista con 4 ítems y sólo 2 completos NO está vacía, así que la tarjeta se veía "visible" en el
 * panel aunque `TiendaCreditos.tsx`/`NosotrosFicha.tsx` la oculten en la tienda real. Específico de
 * `tiendaCreditos` — es la ÚNICA sección con este piso de COMPLETITUD, no sólo de cardinalidad.
 */
export function tiendaCreditosPisoIncompleto(
  seccion: string,
  repeaterVacio: boolean,
  items: readonly CreditoItem[],
): boolean {
  return seccion === 'tiendaCreditos' && !repeaterVacio && !creditosVisibles(items);
}

/**
 * El RESUMEN de una tarjeta repetida colapsada (§ item 2 del spec: "mostrando su resumen, p. ej.
 * «Pedido · Por WhatsApp»") — sus dos primeros campos de texto, valor ACTUAL, unidos por " · ".
 * MISMO criterio que `resumenDe` de `RepeaterEditor.tsx` (principal/detalle), aplicado a campos
 * PLANOS de un bloque `tarjeta` en vez de a un ítem de repeater — no una segunda idea, la misma,
 * para la forma de dato que corresponde acá (slots fijos, no una lista).
 */
export function resumenBloqueTarjeta(
  camposBloque: readonly { name: string }[],
  form: Record<string, unknown>,
): string {
  return camposBloque
    .slice(0, 2)
    .map((c) => String(form[c.name] ?? '').trim())
    .filter((v) => v !== '')
    .join(' · ');
}

/**
 * El PARCIAL que el "Quitar" del acordeón GENÉRICO manda a `cambiar()` (§ EDITOR-ORDEN-Y-LIENZO-1,
 * item 2) — EXTRAÍDO para poder afirmarlo en un test, § EDITOR-TARJETA-GENERICA-QUITAR-SIN-TEST-1
 * (abierto por esa misma tanda: "no hay test de render para el botón 'Quitar' genérico").
 *
 * EL BUG QUE ESTO PREVIENE, reproducido: el primer intento del botón "Quitar" genérico reusaba
 * `quitarTarjeta` (la función de PRESENTACIONES, que escribe `label${slot}`/`copy${slot}`/
 * `categoria${slot}`/`imagen${slot}` — campos que NO existen en ninguna otra sección). Vacía los
 * campos REALES del bloque recibido (`bloque.campos`/`.imagen`) — nunca un nombre derivado del
 * `slot` — así que una tarjeta de BrandStory («Fila N») vacía `filaNRotulo`/`filaNValor`/
 * `filaNSubLinea`, nunca `labelN`/`copyN`.
 */
export function vaciosDeBloqueTarjeta(
  bloque: { campos: readonly { name: string }[]; imagen?: { name: string } },
): Record<string, string> {
  const vacios: Record<string, string> = {};
  for (const c of bloque.campos) vacios[c.name] = '';
  if (bloque.imagen) vacios[bloque.imagen.name] = '';
  return vacios;
}

export interface CondicionCampoResultado {
  /** El mensaje a mostrar DENTRO del campo — la razón, en el mismo tono que un hint. */
  mensaje: string;
  /** El enlace accionable ("configurala en Productos"), o ausente si no hay una salida clara. */
  enlace?: { href: string; etiqueta: string };
}

/**
 * ¿El campo `condicion` aplica HOY contra el catálogo real? `null` = sí aplica (o no hay condición
 * declarada, o el catálogo todavía no cargó — preferir callar a afirmar sobre un dato que no se
 * tiene, § el criterio de `destinoInexistente`/`productoInexistente` ya establecido en este
 * archivo). Un resultado no-null es el AVISO: la condición NO se cumple hoy.
 */
export function condicionCampoInactiva(
  condicion: CondicionCampo | undefined,
  catalogoReal: readonly Product[],
  catalogoListo: boolean,
): CondicionCampoResultado | null {
  if (!condicion || !catalogoListo) return null;
  if (condicion === 'molienda-multiple') {
    // MISMA regla que decide si la tienda real ofrece elegir molienda (§ SuscripcionTaquilla.tsx/
    // TiendaTaquilla.tsx, `decision.modo === 'eleccion'`) — nunca una segunda cuenta que pudiera
    // divergir de la que la tienda consulta para decidir si pinta la fila.
    const algunoOfreceEleccion = catalogoReal.some((p) => decidirMolienda(p.moliendasOpciones).modo === 'eleccion');
    if (algunoOfreceEleccion) return null;
    return {
      mensaje: 'Se muestra sólo cuando un producto tiene más de una molienda disponible. Hoy ninguno la tiene.',
      enlace: { href: '/admin/productos', etiqueta: 'Configurala en Productos' },
    };
  }
  return null;
}

// EL MAPEO campo→FILA de `CreditosFilas` (§ EDITOR-CREDITOSFILAS-INDICE-ORIGINAL-1, abierto por
// EDITOR-ORDEN-Y-LIENZO-1, item 3). `CreditosFilas` (components/storefront/tienda/TiendaCreditos.tsx)
// recibe las filas YA FILTRADAS (`filasCompletas`/`creditosDeTaquilla`: sólo etiqueta+valor
// completos) — wirear `campo="…items.{i}.etiqueta"` con el índice VISIBLE apuntaría al ítem
// EQUIVOCADO en cuanto una fila de en medio estuviera a medias (el defecto que EDITOR-ORDEN-Y-
// LIENZO-1 midió y dejó sin arreglar).
//
// LA SALIDA: el llamador (que SÍ tiene el array ORIGINAL, sin filtrar) ubica cada fila VISIBLE en su
// posición original por REFERENCIA (`Array.prototype.indexOf`, válido porque `.filter()` nunca clona
// los elementos — devuelve la MISMA referencia que ya estaba en el array sin filtrar) y de ahí deriva
// el `campo` real con `campoDe`. Es un utilitario de POSICIÓN, no de negocio: no reimplementa
// `filasCompletas` (que sigue viviendo, sin tocar, en `lib/tienda/creditos.ts` — fuera de `touches:`
// de este slice) ni duplica su predicado de "fila completa".
export function camposPorFilaCreditos<T>(
  itemsOriginales: readonly T[],
  filasVisibles: readonly T[],
  campoDe: (indiceOriginal: number) => { etiqueta: string; valor: string },
): { etiqueta: string; valor: string }[] {
  return filasVisibles.map((fila) => campoDe(itemsOriginales.indexOf(fila)));
}
