import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  BANDA_IDS,
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  seccionEsVisible,
  productoSpotlight,
  productoOtraTalla,
} from './site-content-defaults';

// SPOTLIGHT (§ SPOTLIGHT-BANDA-1) — un solo producto PINEADO. Este archivo afirma la mitad PURA
// del feature (el modelo + el resolver del pin), no el render: `Spotlight.tsx`
// (components/storefront/home/) es un componente React ('use client', framer-motion, next/image)
// y este repo no tiene jsdom (§ CLAUDE.md, "el glob NO incluye *.test.tsx: los tests de COMPONENTE
// necesitan jsdom, que el repo no tiene") — así que su JSX no se ejercita acá. Lo que SÍ se afirma
// es lo que decide QUÉ se muestra antes de que el componente pinte un solo nodo:
// `productoSpotlight`/`productoOtraTalla` (el pin resuelto contra el catálogo) y el gate de
// visibilidad (`seccionEsVisible`) que el componente consulta primero.
//
// LA GRILLA SIN ENCABEZADO (§ PARIDAD-CAFE-Y-ORIGEN-1) es la EXCEPCIÓN declarada al límite de
// arriba: `Spotlight.tsx` SIEMPRE rinde `null` bajo `renderToStaticMarkup` (el catálogo llega por
// `useEffect`, que ese carril nunca corre — mismo límite que documenta `spotlight-banda.test.ts`
// hermano `spotlight-cableado.test.ts` y `titulares-saltos.test.ts`), así que esta afirmación —que
// el split de 3 columnas a 1200px sólo se activa CON encabezado— se hace por FUENTE, no por render,
// igual que `titulares-saltos.test.ts:108-120` ya hace para el mismo componente.

function fuenteSpotlight(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/home/Spotlight.tsx');
  return readFileSync(srcPath, 'utf8');
}

const CATALOGO = [
  { slug: 'cafe-huila-250' },
  { slug: 'cafe-huila-500' },
  { slug: 'cafe-narino-250' },
];

// ─── EL PIN RINDE EL PRODUCTO VIVO ──────────────────────────────────────────────────────────────
test('productoSpotlight: el pin resuelve al producto vivo cuando el slug matchea', () => {
  assert.deepEqual(productoSpotlight(CATALOGO, 'cafe-narino-250'), { slug: 'cafe-narino-250' });
});

// ─── PIN A NADA — NO ROMPE ──────────────────────────────────────────────────────────────────────
test('productoSpotlight: PIN A NADA (slug que ya no matchea ningún producto — se borró) cae al PRIMERO del catálogo, no a un componente roto', () => {
  assert.deepEqual(productoSpotlight(CATALOGO, 'un-producto-que-ya-se-borro'), { slug: 'cafe-huila-250' });
});

test('productoSpotlight: pin VACÍO (nunca configurado) cae al PRIMERO del catálogo, igual que un pin roto', () => {
  assert.deepEqual(productoSpotlight(CATALOGO, ''), { slug: 'cafe-huila-250' });
});

// ─── CATÁLOGO VACÍO — AUTO-OCULTA, NO UN SPOTLIGHT VACÍO ───────────────────────────────────────
test('productoSpotlight: CATÁLOGO VACÍO devuelve null (hide-on-empty) aunque el pin sea válido — no hay fallback que tenga sentido', () => {
  assert.equal(productoSpotlight([], 'cafe-huila-250'), null);
});

test('productoSpotlight: CATÁLOGO VACÍO + pin vacío también da null — las dos causas de vacío no se confunden', () => {
  assert.equal(productoSpotlight([], ''), null);
});

// ─── TAMAÑO COMO ENLACE A LA OTRA TALLA (otro slug), no una variante agrupada (Backlog #62) ─────
test('productoOtraTalla: un slug que matchea devuelve ESE producto (el enlace a la otra talla)', () => {
  assert.deepEqual(productoOtraTalla(CATALOGO, 'cafe-huila-500'), { slug: 'cafe-huila-500' });
});

test('productoOtraTalla: slug VACÍO no cae a ningún fallback — null, el control simplemente se omite', () => {
  assert.equal(productoOtraTalla(CATALOGO, ''), null);
});

test('productoOtraTalla: slug que NO matchea tampoco cae a un fallback — null, preferir callar a un link roto (a diferencia de productoSpotlight)', () => {
  assert.equal(productoOtraTalla(CATALOGO, 'no-existe'), null);
});

// ─── BYTE-IDENTIDAD DE NAYOLI ────────────────────────────────────────────────────────────────────
// `spotlight` TODAVÍA no es miembro de `BANDA_IDS` (§ el bloqueo medido en DECISIONS.md,
// SPOTLIGHT-BANDA-1: sumarla rompe la compilación de `app/(storefront)/page.tsx`, fuera de
// `touches:`), así que hoy no hay forma de que la banda aparezca en el `orden` resuelto de NINGÚN
// tenant — Nayoli incluida. La afirmación de "byte-idéntica por render" se hace en la CAPA DE
// DATOS que un futuro `page.tsx` consultaría antes de pintar nada — mismo patrón que ya usó
// CROMO-MENU-COMO-DATO-1 (`itemsDeMenu`/`menuCtaHref`) para StoreNav.tsx, sin poder renderizar
// React fuera de un árbol de Next real.

