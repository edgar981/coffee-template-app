'use client';

import { useCallback, useState } from 'react';
import { HORAS_DIA } from '@/lib/dashboard/hoy';
import { useCurvaHover } from './useCurvaHover';

// La curva de pedidos por HORA del día. Bespoke (como PagosCurva) y en TINTA: es una
// medida ÚNICA —pedidos por hora—, no una serie categórica, así que va en
// `--duna-ink` y nunca en `--duna-serie-*` (§ La serie categórica: color que
// IDENTIFICA, no que califica). Sin ámbar: nada acá pide atención.
//
// El componente ASUME que hay datos: el vacío-declara (día sin pedidos) lo decide el
// llamador con `curvaDibuja`, y en ese caso ni siquiera monta esto.
//
// EL ANCHO SE MIDE, no se asume (§ PagosCurva, el defecto del observer): un viewBox
// a `width:100%` escalaría el TEXTO con el trazo, y en un teléfono (~340px) el número
// del pico y las horas quedarían a ~5px. Con el ancho real, las coordenadas van en
// píxeles y la tipografía se mantiene fija a cualquier tamaño. La notificación de
// ancho 0 se IGNORA: no es una medida, es el nodo saliendo del DOM.

const ALTO = 140;
const PAD_X = 12;
const PAD_TOP = 22;    // aire para el rótulo del pico
const PAD_BOT = 22;    // aire para las etiquetas de hora
const INNER_H = ALTO - PAD_TOP - PAD_BOT;
const BASELINE = PAD_TOP + INNER_H;

// El eje SIGUE siendo 0–23 (no se recorta el dato: hay pedidos a cualquier hora en
// un storefront 24h). Se rotulan los CUARTOS del día MÁS LOS DOS BORDES, en formato
// de reloj —no duraciones ("6h" se leía como tiempo transcurrido)—. Anclar 0 y 23 es
// lo que quita el efecto "corrido": un set interior (6–21) dejaba 0–6 y 21–23 sin
// etiqueta y la escala se veía desplazada. Cada tick rotula SU hora (23 → "11 p.m.",
// el bucket de las 23:00); "12 a.m." ahí duplicaría el borde izquierdo y mal-rotularía.
const TICKS = [0, 6, 12, 18, 23];

/** Hora del día (0–23) → etiqueta de reloj (es-CO): 12 a.m. · 12 m. · 3 p.m. … */
function relojLabel(h: number): string {
  if (h === 0)  return '12 a.m.';
  if (h === 12) return '12 m.';
  return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
}

const clampY = (y: number) => Math.max(PAD_TOP, Math.min(BASELINE, y));

/** Catmull-Rom → Bézier, con los controles ACOTADOS a la caja (§ PagosCurva: sin
 *  esa cota la spline se pasa de largo y el área se dibuja bajo el eje). */
function pathDe(pts: { x: number; y: number }[]): { linea: string; area: string } {
  if (pts.length < 2) return { linea: '', area: '' };
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  const area = `${d} L ${pts[pts.length - 1].x} ${BASELINE} L ${pts[0].x} ${BASELINE} Z`;
  return { linea: d, area };
}

export default function CurvaPedidosHoy({ buckets }: { buckets: number[] }) {
  const [ancho, setAncho] = useState(0);

  // Hover/scrub/tap-fuera compartido con PagosCurva (mecanismo único). El clic NO
  // entra: la curva es LECTURA, no navegación (§ Backlog #40 — Pedidos no filtra por
  // hora). `hov` es el índice = hora del punto activo.
  const { hov, contenedorRef, alMover, alSalir } = useCurvaHover(HORAS_DIA, PAD_X, ancho);

  // Callback ref que MIDE (ResizeObserver, ignora ancho 0 — § PagosCurva) Y hace de
  // contenedor para el descarte táctil por tap-fuera. Un solo nodo, dos responsabilidades.
  const medirYContener = useCallback((node: HTMLDivElement | null) => {
    contenedorRef.current = node;
    if (!node) return;
    const medir = () => { const w = node.clientWidth; if (w > 0) setAncho(w); };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(node);
    return () => ro.disconnect();
  }, [contenedorRef]);

  const max = Math.max(...buckets, 1);
  const innerW = Math.max(0, ancho - PAD_X * 2);
  const x = (hora: number) => PAD_X + (hora / (HORAS_DIA - 1)) * innerW;
  const pts = buckets.map((n, hora) => ({ x: x(hora), y: PAD_TOP + INNER_H - (n / max) * INNER_H }));
  const { linea, area } = pathDe(pts);

  // El pico: hora más ocupada (la primera si hay empate). Marca dónde llegaron los
  // pedidos, que es lo que una curva sin eje-Y comunica.
  const iPico = buckets.reduce((mejor, n, i) => (n > buckets[mejor] ? i : mejor), 0);
  const pico = pts[iPico];
  const activo = hov !== null ? pts[hov] : null;

  return (
    // `minHeight` reserva el alto ANTES de medir; `position: relative` ancla el tooltip.
    <div ref={medirYContener} style={{ position: 'relative', width: '100%', minHeight: ALTO }}>
      {ancho > 0 && (
        <svg width={ancho} height={ALTO} role="img" aria-label="Pedidos por hora del día de hoy"
             onPointerMove={alMover} onPointerLeave={alSalir}
             style={{ display: 'block', overflow: 'visible', touchAction: 'pan-y' }}>
          <path d={area} fill="color-mix(in srgb, var(--duna-ink) 5%, transparent)" />
          <path d={linea} fill="none" stroke="var(--duna-ink)" strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" />

          {/* Guía del hover: línea punteada + punto sobre la curva (como PagosCurva). */}
          {activo && (
            <g>
              <line x1={activo.x} y1={PAD_TOP} x2={activo.x} y2={BASELINE}
                    stroke="var(--duna-border-2)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={activo.x} cy={activo.y} r="3.5" fill="var(--duna-ink)" />
            </g>
          )}

          {/* Marca del pico: punto + su conteo encima. */}
          <circle cx={pico.x} cy={pico.y} r="3" fill="var(--duna-ink)" />
          <text x={pico.x} y={pico.y - 8} textAnchor="middle" fill="var(--duna-ink)"
                style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--duna-font-ui)' }}>
            {buckets[iPico]}
          </text>

          {/* Eje de horas, en reloj. Los bordes (0, 23) se anclan a su lado —'start' /
              'end'— para no recortarse contra el marco; el resto van centrados. */}
          {TICKS.map(h => (
            <text key={h} x={x(h)} y={ALTO - 6}
                  textAnchor={h === 0 ? 'start' : h === HORAS_DIA - 1 ? 'end' : 'middle'}
                  fill="var(--duna-muted)"
                  style={{ fontSize: 11, fontFamily: 'var(--duna-font-ui)' }}>
              {relojLabel(h)}
            </text>
          ))}
        </svg>
      )}

      {/* Tooltip en la superficie del sistema (`.admin-tooltip`), sólo DATO: el conteo
          de esa hora. Es lectura — no navega. */}
      {activo && hov !== null && (
        <div className="admin-tooltip"
             style={{
               position: 'absolute', left: activo.x, top: Math.max(0, activo.y - 12),
               transform: `translate(${activo.x > ancho - 90 ? '-100%' : activo.x < 90 ? '0' : '-50%'}, -100%)`,
               pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2,
             }}>
          {buckets[hov]} {buckets[hov] === 1 ? 'pedido' : 'pedidos'} · {relojLabel(hov)}
        </div>
      )}
    </div>
  );
}
