import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatCOP } from '@duna/core/utils';
import {
  frecuenciasDeTaquilla,
  bolsasDeTaquilla,
  segmentoMolienda,
  resumenTaquilla,
  referenciaPrecioTaquilla,
  mensajeTaquilla,
  creditosDeTaquilla,
  itemsCasillas,
  bolsasCasillas,
  totalPorEnvioCasillas,
  moliendasCasillas,
  frecuenciaEstructuraPorSlot,
  topeUnidadesCasilla,
} from './suscripcion-taquilla';
import { derivarMatrizTaquilla, celdaDe } from '@/lib/tienda/taquilla';
import { DEFAULTS, type SiteContentData, type SuscripcionPlanesContent } from '../config/site-content-defaults';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { navOffsetClase } from '../config/themes';
import SuscripcionApertura from '@/components/storefront/suscripciones/SuscripcionApertura';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import SuscripcionTaquilla from '@/components/storefront/suscripciones/SuscripcionTaquilla';
import SuscripcionCasillas from '@/components/storefront/suscripciones/SuscripcionCasillas';
import SuscripcionCierre from '@/components/storefront/suscripciones/SuscripcionCierre';
import TiendaCierre from '@/components/storefront/tienda/TiendaCierre';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
import type { Product } from '@/types/product';

// § ONIX-SUSCRIPCION-TAQUILLA-1. Dos mitades: las reglas PURAS de la Taquilla de suscripción
// (resumen, referencia de precio, mensaje de WhatsApp, para los cuatro modos de molienda) y la
// BYTE-IDENTIDAD de /suscripciones sin composiciones nuevas — mismo método que
// `lib/config/nosotros-bandas.test.ts`: SSR a texto vía `renderToStaticMarkup`, sin jsdom (el repo
// no lo tiene), comparando el árbol de HOY (resuelto por `page.tsx`, reconstruido acá porque ese
// archivo es server-only y no se puede importar en el carril) contra el árbol de AYER (lo que
// `Contenido.tsx` montaba antes de este slice).

// ─── frecuenciasDeTaquilla / bolsasDeTaquilla ──────────────────────────────────────────────────

test('frecuenciasDeTaquilla: filtra los slots vacíos, preserva el orden', () => {
  assert.deepEqual(frecuenciasDeTaquilla(['15 días', 'Mes', '2 meses', '']), ['15 días', 'Mes', '2 meses']);
  assert.deepEqual(frecuenciasDeTaquilla(['', '', '', '']), []);
  assert.deepEqual(frecuenciasDeTaquilla(['Semana', '', '', '']), ['Semana']);
});

test('bolsasDeTaquilla: 1..max, y un max inválido cae a 1', () => {
  assert.deepEqual(bolsasDeTaquilla(3), [1, 2, 3]);
  assert.deepEqual(bolsasDeTaquilla(1), [1]);
  assert.deepEqual(bolsasDeTaquilla(5), [1, 2, 3, 4, 5]);
  assert.deepEqual(bolsasDeTaquilla(0), [1]);
  assert.deepEqual(bolsasDeTaquilla(Number.NaN), [1]);
});

// ─── segmentoMolienda — los CUATRO modos de decidirMolienda ────────────────────────────────────

test('segmentoMolienda: modo "ninguna" → null (nada que decidir, nada que decir)', () => {
  assert.equal(segmentoMolienda({ modo: 'ninguna' }, null), null);
});

test('segmentoMolienda: modo "automatica" → "Molienda <nombre>", sin fila de elección', () => {
  assert.equal(segmentoMolienda({ modo: 'automatica', nombre: 'Media' }, null), 'Molienda Media');
});

test('segmentoMolienda: modo "eleccion" CON selección → "Molienda <seleccionada>"', () => {
  assert.equal(segmentoMolienda({ modo: 'eleccion' }, 'Prensa'), 'Molienda Prensa');
});

test('segmentoMolienda: modo "eleccion" SIN selección → null', () => {
  assert.equal(segmentoMolienda({ modo: 'eleccion' }, null), null);
});

test('segmentoMolienda: modo "agotada" → null (declara opciones, ninguna disponible)', () => {
  assert.equal(segmentoMolienda({ modo: 'agotada' }, null), null);
});

// ─── resumenTaquilla — SIEMPRE nombra la presentación (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 4:
// antes el resumen nunca la nombraba, "hoy dicen sólo «1 bolsa de 250 g, cada 15 días»") ─────────

