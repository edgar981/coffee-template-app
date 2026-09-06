import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARES_FUENTES, PAR_DEFECTO, resolverFuentePar, parDeFuentePar,
  linkFuentePar, linkFuentesTodas, varsDeFuentePar, urlGoogle,
} from './fuentes';

// El SET CERRADO de pares y sus derivados (§ Tanda C2 · #3). Puro; capa 1.

test('el default es Editorial, y NUNCA se guarda: editorial/null/basura → null', () => {
  assert.equal(PAR_DEFECTO.clave, 'editorial');
  assert.equal(resolverFuentePar(null), null);
  assert.equal(resolverFuentePar('editorial'), null);   // Editorial = "sin override", no se guarda
  assert.equal(resolverFuentePar('basura'), null);
  assert.equal(resolverFuentePar(42), null);
});

test('un par CUSTOM válido se respeta', () => {
  for (const c of ['calido', 'moderno', 'clasico', 'nitido'] as const) {
    assert.equal(resolverFuentePar(c), c);
    assert.equal(parDeFuentePar(c).clave, c);
  }
});

test('parDeFuentePar(null) = el default Editorial', () => {
  assert.equal(parDeFuentePar(null).clave, 'editorial');
});

test('Editorial NO lleva <link> (lo cubre el @import); un par CUSTOM sí, con sus 2 familias', () => {
  assert.equal(linkFuentePar(null), null);
  assert.equal(linkFuentePar('editorial'), null);
  const l = linkFuentePar('calido');
  assert.ok(l);
  assert.match(l!, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
  assert.match(l!, /family=Fraunces:wght@400;500;600/);
  assert.match(l!, /family=Nunito\+Sans:wght@300;400;500;600;700/);
  assert.match(l!, /display=swap$/);
});

test('varsDeFuentePar: Editorial/null → {} (cae al fallback); CUSTOM → las 2 vars --sf-fuente-*', () => {
  assert.deepEqual(varsDeFuentePar(null), {});
  assert.deepEqual(varsDeFuentePar('editorial'), {});
  const v = varsDeFuentePar('moderno');
  assert.equal(v['--sf-fuente-titulo'], "'Sora', sans-serif");
  assert.equal(v['--sf-fuente-cuerpo'], "'Inter', sans-serif");
});

test('SORA (no Space Grotesk) es el par Moderno — la tipografía de DUNA no se ofrece', () => {
  const moderno = PARES_FUENTES.find((p) => p.clave === 'moderno')!;
  assert.match(moderno.titulo, /Sora/);
  assert.doesNotMatch(moderno.titulo, /Space Grotesk/i);
  // Ningún par ofrece las 3 fuentes del producto (DUNA): Space Grotesk, Hanken, Spline.
  const todas = PARES_FUENTES.map((p) => `${p.titulo} ${p.cuerpo}`).join(' ');
  assert.doesNotMatch(todas, /Space Grotesk|Hanken|Spline/i);
});

test('linkFuentesTodas: UN link con TODAS las familias, deduplicado (Inter una sola vez)', () => {
  const l = linkFuentesTodas();
  assert.match(l, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
  // Inter aparece en Editorial y Moderno con el mismo peso → una sola vez en el link combinado.
  assert.equal((l.match(/family=Inter:/g) ?? []).length, 1);
  // Están las familias de los 5 pares.
  for (const fam of ['Playfair\\+Display', 'Fraunces', 'Sora', 'Lora', 'Poppins', 'Nunito\\+Sans', 'Source\\+Sans\\+3', 'Work\\+Sans']) {
    assert.match(l, new RegExp(`family=${fam}`));
  }
});

test('urlGoogle arma la css2 con las dos familias del par', () => {
  assert.equal(
    urlGoogle(PAR_DEFECTO),
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap',
  );
});
