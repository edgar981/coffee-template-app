import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagenesDe, blobsAReemplazar, blobsHuerfanos } from './site-content-blobs';
import { REGISTRY, type SeccionDef } from './site-content-defaults';

// Registro SINTÉTICO: una sección de collage (4 imágenes fijas, como brandStory) y una REPEATER
// (como será Testimonios). No depende del REGISTRY real —que en esta rama sólo tiene el hero—,
// y de paso demuestra que el camino del repeater ya funciona.
const REG: Record<string, SeccionDef> = {
  collage:     { label: 'C', ocultable: true, imagenes: ['i1', 'i2', 'i3', 'i4'], campos: {} },
  testimonios: { label: 'T', ocultable: true, repeater: { itemsKey: 'items', campos: {} }, imagenes: ['foto'], campos: {} },
};

// ── imagenesDe ────────────────────────────────────────────────────────────────

test('imagenesDe: junta las 4 de una sección de collage', () => {
  const doc = { collage: { i1: 'a', i2: 'b', i3: 'c', i4: 'd' } };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['a', 'b', 'c', 'd']);
});

test('imagenesDe REPEATER: junta la imagen de CADA item, ignora el sin-foto y la basura (listo para Testimonios)', () => {
  const doc = { testimonios: { items: [{ foto: 'a', txt: 'x' }, { foto: 'b' }, { txt: 'sin foto' }, 'basura'] } };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['a', 'b']);
});

test('imagenesDe SOFT: doc/sección/valores ausentes o mal formados → sin imágenes, no lanza', () => {
  assert.deepEqual(imagenesDe(null, REG), []);
  assert.deepEqual(imagenesDe({ collage: 'no-obj' }, REG), []);
  assert.deepEqual(imagenesDe({ collage: { i1: '', i2: '  ' } }, REG), []); // vacíos no cuentan
});

test('imagenesDe con el REGISTRY REAL junta las urls de los ítems de la GALERÍA (cableado end-to-end)', () => {
  // Afirma el CABLEADO, no sólo el mecanismo: la galería real declara `imagenes:['url','poster']` sobre
  // un repeater, así que sus fotos entran al borrado de blobs. Sin segundo arg → REGISTRY real.
  const doc = { nosotrosGaleria: { items: [{ url: '/a.jpg', alt: 'x' }, { url: '/b.jpg' }, { alt: 'sin foto' }] } };
  assert.deepEqual(imagenesDe(doc).sort(), ['/a.jpg', '/b.jpg']);
});

test('imagenesDe REAL: un ítem-VÍDEO aporta url Y poster (los dos blobs se borran con el ítem)', () => {
  // Un ítem-imagen no tiene `poster` → sólo su url; un ítem-vídeo tiene los dos.
  const doc = { nosotrosGaleria: { items: [
    { url: '/foto.jpg', alt: 'x' },                                  // imagen: sólo url
    { url: '/finca.mp4', poster: '/finca-poster.jpg', tipo: 'video' }, // vídeo: url + poster
  ] } };
  assert.deepEqual(imagenesDe(doc).sort(), ['/finca-poster.jpg', '/finca.mp4', '/foto.jpg']);
});

// § NOSOTROS-COMPOSICION-1: las dos imágenes NUEVAS de /nosotros (campos PLANOS de sección, no de
// ítem de repeater) — afirma el CABLEADO end-to-end contra el REGISTRY real, mismo patrón que la
// galería arriba: sin nombrar el campo en `REGISTRY.<seccion>.imagenes`, el borrado de blobs lo
// pierde en silencio para siempre.

test('imagenesDe con el REGISTRY REAL junta la imagen de la HISTORIA de /nosotros (campo plano opcional, § NOSOTROS-COMPOSICION-1)', () => {
  const doc = { nosotrosHistoria: { imagen: '/historia.jpg' } };
  assert.deepEqual(imagenesDe(doc), ['/historia.jpg']);
});

test('imagenesDe con el REGISTRY REAL junta el fondo del CTA DE CIERRE de /nosotros (campo plano opcional, § NOSOTROS-COMPOSICION-1)', () => {
  const doc = { nosotrosCierre: { imagenFondo: '/cierre.jpg' } };
  assert.deepEqual(imagenesDe(doc), ['/cierre.jpg']);
});

// ── SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1): `seccionesHome` es META, no una clave
//    de `registro` — el loop de arriba nunca la alcanza; esta rama es la que la cubre ─────────────

test('imagenesDe: junta la imagen de una instancia "imagenTexto"/"banner" en seccionesHome', () => {
  const doc = {
    seccionesHome: {
      'inst:a': { tipo: 'imagenTexto', titulo: 'x', imagen: '/a.jpg' },
      'inst:b': { tipo: 'banner', titulo: 'y', imagen: '/b.jpg' },
    },
  };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['/a.jpg', '/b.jpg']);
});

