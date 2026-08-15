import { necesitaAtencion, type OrdenParaAtencion } from '@/lib/pedidos/atencion';

// ─── ¿ESTE CLIENTE TIENE PEDIDOS QUE PIDEN ACCIÓN? ───────────────────────────
//
// El sol en la fila de un cliente NO significa "este cliente necesita atención":
// significa "este cliente tiene PEDIDOS que necesitan atención". La distinción no
// es de redacción — es lo que hace que el punto lleve a algún lado. Un cliente no
// tiene estado accionable propio en este dominio (no hay deuda por cliente ni
// criterio de inactividad consultable); sus pedidos sí.
//
// ── SE REUSA `necesitaAtencion`, JAMÁS SE REIMPLEMENTA ───────────────────────
//
// Es la MISMA función que filtra el pill de Pedidos y que enciende el punto sol
// del nav. Tres consumidores, una definición. Si esta capa tuviera su propia idea
// de qué pide atención, el operador vería un sol en la fila del cliente, entraría
// a sus pedidos y no encontraría ninguno marcado — un aviso que no se puede
// resolver es peor que ninguno. Es el modo de falla que este repo ya pagó con
// `razonDelServidor` y `cruzoMinimo` duplicados.
//
// Por lo mismo NO se traduce a SQL. Sería más barato un `COUNT` con los cuatro
// predicados en el `where`, y ahí es exactamente donde las dos cuentas empiezan a
// divergir en silencio: dos números plausibles calculados con criterios distintos.
// Mismo argumento —y misma decisión— que `/api/atencion`.

export interface OrdenParaAtencionCliente extends OrdenParaAtencion {
  /** La FK, no el snapshot. Ver abajo por qué. */
  cliente_id?: string | null;
  numero_orden?: string;
}

/**
 * Cuántos pedidos pide atención cada cliente, por `cliente_id`.
 *
 * Un cliente sin entrada en el mapa no tiene ninguno — se devuelve el mapa
 * disperso y no una entrada en cero por cliente, porque esta función no conoce la
 * lista de clientes: sólo ve órdenes.
 *
 * ── SE AGRUPA POR LA FK, Y LAS ÓRDENES SIN FK SE CAEN ────────────────────────
 *
 * `cliente_id` es exacto: lo escribe `createOrderWithCustomer` en el mismo upsert
 * que resuelve la identidad. Los snapshots (`cliente_email`, `cliente_telefono`)
 * dicen quién compró ENTONCES y son deliberadamente no-redundantes con la
 * relación; agrupar por ellos metería en la cuenta de un cliente los pedidos de
 * otro que comparte teléfono — que en este dominio es un caso legal y decidido
 * (`Customer.telefono` NO es único a propósito).
 *
 * Una orden con `cliente_id` null no se cuenta para nadie. Es honesto: no consta
 * de quién es. El perfil del cliente sí las rescata por snapshot, pero eso es una
 * lectura de historial, no un aviso accionable atribuido a una persona.
 */
export function pedidosPorAtenderPorCliente(
  ordenes: readonly OrdenParaAtencionCliente[],
): Map<string, number> {
  const porCliente = new Map<string, number>();
  for (const orden of ordenes) {
    if (!orden.cliente_id) continue;
    if (!necesitaAtencion(orden)) continue;
    porCliente.set(orden.cliente_id, (porCliente.get(orden.cliente_id) ?? 0) + 1);
  }
  return porCliente;
}