test('resumenTaquilla: «2 × 250 G · CAFÉ MOLIDO, MOLIENDA MEDIA · CADA MES» — molido CON molienda', () => {
  assert.equal(
    resumenTaquilla({ bolsas: 2, peso: 250, presentacion: 'Café Molido', segmentoMolienda: 'Molienda Media', frecuenciaEtiqueta: 'Mes' }),
    '2 × 250 G · CAFÉ MOLIDO, MOLIENDA MEDIA · CADA MES',
  );
});

test('resumenTaquilla: «1 × 500 G · CAFÉ EN GRANO · CADA 15 DÍAS» — sin molienda, la presentación SOLA (no dos " · " seguidos)', () => {
  assert.equal(
    resumenTaquilla({ bolsas: 1, peso: 500, presentacion: 'Café en Grano', segmentoMolienda: null, frecuenciaEtiqueta: '15 días' }),
    '1 × 500 G · CAFÉ EN GRANO · CADA 15 DÍAS',
  );
});

// ─── referenciaPrecioTaquilla ───────────────────────────────────────────────────────────────────

test('referenciaPrecioTaquilla: UNA bolsa, sin multiplicador', () => {
  // `formatCOP` (§ @duna/core/utils) es la fuente del formato — no se re-implementa acá el "$X.XXX"
  // a mano; este test fija el contrato (hay o no multiplicador), no el espaciado de la moneda.
  assert.equal(referenciaPrecioTaquilla(1, 20000), `Referencia: ${formatCOP(20000)}, precio de tienda por bolsa.`);
});

test('referenciaPrecioTaquilla: VARIAS bolsas, con multiplicador', () => {
  assert.equal(referenciaPrecioTaquilla(2, 20000), `Referencia: 2 × ${formatCOP(20000)}, precio de tienda por bolsa.`);
});

// ─── mensajeTaquilla — los CUATRO modos de molienda, CON la presentación en la misma cláusula
// (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 4) ──────────────────────────────────────────────────

test('mensajeTaquilla: modo "ninguna", presentación GRANO — sin cláusula de molienda, bolsa en singular', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 1, peso: 250, presentacion: 'Café en Grano', segmentoMolienda: null, frecuenciaEtiqueta: 'Mes' }),
    'Hola, quiero suscribirme a Café Onix: 1 bolsa de 250 g, café en grano, cada mes.',
  );
});

test('mensajeTaquilla: modo "automatica", presentación MOLIDO — molienda en la MISMA cláusula, bolsas en plural', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 2, peso: 250, presentacion: 'Café Molido', segmentoMolienda: 'Molienda Media', frecuenciaEtiqueta: 'Mes' }),
    'Hola, quiero suscribirme a Café Onix: 2 bolsas de 250 g, café molido, molienda media, cada mes.',
  );
});

test('mensajeTaquilla: modo "eleccion" con selección — la cláusula nombra presentación Y la opción elegida', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 1, peso: 500, presentacion: 'Café Molido', segmentoMolienda: 'Molienda Prensa', frecuenciaEtiqueta: '2 meses' }),
    'Hola, quiero suscribirme a Café Onix: 1 bolsa de 500 g, café molido, molienda prensa, cada 2 meses.',
  );
});

test('mensajeTaquilla: modo "agotada" — mismo que "ninguna": sin cláusula de molienda, presentación sola', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 1, peso: 250, presentacion: 'Café en Grano', segmentoMolienda: null, frecuenciaEtiqueta: '15 días' }),
    'Hola, quiero suscribirme a Café Onix: 1 bolsa de 250 g, café en grano, cada 15 días.',
  );
});

// ─── creditosDeTaquilla ─────────────────────────────────────────────────────────────────────────

test('creditosDeTaquilla: con los DEFAULTS, los cuatro créditos del trato — ninguno fabricado', () => {
  assert.deepEqual(creditosDeTaquilla(DEFAULTS.suscripcionPlanes), [
    { etiqueta: 'Pedido', valor: 'Por WhatsApp' },
    { etiqueta: 'Pago', valor: 'Se acuerda por chat' },
    { etiqueta: 'Envío', valor: 'A todo el país' },
    { etiqueta: 'Pausa o cambio', valor: 'Con un mensaje' },
  ]);
});

