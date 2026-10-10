import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { siteContentEditableSchema } from './site-content-schema';
import { DEFAULTS, REGISTRY, type SeccionKey } from './site-content-defaults';

// El schema editable del contenido. Lo importante acá es lo que NO se ve a simple vista: zod
// DESCARTA las claves no declaradas. Así que un campo que el editor guarda pero el schema no
// declara se perdería EN SILENCIO al guardar. `w`/`h` de la galería (la proporción de la foto para
// el masonry) es exactamente ese caso — se afirma que sobreviven.

test('galería: w/h de un ítem SOBREVIVEN al parse (si no, zod los descartaría y se perdería la proporción)', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosGaleria: { items: [{ url: '/a.jpg', alt: 'x', w: 1600, h: 900 }] },
  });
  assert.deepEqual(parsed.nosotrosGaleria!.items, [{ url: '/a.jpg', alt: 'x', w: 1600, h: 900 }]);
});

test('galería: una clave NO declarada en el ítem SÍ se descarta (confirma que el strip está activo)', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosGaleria: { items: [{ url: '/a.jpg', basura: 'no-declarada' }] },
  });
  assert.deepEqual(parsed.nosotrosGaleria!.items, [{ url: '/a.jpg' }]); // 'basura' fuera
});

test('galería: w/h no-positivos se rechazan (0 o negativo no es una proporción válida)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosGaleria: { items: [{ url: '/a.jpg', w: 0, h: 900 }] } }));
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosGaleria: { items: [{ url: '/a.jpg', w: 1600, h: -1 }] } }));
});

test('galería: tipo (video) y poster de un ítem SOBREVIVEN al parse', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosGaleria: { items: [{ url: '/finca.mp4', alt: 'x', tipo: 'video', poster: '/p.jpg' }] },
  });
  assert.deepEqual(parsed.nosotrosGaleria!.items, [{ url: '/finca.mp4', alt: 'x', tipo: 'video', poster: '/p.jpg' }]);
});

test('galería: un tipo FUERA del enum se rechaza (no cualquier string en `tipo`)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosGaleria: { items: [{ url: '/a.jpg', tipo: 'audio' }] } }));
});

// ─── VARIANTES DE COMPOSICIÓN (§ eje 5e): `variante` de presentaciones SOBREVIVE al parse ────────
test('presentaciones: `variante` SOBREVIVE al parse (si no, zod la descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ presentaciones: { variante: 'indice' } });
  assert.equal(parsed.presentaciones!.variante, 'indice');
});

// ─── VARIANTES DE COMPOSICIÓN (§ EJE-5-VARIANTES-HERO): `variante` del hero SOBREVIVE al parse ───
test('hero: `variante` SOBREVIVE al parse (si no, zod la descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { variante: 'ficha' } });
  assert.equal(parsed.hero!.variante, 'ficha');
});

// ─── EL HERO GANA VIDEO COMO DATO (§ HERO-VIDEO-COMO-DATO-1): imagenTipo/imagenPoster ────────────
test('hero: `imagenTipo`/`imagenPoster` SOBREVIVEN al parse (si no, zod los descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { imagenTipo: 'video', imagenPoster: '/p.jpg' } });
  assert.equal(parsed.hero!.imagenTipo, 'video');
  assert.equal(parsed.hero!.imagenPoster, '/p.jpg');
});

test('hero: `imagenTipo:"video"` SIN `imagenPoster` (o vacío/blanco) se RECHAZA — el póster es obligatorio para un video', () => {
  assert.throws(() => siteContentEditableSchema.parse({ hero: { imagenTipo: 'video' } }));
  assert.throws(() => siteContentEditableSchema.parse({ hero: { imagenTipo: 'video', imagenPoster: '' } }));
  assert.throws(() => siteContentEditableSchema.parse({ hero: { imagenTipo: 'video', imagenPoster: '   ' } }));
});

