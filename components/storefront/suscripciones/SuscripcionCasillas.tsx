"use client";

// LA COMPOSICIÓN «CASILLAS» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4 — aprobada
// por el owner el 2026-10-12 sobre la maqueta `.scratch/chamisas-paginas/nosotros-suscripciones.html`).
// Montada por `SuscripcionPlanes.tsx` SÓLO con `suscripcionPlanes.variante === 'casillas'` Y AL
// MENOS UN CAFÉ ACTIVO (`derivarCasillasCafes`) — sin eso cae sola a «Tarjetas», el MISMO patrón
// que «Taquilla» (§ SuscripcionPlanes.tsx) y «Láminas»/«Taquilla» de /tienda (§ TiendaCatalogo.tsx).
//
// LAS FILAS SON POR CAFÉ, NO POR CATEGORÍA (§ CHAMISAS-CASILLAS-POR-CAFE-1): nació reusando
// `derivarMatrizTaquilla` —la MISMA derivación de «Taquilla», fila=categoría/columna=peso— y eso
// hacía caer la sección entera a «Tarjetas» en el catálogo real de Las Chamisas, donde los tres
// cafés comparten categoría («Café de especialidad») y peso (340 g): los tres reclamaban la misma
// celda. `derivarCasillasCafes` (lib/storefront/casillas-cafes.ts) deriva en su lugar, con la fila
// = el CAFÉ (`nombreBaseProducto`) y columnas SPARSE por tamaño de bolsa — un café sin el tamaño
// elegido queda deshabilitado en su fila, no rompe la composición. El porqué completo vive en el
// docstring de cabecera de ese archivo.
//
// «ARMA TU PEDIDO» SIGUE EL TRATO DE LA TAQUILLA (§ el spec, item 2): Casillas elige VARIOS cafés
// a la vez, cada uno con su cantidad, compartiendo UNA bolsa y UNA molienda para TODO el pedido.
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
import { derivarCasillasCafes, celdaCafeDe, productoDelCafe, productoDePeso } from '@/lib/storefront/casillas-cafes';
import { colorDeLamina, lavadoLamina } from '@/lib/tienda/laminas';
import { LogoMark } from '@/components/storefront/Logo';
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
  cafe: string;
  color: string;
}

