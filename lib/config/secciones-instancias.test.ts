import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECCION_INSTANCIA_TIPOS, DESCRIPTOR_INSTANCIA, DEFAULTS_INSTANCIA,
  esSeccionInstanciaTipo, esInstanciaId, INSTANCIA_PREFIJO,
  resolverInstancia, resolverSeccionesHome, resolverOrdenCompleto,
  imagenesDeInstancia, instanciaOscuraCanonica, instanciaEsUniforme, instanciaEsVisible,
  CATALOGO_INSTANCIAS, nombreInstancia, nuevoIdInstancia, crearInstancia, TOPE_INSTANCIAS_HOME,
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
    // `visible` (§ SECCIONES-INSTANCIAS-VIVO-1) se excluye como `tipo`: es un escalar de INSTANCIA
    // resuelto a mano en `resolverInstancia`, nunca parte de `descriptor.campos`/`escalares` — misma
    // razón que `visible` de una banda no pertenece a `def.campos` en `site-content-defaults.ts`.
    // `items` (§ SECCIONES-TIPOS-2) se excluye por la MISMA razón: es el array REPEATER, resuelto
    // aparte por `resolverItemsInstancia`, nunca parte de `campos`/`escalares` (que son sólo la
    // cabecera plana de la instancia).
    const camposDefault = new Set(Object.keys(DEFAULTS_INSTANCIA[tipo]).filter((k) => k !== 'tipo' && k !== 'visible' && k !== 'items'));
    const esperado = new Set([...camposDescriptor, ...escalares]);
    assert.deepEqual(camposDefault, esperado, `defaults de "${tipo}" deben cubrir exactamente campos+escalares del descriptor`);
  }
});

test('DESCRIPTOR_INSTANCIA: un tipo REPEATER (`items` presente) siempre tiene `items` como array en DEFAULTS_INSTANCIA, y un tipo de campos planos NUNCA lo tiene', () => {
  for (const tipo of SECCION_INSTANCIA_TIPOS) {
    const esRepeater = !!DESCRIPTOR_INSTANCIA[tipo].items;
    const tieneItemsEnDefault = Array.isArray((DEFAULTS_INSTANCIA[tipo] as unknown as { items?: unknown }).items);
    assert.equal(tieneItemsEnDefault, esRepeater, `"${tipo}": items en DEFAULTS_INSTANCIA debe coincidir con si el descriptor declara items`);
  }
});

test('esSeccionInstanciaTipo: acepta los ocho del catálogo, rechaza basura', () => {
  assert.equal(esSeccionInstanciaTipo('texto'), true);
  assert.equal(esSeccionInstanciaTipo('imagenTexto'), true);
  assert.equal(esSeccionInstanciaTipo('banner'), true);
  assert.equal(esSeccionInstanciaTipo('preguntas'), true);
  assert.equal(esSeccionInstanciaTipo('columnas'), true);
  assert.equal(esSeccionInstanciaTipo('filas'), true);
  assert.equal(esSeccionInstanciaTipo('collage'), true);
  assert.equal(esSeccionInstanciaTipo('video'), true);
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
    visible: true,
  });
});

// ─── `visible` (§ SECCIONES-INSTANCIAS-VIVO-1) — EL OJO ─────────────────────────────────────────

test('resolverInstancia: sin `visible` en stored, cae al default del tipo (true)', () => {
  const r = resolverInstancia({ tipo: 'texto', titulo: 'T' }) as { visible: boolean };
  assert.equal(r.visible, true);
});

test('resolverInstancia: `visible: false` explícito se respeta', () => {
  const r = resolverInstancia({ tipo: 'banner', titulo: 'B', visible: false }) as { visible: boolean };
  assert.equal(r.visible, false);
});

test('resolverInstancia: `visible: true` explícito se respeta (no es sólo "ausente -> true")', () => {
  const r = resolverInstancia({ tipo: 'banner', titulo: 'B', visible: true }) as { visible: boolean };
  assert.equal(r.visible, true);
});

test('resolverInstancia: `visible` basura (no booleano) se ignora y cae al default — "sólo se sobreescribe con un booleano explícito"', () => {
  const r = resolverInstancia({ tipo: 'texto', titulo: 'T', visible: 'no' }) as { visible: boolean };
  assert.equal(r.visible, true);
});

