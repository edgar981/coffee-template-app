"use client";

// EL CATÁLOGO · COMPOSICIÓN «TAQUILLA» (§ TIENDA-ONIX-CARTELERA-1). Montada por `TiendaCatalogo.tsx`
// sólo con una matriz VÁLIDA (`derivarMatrizTaquilla`, § lib/tienda/taquilla.ts) — sin ella, ESE
// archivo cae solo a la grilla de «Actual», mismo patrón que «Láminas»/`mostrarSelectorAntojo`.
//
// SOBRE EL FONDO CLARO de la tienda (§ el spec: "no sobre la tinta") — a diferencia de la Apertura,
// que es oscura. CADA CELDA ES UN PRODUCTO REAL del catálogo: clickearla cambia la foto (fundido de
// 200ms), el nombre base, las notas y el precio del botón — nunca un mapeo inventado.
//
// EL RIESGO DE DINERO (§ TIENDA-COMPOSICIONES-CENSO-1): `moliendaAceptada` rechaza en el checkout un
// producto que declara opciones si llega sin molienda. Cada celda pasa por `decidirMolienda`/
// `agregableDirecto`, igual que `ProductCard.handleAdd` — nunca `addItem(producto, 1)` a secas.
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCartStore } from '@/lib/cartStore';
import { decidirMolienda } from '@duna/core/moliendas-opciones';
import { formatCOP } from '@duna/core/utils';
import { whatsappUrl } from '@/lib/config/site';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { creditosVisibles, filasCompletas } from '@/lib/tienda/creditos';
import { camposPorFilaCreditos } from '@/lib/admin/editor-orden-y-lienzo';
import { derivarMatrizTaquilla, celdaDe, nombreBaseProducto, type MatrizTaquilla } from '@/lib/tienda/taquilla';
import { CreditosFilas } from '@/components/storefront/tienda/TiendaCreditos';
import {
  visibilidadBarraFija,
  altoPublicadoBarraFija,
  DURACION_BARRA_FIJA_S,
  VAR_ALTO_BARRA_FIJA,
} from '@/lib/storefront/barra-fija';
import type { Product } from '@/types/product';

interface TiendaTaquillaProps {
  catalog: Product[];
  whatsapp?: string;
  /** § TiendaCatalogoContent.barraFijaMovil — encendida por defecto; `false` explícito la apaga. */
  barraFijaMovil: boolean;
}

