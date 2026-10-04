'use client';

import type { ReactNode } from 'react';
import { ChevronRight, Eye, EyeOff, GripVertical } from 'lucide-react';
import type { AsaOrdenProps } from '@/components/admin/TiendaSeccionEditor';

// § EDITOR-VISUAL-PANEL-1 — LA FILA COMPACTA del nivel Inicio (REDISENO.md § 3, el prototipo
// `.row`/`.row-main`), que REEMPLAZA a la tarjeta grande con borde + párrafo + botón «Editar»
// (`.tienda-tarjeta`, § CLAUDE.md "sin tarjetas grandes con botón Editar"). UN SOLO COMPONENTE para
// los CINCO sitios que antes repetían casi la misma marcación —`TiendaSeccionEditor.tsx` (una banda),
// `InstanciaTarjeta.tsx` (una sección agregada), `EncabezadoSeccion.tsx`/`MenuSeccion.tsx`/
// `FooterSeccion.tsx` (el cromo)—: la MISMA razón por la que `useAccionGuardada` es un hook y no una
// receta a copiar (§ CLAUDE.md, "escribirla a mano salía mal"). Tocar la fila entera ABRE el nivel
// (`onAbrir`, el click del `.row-main` del prototipo); el asa y el ojo son botones APARTE que no
// burbujean al click de abrir (cada uno con su propio `<button>`).
//
// `dim` cubre TANTO «el interruptor está apagado» COMO «la lista está vacía» (hide-on-empty,
// § TiendaSeccionEditor.tsx `noSeMuestra`) — el prototipo sólo distingue con el OJO, no con un
// párrafo (§ CLAUDE.md, "se dicen con el ojo, no con frases como «No se muestra…»"); la distinción
// FINA entre las dos razones queda SÓLO en el aviso de la vista EXPANDIDA (`avisoNoSeMuestra`), que
// esta fila no muestra — eso es una pérdida de matiz a propósito, declarada en el reporte del slice.
export interface FilaSeccionProps {
  icono: ReactNode;
  titulo: string;
  /** Hay un borrador sin publicar para esta fila — un punto ámbar junto al nombre, no la píldora
   *  grande (§ Amber Minimal: el ámbar es información, no decoración; un punto alcanza en una fila
   *  de 38px). */
  hayBorrador?: boolean;
  /** Atenúa la fila entera (la sección no se muestra en la tienda, por el motivo que sea). */
  dim?: boolean;
  /** Muestra el botón de ojo — sólo si `config.ocultable`/equivalente. */
  ocultable?: boolean;
  visible?: boolean;
  onCambiarVisible?: () => void;
  /** El asa de reordenar (§ EDITOR-TIENDA-ORDEN-1) — ausente si esta fila no es reordenable. */
  orden?: AsaOrdenProps;
  onAbrir: () => void;
  /** El CHEVRON que despliega «kids» bajo esta fila (hoy, sólo el Hero — § el spec: "el hero
   *  desplegable en sus zonas"). Ausente = sin chevron. */
  chevronAbierto?: boolean;
  onChevron?: () => void;
  /** Contenido final de la fila — hoy sólo lo usa `InstanciaTarjeta` para su menú «⋯». */
  trailing?: ReactNode;
}

export function FilaSeccion({
  icono, titulo, hayBorrador, dim, ocultable, visible = true, onCambiarVisible,
  orden, onAbrir, chevronAbierto, onChevron, trailing,
}: FilaSeccionProps) {
  return (
    <div
      className={`editor-row${dim ? ' is-dim' : ''}`}
      style={orden?.arrastrando ? { opacity: 0.4 } : undefined}
      onDragOver={orden ? (e) => e.preventDefault() : undefined}
      onDrop={orden ? (e) => e.preventDefault() : undefined}
    >
      {orden && (
        <button
          type="button"
          draggable
          onDragStart={orden.onDragStart}
          onDragEnter={orden.onDragEnter}
          onDragEnd={orden.onDragEnd}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); orden.onMoverArriba(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); orden.onMoverAbajo(); }
          }}
          className="editor-row__grip"
          aria-label={`Mover ${titulo} — posición ${orden.posicion} de ${orden.total}. Arrastra con el mouse o usa las flechas arriba/abajo.`}
        >
          <GripVertical aria-hidden />
        </button>
      )}
      <button type="button" onClick={onAbrir} className="editor-row__main">
        <span className="editor-row__icon">{icono}</span>
        <span className="editor-row__nm">{titulo}</span>
        {hayBorrador && <span className="editor-row__dot" aria-hidden title="Sin publicar" />}
      </button>
      {onChevron && (
        <button
          type="button"
          onClick={onChevron}
          className={`editor-row__chevron${chevronAbierto ? ' is-open' : ''}`}
          aria-expanded={chevronAbierto}
          aria-label={chevronAbierto ? `Ocultar las zonas de ${titulo}` : `Mostrar las zonas de ${titulo}`}
        >
          <ChevronRight aria-hidden />
        </button>
      )}
      {ocultable && (
        <button
          type="button"
          onClick={onCambiarVisible}
          className="editor-row__eye"
          aria-pressed={!visible}
          aria-label={visible ? `Ocultar ${titulo} en la tienda` : `Mostrar ${titulo} en la tienda`}
        >
          {visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        </button>
      )}
      {trailing && <span className="editor-row__menu">{trailing}</span>}
    </div>
  );
}

export default FilaSeccion;
