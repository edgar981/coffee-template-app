import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearComprobante } from '@duna/core/comprobantes';
import { validarArchivoComprobante, COMPROBANTE_SUBIDO_POR_CLIENTE } from '@/lib/comprobante';
import { MAX_COMPROBANTE_BYTES } from '@/constants/comprobante';
import {
  admiteComprobanteCliente, TOPE_COMPROBANTES_CLIENTE,
  type MotivoRechazoComprobanteCliente,
} from '@/lib/checkout/comprobante-cliente';
import { prisma, limpiar } from './fixtures';

// EL CLIENTE ADJUNTA SU PROPIO COMPROBANTE, SIN SESIÓN — Y SIN QUE EL `numero_orden`
// SOLO BASTE COMO PRUEBA.
//
// `POST /api/orders/[id]/comprobante-cliente` evaluó un TOKEN firmado (HMAC con
// vencimiento corto) contra el mecanismo que YA usa `/api/orders/track` — numero_
// orden + el correo que el cliente escribió al pagar — y eligió el SEGUNDO: emitir
// el token exigía escribir en `app/api/checkout/route.ts`, que NO está en el
// `touches:` de este slice (es Tier 1 y requiere su propia aprobación; medido
// ANTES de escribir código — `services/checkout.service.ts` confirma que
// `createOrder` llama a `/api/checkout`, no a `/api/orders`, y que `CheckoutResult`
// no trae el `id` interno de la orden). El porqué completo vive en el docstring de
// `admiteComprobanteCliente` (`lib/checkout/comprobante-cliente.ts`).
//
// Consecuencia para esta suite: donde el spec original pedía "sin prueba / prueba
// de otra orden / vencida", acá se lee así —
//   • "sin prueba"        → sin correo (o uno que no coincide) — NUNCA admite;
//   • "prueba de otra orden" → el correo de una orden B no sirve para la A;
//   • "vencida"           → NO APLICA: un correo no vence. Es la contraparte de
//     elegir un mecanismo sin estado (no hay nada que expirar) en vez de un token
//     con TTL — se anota para que nadie la busque creyendo que falta.
//
// El carril NO monta HTTP (CLAUDE.md, criterio de siempre) y NO habla con Vercel
// Blob (sin red, sin credenciales): `intentarComoLaRuta`, abajo, es una RÉPLICA
// FIEL de la secuencia de la ruta real —lookup → validar archivo → contar →
// admitir → crear—, la misma técnica que `comprobante-verificacion.test.ts` ya usa
// con `verificarComoLaRuta`. Lo que se afirma es contra Postgres real: qué fila
// queda, no la forma de un objeto en memoria (eso ya lo cubre `lib/checkout/
// comprobante-cliente.test.ts`, capa 1).

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/**
 * `crearOrden` de `fixtures.ts` no declara `cliente_email` ni `metodo_pago` —se
 * crea acá, directo, para no tocar un archivo que no está en el `touches:` de
 * este slice por una conveniencia de test.
 */
async function crearOrdenConEmail(opts: {
  numero: string;
  estado?: string;
  metodo_pago?: string | null;
  cliente_email?: string | null;
}) {
  return prisma.order.create({
    data: {
      numero_orden:   opts.numero,
      cliente_nombre: 'Cliente Test',
      cliente_email:  opts.cliente_email ?? 'ana@test.com',
      estado:         opts.estado ?? 'pendiente',
      metodo_pago:    opts.metodo_pago ?? 'nequi',
      condicion_pago: 'ANTICIPADO',
      total:          28000,
    },
  });
}

type ResultadoIntento =
  | { ok: true; comprobante: Awaited<ReturnType<typeof crearComprobante>> }
  | { ok: false; motivo: MotivoRechazoComprobanteCliente }
  | { ok: false; motivo: 'no_encontrada' | 'archivo_invalido'; mensaje?: string };

async function intentarComoLaRuta(
  numero: string,
  email: string,
  archivo: { type: string; size: number },
): Promise<ResultadoIntento> {
  const orden = await prisma.order.findUnique({
    where:  { numero_orden: numero },
    select: { id: true, estado: true, metodo_pago: true, cliente_email: true },
  });
  if (!orden) return { ok: false, motivo: 'no_encontrada' };

  const problemaArchivo = validarArchivoComprobante(archivo);
  if (problemaArchivo) return { ok: false, motivo: 'archivo_invalido', mensaje: problemaArchivo };

  const comprobantesExistentes = await prisma.comprobante.count({ where: { orden_id: orden.id } });
  const veredicto = admiteComprobanteCliente(orden, email, comprobantesExistentes);
  if (!veredicto.ok) return veredicto;

  const comprobante = await crearComprobante({
    ordenId:         orden.id,
    url:             `https://x.public.blob.vercel-storage.com/dev/comprobantes/cliente-${numero}-${comprobantesExistentes}.png`,
    contentType:     archivo.type,
    sizeBytes:       archivo.size,
    subidoPor:       null,
    subidoPorNombre: COMPROBANTE_SUBIDO_POR_CLIENTE,
  });
  return { ok: true, comprobante };
}

const IMAGEN_OK = { type: 'image/png', size: 102_400 };

// ─── Con la prueba correcta: se admite ───────────────────────────────────────

