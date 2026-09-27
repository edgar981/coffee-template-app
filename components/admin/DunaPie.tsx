import type { CSSProperties } from "react";
import {
  construirHorizonte,
  rellenoBajoHorizonte,
  HORIZONTE_ANCHO,
  HORIZONTE_ALTO,
  HORIZONTE_DURACION_S,
  HORIZONTE_DIRECCION,
} from "@/lib/duna-horizonte";

// ─── El HORIZONTE ondulante — identidad de la puerta, no un gráfico ────────────
//
// PANEL-LOGIN-HORIZONTE-FAMILIA-1 (2026-09-27): las líneas ya NO se cruzan —
// comparten una sola onda y se desplazan TODAS a la MISMA velocidad y en el
// MISMO sentido (`HORIZONTE_DURACION_S`/`HORIZONTE_DIRECCION`, constantes ÚNICAS,
// no un valor por línea), así se leen como UNA superficie que se desliza, no
// como trazos independientes compitiendo entre sí. Revierte el cruce a propósito
// que introdujo PANEL-LOGIN-HORIZONTE-ONDULANTE-1 (ver DECISIONS.md, esa entrada
// y la de este slice, para el porqué). Unas van en el ÁMBAR de marca (las más al
// frente); el resto van en `--duna-ink`, que YA conmuta tinta (claro) / crema
// (oscuro) sin tocar una línea de este componente — es el mismo token que ya
// pintaba la cresta única, no uno nuevo.
//
// TODA la geometría —cuántas líneas, dónde va cada una, su opacidad— vive en
// `lib/duna-horizonte.ts`, PURA y testeada ahí (incluido el INVARIANTE de
// no-cruce). Este archivo sólo la consume y la pinta.
//
// LA ANIMACIÓN ES 100% CSS (`transform`, vía @keyframes en app/globals.css),
// NUNCA JS por cuadro. Es la MISMA restricción que obligaba al `<animateMotion>`
// del sol que este horizonte reemplaza: una pantalla donde se teclea una
// contraseña no puede competir con un bucle de `requestAnimationFrame`
// recalculando geometría SVG en cada frame. `transform` es una propiedad que el
// compositor anima en su propio hilo, sin recalcular layout ni repintar el resto
// de la página — verificado por CONSTRUCCIÓN (grep, no herramienta de perfilado:
// este componente no importa React, no tiene hooks, no tiene estado; el único
// atributo que cambia con el tiempo es `transform`, vía CSS puro) y no en vivo, ya
// que este sandbox no tiene un navegador para perfilar. El gate real de esto son
// los ojos del owner (§ el cierre del asiento).
//
// SIN HOOKS, SIN "use client": a diferencia del sol (que necesitaba `useEffect` +
// `getPointAtLength` + una posición aleatoria resuelta en el cliente, para no
// arrastrar un valor del servidor), el horizonte es DETERMINISTA — ninguna línea
// depende de `Math.random()` ni de medir el DOM — así que se computa UNA vez, al
// cargar el módulo, y se sirve igual desde el servidor o el cliente. Sigue
// pudiendo montarse dentro de un árbol `"use client"` (las cuatro pantallas
// pre-auth lo hacen, vía `PreAuthShell`) sin necesitar su propia directiva.
//
// `prefers-reduced-motion` NO necesita un guard propio acá: `app/globals.css` ya
// tiene una regla GLOBAL y sin scope (`*, *::before, *::after { animation-duration:
// 0.01ms !important; animation-iteration-count: 1 !important; }`) que congela
// CUALQUIER animación CSS del sitio, ésta incluida — las líneas quedan quietas en
// su fase base (`transform: translateX(0)`, la forma tal como `duna-horizonte.ts`
// la dibuja), visibles, sin código adicional.
//
// Decorativa: `aria-hidden` y `pointer-events:none`.

// Calculado UNA vez al cargar el módulo — determinista, sin `Math.random`, así que
// no hace falta recomputar por render ni por instancia (no hay estado del que
// depender). Ver `lib/duna-horizonte.ts` para la forma de cada línea.
const LINEAS = construirHorizonte();
const D_RELLENO = rellenoBajoHorizonte(LINEAS);

export function DunaPie() {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${HORIZONTE_ANCHO} ${HORIZONTE_ALTO}`}
      // `width:100%` + `height:auto`: alto proporcional al ancho; el horizonte cruza
      // toda la pantalla. El viewBox recorta las colas de cada línea (fuera de
      // 0..1440), igual que hacía la cresta única.
      style={{ height: "auto" }}
      className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
    >
      <defs>
        <linearGradient id="dunaSolFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--duna-sol)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--duna-sol)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Lavado de sol bajo el horizonte (firma de marca, como el área del panel).
          Apoyado en la línea más al frente — la más prominente. */}
      {D_RELLENO && <path d={D_RELLENO} fill="url(#dunaSolFill)" />}

      {LINEAS.map((linea) => (
        <path
          key={linea.indice}
          d={linea.d}
          fill="none"
          // Acento → ámbar de marca (mismo token que el sol viajero usaba).
          // Neutro → `--duna-ink`, que YA conmuta tinta/crema por tema: no hace
          // falta un token nuevo para esto (y crear uno viviría en
          // `packages/design-system/tokens/tokens.css`, fuera del alcance de
          // este slice, § DECISIONS.md).
          stroke={linea.acento ? "var(--duna-sol)" : "var(--duna-ink)"}
          strokeOpacity={linea.opacidad}
          strokeWidth={linea.acento ? 1.5 : 1.25}
          strokeLinecap="round"
          style={
            {
              animationName: "duna-horizonte-desplaza",
              // COMPARTIDOS por TODA la familia (§ arriba) -- no `linea.duracionS`/
              // `linea.direccion`: esos campos por-línea ya no existen en el tipo,
              // así que reintroducir una velocidad o un sentido distinto por línea
              // exigiría deshacer este import, no sólo cambiar un valor acá.
              animationDuration: `${HORIZONTE_DURACION_S}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              // Hint de compositor: promueve el trazo a su propia capa, para que
              // la traslación no dispare repintado del resto del SVG.
              willChange: "transform",
              "--h-periodo": `${linea.periodoPx}px`,
              "--h-direccion": HORIZONTE_DIRECCION,
            } as CSSProperties
          }
        />
      ))}
    </svg>
  );
}
