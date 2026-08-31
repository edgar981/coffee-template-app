import { isLowStock } from '@duna/core/metrics/inventory-filters';
import { motivosDeAtencion, textoDeMotivo, type MotivoTipo, type OrdenParaAtencion } from '@/lib/pedidos/atencion';
import { RUTA_REPONER } from '@/lib/productos/filtros';

// ─── LA LISTA TRANSVERSAL de "Necesita tu atención" (dashboard Hoy) ───────────
//
// Es la ÚNICA superficie que unifica pedidos-atención + stock-bajo en UNA lista.
// Hasta ahora esos dos se unificaban sólo en el punto del rail; el conteo, el
// carril de Pedidos y la card de stock iban por separado. Esta función es esa
// unificación, y REUSA las definiciones que ya existen —`motivosDeAtencion`
// (pedidos) e `isLowStock` (stock)—: no inventa un predicado, así que no puede
// divergir del carril, del punto ni de la card. Una fuente, varias lecturas.
//
// UN ÍTEM POR ORDEN, no por motivo: una orden con dos motivos (p. ej. despachada
// sin cobrar Y con un comprobante sin verificar) es UNA fila; sus motivos se
// ENCADENAN en el subtítulo (nada escondido). El título es el ancla estable (la
// orden); el subtítulo lidera con el motivo más urgente (van ordenados por
// prioridad). La navegación la carga cada ítem: al DETALLE, donde vive la acción
// —Hoy no muta (§ Dashboard: cada indicador navega, no muta)—.

/** Un ítem de la lista de atención: qué es, por qué, y a dónde lleva. */
export interface ItemAtencion {
  seccion: 'pedidos' | 'productos';
  titulo: string;
  subtitulo: string;
  href: string;
  /** Menor = más urgente. Sale de `PRIORIDAD_ATENCION`, no de un sort ad hoc. */
  prioridad: number;
  /** Desempate DENTRO de un mismo nivel, menor primero: para pedidos es la
   *  antigüedad (más viejo = más urgente); para stock, las unidades (0 primero).
   *  Nunca se comparan entre niveles (la prioridad ya los separa). */
  desempate: number;
}

/**
 * La PRIORIDAD por tipo, DECLARADA (no un `sort` en la página). El criterio es el
 * costo, no la sección: lo que cuesta plata antes que lo que cuesta una reposición.
 * Una orden con varios motivos hereda la prioridad MÁS ALTA (el menor número) de
 * los suyos.
 */
export const PRIORIDAD_ATENCION: Record<MotivoTipo | 'stock', number> = {
  por_cobrar:                 1, // plata en la calle
  entrega_fallida:            2, // entrega perdida, plata en riesgo
  comprobante_sin_verificar:  3, // plata por confirmar
  programacion_a_medias:      4, // pedido trabado — nada perdido, falta un paso
  stock:                      5, // venta futura — es reposición, va al final
};

/** Lo que la lista necesita de una orden, además de lo que `motivosDeAtencion` mira. */
export interface OrdenAtencion extends OrdenParaAtencion {
  numero_orden: string;
  cliente_nombre: string | null;
  /** ISO. Desempata por antigüedad dentro de un mismo nivel. */
  createdAt: string;
}

/** Lo que la lista necesita de un producto (lo que `isLowStock` mira + para mostrar). */
export interface ProductoAtencion {
  nombre: string;
  stock: number;
  stock_minimo?: number | null;
  activo?: boolean;
}

const tituloOrden = (o: OrdenAtencion): string =>
  o.cliente_nombre ? `${o.cliente_nombre} · ${o.numero_orden}` : o.numero_orden;

/**
 * La lista unificada, ORDENADA por prioridad (y antigüedad/unidades dentro del
 * nivel). El llamador decide cuántas mostrar y el "y N más"; acá se produce la
 * lista completa y en orden.
 */
export function itemsDeAtencion(ordenes: OrdenAtencion[], productos: ProductoAtencion[]): ItemAtencion[] {
  const items: ItemAtencion[] = [];

  for (const orden of ordenes) {
    const motivos = motivosDeAtencion(orden);
    if (motivos.length === 0) continue;
    // Motivos en orden de prioridad → el subtítulo lidera con el más urgente.
    const ordenados = [...motivos].sort((a, b) => PRIORIDAD_ATENCION[a.tipo] - PRIORIDAD_ATENCION[b.tipo]);
    items.push({
      seccion:   'pedidos',
      titulo:    tituloOrden(orden),
      subtitulo: ordenados.map(textoDeMotivo).join(' · '),
      href:      `/admin/pedidos?pedido=${encodeURIComponent(orden.numero_orden)}`,
      prioridad: PRIORIDAD_ATENCION[ordenados[0].tipo], // el más urgente
      desempate: new Date(orden.createdAt).getTime(),   // más viejo primero
    });
  }

  for (const p of productos) {
    if (!isLowStock(p)) continue;
    items.push({
      seccion:   'productos',
      titulo:    p.nombre,
      subtitulo: p.stock === 0 ? 'Agotado · sin unidades' : `Quedan ${p.stock} · bajo el mínimo`,
      href:      RUTA_REPONER,
      prioridad: PRIORIDAD_ATENCION.stock,
      desempate: p.stock, // 0 primero
    });
  }

  return items.sort((a, b) => a.prioridad - b.prioridad || a.desempate - b.desempate);
}
