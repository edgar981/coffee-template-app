import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssPaleta } from './palette-style';
import { resolverSiteContent } from './site-content-defaults';
import { contenidoConPresetDeVista } from './theme-mirador';

// CROMO-EJES-PALETA-AL-RENDER-1. `app/(storefront)/layout.tsx` emite el `:root{--sf-*}` PERSISTIDO
// —el que sirve a TODO visitante, sin `?tema=`— llamando a `cssPaleta` con las 3 raíces de
// `content.tema` MÁS los ejes (`origenTexto`/`origenAccion`), el mismo mapeo `null → undefined` que
// ya usaban `theme-mirador.ts` (`cssMiradorTema`, sólo activo con override de mirador) y `page.tsx`
// (`ejesTema`, sólo las bandas CON esquema asignado). Antes de este slice el layout llamaba a
// `cssPaleta` con sólo 3 argumentos, así que el `:root` PERSISTIDO ignoraba lo que un preset hubiera
// declarado en esos dos ejes — el defecto que `CROMO-CARRITO-TEMATIZADO-1` midió en el arnés
// (`--sf-accion` salía tostado en vez del rojo de acción de CORTE).
//
// No se importa `layout.tsx` (RSC async que toca `getSiteSettings`/`getSiteContent`, server-only,
// exige base) — se ejercita EN MEMORIA el mismo llamado que el layout hace, con la MISMA fuente
// (`content.tema`) que produce `resolverSiteContent`/`contenidoConPresetDeVista`, ya usadas puras en
// `theme-mirador.test.ts`. Puro; capa 1.

const NAYOLI = resolverSiteContent({});

// Espeja exactamente la expresión de `app/(storefront)/layout.tsx` (§ `paletaCss`).
function paletaCssDelLayout(content: ReturnType<typeof resolverSiteContent>) {
  return cssPaleta(content.tema.fondo, content.tema.tinta, content.tema.acento, {
    origenTexto: content.tema.origenTexto ?? undefined,
    origenAccion: content.tema.origenAccion ?? undefined,
  });
}

test('Nayoli de fábrica (ejes en null) → BYTE-IDÉNTICO a la llamada de 3 argumentos, sin ejes', () => {
  assert.equal(NAYOLI.tema.origenTexto, null);
  assert.equal(NAYOLI.tema.origenAccion, null);
  const conEjes = paletaCssDelLayout(NAYOLI);
  const sinEjes = cssPaleta(NAYOLI.tema.fondo, NAYOLI.tema.tinta, NAYOLI.tema.acento);
  assert.equal(conEjes, sinEjes);
});

test('un tema que declara origenAccion:"acento" (CORTE) → el `:root` del layout honra el acento en --sf-accion, no el tostado', () => {
  const conCorte = contenidoConPresetDeVista(NAYOLI, 'CORTE');
  assert.equal(conCorte.tema.origenAccion, 'acento');
  const css = paletaCssDelLayout(conCorte)!;
  assert.ok(css);
  // = raices.acento EXACTA de CORTE (§ theme-mirador.test.ts, misma aserción sobre `cssMiradorTema`).
  assert.match(css, /--sf-accion:#a70004/);
  // Confirma que la llamada SIN ejes (el comportamiento viejo del layout) habría dado el tostado, no
  // el acento — si esto dejara de ser distinto, la aserción de arriba dejaría de probar nada.
  const sinEjes = cssPaleta(conCorte.tema.fondo, conCorte.tema.tinta, conCorte.tema.acento)!;
  assert.doesNotMatch(sinEjes, /--sf-accion:#a70004/);
});

test('CORTE también honra origenTexto:"tinta" en --sf-acento-texto, del lado del `:root` persistido', () => {
  const conCorte = contenidoConPresetDeVista(NAYOLI, 'CORTE');
  assert.equal(conCorte.tema.origenTexto, 'tinta');
  const css = paletaCssDelLayout(conCorte)!;
  // = raices.tinta EXACTA de CORTE (§ theme-mirador.test.ts).
  assert.match(css, /--sf-acento-texto:#102407/);
});
