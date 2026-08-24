'use client';

import {
  Sun, Moon, Monitor, PanelLeftOpen, PanelLeftClose, Search,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import NotificationBell from '@/components/admin/NotificationBell';
import { AnimatedIcon } from '@/components/admin/AnimatedIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@duna/core/utils';
import { ADMIN_ICON_BUTTON } from '@/components/admin/iconButton';
import { UserMenu } from '@/components/admin/UserMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopBarProps {
  sidebarWidth: number | string;
  /** Desktop rail collapsed — surfaces the expand toggle + search in the top bar. */
  collapsed: boolean;
  /** Expand the rail (click). */
  onToggleCollapsed: () => void;
  /** Open the ⌘K command palette (collapsed top-bar search button). */
  onOpenSearch: () => void;
}

// El mismo botón en las DOS aperturas del ⌘K de esta barra —el slot de angosto y
// el del rail colapsado—. Escrito una vez: dos copias del mismo control es cómo
// una se queda sin tooltip o con otra etiqueta.
function BotonBuscar({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={cn(ADMIN_ICON_BUTTON, 'h-9 w-9')} onClick={onClick} aria-label="Buscar (⌘K)">
          <Search className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Buscar (⌘K)</TooltipContent>
    </Tooltip>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopBar({
  sidebarWidth, collapsed, onToggleCollapsed, onOpenSearch,
}: TopBarProps) {
  // `theme` = la ELECCIÓN ('light' | 'dark' | 'system'); `resolvedTheme` = el tema
  // EFECTIVO ya resuelto contra el sistema. El menú marca la elección y el icono
  // muestra lo efectivo: con "Sistema" en un OS oscuro, la opción marcada es
  // Sistema y el icono es la luna.
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted]   = useState(false);

  // Avoid hydration mismatch for the theme icon (server can't know the theme).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes mount guard
    setMounted(true);
  }, []);

  return (
    <header
      className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur transition-[left] duration-300 duna:left-[var(--sb-w)]"
      style={{ "--sb-w": typeof sidebarWidth === "number" ? `${sidebarWidth}px` : sidebarWidth } as React.CSSProperties}
    >
      {/* ── EL BUSCADOR OCUPA EL SLOT DE LA HAMBURGUESA ─────────────────────
          La hamburguesa MURIÓ con el drawer: debajo del breakpoint la navegación
          es la barra inferior. Pero ese slot no podía quedar vacío — el botón de
          Buscar vivía dentro del rail, y el rail tampoco existe en angosto, así
          que borrar la hamburguesa a secas dejaba al teléfono sin ninguna forma
          de abrir el ⌘K (un teclado no siempre hay, y un atajo no se descubre).
          Se va lo que se reemplazó; se queda lo que se habría perdido. */}
      <div className="duna:hidden">
        <BotonBuscar onClick={onOpenSearch} />
      </div>

      {/* EL TOGGLE DE COLAPSAR + BUSCAR viven en la topbar (desktop), no en el rail:
          el rail no lleva controles, sólo marca y navegación (§ Sidebar). Y el toggle
          es UNO SOLO que colapsa Y expande — antes estaba PARTIDO (se colapsaba desde
          el rail y se expandía desde acá), y un control que cambia de superficie según
          su estado es más difícil de encontrar que uno fijo. Siempre visible en
          desktop; el ícono y el label siguen a `collapsed`. En móvil no aparece
          (`duna:flex`): el rail no existe y la topbar ya está apretada. */}
      <div className="hidden items-center gap-1 duna:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(ADMIN_ICON_BUTTON, 'h-9 w-9')}
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expandir panel' : 'Colapsar panel'}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{collapsed ? 'Expandir panel' : 'Colapsar panel'}</TooltipContent>
        </Tooltip>
        <BotonBuscar onClick={onOpenSearch} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Selector de tema — TRES estados, no un toggle. Un toggle binario
            persiste una elección explícita la primera vez que se usa y deja el
            admin sin camino de vuelta a seguir al sistema operativo (el provider
            monta `defaultTheme="system"`, pero nada podía volver a 'system'). */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className={cn(ADMIN_ICON_BUTTON, 'h-9 w-9')} aria-label="Cambiar tema">
                  {/* El icono es el tema EFECTIVO; hasta `mounted` no se puede
                      saber (el server no conoce el OS del cliente) → placeholder
                      del mismo tamaño para no mover el layout. */}
                  {mounted
                    ? <AnimatedIcon icon={resolvedTheme === 'dark' ? Moon : Sun} anim="rotate" size={16} />
                    : <div className="h-4 w-4" />}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Cambiar tema</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-40">
            {/* RadioGroup y no Items sueltos: son tres opciones mutuamente
                excluyentes, así se marca la activa y se obtiene el
                role=menuitemradio + aria-checked correcto. El valor leído es
                `theme` (la elección), por eso "Sistema" aparece marcado aunque el
                resuelto sea oscuro. */}
            <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4 text-muted-foreground" /> Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4 text-muted-foreground" /> Oscuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4 text-muted-foreground" /> Sistema
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications (tooltip + animation live inside the component) */}
        <NotificationBell />

        {/* Menú de usuario — SOLO en angosto. En ancho vive en el footer del
            rail, que está siempre a la vista; en angosto el rail NO EXISTE (no
            está escondido: no se renderiza), así que ésta es la única salida de
            sesión. Es el mismo componente, no una copia — y es la razón por la
            que el sheet de "Más" NO lleva bloque de usuario, aunque la maqueta lo
            dibuje: sería el segundo sitio para la misma identidad. */}
        <div className="duna:hidden">
          <UserMenu variant="topbar" />
        </div>

      </div>
    </header>
  );
}
