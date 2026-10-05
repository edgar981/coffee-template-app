import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PASOS_RECORRIDO, ATRIBUTO_RECORRIDO, recorridoEstaVisto, objetivoDisponible,
  calcularFranjas, posicionGlobo,
} from './recorrido-editor';

// EL CONTRATO del recorrido (§ EDITOR-AYUDA-RECORRIDO-1): ids únicos, cada paso apunta a un
// atributo que EXISTE de verdad en el código del editor (§ el spec: "un test que lo verifique
// contra el código o el DOM renderizado" — el repo no tiene jsdom para *.test.tsx, así que esto se
// verifica contra el CÓDIGO, § CLAUDE.md "El glob NO incluye *.test.tsx"), y la geometría pura que
// decide el hueco y la posición del globo.

test('ids de pasos son únicos', () => {
  const ids = PASOS_RECORRIDO.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('hay al menos un paso, y todos tienen título y frase', () => {
  assert.ok(PASOS_RECORRIDO.length > 0);
  for (const p of PASOS_RECORRIDO) {
    assert.ok(p.titulo.trim().length > 0, `${p.id} no tiene título`);
    assert.ok(p.frase.trim().length > 0, `${p.id} no tiene frase`);
  }
});

// EL MAPA id→(archivo, patrones) es del TEST, no del dato puro (§ `recorrido-editor.ts`, el
// docstring de `PasoRecorridoId`: el id ES el valor del atributo, sin un segundo campo que pudiera
// divergir). Verificar DÓNDE y CÓMO vive cada marcador es responsabilidad de quien ata el dato al
// código, y por eso vive acá.
//
// LOS PATRONES SON LA FORMA REAL DE CADA SITIO, no un `data-tour="id"` genérico — cuatro de los
// siete escriben el atributo LITERAL (el botón/div sólo existe cuando debe resaltarse: `lienzo`,
// `panel`, `agregar-seccion`, `publicar`), dos lo escriben CONDICIONAL con el idioma
// `{ cond ? 'id' : undefined }` (`hero`, `telefono` — React omite el atributo cuando es
// `undefined`, mismo idioma que `data-sf-tarjeta={preview ? op.slot : undefined}`, § CLAUDE.md), y
// uno lo escribe por INDIRECCIÓN vía un prop (`estilo`, en `Riel.tsx`: el ítem declara `tour:
// 'estilo'` y el botón renderiza `data-tour={tour}` — dos piezas, ninguna sola prueba la cadena).
//
// CADA PATRÓN SE BUSCA SOBRE EL CÓDIGO SIN COMENTARIOS (§ abajo, `sinComentarios`): los docstrings
// de esta misma tanda escriben `data-tour="hero"` en PROSA (dentro de backticks, para explicar la
// decisión) — si el test buscara esa cadena contra el archivo CRUDO, pasaría aunque el código real
// usara otro atributo, porque la prueba la daría el comentario, no la función. Es la misma trampa
// que CLAUDE.md ya nombra para el grep del artefacto: "un discriminador flojo miente… puede dar
// cero (o, acá, un falso verde) por una reubicación sin que el cambio esté".
interface PatronPaso { archivo: string; patrones: RegExp[] }
const PATRON_DEL_PASO: Record<string, PatronPaso> = {
  lienzo: { archivo: 'components/admin/TiendaPaginas.tsx', patrones: [/data-tour="lienzo"/] },
  panel: { archivo: 'components/admin/TiendaPaginas.tsx', patrones: [/data-tour="panel"/] },
  hero: {
    archivo: 'components/admin/TiendaPaginas.tsx',
    patrones: [/data-tour=\{config\.seccion === 'hero' \? 'hero' : undefined\}/],
  },
  'agregar-seccion': { archivo: 'components/admin/TiendaPaginas.tsx', patrones: [/data-tour="agregar-seccion"/] },
  estilo: {
    archivo: 'components/admin/editor/Riel.tsx',
    patrones: [/tour:\s*'estilo'/, /data-tour=\{tour\}/],
  },
  telefono: {
    archivo: 'components/admin/EditorTiendaPantallaCompleta.tsx',
    patrones: [/data-tour=\{key === 'telefono' \? 'telefono' : undefined\}/],
  },
  publicar: { archivo: 'components/admin/editor/ResumenPublicar.tsx', patrones: [/data-tour="publicar"/] },
};

test('todo paso tiene un patrón declarado donde buscar su marcador', () => {
  for (const p of PASOS_RECORRIDO) {
    assert.ok(PATRON_DEL_PASO[p.id], `${p.id} no tiene patrón declarado en el test`);
  }
});

test('ningún paso del dato quedó sin su patrón en el mapa del test, y viceversa', () => {
  const idsDato = new Set(PASOS_RECORRIDO.map((p) => p.id));
  const idsMapa = new Set(Object.keys(PATRON_DEL_PASO));
  assert.deepEqual([...idsDato].sort(), [...idsMapa].sort());
});

/** Quita los comentarios de LÍNEA (`// …`) y de BLOQUE (`/* … *\/`) de una fuente TS/TSX — tosco
 *  (no entiende un `//` dentro de un string), pero suficiente para este archivo: ninguna de las
 *  líneas con `data-tour` real de este slice tiene un `//`/`/* `*\/` dentro de un string. */
// § EDITOR-PANEL-PIEL-1 — EXPORTADO: `lib/admin/copy-editor.test.ts` lo reusa para su propio barrido
// de jerga/ledger-ids — un segundo `sinComentarios` local habría sido la MISMA trampa que
// `razonDelServidor`/`cruzoMinimo` ya duplicados y divergentes (§ CLAUDE.md).
export function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('el atributo de CADA paso existe de verdad en el CÓDIGO (sin comentarios) de su archivo', () => {
  const raiz = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
  for (const p of PASOS_RECORRIDO) {
    const { archivo, patrones } = PATRON_DEL_PASO[p.id];
    const ruta = path.join(raiz, archivo);
    const codigo = sinComentarios(readFileSync(ruta, 'utf8'));
    for (const patron of patrones) {
      assert.ok(
        patron.test(codigo),
        `${ruta} no contiene ${patron} en su código (sin comentarios) — el paso "${p.id}" apunta a un atributo que no existe`,
      );
    }
  }
});

test('ATRIBUTO_RECORRIDO sigue siendo "data-tour" — si cambiara, los patrones de arriba quedarían desactualizados', () => {
  assert.equal(ATRIBUTO_RECORRIDO, 'data-tour');
});

test('recorridoEstaVisto sólo es verdadero con el valor exacto "1"', () => {
  assert.equal(recorridoEstaVisto('1'), true);
  assert.equal(recorridoEstaVisto(null), false);
  assert.equal(recorridoEstaVisto(''), false);
  assert.equal(recorridoEstaVisto('true'), false);
  assert.equal(recorridoEstaVisto('0'), false);
});

test('objetivoDisponible es falso sin rect, y con un rect 0×0 (display:none no lo quita, lo colapsa)', () => {
  assert.equal(objetivoDisponible(null), false);
  assert.equal(objetivoDisponible({ width: 0, height: 0 }), false);
  assert.equal(objetivoDisponible({ width: 0, height: 40 }), false);
  assert.equal(objetivoDisponible({ width: 120, height: 0 }), false);
  assert.equal(objetivoDisponible({ width: 120, height: 40 }), true);
});

test('calcularFranjas deja el hueco exacto del objetivo + margen, y las cuatro franjas no lo cubren', () => {
  const objetivo = { top: 100, left: 200, width: 300, height: 50 };
  const { arriba, abajo, izquierda, derecha } = calcularFranjas(objetivo, 10, 1000, 800);
  assert.deepEqual(arriba, { top: 0, left: 0, width: 1000, height: 90 });
  assert.equal(abajo.top, 160);
  assert.equal(abajo.height, 640);
  assert.equal(izquierda.width, 190);
  assert.equal(izquierda.top, 90);
  assert.equal(izquierda.height, 70);
  assert.equal(derecha.left, 510);
  assert.equal(derecha.width, 490);
  assert.equal(derecha.height, 70);
});

test('calcularFranjas clampea al viewport — un objetivo pegado al borde no da anchos/altos negativos', () => {
  const objetivo = { top: 0, left: 0, width: 50, height: 20 };
  const { arriba, izquierda } = calcularFranjas(objetivo, 10, 500, 400);
  assert.equal(arriba.height, 0);
  assert.equal(izquierda.width, 0);
});

test('posicionGlobo prefiere ABAJO del objetivo cuando entra', () => {
  const objetivo = { top: 100, left: 100, width: 200, height: 40 };
  const pos = posicionGlobo(objetivo, 300, 200, 1200, 800, 16);
  assert.equal(pos.top, 156); // 100 + 40 + 16
  assert.equal(pos.left, 100);
});

test('posicionGlobo cae a ARRIBA cuando abajo no entra', () => {
  const objetivo = { top: 650, left: 100, width: 200, height: 40 };
  const pos = posicionGlobo(objetivo, 300, 200, 1200, 800, 16);
  // abajo: 650+40+16+200=906 > 800 (no entra) · arriba: 650-16-200=434 >= 0 (entra)
  assert.equal(pos.top, 434);
  assert.equal(pos.left, 100);
});

test('posicionGlobo cae a la DERECHA cuando ni abajo ni arriba entran', () => {
  // un objetivo muy alto (ocupa casi todo el alto del viewport): ni debajo ni encima hay 200px.
  const objetivo = { top: 10, left: 50, width: 120, height: 780 };
  const pos = posicionGlobo(objetivo, 300, 200, 1200, 800, 16);
  assert.equal(pos.left, 186); // 50+120+16
});

test('posicionGlobo cae a la IZQUIERDA cuando abajo/arriba/derecha no entran', () => {
  const objetivo = { top: 10, left: 1000, width: 190, height: 780 };
  const pos = posicionGlobo(objetivo, 300, 200, 1200, 800, 16);
  assert.equal(pos.left, 684); // 1000-16-300
});

test('posicionGlobo cae al CENTRO cuando ningún lado entra', () => {
  const objetivo = { top: 0, left: 0, width: 1200, height: 800 }; // cubre todo el viewport
  const pos = posicionGlobo(objetivo, 300, 200, 1200, 800, 16);
  assert.equal(pos.top, 300); // (800-200)/2
  assert.equal(pos.left, 450); // (1200-300)/2
});

test('posicionGlobo clampea horizontalmente para no salirse por la derecha', () => {
  const objetivo = { top: 100, left: 1150, width: 40, height: 20 };
  const pos = posicionGlobo(objetivo, 300, 200, 1200, 800, 16);
  assert.ok(pos.left + 300 <= 1200 - 16 + 0.001);
});
