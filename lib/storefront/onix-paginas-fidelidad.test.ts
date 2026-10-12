import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULTS, type SiteContentData } from '../config/site-content-defaults';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import Apertura from '@/components/storefront/tienda/Apertura';
import TiendaEncabezado from '@/components/storefront/tienda/TiendaEncabezado';
import TiendaCierre from '@/components/storefront/tienda/TiendaCierre';
import TiendaInterludio from '@/components/storefront/tienda/TiendaInterludio';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosCierre from '@/components/storefront/nosotros/NosotrosCierre';
import SuscripcionApertura from '@/components/storefront/suscripciones/SuscripcionApertura';
import NosotrosApertura from '@/components/storefront/nosotros/NosotrosApertura';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
import SuscripcionTaquilla from '@/components/storefront/suscripciones/SuscripcionTaquilla';
import { CreditosFilas } from '@/components/storefront/tienda/TiendaCreditos';
import type { Product } from '@/types/product';
import type { SuscripcionPlanesContent } from '../config/site-content-defaults';

// § ONIX-PAGINAS-FIDELIDAD-1 — render EN MEMORIA (`renderToStaticMarkup`, sin red, sin DOM) con
// contenido de Onix pasado A MANO (nunca `.env`/una base). Dos preguntas:
// (1) ¿lo que arreglamos para fidelidad a la maqueta SIGUE arreglado? (título quieto, filetes de
//     tinta, Taquilla con presentación);
// (2) ¿lo que NO debía tocarse (las OTRAS composiciones que comparten los mismos archivos
//     compartidos — Apertura/InterludioPlano/CierreFraseYBoton/TiendaCreditos) sigue byte-idéntico?

function conSeccion<K extends keyof SiteContentData>(key: K, over: Partial<SiteContentData[K]>): SiteContentData {
  return { ...DEFAULTS, [key]: { ...DEFAULTS[key], ...over } };
}

// ─── (1) El título QUIETO — sin el marcador de movimiento ──────────────────────────────────────
//
// `Movimiento` (§ components/storefront/movimiento/Movimiento.tsx) monta un `<div>` wrapper propio
// SÓLO cuando `id` está presente; con `id` ausente devuelve `children` DIRECTO, sin nodo de más
// (su propio docstring: "sin un id, este componente no renderiza ningún nodo propio"). Por eso "el
// título no lleva el marcador de movimiento" es, en el HTML, exactamente UN `<div>` menos: el
// wrapper que `Apertura.tsx` ya NO pide (`Movimiento id={quieto ? undefined : 'T06'}`).

test('Apertura: quieto=true quita el wrapper de Movimiento T06 — un <div> menos, mismo título', () => {
  const props = { seccion: 'tiendaEncabezado', titulo: 'CADA MES', rotuloIzquierda: 'IZQ', rotuloDerecha: 'DER' };
  const conMovimiento = renderToStaticMarkup(React.createElement(Apertura, props));
  const quieto = renderToStaticMarkup(React.createElement(Apertura, { ...props, quieto: true }));

  const divsConMovimiento = (conMovimiento.match(/<div/g) ?? []).length;
  const divsQuieto = (quieto.match(/<div/g) ?? []).length;
  assert.equal(
    divsConMovimiento - divsQuieto, 1,
    'quieto debe tener EXACTAMENTE un <div> menos — el wrapper de Movimiento T06 desaparece',
  );
  assert.ok(conMovimiento.includes('CADA MES') && quieto.includes('CADA MES'), 'el título sigue presente en los dos modos');
  // El marcador de la posición ESTÁTICA (§ el spec item 1: "al ras de la izquierda, sangrando"):
  // letter-spacing -.01em y el ancho mobile 22vw sólo existen en el modo quieto.
  assert.ok(quieto.includes('tracking-[-0.01em]'), 'quieto lleva el letter-spacing de la maqueta');
  assert.ok(!conMovimiento.includes('tracking-[-0.01em]'), 'el modo con movimiento NO lleva ese ajuste — no es parte de su diseño');
});

test('SuscripcionApertura y NosotrosApertura: SIEMPRE quietos (sin "T06"/tracking de movimiento)', () => {
  const contenidoSus = conSeccion('suscripcionApertura', { visible: true, titulo: 'CADA MES' });
  const htmlSus = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenidoSus, children: React.createElement(SuscripcionApertura) }),
  );
  const contenidoNos = conSeccion('nosotrosApertura', { visible: true, titulo: 'LA FINCA' });
  const htmlNos = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenidoNos, children: React.createElement(NosotrosApertura) }),
  );
  assert.ok(htmlSus.includes('CADA MES') && htmlSus.includes('tracking-[-0.01em]'));
  assert.ok(htmlNos.includes('LA FINCA') && htmlNos.includes('tracking-[-0.01em]'));
  // Y LA MISMA ALTURA que /suscripciones (§ el spec item 1: "La /nosotros usa el mismo alto que
  // /suscripciones") — el literal `h-[70svh] min-h-[420px]` en los dos, no el default de /tienda
  // (85vh) que usaba antes.
  assert.ok(htmlSus.includes('h-[70svh]') && htmlSus.includes('min-h-[420px]'));
  assert.ok(htmlNos.includes('h-[70svh]') && htmlNos.includes('min-h-[420px]'));
});