export default function SuscripcionCasillas({ catalog, whatsapp, negocio, suscripcionPlanes: c }: SuscripcionCasillasProps) {
  const { tiendaCatalogo } = useSiteContent();
  const preview = useIsPreview();
  const matriz = useMemo(() => derivarCasillasCafes(catalog), [catalog]);
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

  const pesoActivo = peso != null && matriz.pesos.includes(peso) ? peso : matriz.pesos[0];
  const items = itemsCasillas(matriz, cantidades, pesoActivo);

  const frecuencias = frecuenciasDeTaquilla([c.frecuencia1, c.frecuencia2, c.frecuencia3, c.frecuencia4]);
  // DEFAULT = ÚLTIMA frecuencia configurada (§ el docstring de cabecera).
  const slotActivo =
    frecuenciaSlot != null && frecuenciaSlot >= 1 && frecuenciaSlot <= frecuencias.length ? frecuenciaSlot : frecuencias.length;
  const frecuenciaEtiqueta = frecuencias[slotActivo - 1] ?? frecuencias[0];
  const estructura = frecuenciaEstructuraPorSlot(Math.min(4, Math.max(1, slotActivo)) as 1 | 2 | 3 | 4);

  // Sólo los cafés con producto al peso ACTIVO entran a la intersección de molienda — un café
  // deshabilitado para este tamaño (matriz SPARSE, § casillas-cafes.ts) no puede comprarse, así
  // que no debe acotar qué molienda se ofrece.
  const productosDisponiblesEnPeso = matriz.cafes
    .map((cafe) => matriz.celdas.get(celdaCafeDe(cafe, pesoActivo)))
    .filter((p): p is Product => p != null);
  const opcionesMolienda = moliendasCasillas(items.length > 0 ? items.map((i) => i.producto) : productosDisponiblesEnPeso);
  const moliendaActiva = moliendaElegida && opcionesMolienda.includes(moliendaElegida) ? moliendaElegida : opcionesMolienda[0] ?? null;

  const total = totalPorEnvioCasillas(items);
  const totalTexto = total != null ? formatCOP(total) : null;
  const bolsas = bolsasCasillas(items);

  const colorDeCafe = (cafe: string): string => {
    const producto = productoDelCafe(matriz, cafe, pesoActivo);
    return colorDeLamina(producto.id, catalog.indexOf(producto), tiendaCatalogo.coloresPorProducto);
  };

  const marcas: MarcaCafe[] = items.map((it) => ({ cafe: it.cafe, color: colorDeCafe(it.cafe) }));
  const casillas = casillasDeFrecuencia(estructura, marcas, new Date(), 6);
  const totalEnvios = totalEnviosEnVentana(estructura, 6);

  const lineasPedido: LineaPedido[] = items.map((it) => ({
    cantidad: it.cantidad,
    nombre: it.cafe,
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

  const setCantidad = (cafe: string, delta: number) => {
    // Un café sin producto al peso activo (matriz SPARSE) no debe poder sumar — su fila ya queda
    // deshabilitada en el render (botones `disabled`); esta guarda es defensiva, nunca alcanzada
    // por un click real.
    const producto = matriz.celdas.get(celdaCafeDe(cafe, pesoActivo));
    if (!producto) return;
    const tope = topeUnidadesCasilla(producto);
    setCantidades((antes) => {
      const actual = antes[cafe] ?? 0;
      const siguiente = Math.max(0, Math.min(tope, actual + delta));
      return { ...antes, [cafe]: siguiente };
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

      {/* APERTURA (§ CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 1 — medido contra `.so`/`.so h1
          .stk` de la maqueta): ALINEADA A LA IZQUIERDA, no centrada — la maqueta nunca centra `.so`,
          y el centrado era el único defecto de alineación. Va dentro del MISMO ancho que «Arma tu
          pedido» (`max-w-6xl`), para que las dos secciones compartan el mismo margen izquierdo.
          `tituloEnfasis` ("cada mes") DEJA de llevar su píldora propia: la maqueta lo imprime como
          texto PLANO dentro del `<h1>` — sólo el STICKER ("sin cobro automático") es un chip, y ahora
          va INLINE al final de esa misma frase (antes: su propio párrafo debajo, "en su propia
          línea"). Reusa eyebrow/titulo/tituloEnfasis/subtitulo — ver el docstring de cabecera. */}
      <section className="relative bg-[var(--sf-fondo)] px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          {c.eyebrow && (
            <p className="mb-3 text-xs uppercase tracking-widest text-[var(--sf-tostado)]">
              <CampoEditable campo="suscripcionPlanes.eyebrow">{c.eyebrow}</CampoEditable>
            </p>
          )}
          <h1 className="font-playfair text-4xl text-[var(--sf-tinta)] sm:text-5xl">
            <CampoEditable campo="suscripcionPlanes.titulo">{c.titulo}</CampoEditable>
            {c.tituloEnfasis && (
              <>
                {' '}
                <CampoEditable campo="suscripcionPlanes.tituloEnfasis">{c.tituloEnfasis}</CampoEditable>
              </>
            )}
            {c.casillasSticker && (
              <span className="relative top-[-4px] ml-1.5 inline-block -rotate-[8deg] rounded-sm bg-[var(--sf-tostado-4,var(--sf-acento-4))] px-3 py-1 align-middle text-xs font-semibold text-[var(--sf-tinta)] shadow-sm">
                <CampoEditable campo="suscripcionPlanes.casillasSticker">{c.casillasSticker}</CampoEditable>
              </span>
            )}
          </h1>
          {c.subtitulo && (
            <p className="mt-4 max-w-xl text-sm text-[var(--sf-texto)]">
              <CampoEditable campo="suscripcionPlanes.subtitulo" multilinea>{c.subtitulo}</CampoEditable>
            </p>
          )}
        </div>
      </section>

      {/* ARMA TU PEDIDO (§ el spec, item 2): 7/5, los pasos a la izquierda, la nota fija a la
          derecha (en escritorio) — § el spec, item 3: "Escritorio: 7/5". */}
      <section className="bg-[var(--sf-fondo)] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[7fr_5fr] lg:items-start lg:gap-12">
          {/* ESPACIADO 12PX (§ CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 2 — `.steps{gap:
              12px}` de la maqueta): antes `space-y-10` (40px), un resto de cuando los pasos no eran
              tarjetas propias — con cada Paso en su tarjeta blanca, 40px de aire entre tarjetas se
              lee como demasiado hueco. */}
          <div className="space-y-3">
            {/* PASO 1 — ¿Qué café? */}
            <div className="rounded-3xl bg-[var(--sf-tarjeta)] p-4 sm:p-6">
              <PasoCabecera numero={1} titulo="¿Qué café?" hint="Suma bolsas de uno o de varios. Puedes mezclar." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matriz.cafes.map((cafe) => {
                  // SPARSE (§ casillas-cafes.ts): un café puede no tener producto al peso ACTIVO
                  // — queda deshabilitado en su fila, no desaparece (§ el spec). El representativo
                  // (imagen/notas/color) cae al de MENOR peso disponible cuando el activo falta,
                  // para que la tarjeta siga mostrando el café aunque no se pueda comprar así.
                  const productoActivo = matriz.celdas.get(celdaCafeDe(cafe, pesoActivo));
                  const representativo = productoDelCafe(matriz, cafe, pesoActivo);
                  const disponible = productoActivo != null;
                  const cantidad = cantidades[cafe] ?? 0;
                  const color = colorDeCafe(cafe);
                  // § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 3 — el fondo de la tarjeta de
                  // café pasa del tinte manual al 15% (`${color}26`) al LAVADO de verdad
                  // (`lavadoLamina`, § lib/tienda/laminas.ts): es el MISMO pastel que ya pinta
                  // «Láminas» de /tienda (`TiendaLaminas.tsx`), mezclado hacia el fondo del tema
                  // hasta pasar 4,5:1 contra la tinta — no un alfa arbitrario sobre el color pleno.
                  const fondoTarjeta = lavadoLamina(color);
                  return (
                    <div
                      key={cafe}
                      className={`flex flex-col gap-3 rounded-2xl p-4 ${disponible ? '' : 'opacity-50'}`}
                      style={{ backgroundColor: fondoTarjeta }}
                    >
                      <div className="flex items-center gap-3">
                        {/* La miniatura pasa de un avatar REDONDO de 56px a un cuadro de 80px
                            (§ el spec item 3): «miniatura redonda» era la queja medida; acá es la
                            foto del café, no un avatar. El NOMBRE ya no se trunca (`truncate`
                            cortaba "Bourbon Rosado" a "Bourbon …") — envuelve si hace falta. */}
                        {representativo.imagen ? (
                          <img src={representativo.imagen} alt="" className="h-20 w-20 shrink-0 rounded-xl border-2 border-[var(--sf-fondo)] object-cover shadow-sm" />
                        ) : (
                          <span className="h-20 w-20 shrink-0 rounded-xl border-2 border-[var(--sf-fondo)] shadow-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <h3 className="font-playfair text-lg text-[var(--sf-tinta)]">{cafe}</h3>
                          {representativo.notas && representativo.notas.length > 0 && (
                            <p className="text-xs text-[var(--sf-tinta)]/80">{representativo.notas.join(' · ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        {disponible ? (
                          // La línea «bolsa de N g» (§ el spec item 3, faltaba) — `pesoActivo` ya
                          // está en este scope (el peso elegido en el Paso 2), sin tocar ningún
                          // helper de lib/.
                          <span className="text-sm font-semibold leading-tight text-[var(--sf-tinta)]">
                            {formatCOP(productoActivo.precio)}
                            <span className="block text-xs font-normal text-[var(--sf-tinta)]/70">bolsa de {pesoActivo} g</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--sf-texto-suave)]">No disponible en esta bolsa</span>
                        )}
                        <span role="group" aria-label={`Bolsas de ${cafe}`} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCantidad(cafe, -1)}
                            disabled={!disponible || cantidad === 0}
                            aria-label={`Quitar una bolsa de ${cafe}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--sf-tinta)]/30 text-[var(--sf-tinta)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[var(--sf-superficie)]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <output aria-live="polite" className="w-6 text-center tabular-nums text-[var(--sf-tinta)]">{cantidad}</output>
                          <button
                            type="button"
                            onClick={() => setCantidad(cafe, 1)}
                            disabled={!disponible || cantidad >= topeUnidadesCasilla(productoActivo ?? representativo)}
                            aria-label={`Sumar una bolsa de ${cafe}`}
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
            <div className="rounded-3xl bg-[var(--sf-tarjeta)] p-4 sm:p-6">
              <PasoCabecera numero={2} titulo="Bolsa y molienda" hint="Aplica a todo el pedido." />
              {/* El selector SÓLO se muestra con MÁS DE UN tamaño declarado (§ el spec, item 1 de
                  este slice): con uno solo —el caso real de Las Chamisas, 340 g únicamente— no hay
                  nada que elegir, y mostrar un botón solitario sería ceremonia sin decisión. */}
              {matriz.pesos.length > 1 && (
                <div role="group" aria-label="Tamaño de bolsa" className="grid grid-cols-2 gap-3">
                  {matriz.pesos.map((p) => {
                    const representativo = productoDePeso(matriz, p);
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
              )}
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
            <div className="rounded-3xl bg-[var(--sf-tarjeta)] p-4 sm:p-6">
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
                          <span key={m.cafe} className="h-5 w-5 rounded-full border border-[var(--sf-fondo)]" style={{ backgroundColor: m.color }} />
                        ))}
                      </span>
                    ) : (
                      // «Las vacías llevan el sello en tono» (§ el spec, item 2 de refero-chamisas.md
                      // §4) — y las dos razones de estar vacía son DISTINTAS: un mes CON envío
                      // programado pero sin café elegido todavía (sello neutro, el espacio que se va
                      // a llenar) vs. un mes SIN envío en esta cadencia (el mismo sello, MÁS la
                      // etiqueta "sin envío" — mismo criterio que la maqueta: `ship?'':'<span
                      // class="off">sin envío</span>'`).
                      //
                      // § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 4 — el SELLO era un punto
                      // dashed genérico; la maqueta pinta `.ca .seal` (una imagen, opacidad baja). Se
                      // reemplaza por el MISMO `LogoMark` que ya es "el sello" de marca de Las
                      // Chamisas en `NosotrosFichaEtiqueta.tsx`/`EstadoPedido.tsx` — nunca un asset
                      // nuevo para esta captura.
                      <LogoMark className="h-6 w-6 opacity-10" stroke="var(--sf-tinta)" cherry="var(--sf-tinta)" />
                    )}
                    {casilla.dosVeces && <span className="absolute right-1 top-1 text-[10px] font-bold text-[var(--sf-tostado)]">×2</span>}
                    {!casilla.conEnvio && (
                      <span className="text-[8px] uppercase tracking-wide text-[var(--sf-texto-suave)]/70">sin envío</span>
                    )}
                    {/* EL AÑO bajo el mes (§ el spec item 4, faltaba) — `casilla.anio` ya lo calcula
                        `casillasDeFrecuencia` (lib/storefront/casillas-frecuencia.ts); sólo faltaba
                        pintarlo. */}
                    <span className="text-[10px] uppercase leading-tight text-[var(--sf-texto-suave)]">
                      {NOMBRES_MES_ABREV[casilla.mes]}
                      <span className="block text-[9px] font-normal normal-case leading-tight text-[var(--sf-texto-suave)]/70">
                        {casilla.anio}
                      </span>
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
              {/* § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 5 — faltaba la fila "Aquí se
                  pegan los cafés que elijas." para el estado SIN café elegido (`row.
                  insertAdjacentHTML` de la maqueta, la rama `else` de `upd()`): antes esa franja
                  quedaba simplemente VACÍA (`items.length > 0 &&`). `min-h` reserva el alto para que
                  pasar de un estado al otro no salte el layout. Los stickers individuales son
                  decorativos (`aria-hidden`); el texto del estado vacío no lo es. */}
              <div className="mt-3 flex min-h-[32px] items-center gap-1">
                {items.length > 0 ? (
                  items.map((it) => (
                    <span
                      key={it.cafe}
                      aria-hidden="true"
                      className="casillas-sticker h-8 w-8 rounded-full border-2 border-[var(--sf-superficie)]"
                      style={{ backgroundColor: colorDeCafe(it.cafe) }}
                    />
                  ))
                ) : (
                  <span className="text-xs text-[var(--sf-texto-suave)]">Aquí se pegan los cafés que elijas.</span>
                )}
              </div>
              {/* § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 5 — la ciudad era un CAMPO
                  APARTE (una `<label>` + `<input>` en caja propia, debajo del mensaje); la maqueta
                  la escribe EN LÍNEA, sobre la hoja rayada (`.msg{line-height:26px}` +
                  `repeating-linear-gradient` cada 26px), como una línea más del mensaje. El fondo
                  rayado se aplica acá; `lineasMensaje` sigue viniendo de `lineasNotaPedido` (lib/
                  storefront/nota-pedido.ts, fuera de `touches:`) en su ORDEN FIJO documentado —
                  "Mi ciudad: …" es SIEMPRE la línea anteúltima (antes de la pregunta de cierre), así
                  que se sustituye por índice derivado (`lineasMensaje.length - 2`), no una copia a
                  mano del texto. */}
              <div
                className="mt-4 px-0.5 text-sm leading-[26px] text-[var(--sf-texto)]"
                style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 25px, var(--sf-linea) 25px, var(--sf-linea) 26px)' }}
              >
                {lineasMensaje.map((linea, i) =>
                  i === lineasMensaje.length - 2 ? (
                    <div key={i} className="flex items-baseline gap-1">
                      <label htmlFor="casillas-ciudad">
                        <CampoEditable campo="suscripcionPlanes.casillasCiudadLabel">{c.casillasCiudadLabel}</CampoEditable>:
                      </label>
                      <input
                        id="casillas-ciudad"
                        type="text"
                        value={ciudad}
                        onChange={(e) => setCiudad(e.target.value)}
                        placeholder={c.casillasCiudadPlaceholder}
                        autoComplete="address-level2"
                        className="min-w-0 flex-1 border-0 bg-transparent px-1 leading-[26px] text-[var(--sf-tinta)] placeholder:italic placeholder:text-[var(--sf-texto-suave)] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <p key={i} className={i === 0 ? 'font-medium text-[var(--sf-tinta)]' : ''}>{linea}</p>
                  ),
                )}
              </div>

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
// § CHAMISAS-SUSCRIPCIONES-FIDELIDAD-1, el spec item 2 — medido contra `.stp-n`/`.stp .hint` de la
// maqueta: el número era un PUNTO lleno (círculo de tinta); pasa a CUADRO PUNTEADO (34×34,
// `border-dashed`, serif) — el mismo lenguaje visual que el sello de las casillas y el marco de la
// nota de pedido. El `hint` se indenta `ml-[46px]` (34px de badge + 12px de `gap-3`) para quedar
// bajo el TÍTULO, no bajo el número — igual que `.stp .hint{margin-left:46px}`.
function PasoCabecera({ numero, titulo, hint }: { numero: number; titulo: string; hint: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border-2 border-dashed border-[var(--sf-tinta)] font-playfair text-base text-[var(--sf-tinta)]"
        >
          {numero}
        </span>
        <h2 className="font-playfair text-xl text-[var(--sf-tinta)]">{titulo}</h2>
      </div>
      <p className="ml-[46px] mt-1 text-sm text-[var(--sf-texto-suave)]">{hint}</p>
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
