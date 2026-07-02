"use client";
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Warehouse,
  CreditCard, Truck, BarChart3, Zap, Coffee, ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from "next/navigation";
import { SidebarProps, NavItem } from '@/types/admin';


const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
  { icon: ShoppingCart, label: 'Órdenes', path: '/admin/ordenes' },
  { icon: Package, label: 'Productos', path: '/admin/productos' },
  { icon: Users, label: 'Clientes', path: '/admin/clientes' },
  { icon: Warehouse, label: 'Inventario', path: '/admin/inventario' },
  { icon: CreditCard, label: 'Pagos', path: '/admin/pagos' },
  { icon: Truck, label: 'Entregas', path: '/admin/entregas' },
  { icon: BarChart3, label: 'Analítica', path: '/admin/analitica' },
  { icon: Zap, label: 'Automatizaciones', path: '/admin/automatizaciones' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full z-50 sidebar-gradient border-r border-sidebar-border flex flex-col overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5 text-sidebar-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="ml-3 overflow-hidden"
              >
                <p className="text-sm font-semibold text-sidebar-foreground font-inter leading-tight whitespace-nowrap">Sierra Nativa</p>
                <p className="text-xs text-sidebar-foreground/50 whitespace-nowrap">Coffee Co.</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={onToggle}
            className="ml-auto text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = pathname === path || (path !== '/' && pathname.startsWith(path));
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative',
                  active
                    ? 'bg-sidebar-primary/15 text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className={cn('w-4.5 h-4.5 shrink-0', active ? 'text-sidebar-primary' : '')} style={{ width: 18, height: 18 }} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full"
                  />
                )}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2 py-1 bg-sidebar-accent text-sidebar-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center')}>
            <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-sidebar-primary">SN</span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-xs font-medium text-sidebar-foreground whitespace-nowrap">Admin</p>
                  <p className="text-xs text-sidebar-foreground/40 whitespace-nowrap">sierranativa.co</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </>
  );
}