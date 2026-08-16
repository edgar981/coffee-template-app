import prisma from '@duna/core';
import { cruzoMinimo, KARDEX_TOPE } from '@duna/core/metrics/inventory-filters';
import { BUSINESS_TZ, startOfZonedDay } from '@duna/core/timezone';
import type { InventoryLog, Prisma, Product } from '@duna/core';

// EL ajuste manual de inventario. Vivía inline en `/api/inventory/adjust`; se
// extrajo acá SIN CAMBIAR NADA para poder testear su concurrencia, que es donde
// está el defecto del item 1 del backlog y que un route handler no deja
// ejercitar (el carril de integración cubre cadenas, no handlers HTTP — ver
// CLAUDE.md § Las tres capas).
//
// El route handler queda con lo suyo: sesión, parseo y códigos de estado.

/** Salida que excede el stock disponible → el llamador responde 409. */
export class InsufficientStockError extends Error {
  constructor() {
    super('Stock insuficiente para esta salida');
    this.name = 'InsufficientStockError';
  }
}

/** El producto no existe → el llamador responde 404. */
export class ProductoNoEncontradoError extends Error {
  constructor() {
    super('Producto no encontrado');
    this.name = 'ProductoNoEncontradoError';
  }
}

/** Cantidad no numérica o negativa → el llamador responde 400. */
export class CantidadInvalidaError extends Error {
  constructor() {
    super('Cantidad inválida');
    this.name = 'CantidadInvalidaError';
  }
}

export interface AjusteInventarioInput {
  producto_id: string;
  /** `salida` decrementa, `entrada`/`devolucion` incrementan, `ajuste` FIJA. */
  tipo:        string;
  cantidad:    unknown;
  motivo?:     string | null;
}

/**
 * Quién ejecuta el movimiento — SNAPSHOT, no una relación. El llamador lo saca de
 * la sesión (`{ id: session.user.id, nombre: session.user.name ?? null }`), misma
 * convención que Payment y las transiciones de orden. Opcional: un asiento sin
 * humano (un efecto del sistema) lo deja en null, que es honesto.
 */
export interface ActorRef {
  id:     string;
  nombre: string | null;
}

export interface AjusteInventarioResult {
  product: Product;
  log:     InventoryLog;
  /** El movimiento hizo que el producto CRUZARA su mínimo — el llamador emite el
   *  evento post-commit. Se devuelve en vez de emitirse acá para no meter el
   *  motor de automatizaciones dentro de la transacción. */
  cruzoElMinimo: boolean;
}

/**
 * Aplica el movimiento y escribe el asiento de kardex en UNA transacción: o
 * cuajan los dos o ninguno.
 *
 * EL `SELECT … FOR UPDATE` NO ES OPCIONAL. Postgres corre en READ COMMITTED, así
 * que dos transacciones concurrentes pueden LEER el mismo stock antes de que
 * cualquiera escriba: sin el lock, las dos registran el mismo `stock_anterior` y
 * el kardex reporta dos movimientos donde hubo uno. Con tipos delta
 * (`entrada`/`devolucion`/`salida`) además se aplican los dos, y el asiento de la
 * segunda miente sobre cuánto había de verdad.
 *
 * El lock serializa a los concurrentes SOBRE ESA FILA: el segundo espera, lee el
 * valor que el primero ya escribió, y su asiento encadena. Mismo patrón que el
 * POST de pagos. Testeado en tests/integracion/ajuste-concurrente.test.ts, que
 * se escribió antes de este fix y se vio fallar.
 */
