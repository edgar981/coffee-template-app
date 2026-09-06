import { TrackedOrder } from "@/types/order";
import { trackOrder } from "@/lib/api/orders";

// Rastreo público de pedidos. Rutea por la MISMA capa /lib/api que usa el admin
// (sin acceso directo a la base). Exige número de orden + email del cliente;
// devuelve null ("no encontrado") si falta alguno o no coinciden.
//
// ÚNICA función de este módulo: las otras (getOrdersByUser, getOrders, createOrder,
// updateOrderStatus, updateOrder) eran stubs del template que devolvían MOCK —
// getOrdersByUser sólo la usaba /cuenta (andamiaje borrado, § dato falso en ruta
// pública) y las demás no tenían un solo importador. Se retiraron con /cuenta.
export async function getOrderByNumber(
  numeroOrden: string,
  email: string,
): Promise<TrackedOrder | null> {
  if (!numeroOrden.trim() || !email.trim()) return null;
  return trackOrder(numeroOrden.trim(), email.trim());
}
