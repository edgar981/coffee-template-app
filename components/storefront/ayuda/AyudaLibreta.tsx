'use client';

// «LIBRETA» — la composición de Las Chamisas para /preguntas-frecuentes (§ PREGUNTAS-FRECUENTES-1,
// `.scratch/preguntas-frecuentes/maqueta.html`, vista «c1»). Una libreta de renglones con anillos y
// margen de acento; pestañas por grupo al borde (columna en escritorio, fila arriba en celular, §
// el spec); cada pregunta tiene su casilla punteada que se marca al abrirla; un sticker con el
// nombre del grupo se "pega" (pop) al cambiar de pestaña.
//
// COLORES Y TIPOGRAFÍA: SIEMPRE tokens `--sf-*` — la maqueta usa pasteles fijos por pestaña
// (rosa/verde/amarillo/azul) que son del MUESTRARIO de Las Chamisas, no de esta tienda; acá la
// pestaña activa se distingue por PESO/fondo con los tokens de siempre, no por un cuarto color
// inventado.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CampoEditable from '@/components/storefront/CampoEditable';
import RevelarBloque from '@/components/storefront/RevelarBloque';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { whatsappUrl } from '@/lib/config/site';
import { agruparPreguntas } from '@/lib/storefront/preguntas-frecuentes';
import type { AyudaComposicionProps } from './AyudaCreditos';

export default function AyudaLibreta({ titulo, subtitulo, items, whatsapp }: AyudaComposicionProps) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const grupos = useMemo(() => agruparPreguntas(items), [items]);
  const [grupoActivo, setGrupoActivo] = useState(grupos[0]?.grupo ?? null);
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());

  const activo = grupos.find((g) => g.grupo === grupoActivo) ?? grupos[0] ?? null;

  const toggleFila = (indiceOriginal: number) => {
    setAbiertas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(indiceOriginal)) siguiente.delete(indiceOriginal);
      else siguiente.add(indiceOriginal);
      return siguiente;
    });
  };

  return (
    <section className="bg-[var(--sf-fondo)]">
      <div className={`${contenedorClase} mx-auto py-14`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sf-texto-suave,var(--sf-texto))]">Ayuda</p>
        <h1 className="mt-2 font-playfair text-4xl leading-tight text-[var(--sf-tinta)] sm:text-5xl">
          <CampoEditable campo="preguntasFrecuentes.titulo">{titulo}</CampoEditable>
        </h1>
        {subtitulo && (
          <p className="mt-3 max-w-md text-[var(--sf-texto-suave,var(--sf-texto))]">
            <CampoEditable campo="preguntasFrecuentes.subtitulo" multilinea>{subtitulo}</CampoEditable>
          </p>
        )}
      </div>

      {grupos.length > 0 && activo && (
        <div className={`${contenedorClase} mx-auto pb-16`}>
          <div className="relative rounded-2xl bg-[var(--sf-tarjeta)] p-6 pl-16 shadow-sm sm:p-9 sm:pl-24">
            {/* El margen de acento + los anillos — decoración de "libreta", sin hex de marca. */}
            <div aria-hidden="true" className="absolute inset-y-0 left-10 w-px bg-[var(--sf-acento)]/40 sm:left-16" />
            <div aria-hidden="true" className="absolute left-3 top-7 bottom-7 flex flex-col justify-between sm:left-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="h-3.5 w-3.5 rounded-full bg-[var(--sf-fondo)] shadow-inner" />
              ))}
            </div>

            {/* Pestañas: FILA arriba en celular, COLUMNA al borde derecho en escritorio (§ el spec). */}
            <nav
              aria-label="Grupos"
              role="tablist"
              className="mb-6 flex gap-2 overflow-x-auto md:absolute md:-right-3 md:top-10 md:mb-0 md:flex-col md:gap-2 md:overflow-visible"
            >
              {grupos.map((g) => {
                const on = g.grupo === grupoActivo;
                return (
                  <button
                    key={g.grupo}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setGrupoActivo(g.grupo)}
                    className={`shrink-0 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.12em] transition-colors md:rounded-r-md md:rounded-l-none md:px-2 md:py-3 md:[writing-mode:vertical-rl] ${
                      on
                        ? 'bg-[var(--sf-tinta)] font-semibold text-[var(--sf-fondo)]'
                        : 'bg-[var(--sf-fondo)] text-[var(--sf-texto-suave,var(--sf-texto))]'
                    }`}
                  >
                    {g.grupo}
                  </button>
                );
              })}
            </nav>

            <div className="[background-image:repeating-linear-gradient(transparent_0_38px,var(--sf-linea)_38px_39px)]">
              {activo.items.map((pregunta) => {
                const indiceOriginal = items.indexOf(pregunta);
                const abierta = abiertas.has(indiceOriginal);
                const panelId = `libreta-panel-${indiceOriginal}`;
                const botonId = `libreta-boton-${indiceOriginal}`;
                return (
                  <RevelarBloque key={indiceOriginal} preview={preview} indice={activo.items.indexOf(pregunta) % 6} className="border-b border-dashed border-transparent">
                    <button
                      type="button"
                      id={botonId}
                      aria-expanded={abierta}
                      aria-controls={panelId}
                      onClick={() => toggleFila(indiceOriginal)}
                      className="flex min-h-[40px] w-full items-center gap-3 py-0 text-left leading-[40px]"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 transition-colors ${
                          abierta ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]' : 'border-dashed border-[var(--sf-texto-suave,var(--sf-texto))]'
                        }`}
                      >
                        {abierta && <span className="block h-[5px] w-[9px] -translate-y-px rotate-[-45deg] border-b-2 border-l-2 border-[var(--sf-fondo)]" />}
                      </span>
                      <span className="font-playfair text-lg text-[var(--sf-tinta)] sm:text-xl">
                        <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.question`}>{pregunta.question}</CampoEditable>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {abierta && (
                        <motion.div
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div id={panelId} role="region" aria-labelledby={botonId} className="pb-1 pl-8 leading-relaxed text-[var(--sf-texto-suave,var(--sf-texto))]">
                            <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.answer`} multilinea>{pregunta.answer}</CampoEditable>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <span className="sr-only">
                      <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.grupo`}>{pregunta.grupo}</CampoEditable>
                    </span>
                  </RevelarBloque>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--sf-linea)] pt-4">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activo.grupo}
                  initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, rotate: -6 }}
                  transition={{ duration: 0.32 }}
                  className="inline-block rounded-md bg-[var(--sf-acento)]/20 px-3.5 py-1.5 text-sm text-[var(--sf-tinta)]"
                >
                  {activo.grupo.toLowerCase()}
                </motion.span>
              </AnimatePresence>
              {whatsapp && (
                <a
                  href={whatsappUrl(whatsapp, 'Hola, tengo una pregunta que no encontré en la página de ayuda.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--sf-tinta)] px-5 py-3 text-sm text-[var(--sf-fondo)]"
                >
                  Pregúntanos por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