test('creditosDeTaquilla: una fila a medias (sólo etiqueta o sólo valor) NO se muestra', () => {
  const c = { ...DEFAULTS.suscripcionPlanes, credito1Etiqueta: 'Pedido', credito1Valor: '' };
  assert.deepEqual(creditosDeTaquilla(c).map((x) => x.etiqueta), ['Pago', 'Envío', 'Pausa o cambio']);
});

// ─── SELECCIÓN INICIAL — molido · 250 · la última frecuencia configurada (§ ONIX-PAGINAS-
// FIDELIDAD-1, el spec item 4: "la selección inicial es la de la maqueta") ─────────────────────
//
// El catálogo real de Onix (2 categorías × 2 pesos, § `lib/tienda/taquilla.test.ts`): la ÚLTIMA
// fila alfabética es-CO es "Café Molido" — `SuscripcionTaquilla` arranca ahí, NUNCA por el nombre
// "molido" (la taxonomía la deriva el catálogo), sino por POSICIÓN (`matriz.filas[length-1]`).
// `frecuencia2:'Mes'` es la ÚLTIMA no vacía de este fixture — como en el contenido real de Onix.

function onix(): Product[] {
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

test('SuscripcionTaquilla: selección inicial — "Café Molido · 250 · Mes" (última fila, primera columna, última frecuencia)', () => {
  // § ONIX-TAQUILLA-SOLO-TABLA-1 — el resumen (de donde este test leía la selección) pasa a
  // interruptor APAGADO por defecto; se enciende ACÁ porque es la señal que este test necesita, no
  // porque la selección inicial dependa de mostrarlo. El mensaje de WhatsApp (abajo) prueba lo
  // MISMO sin depender de ningún interruptor — doble cobertura del mismo invariante.
  const planes: SuscripcionPlanesContent = { ...PLANES_ONIX, taquillaMostrarResumen: true };
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onix(), whatsapp: '573000000000', suscripcionPlanes: planes }),
  );
  // El resumen nombra la presentación activa — si el default fuera "Café en Grano" (la PRIMERA
  // fila, el bug de antes) o la frecuencia fuera "15 días" (la PRIMERA, no la última), el texto
  // sería otro.
  assert.ok(html.includes('CAFÉ MOLIDO'), 'el resumen debe nombrar "Café Molido", no "Café en Grano"');
  assert.ok(html.includes('CADA MES'), 'la frecuencia activa debe ser la ÚLTIMA configurada ("Mes"), no la primera ("15 días")');
  assert.ok(!html.includes('CADA 15 DÍAS'), 'NO debe quedar en la primera frecuencia');
});

test('SuscripcionTaquilla: la selección inicial también se lee en el mensaje de WhatsApp — DISPONIBLE con los interruptores APAGADOS (el default)', () => {
  // El mensaje no depende de ningún `taquillaMostrarX` (§ ONIX-TAQUILLA-SOLO-TABLA-1): se arma
  // igual aunque la línea "Se envía" no se muestre. `PLANES_ONIX` (sin overrides) es el estado por
  // defecto — los cinco interruptores apagados.
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onix(), whatsapp: '573000000000', suscripcionPlanes: PLANES_ONIX }),
  );
  const href = html.match(/href="([^"]*wa\.me[^"]*)"/)?.[1];
  assert.ok(href, 'el botón de WhatsApp debe tener un href wa.me');
  const mensaje = decodeURIComponent(href!.split('text=')[1] ?? '');
  assert.ok(mensaje.includes('molido'), 'la presentación activa ("café molido") sigue en el mensaje con el resumen apagado');
  assert.ok(mensaje.includes('cada mes'), 'la frecuencia activa ("cada mes", la última configurada) sigue en el mensaje');
  assert.ok(!mensaje.includes('cada 15 días'), 'NO debe quedar en la primera frecuencia');
});

// ─── BYTE-IDENTIDAD: /suscripciones sin composiciones nuevas == el árbol de ayer ───────────────
//
// `suscripcionApertura.visible` nace `false` y `suscripcionPlanes.variante` nace `'tarjetas'` (los
// DEFAULTS), así que para todo tenant sin fila la página debe verse EXACTAMENTE como antes de este
// slice: SuscripcionPlanes (tarjetas) + SuscripcionPasos + `<main>` con la FAQ, envueltos en el
// MISMO `navOffsetClase`.

function arbolDeAyer(content: SiteContentData, whatsapp: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(
      'div',
      { className: navOffsetClase(content.navTratamiento.posicion) },
      React.createElement(SuscripcionPlanes, { whatsapp }),
      React.createElement(SuscripcionPasos),
      React.createElement('main', { className: 'bg-[var(--sf-fondo)]' }, React.createElement(PreguntasFrecuentes)),
    ),
  });
}

