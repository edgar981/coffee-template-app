import { MOCK_ORDERS, MOCK_ADMIN_ORDERS } from "@/lib/mock/orders";
import { Order, OrderStatus } from "@/types/order";

export async function getOrderByNumber(
  numeroOrden: string
) {
  await new Promise((resolve) =>
    setTimeout(resolve, 700)
  );

  return (
    MOCK_ORDERS.find(
      (order) =>
        order.numero_orden === numeroOrden
    ) || null
  );
}

export async function getOrdersByUser() {
  return MOCK_ORDERS;
}

export async function getOrders(): Promise<Order[]> {
  return new Promise(resolve => setTimeout(() => resolve(MOCK_ADMIN_ORDERS), 400));
}

export async function createOrder(data: Omit<Order, 'id' | 'createdAt' | 'numero_orden'>): Promise<Order> {
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  return new Promise(resolve =>
    setTimeout(() => resolve({
      ...data,
      id:           crypto.randomUUID(),
      numero_orden: `SN-${n}`,
      createdAt:    new Date().toISOString(),
    }), 300)
  );
}

export async function updateOrderStatus(id: string, estado: OrderStatus): Promise<Order> {
  const order = MOCK_ADMIN_ORDERS.find(o => o.id === id);
  if (!order) throw new Error(`Order ${id} not found`);
  return new Promise(resolve =>
    setTimeout(() => resolve({ ...order, estado }), 300)
  );
}

export async function updateOrder(id: string, data: Partial<Order>): Promise<Order> {
  const order = MOCK_ADMIN_ORDERS.find(o => o.id === id);
  if (!order) throw new Error(`Order ${id} not found`);
  return new Promise(resolve =>
    setTimeout(() => resolve({ ...order, ...data }), 300)
  );
}