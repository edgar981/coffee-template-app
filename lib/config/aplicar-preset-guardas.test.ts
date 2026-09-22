import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conexionVisible, confirmacionValida } from '@/prisma/aplicar-preset';

// Este archivo vive en lib/config/, NO en prisma/, a propósito (ONBOARDING-APLICAR-PRESET-
// SCRIPT-2): un test bajo prisma/ no cae bajo ningún glob del gate — ni "npm test" (que sólo
// cubre lib/, constants/, packages/core/, app/, components/, services/) ni
// scripts/test-integracion.sh (que sólo cubre tests/integracion/) — y quedaría INVISIBLE para
// `npm run gate`, la misma familia de defecto que § GATE-DOS-CARRILES-1 / "El carril rápido cubre
// app/" ya documentan en CLAUDE.md. `lib/**/*.test.ts` YA cubre esta ruta: cero cambios al glob
// del script "test" en package.json hacen falta para que este archivo corra.
//
// Las dos funciones se prueban AISLADAS de `main()` — el gate de entrypoint de
// `prisma/aplicar-preset.ts` (comparación por `pathToFileURL`) es justamente lo que permite
// importarlas acá sin que el runbook completo se dispare al cargar el módulo (que moriría por
// falta de DATABASE_URL en el entorno del test).

test('confirmacionValida: coincidencia EXACTA con el nombre del tenant confirma', () => {
  assert.equal(confirmacionValida('Café Nayoli', 'Café Nayoli'), true);
});

test('confirmacionValida: recorta sólo espacio en blanco de los BORDES', () => {
  assert.equal(confirmacionValida('Café Nayoli', '  Café Nayoli  '), true);
});

test('confirmacionValida: vacío NO confirma', () => {
  assert.equal(confirmacionValida('Café Nayoli', ''), false);
  assert.equal(confirmacionValida('Café Nayoli', '   '), false);
});

test('confirmacionValida: "y"/"s" (un sí genérico) NO confirma — la guarda exige el NOMBRE', () => {
  assert.equal(confirmacionValida('Café Nayoli', 'y'), false);
  assert.equal(confirmacionValida('Café Nayoli', 's'), false);
});

test('confirmacionValida: un nombre parecido pero DISTINTO (otro case, otro tenant) NO confirma', () => {
  assert.equal(confirmacionValida('Café Nayoli', 'café nayoli'), false);
  assert.equal(confirmacionValida('Café Nayoli', 'Café Nayoli '.trimEnd() + '.'), false);
  assert.equal(confirmacionValida('Café Nayoli', 'Otro Tenant'), false);
});

test('confirmacionValida: null/undefined (canal no-interactivo sin CONFIRMAR_TENANT) NO confirma', () => {
  assert.equal(confirmacionValida('Café Nayoli', null), false);
  assert.equal(confirmacionValida('Café Nayoli', undefined), false);
});

test('conexionVisible: extrae host y base, NUNCA credenciales', () => {
  const r = conexionVisible('postgres://user:supersecreto@ep-ancient-frog.neon.tech:5432/produccion?sslmode=require');
  assert.deepEqual(r, { host: 'ep-ancient-frog.neon.tech', base: 'produccion' });
  // Por CLAVES del objeto devuelto, no sólo por ausencia de substring: `conexionVisible` no puede
  // devolver un campo que no declaró, así que el secreto no tiene por dónde colarse.
  assert.deepEqual(Object.keys(r!).sort(), ['base', 'host']);
});

test('conexionVisible: una URL ilegible da null, nunca imprime el valor crudo', () => {
  assert.equal(conexionVisible('esto no es una URL'), null);
});
