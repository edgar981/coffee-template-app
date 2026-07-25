"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn, getInitials } from '@/lib/utils';
import { PanelLeftClose, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from "next/navigation";
import { SidebarProps } from '@/types/admin';
import { ADMIN_NAV, type AdminNavItem } from '@/constants/admin-nav';
import { AnimatedIcon } from '@/components/admin/AnimatedIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { authClient } from "@/lib/auth-client";
import { ADMIN_ICON_BUTTON } from '@/components/admin/iconButton';

// ─── One nav row ──────────────────────────────────────────────────────────────
// Kept a real <Link> (prefetch, middle-click, aria-current). The WHOLE row drives
// the icon animation via local hover state. On the collapsed icon rail the row is
// wrapped in a Radix tooltip (side="right"); everywhere labels are visible, no
// tooltip (a repeated label is noise).
function NavRow({ item, active, iconOnly, animateIndicator, onNavigate }: {
  item: AdminNavItem;
  active: boolean;
  iconOnly: boolean;
  animateIndicator: boolean;
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const row = (
    <Link
      href={item.path}
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 relative outline-none',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        iconOnly && 'justify-center',
        active
          ? 'bg-sidebar-primary/10 text-sidebar-foreground font-semibold'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
      )}
    >
      <AnimatedIcon
        icon={item.icon}
        anim={item.anim}
        hovered={hovered}
        className={active ? 'text-sidebar-primary' : ''}
      />
      {!iconOnly && (
        <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
      )}
      {active && (
        animateIndicator
          ? <motion.div layoutId="activeIndicator" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-sidebar-primary" />
          : <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-sidebar-primary" />
      )}
    </Link>
  );

  if (!iconOnly) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Nav list ─────────────────────────────────────────────────────────────────
function SidebarNav({ iconOnly, animateIndicator, onNavigate }: {
  iconOnly: boolean;
  animateIndicator: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  return (
    <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-4">
      {ADMIN_NAV
        .filter(item => !item.ownerOnly || session?.user?.role === 'OWNER')
        .map(item => {
          const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <NavRow
              key={item.path}
              item={item}
              active={active}
              iconOnly={iconOnly}
              animateIndicator={animateIndicator}
              onNavigate={onNavigate}
            />
          );
        })}
    </nav>
  );
}

// ─── User footer ──────────────────────────────────────────────────────────────
function UserFooter({ compact }: { compact: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className={cn('flex items-center gap-3 px-2 py-2', compact && 'justify-center')}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20">
          <span className="text-xs font-semibold text-sidebar-primary">{getInitials(session?.user?.name)}</span>
        </div>
        {!compact && (
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-xs font-medium text-sidebar-foreground">
              {isPending ? '…' : session?.user?.name ?? 'Usuario'}
            </p>
            <p className="truncate whitespace-nowrap text-xs text-sidebar-foreground/40">
              {isPending ? '' : session?.user?.email ?? ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search affordance ────────────────────────────────────────────────────────
// Icon-only control → always tooltipped ("Buscar (⌘K)"), even when the sidebar is
// expanded (unlike nav items). Hidden on the collapsed rail (⌘K still works).
function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label="Buscar (⌘K)"
          className={cn(ADMIN_ICON_BUTTON, 'h-8 w-8 shrink-0')}
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Buscar (⌘K)</TooltipContent>
    </Tooltip>
  );
}

// ─── Brand lockup ─────────────────────────────────────────────────────────────
// Wordmark only. The horizontal logo SVG bakes the mark + "DUNA" lettering into a
// single file, so rather than crop it (public/ images are immutable) we render the
// "DUNA" wordmark as text in JetBrains Mono — the wordmark typeface — and keep the
// "Café Nayoli" store label. The unused SVGs stay in public/ untouched.
function BrandLockup() {
  return (
    <div className="mt-3 min-w-0 overflow-hidden">
      <span
        className="block whitespace-nowrap text-[15px] font-semibold uppercase leading-none tracking-[0.2em] text-sidebar-foreground"
        style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
      >
        DUNA
      </span>
      <p className="mt-2 mb-2 whitespace-nowrap text-[13px] leading-none text-sidebar-foreground/55" style={{ fontFamily: 'var(--font-instrument-sans)' }}>
        Café Nayoli
      </p>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({
  collapsed, onToggle, mobileOpen, onClose, onOpenSearch,
}: SidebarProps) {
  // Mobile drawer only: lock body scroll + Escape-to-close while open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen, onClose]);

  return (
    <>
      {/* Mobile backdrop (< lg, drawer open) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* In-flow rail (≥ lg) / off-canvas drawer (< lg). Collapsed = a static icon
          rail: hovering shows tooltips only (no overlay); the toggle is the only
          way to expand/collapse. */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar',
          'w-60 transition-[transform,width] duration-300 ease-in-out',
          collapsed && 'lg:w-18',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        {/* Header — brand + (expanded only) search & collapse toggle */}
        <div className={cn(
          'relative flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3',
          collapsed && 'lg:justify-center',
        )}>
          {/* Full lockup — hidden only on the collapsed desktop rail */}
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <BrandLockup />
          </div>

          {/* Mark — collapsed desktop rail only */}
          <div className={cn('hidden', collapsed && 'lg:flex lg:items-center lg:justify-center')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-mark-v1.svg" alt="Duna" className="h-6 w-6 object-contain dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-mark-negative-v1.svg" alt="Duna" className="hidden h-6 w-6 object-contain dark:block" />
          </div>

          {/* Search — expanded rail + mobile drawer; hidden on the collapsed rail */}
          <div className={cn('shrink-0', collapsed && 'lg:hidden')}>
            <SearchButton onClick={onOpenSearch} />
          </div>

          {/* Collapse toggle — expanded desktop rail only (when collapsed it lives
              in the top bar). PanelLeftClose = "collapse". */}
          <div className={cn('hidden', !collapsed && 'lg:block')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  aria-label="Colapsar panel"
                  className={cn(ADMIN_ICON_BUTTON, 'h-8 w-8 shrink-0')}
                >
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Colapsar panel</TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile drawer close (< lg only) */}
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="ml-auto inline-flex shrink-0 text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav — icon-only + tooltips on the collapsed desktop rail, labelled
            otherwise. `lg:hidden` / `lg:flex` swaps between the two on desktop; the
            mobile drawer always uses the labelled variant. */}
        <div className={cn('flex flex-1 flex-col overflow-hidden', collapsed && 'lg:hidden')}>
          <SidebarNav iconOnly={false} animateIndicator onNavigate={onClose} />
        </div>
        {collapsed && (
          <div className="hidden flex-1 flex-col overflow-hidden lg:flex">
            <SidebarNav iconOnly animateIndicator onNavigate={onClose} />
          </div>
        )}

        {/* User footer — compact (avatar only) on the collapsed rail */}
        <div className={cn(collapsed && 'lg:hidden')}><UserFooter compact={false} /></div>
        {collapsed && <div className="hidden lg:block"><UserFooter compact /></div>}
      </aside>
    </>
  );
}
