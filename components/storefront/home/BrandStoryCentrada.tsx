"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import Image from "next/image";
import { fadeUp, transformAcomodo, useProgresoAcomodo } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { fontSizeDisplay } from "@/lib/config/escala-display";

// LA VARIANTE "CENTRADA" (§ CORTE-BRANDSTORY-COLLAGE-1, MEDIDA contra la sección `.historia` de
// `docs/prototipos/cafeone/index.html:250-273` + `css/app.css:561-578`). El BrandStory de siempre
// (`BrandStoryColumnas`) es a dos columnas — texto de un lado, collage del otro—; ésta es CENTRADA y
// en CAPAS: eyebrow + título grandes al medio, el collage de figuras A LO ANCHO debajo, y el párrafo
// cerrando abajo. Mismos siete campos de contenido (eyebrow/titulo/parrafo1/parrafo2/imagen1..4),
// mismo gate de visibilidad en el DISPATCHER (`BrandStory.tsx`) — lo que cambia es de qué esqueleto
// está hecha la banda.
//
// LA CARDINALIDAD DIFIERE DEL PROTOTIPO, A PROPÓSITO: el `.collage` del prototipo dibuja TRES
// figuras; nuestro modelo (`BrandStoryContent`) sólo tiene CUATRO imágenes (`imagen1..4`), las
// mismas que ya usa `BrandStoryColumnas` — no se inventa un quinto campo ni se descarta una de las
// cuatro para calzar el número del prototipo. Las CUATRO se muestran en fila, alternando el offset
// vertical (mismos valores que ya usa `BrandStoryColumnas` para su 2×2 — no se inventa una escala
// nueva) para reproducir el escalonado del prototipo con la cardinalidad que el modelo sí tiene.
//
// LO QUE EL PROTOTIPO TIENE Y ESTA VARIANTE NO PUEDE EXPRESAR (medido, no improvisado con texto fijo):
//   1. El CTA "Nuestra historia" → #origen (`index.html:270`). `BrandStoryContent` no declara ningún
//      campo de link/label para esta sección —ni la canónica `BrandStoryColumnas` lo tiene: la home
//      lleva el ANZUELO, sin CTA propio (§ site-content-defaults.ts, "LA PÁGINA /nosotros")—. Agregar
//      uno sería escritura de esquema, fuera de este slice. Se construye SIN el botón.
//
// EL PARALLAX DE SCROLL (§ TEMAS-BRANDSTORY-DIRECCION-ARTE-1, cierra el punto 2 de arriba, que
// hasta este slice decía que el motor "este repo no tiene"): `js/home.js:284-301` (`FSA.scrub`)
// resuelve la inclinación/superposición del collage EN FUNCIÓN DEL PROGRESO DE SCROLL de la
// sección, no de un disparo único. Ahora el collage usa el motor real
// (`useProgresoAcomodo`/`transformAcomodo`, `lib/animation.ts`) sobre `useScroll`+`useTransform`
// —el mismo mecanismo de movimiento que ya trae el repo, no un listener propio—: cada figura
// arranca inclinada (`rotar`) y con un asiento vertical (`ASIENTO_ACOMODO_PX`, el mismo `y:16` que
// la aproximación anterior por `whileInView` ya usaba) y SE ACOMODA —rotación y asiento a 0— a
// medida que el visitante scrollea la sección, no al entrar una vez en el viewport.
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
const ASIENTO_ACOMODO_PX = 16;

const IMAGENES = [
  { campo: "imagen1", alt: "Una taza de café servida sobre una mesa de madera, con granos alrededor", offset: "", rotar: -4 },
  { campo: "imagen2", alt: "Cerezas de café secándose extendidas sobre una malla", offset: "sm:mt-8", rotar: 3 },
  { campo: "imagen3", alt: "Las manos de un recolector mostrando cerezas rojas sobre su canasto", offset: "sm:-mt-4", rotar: -3 },
  { campo: "imagen4", alt: "Una rama de cafeto con los granos todavía verdes", offset: "sm:mt-4", rotar: 4 },
] as const;

export default function BrandStoryCentrada({ style }: { style?: React.CSSProperties } = {}) {
  const { brandStory, tema } = useSiteContent();
  const preview = useIsPreview();
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1) — MEDIDO EXACTAMENTE ACÁ: CORTE (`brandStory:
  // 'centrada'`) es el ÚNICO preset que usa esta variante y el ÚNICO que declara `escalaDisplay:
  // 'amplia'`. `undefined` sin escala declarada → NO se toca el `style`, que sigue rindiendo
  // `text-4xl sm:text-5xl` (2.25rem/3rem, medido) — byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');

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
  // Cuatro llamadas EXPLÍCITAS, una por imagen — `IMAGENES` es un literal de longitud fija (4), así
  // que el número de hooks no varía entre renders; llamarlas dentro de un `.map()` sí lo haría
  // (inseguro para React aunque acá el largo nunca cambiaría en la práctica).
  const transformImg1 = useTransform(progreso, (p) => transformAcomodo(IMAGENES[0].rotar, ASIENTO_ACOMODO_PX, p, estatico));
  const transformImg2 = useTransform(progreso, (p) => transformAcomodo(IMAGENES[1].rotar, ASIENTO_ACOMODO_PX, p, estatico));
  const transformImg3 = useTransform(progreso, (p) => transformAcomodo(IMAGENES[2].rotar, ASIENTO_ACOMODO_PX, p, estatico));
  const transformImg4 = useTransform(progreso, (p) => transformAcomodo(IMAGENES[3].rotar, ASIENTO_ACOMODO_PX, p, estatico));
  const transformsPorImagen = [transformImg1, transformImg2, transformImg3, transformImg4];

  return (
    <section id="nuestra-historia" className="overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] py-24" style={style}>
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
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

        {/* El collage A LO ANCHO — cuatro figuras en fila, con offset vertical alternado (estático,
            del layout) y un `transform` scrubbed por scroll (§ el comentario de arriba): cada
            figura arranca inclinada y se ACOMODA a medida que la sección cruza el viewport, salvo
            `estatico` (movimiento reducido / vista previa), donde queda siempre en su estado final.
            SIEMPRE visible (opacity 1): el prototipo nunca desvanece estas figuras, sólo las
            rota/asienta. */}
        <div ref={collageRef} className="mt-16 mb-16 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {IMAGENES.map(({ campo, alt, offset }, i) => (
            <motion.div
              key={campo}
              style={{ transform: transformsPorImagen[i] }}
              className={`relative aspect-[3/4] w-[42%] overflow-hidden rounded-2xl shadow-xl sm:w-40 lg:w-52 ${offset}`}
            >
              <Image
                src={brandStory[campo]}
                alt={alt}
                fill
                sizes="(max-width: 640px) 42vw, (max-width: 1024px) 160px, 208px"
                className="object-cover"
              />
            </motion.div>
          ))}
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
        </motion.div>
      </div>
    </section>
  );
}
