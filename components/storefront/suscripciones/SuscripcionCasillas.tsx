"use client";

// LA COMPOSICIÓN «CASILLAS» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4 — aprobada
// por el owner el 2026-10-12 sobre la maqueta `.scratch/chamisas-paginas/nosotros-suscripciones.html`).
// Montada por `SuscripcionPlanes.tsx` SÓLO con `suscripcionPlanes.variante === 'casillas'` Y una
// matriz 2×N VÁLIDA (`derivarMatrizTaquilla`) — sin ella cae sola a «Tarjetas», el MISMO patrón que
// «Taquilla» (§ SuscripcionPlanes.tsx) y «Láminas»/«Taquilla» de /tienda (§ TiendaCatalogo.tsx).
//
// «ARMA TU PEDIDO» ES LA TAQUILLA, CON TRATO CHAMISAS (§ el spec, item 2): el catálogo real se
// deriva con la MISMA `derivarMatrizTaquilla` que usa «Taquilla» — nunca un segundo modelo de
// producto. La diferencia es de CARDINALIDAD: Taquilla elige UNA celda; Casillas elige VARIOS
// cafés (las filas de la matriz) a la vez, cada uno con su cantidad, compartiendo UNA bolsa y UNA
// molienda para TODO el pedido. El porqué de que "precio por confirmar" no exista acá —la matriz
// garantiza completitud— vive en el docstring de cabecera de `lib/storefront/suscripcion-
// taquilla.ts`, § LA COMPOSICIÓN «CASILLAS».
//
// LA APERTURA REUSA eyebrow/titulo/tituloEnfasis/subtitulo — los MISMOS campos que «Tarjetas» (NO
// se duplican): las dos composiciones comparten el mismo concepto de encabezado, sólo con
// tratamiento visual distinto (fondo crema con sticker inclinado, en vez de la banda oscura de
// «Tarjetas», § el spec, item 1: "Fondo crema, no oscuro").
//
// LA FRECUENCIA POR DEFECTO ES LA ÚLTIMA CONFIGURADA, como en «Taquilla» (§ ONIX-PAGINAS-
// FIDELIDAD-1) — no la "del medio" que muestra la maqueta (su `S.freq` arranca en 'm1', la segunda
// de tres): se alinea a la convención YA establecida de esta sección en vez de introducir una
// segunda regla de default para el mismo concepto.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, MessageCircle } from 'lucide-react';
import { formatCOP } from '@duna/core/utils';
import { whatsappUrl } from '@/lib/config/site';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import CampoEditable from '@/components/storefront/CampoEditable';
import { derivarMatrizTaquilla, celdaDe } from '@/lib/tienda/taquilla';
import { colorDeLamina } from '@/lib/tienda/laminas';
import {
  frecuenciasDeTaquilla,
  itemsCasillas,
  bolsasCasillas,
  totalPorEnvioCasillas,
  moliendasCasillas,
  frecuenciaEstructuraPorSlot,
  topeUnidadesCasilla,
  type CantidadesCasillas,
} from '@/lib/storefront/suscripcion-taquilla';
import { casillasDeFrecuencia, totalEnviosEnVentana, NOMBRES_MES_ABREV } from '@/lib/storefront/casillas-frecuencia';
import { lineasNotaPedido, mensajeNotaPedido, type LineaPedido } from '@/lib/storefront/nota-pedido';
import {
  visibilidadBarraFija,
  altoPublicadoBarraFija,
  DURACION_BARRA_FIJA_S,
  VAR_ALTO_BARRA_FIJA,
} from '@/lib/storefront/barra-fija';
import type { Product } from '@/types/product';
import type { SuscripcionPlanesContent } from '@/lib/config/site-content-defaults';

interface SuscripcionCasillasProps {
  catalog: Product[];
  whatsapp?: string;
  /** El nombre del negocio, para el saludo de la Nota de pedido — llega por PROP, nunca por
   *  `useSiteSettings()` (este componente se monta también en el preview del panel, que no tiene
   *  el `SiteSettingsProvider` del storefront, § el {negocio} de GrindChooser/NosotrosGaleria). */
  negocio?: string;
  suscripcionPlanes: SuscripcionPlanesContent;
}

