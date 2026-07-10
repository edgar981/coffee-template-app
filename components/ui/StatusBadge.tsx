import { cn } from '@/lib/utils';

type Status = keyof typeof statusConfig;

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
  /**
   * 'auto' (default): pale-fill/dark-text in light mode, deeper-fill/light-text
   * in dark mode — follows the admin theme toggle.
   * 'light': light styles only, for the single-theme storefront (which shares
   * the app-wide `.dark` class but is always visually light).
   */
  theme?: 'auto' | 'light';
}

// Light = pale tinted fill + dark same-hue text (WCAG AA on light backgrounds).
// Dark  = deeper/low-opacity fill + light same-hue text (WCAG AA on dark).
const statusConfig = {
  // Órdenes
  pendiente:        { label: 'Pendiente',   light: 'bg-amber-100 text-amber-800',   dark: 'dark:bg-amber-900/30 dark:text-amber-400' },
  // Confirmado merged into Pagado (payment confirmed = order confirmed).
  pagado:           { label: 'Pagado',      light: 'bg-emerald-100 text-emerald-800', dark: 'dark:bg-emerald-900/30 dark:text-emerald-400' },
  preparando:       { label: 'Preparando',  light: 'bg-violet-100 text-violet-800',  dark: 'dark:bg-violet-900/30 dark:text-violet-400' },
  enviado:          { label: 'Enviado',     light: 'bg-sky-100 text-sky-800',        dark: 'dark:bg-sky-900/30 dark:text-sky-400' },
  entregado:        { label: 'Entregado',   light: 'bg-green-100 text-green-800',     dark: 'dark:bg-green-900/30 dark:text-green-400' },
  cancelado:        { label: 'Cancelado',   light: 'bg-red-100 text-red-800',         dark: 'dark:bg-red-900/30 dark:text-red-400' },
  // Pagos
  completado:       { label: 'Completado',  light: 'bg-green-100 text-green-800',     dark: 'dark:bg-green-900/30 dark:text-green-400' },
  fallido:          { label: 'Fallido',     light: 'bg-red-100 text-red-800',         dark: 'dark:bg-red-900/30 dark:text-red-400' },
  reembolsado:      { label: 'Reembolsado', light: 'bg-gray-100 text-gray-700',       dark: 'dark:bg-gray-800 dark:text-gray-400' },
  parcial:          { label: 'Parcial',     light: 'bg-orange-100 text-orange-800',   dark: 'dark:bg-orange-900/30 dark:text-orange-400' },
  // Entregas
  programado:       { label: 'Programado',  light: 'bg-blue-100 text-blue-800',       dark: 'dark:bg-blue-900/30 dark:text-blue-400' },
  en_ruta:          { label: 'En Ruta',     light: 'bg-sky-100 text-sky-800',         dark: 'dark:bg-sky-900/30 dark:text-sky-400' },
  fallido_entrega:  { label: 'Fallido',     light: 'bg-red-100 text-red-800',         dark: 'dark:bg-red-900/30 dark:text-red-400' },
  reprogramado:     { label: 'Reprogramado',light: 'bg-amber-100 text-amber-800',     dark: 'dark:bg-amber-900/30 dark:text-amber-400' },
};

const FALLBACK = { label: '', light: 'bg-gray-100 text-gray-700', dark: 'dark:bg-gray-800 dark:text-gray-300' };

export default function StatusBadge({ status, className, theme = 'auto' }: StatusBadgeProps) {
  const config = statusConfig[status as Status] ?? { ...FALLBACK, label: status };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.light,
        theme === 'auto' && config.dark,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
