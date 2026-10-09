"use client";

import { useRef } from "react";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import Movimiento, { type MovimientoHandle } from "@/components/storefront/movimiento/Movimiento";
import VerAnimacionHero from "@/components/storefront/movimiento/VerAnimacionHero";
import HeroFirmaContenido from "@/components/storefront/home/HeroFirmaContenido";
import { claseAlturaHero } from "@/lib/config/site-content-defaults";

// H02 "LA CEREZA SE EXPANDE" (§ MOVIMIENTO-NIVEL-FIRMA-1) — composición `hero.variante:'cereza'`.
// El motor (`h02`, `animaciones.ts`) pinea esta sección: el bloque de texto se desvanece al iniciar
// el scroll mientras una cereza se acerca y crece hasta cubrir la pantalla — "transición al resto de
// la página" (§ catalogo.ts) de forma LITERAL: al soltar el pin, el visitante sigue a la SECCIÓN
// SIGUIENTE, sin un panel inventado dentro de ésta (simplificación deliberada frente al prototipo,
// que sí dibuja un panel "Nuestra finca" — acá reusa sólo las zonas que el spec pide: titular/
// subtítulo/botones, § el mismo criterio que ya simplificó S01/S02/S03 frente a su prototipo,
// documentado en DUNA-MOVIMIENTO.md).
//
// ESTADO DE REPOSO = el PRIMER frame (cereza chica, centrada; título visible) — es la CSS por
// defecto, sin que el motor necesite tocar nada más que el color del fruto.
export default function HeroCereza({ style }: { style?: React.CSSProperties } = {}) {
  const { hero } = useSiteContent();
  const activoEditor = useModoEditorActivo();
  const ref = useRef<MovimientoHandle>(null);
  const alturaClase = claseAlturaHero(hero.alto, false);

  return (
    <Movimiento
      ref={ref}
      id="H02"
      as="section"
      className={`relative flex ${alturaClase} items-center justify-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]`}
      style={style}
    >
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
        <g data-h02-cereza transform="translate(720 450)">
          <path d="M0 -70 C10 -120 50 -150 90 -160" fill="none" stroke="var(--sf-tostado)" strokeWidth="7" strokeLinecap="round" />
          <path d="M60 -150 C110 -190 170 -170 180 -130 C130 -120 90 -130 60 -150 Z" fill="var(--sf-tostado)" />
          <circle data-h02-fruto r="80" fill="var(--sf-cereza,#b3261e)" />
          <ellipse cx="-26" cy="-28" rx="18" ry="12" fill="var(--sf-fondo)" opacity=".28" />
        </g>
      </svg>

      <div data-h02-titulo className="relative z-10">
        <HeroFirmaContenido />
      </div>

      {activoEditor && <VerAnimacionHero onClick={() => ref.current?.reproducir()} />}
    </Movimiento>
  );
}
