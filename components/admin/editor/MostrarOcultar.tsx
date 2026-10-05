'use client';

import { Eye, EyeOff } from 'lucide-react';

// MOSTRAR U OCULTAR (§ EDITOR-PANEL-CONTROLES-1, el spec: "una sección, una página, el crédito del
// pie, volver arriba, las redes, la barra de envío: el mismo ojo de la lista de secciones con la
// palabra al lado («Se muestra» / «Oculto»), no un interruptor"). Gemelo de `.editor-row__eye`
// (`FilaSeccion.tsx`, fuera de `touches:` de este slice) en el ÍCONO —mismo `Eye`/`EyeOff`, mismo
// significado—, pero DISTINTO en la palabra: ahí el ojo solo alcanza porque es una fila de LISTA,
// repetida, donde el icono ya aprendido no necesita texto (§ CLAUDE.md, "se dicen con el ojo, no con
// frases"). Acá es un CONTROL DE FORMULARIO, visto una vez por rasgo — sin la repetición que vuelve
// el icono solo legible, así que la palabra («Se muestra» / «Oculto») va SIEMPRE al lado, nunca
// escondida detrás de un tooltip o un `aria-label` mudo.
//
// Reemplaza el PAR de capacidades "mostrar/ocultar algo que existe siempre" — no una elección de
// ASPECTO (eso es `EleccionVisual`): acá no hay una miniatura que dibujar, porque lo que cambia es
// que el elemento ESTÉ o no, no cómo se ve estando.

export interface MostrarOcultarProps {
  /** El nombre del rasgo que se muestra u oculta — p. ej. "Riel social". */
  etiqueta: string;
  visible: boolean;
  onCambiar: () => void;
  disabled?: boolean;
}

export function MostrarOcultar({ etiqueta, visible, onCambiar, disabled }: MostrarOcultarProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={visible ? `Ocultar ${etiqueta}` : `Mostrar ${etiqueta}`}
      disabled={disabled}
      onClick={onCambiar}
      className={`editor-mostrar${visible ? '' : ' is-oculto'}`}
    >
      {visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      <span className="editor-mostrar__nm">{etiqueta}</span>
      <span className="editor-mostrar__estado">{visible ? 'Se muestra' : 'Oculto'}</span>
    </button>
  );
}

export default MostrarOcultar;
