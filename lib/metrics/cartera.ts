// Cartera y envejecimiento — las reglas puras detrás del bloque CARTERA de
// Analítica ("¿cuánta plata mía está en la calle?").
//
// CARTERA = órdenes PENDIENTES. No hay pagos parciales en este sistema:
// `registrarPago` snapshotea el monto del total server-side y transiciona la
// orden a `pagado` (lib/orders.ts), así que `estado = 'pendiente'` significa
// exactamente "sin un solo peso cobrado" y el saldo de la orden ES su `total`.
// Por eso no hay aritmética de saldos acá.
//
// LA CARTERA NO EXCLUYE `SN-` — y es una decisión, no un olvido. El resto de
// Analítica es MEDICIÓN y excluye la data de demo; la cartera es una LISTA DE
// TRABAJO, y su contrato es card=lista: cada bucket linkea a la página de
// Órdenes, que tampoco filtra `SN-`. Un conteo que no cuadre con la lista a la
// que lleva es peor que uno que incluye una orden de demo. La exclusión de `SN-`
// en Órdenes queda como la deuda que ya era (se arregla de los dos lados a la vez
// o de ninguno). En PRODUCCIÓN no hay `SN-` desde la purga del 2026-08-03, así
// que la incoherencia es solo de `development`.
//
// PURO: sin Prisma y sin `Date` propio — trabaja sobre day keys `YYYY-MM-DD` en
// America/Bogota, que es lo que el SQL entrega y lo que los filtros de la página
// de Órdenes comparan. Mismo criterio que order-stat-filters.

/**
 * Último día de antigüedad del bucket RECIENTE. Una orden de hasta 7 días es
 * cobro normal en curso, no cartera problemática.
 *
 * TODO(cliente): 7 es un placeholder — el corte real sale de la política de
 * cobro de la sesión con el cliente (mismo estatus que `MIN_ORDENES_INSIGHT`,
 * `HORAS_ENTREGA_SIN_COBRO` y los umbrales de `ZONA_CONFIG`).
 */
export const CARTERA_DIAS_RECIENTE = 7;

/**
 * Último día del bucket MEDIO. Por encima de esto la orden entra a "vencido".
 *
 * TODO(cliente): 15 es un placeholder — ver {@link CARTERA_DIAS_RECIENTE}.
 */
export const CARTERA_DIAS_MEDIO = 15;

export type BucketCartera = 'reciente' | 'medio' | 'vencido';

/** Orden pendiente, con su día de creación ya expresado en America/Bogota. */
export interface OrdenPendiente {
  /** Day key `YYYY-MM-DD` de `createdAt`, bucketeado en SQL. */
  dia:   string;
  total: number;
}

export interface BucketResumen {
  bucket: BucketCartera;
  /** Etiqueta que ve el operador. Deriva de las constantes, no se teclea. */
  label:  string;
  conteo: number;
  monto:  number;
  /**
   * Query string (sin `?`) que reproduce EXACTAMENTE este bucket en la página de
   * Órdenes. Ver {@link queryDelBucket}.
   */
  query:  string;
}

/**
 * Bucket por antigüedad en días. Los cortes son inclusivos por arriba:
 * 0–7 reciente, 8–15 medio, 16+ vencido.
 *
 * Una edad NEGATIVA (orden con fecha futura por un reloj desfasado) cuenta como
 * reciente: es lo mismo que hace `insightUltimoEvento` con un evento futuro, y
 * mandar una orden de hoy al bucket "vencido" sería peor que redondearla.
 */
export function bucketPorEdad(dias: number): BucketCartera {
  if (dias <= CARTERA_DIAS_RECIENTE) return 'reciente';
  if (dias <= CARTERA_DIAS_MEDIO)    return 'medio';
  return 'vencido';
}

/** Day key `YYYY-MM-DD` desplazado `dias` (aritmética de calendario, UTC-anclada). */
export function dayKeyMas(dia: string, dias: number): string {
  const ms = Date.parse(`${dia}T00:00:00Z`) + dias * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Días completos entre dos day keys. Igual que `diasEntre` de insights.ts. */
function edadEnDias(creada: string, hoy: string): number {
  const ms = Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${creada}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Query string (sin `?`) que filtra la lista de Órdenes a EXACTAMENTE este
 * bucket.
 *
 * Que sea exacto y no aproximado es un hallazgo, no un diseño nuevo: los buckets
 * de envejecimiento son rangos de FECHA DE CREACIÓN, y `parseFilters` de la
 * página de Órdenes ya soporta `desde`/`hasta` como day keys de `createdAt` en
 * America/Bogota, inclusivos por ambos extremos. No hizo falta construir un
 * filtro por edad — el que hay ya lo expresa.
 *
 * El `estado=pendiente` es lo que mantiene honesto el link: sin él, un rango de
 * fechas a secas traería también las pagadas y las canceladas de esos días.
 */
export function queryDelBucket(bucket: BucketCartera, hoy: string): string {
  const params = new URLSearchParams({ estado: 'pendiente' });
  if (bucket === 'reciente') {
    params.set('desde', dayKeyMas(hoy, -CARTERA_DIAS_RECIENTE));
  } else if (bucket === 'medio') {
    params.set('desde', dayKeyMas(hoy, -CARTERA_DIAS_MEDIO));
    params.set('hasta', dayKeyMas(hoy, -(CARTERA_DIAS_RECIENTE + 1)));
  } else {
    params.set('hasta', dayKeyMas(hoy, -(CARTERA_DIAS_MEDIO + 1)));
  }
  return params.toString();
}

const LABELS: Record<BucketCartera, string> = {
  reciente: `0–${CARTERA_DIAS_RECIENTE} días`,
  medio:    `${CARTERA_DIAS_RECIENTE + 1}–${CARTERA_DIAS_MEDIO} días`,
  vencido:  `Más de ${CARTERA_DIAS_MEDIO} días`,
};

const ORDEN: BucketCartera[] = ['reciente', 'medio', 'vencido'];

export interface ResumenCartera {
  total:   number;
  conteo:  number;
  buckets: BucketResumen[];
}

/**
 * Agrupa las órdenes pendientes en los tres buckets.
 *
 * Los tres se devuelven SIEMPRE, incluso en cero: un bucket que desaparece al
 * vaciarse hace que la fila de al lado cambie de sitio entre recargas, y el
 * operador aprende la posición de "vencido" antes que su etiqueta.
 */
export function agruparCartera(ordenes: OrdenPendiente[], hoy: string): ResumenCartera {
  const acc = new Map<BucketCartera, { conteo: number; monto: number }>(
    ORDEN.map(b => [b, { conteo: 0, monto: 0 }]),
  );

  for (const o of ordenes) {
    const slot = acc.get(bucketPorEdad(edadEnDias(o.dia, hoy)))!;
    slot.conteo += 1;
    slot.monto  += o.total;
  }

  const buckets = ORDEN.map(bucket => ({
    bucket,
    label:  LABELS[bucket],
    conteo: acc.get(bucket)!.conteo,
    monto:  acc.get(bucket)!.monto,
    query:  queryDelBucket(bucket, hoy),
  }));

  return {
    total:  buckets.reduce((s, b) => s + b.monto, 0),
    conteo: buckets.reduce((s, b) => s + b.conteo, 0),
    buckets,
  };
}