function arbolDeHoy(content: SiteContentData, whatsapp: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(
      'div',
      { className: navOffsetClase(content.navTratamiento.posicion) },
      React.createElement(SuscripcionApertura),
      React.createElement(SuscripcionPlanes, { whatsapp }),
      React.createElement(SuscripcionPasos),
      React.createElement('main', { className: 'bg-[var(--sf-fondo)]' }, React.createElement(PreguntasFrecuentes)),
    ),
  });
}

test('byte-identidad: /suscripciones con los DEFAULTS (apertura apagada, variante "tarjetas") es idéntica al árbol de ayer', () => {
  const whatsapp = '573000000000';
  const viejo = renderToStaticMarkup(arbolDeAyer(DEFAULTS, whatsapp));
  const nuevo = renderToStaticMarkup(arbolDeHoy(DEFAULTS, whatsapp));
  assert.equal(nuevo, viejo);
  assert.ok(viejo.length > 0, 'la página debe renderizar algo con los defaults');
});

test('SuscripcionApertura: con `visible:false` (el default) no renderiza NADA — la apertura es hide-on-off, no hide-on-empty', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(SuscripcionApertura) }),
  );
  assert.equal(html, '');
});

test('SuscripcionApertura: con `visible:true` SÍ renderiza — el título por defecto «CADA MES» aparece', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    suscripcionApertura: { ...DEFAULTS.suscripcionApertura, visible: true },
  };
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(SuscripcionApertura) }),
  );
  assert.ok(html.includes('CADA MES'), 'el título por defecto de la apertura debe aparecer');
});

// ─── LA COMPOSICIÓN «CASILLAS» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1) — tres cafés × dos bolsas,
// como el catálogo real de Las Chamisas. `nombre` lleva el separador " — " de siempre para que
// `nombreBaseProducto` lo recorte, aunque Casillas muestra la CATEGORÍA (el nombre del café), no el
// nombre base del producto — se mantiene por fidelidad al patrón de fixture del resto del archivo.

function chamisas(): Product[] {
  const base = { costo: 0, sku: null, stock: 10, activo: true, disponible: true, descripcion: '' };
  const conMolienda = [
    { nombre: 'En grano', metodo: 'Muele en casa', disponible: true },
    { nombre: 'Molido', metodo: 'Filtro', disponible: true },
  ];
  return [
    { ...base, id: 'bourbon-340', nombre: 'Bourbon Rosado 340 g', slug: 'bourbon-340', categoria: 'Bourbon Rosado', precio: 52000, peso_gramos: 340, notas: ['Floral', 'Frutos rojos', 'Dulce'], moliendasOpciones: conMolienda },
    { ...base, id: 'bourbon-500', nombre: 'Bourbon Rosado 500 g', slug: 'bourbon-500', categoria: 'Bourbon Rosado', precio: 74000, peso_gramos: 500, notas: ['Floral', 'Frutos rojos', 'Dulce'], moliendasOpciones: conMolienda },
    { ...base, id: 'pacamara-340', nombre: 'Pacamara 340 g', slug: 'pacamara-340', categoria: 'Pacamara', precio: 48000, peso_gramos: 340, notas: ['Chocolate', 'Tropical'], moliendasOpciones: conMolienda },
    { ...base, id: 'pacamara-500', nombre: 'Pacamara 500 g', slug: 'pacamara-500', categoria: 'Pacamara', precio: 68000, peso_gramos: 500, notas: ['Chocolate', 'Tropical'], moliendasOpciones: conMolienda },
    { ...base, id: 'papayo-340', nombre: 'Papayo 340 g', slug: 'papayo-340', categoria: 'Papayo', precio: 44000, peso_gramos: 340, notas: ['Caramelo', 'Cítrico'], moliendasOpciones: conMolienda },
    { ...base, id: 'papayo-500', nombre: 'Papayo 500 g', slug: 'papayo-500', categoria: 'Papayo', precio: 62000, peso_gramos: 500, notas: ['Caramelo', 'Cítrico'], moliendasOpciones: conMolienda },
  ] as Product[];
}

