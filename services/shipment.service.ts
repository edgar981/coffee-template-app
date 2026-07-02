import { Shipping } from "@/types/shipping";

let shipments: Shipping[] = [];

export const shipmentService = {
  // GET ALL
  async getAll(): Promise<Shipping[]> {
    return Promise.resolve(shipments);
  },

  // GET BY ORDER NUMBER
  async getByOrderNumber(
    orderNumber: string
  ): Promise<Shipping | undefined> {
    const shipment = shipments.find(
      (item) => item.numero_orden === orderNumber
    );

    return Promise.resolve(shipment);
  },

  // CREATE
  async create(
    payload: Omit<Shipping, "orden_id">
  ): Promise<Shipping> {
    const newShipment: Shipping = {
      ...payload,
      orden_id: crypto.randomUUID(),
    };

    shipments.unshift(newShipment);

    return Promise.resolve(newShipment);
  },

  // UPDATE
  async update(
    ordenId: string,
    payload: Partial<Shipping>
  ): Promise<Shipping | null> {
    const index = shipments.findIndex(
      (item) => item.orden_id === ordenId
    );

    if (index === -1) {
      return Promise.resolve(null);
    }

    shipments[index] = {
      ...shipments[index],
      ...payload,
    };

    return Promise.resolve(shipments[index]);
  },

  // DELETE
  async remove(ordenId: string): Promise<boolean> {
    const index = shipments.findIndex(
      (item) => item.orden_id === ordenId
    );

    if (index === -1) {
      return Promise.resolve(false);
    }

    shipments.splice(index, 1);

    return Promise.resolve(true);
  },

  // FILTER BY STATUS
  async getByStatus(
    estado: Shipping["estado"]
  ): Promise<Shipping[]> {
    const filtered = shipments.filter(
      (item) => item.estado === estado
    );

    return Promise.resolve(filtered);
  },

  // FILTER BY CITY
  async getByCity(ciudad: string): Promise<Shipping[]> {
    const filtered = shipments.filter((item) =>
      item.ciudad.toLowerCase().includes(ciudad.toLowerCase())
    );

    return Promise.resolve(filtered);
  },

  // SEARCH
  async search(query: string): Promise<Shipping[]> {
    const normalized = query.toLowerCase();

    const results = shipments.filter(
      (item) =>
        item.numero_orden.toLowerCase().includes(normalized) ||
        item.cliente_nombre.toLowerCase().includes(normalized) ||
        item.ciudad.toLowerCase().includes(normalized)
    );

    return Promise.resolve(results);
  },

  // SEED MOCK DATA
  seed(data: Shipping[]) {
    shipments = [...data];
  },

  // RESET
  reset() {
    shipments = [];
  },
};