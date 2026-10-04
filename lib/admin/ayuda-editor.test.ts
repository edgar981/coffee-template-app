import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUIAS_AYUDA, PREGUNTAS_FRECUENTES, ATAJOS_TECLADO, NIVELES_PANEL,
  temaDeNivel, buscarAyuda,
} from './ayuda-editor';

// EL CONTRATO del centro de ayuda (§ EDITOR-AYUDA-1): ids únicos dentro de cada colección, y todo
// nivel que una guía reclama tiene que ser un nivel REAL del panel — nunca un nombre inventado que
// el «?» de una sección deje apuntando a nada. Afirma lo que el spec pidió: "un test que falle si
// una guía apunta a un nivel del panel que no existe, o si hay ids repetidos."

test('ids de guías son únicos', () => {
  const ids = GUIAS_AYUDA.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('ids de preguntas frecuentes son únicos', () => {
  const ids = PREGUNTAS_FRECUENTES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('ids de atajos de teclado son únicos', () => {
  const ids = ATAJOS_TECLADO.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('hay al menos una guía, pregunta y atajo (el centro de ayuda no abre vacío)', () => {
  assert.ok(GUIAS_AYUDA.length > 0);
  assert.ok(PREGUNTAS_FRECUENTES.length > 0);
  assert.ok(ATAJOS_TECLADO.length > 0);
});

test('toda guía tiene al menos un paso, un resumen y al menos una palabra clave', () => {
  for (const g of GUIAS_AYUDA) {
    assert.ok(g.pasos.length > 0, `${g.id} no tiene pasos`);
    assert.ok(g.resumen.trim().length > 0, `${g.id} no tiene resumen`);
    assert.ok(g.palabrasClave.length > 0, `${g.id} no tiene palabras clave`);
  }
});

test('NIVELES_PANEL no tiene duplicados — las cuatro fuentes (meta, cromo, elemento hero, secciones) no se pisan', () => {
  assert.equal(new Set(NIVELES_PANEL).size, NIVELES_PANEL.length);
});

test('todo nivel que una guía reclama existe en NIVELES_PANEL', () => {
  const validos = new Set(NIVELES_PANEL);
  for (const g of GUIAS_AYUDA) {
    for (const nivel of g.niveles) {
      assert.ok(validos.has(nivel), `${g.id} reclama el nivel "${nivel}", que no existe en NIVELES_PANEL`);
    }
  }
});

test('ningún nivel lo reclaman dos guías a la vez — el «?» de un nivel no puede ser ambiguo', () => {
  const dueno = new Map<string, string>();
  for (const g of GUIAS_AYUDA) {
    for (const nivel of g.niveles) {
      const yaReclamado = dueno.get(nivel);
      assert.ok(!yaReclamado, `el nivel "${nivel}" lo reclaman "${yaReclamado}" y "${g.id}"`);
      dueno.set(nivel, g.id);
    }
  }
});

test('temaDeNivel resuelve "hero" y las cuatro zonas del hero a la guía del hero', () => {
  for (const nivel of ['hero', 'titular', 'subtitulo', 'botones', 'indicador']) {
    assert.equal(temaDeNivel(nivel), 'hero');
  }
});

test('temaDeNivel resuelve encabezado/menu/footer a la guía de cromo', () => {
  for (const nivel of ['encabezado', 'menu', 'footer']) {
    assert.equal(temaDeNivel(nivel), 'cromo');
  }
});

test('temaDeNivel resuelve "estilo" a la guía de estilo, e "inicio" a la de secciones', () => {
  assert.equal(temaDeNivel('estilo'), 'estilo');
  assert.equal(temaDeNivel('inicio'), 'secciones');
});

test('temaDeNivel resuelve una sección de contenido cualquiera (no-hero) a la guía genérica de secciones', () => {
  assert.equal(temaDeNivel('brandStory'), 'secciones');
  assert.equal(temaDeNivel('testimonials'), 'secciones');
});

test('temaDeNivel sobre un nivel desconocido (p. ej. el id de una sección agregada) cae a "secciones", nunca lanza', () => {
  assert.equal(temaDeNivel('instancia-9x7k2'), 'secciones');
  assert.equal(temaDeNivel(''), 'secciones');
});

test('buscarAyuda con consulta vacía no devuelve nada — preferir callar, la lista completa ya está a la vista', () => {
  const r = buscarAyuda('   ');
  assert.deepEqual(r, { guias: [], preguntas: [] });
});

test('buscarAyuda "foto" encuentra la guía de Fotos y videos por palabra clave', () => {
  const r = buscarAyuda('foto');
  assert.ok(r.guias.some((g) => g.id === 'fotos-videos'));
});

test('buscarAyuda es insensible a mayúsculas y a acentos', () => {
  const sinAcento = buscarAyuda('publicar');
  const conAcento = buscarAyuda('PUBLICAR');
  assert.ok(sinAcento.guias.some((g) => g.id === 'publicar'));
  assert.deepEqual(conAcento.guias.map((g) => g.id).sort(), sinAcento.guias.map((g) => g.id).sort());
});

test('buscarAyuda encuentra una pregunta frecuente por su texto', () => {
  const r = buscarAyuda('perdí todo');
  assert.ok(r.preguntas.some((p) => p.id === 'cerre-sin-publicar'));
});

test('buscarAyuda sin coincidencias devuelve listas vacías, no lanza', () => {
  const r = buscarAyuda('xyzxyzxyz-no-existe');
  assert.deepEqual(r, { guias: [], preguntas: [] });
});
