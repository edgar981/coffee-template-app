import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  urlDePagina,
  urlDePaginaEnEditor,
  marcadorDeSeccion,
  selectorDeSeccion,
  scrollSeguro,
  PARAM_MODO_EDITOR,
  VALOR_MODO_EDITOR,
} from './editor-iframe';

test('urlDePagina: home es la raíz; las demás páginas, su propia ruta', () => {
  assert.equal(urlDePagina('home'), '/');
  assert.equal(urlDePagina('nosotros'), '/nosotros');
  assert.equal(urlDePagina('suscripciones'), '/suscripciones');
});

test('urlDePaginaEnEditor: la misma ruta de urlDePagina, con el parámetro de modo editor', () => {
  assert.equal(urlDePaginaEnEditor('home'), `/?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`);
  assert.equal(urlDePaginaEnEditor('nosotros'), `/nosotros?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`);
  assert.equal(urlDePaginaEnEditor('suscripciones'), `/suscripciones?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`);
});

test('marcadorDeSeccion: home/nosotros usan el nombre de la sección tal cual', () => {
  assert.equal(marcadorDeSeccion('hero'), 'hero');
  assert.equal(marcadorDeSeccion('marquesina'), 'marquesina');
  assert.equal(marcadorDeSeccion('trustBadges'), 'trustBadges');
  assert.equal(marcadorDeSeccion('brandStory'), 'brandStory');
  assert.equal(marcadorDeSeccion('origen'), 'origen');
  assert.equal(marcadorDeSeccion('presentaciones'), 'presentaciones');
  assert.equal(marcadorDeSeccion('subscriptionCTA'), 'subscriptionCTA');
  assert.equal(marcadorDeSeccion('testimonials'), 'testimonials');
  assert.equal(marcadorDeSeccion('nosotrosHistoria'), 'nosotrosHistoria');
  assert.equal(marcadorDeSeccion('nosotrosGaleria'), 'nosotrosGaleria');
  assert.equal(marcadorDeSeccion('nosotrosCierre'), 'nosotrosCierre');
});

test('marcadorDeSeccion: spotlight comparte el marcador de la banda featured que ocupa', () => {
  assert.equal(marcadorDeSeccion('spotlight'), 'featured');
});

test('marcadorDeSeccion: las tres secciones de Suscripciones comparten un marcador único de página', () => {
  assert.equal(marcadorDeSeccion('suscripcionPlanes'), 'suscripciones');
  assert.equal(marcadorDeSeccion('suscripcionPasos'), 'suscripciones');
  assert.equal(marcadorDeSeccion('suscripcionFaq'), 'suscripciones');
});

test('selectorDeSeccion: construye el atributo data-editor-seccion a partir del marcador', () => {
  assert.equal(selectorDeSeccion('hero'), '[data-editor-seccion="hero"]');
  assert.equal(selectorDeSeccion('spotlight'), '[data-editor-seccion="featured"]');
  assert.equal(selectorDeSeccion('suscripcionFaq'), '[data-editor-seccion="suscripciones"]');
});

test('scrollSeguro: valores positivos finitos pasan redondeados', () => {
  assert.equal(scrollSeguro(120.4), 120);
  assert.equal(scrollSeguro(120.6), 121);
  assert.equal(scrollSeguro(0), 0);
});

test('scrollSeguro: negativos, NaN e Infinity caen a 0', () => {
  assert.equal(scrollSeguro(-40), 0);
  assert.equal(scrollSeguro(NaN), 0);
  assert.equal(scrollSeguro(Infinity), 0);
  assert.equal(scrollSeguro(-Infinity), 0);
});
