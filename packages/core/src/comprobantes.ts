import prisma from '@duna/core';
import { Prisma, ComprobanteEstado, MetodoPago } from '@duna/core';
import { registerOrderPaymentTx } from './orders';

// ─── Las escrituras del comprobante ──────────────────────────────────────────
//
// Viven acá y no dentro de los route handlers por el criterio de siempre
// (`lib/inventory.ts`, `lib/product-update.ts`): el carril de integración no
// monta HTTP, así que la única forma de afirmar contra una base real que
// verificar sella y que rechazar NO crea plata es que sean funciones.
//
// La declaración "ninguna de estas funciones toca `Order.estado`" está VIGENTE HOY
// pero DEROGADA por decisión (CLAUDE.md § Decisión — Cuándo un pedido está pagado,
// 2026-08-17). Describe el código real de ESTE momento, no el diseño permanente.
//
// SI ESE DOCUMENTO PARECE CONTRADECIR ESTE COMENTARIO, EL DOCUMENTO NO ESTÁ MAL: él
// describe el destino, este comentario describe el hoy. Cuando se implemente la
// decisión, gana el documento — y este comentario, junto con el invariante de
// `comprobante-verificacion.test`, se reescribe con él.
//
// Lo VIGENTE hoy: `decidirComprobante` es un `updateMany` puro y la orden la mueve
// el Payment y sólo el Payment (§3.1). Es lo que el carril afirma contra una base
// real, y es cierto mientras esta línea exista — no se describe un comportamiento
// que el código todavía no tiene.
//
// Lo DEROGADO: verificar un comprobante sobre una orden PENDIENTE pasará a CREAR el
// Payment —como tercer llamador de `registerOrderPaymentTx`, no un camino paralelo—
// y con eso la orden pasará a `pagado`. El motivo: afirmar "la plata entró" al
// Registrar Pago, antes de juzgar la evidencia, produce los dos síntomas que la
// decisión cierra (pagado con comprobante sin verificar; rechazar que no revierte).
//
// Lo que NO cambia en ninguno de los dos modelos: RECHAZAR nunca crea plata, y el
// comprobante adjuntado DESDE Registrar Pago nace VERIFICADO (documenta un pago que
// el operador ya afirmó, no algo por juzgar).

export class ComprobanteYaDecidido extends Error {
  constructor(public estadoActual: ComprobanteEstado) {
    super(
      `El comprobante ya fue ${estadoActual === 'VERIFICADO' ? 'verificado' : 'rechazado'}. ` +
      'Un veredicto no se reescribe: quedaría sin rastro de quién decidió y cuándo.',
    );
    this.name = 'ComprobanteYaDecidido';
  }
}

// Verificar un comprobante sobre una orden PENDIENTE crea el Payment (§ Decisión —
// Cuándo un pedido está pagado). Falta el dato del pago → no se puede afirmar que la
// plata entró. La UI lo recolecta (método + fecha) antes de verificar.
export class PagoRequeridoParaVerificar extends Error {
  constructor() {
    super('Falta el método de pago para verificar: verificar una orden pendiente registra el cobro.');
    this.name = 'PagoRequeridoParaVerificar';
  }
}

// EFECTIVO con un comprobante es una contradicción: un comprobante existe porque hubo
// transferencia; el efectivo no deja foto (§3.b). La restricción vive en el SERVER, no
// solo en el select — si viviera solo en la UI se saltaría con un request.
export class EfectivoConComprobanteError extends Error {
  constructor() {
    super('Un comprobante implica transferencia: el método no puede ser efectivo.');
    this.name = 'EfectivoConComprobanteError';
  }
}

// Lo que verify necesita para crear el Payment, y que el comprobante NO tiene. El
// `monto` NO está acá A PROPÓSITO: sale server-side de `order.total` (fila bloqueada),
// nunca del cliente — la misma regla que el route de pagos.
export interface PagoAlVerificar {
  metodo: MetodoPago;
  /** Fecha de negocio en que entró la plata. Omitida → default now(). */
  fecha?: Date;
  referencia?: string | null;
}

export interface NuevoComprobante {
  ordenId:         string;
  url:             string;
  contentType:     string;
  sizeBytes:       number;
  subidoPor:       string | null;
  subidoPorNombre: string | null;
}

/**
 * Registra el puntero al blob ya subido. La subida ocurre ANTES y fuera de la
 * transacción, a propósito: `storage.put` habla con un servicio externo y
 * meterlo dentro dejaría una transacción de Postgres abierta durante una llamada
 * de red que puede tardar segundos.
 *
 * El orden es SUBIR → INSERTAR, y no al revés. Si la subida funciona y el insert
 * falla, queda un blob huérfano — basura barata. Al revés quedaría una fila
 * apuntando a una imagen que no existe, y el operador vería un comprobante roto
 * sin forma de saber si el cliente lo mandó. Es la misma asimetría que ya rige
 * el borrado de imágenes de producto.
 */
export async function crearComprobante(datos: NuevoComprobante) {
  return prisma.comprobante.create({
    data: {
      orden_id:          datos.ordenId,
      url:               datos.url,
      content_type:      datos.contentType,
      size_bytes:        datos.sizeBytes,
      estado:            'RECIBIDO',
      subido_por:        datos.subidoPor,
      subido_por_nombre: datos.subidoPorNombre,
    },
  });
}

interface Veredicto {
  por:    string | null;
  nombre: string | null;
  notas?: string | null;
}

