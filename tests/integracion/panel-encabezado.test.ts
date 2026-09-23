import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion, aplicarPreset } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { CORTE } from '../../lib/config/themes';

// EL VIAJE DE PUNTA A PUNTA del ENCABEZADO (§ PANEL-EDITOR-ENCABEZADO-1). `cromo`/`navWordmark`/
// `navTratamiento` NO son secciones del REGISTRY (§ site-content-defaults.ts — `SeccionKey` las
// excluye), así que el gate `seccion in REGISTRY` del route GENÉRICO
// (`app/api/site-content/route.ts:88`) rechazaría publicarlas/descartarlas con 400: sin ESTE viaje
// probado, el botón "Publicar" de `EncabezadoSeccion.tsx` fallaría SIEMPRE, y un test que sólo
// renderizara el componente no lo vería — un botón que promete publicar y siempre da 400 se ve
// idéntico a uno que funciona hasta que alguien lo aprieta. Por eso este test corre contra Postgres
// real, la MISMA secuencia que la ruta propia (`app/api/site-content/encabezado/route.ts`, patrón
// `tema/route.ts`): parsear con el schema real → `guardarBorrador` → `publicarSeccion`/
// `descartarSeccion` de las TRES metas → releer con `readSiteContent`/`readSiteContentParaEditor`.
//
// DEVIACIÓN DE UBICACIÓN (medida, no del spec): el touches de este slice nombraba
// `lib/config/panel-encabezado.test.ts`, pero ESE path cae bajo el glob DB-FREE del carril rápido
// (`"lib/**/*.test.ts"`, `package.json`) — un test que hable con Postgres ahí rompería `npm test`
// para TODOS (§ CLAUDE.md, "El carril rápido cubre `app/`": "Un test de `app/` que necesite Postgres
// real va a `tests/integracion/`, no co-ubicado con la ruta — si no, rompe el carril rápido para
// todos"; la MISMA regla, aplicada a `lib/` en vez de `app/`). El único glob que
// `scripts/test-integracion.sh` recorre es `tests/integracion/**/*.test.ts`
// (`node --test ... "tests/integracion/**/*.test.ts"`), así que este archivo vive ACÁ para que
// `npm run test:integracion` lo ejecute de verdad.

const ENCABEZADO_SCHEMA = siteContentEditableSchema.pick({ cromo: true, navWordmark: true, navTratamiento: true });
const METAS_ENCABEZADO = ['cromo', 'navWordmark', 'navTratamiento'] as const;

/** Simula EXACTAMENTE el PUT de la ruta: parsea el body con el schema real, ACOTADO a las tres
 *  claves del Encabezado (como hace la ruta con `.pick()`), y guarda el resultado en el borrador. */
async function guardarComoLaRuta(body: unknown) {
  const parsed = ENCABEZADO_SCHEMA.parse(body);
  return guardarBorrador(parsed);
}

/** Simula EXACTAMENTE el POST `{accion:'publicar'}` de la ruta: publica las TRES metas, una por
 *  una (§ no-atómico, docstring de la ruta). */
async function publicarComoLaRuta() {
  for (const meta of METAS_ENCABEZADO) await publicarSeccion(meta);
}

/** Gemelo de arriba para `{accion:'descartar'}`. */
async function descartarComoLaRuta() {
  for (const meta of METAS_ENCABEZADO) await descartarSeccion(meta);
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

test('guardar: las tres metas quedan en el BORRADOR y sinPublicar.encabezado es true', async () => {
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: true, navBadge: '' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true },
  });

  const { contenido, sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, true, 'la píldora "Sin publicar" debe prenderse');
  // Draft-merged: el editor lee el borrador ENCIMA de lo publicado, así que ya refleja el cambio.
  assert.equal(contenido.cromo.navTinta, true);
  assert.equal(contenido.cromo.navSubtitulo, true);
  assert.equal(contenido.navWordmark.activo, true);
  assert.equal(contenido.navTratamiento.activo, true);

  // Y lo PUBLICADO todavía NO cambió — guardar el borrador no publica.
  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, false, 'guardar el borrador no debe tocar lo publicado');
  assert.equal(publicado.navWordmark.activo, false);
});

test('publicar: content.{cromo,navWordmark,navTratamiento} quedan actualizadas y el borrador de las TRES queda limpio', async () => {
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: true, navBadge: '' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true },
  });
  await publicarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, true);
  assert.equal(publicado.cromo.navSubtitulo, true);
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navTratamiento.activo, true);

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, false, 'publicar debe limpiar el borrador de las tres metas');
});

test('descartar: el borrador se limpia SIN tocar lo publicado', async () => {
  // Semilla: un Encabezado ya PUBLICADO con los switches encendidos…
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: true, navBadge: '' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true },
  });
  await publicarComoLaRuta();

  // …y un borrador nuevo que los APAGA, sin publicar.
  await guardarComoLaRuta({
    cromo: { navTinta: false, navSubtitulo: false, navBadge: '' },
    navWordmark: { activo: false },
    navTratamiento: { activo: false },
  });
  await descartarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navTratamiento.activo, true);

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, false, 'descartar debe limpiar el borrador');
});

test('default del preset: los cuatro controles arrancan con el valor que puso mergePresetEnContent', async () => {
  // CORTE es el ÚNICO preset del catálogo que enciende los cuatro ejes (§ themes.ts). Esto verifica
  // lo que EncabezadoSeccion.tsx lee al abrir por primera vez sobre un tenant con este preset: los
  // switches YA prendidos, sin que el dueño haya tocado nada — "el preset pone el punto de partida".
  await aplicarPreset(CORTE);

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, true);
  assert.equal(publicado.cromo.navSubtitulo, true);
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navTratamiento.activo, true);
});

test('publicar el Encabezado NO borra cromo.navBadge puesto por un preset — se reenvía sin editarlo', async () => {
  // El write reemplaza la clave `cromo` ENTERA (spread por clave top-level, § site-content-write.ts):
  // si el guardado del Encabezado no reenviara `navBadge`, publicar lo borraría en silencio la
  // primera vez que el dueño toque cualquiera de los OTROS tres switches. `EncabezadoSeccion.tsx` lo
  // evita leyendo el `navBadge` vigente y reenviándolo tal cual en cada guardado (§ su docstring) —
  // esto prueba esa garantía al nivel del write, contra Postgres real.
  await aplicarPreset(CORTE); // navBadge = 'Cosecha 2026'

  await guardarComoLaRuta({
    // El dueño sólo apaga el color del nav; `navSubtitulo`/`navBadge` viajan REENVIADOS con su valor
    // VIGENTE, como hace el componente (nunca a medias).
    cromo: { navTinta: false, navSubtitulo: true, navBadge: 'Cosecha 2026' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true },
  });
  await publicarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navBadge, 'Cosecha 2026', 'el navBadge del preset no debe perderse');
  assert.equal(publicado.cromo.navTinta, false, 'y el cambio que sí se pidió se aplicó');
});
