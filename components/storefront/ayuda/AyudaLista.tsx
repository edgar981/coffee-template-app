'use client';

// «LISTA» — la composición CANÓNICA de /preguntas-frecuentes (§ PREGUNTAS-FRECUENTES-1): un
// acordeón agrupado neutro, para la tienda que carga sus preguntas sin elegir «Créditos» ni
// «Libreta». Sin decoración de marca propia — es el vocabulario de siempre del storefront
// (`--sf-tarjeta`/`--sf-linea`, el mismo trato que `SeccionPreguntas.tsx`/la `PreguntasFrecuentes`
// de hoy), para que cualquier tienda la vea coherente con el resto de sus páginas.
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import CampoEditable from '@/components/storefront/CampoEditable';
import RevelarBloque from '@/components/storefront/RevelarBloque';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { agruparPreguntas } from '@/lib/storefront/preguntas-frecuentes';
import type { AyudaComposicionProps } from './AyudaCreditos';

export default function AyudaLista({ titulo, subtitulo, items }: AyudaComposicionProps) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const grupos = useMemo(() => agruparPreguntas(items), [items]);
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <section className="bg-[var(--sf-fondo)] py-16">
      <div className={`${contenedorClase} mx-auto max-w-2xl`}>
        <h1 className="font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">
          <CampoEditable campo="preguntasFrecuentes.titulo">{titulo}</CampoEditable>
        </h1>
        {subtitulo && (
          <p className="mt-3 text-[var(--sf-texto-suave,var(--sf-texto))]">
            <CampoEditable campo="preguntasFrecuentes.subtitulo" multilinea>{subtitulo}</CampoEditable>
          </p>
        )}

        <div className="mt-8 space-y-8">
          {grupos.map((g) => (
            <div key={g.grupo}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sf-tinta)]">{g.grupo}</h2>
              <div className="space-y-3">
                {g.items.map((pregunta, indiceEnGrupo) => {
                  const indiceOriginal = items.indexOf(pregunta);
                  const abiertaFila = abierta === indiceOriginal;
                  const panelId = `lista-panel-${indiceOriginal}`;
                  const botonId = `lista-boton-${indiceOriginal}`;
                  return (
                    <RevelarBloque key={indiceOriginal} preview={preview} indice={indiceEnGrupo % 6} className="overflow-hidden rounded-2xl sf-borde border-[var(--sf-linea)] bg-[var(--sf-tarjeta)]">
                      <button
                        type="button"
                        id={botonId}
                        aria-expanded={abiertaFila}
                        aria-controls={panelId}
                        onClick={() => setAbierta(abiertaFila ? null : indiceOriginal)}
                        className="flex w-full items-center justify-between gap-3 p-5 text-left"
                      >
                        <span className="font-semibold text-sm text-[var(--sf-tinta)]">
                          <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.question`}>{pregunta.question}</CampoEditable>
                        </span>
                        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-[var(--sf-tinta)] transition-transform ${abiertaFila ? 'rotate-180' : ''}`} />
                      </button>
                      {abiertaFila && (
                        <div id={panelId} role="region" aria-labelledby={botonId} className="px-5 pb-5 text-sm text-[var(--sf-texto-suave,var(--sf-texto))]">
                          <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.answer`} multilinea>{pregunta.answer}</CampoEditable>
                        </div>
                      )}
                      <span className="sr-only">
                        <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.grupo`}>{pregunta.grupo}</CampoEditable>
                      </span>
                    </RevelarBloque>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
