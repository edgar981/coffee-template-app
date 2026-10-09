"use client";

import Link from "next/link";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaTextoContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "TEXTO" del catálogo curado de instancias (§ SECCIONES-INSTANCIAS-1) — un bloque de
// puro texto (antetítulo opcional + título + texto opcional + un CTA opcional), alineado a la
// izquierda/centro/derecha. Es el tipo más simple de los tres: ni imagen, ni foto de fondo.
//
// MISMOS TOKENS QUE CUALQUIER OTRA BANDA: `--sf-banda`/`--sf-sobre-banda(-suave)` con sus
// fallbacks de siempre (fondo/tinta de página), para que un esquema asignado vía `content.esquemas`
// (la MISMA clave key-agnóstica que ya usan las bandas, pasada por `page.tsx` como `style`) tiña
// esta instancia exactamente igual que a cualquier banda. `sf-pildora`/`--sf-accion*` son el MISMO
// botón que `BrandStoryCentrada`/`presentaciones` (ningún token nuevo).

const ALINEACION_CLASE: Record<string, string> = {
  izquierda: "text-left items-start",
  centro: "text-center items-center",
  derecha: "text-right items-end",
};

// § MOVIMIENTO-NIVEL-EDITORIAL-1 — S01 ("capítulos de color") es la ÚNICA excepción de "texto": el
// MISMO campo `animacion` que elige T01-T06 para el TÍTULO puede valer 'S01', y ahí cambia de nodo
// envuelto — la SECCIÓN entera, no el título (S01 tiñe el FONDO, § `animaciones.ts`, `s01`). Ver el
// docstring de `InstanciaDescriptor.animacionElemento` (secciones-instancias.ts) para el porqué de
// que "texto" sea el único tipo que ofrece una animación `aplicaA:'seccion'` en su selector.
const ES_CAPITULO = (animacion: string) => animacion === 'S01';

export default function SeccionTexto({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaTextoContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const ctaHref = resolverCtaSeccion(instancia.ctaLabel, instancia.ctaDestino, paginas);
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const alineacionClase = ALINEACION_CLASE[instancia.alineacion] ?? ALINEACION_CLASE.centro;
  // Con S01, el TÍTULO renderiza por `RevelarBloque` normal (como «Ninguna») — la animación de esta
  // instancia la lleva la SECCIÓN entera (el fondo), nunca las dos a la vez sobre el mismo campo.
  const esCapitulo = ES_CAPITULO(instancia.animacion);
  const animacionTitulo = esCapitulo ? '' : instancia.animacion;

  const contenido = (
    <div className={`${contenedorClase} mx-auto`}>
      <div className={`mx-auto flex max-w-3xl flex-col gap-4 ${alineacionClase}`}>
        {instancia.antetitulo && (
          <RevelarBloque as="p" indice={0} preview={preview} className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-acento-texto))]">
            <CampoEditable campo={`${id}.antetitulo`}>{instancia.antetitulo}</CampoEditable>
          </RevelarBloque>
        )}
        {animacionTitulo ? (
          // § MOVIMIENTO-EDITOR-EXPOSICION-1 — «texto → título». Con una animación elegida, el
          // título corre por GSAP (`Movimiento`) en vez de por `RevelarBloque` (framer-motion):
          // "un mismo elemento nunca lleva las dos" (§ DUNA-MOVIMIENTO.md). Con «Ninguna» (el
          // default de hoy) este branch nunca se toma — byte-idéntico a antes de este slice.
          <Movimiento id={animacionTitulo} as="h2" className="font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl">
            <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
          </Movimiento>
        ) : (
          <RevelarBloque as="h2" indice={instancia.antetitulo ? 1 : 0} preview={preview} className="font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl">
            <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
          </RevelarBloque>
        )}
        {instancia.texto && (
          <RevelarBloque as="p" indice={instancia.antetitulo ? 2 : 1} preview={preview} className="text-base leading-relaxed text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
            <CampoEditable campo={`${id}.texto`} multilinea>{instancia.texto}</CampoEditable>
          </RevelarBloque>
        )}
        {ctaHref && (
          <RevelarBloque indice={3} preview={preview} className="mt-2">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))]"
            >
              <CampoEditable campo={`${id}.ctaLabel`}>{instancia.ctaLabel}</CampoEditable>
            </Link>
          </RevelarBloque>
        )}
      </div>
    </div>
  );

  // § MOVIMIENTO-NIVEL-EDITORIAL-1 — S01 envuelve la SECCIÓN con `<Movimiento as="section">` en vez
  // de la `<section>` plana de siempre: con «Ninguna» (y con T01-T06) este branch nunca se toma —
  // byte-idéntico a antes de este slice.
  if (esCapitulo) {
    return (
      <Movimiento id="S01" as="section" className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
        {contenido}
      </Movimiento>
    );
  }
  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      {contenido}
    </section>
  );
}
