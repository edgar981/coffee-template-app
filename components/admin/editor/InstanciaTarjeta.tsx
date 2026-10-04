'use client';

import type { AsaOrdenProps } from '@/components/admin/TiendaSeccionEditor';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import { InstanciaAccionesMenu } from '@/components/admin/editor/InstanciaAccionesMenu';
import { nombreInstancia, type SeccionInstanciaTipo } from '@/lib/config/secciones-instancias';

// LA FILA COLAPSADA de una sección agregada (§ EDITOR-AGREGAR-SECCION-1, el spec: "Cada sección
// agregada tiene asa, ojo y un menú con Duplicar y Eliminar"). § EDITOR-VISUAL-PANEL-1 la pasó de
// `.tienda-tarjeta` a `FilaSeccion` —la MISMA fila compacta que usan las bandas
// (`TiendaSeccionEditor.tsx`) y el cromo (`EncabezadoSeccion.tsx`/`MenuSeccion.tsx`/
// `FooterSeccion.tsx`)— para que las secciones agregadas se vean "como filas iguales" al resto de
// la lista (§ CLAUDE.md, el spec de ese slice) — una lista mixta donde una fila se ve distinta de
// sus vecinas por ser instancia en vez de banda sería el propio defecto que esta tanda existe para
// no tener. `trailing={<InstanciaAccionesMenu…/>}` es el «⋯» del spec — el único extra que una fila
// de instancia lleva sobre una de banda.
//
// EL "OJO" ENTRÓ EN § SECCIONES-INSTANCIAS-VIVO-1 — cierra el open follow-up que esta misma nota
// dejaba pendiente: `visible` ya está declarado en `lib/config/site-content-schema.ts` (las tres
// uniones de `seccionesHome`) y resuelto en `resolverInstancia` (`secciones-instancias.ts`), así
// que el botón de abajo persiste de verdad — ya no se pierde al refrescar. MISMO mecanismo de
// escritura que el resto de una instancia: `onCambiarVisible` llama a `cambiarInstancia` con el
// objeto COMPLETO (`TiendaPaginas.tsx`), nunca un parche — el mismo contrato que `InstanciaEditorForm`.
//
// EL TÍTULO ES EL CONTENIDO, NO EL TIPO: a diferencia de una banda (nombre fijo, "Hero de la
// home"), dos instancias del mismo tipo serían indistinguibles por nombre — así que la fila muestra
// el `titulo` QUE EL DUEÑO ESCRIBIÓ (o el nombre del tipo, de respaldo, si el título está vacío
// porque la sección se acaba de agregar). EL BADGE DE TIPO SE RETIRA (§ EDITOR-VISUAL-PANEL-1,
// DESVIACIÓN declarada): el prototipo no muestra una etiqueta de tipo en la fila —sólo ícono +
// nombre—, y acá el tipo YA se lee dentro de la edición (`InstanciaEditorForm`); perderlo en la
// fila es un matiz menos, no una función menos.
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
    <FilaSeccion
      icono={<IconoFila tipo="generico" />}
      titulo={nombreFila}
      hayBorrador={hayBorrador}
      dim={!visible}
      ocultable
      visible={visible}
      onCambiarVisible={onCambiarVisible}
      orden={orden}
      onAbrir={onAbrir}
      trailing={<InstanciaAccionesMenu nombre={nombreFila} onDuplicar={onDuplicar} onEliminar={onEliminar} />}
    />
  );
}

export default InstanciaTarjeta;
