'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';
import { formatCOP } from '@/lib/utils';
import { getAnalytics, getWeeklyActivity } from '@/lib/api/analytics';
import { ANALITICS_COLORS, tooltipStyle, axisTickStyle } from '@/constants/dashb-styles';
import type { AnalyticsData, CanalData, WeeklyActivityData } from '@/types/analytics';
import { EMPTY_ANALYTICS } from '@/constants/analytics';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedWeek, zonedDayKey } from '@/lib/timezone';

// ─── MetricCard ───────────────────────────────────────────────────────────────
// SIN trend. Las cuatro tarjetas traían uno escrito a mano ("+149% vs 2023",
// "+6.1% este mes", "+3.2%", "-1.2%") que no salía de ningún lado: números fijos
// en el JSX que no se movían pasara lo que pasara con el negocio. Se eliminan en
// vez de reemplazarse porque calcular la comparativa contra el período anterior
// no es barato desde este endpoint, y eso es del rediseño diferido. Una tarjeta
// sin trend es honesta; una con trend inventado entrena a desconfiar de la
// página entera.

interface MetricCardProps {
  label:    string;
  value:    string;
  sub?:     string;
  loading?: boolean;
}

function MetricCard({ label, value, sub, loading }: MetricCardProps) {
  return (
    <div className="stat-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded mt-1" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Actividad Semanal (weekly, navigable) ────────────────────────────────────
// ONE Monday–Sunday week (America/Bogota) at a time, navigated with ‹ › (same
// visual pattern as the Dashboard carousel arrows). ‹ goes back without limit;
// › is disabled on the current week — there are no future weeks. Data comes
// from /api/analytics/weekly via lib/api (SQL weekday bucketing, CN- only,
// non-cancelled), zero-filled, so the bars always render Lun→Dom.

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
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold mb-1">Actividad Semanal</h3>
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analitica() {
  const [data, setData]       = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const { kpis, salesByMonth, canalData, topProducts } = data;

  // Ranking real: la barra se escala contra el más vendido de la lista.
  const maxUnidades = topProducts[0]?.unidades ?? 1;
  const sinVentas   = !loading && topProducts.length === 0;

  // Add fill colors to canal data
  const canalDataWithColors: CanalData[] = canalData.map((item, i) => ({
    ...item,
    fill: ANALITICS_COLORS[i % ANALITICS_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analítica</h1>
        <p className="text-sm text-muted-foreground">Inteligencia de negocio en tiempo real</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard loading={loading} label="Ingresos Anuales"  value={formatCOP(kpis.totalRevenue)}   sub={`${kpis.totalOrders} órdenes`} />
        {/* Mismo nombre que la tarjeta del Dashboard — una métrica, un nombre. */}
        <MetricCard loading={loading} label="Promedio por orden" value={formatCOP(kpis.ticketPromedio)} sub="Por orden" />
        {/* El sub DECLARA la fórmula: el número es recurrentes/total, el mismo
            corte que la Tasa Recurrencia de Clientes. Sin eso, "Retención" a
            secas se lee como cualquier cosa. */}
        <MetricCard loading={loading} label="Tasa Retención"    value={`${kpis.tasaRetencion}%`}       sub={`Con más de 1 compra · ${kpis.totalCustomers} clientes`} />
        <MetricCard loading={loading} label="Margen Bruto Est." value={`${kpis.margenBruto}%`}         sub="Promedio portafolio" />
      </div>

      {/* Revenue trend + channels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Tendencia de Ingresos y Órdenes</h3>
          <p className="text-xs text-muted-foreground mb-4">Evolución mensual {new Date().getFullYear()}</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `$${((v as number) / 1_000_000).toFixed(1)}M`}
              />
              <YAxis
                yAxisId="right" orientation="right"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [
                  name === 'ventas' ? formatCOP(v as number) : v,
                  name === 'ventas' ? 'Ventas' : 'Órdenes',
                ]}
              />
              <Legend formatter={v => v === 'ventas' ? 'Ventas' : 'Órdenes'} wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left"  type="monotone" dataKey="ventas"  stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="ordenes" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Canales de Venta</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribución de órdenes</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={canalDataWithColors.length > 0 ? canalDataWithColors : [{ name: 'Sin datos', value: 1, fill: 'hsl(var(--muted))' }]}
                cx="50%" cy="50%"
                innerRadius={40} outerRadius={65}
                paddingAngle={3} dataKey="value"
              />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {canalDataWithColors.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeeklyActivityCard />

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Productos Más Vendidos</h3>
          <p className="text-xs text-muted-foreground mb-4">Ranking por unidades vendidas</p>
          {sinVentas ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin ventas registradas todavía.
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const pct = Math.round((p.unidades / maxUnidades) * 100);
                return (
                  <div key={p.producto}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate">{p.producto}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">{p.unidades} uds</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, background: ANALITICS_COLORS[i % ANALITICS_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Revenue by product */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-1">Ingresos por Producto</h3>
        <p className="text-xs text-muted-foreground mb-4">Comparativa de ingresos totales</p>
        {sinVentas ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin ventas registradas todavía.
          </p>
        ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topProducts} layout="vertical" barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `$${((v as number) / 1_000_000).toFixed(1)}M`}
            />
            <YAxis
              type="category" dataKey="producto"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false} tickLine={false} width={130}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={v => formatCOP(v as number)}
            />
            <Bar dataKey="ingresos" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}