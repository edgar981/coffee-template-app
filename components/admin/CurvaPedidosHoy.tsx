'use client';

import { useCallback, useEffect, useState } from 'react';
import { relojLabel, ventanaCurvaHoy } from '@/lib/dashboard/hoy';
import { zonedHour, BUSINESS_TZ } from '@duna/core/timezone';
import { useCurvaHover } from './useCurvaHover';

// La curva de pedidos por HORA del día. Bespoke (como PagosCurva).
//
// COLOR — el discriminador del sol es EL SITIO (§ El ámbar es marca/dato en las
// superficies de DATO, estado en las de estado):
//   · el ÁREA va en ÁMBAR (gradiente `--duna-sol` 10%→0%), un lavado tenue de DATO.
//   · la LÍNEA es la medida, en TINTA a .5 (no plena).
//   · el marcador de AHORA va en SOL y PULSA (§ duna.css `.curva-ahora-pulso`): marca
//     el momento VIVO. EL SOL NO MARCA POSICIÓN (el activo del rail es tinta), MARCA
//     AHORA — el momento que avanza con el reloj y sólo existe en la pantalla del día.
//   · el PICO va en TINTA. Dos marcadores distintos cierran el riesgo de leer el sol
//     como "aquí está el máximo".
//
// EL EJE ES LA JORNADA TRANSCURRIDA: `[primera hora con actividad .. HORA ACTUAL]`. El
// borde derecho es AHORA (no las 11 p.m.): "Hoy" es lo que ha pasado, así que la curva
// no dibuja el futuro y tampoco le reserva ancho. El marcador de ahora queda SIEMPRE en
// el borde derecho, como en la maqueta.
//   · SPAN MÍNIMO de 6 h, rellenando hacia el PASADO: si la actividad es reciente
//     (8:30 con el primer pedido a las 8), el eje se estira a la IZQUIERDA —esas horas
//     tuvieron 0 pedidos, es dato real— en vez de dejar una joroba de una hora llenando
//     la pantalla. El marcador NO se mueve del borde. Antes de las 6 a.m. el eje es
//     `[0 .. ahora]` (no se puede rellenar antes de medianoche); es genuinamente
//     temprano. A las 00:30 el eje es `[0 .. 0]` — un solo punto, y `pathDe` (<2) no
//     dibuja curva: queda sólo el marcador, sin que el span cero rompa la escala.
//
// EL ANCHO SE MIDE (ResizeObserver). El hover/scrub/tap-fuera viven en `useCurvaHover`,
// compartido con Pagos y NO tocado: se le pasa `n` = horas de la VENTANA, y su índice
// se mapea a hora con `inicioEje + i`.

export const ALTO_CURVA = 140;   // el llamador reserva este alto en el estado vacío (sin salto)
const PAD_X = 12;
const PAD_TOP = 22;    // aire para el rótulo del pico
const PAD_BOT = 22;    // aire para las etiquetas de hora
const INNER_H = ALTO_CURVA - PAD_TOP - PAD_BOT;
const BASELINE = PAD_TOP + INNER_H;

const clampY = (y: number) => Math.max(PAD_TOP, Math.min(BASELINE, y));

/** Ticks dentro de la ventana [inicio..fin], donde FIN = la hora ACTUAL. Los dos bordes
 *  siempre —el derecho rotula dónde está el día ("10 a.m.")—, más interiores a un paso
 *  de 6/3/1 según el span. Se cae un interior a < 1.5 h del borde "ahora" para que su
 *  etiqueta no se encime con la de ahora. Con ventana corta hay pocas marcas pero las
 *  horas son ANCHAS, así que no se aprietan. */
function ticksDeVentana(inicio: number, fin: number): number[] {
  const span = fin - inicio;
  if (span <= 0) return [fin];   // ventana degenerada (00:30): sólo la hora actual
  const paso = span <= 5 ? 1 : span <= 11 ? 3 : 6;
  const ts: number[] = [];
  for (let h = inicio; h < fin; h += paso) ts.push(h);
  const out = ts.filter((h, i) => i === 0 || fin - h >= 1.5);
  out.push(fin);
  return out;
}