test('hero: `imagenTipo` ausente o "imagen" pasa SIN `imagenPoster` — el `.refine()` sólo aplica a video, todo lo demás sigue SOFT', () => {
  assert.doesNotThrow(() => siteContentEditableSchema.parse({ hero: {} }));
  assert.doesNotThrow(() => siteContentEditableSchema.parse({ hero: { imagenTipo: 'imagen' } }));
  assert.doesNotThrow(() => siteContentEditableSchema.parse({}));
});

test('hero: el mensaje del rechazo nombra el póster, no un "invalid input" genérico', () => {
  const r = siteContentEditableSchema.safeParse({ hero: { imagenTipo: 'video' } });
  assert.equal(r.success, false);
  if (!r.success) assert.match(r.error.issues[0].message, /póster/i);
});

// ─── EL DESLIZADOR CONTINUO (§ EDITOR-PANEL-DESLIZADORES-1): `hero.veloNivel` SOBREVIVE al parse ──
test('hero: `veloNivel` (un número 0-100) SOBREVIVE al parse (si no, zod lo descartaría al guardar, § #65-B)', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { veloNivel: 65 } });
  assert.equal(parsed.hero!.veloNivel, 65);
});

test('hero: `veloNivel: 0` SOBREVIVE al parse — cero (sin velo) no es "ausente"', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { veloNivel: 0 } });
  assert.equal(parsed.hero!.veloNivel, 0);
});

test('hero: `veloNivel: null` SOBREVIVE al parse — el deslizador nunca se movió es un valor explícito', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { veloNivel: null } });
  assert.equal(parsed.hero!.veloNivel, null);
});

test('hero: `veloNivel` fuera de [0,100] se rechaza', () => {
  assert.throws(() => siteContentEditableSchema.parse({ hero: { veloNivel: -1 } }));
  assert.throws(() => siteContentEditableSchema.parse({ hero: { veloNivel: 101 } }));
});

test('hero: sin `veloNivel` en el body, pasa igual — es opcional, no exigido', () => {
  assert.doesNotThrow(() => siteContentEditableSchema.parse({ hero: { titulo: 'X' } }));
});

// ─── EL ESTILO POR ELEMENTO (§ EDITOR-TIENDA-BARRA-FLOTANTE-1): `hero.estilos` SOBREVIVE al parse ──
test('hero: `estilos` SOBREVIVE al parse (si no, zod lo descartaría al guardar, § #65-B)', () => {
  const parsed = siteContentEditableSchema.parse({
    hero: { estilos: { titulo: { fuente: 'robusta', tamano: 'enorme', color: 'tostado', alinear: 'centro' } } },
  });
  assert.deepEqual(parsed.hero!.estilos, {
    titulo: { fuente: 'robusta', tamano: 'enorme', color: 'tostado', alinear: 'centro' },
  });
});

test('hero.estilos: una clave de SUBCAMPO no declarada en el ítem SÍ se descarta (confirma que el strip está activo dentro de cada elemento)', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { estilos: { titulo: { tamano: 'grande', basura: 'x' } } } });
  assert.deepEqual(parsed.hero!.estilos, { titulo: { tamano: 'grande' } });
});

test('hero.estilos: un ELEMENTO con nombre arbitrario sobrevive el PARSE (el write es key-agnóstico, § esquemasEditableSchema) — el RESOLVER es quien filtra a los cinco reales', () => {
  const parsed = siteContentEditableSchema.parse({ hero: { estilos: { unElementoInventado: { color: 'acento' } } } });
  assert.deepEqual(parsed.hero!.estilos, { unElementoInventado: { color: 'acento' } });
});

// § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — gemelo de `hero.estilos` arriba, para el único
// elemento de marquesina (`texto`, la frase del loop del hero·sticky).
test('marquesina: `estilos` SOBREVIVE al parse (si no, zod lo descartaría al guardar, § #65-B)', () => {
  const parsed = siteContentEditableSchema.parse({
    marquesina: { estilos: { texto: { tamano: 'enorme', color: 'acento' } } },
  });
  assert.deepEqual(parsed.marquesina!.estilos, { texto: { tamano: 'enorme', color: 'acento' } });
});