export async function aplicarAjusteInventario(
  input: AjusteInventarioInput,
  actor?: ActorRef,
): Promise<AjusteInventarioResult> {
  const qty = Number(input.cantidad);
  if (!Number.isFinite(qty) || qty < 0) throw new CantidadInvalidaError();

  const { anterior, updated, log } = await prisma.$transaction(async (tx) => {
    // Estado ANTERIOR real, ya serializado contra cualquier otro ajuste sobre
    // este mismo producto. Todo lo que el asiento afirma sale de acá.
    const [product] = await tx.$queryRaw<
      { nombre: string; stock: number; stock_minimo: number; activo: boolean }[]
    >`SELECT "nombre", "stock", "stock_minimo", "activo"
        FROM "Product" WHERE "id" = ${input.producto_id} FOR UPDATE`;
    if (!product) throw new ProductoNoEncontradoError();

    if (input.tipo === 'salida') {
      // `where stock >= qty` impide sobrevender aunque dos salidas se crucen: si
      // el stock ya no alcanza, no toca ninguna fila y se rechaza.
      const res = await tx.product.updateMany({
        where: { id: input.producto_id, stock: { gte: qty } },
        data:  { stock: { decrement: qty }, updatedAt: new Date() },
      });
      if (res.count === 0) throw new InsufficientStockError();
    } else if (input.tipo === 'entrada' || input.tipo === 'devolucion') {
      await tx.product.update({
        where: { id: input.producto_id },
        data:  { stock: { increment: qty }, updatedAt: new Date() },
      });
    } else {
      // 'ajuste' — fija el valor directo.
      await tx.product.update({
        where: { id: input.producto_id },
        data:  { stock: qty, updatedAt: new Date() },
      });
    }

    // Valor post-operación REAL, releído de la base y no recalculado en JS.
    const post = await tx.product.findUniqueOrThrow({ where: { id: input.producto_id } });
    const asiento = await tx.inventoryLog.create({
      data: {
        producto_id:     input.producto_id,
        producto_nombre: product.nombre,
        tipo:            input.tipo,
        cantidad:        qty,
        stock_anterior:  product.stock,   // de la fila LOCKEADA, no de un snapshot
        stock_nuevo:     post.stock,
        motivo:          input.motivo || null,
        // El actor de ESTA puerta (Ajustar Stock). La otra —la edición de ficha—
        // lo captura en `product-update.ts`; las dos tienen que hacerlo o la
        // auditoría miente a medias (lo peor, porque parece completa).
        ajustado_por:        actor?.id ?? null,
        ajustado_por_nombre: actor?.nombre ?? null,
      },
    });
    return { anterior: product, updated: post, log: asiento };
  });

  return {
    product: updated,
    log,
    // El cruce se evalúa con los DOS valores de la misma transacción, así que dos
    // movimientos concurrentes ya no pueden creerse ambos "el que cruzó" y hacer
    // que la campana avise dos veces del mismo hecho.
    cruzoElMinimo: cruzoMinimo(anterior.stock, updated.stock, {
      stock_minimo: anterior.stock_minimo,
      activo:       anterior.activo,
    }),
  };
}

// ─── LA LECTURA DEL KARDEX ───────────────────────────────────────────────────
//
// Vive acá, junto a quien lo ESCRIBE, y no dentro del route handler, por el
// criterio de siempre en este repo: el carril de integración no monta HTTP, así
// que la única forma de afirmar contra una base real qué filas devuelve una
// consulta es que sea una función.
//
// ── LOS FILTROS DE LA AUDITORÍA · POR QUÉ VIVEN EN EL SERVIDOR ───────────────
//
// `productoId` es la mitad de servidor de la frontera Productos↔Inventario:
// Productos muestra el kardex de UN producto (su detalle lo pide con este filtro);
// Inventario se queda con el COMPLETO, que es la vista de auditoría.
//
// `tipo` y el rango de fechas (`desde`/`hasta`) son lo que hace USABLE esa
// auditoría: sin ellos, a los tres meses es una lista infinita donde no se
// encuentra nada. Y van EN EL SERVIDOR, no filtrando en el cliente como hace
// Pedidos, por una razón que no es de gusto: el kardex tiene TOPE (`KARDEX_TOPE`),
// mientras Pedidos carga todo. Un filtro sobre la ventana de 200 filas cargadas
// respondería "no hubo salidas en marzo" cuando marzo está más allá de la fila
// 200 — una auditoría que miente por omisión, el peor modo de falla de una
// auditoría. Server-side, el `where` filtra sobre TODA la historia y el tope se
// aplica al resultado ya filtrado, que es verdad.
//
// Es ADITIVO: sin ningún filtro la consulta es exactamente la que había —mismo
// orden, mismo tope—, así que ningún llamador de siempre cambia una fila.

// `KARDEX_TOPE` vive en `metrics/inventory-filters` (módulo puro) para que la
// pantalla lo lea sin arrastrar Prisma al cliente. Se re-exporta acá porque es
// donde el lector lo espera, junto a `logsDeInventario` que lo usa de `take`.
export { KARDEX_TOPE };

export interface KardexQuery {
  /**
   * Sin `productoId` se devuelve el kardex de TODOS los productos. La ausencia es
   * una respuesta —"todos"— y no un filtro vacío.
   */
  productoId?: string;
  /** Tipo de movimiento (`entrada`/`salida`/`ajuste`/`venta`/`devolucion`). Un
   *  valor desconocido no rompe: matchea cero filas, que es correcto. */
  tipo?: string;
  /** Rango por FECHA del asiento, en day keys de Bogotá (`YYYY-MM-DD`), inclusivo
   *  por los dos extremos — mismo contrato que el rango de Pedidos. */
  desde?: string;
  hasta?: string;
  take?: number;
}

