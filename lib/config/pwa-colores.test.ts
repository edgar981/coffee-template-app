import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coloresPWA } from './pwa-colores';

// Los colores de chrome/PWA derivan de la paleta; null (Nayoli) → los literales EXACTOS de hoy
// (byte-idéntico), custom → el fondo/tinta del cliente. Puro; capa 1.

test('null/null (Nayoli/fábrica) → los literales EXACTOS de hoy (byte-idéntico)', () => {
  assert.deepEqual(coloresPWA(null, null), { chrome: '#F9F6F4', pwaTheme: '#1E150E' });
});

test('fondo custom → chrome; tinta custom → pwaTheme', () => {
  assert.deepEqual(coloresPWA('#00ff00', '#001122'), { chrome: '#00ff00', pwaTheme: '#001122' });
});

test('un eje null cae a SU literal, sin arrastrar el otro', () => {
  assert.deepEqual(coloresPWA('#abcdef', null), { chrome: '#abcdef', pwaTheme: '#1E150E' });
  assert.deepEqual(coloresPWA(null, '#123456'), { chrome: '#F9F6F4', pwaTheme: '#123456' });
});