// ─── NOSOTROS-COMPOSICION-1: la imagen de la historia y el CTA de cierre SOBREVIVEN al parse ─────
test('nosotrosHistoria: `imagen` SOBREVIVE al parse (si no, zod la descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ nosotrosHistoria: { imagen: '/x.jpg' } });
  assert.equal(parsed.nosotrosHistoria!.imagen, '/x.jpg');
});

test('nosotrosCierre: los cinco campos SOBREVIVEN al parse (si no, zod los descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({
    nosotrosCierre: { titulo: 'T', parrafo: 'P', ctaLabel: 'Ver más', ctaDestino: '/tienda', imagenFondo: '/x.jpg' },
  });
  assert.deepEqual(parsed.nosotrosCierre, { titulo: 'T', parrafo: 'P', ctaLabel: 'Ver más', ctaDestino: '/tienda', imagenFondo: '/x.jpg' });
});

test('nosotrosCierre: un `ctaDestino` fuera del set cerrado se rechaza (a diferencia de ctaLabel/imagenFondo, texto libre)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ nosotrosCierre: { ctaDestino: 'https://ejemplo.com' } }));
});

// ─── EL DERIVADO (§ Backlog #65-B, FIX 3): modelo ⊆ schema, sin una tercera lista a mano ─────────
// Los tests de arriba prueban ÍTEM POR ÍTEM lo que sobrevive/se rechaza (la mitad de repeater). Éste
// cierra la OTRA brecha —la que costó #65-B—: que TODO campo de PRIMER NIVEL del modelo esté en el
// schema. Compara el MODELO (los campos de `DEFAULTS[seccion]`, la instancia REAL) contra el `.shape`
// de cada sub-schema. Un campo del modelo que el schema no declara se STRIPPEA EN SILENCIO al guardar
// → pérdida de dato en cada ciclo (fue `categoria1/2` + los slots 3-4 de presentaciones, congelados
// desde C1 mientras el modelo creció). FALLA nombrando el campo, así que agregar un campo al modelo
// obliga a declararlo en el schema. DERIVADO de fuentes que ya existen (DEFAULTS + el `.shape`), no
// una tercera lista.
//
// ALCANCE: campos de PRIMER NIVEL. Los de ÍTEM de los repeaters no se derivan de `DEFAULTS` (arrays
// vacíos) — los cubren los tests de arriba, a mano, con su comentario. Limitación NOMBRADA.
const camposDelSchema = (seccion: SeccionKey): Set<string> => {
  const sub = siteContentEditableSchema.shape[seccion];
  const obj = (sub as z.ZodOptional<z.ZodObject<z.ZodRawShape>>).unwrap();
  return new Set(Object.keys(obj.shape));
};

test('todo campo del MODELO está en el schema editable (sin strip silencioso)', () => {
  for (const seccion of Object.keys(REGISTRY) as SeccionKey[]) {
    const camposModelo = Object.keys(DEFAULTS[seccion]);
    const enSchema = camposDelSchema(seccion);
    const faltantes = camposModelo.filter(c => !enSchema.has(c));
    assert.deepEqual(faltantes, [],
      `«${seccion}»: campos del modelo que el schema editable STRIPPEA (agrégalos a site-content-schema.ts): ${faltantes.join(', ')}`);
  }
});

// ─── ESQUEMAS (§ eje 5b, mitad B): declarada como meta — sin STRIP silencioso, aunque hoy no
// exista editor que la escriba (SIN PICKER, decisión del owner) ─────────────────────────────
test('esquemas: un mapa banda→esquema válido SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ esquemas: { hero: 'oscuro', trustBadges: 'acento' } });
  assert.deepEqual(parsed.esquemas, { hero: 'oscuro', trustBadges: 'acento' });
});

test('esquemas: un VALOR fuera del set cerrado de 4 se rechaza (a diferencia del resolver, que la absorbe SOFT)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ esquemas: { hero: 'neon' } }));
});

