import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hayLogoImagen, logoParaVariante, altDeLogo, modoLogoResuelto,
  altoLogoNavMovilClase, altoLogoNavEscritorioClase, AIRE_VERTICAL_LOGO_MOVIL_PX,
  altoLogoMenuLateralClase, ALTO_LOGO_MENU_LATERAL_PX,
  colorTaglineAcento, usaColorAcento,
} from './marca-logo';
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

// ── altoLogoNavMovilClase / altoLogoNavEscritorioClase (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1) — el alto
// DERIVADO del logo en 'logoYNombre', nunca un número suelto ───────────────────────────────────

test('altoLogoNavMovilClase: sin CORTE → 40px (64px de barra MENOS 2×aire, § NAV-LOGO-TAMANOS-FINOS-1, corrige NAV-LOGO-MOVIL-CON-AIRE-1)', () => {
  assert.equal(altoLogoNavMovilClase(false), 'h-[40px]');
});

test('altoLogoNavMovilClase: con CORTE → 52/64px (76/88px de barra, § NAV-ALTURA-CON-FILETE-1, MENOS 2×aire)', () => {
  assert.equal(altoLogoNavMovilClase(true), 'h-[52px] min-[640px]:h-[64px]');
});

test('AIRE_VERTICAL_LOGO_MOVIL_PX es 12 — los literales de altoLogoNavMovilClase son 64/76/88 menos 2×12 (24), escritos a mano', () => {
  assert.equal(AIRE_VERTICAL_LOGO_MOVIL_PX, 12);
  assert.equal(64 - 2 * AIRE_VERTICAL_LOGO_MOVIL_PX, 40);
  assert.equal(76 - 2 * AIRE_VERTICAL_LOGO_MOVIL_PX, 52);
  assert.equal(88 - 2 * AIRE_VERTICAL_LOGO_MOVIL_PX, 64);
});

// ── altoLogoMenuLateralClase (§ NAV-LOGO-TAMANOS-FINOS-1) — el literal de la cabecera del menú
// lateral, NO derivado del alto de la barra del header ───────────────────────────────────────────

test('altoLogoMenuLateralClase: 40px, literal fijo — la cabecera del drawer no tiene un alto de barra del que restar aire', () => {
  assert.equal(altoLogoMenuLateralClase(), 'h-[40px]');
});

test('ALTO_LOGO_MENU_LATERAL_PX es 40 — el literal de altoLogoMenuLateralClase lo refleja', () => {
  assert.equal(ALTO_LOGO_MENU_LATERAL_PX, 40);
  assert.equal(altoLogoMenuLateralClase(), `h-[${ALTO_LOGO_MENU_LATERAL_PX}px]`);
});

// ── colorTaglineAcento / usaColorAcento (§ NAV-LOGO-MOVIL-CON-AIRE-1) ───────────────────────────────

test('colorTaglineAcento: variant "dark" (nav flotando sobre el hero oscuro) → --sf-tostado-5 literal (6.26:1 medido contra CORTE tinta, pasa el piso)', () => {
  assert.equal(colorTaglineAcento('dark'), 'text-[var(--sf-tostado-5)]');
});

test('colorTaglineAcento: variant "light" (nav sólido claro) → --sf-acento-texto (2.54:1 de tostado-5 contra fondo/tarjeta FALLA el piso; acento-texto da 15.90:1 en CORTE —resuelve a tinta, origenTexto:\'tinta\'—, el MISMO par de colorActivo)', () => {
  assert.equal(colorTaglineAcento('light'), 'text-[var(--sf-acento-texto)]');
});

test('usaColorAcento: "acento" CON tagline → true', () => {
  assert.equal(usaColorAcento('acento', true), true);
});

test('usaColorAcento: "acento" SIN tagline → false (nada que colorear)', () => {
  assert.equal(usaColorAcento('acento', false), false);
});

test('usaColorAcento: "atenuado" → false, con o sin tagline (el comportamiento de siempre no pasa por acá)', () => {
  assert.equal(usaColorAcento('atenuado', true), false);
  assert.equal(usaColorAcento('atenuado', false), false);
});

test('altoLogoNavEscritorioClase: sin tagline → 24px (h-6) sin importar wordmarkTratado — MEDIDO: el bloque sin tagline renderiza a 22px en los dos casos, porque wordmarkTratado sólo afecta la rama CON tagline', () => {
  assert.equal(altoLogoNavEscritorioClase(false, false), 'min-[1024px]:h-6');
  assert.equal(altoLogoNavEscritorioClase(true, false), 'min-[1024px]:h-6');
});

test('altoLogoNavEscritorioClase: con tagline, SIN tratar → 36px (h-9) — MEDIDO: el bloque renderiza a 35px', () => {
  assert.equal(altoLogoNavEscritorioClase(false, true), 'min-[1024px]:h-9');
});

test('altoLogoNavEscritorioClase: con tagline, TRATADO (wordmarkTratado) → 48px (h-12) — MEDIDO: el bloque renderiza a 45px', () => {
  assert.equal(altoLogoNavEscritorioClase(true, true), 'min-[1024px]:h-12');
});