test('spotlight TODAVÍA no es miembro de BANDA_IDS — el bloqueo medido de SPOTLIGHT-BANDA-1, no un olvido', () => {
  assert.equal((BANDA_IDS as readonly string[]).includes('spotlight'), false);
});

// DEVIACIÓN MECÁNICA (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1, fuera de `touches:` de ese
// slice; actualizada de nuevo por § DESTACADO-PRESENTACION-POR-TAMANO-1 y ahora por
// § DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1, también fuera de `touches:` de ÉSTAS — mismo patrón,
// misma razón): `presentacionSlug`/`cuartoSlug`/`nombreCafe` se sumaron a `SpotlightContent`/
// `DEFAULTS.spotlight` (§ su docstring en site-content-defaults.ts) y esta aserción, literal
// objeto por objeto, quedó desactualizada por cada campo nuevo — se actualiza acá para que el gate
// siga verde; no cambia el CRITERIO que el test afirma (nace OFF, todo campo de texto vacío), sólo
// su conteo de campos.
test('DEFAULTS.spotlight nace OFF (visible:false) con los nueve campos vacíos — la ÚNICA sección ocultable con este default, y a propósito', () => {
  assert.deepEqual(DEFAULTS.spotlight, {
    visible: false,
    eyebrow: '',
    titulo: '',
    badge: '',
    nombreCafe: '',
    productoSlug: '',
    presentacionSlug: '',
    otroTamanoSlug: '',
    cuartoSlug: '',
    notaPrecio: '',
  });
});

test('sin fila (Nayoli, y todo tenant que no la edite), spotlight resuelve OFF: si algún día se monta en `orden`, no se enciende sola', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.spotlight, DEFAULTS.spotlight);
  assert.equal(seccionEsVisible(REGISTRY.spotlight, resuelto.spotlight), false);
});

test('con visible explícito en true, la sección deja de ocultarse — la garantía de arriba es del DEFAULT, no de un `ocultable:false`', () => {
  const resuelto = resolverSiteContent({ spotlight: { visible: true } });
  assert.equal(resuelto.spotlight.visible, true);
  assert.equal(seccionEsVisible(REGISTRY.spotlight, resuelto.spotlight), true);
});

// ─── LA GRILLA SIN ENCABEZADO — §PARIDAD-CAFE-Y-ORIGEN-1 ───────────────────────────────────────────
//
// Medido contra el muestrario desplegado (Onix, `spotlight.eyebrow`/`spotlight.titulo` vacíos hoy):
// sin encabezado, el escenario y la compra se auto-colocaban en las columnas 1 y 2 de la grilla
// `[1fr_1.05fr_1fr]` que sólo se activa desde 1200px, dejando la 3ª columna (1fr) vacía — la banda
// quedaba corrida a la izquierda con un tercio del ancho en blanco. El encabezado es el ÚNICO
// consumidor de esa 3ª columna, así que sin él la grilla debe quedarse en el `min-[820px]:grid-cols-2`
// que ya reparte el ancho completo entre escenario y compra en los anchos intermedios (820-1199px).

test('Spotlight.tsx: el split de tres columnas a 1200px (`min-[1200px]:grid-cols-[1fr_1.05fr_1fr]`) está CONDICIONADO a `tieneEncabezado` — nunca una clase incondicional', () => {
  const src = fuenteSpotlight();
  const m = src.match(/className=\{`grid grid-cols-1[\s\S]*?`\}/);
  assert.ok(m, 'no se encontró la className (template literal) del grid principal de Spotlight');
  const claseGrid = m![0];
  assert.match(
    claseGrid,
    /tieneEncabezado \? 'min-\[1200px\]:grid-cols-\[1fr_1\.05fr_1fr\]' : ''/,
    'el split de 3 columnas debe estar dentro de un ternario sobre tieneEncabezado, no ser parte de la base incondicional',
  );
  // Y el resto de la grilla (columnas/gaps que SÍ deben seguir aplicando siempre, con o sin
  // encabezado) se queda FUERA del ternario — sólo el split de 3 columnas es condicional.
  assert.match(claseGrid, /grid grid-cols-1 gap-10 min-\[820px\]:grid-cols-2 min-\[820px\]:gap-12 min-\[1200px\]:gap-16 items-center/);
});

test('Spotlight.tsx: `tieneEncabezado` se deriva de eyebrow O titulo, y el bloque del encabezado usa esa MISMA bandera — no una segunda comprobación inline del mismo par', () => {
  const src = fuenteSpotlight();
  assert.match(src, /const tieneEncabezado = Boolean\(spotlight\.eyebrow \|\| spotlight\.titulo\);/);
  assert.match(src, /\{tieneEncabezado && \(/, 'el bloque que monta el encabezado debe usar tieneEncabezado, no repetir spotlight.eyebrow || spotlight.titulo');
  assert.doesNotMatch(
    src,
    /\{\(spotlight\.eyebrow \|\| spotlight\.titulo\) &&/,
    'no debe quedar una segunda comprobación inline del mismo par — dos lugares que deciden lo mismo pueden divergir',
  );
});
