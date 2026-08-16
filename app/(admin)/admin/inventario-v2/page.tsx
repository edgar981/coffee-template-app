'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { DunaTable, type DunaColumn } from '@duna/design-system/components/DunaTable';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { toast } from 'sonner';
import { getProducts, getInventoryLogs } from '@/lib/api/inventory';
import { AdjustStockModal } from '@/components/admin/AdjustStockModal';
import type { Product } from '@/types/product';
import type { InventoryLog, InventoryMovementType } from '@/types/inventory';

// ═══ INVENTARIO · la vista de AUDITORÍA del stock ═════════════════════════════
//
// Responde la pregunta que NINGUNA pantalla de producto puede: "¿qué pasó con el
// stock, y quién ajustó qué?". El detalle de un producto muestra el kardex de UN
// producto; recorrer el catálogo producto por producto no reconstruye la historia
// del inventario. Eso —el kardex COMPLETO con su actor— es lo único que sólo esta
// pantalla puede dar.
//
// ── POR QUÉ SE ENCOGIÓ (decisión del owner) ─────────────────────────────────
//
// Tuvo una cola de reposición con carriles (Por reponer / Agotados) y un
// segmentado para llegar a la auditoría. Se quitó: la cola es la MISMA pregunta
// que el carril "Por reponer" de Productos, con la MISMA fuente (`isLowStock`).
// Verla en dos sitios es lo que hacía que la pantalla se sintiera de más. La
// reposición vive en el carril de Productos; Inventario es la vista de auditoría.
//
// Con la cola muere el segmentado: una sola vista. Sobrevive lo que no tiene otro
// hogar:
//   · el kardex completo con la columna Quién (la auditoría),
//   · el valor total del inventario (estado vigente, con su descargo),
//   · el botón Ajustar stock (la puerta de operación de inventario, con selector).
//
// DISPARADOR: si con uso real el operador busca reponer EN Inventario y no en el
// carril de Productos, la cola se mueve acá —con su dato—, igual que el punto sol
// pertenece a donde se RESUELVE el hecho, no a donde se lista. Hasta entonces, un
// solo hogar por pregunta.
//
// Vive en `/admin/inventario-v2` mientras convive con la vieja; heredará la ruta
// al retirarse aquélla, con su redirect — mismo procedimiento que las tres
// verticales anteriores.

// El TIPO de movimiento va NEUTRO — Amber Minimal: el rojo es alerta, y una salida
// o una venta son operación normal. La DIRECCIÓN la carga el signo de la cantidad
// (+entrada, −salida), no un color (aprobado por el owner).
const TIPO_LABEL: Record<InventoryMovementType, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta: 'Venta', devolucion: 'Devolución',
};

/** El signo del movimiento. `ajuste` FIJA un valor absoluto: no es delta, así que
 *  se muestra el resultado, no un `+N` que no ocurrió. */
function signoDelMovimiento(l: InventoryLog): string {
  if (l.tipo === 'ajuste') return String(l.stock_nuevo);
  const suma = l.tipo === 'entrada' || l.tipo === 'devolucion';
  return `${suma ? '+' : '−'}${l.cantidad}`;
}

