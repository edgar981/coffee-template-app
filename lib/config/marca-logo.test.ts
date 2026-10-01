import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hayLogoImagen, logoParaVariante, altDeLogo } from './marca-logo';
import type { LogoContent } from './site-content-defaults';

const SIN_LOGO: LogoContent = { visible: true, oscuro: '', claro: '', alt: '' };
const AMBAS: LogoContent = { visible: true, oscuro: 'https://blob.example/oscuro.svg', claro: 'https://blob.example/claro.svg', alt: '' };
const SOLO_OSCURA: LogoContent = { visible: true, oscuro: 'https://blob.example/oscuro.svg', claro: '', alt: '' };
const SOLO_CLARA: LogoContent = { visible: true, oscuro: '', claro: 'https://blob.example/claro.svg', alt: '' };

// ── hayLogoImagen ────────────────────────────────────────────────────────────────────────────────

test('hayLogoImagen: sin ninguna subida → false (el caso de HOY, Nayoli)', () => {
  assert.equal(hayLogoImagen(SIN_LOGO), false);
});

test('hayLogoImagen: con las dos subidas → true', () => {
  assert.equal(hayLogoImagen(AMBAS), true);
});

test('hayLogoImagen: con SÓLO una de las dos → true (basta una)', () => {
  assert.equal(hayLogoImagen(SOLO_OSCURA), true);
  assert.equal(hayLogoImagen(SOLO_CLARA), true);
});

// ── logoParaVariante — qué versión se usa en cada contexto ──────────────────────────────────────

test('logoParaVariante: variant "light" (fondo claro, páginas internas/encabezado sólido) → la OSCURA', () => {
  assert.equal(logoParaVariante(AMBAS, 'light'), AMBAS.oscuro);
});

test('logoParaVariante: variant "dark" (fondo oscuro/tinta, el hero flotando/el pie) → la CLARA', () => {
  assert.equal(logoParaVariante(AMBAS, 'dark'), AMBAS.claro);
});

test('logoParaVariante: falta la CLARA → "dark" cae a la OSCURA (nunca deja de mostrar el logo subido)', () => {
  assert.equal(logoParaVariante(SOLO_OSCURA, 'dark'), SOLO_OSCURA.oscuro);
});

test('logoParaVariante: falta la OSCURA → "light" cae a la CLARA', () => {
  assert.equal(logoParaVariante(SOLO_CLARA, 'light'), SOLO_CLARA.claro);
});

test('logoParaVariante: ninguna subida → "" en las dos variantes (el consumidor cae al wordmark de texto)', () => {
  assert.equal(logoParaVariante(SIN_LOGO, 'light'), '');
  assert.equal(logoParaVariante(SIN_LOGO, 'dark'), '');
});

// ── altDeLogo ────────────────────────────────────────────────────────────────────────────────────

test('altDeLogo: alt escrito por el dueño se respeta tal cual', () => {
  const logo: LogoContent = { ...AMBAS, alt: 'El logo de Café Las Chamisas' };
  assert.equal(altDeLogo(logo, 'Café Las Chamisas'), 'El logo de Café Las Chamisas');
});

test('altDeLogo: alt vacío cae al nombre del negocio (fallback CONTEXTUAL, no un string inventado)', () => {
  assert.equal(altDeLogo(AMBAS, 'Café Las Chamisas'), 'Café Las Chamisas');
});

test('altDeLogo: alt en blanco (sólo espacios) cuenta como vacío', () => {
  const logo: LogoContent = { ...AMBAS, alt: '   ' };
  assert.equal(altDeLogo(logo, 'Café Las Chamisas'), 'Café Las Chamisas');
});
