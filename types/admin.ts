import { LucideIcon } from "lucide-react";

/** El rail es de ESCRITORIO y nada más. Debajo del breakpoint del sistema no se
 *  esconde detrás de una hamburguesa: no existe, y la navegación es `MobileNav`.
 *  De ahí que ya no haya `mobileOpen` ni `onClose`. */
export interface SidebarProps {
  /** Rail colapsado (72px) contra expandido (240px). */
  collapsed: boolean;
  /** Alterna el rail (control PanelLeft, sólo en estado expandido). */
  onToggle: () => void;
  /** Abre la paleta ⌘K (botón Buscar del rail). */
  onOpenSearch: () => void;
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