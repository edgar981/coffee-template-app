import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Origen from '@/components/storefront/home/Origen';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import {
  BANDA_IDS,
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  seccionEsVisible,
  type SiteContentData,
} from './site-content-defaults';
import { CORTE, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// ORIGEN-BANDA-1 (medido: ORIGEN-BANDA-CENSO-1) — grid de 2 fotos + copy + 4 pares dato editoriales
// a nivel finca + 3 contadores animados. A DIFERENCIA de spotlight (variante de `featured`, § su
// propio archivo de carril), `origen` ES miembro de `BANDA_IDS`. Este archivo afirma el modelo
// (REGISTRY/DEFAULTS), el gate de visibilidad, el cableado del preset (CORTE la enciende, los demás
// no la tocan) y el render por `renderToStaticMarkup` (sin jsdom, § CLAUDE.md) — incluida la MITAD
// verificable del contador (el gate estático; el rAF/IntersectionObserver real es capa 3, mismo
// límite que `historia-direccion-arte.test.ts` documenta para el otro motor de movimiento).
//
// LOS DEFAULTS SON GENÉRICOS Y SUS VALORES (dato*Valor/stat*) NACEN VACÍOS (§ el docstring de
// `OrigenContent`, site-content-defaults.ts) — no hay cifra fabricada que animar sin panel; por eso
// los tests del CONTADOR usan un `content` con valores explícitos, no los DEFAULTS.

function renderOrigen(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(Origen) });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('origen ES miembro de BANDA_IDS (a diferencia de spotlight), posicionada tras brandStory', () => {
  assert.equal((BANDA_IDS as readonly string[]).includes('origen'), true);
  const idx = (BANDA_IDS as readonly string[]).indexOf('origen');
  assert.equal(BANDA_IDS[idx - 1], 'brandStory');
  assert.equal(BANDA_IDS[idx + 1], 'presentaciones');
});

test('DEFAULTS.origen nace OFF (visible:false) — la banda no se enciende sola', () => {
  assert.equal(DEFAULTS.origen.visible, false);
});

test('DEFAULTS.origen: los LABELS de los 4 datos tienen texto; los VALORES y los 3 stats nacen VACÍOS — nada fabricado', () => {
  for (const label of [DEFAULTS.origen.dato1Label, DEFAULTS.origen.dato2Label, DEFAULTS.origen.dato3Label, DEFAULTS.origen.dato4Label]) {
    assert.notEqual(label.trim(), '');
  }
  for (const valor of [DEFAULTS.origen.dato1Valor, DEFAULTS.origen.dato2Valor, DEFAULTS.origen.dato3Valor, DEFAULTS.origen.dato4Valor]) {
    assert.equal(valor, '');
  }
  for (const campo of [
    DEFAULTS.origen.statNumero1, DEFAULTS.origen.statEtiqueta1,
    DEFAULTS.origen.statNumero2, DEFAULTS.origen.statEtiqueta2,
    DEFAULTS.origen.statNumero3, DEFAULTS.origen.statEtiqueta3,
  ]) {
    assert.equal(campo, '');
  }
});

test('REGISTRY.origen: ocultable, sin variantes, con los 2 campos-imagen declarados para el borrado de blobs', () => {
  assert.equal(REGISTRY.origen.ocultable, true);
  assert.equal(REGISTRY.origen.variantes, undefined);
  assert.equal(REGISTRY.origen.repeater, undefined);
  assert.deepEqual(REGISTRY.origen.imagenes, ['imagen1', 'imagen2']);
});

test('REGISTRY.origen: los 4 LABELS son requeridos; los 4 VALORES y los 6 campos de stat son opcionales', () => {
  const c = REGISTRY.origen.campos;
  assert.equal(c.dato1Label, 'requerido');
  assert.equal(c.dato1Valor, 'opcional');
  assert.equal(c.statNumero1, 'opcional');
  assert.equal(c.statEtiqueta1, 'opcional');
});

