import { BUSINESS_TZ, startOfZonedMonth, zonedDayKey } from '@duna/core/timezone';
import type { OrderStatus } from '@/types/order';

// THE shared definitions behind the dashboard's clickable order stats. Each stat
// is counted server-side in app/api/dashboard/stats/route.ts and re-expressed as
// an /admin/ordenes query string on the card. Both sides import from HERE, so
// the number on the card and the row count of the list it links to cannot
// diverge.
//
// PURE DATE/VALUE LOGIC ONLY — no Prisma, no `server-only`, no next/headers. The
// stats route handler imports it on the server; the dashboard StatCard imports
// it in a client component. A server-side import here breaks the client build.

/**
 * The estado "Órdenes Pendientes" counts. The stat is `pendiente` MINUS the
 * por-cobrar set (a dispatched-unpaid contraentrega isn't "requiere atención" —
 * the courier is already out collecting it). The card links with `cobrar=0`
 * (exclude por-cobrar), which the Órdenes page parses back to the same set.
 */
export const PENDING_ESTADO = 'pendiente' satisfies OrderStatus;

/**
 * `PENDING_ORDERS_QUERY` VIVIÓ ACÁ y se retiró con su widget.
 *
 * Expresaba "pendiente MENOS por-cobrar" para la pantalla vieja (`estado=…&cobrar=0`).
 * Su tarjeta cambió de PREGUNTA —de "¿cuántas sin pagar?" a "¿cuántas piden
 * acción?"— porque la primera es del eje de cobro, que en la pantalla nueva es una
 * propiedad de cada fila y no un carril por el que se entra. La nueva la responde
 * `necesitaAtencion`, la misma definición que el pill y el punto del nav, así que
 * ya no hace falta un query que reconstruya un recorte a mano.
 */

// ─── "Por cobrar" (cuentas por cobrar) ───────────────────────────────────────
// A CONTRAENTREGA order whose goods already left (dispatched or delivered) but
// whose money hasn't come in — the receivable the courier is out collecting.
// PURE (no Prisma): the Órdenes list filters with it client-side; the dashboard
// stats route counts with the same definition. Shared here so the card number
// and the filtered list can never diverge.

/**
 * Shipping estados that count as "dispatched": en_ruta (out) and entregado
 * (delivered, cash on its way back). `preparando` is NOT por cobrar yet (the
 * goods haven't left — it's still an ordinary pending order); `fallido` and
 * `cancelado` aren't receivables (the goods came back).
 */
export const POR_COBRAR_SHIPPING_ESTADOS = ['en_ruta', 'entregado'] as const;

/**
 * Query string (without `?`) that filters the Órdenes list to exactly the
 * por-cobrar set. The Órdenes page parses `cobrar=1` back to `isPorCobrar`, so
 * the dashboard "Por cobrar" card and this list show the same rows/total.
 */
export const POR_COBRAR_QUERY = 'cobrar=1';

/**
 * El MISMO conjunto, dicho en el vocabulario de `/admin/pedidos`, donde "por
 * cobrar" es un CARRIL y no un recorte por parámetro.
 *
 * Son dos constantes y no una porque hoy hay dos pantallas vivas con dos
 * vocabularios, y una sola tendría que mentirle a alguna. Las dos se derivan del
 * MISMO `isPorCobrar` de abajo, que es lo que impide que cuenten distinto. La de
 * arriba muere con `/admin/ordenes`.
 */
export const POR_COBRAR_QUERY_PEDIDOS = 'f=por_cobrar';

/**
 * "Por cobrar" = CONTRAENTREGA + pago pendiente + despacho en curso o entregado.
 * For ANTICIPADO orders this is empty by construction (they can't dispatch
 * unpaid — server-enforced).
 */
export function isPorCobrar(order: {
  estado: string;
  condicion_pago?: string | null;
  shipping?: { estado: string } | null;
}): boolean {
  return (
    order.estado === PENDING_ESTADO &&
    order.condicion_pago === 'CONTRAENTREGA' &&
    !!order.shipping &&
    (POR_COBRAR_SHIPPING_ESTADOS as readonly string[]).includes(order.shipping.estado)
  );
}

export interface CurrentMonthRange {
  /** UTC instant of local midnight on the 1st — the server query's `gte`. */
  start: Date;
  /** UTC instant of local midnight on the 1st of NEXT month — the `lt`. */
  end:   Date;
  /** `YYYY-MM-DD` of the 1st, America/Bogota — the `desde` query param. */
  desde: string;
  /** `YYYY-MM-DD` of today, America/Bogota — the `hasta` query param. */
  hasta: string;
}

