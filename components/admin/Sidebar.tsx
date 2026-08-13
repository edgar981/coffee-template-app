"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@duna/core/utils';
import { PanelLeftClose, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from "next/navigation";
import { SidebarProps } from '@/types/admin';
import { ADMIN_NAV, type AdminNavItem } from '@/constants/admin-nav';
import { AnimatedIcon } from '@/components/admin/AnimatedIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { authClient } from "@/lib/auth-client";
import { ADMIN_ICON_BUTTON } from '@/components/admin/iconButton';
import { UserMenu } from '@/components/admin/UserMenu';
import { useAtencionPedidos } from '@/hooks/useAtencionPedidos';

// ─── EL PUNTO SOL ─────────────────────────────────────────────────────────────
//
// Hoy sólo Pedidos tiene una regla de atención, así que la ruta es una constante y
// no un registro. Cuando una segunda sección tenga la suya, esto se vuelve un mapa
// y el endpoint devuelve una bandera por sección — no antes: generalizar con un
// solo caso es inventar la forma equivocada con la mitad de la información.
const RUTA_CON_ATENCION = '/admin/pedidos';

// ─── One nav row ──────────────────────────────────────────────────────────────
// Kept a real <Link> (prefetch, middle-click, aria-current). The WHOLE row drives
// the icon animation via local hover state. On the collapsed icon rail the row is
// wrapped in a Radix tooltip (side="right"); everywhere labels are visible, no
// tooltip (a repeated label is noise).
function NavRow({ item, active, iconOnly, animateIndicator, onNavigate, atencion }: {
  item: AdminNavItem;
  active: boolean;
  iconOnly: boolean;
  animateIndicator: boolean;
  onNavigate: () => void;
  /** El dato BAJA por props: el fetch vive en `Sidebar`, que es único. */
  atencion: boolean;
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
      {/* Primitiva del design-system (`.duna-nav-dot`), no un punto ad-hoc: el
          ámbar del sol significa una sola cosa en todo el producto. NO late — el
          anillo pulsante está reservado a "esto está pasando ahora", que es
          transitorio; y NO tiene estado apagado: si no hay nada que atender, no se
          renderiza. Por eso es `{atencion && …}` y no una clase condicional.

          En el rail COLAPSADO va igual —ahí el ícono solo no dice qué pasa, así que
          el punto es lo único que avisa— pero posicionado distinto: `ml-auto`
          serviría sólo con label. Un margen auto absorbe el espacio libre ANTES de
          que `justify-center` reparta, así que en la fila centrada empujaría el
          ícono a la izquierda y el punto al borde. Colapsado va absoluto en la
          esquina, como ya hace el indicador de activo de abajo. */}
      {atencion && (
        <span
          className={cn('duna-nav-dot', iconOnly ? 'absolute right-2 top-2' : 'ml-auto')}
          role="status"
          aria-label={`${item.label} necesita atención`}
        />
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
function SidebarNav({ iconOnly, animateIndicator, onNavigate, atencionPedidos }: {
  iconOnly: boolean;
  animateIndicator: boolean;
  onNavigate: () => void;
  /** Viene de `Sidebar`. NO se consulta acá: con el rail colapsado hay DOS
   *  `SidebarNav` montados a la vez y serían dos pollers. */
  atencionPedidos: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  return (
    <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-4">
      {ADMIN_NAV
        .filter(item => !item.ownerOnly || session?.user?.role === 'OWNER')
        .map(item => {
          // ── ACTIVO ES LA RUTA O UNA SUBRUTA SUYA, NO UN PREFIJO DE TEXTO ────
          //
          // Era `startsWith(item.path)` a secas, que compara CARACTERES y no
          // segmentos: `/admin/clientes-v2` empieza por `/admin/clientes`, así que
          // estando en la pantalla nueva se encendían las DOS entradas. La barra
          // es lo que convierte la comparación en una de jerarquía de rutas —
          // `/admin/clientes/abc` sigue marcando Clientes, que es lo correcto.
          //
          // El defecto estaba latente desde siempre; no lo destapó nadie porque
          // ninguna ruta era prefijo de otra. Cualquier `/admin/<algo>-v2` futuro
          // lo habría vuelto a encontrar.
          const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <NavRow
              key={item.path}
              item={item}
              active={active}
              iconOnly={iconOnly}
              animateIndicator={animateIndicator}
              onNavigate={onNavigate}
              atencion={item.path === RUTA_CON_ATENCION && atencionPedidos}
            />
          );
        })}
    </nav>
  );
}

// ─── User footer ──────────────────────────────────────────────────────────────
// El bloque de usuario del footer ES el menú de cuenta: era información sin
// acción mientras las acciones vivían en la topbar, lejos de la identidad que
// las contextualiza. El contenido no cambia — lo que cambia es que ahora se
// puede hacer clic. Ver `UserMenu` para las variantes y para por qué la topbar
// conserva una copia por debajo de `lg`.
function UserFooter({ compact }: { compact: boolean }) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <UserMenu variant={compact ? 'compact' : 'sidebar'} />
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
          <Search className="h-4.5 w-4.5" />
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
  // UNA sola consulta para todo el nav, acá y no más abajo: con el rail colapsado
  // hay dos `SidebarNav` montados a la vez, así que el hook viviría duplicado.
  const atencionPedidos = useAtencionPedidos();
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
                  <PanelLeftClose className="h-4.5 w-4.5" />
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
          <SidebarNav iconOnly={false} animateIndicator onNavigate={onClose} atencionPedidos={atencionPedidos} />
        </div>
        {collapsed && (
          <div className="hidden flex-1 flex-col overflow-hidden lg:flex">
            <SidebarNav iconOnly animateIndicator onNavigate={onClose} atencionPedidos={atencionPedidos} />
          </div>
        )}

        {/* User footer — compact (avatar only) on the collapsed rail */}
        <div className={cn(collapsed && 'lg:hidden')}><UserFooter compact={false} /></div>
        {collapsed && <div className="hidden lg:block"><UserFooter compact /></div>}
      </aside>
    </>
  );
}
