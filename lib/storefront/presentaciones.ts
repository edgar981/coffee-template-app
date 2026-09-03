import { hrefCategoria } from '../productos/categorias';
import type { PresentacionesContent } from '../config/site-content-defaults';

// La sección Presentaciones ("¿Cómo tomas tu café?") es de cardinalidad VARIABLE (2-4) sobre campos
// PLANOS (§ site-content-defaults). QUÉ tarjetas se muestran, y en qué grid, se decide ACÁ —en el
// componente, capa 1 pura— y NO en el resolver de SiteContent: así subir de 2 a 4 no toca el resolver
// ni el invariante #44 (un repeater habría exigido perforarlo para mostrar defaults).

export interface TarjetaPresentacion {
  label: string;
  copy: string;
  img: string;
  href: string;
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
    { label: p.label1, copy: p.copy1, img: p.imagen1, cat: p.categoria1, req: true },
    { label: p.label2, copy: p.copy2, img: p.imagen2, cat: p.categoria2, req: true },
    { label: p.label3, copy: p.copy3, img: p.imagen3, cat: p.categoria3, req: false },
    { label: p.label4, copy: p.copy4, img: p.imagen4, cat: p.categoria4, req: false },
  ];
  return slots
    .filter(s => s.req || s.label.trim() !== '' || s.img.trim() !== '')
    .map(s => ({ label: s.label, copy: s.copy, img: s.img, href: hrefCategoria(s.cat) }));
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
