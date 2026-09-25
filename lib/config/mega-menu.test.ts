import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  itemsDeMenu,
  panelDeMenuItem,
  menuCtaHref,
  MENU_ITEM_IDS,
  MENU_CTA_DESTINOS,
  type SiteContentData,
  type MenuContent,
} from '@/lib/config/site-content-defaults';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';

// § MUESTRARIO-MEGA-MENU-1. Un ítem del menú puede declarar un PANEL desplegable (mega-menu): copy
// introductorio + su CTA, DOS columnas de sub-enlaces (etiqueta + nota opcional + destino), y una
// tarjeta promocional (imagen + título + CTA) — medido contra el prototipo
// (`docs/prototipos/cafeone/index.html:57-89`, `#mega-cafe`). Vacío = el ítem sigue siendo un link
// plano, byte-idéntico (§ CROMO-MENU-COMO-DATO-1, la invariante de siempre).
//
// StoreNav.tsx NO se renderiza acá, MISMA razón medida en `menu-como-dato.test.ts` y
// `corte-badge-menu.test.ts`: usa `usePathname()`, que fuera de un árbol real de Next.js revienta.
// Lo que se afirma acá es la CAPA DE DATOS que gobierna a StoreNav byte a byte: `itemsDeMenu` y
// `panelDeMenuItem` son lo que el nav pinta, sin necesitar el render del componente.

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

// Un panel COMPLETO, con las dos columnas y la tarjeta — la base para los casos "con contenido".
const PANEL_COMPLETO: Partial<MenuContent> = {
  panelItem: 'tienda',
  panelIntro: 'Un solo lote, recogido grano a grano.',
  panelIntroCtaLabel: 'Ver producto',
  panelIntroCtaDestino: '/tienda',
  panelCol1Titulo: 'Presentaciones',
  panelCol1Link1Etiqueta: 'Molido', panelCol1Link1Nota: '250 g', panelCol1Link1Destino: '/tienda',
  panelCol1Link2Etiqueta: 'En grano', panelCol1Link2Nota: '500 g', panelCol1Link2Destino: '/tienda',
  panelCol2Titulo: 'La finca',
  panelCol2Link1Etiqueta: 'Nuestra historia', panelCol2Link1Nota: '', panelCol2Link1Destino: '/nosotros',
  panelTarjetaImagen: '/blob/finca.jpg',
  panelTarjetaTitulo: 'Origen San Adolfo',
  panelTarjetaCtaLabel: 'Explorar',
  panelTarjetaCtaDestino: '/nosotros',
};

// ── El SET CERRADO — el modelo declara los 28 campos, todos opcionales (§65-B) ──────────────────

test('REGISTRY.menu.campos declara los 28 campos del panel, todos opcionales', () => {
  const CAMPOS_PANEL = [
    'panelItem', 'panelIntro', 'panelIntroCtaLabel', 'panelIntroCtaDestino',
    'panelCol1Titulo',
    'panelCol1Link1Etiqueta', 'panelCol1Link1Nota', 'panelCol1Link1Destino',
    'panelCol1Link2Etiqueta', 'panelCol1Link2Nota', 'panelCol1Link2Destino',
    'panelCol1Link3Etiqueta', 'panelCol1Link3Nota', 'panelCol1Link3Destino',
    'panelCol2Titulo',
    'panelCol2Link1Etiqueta', 'panelCol2Link1Nota', 'panelCol2Link1Destino',
    'panelCol2Link2Etiqueta', 'panelCol2Link2Nota', 'panelCol2Link2Destino',
    'panelCol2Link3Etiqueta', 'panelCol2Link3Nota', 'panelCol2Link3Destino',
    'panelTarjetaImagen', 'panelTarjetaTitulo', 'panelTarjetaCtaLabel', 'panelTarjetaCtaDestino',
  ] as const;
  assert.equal(CAMPOS_PANEL.length, 28);
  for (const c of CAMPOS_PANEL) assert.equal(REGISTRY.menu.campos[c], 'opcional', `${c} debe ser opcional`);
});

