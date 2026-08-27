"use client";

import { useEffect, useRef, useState } from "react";

// ─── La DUNA con el SOL — identidad de la puerta, no un gráfico ───────────────
//
// La marca contando su metáfora: una duna con un sol que la recorre lentamente.
// Distinta de las curvas del panel —allí la curva es DATO (`pathDe` deriva su
// trazo de los buckets); acá NO hay datos, así que la curva es FIJA y dibujada a
// mano—. Reusar la de datos obligaría a inventarlos. Se parece a las del panel a
// propósito (mismo lenguaje: línea de tinta + lavado de sol), pero es IDENTIDAD.
//
// EL SOL RECORRE LA CRESTA con `<animateMotion>` + `<mpath>` sobre `<circle>` —SVG
// nativo, sin `offset-path` ni depender de la caja CSS—. Corre fuera del hilo
// principal, así que NO compite con quien teclea su contraseña; y sólo repinta la
// caja diminuta del sol. SIN pulso: en el panel el pulso significa "ahora", y acá
// no hay un ahora que marcar —sería decoración, que la doctrina prohíbe—; la
// identidad la lleva el desplazamiento.
//
// Decorativa: `aria-hidden` y `pointer-events:none` — no se anuncia ni intercepta
// clics sobre la card.

const DUR = 180; // 3 min de travesía — lento de verdad.

// La cresta (para el trazo Y el `mpath` del sol). Endpoints INSET (x 40..1400 en un
// viewBox de 1440): el sol nunca llega a los bordes del SVG. Tres crestas suaves.
const D_CRESTA = "M 40 150 C 260 110, 420 114, 600 148 S 940 194, 1120 152 S 1340 106, 1400 140";
// El relleno: la misma cresta extendida a los bordes (planitos) y cerrada al piso.
const D_RELLENO = "M 0 150 L 40 150 C 260 110, 420 114, 600 148 S 940 194, 1120 152 S 1340 106, 1400 140 L 1440 140 L 1440 220 L 0 220 Z";

export function DunaPie() {
  const crestaRef = useRef<SVGPathElement>(null);
  // El sol se resuelve en el CLIENTE (posición aleatoria) para no arrastrar un
  // valor del servidor —hydration mismatch—. Hasta entonces no se dibuja.
  const [sol, setSol] = useState<{ begin: string } | { cx: number; cy: number } | null>(null);

  useEffect(() => {
    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Fracción ACOTADA [0.12, 0.88]: nunca arranca en un borde (medio sol cortado
    // se lee como error). El inset de la cresta ya lo mantiene visible en toda la
    // travesía; esto además evita que ASOME en un extremo.
    const f = 0.12 + Math.random() * 0.76;
    if (reducir) {
      const p = crestaRef.current;
      if (p) {
        const pt = p.getPointAtLength(f * p.getTotalLength());
        setSol({ cx: pt.x, cy: pt.y });
      }
    } else {
      // `begin` NEGATIVO = arranca a mitad de ciclo, en un punto aleatorio.
      setSol({ begin: `-${(f * DUR).toFixed(1)}s` });
    }
  }, []);

  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 220"
      // `width:100%` + `height:auto` → el alto sigue al ancho por la proporción del
      // viewBox: la duna ENTERA se ve a cualquier ancho (sin recorte), el sol queda
      // CIRCULAR (escala uniforme) y NUNCA se corta, y cruza toda la pantalla. En
      // móvil la banda es proporcionalmente más baja —sutil, no menos—.
      style={{ height: "auto" }}
      className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
    >
      <defs>
        <linearGradient id="dunaSolFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--duna-sol)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--duna-sol)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Lavado de sol bajo la cresta (firma de marca, como el área del panel). */}
      <path d={D_RELLENO} fill="url(#dunaSolFill)" />

      {/* La cresta, en tinta a .5 — el mismo trazo de las curvas del panel. */}
      <path
        ref={crestaRef}
        id="duna-cresta"
        d={D_CRESTA}
        fill="none"
        stroke="var(--duna-ink)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* El sol. Recorre la cresta (animado) o queda quieto en su punto (reduced-
          motion). No se dibuja hasta que el cliente fija su posición aleatoria. */}
      {sol && "begin" in sol ? (
        <circle r="11" fill="var(--duna-sol)">
          <animateMotion dur={`${DUR}s`} repeatCount="indefinite" begin={sol.begin}>
            <mpath href="#duna-cresta" />
          </animateMotion>
        </circle>
      ) : sol ? (
        <circle r="11" fill="var(--duna-sol)" cx={sol.cx} cy={sol.cy} />
      ) : null}
    </svg>
  );
}
