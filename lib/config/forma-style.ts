import { varsDeForma, type ClaveForma } from './formas';

// GEMELO de `cssFuentes` (§ fuentes-style), para la FORMA. Arma el `:root{ … }` de un <style>
// SERVER-RENDERED que el layout del storefront inyecta junto a la paleta y las fuentes. Sólo
// `--radius-3xl/2xl/xl` los LEE algo hoy (Tailwind v4: `rounded-2xl` → `var(--radius-2xl)`), así que
// overridearlos mueve el radio de las tarjetas del storefront SIN tocar JSX. Los demás tokens quedan
// INERTES hasta la segunda mitad (§ formas).
//
// POR QUÉ `:root` Y NO `@theme`/una redefinición GLOBAL (§ el censo): `@theme` es GLOBAL en Tailwind v4
// y alcanzaría al ADMIN, que usa `--radius-3xl/2xl/xl`. Este <style> NO: vive en el layout del grupo
// `(storefront)`, un documento SEPARADO del `(admin)` —el admin nunca lo recibe—, así que el `:root`
// sólo pisa los radios en las páginas del storefront. Es exactamente lo que hace `cssPaleta` con
// `--sf-*` (que el admin ignora); acá el scope lo da el layout, no el selector. NO tocar
// `--radius-lg/md/sm`: ésos son del panel (globals.css) y no se emiten acá.
//
// SUAVE (o null, o basura) → `null`: sin <style>. Las utilidades caen a los defaults de Tailwind v4
// (radios 1.5/1/0.75rem) → Nayoli byte-idéntico, sin depender de una siembra. Una forma CUSTOM → el
// <style> con sus 8 vars.
//
// Emite EXACTAMENTE las mismas vars que `varsDeForma` (que alimenta la vista previa inline del panel),
// serializadas — para que el server y el preview no puedan divergir (§ el test de consistencia).

export function cssForma(forma: ClaveForma | null): string | null {
  const vars = varsDeForma(forma);
  const pares = Object.entries(vars);
  if (pares.length === 0) return null;
  return `:root{${pares.map(([k, v]) => `${k}:${v}`).join(';')}}`;
}
