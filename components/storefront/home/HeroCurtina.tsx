"use client";

import { useEffect, useRef } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import Image from "next/image";

import { ArrowRight } from "lucide-react";

import { motion, useReducedMotion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import CampoEditable from "@/components/storefront/CampoEditable";
import { HERO_HREFS, claseAlturaHero } from "@/lib/config/site-content-defaults";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";
import { estiloInlineDeElemento } from "@/lib/config/estilo-elemento";

// LA ZONA «FONDO» — EL ALTO (§ EDITOR-TIENDA-ZONAS-1, docs/editor-tienda/REDISENO.md § 4/§ 8). La
// curtina/ficha nunca leyeron `alturaLlena` (§ el docstring de `HeroContent.alturaLlena`,
// site-content-defaults.ts: "SÓLO HeroMedia lo lee") — ESTA variante GANA el control por primera
// vez acá, ADITIVO y de riesgo bajo: `claseAlturaHero('justo', false)` sin tocar (la canónica) sigue
// dando `min-h-[92vh]`, byte-idéntico al de siempre. Pieza LOCAL duplicada entre las 4 variantes
// (mismo criterio ya aceptado en este repo, § el efecto de video de cada hero).
function ZonaChip({ onClic, children }: { onClic: { campo: string; valor: string; campo2?: string; valor2?: string }; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-editor-zona-campo={onClic.campo}
      data-editor-zona-valor={onClic.valor}
      {...(onClic.campo2 ? { 'data-editor-zona-campo2': onClic.campo2 } : {})}
      {...(onClic.valor2 !== undefined ? { 'data-editor-zona-valor2': onClic.valor2 } : {})}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, marginRight: 8,
        padding: '3px 10px', fontSize: 11, fontWeight: 600, lineHeight: 1.4, borderRadius: 999,
        border: '1px dashed #2563eb', background: 'rgba(255,255,255,.94)', color: '#1d4ed8',
        cursor: 'pointer', position: 'relative', zIndex: 20,
      }}
    >
      {children}
    </button>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },

  visible: { opacity: 1, y: 0 },
};

