'use client';

import { useRef, useState } from 'react';
import { MOVIMIENTO_NINGUNA, catalogoMovimientoDeElemento, type ElementoMovimiento } from '@/lib/movimiento/catalogo';
import { MiniaturaMovimiento } from './MiniaturaMovimiento';

// EL AJUSTE «ANIMACIÓN» (§ MOVIMIENTO-EDITOR-EXPOSICION-1, el spec: "tarjetas como el selector de
// transiciones de la marquesina"). MISMO vocabulario visual y el MISMO patrón de radiogroup con
// roving-tabindex que `SelectorTransicion.tsx` (fuera de `touches:` — éste es un componente PROPIO
// bajo `components/admin/editor/`, no una edición de aquél), pero para el catálogo de
// `lib/movimiento/catalogo.ts`: «Ninguna» siempre PRIMERO, seguida de cada id implementado que
// aplica al `elemento` de esta sección (`catalogoMovimientoDeElemento`).
//
// LA MINIATURA de cada tarjeta es ILUSTRATIVA (`MiniaturaMovimiento`), nunca GSAP real — una docena
// de tarjetas con GSAP de verdad corriendo a la vez sería carísimo y, para una miniatura, inútil:
// lo que importa es transmitir CÓMO se ve, no replicar el motor pixel a pixel.

export interface SelectorMovimientoProps {
  id: string;
  elemento: ElementoMovimiento;
  valor: string;
  onElegir: (valor: string) => void;
  ariaLabel?: string;
}

export function SelectorMovimiento({ id, elemento, valor, onElegir, ariaLabel }: SelectorMovimientoProps) {
  const opciones = [
    { value: MOVIMIENTO_NINGUNA, nombre: 'Ninguna' },
    ...catalogoMovimientoDeElemento(elemento).map((d) => ({ value: d.id, nombre: d.nombre })),
  ];
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
    <div id={id} role="radiogroup" aria-label={ariaLabel} className="editor-movimiento-selector">
      {opciones.map((op) => {
        const esActiva = op.value === valor;
        const animando = enfocada === op.value;
        return (
          <button
            key={op.value || '_ninguna'}
            ref={(el) => { if (el) botonesRef.current.set(op.value, el); else botonesRef.current.delete(op.value); }}
            type="button"
            role="radio"
            aria-checked={esActiva}
            tabIndex={esActiva ? 0 : -1}
            className="bloque-tarjeta editor-movimiento-tarjeta"
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
            <div className="editor-movimiento-tarjeta__cabeza">
              <span className="duna-field__label" style={{ margin: 0 }}>{op.nombre}</span>
              {esActiva && <span className="duna-badge duna-badge--neutral">Actual</span>}
            </div>
            <MiniaturaMovimiento id={op.value} elemento={elemento} activa={animando} />
          </button>
        );
      })}
    </div>
  );
}

export default SelectorMovimiento;
