"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import {
  fadeUp, useProgresoScroll, transformSubscripcionParallax,
  revelaMascaraVertical, transicionTituloPostal, transicionFadePostal,
} from "@/lib/animation";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import { fontSizeDisplay } from "@/lib/config/escala-display";

// LA VARIANTE "LÍNEA" (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): del BLOQUE apilado de hoy
// (§ SubscriptionCTABloque — texto en una columna, tarjetas de plan en la otra) a una FRANJA
// HORIZONTAL condensada: el gancho (`eyebrow`), el título y el botón en una línea.
//
// PÉRDIDA DE BYTES VISIBLES, A PROPÓSITO — el owner la tiene que ver: el `subtitulo` y los hasta
// cuatro `bullet1..4` de la sección NO SE RENDERIZAN en esta composición. Los bullets son una LISTA
// y una franja de una línea no la puede llevar; el subtítulo es una frase completa que, sumada al
// gancho + el título + el botón, ya no cabría "en una línea" (dejaría de ser la franja condensada
// que esta variante existe para ser). El DATO no se borra —sigue en `subscriptionCTA.subtitulo`/
// `bullet1..4`, intacto en la base— y vuelve a mostrarse si la sección cambia a la variante
// `bloque`: lo que no se renderiza es sólo de ESTA composición.
//
// El gate de visibilidad (`seccionEsVisible` + el flag de página `paginas.suscripciones.visible`)
// vive en el DISPATCHER (`SubscriptionCTA.tsx`), no acá — mismo patrón que GrindChooser/HeroSection.
// Las tarjetas de plan del teaser (§ SubscriptionCTABloque) tampoco viven acá: son del bloque de dos
// columnas, y una franja de una línea no tiene dónde ponerlas.
//
// ANGOSTO: una franja de una línea no entra en una pantalla angosta, así que se resuelve con el
// MISMO patrón que ya usa el pie de página para el mismo problema (`StoreFooter`, la "Bottom Bar":
// `flex-col` apilado → `sm:flex-row` una línea) — no se inventa un mecanismo nuevo. Bajo `sm` el
// texto (gancho + título) se apila centrado sobre los botones; desde `sm` los dos quedan en la misma
// fila, el texto a la izquierda y los botones a la derecha.
//
// EL SEGUNDO BOTÓN (§ MUESTRARIO-SECCION-CTA-1, MEDIDO contra `.cta-strip` del prototipo,
// `docs/prototipos/cafeone/index.html:313-320`, "Únete al club" + "Explorar" — DOS botones, no uno):
// `subscriptionCTA.ctaSecundarioLabel`/`.ctaSecundarioDestino` resuelven el href con
// `resolverCtaSeccion` — vacío = sin segundo botón, byte-idéntico. Va con estilo SECUNDARIO (borde,
// no relleno), igual tratamiento que `hero.ctaSecundarioLabel` en `HeroCurtina`. El PRIMER botón
// (`ctaLabel`) no cambia: sigue con href fijo a `/suscripciones`, no editable.
//
// LA IMAGEN DE FONDO OPCIONAL (§ MUESTRARIO-CTA-BANNER-FOTO-1, MEDIDO contra `.cta-strip` del
// prototipo — foto a sangre completa + velo degradado + parallax `[data-parallax]`,
// `js/home.js:303-307`: `translateY((p-0.5)*-10%)` sobre el progreso CRUDO de scroll de la sección).
// `subscriptionCTA.imagenFondo` vacío (default, Nayoli incluida) → el fondo SÓLIDO de hoy,
// byte-idéntico. Con imagen: CERO piezas nuevas del motor de scroll — `useProgresoScroll`
// (`lib/animation.ts`) es el MISMO hook que ya usa `Marquesina.tsx`, y la transformación
// `translateY` se calcula con `transformSubscripcionParallax` (`lib/animation.ts`) — EXTRAÍDA del
// inline que esta sección tenía hasta § SUSCRIPCION-POSTAL-DE-CIERRE-1: esa tanda SÍ declara
// `lib/animation.ts`/`lib/animation.test.ts` en su `touches:` (a diferencia de ésta, que no los
// tenía), así que la cuenta pasa a ser pura y testeada, mismo criterio que
// `transformMarquesinaTexto`/`Tarjeta`.
//
// § SUSCRIPCION-PARALLAX-VISIBLE-1 — EL DESPLAZAMIENTO Y SU BÚFER VAN EN `vh`, NO EN `%` DE LA
// CAJA. Ver el docstring de `transformSubscripcionParallax` (`lib/animation.ts`) para el porqué
// completo: el `%` de antes era relativo al alto de ESTA MISMA caja —que es chica por diseño, una
// franja corta, no un héroe a pantalla completa— así que el efecto era casi imperceptible (~14px de
// punta a punta a 1440×900, medido) sea cual sea el alto exacto de la postal. `vh` es la única
// magnitud de la ecuación que NO se achica cuando la postal se achica (ni cuando cambie de alto en
// el futuro). El búfer del contenedor de abajo (`top-[-6vh] bottom-[-6vh]`) tiene que usar la MISMA
// unidad que el desplazamiento —nunca una mezcla— o el máximo recorrido (±5vh) podría exceder el
// margen y exponer el borde de la foto; 6 contra un máximo de 5 es la MISMA holgura de 1 que ya
// regía en `%`, sólo en la unidad nueva.
//
// EL VELO reusa `--sf-velo` (`app/globals.css`), el MISMO token que Marquesina/HeroMedia — nunca un
// rgba nuevo. Es un degradado de DOS paradas, no las tres de `HeroMedia.tsx`
// (`from-tinta/60 via-transparent to-velo`): esa `via-transparent` deja CERO protección a medio
// camino, y tiene sentido ahí porque el texto vive en el PIE de un hero de viewport completo, lejos
// del centro. Acá el contenido va CENTRADO en una franja corta (`py-20`, § SUSCRIPCION-POSTAL-DE-
// CIERRE-1 — era `py-8`, el valor cambió pero el argumento del velo de dos paradas no): un hueco
// transparente a mitad de camino caería justo donde vive el texto. Se omite ese stop y el degradado corre entre los
// MISMOS DOS extremos que `HeroMedia.tsx` ya calibró y midió (`--sf-tinta`/60 → `--sf-velo`), así que
// el piso de protección en TODA la franja es el 60% que ese docstring ya midió en 4.68:1–5.32:1
// sobre tres fotos claras de referencia (AA, ≥4.5:1) — nunca por debajo de eso. **ESA MEDICIÓN ERA
// SÓLO DE BLANCO** (§ SUSCRIPCION-FOTO-LEGIBLE-Y-ACCIONES-REDONDEADAS-1, gate del owner con captura:
// "le puse una imagen... las letras a penas y se notan"): nunca cubrió el `tostado` del eyebrow.
// Medido ahora (mismo método WCAG, componiendo `--sf-tinta` sobre las tres fotos claras de
// referencia + una oscura): `tostado` NO alcanza 4.5:1 en NINGÚN punto del degradado actual contra
// ninguna de las tres claras (2.09–4.40:1, el propio 80.4% de `--sf-velo` incluido) — necesitaría
// ≥82% de opacidad UNIFORME, que ensancharía el velo de Nayoli/Marquesina (fuera de `touches:`) o
// requeriría un segundo token sin consumidor. El texto translúcido (`--sf-sobre-banda-suave`, blanco
// ~70%) TAMPOCO alcanza en el peor punto (3.20–3.57:1). Sólo el BLANCO PLENO cumple con el velo
// EXISTENTE, sin tocarlo — 4.66–17.09:1 en las cuatro fotos, al peor punto del degradado (60%), el
// mismo margen que ya acepta `HeroMedia.tsx`.
//
// POR ESO, CON IMAGEN, el eyebrow y el título van en BLANCO PLENO LITERAL (`text-white`), SIN pasar
// por `--sf-sobre-banda` — ni el fallback a `--sf-tostado`, ni (cuando la banda trae un esquema
// asignado, p.ej. CORTE·crema) el valor OSCURO que ese esquema deriva para lectura sobre una
// superficie CLARA (`derivarEsquema('crema')` = `base.texto`, floreado para la página crema, no para
// una foto con velo oscuro — la CAUSA RAÍZ real del defecto reportado: no era el velo, era que el
// esquema de la banda SÍ estaba asignado y su texto oscuro sobrevivía a la foto). SIN imagen, nada
// cambia: el `var(--sf-sobre-banda,...)` de siempre sigue resolviendo contra el fondo SÓLIDO, donde
// un esquema claro SÍ necesita texto oscuro para leerse.
//
// MOVIMIENTO REDUCIDO, NO NEGOCIABLE (mismo gate que Marquesina/BrandStoryCentrada/Origen):
// `estatico` (preview del editor, que no puede scrollear de verdad, o `prefers-reduced-motion`) deja
// la imagen QUIETA, sin desplazamiento — nunca a medio camino de un recorrido que no avanza.
//
// § SUSCRIPCION-POSTAL-DE-CIERRE-1 — EL ALTO, MEDIDO CONTRA EL RITMO DE LA PÁGINA, NO EL DEL
// PROTOTIPO. Gate del owner: "La sección PLAN DE SUSCRIPCIÓN se ve off… como si estuviera ahí
// olvidada" — la franja medía 108px (`py-8` = 32px×2 + el botón `py-3`), pegada al pie, la única
// banda de la home SIN la cadencia de las demás. El `.cta-strip` del prototipo
// (`docs/prototipos/cafeone/css/app.css:615`, `min-height:62vh`) es la referencia de FORMA
// (foto a sangre + velo + parallax), NO de ALTO — el owner lo llamó "exageradamente grande" antes de
// pedir esta tanda. El alto que SÍ se adopta es el de las bandas que YA rodean a ésta en el `orden`
// de CORTE: `py-20` (`Spotlight.tsx:163`, `Origen.tsx:128`, `GrindChooserRiel.tsx:464`, y la propia
// variante hermana `SubscriptionCTABloque.tsx:48`, que usa ESTA MISMA sección con `py-20` para los
// otros cinco presets) — tres de cuatro bandas visibles de CORTE comparten ese valor; sólo
// `BrandStoryCentrada.tsx:209` usa `py-24`, la banda más pesada de contenido (collage de 4 fotos),
// no el patrón típico. `py-8` → `py-20`.
//
// EL TÍTULO SUBE A LA ESCALA DE SECCIÓN, NO A UNA PROPIA. Tenía `text-xl sm:text-2xl` — menor que
// CUALQUIER título de banda de la home. `SubscriptionCTABloque.tsx:77` (la misma sección, en los
// otros cinco presets) usa `text-4xl` FIJO — el tamaño que el propio catálogo ya documenta como "el
// de esta sección" (`lib/config/escala-display.ts`, el comentario de `fontSizeDisplay`: "`text-4xl`
// fijo en subscriptionCTA", listado junto a featured/brandStory/presentaciones/testimonials/origen
// como base de CADA sección). Se adopta el MISMO `text-4xl` fijo — no el `text-3xl sm:text-4xl`
// responsive de featured/presentaciones, que es la base de OTRAS secciones, no de ésta.
//
// Y GANA EL MISMO OVERRIDE `escalaDisplay` QUE LAS OTRAS CINCO BANDAS DE CORTE, QUE ESTA VARIANTE
// NUNCA LLAMABA. `themes.ts` (el comentario de `escalaDisplay: 'amplia'`, CORTE) ya lista
// "featured, brandStory, presentaciones, subscriptionCTA, testimonials" como las cinco bandas que
// `fontSizeDisplay(tema.escalaDisplay,'l')` agranda bajo CORTE — pero `SubscriptionCTALinea` (la
// variante que CORTE realmente monta, `variantes.subscriptionCTA:'linea'`) nunca leía `tema` ni
// llamaba esa función; sólo `SubscriptionCTABloque` (que CORTE NO usa) la tenía. El hueco quedaba
// invisible porque nadie lo había notado: la lista del comentario describía una intención que el
// código de la variante activa no cumplía. Se cierra ACÁ, con el MISMO patrón de los otros cinco
// consumidores: `style={displayL ? { fontSize: displayL } : undefined}` — `undefined` sin escala
// declarada (los otros cinco presets, y Nayoli) deja el `text-4xl` de Tailwind intacto, byte a byte.
//
// LA COMPOSICIÓN PASA DE "EN LÍNEA" A "APILADA": el gancho y el título vivían `items-baseline
// flex-wrap gap-x-3` —adyacentes en la MISMA fila—, y el spec pide "el gancho arriba" del título,
// como en CUALQUIER otra banda (Spotlight/Origen/GrindChooserRiel: un `<p>` eyebrow seguido de un
// `<h2>` título, apilados). Con el título en escala de sección esa adyacencia además se habría vuelto
// ilegible (el gancho se habría visto aplastado contra un titular 2-3× más grande). Pasa a una
// columna (`flex-col gap-2`) DENTRO del bloque de texto; el bloque de texto sigue a la izquierda del
// bloque de CTAs en `sm:flex-row` (mismo mecanismo de la "Bottom Bar" del pie, sin tocar) — sólo
// cambia la composición INTERNA del texto, no el acomodo texto↔botones de la franja.
//
// LOS BOTONES SUBEN A `px-8 py-4` (de `px-6 py-3`) — el mismo padding que ya usan
// `SubscriptionCTABloque.tsx:87` y el CTA primario/secundario de `HeroCurtina.tsx:216,226`: con un
// título 2-3× más grande, un botón del tamaño de antes se habría visto menudo al lado.
//
// "AIRE ANTES DEL PIE" — `mb-16` en la `<section>`. Hasta esta tanda `<main>{children}</main>` y
// `<StoreFooter/>` se tocan DIRECTO (`app/(storefront)/layout.tsx:159-160`, SIN margen entre medio,
// fuera de `touches:` — no se toca ese archivo), así que la ÚLTIMA banda de `orden` siempre choca
// con el pie (`bg-[var(--sf-tinta)]`, `StoreFooter.tsx:103`) sin ningún respiro — el mismo choque que
// "se ve como una sola pieza" describe, EMPEORADO por una foto oscura con velo justo encima de un pie
// igual de oscuro. El wrapper de la página (`<div className="min-h-screen bg-[var(--sf-fondo)]…">`,
// `layout.tsx:157`) es la superficie CREMA que un `margin-bottom` (no `padding`: el margen cae FUERA
// de la caja de la sección, así que no lo pinta su propio fondo/velo) deja ver entre la postal y el
// pie. `16` (4rem/64px) no es arbitrario: es el MISMO valor que `BrandStoryCentrada.tsx:242` ya usa
// como margen de respiro (`mt-16 mb-16` alrededor de su collage) — la unidad de "aire" que la página
// ya reconoce, reusada acá en vez de inventar una cuarta.
//
// `SubscriptionCTABloque` (la variante canónica, la de Nayoli) NO LEE `imagenFondo` — no se toca.
//
// § SUSCRIPCION-TITULO-Y-RECARGA-1 — LA TRANSICIÓN DE ENTRADA DEJA DE SER UN SOLO BLOQUE. Hasta
// esta tanda, eyebrow+título+botones entraban juntos en UN `motion.div` con `fadeUp` (opacidad+24px).
// Gate del owner, tras `SUSCRIPCION-POSTAL-DE-CIERRE-1` (el alto/escala/composición ya aplicados):
// aprobó la transición propuesta — el TÍTULO sube desde detrás de una línea (revelado con máscara,
// `revelaMascaraVertical`/`transicionTituloPostal`, § `lib/animation.ts`), y el EYEBROW + el BOTÓN
// entran DESPUÉS con un desvanecimiento escalonado (`fadeUp`/`transicionFadePostal`) — DISTINTO de la
// cascada por palabras de `TextoEnCascada` (§ ORIGEN-TEXTO-EN-CASCADA-1): acá no hay palabras que
// tokenizar, son DOS hermanos (eyebrow, botones) que se desvanecen con un paso entre ellos, el mismo
// patrón de `transicionEscalonada` que ya usa Origen para sus fotos/filas/cifras.
//
// LA MÁSCARA DEL TÍTULO ES `overflow-hidden leading-none` sobre un `<div>` ESTÁTICO (sin motion,
// nunca se anima — sólo recorta), con el `motion.h2` adentro traduciéndose un PORCENTAJE de su
// propia caja (100%→0%) — la MISMA construcción que `transformRevelaTextoDisplay` ya usa para el
// marquee del hero (§ "EL REVELADO ENMASCARADO", `lib/animation.ts`), pero disparada por VIEWPORT
// (`whileInView`, un tiro único) en vez de por scroll continuo: no hay progreso de scroll que leer
// acá, el disparador es "entró en vista", igual que `fadeUp` en el resto de la home. `leading-none`
// fija el alto de la máscara al alto EXACTO de una línea de este texto — un `transform` del hijo no
// cambia esa altura, sólo su posición pintada, así que el traslado nunca desplaza el layout de
// alrededor (ni el eyebrow arriba ni los botones a la derecha se mueven mientras el título sube).
//
// SIN JS: TODO VISIBLE — requisito explícito del slice, mismo mecanismo que ya usa `TextoEnCascada`
// (§ el docstring de ese componente): `initial="hidden"` hornea el estado oculto en el HTML del
// servidor (framer-motion resuelve la variante server-side para que SSR y cliente coincidan), y sin
// hidratación ese estilo nunca se revertiría. El `<noscript><style>` de abajo neutraliza las DOS
// clases marcadoras (`sf-postal-titulo`/`sf-postal-fade`) con `!important` — el navegador sólo lo
// PARSEA como markup real cuando el scripting está apagado, así que con JS la animación queda intacta
// y sin JS el eyebrow/título/botón se ven completos, sin opacidad/traslado residual.
//
// MOVIMIENTO REDUCIDO: sin per-componente especial — igual que el resto de esta sección (`preview`
// gobierna las ternarias, no `estatico`/`reduce`), el `MotionConfig(reducedMotion:'user')` global
// (`app/(storefront)/layout.tsx`) ya vuelve estas transiciones prácticamente instantáneas bajo esa
// preferencia, el mismo criterio que el resto de los `whileInView` de esta home.
export default function SubscriptionCTALinea({ style }: { style?: React.CSSProperties } = {}) {
  const { subscriptionCTA, paginas, navTratamiento, tema } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;
  const ctaSecundarioHref = resolverCtaSeccion(subscriptionCTA.ctaSecundarioLabel, subscriptionCTA.ctaSecundarioDestino, paginas);
  const tieneImagenFondo = subscriptionCTA.imagenFondo.trim() !== "";
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1, cerrado para esta variante en
  // § SUSCRIPCION-POSTAL-DE-CIERRE-1, ver el docstring de arriba): `undefined` sin escala declarada
  // → no se toca el `style` del h2, que sigue rindiendo exactamente `text-4xl` (2.25rem, fijo).
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');

  const sectionRef = useRef<HTMLElement>(null);
  const progreso = useProgresoScroll(sectionRef);
  const parallaxY = useTransform(progreso, (p) => transformSubscripcionParallax(p, estatico));

  return (
    <section
      ref={sectionRef}
      className={`relative mb-16 overflow-hidden py-20${tieneImagenFondo ? "" : " bg-[var(--sf-banda,var(--sf-tinta-2))]"}`}
      style={style}
    >
      {tieneImagenFondo && (
        <div className="absolute inset-0" aria-hidden="true">
          {/* La caja del parallax se extiende 6vh arriba/abajo — EN `vh`, no en `%` de su propio
              alto (§ SUSCRIPCION-PARALLAX-VISIBLE-1, arriba): el `translateY` de ±5vh que
              `transformSubscripcionParallax` produce nunca excede ese búfer de 6vh, así que la
              imagen (siempre más alta que su marco) nunca expone un borde vacío — sea cual sea el
              alto de ESTA sección (chico por diseño), porque el búfer ya no depende de él. */}
          <motion.div className="absolute inset-x-0 top-[-6vh] bottom-[-6vh]" style={{ y: parallaxY }}>
            <Image src={subscriptionCTA.imagenFondo} alt="" fill sizes="100vw" className="object-cover" />
          </motion.div>
          <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 to-[var(--sf-velo)]" />
        </div>
      )}
      <noscript>
        <style>{".sf-postal-titulo{transform:none!important}.sf-postal-fade{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <div className={`relative z-10 ${contenedorClase} mx-auto`}>
        {/* YA NO es un solo `motion.div`: el título sube por máscara (su propio disparo de
            viewport); el eyebrow y los botones se desvanecen DESPUÉS, escalonados entre ellos
            (§ SUSCRIPCION-TITULO-Y-RECARGA-1, el docstring de arriba). El envoltorio vuelve a ser un
            `<div>` plano — sólo fija el acomodo texto↔CTAs, igual que antes. */}
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:text-left">
          {/* El gancho ARRIBA del título (columna, § SUSCRIPCION-POSTAL-DE-CIERRE-1 — ya no
              `items-baseline` en línea: con el título en escala de sección, la línea se habría visto
              aplastada). SIN imagen, mismos tokens `--sf-sobre-banda` que el bloque — la composición
              cambia, no la paleta. CON imagen, BLANCO PLENO literal (§ el docstring de arriba, "ESA
              MEDICIÓN ERA SÓLO DE BLANCO") — nunca `--sf-sobre-banda`, que puede traer el texto
              OSCURO de un esquema claro asignado a la banda (CORTE·crema) sobre una foto con velo
              oscuro. */}
          <div className="flex flex-col items-center gap-2 sm:items-start">
            {/* En preview, `whileInView`→`animate` con `initial={false}`: la vista escalada no
                dispara la intersección (como HeroSection/BrandStory/SubscriptionCTABloque). Fuera de
                preview, idéntico a cualquier otra sección. */}
            {subscriptionCTA.eyebrow && (
              <motion.p
                initial={preview ? false : "hidden"}
                animate={preview ? "visible" : undefined}
                whileInView={preview ? undefined : "visible"}
                viewport={preview ? undefined : { once: true }}
                variants={fadeUp}
                transition={preview ? undefined : transicionFadePostal(0)}
                className={`sf-postal-fade text-xs tracking-[0.2em] uppercase ${tieneImagenFondo ? "text-white" : "text-[var(--sf-sobre-banda,var(--sf-tostado))]"}`}
              >
                {subscriptionCTA.eyebrow}
              </motion.p>
            )}
            {/* LA MÁSCARA — `<div>` ESTÁTICO (sin motion, nunca se anima), `overflow-hidden` del alto
                EXACTO de una línea de este texto (`leading-none`). El `motion.h2` adentro traduce un
                PORCENTAJE de su propia caja — § el docstring de arriba, "LA MÁSCARA DEL TÍTULO". */}
            <div className="overflow-hidden leading-none">
              <motion.h2
                initial={preview ? false : "hidden"}
                animate={preview ? "visible" : undefined}
                whileInView={preview ? undefined : "visible"}
                viewport={preview ? undefined : { once: true }}
                variants={revelaMascaraVertical}
                transition={preview ? undefined : transicionTituloPostal()}
                className={`sf-postal-titulo text-4xl font-playfair ${tieneImagenFondo ? "text-white" : "text-[var(--sf-sobre-banda,white)]"}`}
                style={displayL ? { fontSize: displayL } : undefined}
              >
                {subscriptionCTA.titulo}
              </motion.h2>
            </div>
          </div>
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
            transition={preview ? undefined : transicionFadePostal(1)}
            className="sf-postal-fade flex shrink-0 flex-wrap items-center justify-center gap-4"
          >
            <Link
              href="/suscripciones"
              className="inline-flex shrink-0 items-center gap-2 bg-[var(--sf-accion,var(--sf-tostado))] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] text-[var(--sf-accion-txt,var(--sf-tinta))] font-semibold px-8 py-4 sf-pildora text-sm transition-all hover:-translate-y-0.5"
            >
              {subscriptionCTA.ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
            {ctaSecundarioHref && (
              <Link
                href={ctaSecundarioHref}
                className="inline-flex shrink-0 items-center gap-2 border border-[var(--sf-linea-sobre,white)]/30 px-8 py-4 sf-pildora text-sm font-medium text-[var(--sf-sobre-banda,white)] transition-all hover:border-[var(--sf-linea-sobre,white)]/60 hover:bg-white/10"
              >
                {subscriptionCTA.ctaSecundarioLabel}
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
