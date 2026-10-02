import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { DEFAULTS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA del LOGO SUBIDO (§ MARCA-LOGO-IMAGEN-1): subir/guardar/publicar/releer,
// contra Postgres real. `logo` es una SECCIÓN de verdad del REGISTRY (mismo precedente que `menu`/
// `footer`, § site-content-defaults.ts) agrupada dentro del flujo borrador/publicar del Encabezado
// (`app/api/site-content/encabezado/route.ts`) — el viaje de las OTRAS cuatro claves de ese bloque
// (`cromo`/`navWordmark`/`navTratamiento`/`navDrawerMovil`) ya lo cubre
// `panel-encabezado.test.ts`; éste se enfoca en lo que es PROPIO de `logo`: las imágenes, su
// borrado de blobs, y que el resolver nunca cae a un default inventado (vacío ⇒ sin logo, nunca un
// string de relleno).
//
// "SUBIR" no se prueba acá: la subida DIRECTA a Blob (§ subirDirecto) es una llamada de red real,
// que el carril no hace (§ CLAUDE.md, "el carril no monta HTTP"). Lo que SÍ se prueba es el único
// tramo que el carril puede afirmar de verdad: qué pasa con las URLs una vez que ya están en el
// body — exactamente lo que `guardarComoLaRuta` simula abajo, reusando el schema REAL.

const LOGO_SCHEMA = siteContentEditableSchema.pick({ logo: true });

/** Simula EXACTAMENTE el tramo de `logo` del PUT de la ruta: parsea con el schema real y guarda. */
async function guardarComoLaRuta(logo: { oscuro?: string; claro?: string; alt?: string; modo?: string }) {
  const parsed = LOGO_SCHEMA.parse({ logo });
  return guardarBorrador(parsed);
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// ── Sin fila — byte-idéntico a HOY (Nayoli, sin logo) ───────────────────────────────────────────

test('sin fila guardada: readSiteContent().logo resuelve a las claves vacías (el caso de HOY)', async () => {
  const publicado = await readSiteContent();
  assert.deepEqual(publicado.logo, DEFAULTS.logo);
  assert.equal(publicado.logo.oscuro, '');
  assert.equal(publicado.logo.claro, '');
  assert.equal(publicado.logo.alt, '');
  assert.equal(publicado.logo.modo, '', '§ NAV-LOGO-Y-NOMBRE-1 — sin fila, el modo también es el default vacío');
});

// ── El viaje completo: guardar → publicar → releer ──────────────────────────────────────────────

test('guardar: logo queda en el BORRADOR, sin tocar lo PUBLICADO', async () => {
  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-oscuro.svg', claro: 'https://blob.example/logo-claro.png', alt: 'Logo de Café Las Chamisas' });

  const { contenido, sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.logo, true, 'sinPublicar.logo (derivado del REGISTRY) debe prenderse');
  assert.equal(contenido.logo.oscuro, 'https://blob.example/logo-oscuro.svg');
  assert.equal(contenido.logo.claro, 'https://blob.example/logo-claro.png');
  assert.equal(contenido.logo.alt, 'Logo de Café Las Chamisas');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, '', 'guardar el borrador no debe tocar lo publicado');
  assert.equal(publicado.logo.claro, '', 'guardar el borrador no debe tocar lo publicado');
});

test('publicar: content.logo queda actualizado y el borrador se limpia', async () => {
  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-oscuro.svg', claro: 'https://blob.example/logo-claro.png', alt: 'Logo de Café Las Chamisas' });
  await publicarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, 'https://blob.example/logo-oscuro.svg');
  assert.equal(publicado.logo.claro, 'https://blob.example/logo-claro.png');
  assert.equal(publicado.logo.alt, 'Logo de Café Las Chamisas');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.logo, false, 'publicar debe limpiar el borrador de logo');
});

test('descartar: el borrador se limpia SIN tocar lo YA publicado', async () => {
  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-viejo.svg', claro: '', alt: '' });
  await publicarSeccion('logo');

  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-nuevo.svg', claro: '', alt: '' });
  await descartarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, 'https://blob.example/logo-viejo.svg', 'descartar no debe tocar lo YA publicado');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.logo, false, 'descartar debe limpiar el borrador');
});

// ── Las DOS versiones son independientes — una vacía no arrastra a la otra ──────────────────────

test('subir SÓLO la versión oscura deja la clara vacía — opcional, nunca cae a un default inventado', async () => {
  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-oscuro.svg', claro: '', alt: '' });
  await publicarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, 'https://blob.example/logo-oscuro.svg');
  assert.equal(publicado.logo.claro, '', 'sin la versión clara, el campo se omite — nunca un string de relleno');
});

test('subir SÓLO la versión clara deja la oscura vacía', async () => {
  await guardarComoLaRuta({ oscuro: '', claro: 'https://blob.example/logo-claro.png', alt: '' });
  await publicarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, '');
  assert.equal(publicado.logo.claro, 'https://blob.example/logo-claro.png');
});

// ── El BORRADO DE BLOBS — genérico, sin código propio en la ruta (§ el asiento de este slice) ───

