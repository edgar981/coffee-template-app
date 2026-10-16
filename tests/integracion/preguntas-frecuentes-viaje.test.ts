import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { agruparPreguntas } from '../../lib/storefront/preguntas-frecuentes';
import { preguntasFrecuentesVisible } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de /preguntas-frecuentes (§ PREGUNTAS-FRECUENTES-1), MISMO patrón que
// `presentaciones-viaje.test.ts`: el editor manda el form → el ROUTE lo pasa por
// `siteContentEditableSchema` (donde zod strippearía un campo no declarado) → `guardarBorrador` →
// `publicarSeccion` → y el visitante lo lee por `readSiteContent`. Un test que llame a
// `guardarBorrador` directo no atraparía un campo olvidado en el schema — hay que pasar por el
// schema real, como el route.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ preguntasFrecuentes: data });
  await guardarBorrador(parsed);
}

test('el campo `grupo` de cada pregunta sobrevive borrador→publicar→releer — no lo strippea el schema', async () => {
  await guardarComoElRoute({
    titulo: 'Centro de ayuda',
    items: [
      { grupo: 'Envíos', question: '¿A dónde envían?', answer: 'A todo Colombia.' },
      { grupo: 'Envíos', question: '¿Cuánto cuesta?', answer: 'Desde $9.000.' },
      { grupo: 'Pagos', question: '¿Cómo pago?', answer: 'Nequi o transferencia.' },
    ],
  });
  await publicarSeccion('preguntasFrecuentes');

  const pf = (await readSiteContent()).preguntasFrecuentes;
  assert.equal(pf.items.length, 3, 'las tres filas deben sobrevivir el schema completas');
  assert.equal(pf.items[0].grupo, 'Envíos', 'el campo grupo NO debe strippearse');
  assert.equal(pf.items[2].grupo, 'Pagos');

  // Y "a qué grupo pertenece" se deriva correctamente sobre el dato YA releído de la base.
  const grupos = agruparPreguntas(pf.items);
  assert.deepEqual(grupos.map((g) => g.grupo), ['Envíos', 'Pagos']);
  assert.equal(grupos[0].items.length, 2);
  assert.equal(grupos[1].items.length, 1);
});

test('la composición (variante) elegida sobrevive de punta a punta, no revierte a la canónica', async () => {
  await guardarComoElRoute({
    titulo: 'Preguntas frecuentes',
    items: [{ grupo: 'Envíos', question: '¿A dónde envían?', answer: 'A todo Colombia.' }],
    variante: 'creditos',
  });
  await publicarSeccion('preguntasFrecuentes');

  const pf = (await readSiteContent()).preguntasFrecuentes;
  assert.equal(pf.variante, 'creditos', 'la composición elegida no debe revertir a "lista"');
});

test('una fila a medias (sin respuesta) NO cuenta como grupo visible — hide-on-empty real, no sólo de array', async () => {
  await guardarComoElRoute({
    items: [{ grupo: 'Envíos', question: '¿A dónde envían?', answer: '' }],
  });
  await publicarSeccion('preguntasFrecuentes');

  const content = await readSiteContent();
  // El ARRAY no está vacío (hay 1 fila) — `seccionEsVisible` por sí sola diría "visible" — pero
  // ninguna pregunta está COMPLETA, así que `agruparPreguntas` (lo que de verdad decide si se
  // renderiza algo) da cero grupos.
  assert.equal(content.preguntasFrecuentes.items.length, 1);
  assert.deepEqual(agruparPreguntas(content.preguntasFrecuentes.items), []);
});

test('sin ninguna fila guardada, preguntasFrecuentesVisible da false — "ninguna tienda cambia" hasta cargar preguntas', async () => {
  const content = await readSiteContent();
  assert.equal(content.preguntasFrecuentes.items.length, 0);
  assert.equal(preguntasFrecuentesVisible(content), false);
});

// § PREGUNTAS-FRECUENTES-ARREGLOS-1 — franjaTejido sobrevive el mismo viaje (el schema real, no
// strippearlo; borrador→publicar→releer), y vacío-explícito se OMITE, como cualquier opcional.

test('franjaTejido sobrevive borrador→publicar→releer — no lo strippea el schema', async () => {
  await guardarComoElRoute({
    titulo: 'Lo que nos preguntan',
    items: [{ grupo: 'Envíos', question: '¿A dónde envían?', answer: 'A todo Colombia.' }],
    variante: 'libreta',
    franjaTejido: 'https://blob.example/tejido.jpg',
  });
  await publicarSeccion('preguntasFrecuentes');

  const pf = (await readSiteContent()).preguntasFrecuentes;
  assert.equal(pf.franjaTejido, 'https://blob.example/tejido.jpg');
  assert.equal(pf.variante, 'libreta');
});

test('franjaTejido vacío EXPLÍCITO se OMITE — opcional, nunca inventa un default', async () => {
  await guardarComoElRoute({
    items: [{ grupo: 'Envíos', question: '¿A dónde envían?', answer: 'A todo Colombia.' }],
    franjaTejido: '',
  });
  await publicarSeccion('preguntasFrecuentes');

  const pf = (await readSiteContent()).preguntasFrecuentes;
  assert.equal(pf.franjaTejido, '');
});
