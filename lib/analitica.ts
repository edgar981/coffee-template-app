import prisma from '@/lib/prisma';
import { BUSINESS_TZ, startOfZonedMonth, startOfZonedYear, zonedDayKey } from '@/lib/timezone';
import { nonCancelledOrderCountByCustomer } from '@/lib/metrics/customer-order-stats';
import { agregarMargenPorSku, type CostoProducto, type LineaVendida } from '@/lib/metrics/margen';
import { agruparCartera, type OrdenPendiente } from '@/lib/metrics/cartera';
import { concentracionIngresos, type ClienteIngreso } from '@/lib/metrics/concentracion';
import { PERIODOS, ULTIMOS_MESES_VENTANA, type PeriodoKey } from '@/lib/metrics/periodo';
import type { AnalyticsData, PuntoTrayectoria } from '@/types/analytics';

// EL CÓMPUTO de la página de Analítica. Vive acá y no en el route handler por el
// mismo criterio que `lib/inventory.ts` y `lib/product-update.ts`: **se extrae lo
// que tiene la decisión para poder afirmarlo en un test**.
//
// Acá la decisión son las CONSULTAS. Cinco `$queryRaw` con `LATERAL`, `EXISTS` y
// doble `AT TIME ZONE` que ni `tsc` ni la suite pura pueden verificar — un
// `to_char` con la zona equivocada compila igual y devuelve números creíbles pero
// falsos, que es la peor clase de fallo para una página de analítica. La única
// forma de afirmarlo es contra una base real, y para eso tiene que ser una
// función. Ver `tests/integracion/analitica.test.ts`.
//
// Las definiciones compartidas se IMPORTAN, no se re-declaran: ingreso = libro de
// PAGOS sobre órdenes `CN-` no canceladas (el scope del dashboard), y el bucketing
// por mes/día va EN SQL anclado a America/Bogota.

// Prefijo de las órdenes reales. Las `SN-` son data de demo heredada.
// ÚNICA EXCEPCIÓN en este archivo: la CARTERA no lo aplica — ver su query.
const ORDER_PREFIX = 'CN-%';

// Ventana de la serie de trayectoria: 11 meses cerrados + el mes en curso. Los 11
// no son arbitrarios — la regla semestral de `insights.ts` compara el último mes
// cerrado contra el promedio de los 6 anteriores, así que con menos puntos nunca
// podría dispararse, y el bloque pide "6-12 meses".
export const SERIE_MESES = 12;

type SkuRow      = { producto_id: string | null; producto_nombre: string; unidades: number; ingresos: number };
type SkuMesRow   = SkuRow & { month: string };
type MesRow      = { month: string; total: number };
type MesCountRow = { month: string; n: number };
type CarteraRow  = { dia: string; total: number };
type ClienteRow  = { id: string; nombre: string | null; total: number };
type CanalRow    = { canal: string | null; n: number };

const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/** `2026-08` → `ago 26`. Etiqueta corta del eje X de la trayectoria. */
function etiquetaMes(month: string): string {
  const [anio, mes] = month.split('-');
  return `${MESES_CORTOS[Number(mes) - 1]} ${anio.slice(2)}`;
}

/**
 * Rango del período seleccionado. Se mide por la fecha del PAGO, no por la de
 * creación de la orden.
 *
 * `ultimos_3_meses` es una ventana MÓVIL que incluye el mes en curso, no el
 * trimestre calendario: la pregunta del dueño es "cómo me ha ido últimamente", y
 * un trimestre calendario responde otra cosa —el 1 de abril mostraría
 * enero-marzo y ocultaría todo lo reciente—. Decisión del owner, 2026-08-05.
 *
 * `now` es parámetro para que el carril pueda fijar el reloj: un test que
 * dependiera de la hora del día no es un test (mismo criterio que `soloActiva` en
 * los tests de automatizaciones).
 */