export default function TiendaTaquilla({ catalog, whatsapp, barraFijaMovil }: TiendaTaquillaProps) {
  const { tiendaCreditos } = useSiteContent();
  const preview = useIsPreview();
  const matriz = useMemo(() => derivarMatrizTaquilla(catalog), [catalog]);
  const [seleccion, setSeleccion] = useState<{ categoria: string; peso: number } | null>(null);
  const botonRef = useRef<HTMLDivElement | null>(null);
  // § ONIX-BARRA-FLOTANTE-MOVIL-1 — `visibilidadBarraFija` (lib/storefront/barra-fija.ts) reemplaza
  // al `IntersectionObserver`+`!entry.isIntersecting` de antes: ESE criterio no distinguía "todavía
  // no llegué al botón" de "ya lo pasé" (las dos son "no intersecta"), que era justo el bug que el
  // owner reportó ("aparece y desaparece sin patrón"). Se mide con un listener de scroll/resize, no
  // con un segundo observer — el mismo patrón que `BackToTop.tsx` ya usa para su propio umbral.
  const [barraFijaVisible, setBarraFijaVisible] = useState(false);
  // `montado`: antes, el portal sólo se alcanzaba (`createPortal(..., document.body)`) una vez que
  // `botonFueraDeVista` se volvía `true` — nunca durante el render INICIAL (server o cliente, antes
  // del primer efecto), así que `document` nunca se evaluaba fuera del navegador. Con la barra
  // SIEMPRE montada (§ el comentario de más abajo), ese resguardo accidental se perdió: el portal
  // se alcanzaría en CADA render, incluido `renderToStaticMarkup` en el servidor — `ReferenceError:
  // document is not defined` (visto fallar, `lib/tienda/piezas-compartidas.test.ts`). `montado` lo
  // repone explícito: `false` en el render del servidor y en el PRIMER render del cliente (misma
  // salida en los dos → sin mismatch de hidratación), `true` recién en un efecto posterior.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda de montaje estándar, § TopBar.tsx
    setMontado(true);
  }, []);
  // LA FICHA DE ORIGEN EN LA COLUMNA (§ TIENDA-ONIX-AJUSTES-1, la forma C aprobada) — MISMO criterio
  // que `TiendaCreditos.tsx` (toggle + piso de 3 filas); el helper compartido `taquillaActiva` (§
  // lib/tienda/taquilla.ts) es lo que le dice a ESA sección que calle para no duplicarla acá.
  const filasCreditos = filasCompletas(tiendaCreditos.items);
  // EDITOR-CREDITOSFILAS-INDICE-ORIGINAL-1 — ídem TiendaCreditos.tsx: el índice ORIGINAL, no el
  // visible, para que el clic abra el ítem real de `tiendaCreditos.items`.
  const camposPorFila = camposPorFilaCreditos(tiendaCreditos.items, filasCreditos, (i) => ({
    etiqueta: `tiendaCreditos.items.${i}.etiqueta`,
    valor: `tiendaCreditos.items.${i}.valor`,
  }));
  const mostrarCreditos =
    seccionEsVisible(REGISTRY.tiendaCreditos, tiendaCreditos) && creditosVisibles(tiendaCreditos.items);

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

  if (!matriz) return null;

  // La selección DEFAULT es la primera fila × primera columna — determinista: no hay un criterio de
  // "destacado" declarado en el catálogo del que elegir otra cosa.
  const activa = seleccion ?? { categoria: matriz.filas[0], peso: matriz.columnas[0] };
  const producto = matriz.celdas.get(celdaDe(activa.categoria, activa.peso))!;

  return (
    <div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
        {/* LA FOTO LLENA EL CUADRO (§ TIENDA-ONIX-AJUSTES-1) — `object-cover`, NO `object-contain`:
            el fondo PROPIO de la foto (su propio estudio/backdrop) dejaba de coincidir con
            `--sf-superficie` del contenedor y se veían DOS rectángulos de fondo distintos. Con
            `object-cover` la foto SIEMPRE cubre el cuadro entero —nunca queda fondo del contenedor
            a la vista—, el mismo tratamiento que ya usa `ProductCard.tsx` para el catálogo. Medido
            contra la foto real de Onix (el boceto de referencia): la bolsa ocupa una fracción chica
            del centro con mucho margen de estudio alrededor, así que el recorte que `cover` aplica
            en un cuadro casi-cuadrado no toca la bolsa. */}
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-[var(--sf-superficie)]">
          {/* CALIDAD 90 + `sizes` REAL (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1, el pedido del owner del
              2026-10-11) — antes sin `quality` propio (default 75) y con un `sizes` que declaraba
              100vw/50vw cuando el cuadro mide como máximo 448px (`max-w-md`, con su `mx-auto` sin
              padding propio): el navegador pedía una imagen de más ancho del que iba a mostrar, el
              mismo sub-muestreo que ya corrigió `GrindChooserRiel.tsx` para el riel. `90` es el
              MISMO que ya usa ese riel (por encima del 85 de los heroes) — el empaque de producto es
              la pieza que esta composición existe para vender. Los dos valores ya están en
              `next.config.ts` → `images.qualities`. */}
          {producto.imagen ? (
            <Image
              key={producto.id}
              src={producto.imagen}
              alt={producto.nombre}
              fill
              sizes="(max-width: 768px) calc(100vw - 32px), 448px"
              quality={90}
              className="object-cover transition-opacity duration-200"
            />
          ) : null}
        </div>

        <div>
          <h2 className="font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">
            {nombreBaseProducto(producto.nombre)}
          </h2>
          {producto.notas && producto.notas.length > 0 && (
            <p className="mt-2 text-sm text-[var(--sf-texto-suave)]">{producto.notas.join(' · ')}</p>
          )}

          <TablaTaquilla matriz={matriz} activa={activa} onElegir={setSeleccion} />

          <div ref={botonRef} className="mt-6">
            <BotonTaquilla producto={producto} whatsapp={whatsapp} />
          </div>

          {/* LA FICHA DE ORIGEN, DEBAJO DEL BOTÓN (§ TIENDA-ONIX-AJUSTES-1, la forma C aprobada) —
              EN la columna de compra, no un bloque aparte centrado más abajo de la página. */}
          {mostrarCreditos && (
            <div className="mt-8">
              <CreditosFilas filas={filasCreditos} camposPorFila={camposPorFila} />
            </div>
          )}
        </div>
      </div>

      {barraFijaMovil && (
        // § ONIX-APERTURA-MOVIL-INTERLUDIO-PARALLAX-1 — PORTAL A `document.body`, condicional a
        // `!preview`, MISMO patrón que `VistaRapidaProducto.tsx` (§ VISTA-RAPIDA-CENTRADA-1): sin
        // portal, `EntradaPagina.tsx` (`app/(storefront)/template.tsx`) deja a la banda que envuelve
        // esta composición con un `transform` COMPUTADO distinto de `none` (la identidad que el
        // `animation-fill-mode:both` sostiene tras terminar — medido, § `DECISIONS.md`), así que esa
        // banda se vuelve el bloque contenedor del `fixed` y la barra queda incrustada en la página
        // en vez de flotar contra la pantalla. En la vista previa del panel (`preview`, `true`) se
        // queda ANIDADA — ahí el ancestro correcto es el `transform:scale(...)` de `EscalaDesktop`
        // (§ `VistaTiendaEnVivo.tsx`, que monta este mismo árbol), y un portal la escaparía también
        // de esa escala.
        //
        // § ONIX-BARRA-FLOTANTE-MOVIL-1 — el MONTAJE ya no depende de `barraFijaVisible`: se queda
        // SIEMPRE montada (mientras `barraFijaMovil` esté encendido, un prop ESTABLE que no cambia
        // con el scroll) y es `BarraFijaMovil` quien decide su propia visibilidad con clases/estilos
        // — así puede DESLIZARSE al entrar/salir en vez de aparecer/desaparecer de golpe por un
        // remontaje del portal.
        preview ? (
          <BarraFijaMovil producto={producto} whatsapp={whatsapp} visible={barraFijaVisible} />
        ) : (
          montado &&
          createPortal(
            <BarraFijaMovil producto={producto} whatsapp={whatsapp} visible={barraFijaVisible} />,
            document.body,
          )
        )
      )}
    </div>
  );
}

