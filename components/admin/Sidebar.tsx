"use client";
import Link from 'next/link';
import { useState, Fragment } from 'react';
import { cn } from '@duna/core/utils';
import { PanelLeftClose, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePathname } from "next/navigation";
import { SidebarProps } from '@/types/admin';
import { ADMIN_NAV, type AdminNavItem } from '@/constants/admin-nav';
import { AnimatedIcon } from '@/components/admin/AnimatedIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { authClient } from "@/lib/auth-client";
import { ADMIN_ICON_BUTTON } from '@/components/admin/iconButton';
import { UserMenu } from '@/components/admin/UserMenu';
import { useAtencion } from '@/hooks/useAtencion';
import { atencionDeRuta, type MapaAtencion } from '@/lib/atencion/registro';

// ─── EL PUNTO SOL ─────────────────────────────────────────────────────────────
//
// Era una constante (`RUTA_CON_ATENCION = '/admin/pedidos'`) porque había UNA sola
// sección con regla de atención, y su comentario dejaba escrito el disparador:
// "cuando una segunda sección tenga la suya, esto se vuelve un mapa y el endpoint
// devuelve una bandera por sección". Productos es esa segunda sección, así que la
// constante murió y el registro vive en `lib/atencion/registro.ts` — un solo sitio
// para las dos superficies de navegación, no una copia acá y otra en MobileNav.

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
function SidebarNav({ iconOnly, animateIndicator, onNavigate, atencion }: {
  iconOnly: boolean;
  animateIndicator: boolean;
  onNavigate: () => void;
  /** Viene de `Sidebar`. NO se consulta acá: con el rail colapsado hay DOS
   *  `SidebarNav` montados a la vez y serían dos pollers. */
  atencion: MapaAtencion;
}) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const visibles = ADMIN_NAV.filter(item => !item.ownerOnly || session?.user?.role === 'OWNER');

  return (
    <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-4">
      {visibles.map((item, i) => {
        // ── ACTIVO ES LA RUTA O UNA SUBRUTA SUYA, NO UN PREFIJO DE TEXTO ────
        //
        // Era `startsWith(item.path)` a secas, que compara CARACTERES y no
        // segmentos. La barra es lo que convierte la comparación en una de
        // jerarquía de rutas: `/admin/clientes/abc` sigue marcando Clientes,
        // que es lo correcto. El caso que lo destapó —`/admin/clientes-v2`— ya no
        // existe, pero el fix se QUEDA: la regla es general y cualquier
        // `/admin/<algo>-v2` futuro lo vuelve a encontrar.
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);

        // El encabezado de sección va al PRIMER ítem de cada sección (el tag cambia
        // respecto del anterior), y SÓLO en el rail expandido: colapsado es
        // icon-only y un texto ahí no tiene sitio. Hoy no lleva sección → sin
        // encabezado. El agrupado es contiguo, así que basta comparar con el previo.
        const abreSeccion = item.seccion && item.seccion !== visibles[i - 1]?.seccion;

        return (
          <Fragment key={item.path}>
            {!iconOnly && abreSeccion && (
              <div className="admin-nav-seccion">{item.seccion}</div>
            )}
            <NavRow
              item={item}
              active={active}
              iconOnly={iconOnly}
              animateIndicator={animateIndicator}
              onNavigate={onNavigate}
              atencion={atencionDeRuta(atencion, item.path)}
            />
          </Fragment>
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
// conserva una copia por debajo del breakpoint del sistema.
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
// El LOGO HORIZONTAL real (mark + "DUNA"), no el wordmark en texto. Antes era texto
// porque se quería sólo el wordmark y el SVG horneaba mark+lettering junto; el owner
// decidió usar el lockup completo, que es justo lo que ese archivo trae. Variante
// negativa para oscuro, igual que el mark del rail colapsado.
//
// EL ÁMBAR DEL ASSET (#F59E0B = `--duna-sol`) ES MARCA, NO ESTADO — excepción
// declarada (§ CLAUDE.md, "El ámbar del logo es marca, no atención"). Un logo es la
// firma del producto, no un semáforo; ya vivía en el mark colapsado.
//
// `max-h-7 max-w-full w-auto`: escala para caber sin distorsión (nunca `h-` fijo con
// `max-w`, que aplastaría el logo si el área del lockup es más angosta que su ancho).
function BrandLockup() {
  return (
    <div className="mt-2 min-w-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/duna-logo-horizontal-v1.svg" alt="Duna" className="block max-h-7 w-auto max-w-full object-contain dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/duna-logo-horizontal-negative-v1.svg" alt="Duna" className="hidden max-h-7 w-auto max-w-full object-contain dark:block" />
      <p className="mt-2 mb-2 whitespace-nowrap text-[13px] leading-none text-sidebar-foreground/55" style={{ fontFamily: 'var(--duna-font-ui)' }}>
        Café Nayoli
      </p>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
//
// ── EL RAIL ES DE ESCRITORIO, Y YA NO TIENE VERSIÓN MÓVIL ────────────────────
//
// Hasta la tanda de móvil esto era además un drawer off-canvas con hamburguesa,
// backdrop, bloqueo de scroll y Escape. Todo eso se BORRÓ: debajo del breakpoint
// la navegación es `MobileNav`, y un menú detrás de un botón conviviendo con una
// barra siempre visible son dos respuestas a la misma pregunta.
//
// Lo que se fue con el drawer, y conviene saber que se fue a propósito:
//
//   • el bloqueo de scroll hecho a mano (`body.style.overflow = 'hidden'`), que
//     además estaba a MEDIAS — le faltaba la prevención a nivel de evento, sin la
//     cual iOS Safari sigue moviendo el fondo detrás del panel. El sheet que lo
//     reemplaza la trae con Radix (§ DunaSheet);
//   • el backdrop `bg-black/50` a mano, que era una TERCERA definición del velo
//     junto a `.duna-scrim` y `overlayClasses`;
//   • el Escape y el cierre al navegar, que el sheet resuelve por su cuenta.
//
// El breakpoint es `duna` (960), el del sistema — no el `lg` de 1024 que venía
// por default y que dejaba una franja con barra inferior y rail a la vez.
export default function Sidebar({ collapsed, onToggle, onOpenSearch }: SidebarProps) {
  // UNA sola consulta para todo el nav, acá y no más abajo: con el rail colapsado
  // hay dos `SidebarNav` montados a la vez, así que el hook viviría duplicado.
  // `MobileNav` tiene la suya y no comparte ésta: las dos superficies nunca están
  // montadas al mismo tiempo, así que no hay dos pollers.
  const atencion = useAtencion();

  return (
    <>
      {/* Rail en el flujo, sólo en ancho. Colapsado = rail de íconos estático: el
          hover muestra tooltips (sin overlay) y el toggle es la única forma de
          expandir o colapsar. */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 hidden h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar',
          'w-60 transition-[width] duration-300 ease-in-out duna:flex',
          collapsed && 'duna:w-18',
        )}
      >
        {/* Header — brand + (expanded only) search & collapse toggle */}
        <div className={cn(
          'relative flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3',
          collapsed && 'duna:justify-center',
        )}>
          {/* Full lockup — hidden only on the collapsed desktop rail */}
          <div className={cn('min-w-0 flex-1', collapsed && 'duna:hidden')}>
            <BrandLockup />
          </div>

          {/* Mark — collapsed desktop rail only */}
          <div className={cn('hidden', collapsed && 'duna:flex duna:items-center duna:justify-center')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-mark-v1.svg" alt="Duna" className="h-6 w-6 object-contain dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/duna-mark-negative-v1.svg" alt="Duna" className="hidden h-6 w-6 object-contain dark:block" />
          </div>

          {/* Search — expanded rail only; hidden on the collapsed rail (⌘K sigue) */}
          <div className={cn('shrink-0', collapsed && 'duna:hidden')}>
            <SearchButton onClick={onOpenSearch} />
          </div>

          {/* Collapse toggle — expanded desktop rail only (when collapsed it lives
              in the top bar). PanelLeftClose = "collapse". */}
          <div className={cn('hidden', !collapsed && 'duna:block')}>
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
        </div>

        {/* Nav — icon-only + tooltips on the collapsed rail, labelled otherwise.
            `onNavigate` ya no cierra nada (el drawer murió), pero la prop se
            conserva: `NavRow` la usa y el rail expandido de un monitor angosto
            puede querer un efecto al navegar. Hoy es un no-op DECLARADO, no un
            resto olvidado. */}
        <div className={cn('flex flex-1 flex-col overflow-hidden', collapsed && 'duna:hidden')}>
          <SidebarNav iconOnly={false} animateIndicator onNavigate={() => {}} atencion={atencion} />
        </div>
        {collapsed && (
          <div className="hidden flex-1 flex-col overflow-hidden duna:flex">
            <SidebarNav iconOnly animateIndicator onNavigate={() => {}} atencion={atencion} />
          </div>
        )}

        {/* User footer — compact (avatar only) on the collapsed rail */}
        <div className={cn(collapsed && 'duna:hidden')}><UserFooter compact={false} /></div>
        {collapsed && <div className="hidden duna:block"><UserFooter compact /></div>}
      </aside>
    </>
  );
}