// ─── ORDEN (§ eje 5, parte c): declarada como meta — sin STRIP silencioso, dominio CERRADO ────────

test('orden: un array VÁLIDO de bandaIds conocidos SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ orden: ['presentaciones', 'hero', 'featured'] });
  assert.deepEqual(parsed.orden, ['presentaciones', 'hero', 'featured']);
});

test('orden: un id FUERA del set cerrado se rechaza (a diferencia del resolver, que la absorbe SOFT)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'unaSeccionQueNoExiste'] }));
});

test('orden: una banda REPETIDA se rechaza (el write es más estricto que el loader, que dedupe)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'featured', 'hero'] }));
});

test('orden: un array PARCIAL (no las 7) se acepta — el schema no exige completitud, el resolver la garantiza', () => {
  const parsed = siteContentEditableSchema.parse({ orden: ['hero'] });
  assert.deepEqual(parsed.orden, ['hero']);
});

test('orden: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.orden, undefined);
});

test('orden: un id con el prefijo de instancia SOBREVIVE al parse, mezclado con bandas (§ SECCIONES-INSTANCIAS-1)', () => {
  const parsed = siteContentEditableSchema.parse({ orden: ['hero', 'inst:abc', 'featured'] });
  assert.deepEqual(parsed.orden, ['hero', 'inst:abc', 'featured']);
});

test('orden: una cadena sin el prefijo de instancia y fuera del set de bandas se sigue rechazando', () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'inventada'] }));
});

// ─── SECCIONES AGREGADAS DEL HOME (§ SECCIONES-INSTANCIAS-1): unión discriminada por tipo ─────────

test('seccionesHome: una instancia "texto" válida SOBREVIVE al parse completa', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', texto: 'cuerpo', ctaLabel: 'Ver más', ctaDestino: '/tienda', alineacion: 'derecha' } },
  });
  assert.deepEqual(parsed.seccionesHome, {
    'inst:a': { tipo: 'texto', titulo: 'T', texto: 'cuerpo', ctaLabel: 'Ver más', ctaDestino: '/tienda', alineacion: 'derecha' },
  });
});

test('seccionesHome: "imagenTexto" y "banner" también sobreviven, cada uno con sus propios campos', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:img': { tipo: 'imagenTexto', titulo: 'T', imagen: '/x.jpg', lado: 'derecha' },
      'inst:ban': { tipo: 'banner', titulo: 'B', alto: 'pantalla', ctaSecundarioLabel: 'Otro', ctaSecundarioDestino: '/nosotros' },
    },
  });
  assert.equal((parsed.seccionesHome!['inst:img'] as { imagen: string }).imagen, '/x.jpg');
  assert.equal((parsed.seccionesHome!['inst:ban'] as { alto: string }).alto, 'pantalla');
});

test('seccionesHome: un `tipo` que no es ninguno de los diez se rechaza (unión discriminada)', () => {
  // § SECCIONES-CARRUSEL-1 — este test usaba 'carrusel' como el tipo INVENTADO de muestra; ahora
  // es uno de los diez del catálogo, así que el ejemplo pasó a un nombre que de verdad no existe.
  assert.throws(() => siteContentEditableSchema.parse({ seccionesHome: { 'inst:a': { tipo: 'mosaico-inventado', titulo: 'x' } } }));
});

test('seccionesHome: un campo NO declarado para ese tipo se descarta (el strip sigue activo dentro de la unión)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', imagen: 'esto no existe en "texto"' } },
  });
  assert.equal((parsed.seccionesHome!['inst:a'] as Record<string, unknown>).imagen, undefined);
});

test('seccionesHome: ctaDestino fuera del set cerrado MENU_CTA_DESTINOS se rechaza, igual que en las demás secciones', () => {
  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', ctaDestino: '/ruta-inventada' } },
  }));
});

test('seccionesHome: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.seccionesHome, undefined);
});

