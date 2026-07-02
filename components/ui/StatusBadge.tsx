import { cn } from '@/lib/utils';

type Status = keyof typeof statusConfig;

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

const statusConfig = {
  // Órdenes
  pendiente:        { label: 'Pendiente',   class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  confirmado:       { label: 'Confirmado',  class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  pagado:           { label: 'Pagado',      class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  preparando:       { label: 'Preparando',  class: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
  enviado:          { label: 'Enviado',     class: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  entregado:        { label: 'Entregado',   class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelado:        { label: 'Cancelado',   class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  // Pagos
  completado:       { label: 'Completado',  class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  fallido:          { label: 'Fallido',     class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  reembolsado:      { label: 'Reembolsado', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  parcial:          { label: 'Parcial',     class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  // Entregas
  programado:       { label: 'Programado',  class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  en_ruta:          { label: 'En Ruta',     class: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  fallido_entrega:  { label: 'Fallido',     class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  reprogramado:     { label: 'Reprogramado',class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as Status] ?? { label: status, class: 'bg-gray-100 text-gray-700' };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.class, className)}>
      {config.label}
    </span>
  );
}