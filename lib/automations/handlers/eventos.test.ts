import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOMATION_MAP, renderWhatsappTemplate } from '@/constants/automations';
import { nombreCorto, variablesNuevaOrden, variablesOrdenEntregada } from './eventos';

// WHATSAPP-PLANTILLAS-CABLEADO-1 — la ARIDAD del handler no puede divergir en
// silencio de la que declara la plantilla (§ CLAUDE.md, "cuando dos declaraciones
// describen el mismo conjunto, o una DERIVA de la otra o hay un test que las ata").
// `variablesNuevaOrden`/`variablesOrdenEntregada` son PURAS a propósito: atan la
// aridad sin tocar prisma, así que este test corre en capa 1 (sin base).

test('nueva_orden: la aridad de la fila que arma el handler coincide con la plantilla', () => {
  const tpl = AUTOMATION_MAP.nueva_orden.plantilla;
  assert.ok(tpl, 'nueva_orden debe declarar plantilla');
  const fila = variablesNuevaOrden('Juan', 'CN-1', '$ 1.000', 'Café Nayoli');
  assert.equal(fila.length, tpl.variables.length);
});

test('orden_entregada: la aridad de la fila que arma el handler coincide con la plantilla', () => {
  const tpl = AUTOMATION_MAP.orden_entregada.plantilla;
  assert.ok(tpl, 'orden_entregada debe declarar plantilla');
  const fila = variablesOrdenEntregada('Juan', 'CN-1', 'Café Nayoli');
  assert.equal(fila.length, tpl.variables.length);
});

test('nueva_orden: el nombre del negocio cae en la posición que la plantilla declara (4ª), y el render no deja {{n}} sin resolver', () => {
  const tpl = AUTOMATION_MAP.nueva_orden.plantilla!;
  const fila = variablesNuevaOrden(nombreCorto('juan perez'), 'CN-132453', '$ 45.000', 'Café Nayoli');
  // La posición del nombre del negocio es la declarada por la plantilla: la 4ª.
  assert.equal(tpl.variables[3], 'nombre del negocio');
  assert.equal(fila[3], 'Café Nayoli');

  const mensaje = renderWhatsappTemplate(tpl, fila);
  assert.doesNotMatch(mensaje, /\{\{\d+\}\}/);
  assert.equal(
    mensaje,
    'Hola Juan, confirmamos tu orden CN-132453 por un total de $ 45.000. ' +
      'Ya estamos preparándola y te avisamos apenas salga a ruta. ' +
      'Gracias por comprar en Café Nayoli.',
  );
});

test('orden_entregada: el nombre del negocio cae en la posición que la plantilla declara (3ª), y el render no deja {{n}} sin resolver', () => {
  const tpl = AUTOMATION_MAP.orden_entregada.plantilla!;
  const fila = variablesOrdenEntregada(nombreCorto('juan perez'), 'CN-132453', 'Café Nayoli');
  assert.equal(tpl.variables[2], 'nombre del negocio');
  assert.equal(fila[2], 'Café Nayoli');

  const mensaje = renderWhatsappTemplate(tpl, fila);
  assert.doesNotMatch(mensaje, /\{\{\d+\}\}/);
  assert.equal(
    mensaje,
    'Hola Juan, tu orden CN-132453 fue entregada. ' +
      'Gracias por elegir Café Nayoli, esperamos que la disfrutes. ' +
      'Si algo no salió bien, respóndenos por aquí y lo resolvemos.',
  );
});