test('itemsCasillas: sólo los cafés con cantidad>0, en el orden de la matriz (alfabético es-CO)', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  const items = itemsCasillas(matriz, { Papayo: 2, Pacamara: 0, 'Bourbon Rosado': 1 }, 340);
  assert.deepEqual(items.map((i) => i.categoria), ['Bourbon Rosado', 'Papayo']);
  assert.equal(items[0].cantidad, 1);
  assert.equal(items[0].producto.id, 'bourbon-340');
  assert.equal(items[1].cantidad, 2);
  assert.equal(items[1].producto.id, 'papayo-340');
});

test('itemsCasillas: un mapa vacío da una lista vacía', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  assert.deepEqual(itemsCasillas(matriz, {}, 340), []);
});

test('bolsasCasillas: suma las cantidades de todos los ítems', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  const items = itemsCasillas(matriz, { Papayo: 2, 'Bourbon Rosado': 3 }, 340);
  assert.equal(bolsasCasillas(items), 5);
});

test('totalPorEnvioCasillas: null sin ítems elegidos', () => {
  assert.equal(totalPorEnvioCasillas([]), null);
});

test('totalPorEnvioCasillas: suma precio×cantidad de cada ítem, a la bolsa activa', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  const items340 = itemsCasillas(matriz, { 'Bourbon Rosado': 1, Papayo: 1 }, 340);
  assert.equal(totalPorEnvioCasillas(items340), 52000 + 44000);
  const items500 = itemsCasillas(matriz, { 'Bourbon Rosado': 1, Papayo: 1 }, 500);
  assert.equal(totalPorEnvioCasillas(items500), 74000 + 62000);
});

test('moliendasCasillas: intersección de nombres disponibles entre los productos recibidos', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  const items = itemsCasillas(matriz, { 'Bourbon Rosado': 1, Papayo: 1 }, 340);
  assert.deepEqual(moliendasCasillas(items.map((i) => i.producto)), ['En grano', 'Molido']);
});

test('moliendasCasillas: sin productos, [] — no hay chips que mostrar', () => {
  assert.deepEqual(moliendasCasillas([]), []);
});

test('moliendasCasillas: un producto SIN esa opción disponible la saca de la intersección', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  const items = itemsCasillas(matriz, { 'Bourbon Rosado': 1, Papayo: 1 }, 340);
  const productos = items.map((i) => i.producto);
  // Papayo deja de ofrecer "En grano" (p. ej. ya no queda en esa presentación).
  const papayoSinGrano = {
    ...productos[1],
    moliendasOpciones: [{ nombre: 'En grano', metodo: 'x', disponible: false }, { nombre: 'Molido', metodo: 'x', disponible: true }],
  };
  assert.deepEqual(moliendasCasillas([productos[0], papayoSinGrano]), ['Molido']);
});

test('frecuenciaEstructuraPorSlot: 1=quincenal, 2=mensual, 3=bimestral, 4=trimestral', () => {
  assert.deepEqual(frecuenciaEstructuraPorSlot(1), { enviosPorMes: 2, cadaNMeses: 1 });
  assert.deepEqual(frecuenciaEstructuraPorSlot(2), { enviosPorMes: 1, cadaNMeses: 1 });
  assert.deepEqual(frecuenciaEstructuraPorSlot(3), { enviosPorMes: 1, cadaNMeses: 2 });
  assert.deepEqual(frecuenciaEstructuraPorSlot(4), { enviosPorMes: 1, cadaNMeses: 3 });
});

test('topeUnidadesCasilla: 9 por defecto, acotado por maxCompra si el catálogo lo declara', () => {
  const matriz = derivarMatrizTaquilla(chamisas())!;
  const producto = matriz.celdas.get(celdaDe('Bourbon Rosado', 340))!;
  assert.equal(topeUnidadesCasilla(producto), 9);
  assert.equal(topeUnidadesCasilla({ ...producto, maxCompra: 4 }), 4);
  assert.equal(topeUnidadesCasilla({ ...producto, maxCompra: 20 }), 9);
});

// ─── SuscripcionCasillas — render (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1) ────────────────────────────
//
// `SuscripcionCasillas` recibe el catálogo por PROP (como `SuscripcionTaquilla`), así que se puede
// renderizar DIRECTO con SSR sin depender del `useEffect`/`getCatalog` de `SuscripcionPlanes` (que
// no corre bajo `renderToStaticMarkup`).

const PLANES_CASILLAS: SuscripcionPlanesContent = { ...DEFAULTS.suscripcionPlanes, variante: 'casillas' };