test('seccionesHome: `visible: false` SOBREVIVE al parse, en los tres tipos — § SECCIONES-INSTANCIAS-VIVO-1, el ojo (sin esto, el toggle se STRIPPEARÍA en silencio al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:a': { tipo: 'texto', titulo: 'T', visible: false },
      'inst:b': { tipo: 'imagenTexto', titulo: 'T', visible: false },
      'inst:c': { tipo: 'banner', titulo: 'T', visible: false },
    },
  });
  assert.equal((parsed.seccionesHome!['inst:a'] as { visible: boolean }).visible, false);
  assert.equal((parsed.seccionesHome!['inst:b'] as { visible: boolean }).visible, false);
  assert.equal((parsed.seccionesHome!['inst:c'] as { visible: boolean }).visible, false);
});

test('seccionesHome: sin `visible` en el body, el parse no inventa la clave — el resolver (no el schema) decide el default', () => {
  const parsed = siteContentEditableSchema.parse({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T' } } });
  assert.equal('visible' in (parsed.seccionesHome!['inst:a'] as Record<string, unknown>), false);
});

// ─── § SECCIONES-TIPOS-2 — LOS TRES TIPOS REPEATER (Preguntas/Columnas/Filas) ───────────────────

test('seccionesHome: "preguntas" sobrevive completa, con su array de items', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:faq': { tipo: 'preguntas', titulo: 'Preguntas', items: [{ pregunta: '¿Hay envío?', respuesta: 'Sí.' }] },
    },
  });
  assert.deepEqual(parsed.seccionesHome!['inst:faq'], {
    tipo: 'preguntas', titulo: 'Preguntas', items: [{ pregunta: '¿Hay envío?', respuesta: 'Sí.' }],
  });
});

test('seccionesHome: "columnas" sobrevive completa, y `enlace` valida contra MENU_CTA_DESTINOS como cualquier ctaDestino', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:col': { tipo: 'columnas', items: [{ imagen: '/a.jpg', titulo: 'A', texto: 'texto A', enlace: '/tienda' }] },
    },
  });
  assert.equal((parsed.seccionesHome!['inst:col'] as { items: { enlace: string }[] }).items[0].enlace, '/tienda');

  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:col2': { tipo: 'columnas', items: [{ titulo: 'A', enlace: '/ruta-inventada' }] } },
  }), 'un enlace fuera del set cerrado se rechaza, igual que ctaDestino en los otros tipos');
});

test('seccionesHome: "filas" sobrevive completa, con imagen/ctaLabel/ctaDestino por ítem', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:filas': { tipo: 'filas', items: [{ imagen: '/f.jpg', titulo: 'Fila 1', texto: 'cuerpo', ctaLabel: 'Ver', ctaDestino: '/tienda' }] },
    },
  });
  assert.deepEqual((parsed.seccionesHome!['inst:filas'] as { items: unknown[] }).items, [
    { imagen: '/f.jpg', titulo: 'Fila 1', texto: 'cuerpo', ctaLabel: 'Ver', ctaDestino: '/tienda' },
  ]);
});

test('seccionesHome: los tres REPEATER sin `items` no rompen el parse — campo opcional, como el resto (loader SOFT)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:a': { tipo: 'preguntas' },
      'inst:b': { tipo: 'columnas' },
      'inst:c': { tipo: 'filas' },
    },
  });
  assert.equal('items' in (parsed.seccionesHome!['inst:a'] as Record<string, unknown>), false);
});

test('seccionesHome: "preguntas"/"columnas"/"filas" también llevan `visible`, mismo contrato que los otros tres (§ SECCIONES-INSTANCIAS-VIVO-1)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:a': { tipo: 'preguntas', visible: false },
      'inst:b': { tipo: 'columnas', visible: false },
      'inst:c': { tipo: 'filas', visible: false },
    },
  });
  assert.equal((parsed.seccionesHome!['inst:a'] as { visible: boolean }).visible, false);
  assert.equal((parsed.seccionesHome!['inst:b'] as { visible: boolean }).visible, false);
  assert.equal((parsed.seccionesHome!['inst:c'] as { visible: boolean }).visible, false);
});
// ─── § SECCIONES-TIPOS-3 — "collage" y "video" ──────────────────────────────────────────────────

