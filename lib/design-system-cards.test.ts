import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ─── PANEL-TARJETAS-NO-ESTIRAN-1 ────────────────────────────────────────────────
//
// No hay DOM en este carril (§ CLAUDE.md, § El glob NO incluye *.test.tsx) — así que este
// archivo no puede medir un `getBoundingClientRect`. Lo REPRODUCIBLE sin DOM (y lo que se
// verificó CON DOM, headless, antes de escribir esto — § el asiento del slice) es que la
// regla del primitivo declara `align-content: start`.
//
// EL DEFECTO: `.duna-cards` es un grid `auto-fill` sin `align-content` declarado. En
// document-scroll eso no se nota (el contenedor mide lo que su contenido pide), pero dentro
// de una región de alto FIJO (`.duna-pantalla-fija .duna-split > .duna-cards`, § duna.css)
// el contenedor recibe una altura DEFINIDA por el layout, y `align-content: normal` computa
// a `stretch` para un grid: con menos filas que las que caben, el sobrante se reparte
// estirando esas filas, y `align-items` (también `normal`→`stretch`) estira cada tarjeta a
// la altura de su fila — la tarjeta se ve "alargada" hasta el fondo de la región. Medido
// (Playwright headless, `.scratch/medir-tarjeta-panel.mjs`, NO commiteado): con UN producto,
// 346px de estiramiento en un viewport de 900px de alto, 895px en uno de 1440 — más visible
// cuanto más alta la pantalla, que es EXACTAMENTE el reporte del owner (laptop bien, monitor
// externo alargada).
//
// EL FIX: `align-content: start` en el PRIMITIVO (no sólo en el contexto de alto fijo) — una
// rejilla de tarjetas no debería estirar sus filas en ningún contexto. Tras el fix, medido con
// el mismo arnés: la tarjeta mide lo mismo (306px/297px, la diferencia es sólo el ancho de
// columna que cambia con auto-fill) en los dos viewports, y con varias tarjetas las filas
// SIGUEN igualándose ENTRE SÍ (align-items intacto) sin estirarse hacia el sobrante del
// contenedor.

function leerPrimitivesCss(): string {
  const ruta = path.join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../packages/design-system/primitives/primitives.css',
  );
  return readFileSync(ruta, 'utf8');
}

/** Extrae el cuerpo de la PRIMERA regla `.duna-cards { ... }` del archivo — falla con un
 *  mensaje explícito si el selector no existe, en vez de un `match` null silencioso. */
function reglaDunaCards(fuente: string): string {
  const m = fuente.match(/\.duna-cards\s*\{([^}]*)\}/);
  assert.ok(m, 'primitives.css debería declarar una regla `.duna-cards { ... }` — si el selector cambió de nombre, hay que releer el archivo, no reescribir este test a ciegas');
  return m![1];
}

test('.duna-cards declara align-content: start — las filas de la rejilla no se estiran para llenar el sobrante vertical', () => {
  const cuerpo = reglaDunaCards(leerPrimitivesCss());
  assert.match(
    cuerpo,
    /align-content:\s*start\s*;/,
    'sin `align-content: start`, `.duna-cards` vuelve a heredar `normal` (= `stretch` para un grid), y dentro de una región de alto fijo con pocas filas la tarjeta se estira hasta el fondo de la región — el defecto que este slice cierra',
  );
});

test('.duna-cards NO declara align-items propio — dentro de UNA fila, las tarjetas se siguen igualando a la más alta (comportamiento correcto, no tocado por este fix)', () => {
  const cuerpo = reglaDunaCards(leerPrimitivesCss());
  assert.doesNotMatch(
    cuerpo,
    /align-items\s*:/,
    'el fix es sólo de `align-content` (la distribución de las FILAS dentro del contenedor); `align-items` (la altura de cada tarjeta DENTRO de su fila) debe seguir en el default `stretch` — declararlo acá sería un cambio de alcance no medido por este slice',
  );
});

test('.duna-cards sigue siendo grid auto-fill con el mínimo derivado de --duna-list-w — el fix no tocó la forma de columnas', () => {
  const cuerpo = reglaDunaCards(leerPrimitivesCss());
  assert.match(cuerpo, /display:\s*grid\s*;/);
  assert.match(cuerpo, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(calc\(var\(--duna-list-w\)\s*\/\s*2\),\s*1fr\)\)\s*;/);
});
