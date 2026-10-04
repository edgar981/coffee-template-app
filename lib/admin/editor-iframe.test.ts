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
  cajaDeHover,
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

// § EDITOR-TIENDA-SHELL-1 — el rótulo de hover del lienzo (VistaTiendaIframe.tsx): la caja medida en
// coordenadas del documento del iframe (sin escalar) escala por el MISMO factor que ya posiciona el
// propio <iframe> dentro de su envoltorio.
test('cajaDeHover: escala 1 devuelve la misma caja', () => {
  assert.deepEqual(cajaDeHover({ top: 10, left: 20, width: 300, height: 150 }, 1), { top: 10, left: 20, width: 300, height: 150 });
});

test('cajaDeHover: escala < 1 reduce las cuatro medidas por igual', () => {
  assert.deepEqual(cajaDeHover({ top: 100, left: 40, width: 200, height: 80 }, 0.5), { top: 50, left: 20, width: 100, height: 40 });
});

test('cajaDeHover: escala 0 colapsa la caja a un punto en el origen trasladado', () => {
  assert.deepEqual(cajaDeHover({ top: 100, left: 40, width: 200, height: 80 }, 0), { top: 0, left: 0, width: 0, height: 0 });
});

// ─── EDITOR-AGREGAR-SECCION-LIENZO-1 — el «+» entre secciones, mismo límite de arnés que arriba ──
//
// `EditorPuenteVivo.tsx`/`VistaTiendaIframe.tsx`/`TiendaPaginas.tsx` son `.tsx` sin jsdom
// (§ CLAUDE.md, "El glob NO incluye *.test.tsx"), así que el "ida y vuelta" del DÉCIMO mensaje
// (iframe→panel→`abrirBiblioteca`) se afirma como ARRIBA: leyendo el ARCHIVO FUENTE que de verdad
// se despliega y comprobando, por su contenido, que la cadena de wiring existe de punta a punta —
// no por ejecución (eso lo cubre la sesión del arnés real, § docs/editor-tienda/
// AGREGAR-SECCIONES.md). La forma/validación del mensaje en sí (`esMensajeAgregarSeccion`) tiene
// su test de capa 1 propio en `lib/storefront/editor-puente.test.ts`; esto es sólo el CABLEADO.

test('EditorPuenteVivo.tsx inserta el separador «+» y lo despacha por el MISMO canal del puente (TIPO_MENSAJE_AGREGAR_SECCION), nunca un onClick de React', () => {
  const fuente = leerFuente('../../components/storefront/EditorPuenteVivo.tsx');
  assert.match(
    fuente,
    /TIPO_MENSAJE_AGREGAR_SECCION,\s*ATRIBUTO_EDITOR_AGREGAR_SECCION,?\s*\n\}\s*from\s*["']@\/lib\/storefront\/editor-puente["']/,
    'debe importar el discriminador y el atributo desde el puente — una sola definición, no un literal repetido',
  );
  assert.match(
    fuente,
    /window\.parent\.postMessage\(\{\s*tipo:\s*TIPO_MENSAJE_AGREGAR_SECCION,\s*despuesDe\s*\}/,
    'el clic en el «+» debe postear el mensaje leyendo el atributo del nodo, dentro del listener de captura — nunca un onClick de React (§ el docstring grande del archivo, por qué el clic no pasa por React)',
  );
  assert.doesNotMatch(
    fuente,
    /crearSeparadorAgregar[\s\S]{0,400}onClick/,
    'el botón insertado no debe llevar onClick — el listener de captura ya lo resuelve, un segundo camino podría divergir',
  );
});

test('VistaTiendaIframe.tsx reenvía TIPO_MENSAJE_AGREGAR_SECCION a onAgregarSeccion, sin resolver el marcador', () => {
  const fuente = leerFuente('../../components/admin/VistaTiendaIframe.tsx');
  assert.match(
    fuente,
    /esMensajeAgregarSeccion/,
    'debe importar y usar el validador del décimo mensaje',
  );
  assert.match(
    fuente,
    /esMensajeAgregarSeccion\(e\.data\)\)\s*\{\s*onAgregarSeccion\?\.\(e\.data\.despuesDe\)/,
    'debe reenviar despuesDe TAL CUAL — seccionDesdeMarcador resolvería "featured" al nombre de SeccionVista equivocado (§ el docstring del mensaje en editor-puente.ts)',
  );
  assert.doesNotMatch(
    fuente,
    /seccionDesdeMarcador\(e\.data\.despuesDe\)/,
    'despuesDe no debe pasar por seccionDesdeMarcador: ese paso daría el id equivocado para abrirBiblioteca',
  );
});

test('TiendaPaginas.tsx conecta el «+» del lienzo a abrirBiblioteca — la MISMA función que el separador de la lista', () => {
  const fuente = leerFuente('../../components/admin/TiendaPaginas.tsx');
  assert.match(
    fuente,
    /onAgregarSeccion=\{abrirBiblioteca\}/,
    'VistaTiendaIframe debe recibir abrirBiblioteca directo — nunca un segundo manejador que pudiera divergir de los separadores de la lista',
  );
});