test('seccionesHome: "collage" sobrevive completo, con `tipo`/`poster` por ítem (video dentro de un mosaico) y `enlace` validado contra MENU_CTA_DESTINOS', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:col': {
        tipo: 'collage',
        titulo: 'Nuestra finca',
        disposicion: 'cuatro',
        lado: 'derecha',
        items: [
          { url: '/grande.mp4', tipo: 'video', poster: '/poster.jpg', enlace: '/tienda', leyenda: 'La cosecha' },
          { url: '/chica.jpg', leyenda: 'Un detalle' },
        ],
      },
    },
  });
  assert.deepEqual(parsed.seccionesHome!['inst:col'], {
    tipo: 'collage',
    titulo: 'Nuestra finca',
    disposicion: 'cuatro',
    lado: 'derecha',
    items: [
      { url: '/grande.mp4', tipo: 'video', poster: '/poster.jpg', enlace: '/tienda', leyenda: 'La cosecha' },
      { url: '/chica.jpg', leyenda: 'Un detalle' },
    ],
  });

  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:col2': { tipo: 'collage', items: [{ url: '/a.jpg', enlace: '/ruta-inventada' }] } },
  }), 'un enlace de ítem fuera del set cerrado se rechaza, igual que en columnas/filas');
});

test('seccionesHome: "video" sobrevive completo, con `modo` y `visible`', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:vid': {
        tipo: 'video', titulo: 'Mira cómo trabajamos', texto: 'Un vistazo detrás de cámaras',
        ctaLabel: 'Ver más', ctaDestino: '/tienda', imagen: '/v.mp4', poster: '/p.jpg', modo: 'reproducir', visible: false,
      },
    },
  });
  assert.deepEqual(parsed.seccionesHome!['inst:vid'], {
    tipo: 'video', titulo: 'Mira cómo trabajamos', texto: 'Un vistazo detrás de cámaras',
    ctaLabel: 'Ver más', ctaDestino: '/tienda', imagen: '/v.mp4', poster: '/p.jpg', modo: 'reproducir', visible: false,
  });
});

test('seccionesHome: "video" CON video pero SIN póster se rechaza — el póster es obligatorio para no dejar la portada sin nada que mostrar', () => {
  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:vid': { tipo: 'video', imagen: '/v.mp4' } },
  }));
  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:vid': { tipo: 'video', imagen: '/v.mp4', poster: '' } },
  }));
});

test('seccionesHome: "video" SIN video no exige póster (el hueco "Agregar video", como un hero de imagen sin video)', () => {
  const parsed = siteContentEditableSchema.parse({ seccionesHome: { 'inst:vid': { tipo: 'video', titulo: 'T' } } });
  assert.equal((parsed.seccionesHome!['inst:vid'] as { imagen: string }).imagen, undefined);
});

// ─── § SECCIONES-CARRUSEL-1 — "carrusel": cabecera `titulo` opcional + items + alto + autoplay ──

test('seccionesHome: "carrusel" sobrevive completo, con `titulo` de cabecera, `alto`, `autoplay` y sus diapositivas', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:car': {
        tipo: 'carrusel',
        titulo: 'Lo que ofrecemos',
        alto: 'pantalla',
        autoplay: true,
        items: [
          { imagen: '/a.jpg', titulo: 'Primera', texto: 'Cuerpo A', ctaLabel: 'Ver', ctaDestino: '/tienda' },
          { imagen: '/b.jpg', titulo: 'Segunda' },
        ],
      },
    },
  });
  assert.deepEqual(parsed.seccionesHome!['inst:car'], {
    tipo: 'carrusel',
    titulo: 'Lo que ofrecemos',
    alto: 'pantalla',
    autoplay: true,
    items: [
      { imagen: '/a.jpg', titulo: 'Primera', texto: 'Cuerpo A', ctaLabel: 'Ver', ctaDestino: '/tienda' },
      { imagen: '/b.jpg', titulo: 'Segunda' },
    ],
  });
});

