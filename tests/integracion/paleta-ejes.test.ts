import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { paletaEditableSchema } from '../../lib/config/palette-schema';
import { guardarTemaBorrador, publicarSeccion, aplicarPreset } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { CORTE } from '../../lib/config/themes';

// EL VIAJE DE PUNTA A PUNTA de GUARDAR UN COLOR desde la sección Paleta (§ PALETA-GUARDAR-CONSERVA-
// EJES-1). El bug vivía en que `guardarTemaBorrador` reemplazaba `borrador.tema` ENTERO con los cinco
// campos que el panel edita (fondo/tinta/acento/fuentePar/forma), así que al PUBLICAR, un tenant con
// un preset como CORTE —el único del catálogo que declara `origenTexto`/`origenAccion`/
// `escalaDisplay`, § themes.ts— perdía esos tres ejes EN SILENCIO: la tienda seguía mostrando colores,
// pero con el color de texto y de acción derivados de la raíz equivocada. Este test corre la MISMA
// secuencia que la ruta real (`app/api/site-content/tema/route.ts`): parsear con el schema real
// (`paletaEditableSchema`, donde el PUT viejo mandaba sólo esos cinco campos) → `guardarTemaBorrador`
// → `publicarSeccion('tema')` → releer con `readSiteContent`.
//
// Un test que llame a `guardarTemaBorrador` con un objeto `TemaContent` completo a mano NO atraparía
// esto: el bug es justamente que el PANEL no conoce esos tres campos, así que nunca los manda — hay
// que pasar por `paletaEditableSchema` como hace el route, igual que `presentaciones-viaje.test.ts`
// pasa por `siteContentEditableSchema`.

/** Simula EXACTAMENTE el PUT de `/api/site-content/tema`: parsea el body con el schema real y mapea
 *  las claves wire (`paletaFondo`…) a las de `content.tema` (`fondo`…), como hace el route. */
async function guardarComoLaRuta(body: unknown) {
  const d = paletaEditableSchema.parse(body);
  return guardarTemaBorrador({ fondo: d.paletaFondo, tinta: d.paletaTinta, acento: d.paletaAcento, fuentePar: d.fuentePar, forma: d.forma });
}

/** Simula EXACTAMENTE el POST `{accion:'publicar'}` de la ruta. */
async function publicarComoLaRuta() {
  await publicarSeccion('tema');
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

test('guardar un color desde Paleta sobre un tenant con CORTE no borra origenTexto/origenAccion/escalaDisplay', async () => {
  // CORTE declara los TRES ejes aditivos (§ themes.ts): origenTexto:'tinta', origenAccion:'acento',
  // escalaDisplay:'amplia', aplicados DIRECTO a lo publicado (`aplicarPreset`, el runbook — no pasa
  // por el panel).
  await aplicarPreset(CORTE);
  const antes = await readSiteContent();
  assert.equal(antes.tema.fondo, '#fdfbf7', 'sanity: CORTE puso sus raíces');
  assert.equal(antes.tema.origenTexto, 'tinta', 'sanity: CORTE puso origenTexto');
  assert.equal(antes.tema.origenAccion, 'acento', 'sanity: CORTE puso origenAccion');
  assert.equal(antes.tema.escalaDisplay, 'amplia', 'sanity: CORTE puso escalaDisplay');

  // El dueño abre /admin/tienda y cambia SÓLO el fondo desde la pieza "Colores y tipografía" —el
  // wire manda el objeto COMPLETO de los CINCO campos que el panel controla (§ wireDe,
  // PaletaSeccion.tsx), con tinta/acento/fuentePar/forma reenviados tal cual estaban.
  await guardarComoLaRuta({
    paletaFondo: '#ffffff', paletaTinta: '#102407', paletaAcento: '#a70004',
    fuentePar: 'prensa', forma: 'recta',
  });
  await publicarComoLaRuta();

  const despues = await readSiteContent();
  assert.equal(despues.tema.fondo, '#ffffff', 'el color SÍ cambió — el guardado funcionó');
  assert.equal(despues.tema.origenTexto, 'tinta', 'origenTexto del preset NO debe borrarse al guardar un color');
  assert.equal(despues.tema.origenAccion, 'acento', 'origenAccion del preset NO debe borrarse al guardar un color');
  assert.equal(despues.tema.escalaDisplay, 'amplia', 'escalaDisplay del preset NO debe borrarse al guardar un color');
});

test('"Volver a los colores de fábrica" (nulls en los 5 campos) tampoco borra los ejes del preset', async () => {
  // `resetFabrica` (PaletaSeccion.tsx) manda las 3 raíces + fuentePar + forma en null — el MISMO PUT,
  // mismo `guardarTemaBorrador`. Su propio docstring sólo promete resetear "las 3 raíces Y el par" (y
  // la forma) a fábrica; nunca mencionó los ejes aditivos del preset, que el panel ni siquiera conoce
  // — así que preservarlos acá es consistente con lo que ese botón siempre dijo hacer, no una
  // ampliación de alcance.
  await aplicarPreset(CORTE);

  await guardarComoLaRuta({ paletaFondo: null, paletaTinta: null, paletaAcento: null, fuentePar: null, forma: null });
  await publicarComoLaRuta();

  const despues = await readSiteContent();
  assert.equal(despues.tema.fondo, null, 'las raíces SÍ vuelven a fábrica (null)');
  assert.equal(despues.tema.fuentePar, null, 'el par SÍ vuelve a fábrica (Editorial)');
  assert.equal(despues.tema.origenTexto, 'tinta', 'origenTexto del preset sigue vivo tras "volver a fábrica"');
  assert.equal(despues.tema.origenAccion, 'acento', 'origenAccion del preset sigue vivo tras "volver a fábrica"');
  assert.equal(despues.tema.escalaDisplay, 'amplia', 'escalaDisplay del preset sigue vivo tras "volver a fábrica"');
});
