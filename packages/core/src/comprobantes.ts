import prisma from '@duna/core';
import { ComprobanteEstado } from '@duna/core';

// ─── Las escrituras del comprobante ──────────────────────────────────────────
//
// Viven acá y no dentro de los route handlers por el criterio de siempre
// (`lib/inventory.ts`, `lib/product-update.ts`): el carril de integración no
// monta HTTP, así que la única forma de afirmar contra una base real que
// verificar sella y que rechazar NO crea plata es que sean funciones.
//
// HOY ninguna de estas funciones toca `Order.estado`: `decidirComprobante` es un
// `updateMany` puro, y la orden la mueve el Payment y sólo el Payment (§3.1). Es
// lo que el carril afirma contra una base real, y es cierto mientras esta línea
// exista — no describir un comportamiento que el código todavía no tiene.
//
// PERO la regla de producto CAMBIÓ — decidido, NO implementado (ver CLAUDE.md
// § Decisión — Cuándo un pedido está pagado, 2026-08-17). Verificar un comprobante
// sobre una orden PENDIENTE pasará a CREAR el Payment —como tercer llamador de
// `registerOrderPaymentTx`, no un camino paralelo— y con eso la orden pasará a
// `pagado`. El motivo: pedirle al operador que afirme "la plata entró" al Registrar
// Pago, antes de juzgar la evidencia, produce los dos síntomas que la decisión
// cierra (pagado con comprobante sin verificar; rechazar que no revierte). Cuando
// se implemente, este comentario y el invariante de `comprobante-verificacion.test`
// se reescriben JUNTOS.
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

/**
 * Sella el comprobante con quién y cuándo. **No cobra**: cuándo hay que cobrar lo
 * decide `accionAlVerificar` del lado del cliente, que abre Registrar Pago antes
 * de llegar acá. Esta función es el segundo paso de esa secuencia, o el único
 * cuando la plata ya estaba.
 *
 * `updateMany` con el estado en el `where` y no un `update` por id: hace la
 * transición condicional en UNA sentencia, así que dos verificaciones
 * concurrentes del mismo comprobante no pueden ambas escribir su nombre. La
 * segunda ve `count === 0` y recibe el 409. Mismo patrón que el decremento de
 * stock del despacho.
 */
export async function decidirComprobante(
  id: string,
  estado: Extract<ComprobanteEstado, 'VERIFICADO' | 'RECHAZADO'>,
  veredicto: Veredicto,
) {
  const { count } = await prisma.comprobante.updateMany({
    where: { id, estado: 'RECIBIDO' },
    data: {
      estado,
      verificado_por:        veredicto.por,
      verificado_por_nombre: veredicto.nombre,
      verificado_at:         new Date(),
      notas_verificacion:    veredicto.notas ?? null,
    },
  });

  const actual = await prisma.comprobante.findUnique({ where: { id } });
  if (!actual) return null;
  // Perdió la carrera (o ya venía decidido): el estado que hay es el veredicto
  // que quedó, y se reporta con él en vez de con un error genérico.
  if (count === 0) throw new ComprobanteYaDecidido(actual.estado);
  return actual;
}

/** Los comprobantes de una orden, del más viejo al más nuevo (orden de llegada). */
export function comprobantesDeOrden(ordenId: string) {
  return prisma.comprobante.findMany({
    where:   { orden_id: ordenId },
    orderBy: { createdAt: 'asc' },
  });
}
