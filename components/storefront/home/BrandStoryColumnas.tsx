"use client";

import Image from "next/image";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";
import RevelarBloque from "@/components/storefront/RevelarBloque";

// LA VARIANTE CANÓNICA (§ eje 5e, CORTE-BRANDSTORY-COLLAGE-1): "Nuestra Historia" a dos columnas —
// texto de un lado, collage del otro — el BrandStory de SIEMPRE, extraído VERBATIM al separar el
// mecanismo de variantes del dispatcher (`BrandStory.tsx`). El gate de visibilidad
// (`seccionEsVisible`) vive en el DISPATCHER, no acá — esta variante asume que ya se decidió
// mostrarla.
//
// CARDINALIDAD 1 A 4 (§ CORTE-HISTORIA-COLOR-FOTOS-1): `imagen1` REQUERIDA; `imagen2/3/4`
// OPCIONALES (§ REGISTRY.brandStory.campos) — vacías se OMITEN, no se rellenan con el default. Se
// rinde sólo lo que tiene valor; el grid pasa a 1 columna cuando queda una sola foto (el default de
// Nayoli, con las 4 llenas, sigue siendo el 2×2 de siempre — byte-idéntico).
const IMAGENES = [
  { campo: "imagen1", alt: "Una taza de café servida sobre una mesa de madera, con granos alrededor", offset: "" },
  { campo: "imagen2", alt: "Cerezas de café secándose extendidas sobre una malla", offset: "mt-8" },
  { campo: "imagen3", alt: "Las manos de un recolector mostrando cerezas rojas sobre su canasto", offset: "-mt-4" },
  { campo: "imagen4", alt: "Una rama de cafeto con los granos todavía verdes", offset: "mt-4" },
] as const;

export default function BrandStoryColumnas({ style }: { style?: React.CSSProperties } = {}) {
  const { brandStory, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style` del h2, que sigue rindiendo exactamente `text-4xl sm:text-5xl` (2.25rem/3rem, medido) —
  // byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE, incluida Nayoli con esta variante canónica) = el literal de HOY,
  // byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  // Las imágenes CON VALOR — `imagen1` siempre (requerida); `imagen2/3/4` sólo si el dueño las
  // llenó (§ el comentario de cabecera, arriba). Con las cuatro llenas (Nayoli) da la lista
  // completa en el MISMO orden, así que el `.map` de abajo rinde EXACTO lo de siempre.
  const imagenesLlenas = IMAGENES.filter(({ campo }) => !!brandStory[campo]);

  // LA ENTRADA (§ SECCIONES-ENTRAN-VIVAS-1): eyebrow/título/párrafo(s)/collage entran cada uno por su
  // cuenta con `RevelarBloque` (§ su docstring: gate `preview` incluido, mismo criterio que el resto
  // de la home) — reemplaza al ÚNICO bloque de texto combinado (eyebrow+título+párrafos) y al
  // `scale`+`opacity` propio del collage, que no seguía la curva/duración/disparo tardío del resto.
  return (
    <section id="nuestra-historia" className="py-24 bg-[var(--sf-banda,var(--sf-tinta))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            {/* `--sf-tostado` era FIJO (§ eje 5b, home-2 — mismo hueco que el eyebrow del hero):
                `--sf-sobre-banda` con `--sf-tostado` de fallback preserva hoy y se adapta por esquema.
                EL TÍTULO/PÁRRAFOS (§ eje 5b, home-3) estaban en `--sf-sobre` —floreado contra la
                TARJETA— y daban 1.07:1 al asignar 'crema' a esta banda (canónica oscura). Se apoyan
                DIRECTO en el fondo de la banda: el título va a `--sf-sobre-banda`; los párrafos
                (con el /60 de diseño) van a `--sf-sobre-banda-suave`, SIN el modificador `/NN` de
                Tailwind encima (reduciría el `texto-suave` ya floreado por debajo de AA), con el
                alfa horneado en el fallback (`color-mix(in oklab, white 60%, transparent)` — la
                MISMA fórmula que Tailwind genera para `/60` — así que sin esquema el resultado es el
                mismo píxel que `text-white/60` de siempre). */}
            {brandStory.eyebrow && (
              <RevelarBloque as="p" indice={0} preview={preview} className="text-[var(--sf-sobre-banda,var(--sf-tostado))] text-xs font-medium tracking-[0.2em] uppercase mb-4">
                {brandStory.eyebrow}
              </RevelarBloque>
            )}
            <RevelarBloque
              as="h2"
              indice={1}
              preview={preview}
              className="text-4xl sm:text-5xl font-playfair text-[var(--sf-sobre-banda,white)] leading-tight mb-6"
              style={displayL ? { fontSize: displayL } : undefined}
            >
              {brandStory.titulo}
            </RevelarBloque>
            <RevelarBloque as="p" indice={2} preview={preview} className="text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))] leading-relaxed mb-6 text-base">
              {brandStory.parrafo1}
            </RevelarBloque>
            {brandStory.parrafo2 && (
              <RevelarBloque as="p" indice={3} preview={preview} className="text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))] leading-relaxed mb-8 text-base">
                {brandStory.parrafo2}
              </RevelarBloque>
            )}
          </div>
          <RevelarBloque
            indice={4}
            preview={preview}
            className={`grid gap-4 ${imagenesLlenas.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {/* RADIO (§ RADIO-TARJETAS-IMAGEN-1): `sf-radio-imagen`, no `rounded-2xl` crudo — gate del
                owner, "un poco de redondeo pero sólo a las card de imágenes". Fallback 1rem = el
                mismo `--radius-2xl` que `rounded-2xl` ya resolvía bajo Suave → byte-idéntico para
                Nayoli, que monta ESTA variante canónica. */}
            {imagenesLlenas.map(({ campo, alt, offset }) => (
              <div key={campo} className={`relative h-48 overflow-hidden sf-radio-imagen ${offset}`}>
                <Image
                  src={brandStory[campo]}
                  alt={alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
            ))}
          </RevelarBloque>
        </div>
      </div>
    </section>
  );
}
