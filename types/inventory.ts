export type InventoryMovementType =
  | 'entrada'
  | 'salida'
  | 'ajuste'
  | 'venta'
  | 'devolucion';

export interface InventoryLog {
  id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: InventoryMovementType;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo?: string;
  // Actor snapshot. `null` en las filas viejas y en asientos sin humano — la
  // vista de auditoría lo muestra como "—", que es honesto: no se sabe quién fue.
  ajustado_por?: string | null;
  ajustado_por_nombre?: string | null;
  // Orden de la que nace el movimiento (snapshot del id) y su número YA RESUELTO
  // por el servidor para el enlace. `orden_numero` es null si el movimiento es
  // manual o si la orden ya no existe → la celda "Motivo" va en texto plano.
  orden_id?: string | null;
  orden_numero?: string | null;
  createdAt: string;
}

export interface InventoryAdjustmentForm {
  producto_id: string;
  tipo: InventoryMovementType;
  cantidad: string;
  motivo: string;
}