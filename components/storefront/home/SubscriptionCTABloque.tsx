"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { planesDeSuscripcion, planesDelTeaser, gridColsTeaser } from "@/lib/storefront/planes-suscripcion";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";

// LA VARIANTE "BLOQUE" (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): la CANÓNICA — el layout de HOY,
// verbatim (texto a un lado, tarjetas de plan del teaser al otro, `grid-cols-1 lg:grid-cols-2`). Es
// el mismo componente que vivía en `SubscriptionCTA.tsx` antes de que esa sección ganara variantes;
// se movió acá tal cual, sin reescribir un byte, para abrirle el slot a "linea" (§ SubscriptionCTALinea).
//
// El gate de visibilidad (`seccionEsVisible` + el flag de página `paginas.suscripciones.visible`)
// vive en el DISPATCHER (`SubscriptionCTA.tsx`), no acá — mismo patrón que GrindChooser/HeroSection.
//
// Las tarjetas de plan son DATO: leen la MISMA sección `suscripcionPlanes` que /suscripciones (§ Backlog
// #49, opción 1) → las dos superficies no divergen. El teaser LIMITA los planes (`planesDelTeaser`, § d):
// es un anzuelo que enlaza a /suscripciones, no el grid completo. El destaque sale del dato
// (`plan.destacado`, el `destacadoSlot` de la sección), no del `i===1` hardcodeado de antes. El href del
// CTA es estructura (`/suscripciones`), sólo el label es editable.
//
// LA ENTRADA (§ SECCIONES-ENTRAN-VIVAS-1) — ésta ES la variante canónica (Nayoli, sin preset): hasta
// este slice era un único bloque `fadeUp` por columna, sin curva/duración declaradas (un `fadeUp`
// local, redeclarado acá en vez de importado de `lib/animation.ts`). Eyebrow/título/subtítulo/
// beneficios/CTA entran por separado con `RevelarBloque`, y las tarjetas del teaser pasan del
// `scale`+`x:30` propio a la misma entrada uniforme (opacidad+50px) que el resto de la home.
export default function SubscriptionCTABloque({ style }: { style?: React.CSSProperties } = {}) {
  const { subscriptionCTA, suscripcionPlanes, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const planesTeaser = planesDelTeaser(planesDeSuscripcion(suscripcionPlanes));
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1): `undefined` sin escala declarada → NO se toca el
  // `style` del h2, que sigue rindiendo exactamente `text-4xl` (2.25rem, fijo, medido) —
  // byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  // `slot` sobrevive al filtro (§ lista-plana, CLAUDE.md): si bullet2 está vacío y bullet3 no, el
  // campo editable de la segunda fila visible tiene que seguir siendo "bullet3", no "bullet2" — el
  // slot ORIGINAL, no la posición entre los visibles.
  const beneficios = [
    { slot: 1, valor: subscriptionCTA.bullet1 },
    { slot: 2, valor: subscriptionCTA.bullet2 },
    { slot: 3, valor: subscriptionCTA.bullet3 },
    { slot: 4, valor: subscriptionCTA.bullet4 },
  ].filter(b => b.valor.trim() !== ""); // vacíos omitidos → la lista se cierra sin hueco

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-tinta-2))]" style={style}>
        <div className={`${contenedorClase} mx-auto`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* `--sf-tostado` era FIJO (§ eje 5b, home-2 — mismo hueco que el eyebrow del hero):
                  `--sf-sobre-banda` con `--sf-tostado` de fallback preserva hoy y se adapta por
                  esquema. El bullet-dot y las tarjetas de plan del teaser NO se tocan: el primero es
                  decorativo (no texto), las segundas son tarjetas self-contained con su propio par
                  acento/acento-txt, independiente del esquema de la sección.
                  EL TÍTULO/SUBTÍTULO/BENEFICIOS (§ eje 5b, home-3) estaban en `--sf-sobre`
                  —floreado contra la TARJETA— y daban 1.07:1 al asignar 'crema' a esta banda
                  (canónica oscura). Se apoyan DIRECTO en el fondo de la banda: el título va a
                  `--sf-sobre-banda`; subtítulo/beneficios (con el alfa de diseño) van a
                  `--sf-sobre-banda-suave`, SIN el modificador `/NN` de Tailwind encima (reduciría el
                  `texto-suave` ya floreado por debajo de AA), con el alfa horneado en el fallback
                  (`color-mix(in oklab, white NN%, transparent)` — la MISMA fórmula que Tailwind
                  genera para `/NN` — así que sin esquema el resultado es el mismo píxel que
                  `text-white/NN` de siempre). */}
              {subscriptionCTA.eyebrow && (
                <RevelarBloque as="p" indice={0} preview={preview} className="text-[var(--sf-sobre-banda,var(--sf-tostado))] text-xs tracking-[0.2em] uppercase mb-3"><CampoEditable campo="subscriptionCTA.eyebrow">{subscriptionCTA.eyebrow}</CampoEditable></RevelarBloque>
              )}
              <RevelarBloque as="h2" indice={1} preview={preview} className="text-4xl font-playfair text-[var(--sf-sobre-banda,white)] mb-4" style={displayL ? { fontSize: displayL } : undefined}><CampoEditable campo="subscriptionCTA.titulo">{subscriptionCTA.titulo}</CampoEditable></RevelarBloque>
              <RevelarBloque as="p" indice={2} preview={preview} className="text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))] mb-8 leading-relaxed"><CampoEditable campo="subscriptionCTA.subtitulo" multilinea>{subscriptionCTA.subtitulo}</CampoEditable></RevelarBloque>
              <RevelarBloque indice={3} preview={preview} className="space-y-3 mb-8">
                {beneficios.map((b) => (
                  <div key={b.slot} className="flex items-center gap-3 text-sm text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--sf-tostado)]" />
                    <CampoEditable campo={`subscriptionCTA.bullet${b.slot}`}>{b.valor}</CampoEditable>
                  </div>
                ))}
              </RevelarBloque>
              <RevelarBloque indice={4} preview={preview}>
                <Link href="/suscripciones" className="inline-flex items-center gap-2 bg-[var(--sf-accion,var(--sf-tostado))] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] text-[var(--sf-accion-txt,var(--sf-tinta))] font-semibold px-8 py-4 sf-pildora text-sm transition-all hover:-translate-y-0.5">
                  <CampoEditable campo="subscriptionCTA.ctaLabel">{subscriptionCTA.ctaLabel}</CampoEditable> <ArrowRight className="w-4 h-4" />
                </Link>
              </RevelarBloque>
            </div>
            <RevelarBloque
              indice={5}
              preview={preview}
              className={`grid grid-cols-1 ${gridColsTeaser(planesTeaser.length)} gap-4`}
            >
              {planesTeaser.map(p => (
                /* El color de texto va POR RAMA: sobre el acento (el plan DESTACADO, que el cliente
                   puede elegir claro) usa `acento-txt` (auto-flip); sobre acento-2 (derivado OSCURO)
                   el blanco es correcto para cualquier acento. La descripción hereda el color de la
                   tarjeta con `opacity-70` (antes `text-white/70`, que fijaba blanco).
                   EL NOMBRE DEL PLAN (§ TEMAS-P6-FAMILIAS-2) leía `--sf-tostado` fijo, sin piso
                   contra NINGUNA de las dos superficies —3,135:1 sobre `acento`, 1,378:1 sobre
                   `acento-2`, medido en VETA—. `sobre-acento`/`sobre-acento-2` GANAN PISO contra
                   la superficie que cada rama realmente pinta, con fallback a `--sf-tostado`
                   (Nayoli, sin raíces custom, sigue viendo el tostado de hoy). */
                <div key={p.slot} className={`rounded-2xl p-5 ${p.destacado ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : 'bg-[var(--sf-acento-2)] text-white'}`}>
                  <p className={`text-xs font-medium mb-2 ${p.destacado ? 'text-[var(--sf-sobre-acento,var(--sf-tostado))]' : 'text-[var(--sf-sobre-acento-2,var(--sf-tostado))]'}`}>{p.nombre}</p>
                  <p className="opacity-70 text-xs leading-snug">{p.descripcion}</p>
                </div>
              ))}
            </RevelarBloque>
          </div>
        </div>
      </section>
  )
}
