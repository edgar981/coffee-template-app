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
      </button>
      {/* § EDITOR-PAGINAS-ONIX-ARREGLOS-1 — el punto ámbar SALE de `.editor-row__main` (donde el
          `nm` flex-grow lo empujaba hasta pegarlo contra el chevron/ojo, o contra el borde de la fila
          si ninguno de los dos existía) y se muda a esta ranura FIJA, sibling de main. Como `nm` sigue
          llenando TODO el espacio de `main` (flex:1 1 auto), el punto queda siempre contra el borde
          derecho de `main` — y ese borde es CONSTANTE entre filas sólo si lo que viene DESPUÉS también
          es de ancho fijo (ver la ranura de 28px más abajo): por eso las dos ranuras van juntas.
          Estilo INLINE (no una clase de `editor.css`, fuera de `touches:` de este slice): dos reglas
          de layout puro, sin tema/token que justifique moverlas a la hoja compartida todavía. */}
      <span style={{ width: 10, height: 10, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        {hayBorrador && <span className="editor-row__dot" aria-hidden title="Sin publicar" />}
      </span>
      {/* RANURA FIJA de 28px, SIEMPRE presente — chevron, ojo, o vacía. Antes el chevron/ojo sólo
          existían en el DOM cuando aplicaban, así que una fila sin ninguno de los dos perdía ese
          ancho y el punto ámbar (arriba) terminaba en una columna distinta según la fila tuviera o no
          el ícono de visibilidad al lado (el reporte del owner, § EDITOR-PAGINAS-ONIX-ARREGLOS-1).
          Reservar el ancho SIEMPRE —con o sin ícono real adentro— es lo que fija la columna. Ningún
          consumidor de hoy combina chevron Y ojo en la misma fila (el chevron es sólo del hero, que
          nace `ocultable:false`), así que un `if/else if` alcanza sin necesitar las dos ranuras. */}
      <span style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        {onChevron ? (
          <button
            type="button"
            onClick={onChevron}
            className={`editor-row__chevron${chevronAbierto ? ' is-open' : ''}`}
            aria-expanded={chevronAbierto}
            aria-label={chevronAbierto ? `Ocultar las zonas de ${titulo}` : `Mostrar las zonas de ${titulo}`}
          >
            <ChevronRight aria-hidden />
          </button>
        ) : ocultable ? (
          <button
            type="button"
            onClick={onCambiarVisible}
            className="editor-row__eye"
            aria-pressed={!visible}
            aria-label={visible ? `Ocultar ${titulo} en la tienda` : `Mostrar ${titulo} en la tienda`}
          >
            {visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
          </button>
        ) : null}
      </span>
      {trailing && <span className="editor-row__menu">{trailing}</span>}
    </div>
  );
}

export default FilaSeccion;