test('SuscripcionCasillas: con un catálogo válido, renderiza la apertura, el sticker y los TRES cafés', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: DEFAULTS,
      children: React.createElement(SuscripcionCasillas, {
        catalog: chamisas(), whatsapp: '573000000000', negocio: 'Café Las Chamisas', suscripcionPlanes: PLANES_CASILLAS,
      }),
    }),
  );
  assert.ok(html.includes('Sin cobro automático'), 'el sticker por defecto debe aparecer');
  assert.ok(html.includes('Bourbon Rosado'), 'debe listar el primer café');
  assert.ok(html.includes('Pacamara'), 'debe listar el segundo café');
  assert.ok(html.includes('Papayo'), 'debe listar el tercer café');
  assert.ok(html.includes('Nota de pedido'), 'la pieza de nota de pedido debe aparecer');
  assert.ok(html.includes('elige al menos un café'), 'sin selección, el placeholder de la nota debe aparecer');
});

test('SuscripcionCasillas: sin catálogo válido (una matriz nula no debería montarse — guard de SuscripcionPlanes), este componente NO re-valida solo', () => {
  // `SuscripcionCasillas` asume que YA recibió una matriz válida (el chequeo vive en
  // `SuscripcionPlanes.tsx`, § el comentario de cabecera de ese archivo) — con un catálogo de UN
  // solo producto, `derivarMatrizTaquilla` interno devuelve `null` y el componente no debe lanzar,
  // simplemente no renderiza nada (mismo criterio que `SuscripcionTaquilla` con `!matriz`).
  const unSoloProducto = chamisas().slice(0, 1);
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: DEFAULTS,
      children: React.createElement(SuscripcionCasillas, {
        catalog: unSoloProducto, whatsapp: '573000000000', suscripcionPlanes: PLANES_CASILLAS,
      }),
    }),
  );
  assert.equal(html, '');
});

test('SuscripcionCasillas: el mensaje de WhatsApp de la barra/nota usa el NEGOCIO recibido por prop', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: DEFAULTS,
      children: React.createElement(SuscripcionCasillas, {
        catalog: chamisas(), whatsapp: '573000000000', negocio: 'Café Las Chamisas', suscripcionPlanes: PLANES_CASILLAS,
      }),
    }),
  );
  assert.ok(html.includes('Hola, Café Las Chamisas'), 'el saludo de la nota debe nombrar al negocio recibido por prop');
});

test('byte-identidad: SuscripcionPlanes con variante "casillas" NUNCA se monta sin un catálogo válido pasado por prop — con los DEFAULTS (variante "tarjetas") la composición sigue intacta', () => {
  // Esta es la MISMA aserción que ya corre arriba ("byte-identidad: /suscripciones con los
  // DEFAULTS..."), repetida acá para que quede junto a las pruebas de Casillas: con
  // `suscripcionPlanes.variante` en su default ('tarjetas'), `SuscripcionCasillas` nunca se importa
  // en el árbol que renderiza /suscripciones — Nayoli y cualquier tenant sin fila quedan
  // byte-idénticos a antes de este slice.
  assert.equal(DEFAULTS.suscripcionPlanes.variante, 'tarjetas');
});

// ─── SuscripcionCierre «Costura» (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1) ─────────────────────────────

function contentConCierre(overrides: Partial<SiteContentData['suscripcionCierre']>): SiteContentData {
  return {
    ...DEFAULTS,
    suscripcionCierre: { ...DEFAULTS.suscripcionCierre, frase: '¿Prefieres hablarlo primero?', ctaLabel: 'Ver el catálogo', ctaDestino: '/tienda', ...overrides },
  };
}

test('SuscripcionCierre: con los DEFAULTS (variante "fraseYBoton", sin frase) no renderiza nada', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(SuscripcionCierre) }),
  );
  assert.equal(html, '');
});

test('SuscripcionCierre: variante "costura" monta el marco punteado (CierreCostura), no CierreFraseYBoton', () => {
  const content = contentConCierre({ variante: 'costura' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(SuscripcionCierre) }),
  );
  assert.ok(html.includes('border-dashed'), 'el marco punteado de Costura debe estar presente');
  assert.ok(html.includes('¿Prefieres hablarlo primero?'));
  assert.ok(html.includes('Ver el catálogo'));
  assert.ok(!html.includes('--sf-papel'), 'Costura no lleva la banda --sf-papel de Frase y botón');
});

