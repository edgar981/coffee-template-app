'use client';

import { Pencil, GripVertical } from 'lucide-react';
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
// EL "OJO" NO ENTRÓ A ESTA TANDA, Y ESTÁ DICHO ACÁ PARA QUE NO SE LEA COMO UN OLVIDO: la banda sí lo
// tiene (`config.ocultable` → `form.visible`, persistido por el schema de ESA sección) pero
// persistir un `visible` por instancia exige declararlo en `lib/config/site-content-schema.ts`
// —fuera de `touches:` de este slice— porque `z.object` sin ese campo lo STRIPPEA en silencio al
// guardar (§ CLAUDE.md, "El schema editable STRIPPEA lo no declarado"): un botón que pareciera
// ocultar la sección sin que el valor sobreviva un refresh sería peor que no tenerlo. Ver el open
// follow-up de este slice en DECISIONS.md.
//
// EL TÍTULO ES EL CONTENIDO, NO EL TIPO: a diferencia de una banda (nombre fijo, "Hero de la
// home"), dos instancias del mismo tipo serían indistinguibles por nombre — así que la fila muestra
// el `titulo` QUE EL DUEÑO ESCRIBIÓ (o el nombre del tipo, de respaldo, si el título está vacío
// porque la sección se acaba de agregar) y el TIPO como una etiqueta neutra aparte.
export function InstanciaTarjeta({ tipo, titulo, hayBorrador, orden, onAbrir, onDuplicar, onEliminar }: {
  tipo: SeccionInstanciaTipo;
  titulo: string;
  hayBorrador: boolean;
  orden?: AsaOrdenProps;
  onAbrir: () => void;
  onDuplicar: () => void;
  onEliminar: () => void;
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
          <h2 className="duna-title">{nombreFila}</h2>
          <span className="duna-badge duna-badge--neutral">{nombreTipo}</span>
          {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
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
