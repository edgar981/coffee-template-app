import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { colorLaminaProducto, laminasRelacionadas, fraseNotas, datosProductoLamina, colorPuntoNota, siguienteIndiceGaleria } from './producto-lamina';
import { colorDeLamina } from './laminas';
import { tiendaInterludioVisible } from './tienda-cierre';
import type { Product } from '@/types/product';
import ProductoLamina from '@/components/storefront/producto/ProductoLamina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { CartProvider } from '@/lib/cartStore';
import { DEFAULTS } from '@/lib/config/site-content-defaults';

const producto = (over: Partial<Product>): Product => ({
  id: over.id ?? 'p1',
  nombre: over.nombre ?? 'Pacamara',
  slug: over.slug ?? 'pacamara',
  categoria: 'Café',
  precio: 48000,
  costo: 0,
  sku: null,
  stock: 10,
  activo: true,
  descripcion: '',
  disponible: true,
  ...over,
});

const CATALOGO: Product[] = [
  producto({ id: 'a', slug: 'bourbon-rosado', nombre: 'Bourbon Rosado' }),
  producto({ id: 'b', slug: 'pacamara', nombre: 'Pacamara' }),
  producto({ id: 'c', slug: 'papayo', nombre: 'Papayo' }),
];

// ── el color sale del MISMO mapa que Láminas ──────────────────────────────────────────────────────
test('colorLaminaProducto: el color del producto es el mismo que daría colorDeLamina para su índice en el catálogo', () => {
  const mapa = { b: '#112233' };
  assert.equal(colorLaminaProducto(CATALOGO, 'b', mapa), colorDeLamina('b', 1, mapa));
});

test('colorLaminaProducto: sin entrada en el mapa, cae a la misma paleta de reserva que Láminas (mismo índice)', () => {
  assert.equal(colorLaminaProducto(CATALOGO, 'c', {}), colorDeLamina('c', 2, {}));
});

test('colorLaminaProducto: producto ausente del catálogo recibido cae al índice 0, no lanza', () => {
  assert.equal(colorLaminaProducto(CATALOGO, 'inexistente', {}), colorDeLamina('inexistente', 0, {}));
});

// ── «Te puede interesar» excluye el producto actual ───────────────────────────────────────────────
test('laminasRelacionadas: excluye el producto actual, conserva los demás con el color de SU índice real', () => {
  const relacionados = laminasRelacionadas(CATALOGO, 'b', {});
  assert.deepEqual(relacionados.map((r) => r.productId), ['a', 'c']);
  assert.equal(relacionados[0].color, colorDeLamina('a', 0, {}));
  assert.equal(relacionados[1].color, colorDeLamina('c', 2, {}));
});

test('laminasRelacionadas: catálogo de un solo producto (el actual) → lista vacía', () => {
  assert.deepEqual(laminasRelacionadas([producto({ id: 'solo' })], 'solo', {}), []);
});

test('laminasRelacionadas: conserva TODAS las notas (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 7 — la maqueta muestra la frase completa, no un recorte a dos)', () => {
  const [relacionado] = laminasRelacionadas(
    [producto({ id: 'x', notas: ['Chocolate', 'Floral', 'Cítrico'] }), producto({ id: 'actual' })],
    'actual',
    {},
  );
  assert.deepEqual(relacionado.notas, ['Chocolate', 'Floral', 'Cítrico']);
});

// ── sin retrato no hay bloque — reuso del MISMO gate que /tienda, no uno nuevo ────────────────────
test('sin retrato no hay bloque: el gate que decide si el Interludio se muestra es el MISMO de /tienda (tiendaInterludioVisible), reusado tal cual', () => {
  assert.equal(tiendaInterludioVisible(''), false);
  assert.equal(tiendaInterludioVisible('   '), false);
  assert.equal(tiendaInterludioVisible('https://blob.example/retrato.jpg'), true);
});

// ── la frase de notas ──────────────────────────────────────────────────────────────────────────────
test('fraseNotas: sin notas, cadena vacía', () => {
  assert.equal(fraseNotas([]), '');
});

test('fraseNotas: una nota → "A."', () => {
  assert.equal(fraseNotas(['Chocolate']), 'Chocolate.');
});

test('fraseNotas: dos notas → "A y B."', () => {
  assert.equal(fraseNotas(['Chocolate', 'Tropical']), 'Chocolate y Tropical.');
});

test('fraseNotas: tres notas → "A, B y C." (la maqueta aprobada, "Chocolate, tropical y cremoso.")', () => {
  assert.equal(fraseNotas(['Chocolate', 'Tropical', 'Cremoso']), 'Chocolate, Tropical y Cremoso.');
});

test('fraseNotas: descarta vacíos/espacios antes de puntuar', () => {
  assert.equal(fraseNotas(['Chocolate', '  ', 'Tropical']), 'Chocolate y Tropical.');
});

