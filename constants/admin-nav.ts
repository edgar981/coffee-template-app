import {
  LayoutDashboard, ShoppingCart, Package, Users, Warehouse,
  CreditCard, Truck, BarChart3, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IconAnim } from '@/components/admin/AnimatedIcon';

// THE single source of admin navigation: consumed by the Sidebar (rail + peek +
// mobile drawer) AND the command palette's static index, so a new section shows
// up in both by adding one entry. `anim` is the hover animation for the row.
export interface AdminNavItem {
  icon:       LucideIcon;
  label:      string;
  path:       string;
  anim:       IconAnim;
  ownerOnly?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/admin/dashboard',        anim: 'lift' },
  { icon: ShoppingCart,    label: 'Órdenes',          path: '/admin/ordenes',          anim: 'cart' },
  { icon: Package,         label: 'Productos',        path: '/admin/productos',        anim: 'package' },
  { icon: Users,           label: 'Clientes',         path: '/admin/clientes',         anim: 'users' },
  { icon: Warehouse,       label: 'Inventario',       path: '/admin/inventario',       anim: 'lift' },
  { icon: CreditCard,      label: 'Pagos',            path: '/admin/pagos',            anim: 'lift' },
  { icon: Truck,           label: 'Entregas',         path: '/admin/entregas',         anim: 'truck' },
  { icon: BarChart3,       label: 'Analítica',        path: '/admin/analitica',        anim: 'lift' },
  { icon: Zap,             label: 'Automatizaciones', path: '/admin/automatizaciones', anim: 'lift' },
];
