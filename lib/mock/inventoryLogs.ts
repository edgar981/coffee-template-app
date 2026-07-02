import { InventoryLog } from "@/types/inventory";

export const mockLogs: InventoryLog[] = [
  {
    id: '1',
    producto_id: '1',
    producto_nombre: 'Café Sierra Nevada',
    tipo: 'entrada',
    cantidad: 10,
    stock_anterior: 2,
    stock_nuevo: 12,
    motivo: 'Compra proveedor',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    producto_id: '2',
    producto_nombre: 'Cold Brew Botella',
    tipo: 'venta',
    cantidad: 2,
    stock_anterior: 5,
    stock_nuevo: 3,
    motivo: 'Venta ecommerce',
    createdAt: new Date().toISOString(),
  },
];