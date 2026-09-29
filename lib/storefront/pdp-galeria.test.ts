import { test } from 'node:test';
import assert from 'node:assert/strict';

import { entradaHeroInicial, heroDeGaleria } from './pdp-galeria';

// § HERO-SIN-TARJETA-Y-PDP-IMAGEN-1 (defecto 2) — el porqué completo vive en el docstring de
// pdp-galeria.ts: la imagen principal de /tienda/[slug] cargaba pero su contenedor podía quedar en
// `opacity: 0` computada, porque su visibilidad dependía de que una animación de framer-motion
// completara. Lo PURO y por tanto afirmable acá es la DECISIÓN (qué `initial` usar, a qué imagen
// caer) — la animación en sí, y si framer-motion la ejecuta a tiempo, es capa 3 (navegador real),
// igual que el resto de las animaciones de mount/scroll de este repo.

test('entradaHeroInicial: SIN interacción (galeriaTocada=false) es `false` — nunca animar la carga inicial', () => {
  assert.equal(entradaHeroInicial(false), false);
});

test('entradaHeroInicial: CON interacción (galeriaTocada=true) es el fade normal, {opacity:0}', () => {
  assert.deepEqual(entradaHeroInicial(true), { opacity: 0 });
});

test('heroDeGaleria: con un índice dentro de rango, devuelve esa imagen', () => {
  assert.equal(heroDeGaleria(['a.jpg', 'b.jpg', 'c.jpg'], 1), 'b.jpg');
});

test('heroDeGaleria: con imgIdx=0 (el caso normal de carga), devuelve la portada', () => {
  assert.equal(heroDeGaleria(['portada.jpg', 'otra.jpg'], 0), 'portada.jpg');
});

test('heroDeGaleria: con un índice FUERA de rango (galería más corta que el imgIdx heredado de otra navegación), cae a la portada — nunca undefined', () => {
  assert.equal(heroDeGaleria(['unica.jpg'], 3), 'unica.jpg');
});

test('heroDeGaleria: galería vacía (producto sin imágenes) devuelve undefined — hide-on-empty, imagenPortada() cubre el fallback de marca', () => {
  assert.equal(heroDeGaleria([], 0), undefined);
  assert.equal(heroDeGaleria([], 2), undefined);
});
