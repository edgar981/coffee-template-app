'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
import DashboardDistributionCard from '@/components/admin/DashboardDistributionCard';
import { formatFecha } from '@/lib/format-fecha';
import type { WidgetInsightData } from '@/lib/metrics/insights';

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

  // Core dashboard data. Each source settles INDEPENDENTLY so one failing fetch
  // can't blank the rest. A rejected source is set to null/empty (not left stale),
  // so the UI can show `—` + a retry banner instead of a lying `0`. `setLoading` on
  // finish only — the mount path leaves the initial `loading=true` untouched.
  const fetchCore = useCallback(() => {
    Promise.allSettled([getDashboardStats(), getAnalytics(), getProducts(), getCustomers()])
      .then(([s, a, p, c]) => {
        setStats(s.status === 'fulfilled' ? s.value : null);
        setAnalytics(a.status === 'fulfilled' ? a.value : null);
        if (p.status === 'fulfilled') setProducts(p.value);
        if (c.status === 'fulfilled') setCustomers(c.value);
        setLoading(false);
      });
  }, []);

  // Banner "Reintentar": back to the skeleton, then re-fetch.
  const retry = useCallback(() => { setLoading(true); fetchCore(); }, [fetchCore]);

  useEffect(() => {
    fetchCore(); // `loading` already starts true, so no synchronous setState here.
    // Layout preference is a SEPARATE concern: if it fails, keep the default
    // layout — it must never affect the data widgets/donut/Recientes.
    getDashboardPrefs()
      .then(setWidgetKeys)
      .catch(() => {/* keep DEFAULT_WIDGET_KEYS */});
  }, [fetchCore]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const lowStock       = products.filter(isLowStock).length;
  const activeProducts = products.filter(p => p.activo !== false).length;

  // Las tres vistas del pie vienen del endpoint de STATS (un query base, tres
  // agrupaciones). `analytics.categoryData` sigue existiendo para la página de
  // Analítica; el dashboard ya no lo usa.
  const distribuciones = stats?.distribuciones ?? null;

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

  // Lo que cada widget necesita para su insight: serie mensual (tarjetas de mes) o
  // último evento + día de referencia (tarjetas de scope HOY, que no tienen serie).
  // Sin stats no hay nada → sin insight (la tarjeta ya muestra `—`).
  const insightData: Record<string, WidgetInsightData | undefined> = stats ? {
    ingresos_mes:   { serie: stats.serieMensual.revenue },
    ordenes_mes:    { serie: stats.serieMensual.orders },
    ventas_hoy:     { ultimoEvento: stats.ultimoPago,     hoy: stats.hoyKey },
    despachos_hoy:  { ultimoEvento: stats.ultimoDespacho, hoy: stats.hoyKey },
    pedidos_hoy:    { ultimoEvento: stats.ultimaOrden,    hoy: stats.hoyKey },
  } : {};

  // The ONE place widgets meet data: key → { raw value, live sub, trend }, or
  // `undefined` when THIS widget's source failed to load. `undefined` renders as
  // `—` (a lying `0` is worse than a dash) — stats widgets go blank when the stats
  // endpoint rejected; clientes_recurrentes when analytics did. Registry holds the
  // rest (title, icon, colour, formato, href, static subtitle).
  const widgetValues: Record<string, { raw: number; sub?: string; trend?: Trend } | undefined> = {
    ventas_hoy:           stats ? { raw: stats.ventasHoy } : undefined,
    // Estado, no período: "Nada por cobrar" es el saldo vigente. Sin etiqueta de
    // ventana temporal (ver el comentario de `scopeSuffix` en el registry).
    por_cobrar:           stats ? { raw: stats.porCobrarMonto, sub: porCobrarN > 0 ? `${porCobrarN} ${porCobrarN === 1 ? 'orden' : 'órdenes'} contraentrega` : 'Nada por cobrar' } : undefined,
    despachos_hoy:        stats ? { raw: stats.despachosHoy } : undefined,
    pedidos_hoy:          stats ? { raw: stats.pedidosHoy } : undefined,
    // Sub del registry ("Pagos del mes en curso"): el histórico se fue a su
    // propio widget en vez de colgar de esta tarjeta.
    ingresos_mes:         stats ? { raw: stats.revenueMonth, trend: revenueTrend } : undefined,
    ingresos_historicos:  stats ? { raw: stats.revenueTotal, sub: stats.revenueSince ? `Desde ${formatFecha(stats.revenueSince)}` : undefined } : undefined,
    ordenes_mes:          stats ? { raw: stats.monthly.orders.current, trend: ordersTrend } : undefined,
    // Cuando hay por-cobrar, el sub dice explícitamente que está DESCONTADO de
    // este número: las dos tarjetas son un conjunto y su recorte, no dos cifras
    // rivales. ESTE cross-reference es lo que sostiene esa coherencia (ya no hay
    // etiqueta de scope). Sin por-cobrar cae al sub del registry.
    ordenes_pendientes:   stats ? { raw: stats.pendingOrders, sub: porCobrarN > 0 ? `Sin pago · ${porCobrarN} por cobrar aparte` : undefined } : undefined,
    promedio_por_orden:   stats ? { raw: stats.avgTicket, trend: avgTrend } : undefined,
    // products/customers default to []/[] and load independently of stats.
    alertas_stock:        { raw: lowStock },
    productos_activos:    { raw: activeProducts },
    clientes_totales:     { raw: customers.length },
    clientes_recurrentes: analytics ? { raw: analytics.kpis.tasaRetencion, trend: recurrentesTrend } : undefined,
  };

  const formatValue = (formato: WidgetFormato, raw: number) =>
    formato === 'cop' ? formatCOP(raw) : formato === 'pct' ? `${raw}%` : String(raw);

  // A metrics source (stats or analytics) failed after loading finished — surface
  // ONE banner with a retry instead of a grid full of dashes with no explanation.
  const metricsFailed = !loading && (stats === null || analytics === null);

  // Optimistic: re-render the grid immediately, then persist. On failure, a toast
  // whose "Reintentar" reuses the SAME keys that failed (captured here, not read
  // from state which may have moved on).
  const applyWidgets = (keys: string[]) => {
    setWidgetKeys(keys);
    const persist = (attemptKeys: string[]) =>
      saveDashboardPrefs(attemptKeys).catch(() =>
        toast.error('No se pudo guardar la configuración del panel', {
          action: { label: 'Reintentar', onClick: () => persist(attemptKeys) },
        }),
      );
    persist(keys);
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
        <UITooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setCustomizing(true)}>
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Personalizar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Elige y ordena las tarjetas de tu panel</TooltipContent>
        </UITooltip>
      </div>

      {/* One-time banner when a metrics source failed — better than a grid of
          dashes with no explanation. Retry re-fires the fetches. */}
      {metricsFailed && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-amber-900 dark:text-amber-200">No se pudieron cargar las métricas.</span>
          <Button variant="outline" size="sm" className="shrink-0" onClick={retry}>Reintentar</Button>
        </div>
      )}

      {/* Customizable stat-card grid — the ONLY personalizable surface. The widgets
          render in the admin's chosen order; the charts + recent orders below are
          fixed. A retired key (WIDGET_MAP miss) is skipped, never crashes. A widget
          whose source failed shows `—` (see widgetValues). */}
      {loading ? (
        <StatGridSkeleton count={widgetKeys.length} />
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
            // Insight: solo si el widget lo declara Y su serie llegó. La regla
            // decide sola cuándo callar (historia corta, muestra chica, mes en
            // curso incompleto) — aquí no hay lógica de negocio.
            const data = insightData[key];
            const insight = v && w.insight && data ? w.insight(data) : null;
            return (
              <StatCard
                key={key}
                icon={w.icono}
                label={w.titulo}
                // Source failed → `—` (no trend, static subtitle) instead of a
                // misleading 0.
                value={v ? formatValue(w.formato, v.raw) : '—'}
                // sub e insight compiten por UN slot; StatCard resuelve cuál gana
                // (insight primero) y le apende el scope del widget.
                sub={v?.sub ?? w.subtitulo}
                insight={insight?.text}
                insightEnfasis={insight?.enfasis}
                scopeSuffix={w.scopeSuffix}
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

        <DashboardDistributionCard data={distribuciones} loading={loading} />
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Órdenes Recientes</h3>
            <p className="text-xs text-muted-foreground">Últimas transacciones</p>
          </div>
          <Link href="/admin/ordenes" className="text-xs text-primary hover:underline font-medium">Ver todas →</Link>
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
// jump when the real numbers arrive. `count` = the admin's actual widget count,
// so someone with 4 widgets doesn't see 8 phantoms (and the jump the skeleton
// exists to prevent).
function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
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