'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import { cn, getInitials } from '@duna/core/utils';

const LABEL_ROL: Record<string, string> = { OWNER: 'Dueño', MANAGER: 'Gerente', STAFF: 'Empleado' };

// ─── Menú de usuario ─────────────────────────────────────────────────────────
// UNA definición de las acciones de cuenta (perfil, configuración, cerrar
// sesión) para las dos ubicaciones donde aparece. Vive acá y no duplicada
// porque el logout no puede depender de cuál de las dos copias se actualizó:
// una divergencia entre ellas dejaría la acción más importante del panel
// funcionando en un breakpoint y no en el otro.
//
// DÓNDE SE MONTA:
//   • `sidebar`  — footer del rail expandido.
//   • `compact`  — rail colapsado de escritorio: solo el avatar.
//
// LA VARIANTE `topbar` SE RETIRÓ (§ PANEL-ESTRUCTURA-TIENDA-1, REDISENO.md § 3: "El avatar de la
// barra superior se retira — un solo lugar para el usuario"). Por debajo del breakpoint `duna` el
// rail no existe, pero la identidad y el logout ya no dependen de un segundo disparador en la
// topbar: viven en la hoja «Más» de `MobileNav`, igual que las entradas del negocio.

type UserMenuVariant = 'sidebar' | 'compact';

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
  const rol       = isPending || !user?.role ? '' : (LABEL_ROL[user.role] ?? user.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* El bloque de usuario ENTERO es el disparador — el mismo contenido que antes
            era informativo, ahora accionable. */}
        <button
          aria-label="Menú de usuario"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
            'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            variant === 'compact' && 'justify-center',
          )}
        >
          {/* INICIALES EN TINTA, NO ÁMBAR (§ CLAUDE.md, Amber Minimal): `--sidebar-primary` no
              tiene remapeo a `--duna-*` (reservado para los controles, § "El CHROME del panel ES
              del design-system"), así que `bg-sidebar-primary` seguía siendo ámbar dentro del
              admin. El mismo par ink/paper que `.duna-btn--primary` y que `NegocioMenu`. */}
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--duna-ink)', color: 'var(--duna-paper)' }}
          >
            <span className="text-xs font-semibold">{iniciales}</span>
          </span>
          {variant === 'sidebar' && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate whitespace-nowrap text-xs font-medium text-sidebar-foreground">
                  {nombre}
                </span>
                <span className="block truncate whitespace-nowrap text-xs text-sidebar-foreground/40">
                  {rol}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      {/* El disparador está abajo del todo del rail, así que el menú abre hacia ARRIBA. */}
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-56"
      >
        {/* Identidad: en el rail colapsado el disparador no la muestra, así que el
            menú es el único lugar donde se lee. */}
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
          {/* "Configuración" otra vez: con el editor del negocio la pantalla dejó de
              mostrar sólo equipo, así que el nombre del área ya no es una promesa vacía
              (fue "Equipo y usuarios" mientras eso era todo lo que hacía). */}
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
