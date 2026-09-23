import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  resolverOrdenMenu,
  labelDeItemMenu,
  itemsDeMenu,
  menuCtaHref,
  MENU_ITEM_IDS,
  MENU_CTA_DESTINOS,
  type SiteContentData,
  type MenuContent,
} from '@/lib/config/site-content-defaults';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';

// § CROMO-MENU-COMO-DATO-1. El menú del nav (`StoreNav.tsx`) deja de ser un array literal de items
// conocidos con etiqueta y ruta fijas: la ETIQUETA y el ORDEN pasan a ser DATO editable, sobre un
// SET CERRADO de tres ítems (`MENU_ITEM_IDS`) cuyas rutas siguen siendo ESTRUCTURA — y gana un CTA
// opcional con destino del set cerrado `MENU_CTA_DESTINOS`. `paginas.*.visible` sigue gateando
// "Suscripciones"/"Nosotros" SIN CAMBIO (renombrar no es encender).
//
// StoreNav.tsx NO se renderiza acá, por la MISMA razón ya medida y documentada en
// `cromo-tematizable.test.ts`: usa `usePathname()` (`next/navigation`), que fuera de un árbol real
// de Next.js devuelve `null` y no `'/'`, y revienta en `pathname.startsWith(...)` — una línea AJENA
// a este slice. Lo que se afirma acá es la CAPA DE DATOS que gobierna a StoreNav byte a byte:
// `links = itemsDeMenu(content)` y `ctaHref = menuCtaHref(content)` son pass-through directos, así
// que verificar sus salidas es verificar exactamente lo que el nav va a pintar, sin necesitar el
// render del componente (§ CLAUDE.md, "los tests de COMPONENTE necesitan jsdom, que el repo no
// tiene").

const MENU_HOY: Omit<MenuContent, 'visible'> = {
  labelTienda: 'Tienda',
  labelSuscripciones: 'Suscripciones',
  labelNosotros: 'Nosotros',
  posicion1: 'tienda',
  posicion2: 'suscripciones',
  posicion3: 'nosotros',
  ctaLabel: '',
  ctaDestino: '',
  badgeItem: '',
  badgeTexto: '',
};

const LINKS_HOY = [
  { id: 'tienda', label: 'Tienda', path: '/tienda' },
  { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
  { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
];

// ── El SET CERRADO — declarado una vez, sin agregar/quitar ítems ────────────────────────────────

test('MENU_ITEM_IDS: los TRES ítems conocidos, en el orden canónico de HOY', () => {
  assert.deepEqual(MENU_ITEM_IDS, ['tienda', 'suscripciones', 'nosotros']);
});

test('MENU_CTA_DESTINOS: el set cerrado de destinos del CTA, las tres rutas del menú', () => {
  assert.deepEqual(MENU_CTA_DESTINOS, ['/tienda', '/suscripciones', '/nosotros']);
});

// ── DEFAULTS.menu / REGISTRY.menu — el modelo ───────────────────────────────────────────────────

test('DEFAULTS.menu es el menú de HOY: labels de hoy, orden de hoy, CTA apagado', () => {
  assert.deepEqual(DEFAULTS.menu, { visible: true, ...MENU_HOY });
});

test('REGISTRY.menu: ocultable:false (como el hero — no se apaga entero) y los 10 campos declarados', () => {
  assert.equal(REGISTRY.menu.ocultable, false);
  assert.deepEqual(Object.keys(REGISTRY.menu.campos).sort(), [
    'badgeItem', 'badgeTexto', 'ctaDestino', 'ctaLabel', 'labelNosotros', 'labelSuscripciones', 'labelTienda',
    'posicion1', 'posicion2', 'posicion3',
  ]);
});

// ── resolverOrdenMenu — SOFT, siempre completo, basura → canónica (gemela de resolverOrden) ─────

test('resolverOrdenMenu: las 3 posiciones de HOY → el orden de hoy', () => {
  assert.deepEqual(resolverOrdenMenu(['tienda', 'suscripciones', 'nosotros']), ['tienda', 'suscripciones', 'nosotros']);
});

test('resolverOrdenMenu: vacío/basura/null/undefined → la canónica completa', () => {
  assert.deepEqual(resolverOrdenMenu([]), ['tienda', 'suscripciones', 'nosotros']);
  assert.deepEqual(resolverOrdenMenu(['', '', '']), ['tienda', 'suscripciones', 'nosotros']);
  assert.deepEqual(resolverOrdenMenu(['banana', null, undefined]), ['tienda', 'suscripciones', 'nosotros']);
});

test('resolverOrdenMenu: un orden EDITADO (nosotros primero) se respeta', () => {
  assert.deepEqual(resolverOrdenMenu(['nosotros', 'tienda', 'suscripciones']), ['nosotros', 'tienda', 'suscripciones']);
});

test('resolverOrdenMenu: una posición DUPLICADA — la primera ocurrencia gana, la repetida se descarta y el resto se completa canónico', () => {
  assert.deepEqual(resolverOrdenMenu(['nosotros', 'nosotros', 'tienda']), ['nosotros', 'tienda', 'suscripciones']);
});

test('resolverOrdenMenu: PARCIAL (una sola posición válida) se completa con las canónicas restantes, en orden canónico', () => {
  assert.deepEqual(resolverOrdenMenu(['nosotros']), ['nosotros', 'tienda', 'suscripciones']);
});

// ── labelDeItemMenu ───────────────────────────────────────────────────────────────────────────

test('labelDeItemMenu: devuelve el campo correcto por id', () => {
  const menu: MenuContent = { visible: true, ...MENU_HOY, labelTienda: 'Nuestro café', labelNosotros: 'La finca' };
  assert.equal(labelDeItemMenu(menu, 'tienda'), 'Nuestro café');
  assert.equal(labelDeItemMenu(menu, 'suscripciones'), 'Suscripciones');
  assert.equal(labelDeItemMenu(menu, 'nosotros'), 'La finca');
});

// ── itemsDeMenu — LA INVARIANTE: sin editar nada, el menú de HOY exacto ─────────────────────────

function contenidoConMenu(overrides: Partial<MenuContent> = {}, paginasOverrides: Partial<SiteContentData['paginas']> = {}): SiteContentData {
  return {
    ...DEFAULTS,
    menu: { ...DEFAULTS.menu, ...overrides },
    paginas: { ...DEFAULTS.paginas, ...paginasOverrides },
  };
}

test('INVARIANTE: un tenant que no edita nada rinde el MISMO menú que hoy — mismas etiquetas, mismo orden, sin CTA', () => {
  const content = contenidoConMenu();
  assert.deepEqual(itemsDeMenu(content), LINKS_HOY);
  assert.equal(menuCtaHref(content), null);
});

test('resolverSiteContent({}).menu (sin fila) → itemsDeMenu da el menú de hoy — byte-idéntico sin depender de una fila', () => {
  const content = resolverSiteContent({});
  assert.deepEqual(itemsDeMenu(content), LINKS_HOY);
  assert.equal(menuCtaHref(content), null);
});

test('EDITAR una etiqueta se refleja en itemsDeMenu, sin tocar las otras ni el orden', () => {
  const content = contenidoConMenu({ labelTienda: 'Nuestro café' });
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'tienda', label: 'Nuestro café', path: '/tienda' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
  ]);
});

