'use client';

// «LIBRETA» — la composición de Las Chamisas para /preguntas-frecuentes (§ PREGUNTAS-FRECUENTES-1,
// `.scratch/preguntas-frecuentes/maqueta.html`, vista «c1»). Una libreta de renglones con anillos y
// margen de acento; pestañas por grupo al borde (columna en escritorio, fila arriba en celular, §
// el spec); cada pregunta tiene su casilla punteada que se marca al abrirla; un sticker con el
// nombre del grupo se "pega" (pop) al cambiar de pestaña.
//
// COLORES Y TIPOGRAFÍA: SIEMPRE tokens `--sf-*` — la maqueta usa pasteles fijos por pestaña
// (rosa/verde/amarillo/azul) que son del MUESTRARIO de Las Chamisas, no de esta tienda; acá cada
// pestaña va en SU PROPIO pastel DERIVADO (§ el bloque de abajo), nunca un hex de la maqueta.
//
// § PREGUNTAS-FRECUENTES-ARREGLOS-1 — tres ajustes de fidelidad contra la maqueta aprobada:
//  - El TÍTULO pasa de `text-4xl…sm:text-5xl` (36–48px) a `text-[clamp(38px,5.4vw,72px)]`, el MISMO
//    clamp que `.c-h` de la maqueta — a 1440px el viejo se quedaba en 48px fijo (sin breakpoint más
//    allá de `sm`) contra los ~72px que la maqueta alcanza.
//  - La INTRO (subtítulo) deja `--sf-texto-suave` por `text-[var(--sf-tinta)]/65` — mismo defecto y
//    mismo remedio que en «Créditos» (§ AyudaCreditos.tsx): para el tema de Las Chamisas ese token
//    deriva un terracota casi idéntico al acento, y una frase entera en ese color se lee como error.
//  - Un STICKER de cabecera, "sin letra menuda" — la maqueta lo escribe así (no "en letra menuda"),
//    arriba a la derecha del encabezado (`.c-cab`, `grid-template-columns:minmax(0,1fr) auto`).
//    Copy DECORATIVA, no dato del repeater/campos de esta sección (como "¿No está tu pregunta?" más
//    abajo): no hay fila de SiteContent que la sostenga, así que es un literal, no un CampoEditable.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CampoEditable from '@/components/storefront/CampoEditable';
import RevelarBloque from '@/components/storefront/RevelarBloque';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { whatsappUrl } from '@/lib/config/site';
import { agruparPreguntas } from '@/lib/storefront/preguntas-frecuentes';
import { colorDeLamina, lavadoLamina } from '@/lib/tienda/laminas';
import type { AyudaComposicionProps } from './AyudaCreditos';

export default function AyudaLibreta({ titulo, subtitulo, items, whatsapp, franjaTejido = '' }: AyudaComposicionProps) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const grupos = useMemo(() => agruparPreguntas(items), [items]);
  const [grupoActivo, setGrupoActivo] = useState(grupos[0]?.grupo ?? null);
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());
  const hayFranja = franjaTejido.trim() !== '';

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
      {/* LA FRANJA DE TEJIDO — a sangre, arriba Y abajo de toda la composición (§ la maqueta: un
          `.tejido` bajo el nav y otro al pie de la página). Vacía → nada se dibuja, nunca un
          patrón imitado con CSS/hex (§ CierreCostura.tsx, el mismo criterio). */}
      {hayFranja && (
        <CampoEditable campo="preguntasFrecuentes.franjaTejido" tipo="imagen">
          <div
            className="h-[22px] w-full sm:h-[34px]"
            style={{ backgroundImage: `url(${franjaTejido})`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
            aria-hidden="true"
          />
        </CampoEditable>
      )}

      {/* ENCABEZADO en grid (§ la maqueta, `.c-cab`): eyebrow+título+intro a la izquierda, el
          sticker "sin letra menuda" a la derecha, alineados al pie. Apila en una columna por
          debajo de `md` — el sticker baja debajo del párrafo, nunca se esconde. */}
      <div className={`${contenedorClase} mx-auto grid grid-cols-1 items-end gap-6 py-14 md:grid-cols-[minmax(0,1fr)_auto]`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sf-texto-suave,var(--sf-texto))]">Ayuda</p>
          <h1 className="mt-2 font-playfair text-[clamp(38px,5.4vw,72px)] leading-[1.02] text-[var(--sf-tinta)]">
            <CampoEditable campo="preguntasFrecuentes.titulo">{titulo}</CampoEditable>
          </h1>
          {subtitulo && (
            <p className="mt-3 max-w-md text-[var(--sf-tinta)]/65">
              <CampoEditable campo="preguntasFrecuentes.subtitulo" multilinea>{subtitulo}</CampoEditable>
            </p>
          )}
        </div>
        <span className="inline-block w-fit -rotate-6 rounded-md bg-[var(--sf-acento)]/20 px-3.5 py-1.5 text-sm text-[var(--sf-tinta)] shadow-sm">
          sin letra menuda
        </span>
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

            {/* Pestañas: FILA arriba en celular, COLUMNA al borde derecho en escritorio (§ el spec).
                § PREGUNTAS-FRECUENTES-ARREGLOS-1 — CADA pestaña va en SU PROPIO pastel (§ la
                maqueta: `style="background:…"` por botón, las CUATRO, activa incluida — no sólo la
                inactiva). El pastel sale de "Colores por café" (`colorDeLamina`/`lavadoLamina`,
                `lib/tienda/laminas.ts`, la MISMA paleta derivada que ya pinta las Láminas del
                catálogo), por ORDEN de grupo — nunca un hex de la maqueta (rosa/verde/amarillo/
                azul son del muestrario). `lavadoLamina` garantiza ≥4.5:1 contra `--sf-tinta`, así
                que el texto siempre lee en tinta plena, sin opacidad reducida. La ACTIVA se
                distingue por PESO + un leve desplazamiento hacia afuera en escritorio (`md:
                translate-x-1`, el mismo gesto que `.on{transform:translateX(8px)}` de la maqueta),
                nunca por un cuarto color. */}
            <nav
              aria-label="Grupos"
              role="tablist"
              className="mb-6 flex gap-2 overflow-x-auto md:absolute md:-right-3 md:top-10 md:mb-0 md:flex-col md:gap-2 md:overflow-visible"
            >
              {grupos.map((g, i) => {
                const on = g.grupo === grupoActivo;
                const pastel = lavadoLamina(colorDeLamina(g.grupo, i, {}));
                return (
                  <button
                    key={g.grupo}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setGrupoActivo(g.grupo)}
                    style={{ backgroundColor: pastel }}
                    className={`shrink-0 rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--sf-tinta)] transition-transform md:rounded-r-md md:rounded-l-none md:px-2 md:py-3 md:[writing-mode:vertical-rl] ${
                      on ? 'font-semibold shadow-sm md:translate-x-1' : ''
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

      {hayFranja && (
        <CampoEditable campo="preguntasFrecuentes.franjaTejido" tipo="imagen">
          <div
            className="h-[22px] w-full sm:h-[34px]"
            style={{ backgroundImage: `url(${franjaTejido})`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
            aria-hidden="true"
          />
        </CampoEditable>
      )}
    </section>
  );
}
