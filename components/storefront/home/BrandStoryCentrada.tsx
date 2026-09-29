"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { fadeUp, parametrosAcomodoCollage, transformAcomodo, useProgresoAcomodo } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";

// LA VARIANTE "CENTRADA" (§ CORTE-BRANDSTORY-COLLAGE-1, MEDIDA contra la sección `.historia` de
// `docs/prototipos/cafeone/index.html:250-273` + `css/app.css:561-578`). El BrandStory de siempre
// (`BrandStoryColumnas`) es a dos columnas — texto de un lado, collage del otro—; ésta es CENTRADA y
// en CAPAS: eyebrow + título grandes al medio, el collage de figuras A LO ANCHO debajo, y el párrafo
// cerrando abajo. Mismos campos de contenido (eyebrow/titulo/parrafo1/parrafo2/imagen1..4/ctaLabel/
// ctaDestino), mismo gate de visibilidad en el DISPATCHER (`BrandStory.tsx`) — lo que cambia es de
// qué esqueleto está hecha la banda.
//
// LA CARDINALIDAD ES 1 A 4 (§ CORTE-HISTORIA-COLOR-FOTOS-1), no fija en cuatro: `imagen1` es
// REQUERIDA (mínimo una foto); `imagen2/3/4` son OPCIONALES (§ REGISTRY.brandStory.campos,
// site-content-defaults.ts) — vacías se OMITEN, nunca rellenadas por el resolver. Se rinden sólo
// las imágenes con VALOR; el collage (`justify-center`+`items-center`, abajo) se reacomoda solo
// con las que haya, sin cambio de layout — CENTRADO SIEMPRE, nunca alineado a un borde. Con
// exactamente TRES visibles el resultado es el del prototipo EXACTO (§ HISTORIA-COMO-MUESTRARIO-1,
// más abajo); con otra cantidad, la SIMETRÍA se extiende — nunca un offset vertical inventado.
//
// LOS HOOKS SE LLAMAN SIEMPRE LOS CUATRO, SIN IMPORTAR CUÁNTAS IMÁGENES SE RINDAN: `IMAGENES` es
// un literal de longitud fija (4) y los cuatro `useTransform` (abajo) se calculan siempre; sólo el
// `.map` de RENDER filtra por valor no-vacío. Filtrar ANTES de llamar a los hooks violaría las
// reglas de hooks de React (el conteo variaría entre renders).
//
// EL CTA DE CIERRE (§ MUESTRARIO-SECCION-CTA-1, MEDIDO contra `.historia-copy` del prototipo,
// "Nuestra historia" → `#origen`, `index.html:270`): `brandStory.ctaLabel`/`.ctaDestino` (la
// capacidad GENERAL: cualquier sección puede declarar su propio botón opcional) resuelven el href
// con `resolverCtaSeccion` — vacío = sin botón, byte-idéntico. Va bajo el párrafo de cierre. La
// canónica `BrandStoryColumnas` sigue sin CTA propio (la home lleva el ANZUELO, § site-content-
// defaults.ts, "LA PÁGINA /nosotros") — no es un hueco, es que nadie lo pidió ahí.
//
// EL PARALLAX DE SCROLL (§ TEMAS-BRANDSTORY-DIRECCION-ARTE-1, cierra el punto 2 de arriba, que
// hasta ese slice decía que el motor "este repo no tiene"): `js/home.js:284-301` (`FSA.scrub`)
// resuelve la inclinación/superposición del collage EN FUNCIÓN DEL PROGRESO DE SCROLL de la
// sección, no de un disparo único. El collage usa el motor real
// (`useProgresoAcomodo`/`transformAcomodo`, `lib/animation.ts`) sobre `useScroll`+`useTransform`
// —el mismo mecanismo de movimiento que ya trae el repo, no un listener propio—.
//
// § HISTORIA-COMO-MUESTRARIO-1 REESCRIBIÓ el eje: la aproximación anterior movía cada figura con un
// ASIENTO VERTICAL (`y:16→0`) que el prototipo NUNCA tuvo. `js/home.js:287-297` abre las figuras
// HORIZONTALMENTE (`translateX`), no verticalmente: cada una arranca inclinada (`rotar`) Y con
// apertura 0, y SE ACOMODA —la rotación se endereza a 0° MIENTRAS la apertura CRECE hasta su tope—
// a medida que el visitante scrollea la sección. `parametrosAcomodoCollage` (`lib/animation.ts`)
// deriva `{rotarInicialDeg, aperturaPx}` por FIGURA a partir de su posición entre las VISIBLES y el
// total visible —no de su slot fijo (0..3)—, porque la simetría es sobre lo que se MUESTRA, § abajo.
//
// MOVIMIENTO REDUCIDO, NO NEGOCIABLE: con `prefers-reduced-motion` (o en la VISTA PREVIA del editor,
// que tampoco puede scrollear de verdad — mismo criterio que el resto de esta variante, § el switch
// `preview` de abajo) el collage rinde su estado ACOMODADO final, QUIETO, sin importar el scroll —
// `transformAcomodo(…, estatico=true)` siempre `'none'`—. `useReducedMotion()` es el DETECTOR —el
// mismo hook que ya usan `HeroCurtina`/`HeroMedia`/`NosotrosGaleria` para decisiones que
// `MotionConfig reducedMotion="user"` (§ `ReducedMotionProvider`, `lib/animation.ts`) no cubre: ese
// provider sólo congela animaciones DECLARATIVAS (`animate`/`whileInView`/variants) disparadas por
// `.start()`; un valor de scroll ligado directo vía `useScroll`+`useTransform` no pasa por ahí —no
// hay `.start()` que interceptar—, así que el guard acá SÍ hace falta (a diferencia del cue del
// hero, § `hero-agregados.test.ts`, que no necesita uno propio).
//
// ANGOSTO (<640px, el mismo umbral `sm:` de Tailwind que el prototipo usa en su `@media (max-width:
// 640px)`, `css/app.css:1011-1012`): el collage pasa a COLUMNA (una foto por fila, mismo ancho) y
// SIN transform — el prototipo lo fuerza con `transform:none !important`, porque el `transform`
// scrubbed es un INLINE STYLE (`motion.div` lo escribe vía `element.style`) y sólo una regla con
// `!important` puede ganarle. `max-sm:transform-none!` (sintaxis de importante de Tailwind v4:
// el `!` va al FINAL de la utilidad) reproduce esa misma regla.
//
// TAMAÑOS — MEDIDOS del prototipo (`css/app.css:566-576`), NO inventados: lado `clamp(200px,24vw,
// 340px)`; LA FIGURA DEL MEDIO `clamp(240px,28vw,400px)` + `z-index:2` (`nth-child(2)`, sólo con
// exactamente TRES figuras — el prototipo no define un "medio" para otra cantidad). Angosto:
// `width:min(320px,82vw)` para TODAS (`css/app.css:1012`), sin distinción de tamaño.
//
// EL CONTENEDOR ES `max-w-6xl` (1152px), NO `max-w-4xl` (§ HISTORIA-COMO-MUESTRARIO-1, MEDIDO):
// el `clamp(...)` está en `vw` porque el prototipo mide contra `.shell` (`--content-max: 1440px`,
// `css/tokens.css:157`) — casi el ancho del VIEWPORT, no un texto angosto. Metido dentro de
// `max-w-4xl` (896px) los 3 lados+medio (~1021px a 1280px de viewport) DESBORDABAN el contenedor
// —el defecto real detrás del recorte visible en el gate—. `max-w-6xl` es el ancho de banda que YA
// usan las demás secciones del home (TrustBadges, GrindChooser*, FeaturedProducts, Origen,
// BrandStoryColumnas), así que no es un valor nuevo: es el que le faltaba a esta variante.
//
// CARDINALIDAD PAR (2 o 4 visibles): NO HAY una figura "del medio" única, así que NINGUNA gana el
// tamaño grande — todas quedan del tamaño de lado. Es la generalización MÁS SIMPLE del caso que el
// prototipo sólo define para 3: "impar → hay centro, se agranda"; "par → no hay centro, todas iguales".
//
// `sm:flex-wrap` — el prototipo NUNCA declara más de 3 figuras, así que nunca necesitó envolver.
// Con 4 llenas (el default de HOY, sin preset que recorte `imagen4`) los lados a tamaño de
// prototipo SIGUEN sin caber en una fila aun a `max-w-6xl` (4×307px+3×gap ≈ 1301px > ~1088px
// útiles) — la generalización más simple para ese caso NO es encoger las figuras (el prototipo no
// da esa regla), es dejar que la fila SE ENVUELVA, como ya hacía la composición anterior
// (asiento vertical). Con 3 o menos, `sm:flex-wrap` es un no-op: los TAMAÑOS DE PROTOTIPO caben
// en una sola fila a `max-w-6xl` (medido, con margen).
const IMAGENES = [
  { campo: "imagen1", alt: "Una taza de café servida sobre una mesa de madera, con granos alrededor" },
  { campo: "imagen2", alt: "Cerezas de café secándose extendidas sobre una malla" },
  { campo: "imagen3", alt: "Las manos de un recolector mostrando cerezas rojas sobre su canasto" },
  { campo: "imagen4", alt: "Una rama de cafeto con los granos todavía verdes" },
] as const;

