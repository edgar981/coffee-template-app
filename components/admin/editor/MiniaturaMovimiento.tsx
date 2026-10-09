'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { progresoLoopTarjetaTransicion } from '@/lib/animation';
import { estiloMiniaturaMovimiento } from '@/lib/movimiento/vista-previa';
import { MOVIMIENTO_NINGUNA, type ElementoMovimiento } from '@/lib/movimiento/catalogo';

// LA MINIATURA DE UNA TARJETA DEL SELECTOR (§ MOVIMIENTO-EDITOR-EXPOSICION-1) — MISMO patrón que
// `MiniAnimacionTransicion` (`components/admin/SelectorTransicion.tsx`, fuera de `touches:`): un
// `requestAnimationFrame` que avanza un progreso 0→1 en bucle (`progresoLoopTarjetaTransicion`,
// reusada, nunca copiada) y lo traduce a estilo con una función PURA
// (`estiloMiniaturaMovimiento`, `lib/movimiento/vista-previa.ts`) — NUNCA GSAP real corriendo
// dentro de una docena de tarjetas a la vez. "En reposo, el cuadro final; con movimiento reducido,
// nunca se anima" es el MISMO interruptor: `estatico = prefiereReducido || !activa`.
//
// `elemento` decide CUÁNTAS piezas dibuja y de qué forma (líneas de texto / una foto / tarjetas) —
// la miniatura es ilustrativa del TIPO de elemento, no del contenido real de la sección.

const PIEZAS_POR_ELEMENTO: Record<ElementoMovimiento, number> = {
  texto: 3,
  imagen: 1,
  tarjetas: 3,
  cifras: 1,
  seccion: 1,
  hero: 1,
};

export function MiniaturaMovimiento({ id, elemento, activa }: {
  id: string;
  elemento: ElementoMovimiento;
  activa: boolean;
}) {
  const prefiereReducido = !!useReducedMotion();
  const [progreso, setProgreso] = useState(0);
  const rafRef = useRef<number | null>(null);
  const inicioRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activa || prefiereReducido || id === MOVIMIENTO_NINGUNA) {
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
  }, [activa, prefiereReducido, id]);

  const estatico = prefiereReducido || !activa || id === MOVIMIENTO_NINGUNA;
  const piezas = PIEZAS_POR_ELEMENTO[elemento] ?? 1;

  return (
    <div className="editor-movimiento-mini" aria-hidden>
      {elemento === 'imagen' ? (
        <div
          className="editor-movimiento-mini__foto"
          style={(() => {
            const e = estiloMiniaturaMovimiento(id, progreso, estatico, 0);
            return { transform: e.transform, opacity: e.opacity, clipPath: e.clipPath };
          })()}
        />
      ) : (
        Array.from({ length: piezas }).map((_, i) => {
          const e = estiloMiniaturaMovimiento(id, progreso, estatico, i);
          return (
            <div
              key={i}
              className={elemento === 'tarjetas' ? 'editor-movimiento-mini__tarjeta' : 'editor-movimiento-mini__linea'}
              style={{ transform: e.transform, opacity: e.opacity, clipPath: e.clipPath }}
            />
          );
        })
      )}
    </div>
  );
}

export default MiniaturaMovimiento;
