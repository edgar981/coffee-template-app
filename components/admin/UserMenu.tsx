'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import { cn, getInitials } from '@/lib/utils';

// ─── Menú de usuario ─────────────────────────────────────────────────────────
// UNA definición de las acciones de cuenta (perfil, configuración, cerrar
// sesión) para las dos ubicaciones donde aparece. Vive acá y no duplicada
// porque el logout no puede depender de cuál de las dos copias se actualizó:
// una divergencia entre ellas dejaría la acción más importante del panel
// funcionando en un breakpoint y no en el otro.
//
// DÓNDE SE MONTA (ver la nota de mobile en Sidebar/TopBar):
//   • `sidebar`  — footer del rail expandido y del drawer móvil.
//   • `compact`  — rail colapsado de escritorio: solo el avatar.
//   • `topbar`   — SOLO por debajo de `lg`, donde el sidebar es un drawer
//     oculto y el footer no está a la vista.

type UserMenuVariant = 'sidebar' | 'compact' | 'topbar';

export function UserMenu({ variant }: { variant: UserMenuVariant }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  const iniciales = getInitials(user?.name);
  const nombre    = isPending ? '…' : user?.name ?? 'Usuario';
  const correo    = isPending ? '' : user?.email ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'topbar' ? (
          <button
            aria-label="Menú de usuario"
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-xs font-semibold text-primary">{iniciales}</span>
            </span>
            <span className="hidden max-w-20 truncate text-xs font-medium text-foreground sm:block">
              {nombre.split(' ')[0]}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          // Sidebar: el bloque de usuario ENTERO es el disparador — el mismo
          // contenido que antes era informativo, ahora accionable.
          <button
            aria-label="Menú de usuario"
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
              'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              variant === 'compact' && 'justify-center',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20">
              <span className="text-xs font-semibold text-sidebar-primary">{iniciales}</span>
            </span>
            {variant === 'sidebar' && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate whitespace-nowrap text-xs font-medium text-sidebar-foreground">
                    {nombre}
                  </span>
                  <span className="block truncate whitespace-nowrap text-xs text-sidebar-foreground/40">
                    {correo}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
              </>
            )}
          </button>
        )}
      </DropdownMenuTrigger>

      {/* En el sidebar el disparador está abajo del todo, así que el menú abre
          hacia ARRIBA; en la topbar, hacia abajo y alineado a la derecha. */}
      <DropdownMenuContent
        align={variant === 'topbar' ? 'end' : 'start'}
        side={variant === 'topbar' ? 'bottom' : 'top'}
        sideOffset={8}
        className="w-56"
      >
        {/* Identidad: en el rail colapsado y en la topbar el disparador no la
            muestra, así que el menú es el único lugar donde se lee. */}
        <div className="border-b border-border px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-foreground">{nombre}</p>
          {correo && <p className="truncate text-xs text-muted-foreground">{correo}</p>}
        </div>

        <DropdownMenuItem asChild>
          <Link href="/admin/perfil" className="cursor-pointer">
            <User className="mr-2 h-4 w-4 text-muted-foreground" /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/configuracion" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" /> Configuración
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={handleLogout}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