test('EDITAR el orden se respeta en itemsDeMenu (nosotros primero, tienda al final)', () => {
  const content = contenidoConMenu({ posicion1: 'nosotros', posicion2: 'suscripciones', posicion3: 'tienda' });
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
  ]);
});

test('VISIBILIDAD se queda como hoy: suscripciones apagada → desaparece de itemsDeMenu, sin importar su label/posición', () => {
  const content = contenidoConMenu(
    { labelSuscripciones: 'Suscríbete ya' },
    { suscripciones: { visible: false } },
  );
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
  ]);
});

test('VISIBILIDAD se queda como hoy: nosotros apagada → desaparece de itemsDeMenu', () => {
  const content = contenidoConMenu({}, { nosotros: { visible: false } });
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
  ]);
});

test('tienda NUNCA se gatea por página (no tiene una que apagar) — sigue apareciendo aunque las otras dos estén apagadas', () => {
  const content = contenidoConMenu({}, { suscripciones: { visible: false }, nosotros: { visible: false } });
  assert.deepEqual(itemsDeMenu(content), [{ id: 'tienda', label: 'Tienda', path: '/tienda' }]);
});

// ── menuCtaHref — el CTA sobre el SET CERRADO, preferir callar a un link roto ───────────────────

test('CTA con label y destino válido → el href', () => {
  const content = contenidoConMenu({ ctaLabel: 'Escríbenos', ctaDestino: '/tienda' });
  assert.equal(menuCtaHref(content), '/tienda');
});

test('CTA sin label (destino puesto igual) → null — un botón sin texto no se muestra', () => {
  const content = contenidoConMenu({ ctaLabel: '', ctaDestino: '/tienda' });
  assert.equal(menuCtaHref(content), null);
});

test('CTA con label pero SIN destino (default) → null', () => {
  const content = contenidoConMenu({ ctaLabel: 'Escríbenos' });
  assert.equal(menuCtaHref(content), null);
});

test('CTA con destino FUERA del set cerrado (basura llegada por otra vía) → null, nunca un link roto', () => {
  const content = contenidoConMenu({ ctaLabel: 'Escríbenos', ctaDestino: 'https://wa.me/1234567890' });
  assert.equal(menuCtaHref(content), null);
});

test('CTA apuntando a una página APAGADA (suscripciones) → null, aunque el destino esté en el set cerrado', () => {
  const content = contenidoConMenu(
    { ctaLabel: 'Suscríbete', ctaDestino: '/suscripciones' },
    { suscripciones: { visible: false } },
  );
  assert.equal(menuCtaHref(content), null);
});

test('CTA apuntando a una página APAGADA (nosotros) → null', () => {
  const content = contenidoConMenu({ ctaLabel: 'Conócenos', ctaDestino: '/nosotros' }, { nosotros: { visible: false } });
  assert.equal(menuCtaHref(content), null);
});