export function rangoDelPeriodo(periodo: PeriodoKey, now: Date): { desde: Date; hasta: Date } {
  // Todos los períodos terminan al inicio del mes SIGUIENTE (exclusivo), así que
  // el mes en curso entra completo hasta hoy. El único que no arranca en un mes
  // es `anio`.
  const finDeMesActual = startOfZonedMonth(now, BUSINESS_TZ, 1);
  switch (periodo) {
    case 'mes_anterior':
      return { desde: startOfZonedMonth(now, BUSINESS_TZ, -1), hasta: startOfZonedMonth(now, BUSINESS_TZ, 0) };
    case 'ultimos_3_meses':
      return { desde: startOfZonedMonth(now, BUSINESS_TZ, -(ULTIMOS_MESES_VENTANA - 1)), hasta: finDeMesActual };
    case 'anio':
      return { desde: startOfZonedYear(now, BUSINESS_TZ, 0), hasta: finDeMesActual };
    default:
      return { desde: startOfZonedMonth(now, BUSINESS_TZ, 0), hasta: finDeMesActual };
  }
}

export async function calcularAnalitica(periodoKey: PeriodoKey, now: Date = new Date()): Promise<AnalyticsData> {
  const { desde: periodoDesde, hasta: periodoHasta } = rangoDelPeriodo(periodoKey, now);

  const nextMonthStart  = startOfZonedMonth(now, BUSINESS_TZ, 1);
  const serieStart      = startOfZonedMonth(now, BUSINESS_TZ, -(SERIE_MESES - 1));
  const hoy             = zonedDayKey(now, BUSINESS_TZ);
  const currentMonthKey = hoy.slice(0, 7);

  const [
    skuRows,
    catalogo,
    carteraRows,
    serieIngresosRows,
    serieSkuRows,
    serieOrdenesRows,
    clienteRows,
    ordenesPorCliente,
    totalClientes,
    canalRows,
  ] = await Promise.all([
    // ── 1. RENTABILIDAD: líneas vendidas del período ────────────────────────
    // Sobre órdenes PAGADAS, y el período se mide por la fecha del PAGO, no por
    // la de creación de la orden — misma base que el libro de pagos del
    // dashboard. Consecuencia que la página declara: una orden creada en julio y
    // cobrada en agosto aporta margen a AGOSTO.
    //
    // `EXISTS` y no un JOIN a Payment: hoy no hay pagos parciales (un pago cubre
    // el total y transiciona la orden), pero un JOIN duplicaría los subtotales el
    // día que existan. La forma correcta no cuesta más.
    prisma.$queryRaw<SkuRow[]>`
      SELECT oi."producto_id"              AS producto_id,
             oi."producto_nombre"          AS producto_nombre,
             SUM(oi."cantidad")::int       AS unidades,
             SUM(oi."subtotal")::float8    AS ingresos
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orden_id"
      WHERE o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" = 'pagado'
        AND EXISTS (
          SELECT 1 FROM "Payment" p
          WHERE p."orden_id" = o."id"
            AND p."fecha" >= ${periodoDesde}
            AND p."fecha" <  ${periodoHasta}
        )
      GROUP BY 1, 2
    `,
    // Costo ACTUAL del catálogo — el único disponible: `OrderItem` no snapshotea
    // costo (ver lib/metrics/margen.ts). Sin filtro `activo`: un producto
    // desactivado que vendió en el período tiene que poder costearse, o su venta
    // caería al residual por una razón que no tiene nada que ver con el dato.
    prisma.product.findMany({ select: { id: true, nombre: true, costo: true } }),

    // ── 2. CARTERA: órdenes pendientes ──────────────────────────────────────
    // SIN filtro de `SN-` — decisión deliberada, la única de este archivo. La
    // cartera es una LISTA DE TRABAJO y su contrato es card=lista: cada bucket
    // linkea a /admin/ordenes, que tampoco filtra `SN-`. El resto de la página es
    // medición y sí excluye. Ver el encabezado de lib/metrics/cartera.ts.
    //
    // Sin ventana temporal: es un saldo VIGENTE, igual que "Por cobrar" del
    // dashboard. El bucketing del día va en SQL y en Bogotá; el reparto en
    // buckets lo hace el predicado puro.
    prisma.$queryRaw<CarteraRow[]>`
      SELECT to_char(o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM-DD') AS dia,
             o."total"::float8 AS total
      FROM "Order" o
      WHERE o."estado" = 'pendiente'
    `,

    // ── 3. TRAYECTORIA: ingresos por mes (libro de pagos) ───────────────────
    // Doble `AT TIME ZONE` porque las columnas son `timestamp without time zone`
    // con instantes UTC: hay que etiquetar y luego convertir. Mismo patrón que el
    // dashboard y que /api/analytics/weekly.
    prisma.$queryRaw<MesRow[]>`
      SELECT to_char(pay."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM') AS month,
             SUM(pay."monto")::float8 AS total
      FROM "Payment" pay
      JOIN "Order" o ON o."id" = pay."orden_id"
      WHERE pay."fecha" >= ${serieStart}
        AND pay."fecha" <  ${nextMonthStart}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1
    `,
    // Margen por mes: las mismas líneas del bloque 1, ahora por mes de pago. Se
    // devuelven SIN costear — el margen lo calcula el predicado puro compartido,
    // así que la línea del chart y la tabla de arriba no pueden discrepar.
    // `LATERAL MIN(fecha)` da UN mes por orden aunque hubiera varios pagos.
    prisma.$queryRaw<SkuMesRow[]>`
      SELECT to_char(pay."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM') AS month,
             oi."producto_id"           AS producto_id,
             oi."producto_nombre"       AS producto_nombre,
             SUM(oi."cantidad")::int    AS unidades,
             SUM(oi."subtotal")::float8 AS ingresos
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orden_id"
      JOIN LATERAL (
        SELECT MIN(p."fecha") AS fecha FROM "Payment" p WHERE p."orden_id" = o."id"
      ) pay ON TRUE
      WHERE o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" = 'pagado'
        AND pay."fecha" >= ${serieStart}
        AND pay."fecha" <  ${nextMonthStart}
      GROUP BY 1, 2, 3
    `,
    // Base de MUESTRA de los insights: órdenes cobradas en cada mes. Es el mismo
    // conjunto que produce el valor de la serie — una guarda calculada sobre otro
    // conjunto que el número que acompaña sería peor que no tener guarda.
    prisma.$queryRaw<MesCountRow[]>`
      SELECT to_char(pay."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM') AS month,
             COUNT(*)::int AS n
      FROM "Order" o
      JOIN LATERAL (
        SELECT MIN(p."fecha") AS fecha FROM "Payment" p WHERE p."orden_id" = o."id"
      ) pay ON TRUE
      WHERE o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" = 'pagado'
        AND pay."fecha" >= ${serieStart}
        AND pay."fecha" <  ${nextMonthStart}
      GROUP BY 1
    `,

    // ── 4. CLIENTES Y CANALES ───────────────────────────────────────────────
    // AMBOS respetan el chip de período. Estuvieron clavados en "año en curso"
    // durante el primer pase y era un defecto silencioso: el chip decía "Mes
    // pasado" y estas dos secciones seguían mostrando el año entero, sin que nada
    // en pantalla lo delatara.
    //
    // Dinero PAGADO por cliente (no `Customer.total_compras`, que es data de
    // demo), por fecha de PAGO — la misma base que la rentabilidad, así que "de
    // quién dependo" y "cuánto gané" hablan del mismo dinero.
    prisma.$queryRaw<ClienteRow[]>`
      SELECT c."id"                    AS id,
             c."nombre"                AS nombre,
             SUM(pay."monto")::float8  AS total
      FROM "Payment" pay
      JOIN "Order" o    ON o."id" = pay."orden_id"
      JOIN "Customer" c ON c."id" = o."cliente_id"
      WHERE pay."fecha" >= ${periodoDesde}
        AND pay."fecha" <  ${periodoHasta}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1, 2
    `,
    // Recurrencia con la definición COMPARTIDA de "N órdenes" (no canceladas), la
    // misma que la lista de Clientes y su Top 5 — no un conteo propio.
    nonCancelledOrderCountByCustomer(),
    prisma.customer.count(),
    // Distribución por canal. `canal` es el canal de VENTA (cómo llegó el
    // cliente), no el code path que creó la orden — para eso está `origen` en el
    // evento, y no se persiste (ver CLAUDE.md § Campana del operador).
    //
    // Filtra por `createdAt` y NO por fecha de pago, a diferencia de las otras
    // tres. No es un descuido: la pregunta es "por dónde llegaron las órdenes de
    // este período", y una orden llega cuando se crea. Medirla por su pago
    // atribuiría al canal el mes en que alguien pagó, que no dice nada sobre por
    // dónde entró. El subtítulo de la card dice "órdenes creadas" justamente para
    // que esa diferencia de base esté a la vista y no haya que deducirla.
    prisma.$queryRaw<CanalRow[]>`
      SELECT o."canal" AS canal, COUNT(*)::int AS n
      FROM "Order" o
      WHERE o."createdAt" >= ${periodoDesde}
        AND o."createdAt" <  ${periodoHasta}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1
    `,
  ]);

  // ── 1. Rentabilidad ─────────────────────────────────────────────────────────

  const costos: CostoProducto[] = catalogo.map(p => ({ id: p.id, nombre: p.nombre, costo: p.costo }));
  const aLinea = (r: SkuRow): LineaVendida => ({
    productoId:     r.producto_id,
    productoNombre: r.producto_nombre,
    unidades:       r.unidades,
    ingresos:       r.ingresos,
  });

  const rentabilidad = agregarMargenPorSku(skuRows.map(aLinea), costos);

  // ── 2. Cartera ──────────────────────────────────────────────────────────────

  const cartera = agruparCartera(
    carteraRows.map<OrdenPendiente>(r => ({ dia: r.dia, total: r.total })),
    hoy,
  );

  // ── 3. Trayectoria ──────────────────────────────────────────────────────────
  // Zero-fill sobre la ventana: un mes sin ventas es un 0 real, y omitirlo
  // juntaría los extremos convirtiendo un hueco en una racha falsa.

  const ingresosPorMes = new Map(serieIngresosRows.map(r => [r.month, r.total]));
  const ordenesPorMes  = new Map(serieOrdenesRows.map(r => [r.month, r.n]));

  const lineasPorMes = new Map<string, LineaVendida[]>();
  for (const r of serieSkuRows) {
    const previo = lineasPorMes.get(r.month);
    if (previo) previo.push(aLinea(r));
    else lineasPorMes.set(r.month, [aLinea(r)]);
  }

  const trayectoria: PuntoTrayectoria[] = Array.from({ length: SERIE_MESES }, (_, i) => {
    const d     = startOfZonedMonth(now, BUSINESS_TZ, -(SERIE_MESES - 1 - i));
    const month = zonedDayKey(d, BUSINESS_TZ).slice(0, 7);
    return {
      month,
      label:    etiquetaMes(month),
      // Ingresos = pagos recibidos (incluyen envío). Margen = mercancía menos
      // costo. Son bases distintas A PROPÓSITO y por eso el chart lo declara: el
      // envío es un costo trasladado, no utilidad.
      ingresos: ingresosPorMes.get(month) ?? 0,
      margen:   agregarMargenPorSku(lineasPorMes.get(month) ?? [], costos).margenTotal,
      ordenes:  ordenesPorMes.get(month) ?? 0,
      // El mes en curso está INCOMPLETO: se dibuja, pero los insights lo
      // descartan (`mesesCerrados`). Comparar 5 días contra meses de 30 anuncia
      // "a la baja" todos los días 1.
      cerrado:  month !== currentMonthKey,
    };
  });

  // ── 4. Clientes y canales ───────────────────────────────────────────────────

  const clientes: ClienteIngreso[] = clienteRows.map(r => ({
    id:      r.id,
    nombre:  r.nombre ?? 'Sin nombre',
    total:   r.total,
    ordenes: ordenesPorCliente.get(r.id) ?? 0,
  }));

  const recurrentes = [...ordenesPorCliente.values()].filter(n => n > 1).length;

  const totalCanal = canalRows.reduce((s, r) => s + r.n, 0);
  const canales = canalRows
    .map(r => {
      const name = r.canal ?? 'directo';
      return {
        name:  name.charAt(0).toUpperCase() + name.slice(1),
        value: r.n,
        // % sobre el total del año, no sobre el máximo: la suma da 100.
        pct:   totalCanal > 0 ? (r.n / totalCanal) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    hoy,
    periodo: { key: periodoKey, label: PERIODOS[periodoKey] },
    rentabilidad,
    cartera,
    trayectoria,
    concentracion: concentracionIngresos(clientes),
    recurrencia: {
      recurrentes,
      clientes: totalClientes,
      // Mismo corte que la Tasa Recurrencia de la página de Clientes: recurrentes
      // sobre TODOS los clientes. Una segunda fórmula para el mismo hecho es cómo
      // dos pantallas empiezan a contradecirse.
      pct: totalClientes > 0 ? Math.round((recurrentes / totalClientes) * 100) : 0,
    },
    canales,
  };
}