// ── los datos del producto, sólo los que existen ──────────────────────────────────────────────────
test('datosProductoLamina: sin ningún dato, lista vacía (la etiqueta no se muestra)', () => {
  assert.deepEqual(datosProductoLamina({}), []);
});

test('datosProductoLamina: con los cuatro, en orden variedad · altitud · tostión · peso', () => {
  assert.deepEqual(
    datosProductoLamina({ variedad: 'Pacamara', altitudMin: 1600, altitudMax: 2000, tostado: 'medio', peso_gramos: 340 }),
    [
      { label: 'Variedad', value: 'Pacamara' },
      { label: 'Altitud', value: '1.600–2.000 m s.n.m.' },
      { label: 'Tostión', value: 'Media' },
      { label: 'Peso', value: '340 g' },
    ],
  );
});

test('datosProductoLamina: altitud con un solo extremo (sin el otro) se omite entera', () => {
  assert.deepEqual(datosProductoLamina({ altitudMin: 1600 }), []);
  assert.deepEqual(datosProductoLamina({ altitudMax: 2000 }), []);
});

test('datosProductoLamina: tostado fuera del set conocido (catálogo no-café) se omite, no "Tostión: undefined"', () => {
  assert.deepEqual(datosProductoLamina({ tostado: 'inventado' as never }), []);
});

test('datosProductoLamina: sólo variedad presente → sólo esa entrada', () => {
  assert.deepEqual(datosProductoLamina({ variedad: 'Caturra' }), [{ label: 'Variedad', value: 'Caturra' }]);
});

// ── el punto FUERTE de las notas (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 1) ──────────────────
test('colorPuntoNota: un pastel casi blanco (el color de lámina del Bourbon Rosado de la maqueta) se vuelve sólido y saturado, no un derivado hueco', () => {
  assert.equal(colorPuntoNota('#F8D9D1'), '#ba3d1c');
});

test('colorPuntoNota: un color de lámina ya oscuro/saturado (acento por defecto de Nayoli) también se lleva al mismo piso de fuerza, nunca se queda igual', () => {
  const fuerte = colorPuntoNota('#8b4513');
  assert.equal(fuerte, '#bc5e1a');
  assert.notEqual(fuerte, '#8b4513');
});

test('colorPuntoNota: nunca devuelve el mismo color que recibió — el punto SIEMPRE se distingue de la lámina', () => {
  for (const c of ['#F8D9D1', '#8b4513', '#592e10', '#c9a88e', '#bb9172']) {
    assert.notEqual(colorPuntoNota(c), c);
  }
});