test('imagenesDe: § SECCIONES-TIPOS-2 — junta las imágenes de CADA ÍTEM de una instancia "columnas"/"filas" (REPEATER)', () => {
  const doc = {
    seccionesHome: {
      'inst:col': { tipo: 'columnas', items: [{ imagen: '/c1.jpg', titulo: 'A' }, { imagen: '', titulo: 'B' }, { imagen: '/c2.jpg', titulo: 'C' }] },
      'inst:fil': { tipo: 'filas', items: [{ imagen: '/f1.jpg', titulo: 'Fila' }] },
    },
  };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['/c1.jpg', '/c2.jpg', '/f1.jpg']);
});

test('imagenesDe: una instancia "texto" no aporta ninguna imagen (no tiene campo imagen)', () => {
  const doc = { seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'x' } } };
  assert.deepEqual(imagenesDe(doc, REG), []);
});

test('imagenesDe: § SECCIONES-TIPOS-3 — "video" aporta imagen Y poster a nivel de instancia (no repeater)', () => {
  const doc = { seccionesHome: { 'inst:v': { tipo: 'video', imagen: '/v.mp4', poster: '/p.jpg' } } };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['/p.jpg', '/v.mp4']);
});

test('imagenesDe: § SECCIONES-TIPOS-3 — "collage" junta url Y poster de CADA ítem (un video dentro del mosaico deja los dos)', () => {
  const doc = {
    seccionesHome: {
      'inst:c': {
        tipo: 'collage',
        items: [
          { url: '/grande.mp4', tipo: 'video', poster: '/grande-poster.jpg', leyenda: 'A' },
          { url: '/chica.jpg', leyenda: 'B' },
          { url: '', leyenda: 'C sin media' },
        ],
      },
    },
  };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['/chica.jpg', '/grande-poster.jpg', '/grande.mp4']);
});

test('imagenesDe: seccionesHome ausente, con basura, o con una instancia sin imagen (vacía) no rompe ni aporta nada', () => {
  assert.deepEqual(imagenesDe({}, REG), []);
  assert.deepEqual(imagenesDe({ seccionesHome: 'no-obj' }, REG), []);
  assert.deepEqual(imagenesDe({ seccionesHome: { 'inst:a': { tipo: 'imagenTexto', imagen: '' } } }, REG), []);
});

test('imagenesDe: se junta CON las imágenes de las secciones del REGISTRY, en el mismo resultado', () => {
  const doc = {
    collage: { i1: 'a', i2: '', i3: '', i4: '' },
    seccionesHome: { 'inst:a': { tipo: 'banner', imagen: 'b' } },
  };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['a', 'b']);
});

test('blobsHuerfanos: una imagen de instancia reemplazada en BORRADOR pero aún PUBLICADA no se borra (mismo contrato que las secciones del REGISTRY)', () => {
  const antes = { content: { seccionesHome: { 'inst:a': { tipo: 'banner', imagen: 'A' } } }, borrador: null };
  const despues = {
    content: { seccionesHome: { 'inst:a': { tipo: 'banner', imagen: 'A' } } },
    borrador: { seccionesHome: { 'inst:a': { tipo: 'banner', imagen: 'X' } } },
  };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), []);
});

// ── blobsAReemplazar: SET-diff, NO por índice (modo a) ──────────────────────────

test('SWAP: reordenar slots NO borra nada (set-diff) — falla con un diff por índice', () => {
  // Discriminador del modo (a): un diff por índice (viejas[i] !== nuevas[i]) borraría A y B al
  // intercambiarlos, aunque las dos siguen en uso.
  assert.deepEqual(blobsAReemplazar(['A', 'B', 'C', 'D'], ['B', 'A', 'C', 'D']), []);
});

test('blobsAReemplazar: una URL que desaparece se borra; una que sigue (aunque movida) no', () => {
  assert.deepEqual(blobsAReemplazar(['A', 'B'], ['B']), ['A']);          // A desapareció
  assert.deepEqual(blobsAReemplazar(['A', 'B'], ['B', 'A', 'C']), []);   // ambas siguen
});

// ── blobsHuerfanos: EN USO = content ∪ borrador ─────────────────────────────────

test('GUARDAR: imagen reemplazada en BORRADOR pero aún en PUBLICADO NO se borra (modo b)', () => {
  // Discriminador del modo (b): diffear contra la vista mezclada (content efectiva) borraría A,
  // que sigue publicada. La unión content ∪ borrador la protege.
  const antes   = { content: { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } }, borrador: null };
  const despues = {
    content:  { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } }, // publicado INTACTO
    borrador: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } }, // draft: i1 A→X
  };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), []); // A vive en publicado; X vive en el draft
});

test('PUBLICAR: la imagen vieja publicada, ya sin referencias, SÍ se borra', () => {
  const antes = {
    content:  { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } },
    borrador: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } },
  };
  const despues = { content: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } }, borrador: null };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), ['A']); // A ya no está en ningún lado
});

test('DESCARTAR: la imagen del borrador abandonado SÍ se borra; la publicada queda', () => {
  const antes = {
    content:  { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } },
    borrador: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } },
  };
  const despues = { content: { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } }, borrador: null };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), ['X']); // X (draft abandonado) se limpia; A queda
});
