import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion, aplicarPreset } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { DEFAULTS, mezclarBorrador, resolverVolverArriba, resolverRielSocial } from '../../lib/config/site-content-defaults';
import { CORTE } from '../../lib/config/themes';

// EL VIAJE DE PUNTA A PUNTA de DETALLES DEL SITIO (§ PANEL-DETALLES-SITIO-1). `volverArriba`/
// `rielSocial` NO son secciones del REGISTRY (§ site-content-defaults.ts — `SeccionKey` las excluye),
// así que el gate `seccion in REGISTRY` del route GENÉRICO (`app/api/site-content/route.ts:88`)
// rechazaría publicarlas/descartarlas con 400: sin ESTE viaje probado, el botón "Publicar" de
// `DetallesSitioSeccion.tsx` fallaría SIEMPRE, y un test que sólo renderizara el componente no lo
// vería — un botón que promete publicar y siempre da 400 se ve idéntico a uno que funciona hasta que
// alguien lo aprieta. Corre contra Postgres real, la MISMA secuencia que la ruta propia
// (`app/api/site-content/detalles/route.ts`, patrón `tema`/`encabezado`): parsear con el schema
// real → `guardarBorrador` → `publicarSeccion`/`descartarSeccion` de las DOS metas → releer con
// `readSiteContent`/el mismo cómputo de `sinPublicar` que usa el GET propio de la ruta.
//
// DESVIACIÓN DE UBICACIÓN (medida, no del spec): el `touches:` de este slice nombraba
// `lib/config/detalles-sitio.test.ts`, pero ESE path cae bajo el glob DB-FREE del carril rápido
// (`"lib/**/*.test.ts"`, `package.json`) — un test que hable con Postgres ahí rompería `npm test`
// (capa 1, sin base) para TODOS (§ CLAUDE.md, "El carril rápido cubre `app/`": "Un test de `app/` que
// necesite Postgres real va a `tests/integracion/`, no co-ubicado con la ruta — si no, rompe el
// carril rápido para todos"; la MISMA regla, aplicada a `lib/` en vez de `app/` — el MISMO precedente
// ya medido por `PANEL-EDITOR-ENCABEZADO-1` para `panel-encabezado.test.ts`, § DECISIONS.md). El
// único glob que `scripts/test-integracion.sh` recorre es `tests/integracion/**/*.test.ts`
// (`node --test ... "tests/integracion/**/*.test.ts"`), así que este archivo vive ACÁ para que
// `npm run test:integracion` lo ejecute de verdad.

const DETALLES_SCHEMA = siteContentEditableSchema.pick({ volverArriba: true, rielSocial: true });
const METAS_DETALLES = ['volverArriba', 'rielSocial'] as const;

/** Simula EXACTAMENTE el PUT de la ruta: parsea el body con el schema real, ACOTADO a las dos claves
 *  de Detalles del sitio (como hace la ruta con `.pick()`), y guarda el resultado en el borrador. */
async function guardarComoLaRuta(body: unknown) {
  const parsed = DETALLES_SCHEMA.parse(body);
  return guardarBorrador(parsed);
}

/** Simula EXACTAMENTE el POST `{accion:'publicar'}` de la ruta: publica las DOS metas, una por una
 *  (§ no-atómico, docstring de la ruta). */
async function publicarComoLaRuta() {
  for (const meta of METAS_DETALLES) await publicarSeccion(meta);
}

/** Gemelo de arriba para `{accion:'descartar'}`. */
async function descartarComoLaRuta() {
  for (const meta of METAS_DETALLES) await descartarSeccion(meta);
}

/** Simula EXACTAMENTE el GET propio de la ruta: lee la fila, mezcla borrador sobre publicado, y
 *  computa `sinPublicar` como `algún META en el borrador` — mismo cómputo que
 *  `app/api/site-content/detalles/route.ts`. */
