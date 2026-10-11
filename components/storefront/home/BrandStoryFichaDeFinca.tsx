"use client";

import { useId } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import {
  filasFicha, franjaAltitud, puntoFinca, rotuloSuperior, pieSvgIlustracion,
  FICHA_VIEWBOX_W, FICHA_VIEWBOX_H,
} from "@/lib/storefront/historia-ficha";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";

// LA VARIANTE «FICHA DE FINCA» (§ HISTORIA-FICHA-DE-FINCA-1, MAQUETA APROBADA en
// `.scratch/nayoli-historia/nayoli-nuestra-historia.html`, vista "A"). La sección deja de contar la
// historia y pasa a DEMOSTRARLA: titular corto + una entrada + una ficha de datos de origen, y a la
// derecha una ilustración de montañas (generada del dato) o una foto. El gate de visibilidad
// (`seccionEsVisible`) vive en el DISPATCHER (`BrandStory.tsx`), no acá — igual que
// `BrandStoryColumnas`/`BrandStoryCentrada`.
//
// TITULAR, CEJA Y ENLACE SE REUSAN tal cual (`eyebrow`/`titulo`/`ctaLabel`/`ctaDestino`) — la
// maqueta aprobada lo pide así. `parrafo1`/`parrafo2` NO se leen acá: esta composición tiene su
// propio párrafo (`entrada`), distinto del de columnas/centrada.
//
// EL LAYOUT ES UN SOLO GRID (`grid-cols-1` en angosto, la columna de texto + el medio en
// `lg:`) con PLACEMENT EXPLÍCITO por breakpoint — no un wrapper "texto" + `display:contents` como
// la maqueta HTML (ese truco es innecesario en CSS Grid: el `order` mueve los ítems en angosto y el
// `col-start`/`row-start` los ancla en escritorio, sin anidar nada). El orden ANGOSTO replica el de
// la maqueta — ceja, título, MEDIO (a sangre), entrada, ficha, enlace — distinto del de ESCRITORIO
// (texto en 5 columnas | aire | medio en 6), porque la maqueta así lo dibuja.
const FILA_STAGGER_S = 0.06; // 60 ms entre filas — § el spec, medido de la maqueta aprobada
const FILA_Y_PX = 8;         // sube 8px al entrar — § el spec

const VARIANTES_FILAS = {
  hidden: { opacity: 0 },
  visible: { transition: { staggerChildren: FILA_STAGGER_S, delayChildren: 0.1 } },
};
const VARIANTE_FILA = {
  hidden: { opacity: 0, y: FILA_Y_PX },
  visible: { opacity: 1, y: 0 },
};

