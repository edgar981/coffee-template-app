import type { CajaRect } from '@/lib/admin/editor-iframe';

// EL RECORRIDO GUIADO del editor (§ EDITOR-AYUDA-RECORRIDO-1). Datos PUROS + geometría pura — sin
// React, sin DOM — mismo criterio que `ayuda-editor.ts`/`editor-iframe.ts`: el contenido y el
// cálculo de posiciones se prueban sin montar nada; el componente (`RecorridoEditor.tsx`) sólo los
// USA — busca el elemento marcado con `ATRIBUTO_RECORRIDO`, mide su `getBoundingClientRect()`, y le
// pasa el resultado a estas funciones.
//
// ES EL REPASO de la capacitación (§ EDITOR-AYUDA-1): un minuto, una parte a la vez, con una frase
// corta en el mismo tono que las guías de `ayuda-editor.ts` — no un recorrido cinemático como el del
// prototipo navegable (`docs/editor-tienda/prototipo/prototipo-editor.html`, `K.CH`), que simula un
// cursor tecleando textos de ejemplo. De ahí se toma el TONO y el ORDEN de los capítulos, no su
// mecánica de reproducción.

/** Los SIETE puntos del recorrido, en el orden del spec: "lienzo, panel, el hero y sus zonas,
 *  agregar sección, Estilo, teléfono, Publicar". Cada id es también el valor del atributo
 *  `[data-tour]` que lo ubica en el DOM (§ `ATRIBUTO_RECORRIDO`) — un solo nombre, nunca dos
 *  (§ CLAUDE.md, "cuando dos declaraciones describen el mismo conjunto... hay un TEST que las ata":
 *  acá no hace falta un segundo campo que pudiera divergir del primero). */
export type PasoRecorridoId =
  | 'lienzo'
  | 'panel'
  | 'hero'
  | 'agregar-seccion'
  | 'estilo'
  | 'telefono'
  | 'publicar';

export interface PasoRecorrido {
  id: PasoRecorridoId;
  titulo: string;
  frase: string;
}

/** El nombre del atributo que marca, en el DOM del editor, el elemento que un paso resalta. Un solo
 *  nombre compartido por quien lo ESCRIBE (`TiendaPaginas.tsx`, `Riel.tsx`, `ResumenPublicar.tsx`,
 *  `EditorTiendaPantallaCompleta.tsx`) y quien lo LEE (`RecorridoEditor.tsx`), por el mismo motivo
 *  que `ATRIBUTO_EDITOR_SECCION` en `editor-iframe.ts`. */
export const ATRIBUTO_RECORRIDO = 'data-tour';

export const PASOS_RECORRIDO: PasoRecorrido[] = [
  {
    id: 'lienzo',
    titulo: 'El lienzo',
    frase: 'Acá ves tu tienda real. Tocá cualquier texto o foto para editarla directo, donde está.',
  },
  {
    id: 'panel',
    titulo: 'El panel',
    frase: 'A la izquierda están todas las secciones de tu página, en el mismo orden en que aparecen en la tienda.',
  },
  {
    id: 'hero',
    titulo: 'El hero y sus zonas',
    frase: 'Es la portada de tu tienda. Tiene zonas con nombre —Titular, Subtítulo, Botones— que podés llenar o vaciar sin perder el resto.',
  },
  {
    id: 'agregar-seccion',
    titulo: 'Agregar sección',
    frase: 'Este botón agrega una sección nueva al final de tu página: Texto, Imagen con texto, Banner, y más.',
  },
  {
    id: 'estilo',
    titulo: 'Estilo',
    frase: 'Acá cambiás los colores y las letras de TODA tu tienda, de un solo lugar.',
  },
  {
    id: 'telefono',
    titulo: 'Ver en el teléfono',
    frase: 'Este botón cambia el ancho de la vista al de un teléfono, para que veas cómo se ve ahí tu tienda.',
  },
  {
    id: 'publicar',
    titulo: 'Publicar',
    frase: 'Cuando termines, tocá «Publicar»: te muestra en palabras qué va a cambiar antes de que se vea en tu tienda real.',
  },
];

/** La clave de `localStorage` donde se recuerda que ya se OFRECIÓ el recorrido, por navegador —
 *  mismo patrón que `CLAVE_DISPOSITIVO_EDITOR` (`editor-iframe.ts`): la lectura/escritura real del
 *  storage vive en el componente, envuelta en `try/catch` (sin storage, se ofrece de nuevo y nada se
 *  rompe — el spec lo pide así). */