async function leerComoLaRuta() {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  const content = (row?.content ?? {}) as Record<string, unknown>;
  const borrador = (row?.borrador ?? {}) as Record<string, unknown>;
  const merged = mezclarBorrador(content, borrador) as { volverArriba?: unknown; rielSocial?: unknown };
  return {
    contenido: {
      volverArriba: resolverVolverArriba(merged.volverArriba, DEFAULTS.volverArriba),
      rielSocial: resolverRielSocial(merged.rielSocial, DEFAULTS.rielSocial),
    },
    sinPublicar: METAS_DETALLES.some((m) => m in borrador),
  };
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

test('guardar: las dos metas quedan en el BORRADOR y sinPublicar es true', async () => {
  await guardarComoLaRuta({
    volverArriba: { visible: true },
    rielSocial: { visible: true },
  });

  const { contenido, sinPublicar } = await leerComoLaRuta();
  assert.equal(sinPublicar, true, 'la píldora "Sin publicar" debe prenderse');
  // Draft-merged: el GET propio de la ruta lee el borrador ENCIMA de lo publicado.
  assert.equal(contenido.volverArriba.visible, true);
  assert.equal(contenido.rielSocial.visible, true);

  // Y lo PUBLICADO todavía NO cambió — guardar el borrador no publica.
  const publicado = await readSiteContent();
  assert.equal(publicado.volverArriba.visible, false, 'guardar el borrador no debe tocar lo publicado');
  assert.equal(publicado.rielSocial.visible, false);
});

test('publicar: content.{volverArriba,rielSocial} quedan actualizadas y el borrador de las DOS queda limpio', async () => {
  await guardarComoLaRuta({
    volverArriba: { visible: true },
    rielSocial: { visible: true },
  });
  await publicarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.volverArriba.visible, true);
  assert.equal(publicado.rielSocial.visible, true);

  const { sinPublicar } = await leerComoLaRuta();
  assert.equal(sinPublicar, false, 'publicar debe limpiar el borrador de las dos metas');
});

test('descartar: el borrador se limpia SIN tocar lo publicado', async () => {
  // Semilla: Detalles del sitio ya PUBLICADO con los switches encendidos…
  await guardarComoLaRuta({
    volverArriba: { visible: true },
    rielSocial: { visible: true },
  });
  await publicarComoLaRuta();

  // …y un borrador nuevo que los APAGA, sin publicar.
  await guardarComoLaRuta({
    volverArriba: { visible: false },
    rielSocial: { visible: false },
  });
  await descartarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.volverArriba.visible, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.rielSocial.visible, true, 'descartar no debe tocar lo YA publicado');

  const { sinPublicar } = await leerComoLaRuta();
  assert.equal(sinPublicar, false, 'descartar debe limpiar el borrador');
});

test('default del preset: los dos controles arrancan con el valor que puso mergePresetEnContent', async () => {
  // CORTE es el ÚNICO preset del catálogo que enciende los dos ejes (§ themes.ts). Esto verifica lo
  // que DetallesSitioSeccion.tsx lee al abrir por primera vez sobre un tenant con este preset: los
  // switches YA prendidos, sin que el dueño haya tocado nada — "el preset pone el punto de partida".
  await aplicarPreset(CORTE);

  const publicado = await readSiteContent();
  assert.equal(publicado.volverArriba.visible, true);
  assert.equal(publicado.rielSocial.visible, true);
});

test('cada meta se puede publicar/descartar de forma INDEPENDIENTE de la otra (guarda sólo esa clave)', async () => {
  // El dueño toca SÓLO el switch de volver arriba — el body no trae `rielSocial`, como hace `wireDe`
  // de DetallesSitioSeccion.tsx en cada guardado real (manda las DOS metas completas, pero esto
  // prueba que el mecanismo de guardado no las EXIGE juntas).
  await guardarComoLaRuta({ volverArriba: { visible: true } });
  await publicarSeccion('volverArriba');

  const publicado = await readSiteContent();
  assert.equal(publicado.volverArriba.visible, true);
  assert.equal(publicado.rielSocial.visible, false, 'el otro eje no se tocó');
});
