import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { datosDelPatch } from '@/lib/product-update';
import { blobsRetirados } from '@/lib/product-gallery';
import { prisma, limpiar } from './fixtures';

// UN PATCH PARCIAL NO PUEDE TOCAR NADA MÁS — el defecto que destruía datos y
// blobs en producción desde un botón visible del admin.
//
// "Desactivar", la acción secundaria del diálogo de borrado, manda
// `{ activo: false }` y nada más. El endpoint aplicaba un fallback a CADA campo,
// y un fallback sobre una clave ausente no es un default: es un borrado. Ese
// click vaciaba la descripción, ponía precio/costo/stock en cero, borraba SKU,
// variante, origen, tostado y peso, y dejaba `imagen: ''` con `imagenes: []` —
// tras lo cual el borrado de blobs del propio endpoint veía la portada y la
// galería como "retiradas" y las borraba del store. La base tiene respaldos; los
// blobs no.
//
// POR QUÉ ESTE TEST VA EN EL CARRIL Y NO EN LA SUITE PURA: lo que se afirma no
// es la forma del objeto que se construye, es lo que la fila TIENE DESPUÉS de
// escribir. Un test con mocks habría pasado en verde contra el código defectuoso
// —el objeto que se armaba era exactamente el que Prisma escribió—; lo que
// delata el bug es leer la fila de vuelta. Es el mismo criterio de
// `ajuste-concurrente`: la capa que prueba que ESCRIBE bien no la sustituye
// ninguna otra.
//
// El carril no monta handlers HTTP, así que se ejercita `datosDelPatch` —la
// función que el endpoint usa para decidir qué escribe— contra una base real.
// Lo que queda fuera y sigue siendo del checklist manual: la sesión, los roles y
// el fetch del navegador.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Un producto POBLADO: cada campo con un valor que se note si desaparece. */
async function crearProductoCompleto() {
  return prisma.product.create({
    data: {
      nombre:       'Café Nayoli — Molido 250 g',
      slug:         'cafe-nayoli-molido-250g',
      descripcion:  'Café de especialidad cultivado en la Finca Nayoli.',
      categoria:    'cafe_molido',
      precio:       20000,
      costo:        14000,
      sku:          'NAY-M-250',
      stock:        42,
      stock_minimo: 10,
      activo:       true,
      peso_gramos:  250,
      variante:     'Molido · 250 g',
      origen:       'Supatá, Cundinamarca',
      tostado:      'medio',
      variedad:     'Castillo',
      proceso:      'Lavado',
      altitudMin:   1650,
      altitudMax:   2100,
      molienda:     'Media',
      notas:        ['Chocolate', 'Herbal'],
      notasCata:    ['Fragancia a chocolate'],
      descripcionCorta: 'Origen único de Supatá.',
      imagen:       'https://blob.vercel-storage.com/productos/portada-abc123.webp',
      imagenes:     [
        'https://blob.vercel-storage.com/productos/toma-2-def456.webp',
        'https://blob.vercel-storage.com/productos/toma-3-ghi789.webp',
      ],
      bestseller:   true,
      badge:        'Más vendido',
    },
  });
}

/** Aplica un body como lo hace el endpoint y devuelve la fila releída. */
async function patch(id: string, body: Record<string, unknown>) {
  await prisma.product.update({
    where: { id },
    data:  { ...datosDelPatch(body), updatedAt: new Date() },
  });
  return prisma.product.findUniqueOrThrow({ where: { id } });
}

// ─── LA REGRESIÓN ────────────────────────────────────────────────────────────

test('{ activo: false } cambia SOLO `activo` — la fila entera queda igual', async () => {
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, { activo: false });

  // La afirmación es sobre la fila COMPLETA y no sobre una lista de campos
  // elegidos a mano: así, una columna nueva que alguien agregue al schema queda
  // cubierta el día que la agrega, sin acordarse de este archivo.
  // `updatedAt` es lo único que un PATCH siempre mueve, por diseño.
  assert.deepEqual(
    { ...despues, updatedAt: null },
    { ...antes, activo: false, updatedAt: null },
  );
});