test('seccionesHome: "carrusel" — un `ctaDestino` de ítem fuera del set cerrado se rechaza, igual que en columnas/filas', () => {
  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ titulo: 'A', ctaDestino: '/ruta-inventada' }] } },
  }));
});

test('seccionesHome: "carrusel" sin `titulo`/`autoplay`/`alto`/`visible` en el body, el parse no inventa las claves — el resolver decide el default', () => {
  const parsed = siteContentEditableSchema.parse({ seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ titulo: 'A' }] } } });
  const inst = parsed.seccionesHome!['inst:car'] as Record<string, unknown>;
  assert.equal('titulo' in inst, false);
  assert.equal('autoplay' in inst, false);
  assert.equal('alto' in inst, false);
  assert.equal('visible' in inst, false);
});

test('seccionesHome: "carrusel" también lleva `visible`, mismo contrato que los demás tipos (§ SECCIONES-INSTANCIAS-VIVO-1)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', visible: false, items: [{ titulo: 'A' }] } },
  });
  assert.equal((parsed.seccionesHome!['inst:car'] as { visible: boolean }).visible, false);
});

// ─── § MOVIMIENTO-NIVEL-EDITORIAL-1 — "proceso" ("Del fruto a la taza", S02) ────────────────────

test('seccionesHome: "proceso" sobrevive completo, con `titulo` de cabecera y sus pasos (etiqueta/titulo/texto/imagen)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: {
      'inst:proc': {
        tipo: 'proceso',
        titulo: 'Nuestro proceso',
        items: [
          { etiqueta: '01 · Cosecha', titulo: 'Primero', texto: 'Cuerpo 1', imagen: '/a.jpg' },
          { etiqueta: '', titulo: 'Segundo', texto: 'Cuerpo 2', imagen: '' },
          { etiqueta: '03 · Tercero', titulo: 'Tercero', texto: 'Cuerpo 3', imagen: '' },
        ],
      },
    },
  });
  assert.equal((parsed.seccionesHome!['inst:proc'] as { titulo: string }).titulo, 'Nuestro proceso');
  assert.deepEqual((parsed.seccionesHome!['inst:proc'] as { items: unknown[] }).items, [
    { etiqueta: '01 · Cosecha', titulo: 'Primero', texto: 'Cuerpo 1', imagen: '/a.jpg' },
    { etiqueta: '', titulo: 'Segundo', texto: 'Cuerpo 2', imagen: '' },
    { etiqueta: '03 · Tercero', titulo: 'Tercero', texto: 'Cuerpo 3', imagen: '' },
  ]);
});

test('seccionesHome: "proceso" NO declara `animacion` — un valor mandado se descarta en silencio (el tipo nace con S02 incorporado)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:proc': { tipo: 'proceso', titulo: 'T', animacion: 'T01', items: [{ titulo: 'A' }] } },
  });
  assert.equal('animacion' in (parsed.seccionesHome!['inst:proc'] as Record<string, unknown>), false);
});

test('seccionesHome: "proceso" también lleva `visible`, mismo contrato que los demás tipos (§ SECCIONES-INSTANCIAS-VIVO-1)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:proc': { tipo: 'proceso', visible: false, items: [{ titulo: 'A' }] } },
  });
  assert.equal((parsed.seccionesHome!['inst:proc'] as { visible: boolean }).visible, false);
});

// ─── § MOVIMIENTO-NIVEL-FIRMA-1 — "cierre" ("Vapor que forma el llamado", CTA01) ─────────────────

test('seccionesHome: "cierre" sobrevive completo, con `titulo`/`ctaLabel`/`ctaDestino`', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:cta': { tipo: 'cierre', titulo: 'Lleva esta historia a tu mesa', ctaLabel: 'Comprar café', ctaDestino: '/tienda' } },
  });
  assert.deepEqual(parsed.seccionesHome!['inst:cta'], {
    tipo: 'cierre', titulo: 'Lleva esta historia a tu mesa', ctaLabel: 'Comprar café', ctaDestino: '/tienda',
  });
});

