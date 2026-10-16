'use client';

// «CRÉDITOS» — la composición de Onix para /preguntas-frecuentes (§ PREGUNTAS-FRECUENTES-1,
// `.scratch/preguntas-frecuentes/maqueta.html`, vista «o1»). Grupos en mayúsculas con filete, un
// índice fijo a la izquierda que sigue la lectura (scroll-spy), y un buscador que filtra y resalta.
//
// COLORES Y TIPOGRAFÍA: SIEMPRE tokens `--sf-*` — nunca los hex de la maqueta (crema/verde/rojo de
// Onix), que son del MUESTRARIO, no de esta tienda. El acento rojo de la maqueta (el punto del grupo
// activo, el "+/–") se resuelve a `--sf-acento`; el verde de los encabezados de grupo, a `--sf-tinta`.
//
// EL TEXTO CORRIDO (subtítulo, respuesta abierta, el aviso de "sin resultados") NO usa
// `--sf-texto-suave` (§ PREGUNTAS-FRECUENTES-ARREGLOS-1): para el tema REAL de Onix ese token deriva
// prácticamente idéntico a `--sf-acento` — medido: ambos rgb(150,23,0) sobre el storefront
// desplegado —, así que un párrafo entero salía en rojo y se leía como un error, no como texto.
// `--chk-tinta-suave`/`PreguntasFrecuentes.tsx` ya documentan el mismo defecto en otras pantallas
// (§ CampoFlotante.test.ts: "que en Onix sale casi del mismo rojo que el botón"). El reemplazo es
// `text-[var(--sf-tinta)]/65` — EXACTAMENTE el que ya usa la respuesta de `PreguntasFrecuentes.tsx`
// (la FAQ de siempre, que este slice no toca) para el mismo rol. El acento queda para el botón y los
// "detalles" (números, eyebrow, etiquetas de grupo inactivas) — ésos NO cambian, siguen en
// `--sf-texto-suave`: son UI chrome, no texto corrido, y la maqueta los deja en su color de "suave"
// con total normalidad.
//
// EL ÍNDICE SÓLO HACE SCROLL-SPY FUERA DE PREVIEW: dentro de la vista previa EN VIVO del editor
// (`VistaTiendaEnVivo.tsx`) el árbol se renderiza escalado (`transform:scale`) y un
// `IntersectionObserver` contra ese contenedor no refleja la posición real de scroll del panel —
// mismo motivo por el que `RevelarBloque`/`whileInView` cambian de rama con `preview` (§ su
// docstring). En preview el índice simplemente no resalta ningún grupo (no hay "scroll" que seguir).
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CampoEditable from '@/components/storefront/CampoEditable';
import RevelarBloque from '@/components/storefront/RevelarBloque';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { whatsappUrl } from '@/lib/config/site';
import {
  agruparPreguntas,
  gruposFiltrados,
  totalPreguntas,
  resaltarCoincidencia,
  type PreguntaItem,
} from '@/lib/storefront/preguntas-frecuentes';

export interface AyudaComposicionProps {
  titulo: string;
  subtitulo: string;
  items: PreguntaItem[];
  /** El número de WhatsApp del negocio (§ GrindChooser/SuscripcionPlanes, MISMO patrón de prop — no
   *  `useSiteSettings()` directo: este componente también se monta en el árbol ADMIN de la vista
   *  previa en vivo, que no tiene `SiteSettingsProvider` y haría LANZAR al hook). Ausente/vacío →
   *  el cierre "¿No está tu pregunta?" se omite (CTA sin destino real, mismo criterio que el resto
   *  del storefront: "vacío → no se muestra", nunca un botón muerto). */
  whatsapp?: string;
  /** La franja de tejido decorativa (§ PREGUNTAS-FRECUENTES-ARREGLOS-1, `preguntasFrecuentes.
   *  franjaTejido`) — SÓLO la lee «Libreta» (Las Chamisas), igual que `tiendaCierre.franjaTejido`
   *  "sólo tiene efecto bajo 'costura'". Viaja por las TRES composiciones (mismo patrón que
   *  `whatsapp`) para que `AyudaPagina` no tenga que ramificar qué props manda a cuál; «Créditos» y
   *  «Lista» simplemente no la destructuran. Ausente/vacío → ninguna franja se dibuja (nunca se
   *  imita con CSS/hex — § el criterio de siempre). */
  franjaTejido?: string;
}

