import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOMATION_MAP, renderWhatsappTemplate } from '@/constants/automations';
import { nombreCorto } from './eventos';
import { variablesClienteInactivo } from './programadas';

// WHATSAPP-PLANTILLAS-CABLEADO-1 — misma doctrina que eventos.test.ts: la aridad
// de la fila que arma el handler no puede divergir en silencio de la que declara
// la plantilla. `variablesClienteInactivo` es PURA, sin prisma.

test('cliente_inactivo: la aridad de la fila que arma el handler coincide con la plantilla', () => {
  const tpl = AUTOMATION_MAP.cliente_inactivo.plantilla;
  assert.ok(tpl, 'cliente_inactivo debe declarar plantilla');
  const fila = variablesClienteInactivo('María', 'Café Nayoli', 'un 10% de descuento en tu próximo pedido');
  assert.equal(fila.length, tpl.variables.length);
});

test('cliente_inactivo: el nombre del negocio cae en la posición que la plantilla declara (2ª), y el render no deja {{n}} sin resolver', () => {
  const tpl = AUTOMATION_MAP.cliente_inactivo.plantilla!;
  const fila = variablesClienteInactivo(
    nombreCorto('maria'), 'Café Nayoli', 'un 10% de descuento en tu próximo pedido',
  );
  // La posición del nombre del negocio es la declarada por la plantilla: la 2ª —
  // NO la última, a diferencia de nueva_orden/orden_entregada.
  assert.equal(tpl.variables[1], 'nombre del negocio');
  assert.equal(fila[1], 'Café Nayoli');

  const mensaje = renderWhatsappTemplate(tpl, fila);
  assert.doesNotMatch(mensaje, /\{\{\d+\}\}/);
  assert.equal(
    mensaje,
    'Hola Maria, hace un tiempo no pasas por Café Nayoli y queremos verte de vuelta. ' +
      'Tenemos para ti un 10% de descuento en tu próximo pedido en tu próxima compra. ' +
      'Respóndenos por aquí y te ayudamos con el pedido.',
  );
});