export default function Inventario() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [logs, setLogs]           = useState<InventoryLog[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showAdj, setShowAdj]     = useState(false);

  useEffect(() => {
    let vivo = true;
    // Los productos hacen falta para el valor total Y para el selector del modal;
    // los logs, para el kardex.
    Promise.all([getProducts(), getInventoryLogs()])
      .then(([p, l]) => { if (vivo) { setProductos(p); setLogs(l); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar el inventario'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // Valor del inventario: valuación de ESTADO VIGENTE (cuánto capital está parado
  // en stock ahora). Usa el costo ACTUAL del catálogo, así que es estimada, no
  // contable — se declara en pantalla, como el margen de Analítica.
  const valorTotal = useMemo(
    () => productos.reduce((s, p) => s + ((p.costo ?? 0) * p.stock), 0),
    [productos],
  );

  // Un ajuste aplicado desde el modal: la fila del producto se actualiza (para que
  // el valor total lo refleje) y el movimiento ENCABEZA el kardex.
  const aplicado = useCallback(({ product, log }: { product: Product; log: InventoryLog }) => {
    setProductos(prev => prev.map(p => p.id === product.id ? product : p));
    setLogs(prev => [log, ...prev]);
    toast.success('Inventario actualizado');
  }, []);

  const columnasKardex: DunaColumn[] = [
    { key: 'producto', header: 'Producto' },
    { key: 'tipo',     header: 'Tipo' },
    { key: 'cantidad', header: 'Cantidad', align: 'right' },
    { key: 'saldo',    header: 'Antes → Después', align: 'right' },
    { key: 'motivo',   header: 'Motivo' },
    { key: 'quien',    header: 'Quién' },
    { key: 'fecha',    header: 'Fecha' },
  ];
  const filasKardex = logs.map(l => ({
    key: l.id,
    cells: [
      l.producto_nombre,
      <span key="t" className="duna-badge duna-badge--neutral">{TIPO_LABEL[l.tipo] ?? l.tipo}</span>,
      <span key="c" className="duna-num">{signoDelMovimiento(l)}</span>,
      <span key="s" className="duna-num">{l.stock_anterior} → {l.stock_nuevo}</span>,
      l.motivo || '—',
      // El actor. `—` es honesto: filas viejas y asientos del sistema no tienen
      // humano — es la razón por la que la columna existe.
      l.ajustado_por_nombre || '—',
      <span key="f" className="duna-caption">{formatFecha(l.createdAt)}</span>,
    ],
  }));

  return (
    <div className="duna">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-4)', marginBottom: 'var(--duna-space-5)' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="duna-display-m">Inventario</h1>
          {/* El subtítulo dice qué ES esta pantalla, porque su nombre no lo agota:
              "Inventario" podría ser stock, reposición o auditoría — es la última. */}
          <p className="duna-sub" style={{ margin: 'var(--duna-space-hairline) 0 0' }}>
            Historial de movimientos de stock — quién ajustó qué, y cuándo.
          </p>
        </div>
        <button
          type="button"
          className="duna-btn duna-btn--primary"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setShowAdj(true)}
        >
          <ArrowUpDown /> Ajustar stock
        </button>
      </header>

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* ── Valor del inventario — estado vigente, con su descargo ──────────── */}
      <div style={{ marginBottom: 'var(--duna-space-6)' }}>
        <div className="duna-stat" style={{ display: 'inline-block' }}>
          <div className="duna-stat__v duna-num">{cargando ? '—' : formatCOP(valorTotal)}</div>
          <div className="duna-stat__l">Valor del inventario</div>
        </div>
        <p className="duna-caption" style={{ margin: 'var(--duna-space-2) 0 0' }}>
          Valuación estimada con el costo actual del catálogo, no contable.
        </p>
      </div>

      {/* ── El kardex completo · la vista de auditoría ─────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Movimientos</div>
      {cargando && <p className="duna-sub" style={{ margin: 0 }}>Cargando los movimientos…</p>}
      {!cargando && logs.length === 0 && (
        <div className="duna-card duna-card__pad">
          <p className="duna-sub" style={{ margin: 0 }}>Sin movimientos registrados.</p>
        </div>
      )}
      {!cargando && logs.length > 0 && (
        <DunaTable columns={columnasKardex} rows={filasKardex} minWidth="48rem" />
      )}

      {/* La puerta de operación de inventario: el modal agnóstico con selector de
          producto (sin pre-llenado — la reposición por producto vive en Productos). */}
      <AdjustStockModal
        open={showAdj}
        productos={productos}
        onOpenChange={setShowAdj}
        onAplicado={aplicado}
      />
    </div>
  );
}
