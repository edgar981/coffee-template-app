'use client';

import { Pencil, GripVertical, Eye, EyeOff } from 'lucide-react';
import type { AsaOrdenProps } from '@/components/admin/TiendaSeccionEditor';
import { InstanciaAccionesMenu } from '@/components/admin/editor/InstanciaAccionesMenu';
import { nombreInstancia, type SeccionInstanciaTipo } from '@/lib/config/secciones-instancias';

// LA FILA COLAPSADA de una sección agregada (§ EDITOR-AGREGAR-SECCION-1, el spec: "Cada sección
// agregada tiene asa, ojo y un menú con Duplicar y Eliminar"). Mismas clases que la fila de una
// banda (`.tienda-tarjeta`/`.tienda-tarjeta__meta`, § `TiendaSeccionEditor.tsx`) para que las dos
// convivan sin verse como dos sistemas — una lista mixta donde una fila se ve distinta de sus
// vecinas por ser instancia en vez de banda sería el propio defecto que esta tanda existe para no
// tener.
//
// EL "OJO" ENTRÓ EN § SECCIONES-INSTANCIAS-VIVO-1 — cierra el open follow-up que esta misma nota
// dejaba pendiente: `visible` ya está declarado en `lib/config/site-content-schema.ts` (las tres
// uniones de `seccionesHome`) y resuelto en `resolverInstancia` (`secciones-instancias.ts`), así
// que el botón de abajo persiste de verdad — ya no se pierde al refrescar. MISMO ícono/afordancia
// que el ojo de una banda (`TiendaSeccionEditor.tsx`, `Eye`/`EyeOff`), MISMO mecanismo de escritura
// que el resto de una instancia: `onCambiarVisible` llama a `cambiarInstancia` con el objeto
// COMPLETO (`TiendaPaginas.tsx`), nunca un parche — el mismo contrato que `InstanciaEditorForm`.
//
// EL TÍTULO ES EL CONTENIDO, NO EL TIPO: a diferencia de una banda (nombre fijo, "Hero de la
// home"), dos instancias del mismo tipo serían indistinguibles por nombre — así que la fila muestra
// el `titulo` QUE EL DUEÑO ESCRIBIÓ (o el nombre del tipo, de respaldo, si el título está vacío
// porque la sección se acaba de agregar) y el TIPO como una etiqueta neutra aparte.
export function InstanciaTarjeta({ tipo, titulo, visible, hayBorrador, orden, onAbrir, onDuplicar, onEliminar, onCambiarVisible }: {
  tipo: SeccionInstanciaTipo;
  titulo: string;
  /** `instancia.visible !== false` — ya resuelto por el llamador (§ CLAUDE.md, "visible sólo se
   *  sobreescribe con un booleano explícito"), esta tarjeta no decide el default. */
  visible: boolean;
  hayBorrador: boolean;
  orden?: AsaOrdenProps;
  onAbrir: () => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onCambiarVisible: () => void;
}) {
  const nombreTipo = nombreInstancia(tipo);
  const nombreFila = titulo.trim() || nombreTipo;

  return (
    <div
      className="tienda-tarjeta"
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
          className="duna-btn duna-btn--ghost duna-btn--icon"
          style={{ flexShrink: 0, cursor: 'grab', alignSelf: 'center' }}
          aria-label={`Mover ${nombreFila} — posición ${orden.posicion} de ${orden.total}. Arrastra con el mouse o usa las flechas arriba/abajo.`}
        >
          <GripVertical />
        </button>
      )}
      <div className="tienda-tarjeta__meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCambiarVisible}
            className="duna-btn duna-btn--ghost duna-btn--icon"
            aria-pressed={!visible}
            aria-label={visible ? `Ocultar ${nombreFila} en la tienda` : `Mostrar ${nombreFila} en la tienda`}
          >
            {visible ? <Eye /> : <EyeOff />}
          </button>
          <h2 className="duna-title">{nombreFila}</h2>
          <span className="duna-badge duna-badge--neutral">{nombreTipo}</span>
          {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          {!visible && <span className="duna-badge duna-badge--neutral">Oculta</span>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)' }}>
          <button type="button" onClick={onAbrir} className="duna-btn duna-btn--secondary">
            <Pencil /> Editar
          </button>
          <InstanciaAccionesMenu nombre={nombreFila} onDuplicar={onDuplicar} onEliminar={onEliminar} />
        </div>
      </div>
    </div>
  );
}

export default InstanciaTarjeta;