test('reemplazar UNA versión deja HUÉRFANA sólo la reemplazada — la otra sigue en uso', async () => {
  await guardarComoLaRuta({ oscuro: 'A-oscuro.svg', claro: 'X-claro.svg', alt: '' });
  await publicarSeccion('logo');

  await guardarComoLaRuta({ oscuro: 'B-oscuro.svg', claro: 'X-claro.svg', alt: '' });
  const { blobsABorrar } = await publicarSeccion('logo');

  assert.deepEqual(blobsABorrar, ['A-oscuro.svg'], 'sólo la versión reemplazada queda huérfana; X-claro.svg sigue publicada');
});

test('quitar las DOS versiones (logo retirado) deja las DOS huérfanas', async () => {
  await guardarComoLaRuta({ oscuro: 'A-oscuro.svg', claro: 'A-claro.svg', alt: 'Mi logo' });
  await publicarSeccion('logo');

  await guardarComoLaRuta({ oscuro: '', claro: '', alt: '' });
  const { blobsABorrar } = await publicarSeccion('logo');

  assert.deepEqual(blobsABorrar.sort(), ['A-claro.svg', 'A-oscuro.svg']);

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, '');
  assert.equal(publicado.logo.claro, '');
});

test('guardar un borrador que REEMPLAZA una imagen YA PUBLICADA no la libera todavía — EN USO = content ∪ borrador', async () => {
  // § site-content-blobs.ts: "diffear contra la vista MEZCLADA borraría una imagen reemplazada en
  // el borrador que sigue publicada". A sigue publicada (`content.logo.oscuro`) mientras el dueño
  // edita el borrador — borrarla ahora sería borrar un blob que la tienda en vivo sigue sirviendo.
  await guardarComoLaRuta({ oscuro: 'A-oscuro.svg', claro: '', alt: '' });
  await publicarSeccion('logo');

  const { blobsABorrar } = await guardarComoLaRuta({ oscuro: 'B-oscuro.svg', claro: '', alt: '' });
  assert.deepEqual(blobsABorrar, [], 'A sigue PUBLICADA (content.logo.oscuro); guardar el borrador no la toca');

  // Recién al PUBLICAR el borrador (B reemplaza a A en content) A deja de estar en uso.
  const { blobsABorrar: alPublicar } = await publicarSeccion('logo');
  assert.deepEqual(alPublicar, ['A-oscuro.svg']);
});

// ── El schema es DEFENSIVO (§ #65-B): un logo con basura no debe colarse ─────────────────────────

test('el schema rechaza un tipo equivocado en vez de aceptarlo en silencio', () => {
  assert.throws(() => LOGO_SCHEMA.parse({ logo: { oscuro: 123, claro: '', alt: '' } }));
});

test('el schema acepta logo ausente (ningún campo tocado) sin romper el parse', () => {
  const parsed = LOGO_SCHEMA.parse({});
  assert.equal(parsed.logo, undefined);
});

// ── `modo` (§ NAV-LOGO-Y-NOMBRE-1) — el viaje completo, contra Postgres real ─────────────────────

test('el schema acepta "" explícito en modo sin rechazarlo — NO es z.enum (el form lo manda en cada guardado, aun sin elegir nada)', () => {
  const parsed = LOGO_SCHEMA.parse({ logo: { oscuro: '', claro: '', alt: '', modo: '' } });
  assert.equal(parsed.logo?.modo, '');
});

test('guardar: modo queda en el BORRADOR, sin tocar lo PUBLICADO', async () => {
  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-oscuro.svg', claro: '', alt: '', modo: 'logoYNombre' });

  const { contenido, sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.logo, true);
  assert.equal(contenido.logo.modo, 'logoYNombre');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.modo, '', 'guardar el borrador no debe tocar lo publicado');
});

test('publicar: content.logo.modo queda actualizado', async () => {
  await guardarComoLaRuta({ oscuro: 'https://blob.example/logo-oscuro.svg', claro: '', alt: '', modo: 'logoYNombre' });
  await publicarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.modo, 'logoYNombre');
});

test('descartar: el modo del borrador se limpia SIN tocar el modo YA publicado', async () => {
  await guardarComoLaRuta({ oscuro: 'A.svg', claro: '', alt: '', modo: 'soloNombre' });
  await publicarSeccion('logo');

  await guardarComoLaRuta({ oscuro: 'A.svg', claro: '', alt: '', modo: 'logoYNombre' });
  await descartarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.modo, 'soloNombre', 'descartar no debe tocar el modo YA publicado');
});

test('modo se puede guardar/publicar de forma INDEPENDIENTE de las imágenes — un campo más de la MISMA sección', async () => {
  // Sin ninguna imagen subida, elegir 'soloNombre' explícito es la elección "nada cambia, pero lo
  // digo yo" — § modoLogoResuelto, marca-logo.ts: con logo ausente el default YA es 'soloNombre',
  // así que esto afirma que el dato persiste igual aunque coincida con el default.
  await guardarComoLaRuta({ oscuro: '', claro: '', alt: '', modo: 'soloNombre' });
  await publicarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, '');
  assert.equal(publicado.logo.modo, 'soloNombre');
});
