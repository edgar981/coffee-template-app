import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  urlDePagina,
  urlDePaginaEnEditor,
  marcadorDeSeccion,
  selectorDeSeccion,
  seccionDesdeMarcador,
  scrollSeguro,
  PARAM_MODO_EDITOR,
  VALOR_MODO_EDITOR,
  ATRIBUTO_EDITOR_SECCION,
  ATRIBUTO_EDITOR_CAMPO,
  ATRIBUTO_EDITOR_LINEA,
  MARCADOR_SUSCRIPCIONES,
  ANCHOS_DISPOSITIVO,
  DISPOSITIVO_DEFECTO,
  CLAVE_DISPOSITIVO_EDITOR,
  dispositivoDesdeStorage,
  calcularEscalaDispositivo,
} from './editor-iframe';

test('urlDePagina: home es la raíz; las demás páginas, su propia ruta', () => {
  assert.equal(urlDePagina('home'), '/');
  assert.equal(urlDePagina('nosotros'), '/nosotros');
  assert.equal(urlDePagina('suscripciones'), '/suscripciones');
});

test('urlDePaginaEnEditor: la misma ruta de urlDePagina, con el parámetro de modo editor', () => {
  assert.equal(urlDePaginaEnEditor('home'), `/?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`);
  assert.equal(urlDePaginaEnEditor('nosotros'), `/nosotros?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`);
  assert.equal(urlDePaginaEnEditor('suscripciones'), `/suscripciones?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`);
});

test('marcadorDeSeccion: home/nosotros usan el nombre de la sección tal cual', () => {
  assert.equal(marcadorDeSeccion('hero'), 'hero');
  assert.equal(marcadorDeSeccion('marquesina'), 'marquesina');
  assert.equal(marcadorDeSeccion('trustBadges'), 'trustBadges');
  assert.equal(marcadorDeSeccion('brandStory'), 'brandStory');
  assert.equal(marcadorDeSeccion('origen'), 'origen');
  assert.equal(marcadorDeSeccion('presentaciones'), 'presentaciones');
  assert.equal(marcadorDeSeccion('subscriptionCTA'), 'subscriptionCTA');
  assert.equal(marcadorDeSeccion('testimonials'), 'testimonials');
  assert.equal(marcadorDeSeccion('nosotrosHistoria'), 'nosotrosHistoria');
  assert.equal(marcadorDeSeccion('nosotrosGaleria'), 'nosotrosGaleria');
  assert.equal(marcadorDeSeccion('nosotrosCierre'), 'nosotrosCierre');
});

test('marcadorDeSeccion: spotlight comparte el marcador de la banda featured que ocupa', () => {
  assert.equal(marcadorDeSeccion('spotlight'), 'featured');
});

test('marcadorDeSeccion: las tres secciones de Suscripciones YA marcan su propio nombre (§ EDITOR-TIENDA-SELECCION-1)', () => {
  assert.equal(marcadorDeSeccion('suscripcionPlanes'), 'suscripcionPlanes');
  assert.equal(marcadorDeSeccion('suscripcionPasos'), 'suscripcionPasos');
  assert.equal(marcadorDeSeccion('suscripcionFaq'), 'suscripcionFaq');
});

test('selectorDeSeccion: construye el atributo data-editor-seccion a partir del marcador', () => {
  assert.equal(selectorDeSeccion('hero'), '[data-editor-seccion="hero"]');
  assert.equal(selectorDeSeccion('spotlight'), '[data-editor-seccion="featured"]');
  assert.equal(selectorDeSeccion('suscripcionFaq'), '[data-editor-seccion="suscripcionFaq"]');
});

test('ATRIBUTO_EDITOR_SECCION / MARCADOR_SUSCRIPCIONES: los dos literales que selectorDeSeccion/Contenido.tsx comparten', () => {
  assert.equal(ATRIBUTO_EDITOR_SECCION, 'data-editor-seccion');
  assert.equal(MARCADOR_SUSCRIPCIONES, 'suscripciones');
});

test('ATRIBUTO_EDITOR_CAMPO / ATRIBUTO_EDITOR_LINEA (§ EDITOR-TIENDA-CAMPO-EDITABLE-1): los literales que CampoEditable.tsx/EditorPuenteVivo.tsx comparten', () => {
  assert.equal(ATRIBUTO_EDITOR_CAMPO, 'data-editor-campo');
  assert.equal(ATRIBUTO_EDITOR_LINEA, 'data-editor-linea');
});

test('seccionDesdeMarcador: la inversa — identidad salvo "featured", que resuelve a spotlight', () => {
  assert.equal(seccionDesdeMarcador('hero'), 'hero');
  assert.equal(seccionDesdeMarcador('suscripcionPlanes'), 'suscripcionPlanes');
  assert.equal(seccionDesdeMarcador('suscripcionPasos'), 'suscripcionPasos');
  assert.equal(seccionDesdeMarcador('suscripcionFaq'), 'suscripcionFaq');
  assert.equal(seccionDesdeMarcador('featured'), 'spotlight');
  assert.equal(seccionDesdeMarcador('no-existe'), 'no-existe'); // el llamador valida membresía, no esta función
});

test('scrollSeguro: valores positivos finitos pasan redondeados', () => {
  assert.equal(scrollSeguro(120.4), 120);
  assert.equal(scrollSeguro(120.6), 121);
  assert.equal(scrollSeguro(0), 0);
});

test('scrollSeguro: negativos, NaN e Infinity caen a 0', () => {
  assert.equal(scrollSeguro(-40), 0);
  assert.equal(scrollSeguro(NaN), 0);
  assert.equal(scrollSeguro(Infinity), 0);
  assert.equal(scrollSeguro(-Infinity), 0);
});

