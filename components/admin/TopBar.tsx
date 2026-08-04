'use client';

import {
  Menu, Sun, Moon, Monitor, PanelLeftOpen, Search,
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
import { cn } from '@/lib/utils';
import { ADMIN_ICON_BUTTON } from '@/components/admin/iconButton';
import { UserMenu } from '@/components/admin/UserMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMenuToggle: () => void;
  sidebarWidth: number | string;
  /** Desktop rail collapsed — surfaces the expand toggle + search in the top bar. */
  collapsed: boolean;
  /** Expand the rail (click). */
  onToggleCollapsed: () => void;
  /** Open the ⌘K command palette (collapsed top-bar search button). */
  onOpenSearch: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopBar({
  onMenuToggle, sidebarWidth, collapsed, onToggleCollapsed, onOpenSearch,
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
      className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur transition-[left] duration-300 lg:left-[var(--sb-w)]"
      style={{ "--sb-w": typeof sidebarWidth === "number" ? `${sidebarWidth}px` : sidebarWidth } as React.CSSProperties}
    >
      {/* Mobile menu toggle — opens the off-canvas drawer (< lg only) */}
      <button className={cn(ADMIN_ICON_BUTTON, 'h-9 w-9 lg:hidden')} onClick={onMenuToggle} aria-label="Abrir menú">
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop expand toggle + search — only when the rail is collapsed (when
          expanded they live in the sidebar header). Clicking the toggle expands the
          rail; the search button opens the ⌘K palette. */}
      {collapsed && (
        <div className="hidden items-center gap-1 lg:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(ADMIN_ICON_BUTTON, 'h-9 w-9')}
                onClick={onToggleCollapsed}
                aria-label="Expandir panel"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Expandir panel</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(ADMIN_ICON_BUTTON, 'h-9 w-9')}
                onClick={onOpenSearch}
                aria-label="Buscar (⌘K)"
              >
                <Search className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Buscar (⌘K)</TooltipContent>
          </Tooltip>
        </div>
      )}

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

        {/* Menú de usuario — SOLO por debajo de `lg`. En escritorio vive en el
            footer del sidebar, que está siempre a la vista; en móvil el sidebar
            es un drawer oculto tras la hamburguesa, así que dejar ahí la única
            salida de sesión la escondería detrás de dos toques y de un panel de
            navegación. Es el mismo componente, no una copia. */}
        <div className="lg:hidden">
          <UserMenu variant="topbar" />
        </div>

      </div>
    </header>
  );
}
