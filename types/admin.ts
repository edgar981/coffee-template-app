import { LucideIcon } from "lucide-react";

/** El rail es de ESCRITORIO y nada más. Debajo del breakpoint del sistema no se
 *  esconde detrás de una hamburguesa: no existe, y la navegación es `MobileNav`.
 *  De ahí que ya no haya `mobileOpen` ni `onClose`. */
export interface SidebarProps {
  /** Rail colapsado (72px) contra expandido (240px). */
  collapsed: boolean;
  // Buscar y el toggle de colapsar salieron del rail a la topbar (§ TopBar): el rail
  // no lleva controles, sólo marca y navegación. Por eso ya no van `onToggle` ni
  // `onOpenSearch` — sus handlers viven en la topbar.
}

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  ownerOnly?: boolean;
}

export type Role = 'OWNER' | 'MANAGER' | 'STAFF';

export interface AdminUser {
  id:    string;
  name:  string;
  email: string;
  role:  Role;
  /** Acceso al panel. Un usuario inactivo conserva su historial y puede volver. */
  activo: boolean;
}