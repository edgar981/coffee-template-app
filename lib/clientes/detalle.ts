import prisma from '@duna/core';

// ─── QUÉ PEDIDOS SON DE UN CLIENTE ───────────────────────────────────────────
//
// La respuesta es UNA: los que apuntan a su `cliente_id`. Vive acá y no dentro
// del route handler por el criterio de siempre —el carril no monta HTTP, así que
// la única forma de afirmar esto contra una base real es que sea una función—, y
// porque el defecto que corrige no se ve leyendo el objeto que se construye: se
// ve releyendo qué filas vuelven.
//
// ── EL DEFECTO: EL SNAPSHOT ASUMÍA UN INVARIANTE QUE EL MODELO NIEGA ─────────
//
// `GET /api/customers/[id]` resolvía el conjunto con un `OR` de tres ramas —la FK
// más los SNAPSHOTS `cliente_email` y `cliente_telefono`— declarando que servía
// "for any legacy order that was never linked". Dos cosas lo desmintieron:
//
//   1. Medido en `development` el día del retiro: **cero** órdenes con
//      `cliente_id: null`. La rama de rescate no tenía un solo caso vivo.
//   2. `Customer.telefono` **no es único, y no lo es a propósito** (§ Matching de
//      clientes: un teléfono puede ser compartido por varias personas, y
//      `rankPhoneMatches` existe justamente porque el match por teléfono puede
//      devolver varios). Un `OR` por ese snapshot asume lo contrario.
//
// Así que su único efecto vivo era CRUZAR clientes. Medido: 2 de 13 clientes de
// `development` recibían pedidos y plata de otro por compartir número —QA Test se
// llevaba $28.000 de una orden ajena, QA Bell $20.000—, y el panel se contradecía
// solo: su cifra "Pedidos" cuenta por FK y su historial listaba de más, así que
// decía "1 pedido" con dos filas debajo.
//
// Dos números del mismo hecho que no cuadran no enseñan a desconfiar del que está
// mal: enseñan a desconfiar de los dos.
//
// ── LA MISMA DEFINICIÓN QUE EL RESTO ────────────────────────────────────────
//
// Los agregados por cliente de la lista (`nonCancelledOrderCountByCustomer`,
// `paidTotalByCustomer`, `lastOrderDateByCustomer`) SIEMPRE agruparon por
// `cliente_id`. Esto no cambia una definición: alinea la que se había ido sola.

/** Lo que el detalle necesita de cada pedido, y nada más. */
const CAMPOS_DEL_HISTORIAL = {
  id:             true,
  numero_orden:   true,
  estado:         true,
  // Viaja porque el historial pinta cada pedido con `badgeCobro`, y sin él "Por
  // cobrar" —contraentrega despachada sin cobrar— sería indistinguible de una
  // pendiente cualquiera. Es el MISMO badge que usa la lista de Pedidos; darle
  // otro acá sería una segunda opinión sobre el mismo hecho.
  condicion_pago: true,
  total:          true,
  createdAt:      true,
  shipping:       { select: { estado: true } },
} as const;

/**
 * El historial de pedidos de un cliente, del más reciente al más viejo.
 *
 * Sin recorte por estado: una orden cancelada ES parte de su historia y el badge
 * ya la marca. Lo que sí excluye el CONTEO de la lista son las canceladas, y esa
 * asimetría es correcta —"cuántos pedidos tiene" y "qué le pasó a este cliente"
 * son dos preguntas—; lo que no puede pasar es que el conjunto sea otro.
 */
export function pedidosDelCliente(clienteId: string) {
  return prisma.order.findMany({
    where:   { cliente_id: clienteId },
    select:  CAMPOS_DEL_HISTORIAL,
    orderBy: { createdAt: 'desc' },
  });
}
