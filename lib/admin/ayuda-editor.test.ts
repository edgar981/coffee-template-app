import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUIAS_AYUDA, PREGUNTAS_FRECUENTES, ATAJOS_TECLADO, NIVELES_PANEL,
  temaDeNivel, buscarAyuda,
} from './ayuda-editor';
import { CATALOGO_INSTANCIAS } from '@/lib/config/secciones-instancias';

// EL CONTRATO del centro de ayuda (§ EDITOR-AYUDA-1): ids únicos dentro de cada colección, y todo
// nivel que una guía reclama tiene que ser un nivel REAL del panel — nunca un nombre inventado que
// el «?» de una sección deje apuntando a nada. Afirma lo que el spec pidió: "un test que falle si
// una guía apunta a un nivel del panel que no existe, o si hay ids repetidos."

// § MOVIMIENTO-NIVEL-FIRMA-1 — la lista de tipos de «Agregar sección» (paso de la guía "secciones")
// se DERIVA de `CATALOGO_INSTANCIAS`, nunca escrita a mano: estaba vencida (le faltaban Collage,
// Video, Carrusel y Proceso) y una lista a mano vuelve a vencer la próxima vez que el catálogo gane
// un tipo. Este test afirma que CADA nombre del catálogo aparece en el texto del paso, para que un
// tipo nuevo que no se derive correctamente lo delate.
test('la guía "secciones" menciona CADA nombre de CATALOGO_INSTANCIAS en su paso de «Agregar sección»', () => {
  const guia = GUIAS_AYUDA.find((g) => g.id === 'secciones')!;
  const pasoAgregar = guia.pasos.find((p) => p.texto.includes('Agregar sección'))!;
  assert.ok(pasoAgregar, 'debe existir un paso que mencione «Agregar sección»');
  for (const entrada of CATALOGO_INSTANCIAS) {
    assert.ok(pasoAgregar.texto.includes(entrada.nombre), `falta "${entrada.nombre}" en el paso de Agregar sección`);
  }
});

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

// EL COPY VA EN TUTEO COLOMBIANO, NUNCA VOSEO (§ CLAUDE.md, "El COPY va en TUTEO colombiano").
// Este test recorre TODO el texto de cara al dueño de la tienda —título, resumen, cada paso y su
// secuencia, palabras clave, preguntas/respuestas y atajos— y falla si encuentra una forma de
// voseo. La lista son las formas acentuadas típicas que ya mordieron tres tandas seguidas (§
// CLAUDE.md, el barrido de grep de esa sección) más las que este mismo archivo tuvo en voseo
// antes de corregirse (tocá, podés, elegí, cambiás, fijate, agregá…).
const FORMAS_VOSEO = [
  'tocá', 'tocás', 'podés', 'elegí', 'elegís', 'usá', 'usás', 'subí', 'subís',
  'abrí', 'abrís', 'escribí', 'escribís', 'mirá', 'mirás', 'volvé', 'volvés',
  'hacé', 'hacés', 'poné', 'ponés', 'pasá', 'pasás', 'cambiá', 'cambiás',
  'quitá', 'quitás', 'agregá', 'agregás', 'publicá', 'publicás', 'descartá',
  'descartás', 'buscá', 'buscás', 'querés', 'necesitás', 'sabés', 'tenés',
  'probá', 'probás', 'dejá', 'dejás', 'mandá', 'mandás', 'arrastrá', 'arrastrás',
  'editá', 'editás', 'guardá', 'guardás', 'iniciá', 'iniciás', 'apretá', 'apretás',
  'seguís', 'arrepentís', 'fijate', 'acordate', 'revisá', 'revisás',
] as const;
// `\b` NO sirve acá: en JS una vocal acentuada (á/é/í) no es `\w`, así que `\btocá\b` matchea
// adentro de "tocándolos" o "escribía" — el límite real es "no hay otra LETRA (acentuada o no)
// antes/después", no el límite de palabra ASCII de `\b`.
const LETRA = 'a-zA-ZáéíóúñÁÉÍÓÚÑ';
const REGEX_VOSEO = new RegExp(`(?<![${LETRA}])(${FORMAS_VOSEO.join('|')})(?![${LETRA}])`, 'i');

function textosDeGuia(g: (typeof GUIAS_AYUDA)[number]): { campo: string; texto: string }[] {
  const textos = [
    { campo: 'titulo', texto: g.titulo },
    { campo: 'resumen', texto: g.resumen },
    ...g.palabrasClave.map((k) => ({ campo: 'palabrasClave', texto: k })),
  ];
  g.pasos.forEach((p, i) => {
    textos.push({ campo: `pasos[${i}].texto`, texto: p.texto });
    (p.secuencia ?? []).forEach((s, j) => textos.push({ campo: `pasos[${i}].secuencia[${j}]`, texto: s }));
  });
  return textos;
}

test('ninguna guía usa voseo — todo el texto va en tuteo colombiano', () => {
  for (const g of GUIAS_AYUDA) {
    for (const { campo, texto } of textosDeGuia(g)) {
      const m = texto.match(REGEX_VOSEO);
      assert.equal(m, null, `guía "${g.id}" (${campo}) usa voseo ("${m?.[0]}"): "${texto}"`);
    }
  }
});

test('ninguna pregunta frecuente usa voseo', () => {
  for (const p of PREGUNTAS_FRECUENTES) {
    const campos = [
      { campo: 'pregunta', texto: p.pregunta },
      { campo: 'respuesta', texto: p.respuesta },
      ...(p.palabrasClave ?? []).map((k) => ({ campo: 'palabrasClave', texto: k })),
    ];
    for (const { campo, texto } of campos) {
      const m = texto.match(REGEX_VOSEO);
      assert.equal(m, null, `pregunta "${p.id}" (${campo}) usa voseo ("${m?.[0]}"): "${texto}"`);
    }
  }
});

test('ningún atajo de teclado usa voseo', () => {
  for (const a of ATAJOS_TECLADO) {
    const campos = [
      { campo: 'combinacion', texto: a.combinacion },
      { campo: 'accion', texto: a.accion },
    ];
    for (const { campo, texto } of campos) {
      const m = texto.match(REGEX_VOSEO);
      assert.equal(m, null, `atajo "${a.id}" (${campo}) usa voseo ("${m?.[0]}"): "${texto}"`);
    }
  }
});
