import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion, aplicarPreset } from '../../lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { CORTE } from '../../lib/config/themes';

// EL VIAJE DE PUNTA A PUNTA del ENCABEZADO (§ PANEL-EDITOR-ENCABEZADO-1, ampliado por §
// MUESTRARIO-DRAWER-MOVIL-TEMA-1). `cromo`/`navWordmark`/`navTratamiento`/`navDrawerMovil` NO son
// secciones del REGISTRY (§ site-content-defaults.ts — `SeccionKey` las excluye), así que el gate
// `seccion in REGISTRY` del route GENÉRICO (`app/api/site-content/route.ts:88`) rechazaría
// publicarlas/descartarlas con 400: sin ESTE viaje probado, el botón "Publicar" de
// `EncabezadoSeccion.tsx` fallaría SIEMPRE, y un test que sólo renderizara el componente no lo vería
// — un botón que promete publicar y siempre da 400 se ve idéntico a uno que funciona hasta que
// alguien lo aprieta. Por eso este test corre contra Postgres real, la MISMA secuencia que la ruta
// propia (`app/api/site-content/encabezado/route.ts`, patrón `tema/route.ts`): parsear con el schema
// real → `guardarBorrador` → `publicarSeccion`/`descartarSeccion` de las CUATRO metas → releer con
// `readSiteContent`/`readSiteContentParaEditor`.
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
//
// FUERA DE `touches:` DE `MUESTRARIO-DRAWER-MOVIL-TEMA-1` (medido, no descuido): este archivo ya
// existía (`PANEL-EDITOR-ENCABEZADO-1`) espejando el `.pick()`/`METAS_ENCABEZADO` EXACTOS de
// `app/api/site-content/encabezado/route.ts` — ampliar la ruta a la 4ª meta sin actualizar ESTE
// espejo lo habría dejado probando sólo 3 de las 4 claves reales, un espejo desincronizado del
// original que ES la clase de defecto que este mismo archivo existe para prevenir del lado del
// componente. Ver el asiento de este slice en `DECISIONS.md` para el porqué completo de por qué la
// ruta necesitaba tocarse pese a no estar en `touches:`.
//
// § CROMO-NAV-DIRECCION-SCROLL-1: `navTratamiento` gana un SEGUNDO campo (`direccion`), no una
// QUINTA meta — las CUATRO claves de `METAS_ENCABEZADO` y el `.pick()` de arriba NO cambian. Los
// bodies de abajo llevan `direccion` junto a `activo` porque `wireDe` de `EncabezadoSeccion.tsx`
// manda el objeto `navTratamiento` COMPLETO en cada guardado (nunca a medias, mismo patrón que
// `cromo`).
//
// § CROMO-NAV-FILETE-1: `navTratamiento` gana un TERCER campo (`filete`), mismo razonamiento — los
// bodies de abajo llevan `filete` junto a `activo`/`direccion` porque `wireDe` sigue mandando el
// objeto COMPLETO.
//
// § CROMO-NAV-CTA-Y-BADGE-1: `navTratamiento` gana un CUARTO campo (`cta`), mismo razonamiento —
// los bodies de abajo llevan `cta` junto a `activo`/`direccion`/`filete` porque `wireDe` sigue
// mandando el objeto COMPLETO.
//
// § CROMO-NAV-POSICION-TEMA-REAL-1: `navTratamiento` gana un QUINTO campo (`posicion`), mismo
// razonamiento — los bodies de abajo llevan `posicion` junto a `activo`/`direccion`/`filete`/`cta`
// porque `wireDe` sigue mandando el objeto COMPLETO.
//
// § CROMO-NAV-EXACTO-PROTOTIPO-1: `navTratamiento` gana un SEXTO campo (`subrayado`), mismo
// razonamiento — los bodies de abajo llevan `subrayado` junto a `activo`/`direccion`/`filete`/`cta`/
// `posicion` porque `wireDe` sigue mandando el objeto COMPLETO. `posicion` REESCRIBE su VALOR (la
// geometría del prototipo local, no del tema real) sin tocar este viaje: el body sigue siendo
// `{posicion: true|false}`, sólo cambió lo que StoreNav.tsx hace con ese booleano.
//
// § RIEL-SCROLL-Y-BADGE-DORADO-1: `navTratamiento` gana un SÉPTIMO campo (`badgeColor`), mismo
// razonamiento — los bodies de abajo llevan `badgeColor` junto a los otros seis porque `wireDe`
// sigue mandando el objeto COMPLETO.
//
// § NAV-MOVIL-SIN-BUSCAR-1: `navTratamiento` gana un OCTAVO campo (`buscarMovil`) — los bodies de
// abajo lo llevan junto a los otros siete porque `wireDe` sigue mandando el objeto COMPLETO. A
// DIFERENCIA de los siete anteriores, éste NO es un eje de preset: ningún preset lo declara
// (`mergePresetEnContent`, `themes.ts`, no lo toca — § el test "default del preset", abajo, que lo
// afirma contra Postgres real), así que su default (`true`, `DEFAULTS.navTratamiento.buscarMovil`)
// es la única fuente para TODO tenant, con o sin preset.
//
// § MARCA-LOGO-IMAGEN-1 — DEVIACIÓN MEDIDA, fuera de `touches:` de ese slice (mismo patrón ya
// documentado arriba para § CROMO-NAV-DIRECCION-SCROLL-1 y hermanas: este archivo es un ESPEJO del
// `.pick()`/`METAS_ENCABEZADO` reales de `app/api/site-content/encabezado/route.ts`, y ampliar la
// ruta a una QUINTA clave sin actualizar este espejo lo habría dejado probando sólo 4 de las 5
// claves reales — el mismo defecto que este archivo existe para prevenir). `logo` es DISTINTA de
// las cuatro de arriba: no es una meta excluida del REGISTRY, ES una sección de verdad (§
// `REGISTRY.logo`, site-content-defaults.ts), así que viaja por la MISMA `guardarBorrador`/
// `publicarSeccion`/`descartarSeccion` sin que ninguna de las tres necesitara cambiar de firma — su
// borrado de blobs (`blobsHuerfanos`) ya la reconoce por default. Los bodies de abajo llevan `logo`
// junto a las otras cuatro porque `wireDe` de `EncabezadoSeccion.tsx` manda el objeto COMPLETO en
// cada guardado (nunca a medias), igual que con las demás.
//
// § NAV-LOGO-MOVIL-CON-AIRE-1: `navWordmark` gana un SEGUNDO campo (`taglineColor`) — no una SEXTA
// clave, el `.pick()`/`METAS_ENCABEZADO` de abajo NO cambian. Al nacer, ESTA ampliación no tenía
// editor en `EncabezadoSeccion.tsx` (§ el docstring de `NavWordmarkContent.taglineColor`,
// site-content-defaults.ts) y el `wireDe` real de ese slice mandaba sólo `{activo}` — así que
// `publicarComoLaRuta()`/`guardarComoLaRuta()` BORRABAN `taglineColor` en silencio la primera vez
// que el dueño tocara cualquier OTRO switch del Encabezado (el mismo modo de falla que el `navBadge`
// de arriba ya tenía resuelto). El test de abajo ejercitaba sólo el MECANISMO (el viaje
// borrador→publicar→releer funciona para el campo si alguien lo manda), no la UX real del panel.
//
// CERRADO por TAGLINE-COLOR-CIERRE-1: `EncabezadoSeccion.tsx` ahora REENVÍA `taglineColor` en cada
// guardado (mismo patrón que `navBadge`, vía un estado+ref propios leídos en `wireDe`), así que el
// test "taglineColor publicado sobrevive…" de abajo prueba el caso que de verdad importaba —no sólo
// que el campo PUEDE viajar, sino que un guardado de OTRO switch no lo borra.

