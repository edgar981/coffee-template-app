import { LucideIcon } from "lucide-react";

export interface SidebarProps {
  /** Desktop rail collapsed (72px) vs expanded (240px). Irrelevant < lg. */
  collapsed: boolean;
  /** Toggle the desktop rail (PanelLeft control, expanded state only). */
  onToggle: () => void;
  /** Mobile drawer open. Irrelevant ≥ lg. */
  mobileOpen: boolean;
  /** Close the mobile drawer (backdrop / Escape / nav / close button). */
  onClose: () => void;
  /** Open the ⌘K command palette (sidebar Search button). */
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