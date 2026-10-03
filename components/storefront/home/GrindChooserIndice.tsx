"use client";

import Link from "next/link";
import Image from "next/image";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { tarjetasDePresentaciones } from "@/lib/storefront/presentaciones";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";

// LA VARIANTE "ÍNDICE" (§ eje 5e): de dos cortinas oscuras gemelas a un índice — filas numeradas,
// encabezado alineado a la izquierda, foto chica al margen y divisor entre ítems. Ya no hay texto
// blanco sobre foto —la textura que hacía que dos fincas se leyeran clonadas—. Aguanta 2, 3 o 4 filas
// sin tocar el grid: es una LISTA vertical, no un grid (`gridColsPresentaciones` no aplica acá).
//
// TOKENS: superficie ON-BAND (la fila se apoya en la banda, clara por defecto, pero sigue al ESQUEMA
// si se le asigna uno a `presentaciones`), no la tile oscura fija del mosaico. `--sf-sobre-banda` /
// `--sf-sobre-banda-suave` AUTO-FLIPEAN con el esquema (§ esquema-style.ts); los fallbacks reproducen
// el mismo par que Newsletter usa sobre una banda CLARA (`--sf-tinta`/`--sf-texto`), no el blanco fijo
// de Hero/BrandStory/Subscription (esas son bandas OSCURAS).
//
// El gate de visibilidad (`seccionEsVisible`) vive en el DISPATCHER (`GrindChooser.tsx`), no acá.
//
// EL `negocio` DEL ALT LLEGA POR PROP, no por `useSiteSettings()` — mismo motivo que el mosaico
// (§ GrindChooserMosaico): se monta también en la vista previa del panel, sin el SiteSettingsProvider
// del storefront.
//
// LA ENTRADA (§ SECCIONES-ENTRAN-VIVAS-1) — mismo cambio que el mosaico: antetítulo/título por
// separado, cada fila escalonada por índice, con `RevelarBloque`.
export default function GrindChooserIndice({ negocio, style }: { negocio?: string; style?: React.CSSProperties }) {
  const { presentaciones, tema } = useSiteContent();
  const preview = useIsPreview();

  const tarjetas = tarjetasDePresentaciones(presentaciones);
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style` del h2, que sigue rindiendo exactamente `text-3xl sm:text-4xl` (1.875rem/2.25rem,
  // medido) — byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-left">
          {presentaciones.eyebrow && (
            <RevelarBloque as="p" indice={0} preview={preview} className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2"><CampoEditable campo="presentaciones.eyebrow">{presentaciones.eyebrow}</CampoEditable></RevelarBloque>
          )}
          <RevelarBloque as="h2" indice={1} preview={preview} className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))]" style={displayL ? { fontSize: displayL } : undefined}><CampoEditable campo="presentaciones.titulo" multilinea>{presentaciones.titulo}</CampoEditable></RevelarBloque>
        </div>

        <div className="divide-y divide-[var(--sf-linea)] border-t border-[var(--sf-linea)]">
          {tarjetas.map((op, i) => (
            <RevelarBloque key={i} indice={i} preview={preview}>
              {/* `data-sf-tarjeta`: marcador INERTE del slot (1-4) para el puente vista→formulario del
                  editor (§ Backlog #46), gemelo del mosaico — el mecanismo (`onClicTarjeta` +
                  `.closest('[data-sf-tarjeta]')`) es agnóstico de markup. Sólo en preview; en la tienda
                  del visitante el atributo es `undefined` y React lo omite. */}
              <Link
                href={op.href}
                data-sf-tarjeta={preview ? op.slot : undefined}
                className="group flex items-center gap-5 sm:gap-6 py-6"
              >
                {/* Número de POSICIÓN visible (01, 02…), no el `slot` —que puede saltar si una tarjeta
                    opcional se llena fuera de orden—. Sólo decora el orden que el visitante VE. */}
                <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl sm:text-2xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] mb-1 group-hover:underline">
                    <CampoEditable campo={`presentaciones.label${op.slot}`}>{op.label}</CampoEditable>
                  </h3>
                  <p className="text-sm text-[var(--sf-sobre-banda-suave,var(--sf-texto))] max-w-md"><CampoEditable campo={`presentaciones.copy${op.slot}`} multilinea>{op.copy}</CampoEditable></p>
                </div>
                {/* Foto chica al margen. Sin foto: hueco de marca (`--sf-linea`) — nunca un
                    `<img src="">` roto, mismo criterio que el mosaico. */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--sf-linea)] sm:h-24 sm:w-24">
                  {/* El marcador vive en un `<div>` SIEMPRE presente (§ el mismo razonamiento de
                      GrindChooserMosaico.tsx): sin él, una tarjeta 1-2 con imagen vacía —el estado
                      real de Nayoli, § DEFAULTS.presentaciones— no tendría nodo clickeable. */}
                  <CampoEditable campo={`presentaciones.imagen${op.slot}`} tipo="imagen">
                    <div className="absolute inset-0">
                      {op.img && (
                        <Image
                          src={op.img}
                          alt={negocio ? `${negocio} ${op.label}` : op.label}
                          fill
                          sizes="96px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                  </CampoEditable>
                </div>
              </Link>
            </RevelarBloque>
          ))}
        </div>
      </div>
    </section>
  );
}