test('sin fila (Nayoli), origen resuelve OFF — DEFAULTS y el gate coinciden', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.origen, DEFAULTS.origen);
  assert.equal(seccionEsVisible(REGISTRY.origen, resuelto.origen), false);
});

test('con visible explícito en true, la sección deja de ocultarse — la garantía de arriba es del DEFAULT, no de un `ocultable:false`', () => {
  const resuelto = resolverSiteContent({ origen: { visible: true } });
  assert.equal(resuelto.origen.visible, true);
  assert.equal(seccionEsVisible(REGISTRY.origen, resuelto.origen), true);
});

// ─── EL RENDER — LA INVARIANTE: Nayoli queda BYTE-IDÉNTICA ─────────────────────────────────────

test('LA INVARIANTE: Nayoli (resolverSiteContent({}), sin fila) rinde la banda VACÍA — ni un nodo', () => {
  const html = renderOrigen(resolverSiteContent({}));
  assert.equal(html, '');
});

test('con `origen.visible:true` y los DEFAULTS (sin valores cargados): rinde el copy, pero SIN lista de datos ni contadores — hide-on-empty', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(html.includes(DEFAULTS.origen.titulo));
  assert.ok(html.includes(DEFAULTS.origen.lede));
  assert.ok(!html.includes('<dl'), 'sin un solo dato con valor, el <dl> entero no debe rendir');
  assert.ok(!html.includes(DEFAULTS.origen.dato1Label), 'un label sin valor tampoco aparece — el par se omite completo');
});

test('con datos y stats CARGADOS (contenido explícito, no los DEFAULTS): la lista y los 3 contadores SÍ rinden', () => {
  const content = {
    ...DEFAULTS,
    origen: {
      ...DEFAULTS.origen,
      visible: true,
      dato1Valor: '1.500 – 1.800 msnm',
      dato2Valor: 'Caturra y Colombia',
      statNumero1: '1600', statEtiqueta1: 'msnm promedio',
      statNumero2: '12', statEtiqueta2: 'hectáreas sembradas',
      statNumero3: '52', statEtiqueta3: 'años de tradición',
    },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(html.includes(DEFAULTS.origen.dato1Label));
  assert.ok(html.includes('1.500 – 1.800 msnm'));
  assert.ok(html.includes(DEFAULTS.origen.dato2Label));
  assert.ok(!html.includes(DEFAULTS.origen.dato3Label), 'dato3 sin valor sigue omitido aunque dato1/2 tengan');
  for (const etiqueta of ['msnm promedio', 'hectáreas sembradas', 'años de tradición']) {
    assert.ok(html.includes(etiqueta), `falta la etiqueta "${etiqueta}"`);
  }
});

// ─── EL CONTADOR — el gate ESTÁTICO (§ lib/animation.test.ts para la matemática pura) ────────────
//
// LO QUE SE PUEDE AFIRMAR SIN NAVEGADOR (mismo límite que `historia-direccion-arte.test.ts`): el
// PROXY de movimiento reducido es la VISTA PREVIA (`PreviewProvider`) — las dos razones colapsan al
// MISMO `estatico` en `Origen.tsx`/`useContadorAnimado`, así que ejercer una prueba la otra.
// `prefers-reduced-motion` en tiempo real depende de `matchMedia`, que no existe en este carril.

const CONTENT_CON_STATS = {
  ...DEFAULTS,
  origen: {
    ...DEFAULTS.origen,
    visible: true,
    statNumero1: '1600', statEtiqueta1: 'msnm promedio',
    statNumero2: '12', statEtiqueta2: 'hectáreas sembradas',
    statNumero3: '52', statEtiqueta3: 'años de tradición',
  },
} as SiteContentData;

test('EN PREVIEW (proxy de movimiento reducido): el contador nace YA en su valor final, "1.600" — nunca en "0"', () => {
  const html = renderOrigen(CONTENT_CON_STATS, { preview: true });
  assert.ok(html.includes('1.600'), 'statNumero1 ("1600") debe rendir formateado ya en su valor final');
  assert.ok(html.includes('>12<'), 'statNumero2 debe rendir "12" ya en su valor final');
  assert.ok(html.includes('>52<'), 'statNumero3 debe rendir "52" ya en su valor final');
});

test('SIN preview (SSR, sin IntersectionObserver real): los tres contadores arrancan en "0" — el rAF no corrió', () => {
  const html = renderOrigen(CONTENT_CON_STATS);
  const ceros = html.match(/>0</g) || [];
  assert.equal(ceros.length, 3, 'las TRES estadísticas deben arrancar en 0 sin scroll/observer real');
  assert.ok(!html.includes('1.600'), 'sin el gate estático, el primer render no debe mostrar el valor final');
});

test('un `statNumeroN` vacío se OMITE (junto a su etiqueta) — nunca un "0" fabricado', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, statNumero1: '', statEtiqueta1: 'Sin dato' },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(!html.includes('Sin dato'), 'un stat sin número no debe rendir ni su etiqueta');
});