interface MarcaCafe {
  categoria: string;
  color: string;
}

export default function SuscripcionCasillas({ catalog, whatsapp, negocio, suscripcionPlanes: c }: SuscripcionCasillasProps) {
  const { tiendaCatalogo } = useSiteContent();
  const preview = useIsPreview();
  const matriz = useMemo(() => derivarMatrizTaquilla(catalog), [catalog]);
  const [cantidades, setCantidades] = useState<CantidadesCasillas>({});
  const [peso, setPeso] = useState<number | null>(null);
  const [moliendaElegida, setMoliendaElegida] = useState<string | null>(null);
  const [frecuenciaSlot, setFrecuenciaSlot] = useState<number | null>(null);
  const [ciudad, setCiudad] = useState('');

  const botonRef = useRef<HTMLDivElement | null>(null);
  const [barraFijaVisible, setBarraFijaVisible] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);
  const [finVisible, setFinVisible] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda de montaje estándar, § SuscripcionTaquilla.tsx
    setMontado(true);
  }, []);

  useEffect(() => {
    const el = botonRef.current;
    if (!el || typeof window === 'undefined') return;
    const evaluar = () => {
      const rect = el.getBoundingClientRect();
      setBarraFijaVisible((antes) => visibilidadBarraFija(rect, window.innerHeight, antes));
    };
    evaluar();
    window.addEventListener('scroll', evaluar, { passive: true });
    window.addEventListener('resize', evaluar);
    return () => {
      window.removeEventListener('scroll', evaluar);
      window.removeEventListener('resize', evaluar);
    };
  }, [matriz]);

  useEffect(() => {
    const el = finRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setFinVisible(entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [matriz]);

  if (!matriz) return null;

  const pesoActivo = peso != null && matriz.columnas.includes(peso) ? peso : matriz.columnas[0];
  const items = itemsCasillas(matriz, cantidades, pesoActivo);

  const frecuencias = frecuenciasDeTaquilla([c.frecuencia1, c.frecuencia2, c.frecuencia3, c.frecuencia4]);
  // DEFAULT = ÚLTIMA frecuencia configurada (§ el docstring de cabecera).
  const slotActivo =
    frecuenciaSlot != null && frecuenciaSlot >= 1 && frecuenciaSlot <= frecuencias.length ? frecuenciaSlot : frecuencias.length;
  const frecuenciaEtiqueta = frecuencias[slotActivo - 1] ?? frecuencias[0];
  const estructura = frecuenciaEstructuraPorSlot(Math.min(4, Math.max(1, slotActivo)) as 1 | 2 | 3 | 4);

  const opcionesMolienda = moliendasCasillas(items.length > 0 ? items.map((i) => i.producto) : matriz.filas.map((f) => matriz.celdas.get(celdaDe(f, pesoActivo))!));
  const moliendaActiva = moliendaElegida && opcionesMolienda.includes(moliendaElegida) ? moliendaElegida : opcionesMolienda[0] ?? null;

  const total = totalPorEnvioCasillas(items);
  const totalTexto = total != null ? formatCOP(total) : null;
  const bolsas = bolsasCasillas(items);

  const colorDeCafe = (categoria: string): string => {
    const producto = matriz.celdas.get(celdaDe(categoria, pesoActivo))!;
    return colorDeLamina(producto.id, catalog.indexOf(producto), tiendaCatalogo.coloresPorProducto);
  };

  const marcas: MarcaCafe[] = items.map((it) => ({ categoria: it.categoria, color: colorDeCafe(it.categoria) }));
  const casillas = casillasDeFrecuencia(estructura, marcas, new Date(), 6);
  const totalEnvios = totalEnviosEnVentana(estructura, 6);

  const lineasPedido: LineaPedido[] = items.map((it) => ({
    cantidad: it.cantidad,
    nombre: it.categoria,
    tamano: `${pesoActivo} g`,
    molienda: moliendaActiva ? moliendaActiva.toLowerCase() : undefined,
  }));
  const notaInput = {
    negocio: negocio ?? 'esta tienda',
    frecuenciaFrase: frecuenciaEtiqueta ? `cada ${frecuenciaEtiqueta.toLowerCase()}` : '',
    items: lineasPedido,
    placeholderSinItems: '(elige al menos un café)',
    totalTexto: totalTexto ? `${totalTexto} + envío` : '—',
    ciudad,
    preguntaCierre: c.casillasPreguntaCierre,
  };
  const lineasMensaje = lineasNotaPedido(notaInput);
  const mensaje = mensajeNotaPedido(notaInput);
  const mostrarBarra = barraFijaVisible && !finVisible;

  const setCantidad = (categoria: string, delta: number) => {
    const producto = matriz.celdas.get(celdaDe(categoria, pesoActivo))!;
    const tope = topeUnidadesCasilla(producto);
    setCantidades((antes) => {
      const actual = antes[categoria] ?? 0;
      const siguiente = Math.max(0, Math.min(tope, actual + delta));
      return { ...antes, [categoria]: siguiente };
    });
  };

  const ayudaHref = whatsapp ? whatsappUrl(whatsapp, c.casillasAyudaMensaje) : undefined;

  return (
    <div>
      {/* Movimiento (§ el spec: "sticker se pega… 180ms"/"casillas se llenan en cascada… 30ms" — con
          `prefers-reduced-motion`, instantáneo). El guard GLOBAL ya zeroea duración/iteraciones bajo
          reduced-motion (app/globals.css), así que esta hoja no necesita su propio guard — mismo
          criterio que `EstadoPedido.tsx` (§ COMPRA-LINEAS-ONIX-CHAMISAS-1). */}
      <style>{`
        @keyframes casillas-sticker-pega { from { transform: scale(0.85) rotate(-6deg); opacity: 0; } to { transform: scale(1) rotate(-6deg); opacity: 1; } }
        .casillas-sticker { animation: casillas-sticker-pega 180ms ease-out; }
        @keyframes casillas-llenar { from { opacity: 0.35; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        .casillas-cascada { animation: casillas-llenar 220ms ease-out both; }
      `}</style>

      {/* APERTURA (§ el spec, item 1): fondo crema, sticker inclinado, línea explicativa. REUSA
          eyebrow/titulo/tituloEnfasis/subtitulo — ver el docstring de cabecera. */}
      <section className="relative bg-[var(--sf-fondo)] px-4 py-16 text-center sm:py-20">
        {c.eyebrow && (
          <p className="mb-4 text-xs uppercase tracking-widest text-[var(--sf-tostado)]">
            <CampoEditable campo="suscripcionPlanes.eyebrow">{c.eyebrow}</CampoEditable>
          </p>
        )}
        <h1 className="font-playfair text-4xl text-[var(--sf-tinta)] sm:text-5xl">
          <CampoEditable campo="suscripcionPlanes.titulo">{c.titulo}</CampoEditable>
          {c.tituloEnfasis && (
            <>
              {' '}
              <span
                className="inline-block -rotate-3 rounded-sm bg-[var(--sf-tostado-4,var(--sf-acento-4))] px-3 py-1 align-middle text-base font-sans font-semibold uppercase tracking-wide text-[var(--sf-tinta)]"
              >
                <CampoEditable campo="suscripcionPlanes.tituloEnfasis">{c.tituloEnfasis}</CampoEditable>
              </span>
            </>
          )}
        </h1>
        {c.casillasSticker && (
          <p className="mt-4">
            <span className="inline-block -rotate-6 rounded-sm bg-[var(--sf-tostado-4,var(--sf-acento-4))] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--sf-tinta)] shadow-sm">
              <CampoEditable campo="suscripcionPlanes.casillasSticker">{c.casillasSticker}</CampoEditable>
            </span>
          </p>
        )}
        {c.subtitulo && (
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--sf-texto)]">
            <CampoEditable campo="suscripcionPlanes.subtitulo" multilinea>{c.subtitulo}</CampoEditable>
          </p>
        )}
      </section>

      {/* ARMA TU PEDIDO (§ el spec, item 2): 7/5, los pasos a la izquierda, la nota fija a la
          derecha (en escritorio) — § el spec, item 3: "Escritorio: 7/5". */}
      <section className="bg-[var(--sf-fondo)] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[7fr_5fr] lg:items-start lg:gap-12">
          <div className="space-y-10">
            {/* PASO 1 — ¿Qué café? */}
            <div>
              <PasoCabecera numero={1} titulo="¿Qué café?" hint="Suma bolsas de uno o de varios. Puedes mezclar." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matriz.filas.map((categoria) => {
                  const producto = matriz.celdas.get(celdaDe(categoria, pesoActivo))!;
                  const cantidad = cantidades[categoria] ?? 0;
                  const color = colorDeCafe(categoria);
                  return (
                    <div
                      key={categoria}
                      className="flex flex-col rounded-2xl border border-dashed border-[var(--sf-linea)] p-4"
                      style={{ backgroundColor: `${color}26` }}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        {producto.imagen ? (
                          <img src={producto.imagen} alt="" className="h-14 w-14 shrink-0 rounded-full border-2 border-[var(--sf-fondo)] object-cover shadow-sm" />
                        ) : (
                          <span className="h-14 w-14 shrink-0 rounded-full border-2 border-[var(--sf-fondo)] shadow-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate font-playfair text-lg text-[var(--sf-tinta)]">{categoria}</h3>
                          {producto.notas && producto.notas.length > 0 && (
                            <p className="truncate text-xs text-[var(--sf-texto-suave)]">{producto.notas.join(' · ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-sm font-semibold text-[var(--sf-tinta)]">{formatCOP(producto.precio)}</span>
                        <span role="group" aria-label={`Bolsas de ${categoria}`} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCantidad(categoria, -1)}
                            disabled={cantidad === 0}
                            aria-label={`Quitar una bolsa de ${categoria}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--sf-tinta)]/30 text-[var(--sf-tinta)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[var(--sf-superficie)]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <output aria-live="polite" className="w-6 text-center tabular-nums text-[var(--sf-tinta)]">{cantidad}</output>
                          <button
                            type="button"
                            onClick={() => setCantidad(categoria, 1)}
                            disabled={cantidad >= topeUnidadesCasilla(producto)}
                            aria-label={`Sumar una bolsa de ${categoria}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--sf-tinta)]/30 text-[var(--sf-tinta)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[var(--sf-superficie)]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {ayudaHref && (
                <a
                  href={ayudaHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--sf-tinta)] underline hover:no-underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <CampoEditable campo="suscripcionPlanes.casillasAyudaLabel">{c.casillasAyudaLabel}</CampoEditable>
                </a>
              )}
            </div>

            {/* PASO 2 — Bolsa y molienda */}
            <div>
              <PasoCabecera numero={2} titulo="Bolsa y molienda" hint="Aplica a todo el pedido." />
              <div role="group" aria-label="Tamaño de bolsa" className="grid grid-cols-2 gap-3">
                {matriz.columnas.map((p) => {
                  const representativo = matriz.celdas.get(celdaDe(matriz.filas[0], p))!;
                  const elegido = p === pesoActivo;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => setPeso(p)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                        elegido ? 'border-[var(--sf-tinta)]' : 'border-[var(--sf-linea)] hover:border-[var(--sf-tinta)]/40'
                      }`}
                    >
                      {representativo.imagen && (
                        <img src={representativo.imagen} alt="" className="h-16 w-10 object-contain" />
                      )}
                      <span className="text-sm font-semibold text-[var(--sf-tinta)]">{p} g</span>
                    </button>
                  );
                })}
              </div>
              {opcionesMolienda.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-texto-suave)]">
                    <CampoEditable campo="suscripcionPlanes.taquillaEtiquetaMolienda">{c.taquillaEtiquetaMolienda}</CampoEditable>
                  </p>
                  <div role="group" aria-label="Molienda" className="flex flex-wrap gap-2">
                    {opcionesMolienda.map((nombre) => (
                      <button
                        key={nombre}
                        type="button"
                        aria-pressed={nombre === moliendaActiva}
                        onClick={() => setMoliendaElegida(nombre)}
                        className={`rounded-full border-2 px-4 py-1.5 text-sm transition-colors ${
                          nombre === moliendaActiva
                            ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                            : 'border-[var(--sf-linea)] text-[var(--sf-tinta)] hover:border-[var(--sf-tinta)]/40'
                        }`}
                      >
                        {nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PASO 3 — ¿Cada cuánto? + Casillas de frecuencia */}
            <div>
              <PasoCabecera numero={3} titulo="¿Cada cuánto?" hint="Así se ven tus próximos seis meses." />
              <div role="group" aria-label="Frecuencia" className="flex flex-wrap gap-2">
                {frecuencias.map((f, i) => {
                  const slot = i + 1;
                  const elegido = slot === slotActivo;
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => setFrecuenciaSlot(slot)}
                      className={`rounded-full border-2 px-4 py-1.5 text-sm transition-colors ${
                        elegido
                          ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                          : 'border-[var(--sf-linea)] text-[var(--sf-tinta)] hover:border-[var(--sf-tinta)]/40'
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>

              {/* CASILLAS DE FRECUENCIA (§ `lib/storefront/casillas-frecuencia.ts`) — `key={slotActivo}`
                  remonta el `<ol>` al cambiar de frecuencia, para que el stagger de 30ms se REPITA
                  cada vez (§ el spec, "las casillas se llenan en cascada… al cambiar la frecuencia"). */}
              <ol key={slotActivo} aria-label="Próximos seis meses" className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {casillas.map((casilla, i) => (
                  <li
                    key={i}
                    className="casillas-cascada relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--sf-linea)] p-1 text-center"
                    style={preview ? undefined : { animationDelay: `${i * 30}ms` }}
                  >
                    {casilla.marcas.length > 0 ? (
                      <span className="flex -space-x-1" aria-hidden="true">
                        {casilla.marcas.map((m) => (
                          <span key={m.categoria} className="h-5 w-5 rounded-full border border-[var(--sf-fondo)]" style={{ backgroundColor: m.color }} />
                        ))}
                      </span>
                    ) : (
                      // «Las vacías llevan el sello en tono» (§ el spec, item 2 de refero-chamisas.md
                      // §4) — y las dos razones de estar vacía son DISTINTAS: un mes CON envío
                      // programado pero sin café elegido todavía (sello neutro, el espacio que se va
                      // a llenar) vs. un mes SIN envío en esta cadencia (el mismo sello, MÁS la
                      // etiqueta "sin envío" — mismo criterio que la maqueta: `ship?'':'<span
                      // class="off">sin envío</span>'`).
                      <span className="h-5 w-5 rounded-full border border-dashed border-[var(--sf-linea)]" aria-hidden="true" />
                    )}
                    {casilla.dosVeces && <span className="absolute right-1 top-1 text-[10px] font-bold text-[var(--sf-tostado)]">×2</span>}
                    {!casilla.conEnvio && (
                      <span className="text-[8px] uppercase tracking-wide text-[var(--sf-texto-suave)]/70">sin envío</span>
                    )}
                    <span className="text-[10px] uppercase text-[var(--sf-texto-suave)]">
                      {NOMBRES_MES_ABREV[casilla.mes]}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-[var(--sf-texto)]">
                {items.length > 0 ? (
                  <>
                    <b>{totalEnvios} envíos en 6 meses</b> · {totalTexto} por envío + envío
                  </>
                ) : (
                  'Elige un café y estas casillas se llenan con su sticker.'
                )}
              </p>
            </div>
          </div>

          {/* NOTA DE PEDIDO (§ el spec, item 3: hoja crema con borde punteado, tejido como membrete) */}
          <aside aria-labelledby="nota-pedido-titulo" className="lg:sticky lg:top-24">
            <div className="rounded-2xl border-2 border-dashed border-[var(--sf-linea)] bg-[var(--sf-superficie)] p-6">
              {/* El tejido como membrete (§ el spec, item 3) — mismo patrón de rayado diagonal que
                  la lámina de `EstadoPedido.tsx` (§ COMPRA-LINEAS-ONIX-CHAMISAS-1), sin imagen: un
                  degradado repetido imita la costura sin depender de un asset que la tienda suba. */}
              <div
                aria-hidden="true"
                className="-mx-6 -mt-6 mb-4 h-3 rounded-t-2xl"
                style={{ background: 'repeating-linear-gradient(45deg, var(--sf-acento) 0, var(--sf-acento) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 12px)' }}
              />
              <h2 id="nota-pedido-titulo" className="font-playfair text-xl text-[var(--sf-tinta)]">
                <CampoEditable campo="suscripcionPlanes.casillasNotaTitulo">{c.casillasNotaTitulo}</CampoEditable>
              </h2>
              <p className="mt-1 text-xs text-[var(--sf-texto-suave)]">
                <CampoEditable campo="suscripcionPlanes.casillasNotaIntro">{c.casillasNotaIntro}</CampoEditable>
              </p>
              {items.length > 0 && (
                <div className="mt-3 flex -space-x-1" aria-hidden="true">
                  {items.map((it) => (
                    <span
                      key={it.categoria}
                      className="casillas-sticker h-8 w-8 rounded-full border-2 border-[var(--sf-superficie)]"
                      style={{ backgroundColor: colorDeCafe(it.categoria) }}
                    />
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-1 text-sm text-[var(--sf-texto)]">
                {lineasMensaje.map((linea, i) => (
                  <p key={i} className={i === 0 ? 'font-medium text-[var(--sf-tinta)]' : ''}>{linea}</p>
                ))}
              </div>
              <label className="mt-3 block text-sm text-[var(--sf-texto)]">
                <CampoEditable campo="suscripcionPlanes.casillasCiudadLabel">{c.casillasCiudadLabel}</CampoEditable>
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder={c.casillasCiudadPlaceholder}
                  autoComplete="address-level2"
                  className="mt-1 w-full rounded-lg border border-[var(--sf-linea)] bg-[var(--sf-fondo)] px-3 py-2 text-sm text-[var(--sf-tinta)]"
                />
              </label>

              <div ref={botonRef} className="mt-5">
                {whatsapp && (
                  <a
                    href={items.length > 0 ? whatsappUrl(whatsapp, mensaje) : undefined}
                    aria-disabled={items.length === 0}
                    target={items.length > 0 ? '_blank' : undefined}
                    rel="noreferrer"
                    className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[2px] px-6 text-center text-sm font-bold uppercase tracking-[0.1em] text-[var(--sf-fondo)] transition-opacity ${
                      items.length > 0 ? 'bg-[var(--sf-tinta)] hover:opacity-90' : 'cursor-not-allowed bg-[var(--sf-tinta)]/40'
                    }`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {items.length > 0 ? (
                      <CampoEditable campo="suscripcionPlanes.casillasCtaLabel">{c.casillasCtaLabel}</CampoEditable>
                    ) : (
                      <CampoEditable campo="suscripcionPlanes.casillasCtaVacioLabel">{c.casillasCtaVacioLabel}</CampoEditable>
                    )}
                  </a>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--sf-texto-suave)]">
                <CampoEditable campo="suscripcionPlanes.casillasAviso">{c.casillasAviso}</CampoEditable>
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div ref={finRef} />

      {/* BARRA FIJA (celular) — § el spec, item 3: "en cuanto hay un café elegido aparece una barra
          fija abajo". MISMO patrón que `SuscripcionTaquilla.tsx`: portal fuera de preview para no
          quedar incrustada por el `transform` de `EntradaPagina.tsx`. */}
      {whatsapp &&
        (preview ? (
          <BarraFijaCasillas
            bolsas={bolsas} frecuenciaEtiqueta={frecuenciaEtiqueta} totalTexto={totalTexto}
            visible={mostrarBarra && items.length > 0} whatsapp={whatsapp} mensaje={mensaje}
          />
        ) : (
          montado &&
          createPortal(
            <BarraFijaCasillas
              bolsas={bolsas} frecuenciaEtiqueta={frecuenciaEtiqueta} totalTexto={totalTexto}
              visible={mostrarBarra && items.length > 0} whatsapp={whatsapp} mensaje={mensaje}
            />,
            document.body,
          )
        ))}
    </div>
  );
}

// LOS TRES ENCABEZADOS DE PASO SON ESTRUCTURALES, NO CAMPOS EDITABLES (§ el spec, item 2: la
// secuencia "¿Qué café? / Bolsa y molienda / ¿Cada cuánto?" es el MECANISMO del armador, no copy de
// negocio — mismo criterio que el número "0N" y los íconos de `SuscripcionPasos.tsx`, estructurales
// por índice). Simplificación DECLARADA frente al spec item 7 ("todo texto visible es un campo
// editable"), que aplica de lleno al resto de la página (apertura/así-funciona/letra-pequeña/
// cierre) pero no se extendió acá por presupuesto del slice — ver DECISIONS.md.
function PasoCabecera({ numero, titulo, hint }: { numero: number; titulo: string; hint: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sf-tinta)] text-xs font-bold text-[var(--sf-fondo)]">{numero}</span>
        <h2 className="font-playfair text-xl text-[var(--sf-tinta)]">{titulo}</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--sf-texto-suave)]">{hint}</p>
    </div>
  );
}

function BarraFijaCasillas({
  bolsas, frecuenciaEtiqueta, totalTexto, visible, whatsapp, mensaje,
}: {
  bolsas: number;
  frecuenciaEtiqueta: string | undefined;
  totalTexto: string | null;
  visible: boolean;
  whatsapp: string;
  mensaje: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof document === 'undefined') return;
    const publicar = () => {
      const alto = visible ? el.offsetHeight + (Number.parseFloat(getComputedStyle(el).bottom) || 0) : 0;
      document.documentElement.style.setProperty(VAR_ALTO_BARRA_FIJA, altoPublicadoBarraFija(visible, alto));
    };
    publicar();
    window.addEventListener('resize', publicar);
    return () => {
      window.removeEventListener('resize', publicar);
      document.documentElement.style.setProperty(VAR_ALTO_BARRA_FIJA, '0px');
    };
  }, [visible]);

  const tabProps = visible ? {} : { tabIndex: -1 };

  return (
    <div
      ref={ref}
      aria-hidden={!visible}
      style={{
        transitionDuration: `${DURACION_BARRA_FIJA_S}s`,
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(16px)',
      }}
      className={`fixed inset-x-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-[var(--sf-linea)]/20 bg-[var(--sf-tinta)] px-4 py-3 shadow-xl transition-all md:hidden ${
        visible ? '' : 'pointer-events-none'
      }`}
    >
      <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)]">
        {bolsas} {bolsas === 1 ? 'bolsa' : 'bolsas'}{frecuenciaEtiqueta ? ` · ${frecuenciaEtiqueta.toLowerCase()}` : ''}{totalTexto ? ` · ${totalTexto}` : ''}
      </span>
      <a
        href={whatsappUrl(whatsapp, mensaje)}
        target="_blank"
        rel="noreferrer"
        {...tabProps}
        className="shrink-0 cursor-pointer rounded-full bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
      >
        Pedir
      </a>
    </div>
  );
}