test('el desactivado NO propone borrar un solo blob', async () => {
  // La mitad irreversible. Aunque la fila quedara mal, lo que destruye para
  // siempre es el borrado en el store — y se decide con este diff.
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, { activo: false });

  const portadaRetirada = Boolean(
    antes.imagen && antes.imagen !== despues.imagen && !despues.imagenes.includes(antes.imagen),
  );
  const galeriaRetirada = blobsRetirados(antes.imagenes, despues.imagenes, [despues.imagen]);

  assert.equal(portadaRetirada, false);
  assert.deepEqual(galeriaRetirada, []);
});

test('reactivar tampoco toca nada: el ida y vuelta deja la fila idéntica', async () => {
  const antes = await crearProductoCompleto();

  await patch(antes.id, { activo: false });
  const despues = await patch(antes.id, { activo: true });

  assert.deepEqual({ ...despues, updatedAt: null }, { ...antes, updatedAt: null });
});

// ─── Que el arreglo no haya vuelto mudo al endpoint ──────────────────────────

test('un PATCH completo sigue escribiendo todo lo que trae', async () => {
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, {
    nombre:       'Café Nayoli — Molido 500 g',
    descripcion:  'Descripción nueva.',
    categoria:    'cafe_molido',
    precio:       35000,
    costo:        22000,
    sku:          'NAY-M-500',
    stock:        18,
    stock_minimo: 6,
    activo:       true,
    peso_gramos:  500,
    variante:     'Molido · 500 g',
    origen:       'Supatá, Cundinamarca',
    tostado:      'oscuro',
    imagen:       'https://blob.vercel-storage.com/productos/portada-nueva-xyz.webp',
    imagenes:     ['https://blob.vercel-storage.com/productos/toma-2-def456.webp'],
  });

  assert.equal(despues.nombre, 'Café Nayoli — Molido 500 g');
  assert.equal(despues.precio, 35000);
  assert.equal(despues.stock, 18);
  assert.equal(despues.peso_gramos, 500);
  assert.equal(despues.tostado, 'oscuro');
  assert.deepEqual(despues.imagenes, ['https://blob.vercel-storage.com/productos/toma-2-def456.webp']);
  // Y la toma que salió de la galería sí se propone para borrado — el arreglo
  // frena el borrado espurio sin apagar el legítimo.
  assert.deepEqual(
    blobsRetirados(antes.imagenes, despues.imagenes, [despues.imagen]),
    ['https://blob.vercel-storage.com/productos/toma-3-ghi789.webp'],
  );
});

test('vaciar un campo A PROPÓSITO se distingue de no mandarlo', async () => {
  // La razón de mirar la PRESENCIA de la clave y no la verdad del valor: `''`,
  // `0` y `null` son ediciones legítimas y tienen que poder escribirse.
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, { sku: '', descripcion: '', costo: 0 });

  assert.equal(despues.sku, null);            // `'' || null` → null, como siempre
  assert.equal(despues.descripcion, '');
  assert.equal(despues.costo, 0);
  // …y lo que no se mandó sigue intacto.
  assert.equal(despues.precio, antes.precio);
  assert.equal(despues.stock, antes.stock);
  assert.equal(despues.imagen, antes.imagen);
});

test('un slug vacío no borra el slug — la columna es única y sostiene la URL', async () => {
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, { slug: '', nombre: 'Otro nombre' });

  assert.equal(despues.slug, antes.slug);
  assert.equal(despues.nombre, 'Otro nombre');
});

test('una clave con `undefined` cuenta como AUSENTE, no como borrado', async () => {
  // Es lo que manda un cliente que arma el body con campos opcionales
  // (`variante: form.variante || undefined`), y el caso que hace insuficiente
  // un `Object.hasOwn` a secas.
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, { activo: false, variante: undefined, origen: undefined });

  assert.equal(despues.variante, antes.variante);
  assert.equal(despues.origen, antes.origen);
});

test('un body VACÍO no cambia ningún campo', async () => {
  const antes = await crearProductoCompleto();

  const despues = await patch(antes.id, {});

  assert.deepEqual({ ...despues, updatedAt: null }, { ...antes, updatedAt: null });
});