test('TiendaEncabezado: la apertura de /tienda (variante "apertura") CONSERVA su movimiento tal cual', () => {
  const contenido = conSeccion('tiendaEncabezado', { variante: 'apertura', titulo: 'CAFÉ ONIX' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement<{ negocio?: string }>(TiendaEncabezado, { negocio: 'Onix' }) }),
  );
  assert.ok(html.includes('CAFÉ ONIX'));
  // Si /tienda hubiera quedado quieta por accidente, llevaría el tracking de la maqueta — y no es
  // el caso: "nadie lo pidió cambiar".
  assert.ok(!html.includes('tracking-[-0.01em]'), '/tienda NO debe llevar el ajuste de la maqueta quieta — conserva T06');
});

// ─── (2) Los filetes usan la TINTA (R1), nunca `--sf-linea` ────────────────────────────────────

function onixCatalog(): Product[] {
  const base = {
    costo: 0, sku: null, stock: 10, activo: true, disponible: true, moliendasOpciones: [] as never[], descripcion: '',
  };
  return [
    { ...base, id: 'p-grano-250', nombre: 'Café Onix — En grano 250 g', slug: 'onix-grano-250', categoria: 'Café en Grano', precio: 20000, peso_gramos: 250 },
    { ...base, id: 'p-grano-500', nombre: 'Café Onix — En grano 500 g', slug: 'onix-grano-500', categoria: 'Café en Grano', precio: 35000, peso_gramos: 500 },
    { ...base, id: 'p-molido-250', nombre: 'Café Onix — Molido 250 g', slug: 'onix-molido-250', categoria: 'Café Molido', precio: 20000, peso_gramos: 250 },
    { ...base, id: 'p-molido-500', nombre: 'Café Onix — Molido 500 g', slug: 'onix-molido-500', categoria: 'Café Molido', precio: 35000, peso_gramos: 500 },
  ] as Product[];
}

const PLANES_ONIX: SuscripcionPlanesContent = {
  ...DEFAULTS.suscripcionPlanes,
  frecuencia1: '15 días', frecuencia2: 'Mes', frecuencia3: '', frecuencia4: '',
};

test('SuscripcionTaquilla: los filetes son tinta al 15% — cero `--sf-linea` en todo el árbol', () => {
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onixCatalog(), whatsapp: '573000000000', suscripcionPlanes: PLANES_ONIX }),
  );
  assert.ok(html.includes('var(--sf-tinta)'));
  assert.ok(!html.includes('var(--sf-linea)'), 'SuscripcionTaquilla no debe usar --sf-linea — invisible para Onix (R1 del informe)');
});

test('PreguntasFrecuentes (variante letraPequena): rótulo + filetes de tinta, N+1 filetes para N preguntas', () => {
  const contenido = conSeccion('suscripcionFaq', {
    visible: true,
    variante: 'letraPequena',
    titulo: 'Antes de suscribirte',
    items: [
      { question: '¿Puedo pausar?', answer: 'Sí, cuando quieras.' },
      { question: '¿Hay compromiso?', answer: 'No, cancelas cuando quieras.' },
    ],
  });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement(PreguntasFrecuentes) }),
  );
  assert.ok(html.includes('Letra pequeña'), 'lleva el rótulo fijo de la maqueta aprobada');
  assert.ok(!html.includes('var(--sf-linea)'), 'sin --sf-linea — R1');
  // R3: filete arriba de la primera Y abajo de cada una → para 2 preguntas, 3 ocurrencias del
  // filete de tinta (una por `border-t` inicial + dos `border-b`).
  const ocurrencias = (html.match(/var\(--sf-tinta\)\]\/15/g) ?? []).length;
  assert.equal(ocurrencias, 3, '2 filas ⇒ 3 filetes (arriba de la 1ª + abajo de cada una), no 1 (sólo entre filas)');
});

test('NosotrosHistoriaSinopsis: el filete vertical es tinta, no --sf-linea', () => {
  const contenido = conSeccion('nosotrosHistoria', { eyebrow: 'Sinopsis', parrafo1: 'La finca.', imagen: '', retratoNombre: '' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: { ...contenido, nosotrosHistoria: { ...contenido.nosotrosHistoria, variante: 'sinopsis' } }, children: React.createElement(NosotrosHistoria) }),
  );
  assert.ok(html.includes('var(--sf-tinta)]/15'));
  assert.ok(!html.includes('var(--sf-linea)'));
});

test('CreditosFilas: R3 — filete arriba de la primera fila Y abajo de cada fila (N+1, no N-1)', () => {
  const filas = [
    { etiqueta: 'Pedido', valor: 'Por WhatsApp' },
    { etiqueta: 'Pago', valor: 'Se acuerda por chat' },
    { etiqueta: 'Envío', valor: 'A todo el país' },
  ];
  const html = renderToStaticMarkup(React.createElement(CreditosFilas, { filas }));
  const topes = (html.match(/border-t/g) ?? []).length;
  const bottoms = (html.match(/border-b/g) ?? []).length;
  assert.equal(topes, 1, 'un solo border-t — arriba de la PRIMERA fila');
  assert.equal(bottoms, 3, 'un border-b por CADA fila (3)');
});

