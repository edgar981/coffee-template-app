import type { LucideIcon } from 'lucide-react';
import {
  Banknote, Wallet, Truck, ShoppingCart, DollarSign, Clock,
  AlertTriangle, Users, Package, TrendingUp,
} from 'lucide-react';
import { PENDING_ORDERS_QUERY, POR_COBRAR_QUERY } from '@/lib/metrics/order-stat-filters';
import { LOW_STOCK_QUERY } from '@/lib/metrics/inventory-filters';

// ─── Dashboard widget registry ───────────────────────────────────────────────
// THE catalog of stat-card widgets an admin can turn on/off and reorder. This is
// the FORM of the "Comercio Digital" template (a registry + a persisted, ordered
// selection per user); the widgets themselves are this vertical's CONTENT.
//
// Each `key` is a stable, snake_case identifier — it is what gets persisted (see
// prisma DashboardPreference.widgets) and mapped to a server-side value in the
// dashboard page. Renaming a key is a breaking change (retired keys are silently
// dropped on read, so a user loses that card rather than seeing a crash).
//
// PURE + CLIENT-SAFE: presentation metadata + deep-link builders only. No Prisma,
// no data fetching. The value/sub/trend binding lives in the dashboard page (next
// to the loaded data); the deep-link queries reuse the SAME shared helpers the
// destination lists parse, so every card still reconciles with its list.
//
// MULTITENANT SEAM (documented, NOT built — see CLAUDE.md): when a store/tenant
// model exists, (a) each widget gains a `verticales`/`stores` filter so the
// catalog is scoped per business vertical, (b) DashboardPreference gains the
// store key, and (c) `defaultVisible` moves to a per-vertical default set. None
// of this is implemented now; there is no tenant model yet.

export type WidgetFormato = 'cop' | 'int' | 'pct';

/** Grouping in the customizer panel only — it does NOT affect the grid layout. */
export type WidgetCategoria = 'hoy' | 'mes' | 'historico' | 'clientes' | 'inventario';

/** Ordered display names for the categories that have widgets. `historico` is a
 *  reserved bucket for future widgets, so it renders only when populated. */
export const WIDGET_CATEGORIA_LABEL: Record<WidgetCategoria, string> = {
  hoy:        'Hoy',
  mes:        'Mes / operación',
  historico:  'Histórico',
  clientes:   'Clientes',
  inventario: 'Inventario',
};

export const WIDGET_CATEGORIA_ORDER: WidgetCategoria[] = ['hoy', 'mes', 'inventario', 'clientes', 'historico'];

/** Date context for the day/month-scoped deep links (America/Bogota day keys). */
export interface WidgetHrefContext {
  today:      string;
  monthStart: string;
  /** Full `estado=…&desde=…&hasta=…` query (no `?`) for "Órdenes del mes". */
  monthQuery: string;
}

export interface WidgetDef {
  /** Stable snake_case id — the persisted identifier. */
  key:            string;
  titulo:         string;
  /** Static fallback subtitle; the page may override it with a live one. */
  subtitulo:      string;
  icono:          LucideIcon;
  formato:        WidgetFormato;
  categoria:      WidgetCategoria;
  defaultVisible: boolean;
  /** Pastel chip class (admin design system). */
  color:          string;
  /** Deep link: a static path, or a fn of the date context for scoped links. */
  href?:          string | ((ctx: WidgetHrefContext) => string);
}

