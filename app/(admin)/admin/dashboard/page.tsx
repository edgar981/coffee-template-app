'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingCart, Package, Users,
  AlertTriangle, DollarSign, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import StatusBadge from '@/components/ui/StatusBadge';
import { getDashboardStats } from '@/lib/api/dashboard';
import { getAnalytics } from '@/lib/api/analytics';
import { getProducts } from '@/lib/api/products';
import { getCustomers } from '@/lib/api/customers';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';
import type { Customer } from '@/types/customer';
import type { DashboardStats } from '@/types/dashboard';
import type { AnalyticsData } from '@/types/analytics';
import { formatCOP } from '@/lib/utils';
import StatCard from '@/components/admin/StatCard';
import { DASHBOARD_COLORS, tooltipStyle, axisTickStyle } from '@/constants/dashb-styles';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats]         = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [products, setProducts]   = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getAnalytics(), getProducts(), getCustomers()])
      .then(([s, a, p, c]) => {
        setStats(s);
        setAnalytics(a);
        setProducts(p);
        setCustomers(c);
        setLoading(false);
      });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const lowStock       = products.filter(p => p.stock <= (p.stock_minimo ?? 5)).length;
  const activeProducts = products.filter(p => p.activo !== false).length;

  const salesData    = analytics?.salesByMonth ?? [];
  const categoryData = analytics?.categoryData ?? [];

  // Only surface a trend chip when today is actually up on yesterday — the
  // StatCard trend renders as a green up-arrow, so a flat/down day stays in `sub`.
  const ordersTrend = stats && stats.ordersDeltaPct !== null && stats.ordersDeltaPct > 0
    ? `+${stats.ordersDeltaPct}%`
    : undefined;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Operaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">Café Nayoli — Resumen del negocio</p>
      </div>

      {/* Stats row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign}    label="Ingresos Totales"    value={formatCOP(stats?.totalRevenue ?? 0)}                     color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard icon={ShoppingCart}  label="Órdenes Hoy"         value={stats?.ordersToday ?? 0}    sub={`vs ${stats?.ordersYesterday ?? 0} ayer`} trend={ordersTrend} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={Clock}         label="Órdenes Pendientes"  value={stats?.pendingOrders ?? 0}  sub="Requieren atención"        color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard icon={AlertTriangle} label="Alertas de Stock"    value={lowStock}                   sub="Productos bajo mínimo"     color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
      </div>

      {/* Stats row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Clientes Totales"     value={customers.length}         sub="Registrados"                       color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" />
        <StatCard icon={Package}     label="Productos Activos"    value={activeProducts}           sub="En catálogo"                       color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" />
        <StatCard icon={TrendingUp}  label="Ticket Promedio"      value={formatCOP(stats?.avgTicket ?? 0)}                                 color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" />
        <StatCard icon={TrendingUp}  label="Clientes Recurrentes" value={`${analytics?.kpis.tasaRetencion ?? 0}%`} sub="con más de 1 compra"          color="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Ventas Mensuales {new Date().getFullYear()}</h3>
              <p className="text-xs text-muted-foreground">Ingresos por mes</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#92400e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#92400e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis
                tick={axisTickStyle} axisLine={false} tickLine={false}
                tickFormatter={v => `$${((v as number) / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => formatCOP(v as number)}
              />
              <Area type="monotone" dataKey="ventas" stroke="#92400e" strokeWidth={2} fill="url(#colorVentas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-1">Por Categoría</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribución de ventas</p>
          {categoryData.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-center text-muted-foreground text-sm">
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

// ─── OrdersTable ──────────────────────────────────────────────────────────────

function OrdersTable({ orders }: { orders: Order[] }) {
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
            <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                {o.numero_orden ?? `#${o.id.slice(-6)}`}
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