test('instanciaEsVisible: true por default, false sólo con visible===false explícito', () => {
  const visible = resolverInstancia({ tipo: 'texto', titulo: 'T' })!;
  const oculta = resolverInstancia({ tipo: 'texto', titulo: 'T', visible: false })!;
  assert.equal(instanciaEsVisible(visible), true);
  assert.equal(instanciaEsVisible(oculta), false);
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

// ─── § SECCIONES-TIPOS-2 — LOS TRES REPEATER (Preguntas/Columnas/Filas) ─────────────────────────

test('resolverInstancia: "preguntas" — items se resuelve como array, descarta ítems no-objeto, normaliza a string', () => {
  const r = resolverInstancia({
    tipo: 'preguntas',
    items: [
      { pregunta: '¿Hay envío?', respuesta: 'Sí.' },
      'basura',
      { pregunta: 42, respuesta: null },
    ],
  }) as unknown as { items: { pregunta: string; respuesta: string }[] };
  assert.deepEqual(r.items, [
    { pregunta: '¿Hay envío?', respuesta: 'Sí.' },
    { pregunta: '', respuesta: '' },
  ], 'el ítem-string se descarta; el no-string se coerciona a vacío, nunca se inventa');
});

test('resolverInstancia: "columnas" — items ausente o no-array da []  (nunca lanza, nunca inventa ítems)', () => {
  assert.deepEqual((resolverInstancia({ tipo: 'columnas' }) as unknown as { items: unknown[] }).items, []);
  assert.deepEqual((resolverInstancia({ tipo: 'columnas', items: 'no es un array' }) as unknown as { items: unknown[] }).items, []);
  assert.deepEqual((resolverInstancia({ tipo: 'columnas', items: null }) as unknown as { items: unknown[] }).items, []);
});

test('resolverInstancia: "filas" — un ítem sin `imagen` en stored la normaliza a vacío (nunca inventa una foto)', () => {
  const r = resolverInstancia({ tipo: 'filas', items: [{ titulo: 'Fila 1' }] }) as unknown as { items: Record<string, string>[] };
  assert.deepEqual(r.items, [{ imagen: '', titulo: 'Fila 1', texto: '', ctaLabel: '', ctaDestino: '' }]);
});

test('instanciaEsVisible: REPEATER — hide-on-empty GANA sobre `visible:true` (items vacío = sin nada que mostrar)', () => {
  const vacia = resolverInstancia({ tipo: 'preguntas', visible: true, items: [] })!;
  const conItems = resolverInstancia({ tipo: 'preguntas', visible: true, items: [{ pregunta: 'x', respuesta: 'y' }] })!;
  assert.equal(instanciaEsVisible(vacia), false, 'items:[] oculta aunque visible sea true explícito');
  assert.equal(instanciaEsVisible(conItems), true);
});

test('instanciaEsVisible: REPEATER — `visible:false` sigue ocultando aunque haya items', () => {
  const r = resolverInstancia({ tipo: 'columnas', visible: false, items: [{ titulo: 'A' }, { titulo: 'B' }] })!;
  assert.equal(instanciaEsVisible(r), false);
});

test('imagenesDeInstancia: REPEATER — junta las imágenes de CADA ítem, no strings vacíos, nunca del campo "titulo"', () => {
  assert.deepEqual(
    imagenesDeInstancia({ tipo: 'columnas', items: [{ imagen: '/a.jpg', titulo: 'A' }, { imagen: '', titulo: 'B' }, { imagen: '/c.jpg', titulo: 'C' }] }),
    ['/a.jpg', '/c.jpg'],
  );
  assert.deepEqual(imagenesDeInstancia({ tipo: 'preguntas', items: [{ pregunta: 'x', respuesta: 'y' }] }), [], '"preguntas" no declara imagenes por ítem');
  assert.deepEqual(imagenesDeInstancia({ tipo: 'filas', items: 'no es un array' }), []);
});

test('DESCRIPTOR_INSTANCIA.columnas: "de dos a seis columnas" es el min/max del editor, y el default nace con exactamente 2', () => {
  assert.equal(DESCRIPTOR_INSTANCIA.columnas.items?.min, 2);
  assert.equal(DESCRIPTOR_INSTANCIA.columnas.items?.max, 6);
  assert.equal(DEFAULTS_INSTANCIA.columnas.items.length, 2);
});

test('DESCRIPTOR_INSTANCIA.preguntas/filas: sin tope (repeater puro, como Testimonios) — min 0', () => {
  assert.equal(DESCRIPTOR_INSTANCIA.preguntas.items?.min, 0);
  assert.equal(DESCRIPTOR_INSTANCIA.preguntas.items?.max, undefined);
  assert.equal(DESCRIPTOR_INSTANCIA.filas.items?.min, 0);
  assert.equal(DESCRIPTOR_INSTANCIA.filas.items?.max, undefined);
});

// ─── § SECCIONES-TIPOS-3 — "collage" y "video" ──────────────────────────────────────────────────

test('DESCRIPTOR_INSTANCIA.collage: "de tres a seis ítems" es el min/max del editor, y el default nace con exactamente 3', () => {
  assert.equal(DESCRIPTOR_INSTANCIA.collage.items?.min, 3);
  assert.equal(DESCRIPTOR_INSTANCIA.collage.items?.max, 6);
  assert.equal(DEFAULTS_INSTANCIA.collage.items.length, 3);
});

test('resolverInstancia: "collage" — items normaliza url/tipo/poster/enlace/leyenda a string, sin clampar `tipo` del ítem', () => {
  const r = resolverInstancia({
    tipo: 'collage',
    items: [
      { url: '/grande.mp4', tipo: 'video', poster: '/poster.jpg', enlace: '/tienda', leyenda: 'La grande' },
      { url: '/chica.jpg', titulo: 'ignorado', leyenda: 'Una chica' },
      { url: 42, tipo: null },
    ],
  }) as unknown as { items: Record<string, string>[] };
  assert.deepEqual(r.items, [
    { url: '/grande.mp4', tipo: 'video', poster: '/poster.jpg', enlace: '/tienda', leyenda: 'La grande' },
    { url: '/chica.jpg', tipo: '', poster: '', enlace: '', leyenda: 'Una chica' },
    { url: '', tipo: '', poster: '', enlace: '', leyenda: '' },
  ]);
});

test('resolverInstancia: "collage" — disposicion/lado clampan a su set cerrado, igual que cualquier escalar', () => {
  assert.equal((resolverInstancia({ tipo: 'collage', disposicion: 'cuatro' }) as unknown as { disposicion: string }).disposicion, 'cuatro');
  assert.equal((resolverInstancia({ tipo: 'collage', disposicion: 'ocho' }) as unknown as { disposicion: string }).disposicion, 'dos');
  assert.equal((resolverInstancia({ tipo: 'collage', lado: 'derecha' }) as unknown as { lado: string }).lado, 'derecha');
  assert.equal((resolverInstancia({ tipo: 'collage', lado: 'arriba' }) as unknown as { lado: string }).lado, 'izquierda');
});

test('instanciaEsVisible: "collage" — hide-on-empty gana sobre `visible:true`, igual que los otros repeater', () => {
  const vacia = resolverInstancia({ tipo: 'collage', visible: true, items: [] })!;
  const conItems = resolverInstancia({ tipo: 'collage', visible: true, items: [{ leyenda: 'x' }] })!;
  assert.equal(instanciaEsVisible(vacia), false);
  assert.equal(instanciaEsVisible(conItems), true);
});

test('imagenesDeInstancia: "collage" — junta url Y poster de cada ítem, nunca de "leyenda"/"enlace"', () => {
  assert.deepEqual(
    imagenesDeInstancia({
      tipo: 'collage',
      items: [
        { url: '/a.mp4', tipo: 'video', poster: '/a-poster.jpg', leyenda: 'A' },
        { url: '', tipo: '', poster: '', leyenda: 'B vacía' },
        { url: '/c.jpg', leyenda: 'C' },
      ],
    }),
    ['/a.mp4', '/a-poster.jpg', '/c.jpg'],
  );
});

test('resolverInstancia: "video" — imagen/poster opcionales sin default (nunca inventa un video), modo clampa a "fondo"/"reproducir"', () => {
  const r = resolverInstancia({ tipo: 'video', titulo: 'T' }) as unknown as { imagen: string; poster: string; modo: string };
  assert.equal(r.imagen, '');
  assert.equal(r.poster, '');
  assert.equal(r.modo, 'fondo');
  assert.equal((resolverInstancia({ tipo: 'video', modo: 'reproducir' }) as unknown as { modo: string }).modo, 'reproducir');
  assert.equal((resolverInstancia({ tipo: 'video', modo: 'basura' }) as unknown as { modo: string }).modo, 'fondo');
});

test('imagenesDeInstancia: "video" — junta imagen Y poster a nivel de instancia (no repeater)', () => {
  assert.deepEqual(imagenesDeInstancia({ tipo: 'video', imagen: '/v.mp4', poster: '/p.jpg' }), ['/v.mp4', '/p.jpg']);
  assert.deepEqual(imagenesDeInstancia({ tipo: 'video', imagen: '', poster: '' }), []);
});

// ─── LA DERIVACIÓN, SEGUNDA MITAD: el SCHEMA cubre EXACTAMENTE los campos del DESCRIPTOR ──────────
//
// `site-content-schema.test.ts` ya afirma la derivación modelo→schema para las secciones del
// REGISTRY (`camposDelSchema`, introspección de `.shape`); acá, por ROUND-TRIP, para los tipos del
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
    // § SECCIONES-TIPOS-2 — un tipo REPEATER agrega `items` a lo esperado, con UN ítem de muestra
    // que cubre cada campo de `items.descriptor.campos` — mismo criterio round-trip, un nivel más
    // adentro: si el sub-schema del ÍTEM no declara un campo, el strip se ve en ESE array.
    if (descriptor.items) {
      camposEsperados.add('items');
      const itemCampos = Object.keys(descriptor.items.descriptor.campos);
      const itemMuestra: Record<string, unknown> = {};
      for (const campo of itemCampos) itemMuestra[campo] = campo.toLowerCase().includes('destino') || campo === 'enlace' ? '' : 'x';
      muestra.items = [itemMuestra];
    }

    const parsed = siteContentEditableSchema.parse({ seccionesHome: { 'inst:muestra': muestra } });
    const resultado = parsed.seccionesHome!['inst:muestra'] as Record<string, unknown>;
    assert.deepEqual(new Set(Object.keys(resultado)), camposEsperados,
      `"${tipo}": el schema y el descriptor deben declarar EXACTAMENTE los mismos campos (faltantes o sobrantes = un campo se perdería en silencio al guardar)`);

    if (descriptor.items) {
      const itemCampos = Object.keys(descriptor.items.descriptor.campos);
      const itemResultado = (resultado.items as Record<string, unknown>[])[0];
      assert.deepEqual(new Set(Object.keys(itemResultado)), new Set(itemCampos),
        `"${tipo}": el sub-schema del ÍTEM debe declarar EXACTAMENTE los mismos campos que items.descriptor.campos`);
    }
  }
});

