import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { siteContentEditableSchema } from './site-content-schema';
import { DEFAULTS, REGISTRY, type SeccionKey } from './site-content-defaults';

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

// ─── VARIANTES DE COMPOSICIÓN (§ eje 5e): `variante` de presentaciones SOBREVIVE al parse ────────
test('presentaciones: `variante` SOBREVIVE al parse (si no, zod la descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ presentaciones: { variante: 'indice' } });
  assert.equal(parsed.presentaciones!.variante, 'indice');
});

// ─── EL DERIVADO (§ Backlog #65-B, FIX 3): modelo ⊆ schema, sin una tercera lista a mano ─────────
// Los tests de arriba prueban ÍTEM POR ÍTEM lo que sobrevive/se rechaza (la mitad de repeater). Éste
// cierra la OTRA brecha —la que costó #65-B—: que TODO campo de PRIMER NIVEL del modelo esté en el
// schema. Compara el MODELO (los campos de `DEFAULTS[seccion]`, la instancia REAL) contra el `.shape`
// de cada sub-schema. Un campo del modelo que el schema no declara se STRIPPEA EN SILENCIO al guardar
// → pérdida de dato en cada ciclo (fue `categoria1/2` + los slots 3-4 de presentaciones, congelados
// desde C1 mientras el modelo creció). FALLA nombrando el campo, así que agregar un campo al modelo
// obliga a declararlo en el schema. DERIVADO de fuentes que ya existen (DEFAULTS + el `.shape`), no
// una tercera lista.
//
// ALCANCE: campos de PRIMER NIVEL. Los de ÍTEM de los repeaters no se derivan de `DEFAULTS` (arrays
// vacíos) — los cubren los tests de arriba, a mano, con su comentario. Limitación NOMBRADA.
const camposDelSchema = (seccion: SeccionKey): Set<string> => {
  const sub = siteContentEditableSchema.shape[seccion];
  const obj = (sub as z.ZodOptional<z.ZodObject<z.ZodRawShape>>).unwrap();
  return new Set(Object.keys(obj.shape));
};

test('todo campo del MODELO está en el schema editable (sin strip silencioso)', () => {
  for (const seccion of Object.keys(REGISTRY) as SeccionKey[]) {
    const camposModelo = Object.keys(DEFAULTS[seccion]);
    const enSchema = camposDelSchema(seccion);
    const faltantes = camposModelo.filter(c => !enSchema.has(c));
    assert.deepEqual(faltantes, [],
      `«${seccion}»: campos del modelo que el schema editable STRIPPEA (agrégalos a site-content-schema.ts): ${faltantes.join(', ')}`);
  }
});

// ─── ESQUEMAS (§ eje 5b, mitad B): declarada como meta — sin STRIP silencioso, aunque hoy no
// exista editor que la escriba (SIN PICKER, decisión del owner) ─────────────────────────────
test('esquemas: un mapa banda→esquema válido SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ esquemas: { hero: 'oscuro', trustBadges: 'acento' } });
  assert.deepEqual(parsed.esquemas, { hero: 'oscuro', trustBadges: 'acento' });
});

test('esquemas: un VALOR fuera del set cerrado de 4 se rechaza (a diferencia del resolver, que la absorbe SOFT)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ esquemas: { hero: 'neon' } }));
});

// ─── ORDEN (§ eje 5, parte c): declarada como meta — sin STRIP silencioso, dominio CERRADO ────────

test('orden: un array VÁLIDO de bandaIds conocidos SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ orden: ['presentaciones', 'hero', 'featured'] });
  assert.deepEqual(parsed.orden, ['presentaciones', 'hero', 'featured']);
});

test('orden: un id FUERA del set cerrado se rechaza (a diferencia del resolver, que la absorbe SOFT)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'unaSeccionQueNoExiste'] }));
});

test('orden: una banda REPETIDA se rechaza (el write es más estricto que el loader, que dedupe)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'featured', 'hero'] }));
});

test('orden: un array PARCIAL (no las 7) se acepta — el schema no exige completitud, el resolver la garantiza', () => {
  const parsed = siteContentEditableSchema.parse({ orden: ['hero'] });
  assert.deepEqual(parsed.orden, ['hero']);
});

test('orden: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.orden, undefined);
});
