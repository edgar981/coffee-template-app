import prisma from '@duna/core';
import type { HoraRow } from './hoy';

// LAS DOS CONSULTAS de la pantalla "Hoy". Aparte de las reglas puras (hoy.ts)
// porque importan prisma; extraídas del route handler para poder afirmar sus
// DECISIONES contra una base real —el carril—. Un test con mocks pasaría en verde
// aunque el `where` contara canceladas donde no debe, porque el defecto estaría en
// QUÉ FILAS entran, no en cómo se suman.
//
// Los dos ejes NO usan el mismo filtro, y es a propósito (§ la frase partida):
//   · CONTEO (la curva)  → EXCLUYE canceladas — misma base que la tarjeta
//     "Pedidos de hoy", para que la suma de la curva = ese conteo.
//   · DINERO  (top-hoy)  → INCLUYE canceladas — cancelar no toca el pago, la plata
//     entró (§ REVENUE_ORDER_SCOPE).
// Los dos van por `createdAt` de hoy (no por fecha de pago), para casar entre sí.

const ORDER_PREFIX = 'CN-%';

/** Filtro de ventana común: órdenes reales creadas en `[desde, hasta)`. */
interface Ventana {
  desde: Date;
  hasta: Date;
  /** IANA tz para el reloj de pared (America/Bogota). */
  tz:    string;
}

/**
 * Pedidos CREADOS hoy agrupados por HORA (0–23, reloj de Bogotá). EXCLUYE
 * canceladas y SN-. El doble `AT TIME ZONE` convierte el instante UTC guardado en
 * `timestamp without time zone` al reloj local antes de extraer la hora.
 *
 * Devuelve filas dispersas (sólo las horas con pedidos); el relleno a 24 buckets es
 * la regla pura `bucketsPorHora`.
 */
export function pedidosPorHoraDeHoy({ desde, hasta, tz }: Ventana): Promise<HoraRow[]> {
  return prisma.$queryRaw<HoraRow[]>`
    SELECT EXTRACT(HOUR FROM (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}))::int AS hora,
           COUNT(*)::int AS n
    FROM "Order" o
    WHERE o."createdAt" >= ${desde}
      AND o."createdAt" <  ${hasta}
      AND o."numero_orden" LIKE ${ORDER_PREFIX}
      AND o."estado" <> 'cancelado'
    GROUP BY 1
  `;
}

export interface TopHoyRow {
  nombre: string;
  total:  number;
}

/**
 * Lo que más se vendió hoy: `SUM(OrderItem.subtotal)` por producto, de las órdenes
 * CREADAS hoy. INCLUYE canceladas. Agrupa por `producto_nombre` (el snapshot de la
 * línea: lo que se vendió, exista o no el producto hoy). Ya ordenado desc y topado.
 */
export function topHoyVendido({ desde, hasta, tz, limite }: Ventana & { limite: number }): Promise<TopHoyRow[]> {
  // `tz` no se usa en el filtro —la ventana ya viene anclada a Bogotá por el
  // llamador—, pero se recibe para que las dos consultas compartan la misma firma
  // de ventana y no puedan divergir en qué día miran.
  void tz;
  return prisma.$queryRaw<TopHoyRow[]>`
    SELECT oi."producto_nombre" AS nombre,
           SUM(oi."subtotal")::float8 AS total
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orden_id"
    WHERE o."createdAt" >= ${desde}
      AND o."createdAt" <  ${hasta}
      AND o."numero_orden" LIKE ${ORDER_PREFIX}
    GROUP BY 1
    ORDER BY total DESC
    LIMIT ${limite}
  `;
}
