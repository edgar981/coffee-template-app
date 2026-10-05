'use client';

import Link from 'next/link';
import { ChevronDown, ExternalLink, SlidersHorizontal, Store } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { cn, getInitials } from '@duna/core/utils';

// ─── Menú del negocio (§ PANEL-ESTRUCTURA-TIENDA-1, REDISENO.md § 3) ──────────
//
// El nombre del negocio deja de ser texto muted bajo el lockup de Duna y pasa a ser una tarjeta
// CLICKEABLE en el rail: tocarla abre «Editar tienda · Ver tienda · Datos del negocio». Mismo
// patrón que `UserMenu` (Radix DropdownMenu, no un popover hecho a mano) — foco atrapado, Escape y
// click-fuera gratis, en vez de reimplementar lo que esa primitiva ya da.
//
// SÓLO INICIALES — sin el ícono del logo. El spec de este slice ofrecía la alternativa ("iniciales
// o el ícono del logo si la tienda lo tiene"), pero ese ícono vive en `SiteContent.logo` (el
// storefront), no en `SiteSetting` (la identidad del negocio) — y el árbol del admin NO monta
// `SiteContentProvider` (sólo el storefront y el editor lo hacen). Leerlo acá habría exigido sumar
// ese provider a TODO el admin, o un fetch propio — superficie fuera de lo que este slice necesita
// para la estructura del menú. Iniciales es el fallback que el propio spec ya permite, y es lo que
// usa HOY cualquier tenant sin logo subido.
//
// LA CIUDAD DEL PROTOTIPO ("Tu tienda · Neiva") NO SE REPLICA: no hay dato de ciudad en
// `SiteSetting` y no se inventa uno — el subtítulo se queda en "Tu tienda" a secas.
//
// EL AVATAR ES TINTA, NO ÁMBAR (§ CLAUDE.md, Amber Minimal — el sol es atención, no decoración):
// `--duna-ink`/`--duna-paper`, el mismo par que pinta `.duna-btn--primary`, en vez del
// `bg-sidebar-primary` que no tiene contraparte Duna (§ CLAUDE.md, "El CHROME del panel ES del
// design-system" — `--sidebar-primary` es de las pocas rutas sin remapear, reservada para los
// controles).

export function NegocioMenu({ compact }: { compact: boolean }) {
  const { nombre } = useSiteSettings();
  const iniciales = getInitials(nombre);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Menú de la tienda"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border px-2.5 py-2 text-left transition-colors',
            'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            compact && 'justify-center border-transparent px-0',
          )}
        >
          <span
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]"
            style={{ background: 'var(--duna-ink)', color: 'var(--duna-paper)' }}
          >
            <span className="text-xs font-semibold">{iniciales}</span>
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate whitespace-nowrap text-xs font-semibold text-sidebar-foreground">
                  {nombre}
                </span>
                <span className="block truncate whitespace-nowrap text-xs text-sidebar-foreground/55">
                  Tu tienda
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="bottom" sideOffset={8} className="w-56">
        <DropdownMenuItem asChild>
          {/* «Editar tienda» va DIRECTO al editor de pantalla completa, no a la portada de
              `/admin/tienda` — es el atajo que el spec pide, no un paso intermedio. */}
          <Link href="/editor/tienda" className="cursor-pointer">
            <Store className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Editar tienda</span>
            <span className="text-xs text-muted-foreground">Editor</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/" target="_blank" rel="noreferrer" className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" /> Ver tienda
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          {/* "Datos del negocio": la parte de identidad de Configuración (§ Config del negocio —
              SiteSetting, CLAUDE.md), no la de equipo. La pantalla ya abre ahí por defecto. */}
          <Link href="/admin/configuracion" className="cursor-pointer">
            <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" /> Datos del negocio
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
