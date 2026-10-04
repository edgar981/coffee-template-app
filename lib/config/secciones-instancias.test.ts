import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECCION_INSTANCIA_TIPOS, DESCRIPTOR_INSTANCIA, DEFAULTS_INSTANCIA,
  esSeccionInstanciaTipo, esInstanciaId, INSTANCIA_PREFIJO,
  resolverInstancia, resolverSeccionesHome, resolverOrdenCompleto,
  imagenesDeInstancia, instanciaOscuraCanonica, instanciaEsUniforme,
} from './secciones-instancias';
import { siteContentEditableSchema } from './site-content-schema';

// LA DERIVACIÓN (§ SECCIONES-INSTANCIAS-1): el DESCRIPTOR es la única fuente por tipo; este test
// afirma que el resolver no inventa ni se come ningún campo que el descriptor declara, y que los
// DEFAULTS cubren exactamente las mismas claves (más `tipo`) — las "tres derivaciones" del spec son
// resolver + schema (afirmado en site-content-schema.test.ts, que compara contra ESTE descriptor) +
// este test de paridad resolver↔descriptor↔defaults.
test('DESCRIPTOR_INSTANCIA: cada tipo tiene EXACTAMENTE sus campos cubiertos en DEFAULTS_INSTANCIA', () => {
  for (const tipo of SECCION_INSTANCIA_TIPOS) {
    const camposDescriptor = new Set(Object.keys(DESCRIPTOR_INSTANCIA[tipo].campos));
    const escalares = new Set(Object.keys(DESCRIPTOR_INSTANCIA[tipo].escalares ?? {}));
    const camposDefault = new Set(Object.keys(DEFAULTS_INSTANCIA[tipo]).filter((k) => k !== 'tipo'));
    const esperado = new Set([...camposDescriptor, ...escalares]);
    assert.deepEqual(camposDefault, esperado, `defaults de "${tipo}" deben cubrir exactamente campos+escalares del descriptor`);
  }
});

test('esSeccionInstanciaTipo: acepta los tres, rechaza basura', () => {
  assert.equal(esSeccionInstanciaTipo('texto'), true);
  assert.equal(esSeccionInstanciaTipo('imagenTexto'), true);
  assert.equal(esSeccionInstanciaTipo('banner'), true);
  assert.equal(esSeccionInstanciaTipo('hero'), false);
  assert.equal(esSeccionInstanciaTipo(''), false);
  assert.equal(esSeccionInstanciaTipo(123), false);
  assert.equal(esSeccionInstanciaTipo(undefined), false);
});

test('esInstanciaId: exige el prefijo Y algo después de él', () => {
  assert.equal(esInstanciaId(`${INSTANCIA_PREFIJO}abc`), true);
  assert.equal(esInstanciaId('hero'), false);
  assert.equal(esInstanciaId('marquesina'), false);
  assert.equal(esInstanciaId(INSTANCIA_PREFIJO), false, 'el prefijo solo, sin id detrás, no cuenta');
  assert.equal(esInstanciaId('inst'), false, 'sin los dos puntos no es el prefijo');
});

test('resolverInstancia: null con basura, con tipo desconocido, o sin tipo', () => {
  assert.equal(resolverInstancia(null), null);
  assert.equal(resolverInstancia('un string'), null);
  assert.equal(resolverInstancia([1, 2, 3]), null);
  assert.equal(resolverInstancia({ titulo: 'sin tipo' }), null);
  assert.equal(resolverInstancia({ tipo: 'carrusel-inventado', titulo: 'x' }), null);
});

test('resolverInstancia: "texto" — requerido vacío cae al default, opcional presente se respeta', () => {
  const r = resolverInstancia({ tipo: 'texto', titulo: '', texto: 'Hola', ctaLabel: '' });
  assert.deepEqual(r, {
    tipo: 'texto',
    antetitulo: DEFAULTS_INSTANCIA.texto.antetitulo,
    titulo: DEFAULTS_INSTANCIA.texto.titulo,
    texto: 'Hola',
    ctaLabel: '',
    ctaDestino: '',
    alineacion: 'centro',
  });
});

test('resolverInstancia: "texto" — opcional AUSENTE cae al default; opcional PRESENTE-vacío se respeta', () => {
  const sinCtaLabel = resolverInstancia({ tipo: 'texto', titulo: 'T' });
  assert.equal((sinCtaLabel as { ctaLabel: string }).ctaLabel, '', 'ausente -> default (vacío)');

  const conCtaLabelVacio = resolverInstancia({ tipo: 'texto', titulo: 'T', texto: 'ya tenía texto', ctaLabel: '' });
  assert.equal((conCtaLabelVacio as { ctaLabel: string }).ctaLabel, '', 'presente-vacío también da vacío (mismo valor, pero por la rama correcta)');
});

