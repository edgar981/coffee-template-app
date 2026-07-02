import { InventoryLog } from '@/types/inventory';
import { DEMO_PRODUCTS } from '@/lib/mock/products';
import { mockLogs } from '@/lib/mock/inventoryLogs';
import { Product } from '@/types/product';


export async function getProducts(): Promise<Product[]> {
  return new Promise(resolve => {
    setTimeout(() => resolve(DEMO_PRODUCTS), 400);
  });
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<Product> {
  return new Promise(resolve =>
    setTimeout(() => resolve({ ...data, id: crypto.randomUUID() }), 300)
  );
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const product = DEMO_PRODUCTS.find(p => p.id === id);
  if (!product) throw new Error(`Product ${id} not found`);
  return new Promise(resolve =>
    setTimeout(() => resolve({ ...product, ...data }), 300)
  );
}

export async function deleteProduct(id: string): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 300));
}

export async function getInventoryLogs(): Promise<InventoryLog[]> {
  return new Promise(resolve => {
    setTimeout(() => resolve(mockLogs), 400);
  });
}