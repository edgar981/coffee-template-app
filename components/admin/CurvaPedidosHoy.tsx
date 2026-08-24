'use client';

import { useCallback, useEffect, useState } from 'react';
import { HORAS_DIA, relojLabel } from '@/lib/dashboard/hoy';
import { zonedHour, BUSINESS_TZ } from '@duna/core/timezone';
import { useCurvaHover } from './useCurvaHover';

// La curva de pedidos por HORA del día. Bespoke (como PagosCurva).
//
// COLOR — el discriminador del sol es EL SITIO (§ El ámbar es marca/dato en las
// superficies de DATO, estado en las de estado):
//   · el ÁREA va en ÁMBAR (gradiente `--duna-sol` 10%→0%), un lavado tenue: es una
//     superficie de DATO, no un badge. La misma decisión rige el área de PagosCurva.
//   · la LÍNEA es la medida, en TINTA a .5 (no plena).
//   · el marcador de AHORA va en SOL y PULSA (§ duna.css `.curva-ahora-pulso`): marca
//     el momento VIVO. EL SOL NO MARCA POSICIÓN (el activo del rail es tinta), MARCA
//     AHORA — el momento que avanza con el reloj y sólo existe en la pantalla del día.
//   · el PICO va en TINTA. Dos marcadores distintos cierran el riesgo de leer el sol
//     como "aquí está el máximo".
//
// EL EJE ES LA JORNADA, no 0–23 fijo: va desde la PRIMERA HORA CON ACTIVIDAD del día
// hasta las 11 p.m. (borde derecho FIJO). Así el vacío de la madrugada no se come un
// tercio del ancho, la escala es ESTABLE dentro del día (el borde izquierdo = primera
// hora con orden, que nunca retrocede) y "ahora" avanza hacia la derecha. La curva NO
// dibuja el futuro: la línea y el área llegan sólo hasta la hora actual; el resto queda
// en blanco (mostrar menos antes que mentir).
//
// EL COMPONENTE ASUME que hay datos (el vacío-declara lo decide el llamador con
// `curvaDibuja`). EL ANCHO SE MIDE (ResizeObserver). El hover/scrub/tap-fuera viven en
// `useCurvaHover`, compartido con Pagos y NO tocado: se le pasa `n` = horas de la
// VENTANA, y su índice se mapea a hora con `inicio + i`.

export const ALTO_CURVA = 140;   // el llamador reserva este alto en el estado vacío (sin salto)
const PAD_X = 12;
const PAD_TOP = 22;    // aire para el rótulo del pico
const PAD_BOT = 22;    // aire para las etiquetas de hora
const INNER_H = ALTO_CURVA - PAD_TOP - PAD_BOT;
const BASELINE = PAD_TOP + INNER_H;
const FIN = HORAS_DIA - 1;   // 23 — el borde derecho fijo (11 p.m.)

const clampY = (y: number) => Math.max(PAD_TOP, Math.min(BASELINE, y));

/** Ticks dentro de la ventana [inicio..23]: los DOS bordes siempre, más interiores a
 *  un paso que da ~4–5 marcas. Se cae un interior a < 1.5 h del borde derecho para no
 *  encimar con "11 p.m.". Con ventana corta hay pocas marcas, pero las horas son
 *  ANCHAS (más px/hora), así que no se aprietan. */
function ticksDeVentana(inicio: number): number[] {
  const span = FIN - inicio;
  if (span <= 0) return [inicio];
  const paso = span <= 5 ? 1 : span <= 11 ? 3 : 6;
  const ts: number[] = [];
  for (let h = inicio; h < FIN; h += paso) ts.push(h);
  const out = ts.filter((h, i) => i === 0 || FIN - h >= 1.5);
  out.push(FIN);
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

  // LA HORA ACTUAL de Bogotá, alineada al borde de la hora — para no dibujar el futuro.
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

  // LA VENTANA: [inicio..23]. `inicio` = primera hora con actividad (garantizada por
  // `curvaDibuja` en el llamador). `n` = horas de la ventana — lo que se le pasa al
  // hook, cuyo índice 0..n-1 se mapea a hora con `inicio + i`.
  const inicioBruto = buckets.findIndex(n => n > 0);
  const inicio = inicioBruto < 0 ? 0 : inicioBruto;
  const n = HORAS_DIA - inicio;

  // Hover/scrub/tap-fuera compartido con PagosCurva (mecanismo único). Se GUARDA a las
  // horas transcurridas: hover sobre el futuro (blanco) no tiene dato que mostrar.
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

  const ventana = buckets.slice(inicio);                 // horas inicio..23, índice 0..n-1
  const idxAhora = Math.min(Math.max(0, horaActual - inicio), n - 1);
  const elapsed = ventana.slice(0, idxAhora + 1);        // lo transcurrido dentro de la ventana
  const max = Math.max(...elapsed, 1);
  const innerW = Math.max(0, ancho - PAD_X * 2);
  const denom = Math.max(1, n - 1);
  const xIdx = (idx: number) => PAD_X + (idx / denom) * innerW;
  const pts = ventana.map((cnt, idx) => ({ x: xIdx(idx), y: PAD_TOP + INNER_H - (cnt / max) * INNER_H }));
  const ptsVis = pts.slice(0, idxAhora + 1);
  const { linea, area } = pathDe(ptsVis);

  // El pico de lo transcurrido (la primera hora si hay empate) — en tinta. Índice de
  // ventana; la hora real es `inicio + iPico`.
  const iPico = elapsed.reduce((mejor, cnt, i) => (cnt > elapsed[mejor] ? i : mejor), 0);
  const pico = pts[iPico];
  // El punto de AHORA — el fin de la línea, en sol. Con un solo punto (00:30, o el
  // primer pedido recién entrado) `ptsVis` no dibuja curva; queda sólo este marcador.
  const ahoraPt = pts[idxAhora];
  // Hover válido = sobre lo transcurrido. Índice de ventana → hora real.
  const hovVal = hov !== null && hov <= idxAhora ? hov : null;
  const activo = hovVal !== null ? pts[hovVal] : null;
  const hovHora = hovVal !== null ? inicio + hovVal : null;

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
            {buckets[inicio + iPico]}
          </text>

          {/* Marca de AHORA: círculo r=6 + anillo r=11 que PULSA (§ duna.css), en SOL. */}
          <g>
            <circle className="curva-ahora-pulso" cx={ahoraPt.x} cy={ahoraPt.y} r="11"
                    fill="none" stroke="var(--duna-sol)" strokeWidth="1.5" opacity="0.3" />
            <circle cx={ahoraPt.x} cy={ahoraPt.y} r="6" fill="var(--duna-sol)" />
          </g>

          {/* Eje de horas (la JORNADA), en reloj. Los bordes se anclan a su lado. */}
          {ticksDeVentana(inicio).map(h => (
            <text key={h} x={xIdx(h - inicio)} y={ALTO_CURVA - 6}
                  textAnchor={h === inicio ? 'start' : h === FIN ? 'end' : 'middle'}
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