// ─── EL CATÁLOGO DE LA BIBLIOTECA (§ EDITOR-AGREGAR-SECCION-1) ──────────────────────────────────

test('CATALOGO_INSTANCIAS: una entrada por cada tipo del catálogo, ni una de más ni de menos', () => {
  assert.deepEqual(
    new Set(CATALOGO_INSTANCIAS.map((c) => c.tipo)),
    new Set(SECCION_INSTANCIA_TIPOS),
    'un tipo nuevo en SECCION_INSTANCIA_TIPOS sin su entrada acá queda ausente de la biblioteca',
  );
  for (const c of CATALOGO_INSTANCIAS) {
    assert.ok(c.nombre.trim() !== '', `"${c.tipo}": nombre vacío`);
    assert.ok(c.frase.trim() !== '', `"${c.tipo}": frase vacía`);
  }
});

test('nombreInstancia: el nombre en palabras del catálogo, "Sección" para un tipo desconocido', () => {
  assert.equal(nombreInstancia('texto'), 'Texto');
  assert.equal(nombreInstancia('imagenTexto'), 'Imagen con texto');
  assert.equal(nombreInstancia('banner'), 'Banner');
  assert.equal(nombreInstancia('preguntas'), 'Preguntas');
  assert.equal(nombreInstancia('columnas'), 'Columnas');
  assert.equal(nombreInstancia('filas'), 'Filas');
  assert.equal(nombreInstancia('collage'), 'Collage');
  assert.equal(nombreInstancia('video'), 'Video');
  assert.equal(nombreInstancia('inventado' as unknown as 'texto'), 'Sección');
});

