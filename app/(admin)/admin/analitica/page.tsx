'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend,
} from 'recharts';
import { formatCOP } from '@/lib/utils';
import { getAnalytics, getWeeklyActivity } from '@/lib/api/analytics';
import { ANALITICS_COLORS, tooltipStyle, axisTickStyle } from '@/constants/dashb-styles';
import { widgetInsight, type InsightMonthPoint } from '@/lib/metrics/insights';
import { PERIODOS, PERIODO_ORDEN, PERIODO_DEFAULT, type PeriodoKey } from '@/lib/metrics/periodo';
import { CARTERA_DIAS_MEDIO } from '@/lib/metrics/cartera';
import { TOP_CONCENTRACION } from '@/lib/metrics/concentracion';
import type { AnalyticsData, WeeklyActivityData } from '@/types/analytics';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedWeek, zonedDayKey } from '@/lib/timezone';

// ANALÍTICA — cuatro preguntas de dueño, cada una atada a una decisión:
//
//   1. RENTABILIDAD  ¿estoy ganando o solo vendiendo?    → qué SKU sostener
//   2. CARTERA       ¿cuánta plata mía está en la calle?  → a quién cobrar
//   3. TRAYECTORIA   ¿el negocio crece?                   → si el rumbo sirve
//   4. CLIENTES      ¿quién y por dónde?                  → dónde concentrar
//
// El principio que gobierna qué entra: si una sección no cambia ninguna decisión,
// es decoración. Por eso murieron las cuatro KPI cards viejas (un margen promedio
// del catálogo que no miraba una sola venta, una retención sobre clientes que
// nunca compraron) y el grid de "Productos Más Vendidos" + "Ingresos por
// Producto" — dos vistas del mismo dato rankeado por el criterio equivocado, que
// la tabla del bloque 1 reemplaza ordenando por PLATA DEJADA.

// ─── Piezas compartidas ───────────────────────────────────────────────────────

function Bloque({ n, titulo, pregunta, sub, accion, children }: {
  n:        number;
  titulo:   string;
  /** La pregunta de dueño. Es el subtítulo REAL del bloque, no un adorno. */
  pregunta: string;
  sub?:     string;
  accion?:  React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold text-muted-foreground/60 tabular-nums">{n}</span>
            <h2 className="text-lg font-semibold">{titulo}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{pregunta}</p>
          {sub && <p className="text-xs text-muted-foreground/80 mt-0.5">{sub}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Panel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-card border border-border rounded-xl p-5 ${className}`}>{children}</div>;
}

/**
 * Fallback honesto: el hecho de que no hay dato, no un gráfico vacío. Patrón del
 * dashboard — un chart con los ejes dibujados y sin serie se lee como "el negocio
 * está en cero" cuando lo que pasa es que no hay nada que medir todavía.
 */
function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

/**
 * La línea de insight de la escalera de `lib/metrics/insights.ts`, aplicada a un
 * chart en vez de a una stat card. Mismo tratamiento visual que allá: muted, sin
 * icono ni color (Amber Minimal — el rojo está reservado a alertas reales), y el
 * énfasis por tono neutro, nunca por semántica.
 */
function LineaInsight({ serie }: { serie: InsightMonthPoint[] }) {
  const insight = widgetInsight({ serie });
  if (!insight) return null;
  return (
    <p className={`text-xs mt-1 ${insight.enfasis ? 'text-foreground/70' : 'text-muted-foreground'}`}>
      {insight.text}
    </p>
  );
}

// ─── 1. RENTABILIDAD ──────────────────────────────────────────────────────────

function SelectorPeriodo({ valor, onChange, disabled }: {
  valor:    PeriodoKey;
  onChange: (p: PeriodoKey) => void;
  disabled: boolean;
}) {
  // Segmented control NEUTRO: el ámbar sólido de la vista está reservado a la
  // acción principal de la página, y elegir un período no lo es. El seleccionado
  // se marca con `bg-muted` + peso, dentro de la familia neutra.
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Período">
      {PERIODO_ORDEN.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          disabled={disabled}
          aria-pressed={valor === key}
          className={`rounded-md px-3 py-1 text-xs transition-colors disabled:opacity-50 disabled:pointer-events-none ${
            valor === key
              ? 'bg-muted font-semibold text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          {PERIODOS[key]}
        </button>
      ))}
    </div>
  );
}