test('seccionesHome: "cierre" — un `ctaDestino` fuera del set cerrado se rechaza, igual que el resto del archivo', () => {
  assert.throws(() => siteContentEditableSchema.parse({
    seccionesHome: { 'inst:cta': { tipo: 'cierre', titulo: 'T', ctaDestino: '/inventado' } },
  }));
});

test('seccionesHome: "cierre" NO declara `animacion` — un valor mandado se descarta en silencio (el tipo nace con CTA01 incorporado)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:cta': { tipo: 'cierre', titulo: 'T', animacion: 'T01' } },
  });
  assert.equal('animacion' in (parsed.seccionesHome!['inst:cta'] as Record<string, unknown>), false);
});

test('seccionesHome: "cierre" también lleva `visible`, mismo contrato que los demás tipos (§ SECCIONES-INSTANCIAS-VIVO-1)', () => {
  const parsed = siteContentEditableSchema.parse({
    seccionesHome: { 'inst:cta': { tipo: 'cierre', visible: false } },
  });
  assert.equal((parsed.seccionesHome!['inst:cta'] as { visible: boolean }).visible, false);
});

// ─── § TIENDA-CHAMISAS-ALBUM-1 — el mapa `tiendaCatalogo.coloresPorProducto` ──────────────────────

test('tiendaCatalogo.coloresPorProducto: un mapa id→hex SOBREVIVE al parse (si no, zod lo descartaría al guardar, § #65-B)', () => {
  const parsed = siteContentEditableSchema.parse({
    tiendaCatalogo: { coloresPorProducto: { prod1: '#f4b3c2', prod2: '#9ac77a' } },
  });
  assert.deepEqual(parsed.tiendaCatalogo!.coloresPorProducto, { prod1: '#f4b3c2', prod2: '#9ac77a' });
});

test('tiendaCatalogo.coloresPorProducto: un valor NO-hex sobrevive el SCHEMA igual (el resolver, no el schema, lo filtra SOFT)', () => {
  const parsed = siteContentEditableSchema.parse({
    tiendaCatalogo: { coloresPorProducto: { prod1: 'rojo' } },
  });
  assert.deepEqual(parsed.tiendaCatalogo!.coloresPorProducto, { prod1: 'rojo' });
});

test('tiendaEncabezado: sticker/intro/antojoTitulo sobreviven el schema (§ la composición «Carta»)', () => {
  const parsed = siteContentEditableSchema.parse({
    tiendaEncabezado: { sticker: 'cosecha 2026', intro: 'Lo cultivamos nosotras.', antojoTitulo: '¿Qué te antoja?' },
  });
  assert.deepEqual(parsed.tiendaEncabezado, { sticker: 'cosecha 2026', intro: 'Lo cultivamos nosotras.', antojoTitulo: '¿Qué te antoja?' });
});

// ─── § TIENDA-CHAMISAS-ALBUM-1 — las DOS secciones nuevas: Interludio y Cierre ────────────────────

test('tiendaInterludio: visible/imagen/cita/firma sobreviven el schema completos', () => {
  const parsed = siteContentEditableSchema.parse({
    tiendaInterludio: { visible: true, imagen: '/x.jpg', cita: 'Cada taza cuenta una historia.', firma: 'Marcela, vereda El Roble' },
  });
  assert.deepEqual(parsed.tiendaInterludio, { visible: true, imagen: '/x.jpg', cita: 'Cada taza cuenta una historia.', firma: 'Marcela, vereda El Roble' });
});

test('tiendaCierre: visible/franjaTejido/frase/boton sobreviven el schema completos', () => {
  const parsed = siteContentEditableSchema.parse({
    tiendaCierre: { visible: true, franjaTejido: '/franja.jpg', frase: 'Te lo apartamos cada mes.', boton: 'Escríbenos' },
  });
  assert.deepEqual(parsed.tiendaCierre, { visible: true, franjaTejido: '/franja.jpg', frase: 'Te lo apartamos cada mes.', boton: 'Escríbenos' });
});
