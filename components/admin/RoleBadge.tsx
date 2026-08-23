// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'OWNER' | 'MANAGER' | 'STAFF';
type BadgeSize = 'sm' | 'lg';

interface RoleBadgeProps {
  role:   string;
  size?:  BadgeSize;
}

// ─── Config ───────────────────────────────────────────────────────────────────
//
// EL ROL ES UNA CATEGORÍA, NO UN ESTADO — así que va NEUTRO, no con color propio.
// La versión vieja los pintaba con la rampa pastel (violeta el Gerente, celeste el
// Empleado), que es exactamente el "color que identifica" que Amber Minimal prohíbe
// en un badge: entrena al operador a leer el color como si dijera algo. Lo que
// distingue a los tres es su ETIQUETA (Dueño / Gerente / Empleado), no su tinte.

const LABEL: Record<Role, string> = {
  OWNER:   'Dueño',
  MANAGER: 'Gerente',
  STAFF:   'Empleado',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const label = LABEL[role as Role] ?? LABEL.STAFF;

  return (
    <span
      className="duna-badge duna-badge--neutral"
      style={size === 'lg'
        ? { fontSize: 'var(--duna-text-label)', padding: 'var(--duna-space-1) var(--duna-space-3)' }
        : undefined}
    >
      {label}
    </span>
  );
}
