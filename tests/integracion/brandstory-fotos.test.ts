import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de brandStory (§ CORTE-HISTORIA-COLOR-FOTOS-1): el collage dejó de ser
// 4 fotos FIJAS y pasó a 1-4 — `imagen1` sigue REQUERIDA (mínimo una foto); `imagen2/3/4` pasaron a
// OPCIONALES (vacías se OMITEN, nunca rellenadas por el resolver). El schema editable SIEMPRE fue
// `z.string().optional()` para las cuatro (SOFT, § site-content-schema.ts) — quien decide
// requerido/opcional es el RESOLVER (`REGISTRY.brandStory.campos`, `resolverSiteContent`), así que
// hay que pasar por el viaje completo (schema → guardar borrador → publicar → releer) para afirmar
// el comportamiento real, no sólo el resolver aislado (mismo criterio que
// `presentaciones-viaje.test.ts`, que existe por la misma razón sobre otra sección).

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// Simula EXACTAMENTE el paso del route: parsea el body con el schema real y guarda el resultado.
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ brandStory: data });
  await guardarBorrador(parsed);
}

test('con tres imágenes llenas y una vacía, la Historia resuelve TRES — imagen3 opcional vacía sobrevive el viaje sin caer al default', async () => {
  await guardarComoElRoute({
    titulo: 'Nuestra historia real',
    parrafo1: 'Un párrafo real',
    imagen1: 'https://blob.example/imagen1.jpg',
    imagen2: 'https://blob.example/imagen2.jpg',
    imagen3: '',
    imagen4: 'https://blob.example/imagen4.jpg',
  });
  await publicarSeccion('brandStory');

  const bs = (await readSiteContent()).brandStory;
  assert.equal(bs.imagen1, 'https://blob.example/imagen1.jpg');
  assert.equal(bs.imagen2, 'https://blob.example/imagen2.jpg');
  assert.equal(bs.imagen3, '', 'imagen3 vacía debe sobrevivir el schema y el publish — opcional NO cae al default');
  assert.equal(bs.imagen4, 'https://blob.example/imagen4.jpg');
  // Sanity: si el bug reapareciera (imagen3 tratada como requerida), caería acá — distinto del
  // string vacío que se afirma arriba.
  assert.notEqual(bs.imagen3, DEFAULTS.brandStory.imagen3);
});

test('con las cuatro llenas, la Historia resuelve las CUATRO (byte-idéntico al default, sin fila guardada)', async () => {
  // Sin guardar nada: DEFAULTS.brandStory ya trae las 4 fotos de Nayoli llenas — el mismo caso que
  // corre en producción hoy (nadie vació ninguna).
  const bs = (await readSiteContent()).brandStory;
  assert.equal(bs.imagen1, DEFAULTS.brandStory.imagen1);
  assert.equal(bs.imagen2, DEFAULTS.brandStory.imagen2);
  assert.equal(bs.imagen3, DEFAULTS.brandStory.imagen3);
  assert.equal(bs.imagen4, DEFAULTS.brandStory.imagen4);
});

test('imagen1 (REQUERIDA) vacía cae al default; imagen2/3/4 (OPCIONALES) vacías se omiten — la distinción sobrevive el viaje completo', async () => {
  await guardarComoElRoute({ imagen1: '', imagen2: '', imagen3: '', imagen4: '' });
  await publicarSeccion('brandStory');

  const bs = (await readSiteContent()).brandStory;
  assert.equal(bs.imagen1, DEFAULTS.brandStory.imagen1, 'imagen1 vacía debe caer al default: sigue siendo la única requerida');
  assert.equal(bs.imagen2, '', 'imagen2 vacía se omite, no cae al default');
  assert.equal(bs.imagen3, '', 'imagen3 vacía se omite, no cae al default');
  assert.equal(bs.imagen4, '', 'imagen4 vacía se omite, no cae al default');
});