test('un `statNumeroN` no numérico (basura) tampoco se anima ni rompe — el filtro de "tiene valor" lo deja pasar, pero se muestra TAL CUAL', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, statNumero1: 'N/D', statEtiqueta1: 'Estado' },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(html.includes('N/D'), 'un valor no-numérico se muestra literal, no se descarta');
  assert.ok(html.includes('Estado'));
});

// ─── CORTE la enciende; los demás presets no tocan `content.origen` ─────────────────────────────

test('CORTE declara bandasVisibles.origen y le asigna esquema "crema" — sigue validando COMPLETO', () => {
  assert.equal(CORTE.bandasVisibles?.origen, true);
  assert.equal(CORTE.esquemas.origen, 'crema');
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent(_, CORTE): enciende origen.visible — si no, el slot quedaría en el orden y en blanco', () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const origen = despues.origen as Record<string, unknown>;
  assert.equal(origen.visible, true);
});

test('mergePresetEnContent(_, CORTE): preserva cualquier copy/dato que el dueño ya hubiera puesto, sólo enciende `visible`', () => {
  const antes = { ...DEFAULTS, origen: { ...DEFAULTS.origen, titulo: 'Mi propio título', dato1Valor: '2.000 msnm' } };
  const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, CORTE);
  const origen = despues.origen as Record<string, unknown>;
  assert.equal(origen.visible, true);
  assert.equal(origen.titulo, 'Mi propio título');
  assert.equal(origen.dato1Valor, '2.000 msnm');
});

test('mergePresetEnContent NO toca origen para un preset que NO declara bandasVisibles.origen (PATIO)', () => {
  assert.equal(PATIO.bandasVisibles?.origen, undefined);
  const despues = mergePresetEnContent({ ...DEFAULTS }, PATIO);
  assert.deepEqual(despues.origen, DEFAULTS.origen);
});

// ─── EL MIRADOR (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — origen sigue sin renderizar', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli);
  assert.equal(renderOrigen(sinTema), '');
});

test('?tema=CORTE sobre Nayoli: origen pasa a visible y el render trae el copy de los DEFAULTS (Nayoli no tiene fila propia; mergePresetEnContent nunca escribe texto de sección)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.origen.visible, true);

  const html = renderOrigen(conCorte);
  assert.ok(html !== '');
  assert.ok(html.includes(DEFAULTS.origen.titulo));
  // Consecuencia MEDIDA y aceptada (§ el docstring de `OrigenContent`): sin panel para cargar datos
  // reales, la lista y los contadores rinden vacíos bajo CORTE — mismo comportamiento que
  // `featured·spotlight` hoy sin catálogo real (§ spotlight-cableado.test.ts).
  assert.ok(!html.includes('<dl'), 'sin valores cargados, la lista de datos no rinde ni bajo CORTE');
});

test('?tema=CORTE NO toca ningún texto/dato de la sección — sólo `visible` (coherente con la garantía general del mirador)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.origen.titulo, nayoli.origen.titulo);
  assert.equal(conCorte.origen.lede, nayoli.origen.lede);
  assert.equal(conCorte.origen.dato1Valor, nayoli.origen.dato1Valor);
});
