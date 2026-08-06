import prisma from '@/lib/prisma';
import { AUTOMATIONS } from '@/constants/automations';

// Fixtures del CARRIL DE INTEGRACIÓN. Deliberadamente NO se usa `prisma/seed.ts`:
// ese seed construye una tienda de demo —120 órdenes, clientes realistas,
// historial— y un test que depende de él falla el día que alguien ajusta la demo,
// por una razón que no tiene nada que ver con lo que el test mide. Acá cada test
// declara las filas EXACTAS que su cadena necesita y nada más.
//
// La base la levanta scripts/test-integracion.sh y muere con la corrida, así que
// estos helpers no tienen que ser conservadores: pueden borrar todo.

/** Un `Product` con lo mínimo que el schema exige. */
export async function crearProducto(opts: {
  slug: string;
  stock: number;
  stock_minimo: number;
  nombre?: string;
  activo?: boolean;
}) {
  return prisma.product.create({
    data: {
      nombre:       opts.nombre ?? `Producto ${opts.slug}`,
      slug:         opts.slug,
      categoria:    'cafe_grano',
      precio:       20000,
      stock:        opts.stock,
      stock_minimo: opts.stock_minimo,
      activo:       opts.activo ?? true,
    },
  });
}

/**
 * Una `Order`. El número lleva prefijo `CN-` a propósito: los barridos filtran
 * con `ORDENES_REALES` (excluye la data de demo `SN-`), así que una orden `SN-`
 * quedaría fuera y el test pasaría en verde sin haber ejercitado nada.
 */
export async function crearOrden(opts: {
  numero: string;
  estado?: string;
  condicion_pago?: 'ANTICIPADO' | 'CONTRAENTREGA';
  total?: number;
  cliente_nombre?: string;
}) {
  return prisma.order.create({
    data: {
      numero_orden:   opts.numero,
      cliente_nombre: opts.cliente_nombre ?? 'Cliente Test',
      estado:         opts.estado ?? 'pendiente',
      condicion_pago: opts.condicion_pago ?? 'CONTRAENTREGA',
      total:          opts.total ?? 28000,
    },
  });
}

/** Un `Shipping` colgado de una orden. `fecha_entrega` es TEXTO (ISO-8601). */
export async function crearEnvio(opts: {
  ordenId: string;
  estado: string;
  fecha_entrega?: string | null;
  mensajero?: string | null;
}) {
  return prisma.shipping.create({
    data: {
      orden_id:      opts.ordenId,
      estado:        opts.estado,
      fecha_entrega: opts.fecha_entrega ?? null,
      mensajero:     opts.mensajero ?? null,
    },
  });
}

/**
 * Un `Comprobante` colgado de una orden. La `url` es un literal: el carril NO
 * habla con Vercel Blob —no hay red ni credenciales en los tests— y no hace
 * falta, porque lo que se afirma es la CADENA (evidencia → veredicto → plata),
 * no la subida.
 */
export async function crearComprobanteFixture(opts: {
  ordenId: string;
  estado?: 'RECIBIDO' | 'VERIFICADO' | 'RECHAZADO';
  contentType?: string;
}) {
  return prisma.comprobante.create({
    data: {
      orden_id:          opts.ordenId,
      url:               `https://x.public.blob.vercel-storage.com/dev/comprobantes/soporte-${opts.ordenId}.png`,
      content_type:      opts.contentType ?? 'image/png',
      size_bytes:        102_400,
      estado:            opts.estado ?? 'RECIBIDO',
      subido_por:        'user_test',
      subido_por_nombre: 'Operador Test',
    },
  });
}

/** ISO-8601 UTC de hace `h` horas — el formato que el servidor escribe siempre. */
export const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/**
 * Deja ACTIVA exactamente una automatización y APAGA todas las demás, escribiendo
 * una fila real de `AutomationSetting` por cada key del registry.
 *
 * No es cosmético, es lo que hace determinista el carril: `runScheduledAutomations`
 * barre TODAS las programadas, y varias declaran su hora en reloj de Bogotá. Sin
 * esto, un test que corriera a las 9:00 dispararía también `contraentrega_sin_cobrar`
 * y `envio_estancado`, y a las 7:00 intentaría MANDAR UN CORREO real por
 * `resumen_diario`. Un test que pasa o falla según la hora del día no es un test.
 */
export async function soloActiva(key: string) {
  await prisma.automationSetting.deleteMany({});
  await prisma.automationSetting.createMany({
    data: AUTOMATIONS.map(def => ({
      key:    def.key,
      activo: def.key === key,
      config: def.configSchema.parse({}) as object,
    })),
  });
}

/** Fija `activo` de UNA key, dejando el resto como esté. */
export async function setActivo(key: string, activo: boolean) {
  await prisma.automationSetting.update({ where: { key }, data: { activo } });
}

/**
 * Vacía todo entre tests. El orden respeta las FKs: los hijos antes que los
 * padres. `AutomationRun` y `Notification` no tienen relaciones, pero se limpian
 * igual porque son justamente lo que cada test afirma.
 */
export async function limpiar() {
  await prisma.notification.deleteMany({});
  await prisma.automationRun.deleteMany({});
  await prisma.automationSetting.deleteMany({});
  await prisma.inventoryLog.deleteMany({});
  await prisma.comprobante.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.shipping.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.product.deleteMany({});
}

/** Los runs de una automatización, en orden de creación. */
export function runsDe(automationKey: string) {
  return prisma.automationRun.findMany({ where: { automationKey }, orderBy: { createdAt: 'asc' } });
}

/** Las notificaciones de un tipo, en orden de creación. */
export function notificacionesDe(tipo: string) {
  return prisma.notification.findMany({ where: { tipo }, orderBy: { createdAt: 'asc' } });
}

export { prisma };
