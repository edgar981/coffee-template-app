import type { Product } from '@/types/product';
import type { InventoryLog, InventoryAdjustmentForm } from '@/types/inventory';

export async function getProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
}

export async function getInventoryLogs(): Promise<InventoryLog[]> {
  const res = await fetch('/api/inventory/logs');
  if (!res.ok) throw new Error('Error al cargar movimientos');
  return res.json();
}

export async function adjustInventory(
  form: InventoryAdjustmentForm
): Promise<{ product: Product; log: InventoryLog }> {
  const res = await fetch('/api/inventory/adjust', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Error al ajustar inventario');
  return res.json();
}