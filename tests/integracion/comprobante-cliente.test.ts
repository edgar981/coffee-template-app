import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearComprobante } from '@duna/core/comprobantes';
import { validarArchivoComprobante, COMPROBANTE_SUBIDO_POR_CLIENTE } from '@/lib/comprobante';
import { MAX_COMPROBANTE_BYTES } from '@/constants/comprobante';
import {
  admiteComprobanteCliente, verificarCodigoComprobante, emitirCodigoComprobante,
  TOPE_COMPROBANTES_CLIENTE,
  type MotivoRechazoComprobanteCliente,
} from '@/lib/checkout/comprobante-cliente';
import { prisma, limpiar } from './fixtures';

// EL CLIENTE ADJUNTA SU PROPIO COMPROBANTE, SIN SESIÓN — Y SIN QUE EL `numero_orden`
// SOLO BASTE COMO PRUEBA.
//
// `CHECKOUT-COMPROBANTE-CLIENTE-1` evaluó esto con el MISMO mecanismo que `/api/orders/track`
// —numero_orden + el correo del comprador— porque emitir un token firmado exigía escribir en
// `app/api/checkout/route.ts`, que entonces NO estaba en el `touches:` de ese slice (Tier 1, sin
// aprobación todavía). `CHECKOUT-COMPROBANTE-TOKEN-1` cierra ese hueco: con la aprobación ya
// dada, el token es el que corresponde — el correo deja de autorizar nada en esta ruta. El
// porqué completo vive en el docstring de cabecera de `lib/checkout/comprobante-cliente.ts`.
//
// El carril NO monta HTTP (CLAUDE.md, criterio de siempre) y NO habla con Vercel Blob (sin red,
// sin credenciales): `intentarComoLaRuta`, abajo, es una RÉPLICA FIEL de la secuencia de la
// ruta real —lookup → validar archivo → contar → verificar código → admitir → crear—, la misma
// técnica que `comprobante-verificacion.test.ts` ya usa con `verificarComoLaRuta`. Lo que se
// afirma es contra Postgres real: qué fila queda, no la forma de un objeto en memoria (eso ya lo
// cubre `lib/checkout/comprobante-cliente.test.ts`, capa 1).

const SECRETO = 'secreto-del-carril-para-esta-suite-0123456789';

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/**
 * `crearOrden` de `fixtures.ts` no declara `metodo_pago` — se crea acá, directo, para no tocar
 * un archivo que no está en el `touches:` de este slice por una conveniencia de test.
 */
async function crearOrdenConMetodo(opts: {
  numero: string;
  estado?: string;
  metodo_pago?: string | null;
}) {
  return prisma.order.create({
    data: {
      numero_orden:   opts.numero,
      cliente_nombre: 'Cliente Test',
      cliente_email:  'ana@test.com',
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
  codigo: string,
  archivo: { type: string; size: number },
): Promise<ResultadoIntento> {
  const orden = await prisma.order.findUnique({
    where:  { numero_orden: numero },
    select: { id: true, estado: true, metodo_pago: true },
  });
  if (!orden) return { ok: false, motivo: 'no_encontrada' };

  const problemaArchivo = validarArchivoComprobante(archivo);
  if (problemaArchivo) return { ok: false, motivo: 'archivo_invalido', mensaje: problemaArchivo };

  const comprobantesExistentes = await prisma.comprobante.count({ where: { orden_id: orden.id } });
  const codigoValido = verificarCodigoComprobante(codigo, numero, SECRETO);
  const veredicto = admiteComprobanteCliente(orden, codigoValido, comprobantesExistentes);
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

function codigoDe(numero: string): string {
  const codigo = emitirCodigoComprobante(numero, SECRETO);
  assert.notEqual(codigo, null, 'la emisión con secreto nunca debe devolver null');
  return codigo as string;
}

// ─── Con el código correcto: se admite ───────────────────────────────────────

test('el código emitido para la orden real → admite, fila RECIBIDO, subido por el cliente', async () => {
  const orden = await crearOrdenConMetodo({ numero: 'CN-700001', metodo_pago: 'nequi' });
  const r = await intentarComoLaRuta('CN-700001', codigoDe('CN-700001'), IMAGEN_OK);

  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.comprobante.estado, 'RECIBIDO');
    assert.equal(r.comprobante.subido_por, null, 'sin sesión, nunca un actor humano');
    assert.equal(r.comprobante.subido_por_nombre, COMPROBANTE_SUBIDO_POR_CLIENTE);
  }
  const filas = await prisma.comprobante.findMany({ where: { orden_id: orden.id } });
  assert.equal(filas.length, 1);
});

// ─── "sin prueba" — sin código, o uno inventado ──────────────────────────────

test('sin código (cadena vacía) → se rechaza, nunca "cualquiera sirve"', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700002' });
  const r = await intentarComoLaRuta('CN-700002', '', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'codigo_invalido' });
});

test('código inventado (forma cualquiera) → rechazado, MISMO motivo que "orden no existe"', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700002b' });
  const r = await intentarComoLaRuta('CN-700002b', 'no-soy-un-codigo-real', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'codigo_invalido' });
  // Nada se escribió.
  const ordenId = (await prisma.order.findUniqueOrThrow({ where: { numero_orden: 'CN-700002b' } })).id;
  assert.equal(await prisma.comprobante.count({ where: { orden_id: ordenId } }), 0);
});

