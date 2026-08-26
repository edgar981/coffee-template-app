import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentTypesParaKind, TIPOS_PERMITIDOS, TIPOS_VIDEO } from './upload';

// `contentTypesParaKind` decide qué tipos firma el token de subida directa. El `kind` lo manda el
// NAVEGADOR (clientPayload), así que un cliente malicioso podría mandar cualquier cosa: lo que importa
// es que nunca abra más que una de dos listas CONOCIDAS, y que la basura caiga a lo más restrictivo.

test("kind 'imagen' → sólo imágenes", () => {
  assert.deepEqual(contentTypesParaKind('imagen'), [...TIPOS_PERMITIDOS]);
});

test("kind 'imagen-o-video' → imágenes + vídeo (las dos listas conocidas)", () => {
  assert.deepEqual(contentTypesParaKind('imagen-o-video'), [...TIPOS_PERMITIDOS, ...TIPOS_VIDEO]);
});

test('un kind DESCONOCIDO o basura cae a sólo-imágenes — nunca a video por accidente', () => {
  for (const basura of ['video', 'cualquier-cosa', '', null, undefined, 42, {}, ['imagen-o-video']]) {
    assert.deepEqual(contentTypesParaKind(basura), [...TIPOS_PERMITIDOS]);
  }
});

test('NUNCA devuelve un comodín ni un tipo fuera de las dos listas', () => {
  const todos = contentTypesParaKind('imagen-o-video');
  for (const t of todos) assert.ok([...TIPOS_PERMITIDOS, ...TIPOS_VIDEO].includes(t as never));
  assert.ok(!todos.includes('*'));
});
