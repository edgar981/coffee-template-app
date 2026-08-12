import type { ReactNode } from 'react';
import { BADGE_TONE_CLASS, type BadgeTone } from '../primitives/status';

// Fila compuesta de una lista de pedidos — AGNÓSTICA. No conoce el tipo `Order`
// ni nada de dominio: recibe props genéricos ya resueltos por el consumidor
// (nombre, id, monto formateado, canal como nodo, estado, progreso, "hace X").
// El "en curso" vive SOLO en `steps` (BadgeTone no tiene tono de progreso), así
// que un badge de estado nunca puede afirmar "en camino": eso lo dicen los steps.

export interface OrderSteps {
  /** Total de segmentos (los mismos para toda una vertical). */
  count: number;
  /** Índice del segmento actual (0-based); los `< current` van "hechos". */
  current: number;
  /** Secuencia terminada: sin "ahora", todo hecho. */
  done?: boolean;
}

export interface OrderCardProps {
  /** Título (p. ej. el cliente). Texto ya resuelto. */
  title: string;
  /** Identificador visible (p. ej. número de orden), en mono. */
  id: string;
  /** Monto YA formateado por el consumidor — el DS no formatea moneda. */
  amount: string;
  /** Contexto de canal: un nodo (chip/ícono) o texto. El DS no conoce canales. */
  channel?: ReactNode;
  /** Estado terminal/de cobro como badge. NO admite "en curso" (BadgeTone no lo
   *  tiene): el progreso vive en `steps`. */
  status?: { label: string; tone: BadgeTone };
  /** Progreso de fulfillment — la ÚNICA vía de "en curso". */
  steps: OrderSteps;
  /** "hace X" YA formateado por el consumidor. */
  timeAgo?: string;
  selected?: boolean;
  onClick?: () => void;
}

function segClass(i: number, s: OrderSteps): string {
  if (s.done || i < s.current) return 'duna-steps__seg is-done';
  if (i === s.current) return 'duna-steps__seg is-now';
  return 'duna-steps__seg';
}

export function OrderCard({
  title, id, amount, channel, status, steps, timeAgo, selected, onClick,
}: OrderCardProps) {
  return (
    <div className={`duna-order-card${selected ? ' is-selected' : ''}`} onClick={onClick}>
      <div className="duna-order-card__top">
        <span className="duna-order-card__name">{title}</span>
        <span className="duna-order-card__id duna-mono">{id}</span>
        <span className="duna-order-card__amount duna-num">{amount}</span>
      </div>
      <div className="duna-order-card__mid">
        {channel}
        {status && (
          <span className={`duna-badge ${BADGE_TONE_CLASS[status.tone]}`}>
            {status.tone !== 'neutral' && <span className="duna-badge__dot" />}
            {status.label}
          </span>
        )}
      </div>
      <div className="duna-order-card__foot">
        <span className="duna-steps">
          {Array.from({ length: steps.count }, (_, i) => (
            <span key={i} className={segClass(i, steps)} />
          ))}
        </span>
        {timeAgo && <span className="duna-order-card__time">{timeAgo}</span>}
      </div>
    </div>
  );
}
