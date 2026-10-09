import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGISTRY, bandaOscuraCanonica, bandaUniforme } from './site-content-defaults';
import { LABEL_COMPOSICION_HERO, ZONAS_COMPOSICION_HERO } from '@/components/admin/tienda-secciones';
import { CATALOGO_MOVIMIENTO, movimientoPorId, catalogoMovimientoDeElemento } from '../movimiento/catalogo';

// § MOVIMIENTO-NIVEL-FIRMA-1 — el REGISTRO de las composiciones del hero (REGISTRY.hero.variantes
// ↔ el editor ↔ el catálogo de movimiento), para que las TRES listas que describen el mismo
// conjunto —`REGISTRY.hero.variantes.claves` (site-content-defaults.ts), `LABEL_COMPOSICION_HERO`/
// `ZONAS_COMPOSICION_HERO` (tienda-secciones.ts) y `CATALOGO_MOVIMIENTO` (lib/movimiento/
// catalogo.ts)— no puedan divergir en silencio (§ CLAUDE.md, "cuando dos declaraciones describen el
// mismo conjunto, o una DERIVA de la otra o hay un TEST").

test('LABEL_COMPOSICION_HERO/ZONAS_COMPOSICION_HERO: una entrada EXACTA por cada clave de REGISTRY.hero.variantes.claves, ni una de más ni de menos', () => {
  const claves = new Set(REGISTRY.hero.variantes!.claves);
  assert.deepEqual(new Set(Object.keys(LABEL_COMPOSICION_HERO)), claves);
  assert.deepEqual(new Set(Object.keys(ZONAS_COMPOSICION_HERO)), claves);
});

test('ZONAS_COMPOSICION_HERO: cada composición trae al menos Titular/Subtítulo/Botones, nombres no vacíos', () => {
  for (const [valor, zonas] of Object.entries(ZONAS_COMPOSICION_HERO)) {
    const labels = zonas.map((z) => z.label);
    assert.ok(labels.includes('Titular'), `"${valor}" sin zona Titular`);
    assert.ok(labels.includes('Subtítulo'), `"${valor}" sin zona Subtítulo`);
    assert.ok(labels.includes('Botones'), `"${valor}" sin zona Botones`);
  }
});

// § MOVIMIENTO-NIVEL-FIRMA-1 — las tres composiciones de FIRMA: "grano"/"cereza" son ilustración
// PURA (sin zona "Fondo" — no hay foto que subir); "paisaje" SÍ gana "Fondo" (lee `hero.imagen`,
// opcional: con ella hace parallax sobre la foto real, sin ella cae a la ilustración de montañas).
test('"grano"/"cereza": sin zona de Fondo (ilustración pura, sin hero.imagen)', () => {
  for (const valor of ['grano', 'cereza']) {
    const labels = ZONAS_COMPOSICION_HERO[valor]!.map((z) => z.label);
    assert.ok(!labels.some((l) => l.includes('Fondo')), `"${valor}" no debería ofrecer Fondo`);
  }
});

test('"paisaje": SÍ gana zona de Fondo (foto/video opcional)', () => {
  const labels = ZONAS_COMPOSICION_HERO.paisaje!.map((z) => z.label);
  assert.ok(labels.some((l) => l.includes('Fondo')), 'paisaje debe ofrecer Fondo');
});

// § MOVIMIENTO-NIVEL-FIRMA-1 — H01/H02/H03 pasan de un eje `animacion` (aplicaA:'hero', que
// `catalogoMovimientoDeElemento('hero')` listaba vacío) a ser composiciones de `hero.variante`. El
// catálogo sigue siendo la fuente de nombre/descripción/nivel; esto afirma que los TRES siguen con
// motor y con su clase `revelado` (el botón «Ver animación» del editor, § VerAnimacionHero.tsx).
test('H01/H02/H03: implementada, aplicaA:"hero", clases scrub+revelado (pin+scrub con estado final reproducible)', () => {
  for (const id of ['H01', 'H02', 'H03']) {
    const d = movimientoPorId(id);
    assert.equal(d?.implementada, true, `${id} debe tener motor`);
    assert.equal(d?.aplicaA, 'hero', `${id} debe aplicar a 'hero'`);
    assert.ok(d?.clases.includes('scrub'), `${id} debe ser scrub`);
    assert.ok(d?.clases.includes('revelado'), `${id} debe poder reproducirse una vez`);
  }
  assert.deepEqual(catalogoMovimientoDeElemento('hero').map((d) => d.id), ['H01', 'H02', 'H03']);
});

test('CTA01: implementada, aplicaA:"seccion" (nace incorporado en el tipo "cierre", como S02 en "proceso")', () => {
  const d = movimientoPorId('CTA01');
  assert.equal(d?.implementada, true);
  assert.equal(d?.aplicaA, 'seccion');
  assert.ok(d?.clases.includes('scrub'));
  assert.ok(d?.clases.includes('revelado'));
});

test('CATALOGO_MOVIMIENTO: ningún id de nivel "firma" quedó sin motor tras este slice', () => {
  const firma = CATALOGO_MOVIMIENTO.filter((d) => d.nivel === 'firma');
  assert.ok(firma.length > 0);
  for (const d of firma) assert.equal(d.implementada, true, `${d.id} (firma) sin motor`);
});

// § MOVIMIENTO-NIVEL-FIRMA-1 — los tres héroes de FIRMA son UN SOLO PLANO de media (oscuros,
// uniformes) — ver el docstring de `REGISTRY.hero.variantes` (site-content-defaults.ts) para el
// porqué. Redundante A PROPÓSITO con `site-content-defaults.test.ts` (ese archivo lo afirma vía
// `resolverSiteContent`; éste lo afirma como parte del REGISTRO de composiciones, el eje de este
// archivo) — las dos vistas del mismo hecho, no dos definiciones que puedan divergir: ambas llaman
// a la MISMA función (`bandaOscuraCanonica`/`bandaUniforme`).
test('"grano"/"cereza"/"paisaje" son oscuros y uniformes, como curtina/media/sticky', () => {
  for (const variante of ['grano', 'cereza', 'paisaje']) {
    assert.equal(bandaOscuraCanonica('hero', variante), true, `${variante} debe ser oscura`);
    assert.equal(bandaUniforme('hero', variante), true, `${variante} debe ser uniforme`);
  }
});
