import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarResumenPendiente } from './completar-resumen';
import type { CambioResumen } from '@/lib/admin/resumen-cambios';

// § EDITOR-PUBLICAR-CONSISTENTE-1 — afirma el invariante que el bug del owner violaba: nunca menos
// filas que claves pendientes. `resumenCambios` real (fuera de `touches:`) devuelve exactamente este
// `[]` para 'encabezado'/'menu'/'footer' — se simula acá con el mismo resultado, sin importar ese
// módulo, porque lo que se prueba es el COMPLETADO, no el resumen real.

function fila(clave: string, etiqueta: string): CambioResumen {
  return { clave, tituloSeccion: clave, elemento: 'x', tipo: 'cambiado', etiqueta };
}

test('una clave pendiente sin ninguna fila descrita gana una fila genérica — el caso del ícono de pestaña', () => {
  const pendientes = ['encabezado'];
  const cambios: CambioResumen[] = []; // lo que `resumenCambios` devuelve hoy para 'encabezado'
  const r = completarResumenPendiente(pendientes, cambios, (c) => (c === 'encabezado' ? 'Encabezado' : undefined));
  assert.equal(r.length, 1);
  assert.equal(r[0].clave, 'encabezado');
  assert.equal(r[0].tituloSeccion, 'Encabezado');
  assert.equal(r[0].etiqueta, 'Encabezado · cambiado');
});

test('nunca da MENOS filas que claves pendientes — el invariante que el badge/publish/popover comparten', () => {
  const pendientes = ['hero', 'encabezado', 'menu', 'footer'];
  // sólo 'hero' tiene fila real (dos campos cambiados); las tres de cromo no tienen ninguna.
  const cambios: CambioResumen[] = [fila('hero', 'Hero · Titular · cambiado'), fila('hero', 'Hero · Subtítulo · cambiado')];
  const r = completarResumenPendiente(pendientes, cambios, (c) => ({ encabezado: 'Encabezado', menu: 'Menú', footer: 'Pie' } as Record<string, string>)[c]);
  const claves = new Set(r.map((c) => c.clave));
  assert.ok(claves.has('hero') && claves.has('encabezado') && claves.has('menu') && claves.has('footer'));
  // >= pendientes.length, nunca menos — hero sigue aportando sus DOS filas (no se colapsa).
  assert.ok(r.length >= pendientes.length, `esperaba >= ${pendientes.length}, dio ${r.length}`);
  assert.equal(r.filter((c) => c.clave === 'hero').length, 2);
  assert.equal(r.filter((c) => c.clave === 'encabezado').length, 1);
});

test('una clave YA descrita no se duplica', () => {
  const pendientes = ['hero'];
  const cambios: CambioResumen[] = [fila('hero', 'Hero · Titular · cambiado')];
  const r = completarResumenPendiente(pendientes, cambios, () => undefined);
  assert.equal(r.length, 1);
  assert.equal(r[0].etiqueta, 'Hero · Titular · cambiado');
});

test('sin título conocido, cae al nombre crudo de la clave', () => {
  const r = completarResumenPendiente(['algoRaro'], [], () => undefined);
  assert.equal(r.length, 1);
  assert.equal(r[0].tituloSeccion, 'algoRaro');
  assert.equal(r[0].etiqueta, 'algoRaro · cambiado');
});

test('sin pendientes y sin cambios, da vacío', () => {
  assert.deepEqual(completarResumenPendiente([], [], () => undefined), []);
});
