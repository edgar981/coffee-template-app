'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { estiloTarjetaTransicion, progresoLoopTarjetaTransicion } from '@/lib/animation';

// EL SELECTOR DE TRANSICIÓN DE LA MARQUESINA, COMO FILA DE TARJETAS (§ EDITOR-TIENDA-
// TRANSICIONES-TARJETAS-1) — reemplaza al `<select>` nativo de «Cómo salen los productos»
// (§ EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1, que dejó escrita la razón de por qué nació nativo:
// "no hay dónde montar una miniatura dentro de la lista abierta sin reemplazar el control nativo
// por uno compuesto"). Ese reemplazo es justo lo que este slice construye.
//
// EL PATRÓN DE TARJETA ES EL DE `ComposicionHero.tsx` — misma superficie (`.bloque-tarjeta`, ya en
// `app/(admin)/duna.css`), mismo badge "Actual" para la opción elegida, mismo orden visual (label →
// contenido → hint) — no una primitiva nueva. LO QUE NO SE REUTILIZA LITERAL es el COMPONENTE: ahí
// las cuatro composiciones se apilan VERTICALMENTE dentro de una hoja aparte (`VistaNueva`, abierta
// por un botón "Composición: X"); acá el spec pide una FILA, inline, en el lugar donde vivía el
// `<select>` — layouts distintos para el mismo vocabulario visual. Si una composición futura
// quisiera una fila de tarjetas en vez de la hoja vertical, el radiogroup/roving-tabindex de abajo
// es la pieza reusable; `ComposicionHero.tsx` no se tocó para no arriesgar esa capacidad existente
// por una generalización que nadie pidió todavía (§ CLAUDE.md, "no diseñar para requisitos
// hipotéticos").
//
// LA MINI ANIMACIÓN REUSA LAS FUNCIONES DE `lib/animation.ts`, NUNCA COPIA VALORES: `MiniAnimacion
// Transicion` (abajo) llama a `estiloTarjetaTransicion` — el MISMO dispatch (`transformTransicion
// MarquesinaItem`/`filterTransicionMarquesinaItem`/`opacidadEntradaSalidaItem`) que
// `MarquesinaTarjetaMotor.tsx` usa para la banda real, con una ventana de demo fija en vez de la
// ventana derivada del catálogo (§ el docstring de `estiloTarjetaTransicion`). Si alguna de las
// cinco coreografías cambia de magnitud, esta vista previa cambia con ella — no hay un segundo
// juego de números que pueda quedarse rezagado.
//
// "EN REPOSO, CADA TARJETA MUESTRA EL CUADRO FINAL. CON MOVIMIENTO REDUCIDO, NUNCA SE ANIMA" (el
// spec, literal) — las DOS reglas son el MISMO interruptor: `estatico = prefiereReducido || !activa`
// (`activa` = hover u foco). Con `estatico=true` las tres funciones de `lib/animation.ts` devuelven
// su identidad sin mirar el progreso (§ el docstring de `estiloTarjetaTransicion`), así que no hace
// falta una rama separada para "reposo" y otra para "reducido": es la misma rama, dos disparadores.
//
// EL PROGRESO "AVANZA SOLO" (el spec, literal) vía `requestAnimationFrame`, nunca el reloj de pared
// ni un `setInterval`: cada cuadro lee cuánto pasó desde que el bucle arrancó y lo traduce a
// progreso con `progresoLoopTarjetaTransicion` (pura, § lib/animation.ts) — recorre 0→1 y vuelve a
// arrancar en 0, sin ping-pong (las cinco transiciones "siguen de largo" al salir).

export interface OpcionTransicion {
  value: string;
  label: string;
  /** La frase de una línea que describe ESTA transición — antes vivía concatenada en el `hint`
   *  único del `<select>`; ahora cada tarjeta lleva la suya. */
  hint: string;
}

export interface SelectorTransicionProps {
  id: string;
  opciones: OpcionTransicion[];
  valor: string;
  onElegir: (valor: string) => void;
  ariaDescribedby?: string;
  /** El nombre accesible del grupo (el mismo texto del `<label>` visual del campo). Un `<div
   *  role="radiogroup">` no es un control "labelable" por `<label htmlFor>` —a diferencia de un
   *  `<select>`—, así que el grupo necesita su PROPIO nombre accesible en vez de depender de esa
   *  asociación. */
  ariaLabel?: string;
}

const CAJA_MINIATURA: React.CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden',
  borderRadius: 'var(--duna-r-s)', background: 'var(--duna-wash-hover)',
  border: '1px solid var(--duna-border)',
};

