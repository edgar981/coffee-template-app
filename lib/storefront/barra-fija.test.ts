import { test } from 'node:test';
import assert from 'node:assert/strict';

import { visibilidadBarraFija, altoPublicadoBarraFija, MARGEN_HISTERESIS_BARRA_FIJA_PX } from './barra-fija';

const ALTURA_PANTALLA = 844; // iPhone emulado, § el demo medido por el orquestador (390×844)

// ── ANTES DE LLEGAR AL BOTÓN — oculta, siempre ──────────────────────────────────────────────────

test('visibilidadBarraFija: antes de llegar al botón (más abajo del viewport) → oculta', () => {
  const boton = { top: 1000, bottom: 1100 };
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, false), false);
});

test('visibilidadBarraFija: antes de llegar al botón → oculta AUNQUE visibleAntes sea true', () => {
  // El caso que distingue esto de la histéresis: "antes de llegar" no es una zona de incertidumbre
  // que deba conservar el estado previo — es un hecho que fuerza oculta sin condición.
  const boton = { top: 900, bottom: 950 };
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, true), false);
});

// ── MIENTRAS EL BOTÓN SE VE — oculta, siempre ───────────────────────────────────────────────────

test('visibilidadBarraFija: el botón está en pantalla → oculta', () => {
  const boton = { top: 200, bottom: 300 };
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, false), false);
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, true), false);
});

test('visibilidadBarraFija: el botón asoma apenas por el borde inferior → sigue en pantalla, oculta', () => {
  const boton = { top: 840, bottom: 900 }; // top < 844, bottom > 0: una franja visible
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, false), false);
});

// ── EL BOTÓN YA PASÓ ARRIBA — visible ───────────────────────────────────────────────────────────

test('visibilidadBarraFija: el botón quedó claramente arriba de la pantalla → visible', () => {
  const boton = { top: -300, bottom: -200 };
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, false), true);
});

test('visibilidadBarraFija: entre arriba del todo (sobre la portada) también visible', () => {
  // § "Qué pasa hoy" del spec: con el bug viejo la barra se veía desde arriba de la página. Con la
  // regla nueva, ese tramo (el botón bien abajo del viewport, top >= alturaPantalla) debe dar
  // oculta, no visible — lo cubre el primer test de este archivo. Éste confirma el otro extremo.
  const boton = { top: -2000, bottom: -1900 };
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, true), true);
});

// ── LA HISTÉRESIS — cruzar de a 8px sobre el umbral cambia UNA sola vez ─────────────────────────

test('visibilidadBarraFija: histéresis al APARECER — oculta dentro de la franja, visible sólo al cruzarla', () => {
  // El botón sube (scroll hacia abajo): bottom pasa de -4 a -20 en pasos de 8px, cruzando el
  // margen de 16px. Dentro de (-16, 0] debe conservar el estado previo (oculta); sólo al superar
  // -16 debe pasar a visible, y sólo UNA vez.
  const pasos = [-4, -12, -20].map((bottom) => ({ top: bottom - 50, bottom }));
  let visible = false;
  let cambios = 0;
  for (const boton of pasos) {
    const nuevo = visibilidadBarraFija(boton, ALTURA_PANTALLA, visible);
    if (nuevo !== visible) cambios += 1;
    visible = nuevo;
  }
  assert.equal(visible, true);
  assert.equal(cambios, 1);
});

test('visibilidadBarraFija: histéresis al OCULTARSE — se queda visible en la franja, oculta sólo al re-entrar', () => {
  // El botón baja de vuelta (scroll hacia arriba): bottom pasa de -20 a +4. La barra debe quedarse
  // VISIBLE mientras bottom <= 0 (incluida la franja de histéresis, para no titilar) y ocultarse
  // sólo cuando el botón vuelve a tener una parte genuinamente en pantalla (bottom > 0).
  const pasos = [-20, -12, -4, 4].map((bottom) => ({ top: bottom - 46, bottom }));
  let visible = true;
  let cambios = 0;
  for (const boton of pasos) {
    const nuevo = visibilidadBarraFija(boton, ALTURA_PANTALLA, visible);
    if (nuevo !== visible) cambios += 1;
    visible = nuevo;
  }
  assert.equal(visible, false);
  assert.equal(cambios, 1);
});

test('visibilidadBarraFija: margen personalizado se respeta', () => {
  const boton = { top: -58, bottom: -8 };
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, false, 4), true); // -8 <= -4
  assert.equal(visibilidadBarraFija(boton, ALTURA_PANTALLA, false, MARGEN_HISTERESIS_BARRA_FIJA_PX), false); // -8 > -16, conserva
});

// ── EL ALTO PUBLICADO ────────────────────────────────────────────────────────────────────────────

test('altoPublicadoBarraFija: oculta → "0px", sin importar el alto medido', () => {
  assert.equal(altoPublicadoBarraFija(false, 64), '0px');
  assert.equal(altoPublicadoBarraFija(false, 0), '0px');
});

test('altoPublicadoBarraFija: visible → el alto real, en px', () => {
  assert.equal(altoPublicadoBarraFija(true, 64), '64px');
  assert.equal(altoPublicadoBarraFija(true, 76.5), '76.5px');
});

test('altoPublicadoBarraFija: visible con un alto negativo (medición espuria) → nunca negativo', () => {
  assert.equal(altoPublicadoBarraFija(true, -5), '0px');
});
