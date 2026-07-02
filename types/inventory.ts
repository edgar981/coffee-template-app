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
  createdAt: string;
}

export interface InventoryAdjustmentForm {
  producto_id: string;
  tipo: InventoryMovementType;
  cantidad: string;
  motivo: string;
}