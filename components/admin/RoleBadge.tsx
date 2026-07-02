import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'OWNER' | 'MANAGER' | 'STAFF';
type BadgeSize = 'sm' | 'lg';

interface RoleBadgeProps {
  role:   string;
  size?:  BadgeSize;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const config: Record<Role, { label: string; class: string }> = {
  OWNER:   { label: 'Dueño',    class: 'bg-primary/10 text-primary border-primary/20' },
  MANAGER: { label: 'Gerente',  class: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
  STAFF:   { label: 'Empleado', class: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' },
};

const FALLBACK = config.STAFF;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const c = config[role as Role] ?? FALLBACK;

  return (
    <span className={cn(
      'inline-flex items-center font-semibold border rounded-lg',
      size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5',
      c.class,
    )}>
      {c.label}
    </span>
  );
}