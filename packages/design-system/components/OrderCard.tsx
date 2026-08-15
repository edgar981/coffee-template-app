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
  /**
   * Miniatura de la fila — un nodo, no una URL: el DS no carga imágenes ni sabe
   * de optimizadores. El consumidor pasa lo que quiera (un `.duna-tile--sm` con
   * su `<img>`, o el reemplazo cuando no hay foto).
   *
   * OPCIONAL, y la ausencia deja la fila EXACTAMENTE como estaba: sin medio no
   * se emite ni el envoltorio de dos columnas, así que las filas de pedidos y de
   * clientes no cambian una línea de layout.
   *
   * Existe porque la lista de una vertical con imágenes vive en la misma columna
   * de 400px que las otras dos (`--duna-list-w`), y ahí la tabla de columnas que
   * uno imagina no cabe. Darle otro aspecto a la fila según lleve foto sería una
   * segunda opinión sobre cómo se ve un registro en una lista de este panel.
   */
  media?: ReactNode;
  /**
   * Acciones de la fila (p. ej. un menú de tres puntos), a la derecha.
   *
   * OPCIONAL, y con default seguro: SIN `actions` la fila es EXACTAMENTE la de
   * siempre —un `<button>` cuando es clickeable (foco, Enter y Espacio gratis, el
   * arreglo H9)—, así que Pedidos y Clientes, que no la pasan, no cambian una
   * línea.
   *
   * CON `actions` la fila NO PUEDE seguir siendo un `<button>`: anidar el trigger
   * del menú dentro de un botón es HTML inválido y un lío de foco. Ésta es la
   * partición que el comentario de abajo anticipaba. La superficie pasa al patrón
   * `duna-hit`: el NOMBRE es el hit-target (su `::after` cubre toda la fila y le
   * devuelve el clic + el teclado que daba el `<button>`), y las acciones viven en
   * una capa `__sobre`, que es su PROPIA parada en el tab order.
   */
  actions?: ReactNode;
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
// haría inválido envolver todo en un <button>. Si la fila necesita un control
// propio (el menú de tres puntos, vía la prop `actions`), esta forma deja de
// servir y hay que partirla — no anidar. Esa partición es la RAMA de `actions`
// más abajo: el `<button>` que envuelve todo se cambia por el patrón `duna-hit`.
export function OrderCard({
  title, id, amount, channel, status, steps, timeAgo, media, actions, selected, onClick,
}: OrderCardProps) {
  const className = `duna-order-card${media ? ' duna-order-card--media' : ''}${selected ? ' is-selected' : ''}`;
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

  // CON `actions`, el nombre es el hit-target (un `<button>` cuyo `::after` cubre
  // la fila) en vez de que la fila entera sea un botón. Sin `actions`, es el
  // `<span>` de siempre y el botón es la carcasa. Las dos dan foco + Enter/Espacio
  // sobre el área principal; lo que cambia es DÓNDE vive el botón.
  const nombre = actions ? (
    <button
      type="button"
      className="duna-hit duna-order-card__name"
      onClick={onClick}
      aria-current={selected || undefined}
    >
      {title}
    </button>
  ) : (
    <span className="duna-order-card__name">{title}</span>
  );

  // El apilado de siempre. Con medio se envuelve en `__body` y queda a la derecha
  // de la miniatura; SIN medio se emite tal cual —ni un nodo de más— para que las
  // filas que ya están en producción no cambien de estructura.
  const apilado = (
    <>
      <div className="duna-order-card__top">
        {nombre}
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
    </>
  );

  // ── LA RAMA CON ACCIONES · superficie duna-hit, no <button> ────────────────
  // La fila es un `<div>` posicionado (no un botón), el clic + el teclado los da
  // el nombre (`.duna-hit`, su `::after` cubre la fila), y las acciones van en una
  // capa `__sobre` — su propia parada en el tab order, por encima del `::after`.
  // El contenido SIEMPRE se envuelve en `__body` acá (haya medio o no) porque las
  // acciones son un tercer ítem flex a la derecha y el cuerpo tiene que ser el
  // flexible del medio.
  if (actions) {
    return (
      <div className={`${className} duna-order-card--con-acciones`}>
        {media && <div className="duna-order-card__media">{media}</div>}
        <div className="duna-order-card__body">{apilado}</div>
        <div className="duna-hit__sobre duna-order-card__actions">{actions}</div>
      </div>
    );
  }

  return carcasa(
    media ? (
      <>
        <div className="duna-order-card__media">{media}</div>
        <div className="duna-order-card__body">{apilado}</div>
      </>
    ) : apilado,
  );
}