test('CTA a /tienda (sin gate de página) SIGUE mostrándose aunque las otras dos páginas estén apagadas', () => {
  const content = contenidoConMenu(
    { ctaLabel: 'Ver catálogo', ctaDestino: '/tienda' },
    { suscripciones: { visible: false }, nosotros: { visible: false } },
  );
  assert.equal(menuCtaHref(content), '/tienda');
});

// ── El schema editable — DOS sets cerrados, el WRITE es más estricto que el loader ──────────────

test('menu: un objeto válido con las 3 posiciones y el CTA SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({
    menu: { labelTienda: 'Nuestro café', posicion1: 'nosotros', posicion2: 'tienda', posicion3: 'suscripciones', ctaLabel: 'Escríbenos', ctaDestino: '/tienda' },
  });
  assert.deepEqual(parsed.menu, {
    labelTienda: 'Nuestro café', posicion1: 'nosotros', posicion2: 'tienda', posicion3: 'suscripciones', ctaLabel: 'Escríbenos', ctaDestino: '/tienda',
  });
});

test('menu: parcial (una sola clave) sobrevive — el schema no exige todas a la vez', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { labelTienda: 'x' } });
  assert.deepEqual(parsed.menu, { labelTienda: 'x' });
});

test('menu: posicionN vacía ("") sobrevive — el resolver la completa con el default, el schema sólo valida el TIPO', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { posicion1: '' } });
  assert.equal(parsed.menu!.posicion1, '');
});

test('menu: ctaDestino vacío ("") sobrevive — es el estado "CTA apagado"', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { ctaDestino: '' } });
  assert.equal(parsed.menu!.ctaDestino, '');
});

test('menu: un DESTINO fuera del set cerrado se rechaza (a diferencia del resolver, que lo absorbe SOFT)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { ctaDestino: 'https://wa.me/1234567890' } }));
  assert.throws(() => siteContentEditableSchema.parse({ menu: { ctaDestino: '/checkout' } }));
});

test('menu: una POSICIÓN fuera del set cerrado se rechaza', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { posicion1: 'inicio' } }));
  assert.throws(() => siteContentEditableSchema.parse({ menu: { posicion2: 42 } }));
});

test('menu: DOS posiciones no pueden repetirse (el write es más estricto que el loader, que dedupe)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { posicion1: 'tienda', posicion2: 'tienda' } }));
});

test('menu: la MISMA posición vacía repetida NO se rechaza — "" no cuenta como duplicado', () => {
  assert.doesNotThrow(() => siteContentEditableSchema.parse({ menu: { posicion1: '', posicion2: '' } }));
});

test('menu: ausente no rompe el parse (como las demás secciones)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.menu, undefined);
});

test('menu: una clave NO declarada en el modelo se descarta (confirma que el strip está activo)', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { labelTienda: 'x', basura: 'no-declarada' } });
  assert.deepEqual(parsed.menu, { labelTienda: 'x' });
});

// ── El VIAJE completo — guardado crudo → resolverSiteContent → itemsDeMenu ──────────────────────

test('un documento GUARDADO parcial (sólo dos campos tocados) resuelve con el resto en su default de hoy', () => {
  const content = resolverSiteContent({ menu: { labelNosotros: 'La finca', posicion1: 'nosotros' } });
  // labelNosotros editado, resto de labels en su default; posicion1 editado, 2/3 en su default →
  // resolverOrdenMenu ve ['nosotros','suscripciones','nosotros'] y dedupea a ['nosotros','suscripciones','tienda'].
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'nosotros', label: 'La finca', path: '/nosotros' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
  ]);
});

test('un documento con las 3 posiciones VACÍAS/de tipo equivocado (dato corrupto por otra vía) resuelve al orden de hoy', () => {
  // Los tres son "vacíos" para el resolver genérico (número/null no son string) → cada uno cae al
  // DEFAULT de su propia posición (`esVacio`) → el orden queda EXACTAMENTE el canónico.
  const content = resolverSiteContent({ menu: { posicion1: 123, posicion2: null, posicion3: undefined } });
  assert.deepEqual(itemsDeMenu(content), LINKS_HOY);
});

test('una STRING fuera del set cerrado en posicion1 NO cae a su default (el resolver genérico sólo mira vacío/no-vacío) — `resolverOrdenMenu` la filtra igual, y lo que faltó se completa AL FINAL, en orden canónico', () => {
  // Medido, no asumido: `esVacio('inicio')` es `false` (es un string no-vacío), así que el resolver
  // genérico la deja pasar tal cual — es `resolverOrdenMenu`, más abajo en la cadena, quien la
  // descarta por no pertenecer a `MENU_ITEM_IDS`. Como 'tienda' nunca apareció en ninguna posición
  // válida, entra por el relleno canónico — AL FINAL, no en su slot original. Es el mismo
  // comportamiento (y la misma razón) que `resolverOrden` ya tiene para las bandas.
  const content = resolverSiteContent({ menu: { posicion1: 'inicio', posicion2: 'suscripciones', posicion3: 'nosotros' } });
  assert.deepEqual(itemsDeMenu(content), [
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
  ]);
});
