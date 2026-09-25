import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import GrindChooserRiel from '@/components/storefront/home/GrindChooserRiel';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { SECCIONES_TIENDA, type SeccionConfig } from '@/components/admin/tienda-secciones';

import { DEFAULTS, type PresentacionesContent, type SiteContentData } from './site-content-defaults';

// CORTE-TITULARES-SALTOS-DE-LINEA-1 (cierra PANEL-EDITOR-SPOTLIGHT-TITULO-SALTOS-1) — el hueco,
// MEDIDO contra `docs/prototipos/cafeone/index.html`: son los ÚNICOS DOS `<h[12]>` con `<br>` de
// todo el prototipo —
//   :166 `.spotlight`      "Un solo origen,<br>cuidado de principio<br>a fin."
//   :231 `.presentaciones` "Nuestro café.<br>4 presentaciones."
// — y ninguno de los dos se podía escribir desde el panel: el campo `titulo` era de una línea
// (`<input>`, sin `textarea:true`) y el `<h2>` que lo rinde no preservaba saltos. Este archivo
// afirma las DOS mitades del arreglo: el CAMPO (textarea:true en `tienda-secciones.ts`, § abajo) y
// el RENDER (`whitespace-pre-line` en los `<h2>` de `Spotlight.tsx`/`GrindChooserRiel.tsx`) — y que
// NINGÚN otro campo `titulo` del repo quedó tocado (el hueco era sólo de esos dos titulares).

function seccion(nombre: string): SeccionConfig {
  const s = SECCIONES_TIENDA.find((s) => s.seccion === nombre);
  assert.ok(s, `sección "${nombre}" no encontrada en SECCIONES_TIENDA`);
  return s!;
}

function campoTexto(seccionNombre: string, campoNombre: string) {
  const c = seccion(seccionNombre).campos.find((c) => c.name === campoNombre);
  assert.ok(c, `campo "${campoNombre}" no encontrado en la sección "${seccionNombre}"`);
  return c!;
}

// ─── EL CAMPO — SPOTLIGHT.titulo y PRESENTACIONES.titulo declaran textarea:true ───────────────────

test('SPOTLIGHT.titulo declara textarea:true — el dueño puede escribir un salto de línea de autor', () => {
  assert.equal(campoTexto('spotlight', 'titulo').textarea, true);
});

test('PRESENTACIONES.titulo declara textarea:true — el dueño puede escribir un salto de línea de autor', () => {
  assert.equal(campoTexto('presentaciones', 'titulo').textarea, true);
});

// ─── NINGÚN OTRO "titulo" DEL REPO QUEDÓ TOCADO — el hueco era sólo de esos dos titulares ─────────

test('ningún otro campo llamado "titulo" de SECCIONES_TIENDA quedó marcado textarea por este slice', () => {
  const otras = SECCIONES_TIENDA.filter((s) => s.seccion !== 'spotlight' && s.seccion !== 'presentaciones');
  assert.ok(otras.length > 0, 'sanity: debe haber otras secciones con campo titulo para que esta prueba afirme algo');
  let tituloVistos = 0;
  for (const s of otras) {
    const t = s.campos.find((c) => c.name === 'titulo');
    if (!t) continue;
    tituloVistos += 1;
    assert.notEqual(t.textarea, true, `"${s.seccion}".titulo no era parte del hueco medido — no debía tocarse`);
  }
  assert.ok(tituloVistos > 0, 'sanity: debe existir al menos un campo "titulo" fuera de spotlight/presentaciones');
});

// ─── EL RENDER, GrindChooserRiel — SSR REAL, mismo patrón que site-content-defaults.test.ts ────────
//
// (SIN jsdom, § CLAUDE.md "El glob NO incluye *.test.tsx"; `renderToStaticMarkup` es texto puro.
// GrindChooserRiel no depende de un fetch async — a diferencia de Spotlight, abajo — así que acá SÍ
// se puede afirmar el HTML real, no sólo la fuente declarada.)

function renderRiel(pres: PresentacionesContent): string {
  const content = { ...DEFAULTS, presentaciones: pres } as SiteContentData;
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(GrindChooserRiel) }),
  );
}

test('GrindChooserRiel: el <h2> del titular lleva whitespace-pre-line', () => {
  const html = renderRiel({ ...DEFAULTS.presentaciones, variante: 'riel' });
  assert.match(html, /<h2[^>]*class="[^"]*\bwhitespace-pre-line\b[^"]*"[^>]*>/);
});

test('GrindChooserRiel: un titulo con salto de línea de autor queda DENTRO del <h2> con la clase que lo preserva — no basta con que el "\\n" aparezca en algún lado del HTML', () => {
  const conSalto = 'Nuestro café.\n4 presentaciones.';
  const html = renderRiel({ ...DEFAULTS.presentaciones, variante: 'riel', titulo: conSalto });
  const m = html.match(/<h2[^>]*class="([^"]*)"[^>]*>([^<]*)<\/h2>/);
  assert.ok(m, 'no se encontró el <h2> del titular en el HTML rendido');
  const [, clases, contenido] = m!;
  assert.match(clases, /\bwhitespace-pre-line\b/, 'el <h2> que envuelve el salto debe llevar whitespace-pre-line');
  assert.equal(contenido, conSalto, 'el contenido del <h2> debe ser el titular EXACTO, con su "\\n" intacto');
});

test('GrindChooserRiel: Nayoli (titulo sin salto) sigue mostrando su texto tal cual — whitespace-pre-line no lo altera', () => {
  const html = renderRiel({ ...DEFAULTS.presentaciones, variante: 'riel' });
  assert.ok(html.includes(DEFAULTS.presentaciones.titulo));
});

// ─── EL RENDER, Spotlight — POR DECLARACIÓN DE FUENTE, no por SSR ──────────────────────────────────
//
// LÍMITE (heredado de spotlight-cableado.test.ts, § su propio comentario): `Spotlight.tsx` fetchea
// el catálogo en un `useEffect` que `renderToStaticMarkup` nunca corre, así que el componente
// SIEMPRE rinde `null` en este carril (catálogo vacío → `productoSpotlight` devuelve `null` →
// `if (!producto) return null`), sea cual sea `spotlight.titulo`. El propio `useCartStore()` que el
// componente llama sin condición además exige `<CartProvider>` (§ CLAUDE.md, "un hook con nombre de
// STORE puede ser un CONTEXT con throw duro") — envolverlo no cambiaría el resultado, sigue sin
// producto. Por eso la verificación de ESTE componente es por FUENTE (mismo patrón que
// `spotlight-cableado.test.ts:134-139`, que ya lee `FeaturedProducts.tsx` por la misma razón), tal
// como el spec de este slice autoriza explícitamente para este caso.

function fuenteSpotlight(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/home/Spotlight.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('Spotlight.tsx: el <h2> que rinde spotlight.titulo lleva whitespace-pre-line', () => {
  const src = fuenteSpotlight();
  // La misma línea debe: (a) interpolar `{spotlight.titulo}`, (b) llevar la clase en su `className`.
  const lineaH2 = src.split('\n').find((l) => l.includes('{spotlight.titulo}'));
  assert.ok(lineaH2, 'no se encontró la línea del <h2> que rinde spotlight.titulo');
  assert.match(lineaH2!, /<h2\b/);
  assert.match(lineaH2!, /className="[^"]*\bwhitespace-pre-line\b[^"]*"/);
});
