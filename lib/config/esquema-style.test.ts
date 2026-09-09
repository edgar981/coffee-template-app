import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esquemaStyle, bandaEsOscura } from './esquema-style';
import { RAICES_DEFECTO, derivarEsquema, contraste } from './palette-derive';
import { BANDA_IDS, BANDAS_OSCURAS, type EsquemasContent } from './site-content-defaults';

// Capa 1 del PUENTE banda→esquema (§ eje 5b, mitad B). Sin base — lógica pura.

test('esquemaStyle: sin esquema (null/undefined) → {} — CERO vars locales (byte-identidad: la banda cae a su fallback de clase)', () => {
  assert.deepEqual(esquemaStyle(null, null, null, null), {});
  assert.deepEqual(esquemaStyle(undefined, null, null, null), {});
});

test('esquemaStyle: con esquema, emite exactamente las 6 vars que un esquema mueve (§ home-2: + sobre-banda/-suave)', () => {
  const s = esquemaStyle('oscuro', null, null, null);
  assert.deepEqual(
    Object.keys(s).sort(),
    ['--sf-banda', '--sf-linea-sobre', '--sf-sobre', '--sf-sobre-banda', '--sf-sobre-banda-suave', '--sf-tarjeta'],
  );
});

test('esquemaStyle: los valores emitidos SON los de `derivarEsquema` (mismo motor, sin redefinir la derivación)', () => {
  const p = derivarEsquema(RAICES_DEFECTO, 'acento');
  const s = esquemaStyle('acento', null, null, null);
  assert.deepEqual(s, {
    '--sf-banda': p.fondo,
    '--sf-tarjeta': p.tarjeta,
    '--sf-sobre': p.sobre,
    '--sf-linea-sobre': p.linea,
    '--sf-sobre-banda': p.texto,
    '--sf-sobre-banda-suave': p['texto-suave'],
  });
});

// ── --sf-sobre-banda(-suave): texto DIRECTO sobre la banda, no sobre la tarjeta (§ home-2) ──────
// El hueco medido que esta pasada cierra: `--sf-sobre` está floreado contra la TARJETA (buen
// margen en 3/4 esquemas por coincidencia — tarjeta ≈ banda ±10% — pero FALLA en 'crema' porque el
// sobre de esa rama es el blanco fijo de hoy, no un auto-flip). `--sf-sobre-banda` reusa
// `texto`/`texto-suave`, que SIEMPRE están floreados contra el fondo de la banda misma.

test('esquemaStyle: --sf-sobre-banda(-suave) ≥4.5:1 contra --sf-banda en LOS 4 ESQUEMAS (el peor caso, "crema", incluido)', () => {
  for (const id of ['crema', 'superficie', 'oscuro', 'acento'] as const) {
    const s = esquemaStyle(id, null, null, null);
    assert.ok(
      contraste(s['--sf-sobre-banda'], s['--sf-banda']) >= 4.5,
      `${id}: --sf-sobre-banda debe leerse sobre --sf-banda`,
    );
    assert.ok(
      contraste(s['--sf-sobre-banda-suave'], s['--sf-banda']) >= 4.5,
      `${id}: --sf-sobre-banda-suave debe leerse sobre --sf-banda`,
    );
  }
});

test('esquemaStyle: --sf-sobre (tarjeta-scoped) NO alcanza 4.5:1 contra --sf-banda con "crema" — por eso existe --sf-sobre-banda', () => {
  // Regresión documentada: si alguien "simplificara" reusando --sf-sobre para texto-sobre-banda,
  // este caso (medido 1.07:1) lo delata.
  const s = esquemaStyle('crema', null, null, null);
  assert.ok(contraste(s['--sf-sobre'], s['--sf-banda']) < 4.5);
});

test('esquemaStyle: crema es EXACTO al output de `derivarPaleta` (tarjeta/sobre = #ffffff, byte-idéntico al literal de hoy)', () => {
  const s = esquemaStyle('crema', null, null, null);
  assert.equal(s['--sf-tarjeta'], '#ffffff');
  assert.equal(s['--sf-sobre'], '#ffffff');
  assert.equal(s['--sf-banda'], RAICES_DEFECTO.fondo);
});

test('esquemaStyle: raíces null (fábrica) cae a RAICES_DEFECTO — mismas raíces que el resto del motor', () => {
  const conNull = esquemaStyle('oscuro', null, null, null);
  const conDefecto = esquemaStyle('oscuro', RAICES_DEFECTO.fondo, RAICES_DEFECTO.tinta, RAICES_DEFECTO.acento);
  assert.deepEqual(conNull, conDefecto);
});

