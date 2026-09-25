import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// § HIGIENE-SEED-Y-DOCTRINA-1 / SEED-SITESETTING-UPSERT-NOOP-1 (DECISIONS.md). `prisma/seed.ts`
// hacía `siteSetting.upsert({ update: {}, create: { nombre: 'Café Nayoli', … } })` — sobre CUALQUIER
// base ya migrada la fila YA EXISTE (la inserta `20260824120000_add_site_setting` en el mismo INSERT
// que crea la tabla), así que `update: {}` es la rama que SIEMPRE corre y `create` nunca se alcanza.
// El literal 'Café Nayoli' ahí era, por tanto, inalcanzable Y contradecía la doctrina de neutralidad
// (§ CLAUDE.md, "El código compartido no NACE siendo Nayoli/demo") en la única rama donde SÍ podría
// ejecutarse algún día (una fila borrada a mano y re-sembrada).
//
// ESTE TEST DERIVA de las DOS fuentes reales — el `create` de `prisma/seed.ts` y el INSERT de la
// migración YA APLICADA (inmutable, § CLAUDE.md "NO toques la migración") — en vez de hardcodear un
// tercer objeto esperado a mano: si alguno de los dos diverge, el test lo nombra. Capa 1, sin base:
// lee las DOS fuentes como TEXTO (mismo patrón que `footer-tema.test.ts` extrayendo el cuerpo de
// `FooterColumnas`), nunca ejecuta `prisma/seed.ts` (su `main()` corre al importar el módulo y
// necesita una base real — inapropiado para un test puro).

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const SEED_PATH = path.join(AQUI, '../../prisma/seed.ts');
const MIGRACION_PATH = path.join(
  AQUI,
  '../../packages/core/prisma/migrations/20260824120000_add_site_setting/migration.sql',
);

const CAMPOS = ['nombre', 'tagline', 'descripcionFooter', 'whatsapp', 'instagram', 'emailRemitente'] as const;

// Extrae {id, nombre, tagline, descripcionFooter, whatsapp, instagram, emailRemitente} del INSERT de
// la migración, por POSICIÓN: la lista de columnas entre paréntesis fija el orden, y los valores
// citados (todo menos `updatedAt`, que es CURRENT_TIMESTAMP sin comillas) van en la misma secuencia.
function valoresDeMigracion(): Record<string, string> {
  const sql = readFileSync(MIGRACION_PATH, 'utf8');
  const columnasMatch = sql.match(/INSERT INTO "SiteSetting"\s*\(([^)]+)\)/);
  assert.ok(columnasMatch, 'no se pudo ubicar la lista de columnas del INSERT en la migración');
  const columnas = columnasMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''));

  const valuesMatch = sql.match(/VALUES\s*\(([\s\S]*?)\);/);
  assert.ok(valuesMatch, 'no se pudo ubicar el bloque VALUES del INSERT en la migración');
  const valoresCitados = [...valuesMatch[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);

  // `updatedAt` es CURRENT_TIMESTAMP, sin comillas — no aparece en `valoresCitados`, así que las
  // columnas citadas son todas menos la última.
  const columnasCitadas = columnas.slice(0, -1);
  assert.equal(
    columnasCitadas.length, valoresCitados.length,
    'la cantidad de columnas citadas no coincide con la cantidad de valores citados en el INSERT',
  );

  const resultado: Record<string, string> = {};
  columnasCitadas.forEach((col, i) => { resultado[col] = valoresCitados[i]; });
  return resultado;
}

// Extrae los mismos campos del `create: {…}` de `prisma/seed.ts`, campo por campo — cada uno vive en
// su propia línea `campo:  'valor',` dentro del `siteSetting.upsert`.
function valoresDeSeed(): Record<string, string> {
  const src = readFileSync(SEED_PATH, 'utf8');
  const inicio = src.indexOf('prisma.siteSetting.upsert');
  assert.ok(inicio > -1, 'no se encontró prisma.siteSetting.upsert en prisma/seed.ts');
  const fin = src.indexOf('metodosPago:', inicio);
  assert.ok(fin > inicio, 'no se pudo acotar el bloque create de siteSetting.upsert antes de metodosPago');
  const bloque = src.slice(inicio, fin);

  const resultado: Record<string, string> = {};
  for (const campo of CAMPOS) {
    const m = bloque.match(new RegExp(`\\b${campo}:\\s*'([^']*)'`));
    assert.ok(m, `no se encontró el campo '${campo}' en el create de siteSetting.upsert`);
    resultado[campo] = m[1];
  }
  // `id` va aparte: en la migración es el primer valor citado; en el seed es un literal fijo
  // ('default') que no forma parte de la comparación de VALORES DE NEGOCIO (nombre/tagline/…).
  const idMatch = bloque.match(/\bid:\s*'([^']*)'/);
  assert.ok(idMatch, "no se encontró el campo 'id' en el create de siteSetting.upsert");
  resultado.id = idMatch[1];
  return resultado;
}

test('el create de siteSetting.upsert (seed) declara los MISMOS valores neutros que el INSERT de la migración', () => {
  const deMigracion = valoresDeMigracion();
  const deSeed = valoresDeSeed();

  assert.equal(deSeed.id, deMigracion.id, "'id' debe coincidir ('default')");
  for (const campo of CAMPOS) {
    assert.equal(
      deSeed[campo], deMigracion[campo],
      `'${campo}': el create de seed.ts ('${deSeed[campo]}') difiere del INSERT de la migración ('${deMigracion[campo]}')`,
    );
  }
});

test('la migración inserta la fila NEUTRA que la doctrina describe — no "Café Nayoli"', () => {
  const deMigracion = valoresDeMigracion();
  assert.equal(deMigracion.nombre, 'Configura tu tienda');
  assert.equal(deMigracion.tagline, '');
  assert.equal(deMigracion.descripcionFooter, '');
  assert.equal(deMigracion.whatsapp, '');
  assert.equal(deMigracion.instagram, '');
  assert.equal(deMigracion.emailRemitente, '');
});

test('update sigue vacío — el upsert nunca pisa una fila existente (ni con datos neutros)', () => {
  const src = readFileSync(SEED_PATH, 'utf8');
  const inicio = src.indexOf('prisma.siteSetting.upsert');
  assert.ok(inicio > -1);
  const fin = src.indexOf('create:', inicio);
  assert.ok(fin > inicio);
  const bloque = src.slice(inicio, fin);
  assert.match(bloque, /update:\s*\{\s*\}/, 'update debe seguir siendo el objeto vacío {}');
});
