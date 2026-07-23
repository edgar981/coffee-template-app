import { LucideIcon } from "lucide-react";

export interface SidebarProps {
  /** Desktop rail collapsed (72px) vs expanded (240px). Irrelevant < lg. */
  collapsed: boolean;
  /** Toggle the desktop rail (collapse chevron). */
  onToggle: () => void;
  /** Mobile drawer open. Irrelevant ≥ lg. */
  mobileOpen: boolean;
  /** Close the mobile drawer (backdrop / Escape / nav / close button). */
  onClose: () => void;
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
}