test('ANCHOS_DISPOSITIVO: los tres anchos medidos contra lo que el repo ya usa', () => {
  assert.equal(ANCHOS_DISPOSITIVO.escritorio, 1280);
  assert.equal(ANCHOS_DISPOSITIVO.tablet, 768);
  assert.equal(ANCHOS_DISPOSITIVO.telefono, 393);
});

test('DISPOSITIVO_DEFECTO: escritorio, por decisión del owner', () => {
  assert.equal(DISPOSITIVO_DEFECTO, 'escritorio');
});

test('CLAVE_DISPOSITIVO_EDITOR: namespaced, no choca con otras claves de localStorage del admin', () => {
  assert.equal(CLAVE_DISPOSITIVO_EDITOR, 'admin:editor-tienda:dispositivo');
});

test('dispositivoDesdeStorage: las tres claves válidas pasan tal cual', () => {
  assert.equal(dispositivoDesdeStorage('escritorio'), 'escritorio');
  assert.equal(dispositivoDesdeStorage('tablet'), 'tablet');
  assert.equal(dispositivoDesdeStorage('telefono'), 'telefono');
});

test('dispositivoDesdeStorage: null, vacío o cualquier otra cosa cae al default', () => {
  assert.equal(dispositivoDesdeStorage(null), DISPOSITIVO_DEFECTO);
  assert.equal(dispositivoDesdeStorage(''), DISPOSITIVO_DEFECTO);
  assert.equal(dispositivoDesdeStorage('movil'), DISPOSITIVO_DEFECTO);
  assert.equal(dispositivoDesdeStorage('Escritorio'), DISPOSITIVO_DEFECTO);
});

test('calcularEscalaDispositivo: el dispositivo cabe entero → escala 1, sin reducir', () => {
  assert.equal(calcularEscalaDispositivo(1600, 1280), 1);
  assert.equal(calcularEscalaDispositivo(1280, 1280), 1);
  assert.equal(calcularEscalaDispositivo(900, 393), 1);
});

test('calcularEscalaDispositivo: el dispositivo NO cabe → reduce entero, nunca recorta', () => {
  assert.equal(calcularEscalaDispositivo(640, 1280), 0.5);
  assert.equal(calcularEscalaDispositivo(960, 1280), 0.75);
});

test('calcularEscalaDispositivo: sin medir todavía (0/negativo) → cabe, no reduce a cero', () => {
  assert.equal(calcularEscalaDispositivo(0, 1280), 1);
  assert.equal(calcularEscalaDispositivo(-10, 1280), 1);
  assert.equal(calcularEscalaDispositivo(1600, 0), 1);
});

// ─── EDITOR-TIENDA-TEMA-PROVEEDOR-1 — el layout de /editor monta SiteSettingsProvider ─────────────
//
// La causa medida: `PaletaSeccion` (la pestaña «Tema») llama `useSiteSettings()`, que lanza fuera de
// `<SiteSettingsProvider>`. Sólo `app/(admin)/admin/layout.tsx` lo montaba; `app/(admin)/editor/
// layout.tsx` verificaba la sesión y devolvía `children` sin él — de ahí el "This page couldn't
// load" al abrir «Tema» en `/editor/tienda`.
//
// Este archivo NO PUEDE montar `EditorLayout` por ejecución: es un Server Component async que llama
// `headers()` (next/headers, exige un request real de Next) y `auth.api.getSession` + `prisma.user.
// findUnique` (Better Auth + DB) — justo lo que el carril rápido (capa 1, SIN base, § CLAUDE.md "El
// GATE DE UN SLICE") no tiene. Y el repo no tiene jsdom para montar `.test.tsx` de componente
// (§ CLAUDE.md, "El glob NO incluye *.test.tsx"). Así que se sigue el patrón ya establecido para este
// mismo límite (`lib/preauth-chasis.test.ts`): leer el ARCHIVO FUENTE que de verdad se despliega y
// afirmar, por su contenido, que el árbol de «Tema» queda envuelto — el test más cercano a la
// ejecución real que el arnés permite.

function leerFuente(rutaRelativaDesdeAca: string): string {
  const ruta = path.join(fileURLToPath(new URL('.', import.meta.url)), rutaRelativaDesdeAca);
  return readFileSync(ruta, 'utf8');
}

test('app/(admin)/editor/layout.tsx importa y monta SiteSettingsProvider alrededor de children', () => {
  const fuente = leerFuente('../../app/(admin)/editor/layout.tsx');

  assert.match(
    fuente,
    /import\s*\{\s*SiteSettingsProvider\s*\}\s*from\s*["']@\/components\/admin\/SiteSettingsProvider["']/,
    'debe importar el MISMO provider que monta app/(admin)/admin/layout.tsx — no una copia',
  );
  assert.match(
    fuente,
    /<SiteSettingsProvider\s+value=\{[^}]+\}>\s*\{children\}\s*<\/SiteSettingsProvider>/,
    'children debe quedar DENTRO de <SiteSettingsProvider>, o PaletaSeccion (la pestaña «Tema») vuelve a lanzar',
  );
});

test('app/(admin)/editor/layout.tsx reusa getSiteSettings() — no una segunda lectura de la config', () => {
  const fuente = leerFuente('../../app/(admin)/editor/layout.tsx');

  assert.match(
    fuente,
    /import\s*\{\s*getSiteSettings\s*\}\s*from\s*["']@\/lib\/config\/site-settings["']/,
    'debe reusar la MISMA función server-only + cache() que lee app/(admin)/admin/layout.tsx',
  );
  // El valor que viaja al provider sale de getSiteSettings(), no de un objeto armado a mano.
  assert.match(
    fuente,
    /getSiteSettings\(\)/,
    'getSiteSettings() debe invocarse de verdad, no sólo importarse',
  );
});
