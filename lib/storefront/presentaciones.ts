import { hrefCategoria } from '../productos/categorias';
import type { PresentacionesContent } from '../config/site-content-defaults';

// La sección Presentaciones ("¿Cómo tomas tu café?") es de cardinalidad VARIABLE (2-4) sobre campos
// PLANOS (§ site-content-defaults). QUÉ tarjetas se muestran, y en qué grid, se decide ACÁ —en el
// componente, capa 1 pura— y NO en el resolver de SiteContent: así subir de 2 a 4 no toca el resolver
// ni el invariante #44 (un repeater habría exigido perforarlo para mostrar defaults).

export interface TarjetaPresentacion {
  /** El SLOT (1-4) del que salió la tarjeta, PRESERVADO a través del filtro. La POSICIÓN en la lista
   *  visible NO es el slot cuando una tarjeta opcional se llena fuera de orden (slot 4 con slot 3
   *  vacío → la 3ª tarjeta visible es el slot 4). El editor lo usa para el puente vista→formulario
   *  (§ el marcador `data-sf-tarjeta`); en el storefront no tiene efecto. */
  slot: number;
  label: string;
  copy: string;
  img: string;
  href: string;
  /** El destino CRUDO (la categoría editable), ANTES de `hrefCategoria`. El storefront usa `href`
   *  (no lo lee), pero el AVISO de configuración del Dashboard lo necesita para cruzarlo contra el
   *  catálogo (§ Backlog #65 — un destino que no existe no trae productos). Vacío = /tienda (todos). */
  cat: string;
}

/**
 * Las tarjetas PRESENTES, de una config de presentaciones.
 *
 * Slots 1-2 SIEMPRE (requeridos → mínimo 2, con los defaults de Nayoli). Slots 3-4 sólo si tienen
 * título O imagen — **OR, no AND**, y es una decisión: con AND, un cliente que escribió el título y la
 * descripción pero todavía no subió la foto vería su tarjeta DESAPARECER sin saber por qué (el editor
 * no lo dice). Con OR, la tarjeta APARECE apenas se empieza a llenar, y una imagen faltante es un
 * defecto VISIBLE que el cliente sabe arreglar (el componente pinta el hueco, no un `<img>` roto).
 *
 * El `href` lo construye `hrefCategoria` desde el destino editable (vacío → /tienda).
 */
export function tarjetasDePresentaciones(p: PresentacionesContent): TarjetaPresentacion[] {
  const slots = [
    { slot: 1, label: p.label1, copy: p.copy1, img: p.imagen1, cat: p.categoria1, req: true },
    { slot: 2, label: p.label2, copy: p.copy2, img: p.imagen2, cat: p.categoria2, req: true },
    { slot: 3, label: p.label3, copy: p.copy3, img: p.imagen3, cat: p.categoria3, req: false },
    { slot: 4, label: p.label4, copy: p.copy4, img: p.imagen4, cat: p.categoria4, req: false },
  ];
  return slots
    .filter(s => s.req || s.label.trim() !== '' || s.img.trim() !== '')
    .map(s => ({ slot: s.slot, label: s.label, copy: s.copy, img: s.img, href: hrefCategoria(s.cat), cat: s.cat }));
}

/**
 * La clase de columnas del grid del storefront según el conteo de tarjetas (§ doctrina, medido a
 * 800px): 2 → 2 col, 3 → 3 col, 4 → **2×2** (dos filas de a dos, NO 4-en-fila: a 800px 4 columnas
 * dan ~170px/tarjeta, ilegible con título + copy + CTA adentro).
 *
 * Lookup con clases LITERALES para que el JIT de Tailwind las incluya —nunca interpolación—.
 */
export function gridColsPresentaciones(n: number): string {
  const mapa: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2',
  };
  return mapa[n] ?? 'md:grid-cols-2';
}

// ─── RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 — la composición 'riel' pasa a mostrar el CATÁLOGO ──────────
//
// `precioMinimoCategoria`/`ProductoConPrecio` (§ PARIDAD-RIEL-TARJETAS-1) se RETIRARON: existían
// para el precio "desde" de una tarjeta-CATEGORÍA (`op.cat`), y esa tarjeta ya no existe bajo
// 'riel' — cada tarjeta es ahora un PRODUCTO con su propio `precio` real, sin necesidad de un
// mínimo agregado. Eran el ÚNICO consumidor de las dos (verificado: `grep -rln
// precioMinimoCategoria` fuera de este archivo y su test daba sólo `GrindChooserRiel.tsx`) — código
// muerto que este slice no deja ambiguo (§ CLAUDE.md, "código muerto se BORRA o se CABLEA").

/** Tope de tarjetas del riel — es para HOJEAR el catálogo, no para listarlo entero (la cuadrícula
 *  completa ya vive en /tienda). */
export const TOPE_RIEL_PRODUCTOS = 8;

/**
 * Los productos que muestra la composición 'riel': el catálogo, en SU ORDEN, recortado al tope.
 *
 * NO vuelve a filtrar por `activo` — `/api/catalog` ya lo hace (`where: { activo: true }`,
 * § app/api/catalog/route.ts), el mismo criterio que ya declaraba `precioMinimoCategoria` para el
 * mismo campo. Tampoco reordena: el orden es el que el catálogo público ya trae
 * (`orderBy: { createdAt: 'asc' }`), así que el riel y /tienda listan en el mismo orden.
 *
 * Catálogo vacío (aún sin cargar, o sin productos) → `[]` — la sección se comporta como con
 * presentaciones vacías: ninguna tarjeta que mostrar.
 */
export function productosDelRiel<T>(catalogo: readonly T[]): T[] {
  return catalogo.slice(0, TOPE_RIEL_PRODUCTOS);
}
