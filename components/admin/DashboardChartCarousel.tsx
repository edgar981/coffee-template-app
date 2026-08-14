'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getDashboardChart } from '@/lib/api/dashboard';
import {
  CHART_RANGES, CHART_RANGE_LABEL,
  type ChartRange, type DashboardChartData,
} from '@/types/dashboard';
import { formatCOP } from '@duna/core/utils';
import { axisTickStyle } from '@/constants/dashb-styles';
// Misma flecha que el pie de distribución (extraída de aquí para compartirla).
import ArrowButton from '@/components/admin/ChartArrowButton';

// Two daily charts in one card, flipped with the ‹ › arrows. The range selector
// is shared: switching charts keeps the window, because `range` lives above both
// and one fetch returns both series.
//
// Ventas is PAYMENT-based (the method money actually arrived by) — see the
// endpoint for why Order.metodo_pago isn't the source.

type ChartId = 'ventas' | 'pedidos';

/**
 * Both series share the shape `{ date, ...numeric buckets }`, and the card
 * renders whichever is active through one set of Recharts elements keyed by
 * `spec.series`. This is that common row.
 */
type ChartRow = { date: string } & Record<string, string | number>;

interface Series {
  key:   string;
  label: string;
  color: string;
}

interface ChartSpec {
  id:       ChartId;
  title:    string;
  series:   Series[];
  /** Tooltip + Y-axis formatting. */
  format:   (value: number) => string;
  axisTick: (value: number) => string;
}

// Warm saturated amber→brown chart ramp, stepped by luminosity (saturation stays
// high — that's the "life"). SERIE_1/SERIE_2 are the two headline series of each
// chart; the residual bucket stays muted grey so it never reads as a headline
// series. SERIE_2 uses --chart-3 (not --chart-2): --chart-1 and --chart-3 sit
// ~15pp of lightness apart, more separable than the ~7pp of --chart-2.
const SERIE_1 = 'hsl(var(--chart-1))';
const SERIE_2 = 'hsl(var(--chart-3))';
const MUTED   = 'hsl(var(--muted-foreground))';

