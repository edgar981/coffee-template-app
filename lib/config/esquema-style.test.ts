import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esquemaStyle, bandaEsOscura, tratamientoNav } from './esquema-style';
import { RAICES_DEFECTO, derivarEsquema, contraste } from './palette-derive';
import { BANDA_IDS, BANDAS_OSCURAS, type EsquemasContent } from './site-content-defaults';

// Capa 1 del PUENTE banda→esquema (§ eje 5b, mitad B). Sin base — lógica pura.

test('esquemaStyle: sin esquema (null/undefined) → {} — CERO vars locales (byte-identidad: la banda cae a su fallback de clase)', () => {
  assert.deepEqual(esquemaStyle(null, null, null, null), {});
  assert.deepEqual(esquemaStyle(undefined, null, null, null), {});
});

test('esquemaStyle: con esquema, emite exactamente las 8 vars que un esquema mueve (§ home-2 + § TEMAS-P6-FAMILIAS-1: + sobre-tarjeta/-suave)', () => {
  const s = esquemaStyle('oscuro', null, null, null);
  assert.deepEqual(
    Object.keys(s).sort(),
    ['--sf-banda', '--sf-linea-sobre', '--sf-sobre', '--sf-sobre-banda', '--sf-sobre-banda-suave', '--sf-sobre-tarjeta', '--sf-sobre-tarjeta-suave', '--sf-tarjeta'],
  );
});

test('esquemaStyle: los valores emitidos SON los de `derivarEsquema` (mismo motor, sin redefinir la derivación)', () => {
  const p = derivarEsquema(RAICES_DEFECTO, 'acento');
  const s = esquemaStyle('acento', null, null, null);
  assert.deepEqual(s, {
    '--sf-banda': p.fondo,
    '--sf-tarjeta': p.tarjeta,
    '--sf-sobre': p.sobre,
    '--sf-sobre-tarjeta': p['sobre-tarjeta'],
    '--sf-sobre-tarjeta-suave': p['sobre-tarjeta-suave'],
    '--sf-linea-sobre': p.linea,
    '--sf-sobre-banda': p.texto,
    '--sf-sobre-banda-suave': p['texto-suave'],
  });
});

// ── --sf-sobre-tarjeta(-suave): el PAR de la familia tarjeta (§ TEMAS-P6-FAMILIAS-1) ─────────────
// El hueco medido: los consumidores (ProductCard, SuscripcionPlanes, TestimonialSection) leían
// tokens RAÍZ (`--sf-tinta`/`--sf-acento-texto`) dentro de `bg-[var(--sf-tarjeta)]`, sin florear
// contra ELLA. `--sf-sobre` (ya existente) no sirve de reemplazo: es OTRO rol (texto-sobre-tinta,
// usado en footer/botones/nav) y queda degenerado en 'crema' (ver el test de abajo).

test('esquemaStyle: --sf-sobre-tarjeta(-suave) ≥4.5:1 contra --sf-tarjeta en LOS 4 ESQUEMAS (el peor caso, "crema", incluido)', () => {
  for (const id of ['crema', 'superficie', 'oscuro', 'acento'] as const) {
    const s = esquemaStyle(id, null, null, null);
    assert.ok(
      contraste(s['--sf-sobre-tarjeta'], s['--sf-tarjeta']) >= 4.5,
      `${id}: --sf-sobre-tarjeta debe leerse sobre --sf-tarjeta`,
    );
    assert.ok(
      contraste(s['--sf-sobre-tarjeta-suave'], s['--sf-tarjeta']) >= 4.5,
      `${id}: --sf-sobre-tarjeta-suave debe leerse sobre --sf-tarjeta`,
    );
  }
});