export const CLAVE_RECORRIDO_VISTO = 'admin:editor-recorrido-visto';

/** El valor guardado puede ser cualquier string (otra versión, basura, `null` si nunca se guardó):
 *  sólo `'1'` cuenta como "ya se ofreció". Preferir callar (ofrecerlo de nuevo) antes que asumir
 *  visto sobre un dato que no se entiende — mismo criterio que `dispositivoDesdeStorage`. */
export function recorridoEstaVisto(valor: string | null): boolean {
  return valor === '1';
}

/** Un objetivo cuyo rect mide 0×0 no está disponible — ni ausente del DOM (`display:none` no lo
 *  quita, sólo lo colapsa) ni presente de verdad. Es el discriminador único que decide si un paso se
 *  salta solo (§ el spec: "si una parte no existe en ese momento... el paso se salta solo"), para
 *  que `RecorridoEditor.tsx` no tenga dos chequeos (existe vs. mide algo) que puedan divergir. */
export function objetivoDisponible(rect: { width: number; height: number } | null): boolean {
  return !!rect && rect.width > 0 && rect.height > 0;
}

/** Las CUATRO franjas que rodean el objetivo —arriba, abajo, izquierda, derecha— y dejan, por
 *  construcción, el rectángulo del objetivo sin nada encima (§ `RecorridoEditor.tsx`: la técnica del
 *  "hueco" por sustracción, no por `clip-path`). `margen` agranda el hueco más allá del borde exacto
 *  del objetivo, para que el resaltado no quede pegado al elemento. Clampeado al viewport: un
 *  objetivo que toca un borde de la pantalla no produce una franja de ancho/alto negativo. */
export function calcularFranjas(objetivo: CajaRect, margen: number, vw: number, vh: number): {
  arriba: CajaRect;
  abajo: CajaRect;
  izquierda: CajaRect;
  derecha: CajaRect;
} {
  const top = Math.max(0, objetivo.top - margen);
  const bottom = Math.min(vh, objetivo.top + objetivo.height + margen);
  const left = Math.max(0, objetivo.left - margen);
  const right = Math.min(vw, objetivo.left + objetivo.width + margen);
  const altoHueco = Math.max(0, bottom - top);
  return {
    arriba: { top: 0, left: 0, width: vw, height: top },
    abajo: { top: bottom, left: 0, width: vw, height: Math.max(0, vh - bottom) },
    izquierda: { top, left: 0, width: left, height: altoHueco },
    derecha: { top, left: right, width: Math.max(0, vw - right), height: altoHueco },
  };
}

function clamp(valor: number, min: number, max: number): number {
  const techo = Math.max(min, max);
  return Math.min(Math.max(valor, min), techo);
}

/** Dónde poner el globo (título + frase + Siguiente/Anterior/Saltar) sin que se salga de la
 *  pantalla: abajo del objetivo si entra, si no arriba, si no a la derecha, si no a la izquierda, y
 *  si ninguna entra, centrado — mismo orden de intentos que un tooltip de posición automática
 *  cualquiera. Puro: recibe el rect del objetivo y el tamaño del globo (medidos o estimados por el
 *  componente), nunca lee `window` él mismo. */
export function posicionGlobo(
  objetivo: CajaRect,
  globoAncho: number,
  globoAlto: number,
  vw: number,
  vh: number,
  margen = 16,
): { top: number; left: number } {
  const objetivoDerecha = objetivo.left + objetivo.width;
  const objetivoAbajo = objetivo.top + objetivo.height;

  if (objetivoAbajo + margen + globoAlto <= vh) {
    return { top: objetivoAbajo + margen, left: clamp(objetivo.left, margen, vw - globoAncho - margen) };
  }
  if (objetivo.top - margen - globoAlto >= 0) {
    return { top: objetivo.top - margen - globoAlto, left: clamp(objetivo.left, margen, vw - globoAncho - margen) };
  }
  if (objetivoDerecha + margen + globoAncho <= vw) {
    return { top: clamp(objetivo.top, margen, vh - globoAlto - margen), left: objetivoDerecha + margen };
  }
  if (objetivo.left - margen - globoAncho >= 0) {
    return { top: clamp(objetivo.top, margen, vh - globoAlto - margen), left: objetivo.left - margen - globoAncho };
  }
  return {
    top: clamp((vh - globoAlto) / 2, margen, vh - globoAlto - margen),
    left: clamp((vw - globoAncho) / 2, margen, vw - globoAncho - margen),
  };
}