// Catalog order doubles as the DEFAULT order: the visible-by-default widgets, read
// top to bottom, give "fila Hoy primero, luego mes/operación" for free.
export const DASHBOARD_WIDGETS: WidgetDef[] = [
  // ── Hoy ──
  { key: 'ventas_hoy',      titulo: 'Ventas de hoy',      subtitulo: 'Pagos recibidos hoy', icono: Banknote,     formato: 'cop', categoria: 'hoy', defaultVisible: true,  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', href: (c) => `/admin/pagos?desde=${c.today}&hasta=${c.today}` },
  { key: 'por_cobrar',      titulo: 'Por cobrar',         subtitulo: 'Contraentrega sin pago', icono: Wallet,     formato: 'cop', categoria: 'hoy', defaultVisible: true,  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',         href: `/admin/ordenes?${POR_COBRAR_QUERY}` },
  { key: 'despachos_hoy',   titulo: 'Despachos de hoy',   subtitulo: 'Salieron a ruta hoy', icono: Truck,        formato: 'int', categoria: 'hoy', defaultVisible: true,  color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',                  href: '/admin/entregas' },
  { key: 'pedidos_hoy',     titulo: 'Pedidos de hoy',     subtitulo: 'Órdenes creadas hoy', icono: ShoppingCart, formato: 'int', categoria: 'hoy', defaultVisible: true,  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',              href: (c) => `/admin/ordenes?desde=${c.today}&hasta=${c.today}` },
  // ── Mes / operación ──
  { key: 'ingresos_mes',       titulo: 'Ingresos del mes',   subtitulo: 'Mes en curso', icono: DollarSign,   formato: 'cop', categoria: 'mes', defaultVisible: true,  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', href: (c) => `/admin/pagos?desde=${c.monthStart}&hasta=${c.today}` },
  { key: 'ordenes_mes',        titulo: 'Órdenes del mes',    subtitulo: 'Mes en curso', icono: ShoppingCart, formato: 'int', categoria: 'mes', defaultVisible: true,  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',              href: (c) => `/admin/ordenes?${c.monthQuery}` },
  { key: 'ordenes_pendientes', titulo: 'Órdenes Pendientes', subtitulo: 'Requieren atención', icono: Clock,   formato: 'int', categoria: 'mes', defaultVisible: true,  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',         href: `/admin/ordenes?${PENDING_ORDERS_QUERY}` },
  { key: 'promedio_por_orden', titulo: 'Promedio por orden', subtitulo: 'Promedio por venta · mes', icono: TrendingUp, formato: 'cop', categoria: 'mes', defaultVisible: false, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  // ── Inventario ──
  { key: 'alertas_stock',    titulo: 'Alertas de Stock',   subtitulo: 'Productos bajo mínimo', icono: AlertTriangle, formato: 'int', categoria: 'inventario', defaultVisible: true,  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',        href: `/admin/inventario?${LOW_STOCK_QUERY}` },
  { key: 'productos_activos', titulo: 'Productos Activos',  subtitulo: 'En catálogo', icono: Package,          formato: 'int', categoria: 'inventario', defaultVisible: false, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  // ── Clientes ──
  { key: 'clientes_totales',    titulo: 'Clientes Totales',    subtitulo: 'Registrados', icono: Users,        formato: 'int', categoria: 'clientes', defaultVisible: false, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', href: '/admin/clientes' },
  { key: 'clientes_recurrentes', titulo: 'Clientes Recurrentes', subtitulo: 'con más de 1 compra', icono: TrendingUp, formato: 'pct', categoria: 'clientes', defaultVisible: false, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400', href: '/admin/clientes?recurrentes=1' },
];

export const WIDGET_MAP: Record<string, WidgetDef> = Object.fromEntries(
  DASHBOARD_WIDGETS.map((w) => [w.key, w]),
);

/** Default layout = the `defaultVisible` widgets in catalog order (8 cards). */
export const DEFAULT_WIDGET_KEYS: string[] = DASHBOARD_WIDGETS.filter((w) => w.defaultVisible).map((w) => w.key);

/**
 * Coerce arbitrary input into a valid ordered list of widget keys: keep only
 * strings that are REAL registry keys, drop duplicates, preserve order. The one
 * gate both the API (on write) and the client (on read) run everything through,
 * so an unknown/retired/malformed key can never reach the grid.
 */
export function sanitizeWidgetKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of input) {
    if (typeof k === 'string' && k in WIDGET_MAP && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
