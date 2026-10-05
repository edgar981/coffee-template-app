'use client';

import { useId, useRef, type ReactNode } from 'react';
import { siguienteIndiceEleccion, indiceDeValor, esTeclaDeEleccion } from '@/lib/admin/eleccion-visual';

// LA ELECCIÓN VISUAL (§ EDITOR-PANEL-CONTROLES-1): reemplaza al `.duna-switch` para los rasgos de
// ASPECTO del editor — pedido del owner, revisando el editor: «Los indicadores de apagar encender no
// me gusta como se ven... el panel debería sentirse más interactivo y no solo activo desactivo,
// prendo apago». Dos o tres opciones LADO A LADO, cada una con una miniatura dibujada que muestra
// cómo queda, y un rótulo corto — nunca "Activado"/"Desactivado". Calcado del prototipo navegable
// (`docs/editor-tienda/prototipo/prototipo-editor.html`, `.opts`/`.opt`/`.pic`): borde + miniatura +
// rótulo, la elegida con el borde de tinta (el MISMO signo que `.duna-tile.is-selected`,
// packages/design-system/primitives/primitives.css — "el idioma del sistema para «ésta es la que
// estás viendo»").
//
// ACCESIBLE COMO UN GRUPO DE RADIOS (WAI-ARIA `radiogroup`/`radio`), no una fila de botones sueltos:
// elegir una es mutuamente excluyente con las demás, que es exactamente lo que un radio expresa y un
// botón no. El roving-tabindex (sólo la opción elegida es alcanzable con Tab; las flechas mueven el
// foco Y la elección a la vez, patrón estándar de un radiogroup) vive acá; la aritmética de índices
// —la parte que se puede romper en silencio, dejando una opción inalcanzable con teclado— está en
// `lib/admin/eleccion-visual.ts`, afirmada sin montar nada.
//
// PASAR EL MOUSE NO ESCRIBE NADA (el spec: "el autoguardado sólo corre al elegir"): la miniatura no
// tiene estado de "previsualizando", sólo hover visual (CSS) y el `onClick`/`onKeyDown` que llaman a
// `onElegir`. No hay temporizador, no hay `onMouseEnter`.

export interface OpcionEleccionVisual {
  value: string;
  /** El rótulo corto bajo la miniatura — p. ej. "Simple" / "Con estilo", nunca "Activado"/"Desactivado". */
  label: string;
  /** La miniatura dibujada (SVG simple) que muestra cómo queda ESTA opción. */
  miniatura: ReactNode;
}

export interface EleccionVisualProps {
  /** El nombre del rasgo — `aria-label` del grupo (p. ej. "Estilo del nombre"). */
  etiqueta: string;
  opciones: OpcionEleccionVisual[];
  valor: string;
  onElegir: (valor: string) => void;
}

export function EleccionVisual({ etiqueta, opciones, valor, onElegir }: EleccionVisualProps) {
  const idBase = useId();
  const botonesRef = useRef<Array<HTMLButtonElement | null>>([]);
  const indiceActual = indiceDeValor(opciones, valor);

  const alPresionarTecla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!esTeclaDeEleccion(e.key)) return;
    e.preventDefault();
    const siguiente = siguienteIndiceEleccion(indiceActual, opciones.length, e.key);
    if (siguiente === null) return;
    const opcion = opciones[siguiente];
    onElegir(opcion.value);
    botonesRef.current[siguiente]?.focus();
  };

  return (
    <div
      className="editor-eleccion"
      role="radiogroup"
      aria-label={etiqueta}
      onKeyDown={alPresionarTecla}
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o, i) => {
        const elegida = o.value === valor;
        return (
          <button
            key={o.value}
            ref={(el) => { botonesRef.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={elegida}
            tabIndex={elegida ? 0 : -1}
            id={`${idBase}-${i}`}
            onClick={() => onElegir(o.value)}
            className={`editor-eleccion__opt${elegida ? ' is-on' : ''}`}
          >
            <span className="editor-eleccion__pic" aria-hidden>{o.miniatura}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default EleccionVisual;