test('nuevoIdInstancia: lleva el prefijo y nunca choca con los existentes', () => {
  const a = nuevoIdInstancia([]);
  assert.ok(esInstanciaId(a));
  const b = nuevoIdInstancia([a]);
  assert.notEqual(a, b);
  assert.ok(esInstanciaId(b));
});

test('nuevoIdInstancia: evita la colisión aunque TODOS los intentos "al azar" repitan (determinista bajo mock)', () => {
  const original = Math.random;
  try {
    let llamadas = 0;
    // Simula dos colisiones seguidas antes de un valor libre: el bucle debe reintentar, no
    // devolver un id que ya está en `existentes`.
    Math.random = () => { llamadas += 1; return llamadas <= 2 ? 0.123456 : 0.654321; };
    const chocado1 = `${INSTANCIA_PREFIJO}${Date.now().toString(36)}${(0.123456).toString(36).slice(2, 8)}`;
    const id = nuevoIdInstancia([chocado1]);
    assert.notEqual(id, chocado1);
    assert.ok(esInstanciaId(id));
  } finally {
    Math.random = original;
  }
});

test('TOPE_INSTANCIAS_HOME: un número positivo mayor que un home real de hoy (0 instancias)', () => {
  assert.ok(TOPE_INSTANCIAS_HOME > 0);
  assert.equal(Number.isInteger(TOPE_INSTANCIAS_HOME), true);
});

