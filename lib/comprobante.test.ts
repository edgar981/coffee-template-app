import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarArchivoComprobante, esImagen, formatearTamano, estadoComprobante,
  accionAlVerificar, puedeDecidirse, tienePendienteDeVerificar, nombreArchivo,
} from './comprobante';
import { MAX_COMPROBANTE_BYTES } from '@/constants/comprobante';

// ─── Qué se acepta ───────────────────────────────────────────────────────────

test('acepta los tres formatos de imagen', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validarArchivoComprobante({ type, size: 1024 }), null, type);
  }
});

test('acepta PDF — es el caso real de Bancolombia, no una concesión teórica', () => {
  assert.equal(validarArchivoComprobante({ type: 'application/pdf', size: 1024 }), null);
});

test('rechaza un formato ajeno DICIENDO cuáles sirven', () => {
  const msg = validarArchivoComprobante({ type: 'image/gif', size: 1024 });
  assert.ok(msg);
  assert.match(msg, /PDF/);
  assert.match(msg, /image\/gif/);
});

test('un archivo sin content-type se rechaza, y el mensaje no queda cojo', () => {
  const msg = validarArchivoComprobante({ type: '', size: 1024 });
  assert.ok(msg);
  assert.match(msg, /desconocido/);
});

test('en el límite exacto pasa; un byte más, no', () => {
  assert.equal(validarArchivoComprobante({ type: 'image/png', size: MAX_COMPROBANTE_BYTES }), null);
  const msg = validarArchivoComprobante({ type: 'image/png', size: MAX_COMPROBANTE_BYTES + 1 });
  assert.ok(msg);
  assert.match(msg, /máximo/);
});

test('un archivo vacío se rechaza antes de mirar el formato', () => {
  assert.match(validarArchivoComprobante({ type: 'image/png', size: 0 })!, /vacío/);
});

// ─── Imagen vs documento ─────────────────────────────────────────────────────

test('sólo las imágenes se renderizan como imagen', () => {
  assert.equal(esImagen('image/jpeg'), true);
  assert.equal(esImagen('image/webp'), true);
  // Un PDF en un <img> no falla ruidosamente: se queda en blanco, y el operador
  // cree que el comprobante llegó roto.
  assert.equal(esImagen('application/pdf'), false);
});

test('el tamaño se lee en la unidad que corresponde', () => {
  assert.equal(formatearTamano(512), '512 B');
  assert.equal(formatearTamano(2048), '2 KB');
  assert.equal(formatearTamano(1024 * 1024 * 1.2), '1,2 MB');
  // Coma decimal, no punto: es la convención es-CO del resto del admin.
  assert.ok(!formatearTamano(1024 * 1024 * 3.7).includes('.'));
});

// ─── El badge ────────────────────────────────────────────────────────────────

test('RECIBIDO es ámbar: hay algo que hacer', () => {
  assert.equal(estadoComprobante('RECIBIDO').tono, 'warn');
});

test('VERIFICADO es verde', () => {
  assert.equal(estadoComprobante('VERIFICADO').tono, 'ok');
});

test('RECHAZADO va NEUTRO, no rojo — ya se resolvió, no exige nada', () => {
  assert.equal(estadoComprobante('RECHAZADO').tono, 'neutral');
  assert.match(estadoComprobante('RECHAZADO').detalle, /se conserva/);
});

// ─── La verificación crea la plata ───────────────────────────────────────────

test('orden pendiente: verificar COBRA (abre Registrar Pago), no sella a secas', () => {
  assert.equal(accionAlVerificar('pendiente'), 'cobrar');
});

test('orden ya pagada: verificar sólo SELLA quién y cuándo', () => {
  assert.equal(accionAlVerificar('pagado'), 'sellar');
});

test('una orden cancelada no cae en el camino de cobrar', () => {
  // No hay plata que crear sobre una orden cancelada; el sello es lo único que
  // tiene sentido, y el servidor decide si lo permite.
  assert.equal(accionAlVerificar('cancelado'), 'sellar');
});

// ─── Transiciones ────────────────────────────────────────────────────────────

test('sólo un RECIBIDO se decide', () => {
  assert.equal(puedeDecidirse('RECIBIDO'), true);
});

test('re-decidir borraría quién decidió y cuándo: no se permite', () => {
  assert.equal(puedeDecidirse('VERIFICADO'), false);
  assert.equal(puedeDecidirse('RECHAZADO'), false);
});

// ─── Pendiente de mirar ──────────────────────────────────────────────────────

test('con al menos un RECIBIDO, la orden tiene soporte por verificar', () => {
  assert.equal(tienePendienteDeVerificar([{ estado: 'VERIFICADO' }, { estado: 'RECIBIDO' }]), true);
});

test('sin ningún RECIBIDO, no hay nada pendiente', () => {
  assert.equal(tienePendienteDeVerificar([{ estado: 'VERIFICADO' }, { estado: 'RECHAZADO' }]), false);
  assert.equal(tienePendienteDeVerificar([]), false);
});

// ─── Nombre del archivo ──────────────────────────────────────────────────────

test('el nombre sale de la URL: no hay columna que pueda contradecirla', () => {
  const url = 'https://x.public.blob.vercel-storage.com/dev/comprobantes/soporte-nequi-a1b2c3.pdf';
  assert.equal(nombreArchivo(url), 'soporte-nequi-a1b2c3.pdf');
});

test('el sufijo aleatorio se conserva: es lo que distingue dos soportes homónimos', () => {
  const a = nombreArchivo('https://x.public.blob.vercel-storage.com/dev/comprobantes/pago-aaa.png');
  const b = nombreArchivo('https://x.public.blob.vercel-storage.com/dev/comprobantes/pago-bbb.png');
  assert.notEqual(a, b);
});

test('una URL basura no rompe la vista', () => {
  assert.equal(nombreArchivo(''), 'Comprobante');
  assert.equal(nombreArchivo('no-es-una-url'), 'no-es-una-url');
});
