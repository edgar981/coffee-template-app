import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DEFAULTS } from '@/lib/config/site-content-defaults';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { ModoEditorProvider } from '@/components/storefront/ModoEditor';

// ─── item 2: /tienda gana `data-editor-seccion` (EDITOR-TIENDA-SIN-MARCADOR-SECCION-1) ─────────────
//
// Antes de este slice /tienda era la ÚNICA de las cuatro páginas sin este marcador: el click-to-edit
// de TEXTO funcionaba (su propio `data-editor-campo`), pero "tocar cualquier punto de la sección la
// abre en el panel" (lo que `EditorPuenteVivo.tsx` lee por `closest('[data-editor-seccion]')`) no.
//
// Se prueban las TRES ramas de layout (Legacy/Corte/Apertura) + las tres secciones de cola
// (créditos/interludio/cierre) — la misma forma que ya exigía `onix-paginas-fidelidad.test.ts` para
// el resto de las piezas de /tienda: render EN MEMORIA, sin red, sin DOM.
import Shop from '@/app/(storefront)/tienda/page';

// `ShopLegacy`/`ShopCorte`/`ShopApertura`/`TiendaAlbumExtra`/`bandaNodo` NO se exportan — son
// funciones internas de `page.tsx`, y agregar un export sólo para el test ensancharía la superficie
// pública de un Page component (convención de Next: el único export válido es el default). Se prueba
// por tanto el ÁRBOL COMPLETO (`Shop`, el default export), que es lo que el storefront monta de
// verdad — más fiel que aislar una función interna.
import { SiteSettingsProvider } from '@/components/storefront/SiteSettingsProvider';

const SETTINGS = { nombre: 'Café Nayoli', whatsapp: '', instagram: '', descripcionFooter: '', emailRemitente: '', emailReplyTo: '', adminEmail: '', redes: [] } as any;

function renderShop(enModoEditor: boolean): string {
  return renderToStaticMarkup(
    React.createElement(ModoEditorProvider, {
      activo: enModoEditor,
      children: React.createElement(SiteSettingsProvider, {
        value: SETTINGS,
        children: React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(Shop) }),
      }),
    }),
  );
}

test('/tienda, SIN modo editor: cero `data-editor-seccion` — byte-idéntico (el contrato que ya cumple CampoEditable)', () => {
  const html = renderShop(false);
  assert.ok(!html.includes('data-editor-seccion'), 'sin modo editor no debe aparecer ningún marcador de sección');
});

test('/tienda, EN modo editor: las cinco secciones quedan marcadas — tiendaEncabezado, tiendaCatalogo, tiendaCreditos, tiendaInterludio, tiendaCierre', () => {
  const html = renderShop(true);
  for (const id of ['tiendaEncabezado', 'tiendaCatalogo']) {
    assert.ok(html.includes(`data-editor-seccion="${id}"`), `falta el marcador de "${id}" (rama Legacy, DEFAULTS.tiendaCatalogo.variante = 'actual')`);
  }
  // `tiendaCreditos`/`tiendaInterludio`/`tiendaCierre` se auto-ocultan con los DEFAULTS (hide-on-
  // empty/piso de filas/nacen apagadas) — el marcador existe igual, como un `<div>` vacío, MISMO
  // criterio que `bandaNodo` de /nosotros (envuelve incondicionalmente, con o sin contenido).
  for (const id of ['tiendaCreditos', 'tiendaInterludio', 'tiendaCierre']) {
    assert.ok(html.includes(`data-editor-seccion="${id}"`), `falta el marcador de "${id}" (aunque la sección esté oculta con los DEFAULTS)`);
  }
});

// ─── item 3: las filas de Créditos quedan clicables, con el ÍNDICE ORIGINAL (EDITOR-CREDITOSFILAS-
// INDICE-ORIGINAL-1) ─────────────────────────────────────────────────────────────────────────────
//
// La reproducción exacta del defecto que EDITOR-ORDEN-Y-LIENZO-1 dejó abierto: una fila a medias en
// el MEDIO de `tiendaCreditos.items` NO debe correr el campo de la fila siguiente — el clic en la
// SEGUNDA fila VISIBLE ("Pausa") tiene que abrir `items.2`, nunca `items.1` (la incompleta).
import TiendaCreditos from '@/components/storefront/tienda/TiendaCreditos';

function conTiendaCreditos(items: { etiqueta: string; valor: string }[]) {
  return {
    ...DEFAULTS,
    tiendaCreditos: { visible: true, items },
  };
}

function renderConModoEditor(node: React.ReactElement, content: typeof DEFAULTS): string {
  return renderToStaticMarkup(
    React.createElement(ModoEditorProvider, {
      activo: true,
      children: React.createElement(SiteContentProvider, { value: content, children: node }),
    }),
  );
}