test('esquemaStyle: --sf-sobre (el token VIEJO) NO alcanza 4.5:1 contra --sf-tarjeta con "crema" — por eso --sf-sobre-tarjeta no lo reusa', () => {
  // Regresión documentada: si alguien "simplificara" reusando --sf-sobre para texto-sobre-tarjeta,
  // este caso (medido 1:1, blanco sobre tarjeta blanca) lo delata.
  const s = esquemaStyle('crema', null, null, null);
  assert.ok(contraste(s['--sf-sobre'], s['--sf-tarjeta']) < 4.5);
  assert.ok(contraste(s['--sf-sobre-tarjeta'], s['--sf-tarjeta']) >= 4.5, 'el par nuevo sí pasa donde el viejo no');
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
//
// La firma ganó el 2º parámetro `variante` en EJE-5-VARIANTES-HERO (§ abajo). Estos tests
// pre-existentes pasan `undefined` donde la banda de la prueba no varía por composición (todas salvo
// el hero, y el propio hero en su forma canónica) — es EXACTAMENTE lo que StoreNav envía cuando
// `varianteDeBanda` no encuentra sección (bandas estructurales) o la banda resuelve a su canónica.

test('bandaEsOscura: hero SIN esquema asignado (mapa vacío, o sin entrada para "hero") → true — byte-idéntico al `isHome && !scrolled` de hoy', () => {
  assert.equal(bandaEsOscura('hero', undefined, {}, null, null, null), true);
  assert.equal(bandaEsOscura('hero', undefined, { testimonials: 'oscuro' }, null, null, null), true);
});

test('bandaEsOscura: hero con esquema OSCURO (fondo = raíz tinta) → true', () => {
  assert.equal(bandaEsOscura('hero', undefined, { hero: 'oscuro' }, null, null, null), true);
});

test('bandaEsOscura: hero con esquema CLARO (crema/superficie) → false — el esquema manda sobre la canónica', () => {
  assert.equal(bandaEsOscura('hero', undefined, { hero: 'crema' }, null, null, null), false);
  assert.equal(bandaEsOscura('hero', undefined, { hero: 'superficie' }, null, null, null), false);
});

test('bandaEsOscura: esquema ACENTO sigue la luminancia REAL del acento del cliente, no el nombre del esquema', () => {
  // El acento de Nayoli (#8b4513) es oscuro → 'acento' da una banda oscura, como 'oscuro'.
  assert.equal(bandaEsOscura('hero', undefined, { hero: 'acento' }, null, null, null), true);
  // Un acento CLARO (un cliente con acento pastel) da una banda clara con el MISMO esquema 'acento'.
  assert.equal(bandaEsOscura('hero', undefined, { hero: 'acento' }, '#faf7f4', '#1a0f08', '#f5e6c8'), false);
});

// ── La CANÓNICA por banda (sin esquema): la mina que este slice desactiva ────────────────────────
// Antes de esta pasada, `heroEsOscuro` asumía SIEMPRE la canónica del HERO para CUALQUIER banda
// —correcto sólo mientras `orden[0]` era necesariamente 'hero'—. Visto fallar contra ese default
// viejo (comportamiento "todo-oscuro"): con `bandaFondo` fijo en `raices.tinta` sin importar la
// banda, TODA banda sin esquema —incluidas las canónicamente CLARAS— daba `true`.

test('bandaEsOscura: CADA banda del home, SIN esquema y SIN variante, da exactamente su canónica declarada en BANDAS_OSCURAS', () => {
  for (const bandaId of BANDA_IDS) {
    const esperado = BANDAS_OSCURAS.has(bandaId);
    assert.equal(
      bandaEsOscura(bandaId, undefined, {}, null, null, null),
      esperado,
      `${bandaId} debe dar ${esperado ? 'oscura' : 'clara'}`,
    );
  }
});

test('bandaEsOscura: las bandas OSCURAS canónicas son exactamente hero/brandStory/subscriptionCTA (el resto, claras)', () => {
  assert.deepEqual([...BANDAS_OSCURAS].sort(), ['brandStory', 'hero', 'subscriptionCTA']);
  for (const bandaId of BANDA_IDS) {
    if (!BANDAS_OSCURAS.has(bandaId)) assert.equal(bandaEsOscura(bandaId, undefined, {}, null, null, null), false);
  }
});

test('bandaEsOscura: una banda CLARA sin su propio esquema no se contagia del esquema de OTRA banda', () => {
  assert.equal(bandaEsOscura('featured', undefined, { hero: 'oscuro' }, null, null, null), false);
});

test('bandaEsOscura: el esquema asignado SIEMPRE manda sobre la canónica, en las dos direcciones', () => {
  // canónica CLARA + esquema oscuro → oscura
  assert.equal(bandaEsOscura('featured', undefined, { featured: 'oscuro' }, null, null, null), true);
  // canónica OSCURA + esquema crema → clara
  assert.equal(bandaEsOscura('brandStory', undefined, { brandStory: 'crema' }, null, null, null), false);
});

// ── bandaEsOscura VARIANT-AWARE (§ EJE-5-VARIANTES-HERO) — la MINA que este slice desactiva ──────
// El hero ganó una SEGUNDA variante ('ficha', CLARA) y `orden[0]` ya no garantiza 'curtina' (oscura).
// Sin el parámetro `variante`, un hero·ficha primero-y-sin-esquema daría "oscura" (heredado del set
// `BANDAS_OSCURAS`) y el nav quedaría con texto claro sobre banda clara.

test('bandaEsOscura: hero·ficha SIN esquema → false (clara) — VISTO FALLAR sin variant-aware (daría oscura, heredado de BANDAS_OSCURAS)', () => {
  assert.equal(bandaEsOscura('hero', 'ficha', {}, null, null, null), false);
});

test('bandaEsOscura: hero·curtina SIN esquema → true (oscura, la canónica de Nayoli)', () => {
  assert.equal(bandaEsOscura('hero', 'curtina', {}, null, null, null), true);
});

test('bandaEsOscura: hero con variante AUSENTE (undefined) SIN esquema → true (byte-idéntico a curtina)', () => {
  assert.equal(bandaEsOscura('hero', undefined, {}, null, null, null), true);
});

test('bandaEsOscura: una banda CLARA sin variante propia (trustBadges) sigue clara sin importar qué `variante` se le pase', () => {
  assert.equal(bandaEsOscura('trustBadges', undefined, {}, null, null, null), false);
  assert.equal(bandaEsOscura('trustBadges', 'ficha', {}, null, null, null), false); // ignorada: sólo el hero bifurca
});

test('bandaEsOscura: CON esquema asignado, la variante se IGNORA — el esquema decide para las DOS variantes del hero', () => {
  // Banda CLARA (featured) + esquema 'oscuro' → oscura, la variante da igual.
  assert.equal(bandaEsOscura('featured', 'ficha', { featured: 'oscuro' }, null, null, null), true);
  assert.equal(bandaEsOscura('featured', undefined, { featured: 'oscuro' }, null, null, null), true);
  // Banda OSCURA (hero) + esquema 'crema' → clara, para las DOS variantes.
  assert.equal(bandaEsOscura('hero', 'curtina', { hero: 'crema' }, null, null, null), false);
  assert.equal(bandaEsOscura('hero', 'ficha', { hero: 'crema' }, null, null, null), false);
});

// ── tratamientoNav (§ EJE-5-NAV-UNIFORME) — UNA regla: flotante (uniformidad) + textoClaro (darkness) ─
// Corrige la SUPOSICIÓN de que la primera banda siempre admite un nav transparente-flotante. El gate
// visual del owner encontró el nav ilegible sobre la ficha (bi-tonal): ningún color de texto único
// se lee sobre las dos mitades.

test('tratamientoNav: hero·ficha SIN esquema → {flotante:false, textoClaro:false} — el FIX. VISTO FALLAR sin uniformidad: heredaría {flotante:true, textoClaro:false} (el bug del gate, nav transparente sobre foto)', () => {
  assert.deepEqual(tratamientoNav('hero', 'ficha', {}, null, null, null), { flotante: false, textoClaro: false });
});

test('tratamientoNav: hero·curtina SIN esquema → {flotante:true, textoClaro:true} — byte-idéntico al `isHome && !scrolled` de HOY (Nayoli)', () => {
  assert.deepEqual(tratamientoNav('hero', 'curtina', {}, null, null, null), { flotante: true, textoClaro: true });
});

test('tratamientoNav: una banda clara UNIFORME (trustBadges, sin sección/variantes) → {flotante:true, textoClaro:false}', () => {
  assert.deepEqual(tratamientoNav('trustBadges', undefined, {}, null, null, null), { flotante: true, textoClaro: false });
});

test('tratamientoNav: una banda + esquema "oscuro" → {flotante:true, textoClaro:true} — el esquema manda sobre la canónica, la uniformidad no depende de él', () => {
  assert.deepEqual(
    tratamientoNav('featured', undefined, { featured: 'oscuro' }, null, null, null),
    { flotante: true, textoClaro: true },
  );
});

test('tratamientoNav: hero·ficha CON esquema sigue SIN flotar — la uniformidad es del LAYOUT, un esquema no une las dos mitades partidas', () => {
  assert.deepEqual(
    tratamientoNav('hero', 'ficha', { hero: 'oscuro' }, null, null, null),
    { flotante: false, textoClaro: false },
  );
});
