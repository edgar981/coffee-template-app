import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteContentEditableSchema } from './site-content-schema';

// El schema editable del contenido. Lo importante acá es lo que NO se ve a simple vista: zod
// DESCARTA las claves no declaradas. Así que un campo que el editor guarda pero el schema no
// declara se perdería EN SILENCIO al guardar. `w`/`h` de la galería (la proporción de la foto para
// el masonry) es exactamente ese caso — se afirma que sobreviven.

test('galería: w/h de un ítem SOBREVIVEN al parse (si no, zod los descartaría y se perdería la proporción)', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosGaleria: { items: [{ url: '/a.jpg', alt: 'x', w: 1600, h: 900 }] },
  });
  assert.deepEqual(parsed.nosotrosGaleria!.items, [{ url: '/a.jpg', alt: 'x', w: 1600, h: 900 }]);
});

test('galería: una clave NO declarada en el ítem SÍ se descarta (confirma que el strip está activo)', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosGaleria: { items: [{ url: '/a.jpg', basura: 'no-declarada' }] },
  });
  assert.deepEqual(parsed.nosotrosGaleria!.items, [{ url: '/a.jpg' }]); // 'basura' fuera
});

test('galería: w/h no-positivos se rechazan (0 o negativo no es una proporción válida)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosGaleria: { items: [{ url: '/a.jpg', w: 0, h: 900 }] } }));
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosGaleria: { items: [{ url: '/a.jpg', w: 1600, h: -1 }] } }));
});

test('galería: tipo (video) y poster de un ítem SOBREVIVEN al parse', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosGaleria: { items: [{ url: '/finca.mp4', alt: 'x', tipo: 'video', poster: '/p.jpg' }] },
  });
  assert.deepEqual(parsed.nosotrosGaleria!.items, [{ url: '/finca.mp4', alt: 'x', tipo: 'video', poster: '/p.jpg' }]);
});

test('galería: un tipo FUERA del enum se rechaza (no cualquier string en `tipo`)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosGaleria: { items: [{ url: '/a.jpg', tipo: 'audio' }] } }));
});
