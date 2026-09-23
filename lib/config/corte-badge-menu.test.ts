import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  itemsDeMenu,
  type SiteContentData,
  type MenuContent,
} from '@/lib/config/site-content-defaults';
import { CORTE, PRESETS, mergePresetEnContent, validarPreset } from '@/lib/config/themes';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';

// § CORTE-BADGE-COSECHA-EN-MENU-1. El badge de cosecha del prototipo (`.nav-item .badge`,
// `docs/prototipos/cafeone/index.html:27-32`, junto al PRIMER `.nav-item`, "Nuestro café") deja de
// envolver el LOGO (`cromo.navBadge`) y pasa a ser un ATRIBUTO de un ítem del menú:
// `MenuContent.badgeItem`/`.badgeTexto`. `itemsDeMenu` lo resuelve en el ítem cuyo id coincide.
//
// StoreNav.tsx NO se renderiza acá, por la MISMA razón ya medida en `cromo-tematizable.test.ts` y
// `menu-como-dato.test.ts`: usa `usePathname()` (`next/navigation`), que fuera de un árbol real de
// Next.js devuelve `null` y revienta en `pathname.startsWith(...)`. Lo que se afirma acá es la CAPA
// DE DATOS que gobierna a StoreNav byte a byte: `links = itemsDeMenu(content)` es el pass-through
// directo que el nav pinta, con y sin badge — verificar sus salidas es verificar exactamente lo que
// el nav pintaría, sin necesitar el render. Que el badge YA NO envuelve el logo se afirma por
// AUSENCIA de lector: ningún test acá ni en `cromo-tematizable.test.ts` ejercita una rama de
// StoreNav que consuma `cromo.navBadge` para el logo, porque esa rama no existe más en la fuente
// (verificado por lectura del diff de este slice, no por render).
//
// DESVÍO DEL SPEC, medido y reportado en el asiento de este slice: el spec pedía "poné
// `CORTE.navBadge` en vacío". Se midió que `cromo-tematizable.test.ts` (FUERA de `touches:` de
// este slice) afirma `CORTE.navBadge === 'Cosecha 2026'` Y `mergePresetEnContent(_,
// CORTE).cromo.navBadge === 'Cosecha 2026'` — vaciarlo rompía ese archivo sin poder tocarlo. La
// medición contra el test existente ganó: `CORTE.navBadge` se DEJA en `'Cosecha 2026'`, dormido
// (sin lector en `StoreNav.tsx`), y el mecanismo VIVO del badge es enteramente nuevo
// (`menuBadgeItem`/`menuBadgeTexto` → `content.menu.badgeItem`/`.badgeTexto`).

function contenidoConMenu(
  overrides: Partial<MenuContent> = {},
  paginasOverrides: Partial<SiteContentData['paginas']> = {},
): SiteContentData {
  return {
    ...DEFAULTS,
    menu: { ...DEFAULTS.menu, ...overrides },
    paginas: { ...DEFAULTS.paginas, ...paginasOverrides },
  };
}

// ── El modelo: badgeItem/badgeTexto son opcionales, default vacío (byte-idéntico sin fila) ──────

test('REGISTRY.menu.campos declara badgeItem/badgeTexto como opcional (§65-B: si no, se stripean en silencio al guardar)', () => {
  assert.equal(REGISTRY.menu.campos.badgeItem, 'opcional');
  assert.equal(REGISTRY.menu.campos.badgeTexto, 'opcional');
});

test('DEFAULTS.menu.badgeItem/badgeTexto nacen vacíos — ningún ítem lleva badge sin fila', () => {
  assert.equal(DEFAULTS.menu.badgeItem, '');
  assert.equal(DEFAULTS.menu.badgeTexto, '');
});

// ── itemsDeMenu: BYTE-IDÉNTICO sin badge configurado — la invariante del slice ────────────────────

test('sin badgeItem/badgeTexto configurado, itemsDeMenu es byte-idéntico a HOY: ninguna clave `badge` en ningún ítem', () => {
  const links = itemsDeMenu(contenidoConMenu());
  assert.deepEqual(links, [
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
  ]);
  for (const l of links) assert.ok(!('badge' in l), `${l.id} no debe traer la clave badge`);
});

test('resolverSiteContent({}) (sin fila) → itemsDeMenu sin badge — byte-idéntico sin depender de una fila (Nayoli)', () => {
  const links = itemsDeMenu(resolverSiteContent({}));
  for (const l of links) assert.ok(!('badge' in l));
});

// ── itemsDeMenu: el badge sale JUNTO a su ítem, y sólo ahí ───────────────────────────────────────

test('badgeItem+badgeTexto configurado (tienda) → el badge sale SÓLO en ese ítem', () => {
  const content = contenidoConMenu({ badgeItem: 'tienda', badgeTexto: 'Cosecha 2026' });
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'tienda', label: 'Tienda', path: '/tienda', badge: 'Cosecha 2026' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
  ]);
});

test('badgeItem apuntando a OTRO ítem del set (nosotros) → el badge sale ahí, no en tienda', () => {
  const content = contenidoConMenu({ badgeItem: 'nosotros', badgeTexto: 'Edición limitada' });
  const links = itemsDeMenu(content);
  assert.deepEqual(links.find(l => l.id === 'nosotros'), { id: 'nosotros', label: 'Nosotros', path: '/nosotros', badge: 'Edición limitada' });
  assert.ok(!('badge' in links.find(l => l.id === 'tienda')!));
  assert.ok(!('badge' in links.find(l => l.id === 'suscripciones')!));
});

