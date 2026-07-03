import { LucideIcon } from "lucide-react";

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
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