test('colorPuntoNota: un color acromático (gris/blanco/negro) no revienta — cae a un rojo determinista, nunca NaN/undefined', () => {
  for (const c of ['#000000', '#ffffff', '#808080']) {
    const fuerte = colorPuntoNota(c);
    assert.match(fuerte, /^#[0-9a-f]{6}$/);
  }
});

// ── el índice siguiente/anterior de la galería (§ PRODUCTO-LAMINA-GALERIA-1) ──────────────────────
// `siguienteIndiceGaleria` es un RE-EXPORT de `lib/storefront/galeria.ts` (§ el docstring de arriba
// en producto-lamina.ts) — este test confirma que la galería de ESTA composición navega con la
// MISMA regla «en bucle» que ya usa `GaleriaProducto.tsx`, no una segunda copia que pudiera divergir.
test('siguienteIndiceGaleria: siguiente avanza uno, y da la vuelta al llegar al final (3 fotos)', () => {
  assert.equal(siguienteIndiceGaleria(0, 3, 1), 1);
  assert.equal(siguienteIndiceGaleria(1, 3, 1), 2);
  assert.equal(siguienteIndiceGaleria(2, 3, 1), 0); // vuelta al inicio
});

test('siguienteIndiceGaleria: anterior retrocede uno, y da la vuelta al llegar al principio (3 fotos)', () => {
  assert.equal(siguienteIndiceGaleria(2, 3, -1), 1);
  assert.equal(siguienteIndiceGaleria(1, 3, -1), 0);
  assert.equal(siguienteIndiceGaleria(0, 3, -1), 2); // vuelta al final
});

test('siguienteIndiceGaleria: con una sola foto, no hay a dónde navegar — devuelve el mismo índice', () => {
  assert.equal(siguienteIndiceGaleria(0, 1, 1), 0);
  assert.equal(siguienteIndiceGaleria(0, 1, -1), 0);
});

// ── el mecanismo de cambiar de foto, por RENDER (§ PRODUCTO-LAMINA-GALERIA-1) ─────────────────────
// `renderToStaticMarkup` en memoria (sin jsdom, sin red, sin `.env`/base — mismo método que
// `lib/config/nosotros-bandas.test.ts`/`lib/config/cromo-volver-arriba.test.ts`). SSR no evalúa CSS,
// así que "a 1100px y 390px" no son dos renders con geometría distinta —no hay viewport que medir
// sin navegador—: es la MISMA marca, afirmando que las flechas llevan las dos clases responsive que
// producen ese comportamiento (`hidden` por defecto, bajo 640px = 390px; `sm:flex` desde 640px en
// adelante = 1100px), mientras que miniaturas y puntos —el mecanismo del celular— NO llevan ningún
// `hidden` que las apague en ningún ancho. Lo que el teclado/el deslizar HACEN (los `onKeyDown`/
// `onTouchStart`/`onTouchEnd`) no serializa a HTML —ningún `renderToStaticMarkup` lo vería—, así
// que esa mitad queda declarada como límite, no afirmada acá.
// Las URLs van como paths LOCALES (`/una.webp`, mismo patrón que `PRODUCTO_FIXTURE` de
// `lib/config/presentaciones-riel.test.ts`), no `https://` — `next/image` valida los hosts
// remotos contra `next.config.ts` (`images.remotePatterns`, sólo el store de Blob), y un host de
// prueba inventado lo rechaza con 500 en SSR. Un path local no pasa por esa validación.
function productoConTresFotos(): Product {
  return producto({
    id: 'p-3fotos',
    imagen: '/una.webp',
    imagenes: ['/dos.webp', '/tres.webp'],
  });
}

function renderProductoLamina(product: Product, catalog: Product[]): string {
  const arbol = React.createElement(SiteContentProvider, {
    value: DEFAULTS,
    children: React.createElement(CartProvider, {
      children: React.createElement(ProductoLamina, { product, catalog }),
    }),
  });
  return renderToStaticMarkup(arbol);
}

test('render en memoria, 3 fotos: las DOS flechas aparecen, con `aria-label` y las clases que las ocultan bajo 640px (≈390px) y las muestran desde 640px (≈1100px)', () => {
  const product = productoConTresFotos();
  const html = renderProductoLamina(product, [product]);
  assert.match(html, /aria-label="Foto anterior"/);
  assert.match(html, /aria-label="Foto siguiente"/);
  // Las DOS flechas llevan `hidden` (ocultas por defecto, el caso de 390px) y `sm:flex` (visibles
  // desde 640px, el caso de 1100px) — nunca `flex` a secas, que las mostraría también en el celular.
  const flechaAnterior = /<button[^>]*aria-label="Foto anterior"[^>]*class="([^"]*)"/.exec(html);
  const flechaSiguiente = /<button[^>]*aria-label="Foto siguiente"[^>]*class="([^"]*)"/.exec(html);
  assert.ok(flechaAnterior, 'la flecha anterior debe existir en el marcado');
  assert.ok(flechaSiguiente, 'la flecha siguiente debe existir en el marcado');
  for (const clase of [flechaAnterior![1], flechaSiguiente![1]]) {
    assert.match(clase, /(^|\s)hidden(\s|$)/);
    assert.match(clase, /(^|\s)sm:flex(\s|$)/);
  }
});

test('render en memoria, 3 fotos: las miniaturas (una por foto, "arcos pequeños") no llevan ninguna clase que las oculte en el celular — el mecanismo de 390px no depende del de 1100px', () => {
  const product = productoConTresFotos();
  const html = renderProductoLamina(product, [product]);
  for (let i = 1; i <= 3; i++) {
    assert.match(html, new RegExp(`aria-label="Ver foto ${i} de 3"`));
  }
  const miniatura = /<button[^>]*aria-label="Ver foto 1 de 3"[^>]*class="([^"]*)"/.exec(html);
  assert.ok(miniatura, 'la miniatura 1 debe existir en el marcado');
  // `(^|\s)hidden(\s|$)` — el TOKEN de clase completo, no la substring dentro de
  // `overflow-hidden` (que SÍ está presente, legítimamente, para recortar la foto del arco).
  assert.doesNotMatch(miniatura![1], /(^|\s)hidden(\s|$)/);
});

test('render en memoria, 3 fotos: los TRES puntos siguen ahí ("los puntos se quedan"), junto a las miniaturas y las flechas', () => {
  const product = productoConTresFotos();
  const html = renderProductoLamina(product, [product]);
  for (let i = 1; i <= 3; i++) {
    assert.match(html, new RegExp(`aria-label="Foto ${i} de 3"`));
  }
});

test('render en memoria, UNA sola foto: no aparece ninguna flecha, miniatura ni punto — "no aparece nada de esto"', () => {
  const product = producto({ id: 'p-1foto', imagen: '/unica.webp', imagenes: [] });
  const html = renderProductoLamina(product, [product]);
  assert.doesNotMatch(html, /aria-label="Foto anterior"/);
  assert.doesNotMatch(html, /aria-label="Foto siguiente"/);
  assert.doesNotMatch(html, /aria-label="Ver foto/);
  assert.doesNotMatch(html, /aria-label="Foto 1 de/);
});
