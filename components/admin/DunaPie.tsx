"use client";

import { useEffect, useRef, useState } from "react";

// ─── La DUNA con el SOL — identidad de la puerta, no un gráfico ───────────────
//
// La marca contando su metáfora: una duna con un sol que la CRUZA, se pone por un
// borde y sale por el otro. Distinta de las curvas del panel —allí la curva es
// DATO (`pathDe` deriva su trazo de los buckets); acá NO hay datos, así que la
// curva es FIJA y dibujada a mano—. Se parece a las del panel a propósito (línea
// de tinta + lavado de sol), pero es IDENTIDAD.
//
// LA CRESTA SALE DE LA PANTALLA por los dos lados: el path arranca antes de x=0 y
// termina después de x=1440 (el viewBox recorta lo de afuera), así que la línea
// cruza ENTERA, sin planos ni cortes en los extremos.
//
// EL SOL RECORRE LA CRESTA con `<animateMotion>` + `<mpath>` sobre `<circle>` —SVG
// nativo, sin offset-path—. Cruza en UN sentido y el salto del loop (fin→inicio
// del path) cae en las COLAS invisibles: el sol se pone por un borde y sale por el
// otro, sin teletransporte visible. Un sol que se va y vuelve NO se lee como el
// paso del tiempo (eso sería ping-pong); el rato fuera de pantalla es lo que hace
// un sol. Corre fuera del hilo principal (no compite con quien teclea) y sólo
// repinta la caja del sol. SIN pulso: acá no hay un "ahora" que marcar.
//
// "A VECES NO SE VE EL SOL" ES DISEÑADO, NO UN BUG. Las colas son ~18% del path
// (160px de cada lado sobre ~1760), así que el sol pasa **~40 s FUERA DE PANTALLA
// de cada ~220 s** del ciclo (se pone y vuelve a salir). Eso NO contradice que "al
// cargar SIEMPRE hay sol": el ARRANQUE aleatorio se acota a la parte visible
// (abajo, `lInicio`), así que la primera impresión lo tiene; lo que se va y vuelve
// es el recorrido, no el arranque. Si esos ~40 s se sienten largos, se afina la
// LONGITUD de las colas (colas más cortas → menos tiempo fuera), no es un defecto.
//
// Decorativa: `aria-hidden` y `pointer-events:none`.

// Cuánto tarda el sol en cruzar el TRAMO VISIBLE. El `dur` TOTAL se deriva de esto
// (el path es más largo que lo visible por las colas), para que cruzar la pantalla
// siga tardando esto y no se acelere al alargar el path.
const CRUCE_VISIBLE_S = 180; // 3 min

// El viewBox visible es 0..1440 en x. El path se EXTIENDE a x −160..1600: las colas
// (−160..0 y 1440..1600) quedan fuera y el viewBox las recorta. Tres crestas suaves
// en la parte visible; las colas sólo continúan el trazo para que el sol entre/salga
// liso. Sirve para el trazo, el `mpath` y (cerrada al piso) el relleno.
const D_CRESTA =
  "M -160 146 C 40 120, 220 116, 400 148 C 580 180, 760 184, 940 150 C 1120 118, 1300 112, 1440 142 C 1520 156, 1560 154, 1600 150";
const D_RELLENO = `${D_CRESTA} L 1600 240 L -160 240 Z`;

const VIS_X0 = 0;
const VIS_X1 = 1440;
const MARGEN = 44; // px adentro de cada borde: el sol nunca ARRANCA medio cortado.

type SolAnimado = { dur: number; begin: string };
type SolQuieto = { cx: number; cy: number };

export function DunaPie() {
  const crestaRef = useRef<SVGPathElement>(null);
  // Se resuelve en el CLIENTE (posición/tiempo aleatorios) para no arrastrar un
  // valor del servidor —hydration mismatch—. Hasta entonces no se dibuja.
  const [sol, setSol] = useState<SolAnimado | SolQuieto | null>(null);

  useEffect(() => {
    const p = crestaRef.current;
    if (!p) return;
    const total = p.getTotalLength();

    // Longitud del path donde su x cruza `targetX`. x es MONÓTONA (cada comando
    // avanza en x), así que una búsqueda binaria por longitud es exacta.
    const lenEnX = (targetX: number) => {
      let lo = 0, hi = total;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        if (p.getPointAtLength(mid).x < targetX) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };

    // El TRAMO VISIBLE, en longitud de path; el `dur` total mantiene su cruce en
    // CRUCE_VISIBLE_S (velocidad constante — `calcMode` "paced" por defecto).
    const lVis0 = lenEnX(VIS_X0);
    const lVis1 = lenEnX(VIS_X1);
    const durTotal = (CRUCE_VISIBLE_S * total) / (lVis1 - lVis0);

    // Arranque ALEATORIO acotado a la parte visible (con margen para no asomar
    // medio cortado): la primera impresión SIEMPRE tiene sol.
    const lIni = lenEnX(VIS_X0 + MARGEN);
    const lFin = lenEnX(VIS_X1 - MARGEN);
    const lInicio = lIni + Math.random() * (lFin - lIni);

    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducir) {
      const pt = p.getPointAtLength(lInicio);
      setSol({ cx: pt.x, cy: pt.y });
    } else {
      // `begin` NEGATIVO = arranca a mitad de ciclo. Con velocidad constante, la
      // fracción de tiempo == fracción de longitud, así que este begin coloca al
      // sol justo en `lInicio` (dentro de lo visible).
      const begin = -((lInicio / total) * durTotal);
      setSol({ dur: durTotal, begin: `${begin.toFixed(1)}s` });
    }
  }, []);

  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 240"
      // `width:100%` + `height:auto`: alto proporcional al ancho; la duna cruza toda
      // la pantalla, el sol queda CIRCULAR (escala uniforme). El viewBox recorta las
      // colas del path (x<0, x>1440), así que la cresta y el sol "salen" por los bordes.
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

      {/* El sol. Cruza la cresta (animado, se pone/sale por las colas) o queda quieto
          en su punto visible (reduced-motion). No se dibuja hasta que el cliente fija
          su tiempo/posición aleatorios. */}
      {sol && "begin" in sol ? (
        <circle r="11" fill="var(--duna-sol)">
          <animateMotion dur={`${sol.dur.toFixed(1)}s`} repeatCount="indefinite" begin={sol.begin}>
            <mpath href="#duna-cresta" />
          </animateMotion>
        </circle>
      ) : sol ? (
        <circle r="11" fill="var(--duna-sol)" cx={sol.cx} cy={sol.cy} />
      ) : null}
    </svg>
  );
}