test('badgeItem fuera del set cerrado (dato corrupto por otra vía) → preferir callar, ningún ítem lo recibe', () => {
  const content = contenidoConMenu({ badgeItem: 'inicio', badgeTexto: 'Cosecha 2026' });
  for (const l of itemsDeMenu(content)) assert.ok(!('badge' in l));
});

test('badgeItem SIN badgeTexto (vacío) → sin badge, aunque el ítem exista y esté visible', () => {
  const content = contenidoConMenu({ badgeItem: 'tienda', badgeTexto: '' });
  for (const l of itemsDeMenu(content)) assert.ok(!('badge' in l));
});

test('badgeTexto SIN badgeItem (vacío) → sin badge en ningún ítem', () => {
  const content = contenidoConMenu({ badgeItem: '', badgeTexto: 'Cosecha 2026' });
  for (const l of itemsDeMenu(content)) assert.ok(!('badge' in l));
});

test('badgeItem apuntando a un ítem OCULTO (gateado por paginas.*.visible) → el badge no aparece — preferir callar, mismo criterio que menuCtaHref', () => {
  const content = contenidoConMenu(
    { badgeItem: 'nosotros', badgeTexto: 'Cosecha 2026' },
    { nosotros: { visible: false } },
  );
  const links = itemsDeMenu(content);
  assert.equal(links.find(l => l.id === 'nosotros'), undefined);
  for (const l of links) assert.ok(!('badge' in l));
});

// ── El schema editable — badgeItem del SET CERRADO, badgeTexto texto libre ───────────────────────

test('menu: badgeItem/badgeTexto sobreviven al parse (si no, zod los descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { badgeItem: 'tienda', badgeTexto: 'Cosecha 2026' } });
  assert.deepEqual(parsed.menu, { badgeItem: 'tienda', badgeTexto: 'Cosecha 2026' });
});

test('menu: badgeItem fuera del set cerrado se rechaza (el write es estricto; el resolver SOFT es la red aparte)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { badgeItem: 'inicio' } }));
});

test('menu: badgeItem vacío ("") sobrevive — es el estado "ningún ítem elegido"', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { badgeItem: '' } });
  assert.equal(parsed.menu!.badgeItem, '');
});

test('menu: badgeTexto vacío ("") sobrevive — es el estado "badge apagado"', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { badgeTexto: '' } });
  assert.equal(parsed.menu!.badgeTexto, '');
});

// ── CORTE: el mecanismo VIVO del badge vive en content.menu, no en content.cromo ─────────────────

test('CORTE declara menuBadgeItem/menuBadgeTexto; los otros 5 presets NO (ausentes, no "" )', () => {
  assert.equal(CORTE.menuBadgeItem, 'tienda');
  assert.equal(CORTE.menuBadgeTexto, 'Cosecha 2026');
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.menuBadgeItem, undefined, `${preset.clave} no debe declarar menuBadgeItem`);
    assert.equal(preset.menuBadgeTexto, undefined, `${preset.clave} no debe declarar menuBadgeTexto`);
  }
});

test('mergePresetEnContent(_, CORTE): content.menu lleva el badge en "tienda", preservando labels/posiciones/CTA de hoy', () => {
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, CORTE);
  assert.deepEqual(out.menu, { ...DEFAULTS.menu, badgeItem: 'tienda', badgeTexto: 'Cosecha 2026' });
});

test('mergePresetEnContent: los otros 5 presets dejan content.menu SIN TOCAR — byte-idéntico', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, preset);
    assert.deepEqual(out.menu, DEFAULTS.menu, `${preset.clave} debe dejar content.menu en su default de hoy`);
  }
});

test('itemsDeMenu sobre el content resultante de aplicar CORTE: el badge sale junto a "Tienda", los otros dos ítems intactos', () => {
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, CORTE) as unknown as SiteContentData;
  assert.deepEqual(itemsDeMenu(out), [
    { id: 'tienda', label: 'Tienda', path: '/tienda', badge: 'Cosecha 2026' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
  ]);
});

test('itemsDeMenu sobre el content resultante de aplicar cualquier preset que NO sea CORTE: sin badge — byte-idéntico (Nayoli y los otros presets)', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, preset) as unknown as SiteContentData;
    for (const l of itemsDeMenu(out)) assert.ok(!('badge' in l), `${preset.clave}: ${l.id} no debe traer badge`);
  }
});

test('validarPreset(CORTE) sigue devolviendo [] (completo) — el badge del menú es opcional y no rompe la completitud', () => {
  assert.deepEqual(validarPreset(CORTE), []);
});

// ── El logo ya no lo lee — cromo.navBadge queda DORMIDO, sin vaciarse (§ el desvío de arriba) ────

test('CORTE.navBadge SIGUE en "Cosecha 2026" — dormido, no vaciado (vaciarlo rompía cromo-tematizable.test.ts, fuera de touches: de este slice)', () => {
  assert.equal(CORTE.navBadge, 'Cosecha 2026');
});

test('DEFAULTS.cromo.navBadge sigue vacío — el default de "sin badge en el logo" no cambió', () => {
  assert.equal(DEFAULTS.cromo.navBadge, '');
});
