import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composicionCajon, composicionConfirmacion, composicionSeguimiento, composicionPasos, stickerConfirmacion, etiquetaMetodoPedido, verboCTACompra } from './composiciones-compra';

// COMPRA-LINEAS-ONIX-CHAMISAS-1 — resolución de cada composición y caída a la común con un valor
// desconocido (§ el spec del slice, "Cómo lo probás").

test('composicionCajon: resuelve los tres valores del set cerrado', () => {
  assert.equal(composicionCajon('comun'), 'comun');
  assert.equal(composicionCajon('creditos'), 'creditos');
  assert.equal(composicionCajon('album'), 'album');
});

test('composicionCajon: ausente/null/undefined/basura/otro-tipo cae a "comun"', () => {
  assert.equal(composicionCajon(undefined), 'comun');
  assert.equal(composicionCajon(null), 'comun');
  assert.equal(composicionCajon(''), 'comun');
  assert.equal(composicionCajon('flotante'), 'comun'); // valor real de OTRO eje (carrito.variante)
  assert.equal(composicionCajon('lamina'), 'comun'); // valor real de OTRO eje (confirmacion)
  assert.equal(composicionCajon(42), 'comun');
  assert.equal(composicionCajon({}), 'comun');
});

test('composicionConfirmacion: resuelve los tres valores del set cerrado', () => {
  assert.equal(composicionConfirmacion('comun'), 'comun');
  assert.equal(composicionConfirmacion('boleto'), 'boleto');
  assert.equal(composicionConfirmacion('lamina'), 'lamina');
});

test('composicionConfirmacion: ausente/null/undefined/basura/otro-tipo cae a "comun"', () => {
  assert.equal(composicionConfirmacion(undefined), 'comun');
  assert.equal(composicionConfirmacion(null), 'comun');
  assert.equal(composicionConfirmacion(''), 'comun');
  assert.equal(composicionConfirmacion('album'), 'comun'); // valor real de OTRO eje (cajon/seguimiento)
  assert.equal(composicionConfirmacion(42), 'comun');
  assert.equal(composicionConfirmacion([]), 'comun');
});

test('composicionSeguimiento: resuelve los tres valores del set cerrado', () => {
  assert.equal(composicionSeguimiento('comun'), 'comun');
  assert.equal(composicionSeguimiento('escaleta'), 'escaleta');
  assert.equal(composicionSeguimiento('album'), 'album');
});

test('composicionSeguimiento: ausente/null/undefined/basura/otro-tipo cae a "comun"', () => {
  assert.equal(composicionSeguimiento(undefined), 'comun');
  assert.equal(composicionSeguimiento(null), 'comun');
  assert.equal(composicionSeguimiento(''), 'comun');
  assert.equal(composicionSeguimiento('boleto'), 'comun'); // valor real de OTRO eje (confirmacion)
  assert.equal(composicionSeguimiento(42), 'comun');
});

test('stickerConfirmacion: una etiqueta corta por cada uno de los cinco estados, sin huecos', () => {
  assert.equal(stickerConfirmacion('aprobado'), '¡Pagado!');
  assert.equal(stickerConfirmacion('pendiente'), 'En espera');
  assert.equal(stickerConfirmacion('rechazado'), 'Sin pagar');
  assert.equal(stickerConfirmacion('manual'), 'Guardado');
  assert.equal(stickerConfirmacion('sin_referencia'), 'Sin pagar');
});

test('etiquetaMetodoPedido: un nombre llano por cada método real, nunca el verbo del botón', () => {
  assert.equal(etiquetaMetodoPedido('wompi'), 'Pago en línea');
  assert.equal(etiquetaMetodoPedido('nequi'), 'Nequi');
  assert.equal(etiquetaMetodoPedido('daviplata'), 'Daviplata');
  assert.equal(etiquetaMetodoPedido('breb'), 'Bre-B');
  assert.equal(etiquetaMetodoPedido('transferencia'), 'Transferencia');
  assert.equal(etiquetaMetodoPedido('efectivo'), 'Efectivo (contraentrega)');
  assert.equal(etiquetaMetodoPedido('whatsapp'), 'Coordinado por WhatsApp');
});

test('etiquetaMetodoPedido: `null` cae a una frase honesta, no a un hueco en blanco', () => {
  assert.equal(etiquetaMetodoPedido(null), 'Por confirmar');
});

// COMPRA-FIDELIDAD-3 — el cuarto eje (Entrega/Pago) y el CTA que nombra el método.

test('composicionPasos: resuelve los tres valores del set cerrado', () => {
  assert.equal(composicionPasos('comun'), 'comun');
  assert.equal(composicionPasos('ficha'), 'ficha');
  assert.equal(composicionPasos('tejido'), 'tejido');
});

test('composicionPasos: ausente/null/undefined/basura/otro-tipo cae a "comun"', () => {
  assert.equal(composicionPasos(undefined), 'comun');
  assert.equal(composicionPasos(null), 'comun');
  assert.equal(composicionPasos(''), 'comun');
  assert.equal(composicionPasos('boleto'), 'comun'); // valor real de OTRO eje (confirmacion)
  assert.equal(composicionPasos('album'), 'comun'); // valor real de OTRO eje (cajon/seguimiento)
  assert.equal(composicionPasos(42), 'comun');
});

test('verboCTACompra: nombra el método para cada medio manual, como pide la maqueta', () => {
  assert.equal(verboCTACompra('nequi'), 'Ya pagué con Nequi · confirmar');
  assert.equal(verboCTACompra('daviplata'), 'Ya pagué con Daviplata · confirmar');
  assert.equal(verboCTACompra('breb'), 'Ya pagué con Bre-B · confirmar');
  assert.equal(verboCTACompra('transferencia'), 'Ya transferí · confirmar pedido');
  assert.equal(verboCTACompra('efectivo'), 'Confirmar pedido contra entrega');
});

test('verboCTACompra: delega en verboBotonPago para wompi, whatsapp y null — sin segunda definición', () => {
  assert.equal(verboCTACompra('wompi'), 'Pagar con Wompi');
  assert.equal(verboCTACompra('whatsapp'), 'Enviar por WhatsApp');
  assert.equal(verboCTACompra(null), 'Confirmar pedido');
});
