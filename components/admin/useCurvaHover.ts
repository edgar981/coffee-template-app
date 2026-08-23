'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Interacción de hover/scrub COMPARTIDA por las curvas de tinta del panel
// (PagosCurva, CurvaPedidosHoy). Extraída para que haya UN SOLO mecanismo — el
// owner lo pidió explícito: duplicarlo sería el segundo mecanismo que se evita.
//
// - UN SOLO CAMINO: pointer events, no mouse events (un mouse moderno emite AMBOS,
//   así que tener los dos setearía el hover dos veces por movimiento). `alMover`
//   cubre el hover del mouse Y el scrub del dedo; el scrub táctil funciona porque el
//   SVG lleva `touch-action: pan-y` (el arrastre horizontal va a JS, el vertical se
//   lo queda el navegador para scrollear).
// - DESCARTE EN TÁCTIL por tap-FUERA: en táctil no hay `pointerleave` al levantar el
//   dedo, así que sin esto el tooltip se movería de punto pero no se iría nunca. Un
//   `pointerdown` en el documento, scopeado al contenedor. Se registra SÓLO mientras
//   hay tooltip y depende del BOOLEANO (no del índice), así que los cambios
//   punto→punto no lo re-registran; y como el efecto corre DESPUÉS del render que
//   puso `hover`, el listener no existe durante el tap que lo originó.
// - `alSalir` limpia SÓLO con mouse: en táctil `pointerleave` dispara al levantar el
//   dedo y el tooltip debe QUEDARSE (se descarta con el tap-fuera).
//
// NO incluye el CLIC: cada curva pone el suyo — Pagos ACOTA, el Dashboard NO navega
// (§ Backlog #40). El hook es sólo lectura del punto activo.
export function useCurvaHover(n: number, padX: number, ancho: number) {
  const [hover, setHover] = useState<number | null>(null);
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  const hayTooltip = hover !== null;
  useEffect(() => {
    if (!hayTooltip) return;
    const alTocarFuera = (e: PointerEvent) => {
      const cont = contenedorRef.current;
      if (cont && !cont.contains(e.target as Node)) setHover(null);
    };
    document.addEventListener('pointerdown', alTocarFuera);
    return () => document.removeEventListener('pointerdown', alTocarFuera);
  }, [hayTooltip]);

  const alMover = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - padX) / Math.max(1, ancho - padX * 2)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }, [n, padX, ancho]);

  const alSalir = useCallback((e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') setHover(null);
  }, []);

  // `hov` = `hover` clamped al rango válido: un `hover` viejo puede quedar ≥ n cuando
  // n encoge (cambio de eje), y renderizar el punto fuera del array reventaría.
  const hov = hover !== null && hover >= 0 && hover < n ? hover : null;

  return { hover, hov, setHover, contenedorRef, alMover, alSalir };
}