export default function AyudaCreditos({ titulo, subtitulo, items, whatsapp }: AyudaComposicionProps) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const [query, setQuery] = useState('');
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());
  // `null` = "sin elección manual todavía" — el grupo activo cae al PRIMERO (abajo), sin un efecto
  // de sincronización inicial (§ react-hooks/set-state-in-effect: un setState síncrono en el cuerpo
  // de un efecto dispara renders en cascada). El clic en el índice y el scroll-spy SÍ escriben este
  // estado — eso vive dentro de un callback de evento/observer, no en el cuerpo del efecto.
  const [grupoActivoManual, setGrupoActivoManual] = useState<string | null>(null);
  const refsGrupo = useRef(new Map<string, HTMLElement>());

  const grupos = useMemo(() => agruparPreguntas(items), [items]);
  const visibles = useMemo(() => gruposFiltrados(grupos, query), [grupos, query]);
  const totalGeneral = totalPreguntas(grupos);
  const totalVisible = totalPreguntas(visibles);
  const grupoActivo = grupoActivoManual ?? grupos[0]?.grupo ?? null;

  // EL SCROLL-SPY (§ la maqueta: "un índice fijo... que sigue tu lectura"). `rootMargin` deja una
  // franja activa en el TERCIO superior del viewport — el mismo criterio de la maqueta
  // (`-40% 0px -55% 0px`), para que el grupo se marque activo cuando su encabezado ya cruzó la zona
  // de lectura, no recién al entrar por abajo.
  useEffect(() => {
    if (preview) return;
    const nodos = [...refsGrupo.current.values()];
    if (nodos.length === 0) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            const grupo = (entrada.target as HTMLElement).dataset.grupo;
            if (grupo) setGrupoActivoManual(grupo);
          }
        }
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    nodos.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [visibles, preview]);

  const irAGrupo = (grupo: string) => {
    refsGrupo.current.get(grupo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFila = (indiceOriginal: number) => {
    setAbiertas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(indiceOriginal)) siguiente.delete(indiceOriginal);
      else siguiente.add(indiceOriginal);
      return siguiente;
    });
  };

  // LA NUMERACIÓN CONTINUA (01, 02, 03…) — precalculada en UN solo paso, no con un contador mutado
  // dentro del `.map()` de render (react-hooks/immutability: reasignar una variable mientras se
  // renderiza puede dejar estado inconsistente entre renders). El mapa va por índice ORIGINAL —el
  // mismo que ya identifica la fila para `CampoEditable`/el toggle de apertura— así que sobrevive
  // intacto si el filtro de búsqueda cambia cuáles preguntas están visibles.
  const numeroPorIndiceOriginal = useMemo(() => {
    const mapa = new Map<number, number>();
    let n = 0;
    for (const g of visibles) {
      for (const it of g.items) {
        n += 1;
        mapa.set(items.indexOf(it), n);
      }
    }
    return mapa;
  }, [visibles, items]);

  return (
    <section className="bg-[var(--sf-fondo)]">
      {/* DOS COLUMNAS en escritorio (§ la maqueta, `.o-cab`): título a la izquierda, subtítulo +
          buscador a la derecha, alineados al pie. Apila en una columna por debajo de `md`. */}
      <div className={`${contenedorClase} mx-auto grid grid-cols-1 items-end gap-8 border-b border-[var(--sf-linea)]/60 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--sf-texto-suave,var(--sf-texto))]">
            Ayuda
          </p>
          <h1 className="mt-3 font-playfair text-4xl uppercase leading-[0.95] text-[var(--sf-tinta)] sm:text-5xl md:text-6xl">
            <CampoEditable campo="preguntasFrecuentes.titulo">{titulo}</CampoEditable>
          </h1>
        </div>
        <div>
          {subtitulo && (
            <p className="max-w-md text-[var(--sf-tinta)]/65">
              <CampoEditable campo="preguntasFrecuentes.subtitulo" multilinea>{subtitulo}</CampoEditable>
            </p>
          )}
          <label className="mt-4 flex max-w-md items-center gap-2 border-b border-[var(--sf-tinta)] pb-2">
            <span aria-hidden="true" className="text-[var(--sf-texto-suave,var(--sf-texto))]">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca: envío, Nequi, molido…"
              aria-label="Buscar una pregunta"
              className="min-w-0 flex-1 bg-transparent text-[var(--sf-tinta)] outline-none placeholder:text-[var(--sf-texto-suave,var(--sf-texto))]"
            />
            {query && (
              <small className="font-mono text-xs text-[var(--sf-texto-suave,var(--sf-texto))]">
                {totalVisible} de {totalGeneral}
              </small>
            )}
          </label>
        </div>
      </div>

      {grupos.length === 0 ? null : (
        <div className={`${contenedorClase} mx-auto grid grid-cols-1 gap-10 py-10 md:grid-cols-[220px_minmax(0,1fr)]`}>
          <nav aria-label="Grupos" className="flex gap-3 overflow-x-auto md:sticky md:top-24 md:flex-col md:self-start md:overflow-visible">
            {grupos.map((g) => (
              <button
                key={g.grupo}
                type="button"
                onClick={() => irAGrupo(g.grupo)}
                className={`flex shrink-0 items-center justify-between gap-3 border-b border-[var(--sf-linea)] py-2 text-[11px] uppercase tracking-[0.18em] transition-colors md:border-b ${
                  grupoActivo === g.grupo ? 'text-[var(--sf-tinta)]' : 'text-[var(--sf-texto-suave,var(--sf-texto))]'
                }`}
              >
                <span className="flex items-center gap-2">
                  {grupoActivo === g.grupo && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--sf-acento)]" />}
                  {g.grupo}
                </span>
                <span className="font-mono text-[10px] text-[var(--sf-texto-suave,var(--sf-texto))]">{String(g.items.length).padStart(2, '0')}</span>
              </button>
            ))}
          </nav>

          <div>
            {visibles.length === 0 ? (
              <p className="text-sm text-[var(--sf-tinta)]/65">No encontramos ninguna pregunta con «{query}».</p>
            ) : (
              visibles.map((g) => (
                <section
                  key={g.grupo}
                  data-grupo={g.grupo}
                  ref={(nodo) => {
                    if (nodo) refsGrupo.current.set(g.grupo, nodo);
                    else refsGrupo.current.delete(g.grupo);
                  }}
                  className="mb-11"
                >
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--sf-tinta)]">{g.grupo}</h3>
                  {g.items.map((pregunta) => {
                    const indiceOriginal = items.indexOf(pregunta);
                    const abierta = abiertas.has(indiceOriginal);
                    const n = numeroPorIndiceOriginal.get(indiceOriginal) ?? 0;
                    const panelId = `creditos-panel-${indiceOriginal}`;
                    const botonId = `creditos-boton-${indiceOriginal}`;
                    const segmentosPregunta = resaltarCoincidencia(pregunta.question, query);
                    return (
                      <RevelarBloque key={indiceOriginal} preview={preview} indice={n % 6} className="border-t border-[var(--sf-linea)]/60 last:border-b">
                        <button
                          type="button"
                          id={botonId}
                          aria-expanded={abierta}
                          aria-controls={panelId}
                          onClick={() => toggleFila(indiceOriginal)}
                          className="grid w-full grid-cols-[44px_minmax(0,1fr)_24px] items-baseline gap-3 py-4 text-left"
                        >
                          <span className="font-mono text-xs text-[var(--sf-texto-suave,var(--sf-texto))]">{String(n).padStart(2, '0')}</span>
                          <span className="font-playfair text-xl leading-snug text-[var(--sf-tinta)]">
                            {segmentosPregunta.map((seg, i) =>
                              seg.resaltado ? (
                                <mark key={i} className="bg-[var(--sf-acento)]/30 text-[var(--sf-tinta)]">{seg.texto}</mark>
                              ) : (
                                <span key={i}>{seg.texto}</span>
                              ),
                            )}
                          </span>
                          <span aria-hidden="true" className="relative h-3.5 w-3.5 self-center">
                            <span className={`absolute left-0 top-1/2 h-[1.5px] w-3.5 -translate-y-1/2 bg-[var(--sf-tinta)] transition-transform duration-300 ${abierta ? '' : 'rotate-90'}`} />
                            <span className="absolute left-0 top-1/2 h-[1.5px] w-3.5 -translate-y-1/2 bg-[var(--sf-tinta)]" />
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
                              <div id={panelId} role="region" aria-labelledby={botonId} className="max-w-[62ch] pb-5 pl-[56px] text-[var(--sf-tinta)]/65">
                                <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.answer`} multilinea>{pregunta.answer}</CampoEditable>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {/* Mantiene el campo editable de `grupo`/`question` alcanzable, sin texto visible duplicado. */}
                        <span className="sr-only">
                          <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.grupo`}>{pregunta.grupo}</CampoEditable>
                          <CampoEditable campo={`preguntasFrecuentes.items.${indiceOriginal}.question`}>{pregunta.question}</CampoEditable>
                        </span>
                      </RevelarBloque>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </div>
      )}

      {whatsapp && (
        <div className="bg-[var(--sf-tinta)] px-6 py-10">
          <div className={`${contenedorClase} mx-auto flex flex-wrap items-center justify-between gap-5`}>
            <p className="font-playfair text-2xl uppercase text-[var(--sf-fondo)]">¿No está tu pregunta?</p>
            <a
              href={whatsappUrl(whatsapp, 'Hola, tengo una pregunta que no encontré en la página de ayuda.')}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[var(--sf-acento)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]"
            >
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