test('resolverInstancia: "texto" — alineación basura cae a la canónica', () => {
  const r = resolverInstancia({ tipo: 'texto', titulo: 'T', alineacion: 'arriba-a-la-derecha' });
  assert.equal((r as { alineacion: string }).alineacion, 'centro');
  const ok = resolverInstancia({ tipo: 'texto', titulo: 'T', alineacion: 'derecha' });
  assert.equal((ok as { alineacion: string }).alineacion, 'derecha');
});

test('resolverInstancia: "imagenTexto" — imagen es OPCIONAL, sin default (nunca inventa una foto)', () => {
  const r = resolverInstancia({ tipo: 'imagenTexto', titulo: 'T' });
  assert.equal((r as { imagen: string }).imagen, '', 'sin fila, la imagen queda vacía -- el hueco "Agregar foto", no un placeholder robado');
});

test('resolverInstancia: "banner" — alto clampa al set cerrado de tres pasos', () => {
  assert.equal((resolverInstancia({ tipo: 'banner', titulo: 'T', alto: 'alto' }) as { alto: string }).alto, 'alto');
  assert.equal((resolverInstancia({ tipo: 'banner', titulo: 'T', alto: 'gigante' }) as { alto: string }).alto, 'justo');
});

test('resolverSeccionesHome: descarta ids SIN el prefijo de instancia, aunque el valor sea válido', () => {
  const out = resolverSeccionesHome({
    hero: { tipo: 'texto', titulo: 'colado sin prefijo' },
    [`${INSTANCIA_PREFIJO}a`]: { tipo: 'texto', titulo: 'esta sí' },
  });
  assert.deepEqual(Object.keys(out), [`${INSTANCIA_PREFIJO}a`]);
});

test('resolverSeccionesHome: descarta instancias con tipo desconocido o forma rota, conserva las válidas', () => {
  const out = resolverSeccionesHome({
    [`${INSTANCIA_PREFIJO}a`]: { tipo: 'texto', titulo: 'Válida' },
    [`${INSTANCIA_PREFIJO}b`]: { tipo: 'no-existe', titulo: 'Rota' },
    [`${INSTANCIA_PREFIJO}c`]: 'basura',
    [`${INSTANCIA_PREFIJO}d`]: null,
  });
  assert.deepEqual(Object.keys(out), [`${INSTANCIA_PREFIJO}a`]);
});

test('resolverSeccionesHome: con stored no-objeto da {} -- nunca lanza', () => {
  assert.deepEqual(resolverSeccionesHome(undefined), {});
  assert.deepEqual(resolverSeccionesHome(null), {});
  assert.deepEqual(resolverSeccionesHome('x'), {});
  assert.deepEqual(resolverSeccionesHome([1, 2]), {});
});

// ─── resolverOrdenCompleto — EL EJE DEL CONTRATO: "sin la clave = idéntico a hoy" ────────────────

const BANDAS_FICTICIAS = ['hero', 'marquesina', 'brandStory'] as const;

test('resolverOrdenCompleto: sin instancias, es BYTE-IDÉNTICO a resolver sólo bandas', () => {
  const r = resolverOrdenCompleto(['brandStory', 'hero'], BANDAS_FICTICIAS, []);
  assert.deepEqual(r, ['brandStory', 'hero', 'marquesina']);
});

test('resolverOrdenCompleto: una instancia mencionada en stored Y presente en instanciaIds entra en su posición', () => {
  const id = `${INSTANCIA_PREFIJO}x`;
  const r = resolverOrdenCompleto(['hero', id, 'marquesina', 'brandStory'], BANDAS_FICTICIAS, [id]);
  assert.deepEqual(r, ['hero', id, 'marquesina', 'brandStory']);
});

test('resolverOrdenCompleto: un id con el prefijo de instancia pero SIN instancia real se descarta ("el id entra a orden sólo si su instancia existe")', () => {
  const idFantasma = `${INSTANCIA_PREFIJO}no-existe`;
  const r = resolverOrdenCompleto(['hero', idFantasma, 'marquesina'], BANDAS_FICTICIAS, []);
  assert.ok(!r.includes(idFantasma), 'una instancia que ya no existe no puede seguir ocupando un slot');
  assert.deepEqual(new Set(r), new Set(BANDAS_FICTICIAS));
});

