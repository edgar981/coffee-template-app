import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerGlobsDeComando, globAPatronRegExp, archivosSinCubrir } from './tests-descubiertos';

// Este archivo vive en lib/gate/, dos niveles bajo la raíz del repo.
const RAIZ = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// Lo que NO es código de este repo ni el objeto de esta guarda: dependencias
// (`node_modules`, que trae CIENTOS de sus propios `*.test.ts`), artefactos de
// construcción (`.next`, `tsconfig.tsbuildinfo` no aplica acá pero `.next` sí) y
// carpetas de herramienta (`.git`, `.vercel`, `.scratch` — gitignored, de un
// worker, nunca contenido del repo).
const EXCLUIDOS = new Set(['node_modules', '.git', '.next', '.vercel', '.scratch']);

function archivosDeTestDelRepo(raiz: string): string[] {
  const acc: string[] = [];
  const caminar = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUIDOS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        caminar(abs);
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        acc.push(path.relative(raiz, abs).split(path.sep).join('/'));
      }
    }
  };
  caminar(raiz);
  return acc;
}

/**
 * Los patrones de los DOS carriles del gate (`npm run gate` = `test` +
 * `test:integracion`, § GATE-DOS-CARRILES-1 en CLAUDE.md) — leídos de sus DOS
 * fuentes, nunca transcritos:
 *   - el script "test" de package.json (el carril rápido, el que esta guarda existe
 *     para proteger);
 *   - la invocación final de `node --test` en scripts/test-integracion.sh (el carril
 *     de integración) — un archivo bajo `tests/integracion/` NO es invisible: corre
 *     por AHÍ, a propósito, porque necesita Postgres real (§ El carril rápido cubre
 *     app/, CLAUDE.md: "un test que necesite Postgres real va a tests/integracion/,
 *     no co-ubicado con la ruta"). Sin este segundo patrón, esta guarda fallaría
 *     SIEMPRE contra los ~30 archivos de ese carril, que ya están cubiertos.
 */
function patronesDelGate(raiz: string): string[] {
  const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const testCmd = pkg.scripts?.test;
  assert.ok(testCmd, 'package.json no tiene un script "test" — el carril rápido no existe');

  const integracionSh = readFileSync(path.join(raiz, 'scripts', 'test-integracion.sh'), 'utf8');

  return [...extraerGlobsDeComando(testCmd), ...extraerGlobsDeComando(integracionSh)];
}

test('todo archivo de test del repositorio cae bajo un patrón que algún carril del gate ejecuta', () => {
  const patrones = patronesDelGate(RAIZ);
  assert.ok(
    patrones.length > 0,
    'la extracción de patrones no encontró ninguno — está rota la extracción, no el repo',
  );

  const archivos = archivosDeTestDelRepo(RAIZ);
  const invisibles = archivosSinCubrir(archivos, patrones).sort();

  const mensaje = [
    'Estos archivos de test NO caen bajo ningún patrón de "npm test" ni de',
    '"npm run test:integracion" — ningún carril de "npm run gate" los va a ejecutar:',
    ...invisibles.map((f) => `  - ${f}`),
    '',
    'Arreglo: si el archivo es DB-free, agregá su subárbol al glob del script "test" en',
    'package.json (mismo patrón y comillas que los que ya están). Si necesita Postgres',
    'real, va bajo tests/integracion/, no co-ubicado con su código.',
    '',
    'LÍMITE de esta guarda: sólo prueba que el archivo CAE bajo un patrón, no que su',
    'contenido se EJECUTE — un caso saltado o una condición que lo apaga siguen siendo',
    'invisibles, y esta guarda no los ve.',
  ].join('\n');

  assert.deepEqual(invisibles, [], mensaje);
});

// ── Las piezas puras, por separado ──────────────────────────────────────────

test('extraerGlobsDeComando lee sólo las cadenas entrecomilladas que terminan en .test.ts', () => {
  const comando = 'node --import tsx --test "lib/**/*.test.ts" "constants/**/*.test.ts"';
  assert.deepEqual(extraerGlobsDeComando(comando), ['lib/**/*.test.ts', 'constants/**/*.test.ts']);
});

test('extraerGlobsDeComando ignora las comillas que NO son un glob de test', () => {
  // scripts/test-integracion.sh entrecomilla rutas y mensajes que no son el glob:
  // "$DATADIR", "$LOG", "CREATE DATABASE ${BASE};" — ninguno debe colarse.
  const comando = 'pg_ctl -D "$DATADIR" -l "$LOG"\nnode --test "tests/integracion/**/*.test.ts"';
  assert.deepEqual(extraerGlobsDeComando(comando), ['tests/integracion/**/*.test.ts']);
});

test('globAPatronRegExp: "lib/**/*.test.ts" matchea sin subcarpeta y con varias, no fuera de lib/', () => {
  const re = globAPatronRegExp('lib/**/*.test.ts');
  assert.ok(re.test('lib/admin-titulo.test.ts'));
  assert.ok(re.test('lib/gate/tests-descubiertos.test.ts'));
  assert.ok(re.test('lib/config/site-content-schema.test.ts'));
  assert.ok(!re.test('components/foo.test.ts'));
  assert.ok(!re.test('lib/foo.ts')); // sin el sufijo .test.ts, no es un test
});

test('archivosSinCubrir: EL CASO REAL DE ANOCHE (§ GATE-GUARDA-TESTS-INVISIBLES-1)', () => {
  // Los patrones del carril rápido tal como estaban en package.json ANTES de
  // GATE-GLOB-COMPONENTS-SERVICES-1 (commit 2f8c205) — verificados contra
  // `git show 2f8c205^:package.json`: SIN "components/**/*.test.ts" ni
  // "services/**/*.test.ts". El patrón de integración no cambió.
  //
  // Los dos archivos que quedaron invisibles esa noche —uno de ellos del camino de
  // dinero (services/checkout.service.test.ts)— SIGUEN EXISTIENDO hoy, así que esta
  // reproducción corre contra el árbol REAL del repo, no contra un fixture inventado.
  //
  // ESTA REPRODUCCIÓN CORRE CONTRA EL ÁRBOL REAL, así que crece con él: un TERCERO se sumó
  // (`prisma/aplicar-preset.test.ts`, § ONBOARDING-APLICAR-PRESET-SCRIPT-1) — legítimo bajo el
  // glob VIGENTE de `npm test` (que sí lo cubre, ver el primer test de este archivo), pero
  // invisible bajo los patrones CONGELADOS de "anoche" (que nunca conocieron `prisma/`, igual que
  // nunca conocieron `components/`/`services/` antes de GATE-GLOB-COMPONENTS-SERVICES-1). La
  // reproducción del incidente sigue siendo válida con tres nombres en vez de dos; lo que
  // demuestra —que un archivo no cae solo bajo ningún patrón— no cambia.
  const patronesDeAnoche = [
    'lib/**/*.test.ts',
    'constants/**/*.test.ts',
    'packages/core/**/*.test.ts',
    'app/**/*.test.ts',
    'tests/integracion/**/*.test.ts',
  ];
  const archivos = archivosDeTestDelRepo(RAIZ);
  const invisibles = archivosSinCubrir(archivos, patronesDeAnoche).sort();

  assert.deepEqual(
    invisibles,
    [
      'components/storefront/checkout/interpretar-respuesta-otro-metodo.test.ts',
      'prisma/aplicar-preset.test.ts',
      'services/checkout.service.test.ts',
    ].sort(),
    'con los patrones de anoche la guarda debe nombrar EXACTAMENTE los archivos que quedaron invisibles',
  );
});
