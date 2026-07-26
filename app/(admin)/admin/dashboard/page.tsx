'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { getDashboardStats } from '@/lib/api/dashboard';
import { getAnalytics } from '@/lib/api/analytics';
import { getProducts } from '@/lib/api/products';
import { getCustomers } from '@/lib/api/customers';
import { getDashboardPrefs, saveDashboardPrefs } from '@/lib/api/dashboardPrefs';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';
import type { Customer } from '@/types/customer';
import type { DashboardStats } from '@/types/dashboard';
import type { AnalyticsData } from '@/types/analytics';
import { formatCOP } from '@/lib/utils';
import StatCard from '@/components/admin/StatCard';
import DashboardCustomizer from '@/components/admin/DashboardCustomizer';
import type { Trend } from '@/lib/metrics/trend';
import { computeTrend, NEUTRAL_TREND } from '@/lib/metrics/trend';
import { currentMonthOrdersQuery, currentMonthRange } from '@/lib/metrics/order-stat-filters';
import { isLowStock } from '@/lib/metrics/inventory-filters';
import {
  WIDGET_MAP, DEFAULT_WIDGET_KEYS,
  type WidgetFormato, type WidgetHrefContext,
} from '@/constants/dashboard-widgets';
import DashboardChartCarousel from '@/components/admin/DashboardChartCarousel';
import { DASHBOARD_COLORS, tooltipStyle } from '@/constants/dashb-styles';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics]   = useState<AnalyticsData | null>(null);
  const [products, setProducts]     = useState<Product[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  // The admin's chosen stat-card layout (ordered visible widget keys). Defaults to
  // the registry default until the persisted preference loads.
  const [widgetKeys, setWidgetKeys] = useState<string[]>(DEFAULT_WIDGET_KEYS);
  const [customizing, setCustomizing] = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getAnalytics(), getProducts(), getCustomers(), getDashboardPrefs()])
      .then(([s, a, p, c, w]) => {
        setStats(s); setAnalytics(a); setProducts(p); setCustomers(c); setWidgetKeys(w);
      })
      .catch(() => {/* leave defaults; a failed sub-fetch shouldn't hang the panel */})
      .finally(() => setLoading(false));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const lowStock       = products.filter(isLowStock).length;
  const activeProducts = products.filter(p => p.activo !== false).length;

  const categoryData = analytics?.categoryData ?? [];

  // Deep-link context (America/Bogota day keys + the shared month query), fed to
  // each widget's href builder so a card links to exactly the rows it counts.
  const monthQuery = currentMonthOrdersQuery();
  const { desde: monthStartKey, hasta: todayKey } = currentMonthRange();
  const hrefCtx: WidgetHrefContext = { today: todayKey, monthStart: monthStartKey, monthQuery };

  // Month-over-month trend pills: current calendar month vs previous complete
  // month. The anti-noise floor lives in lib/metrics/trend.ts.
  const m = stats?.monthly;
  const revenueTrend = m ? computeTrend(m.revenue.current,   m.revenue.previous,   m.prevMonthOrders) : NEUTRAL_TREND;
  const ordersTrend  = m ? computeTrend(m.orders.current,    m.orders.previous,    m.prevMonthOrders) : NEUTRAL_TREND;
  const avgTrend     = m ? computeTrend(m.avgTicket.current, m.avgTicket.previous, m.prevMonthOrders) : NEUTRAL_TREND;
  // "Clientes Recurrentes" MoM needs per-month cohort logic the metrics endpoint
  // doesn't have yet → neutral fallback (reported as backend-pending).
  const recurrentesTrend = NEUTRAL_TREND;

  const porCobrarN = stats?.porCobrar ?? 0;

  // The ONE place widgets meet data: key → { raw value, live sub, trend }. Every
  // number comes from the stats endpoint or a shared helper (isLowStock), so each
  // card reconciles with its deep-linked list. Registry holds the rest (title,
  // icon, colour, formato, href, static subtitle).
  const widgetValues: Record<string, { raw: number; sub?: string; trend?: Trend }> = stats ? {
    ventas_hoy:           { raw: stats.ventasHoy },
    por_cobrar:           { raw: stats.porCobrarMonto, sub: porCobrarN > 0 ? `${porCobrarN} ${porCobrarN === 1 ? 'orden' : 'órdenes'} contraentrega` : 'Nada por cobrar' },
    despachos_hoy:        { raw: stats.despachosHoy },
    pedidos_hoy:          { raw: stats.pedidosHoy },
    ingresos_mes:         { raw: stats.revenueMonth, sub: `Histórico: ${formatCOP(stats.revenueTotal)}`, trend: revenueTrend },
    ordenes_mes:          { raw: stats.monthly.orders.current, trend: ordersTrend },
    ordenes_pendientes:   { raw: stats.pendingOrders, sub: porCobrarN > 0 ? `Por cobrar: ${porCobrarN}` : undefined, trend: undefined },
    promedio_por_orden:   { raw: stats.avgTicket, trend: avgTrend },
    alertas_stock:        { raw: lowStock },
    productos_activos:    { raw: activeProducts },
    clientes_totales:     { raw: customers.length },
    clientes_recurrentes: { raw: analytics?.kpis.tasaRetencion ?? 0, trend: recurrentesTrend },
  } : {};

  const formatValue = (formato: WidgetFormato, raw: number) =>
    formato === 'cop' ? formatCOP(raw) : formato === 'pct' ? `${raw}%` : String(raw);

  // Optimistic: re-render the grid immediately, then persist. A failed write
  // surfaces a toast but keeps the on-screen layout (they can retry).
  const applyWidgets = (keys: string[]) => {
    setWidgetKeys(keys);
    saveDashboardPrefs(keys).catch(() => toast.error('No se pudo guardar la configuración del panel'));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Operaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Café Nayoli — Resumen del negocio</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setCustomizing(true)} title="Personalizar panel">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </div>

      {/* Customizable stat-card grid — the ONLY personalizable surface. The widgets
          render in the admin's chosen order; the charts + recent orders below are
          fixed. A retired key (WIDGET_MAP miss) is skipped, never crashes. */}
      {loading ? (
        <StatGridSkeleton />
      ) : widgetKeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Sin widgets — personaliza tu panel para elegir qué ver.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal className="w-4 h-4" /> Personalizar
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {widgetKeys.map(key => {
            const w = WIDGET_MAP[key];
            if (!w) return null;
            const v = widgetValues[key];
            const href = typeof w.href === 'function' ? w.href(hrefCtx) : w.href;
            return (
              <StatCard
                key={key}
                icon={w.icono}
                label={w.titulo}
                value={formatValue(w.formato, v?.raw ?? 0)}
                sub={v?.sub ?? w.subtitulo}
                trend={v?.trend}
                color={w.color}
                href={href}
              />
            );
          })}
        </div>
      )}

      <DashboardCustomizer
        open={customizing}
        onOpenChange={setCustomizing}
        value={widgetKeys}
        onApply={applyWidgets}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DashboardChartCarousel />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-1">Por Categoría</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribución de ventas</p>
          {categoryData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-center text-muted-foreground text-sm">
              {loading ? 'Cargando...' : 'Sin ventas registradas todavía.'}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={categoryData} cx="50%" cy="50%"
                    innerRadius={40} outerRadius={65}
                    paddingAngle={3} dataKey="value"
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={DASHBOARD_COLORS[i % DASHBOARD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: DASHBOARD_COLORS[i % DASHBOARD_COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Órdenes Recientes</h3>
            <p className="text-xs text-muted-foreground">Últimas transacciones</p>
          </div>
          <a href="/admin/ordenes" className="text-xs text-primary hover:underline font-medium">Ver todas →</a>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
        ) : !stats || stats.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Aún no hay órdenes.</div>
        ) : (
          <OrdersTable orders={stats.recentOrders} />
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
// Card-shaped placeholders matching the StatCard footprint so the layout doesn't
// jump when the real numbers arrive. Eight = the default widget count.
function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="w-10 h-10 rounded-lg bg-muted" />
          <div className="mt-3 space-y-2">
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted/70" />
            <div className="h-2.5 w-16 rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── OrdersTable ──────────────────────────────────────────────────────────────

// Rows deep-link into the Órdenes page, which opens the matching order's detail
// dialog from the `?order=` param (there is no per-order route). The whole row
// navigates on click; the numero_orden cell is a real <Link> so middle-click,
// "open in new tab" and keyboard/screen-reader navigation all work.
function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const orderHref = (o: Order) => `/admin/ordenes?order=${encodeURIComponent(o.numero_orden)}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {['Orden', 'Cliente', 'Canal', 'Total', 'Estado'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr
              key={o.id}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => router.push(orderHref(o))}
            >
              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                <Link
                  href={orderHref(o)}
                  // The row already handles the click; this exists for middle-click
                  // and focus order, so stop it from navigating twice.
                  onClick={e => e.stopPropagation()}
                  className="rounded hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {o.numero_orden ?? `#${o.id.slice(-6)}`}
                </Link>
              </td>
              <td className="px-5 py-3 font-medium">{o.cliente_nombre}</td>
              <td className="px-5 py-3">
                <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded">{o.canal ?? 'directo'}</span>
              </td>
              <td className="px-5 py-3 font-semibold">{formatCOP(o.total)}</td>
              <td className="px-5 py-3"><StatusBadge status={o.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}