test('SuscripcionCierre: variante "fraseYBoton" (con frase) sigue montando la banda --sf-papel, byte-idéntica a antes de este slice', () => {
  const content = contentConCierre({ variante: 'fraseYBoton' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(SuscripcionCierre) }),
  );
  assert.ok(html.includes('--sf-papel'), 'Frase y botón debe seguir pintando la banda --sf-papel');
  assert.ok(!html.includes('border-dashed'), 'Frase y botón no lleva el marco punteado de Costura');
});

test('TiendaCierre: la extracción a CierreCostura no cambió su composición "costura" — sigue sin --sf-papel', () => {
  const content: SiteContentData = { ...DEFAULTS, tiendaCierre: { ...DEFAULTS.tiendaCierre, frase: 'Tres cafés, una finca.', boton: 'Ver los tres cafés' } };
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(TiendaCierre) }),
  );
  assert.ok(html.includes('border-dashed'));
  assert.ok(!html.includes('--sf-papel'));
});

// ─── § ONIX-TAQUILLA-FILETES-1 — los filetes de la tabla, LA REGLA no un parche de la fila CADA ───
//
// El owner reportó dos defectos puntuales (la última fila no cerraba abajo; «15 DÍAS» no tenía
// línea izquierda), pero el fix es de la CELDA, no de esas dos filas (§ el docstring de
// `FilaTaquilla`, SuscripcionTaquilla.tsx): cada celda —etiqueta y dato— lleva su propio
// `border-b`, y cada celda de dato lleva `border-l` SIEMPRE (ya no se salta la primera). Estas dos
// pruebas lo afirman con DOS matrices distintas —una donde la última fila es «Cada» (sin
// moliendas, el caso que el owner miró) y otra donde la última fila es «Molienda» (un producto con
// `moliendasOpciones`)— para que la regla quede probada como regla, no como coincidencia de una
// sola fila.

function catalogoOnix2x2(conMolienda: boolean): Product[] {
  const base = { costo: 0, sku: null, stock: 10, activo: true, disponible: true, descripcion: '', imagen: '', notas: [] as string[] };
  const moliendasMolido250 = conMolienda
    ? [{ metodo: '', nombre: 'Media', disponible: true }, { metodo: '', nombre: 'Fina', disponible: true }]
    : [];
  return [
    { ...base, id: 'p1', nombre: 'Onix grano 250', slug: 'onix-grano-250', categoria: 'Café en Grano', precio: 20000, peso_gramos: 250, moliendasOpciones: [] },
    { ...base, id: 'p2', nombre: 'Onix grano 500', slug: 'onix-grano-500', categoria: 'Café en Grano', precio: 35000, peso_gramos: 500, moliendasOpciones: [] },
    { ...base, id: 'p3', nombre: 'Onix molido 250', slug: 'onix-molido-250', categoria: 'Café Molido', precio: 20000, peso_gramos: 250, moliendasOpciones: moliendasMolido250 },
    { ...base, id: 'p4', nombre: 'Onix molido 500', slug: 'onix-molido-500', categoria: 'Café Molido', precio: 35000, peso_gramos: 500, moliendasOpciones: [] },
  ] as Product[];
}

// Tres frecuencias (§ el spec de este slice: "al menos tres"), las mismas que `DEFAULTS` ya trae.
const PLANES_TRES_FRECUENCIAS: SuscripcionPlanesContent = {
  ...DEFAULTS.suscripcionPlanes,
  frecuencia1: '15 días', frecuencia2: 'Mes', frecuencia3: '2 meses', frecuencia4: '',
};