function TablaTaquilla({
  matriz, activa, onElegir,
}: {
  matriz: MatrizTaquilla;
  activa: { categoria: string; peso: number };
  onElegir: (c: { categoria: string; peso: number }) => void;
}) {
  return (
    <div
      className="mt-8 grid overflow-hidden border border-[var(--sf-linea)]/20"
      style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${matriz.columnas.length}, minmax(0,1fr))` }}
    >
      <div />
      {matriz.columnas.map((peso) => (
        <div
          key={peso}
          className="border-l border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]"
        >
          {peso} g
        </div>
      ))}
      {matriz.filas.map((categoria) => (
        <CeldaFila key={categoria} categoria={categoria} matriz={matriz} activa={activa} onElegir={onElegir} />
      ))}
    </div>
  );
}

function CeldaFila({
  categoria, matriz, activa, onElegir,
}: {
  categoria: string;
  matriz: MatrizTaquilla;
  activa: { categoria: string; peso: number };
  onElegir: (c: { categoria: string; peso: number }) => void;
}) {
  return (
    <>
      <div className="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">
        {categoria}
      </div>
      {matriz.columnas.map((peso) => {
        const p = matriz.celdas.get(celdaDe(categoria, peso))!;
        const elegida = activa.categoria === categoria && activa.peso === peso;
        const agotada = !p.disponible;
        return (
          <button
            key={peso}
            type="button"
            onClick={() => onElegir({ categoria, peso })}
            aria-pressed={elegida}
            className={`relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl ${
              elegida
                ? 'bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                : 'text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]'
            }`}
          >
            {formatCOP(p.precio)}
            {agotada && (
              <span className="mt-1 text-[10px] font-sans font-semibold uppercase tracking-[0.1em] opacity-70">
                Agotado
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function BotonTaquilla({ producto, whatsapp }: { producto: Product; whatsapp?: string }) {
  const { addItem } = useCartStore();
  const [agregado, setAgregado] = useState(false);
  const decision = decidirMolienda(producto.moliendasOpciones);
  const agregaDirecto = decision.modo === 'ninguna' || decision.modo === 'automatica';
  const agotado = !producto.disponible;

  if (agotado) {
    if (!whatsapp) return null;
    return (
      <a
        href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${producto.nombre}?`)}
        target="_blank"
        rel="noreferrer"
        className="sf-pildora block w-full cursor-pointer border border-[var(--sf-tinta)] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-tinta)] transition-colors hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
      >
        Avísame por WhatsApp
      </a>
    );
  }

  // «Agotada: … el botón pasa a fantasma». Con molienda de elección REAL (§ ProductCard.handleAdd:
  // "Sin preventDefault: el click sigue al <Link>"), acá no hay <Link> que envuelva — se navega a la
  // ficha del producto, el único sitio donde el cliente elige entre varias.
  if (!agregaDirecto) {
    return (
      <a
        href={`/tienda/${producto.slug}`}
        className="sf-pildora block w-full cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
      >
        Elegir molienda · {formatCOP(producto.precio)}
      </a>
    );
  }

  const handleAdd = () => {
    addItem(producto, 1, decision.modo === 'automatica' ? { molienda: decision.nombre } : {});
    setAgregado(true);
    window.setTimeout(() => setAgregado(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="sf-pildora block w-full cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
    >
      {agregado ? 'Agregado ✓' : `Agregar · ${formatCOP(producto.precio)}`}
    </button>
  );
}

// LA BARRA FIJA DEL CELULAR (§ TIENDA-ONIX-CARTELERA-1, el spec item 6; FLOTANTE desde
// § ONIX-BARRA-FLOTANTE-MOVIL-1) — SIN precedente en el storefront (§ TIENDA-COMPOSICIONES-
// CENSO-1). Aparece cuando el botón principal quedó arriba de la pantalla (`visibilidadBarraFija`
// del padre, nunca antes de llegar a él). `md:hidden`: en escritorio el botón principal rara vez
// sale de pantalla sin que el visitante ya esté mirando otra cosa, y la maqueta aprobada la dibuja
// sólo para el celular.
//
// SE QUEDA SIEMPRE MONTADA (§ ONIX-BARRA-FLOTANTE-MOVIL-1, el spec item 2) — la visibilidad la
// decide `visible`, vía framer-motion (`animate`), no un montaje/desmontaje por cada cruce del
// umbral. Eso es lo que permite DESLIZARSE al entrar/salir en vez de aparecer de golpe, y lo que
// hace que `ReducedMotionProvider` (`MotionConfig reducedMotion="user"`, § `BackToTop.tsx`) congele
// el desplazamiento vertical bajo movimiento reducido y deje sólo el fundido de opacidad — EL MISMO
// canal, no un `@media (prefers-reduced-motion)` propio.
//
// FLOTA, no va pegada a los bordes (§ el spec, item 3): separada de los lados y del borde inferior
// (`inset-x-3` = 12px + `env(safe-area-inset-bottom)`, § cifras-decision), con el radio de tarjeta
// del tema activo (`var(--radius-2xl, …)` — el MISMO token que `rounded-2xl` resuelve en las
// tarjetas del storefront, § `PreguntasFrecuentes.tsx`/`TestimonialSection.tsx`; `--sf-pildora` de
// respaldo si ese token no estuviera definido) y una sombra (`shadow-xl`) que la despega del
// contenido de abajo.
//
// PUBLICA SU ALTO (§ el spec, item 4) en `VAR_ALTO_BARRA_FIJA` —`<html>`, vía
// `document.documentElement`— para que `BackToTop.tsx` suba por encima sin que las dos barras se
// conozcan directamente: UNA sola fuente de la medida (`lib/storefront/barra-fija.ts`), no un
// acoplamiento de props entre dos componentes que viven en árboles distintos (uno en portal, el
// otro en el layout). El alto publicado es `offsetHeight` (la caja de la tarjeta) MÁS su
// `computedStyle.bottom` (que ya resuelve el `env(safe-area-inset-bottom)`) — así representa la
// distancia REAL desde el borde de la pantalla hasta el techo de la tarjeta, sin leer el `transform`
// del deslizamiento (que `getBoundingClientRect` sí incluiría, y que durante la transición de 250ms
// haría que el alto publicado oscilara en vez de ser estable).
function BarraFijaMovil({
  producto, whatsapp, visible,
}: { producto: Product; whatsapp?: string; visible: boolean }) {
  const { addItem } = useCartStore();
  const decision = decidirMolienda(producto.moliendasOpciones);
  const agregaDirecto = decision.modo === 'ninguna' || decision.modo === 'automatica';
  const agotado = !producto.disponible;
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
    <motion.div
      ref={ref}
      aria-hidden={!visible}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 16 }}
      transition={{ duration: DURACION_BARRA_FIJA_S }}
      className={`fixed inset-x-3 z-30 flex items-center justify-between gap-3 sf-borde border-[var(--sf-linea)]/20 bg-[var(--sf-tinta)] px-4 py-3 shadow-xl md:hidden ${
        visible ? '' : 'pointer-events-none'
      }`}
      style={{
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        borderRadius: 'var(--radius-2xl, var(--sf-pildora, 9999px))',
      }}
    >
      <span className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)]">
        {producto.variante || producto.nombre} — {formatCOP(producto.precio)}
      </span>
      {agotado ? (
        whatsapp && (
          <a
            href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${producto.nombre}?`)}
            target="_blank"
            rel="noreferrer"
            {...tabProps}
            className="sf-pildora shrink-0 cursor-pointer border border-[var(--sf-fondo)] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-fondo)] transition-colors hover:bg-[var(--sf-fondo)] hover:text-[var(--sf-tinta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-fondo)]"
          >
            Avísame
          </a>
        )
      ) : agregaDirecto ? (
        <button
          type="button"
          onClick={() => addItem(producto, 1, decision.modo === 'automatica' ? { molienda: decision.nombre } : {})}
          {...tabProps}
          className="sf-pildora shrink-0 cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
        >
          Agregar
        </button>
      ) : (
        <a
          href={`/tienda/${producto.slug}`}
          {...tabProps}
          className="sf-pildora shrink-0 cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-4 py-2 text-xs font-semibold uppercase text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]"
        >
          Elegir
        </a>
      )}
    </motion.div>
  );
}
