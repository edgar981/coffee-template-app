import { test } from 'node:test';
import assert from 'node:assert/strict';

import { inicioCruceInalcanzable, startCruceGigante } from './cruce';

// ─── Punto 7 (§ EDITOR-PAGINAS-ONIX-ARREGLOS-1): el defecto medido con el repro aislado ────────────
// (`.scratch/editor-paginas-onix-arreglos-1/`, GSAP/ScrollTrigger reales, sin DB/`.env`): para una
// sección que nace al TOPE del documento (la Apertura — primera banda de /tienda, /nosotros,
// /suscripciones), `topDocumento - alturaViewport` es NEGATIVO — inalcanzable.

test('una sección que nace en el tope del documento (topDocumento=0) tiene el umbral de "top bottom" inalcanzable', () => {
  assert.equal(inicioCruceInalcanzable(0, 900), true);
  assert.equal(inicioCruceInalcanzable(0, 844), true);
});

test('una sección que nace MUY por debajo del tope (mid-page, Banner/ImagenTexto) tiene el umbral alcanzable', () => {
  // Medido con el repro `repro-midpage.html`: topDocumento=2700 a viewport 900 → 2700-900=1800>0.
  assert.equal(inicioCruceInalcanzable(2700, 900), false);
});

test('el umbral exacto es topDocumento === alturaViewport — inalcanzable es "< 0", no "<= 0"', () => {
  // topDocumento === alturaViewport da resta EXACTAMENTE 0: el scroll 0 SÍ alcanza ese umbral (no es
  // negativo), así que 'top bottom' sigue siendo válido en el límite.
  assert.equal(inicioCruceInalcanzable(900, 900), false);
  assert.equal(inicioCruceInalcanzable(899, 900), true);
});

test('startCruceGigante: "top top" cuando el inicio es inalcanzable, "top bottom" si no — las CUATRO combinaciones medidas con el repro', () => {
  // Las cuatro combinaciones reales que el repro de este slice corrió (85vh/70svh × escritorio/
  // celular): las CUATRO dieron topDocumento=0 (la Apertura es la primera banda) → las cuatro
  // deberían usar 'top top'.
  assert.equal(startCruceGigante(0, 900), 'top top');   // tienda/nosotros-desktop
  assert.equal(startCruceGigante(0, 844), 'top top');   // tienda/nosotros-movil
  // Mid-page (Banner/ImagenTexto, hipotético, § repro-midpage.html): 'top bottom', sin cambio.
  assert.equal(startCruceGigante(2700, 900), 'top bottom');
});
