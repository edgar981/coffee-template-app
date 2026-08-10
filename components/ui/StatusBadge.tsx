import { cn } from '@duna/core/utils';

type Status = keyof typeof statusConfig;

interface StatusBadgeProps {
  status?: Status | string;
  /**
   * Tono del semáforo para una etiqueta COMPUESTA — una que no es un valor del
   * enum y por tanto no puede estar en el mapa de abajo (la columna Entrega de
   * Órdenes: "Lista para despacho · 14 may 2026"). Con `tone`, el texto lo pone
   * `label`. Existe para que esas etiquetas NO se pinten con un mapa de colores
   * propio: el semáforo sigue viviendo en este archivo y sólo en este.
   */
  tone?: SemaphoreTone;
  /** Texto del badge cuando se usa `tone`. */
  label?: string;
  /** Tooltip nativo — el matiz que no cabe en la etiqueta. */
  title?: string;
  className?: string;
  /**
   * 'auto' (default): pale-fill/dark-text in light mode, deeper-fill/light-text
   * in dark mode — follows the admin theme toggle.
   * 'light': light styles only, for the single-theme storefront (which shares
   * the app-wide `.dark` class but is always visually light).
   */
  theme?: 'auto' | 'light';
}

// ─── The muted semaphore (Regla 2) ───────────────────────────────────────────
// Process states only, mapped to a 4-tone semaphore + neutral — NEVER per-state
// hues. "Muted" = low-saturation fill + dark same-hue text (AA on light; AA on
// dark with the light same-hue text). Categorical labels (zona, canal) do NOT use
// this — they render neutral outline/gris in place.
//   WARN  = ámbar  (pendiente, parcial, reprogramado — awaiting action)
//   OK    = verde  (pagada, entregado, completado)
//   DANGER= rojo   (cancelado, fallido)
//   INFO  = azul   (in-progress: preparando, enviado, programado, en ruta) — the
//                   ONE informational tone allowed
//   NEUTRAL= gris  (reembolsado, and the fallback)
const WARN    = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
const OK      = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
const DANGER  = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
const INFO    = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
const NEUTRAL = 'bg-muted text-muted-foreground';

// Los cinco tonos, nombrados. Es la MISMA tabla de arriba, expuesta para las
// etiquetas compuestas — no una segunda paleta.
const TONOS = { warn: WARN, ok: OK, danger: DANGER, info: INFO, neutral: NEUTRAL } as const;

export type SemaphoreTone = keyof typeof TONOS;

const semaphore = (label: string, tone: string) => ({
  label,
  light: tone.split(' ').filter((c) => !c.startsWith('dark:')).join(' '),
  dark:  tone.split(' ').filter((c) => c.startsWith('dark:')).join(' '),
});

const statusConfig = {
  // Órdenes — "Pagada" es la fuente ÚNICA del wording de pago (Confirmado se
  // fusionó en Pagado; concuerda con «la orden» y con el PaymentHint de Entregas).
  pendiente:        semaphore('Pendiente',    WARN),
  pagado:           semaphore('Pagada',       OK),
  preparando:       semaphore('Preparando',   INFO),
  enviado:          semaphore('Enviado',      INFO),
  entregado:        semaphore('Entregado',    OK),
  cancelado:        semaphore('Cancelado',    DANGER),
  // Pagos
  completado:       semaphore('Completado',   OK),
  fallido:          semaphore('Fallido',      DANGER),
  reembolsado:      semaphore('Reembolsado',  NEUTRAL),
  parcial:          semaphore('Parcial',      WARN),
  // Entregas
  programado:       semaphore('Programado',   INFO),
  en_ruta:          semaphore('En Ruta',      INFO),
  fallido_entrega:  semaphore('Fallido',      DANGER),
  reprogramado:     semaphore('Reprogramado', WARN),
  // Ejecuciones de automatizaciones (AutomationRunEstado — enum en MAYÚSCULAS, así
  // que no colisiona con las keys de arriba). PENDIENTE_CANAL va ámbar porque es
  // exactamente eso: a la espera de una acción (conectar el canal), no un éxito.
  ENVIADO:          semaphore('Enviado',      OK),
  PENDIENTE_CANAL:  semaphore('Sin canal',    WARN),
  FALLIDO:          semaphore('Falló',        DANGER),
  OMITIDO:          semaphore('Omitido',      NEUTRAL),
  // Se evaluó y se calló porque ya estaba atendido. Va NEUTRAL y no WARN: no hay
  // nada que hacer al respecto — es la idempotencia funcionando, no una espera.
  DUPLICADO:        semaphore('Sin repetir',  NEUTRAL),
};

const FALLBACK = { label: '', light: 'bg-muted text-muted-foreground', dark: '' };

export default function StatusBadge({ status, tone, label, title, className, theme = 'auto' }: StatusBadgeProps) {
  const config = tone
    ? semaphore(label ?? String(status ?? ''), TONOS[tone])
    : statusConfig[status as Status] ?? { ...FALLBACK, label: status };

  return (
    <span
      title={title}
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