// ─── (3) BYTE-IDENTIDAD de las composiciones de OTRAS tiendas que comparten archivo ────────────
//
// Las piezas compartidas (Apertura/InterludioPlano/CierreFraseYBoton/TiendaCreditos) alimentan
// VARIAS composiciones por dispatcher (§ REGISTRY.*.variantes). Esta tanda sólo tocó el contenido
// Y el estilo que esas piezas pintan — las composiciones CANÓNICAS de los mismos dispatchers, que
// NO montan esas piezas, tienen que seguir exactamente igual. Se verifica RENDERIZANDO cada
// canónica (Relato/Línea/Costura/Retrato/Tarjetas: contenido puro, sin red, seguro de renderizar
// en memoria) y confirmando que el HTML no lleva NINGUNA de las marcas nuevas de esta tanda
// (`tracking-[-0.01em]`, `rounded-[2px]`, `[text-shadow`, `22vw`, `var(--sf-tinta)]/65` del rol de
// texto secundario, `var(--sf-tinta)]/15` del filete). Dos composiciones (Actual/Láminas, de
// `TiendaCatalogo.tsx`) NO se renderizan acá — exigen el catálogo real vía red, fuera de lo que
// esta verificación en memoria puede ejercitar sin tocar una base — y se verifican por LECTURA DE
// FUENTE: ninguno de los DOS archivos que las implementan importa las piezas tocadas.

const MARCAS_DE_LA_TANDA = ['tracking-[-0.01em]', 'rounded-[2px]', '[text-shadow', '22vw', 'var(--sf-tinta)]/65', 'var(--sf-tinta)]/15'];

function sinMarcasDeLaTanda(html: string, nombre: string) {
  for (const marca of MARCAS_DE_LA_TANDA) {
    assert.ok(!html.includes(marca), `"${nombre}" no debería llevar la marca "${marca}" de ONIX-PAGINAS-FIDELIDAD-1 — no monta las piezas tocadas`);
  }
}

test('Relato (nosotrosHistoria canónica) — byte-identidad: no toca ninguna pieza de esta tanda', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(NosotrosHistoria) }),
  );
  assert.equal(DEFAULTS.nosotrosHistoria.variante, 'relato', 'la canónica de DEFAULTS debe ser "relato" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Relato');
});

test('Línea (nosotrosCierre canónica) — byte-identidad: no monta CierreFraseYBoton', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(NosotrosCierre) }),
  );
  assert.equal(DEFAULTS.nosotrosCierre.variante, 'linea', 'la canónica de DEFAULTS debe ser "linea" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Línea');
});

test('Costura (tiendaCierre canónica) — byte-identidad: no monta CierreFraseYBoton', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(TiendaCierre) }),
  );
  assert.equal(DEFAULTS.tiendaCierre.variante, 'costura', 'la canónica de DEFAULTS debe ser "costura" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Costura');
});

test('Retrato (tiendaInterludio canónica) — byte-identidad: no monta InterludioPlano', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(TiendaInterludio) }),
  );
  assert.equal(DEFAULTS.tiendaInterludio.variante, 'retrato', 'la canónica de DEFAULTS debe ser "retrato" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Retrato');
});

test('Tarjetas (suscripcionFaq canónica) — byte-identidad: no es la composición "letraPequena" tocada', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(PreguntasFrecuentes) }),
  );
  assert.equal(DEFAULTS.suscripcionFaq.variante, 'tarjetas', 'la canónica de DEFAULTS debe ser "tarjetas" para que este render la ejercite');
  assert.ok(!html.includes('Letra pequeña'), 'el rótulo fijo es exclusivo de la composición "letraPequena"');
  sinMarcasDeLaTanda(html, 'Tarjetas (FAQ)');
});

test('Actual / Láminas (TiendaCatalogo.tsx, TiendaLaminas.tsx) — por LECTURA DE FUENTE: ninguna importa las piezas tocadas', () => {
  // Fuera del render en memoria a propósito (§ el comentario de arriba): las dos exigen el
  // catálogo real por red. Se verifica por texto-fuente que el archivo no las usa — así que, aunque
  // su variante canónica ('actual') NO sea 'laminas'/'taquilla', ninguna de las dos puede haber
  // empezado a invocar una pieza tocada sin que este grep lo note.
  for (const archivo of ['components/storefront/tienda/TiendaCatalogo.tsx', 'components/storefront/tienda/TiendaLaminas.tsx']) {
    const fuente = readFileSync(join(process.cwd(), archivo), 'utf8');
    for (const pieza of ['tienda/Apertura', 'tienda/InterludioPlano', 'tienda/CierreFraseYBoton']) {
      assert.ok(!fuente.includes(pieza), `${archivo} no debe importar ${pieza}`);
    }
  }
});
