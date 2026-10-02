import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hayLogoImagen, logoParaVariante, altDeLogo, modoLogoResuelto } from './marca-logo';
import type { LogoContent } from './site-content-defaults';

// `icono` (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1) es ajeno a lo que este archivo prueba (wordmark/
// mark, no el favicon) — '' en las cinco fixtures, sólo para satisfacer `LogoContent`. `modo` (§
// NAV-LOGO-Y-NOMBRE-1) también '' por defecto — las fixtures con un modo EXPLÍCITO lo declaran.
const SIN_LOGO: LogoContent = { visible: true, oscuro: '', claro: '', alt: '', icono: '', modo: '' };
const AMBAS: LogoContent = { visible: true, oscuro: 'https://blob.example/oscuro.svg', claro: 'https://blob.example/claro.svg', alt: '', icono: '', modo: '' };
const SOLO_OSCURA: LogoContent = { visible: true, oscuro: 'https://blob.example/oscuro.svg', claro: '', alt: '', icono: '', modo: '' };
const SOLO_CLARA: LogoContent = { visible: true, oscuro: '', claro: 'https://blob.example/claro.svg', alt: '', icono: '', modo: '' };

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

// ── modoLogoResuelto (§ NAV-LOGO-Y-NOMBRE-1) — el default CONDICIONAL, y el clamp de basura ───────

test('modoLogoResuelto: sin logo y sin modo elegido → "soloNombre" (el caso de HOY, Nayoli)', () => {
  assert.equal(modoLogoResuelto(SIN_LOGO), 'soloNombre');
});

test('modoLogoResuelto: con logo y sin modo elegido → "soloLogo" (el caso de HOY, un tenant que ya subió uno)', () => {
  assert.equal(modoLogoResuelto(AMBAS), 'soloLogo');
  assert.equal(modoLogoResuelto(SOLO_OSCURA), 'soloLogo');
  assert.equal(modoLogoResuelto(SOLO_CLARA), 'soloLogo');
});

test('modoLogoResuelto: los TRES valores explícitos sobreviven tal cual, con o sin logo subido', () => {
  assert.equal(modoLogoResuelto({ ...SIN_LOGO, modo: 'soloNombre' }), 'soloNombre');
  assert.equal(modoLogoResuelto({ ...SIN_LOGO, modo: 'soloLogo' }), 'soloLogo');
  assert.equal(modoLogoResuelto({ ...SIN_LOGO, modo: 'logoYNombre' }), 'logoYNombre');
  assert.equal(modoLogoResuelto({ ...AMBAS, modo: 'soloNombre' }), 'soloNombre', 'una elección válida AUN con logo subido — el dueño puede volver al texto sin borrar las imágenes');
  assert.equal(modoLogoResuelto({ ...AMBAS, modo: 'logoYNombre' }), 'logoYNombre');
});

test('modoLogoResuelto: basura (ni vacío ni uno de los tres) cae al default CONDICIONAL, nunca lanza — SOFT', () => {
  assert.equal(modoLogoResuelto({ ...SIN_LOGO, modo: 'da' }), 'soloNombre');
  assert.equal(modoLogoResuelto({ ...AMBAS, modo: 'basura-que-nadie-escribió' }), 'soloLogo');
});
