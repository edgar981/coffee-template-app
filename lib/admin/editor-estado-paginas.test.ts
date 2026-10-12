import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hayBorradorReal, debeMostrarControlesHome, paginaEstaApagada, nombreNivelInicio,
  debeReintentarVigiaRuta, TOPE_INTENTOS_VIGIA_RUTA,
} from './editor-estado-paginas';

// § EDITOR-ESTADO-PAGINAS-1 — las reglas puras detrás de G1/G2/G4/G5/G7
// (.scratch/auditoria-editor/hallazgos.md). El componente (`TiendaPaginas.tsx`,
// `TiendaSeccionEditor.tsx`, `VistaTiendaIframe.tsx`) sólo las LLAMA; se verifican acá sin montar
// React ni levantar el iframe.

// ── G1/G2 · hayBorradorReal — "difiere de lo publicado", no "la clave está en el borrador" ───────

test('hayBorradorReal: form igual a lo publicado → false, aunque el flag crudo del servidor diga true', () => {
  const publicado = { titulo: 'Hola', visible: true };
  const form = { titulo: 'Hola', visible: true };
  assert.equal(hayBorradorReal(form, publicado, true), false);
});

test('hayBorradorReal: form distinto de lo publicado → true', () => {
  const publicado = { titulo: 'Hola' };
  const form = { titulo: 'Chau' };
  assert.equal(hayBorradorReal(form, publicado, false), true);
});

test('hayBorradorReal: prender y apagar un ojo (volver al mismo valor) apaga el punto sin esperar un refetch', () => {
  const publicado = { visible: true, titulo: 'x' };
  // El dueño apaga y vuelve a prender — el form vuelve a ser idéntico a lo publicado.
  const formTrasIdaYVuelta = { visible: true, titulo: 'x' };
  assert.equal(hayBorradorReal(formTrasIdaYVuelta, publicado, true), false);
});

test('hayBorradorReal: volver a escribir el texto original también apaga el punto', () => {
  const publicado = { titulo: 'Café Nayoli' };
  const formOriginal = { titulo: 'Café Nayoli' };
  assert.equal(hayBorradorReal(formOriginal, publicado, true), false);
});

test('hayBorradorReal: sin `publicado` todavía (undefined) cae al flag crudo del servidor', () => {
  assert.equal(hayBorradorReal({ titulo: 'x' }, undefined, true), true);
  assert.equal(hayBorradorReal({ titulo: 'x' }, undefined, false), false);
});

test('hayBorradorReal: `form` sin sembrar (null, antes de la siembra única) también cae al flag crudo', () => {
  assert.equal(hayBorradorReal(null, { titulo: 'x' }, true), true);
  assert.equal(hayBorradorReal(null, { titulo: 'x' }, false), false);
});

// ── G4 · debeMostrarControlesHome ──────────────────────────────────────────────────────────────

test('debeMostrarControlesHome: sólo "home"', () => {
  assert.equal(debeMostrarControlesHome('home'), true);
  assert.equal(debeMostrarControlesHome('tienda'), false);
  assert.equal(debeMostrarControlesHome('nosotros'), false);
  assert.equal(debeMostrarControlesHome('suscripciones'), false);
});

// ── G5 · paginaEstaApagada ──────────────────────────────────────────────────────────────────────

test('paginaEstaApagada: nosotros/suscripciones apagadas → true', () => {
  const paginas = { nosotros: { visible: false }, suscripciones: { visible: true } };
  assert.equal(paginaEstaApagada('nosotros', paginas), true);
  assert.equal(paginaEstaApagada('suscripciones', paginas), false);
});

test('paginaEstaApagada: home/tienda nunca están apagadas — no son `apagable`', () => {
  const paginas = { nosotros: { visible: false }, suscripciones: { visible: false } };
  assert.equal(paginaEstaApagada('home', paginas), false);
  assert.equal(paginaEstaApagada('tienda', paginas), false);
});

test('paginaEstaApagada: sin `paginas` todavía (doc sin cargar) → false, no afirma sin base', () => {
  assert.equal(paginaEstaApagada('nosotros', undefined), false);
  assert.equal(paginaEstaApagada('nosotros', null), false);
});

// ── G7 · nombreNivelInicio ──────────────────────────────────────────────────────────────────────

test('nombreNivelInicio: "home" siempre se llama "Inicio", sea cual sea su label', () => {
  assert.equal(nombreNivelInicio('home', 'Home'), 'Inicio');
});

test('nombreNivelInicio: las demás páginas nombran la página abierta — nunca "Inicio" a secas', () => {
  assert.equal(nombreNivelInicio('suscripciones', 'Suscripciones'), 'Suscripciones');
  assert.equal(nombreNivelInicio('nosotros', 'Nosotros'), 'Nosotros');
  assert.equal(nombreNivelInicio('tienda', 'Tienda'), 'Tienda');
});

// ── G5 (el tope del vigía) · debeReintentarVigiaRuta ───────────────────────────────────────────

test('debeReintentarVigiaRuta: reintenta mientras no se llegue al tope', () => {
  for (let i = 0; i < TOPE_INTENTOS_VIGIA_RUTA; i++) {
    assert.equal(debeReintentarVigiaRuta(i), true, `intento ${i} debería reintentar (tope=${TOPE_INTENTOS_VIGIA_RUTA})`);
  }
});

test('debeReintentarVigiaRuta: deja de insistir al llegar al tope', () => {
  assert.equal(debeReintentarVigiaRuta(TOPE_INTENTOS_VIGIA_RUTA), false);
  assert.equal(debeReintentarVigiaRuta(TOPE_INTENTOS_VIGIA_RUTA + 10), false);
});