export interface ResultadoVeredicto {
  /** El comprobante ya con el veredicto, o `null` si no existía. */
  comprobante: Awaited<ReturnType<typeof prisma.comprobante.findUnique>>;
  /** `true` sólo cuando ESTA verificación creó el Payment. El route lo usa para
   *  disparar `order.pagado` — un pago que no avisa es una venta que el cliente no
   *  se entera. */
  pagoCreado: boolean;
}

/**
 * El veredicto sobre un comprobante. El sello (`updateMany` con el estado en el
 * `where`) hace la transición condicional en UNA sentencia: dos veredictos
 * concurrentes del mismo comprobante no pueden ambos escribir su nombre — el
 * segundo ve `count === 0` y recibe `ComprobanteYaDecidido`.
 *
 * VERIFICAR CREA LA PLATA (§ Decisión — Cuándo un pedido está pagado). Sobre una
 * orden PENDIENTE, verificar es el TERCER llamador de `registerOrderPaymentTx` —no
 * un camino paralelo—, en la MISMA transacción que sella. Sobre una orden ya
 * pagada, sólo SELLA (la rama que antes era la única). Rechazar nunca toca la orden.
 *
 * LA GUARDA CONTRA UN SEGUNDO PAYMENT es el `SELECT … FOR UPDATE` sobre la orden,
 * NO una unique en la base (Payment no la tiene). Sin él, dos comprobantes distintos
 * de la misma orden verificados a la vez leerían ambos `pendiente` y crearían dos
 * Payments. Es el mismo lock que el route de pagos, movido acá porque
 * `registerOrderPaymentTx` no bloquea por su cuenta.
 */
export async function decidirComprobante(
  id: string,
  estado: Extract<ComprobanteEstado, 'VERIFICADO' | 'RECHAZADO'>,
  veredicto: Veredicto,
  pago?: PagoAlVerificar,
): Promise<ResultadoVeredicto> {
  // RECHAZAR nunca crea plata ni toca la orden: el sello simple de siempre.
  if (estado === 'RECHAZADO') {
    return sellar(prisma, id, estado, veredicto);
  }

  // VERIFICAR: transacción con lock de la orden. El sello y el Payment (si aplica)
  // quedan atómicos, y el lock serializa dos verificaciones de la misma orden.
  return prisma.$transaction(async (tx) => {
    const comp = await tx.comprobante.findUnique({ where: { id }, select: { orden_id: true } });
    if (!comp) return { comprobante: null, pagoCreado: false };

    // El lock PRIMERO — antes de leer el estado con el que se decide cobrar. Un
    // segundo verify de la misma orden se bloquea acá y, cuando pasa, ya la ve pagada.
    const filas = await tx.$queryRaw<{ estado: string; total: number }[]>`
      SELECT "estado", "total" FROM "Order" WHERE "id" = ${comp.orden_id} FOR UPDATE
    `;
    const orden = filas[0];

    // El sello, condicional en UNA sentencia. `count === 0` ⇒ ya venía decidido.
    const sellado = await sellar(tx, id, estado, veredicto);
    if (!sellado.comprobante) return sellado;

    // Este llamado ES el que verificó (count === 1). Si la orden aún no tenía plata,
    // la verificación es lo que la crea. `monto` sale de la fila BLOQUEADA, jamás del
    // input — no hay puerta para que el cliente mande un monto.
    let pagoCreado = false;
    if (orden && orden.estado === 'pendiente') {
      if (!pago)                     throw new PagoRequeridoParaVerificar();
      if (pago.metodo === 'EFECTIVO') throw new EfectivoConComprobanteError();
      await registerOrderPaymentTx(tx, comp.orden_id, {
        monto:                 orden.total,
        metodo:                pago.metodo,
        referencia:            pago.referencia ?? null,
        fecha:                 pago.fecha,
        registrado_por:        veredicto.por,
        registrado_por_nombre: veredicto.nombre,
      });
      pagoCreado = true;
    }

    return { comprobante: sellado.comprobante, pagoCreado };
  });
}

/**
 * El sello puro: marca el comprobante con el veredicto en una sola sentencia
 * condicional. Corre igual con `prisma` (rechazar) o con un `tx` (verificar dentro
 * de la transacción del cobro).
 */
async function sellar(
  db: Prisma.TransactionClient,
  id: string,
  estado: Extract<ComprobanteEstado, 'VERIFICADO' | 'RECHAZADO'>,
  veredicto: Veredicto,
): Promise<ResultadoVeredicto> {
  const { count } = await db.comprobante.updateMany({
    where: { id, estado: 'RECIBIDO' },
    data: {
      estado,
      verificado_por:        veredicto.por,
      verificado_por_nombre: veredicto.nombre,
      verificado_at:         new Date(),
      notas_verificacion:    veredicto.notas ?? null,
    },
  });

  const actual = await db.comprobante.findUnique({ where: { id } });
  if (!actual) return { comprobante: null, pagoCreado: false };
  // Perdió la carrera (o ya venía decidido): el estado que hay es el veredicto que
  // quedó, y se reporta con él en vez de con un error genérico.
  if (count === 0) throw new ComprobanteYaDecidido(actual.estado);
  return { comprobante: actual, pagoCreado: false };
}

/** Los comprobantes de una orden, del más viejo al más nuevo (orden de llegada). */
export function comprobantesDeOrden(ordenId: string) {
  return prisma.comprobante.findMany({
    where:   { orden_id: ordenId },
    orderBy: { createdAt: 'asc' },
  });
}