export default function BrandStoryFichaDeFinca({ style }: { style?: React.CSSProperties } = {}) {
  const { brandStory, tema, paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  const ctaHref = resolverCtaSeccion(brandStory.ctaLabel, brandStory.ctaDestino, paginas);
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1), mismo criterio que las otras dos variantes.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  const filas = filasFicha(brandStory);
  const franja = franjaAltitud(brandStory.altitudMin, brandStory.altitudMax, brandStory.altitudUnidad);
  const punto = puntoFinca(franja);
  const rotuloSup = rotuloSuperior(brandStory.lugar);
  const pieSvg = pieSvgIlustracion(brandStory.pieIlustracion);
  const esFoto = brandStory.medio === 'foto';

  // `id` ÚNICO para el gradiente de la franja — un `url(#g-banda)` fijo chocaría si esta composición
  // llegara a montarse dos veces en la misma página (hoy no ocurre; es la guarda barata).
  const idGradiente = `ficha-finca-banda-${useId()}`;

  // MISMO switch `preview` que el resto de la home (§ RevelarBloque, § BrandStoryCentrada): en la
  // vista previa escalada del editor `whileInView` nunca dispara, así que se usa `animate` con
  // `initial={false}` — el estado visible desde el primer render.
  const inicialMovimiento = preview ? false : 'hidden';
  const animarMovimiento = preview ? 'visible' : undefined;
  const whileInViewMovimiento = preview ? undefined : 'visible';
  const viewportMovimiento = preview ? undefined : { once: true as const };

  const ariaLabelIlustracion = rotuloSup
    ? (franja ? `Ilustración de ${brandStory.lugar.trim()}, con la franja entre ${franja.etiquetaMin} y ${franja.etiquetaMax}` : `Ilustración de ${brandStory.lugar.trim()}`)
    : 'Ilustración de las montañas de la finca';

  return (
    <section id="nuestra-historia" className="bg-[var(--sf-banda,var(--sf-tinta))] py-24" style={style}>
      <div className={`${contenedorClase} mx-auto grid grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(32px,1fr)_minmax(0,6fr)] lg:items-start lg:gap-y-0`}>
        {brandStory.eyebrow && (
          <RevelarBloque
            as="p" indice={0} preview={preview}
            className="order-1 text-xs font-medium tracking-[0.2em] uppercase text-[var(--sf-sobre-banda,var(--sf-tostado))] lg:order-none lg:col-start-1 lg:row-start-1"
          >
            <CampoEditable campo="brandStory.eyebrow">{brandStory.eyebrow}</CampoEditable>
          </RevelarBloque>
        )}

        <RevelarBloque
          as="h2" indice={1} preview={preview}
          className="order-2 font-playfair text-4xl leading-tight text-[var(--sf-sobre-banda,white)] sm:text-5xl lg:order-none lg:col-start-1 lg:row-start-2 lg:mt-4"
          style={displayL ? { fontSize: displayL } : undefined}
        >
          <CampoEditable campo="brandStory.titulo">{brandStory.titulo}</CampoEditable>
        </RevelarBloque>

        {/* EL MEDIO — ilustración o foto, 4:5. "A sangre" sólo en angosto (fuera del padding del
            contenedor); en escritorio vive en su propia columna, sin bleed. */}
        <RevelarBloque
          as="div" indice={4} preview={preview}
          className="order-3 -mx-4 sm:-mx-6 lg:order-none lg:col-start-3 lg:row-start-1 lg:row-span-5 lg:mx-0"
        >
          <figure className="m-0">
            <div className="relative aspect-[4/5] overflow-hidden bg-[var(--sf-tinta)]">
              {esFoto ? (
                // «Foto»: reusa `imagen1` (ya requerida para columnas/centrada) — SIN `sf-radio-imagen`
                // a propósito (§ el spec: "sin radio").
                <CampoEditable campo="brandStory.imagen1" tipo="imagen">
                  <Image
                    src={brandStory.imagen1}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-cover"
                  />
                </CampoEditable>
              ) : (
                <motion.svg
                  viewBox={`0 0 ${FICHA_VIEWBOX_W} ${FICHA_VIEWBOX_H}`}
                  className="h-full w-full"
                  role="img"
                  aria-label={ariaLabelIlustracion}
                  initial={inicialMovimiento}
                  animate={animarMovimiento}
                  whileInView={whileInViewMovimiento}
                  viewport={viewportMovimiento}
                >
                  {franja && (
                    <defs>
                      <linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor="var(--sf-acento,var(--sf-tostado))" stopOpacity=".16" />
                        <stop offset="1" stopColor="var(--sf-acento,var(--sf-tostado))" stopOpacity=".07" />
                      </linearGradient>
                    </defs>
                  )}

                  {/* El marco doble fino. */}
                  <rect x=".5" y=".5" width={FICHA_VIEWBOX_W - 1} height={FICHA_VIEWBOX_H - 1} fill="none" stroke="var(--sf-acento,var(--sf-tostado))" strokeOpacity=".35" />
                  <rect x="10.5" y="10.5" width={FICHA_VIEWBOX_W - 21} height={FICHA_VIEWBOX_H - 21} fill="none" stroke="var(--sf-acento,var(--sf-tostado))" strokeOpacity=".18" />

                  {rotuloSup && (
                    <text x={FICHA_VIEWBOX_W / 2} y="62" textAnchor="middle" className="uppercase" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.32em', fill: 'var(--sf-acento,var(--sf-tostado))' }}>
                      {rotuloSup}
                    </text>
                  )}

                  {franja && (
                    <>
                      <motion.rect
                        x="40" y={franja.yTop} width="460" height={franja.yBottom - franja.yTop}
                        fill={`url(#${idGradiente})`}
                        style={{ transformOrigin: `270px ${franja.yBottom}px` }}
                        variants={{ hidden: { scaleY: 0 }, visible: { scaleY: 1 } }}
                        transition={{ duration: 0.9, ease: [0.3, 0.6, 0.2, 1], delay: 0.5 }}
                      />
                      <g stroke="var(--sf-acento,var(--sf-tostado))" strokeOpacity=".55" strokeDasharray="2 6">
                        <line x1="40" x2="500" y1={franja.yTop} y2={franja.yTop} />
                        <line x1="40" x2="500" y1={franja.yBottom} y2={franja.yBottom} />
                      </g>
                      <text x="496" y={franja.yTop - 8} textAnchor="end" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', fill: 'var(--sf-acento,var(--sf-tostado))' }}>
                        {franja.etiquetaMax}
                      </text>
                      <text x="496" y={franja.yBottom + 16} textAnchor="end" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', fill: 'var(--sf-acento,var(--sf-tostado))' }}>
                        {franja.etiquetaMin}
                      </text>
                    </>
                  )}

                  {/* Las TRES crestas — decorativas, fijas, con opacidad decreciente hacia el fondo. */}
                  <g fill="none" stroke="var(--sf-acento,var(--sf-tostado))" strokeWidth="1.6" strokeLinecap="round">
                    <motion.path
                      d="M30 470 C 80 430, 110 360, 160 330 S 230 200, 290 160 S 360 250, 400 270 S 470 230, 510 250"
                      variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                      transition={{ duration: 1.4, ease: [0.3, 0.6, 0.2, 1] }}
                    />
                    <motion.path
                      d="M30 520 C 90 500, 130 440, 190 420 S 260 330, 320 340 S 410 400, 450 380 S 500 360, 510 368"
                      strokeOpacity=".6"
                      variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                      transition={{ duration: 1.4, ease: [0.3, 0.6, 0.2, 1], delay: 0.15 }}
                    />
                    <motion.path
                      d="M30 575 C 110 560, 170 520, 230 512 S 330 470, 380 488 S 470 520, 510 510"
                      strokeOpacity=".35"
                      variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                      transition={{ duration: 1.4, ease: [0.3, 0.6, 0.2, 1], delay: 0.3 }}
                    />
                  </g>

                  {/* El punto de la finca — dentro de la franja, o en la cresta sin rango. */}
                  <motion.g
                    variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                    transition={{ duration: 0.5, delay: 1.2 }}
                  >
                    <g transform={`translate(${punto.x} ${punto.y})`}>
                      <circle r="16" fill="var(--sf-tinta)" stroke="var(--sf-acento,var(--sf-tostado))" />
                      <text y="6" textAnchor="middle" style={{ fontSize: 16, fill: 'var(--sf-acento,var(--sf-tostado))' }}>✦</text>
                    </g>
                    {brandStory.nombrePunto && (
                      <text x={punto.x + 26} y={punto.y - 8} style={{ fontFamily: 'var(--f-d, "Playfair Display", serif)', fontSize: 22, fill: 'var(--sf-sobre-banda,white)' }}>
                        <CampoEditable campo="brandStory.nombrePunto">{brandStory.nombrePunto}</CampoEditable>
                      </text>
                    )}
                    {brandStory.subLineaPunto && (
                      <text x={punto.x + 26} y={punto.y + 12} style={{ fontSize: 12, fill: 'var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))' }}>
                        <CampoEditable campo="brandStory.subLineaPunto">{brandStory.subLineaPunto}</CampoEditable>
                      </text>
                    )}
                  </motion.g>

                  {pieSvg && (
                    <>
                      <line x1="150" x2="390" y1="620" y2="620" stroke="var(--sf-acento,var(--sf-tostado))" strokeOpacity=".4" />
                      <text x={FICHA_VIEWBOX_W / 2} y="648" textAnchor="middle" className="uppercase" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.2em', fill: 'var(--sf-acento,var(--sf-tostado))' }}>
                        {pieSvg}
                      </text>
                    </>
                  )}
                </motion.svg>
              )}
            </div>
            {brandStory.pieMedio && (
              <figcaption className="mt-3 text-sm text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))]">
                <CampoEditable campo="brandStory.pieMedio">{brandStory.pieMedio}</CampoEditable>
              </figcaption>
            )}
          </figure>
        </RevelarBloque>

        {brandStory.entrada && (
          <RevelarBloque
            as="p" indice={2} preview={preview}
            className="order-4 text-lg leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))] lg:order-none lg:col-start-1 lg:row-start-3 lg:mt-6 lg:max-w-md"
          >
            <CampoEditable campo="brandStory.entrada" multilinea>{brandStory.entrada}</CampoEditable>
          </RevelarBloque>
        )}

        {filas.length > 0 && (
          <motion.dl
            className="order-5 mt-8 border-t border-[var(--sf-sobre-banda,white)]/10 lg:order-none lg:col-start-1 lg:row-start-4 lg:mt-8"
            initial={inicialMovimiento}
            animate={animarMovimiento}
            whileInView={whileInViewMovimiento}
            viewport={viewportMovimiento}
            variants={VARIANTES_FILAS}
          >
            {filas.map((fila, i) => (
              <motion.div
                key={i}
                variants={VARIANTE_FILA}
                transition={{ duration: 0.4 }}
                className="grid min-h-[56px] grid-cols-[minmax(0,9em)_minmax(0,1fr)] items-center gap-4 border-b border-[var(--sf-sobre-banda,white)]/10 py-2.5"
              >
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sf-sobre-banda,var(--sf-tostado))]">
                  {fila.rotulo}
                </dt>
                <dd className="font-playfair text-xl text-[var(--sf-sobre-banda,white)]" style={{ fontVariantNumeric: 'lining-nums' }}>
                  {fila.valor}
                  {fila.subLinea && (
                    <small className="mt-0.5 block font-sans text-sm font-normal text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_55%,transparent))]">
                      {fila.subLinea}
                    </small>
                  )}
                </dd>
              </motion.div>
            ))}
          </motion.dl>
        )}

        {ctaHref && (
          <RevelarBloque
            as="div" indice={3} preview={preview}
            className="order-6 mt-7 lg:order-none lg:col-start-1 lg:row-start-5"
          >
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--sf-sobre-banda,var(--sf-tostado))] underline decoration-[color-mix(in_oklab,var(--sf-tostado)_45%,transparent)] underline-offset-4 hover:decoration-[var(--sf-tostado)]"
            >
              <CampoEditable campo="brandStory.ctaLabel">{brandStory.ctaLabel}</CampoEditable>
              <span aria-hidden="true">→</span>
            </Link>
          </RevelarBloque>
        )}
      </div>
    </section>
  );
}