// LA TARJETA GENÉRICA QUE SE MUEVE DENTRO DE LA CAJA — una silueta de "tarjeta de producto" (sin
// foto real: la elección no depende de qué venda el dueño), centrada, a una fracción del tamaño de
// la caja para que el recorrido ±100% de su propio alto/ancho (`REVELADO_TRASLADO_PCT`, lib/
// animation.ts) quede DENTRO del marco en vez de disparar fuera de la fila.
//
// `overflow:hidden` DE LA CAJA ACTÚA COMO VENTANA DECORATIVA, no como la máscara que la REGLA DEL
// OWNER prohíbe para las cinco transiciones (§ lib/animation.ts, "sin máscara, sin recortes, sin
// bordes extra — el producto entra ENTERO"): esa regla es de la BANDA REAL (`MarquesinaMotor.tsx`),
// donde recortar a medio camino arruinaría el efecto sobre una foto de catálogo. Acá es una
// miniatura ILUSTRATIVA — mismo criterio que `CAJA_MINIATURA`/`MiniaturaComposicion` de
// `ComposicionHero.tsx`, que tampoco reproducen el DOM real del storefront.
const TARJETA_MINI: React.CSSProperties = {
  position: 'absolute', inset: 0, margin: 'auto',
  width: '42%', aspectRatio: '3 / 4',
  borderRadius: 'var(--duna-r-s)',
  background: 'var(--duna-wash-active)',
  border: '1px solid var(--duna-border-2)',
};

function MiniAnimacionTransicion({ tipo, activa, prefiereReducido }: {
  tipo: string;
  activa: boolean;
  prefiereReducido: boolean;
}) {
  const [progreso, setProgreso] = useState(0);
  const rafRef = useRef<number | null>(null);
  const inicioRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activa || prefiereReducido) {
      inicioRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const paso = (ahora: number) => {
      if (inicioRef.current == null) inicioRef.current = ahora;
      setProgreso(progresoLoopTarjetaTransicion(ahora - inicioRef.current));
      rafRef.current = requestAnimationFrame(paso);
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      inicioRef.current = null;
    };
  }, [activa, prefiereReducido]);

  const estatico = prefiereReducido || !activa;
  const estilo = estiloTarjetaTransicion(tipo, progreso, estatico);

  return (
    <div style={CAJA_MINIATURA} aria-hidden>
      <div style={{ ...TARJETA_MINI, transform: estilo.transform, opacity: estilo.opacity, filter: estilo.filter }} />
    </div>
  );
}

/** Una fila de tarjetas — una por transición — con rol de GRUPO DE OPCIONES (`radiogroup`/`radio`,
 *  § APG): flechas mueven el foco Y la elección a la vez (el patrón estándar de un radiogroup), y
 *  cada tarjeta es un `<button>` real (Enter/Espacio activan por conducta nativa, sin reinventar el
 *  manejo de tecla). `tabIndex` ROVING: sólo la tarjeta ELEGIDA es alcanzable por Tab; las demás se
 *  alcanzan con las flechas desde ahí — el mismo contrato que un grupo de radios nativo. */
export function SelectorTransicion({ id, opciones, valor, onElegir, ariaDescribedby, ariaLabel }: SelectorTransicionProps) {
  const prefiereReducido = !!useReducedMotion();
  const [enfocada, setEnfocada] = useState<string | null>(null);
  const botonesRef = useRef(new Map<string, HTMLButtonElement>());

  const moverFoco = (desde: string, delta: 1 | -1) => {
    const i = opciones.findIndex((o) => o.value === desde);
    if (i === -1) return;
    const siguiente = opciones[(i + delta + opciones.length) % opciones.length];
    onElegir(siguiente.value);
    botonesRef.current.get(siguiente.value)?.focus();
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-3)' }}
    >
      {opciones.map((op) => {
        const esActiva = op.value === valor;
        const animando = enfocada === op.value;
        return (
          <button
            key={op.value}
            ref={(el) => { if (el) botonesRef.current.set(op.value, el); else botonesRef.current.delete(op.value); }}
            type="button"
            role="radio"
            aria-checked={esActiva}
            tabIndex={esActiva ? 0 : -1}
            className="bloque-tarjeta"
            style={{ flex: '1 1 160px', minWidth: 150, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onElegir(op.value)}
            onFocus={() => setEnfocada(op.value)}
            onBlur={() => setEnfocada((actual) => (actual === op.value ? null : actual))}
            onMouseEnter={() => setEnfocada(op.value)}
            onMouseLeave={() => setEnfocada((actual) => (actual === op.value ? null : actual))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moverFoco(op.value, 1); }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moverFoco(op.value, -1); }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--duna-space-3)' }}>
              <span className="duna-field__label" style={{ margin: 0 }}>{op.label}</span>
              {esActiva && <span className="duna-badge duna-badge--neutral">Actual</span>}
            </div>
            <MiniAnimacionTransicion tipo={op.value} activa={animando} prefiereReducido={prefiereReducido} />
            <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-3)', marginBottom: 0 }}>{op.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

export default SelectorTransicion;