// LA VARIANTE "CURTINA" (§ eje 5, EJE-5-VARIANTES-HERO): la canónica, EXTRACCIÓN VERBATIM del hero
// de siempre — cortina fotográfica a sangre con degradado oscuro encima, texto blanco. El dispatcher
// (`HeroSection.tsx`) elige esta variante por defecto (`variante: 'curtina'`), así que Nayoli queda
// BYTE-IDÉNTICA al hero de antes de este slice.
//
// El hero se renderiza desde SiteContent (loader SOFT): los campos ya vienen resueltos
// —requeridos con su default, opcionales vacíos como ""—, así que acá sólo hay que OMITIR
// los opcionales vacíos (eyebrow, el énfasis del titular, el 2º CTA). Hero es `ocultable:false`
// → siempre se renderiza. Los destinos de los CTA son ESTRUCTURA (`HERO_HREFS`), no editables.
export default function HeroCurtina({ style }: { style?: React.CSSProperties } = {}) {
  const { hero, paginas, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const activoEditor = useModoEditorActivo();
  // EL ALTO (§ EDITOR-TIENDA-ZONAS-1): `hero.alto` ausente (`'justo'`) con `alturaLlena:false`
  // (nunca leído por esta variante) → `min-h-[92vh]`, el de SIEMPRE.
  const alturaClase = claseAlturaHero(hero.alto, false);
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style` del h1, que sigue rindiendo exactamente `text-5xl sm:text-6xl lg:text-7xl` (3rem/3.75rem/
  // 4.5rem, medido) — byte-idéntico. Con `tema.escalaDisplay` declarado (hoy sólo CORTE), pisa esas
  // clases con el `clamp(...)` del prototipo vía inline style (gana por especificidad, sin tocar la
  // className).
  const displayXl = fontSizeDisplay(tema.escalaDisplay, 'xl');
  // El 2º CTA del hero apunta a /suscripciones (`HERO_HREFS.secundario`, estructura). Si la capacidad
  // de suscripciones está apagada (§ paginas.suscripciones, Backlog #49), se OCULTA —igual que el link
  // del nav/footer y el bloque de la home—: un CTA "Suscripción Mensual" a una página que redirige
  // sería un enlace muerto. Es la QUINTA superficie que enlaza a /suscripciones. En preview (editor)
  // `paginas` viene de DEFAULTS (siempre true), así que el 2º CTA sigue editable.
  const mostrarCtaSuscripcion = HERO_HREFS.secundario !== '/suscripciones' || paginas.suscripciones.visible;
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  // EL FONDO ES VIDEO cuando el dueño lo eligió (§ HERO-VIDEO-COMO-DATO-1); si no, la imagen de
  // siempre. `imagenTipo` llega YA CLAMPADO por el resolver — nunca otro valor que 'imagen'/'video'.
  const esVideo = hero.imagenTipo === 'video';
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  // El hero SIEMPRE está en el viewport al cargar —a diferencia de la galería de /nosotros, que
  // difiere la descarga con un IntersectionObserver porque vive bajo el fold—, así que acá no hay
  // NADA que diferir: se reproduce apenas se puede, salvo en PREVIEW (la vista en vivo del editor
  // queda quieta, como el resto de las secciones) o con REDUCED-MOTION (queda en el `poster`, con
  // controles para que el visitante reproduzca si quiere — un play iniciado por el usuario es
  // legítimo aun con esa preferencia, § NosotrosGaleria.tsx).
  const reproducir = esVideo && !preview && !reduce;

  // EL PÓSTER SE PRE-CARGA CON PRIORIDAD ALTA (§ HERO-VIDEO-POSTER-PRIORIDAD-1). El defecto que
  // este slice cierra era de OMISIÓN, no de diseño: se razonó la prioridad del <video> (ver el
  // comentario de `preload` más abajo) y se dejó afuera la del PÓSTER, que es un recurso de
  // IMAGEN aparte — con `imagenTipo: 'imagen'` el <Image priority> de abajo ya emite un
  // `<link rel="preload" as="image" fetchpriority="high">`; con video, el póster se descubría
  // recién cuando el parser llegaba al <video> y sin ninguna señal de prioridad. Eso empeoraba el
  // primer pintado con video respecto a sin video — justo lo que el tope de 8 MB busca evitar,
  // porque el póster es lo ÚNICO que el visitante ve mientras el video baja.
  //
  // `ReactDOM.preload` (no un <link> en el JSX) es la API de React 19 para esto: inserta el
  // recurso en el <head> durante el render — server O cliente, sin depender de dónde se llame— y
  // dedupea por href. Va acá, en el CUERPO del render (no en el useEffect de abajo), para que
  // emita en el HTML servido en el SSR, igual que <Image priority>.
  //
  // NO depende de `reproducir`: en preview/reduced-motion el video se queda quieto con
  // `preload="none"` y el póster es lo único que se ve — SIEMPRE, no sólo mientras el video
  // buferea — así que adelantarlo vale igual en los dos casos.
  if (esVideo && hero.imagenPoster) {
    preload(hero.imagenPoster, { as: "image", fetchPriority: "high" });
  }

  // La reproducción se dispara IMPERATIVAMENTE (`.play()`/`.pause()`), NO con el atributo `autoPlay`
  // de React: `useReducedMotion()` devuelve `null` en el primer render (servidor e hidratación) y
  // recién resuelve el valor real DESPUÉS de montar, así que el atributo `autoplay` quedaría fijado
  // por el estado transitorio del primer render y no reaccionaría si la preferencia real difiere —
  // un `.play()/.pause()` en el efecto sí reacciona. `muted` va TAMBIÉN por REF: el prop de React no
  // siempre llega al atributo del DOM, e iOS bloquea el autoplay de un <video> que no esté silenciado
  // al nivel del elemento (mismo comentario que la galería, § NosotrosGaleria.tsx).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reproducir) v.play().catch(() => {});
    else v.pause();
  }, [reproducir]);

  return (
    <section className={`relative flex ${alturaClase} items-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]`} style={style}>
      <div className="absolute inset-0">
        {esVideo ? (
          // VIDEO DE FONDO — autoplay simple, SIN scroll-scrub (esa es otra capacidad, con su propio
          // censo, no ésta). El `poster` es la garantía del `.refine()` de guardado (§ site-content-
          // schema.ts): un hero de video SIEMPRE trae póster, así que la portada nunca queda sin nada
          // que mostrar mientras el video buferea; si igual llegara sin póster (un dato viejo, una
          // edición directa en la base), `<video>` sin `poster` simplemente no lo muestra — no rompe.
          // `preload="auto"` SÓLO cuando SÍ va a reproducir: es el lever disponible para EL VIDEO EN
          // SÍ —no hay un prop de prioridad equivalente al `priority` de <Image> en este set de
          // tipos de React (VideoHTMLAttributes no trae `fetchPriority`)—, así que adelantar la
          // descarga del VIDEO con `preload` es lo que hay. Si no va a reproducir (preview/reduce),
          // `preload="none"`: el póster se muestra igual sin bajar el video.
          //
          // EL PÓSTER ES OTRA COSA — un recurso de imagen aparte, que SÍ puede llevar prioridad; ver
          // el `preload(...)` de ReactDOM más arriba (§ HERO-VIDEO-POSTER-PRIORIDAD-1).
          <CampoEditable campo="hero.imagen" tipo="imagen">
            <video
              ref={videoRef}
              src={hero.imagen}
              poster={hero.imagenPoster || undefined}
              muted
              loop
              playsInline
              preload={reproducir ? 'auto' : 'none'}
              controls={!!reduce && !preview}
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          </CampoEditable>
        ) : (
          <CampoEditable campo="hero.imagen" tipo="imagen">
            <Image
              src={hero.imagen}
              alt=""
              fill
              priority
              sizes="100vw"
              quality={85}
              className="object-cover opacity-40"
            />
          </CampoEditable>
        )}

        {/* `pointer-events-none` (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1, MEDIDO por ejecución):
            este velo decorativo pinta DESPUÉS del medio en el mismo `absolute inset-0`, así que sin
            esto el navegador le entrega el clic a ÉL, no al `<CampoEditable>` que envuelve el medio
            —aunque el medio esté "debajo" en el árbol DOM, el VELO gana el hit-test por ser el
            último en pintar—. Nunca tuvo un propósito interactivo (es sólo un degradado), así que
            dejarlo pasar el clic no cambia nada para un visitante real. */}
        <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent to-[var(--sf-tinta)]/80 pointer-events-none" />
      </div>

      {/* LA ZONA «FONDO» — EL ALTO (§ EDITOR-TIENDA-ZONAS-1): § el docstring de cabecera.
          `top-24`, no `top-3` — el `<header>` del storefront es `fixed … z-50` sobre TODO el
          viewport (StoreNav.tsx), así que un chip cerca del borde superior queda TAPADO: el
          clic real (hit-test del navegador) cae en el nav, no en el chip. Medido por ejecución:
          con `top-3` el clic no producía ningún mensaje. */}
      {activoEditor && (
        <div className="absolute top-24 left-3 z-20 flex flex-wrap">
          <span style={{ display: 'block', width: '100%', marginBottom: 2, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#1d4ed8' }}>Fondo · Alto</span>
          <ZonaChip onClic={{ campo: 'alto', valor: 'justo', campo2: 'alturaLlena', valor2: 'false' }}>Justo</ZonaChip>
          <ZonaChip onClic={{ campo: 'alto', valor: 'alto', campo2: 'alturaLlena', valor2: 'false' }}>Alto</ZonaChip>
          <ZonaChip onClic={{ campo: 'alto', valor: 'pantalla', campo2: 'alturaLlena', valor2: 'true' }}>Pantalla completa</ZonaChip>
        </div>
      )}

      <div className={`relative z-10 mx-auto w-full ${contenedorClase}`}>
        <motion.div
          // En la VISTA PREVIA del panel (`preview`), `initial={false}` renderiza en el estado
          // "visible" SIN animación de entrada: el contenido se ve asentado desde el primer render.
          // Sin esto, `initial="hidden"` con la entrada por `animate` haría parpadear el preview en
          // cada re-render del form; y una sección futura con `whileInView` quedaría INVISIBLE
          // esperando una intersección que dentro del contenedor escalado no llega.
          initial={preview ? false : 'hidden'}
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
          className="max-w-2xl"
        >
          {/* El eyebrow y el énfasis del titular usaban `--sf-tostado` —FIJO, no recomputado por
              esquema (§ eje 5b, home-2)— así que sobre un esquema CLARO (crema/superficie) quedaban
              tan claros como el fondo: medido, 2.02:1/1.76:1. `--sf-sobre-banda` con `--sf-tostado`
              de fallback preserva el tostado de hoy sin esquema y se adapta con uno asignado.
              EL TÍTULO/SUBTÍTULO/CTA SECUNDARIO/SCROLL (§ eje 5b, home-3) estaban en `--sf-sobre`
              —floreado contra la TARJETA, no la banda— y ese hueco daba 1.07:1 al asignar 'crema'
              a esta banda (su canónica es oscura; 'crema' hardcodea sobre=#ffffff sin auto-flip).
              Se apoyan DIRECTO en el fondo de la banda: título/CTA (sin alfa) van a
              `--sf-sobre-banda`; subtítulo/scroll (con alfa de diseño) van a
              `--sf-sobre-banda-suave`, SIN el modificador `/NN` de Tailwind encima —aplicarlo
              reduciría el `texto-suave` ya floreado (raso en oscuro/acento, 4.52/4.56:1, § motor)
              por debajo de AA— con el alfa horneado DENTRO del fallback
              (`color-mix(in oklab, white NN%, transparent)`, la MISMA fórmula que Tailwind genera
              para un modificador de opacidad): sin esquema, `--sf-sobre-banda-suave` no está seteada
              y el `var()` cae a ese fallback → el mismo píxel que el `text-white/NN` de siempre; con
              esquema, cae al `texto-suave` YA floreado (≥4.5:1 en los 4, medido) a opacidad plena. */}
          {hero.eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-tostado))]"
            >
              <CampoEditable campo="hero.eyebrow">{hero.eyebrow}</CampoEditable>
            </motion.p>
          )}

          <motion.h1
            variants={fadeUp}
            className="mb-6 font-playfair text-5xl leading-[1.08] text-[var(--sf-sobre-banda,white)] sm:text-6xl lg:text-7xl"
            style={{ ...(displayXl ? { fontSize: displayXl } : undefined), ...estiloInlineDeElemento(hero.estilos.titulo, 'titular', tema.fuentePar) }}
          >
            <CampoEditable campo="hero.titulo">{hero.titulo}</CampoEditable>
            {hero.tituloEnfasis && (
              <>
                <br />
                <em className="italic text-[var(--sf-sobre-banda,var(--sf-tostado))]">
                  <CampoEditable campo="hero.tituloEnfasis">{hero.tituloEnfasis}</CampoEditable>
                </em>
              </>
            )}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mb-10 max-w-md text-lg leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]"
            style={estiloInlineDeElemento(hero.estilos.subtitulo, 'subtitulo', tema.fuentePar)}
          >
            <CampoEditable campo="hero.subtitulo" multilinea>{hero.subtitulo}</CampoEditable>
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-4"
          >
            <Link
              href={HERO_HREFS.primario}
              className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))]"
              style={estiloInlineDeElemento(hero.estilos.ctaPrimarioLabel, 'boton', tema.fuentePar)}
            >
              <CampoEditable campo="hero.ctaPrimarioLabel">{hero.ctaPrimarioLabel}</CampoEditable>

              <ArrowRight className="h-4 w-4" />
            </Link>

            {hero.ctaSecundarioLabel && mostrarCtaSuscripcion && (
              <Link
                href={HERO_HREFS.secundario}
                className="inline-flex items-center gap-2 sf-pildora border border-[var(--sf-linea-sobre,white)]/30 px-8 py-4 text-sm font-medium text-[var(--sf-sobre-banda,white)] transition-all duration-200 hover:border-[var(--sf-linea-sobre,white)]/60 hover:bg-white/10"
                style={estiloInlineDeElemento(hero.estilos.ctaSecundarioLabel, 'boton', tema.fuentePar)}
              >
                <CampoEditable campo="hero.ctaSecundarioLabel">{hero.ctaSecundarioLabel}</CampoEditable>
              </Link>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator — se OMITE en preview: una flecha en bucle que invita a
          scrollear no significa nada dentro de un marco de vista previa (§ ?preview). */}
      {!preview && (
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_40%,transparent))]"
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-12 bg-linear-to-b from-white/40 to-transparent" />
        </motion.div>
      )}
    </section>
  );
}
