import { test } from 'node:test';
import assert from 'node:assert/strict';

import { contenedorAnchoClase, PRESETS } from './themes';
import { resolverSiteContent } from './site-content-defaults';
import { contenidoConPresetDeVista } from './theme-mirador';

// EL CONTENEDOR DE CONTENIDO compartido por el encabezado y las BANDAS del storefront
// (§ PARIDAD-ANCHO-CONTENIDO-1). Ver el docstring de `contenedorAnchoClase` (`themes.ts`) para el
// porqué de reusar `content.navTratamiento.posicion` acá en vez de una meta nueva. Puro; capa 1.

test('contenedorAnchoClase(false) = el literal de HOY, byte a byte (max-w-6xl, todo tenant salvo CORTE)', () => {
  assert.equal(contenedorAnchoClase(false), 'max-w-6xl px-4 sm:px-6 lg:px-8');
});

test('contenedorAnchoClase(true) = la geometría EXACTA del prototipo (CORTE) — MISMO literal que `StoreNav.tsx` ya usaba para su propio contenedor; `min-[640px]:`, no `sm:` (§ PARIDAD-CORTENAV-CASCADA-1, el fix de la cascada contra `cortenav:`)', () => {
  assert.equal(contenedorAnchoClase(true), 'max-w-[1440px] px-[18px] min-[640px]:px-6 cortenav:px-8');
});

test('sin fila de SiteContent (Nayoli/defaults) → navTratamiento.posicion es false → el contenedor de HOY', () => {
  const posicion = resolverSiteContent({}).navTratamiento.posicion;
  assert.equal(posicion, false);
  assert.equal(contenedorAnchoClase(posicion), 'max-w-6xl px-4 sm:px-6 lg:px-8');
});

test('con el preset CORTE superpuesto → navTratamiento.posicion es true → la geometría del prototipo', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const posicion = conCorte.navTratamiento.posicion;
  assert.equal(posicion, true);
  assert.equal(contenedorAnchoClase(posicion), 'max-w-[1440px] px-[18px] min-[640px]:px-6 cortenav:px-8');
});

test('de los 6 presets del catálogo, sólo CORTE resuelve navTratamiento.posicion=true (el eje que gobierna este contenedor no se activa por accidente en otro preset)', () => {
  for (const preset of PRESETS) {
    const conPreset = contenidoConPresetDeVista(resolverSiteContent({}), preset.clave);
    const esperado = preset.clave === 'CORTE';
    assert.equal(
      conPreset.navTratamiento.posicion,
      esperado,
      `${preset.clave}: navTratamiento.posicion debería ser ${esperado}`,
    );
  }
});
