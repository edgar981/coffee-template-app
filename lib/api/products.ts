import type { Product } from '@/types/product';
import { razonDelServidor } from '@/lib/api/errors';

// Admin: catálogo completo (requiere sesión; incluye costo/stock_minimo).
export async function getProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
}

// Storefront: catálogo público (solo productos activos, campos de cliente).
// Memoizado a nivel de módulo: home, tienda, detalle y búsqueda comparten una
// sola petición por carga de página; en error se limpia para poder reintentar.
let catalogPromise: Promise<Product[]> | null = null;

export function getCatalog(): Promise<Product[]> {
  if (!catalogPromise) {
    catalogPromise = fetch('/api/catalog').then((res) => {
      if (!res.ok) {
        catalogPromise = null;
        throw new Error('Error al cargar el catálogo');
      }
      return res.json();
    });
  }
  return catalogPromise;
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const res = await fetch('/api/products', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw await razonDelServidor(res, 'Error al crear producto');
  return res.json();
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw await razonDelServidor(res, 'Error al actualizar producto');
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  // Surface the server's reason (e.g. the 409 "aparece en N órdenes; desactívalo")
  // so the confirm dialog can show it verbatim.
  if (!res.ok) throw await razonDelServidor(res, 'Error al eliminar producto');
}