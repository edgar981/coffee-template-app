'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';
import { formatCOP } from '@/lib/utils';
import { getAnalytics } from '@/lib/api/analytics';
import { ANALITICS_COLORS, tooltipStyle, axisTickStyle } from '@/constants/dashb-styles';
import type { AnalyticsData, CanalData } from '@/types/analytics';
import { EMPTY_ANALYTICS, productData } from '@/constants/analytics';

// ─── Static fallback data (shown while loading) ───────────────────────────────

const sortedProducts = [...productData].sort((a, b) => b.ventas - a.ventas);
const maxVentas      = sortedProducts[0]?.ventas ?? 1;

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label:     string;
  value:     string;
  sub?:      string;
  trend?:    string;
  positive?: boolean;
  loading?:  boolean;
}

function MetricCard({ label, value, sub, trend, positive, loading }: MetricCardProps) {
  return (
    <div className="stat-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded mt-1" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend && !loading && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {positive
            ? <ArrowUpRight className="w-3 h-3" />
            : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      )}
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

  const { kpis, salesByMonth, canalData, weekData } = data;

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
        <MetricCard loading={loading} label="Ingresos Anuales"  value={formatCOP(kpis.totalRevenue)}   sub={`${kpis.totalOrders} órdenes`}      trend="+149% vs 2023"  positive />
        <MetricCard loading={loading} label="Ticket Promedio"   value={formatCOP(kpis.ticketPromedio)} sub="Por orden"                           trend="+6.1% este mes" positive />
        <MetricCard loading={loading} label="Tasa Retención"    value={`${kpis.tasaRetencion}%`}       sub={`${kpis.totalCustomers} clientes`}   trend="+3.2%"          positive />
        <MetricCard loading={loading} label="Margen Bruto Est." value={`${kpis.margenBruto}%`}         sub="Promedio portafolio"                 trend="-1.2%"          positive={kpis.margenBruto >= 50} />
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
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Actividad Semanal</h3>
          <p className="text-xs text-muted-foreground mb-4">Órdenes por día de la semana</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia"  tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis               tick={axisTickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="ordenes" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Productos Más Vendidos</h3>
          <p className="text-xs text-muted-foreground mb-4">Ranking por unidades vendidas</p>
          <div className="space-y-3">
            {sortedProducts.map((p, i) => {
              const pct = Math.round((p.ventas / maxVentas) * 100);
              return (
                <div key={p.producto}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate">{p.producto}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{p.ventas} uds</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, background: ANALITICS_COLORS[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue by product */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-1">Ingresos por Producto</h3>
        <p className="text-xs text-muted-foreground mb-4">Comparativa de ingresos totales</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={productData} layout="vertical" barSize={18}>
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
      </div>
    </div>
  );
}