/** Catmull-Rom → Bézier, con los controles ACOTADOS a la caja (§ PagosCurva). */
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

export default function CurvaPedidosHoy({ buckets, onPunto }: {
  buckets: number[];
  /** Clic en la hora activa → navega al día filtrado por esa hora. Ausente = no
   *  clickeable. El destino lo arma el llamador. */
  onPunto?: (hora: number) => void;
}) {
  const [ancho, setAncho] = useState(0);

  // LA HORA ACTUAL de Bogotá, alineada al borde de la hora. El estado vive ACÁ, así que
  // al cambiar la hora SÓLO se re-renderiza esta curva —no el Dashboard—, igual que el
  // eyebrow con su reloj de minuto. El pulso es CSS, sin estado. Sin esto, a las 11:05
  // el marcador seguiría diciendo "10 a.m." hasta recargar.
  const [horaActual, setHoraActual] = useState(() => zonedHour(new Date(), BUSINESS_TZ));
  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const alProximaHora = 3_600_000 - (Date.now() % 3_600_000); // Bogotá = UTC-5, borde de hora alineado
    const arranque = setTimeout(() => {
      setHoraActual(zonedHour(new Date(), BUSINESS_TZ));
      intervalo = setInterval(() => setHoraActual(zonedHour(new Date(), BUSINESS_TZ)), 3_600_000);
    }, alProximaHora);
    return () => { clearTimeout(arranque); if (intervalo) clearInterval(intervalo); };
  }, []);

  // LA VENTANA del eje: pura y testeada en capa 1 (`ventanaCurvaHoy`). La primera
  // actividad se lee sobre los 24 buckets del DÍA —NO la ventana recortada—, así que el
  // borde izquierdo (`clamp(horaFin−6, 0, primeraActividad) ≤ primeraActividad`) nunca
  // pasa esa hora y ningún pedido queda fuera. Borde derecho = AHORA. El marcador queda
  // en el borde derecho; el span mínimo rellena hacia el pasado si el día recién empezó.
  const { inicioEje, horaFin, n } = ventanaCurvaHoy(buckets, horaActual);

  // Hover/scrub/tap-fuera compartido con PagosCurva. Índice 0..n-1 → hora `inicioEje + i`.
  const { hov, contenedorRef, alMover, alSalir } = useCurvaHover(n, PAD_X, ancho);

  // Callback ref que MIDE (ResizeObserver, ignora ancho 0 — § PagosCurva) Y hace de
  // contenedor para el descarte táctil. Un solo nodo, dos responsabilidades.
  const medirYContener = useCallback((node: HTMLDivElement | null) => {
    contenedorRef.current = node;
    if (!node) return;
    const medir = () => { const w = node.clientWidth; if (w > 0) setAncho(w); };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(node);
    return () => ro.disconnect();
  }, [contenedorRef]);

  const ventana = buckets.slice(inicioEje, horaFin + 1);   // longitud n; TODA transcurrida
  const max = Math.max(...ventana, 1);
  const innerW = Math.max(0, ancho - PAD_X * 2);
  const denom = Math.max(1, n - 1);                        // n=1 (00:30) no rompe la escala
  const xIdx = (idx: number) => PAD_X + (idx / denom) * innerW;
  const pts = ventana.map((cnt, idx) => ({ x: xIdx(idx), y: PAD_TOP + INNER_H - (cnt / max) * INNER_H }));
  const { linea, area } = pathDe(pts);

  // El pico (la primera hora si hay empate) — en tinta. Índice de ventana; hora real
  // `inicioEje + iPico`.
  const iPico = ventana.reduce((mejor, cnt, i) => (cnt > ventana[mejor] ? i : mejor), 0);
  const pico = pts[iPico];
  // El punto de AHORA — el ÚLTIMO, el borde derecho. Con un solo punto (00:30) `pathDe`
  // no dibuja curva; queda sólo este marcador.
  const ahoraPt = pts[n - 1];
  // Hover: toda la ventana es transcurrida, así que cualquier índice es válido.
  const activo = hov !== null ? pts[hov] : null;
  const hovHora = hov !== null ? inicioEje + hov : null;

  return (
    // `minHeight` reserva el alto ANTES de medir; `position: relative` ancla el tooltip.
    <div ref={medirYContener} style={{ position: 'relative', width: '100%', minHeight: ALTO_CURVA }}>
      {ancho > 0 && (
        <svg width={ancho} height={ALTO_CURVA} role="img" aria-label="Pedidos por hora del día de hoy"
             onPointerMove={alMover} onPointerLeave={alSalir}
             onClick={onPunto && hovHora !== null ? () => onPunto(hovHora) : undefined}
             style={{ display: 'block', overflow: 'visible', touchAction: 'pan-y', cursor: onPunto ? 'pointer' : 'default' }}>
          {/* Área en ÁMBAR, gradiente tenue 10%→0% (§ el sitio decide: superficie de
              dato = firma, no estado). El % del tope se afina por tema en el gate. */}
          <defs>
            <linearGradient id="curvaHoyArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--duna-sol)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--duna-sol)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#curvaHoyArea)" />
          <path d={linea} fill="none" stroke="var(--duna-ink)" strokeOpacity="0.5" strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" />

          {/* Guía del hover: línea punteada + punto sobre la curva (como PagosCurva). */}
          {activo && (
            <g>
              <line x1={activo.x} y1={PAD_TOP} x2={activo.x} y2={BASELINE}
                    stroke="var(--duna-border-2)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={activo.x} cy={activo.y} r="3.5" fill="var(--duna-ink)" />
            </g>
          )}

          {/* Marca del PICO: punto + su conteo encima, en TINTA. */}
          <circle cx={pico.x} cy={pico.y} r="3" fill="var(--duna-ink)" />
          <text x={pico.x} y={pico.y - 8} textAnchor="middle" fill="var(--duna-ink)"
                style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--duna-font-ui)' }}>
            {buckets[inicioEje + iPico]}
          </text>

          {/* Marca de AHORA: círculo r=6 + anillo r=11 que PULSA (§ duna.css), en SOL, en
              el borde derecho. */}
          <g>
            <circle className="curva-ahora-pulso" cx={ahoraPt.x} cy={ahoraPt.y} r="11"
                    fill="none" stroke="var(--duna-sol)" strokeWidth="1.5" opacity="0.3" />
            <circle cx={ahoraPt.x} cy={ahoraPt.y} r="6" fill="var(--duna-sol)" />
          </g>

          {/* Eje de horas (la JORNADA transcurrida), en reloj. La última etiqueta = la
              hora ACTUAL (dónde está el día); los bordes se anclan a su lado. */}
          {ticksDeVentana(inicioEje, horaFin).map(h => (
            <text key={h} x={xIdx(h - inicioEje)} y={ALTO_CURVA - 6}
                  textAnchor={h === inicioEje ? 'start' : h === horaFin ? 'end' : 'middle'}
                  fill="var(--duna-muted)"
                  style={{ fontSize: 11, fontFamily: 'var(--duna-font-ui)' }}>
              {relojLabel(h)}
            </text>
          ))}
        </svg>
      )}

      {/* Tooltip en la superficie del sistema (`.admin-tooltip`), sólo DATO: el conteo
          de esa hora. Es lectura — no navega. */}
      {activo && hovHora !== null && (
        <div className="admin-tooltip"
             style={{
               position: 'absolute', left: activo.x, top: Math.max(0, activo.y - 12),
               transform: `translate(${activo.x > ancho - 90 ? '-100%' : activo.x < 90 ? '0' : '-50%'}, -100%)`,
               pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2,
             }}>
          {buckets[hovHora]} {buckets[hovHora] === 1 ? 'pedido' : 'pedidos'} · {relojLabel(hovHora)}
        </div>
      )}
    </div>
  );
}