test('crearInstancia: una copia de los defaults, NO la misma referencia', () => {
  const a = crearInstancia('texto');
  const b = crearInstancia('texto');
  assert.deepEqual(a, DEFAULTS_INSTANCIA.texto);
  assert.notEqual(a, DEFAULTS_INSTANCIA.texto, 'no debe ser el mismo objeto que el default compartido');
  assert.notEqual(a, b, 'dos creaciones no deben compartir referencia entre sí');
  (a as { titulo: string }).titulo = 'editado';
  assert.equal(DEFAULTS_INSTANCIA.texto.titulo, 'Un título para esta sección', 'mutar la copia no debe tocar el default');
});

test('instanciaOscuraCanonica / instanciaEsUniforme: banner oscuro y uniforme, imagenTexto/filas no-uniformes, texto/preguntas/columnas claros y uniformes', () => {
  assert.equal(instanciaOscuraCanonica('banner'), true);
  assert.equal(instanciaOscuraCanonica('texto'), false);
  assert.equal(instanciaOscuraCanonica('imagenTexto'), false);
  assert.equal(instanciaOscuraCanonica('preguntas'), false);
  assert.equal(instanciaOscuraCanonica('columnas'), false);
  assert.equal(instanciaOscuraCanonica('filas'), false);
  assert.equal(instanciaEsUniforme('banner'), true);
  assert.equal(instanciaEsUniforme('texto'), true);
  assert.equal(instanciaEsUniforme('imagenTexto'), false);
  assert.equal(instanciaEsUniforme('preguntas'), true);
  assert.equal(instanciaEsUniforme('columnas'), true);
  assert.equal(instanciaEsUniforme('filas'), false, 'filas reusa ImagenTexto por fila, alternando — igual de bi-tonal (o más) que una sola imagenTexto');
});

test('§ SECCIONES-TIPOS-3 — instanciaOscuraCanonica/instanciaEsUniforme: video oscuro y uniforme (como banner), collage claro y uniforme (como columnas)', () => {
  assert.equal(instanciaOscuraCanonica('video'), true);
  assert.equal(instanciaOscuraCanonica('collage'), false);
  assert.equal(instanciaEsUniforme('video'), true);
  assert.equal(instanciaEsUniforme('collage'), true);
});