test('REGISTRY.menu.imagenes nombra panelTarjetaImagen — el borrado de blobs reemplazados la ve', () => {
  assert.deepEqual(REGISTRY.menu.imagenes, ['panelTarjetaImagen']);
});

test('DEFAULTS.menu.panelItem nace vacío — ningún ítem lleva panel sin fila', () => {
  assert.equal(DEFAULTS.menu.panelItem, '');
});

// ── SIN PANEL: el ítem sigue siendo un link plano, byte-idéntico ────────────────────────────────

test('sin panelItem configurado, itemsDeMenu es byte-idéntico a hoy: ninguna clave `panel` en ningún ítem', () => {
  const links = itemsDeMenu(contenidoConMenu());
  assert.deepEqual(links, [
    { id: 'tienda', label: 'Tienda', path: '/tienda' },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
    { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
  ]);
  for (const l of links) assert.ok(!('panel' in l), `${l.id} no debe traer la clave panel`);
});

test('resolverSiteContent({}) (sin fila) → itemsDeMenu sin panel — byte-idéntico sin depender de una fila (Nayoli)', () => {
  const links = itemsDeMenu(resolverSiteContent({}));
  for (const l of links) assert.ok(!('panel' in l));
});

test('panelDeMenuItem: sin panelItem configurado, null para los tres ids', () => {
  const content = contenidoConMenu();
  for (const id of MENU_ITEM_IDS) assert.equal(panelDeMenuItem(content, id), null);
});

test('panelDeMenuItem: panelItem apuntando a OTRO ítem del set → null para el ítem que no coincide', () => {
  const content = contenidoConMenu({ panelItem: 'tienda', panelIntro: 'Texto' });
  assert.equal(panelDeMenuItem(content, 'suscripciones'), null);
  assert.equal(panelDeMenuItem(content, 'nosotros'), null);
  assert.notEqual(panelDeMenuItem(content, 'tienda'), null);
});

test('panelDeMenuItem: panelItem configurado pero TODO EL RESTO vacío → null (preferir callar a un desplegable sin nada adentro)', () => {
  const content = contenidoConMenu({ panelItem: 'tienda' });
  assert.equal(panelDeMenuItem(content, 'tienda'), null);
});

// ── CON PANEL: se declaran intro/CTA, columnas y tarjeta ────────────────────────────────────────

test('panelDeMenuItem: un panel completo resuelve intro, CTA, las dos columnas y la tarjeta', () => {
  const content = contenidoConMenu(PANEL_COMPLETO);
  const panel = panelDeMenuItem(content, 'tienda');
  assert.deepEqual(panel, {
    intro: 'Un solo lote, recogido grano a grano.',
    introCtaHref: '/tienda',
    introCtaLabel: 'Ver producto',
    columnas: [
      {
        titulo: 'Presentaciones',
        enlaces: [
          { etiqueta: 'Molido', nota: '250 g', destino: '/tienda' },
          { etiqueta: 'En grano', nota: '500 g', destino: '/tienda' },
        ],
      },
      {
        titulo: 'La finca',
        enlaces: [
          { etiqueta: 'Nuestra historia', nota: '', destino: '/nosotros' },
        ],
      },
    ],
    tarjetaImagen: '/blob/finca.jpg',
    tarjetaTitulo: 'Origen San Adolfo',
    tarjetaCtaHref: '/nosotros',
    tarjetaCtaLabel: 'Explorar',
  });
});

test('itemsDeMenu: el panel sale SÓLO en su ítem, los otros dos sin la clave', () => {
  const content = contenidoConMenu(PANEL_COMPLETO);
  const links = itemsDeMenu(content);
  const tienda = links.find(l => l.id === 'tienda')!;
  assert.ok('panel' in tienda);
  assert.equal(tienda.panel!.intro, 'Un solo lote, recogido grano a grano.');
  assert.ok(!('panel' in links.find(l => l.id === 'suscripciones')!));
  assert.ok(!('panel' in links.find(l => l.id === 'nosotros')!));
});

test('una columna con SÓLO título (sin ningún enlace vivo) SIGUE apareciendo — título O enlaces, mismo criterio OR que Presentaciones', () => {
  const content = contenidoConMenu({ panelItem: 'tienda', panelCol1Titulo: 'Presentaciones' });
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.deepEqual(panel.columnas, [{ titulo: 'Presentaciones', enlaces: [] }]);
});

test('una columna con SÓLO un enlace (sin título) SIGUE apareciendo', () => {
  const content = contenidoConMenu({
    panelItem: 'tienda',
    panelCol1Link1Etiqueta: 'Ver tienda', panelCol1Link1Destino: '/tienda',
  });
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.deepEqual(panel.columnas, [{ titulo: '', enlaces: [{ etiqueta: 'Ver tienda', nota: '', destino: '/tienda' }] }]);
});

test('una columna SIN título y SIN ningún enlace vivo se OMITE — no un objeto vacío', () => {
  const content = contenidoConMenu({ panelItem: 'tienda', panelCol1Titulo: 'Presentaciones', panelCol2Titulo: '' });
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.equal(panel.columnas.length, 1);
  assert.equal(panel.columnas[0].titulo, 'Presentaciones');
});

// ── LOS DESTINOS — el SET CERRADO `MENU_CTA_DESTINOS`, preferir callar a un link roto ───────────

test('un enlace de columna con destino FUERA del set cerrado (basura llegada por otra vía) NO valida — se omite de la lista', () => {
  const content = contenidoConMenu({
    panelItem: 'tienda',
    panelCol1Titulo: 'Presentaciones',
    panelCol1Link1Etiqueta: 'Molido 250g', panelCol1Link1Destino: 'producto.html?p=Molido&t=250',
  });
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.deepEqual(panel.columnas, [{ titulo: 'Presentaciones', enlaces: [] }]);
});

test('un enlace SIN etiqueta (destino puesto igual) se omite — un link sin texto no se muestra', () => {
  const content = contenidoConMenu({
    panelItem: 'tienda',
    panelCol1Titulo: 'Presentaciones',
    panelCol1Link1Destino: '/tienda',
  });
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.deepEqual(panel.columnas, [{ titulo: 'Presentaciones', enlaces: [] }]);
});

test('un enlace apuntando a una página APAGADA (suscripciones) se omite, aunque el destino esté en el set cerrado', () => {
  const content = contenidoConMenu(
    { panelItem: 'tienda', panelCol1Titulo: 'Suscríbete', panelCol1Link1Etiqueta: 'Ver planes', panelCol1Link1Destino: '/suscripciones' },
    { suscripciones: { visible: false } },
  );
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.deepEqual(panel.columnas, [{ titulo: 'Suscríbete', enlaces: [] }]);
});

test('el CTA de intro y el CTA de la tarjeta siguen el MISMO set cerrado — destino fuera de él → null', () => {
  const content = contenidoConMenu({
    panelItem: 'tienda',
    panelIntro: 'Texto',
    panelIntroCtaLabel: 'Ver', panelIntroCtaDestino: '#historia',
    panelTarjetaTitulo: 'Origen',
    panelTarjetaCtaLabel: 'Explorar', panelTarjetaCtaDestino: 'https://wa.me/123',
  });
  const panel = panelDeMenuItem(content, 'tienda')!;
  assert.equal(panel.introCtaHref, null);
  assert.equal(panel.tarjetaCtaHref, null);
});

test('MENU_CTA_DESTINOS: el mismo set cerrado de tres rutas que ya rige el CTA del menú', () => {
  assert.deepEqual(MENU_CTA_DESTINOS, ['/tienda', '/suscripciones', '/nosotros']);
});

// ── EL BADGE Y EL CTA DEL MENÚ SIGUEN FUNCIONANDO IGUAL, sin interferencia del panel ────────────

test('un ítem puede llevar BADGE y PANEL a la vez, sin que se pisen', () => {
  const content = contenidoConMenu({ ...PANEL_COMPLETO, badgeItem: 'tienda', badgeTexto: 'Cosecha 2026' });
  const links = itemsDeMenu(content);
  const tienda = links.find(l => l.id === 'tienda')!;
  assert.equal(tienda.badge, 'Cosecha 2026');
  assert.ok(!!tienda.panel);
});

test('el CTA del menú (menuCtaHref) sigue resolviendo igual, sin importar el panel', () => {
  const content = contenidoConMenu({ ...PANEL_COMPLETO, ctaLabel: 'Escríbenos', ctaDestino: '/suscripciones' });
  assert.equal(menuCtaHref(content), '/suscripciones');
});

test('el badge en un ítem SIN panel (nosotros) sigue apareciendo solo, sin panel', () => {
  const content = contenidoConMenu({ ...PANEL_COMPLETO, badgeItem: 'nosotros', badgeTexto: 'Edición limitada' });
  const links = itemsDeMenu(content);
  const nosotros = links.find(l => l.id === 'nosotros')!;
  assert.equal(nosotros.badge, 'Edición limitada');
  assert.ok(!('panel' in nosotros));
});

// ── El schema editable — panelItem y cada *Destino del SET CERRADO, el WRITE es más estricto ────

test('menu: un panel completo SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ menu: PANEL_COMPLETO });
  assert.deepEqual(parsed.menu, PANEL_COMPLETO);
});

