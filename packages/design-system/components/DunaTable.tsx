import type { ReactNode } from 'react';

// Tabla de DATOS columnar — AGNÓSTICA. No conoce dominio: recibe columnas y filas
// ya resueltas por el consumidor (un movimiento de kardex, un pago, lo que sea).
// El consumidor arma cada celda como un nodo —un badge, un `duna-mono`, un "—"—;
// el DS sólo pone la rejilla, el encabezado y el scroll horizontal.
//
// Distinta de `ItemsTable`, que es de dos columnas (label / monto) para las líneas
// de una orden. Ésta es de N columnas con encabezado, para una vista de auditoría
// o un listado denso. Nace para el kardex de Inventario; Pagos y Analítica la van
// a querer.
//
// EL SCROLL HORIZONTAL LO RESUELVE EL SISTEMA, no cada pantalla: el envoltorio
// scrollea y la tabla no se aplasta (`min-width` en `.duna-table`). Es donde una
// tabla se rompe en un teléfono, así que no puede quedar librado a que cada
// consumidor se acuerde de envolverla.

export interface DunaColumn {
  /** Clave estable de la columna (para el `key` de React del encabezado). */
  key: string;
  /** Lo que va en el `<th>` — texto o nodo. */
  header: ReactNode;
  /** Alineación de la columna. `right` para números; afecta encabezado Y celdas. */
  align?: 'left' | 'right';
}

export interface DunaRow {
  /** Clave estable de la fila. */
  key: string;
  /**
   * Las celdas, POSICIONALES: `cells[i]` cae bajo `columns[i]`. Cada una es un
   * nodo ya resuelto por el consumidor. La alineación no se repite acá — la hereda
   * de su columna, para que una celda no pueda desalinearse de su encabezado.
   */
  cells: ReactNode[];
}

export interface DunaTableProps {
  columns: DunaColumn[];
  rows: DunaRow[];
  /**
   * Ancho mínimo antes de que el envoltorio scrollee. Default `.duna-table` = 32rem;
   * una tabla con muchas columnas (el kardex de auditoría) lo sube para que sus
   * columnas respiren en vez de amontonarse antes de scrollear.
   */
  minWidth?: string;
}

export function DunaTable({ columns, rows, minWidth }: DunaTableProps) {
  return (
    <div className="duna-table-wrap">
      <table className="duna-table" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.align === 'right' ? 'duna-table__r' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              {r.cells.map((cell, i) => (
                <td key={columns[i]?.key ?? i}
                    className={columns[i]?.align === 'right' ? 'duna-table__r' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
