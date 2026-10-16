// LA RETÍCULA DE DOS COLUMNAS de la Ficha «Etiqueta de bolsa» (§ CHAMISAS-PAGINAS-ARREGLOS-1,
// refero-chamisas.md §3 punto 4 / la maqueta `.fic-grid`/`.fc`/`.fc.lft`/`.fc.span`,
// `.scratch/chamisas-paginas/nosotros-suscripciones.html`). PURO (capa 1).
//
// EL DEFECTO MEDIDO: `NosotrosFichaEtiqueta.tsx` sólo pasaba a dos columnas desde `sm:` (640px) —
// en celular (390px, la captura de referencia) la retícula caía a UNA sola columna, apilando las 8
// filas en vez de emparejarlas como la maqueta ("pares Origen/Altitud, Proceso/Cosecha y
// Familias/Tostión, con Variedades y Presentación a lo ancho"). La maqueta nunca tuvo ese fallback:
// `.fic-grid{display:grid;grid-template-columns:1fr 1fr}` es la MISMA regla en las dos anchuras; lo
// único que cambia entre breakpoints es el padding/tamaño de cada celda, no el número de columnas.
//
// QUÉ FILA VA A LO ANCHO: la maqueta lo hardcodea por POSICIÓN en un array fijo de 8 filas
// ('span' en Variedades y Presentación); acá las filas vienen de `tiendaCreditos.items`, un
// repeater editable por el panel — ORDEN y CANTIDAD no están garantizados. Se deriva en su lugar del
// mismo ÍCONO que ya identifica la fila (`fichaIcono`, ficha-iconos.ts): "variedades" y
// "presentacion" son las dos claves que la maqueta pone a lo ancho, y derivarlo del ícono ya
// resuelto evita una SEGUNDA clasificación de la etiqueta que pudiera divergir de la primera.
//
// EL "HUECO SUELTO": con `grid-template-columns:1fr 1fr` y auto-flow, una fila ANCHO COMPLETO
// reinicia la fila siguiente en la columna izquierda — así es como la maqueta, con sus dos tramos
// pares (2 y 4 filas), nunca deja una celda vecina vacía. Un tramo de cantidad IMPAR (posible con un
// repeater editable, no con los 8 datos fijos de la maqueta) SÍ la dejaría: la ÚLTIMA fila de ese
// tramo queda sola en su fila, con la celda vecina en blanco. Se promueve esa fila a ANCHO COMPLETO
// también — la misma salida que la retícula ya usa para "Variedades"/"Presentación", no un
// tratamiento nuevo.
import { fichaIcono } from './ficha-iconos';

export interface FichaFila {
  etiqueta: string;
  valor: string;
}

export interface FichaFilaGrid extends FichaFila {
  anchoCompleto: boolean;
  /** 0 = columna izquierda (lleva el borde derecho); 1 = columna derecha (lleva el relleno
   *  izquierdo); `null` en una fila ancho completo, que no tiene una columna que bordear. */
  columna: 0 | 1 | null;
}

/** ¿Esta fila va a lo ancho de la retícula? (§ el docstring de cabecera — "Variedades" y
 *  "Presentación", derivado del mismo ícono que ya identifica la fila). */
export function filaAnchoCompleto(etiqueta: string): boolean {
  const id = fichaIcono(etiqueta);
  return id === 'variedades' || id === 'presentacion';
}

/** Las filas de la ficha, con `anchoCompleto` (incluida la promoción que evita el hueco suelto) y
 *  `columna` (0/1, para el borde/relleno de cada fila PAREADA) ya resueltos. */
export function filasFichaGrid<T extends FichaFila>(filas: readonly T[]): (T & { anchoCompleto: boolean; columna: 0 | 1 | null })[] {
  const marcadas = filas.map((f) => ({ ...f, anchoCompleto: filaAnchoCompleto(f.etiqueta), columna: null as 0 | 1 | null }));

  // Promover la ÚLTIMA fila de cada tramo IMPAR (entre dos anchas, o entre un borde y una ancha) a
  // ancho completo — así nunca queda una celda vecina vacía.
  let inicioTramo = 0;
  for (let i = 0; i <= marcadas.length; i++) {
    const limite = i === marcadas.length || marcadas[i].anchoCompleto;
    if (!limite) continue;
    const largoTramo = i - inicioTramo;
    if (largoTramo % 2 === 1) marcadas[i - 1].anchoCompleto = true;
    inicioTramo = i + 1;
  }

  // Asignar columna 0/1 a cada fila NO ancho-completo, reiniciando la paridad en cada fila ancha —
  // es lo que replica el auto-flow real de CSS grid (una fila `grid-column:1/-1` siempre empieza la
  // siguiente en la columna izquierda).
  let paridad = 0;
  for (const m of marcadas) {
    if (m.anchoCompleto) { paridad = 0; continue; }
    m.columna = (paridad % 2) as 0 | 1;
    paridad++;
  }
  return marcadas;
}
