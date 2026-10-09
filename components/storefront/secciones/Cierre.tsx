"use client";

import Link from "next/link";
import CampoEditable from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import type { InstanciaCierreContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "CIERRE" (CTA01, "Vapor que forma el llamado" — § MOVIMIENTO-NIVEL-FIRMA-1): una
// frase + un botón, con el vapor de una taza dibujándose atado al scroll; al completar el trazo, la
// frase y el botón revelan. Nace CON su animación incorporada — igual que "proceso" con S02 — así
// que no declara `animacionElemento` ni el ajuste «Animación» (§ `DESCRIPTOR_INSTANCIA.cierre`,
// secciones-instancias.ts).
//
// SIN PIN: a diferencia de S02/S03, el vapor se dibuja mientras la sección ENTRA al viewport
// (`start:'top 70%'`), nunca fija la página — mismo criterio que el prototipo.
export default function SeccionCierre({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaCierreContent;
  style?: React.CSSProperties;
}) {
  const { paginas } = useSiteContent();
  const ctaHref = resolverCtaSeccion(instancia.ctaLabel, instancia.ctaDestino, paginas);

  return (
    <Movimiento
      id="CTA01"
      as="section"
      className="relative overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] py-24"
      style={style}
    >
      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-6 px-6 text-center">
        <svg viewBox="0 0 320 200" className="h-auto w-full max-w-[220px]" aria-hidden="true">
          <path data-cta01-vapor d="M120 140 C100 110 140 90 120 60 C105 40 125 20 120 6" fill="none" stroke="var(--sf-fondo)" strokeWidth="5" strokeLinecap="round" opacity=".8" />
          <path data-cta01-vapor d="M160 140 C140 105 180 85 160 52 C145 30 168 14 160 0" fill="none" stroke="var(--sf-fondo)" strokeWidth="5" strokeLinecap="round" opacity=".8" />
          <path data-cta01-vapor d="M200 140 C180 110 220 90 200 60 C185 40 205 20 200 6" fill="none" stroke="var(--sf-fondo)" strokeWidth="5" strokeLinecap="round" opacity=".8" />
          <path d="M70 160 Q70 196 160 200 Q250 196 250 160 Z" fill="var(--sf-fondo)" />
          <ellipse cx="160" cy="160" rx="90" ry="20" fill="var(--sf-acento,var(--sf-tostado))" stroke="var(--sf-fondo)" strokeWidth="4" />
        </svg>
        <h2
          data-cta01-frase
          className="font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,white)] sm:text-4xl"
        >
          <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
        </h2>
        {/* § CTA-PRIMARIO-COLOR-Y-HOVER-1 (lib/config/cta-primario.test.ts, fuera de `touches:`):
            mismo motivo que HeroFirmaContenido.tsx — fondo/texto siguen `--sf-accion`/`-txt`, el
            hover se queda en el lift, sin sumar un consumidor nuevo al censo del hover de acción. */}
        {ctaHref && (
          <Link
            data-cta01-boton
            href={ctaHref}
            className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all hover:-translate-y-0.5"
          >
            <CampoEditable campo={`${id}.ctaLabel`}>{instancia.ctaLabel}</CampoEditable>
          </Link>
        )}
      </div>
    </Movimiento>
  );
}