// El lado, y el medio (SÓLO con 3 visibles) — dos strings LITERALES completos, nunca interpolados:
// Tailwind escanea el TEXTO del archivo buscando substrings de clase completos (mismo criterio que
// `gridColsPresentaciones`, § lib/storefront/presentaciones.ts); una clase armada por template
// literal con el número adentro sería invisible para el JIT.
const CLASE_FIGURA_LADO = 'w-[min(320px,82vw)] sm:w-[clamp(200px,24vw,340px)]';
const CLASE_FIGURA_MEDIO = 'z-10 w-[min(320px,82vw)] sm:w-[clamp(240px,28vw,400px)]';

export default function BrandStoryCentrada({ style }: { style?: React.CSSProperties } = {}) {
  const { brandStory, tema, paginas } = useSiteContent();
  const preview = useIsPreview();
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1) — MEDIDO EXACTAMENTE ACÁ: CORTE (`brandStory:
  // 'centrada'`) es el ÚNICO preset que usa esta variante y el ÚNICO que declara `escalaDisplay:
  // 'amplia'`. `undefined` sin escala declarada → NO se toca el `style`, que sigue rindiendo
  // `text-4xl sm:text-5xl` (2.25rem/3rem, medido) — byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  const ctaHref = resolverCtaSeccion(brandStory.ctaLabel, brandStory.ctaDestino, paginas);

  // Mismo switch que `BrandStoryColumnas` (§ ahí, el razonamiento completo): en la vista previa
  // escalada del panel, `whileInView` no dispara —la intersección con el viewport no llega dentro
  // del contenedor con `transform: scale`—, así que se cambia a `animate` con `initial={false}`:
  // el elemento descansa en su estado visible desde el primer render.

  // EL COLLAGE: scroll-scrub real, con el gate de movimiento reducido (§ el comentario de arriba).
  // `estatico` cubre las DOS razones por las que este collage no puede depender del scroll: la
  // preferencia del visitante, y la vista previa del editor (que tampoco scrollea de verdad).
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;
  const collageRef = useRef<HTMLDivElement>(null);
  const progreso = useProgresoAcomodo(collageRef);
  // Las imágenes CON VALOR, preservando el índice original (0..3) — ANTES de los hooks, porque la
  // simetría de `parametrosAcomodoCollage` es sobre la POSICIÓN ENTRE LAS VISIBLES y el TOTAL
  // visible, no sobre el slot fijo (0..3): con imagen1+imagen3 llenas y 2/4 vacías, imagen3 es la
  // SEGUNDA de DOS visibles, no la "tercera de cuatro". Esto es puro cálculo de datos (sin hooks),
  // así que reordenarlo antes de los `useTransform` no viola las reglas de hooks.
  const imagenesLlenas = IMAGENES
    .map((img, i) => ({ ...img, i }))
    .filter(({ campo }) => !!brandStory[campo]);
  const totalVisible = imagenesLlenas.length;
  // El parámetro de CADA slot (0..3), por su posición dentro de las visibles — `null` para un slot
  // vacío (nunca se lee: `imagenesLlenas` no lo incluye en el `.map()` de render, abajo).
  const posicionPorSlot = new Map(imagenesLlenas.map(({ i }, pos) => [i, pos]));
  const parametroDeSlot = (i: number) => {
    const pos = posicionPorSlot.get(i);
    return pos === undefined ? { rotarInicialDeg: 0, aperturaPx: 0 } : parametrosAcomodoCollage(pos, totalVisible);
  };
  // Cuatro llamadas EXPLÍCITAS, una por imagen — `IMAGENES` es un literal de longitud fija (4), así
  // que el número de hooks no varía entre renders; llamarlas dentro de un `.map()` sí lo haría
  // (inseguro para React aunque acá el largo nunca cambiaría en la práctica).
  const p1 = parametroDeSlot(0);
  const p2 = parametroDeSlot(1);
  const p3 = parametroDeSlot(2);
  const p4 = parametroDeSlot(3);
  const transformImg1 = useTransform(progreso, (p) => transformAcomodo(p1.rotarInicialDeg, p1.aperturaPx, p, estatico));
  const transformImg2 = useTransform(progreso, (p) => transformAcomodo(p2.rotarInicialDeg, p2.aperturaPx, p, estatico));
  const transformImg3 = useTransform(progreso, (p) => transformAcomodo(p3.rotarInicialDeg, p3.aperturaPx, p, estatico));
  const transformImg4 = useTransform(progreso, (p) => transformAcomodo(p4.rotarInicialDeg, p4.aperturaPx, p, estatico));
  const transformsPorImagen = [transformImg1, transformImg2, transformImg3, transformImg4];

  return (
    <section id="nuestra-historia" className="overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] py-24" style={style}>
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
        >
          {/* Mismos tokens que `BrandStoryColumnas` (§ ahí, el razonamiento completo de contraste):
              `--sf-sobre-banda`/`--sf-sobre-banda-suave` con los mismos fallbacks, sólo que acá
              centrados en vez de alineados a la izquierda. */}
          {brandStory.eyebrow && (
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-tostado))]">
              {brandStory.eyebrow}
            </p>
          )}
          <h2
            className="font-playfair text-4xl leading-tight text-[var(--sf-sobre-banda,white)] sm:text-5xl"
            style={displayL ? { fontSize: displayL } : undefined}
          >
            {brandStory.titulo}
          </h2>
        </motion.div>

        {/* El collage A LO ANCHO — figuras en fila (columna bajo 640px, § el comentario de cabecera),
            centradas verticalmente (`items-center`, como el prototipo: la figura del medio protruye
            por ser más GRANDE, nunca por un offset de margen) y un `transform` scrubbed por scroll:
            cada figura arranca inclinada y se ABRE (rotación→0, apertura horizontal→su tope) a
            medida que la sección cruza el viewport, salvo `estatico` (movimiento reducido / vista
            previa) o angosto (`max-sm:transform-none!`, § arriba), donde queda siempre quieta.
            SIEMPRE visible (opacity 1): el prototipo nunca desvanece estas figuras, sólo las
            rota/abre. */}
        <div ref={collageRef} className="mt-16 mb-16 flex flex-col items-center justify-center gap-6 sm:flex-row sm:flex-wrap">
          {imagenesLlenas.map(({ campo, alt, i }, pos) => {
            const esMedia = totalVisible === 3 && pos === 1;
            return (
              <motion.div
                key={campo}
                style={{ transform: transformsPorImagen[i] }}
                className={`relative aspect-[3/4] shrink-0 overflow-hidden rounded-2xl shadow-[0_18px_44px_rgba(16,36,7,0.14)] max-sm:transform-none! ${esMedia ? CLASE_FIGURA_MEDIO : CLASE_FIGURA_LADO}`}
              >
                <Image
                  src={brandStory[campo]}
                  alt={alt}
                  fill
                  sizes="(max-width: 640px) 82vw, 28vw"
                  className="object-cover"
                />
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
          className="mx-auto max-w-2xl"
        >
          <p className="text-base leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))]">
            {brandStory.parrafo1}
          </p>
          {brandStory.parrafo2 && (
            <p className="mt-6 text-base leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))]">
              {brandStory.parrafo2}
            </p>
          )}
          {ctaHref && (
            <Link
              href={ctaHref}
              className="mt-8 inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-tinta)] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-tostado-4)]"
            >
              {brandStory.ctaLabel}
            </Link>
          )}
        </motion.div>
      </div>
    </section>
  );
}