/**
 * Un day key de Bogotá (`YYYY-MM-DD`) → el instante UTC de su inicio (`delta 0`) o
 * del inicio del día SIGUIENTE (`delta 1`, el fin exclusivo). El mediodía UTC cae
 * dentro del día de Bogotá para cualquier fecha, así que `startOfZonedDay` resuelve
 * el día correcto sin arrastrar la zona del proceso. `createdAt` guarda instantes
 * UTC, así que el rango se compara contra instantes, no contra texto.
 */
function limiteUtc(dayKey: string, deltaDias: 0 | 1): Date {
  return startOfZonedDay(new Date(`${dayKey}T12:00:00Z`), BUSINESS_TZ, deltaDias);
}

/** Un asiento del kardex con el número de orden ya RESUELTO: `null` si el
 *  movimiento no viene de una orden (ajuste/edición manual) o si la orden ya no
 *  existe. La celda "Motivo" de la auditoría enlaza cuando esto no es null. */
export type KardexRow = InventoryLog & { orden_numero: string | null };

/**
 * Los movimientos de inventario, del más reciente al más viejo, con el número de
 * su orden RESUELTO para el enlace.
 *
 * DESEMPATE `[createdAt desc, id desc]`: `createdAt` es `timestamp(3)`
 * (milisegundos), así que dos asientos escritos dentro del mismo ms empataban y
 * podían salir en cualquier orden entre sí. El `id` los desempata de forma
 * ESTABLE, y además ~cronológica: `cuid()` lleva un prefijo de tiempo, igual que
 * el `[occurred_at, id]` del libro de transiciones.
 *
 * DEPENDE de que el generador de id sea MONÓTONO. Hoy lo es (`@default(cuid())`);
 * el día que el schema pase a `uuid()` —aleatorio— este desempate deja de ordenar
 * y sólo estabiliza, EN SILENCIO. Es la misma nota que el libro de transiciones.
 * El lock `FOR UPDATE` sigue serializando las ESCRITURAS —el kardex nunca queda
 * mal encadenado—; esto sólo le da un orden determinista a la LECTURA.
 *
 * LA RESOLUCIÓN DEL NÚMERO va en UN batch (`IN` sobre los `orden_id` presentes),
 * no con una FK: mismo criterio de snapshot que el actor. `?pedido=` de Pedidos
 * matchea por `numero_orden`, no por id, así que el enlace necesita el número. Una
 * orden borrada simplemente no aparece en el `IN` → `orden_numero` null → la celda
 * va en texto plano, sin un enlace muerto — gratis, por resolver en la lectura.
 */
export async function logsDeInventario(
  { productoId, tipo, desde, hasta, take = KARDEX_TOPE }: KardexQuery = {},
): Promise<KardexRow[]> {
  const where: Prisma.InventoryLogWhereInput = {};
  if (productoId) where.producto_id = productoId;
  if (tipo)       where.tipo        = tipo;
  // El rango va como `[gte inicio, lt inicio-del-día-siguiente)`: el `lt` sobre el
  // arranque del día que sigue a `hasta` incluye TODO ese día sin depender de la
  // resolución del reloj (un `lte 23:59:59.999` se escapa de un asiento a las
  // 23:59:59.9995). Cada extremo es independiente, como en el rango de Pedidos.
  if (desde || hasta) {
    where.createdAt = {
      ...(desde ? { gte: limiteUtc(desde, 0) } : {}),
      ...(hasta ? { lt:  limiteUtc(hasta, 1) } : {}),
    };
  }
  const rows = await prisma.inventoryLog.findMany({
    where:   Object.keys(where).length ? where : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });

  const ordenIds = [...new Set(rows.map(r => r.orden_id).filter((x): x is string => !!x))];
  const numeroPorId = new Map<string, string>();
  if (ordenIds.length) {
    const ordenes = await prisma.order.findMany({
      where:  { id: { in: ordenIds } },
      select: { id: true, numero_orden: true },
    });
    for (const o of ordenes) numeroPorId.set(o.id, o.numero_orden);
  }
  return rows.map(r => ({
    ...r,
    orden_numero: r.orden_id ? (numeroPorId.get(r.orden_id) ?? null) : null,
  }));
}