test('numero_orden + el correo real de la orden → admite, fila RECIBIDO, subido por el cliente', async () => {
  const orden = await crearOrdenConEmail({ numero: 'CN-700001', cliente_email: 'ana@test.com', metodo_pago: 'nequi' });
  const r = await intentarComoLaRuta('CN-700001', 'ana@test.com', IMAGEN_OK);

  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.comprobante.estado, 'RECIBIDO');
    assert.equal(r.comprobante.subido_por, null, 'sin sesión, nunca un actor humano');
    assert.equal(r.comprobante.subido_por_nombre, COMPROBANTE_SUBIDO_POR_CLIENTE);
  }
  const filas = await prisma.comprobante.findMany({ where: { orden_id: orden.id } });
  assert.equal(filas.length, 1);
});

test('el correo tolera mayúsculas y espacios — misma normalización que /api/orders/track', async () => {
  await crearOrdenConEmail({ numero: 'CN-700001b', cliente_email: 'ana@test.com' });
  const r = await intentarComoLaRuta('CN-700001b', '  Ana@Test.com  ', IMAGEN_OK);
  assert.equal(r.ok, true);
});

// ─── "sin prueba" — sin correo, o uno que no coincide ────────────────────────

test('sin correo (cadena vacía) → se rechaza, nunca "cualquiera sirve"', async () => {
  await crearOrdenConEmail({ numero: 'CN-700002', cliente_email: 'ana@test.com' });
  const r = await intentarComoLaRuta('CN-700002', '', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'email_no_coincide' });
});

test('correo que no coincide con el de la orden → rechazado, MISMO motivo que "orden no existe"', async () => {
  await crearOrdenConEmail({ numero: 'CN-700002b', cliente_email: 'ana@test.com' });
  const r = await intentarComoLaRuta('CN-700002b', 'otro@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'email_no_coincide' });
  // Nada se escribió.
  const ordenId = (await prisma.order.findUniqueOrThrow({ where: { numero_orden: 'CN-700002b' } })).id;
  assert.equal(await prisma.comprobante.count({ where: { orden_id: ordenId } }), 0);
});

// ─── "prueba de otra orden" — el correo de B no sirve para A ─────────────────

test('el correo de una orden DISTINTA no es prueba válida de ésta', async () => {
  const a = await crearOrdenConEmail({ numero: 'CN-700003a', cliente_email: 'ana@test.com' });
  await crearOrdenConEmail({ numero: 'CN-700003b', cliente_email: 'beto@test.com' });

  const r = await intentarComoLaRuta('CN-700003a', 'beto@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'email_no_coincide' });
  assert.equal(await prisma.comprobante.count({ where: { orden_id: a.id } }), 0);
});

// ─── Orden ya pagada o de pasarela ────────────────────────────────────────────

test('orden YA PAGADA → rechazada, aunque el correo coincida', async () => {
  await crearOrdenConEmail({ numero: 'CN-700004', cliente_email: 'ana@test.com', estado: 'pagado' });
  const r = await intentarComoLaRuta('CN-700004', 'ana@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('orden CANCELADA → rechazada', async () => {
  await crearOrdenConEmail({ numero: 'CN-700005', cliente_email: 'ana@test.com', estado: 'cancelado' });
  const r = await intentarComoLaRuta('CN-700005', 'ana@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('método de PASARELA (\'wompi\') → rechazada: el cobro se confirma solo, nadie mira una foto', async () => {
  await crearOrdenConEmail({ numero: 'CN-700006', cliente_email: 'ana@test.com', metodo_pago: 'wompi' });
  const r = await intentarComoLaRuta('CN-700006', 'ana@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('método EFECTIVO → rechazada: no hay nada que fotografiar', async () => {
  await crearOrdenConEmail({ numero: 'CN-700007', cliente_email: 'ana@test.com', metodo_pago: 'efectivo' });
  const r = await intentarComoLaRuta('CN-700007', 'ana@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

// ─── Tipo o tamaño inválido ───────────────────────────────────────────────────

test('tipo de archivo inválido → rechazado ANTES de escribir nada', async () => {
  const orden = await crearOrdenConEmail({ numero: 'CN-700008', cliente_email: 'ana@test.com' });
  const r = await intentarComoLaRuta('CN-700008', 'ana@test.com', { type: 'image/gif', size: 1024 });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false ? r.motivo : null, 'archivo_invalido');
  assert.equal(await prisma.comprobante.count({ where: { orden_id: orden.id } }), 0);
});

test('tamaño por encima del tope → rechazado', async () => {
  const orden = await crearOrdenConEmail({ numero: 'CN-700009', cliente_email: 'ana@test.com' });
  const r = await intentarComoLaRuta('CN-700009', 'ana@test.com', { type: 'image/png', size: MAX_COMPROBANTE_BYTES + 1 });
  assert.equal(r.ok, false);
  assert.equal(await prisma.comprobante.count({ where: { orden_id: orden.id } }), 0);
});

// ─── Tope por orden ───────────────────────────────────────────────────────────

test('tope por orden: al llegar a TOPE_COMPROBANTES_CLIENTE, el siguiente se rechaza', async () => {
  const orden = await crearOrdenConEmail({ numero: 'CN-700010', cliente_email: 'ana@test.com' });

  for (let i = 0; i < TOPE_COMPROBANTES_CLIENTE; i++) {
    const r = await intentarComoLaRuta('CN-700010', 'ana@test.com', IMAGEN_OK);
    assert.equal(r.ok, true, `intento ${i} debía admitirse`);
  }
  const rechazado = await intentarComoLaRuta('CN-700010', 'ana@test.com', IMAGEN_OK);
  assert.deepEqual(rechazado, { ok: false, motivo: 'tope_alcanzado' });

  const total = await prisma.comprobante.count({ where: { orden_id: orden.id } });
  assert.equal(total, TOPE_COMPROBANTES_CLIENTE, 'el rechazado no debe sumar una fila más');
});