function Rentabilidad({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  const r = data?.rentabilidad;

  if (loading) {
    return (
      <Panel>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full mt-6" />
      </Panel>
    );
  }
  if (!r || r.filas.length === 0) {
    return (
      <Panel>
        <Vacio>
          Sin ventas cobradas en este período.
          {r && r.residual.ingresos > 0 && (
            <span className="block mt-1 text-xs">
              Hay {formatCOP(r.residual.ingresos)} vendidos que no se pudieron costear.
            </span>
          )}
        </Vacio>
      </Panel>
    );
  }

  return (
    <Panel>
      {/* Header: margen bruto del período. La nota de al lado NO es decorativa —
          declara que el costo no está snapshoteado (ver lib/metrics/margen.ts). */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Margen bruto del período</p>
          <p className="text-3xl font-bold">{formatCOP(r.margenTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCOP(r.ingresos)} en mercancía − {formatCOP(r.costo)} de costo
            {r.margenPct !== null && ` · ${r.margenPct.toFixed(1)}%`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground max-w-xs sm:text-right">
          Margen estimado con el costo ACTUAL del catálogo, sobre órdenes pagadas.
          Mercancía sin envío.
        </p>
      </div>

      <div className="overflow-x-auto -mx-5 px-5 mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left font-medium py-2">Producto</th>
              <th className="text-right font-medium py-2 whitespace-nowrap">Uds</th>
              <th className="text-right font-medium py-2 whitespace-nowrap">Ingresos</th>
              <th className="text-right font-medium py-2 whitespace-nowrap">Margen / ud</th>
              {/* La columna que ORDENA la tabla: plata dejada, no volumen. */}
              <th className="text-right font-medium py-2 whitespace-nowrap">Margen total</th>
            </tr>
          </thead>
          <tbody>
            {r.filas.map(f => (
              <tr key={f.productoId} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-3">
                  <Link
                    href={`/admin/productos?producto=${encodeURIComponent(f.productoId)}`}
                    title={`Ver ${f.producto}`}
                    className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {f.producto}
                  </Link>
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{f.unidades}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{formatCOP(f.ingresos)}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {f.margenUnitario === null ? '—' : formatCOP(f.margenUnitario)}
                </td>
                {/* Un margen negativo se pinta rojo: es una alerta REAL (se está
                    vendiendo por debajo del costo), el único caso en que Amber
                    Minimal admite color semántico en esta tabla. */}
                <td className={`py-2 text-right tabular-nums font-semibold ${f.margenTotal < 0 ? 'text-destructive' : ''}`}>
                  {formatCOP(f.margenTotal)}
                  {f.margenPct !== null && (
                    <span className="ml-2 font-normal text-xs text-muted-foreground">{f.margenPct.toFixed(0)}%</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* El residual es un HECHO declarado, no un silencio. Costear en 0 lo que no
          se pudo costear convertiría un dato faltante en "margen 100%". */}
      {r.residual.ingresos > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {r.residual.productos} {r.residual.productos === 1 ? 'producto' : 'productos'} sin costo
          resoluble ({r.residual.unidades} uds, {formatCOP(r.residual.ingresos)}) quedan fuera del
          margen: su línea no resuelve a un producto del catálogo.
        </p>
      )}

      <p className="text-xs text-muted-foreground/80 mt-3 pt-3 border-t border-border">
        El costo por producto es dato del seed hasta la sesión con el cliente —
        mismo estatus que el stock mínimo. Los números se vuelven verdaderos cuando
        se carguen los costos reales.
      </p>
    </Panel>
  );
}

// ─── 2. CARTERA ───────────────────────────────────────────────────────────────

function Cartera({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <Panel key={i}><Skeleton className="h-16 w-full" /></Panel>)}
      </div>
    );
  }
  const c = data?.cartera;
  if (!c || c.conteo === 0) {
    // El bloque RESPIRA, no grita: cero cartera es la mejor noticia posible.
    return <Panel><Vacio>Nada pendiente de cobro.</Vacio></Panel>;
  }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-xs text-muted-foreground mb-1">Total por cobrar</p>
        <p className="text-3xl font-bold">{formatCOP(c.total)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {c.conteo} {c.conteo === 1 ? 'orden pendiente' : 'órdenes pendientes'} · saldo vigente, sin período
        </p>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {c.buckets.map(b => {
          const vencido = b.bucket === 'vencido' && b.conteo > 0;
          const contenido = (
            <>
              <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
              <p className={`text-xl font-bold ${vencido ? 'text-destructive' : ''}`}>{formatCOP(b.monto)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {b.conteo} {b.conteo === 1 ? 'orden' : 'órdenes'}
              </p>
            </>
          );
          // Un bucket vacío NO linkea: una lista vacía al otro lado promete una
          // navegación que no lleva a nada (misma regla que `CustomerLink`).
          if (b.conteo === 0) {
            return <Panel key={b.bucket} className="opacity-60">{contenido}</Panel>;
          }
          return (
            <Link
              key={b.bucket}
              href={`/admin/ordenes?${b.query}`}
              className="group bg-card border border-border rounded-xl p-5 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {contenido}
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                Ver órdenes <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground/80">
        La cartera cuenta lo mismo que la lista de Órdenes a la que llevan estos
        enlaces: es una lista de trabajo, no una medición, así que su contrato es
        cuadrar con esa lista. El resto de esta página excluye las órdenes de demo
        (<code className="text-[11px]">SN-</code>); esta sección no. Los cortes de
        7 y {CARTERA_DIAS_MEDIO} días son provisionales hasta definir la política
        de cobro.
      </p>
    </div>
  );
}

// ─── 3. TRAYECTORIA ───────────────────────────────────────────────────────────

function Trayectoria({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  const serie = useMemo(() => data?.trayectoria ?? [], [data]);

  // Prehistoria fuera: los meses ANTERIORES a la primera venta no son historia
  // con valor 0, son ventana vacía. Sin este corte un negocio de 3 meses
  // "cumpliría" los 6 del promedio semestral rellenando con ceros y la página
  // anunciaría un hecho inventado. Mismo criterio que `mesesCerrados`.
  const desdeLaPrimera = useMemo(() => {
    const i = serie.findIndex(p => p.ingresos > 0 || p.ordenes > 0);
    return i === -1 ? [] : serie.slice(i);
  }, [serie]);

  // Las series de los insights: una por línea, cada una con SU valor y la misma
  // base de muestra (órdenes cobradas del mes).
  const serieIngresos: InsightMonthPoint[] = desdeLaPrimera.map(p => ({ month: p.month, value: p.ingresos, ordenes: p.ordenes, cerrado: p.cerrado }));
  const serieMargen:   InsightMonthPoint[] = desdeLaPrimera.map(p => ({ month: p.month, value: p.margen,   ordenes: p.ordenes, cerrado: p.cerrado }));

  if (loading) return <Panel><Skeleton className="h-64 w-full" /></Panel>;
  if (desdeLaPrimera.length === 0) {
    return <Panel><Vacio>Sin ventas cobradas todavía — no hay trayectoria que dibujar.</Vacio></Panel>;
  }

  return (
    <Panel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Ingresos</h3>
          <p className="text-xs text-muted-foreground">Pagos recibidos, incluye envío</p>
          <LineaInsight serie={serieIngresos} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Margen estimado</h3>
          <p className="text-xs text-muted-foreground">Mercancía sin envío, costo actual</p>
          <LineaInsight serie={serieMargen} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={desdeLaPrimera}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={axisTickStyle} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTickStyle} axisLine={false} tickLine={false}
            tickFormatter={v => `$${((v as number) / 1_000_000).toFixed(1)}M`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [formatCOP(v as number), name === 'ingresos' ? 'Ingresos' : 'Margen est.']}
          />
          <Legend formatter={v => (v === 'ingresos' ? 'Ingresos' : 'Margen est.')} wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="ingresos" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} />
          {/* Punteada: es una ESTIMACIÓN (costo actual, no snapshoteado), y la
              línea lo dice sin obligar a leer la nota. */}
          <Line type="monotone" dataKey="margen" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="5 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground/80 mt-2">
        El mes en curso se dibuja pero no cuenta para las tendencias: está
        incompleto. Una orden entra al mes en que se COBRÓ, no en el que se creó.
      </p>
    </Panel>
  );
}

// ─── 4. CLIENTES Y CANALES ────────────────────────────────────────────────────

function Concentracion({ data }: { data: AnalyticsData }) {
  const { concentracion: c, recurrencia } = data;

  return (
    <Panel>
      <h3 className="font-semibold mb-1">Concentración de ingresos</h3>
      {c.pct === null ? (
        <p className="text-xs text-muted-foreground mb-4">
          Muestra aún pequeña para hablar de concentración.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mb-4">
          El {c.pct.toFixed(0)}% de tus ingresos viene de {c.top.length} clientes.
        </p>
      )}

      {c.top.length === 0 ? (
        <Vacio>Sin clientes con pagos registrados.</Vacio>
      ) : (
        <div className="space-y-2">
          {c.top.map((cl, i) => (
            <Link
              key={cl.id}
              href={`/admin/clientes/${cl.id}`}
              className="flex items-center gap-3 -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">{cl.nombre?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{cl.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {cl.ordenes} {cl.ordenes === 1 ? 'orden' : 'órdenes'}
                </p>
              </div>
              <p className="text-xs font-bold text-primary">{formatCOP(cl.total)}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-1">Recurrencia</p>
        <p className="text-2xl font-bold">{recurrencia.pct}%</p>
        {/* El sub DECLARA la fórmula, igual que en la página de Clientes: sin el
            "N de M", un porcentaje de recurrencia se lee como cualquier cosa. */}
        <p className="text-xs text-muted-foreground mt-1">
          {recurrencia.recurrentes} de {recurrencia.clientes} clientes con más de 1 compra
        </p>
      </div>
    </Panel>
  );
}

function Canales({ data }: { data: AnalyticsData }) {
  const { canales } = data;
  const max = canales[0]?.value ?? 1;

  return (
    <Panel>
      <h3 className="font-semibold mb-1">Canales de venta</h3>
      <p className="text-xs text-muted-foreground mb-4">Órdenes del año en curso, por dónde llegó el cliente</p>
      {canales.length === 0 ? (
        <Vacio>Sin órdenes este año.</Vacio>
      ) : (
        // Barras y no pie: son 2–4 categorías y lo que se compara son magnitudes,
        // que una barra responde de un vistazo y un pie obliga a estimar ángulos.
        <div className="space-y-3">
          {canales.map((c, i) => (
            <div key={c.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.value} {c.value === 1 ? 'orden' : 'órdenes'} · {c.pct.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${(c.value / max) * 100}%`, background: ANALITICS_COLORS[i % ANALITICS_COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Actividad Semanal (weekly, navigable) ────────────────────────────────────
// SOBREVIVE del grid anterior sin cambios de fondo: ya cumplía el estándar
// (bucketing de día EN SQL y en America/Bogota, solo `CN-`, no canceladas) — era
// la única parte de la página que lo hacía. Se integra al bloque 4 en vez de
// reescribirse.
//
// ONE Monday–Sunday week at a time, navigated with ‹ › (same visual pattern as
// the Dashboard carousel arrows). ‹ goes back without limit; › is disabled on the
// current week — there are no future weeks.

const ZERO_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  .map(dia => ({ dia, ordenes: 0, ingresos: 0 }));

// "20 – 26 de jul" (same month) / "30 de jun – 6 de jul" (crossing months).
const WEEK_DAY   = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: BUSINESS_TZ });
const WEEK_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: BUSINESS_TZ });

function weekRangeLabel(monday: Date): string {
  const sunday = startOfZonedDay(monday, BUSINESS_TZ, 6);
  const month = (d: Date) => WEEK_MONTH.format(d).replace('.', '');
  if (month(monday) === month(sunday)) {
    return `${WEEK_DAY.format(monday)} – ${WEEK_DAY.format(sunday)} de ${month(sunday)}`;
  }
  return `${WEEK_DAY.format(monday)} de ${month(monday)} – ${WEEK_DAY.format(sunday)} de ${month(sunday)}`;
}

function WeeklyActivityCard() {
  // Week shown = current week + offset (0 = current, -1 = previous, …).
  const [offset, setOffset] = useState(0);
  const [data, setData]     = useState<WeeklyActivityData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const monday  = useMemo(() => startOfZonedWeek(new Date(), BUSINESS_TZ, offset), [offset]);
  const weekKey = zonedDayKey(monday, BUSINESS_TZ);

  useEffect(() => {
    let active = true;
    getWeeklyActivity(weekKey)
      .then(result => { if (active) setData(result); })
      .catch(()     => { if (active) setFailed(weekKey); });
    // Ignore an in-flight response once the week changed again.
    return () => { active = false; };
  }, [weekKey]);

  // Derived, carousel-style: loading = the visible week isn't the loaded one.
  // Navigation keeps the LAST loaded bars mounted (dimmed) — no unmount flash.
  const error   = failed === weekKey;
  const loading = !error && data?.week !== weekKey;
  const rows    = data?.days ?? ZERO_WEEK;
  const isEmpty = !loading && !error && rows.every(d => d.ordenes === 0);

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold mb-1">Actividad semanal</h3>
          {/* The number means nothing without its week — always show the range. */}
          <p className="text-xs text-muted-foreground">
            Órdenes por día · {weekRangeLabel(monday)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset(o => o - 1)}
            aria-label="Semana anterior"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setOffset(o => Math.min(0, o + 1))}
            disabled={offset === 0}
            aria-label="Semana siguiente"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Chart stays MOUNTED while navigating; loading just dims it. */}
        <div className={loading ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rows} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia"  tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis               tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="ordenes" name="Órdenes" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {error && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            No se pudo cargar la semana.
          </p>
        )}
        {isEmpty && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            Sin órdenes esta semana
          </p>
        )}
      </div>
    </Panel>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analitica() {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [failed, setFailed]   = useState<PeriodoKey | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoKey>(PERIODO_DEFAULT);

  useEffect(() => {
    let active = true;
    getAnalytics(periodo)
      .then(d => { if (active) setData(d); })
      .catch(() => { if (active) setFailed(periodo); });
    // Ignora una respuesta en vuelo si el período cambió de nuevo.
    return () => { active = false; };
  }, [periodo]);

  // DERIVADO, no seteado en el effect: cargando = el período visible no es el que
  // trajo la respuesta. Es el mismo mecanismo que la card semanal de abajo (que
  // compara contra el `week` que el server devuelve), y funciona porque el
  // endpoint hace eco del período que resolvió. Un `setLoading(true)` síncrono
  // dentro del effect provoca un render en cascada por cada cambio de período.
  const error   = failed === periodo;
  const loading = !error && data?.periodo.key !== periodo;

  // Con error NO se muestran los datos del período anterior: el selector diría
  // "mes anterior" sobre las cifras del mes en curso, que es peor que no mostrar
  // nada. El selector queda vivo — cambiar de período ES el reintento.
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">Analítica</h1>
          <SelectorPeriodo valor={periodo} onChange={setPeriodo} disabled={false} />
        </div>
        <Panel><Vacio>No se pudo cargar la analítica.</Vacio></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Analítica</h1>
        <p className="text-sm text-muted-foreground">
          Cuatro preguntas del negocio, y qué decisión cambia cada una
        </p>
      </div>

      <Bloque
        n={1}
        titulo="Rentabilidad"
        pregunta="¿Estoy ganando o solo vendiendo?"
        sub={data ? `Órdenes cobradas · ${data.periodo.label.toLowerCase()}` : undefined}
        accion={<SelectorPeriodo valor={periodo} onChange={setPeriodo} disabled={loading} />}
      >
        <Rentabilidad data={data} loading={loading} />
      </Bloque>

      <Bloque
        n={2}
        titulo="Cartera"
        pregunta="¿Cuánta plata mía está en la calle?"
        sub="Órdenes sin pago registrado, por antigüedad"
      >
        <Cartera data={data} loading={loading} />
      </Bloque>

      <Bloque
        n={3}
        titulo="Trayectoria"
        pregunta="¿El negocio crece?"
        sub="Últimos 12 meses, desde la primera venta"
      >
        <Trayectoria data={data} loading={loading} />
      </Bloque>

      <Bloque
        n={4}
        titulo="Clientes y canales"
        pregunta="¿Quién compra, y por dónde llega?"
        sub={`Top ${TOP_CONCENTRACION} por dinero pagado · año en curso`}
      >
        {loading || !data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel><Skeleton className="h-56 w-full" /></Panel>
            <Panel><Skeleton className="h-56 w-full" /></Panel>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Concentracion data={data} />
            <div className="space-y-4">
              <Canales data={data} />
              <WeeklyActivityCard />
            </div>
          </div>
        )}
      </Bloque>
    </div>
  );
}