const CHARTS: ChartSpec[] = [
  {
    id:       'ventas',
    title:    'Ventas',
    series: [
      { key: 'efectivo',      label: 'Efectivo',      color: SERIE_1  },
      { key: 'transferencia', label: 'Transferencia', color: SERIE_2 },
      { key: 'otro',          label: 'Otro',          color: MUTED },
    ],
    format:   formatCOP,
    axisTick: v => {
      if (v === 0) return '$0';
      return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}k`;
    },
  },
  {
    id:       'pedidos',
    title:    'Pedidos',
    series: [
      { key: 'g250',  label: '250 g', color: SERIE_1  },
      { key: 'g500',  label: '500 g', color: SERIE_2 },
      { key: 'otros', label: 'Otros', color: MUTED },
    ],
    format:   v => String(v),
    axisTick: v => String(v),
  },
];

// "5 may" — Spanish, no year (the range selector already frames the window).
const DAY_LABEL = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function formatDay(date: string): string {
  // `date` is a bare YYYY-MM-DD day key; parsing it as UTC and formatting in UTC
  // keeps it the same calendar day regardless of the viewer's timezone.
  return DAY_LABEL.format(new Date(`${date}T00:00:00Z`)).replace('.', '');
}

export default function DashboardChartCarousel() {
  const router = useRouter();
  const [range, setRange]   = useState<ChartRange>('3m');
  const [index, setIndex]   = useState(0);
  const [data, setData]     = useState<DashboardChartData | null>(null);
  const [failed, setFailed] = useState<ChartRange | null>(null);

  const spec = CHARTS[index];

  // Clic en un día → los pedidos creados ESE día. Recharts devuelve el punto en
  // `activeLabel` (el valor de x = nuestro day key `YYYY-MM-DD`), y se navega a la
  // lista acotada a ese día de Bogotá. Aplica a las DOS gráficas (comparten eje x).
  //
  // ── EL DESTINO NO MIDE LO MISMO QUE LA GRÁFICA, y hay que saberlo ───────────
  //
  // Se migra la ruta TAL CUAL —de `/admin/ordenes` a `/admin/pedidos`— sin tocar la
  // discrepancia, que es anterior a esta tanda y no se arregla acá (owner):
  //
  //   · "Ventas" mide PLATA RECIBIDA ese día, por `Payment.fecha`. El enlace lleva
  //     a órdenes CREADAS ese día: un pago de hoy sobre una orden de la semana
  //     pasada está en la barra y no en la lista.
  //   · "Pedidos" mide LÍNEAS de producto por peso, sobre órdenes ya PAGADAS. El
  //     enlace lleva a órdenes de cualquier estado, y cuenta órdenes, no líneas.
  //
  // Arreglarlo pide un destino en PAGOS para la primera —otra pantalla, otra
  // decisión— así que queda anotado con su disparador en el backlog: cuando se
  // rediseñe Analítica o Pagos. Migrarlo callado habría sido llevarse el defecto a
  // la pantalla nueva como si fuera una propiedad suya.
  const handleDayClick = (state: { activeLabel?: string | number } | null) => {
    const day = state?.activeLabel;
    if (typeof day === 'string' && day) {
      router.push(`/admin/pedidos?desde=${day}&hasta=${day}`);
    }
  };

  useEffect(() => {
    let active = true;
    getDashboardChart(range)
      .then(result => { if (active) setData(result); })
      .catch(()     => { if (active) setFailed(range); });
    // Ignore an in-flight response once the range changed again.
    return () => { active = false; };
  }, [range]);

  // Loading/error are DERIVED from which range the state belongs to — the
  // endpoint echoes `range` back for exactly this. Flipping the range makes the
  // card loading again without a synchronous setState inside the effect.
  const error   = failed === range;
  const loading = !error && data?.range !== range;

  const rows = useMemo<ChartRow[]>(
    () => (data ? (spec.id === 'ventas' ? data.ventas : data.pedidos) : []),
    [data, spec.id],
  );

  // Render order for the OVERLAID areas: biggest series first (background) so
  // smaller ones stay visible on top. Legend/tooltip keep the spec order.
  const renderSeries = useMemo(
    () =>
      [...spec.series].sort((a, b) => {
        const total = (s: Series) => rows.reduce((sum, r) => sum + Number(r[s.key] ?? 0), 0);
        return total(b) - total(a);
      }),
    [spec.series, rows],
  );

  // Zero-filled days are still rows, so "empty" means every series is 0.
  const isEmpty = rows.length > 0 && rows.every(row =>
    spec.series.every(s => (row[s.key] ?? 0) === 0),
  );

  const step = (delta: number) =>
    setIndex(i => (i + delta + CHARTS.length) % CHARTS.length);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header: ‹ title › + shared range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1">
          <ArrowButton label="Gráfico anterior" onClick={() => step(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </ArrowButton>
          <div className="px-1">
            <h3 className="font-semibold text-foreground">{spec.title}</h3>
          </div>
          <ArrowButton label="Gráfico siguiente" onClick={() => step(1)}>
            <ChevronRight className="w-4 h-4" />
          </ArrowButton>
        </div>

        <div role="group" aria-label="Rango de fechas" className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {CHART_RANGES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {CHART_RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3">
        {spec.series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ChartMessage>No se pudo cargar el gráfico.</ChartMessage>
      ) : isEmpty ? (
        <ChartMessage>
          {spec.id === 'ventas' ? 'Sin ventas en este período' : 'Sin pedidos en este período'}
        </ChartMessage>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            onClick={handleDayClick}
            className="cursor-pointer [&_.recharts-area]:cursor-pointer"
          >
            <defs>
              {spec.series.map(s => (
                <linearGradient key={s.key} id={`fill-${spec.id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  {/* Low opacity on purpose: the areas OVERLAP (not stacked), so
                      each fill must stay readable through the ones above it. */}
                  <stop offset="5%"  stopColor={s.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date" tick={axisTickStyle} axisLine={false} tickLine={false}
              minTickGap={24} tickFormatter={formatDay}
            />
            <YAxis
              tick={axisTickStyle} axisLine={false} tickLine={false}
              width={52} allowDecimals={false} tickFormatter={spec.axisTick}
            />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))' }}
              content={<BreakdownTooltip spec={spec} />}
            />
            {/* NO stackId: each series draws its OWN daily value. Stacked areas
                made the top line trace the CUMULATIVE edge — the grey "Otro"
                calcaba el total del día mientras su tooltip decía $0. The
                per-day total lives in the tooltip, not in a line. */}
            {renderSeries.map(s => (
              <Area
                key={s.key}
                type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color} strokeWidth={2}
                fill={`url(#fill-${spec.id}-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

// Recharts passes `payload` as the hovered day's series entries. Rendered with
// one swatch row per category plus the day's total — the ONLY place the total
// lives now that the areas overlap instead of stacking.
function BreakdownTooltip({ spec, active, payload, label }: {
  spec: ChartSpec;
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const byKey = new Map(payload.map(p => [String(p.dataKey), p.value ?? 0]));
  const total = spec.series.reduce((sum, s) => sum + (byKey.get(s.key) ?? 0), 0);

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{formatDay(label)}</p>
      <div className="space-y-1">
        {spec.series.map(s => (
          <div key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {spec.format(byKey.get(s.key) ?? 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-border pt-1.5">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold text-foreground tabular-nums">{spec.format(total)}</span>
      </div>
      {/* Affordance for the chart-day drill-down (AreaChart onClick). */}
      <p className="mt-1.5 text-[10px] italic text-muted-foreground/70">Click para ver órdenes del día</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[220px] animate-pulse">
      <div className="flex h-full items-end gap-1.5">
        {[38, 55, 30, 68, 46, 74, 52, 62, 34, 58, 70, 44].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-muted" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function ChartMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
