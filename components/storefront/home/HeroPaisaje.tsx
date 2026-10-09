"use client";

import { useEffect, useRef } from "react";
import { preload } from "react-dom";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import CampoEditable from "@/components/storefront/CampoEditable";
import Movimiento, { type MovimientoHandle } from "@/components/storefront/movimiento/Movimiento";
import VerAnimacionHero from "@/components/storefront/movimiento/VerAnimacionHero";
import HeroFirmaContenido from "@/components/storefront/home/HeroFirmaContenido";
import { claseAlturaHero } from "@/lib/config/site-content-defaults";

// LAS CUATRO CAPAS de la ilustración de montañas (sin media de fondo) — EXACTO al prototipo
// (`docs/movimiento/catalogo-movimiento.html`, `#h03 .capa-p`): cada una traduce `data-v*260px` al
// scrollear (§ `h03`, animaciones.ts). Colores DERIVADOS de la paleta, no los hex fijos del
// prototipo (que asumía un tema propio) — tonos medios/oscuros de la raíz acento/tinta.
const CAPAS_ILUSTRADAS = [
  { v: 0.15, color: 'var(--sf-tostado)', d: 'M0 520 L180 380 L360 470 L560 300 L760 450 L980 330 L1200 440 L1440 340 L1440 900 L0 900Z' },
  { v: 0.35, color: 'var(--sf-acento,var(--sf-tostado))', d: 'M0 600 L220 480 L420 560 L640 440 L900 560 L1120 470 L1440 560 L1440 900 L0 900Z' },
  { v: 0.6, color: 'color-mix(in oklab, var(--sf-acento,var(--sf-tostado)) 70%, var(--sf-tinta))', d: 'M0 700 Q200 620 420 680 T860 670 T1440 650 L1440 900 L0 900Z' },
  { v: 0.95, color: 'var(--sf-tinta)', d: 'M0 820 Q240 760 520 800 T1080 790 T1440 780 L1440 900 L0 900Z' },
];

// H03 "PAISAJE EN CAPAS" (§ MOVIMIENTO-NIVEL-FIRMA-1) — composición `hero.variante:'paisaje'`. CON
// foto/video de fondo (`hero.imagen`, el MISMO campo compartido que Cortina/Portada): el motor
// (`h03`, animaciones.ts) aplica un parallax de UNA capa sobre la media real — `[data-h03-capa]`
// con `data-h03-capa="0.2"`, una velocidad baja (no se quiere que la foto "viaje" demasiado). SIN
// media: cae a la ILUSTRACIÓN de montañas por capas del prototipo, con CUATRO capas a velocidades
// distintas. En los dos casos el título se atenúa y sube al scrollear (`[data-h03-titulo]`).
export default function HeroPaisaje({ style }: { style?: React.CSSProperties } = {}) {
  const { hero } = useSiteContent();
  const preview = useIsPreview();
  const activoEditor = useModoEditorActivo();
  const ref = useRef<MovimientoHandle>(null);
  const alturaClase = claseAlturaHero(hero.alto, false);

  const tieneMedia = !!hero.imagen;
  const esVideo = tieneMedia && hero.imagenTipo === 'video';
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const reproducir = esVideo && !preview && !reduce;

  if (esVideo && hero.imagenPoster) {
    preload(hero.imagenPoster, { as: "image", fetchPriority: "high" });
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reproducir) v.play().catch(() => {});
    else v.pause();
  }, [reproducir]);

  return (
    <Movimiento
      ref={ref}
      id="H03"
      as="section"
      className={`relative flex ${alturaClase} items-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]`}
      style={style}
    >
      <div className="absolute inset-0">
        {tieneMedia ? (
          <div data-h03-capa="0.2" className="absolute inset-0">
            <CampoEditable campo="hero.imagen" tipo="imagen">
              {esVideo ? (
                <video
                  ref={videoRef}
                  src={hero.imagen}
                  poster={hero.imagenPoster || undefined}
                  muted
                  loop
                  playsInline
                  preload={reproducir ? 'auto' : 'none'}
                  controls={!!reduce && !preview}
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image src={hero.imagen} alt="" fill priority sizes="100vw" quality={85} className="object-cover" />
              )}
            </CampoEditable>
          </div>
        ) : (
          <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <rect width="1440" height="900" fill="var(--sf-fondo)" />
            {CAPAS_ILUSTRADAS.map((capa) => (
              <path key={capa.v} data-h03-capa={capa.v} d={capa.d} fill={capa.color} />
            ))}
          </svg>
        )}
        <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/40 via-transparent to-[var(--sf-tinta)]/70 pointer-events-none" />
      </div>

      <div data-h03-titulo className="relative z-10 w-full text-center">
        <HeroFirmaContenido />
      </div>

      {activoEditor && <VerAnimacionHero onClick={() => ref.current?.reproducir()} />}
    </Movimiento>
  );
}
