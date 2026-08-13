// Esqueleto de la lista — AGNÓSTICO, como la tarjeta que imita.
//
// ── POR QUÉ NO ES UN RECTÁNGULO CON UNA ALTURA ───────────────────────────────
//
// Porque la altura es TODO el problema. Un esqueleto que mide distinto que su
// contenido no quita el salto de layout: lo mueve de sitio y lo vuelve más raro
// (la pantalla brinca cuando llegan los datos, no cuando aparecen).
//
// Acá la altura no se declara: se PRODUCE. El esqueleto monta LA MISMA estructura
// que `OrderCard` —las mismas clases, los mismos contenedores, los mismos
// modificadores tipográficos— y en las ranuras de texto pone un texto de relleno
// tratado con `.duna-skel`, que sólo lo vuelve transparente y le pinta el fondo.
// Padding, borde, radio, `line-height`, tamaños de fuente y márgenes salen de las
// mismas reglas CSS que la tarjeta real.
//
// La consecuencia es la que importa: si mañana el nombre de la tarjeta sube de 14
// a 15px, el hueco sube con él, sin que nadie toque este archivo. Un `height`
// copiado a mano se desincronizaría en silencio, que es el modo de falla que este
// componente existe para no tener.
//
// ── EL TEXTO DE RELLENO NO ES CONTENIDO ──────────────────────────────────────
//
// Es un ESPACIADOR: su única función es empujar la caja al tamaño que tendrá el
// dato real. Por eso no se traduce, no se configura y no viaja por props — sería
// prometer que significa algo. Lo saca del árbol de accesibilidad el `aria-hidden`
// de la lista, y del portapapeles el `user-select: none` de `.duna-skel`.
//
// Lo que un lector de pantalla SÍ anuncia es el estado, por `role="status"` y una
// etiqueta `.duna-sr-only` que el consumidor provee (es idioma). Sin eso el
// esqueleto sería invisible justo para quien no puede ver la animación — y el
// "Cargando…" que reemplaza sí se leía.

export interface SkeletonOrderCardsProps {
  /**
   * Cuántas tarjetas. Por defecto 3: las que caben sin inventar.
   *
   * NO intenta adivinar cuántos resultados vienen — no se sabe, y un esqueleto de
   * 12 filas seguido de 2 resultados es una promesa incumplida que vuelve a mover
   * la página. Reservar de menos deja crecer la lista hacia abajo, que es el
   * movimiento que el ojo ya espera al cargar.
   */
  count?: number;
  /**
   * Qué se está cargando, en palabras. OBLIGATORIO y sin default: es idioma, y
   * este paquete no lo conoce (misma frontera que `SearchField.label`).
   */
  label: string;
}

/**
 * Una tarjeta. Las tres filas de `OrderCard`, con las mismas clases.
 *
 * `variant` sólo cambia el ANCHO de los rellenos, nunca la altura: las tarjetas
 * reales de una lista miden lo mismo entre sí —su estructura es fija— y el
 * espacio reservado tiene que coincidir con el total. Lo que sí varía dentro de
 * UNA tarjeta son las alturas de sus bloques, y no por decoración: el nombre
 * (14px), el identificador mono (12px) y el pie (11px) tienen tamaños distintos
 * de verdad, así que sus rellenos también. Imita la estructura real, no dibuja
 * rectángulos iguales.
 */
function SkeletonOrderCard({ variant }: { variant: number }) {
  // Tres largos de nombre y de monto, rotando. Una lista donde las tres filas son
  // idénticas se lee como un patrón; una donde varían se lee como contenido.
  const nombres = ['Nombre del cliente', 'Nombre cliente', 'Nombre de cliente largo'];
  const montos  = ['$ 000.000', '$ 00.000', '$ 000.000'];
  const i = variant % 3;

  return (
    <div className="duna-order-card is-skeleton">
      <div className="duna-order-card__top">
        <span className="duna-order-card__name duna-skel">{nombres[i]}</span>
        <span className="duna-order-card__id duna-mono duna-skel">CN-000000</span>
        <span className="duna-order-card__amount duna-num duna-skel">{montos[i]}</span>
      </div>
      <div className="duna-order-card__mid">
        {/* El chip de canal y el badge, con sus clases: el badge tiene padding y
            borde propios, así que sólo montándolo se obtiene su altura real —
            que es la que manda en esta fila. */}
        <span className="duna-chip-channel duna-skel">Canal</span>
        <span className="duna-badge duna-badge--neutral duna-skel">Estado</span>
      </div>
      <div className="duna-order-card__foot">
        {/* La barra de pasos NO se esqueletiza: ya es una barra gris de 3px. Se
            monta con sus segmentos en reposo, que es exactamente cómo se ve un
            progreso todavía desconocido. */}
        <span className="duna-steps">
          <span className="duna-steps__seg" /><span className="duna-steps__seg" />
          <span className="duna-steps__seg" /><span className="duna-steps__seg" />
        </span>
        <span className="duna-order-card__time duna-skel">hace 0 min</span>
      </div>
    </div>
  );
}

export function SkeletonOrderCards({ count = 3, label }: SkeletonOrderCardsProps) {
  return (
    // `role="status"` + `aria-busy`: el estado se ANUNCIA. `aria-hidden` va sobre
    // la parte visual —los rellenos son espaciadores, no texto— y la etiqueta
    // viaja aparte, visible sólo para el lector.
    <div role="status" aria-busy="true"
         style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      <span className="duna-sr-only">{label}</span>
      <span aria-hidden="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
        {Array.from({ length: count }, (_, i) => <SkeletonOrderCard key={i} variant={i} />)}
      </span>
    </div>
  );
}
