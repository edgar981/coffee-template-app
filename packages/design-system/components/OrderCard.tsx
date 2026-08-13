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
  /**
   * Identificador visible (p. ej. número de orden), en mono.
   *
   * OPCIONAL, y por la misma razón que `steps`: hay filas cuyo TÍTULO ya es el
   * identificador y no tienen un segundo. El caso que lo motivó es el historial
   * de un cliente — ahí la fila ES un pedido, así que su número va de título y no
   * queda nada para esta ranura. Antes había que pasar `''`, que renderiza un
   * hueco vacío: la ausencia dicha con un valor falso.
   */
  id?: string;
  /** Monto YA formateado por el consumidor — el DS no formatea moneda. */
  amount: string;
  /** Contexto de canal: un nodo (chip/ícono) o texto. El DS no conoce canales. */
  channel?: ReactNode;
  /** Estado terminal/de cobro como badge. NO admite "en curso" (BadgeTone no lo
   *  tiene): el progreso vive en `steps`. */
  status?: { label: string; tone: BadgeTone };
  /**
   * Progreso de fulfillment — la ÚNICA vía de "en curso".
   *
   * OPCIONAL, y la ausencia es una respuesta: hay filas que NO tienen camino que
   * mostrar. El caso que lo motivó es un pedido cancelado —su recorrido se anuló,
   * así que una barra invita a leerlo como vivo, y además la etapa que alcanzó ya
   * no está en la fila que la lista carga—. Dibujarle una barra exigiría
   * inventarle una posición.
   *
   * La ausencia es la representación honesta, igual que un "hace X" que no se
   * puede afirmar o un paso que no se puede derivar. No debilita la regla del "en
   * curso": `BadgeTone` sigue sin tono de progreso, así que quedarse sin steps no
   * le da al badge permiso para decir "en camino" — deja a la fila sin decirlo, que
   * es distinto y es correcto.
   */
  steps?: OrderSteps;
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

// ── LA FILA ES UN BOTÓN CUANDO HACE ALGO, Y UN DIV CUANDO NO ─────────────────
//
// Era un `<div onClick>`: se podía clickear con el mouse y con NADA más. No
// recibía foco, no respondía a Enter ni a Espacio, y un lector de pantalla la
// anunciaba como un bloque de texto — o sea que la fila principal de la pantalla
// más usada del panel no era operable por teclado. Un `<button>` nativo resuelve
// las tres cosas de una vez, sin un solo handler de teclado escrito a mano: el
// navegador ya sabe que Enter y Espacio activan un botón.
//
// El elemento lo decide `onClick`, y no es una comodidad: una tarjeta que NO
// hace nada no debe ser focusable —mandaría al teclado a parar en algo que no
// responde— ni mostrar cursor de mano. Por eso la carcasa cambia con la prop en
// vez de ser siempre un botón deshabilitado.
//
// Dentro de la tarjeta sólo hay <span>: ningún control anidado, que es lo que
// haría inválido envolver todo en un <button>. Si algún día la fila necesita un
// botón propio (un "Despachar" inline), esta forma deja de servir y hay que
// partirla — no anidar.
export function OrderCard({
  title, id, amount, channel, status, steps, timeAgo, selected, onClick,
}: OrderCardProps) {
  const className = `duna-order-card${selected ? ' is-selected' : ''}`;
  // `aria-current` y no `aria-selected`: la tarjeta no vive en un `listbox` ni en
  // un `tablist`, así que `aria-selected` no tendría rol que lo sostenga.
  // "seleccionada" acá significa "es la que el panel de al lado está mostrando",
  // que es exactamente lo que `aria-current` describe.
  const carcasa = (kids: ReactNode) =>
    onClick ? (
      <button type="button" className={className} onClick={onClick} aria-current={selected || undefined}>
        {kids}
      </button>
    ) : (
      <div className={className}>{kids}</div>
    );

  return carcasa(
    <>
      <div className="duna-order-card__top">
        <span className="duna-order-card__name">{title}</span>
        {id && <span className="duna-order-card__id duna-mono">{id}</span>}
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
      {/* El pie sólo existe si tiene algo que poner. Sin steps y sin "hace X"
          quedaría un bloque vacío aportando su `margin-top` — un hueco que se lee
          como si algo no hubiera cargado. */}
      {(steps || timeAgo) && (
        <div className="duna-order-card__foot">
          {steps && (
            <span className="duna-steps">
              {Array.from({ length: steps.count }, (_, i) => (
                <span key={i} className={segClass(i, steps)} />
              ))}
            </span>
          )}
          {timeAgo && <span className="duna-order-card__time">{timeAgo}</span>}
        </div>
      )}
    </>,
  );
}