test('esquemaStyle: raíces CUSTOM (no-null) se usan tal cual, no caen a RAICES_DEFECTO', () => {
  const s = esquemaStyle('crema', '#f0f0f0', '#101010', '#123456');
  assert.equal(s['--sf-banda'], '#f0f0f0');
});

// ── bandaEsOscura: el nav ─────────────────────────────────────────────────────
// (era `heroEsOscuro`, ESPECÍFICA del hero — generalizada en EJE-5-ORDEN-NAV-CANONICA porque
// `orden[0]` ya no es necesariamente 'hero'. § site-content-defaults.ts, `BANDAS_OSCURAS`.)

test('bandaEsOscura: hero SIN esquema asignado (mapa vacío, o sin entrada para "hero") → true — byte-idéntico al `isHome && !scrolled` de hoy', () => {
  assert.equal(bandaEsOscura('hero', {}, null, null, null), true);
  assert.equal(bandaEsOscura('hero', { testimonials: 'oscuro' }, null, null, null), true);
});

test('bandaEsOscura: hero con esquema OSCURO (fondo = raíz tinta) → true', () => {
  assert.equal(bandaEsOscura('hero', { hero: 'oscuro' }, null, null, null), true);
});

test('bandaEsOscura: hero con esquema CLARO (crema/superficie) → false — el esquema manda sobre la canónica', () => {
  assert.equal(bandaEsOscura('hero', { hero: 'crema' }, null, null, null), false);
  assert.equal(bandaEsOscura('hero', { hero: 'superficie' }, null, null, null), false);
});

test('bandaEsOscura: esquema ACENTO sigue la luminancia REAL del acento del cliente, no el nombre del esquema', () => {
  // El acento de Nayoli (#8b4513) es oscuro → 'acento' da una banda oscura, como 'oscuro'.
  assert.equal(bandaEsOscura('hero', { hero: 'acento' }, null, null, null), true);
  // Un acento CLARO (un cliente con acento pastel) da una banda clara con el MISMO esquema 'acento'.
  assert.equal(bandaEsOscura('hero', { hero: 'acento' }, '#faf7f4', '#1a0f08', '#f5e6c8'), false);
});

// ── La CANÓNICA por banda (sin esquema): la mina que este slice desactiva ────────────────────────
// Antes de esta pasada, `heroEsOscuro` asumía SIEMPRE la canónica del HERO para CUALQUIER banda
// —correcto sólo mientras `orden[0]` era necesariamente 'hero'—. Visto fallar contra ese default
// viejo (comportamiento "todo-oscuro"): con `bandaFondo` fijo en `raices.tinta` sin importar la
// banda, TODA banda sin esquema —incluidas las canónicamente CLARAS— daba `true`.

test('bandaEsOscura: CADA banda del home, SIN esquema, da exactamente su canónica declarada en BANDAS_OSCURAS', () => {
  for (const bandaId of BANDA_IDS) {
    const esperado = BANDAS_OSCURAS.has(bandaId);
    assert.equal(
      bandaEsOscura(bandaId, {}, null, null, null),
      esperado,
      `${bandaId} debe dar ${esperado ? 'oscura' : 'clara'}`,
    );
  }
});

test('bandaEsOscura: las bandas OSCURAS canónicas son exactamente hero/brandStory/subscriptionCTA (el resto, claras)', () => {
  assert.deepEqual([...BANDAS_OSCURAS].sort(), ['brandStory', 'hero', 'subscriptionCTA']);
  for (const bandaId of BANDA_IDS) {
    if (!BANDAS_OSCURAS.has(bandaId)) assert.equal(bandaEsOscura(bandaId, {}, null, null, null), false);
  }
});

test('bandaEsOscura: una banda CLARA sin su propio esquema no se contagia del esquema de OTRA banda', () => {
  assert.equal(bandaEsOscura('featured', { hero: 'oscuro' }, null, null, null), false);
});

test('bandaEsOscura: el esquema asignado SIEMPRE manda sobre la canónica, en las dos direcciones', () => {
  // canónica CLARA + esquema oscuro → oscura
  assert.equal(bandaEsOscura('featured', { featured: 'oscuro' }, null, null, null), true);
  // canónica OSCURA + esquema crema → clara
  assert.equal(bandaEsOscura('brandStory', { brandStory: 'crema' }, null, null, null), false);
});
