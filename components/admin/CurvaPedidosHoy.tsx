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
//     superficie de DATO, no un badge ni un punto, así que el ámbar acá es firma, no
//     atención. La misma decisión rige el área de PagosCurva.
//   · la LÍNEA es la medida, en TINTA a .5 (no plena): es el dato, atenuado para que
//     el marcador de ahora y el pico canten.
//   · el marcador de AHORA va en SOL — y acá el sol SÍ significa algo: marca el
//     momento VIVO, "dónde está el día". EL SOL NO MARCA POSICIÓN (el activo del rail
//     es tinta), MARCA AHORA — el momento que avanza con el reloj y sólo existe en la
//     pantalla del día. Por eso Pagos, que es un libro de período, no lo usa.
//   · el PICO va en TINTA. Dos marcadores DISTINTOS —ahora (sol, con anillo) y pico
//     (tinta)— cierran el riesgo de que el sol se lea como "aquí está el máximo".
//
// EL COMPONENTE ASUME que hay datos: el vacío-declara lo decide el llamador con
// `curvaDibuja`. EL ANCHO SE MIDE (ResizeObserver, § PagosCurva). El hover/scrub/
// tap-fuera viven en `useCurvaHover`, compartido con Pagos y NO tocado acá.

const ALTO = 140;
const PAD_X = 12;
const PAD_TOP = 22;    // aire para el rótulo del pico
const PAD_BOT = 22;    // aire para las etiquetas de hora
const INNER_H = ALTO - PAD_TOP - PAD_BOT;
const BASELINE = PAD_TOP + INNER_H;

// El eje SIGUE siendo 0–23 (el día completo es el MARCO, aunque la curva sólo llegue
// hasta la hora actual). Se rotulan los cuartos + los dos bordes, en reloj.
const TICKS = [0, 6, 12, 18, 23];

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

export default function CurvaPedidosHoy({ buckets, onPunto }: {
  buckets: number[];
  /** Clic en la hora activa → navega al día filtrado por esa hora. Ausente = no
   *  clickeable (la curva sigue siendo lectura pura). El destino lo arma el llamador. */
  onPunto?: (hora: number) => void;
}) {
  const [ancho, setAncho] = useState(0);

  // LA HORA ACTUAL de Bogotá (la hora de operación, no la del navegador), alineada al
  // borde de la hora: la curva no dibuja el FUTURO —a las 9:40 la línea llegaría plana
  // hasta las 11 p.m. y se leería "no hubo ventas en la tarde", no "todavía no
  // ocurrió"—. Avanza sola en cada borde de hora, como el eyebrow del reloj.
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

  // Hover/scrub/tap-fuera compartido con PagosCurva (mecanismo único). `hov` es el
  // índice = hora del punto activo. Se GUARDA a las horas transcurridas: hover sobre
  // el futuro (blanco) no tiene dato que mostrar.
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

  // Sólo lo TRANSCURRIDO (0..horaActual). El eje mapea igual sobre 0–23, así que la
  // curva ocupa la izquierda y el futuro queda en blanco —no insinuado—. (Un pedido
  // no puede caer en una hora futura, así que el corte no esconde dato real.)
  const elapsed = buckets.slice(0, horaActual + 1);
  const max = Math.max(...elapsed, 1);
  const innerW = Math.max(0, ancho - PAD_X * 2);
  const x = (hora: number) => PAD_X + (hora / (HORAS_DIA - 1)) * innerW;
  const pts = buckets.map((n, hora) => ({ x: x(hora), y: PAD_TOP + INNER_H - (n / max) * INNER_H }));
  const ptsVis = pts.slice(0, horaActual + 1);
  const { linea, area } = pathDe(ptsVis);

  // El pico de lo transcurrido (la primera hora si hay empate) — en tinta.
  const iPico = elapsed.reduce((mejor, n, i) => (n > elapsed[mejor] ? i : mejor), 0);
  const pico = pts[iPico];
  // El punto de AHORA — el fin de la línea, en sol. Con un solo punto transcurrido
  // (00:30) `ptsVis` no dibuja curva (`pathDe` < 2), así que sólo queda este marcador.
  const ahoraPt = pts[Math.min(horaActual, HORAS_DIA - 1)];
  // Hover válido = sobre lo transcurrido. El futuro no tiene dato.
  const hovVal = hov !== null && hov <= horaActual ? hov : null;
  const activo = hovVal !== null ? pts[hovVal] : null;

  return (
    // `minHeight` reserva el alto ANTES de medir; `position: relative` ancla el tooltip.
    <div ref={medirYContener} style={{ position: 'relative', width: '100%', minHeight: ALTO }}>
      {ancho > 0 && (
        <svg width={ancho} height={ALTO} role="img" aria-label="Pedidos por hora del día de hoy"
             onPointerMove={alMover} onPointerLeave={alSalir}
             // Clic = navegar a la hora activa (mismo `hovVal`). En táctil el tap ya
             // fijó `hov` con el mousemove sintetizado, así que el clic acota igual.
             onClick={onPunto && hovVal !== null ? () => onPunto(hovVal) : undefined}
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
            {buckets[iPico]}
          </text>

          {/* Marca de AHORA: círculo r=6 relleno + anillo r=11 al 30%, en SOL. Marca
              dónde está el día, no el pico; el anillo lo distingue de un punto de
              atención pelado. */}
          <g>
            <circle cx={ahoraPt.x} cy={ahoraPt.y} r="11" fill="none"
                    stroke="var(--duna-sol)" strokeWidth="1.5" opacity="0.3" />
            <circle cx={ahoraPt.x} cy={ahoraPt.y} r="6" fill="var(--duna-sol)" />
          </g>

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
      {activo && hovVal !== null && (
        <div className="admin-tooltip"
             style={{
               position: 'absolute', left: activo.x, top: Math.max(0, activo.y - 12),
               transform: `translate(${activo.x > ancho - 90 ? '-100%' : activo.x < 90 ? '0' : '-50%'}, -100%)`,
               pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2,
             }}>
          {buckets[hovVal]} {buckets[hovVal] === 1 ? 'pedido' : 'pedidos'} · {relojLabel(hovVal)}
        </div>
      )}
    </div>
  );
}
