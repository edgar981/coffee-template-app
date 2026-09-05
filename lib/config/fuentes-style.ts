import { resolverFuentePar, parDeFuentePar, type ClaveFuentePar } from './fuentes';

// GEMELO de `cssPaleta` (§ palette-style), para las FUENTES. Arma el `:root{ --sf-fuente-*: … }` de un
// <style> SERVER-RENDERED que el layout del storefront inyecta junto a la paleta. Las clases `.font-*`
// (§ globals.css) leen esas vars; sin el <style> (Editorial/null) caen a su fallback Inter/Playfair.
//
// POR QUÉ `:root` Y NO inline (idéntico a la paleta): componentes del storefront se PORTALEAN a <body>
// (carrito, buscadores) y escaparían de un wrapper; `:root` los alcanza a todos. Gana sobre los
// defaults por ORDEN DE FUENTE (va después). SIN FLASH: viaja en el HTML del server (force-dynamic).
//
// EDITORIAL (o null, o basura) → `null`: sin <style>. Las clases caen a `'Inter'/'Playfair Display'`
// —las que carga el `@import` de globals.css— → Nayoli byte-idéntico, sin depender de una siembra.
// Un par CUSTOM → el <style> con sus dos familias (que el `<link>` del layout ya cargó, § linkFuentePar).

export function cssFuentes(fuentePar: ClaveFuentePar | null): string | null {
  const clave = resolverFuentePar(fuentePar);
  if (!clave) return null;
  const par = parDeFuentePar(clave);
  return `:root{--sf-fuente-titulo:${par.titulo};--sf-fuente-cuerpo:${par.cuerpo}}`;
}
