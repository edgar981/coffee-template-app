import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagenDeMolienda } from '@duna/core/moliendas-opciones';
import { imagenPortada, PLACEHOLDER_PRODUCTO } from '@/lib/producto-imagen';

// EL MUESTRARIO (§ MUESTRARIO-VARIANTE-IMAGEN-1) — la imagen que `Spotlight.tsx`
// (components/storefront/home/) muestra cuando el cliente elige una presentación.
// El componente encadena DOS decisiones: cuál imagen usar (`imagenDeMolienda`, la
// opción elegida o la del producto — packages/core, ya afirmada campo-por-campo en
// `packages/core/src/moliendas-opciones.test.ts`) y el FALLBACK de portada
// (`imagenPortada`, cadena vacía → placeholder de marca). Este archivo prueba las
// DOS JUNTAS, en la composición exacta que el componente usa — probar sólo la
// primera no afirmaría que el placeholder sigue respondiendo cuando ni la opción
// ni el producto tienen foto, que es justo el caso que `imagenPortada` existe para
// cerrar (§ lib/producto-imagen.ts, el bug de `??` vs `||`).
//
// Es un componente 'use client' con framer-motion y next/image; el repo no tiene
// jsdom para TSX (§ CLAUDE.md), así que — mismo criterio que
// `lib/config/spotlight-banda.test.ts` — se afirma lo que decide QUÉ se muestra
// antes de que el componente pinte un nodo, no el JSX.

const IMAGEN_PRODUCTO = '/images/cafe-huila-250.webp';
const IMAGEN_OPCION = 'https://blob.example/productos/molido-media.jpg';

/** La composición exacta de `Spotlight.tsx` para el `src` de la imagen principal. */
function imagenSpotlight(raw: unknown, molienda: string | null, imagenProducto: string): string {
  return imagenPortada(imagenDeMolienda(raw, molienda, imagenProducto));
}

test('con imagen propia en la opción elegida, el spotlight la usa', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: true, imagen: IMAGEN_OPCION }];
  assert.equal(imagenSpotlight(opciones, 'Media', IMAGEN_PRODUCTO), IMAGEN_OPCION);
});

test('sin imagen propia en la opción, el spotlight cae a la del producto — el comportamiento de hoy', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: true }];
  assert.equal(imagenSpotlight(opciones, 'Media', IMAGEN_PRODUCTO), IMAGEN_PRODUCTO);
});

test('sin molienda elegida (null), el spotlight muestra la del producto', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: true, imagen: IMAGEN_OPCION }];
  assert.equal(imagenSpotlight(opciones, null, IMAGEN_PRODUCTO), IMAGEN_PRODUCTO);
});

test('una molienda elegida que ya no matchea ninguna opción (dato rancio) cae a la del producto', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: true, imagen: IMAGEN_OPCION }];
  assert.equal(imagenSpotlight(opciones, 'Gruesa', IMAGEN_PRODUCTO), IMAGEN_PRODUCTO);
});

test('una opción con `imagen` en blanco se trata como sin imagen propia', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: true, imagen: '   ' }];
  assert.equal(imagenSpotlight(opciones, 'Media', IMAGEN_PRODUCTO), IMAGEN_PRODUCTO);
});

test('sin imagen de opción NI de producto, el placeholder de marca sigue respondiendo', () => {
  const opciones = [{ nombre: 'Media', metodo: 'Filtro', disponible: true }];
  assert.equal(imagenSpotlight(opciones, 'Media', ''), PLACEHOLDER_PRODUCTO);
});

test('NAYOLI BYTE-IDÉNTICO: un catálogo sin imagen por opción sigue mostrando siempre la portada', () => {
  // Los datos reales de Nayoli no declaran `imagen` en ninguna opción — el swap
  // nuevo no puede moverles un byte.
  const MOLIDO = [
    { nombre: 'Extra gruesa', metodo: 'Cold brew', disponible: false },
    { nombre: 'Gruesa', metodo: 'Prensa francesa', disponible: false },
    { nombre: 'Media', metodo: 'Filtro / Greca', disponible: true },
    { nombre: 'Fina', metodo: 'Moka / Espresso', disponible: false },
  ];
  for (const molienda of ['Extra gruesa', 'Gruesa', 'Media', 'Fina', null]) {
    assert.equal(imagenSpotlight(MOLIDO, molienda, IMAGEN_PRODUCTO), IMAGEN_PRODUCTO);
  }
});
