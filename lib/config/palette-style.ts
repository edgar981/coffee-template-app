import { derivarPaleta, type EjesPaleta } from './palette-derive';

// Puente entre las RAÍCES de SiteSetting y el CSS que inyecta el layout del storefront.
// Deriva las tintas que produce `derivarPaleta` y arma un `:root{ --sf-*: … }` para un
// <style> SERVER-RENDERED — una var por CLAVE del objeto derivado, ni una más ni una menos
// (§ palette-style.test.ts: la cuenta se afirma contra esa fuente, no contra un número).
//
// POR QUÉ `:root` Y NO un style inline en el wrapper: algunos componentes del storefront
// se PORTALEAN a <body> (el carrito, buscadores) y escaparían de las vars del wrapper. Un
// `:root` global las alcanza a todos —body es hijo de :root—, y como este <style> sólo se
// renderiza en rutas del storefront y `--sf-*` son vars del storefront, no toca al admin.
// Gana sobre los defaults de `globals.css` por ORDEN DE FUENTE (va después, en el body).
//
// SIN FLASH: el <style> viaja en el HTML del server (el storefront es force-dynamic), así
// que las vars del cliente están en el PRIMER paint. Nunca se ve el color de Nayoli un
// instante antes del del cliente —eso pasaría sólo si las vars llegaran por un script
// cliente después del paint, que no es el caso—.
//
// MEMO por las 3 raíces: la derivación es 0.13ms, pero un deployment single-tenant tiene
// las mismas raíces en cada request, así que se computa UNA vez y se reusa. La clave por
// valor recomputa sólo si el cliente edita su paleta.

let memo: { clave: string; css: string } | null = null;

/**
 * CSS `:root{…}` con una var `--sf-*` por cada clave que devuelve `derivarPaleta`, o `null`
 * si el cliente no configuró paleta (las tres null) → cae a los defaults de `globals.css`
 * (Nayoli byte-idéntico, sin depender de una siembra). Los valores son hex del motor —
 * seguros para un `<style>`—; el write ya rechazó cualquier basura (§ palette-schema).
 *
 * `ejes` (§ `EjesPaleta`, `palette-derive.ts`, TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1) es OPCIONAL
 * y ADITIVO: ausente = el comportamiento de siempre. Desde `CROMO-EJES-PALETA-AL-RENDER-1` los DOS
 * call sites reales lo pasan: el layout del storefront (`app/(storefront)/layout.tsx`), para el
 * `:root` PERSISTIDO que sirve a TODO visitante, y `theme-mirador.ts` (`cssMiradorTema`), para el
 * `:root` del MIRADOR (`?tema=`, invocado desde `app/(storefront)/page.tsx`). `null`/`undefined`
 * en `origenTexto`/`origenAccion` — el default de TODO tenant real y de 5 de los 6 presets del
 * catálogo (§ TemaContent, site-content-defaults.ts) — da lo mismo de siempre.
 */
export function cssPaleta(
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
  ejes?: EjesPaleta,
): string | null {
  if (!fondo || !tinta || !acento) return null;
  // La clave del memo INCLUYE los ejes: dos llamadas con las MISMAS raíces pero ejes distintos
  // (posible en el mirador, que recalcula por request) no pueden compartir un CSS cacheado del
  // otro eje — el memo cachea por RESULTADO, no sólo por raíz.
  const clave = `${fondo}|${tinta}|${acento}|${ejes?.origenTexto ?? ''}|${ejes?.origenAccion ?? ''}`;
  if (memo?.clave === clave) return memo.css;
  const p = derivarPaleta({ fondo, tinta, acento }, ejes);
  const css = `:root{${Object.entries(p).map(([k, v]) => `--sf-${k}:${v}`).join(';')}}`;
  memo = { clave, css };
  return css;
}