/**
 * Current calendar month in progress, anchored to America/Bogota wall clock.
 *
 * `start`/`end` are absolute instants for DB range queries; `desde`/`hasta` are
 * the local day keys the Órdenes page filters on. `hasta` is TODAY rather than
 * the last day of the month — the month is in progress, and no order is dated in
 * the future, so both forms select the same rows.
 */
export function currentMonthRange(now: Date = new Date()): CurrentMonthRange {
  const start = startOfZonedMonth(now, BUSINESS_TZ, 0);
  const end   = startOfZonedMonth(now, BUSINESS_TZ, 1);
  return {
    start,
    end,
    desde: zonedDayKey(start, BUSINESS_TZ),
    hasta: zonedDayKey(now, BUSINESS_TZ),
  };
}

/**
 * THE definition of a countable order: everything except `cancelado`. A pending
 * order IS an order; a cancelled one is not (it's an auditable record, not a
 * sale). One definition, N consumers — the customer "N órdenes" count (list,
 * Top 5, profile), the recurrentes metric, and the "Órdenes del mes" stat all
 * read from here so a displayed count can never disagree with its label.
 *
 * Enumerated (positive) form because a URL/Prisma `in` can't express negation.
 * Exhaustive over OrderStatus by construction — if a fourth estado is ever added,
 * the `satisfies` still compiles but this list must be revisited.
 */
export const NON_CANCELLED_ESTADOS = ['pendiente', 'pagado'] satisfies OrderStatus[];

/**
 * EL PREFIJO DE UNA ORDEN REAL DEL TENANT. Las `SN-` son FIXTURES DE DEMO del seed
 * (`prisma/seed.ts`) y no cuentan en ningún lado: no es una definición de negocio,
 * es limpieza de datos de prueba (owner, 2026-08-21). Ningún camino de runtime las
 * produce — el único generador emite siempre `CN-` (`packages/core/src/orders.ts`).
 *
 * ── OJO: CONVIVE CON UNA FORMA MÁS PERMISIVA, Y NO SON LO MISMO ──────────────
 * `soloOrdenesReales` (`lib/pedidos/filtros.ts`) excluye por NEGACIÓN —"todo lo que
 * no empiece por SN-"— y por eso conserva una orden SIN número; esta constante
 * incluye por AFIRMACIÓN, así que una orden sin número o con un tercer prefijo
 * queda fuera. Para una LISTA la permisiva es la correcta (esconder una orden que
 * no dice cómo se llama es peor que mostrarla); para una SUMA de dinero la estricta
 * lo es (un total no puede incluir algo que no se sabe qué es).
 *
 * Se usa la estricta acá porque es la que ya aplican TODAS las consultas de
 * Analítica, y usar la otra le habría dado a la concentración un alcance distinto
 * del de sus tres consultas hermanas — una divergencia nueva dentro de una misma
 * pantalla, que es peor que la que este módulo viene a cerrar.
 */
export const TENANT_ORDER_PREFIX = 'CN-';

/** Predicate form of {@link NON_CANCELLED_ESTADOS} for filtering loaded orders. */
export const isCountableOrder = (estado: string): boolean => estado !== 'cancelado';

/** The Órdenes del mes stat counts the same set (everything except cancelado). */
export const MONTH_STAT_ESTADOS = NON_CANCELLED_ESTADOS;

/**
 * Query string (without `?`) reproducing the Órdenes del mes stat exactly.
 *
 * The estado list is what keeps the link honest: the stat filters
 * `estado != 'cancelado'`, which a date-only link cannot express, so it would
 * over-count by every order cancelled inside the current month.
 */
export function currentMonthOrdersQuery(now: Date = new Date()): string {
  const { desde, hasta } = currentMonthRange(now);
  // SIN `estado`. Enumerar `pendiente,pagado` era la única forma de decirle a la
  // pantalla vieja "todas menos las canceladas", porque su carril "Todos" no
  // filtraba nada y el enlace habría contado de más. En `/admin/pedidos` ese
  // carril YA excluye canceladas —la misma `isCountableOrder` que cuenta este
  // stat— así que el rango solo alcanza y el enlace se lee.
  return new URLSearchParams({ desde, hasta }).toString();
}
