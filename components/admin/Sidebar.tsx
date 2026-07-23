"use client";
import Link from 'next/link';
import { useEffect } from 'react';
import { cn, getInitials } from '@/lib/utils';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Warehouse,
  CreditCard, Truck, BarChart3, Zap, ChevronRight,
  ChevronLeft, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from "next/navigation";
import { SidebarProps, NavItem } from '@/types/admin';
import { authClient } from "@/lib/auth-client";


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

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  // Mobile drawer only: while it's open, lock the body scroll and let Escape
  // close it. Keyed on `mobileOpen`, so it never touches desktop behaviour.
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen, onClose]);

  return (
    <>
      {/* Mobile backdrop: only rendered < lg, only while the drawer is open.
          Tapping it closes the drawer. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Off-canvas drawer < lg (full 240px, slides on transform); in-flow rail
          ≥ lg (72/240 width, always on-screen). Width/transform are driven by
          responsive classes — not JS-animated inline width — so the same element
          can be a full-width drawer on mobile and a collapsible rail on desktop. */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full z-50 bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden',
          'w-60 transition-[transform,width] duration-300 ease-in-out',
          // Desktop rail width
          collapsed && 'lg:w-18',
          // Off-canvas when the mobile drawer is closed; the desktop media query
          // (emitted after the base rule) pins it on-screen ≥ lg regardless.
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        {/* Brand: the complete Duna lockup (one image) + the store it administers.
            Theme-aware: dark-ink art on the light sidebar, light-ink "negative"
            art on the dark sidebar (no CSS inversion). The mark-only variant is
            shown ONLY for the collapsed desktop rail; the mobile drawer is always
            full width and shows the horizontal lockup. */}
        <div className={cn(
          'relative flex items-center h-16 px-4 border-b border-sidebar-border shrink-0',
          collapsed && 'lg:justify-center',
        )}>
          {/* Full horizontal lockup — hidden only on the collapsed desktop rail */}
          <div className={cn('min-w-0 overflow-hidden mt-3', collapsed && 'lg:hidden')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-logo-horizontal-v1.svg" alt="Duna" className="block h-4 w-auto object-contain object-left dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-logo-horizontal-negative-v1.svg" alt="Duna" className="hidden h-4 w-auto object-contain object-left dark:block" />
            <p
              className="mt-2 mb-2 text-[13px] leading-none text-sidebar-foreground/55 whitespace-nowrap"
              style={{ fontFamily: 'var(--font-instrument-sans)' }}
            >
              Café Nayoli
            </p>
          </div>

          {/* Mark — shown ONLY on the collapsed desktop rail */}
          <div className={cn('hidden', collapsed && 'lg:flex lg:items-center lg:justify-center')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-mark-v1.svg" alt="Duna" className="h-6 w-6 object-contain dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-mark-negative-v1.svg" alt="Duna" className="hidden h-6 w-6 object-contain dark:block" />
          </div>

          {/* Desktop rail collapse toggle (≥ lg only) */}
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className={cn(
              'hidden lg:inline-flex text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors cursor-pointer shrink-0',
              collapsed ? 'lg:absolute lg:right-1.5 lg:top-1/2 lg:-translate-y-1/2' : 'ml-auto',
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile drawer close button (< lg only) */}
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="ml-auto inline-flex lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
          {navItems
            .filter(item => !item.ownerOnly || session?.user?.role === "OWNER")
            .map(({ icon: Icon, label, path }) => {
            const active = pathname === path || (path !== '/' && pathname.startsWith(path));
            return (
              <Link
                key={path}
                href={path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative',
                  active
                    ? 'bg-sidebar-primary/10 text-sidebar-foreground font-semibold'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className={cn('w-4.5 h-4.5 shrink-0', active ? 'text-sidebar-primary' : '')} style={{ width: 18, height: 18 }} />
                {/* Label — hidden only on the collapsed desktop rail (always
                    visible in the mobile drawer). */}
                <span className={cn('text-sm font-medium whitespace-nowrap', collapsed && 'lg:hidden')}>
                  {label}
                </span>
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full"
                  />
                )}
                {/* Hover tooltip — only meaningful on the collapsed desktop rail */}
                {collapsed && (
                  <div className="hidden lg:block absolute left-full ml-3 px-2 py-1 bg-sidebar-accent text-sidebar-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'lg:justify-center')}>
            <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-sidebar-primary">
                {getInitials(session?.user?.name)}
              </span>
            </div>
            {/* User meta — hidden only on the collapsed desktop rail */}
            <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <p className="text-xs font-medium text-sidebar-foreground whitespace-nowrap truncate">
                {isPending ? "…" : session?.user?.name ?? "Usuario"}
              </p>
              <p className="text-xs text-sidebar-foreground/40 whitespace-nowrap truncate">
                {isPending ? "" : session?.user?.email ?? ""}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
