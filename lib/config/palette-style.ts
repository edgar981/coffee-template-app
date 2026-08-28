import { derivarPaleta } from './palette-derive';

// Puente entre las RAÍCES de SiteSetting y el CSS que inyecta el layout del storefront.
// Deriva las 21 tintas y arma un `:root{ --sf-*: … }` para un <style> SERVER-RENDERED.
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
 * CSS `:root{…}` con las 21 vars `--sf-*` derivadas de las raíces, o `null` si el cliente
 * no configuró paleta (las tres null) → cae a los defaults de `globals.css` (Nayoli
 * byte-idéntico, sin depender de una siembra). Los valores son hex del motor —seguros para
 * un `<style>`—; el write ya rechazó cualquier basura (§ palette-schema).
 */
export function cssPaleta(
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): string | null {
  if (!fondo || !tinta || !acento) return null;
  const clave = `${fondo}|${tinta}|${acento}`;
  if (memo?.clave === clave) return memo.css;
  const p = derivarPaleta({ fondo, tinta, acento });
  const css = `:root{${Object.entries(p).map(([k, v]) => `--sf-${k}:${v}`).join(';')}}`;
  memo = { clave, css };
  return css;
}