const ENCABEZADO_SCHEMA = siteContentEditableSchema.pick({ cromo: true, navWordmark: true, navTratamiento: true, navDrawerMovil: true, logo: true });
const METAS_ENCABEZADO = ['cromo', 'navWordmark', 'navTratamiento', 'navDrawerMovil', 'logo'] as const;

/** Simula EXACTAMENTE el PUT de la ruta: parsea el body con el schema real, ACOTADO a las cuatro
 *  claves del Encabezado (como hace la ruta con `.pick()`), y guarda el resultado en el borrador. */
async function guardarComoLaRuta(body: unknown) {
  const parsed = ENCABEZADO_SCHEMA.parse(body);
  return guardarBorrador(parsed);
}

/** Simula EXACTAMENTE el POST `{accion:'publicar'}` de la ruta: publica las CUATRO metas, una por
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

test('guardar: las cuatro metas + logo quedan en el BORRADOR y sinPublicar.encabezado es true', async () => {
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: true, navBadge: '' },
    navWordmark: { activo: true },
    // § NAV-MOVIL-SIN-BUSCAR-1: `buscarMovil: false` ejercita la dirección que motivó el slice — el
    // dueño apaga el buscar de la barra móvil (default `true`, los otros siete campos van a su
    // NO-default `true` por la razón de siempre: ejercitar el camino de escritura, no el de lectura).
    navTratamiento: { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true, badgeColor: '#f5b36a', buscarMovil: false },
    navDrawerMovil: { variante: 'pantallaCompleta' },
    logo: { oscuro: 'https://blob.example/logo-oscuro.svg', claro: 'https://blob.example/logo-claro.svg', alt: 'Logo de Café Las Chamisas' },
  });

  const { contenido, sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, true, 'la píldora "Sin publicar" debe prenderse');
  // Draft-merged: el editor lee el borrador ENCIMA de lo publicado, así que ya refleja el cambio.
  assert.equal(contenido.cromo.navTinta, true);
  assert.equal(contenido.cromo.navSubtitulo, true);
  assert.equal(contenido.navWordmark.activo, true);
  assert.equal(contenido.navTratamiento.activo, true);
  assert.equal(contenido.navTratamiento.direccion, true);
  assert.equal(contenido.navTratamiento.filete, true);
  assert.equal(contenido.navTratamiento.cta, true);
  assert.equal(contenido.navTratamiento.posicion, true);
  assert.equal(contenido.navTratamiento.subrayado, true);
  assert.equal(contenido.navTratamiento.badgeColor, '#f5b36a');
  assert.equal(contenido.navTratamiento.buscarMovil, false);
  assert.equal(contenido.navDrawerMovil.variante, 'pantallaCompleta');
  assert.equal(contenido.logo.oscuro, 'https://blob.example/logo-oscuro.svg');
  assert.equal(contenido.logo.claro, 'https://blob.example/logo-claro.svg');
  assert.equal(contenido.logo.alt, 'Logo de Café Las Chamisas');

  // Y lo PUBLICADO todavía NO cambió — guardar el borrador no publica.
  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, false, 'guardar el borrador no debe tocar lo publicado');
  assert.equal(publicado.navWordmark.activo, false);
  assert.equal(publicado.navTratamiento.badgeColor, null, 'guardar el borrador no debe tocar lo publicado');
  assert.equal(publicado.navTratamiento.buscarMovil, true, 'guardar el borrador no debe tocar lo publicado (default true)');
  assert.equal(publicado.navDrawerMovil.variante, 'dropdown');
  assert.equal(publicado.logo.oscuro, '', 'guardar el borrador no debe tocar lo publicado');
  assert.equal(publicado.logo.claro, '', 'guardar el borrador no debe tocar lo publicado');
});

test('publicar: content.{cromo,navWordmark,navTratamiento,navDrawerMovil,logo} quedan actualizadas y el borrador queda limpio', async () => {
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: true, navBadge: '' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true, badgeColor: '#f5b36a', buscarMovil: false },
    navDrawerMovil: { variante: 'pantallaCompleta' },
    logo: { oscuro: 'https://blob.example/logo-oscuro.svg', claro: 'https://blob.example/logo-claro.svg', alt: 'Logo de Café Las Chamisas' },
  });
  await publicarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, true);
  assert.equal(publicado.cromo.navSubtitulo, true);
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navTratamiento.activo, true);
  assert.equal(publicado.navTratamiento.direccion, true);
  assert.equal(publicado.navTratamiento.filete, true);
  assert.equal(publicado.navTratamiento.cta, true);
  assert.equal(publicado.navTratamiento.posicion, true);
  assert.equal(publicado.navTratamiento.subrayado, true);
  assert.equal(publicado.navTratamiento.badgeColor, '#f5b36a');
  assert.equal(publicado.navTratamiento.buscarMovil, false, '§ NAV-MOVIL-SIN-BUSCAR-1 — el dueño lo apagó y publicó');
  assert.equal(publicado.navDrawerMovil.variante, 'pantallaCompleta');
  assert.equal(publicado.logo.oscuro, 'https://blob.example/logo-oscuro.svg');
  assert.equal(publicado.logo.claro, 'https://blob.example/logo-claro.svg');
  assert.equal(publicado.logo.alt, 'Logo de Café Las Chamisas');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, false, 'publicar debe limpiar el borrador de las cinco claves');
});

test('publicar sólo deja HUÉRFANO el logo REEMPLAZADO — blobsABorrar lo nombra (§ MARCA-LOGO-IMAGEN-1)', async () => {
  // `logo` SÍ es sección REGISTRY (a diferencia de las otras cuatro metas de este bloque), así que
  // el borrado de blobs GENÉRICO (`blobsHuerfanos`, site-content-blobs.ts) ya la reconoce sin que
  // esta ruta necesite una línea propia de lógica de blobs — esto lo prueba contra Postgres real.
  await guardarComoLaRuta({ logo: { oscuro: 'A.svg', claro: '', alt: '' } });
  await publicarComoLaRuta();

  // Reemplaza la versión oscura por otra — A.svg deja de estar en uso en cuanto esto se publique.
  await guardarComoLaRuta({ logo: { oscuro: 'B.svg', claro: '', alt: '' } });
  const { blobsABorrar } = await publicarSeccion('logo');
  assert.deepEqual(blobsABorrar, ['A.svg'], 'A.svg ya no está referenciada tras publicar B.svg');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, 'B.svg');
});

test('descartar: el borrador se limpia SIN tocar lo publicado', async () => {
  // Semilla: un Encabezado ya PUBLICADO con los switches encendidos… y el buscar móvil YA apagado
  // (§ NAV-MOVIL-SIN-BUSCAR-1) — es la elección del dueño que "descartar" tiene que PRESERVAR.
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: true, navBadge: '' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true, badgeColor: '#f5b36a', buscarMovil: false },
    navDrawerMovil: { variante: 'pantallaCompleta' },
    logo: { oscuro: 'https://blob.example/logo-oscuro.svg', claro: '', alt: '' },
  });
  await publicarComoLaRuta();

  // …y un borrador nuevo que los APAGA (y vuelve a encender el buscar móvil), sin publicar.
  await guardarComoLaRuta({
    cromo: { navTinta: false, navSubtitulo: false, navBadge: '' },
    navWordmark: { activo: false },
    navTratamiento: { activo: false, direccion: false, filete: false, cta: false, posicion: false, subrayado: false, badgeColor: null, buscarMovil: true },
    navDrawerMovil: { variante: 'dropdown' },
    logo: { oscuro: '', claro: '', alt: '' },
  });
  await descartarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navTratamiento.activo, true);
  assert.equal(publicado.navTratamiento.direccion, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navTratamiento.filete, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navTratamiento.cta, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navTratamiento.posicion, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navTratamiento.subrayado, true, 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navTratamiento.badgeColor, '#f5b36a', 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.navTratamiento.buscarMovil, false, 'descartar no debe tocar lo YA publicado (el dueño lo había apagado)');
  assert.equal(publicado.navDrawerMovil.variante, 'pantallaCompleta', 'descartar no debe tocar lo YA publicado');
  assert.equal(publicado.logo.oscuro, 'https://blob.example/logo-oscuro.svg', 'descartar no debe tocar lo YA publicado');

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, false, 'descartar debe limpiar el borrador');
});

test('default del preset: los diez controles arrancan con el valor que puso mergePresetEnContent', async () => {
  // CORTE es el ÚNICO preset del catálogo que enciende los diez ejes (§ themes.ts). Esto verifica
  // lo que EncabezadoSeccion.tsx lee al abrir por primera vez sobre un tenant con este preset: los
  // switches YA prendidos, sin que el dueño haya tocado nada — "el preset pone el punto de partida".
  await aplicarPreset(CORTE);

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navTinta, true);
  assert.equal(publicado.cromo.navSubtitulo, true);
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navTratamiento.activo, true);
  assert.equal(publicado.navTratamiento.direccion, true);
  assert.equal(publicado.navTratamiento.filete, true);
  assert.equal(publicado.navTratamiento.cta, true);
  assert.equal(publicado.navTratamiento.posicion, true);
  assert.equal(publicado.navTratamiento.subrayado, true);
  assert.equal(publicado.navTratamiento.badgeColor, '#f5b36a');
  assert.equal(publicado.navDrawerMovil.variante, 'pantallaCompleta');
  // `logo` NO es parte de ningún preset (§ MARCA-LOGO-IMAGEN-1): es contenido que el dueño SUBE, no
  // un eje de theme — `aplicarPreset` no lo toca y queda en su default vacío.
  assert.equal(publicado.logo.oscuro, '', 'ningún preset escribe logo');
  assert.equal(publicado.logo.claro, '', 'ningún preset escribe logo');
  // `buscarMovil` (§ NAV-MOVIL-SIN-BUSCAR-1) TAMPOCO es parte de ningún preset — a diferencia de
  // `logo`, `mergePresetEnContent` SÍ reconstruye `navTratamiento` entero (y por tanto no deja este
  // campo en la fila cruda), pero `readSiteContent` resuelve la lectura (`resolverNavTratamiento`)
  // y su `bool()` cae al DEFAULT (`true`) ante la ausencia — confirmado acá contra Postgres real,
  // no sólo contra el merge en memoria (§ nav-internas.test.ts).
  assert.equal(publicado.navTratamiento.buscarMovil, true, 'ningún preset lo toca; resuelve al default');
});

test('publicar el Encabezado NO borra cromo.navBadge puesto por un preset — se reenvía sin editarlo', async () => {
  // El write reemplaza la clave `cromo` ENTERA (spread por clave top-level, § site-content-write.ts):
  // si el guardado del Encabezado no reenviara `navBadge`, publicar lo borraría en silencio la
  // primera vez que el dueño toque cualquiera de los OTROS switches. `EncabezadoSeccion.tsx` lo
  // evita leyendo el `navBadge` vigente y reenviándolo tal cual en cada guardado (§ su docstring) —
  // esto prueba esa garantía al nivel del write, contra Postgres real.
  await aplicarPreset(CORTE); // navBadge = 'Cosecha 2026'

  await guardarComoLaRuta({
    // El dueño sólo apaga el color del nav; `navSubtitulo`/`navBadge` viajan REENVIADOS con su valor
    // VIGENTE, como hace el componente (nunca a medias).
    cromo: { navTinta: false, navSubtitulo: true, navBadge: 'Cosecha 2026' },
    navWordmark: { activo: true },
    navTratamiento: { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true, badgeColor: '#f5b36a', buscarMovil: true },
    navDrawerMovil: { variante: 'pantallaCompleta' },
    logo: { oscuro: '', claro: '', alt: '' },
  });
  await publicarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.cromo.navBadge, 'Cosecha 2026', 'el navBadge del preset no debe perderse');
  assert.equal(publicado.cromo.navTinta, false, 'y el cambio que sí se pidió se aplicó');
});

test('el drawer móvil se puede publicar/descartar de forma INDEPENDIENTE de los otros cuatro ejes/sección (guarda sólo esa clave)', async () => {
  // El dueño toca SÓLO el switch del drawer móvil — el body no trae `cromo`/`navWordmark`/
  // `navTratamiento`/`logo`, como hace `wireDe` de EncabezadoSeccion.tsx en cada guardado real
  // (manda las CINCO claves completas, pero esto prueba que el mecanismo de guardado no las EXIGE
  // juntas).
  await guardarComoLaRuta({ navDrawerMovil: { variante: 'pantallaCompleta' } });
  await publicarSeccion('navDrawerMovil');

  const publicado = await readSiteContent();
  assert.equal(publicado.navDrawerMovil.variante, 'pantallaCompleta');
  assert.equal(publicado.cromo.navTinta, false, 'los otros ejes no se tocaron');
  assert.equal(publicado.logo.oscuro, '', 'logo no se tocó');
});

// § NAV-LOGO-MOVIL-CON-AIRE-1 — `navWordmark` gana un SEGUNDO campo (`taglineColor`): el body de
// abajo lo manda junto a `activo` porque `wireDe` de `EncabezadoSeccion.tsx` manda el objeto
// COMPLETO en cada guardado — MISMO patrón que las demás metas de esta ruta. A diferencia de las
// otras ocho ampliaciones de arriba, ÉSTA no tiene editor en el panel todavía (§ el docstring de
// `NavWordmarkContent.taglineColor`): el viaje borrador→publicar→releer sigue siendo el MISMO
// mecanismo (`guardarBorrador`/`publicarSeccion`/`descartarSeccion`), así que se afirma igual.
test('taglineColor viaja borrador→publicar→releer, junto a activo, por el MISMO mecanismo', async () => {
  await guardarComoLaRuta({ navWordmark: { activo: true, taglineColor: 'acento' } });

  const { contenido } = await readSiteContentParaEditor();
  assert.equal(contenido.navWordmark.activo, true);
  assert.equal(contenido.navWordmark.taglineColor, 'acento');

  await publicarSeccion('navWordmark');
  const publicado = await readSiteContent();
  assert.equal(publicado.navWordmark.activo, true);
  assert.equal(publicado.navWordmark.taglineColor, 'acento');
});

test('taglineColor: sin dato guardado, resuelve a "atenuado" (el default byte-idéntico) — Onix/Nayoli no cambian', async () => {
  const publicado = await readSiteContent();
  assert.equal(publicado.navWordmark.taglineColor, 'atenuado');
});

test('taglineColor publicado ("acento", § NAV-LOGO-MOVIL-CON-AIRE-1) sobrevive a guardar y publicar el Encabezado (TAGLINE-COLOR-CIERRE-1)', async () => {
  // El color del tagline nace por una operación de datos directa (sin editor en el panel todavía,
  // § PENDIENTE_PANEL) — reproduce el estado real de Café Las Chamisas: dorado, ya publicado.
  await guardarComoLaRuta({ navWordmark: { activo: true, taglineColor: 'acento' } });
  await publicarSeccion('navWordmark');

  // El dueño abre "Encabezado" y toca OTRO switch (el color del nav). `EncabezadoSeccion.tsx`
  // REENVÍA el `taglineColor` VIGENTE ('acento') junto con `activo` —el mismo patrón que ya usa para
  // `cromo.navBadge`—, así que el body de un guardado real lleva las CINCO claves completas con el
  // color intacto. Antes de TAGLINE-COLOR-CIERRE-1 este body habría llevado `navWordmark: {activo:
  // true}` a secas, borrando el dorado al publicar.
  await guardarComoLaRuta({
    cromo: { navTinta: true, navSubtitulo: false, navBadge: '' },
    navWordmark: { activo: true, taglineColor: 'acento' },
    navTratamiento: { activo: false, direccion: false, filete: false, cta: false, posicion: false, subrayado: false, badgeColor: null, buscarMovil: true },
    navDrawerMovil: { variante: 'dropdown' },
    logo: { oscuro: '', claro: '', alt: '' },
  });
  await publicarComoLaRuta();

  const publicado = await readSiteContent();
  assert.equal(publicado.navWordmark.taglineColor, 'acento', 'el color del tagline no debe borrarse al guardar/publicar otro eje del Encabezado');
  assert.equal(publicado.cromo.navTinta, true, 'y el cambio que sí se pidió (otro switch) se aplicó');
});

test('el logo se puede guardar/publicar de forma INDEPENDIENTE de los otros cuatro ejes (§ MARCA-LOGO-IMAGEN-1)', async () => {
  // Gemelo del test de arriba, del lado de `logo`: el dueño sube sólo una imagen, sin tocar
  // ningún switch — el body no trae `cromo`/`navWordmark`/`navTratamiento`/`navDrawerMovil`.
  await guardarComoLaRuta({ logo: { oscuro: 'https://blob.example/logo-oscuro.svg', claro: '', alt: '' } });

  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.encabezado, true, 'la píldora debe prenderse aunque sólo cambie logo');

  await publicarSeccion('logo');

  const publicado = await readSiteContent();
  assert.equal(publicado.logo.oscuro, 'https://blob.example/logo-oscuro.svg');
  assert.equal(publicado.cromo.navTinta, false, 'los otros ejes no se tocaron');
  assert.equal(publicado.navWordmark.activo, false, 'los otros ejes no se tocaron');
});