test('resolverOrdenCompleto: una instancia que falta en stored se agrega AL FINAL, después de completar las bandas', () => {
  const id = `${INSTANCIA_PREFIJO}nueva`;
  const r = resolverOrdenCompleto(['marquesina'], BANDAS_FICTICIAS, [id]);
  assert.deepEqual(r, ['marquesina', 'hero', 'brandStory', id]);
});

test('resolverOrdenCompleto: basura (tipo desconocido, duplicados, no-array) nunca hace caer una banda o una instancia', () => {
  const id = `${INSTANCIA_PREFIJO}a`;
  const r1 = resolverOrdenCompleto('no es un array', BANDAS_FICTICIAS, [id]);
  assert.deepEqual(new Set(r1), new Set([...BANDAS_FICTICIAS, id]));

  const r2 = resolverOrdenCompleto(['hero', 'hero', id, id, 'inventada'], BANDAS_FICTICIAS, [id]);
  assert.deepEqual(r2, ['hero', id, 'marquesina', 'brandStory'], 'dedup: primera aparición gana, sin repetir');
});

test('imagenesDeInstancia: sólo los campos declarados como imagen, no strings vacíos', () => {
  assert.deepEqual(imagenesDeInstancia({ tipo: 'imagenTexto', imagen: '/x.jpg' }), ['/x.jpg']);
  assert.deepEqual(imagenesDeInstancia({ tipo: 'imagenTexto', imagen: '' }), []);
  assert.deepEqual(imagenesDeInstancia({ tipo: 'texto', titulo: 'sin campo imagen' }), []);
  assert.deepEqual(imagenesDeInstancia({ tipo: 'desconocido', imagen: '/x.jpg' }), []);
  assert.deepEqual(imagenesDeInstancia(null), []);
});

// ─── LA DERIVACIÓN, SEGUNDA MITAD: el SCHEMA cubre EXACTAMENTE los campos del DESCRIPTOR ──────────
//
// `site-content-schema.test.ts` ya afirma la derivación modelo→schema para las secciones del
// REGISTRY (`camposDelSchema`, introspección de `.shape`); acá, por ROUND-TRIP, para las tres del
// catálogo de instancias — más robusto frente a la forma interna de `z.discriminatedUnion`
// (record→unión discriminada, sin un `.unwrap()` de una sola sección que reusar). Si el DESCRIPTOR
// declara un campo que el schema de ESE tipo no tiene, el parse lo STRIPPEA en silencio y este test
// lo detecta por su AUSENCIA en el resultado; si el schema declara un campo que el descriptor no
// tiene, sobra una clave en el resultado que el descriptor nunca predijo.
test('DESCRIPTOR_INSTANCIA ⊆ schema: cada campo+escalar de cada tipo SOBREVIVE el parse (sin strip silencioso)', () => {
  for (const tipo of SECCION_INSTANCIA_TIPOS) {
    const descriptor = DESCRIPTOR_INSTANCIA[tipo];
    const camposEsperados = new Set(['tipo', ...Object.keys(descriptor.campos), ...Object.keys(descriptor.escalares ?? {})]);
    const muestra: Record<string, unknown> = { tipo };
    for (const campo of Object.keys(descriptor.campos)) muestra[campo] = campo.toLowerCase().includes('destino') ? '' : 'x';
    for (const campo of Object.keys(descriptor.escalares ?? {})) muestra[campo] = 'x';

    const parsed = siteContentEditableSchema.parse({ seccionesHome: { 'inst:muestra': muestra } });
    const resultado = parsed.seccionesHome!['inst:muestra'] as Record<string, unknown>;
    assert.deepEqual(new Set(Object.keys(resultado)), camposEsperados,
      `"${tipo}": el schema y el descriptor deben declarar EXACTAMENTE los mismos campos (faltantes o sobrantes = un campo se perdería en silencio al guardar)`);
  }
});

test('instanciaOscuraCanonica / instanciaEsUniforme: banner oscuro y uniforme, imagenTexto no-uniforme, texto claro y uniforme', () => {
  assert.equal(instanciaOscuraCanonica('banner'), true);
  assert.equal(instanciaOscuraCanonica('texto'), false);
  assert.equal(instanciaOscuraCanonica('imagenTexto'), false);
  assert.equal(instanciaEsUniforme('banner'), true);
  assert.equal(instanciaEsUniforme('texto'), true);
  assert.equal(instanciaEsUniforme('imagenTexto'), false);
});