test('FilaTaquilla: la ÚLTIMA fila cierra con su línea inferior — cuando es "Cada" (sin moliendas) Y cuando es "Molienda" (con moliendas), no sólo en la que el owner miró', () => {
  // Sin moliendas en "Café Molido 250" (la celda default: última fila × primera columna):
  // decidirMolienda da modo 'ninguna' -> NO hay fila de molienda -> la última fila es "Cada".
  const htmlSinMolienda = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: catalogoOnix2x2(false), whatsapp: '573000000000', suscripcionPlanes: PLANES_TRES_FRECUENCIAS }),
  );
  const inicioFilaCada = htmlSinMolienda.lastIndexOf('<div class="flex min-h-[54px] items-center border-b', htmlSinMolienda.indexOf('>Cada<'));
  const filaCada = htmlSinMolienda.slice(inicioFilaCada);
  // La etiqueta "Cada" + sus 3 opciones (15 días/Mes/2 meses) = 4 celdas, las 4 con `border-b`.
  assert.equal((filaCada.match(/>15 días<\/button>|>Mes<\/button>|>2 meses<\/button>/g) ?? []).length, 3, 'las 3 opciones de frecuencia deben estar en el tramo medido');
  assert.equal((filaCada.match(/border-b/g) ?? []).length, 4, 'la etiqueta "Cada" + sus 3 opciones deben llevar border-b cada una (4 en total)');
  assert.ok(!htmlSinMolienda.includes('>Molienda<'), 'sin moliendas en el producto elegido, no debe existir una fila "Molienda"');

  // Con moliendas en "Café Molido 250": decidirMolienda da modo 'eleccion' -> SÍ hay fila de
  // molienda, que pasa a ser la ÚLTIMA. Debe cerrar igual, SIN tocar código: misma regla por celda.
  const htmlConMolienda = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: catalogoOnix2x2(true), whatsapp: '573000000000', suscripcionPlanes: PLANES_TRES_FRECUENCIAS }),
  );
  assert.ok(htmlConMolienda.includes('>Molienda<'), 'con moliendas en el producto elegido, debe existir la fila "Molienda"');
  const inicioFilaMolienda = htmlConMolienda.lastIndexOf('<div class="flex min-h-[54px] items-center border-b', htmlConMolienda.indexOf('>Molienda<'));
  const filaMolienda = htmlConMolienda.slice(inicioFilaMolienda);
  assert.equal((filaMolienda.match(/>Media<\/button>|>Fina<\/button>/g) ?? []).length, 2, 'las 2 opciones de molienda deben estar en el tramo medido');
  assert.equal((filaMolienda.match(/border-b/g) ?? []).length, 3, 'la etiqueta "Molienda" + sus 2 opciones deben llevar border-b cada una (3 en total) — la ÚLTIMA fila cierra, sea "Cada" o "Molienda"');

  // El CONTENEDOR nunca duplica el cierre: su único filete horizontal propio es el `border-t` del
  // techo (cada celda cierra su propio fondo, así que un `border-b` de contenedor sería redundante).
  const contenedor = htmlSinMolienda.slice(htmlSinMolienda.indexOf('grid mt-[22px]'), htmlSinMolienda.indexOf('grid mt-[22px]') + 120);
  assert.ok(contenedor.includes('border-t'), 'el contenedor debe seguir dando el techo (border-t), una vez');
});

test('FilaTaquilla: TODA primera celda de fila lleva su línea izquierda — "15 DÍAS" es el ejemplo reportado, no el único caso', () => {
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: catalogoOnix2x2(false), whatsapp: '573000000000', suscripcionPlanes: PLANES_TRES_FRECUENCIAS }),
  );
  // 2 (header: 250g/500g) + 2+2 (precio × 2 categorías) + 3 (bolsas) + 3 (frecuencia) = 12 celdas de
  // dato, TODAS con `border-l` ahora (antes la primera de cada fila se saltaba) + 1 del contenedor.
  assert.equal((html.match(/border-l/g) ?? []).length, 13, '12 celdas de dato + 1 del contenedor — ninguna primera celda debe quedar sin su línea izquierda');

  // La celda REPORTADA, "15 DÍAS" (primera opción de la fila "Cada"): su propio <button> debe
  // llevar `border-l`, no sólo una celda vecina.
  const idxBoton15Dias = html.indexOf('>15 días</button>');
  const inicioBoton = html.lastIndexOf('<button', idxBoton15Dias);
  const boton15Dias = html.slice(inicioBoton, idxBoton15Dias);
  assert.ok(boton15Dias.includes('border-l'), 'el <button> de "15 DÍAS" debe llevar border-l en su propia clase — no en un vecino');

  // Y la PRIMERA celda de una fila de PRECIO (no reportada por el owner, pero la misma regla):
  // "Café en Grano" × 250 g = "$ 20.000", primer botón de esa fila.
  const idxGrano = html.indexOf('>Café en Grano<');
  const idxPrimerPrecio = html.indexOf('<button', idxGrano);
  const idxCierrePrimerPrecio = html.indexOf('>', html.indexOf('"', idxPrimerPrecio));
  const primerPrecio = html.slice(idxPrimerPrecio, idxCierrePrimerPrecio);
  assert.ok(primerPrecio.includes('border-l'), 'la primera celda de precio ("Café en Grano" × 250 g) también debe llevar border-l — la regla es de la celda, no de la fila "Cada"');
});