test('menu: panelItem fuera del set cerrado se rechaza', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { panelItem: 'inicio' } }));
});

test('menu: panelItem vacío ("") sobrevive — es el estado "ningún ítem con panel"', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { panelItem: '' } });
  assert.equal(parsed.menu!.panelItem, '');
});

test('menu: un destino de columna FUERA del set cerrado se rechaza (el write es estricto; el resolver SOFT es la red aparte)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { panelCol1Link1Destino: 'producto.html?p=Molido' } }));
  assert.throws(() => siteContentEditableSchema.parse({ menu: { panelCol2Link3Destino: '#historia' } }));
});

test('menu: panelIntroCtaDestino y panelTarjetaCtaDestino fuera del set cerrado se rechazan', () => {
  assert.throws(() => siteContentEditableSchema.parse({ menu: { panelIntroCtaDestino: 'https://wa.me/1234567890' } }));
  assert.throws(() => siteContentEditableSchema.parse({ menu: { panelTarjetaCtaDestino: '/checkout' } }));
});

test('menu: cada *Destino vacío ("") sobrevive — es el estado "CTA/enlace apagado"', () => {
  const parsed = siteContentEditableSchema.parse({
    menu: { panelIntroCtaDestino: '', panelCol1Link1Destino: '', panelTarjetaCtaDestino: '' },
  });
  assert.equal(parsed.menu!.panelIntroCtaDestino, '');
  assert.equal(parsed.menu!.panelCol1Link1Destino, '');
  assert.equal(parsed.menu!.panelTarjetaCtaDestino, '');
});

test('menu: una clave del panel NO declarada se descarta (confirma que el strip está activo)', () => {
  const parsed = siteContentEditableSchema.parse({ menu: { panelIntro: 'x', panelBasura: 'no-declarada' } });
  assert.deepEqual(parsed.menu, { panelIntro: 'x' });
});

// ── El VIAJE completo — guardado crudo → resolverSiteContent → itemsDeMenu ──────────────────────

test('un documento GUARDADO parcial (sólo el panel de un ítem) resuelve con el resto del menú en su default de hoy', () => {
  const content = resolverSiteContent({ menu: PANEL_COMPLETO });
  const links = itemsDeMenu(content);
  assert.deepEqual(links.map(l => l.id), ['tienda', 'suscripciones', 'nosotros']);
  assert.ok(!!links.find(l => l.id === 'tienda')!.panel);
  assert.equal(links.find(l => l.id === 'tienda')!.label, 'Tienda');
});
