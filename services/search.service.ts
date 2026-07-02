

import { SearchResult } from "@/types/search";
import { get } from "http";
import { getOrders } from "./order.service";
import { getProducts } from "./inventory.service";
import { getCustomers } from "./customers.service";
import { normalize } from "@/lib/utils";


export const searchService = {
  async search(
    query: string
  ): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const normalized = normalize(query);

    const [
      orders,
      products,
      customers,
    ] = await Promise.all([
      getOrders(),
      getProducts(),
      getCustomers(),
    ]);

    const orderResults = orders
  .filter(o =>
    normalize(o.numero_orden ?? "").includes(normalized) ||
    normalize(o.cliente_nombre ?? "").includes(normalized)
  )
        .map<SearchResult>((o) => ({
          id: o.id,

          type: "orden",

          title:
            o.numero_orden,

          subtitle:
            o.cliente_nombre,

          badge:
            o.estado,

          href:
            `/admin/ordenes/${o.id}`,
        }));

    const productResults = products
  .filter(p =>
    normalize(p.nombre).includes(normalized) ||
    normalize(p.categoria).includes(normalized)
  )
        .map<SearchResult>((p) => ({
          id: p.id,

          type: "producto",

          title:
            p.nombre,

          subtitle:
            p.categoria,

          href:
            `/admin/productos/${p.id}`,
        }));

    const customerResults =
      customers
        .filter(
          (c) =>
            normalize(c.nombre).includes(normalized) ||
            normalize(c.email ?? "").includes(normalized)
        )
        .map<SearchResult>((c) => ({
          id: c.id,

          type: "cliente",

          title:
            c.nombre,

          subtitle:
            c.email,

          href:
            `/admin/clientes/${c.id}`,
        }));

    return [
      ...orderResults,
      ...productResults,
      ...customerResults,
    ].slice(0, 12);
  },
};