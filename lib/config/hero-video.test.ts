import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HERO_VIDEO_MOVIL_MEDIA, HERO_VIDEO_ESCRITORIO_MEDIA, tieneVideoMovil, fuentesVideoHero, posterVideoMovil } from './hero-video';

// § HERO-VIDEO-MOVIL-1 — la lógica PURA de la elección entre video de escritorio y video de teléfono.

test('HERO_VIDEO_MOVIL_MEDIA: aspecto menor o igual que 1 — orientación vertical angosta', () => {
  assert.equal(HERO_VIDEO_MOVIL_MEDIA, '(max-aspect-ratio: 1/1)');
});

test('HERO_VIDEO_ESCRITORIO_MEDIA: es la NEGACIÓN textual de HERO_VIDEO_MOVIL_MEDIA — para el preload del póster de escritorio (§ el defecto medido: sin esto, ese preload se disparaba siempre)', () => {
  assert.equal(HERO_VIDEO_ESCRITORIO_MEDIA, 'not (max-aspect-ratio: 1/1)');
});

// ─── tieneVideoMovil ────────────────────────────────────────────────────────────────────────────────

test('tieneVideoMovil: ausente es false', () => {
  assert.equal(tieneVideoMovil({}), false);
});

test('tieneVideoMovil: vacío o sólo espacios es false — no un dato real', () => {
  assert.equal(tieneVideoMovil({ imagenMovil: '' }), false);
  assert.equal(tieneVideoMovil({ imagenMovil: '   ' }), false);
});

test('tieneVideoMovil: una URL real es true', () => {
  assert.equal(tieneVideoMovil({ imagenMovil: '/v-movil.mp4' }), true);
});

// ─── fuentesVideoHero ───────────────────────────────────────────────────────────────────────────────

test('fuentesVideoHero: SIN video móvil, UNA sola fuente — el comodín de escritorio, SIN media (byte-idéntico)', () => {
  const f = fuentesVideoHero({ imagen: '/v.mp4', imagenPoster: '/p.jpg' });
  assert.deepEqual(f, [{ src: '/v.mp4' }]);
});

test('fuentesVideoHero: imagenMovil en blanco se trata como ausente — misma fuente única', () => {
  const f = fuentesVideoHero({ imagen: '/v.mp4', imagenPoster: '/p.jpg', imagenMovil: '   ' });
  assert.deepEqual(f, [{ src: '/v.mp4' }]);
});

test('fuentesVideoHero: CON video móvil, el móvil va PRIMERO con su media; el de escritorio queda de comodín, SIN media', () => {
  const f = fuentesVideoHero({
    imagen: '/v.mp4', imagenPoster: '/p.jpg',
    imagenMovil: '/v-movil.mp4', imagenMovilPoster: '/p-movil.jpg',
  });
  assert.deepEqual(f, [
    { src: '/v-movil.mp4', media: HERO_VIDEO_MOVIL_MEDIA },
    { src: '/v.mp4' },
  ]);
});

// ─── posterVideoMovil ───────────────────────────────────────────────────────────────────────────────

test('posterVideoMovil: con póster propio, lo devuelve', () => {
  const p = posterVideoMovil({
    imagen: '/v.mp4', imagenPoster: '/p.jpg',
    imagenMovil: '/v-movil.mp4', imagenMovilPoster: '/p-movil.jpg',
  });
  assert.equal(p, '/p-movil.jpg');
});

test('posterVideoMovil: SIN póster propio (dato escrito por otro camino, § el refine del schema no lo garantiza en lectura), cae al de escritorio — nunca deja la portada sin nada', () => {
  assert.equal(
    posterVideoMovil({ imagen: '/v.mp4', imagenPoster: '/p.jpg', imagenMovil: '/v-movil.mp4', imagenMovilPoster: '' }),
    '/p.jpg',
  );
  assert.equal(
    posterVideoMovil({ imagen: '/v.mp4', imagenPoster: '/p.jpg', imagenMovil: '/v-movil.mp4' }),
    '/p.jpg',
  );
});
