'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useCurvaHover } from './useCurvaHover';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODO_PAGO_LABEL, METODO_CATEGORIA } from '@/types/payment';
import { formatCOP } from '@duna/core/utils';
import { bucketear, bucketKey, type Escala } from '@/lib/pagos/bucketeo';
import { etiquetaEje, etiquetaBucket, type RecorteTiempo } from '@/lib/pagos/etiquetas';

// EL GRÁFICO DE PAGOS — una CURVA sobre el tiempo, en la zona FIJA de la pantalla
// (no scrollea: § la anatomía). Todo sale de `pagos`, la misma fuente que el libro.
//
// DOS EJES INTERCAMBIABLES, y la regla de siempre: EL EJE NUNCA SE FILTRA A SÍ MISMO.
// - modo TIEMPO (4–92 puntos): una curva sobre los buckets; filtra por MÉTODO (el select).
// - modo MÉTODO (el recorte es 1 bucket): una barra por método; filtra por TIEMPO.
//   Se muestran las cinco y se resalta la activa; una nota lo declara.
// - 2–3 buckets: ni tendencia ni método → se declara y la frase de arriba ya lo dice.
// - >92 puntos ni en meses: no dibuja, se declara.
//
// La curva NO se apila por método (una curva apilada no existe): el desglose por método
// vive en el modo método y en el select. Por eso acá no hay toggle ni leyenda.

const METODOS_SERIE: { metodo: MetodoPago; color: string }[] = [
  { metodo: 'EFECTIVO',      color: 'var(--duna-serie-1)' },
  { metodo: 'NEQUI',         color: 'var(--duna-serie-2)' },
  { metodo: 'DAVIPLATA',     color: 'var(--duna-serie-3)' },
  { metodo: 'TRANSFERENCIA', color: 'var(--duna-serie-4)' },
  { metodo: 'OTRO',          color: 'var(--duna-serie-5)' },
];

/**
 * Alto del área de dibujo. Es un lever del presupuesto de alto (§ spec): la zona fija no
 * scrollea, así que cada píxel de acá le cuesta una fila al libro. **100 es el piso de
 * legibilidad** —por debajo los picos se comprimen y la curva se lee como textura, no
 * como magnitud—, así que 110 deja margen sin llegar al borde.
 */
const ALTO = 110;
/** Aire arriba para la cifra del pico, que se pinta sobre el punto. */
const PAD_TOP = 20;
/** Margen lateral para que el primer y el último punto no queden cortados. */
const INSET = 10;
/** Tope de etiquetas del eje: más que esto se amontonan y no se leen. */
const MAX_ETIQUETAS = 8;
const ALTO_BARRAS = 96; // el modo método sigue siendo barras

/**
 * Catmull-Rom → Bézier cúbica. Pasa POR los puntos (a diferencia de una Bézier suelta),
 * que es lo que hace que el pico marcado caiga exactamente sobre la curva.
 *
 * Los controles se ACOTAN a la caja: con datos de picos y ceros —una tienda que factura
 * un día sí y otro no— la spline se pasa de largo y el área se dibujaría por debajo del
 * eje, que se lee como un dato negativo que no existe.
 */
