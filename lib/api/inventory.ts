import type { Product } from '@/types/product';
import type { InventoryLog, InventoryAdjustmentForm } from '@/types/inventory';

export async function getProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
}

/** Filtros de la auditoría del kardex. Todos opcionales — sin ninguno, el kardex
 *  completo. `desde`/`hasta` son day keys de Bogotá (`YYYY-MM-DD`). */
export interface KardexFiltros {
  producto?: string;
  tipo?:     string;
  desde?:    string;
  hasta?:    string;
}

/**
 * Los movimientos de inventario. Sin filtros trae el kardex COMPLETO (la vista de
 * auditoría de Inventario); con `producto`, sólo los de ese producto (lo que
 * muestra el detalle de un producto). `tipo` y el rango de fechas acotan la
 * auditoría — server-side, porque el kardex tiene tope y filtrar en el cliente
 * mentiría más allá de la ventana cargada (ver `logsDeInventario`).
 */
export async function getInventoryLogs(filtros: KardexFiltros = {}): Promise<InventoryLog[]> {
  const q = new URLSearchParams();
  if (filtros.producto) q.set('producto', filtros.producto);
  if (filtros.tipo)     q.set('tipo', filtros.tipo);
  if (filtros.desde)    q.set('desde', filtros.desde);
  if (filtros.hasta)    q.set('hasta', filtros.hasta);
  const qs = q.toString();
  const res = await fetch(`/api/inventory/logs${qs ? `?${qs}` : ''}`);
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