test('TiendaCreditos: una fila a medias en el medio no corre el campo de la fila siguiente', () => {
  // CUATRO ítems — el PISO de `creditosVisibles` exige 3 filas COMPLETAS (§ MIN_FILAS_CREDITOS,
  // lib/tienda/creditos.ts); con sólo 2 completas la sección entera se oculta y el test no mediría
  // nada. El incompleto va en el medio (slot 1), a propósito.
  const content = conTiendaCreditos([
    { etiqueta: 'Pago', valor: 'Contraentrega' },
    { etiqueta: 'Envío', valor: '' }, // a medias — se filtra, NO debe contarse en el índice
    { etiqueta: 'Pausa', valor: 'Cuando quieras' },
    { etiqueta: 'Molienda', valor: 'A elegir' },
  ]);
  const html = renderConModoEditor(React.createElement(TiendaCreditos), content);
  assert.ok(html.includes('data-editor-campo="tiendaCreditos.items.0.etiqueta"'), 'la 1ª fila visible debe apuntar al ítem 0');
  assert.ok(html.includes('data-editor-campo="tiendaCreditos.items.2.etiqueta"'), 'la 2ª fila visible debe apuntar al ítem 2 — NO al 1 (el incompleto)');
  assert.ok(html.includes('data-editor-campo="tiendaCreditos.items.3.etiqueta"'), 'la 3ª fila visible debe apuntar al ítem 3');
  assert.ok(!html.includes('data-editor-campo="tiendaCreditos.items.1.etiqueta"'), 'el ítem incompleto nunca debe aparecer como campo clicable');
});

test('TiendaCreditos, SIN modo editor: cero `data-editor-campo` en las filas — byte-idéntico', () => {
  const content = conTiendaCreditos([
    { etiqueta: 'Pago', valor: 'Contraentrega' },
    { etiqueta: 'Envío', valor: 'Gratis' },
    { etiqueta: 'Pausa', valor: 'Cuando quieras' },
  ]);
  const html = renderToStaticMarkup(
    React.createElement(ModoEditorProvider, {
      activo: false,
      children: React.createElement(SiteContentProvider, { value: content, children: React.createElement(TiendaCreditos) }),
    }),
  );
  assert.ok(!html.includes('data-editor-campo'), 'sin modo editor las filas no deben llevar ningún marcador de campo');
});

// ─── item 4: `CampoBooleano` respeta `composiciones` (EDITOR-CAMPOBOOLEANO-COMPOSICIONES-1) ────────
//
// El defecto REAL, medido contra el código del mismo día (`ONIX-TAQUILLA-SOLO-TABLA-1`): los cinco
// `taquillaMostrar*` de `suscripcionPlanes` no tienen efecto bajo "Tarjetas"/"Casillas" —
// `SuscripcionPlanes.tsx`/`SuscripcionCasillas.tsx` nunca los leen—, pero antes de este fix
// aparecían ahí igual, con un hint que nadie hacía cumplir.
import { aplicaAComposicion } from '@/lib/admin/editor-composicion-campos';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';

const SUSCRIPCION_PLANES = SECCIONES_TIENDA.find((s) => s.seccion === 'suscripcionPlanes')!;

test('suscripcionPlanes: los cinco `taquillaMostrar*` sólo aplican bajo "taquilla" — plegados bajo "tarjetas"/"casillas"', () => {
  const nombres = ['taquillaMostrarResumen', 'taquillaMostrarReferencia', 'taquillaMostrarSeEnvia', 'taquillaMostrarAviso', 'taquillaMostrarCreditos'];
  for (const n of nombres) {
    const b = SUSCRIPCION_PLANES.booleanos!.find((x) => x.name === n)!;
    assert.ok(b, `"${n}" debería estar en booleanos`);
    assert.equal(aplicaAComposicion(b, 'taquilla'), true, `"${n}" debe aplicar bajo "taquilla"`);
    assert.equal(aplicaAComposicion(b, 'tarjetas'), false, `"${n}" NO debe aplicar bajo "tarjetas" — SuscripcionPlanes.tsx nunca lo lee`);
    assert.equal(aplicaAComposicion(b, 'casillas'), false, `"${n}" NO debe aplicar bajo "casillas" — SuscripcionCasillas.tsx nunca lo lee`);
  }
});

test('tiendaCatalogo/featured/nosotrosEscenas: los booleanos "universales" (sin `composiciones`) NO se tocaron — siguen aplicando a TODAS', () => {
  // § el docstring de `CampoBooleano`: `mostrarPrecioPor100g`/`barraFijaMovil`/`esquineros` son
  // deliberadamente universales (cada uno con su propio comentario "se edita siempre, no sólo
  // cuando aplica") — este fix NO los retroactiva. Se afirma explícito para que una futura limpieza
  // no los confunda con el defecto que SÍ se cerró.
  const casos: [string, string][] = [
    ['tiendaCatalogo', 'barraFijaMovil'],
    ['nosotrosEscenas', 'esquineros'],
  ];
  for (const [seccion, nombreCampo] of casos) {
    const config = SECCIONES_TIENDA.find((s) => s.seccion === seccion)!;
    const b = config.booleanos!.find((x) => x.name === nombreCampo)!;
    assert.equal(b.composiciones, undefined, `"${seccion}.${nombreCampo}" debe seguir SIN \`composiciones\` — universal a propósito`);
    assert.equal(aplicaAComposicion(b, 'cualquier-cosa'), true);
  }
});
