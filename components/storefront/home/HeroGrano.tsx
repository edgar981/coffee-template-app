"use client";

import { useRef } from "react";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import Movimiento, { type MovimientoHandle } from "@/components/storefront/movimiento/Movimiento";
import VerAnimacionHero from "@/components/storefront/movimiento/VerAnimacionHero";
import HeroFirmaContenido from "@/components/storefront/home/HeroFirmaContenido";
import { claseAlturaHero } from "@/lib/config/site-content-defaults";

// H01 "EL GRANO CAE EN LA TAZA" (§ MOVIMIENTO-NIVEL-FIRMA-1) — composición `hero.variante:'grano'`.
// El motor (`h01`, `components/storefront/movimiento/animaciones.ts`) pinea esta sección y hace caer
// un grano que tuesta (de `--sf-acento` a `--sf-tinta`) hasta fundirse en la taza, con un repique en
// la superficie. Usa las MISMAS zonas de texto que Cortina (eyebrow/titular/subtítulo/botones, § su
// extracción a `HeroFirmaContenido.tsx`) — ilustración pura, sin `hero.imagen`.
//
// ESTADO DE REPOSO (sin motor: editor/preview/reduced-motion) = el grano YA fundido —invisible, el
// repique ya asentado— porque es el que se ve bien como hero ESTÁTICO; de ahí los `opacity-0`/
// `opacity="0"` de abajo. El motor es lo único que saca al grano de ese reposo (el PRIMER
// `gsap.set` de `h01()` lo hace visible y lo posiciona arriba antes de dejarlo caer).
export default function HeroGrano({ style }: { style?: React.CSSProperties } = {}) {
  const { hero } = useSiteContent();
  const activoEditor = useModoEditorActivo();
  const ref = useRef<MovimientoHandle>(null);
  const alturaClase = claseAlturaHero(hero.alto, false);

  return (
    <Movimiento
      ref={ref}
      id="H01"
      as="section"
      className={`relative flex ${alturaClase} items-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]`}
      style={style}
    >
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id="h01-boca">
            <ellipse cx="1040" cy="644" rx="146" ry="30" />
          </clipPath>
        </defs>
        <g>
          <path d="M880 640 Q880 820 1040 840 Q1200 820 1200 640 Z" fill="var(--sf-fondo)" stroke="var(--sf-tinta)" strokeWidth="3" />
          <path d="M1200 680 q70 0 70 50 q0 50 -76 54" fill="none" stroke="var(--sf-tinta)" strokeWidth="3" />
          <ellipse cx="1040" cy="640" rx="160" ry="38" fill="var(--sf-fondo)" stroke="var(--sf-tinta)" strokeWidth="3" />
          <ellipse cx="1040" cy="644" rx="146" ry="30" fill="var(--sf-tinta)" />
          <g clipPath="url(#h01-boca)">
            <ellipse data-h01-onda1 cx="1040" cy="644" rx="10" ry="3" fill="none" stroke="var(--sf-tostado)" strokeWidth="3" opacity="0" />
            <ellipse data-h01-onda2 cx="1040" cy="644" rx="10" ry="3" fill="none" stroke="var(--sf-tostado)" strokeWidth="2" opacity="0" />
          </g>
          <ellipse cx="1040" cy="860" rx="210" ry="18" fill="var(--sf-tinta)" opacity=".15" />
        </g>
        <g data-h01-grano transform="translate(1040 120)" className="opacity-0">
          <ellipse data-h01-grano-cuerpo rx="34" ry="46" fill="var(--sf-acento,var(--sf-tostado))" stroke="var(--sf-fondo)" strokeWidth="2.5" />
          <path d="M0 -40 C-12 -14 12 14 0 40" fill="none" stroke="var(--sf-fondo)" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      <div data-h01-titulo>
        <HeroFirmaContenido />
      </div>

      {activoEditor && <VerAnimacionHero onClick={() => ref.current?.reproducir()} />}
    </Movimiento>
  );
}
