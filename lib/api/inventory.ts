import type { Product } from '@/types/product';
import type { InventoryLog, InventoryAdjustmentForm } from '@/types/inventory';

export async function getProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
}

/**
 * Los movimientos de inventario. Sin `productoId` trae el kardex COMPLETO (la
 * vista de auditoría de Inventario); con él, sólo los de ese producto — que es
 * lo que muestra el detalle de un producto.
 *
 * El parámetro es opcional para que el llamador de siempre no cambie: la
 * pestaña Movimientos sigue llamando `getInventoryLogs()` y recibe lo mismo.
 */
export async function getInventoryLogs(productoId?: string): Promise<InventoryLog[]> {
  const qs = productoId ? `?producto=${encodeURIComponent(productoId)}` : '';
  const res = await fetch(`/api/inventory/logs${qs}`);
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
  if (!res.ok) {
    // Propaga el motivo del servidor (p. ej. "Stock insuficiente para esta
    // salida" en un 409) para que el admin vea por qué se rechazó.
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? 'Error al ajustar inventario');
  }
  return res.json();
}