// Tabla de líneas de una orden en el detalle — AGNÓSTICA. Filas genéricas
// {label, meta?, amount} + fila total opcional. No conoce `OrderItem` ni dominio:
// el consumidor resuelve textos y montos (el DS no formatea moneda).

export interface ItemRow {
  /** Descripción de la línea (nombre del ítem). */
  label: string;
  /** Metadato opcional (cantidad, variante) — texto ya resuelto. */
  meta?: string;
  /** Monto YA formateado. */
  amount: string;
}

export interface ItemsTableProps {
  rows: ItemRow[];
  /** Fila total opcional: label + monto ya formateado. */
  total?: { label: string; amount: string };
}

export function ItemsTable({ rows, total }: ItemsTableProps) {
  return (
    <table className="duna-items-table">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              {r.label}
              {r.meta && <span className="duna-items-table__meta"> · {r.meta}</span>}
            </td>
            <td className="duna-items-table__r duna-num">{r.amount}</td>
          </tr>
        ))}
        {total && (
          <tr className="duna-items-table__total">
            <td>{total.label}</td>
            <td className="duna-items-table__r duna-num">{total.amount}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