test('la vía número + email YA NO AUTORIZA — un string con forma de correo no es un código válido', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700002c' });
  const r = await intentarComoLaRuta('CN-700002c', 'ana@test.com', IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'codigo_invalido' });
});

// ─── "prueba de otra orden" — el código de B no sirve para A ─────────────────

test('el código de una orden DISTINTA no es prueba válida de ésta', async () => {
  const a = await crearOrdenConMetodo({ numero: 'CN-700003a' });
  await crearOrdenConMetodo({ numero: 'CN-700003b' });

  const r = await intentarComoLaRuta('CN-700003a', codigoDe('CN-700003b'), IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'codigo_invalido' });
  assert.equal(await prisma.comprobante.count({ where: { orden_id: a.id } }), 0);
});

// ─── "vencida" — un código con el vencimiento ya pasado ──────────────────────

test('código VENCIDO → rechazado, aunque sea de la orden correcta', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700003c' });
  // Emitido "ayer" (referencia fija, sin depender del reloj del sistema): el verificador,
  // llamado con `ahora` por defecto (Date.now()), ya lo ve vencido.
  const vencido = emitirCodigoComprobante('CN-700003c', SECRETO, Date.now() - 48 * 60 * 60 * 1000) as string;
  const orden = await prisma.order.findUniqueOrThrow({ where: { numero_orden: 'CN-700003c' } });
  const codigoValido = verificarCodigoComprobante(vencido, 'CN-700003c', SECRETO);
  const veredicto = admiteComprobanteCliente(orden, codigoValido, 0);
  assert.deepEqual(veredicto, { ok: false, motivo: 'codigo_invalido' });
});

// ─── Un secreto distinto del que firmó no puede verificar ────────────────────

test('verificar con un secreto DISTINTO del que emitió → rechazado', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700003d' });
  const codigo = codigoDe('CN-700003d');
  const orden = await prisma.order.findUniqueOrThrow({ where: { numero_orden: 'CN-700003d' } });
  const codigoValido = verificarCodigoComprobante(codigo, 'CN-700003d', 'otro-secreto-cualquiera');
  assert.equal(codigoValido, false);
  const veredicto = admiteComprobanteCliente(orden, codigoValido, 0);
  assert.deepEqual(veredicto, { ok: false, motivo: 'codigo_invalido' });
});

// ─── Orden ya pagada o de pasarela ────────────────────────────────────────────

test('orden YA PAGADA → rechazada, aunque el código sea correcto', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700004', estado: 'pagado' });
  const r = await intentarComoLaRuta('CN-700004', codigoDe('CN-700004'), IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('orden CANCELADA → rechazada', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700005', estado: 'cancelado' });
  const r = await intentarComoLaRuta('CN-700005', codigoDe('CN-700005'), IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('método de PASARELA (\'wompi\') → rechazada: el cobro se confirma solo, nadie mira una foto', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700006', metodo_pago: 'wompi' });
  const r = await intentarComoLaRuta('CN-700006', codigoDe('CN-700006'), IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('método EFECTIVO → rechazada: no hay nada que fotografiar', async () => {
  await crearOrdenConMetodo({ numero: 'CN-700007', metodo_pago: 'efectivo' });
  const r = await intentarComoLaRuta('CN-700007', codigoDe('CN-700007'), IMAGEN_OK);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

// ─── Tipo o tamaño inválido ───────────────────────────────────────────────────

test('tipo de archivo inválido → rechazado ANTES de escribir nada', async () => {
  const orden = await crearOrdenConMetodo({ numero: 'CN-700008' });
  const r = await intentarComoLaRuta('CN-700008', codigoDe('CN-700008'), { type: 'image/gif', size: 1024 });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false ? r.motivo : null, 'archivo_invalido');
  assert.equal(await prisma.comprobante.count({ where: { orden_id: orden.id } }), 0);
});

test('tamaño por encima del tope → rechazado', async () => {
  const orden = await crearOrdenConMetodo({ numero: 'CN-700009' });
  const r = await intentarComoLaRuta('CN-700009', codigoDe('CN-700009'), { type: 'image/png', size: MAX_COMPROBANTE_BYTES + 1 });
  assert.equal(r.ok, false);
  assert.equal(await prisma.comprobante.count({ where: { orden_id: orden.id } }), 0);
});

// ─── Tope por orden ───────────────────────────────────────────────────────────

test('tope por orden: al llegar a TOPE_COMPROBANTES_CLIENTE, el siguiente se rechaza', async () => {
  const orden = await crearOrdenConMetodo({ numero: 'CN-700010' });
  const codigo = codigoDe('CN-700010');

  for (let i = 0; i < TOPE_COMPROBANTES_CLIENTE; i++) {
    const r = await intentarComoLaRuta('CN-700010', codigo, IMAGEN_OK);
    assert.equal(r.ok, true, `intento ${i} debía admitirse`);
  }
  const rechazado = await intentarComoLaRuta('CN-700010', codigo, IMAGEN_OK);
  assert.deepEqual(rechazado, { ok: false, motivo: 'tope_alcanzado' });

  const total = await prisma.comprobante.count({ where: { orden_id: orden.id } });
  assert.equal(total, TOPE_COMPROBANTES_CLIENTE, 'el rechazado no debe sumar una fila más');
});
