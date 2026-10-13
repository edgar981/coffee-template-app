"use client";

// LA FICHA «ETIQUETA DE BOLSA» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 4: "Ficha
// de origen como etiqueta de la bolsa. Retícula de dos columnas con iconos de línea, igual que el
// panel de la bolsa, con borde punteado y el sello de una tinta como estampilla"). Segunda
// composición de `nosotrosFicha`, hermana de la canónica («tinta», el capítulo verde con cifras)
// bajo el mismo dispatcher (`NosotrosFicha.tsx`).
//
// LEE `tiendaCreditos.items`, igual que «tinta» — CERO duplicación nueva: la ÚNICA diferencia es el
// LAYOUT (retícula de dos columnas con borde punteado, en vez de columna invertida sobre fondo
// tinta). Las TRES cifras quedan SIN EFECTO bajo esta composición (§ el docstring de
// `NosotrosFichaContent`).
//
// EL ÍCONO ES UNO SOLO, decorativo, repetido en cada fila — no hay un dato de "ícono por etiqueta"
// en el modelo (serían N campos nuevos por una fila de la que no hay garantía de cardinalidad fija),
// así que una marca de línea NEUTRA (no un ícono de café) cumple "iconos de línea" sin inventar una
// capacidad de selección que nadie pidió.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { Minus } from 'lucide-react';
import { filasCompletas } from '@/lib/tienda/creditos';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CampoEditable from '@/components/storefront/CampoEditable';

export default function NosotrosFichaEtiqueta() {
  const { nosotrosFicha, tiendaCreditos, navTratamiento } = useSiteContent();
  const filas = filasCompletas(tiendaCreditos.items);
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section className="bg-[var(--sf-fondo)] py-20">
      <div className={`${contenedorClase} mx-auto`}>
        <div
          className="relative overflow-hidden rounded-[24px] border-2 border-dashed border-[var(--sf-tinta)] p-8 sm:p-12"
          style={{ backgroundColor: 'var(--sf-superficie)' }}
        >
          {nosotrosFicha.eyebrow.trim() !== '' && (
            <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-tinta)]/70">
              <CampoEditable campo="nosotrosFicha.eyebrow">{nosotrosFicha.eyebrow}</CampoEditable>
            </p>
          )}
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
            {filas.map((fila, i) => (
              <div
                key={`${fila.etiqueta}-${i}`}
                className="flex items-start gap-3 border-b border-[var(--sf-tinta)]/15 pb-4"
              >
                <Minus aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--sf-tinta)]/50" />
                <div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--sf-tinta)]/70">{fila.etiqueta}</p>
                  <p className="text-[15px] text-[var(--sf-tinta)]">{fila.valor}</p>
                </div>
              </div>
            ))}
          </div>
          {nosotrosFicha.sello.trim() !== '' && (
            <span
              className="absolute -top-4 right-6 rotate-[-6deg] rounded-full border-2 border-[var(--sf-tinta)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--sf-tinta)]"
              style={{ backgroundColor: 'var(--sf-fondo)' }}
            >
              <CampoEditable campo="nosotrosFicha.sello">{nosotrosFicha.sello}</CampoEditable>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