function smoothPath(pts: { x: number; y: number }[], yMin: number, yMax: number): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const clamp = (v: number) => Math.min(yMax, Math.max(yMin, v));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** El monto ABREVIADO del pico: sobre la curva no cabe un "$ 1.240.000". */
function abreviaCOP(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$ ${m.toFixed(m < 10 ? 1 : 0).replace('.', ',')} M`;
  }
  if (n >= 1_000) return `$ ${Math.round(n / 1_000)} K`;
  return formatCOP(n);
}

const UNIDAD: Record<Escala, string> = { dia: 'día', semana: 'semana', mes: 'mes' };

/**
 * El hueco de la curva mientras el dato viaja.
 *
 * Vive ACÁ y no en la página para que comparta `ALTO` y las clases del bloque cargado:
 * así el alto coincide POR CONSTRUCCIÓN y no por una suma que alguien tenga que
 * mantener. La zona fija no scrollea —si el hueco midiera distinto, el bloque saltaría
 * al llegar el dato, y debajo está el libro cuyas filas se cuentan una por una—.
 *
 * No dice NADA: un texto acá tendría que afirmar algo sobre un dato que todavía no
 * existe, que es justo el defecto que este esqueleto viene a cerrar.
 */
export function PagosCurvaEsqueleto() {
  return (
    <div className="admin-grafico" aria-hidden="true">
      <div className="admin-grafico__caja" style={{ height: ALTO, display: 'flex', alignItems: 'flex-end' }}>
        <span style={{ width: '100%', height: '58%', borderRadius: 'var(--duna-r-s)', background: 'var(--duna-skel)' }} />
      </div>
      <div className="admin-grafico__eje" />
      <p className="admin-grafico__hint">
        <span style={{ display: 'inline-block', width: '19rem', maxWidth: '80%', height: '0.85em',
                       borderRadius: 3, background: 'var(--duna-skel)', verticalAlign: 'middle' }} />
      </p>
    </div>
  );
}

export function PagosCurva({
  pagos, desde, hasta, metodoFiltrado, bucketSel, onBucket, onMetodo,
}: {
  pagos: Payment[];
  desde: string;
  hasta: string;
  metodoFiltrado: string;              // 'all' | MetodoPago | `cat:${cat}`
  bucketSel: RecorteTiempo | null;
  onBucket: (r: RecorteTiempo) => void;
  onMetodo: (m: MetodoPago) => void;
}) {
  const b = useMemo(() => bucketear(desde, hasta), [desde, hasta]);

  // El modo lo decide si el recorte activo es UN bucket (clic en punto, o rango de 1).
  const modo: 'tiempo' | 'metodo' | 'pocas' | 'muchas' =
    b.tipo === 'muchas' ? 'muchas'
    : bucketSel ? 'metodo'
    : b.tipo === 'pocas' ? (b.n === 1 ? 'metodo' : 'pocas')
    : 'tiempo';

  // El ancho se MIDE (no se asume): un viewBox estirado deformaría el trazo y la
  // tipografía.
  //
  // Va por CALLBACK REF y no por `useRef` + efecto: el bloque se remonta al cambiar de
  // eje (`key={modo}`), así que la caja que existía deja de existir y aparece OTRA. Un
  // efecto con deps `[]` lee la caja UNA vez y nunca se entera del remonte —el observer
  // se queda mirando un nodo que ya no está en el DOM y el ancho no se vuelve a medir—.
  // El callback ref se dispara con cada nodo, así que engancha y desengancha solo.
  //
  // Y una notificación de ANCHO 0 se IGNORA: no es una medida, es el nodo saliendo del
  // DOM (medido: al desmontar, el RO avisa `width: 0`). Tomarla dejaría el ancho en 0 —
  // sin curva, y con todas las etiquetas del eje apiladas en `left: 0`.
  const observador = useRef<ResizeObserver | null>(null);
  const [ancho, setAncho] = useState(0);
  const cajaRef = useCallback((nodo: HTMLDivElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(entradas => {
      for (const e of entradas) {
        const w = Math.round(e.contentRect.width);
        if (w > 0) setAncho(w);
      }
    });
    ro.observe(nodo);
    observador.current = ro;
  }, []);

  // El hover/scrub/tap-fuera vive en `useCurvaHover` (mecanismo ÚNICO compartido con
  // CurvaPedidosHoy). Se instancia más abajo, cuando `n` ya está disponible; ver el
  // bloque "hover + reset de eje".

  const metOk = useMemo(() => (m: MetodoPago) => {
    if (metodoFiltrado === 'all') return true;
    if (metodoFiltrado.startsWith('cat:')) return METODO_CATEGORIA[m] === metodoFiltrado.slice(4);
    return m === metodoFiltrado;
  }, [metodoFiltrado]);

  // ── Datos del modo TIEMPO ───────────────────────────────────────────────────
  const datosT = useMemo(() => {
    if (modo !== 'tiempo' || b.tipo !== 'dibuja') return null;
    const { escala, buckets } = b;
    const porBucket = new Map(buckets.map(bk => [bk.key, { total: 0, conteo: 0 }]));
    for (const p of pagos) {
      if (!metOk(p.metodo)) continue;
      const celda = porBucket.get(bucketKey(new Date(p.fecha), escala));
      if (!celda) continue;
      celda.total += p.monto;
      celda.conteo += 1;
    }
    const series = buckets.map(bk => ({ bucket: bk, ...porBucket.get(bk.key)! }));
    const max = Math.max(1, ...series.map(s => s.total));
    // El pico se marca sólo si hay plata: con todo en cero no hay pico que nombrar.
    let iPico = -1;
    for (let i = 0; i < series.length; i++) {
      if (series[i].total > 0 && (iPico === -1 || series[i].total > series[iPico].total)) iPico = i;
    }
    const hoyKey = bucketKey(new Date(), escala);
    const iHoy = series.findIndex(s => s.bucket.key === hoyKey);
    const iSel = bucketSel ? series.findIndex(s => s.bucket.key === bucketSel.key) : -1;
    return { escala, series, max, iPico, iHoy, iSel };
  }, [modo, b, pagos, metOk, bucketSel]);

  // ── Datos del modo MÉTODO ───────────────────────────────────────────────────
  const datosM = useMemo(() => {
    if (modo !== 'metodo') return null;
    const enBucket = bucketSel
      ? (p: Payment) => bucketKey(new Date(p.fecha), bucketSel.escala) === bucketSel.key
      : () => true; // rango de 1 bucket: todos los pagos caen en él
    const porMetodo: Record<string, number> = {};
    for (const p of pagos) if (enBucket(p)) porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + p.monto;
    const max = Math.max(1, ...METODOS_SERIE.map(m => porMetodo[m.metodo] ?? 0));
    return { porMetodo, max };
  }, [modo, pagos, bucketSel]);

  // El método resaltado (sólo uno concreto; una categoría no resalta a uno).
  const metodoSel = metodoFiltrado !== 'all' && !metodoFiltrado.startsWith('cat:')
    ? (metodoFiltrado as MetodoPago) : null;

  // ── hover + reset de eje ────────────────────────────────────────────────────
  // El hook va ANTES de todos los early-returns (hooks incondicionales). `n` sale de
  // `datosT` (0 cuando no hay curva; da igual, ahí el componente retorna sin dibujar).
  const nHover = datosT ? datosT.series.length : 0;
  const { hov, setHover, contenedorRef, alMover, alSalir } = useCurvaHover(nHover, INSET, ancho);

  // `hover` NO debe sobrevivir al cambio de eje: en TÁCTIL un tap sintetiza un
  // `mousemove` que lo setea pero NUNCA un `mouseleave` que lo limpie, así que quedaría
  // pegado al volver a modo tiempo. Reset-EN-RENDER (guardar modo previo, comparar,
  // resetear), NO un `useEffect` (el repo lint-prohíbe `set-state-in-effect`), y NO
  // subiendo el `key` al componente (resetearía `ancho` y daría un flash de curva vacía).
  const [modoPrevio, setModoPrevio] = useState(modo);
  if (modo !== modoPrevio) {
    setModoPrevio(modo);
    setHover(null);
  }

  // ── Los dos casos que DECLARAN en vez de dibujar ────────────────────────────
  if (modo === 'muchas') {
    return <div key={modo} className="admin-grafico admin-grafico--vacio"><p className="duna-sub" style={{ margin: 0 }}>
      El rango es demasiado amplio para dibujar una tendencia. El libro de abajo sigue completo.
    </p></div>;
  }
  if (modo === 'pocas') {
    return <div key={modo} className="admin-grafico admin-grafico--vacio"><p className="duna-sub" style={{ margin: 0 }}>
      Dos o tres períodos no dibujan una tendencia — la frase de arriba ya lo dice mejor.
    </p></div>;
  }

  // ── MODO MÉTODO (conservado) ────────────────────────────────────────────────
  if (modo === 'metodo' && datosM) {
    return (
      <div key={modo} className="admin-grafico">
        <div className="admin-grafico__head">
          <span className="duna-eyebrow">Ingresos por método</span>
        </div>
        <div className="admin-grafico__metodos">
          {METODOS_SERIE.map(m => {
            const v = datosM.porMetodo[m.metodo] ?? 0;
            const activo = metodoSel === m.metodo;
            return (
              <button
                key={m.metodo}
                type="button"
                className={`admin-grafico__mcol${activo ? ' is-sel' : ''}`}
                onClick={() => onMetodo(m.metodo)}
                title={`${METODO_PAGO_LABEL[m.metodo]} — ${formatCOP(v)}`}
              >
                <span className="admin-grafico__mval duna-num">{formatCOP(v)}</span>
                <span className="admin-grafico__mbararea" style={{ height: ALTO_BARRAS }}>
                  <span className="admin-grafico__mbar" style={{ height: (v / datosM.max) * ALTO_BARRAS, background: m.color }} />
                </span>
                <span className="admin-grafico__mlbl">{METODO_PAGO_LABEL[m.metodo]}</span>
              </button>
            );
          })}
        </div>
        {/* Se DECLARA sólo cuando ocurre: cinco barras sobre una tabla filtrada se
            leería como fallo si no se dice. */}
        {metodoSel && (
          <p className="admin-grafico__nota">
            El desglose es del período completo; el libro de abajo está filtrado a {METODO_PAGO_LABEL[metodoSel]}.
          </p>
        )}
      </div>
    );
  }

  // ── MODO TIEMPO · LA CURVA ──────────────────────────────────────────────────
  if (!datosT) return null;
  const { escala, series, max, iPico, iHoy, iSel } = datosT;
  const n = series.length;
  const alto = ALTO;
  const yDe = (v: number) => PAD_TOP + (alto - PAD_TOP) * (1 - v / max);
  const xDe = (i: number) => INSET + (ancho - INSET * 2) * (n === 1 ? 0.5 : i / (n - 1));

  const puntos = ancho > 0 ? series.map((s, i) => ({ x: xDe(i), y: yDe(s.total) })) : [];
  const linea = smoothPath(puntos, PAD_TOP, alto);
  const area = puntos.length
    ? `${linea} L ${puntos[puntos.length - 1].x} ${alto} L ${puntos[0].x} ${alto} Z`
    : '';

  // Etiquetas del eje: como máximo ~8, repartidas parejo (siempre la primera).
  const paso = Math.max(1, Math.ceil(n / MAX_ETIQUETAS));
  // `hov` (clamp de `hover` al rango válido) lo da el hook — mismo cálculo.

  return (
    <div key={modo} ref={contenedorRef} className="admin-grafico">
      {/* SIN cabecera propia: decía la escala ("Ingresos por día") y el hint de abajo ya
          la dice ("Un punto por día · clic para acotar…"). Era el mismo dato dos veces,
          y en la zona fija cada línea se paga en filas de libro. El modo método SÍ la
          lleva: ahí no hay hint, y el eyebrow es su única etiqueta. */}
      <div ref={cajaRef} className="admin-grafico__caja" style={{ height: alto }}>
        {ancho > 0 && (
          <svg width={ancho} height={alto} role="img"
               aria-label={`Ingresos por ${UNIDAD[escala as Escala]}, ${n} períodos`}
               // Hover del mouse + scrub del dedo, y descarte por tap-fuera: TODO en
               // `useCurvaHover` (mecanismo único). `touch-action: pan-y` (abajo) manda el
               // arrastre horizontal a JS y deja el vertical al scroll.
               onPointerMove={alMover}
               onPointerLeave={alSalir}
               // ACOTAR lo decide el `click`, y el slop del navegador decide si hay click:
               // un tap (movimiento < slop del SO: ~8px Chromium / ~10px iOS) dispara click
               // → acota; un arrastre (> slop) NO dispara click → sólo leyó el valor. Por
               // eso el umbral no lo elige el código —lo pone la plataforma, que ya sabe qué
               // es un tap en cada SO—.
               onClick={() => {
                 if (hov === null) return;
                 const s = series[hov];
                 onBucket({ escala: escala as Escala, key: s.bucket.key, etiqueta: etiquetaBucket(s.bucket.inicio, escala as Escala) });
               }}
               style={{ display: 'block', cursor: 'pointer', touchAction: 'pan-y' }}>
            {/* Área en ÁMBAR, gradiente tenue 10%→0% (§ el sitio decide: una superficie
                de DATO lleva firma de marca, no estado). Misma decisión que la curva de
                Hoy; el % del tope se afina por tema en el gate. La LÍNEA y los marcadores
                siguen en TINTA —Pagos es un libro de período, no tiene "ahora"—. */}
            <defs>
              <linearGradient id="curvaPagosArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--duna-sol)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="var(--duna-sol)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#curvaPagosArea)" />
            <path d={linea} fill="none" stroke="var(--duna-ink)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />

            {/* Guía del hover: punteada, y el punto sobre la curva. */}
            {hov !== null && (
              <g>
                <line x1={puntos[hov].x} y1={PAD_TOP} x2={puntos[hov].x} y2={alto}
                      stroke="var(--duna-border-2)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={puntos[hov].x} cy={puntos[hov].y} r="3.5" fill="var(--duna-ink)" />
              </g>
            )}

            {/* PICO: punto relleno + su cifra abreviada. Sin ámbar — nada acá pide
                atención; es tinta, como todo el gráfico. */}
            {iPico >= 0 && (
              <g>
                <circle cx={puntos[iPico].x} cy={puntos[iPico].y} r="3" fill="var(--duna-ink)" />
                <text x={Math.min(ancho - 4, Math.max(4, puntos[iPico].x))} y={Math.max(11, puntos[iPico].y - 9)}
                      textAnchor={puntos[iPico].x > ancho - 44 ? 'end' : puntos[iPico].x < 44 ? 'start' : 'middle'}
                      fill="var(--duna-ink)" style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--duna-font-ui)' }}>
                  {abreviaCOP(series[iPico].total)}
                </text>
              </g>
            )}

            {/* HOY: punto hueco. */}
            {iHoy >= 0 && (
              <circle cx={puntos[iHoy].x} cy={puntos[iHoy].y} r="3" fill="var(--duna-bg)"
                      stroke="var(--duna-ink)" strokeWidth="1.5" />
            )}

            {/* SELECCIÓN: anillo sobre el punto recortado. */}
            {iSel >= 0 && (
              <circle cx={puntos[iSel].x} cy={puntos[iSel].y} r="6" fill="none"
                      stroke="var(--duna-ink)" strokeWidth="1.5" />
            )}
          </svg>
        )}

        {/* El tooltip usa la superficie del sistema (`.admin-tooltip`, chip invertido). */}
        {hov !== null && ancho > 0 && (
          <div className="admin-tooltip"
               style={{
                 position: 'absolute', left: puntos[hov].x, top: Math.max(0, puntos[hov].y - 12),
                 transform: `translate(${puntos[hov].x > ancho - 90 ? '-100%' : puntos[hov].x < 90 ? '0' : '-50%'}, -100%)`,
                 pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2,
               }}>
            {formatCOP(series[hov].total)} · {etiquetaBucket(series[hov].bucket.inicio, escala as Escala)}
            {' · '}{series[hov].conteo} {series[hov].conteo === 1 ? 'pago' : 'pagos'}
          </div>
        )}
      </div>

      <div className="admin-grafico__eje">
        {series.map((s, i) => (
          <span key={s.bucket.key} className={s.bucket.parcial ? 'is-parcial' : undefined}
                style={{ left: ancho > 0 ? xDe(i) : 0, visibility: i % paso === 0 ? 'visible' : 'hidden' }}>
            {etiquetaEje(s.bucket.inicio, escala as Escala)}{s.bucket.parcial ? ' ·' : ''}
          </span>
        ))}
      </div>

      <p className="admin-grafico__hint">
        Un punto por {UNIDAD[escala as Escala]} · clic para acotar el libro a ese {UNIDAD[escala as Escala]}
        {series.some(s => s.bucket.parcial) ? ' · «·» = período parcial' : ''}
      </p>
    </div>
  );
}
