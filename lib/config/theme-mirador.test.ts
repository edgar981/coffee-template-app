import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenidoConPresetDeVista, cssMiradorTema } from './theme-mirador';
import { resolverSiteContent } from './site-content-defaults';
import { CORTE } from './themes';

// EL MIRADOR (§ TEMAS-MIRADOR-PRESET-1). Puro; capa 1. Afirma el CONTRATO del que depende el
// invariante del slice —«el tenant no se mueve»— del lado de LECTURA: sin clave, con una clave
// que no nombra ningún preset, y con una clave de un preset INCOMPLETO, el resultado es
// EXACTAMENTE el `content` de entrada (misma referencia — nada se reconstruye de más). Con un
// preset completo (CORTE, ya validado completo por `themes.test.ts`), el resultado trae sus
// variantes de banda sin tocar ningún texto/imagen del dueño — la MISMA garantía que
// `mergePresetEnContent` ya afirma, ejercida acá por el punto de entrada que la URL usa.

const DEFECTO = resolverSiteContent({});

test('sin clave (undefined) → devuelve la MISMA referencia de content, sin tocar nada', () => {
  const out = contenidoConPresetDeVista(DEFECTO, undefined);
  assert.equal(out, DEFECTO);
});

test('clave que no nombra ningún preset del catálogo → devuelve la MISMA referencia', () => {
  const out = contenidoConPresetDeVista(DEFECTO, 'NO-EXISTE');
  assert.equal(out, DEFECTO);
});

test('clave de un preset INCOMPLETO (VITRINA: fuentePar/forma sin decidir) → devuelve la MISMA referencia, nunca a medias', () => {
  const out = contenidoConPresetDeVista(DEFECTO, 'VITRINA');
  assert.equal(out, DEFECTO);
});

test('CORTE (completo) → las tres bandas nuevas quedan pedidas en el content resultante', () => {
  const out = contenidoConPresetDeVista(DEFECTO, 'CORTE');
  assert.notEqual(out, DEFECTO);
  assert.equal(out.hero.variante, 'media');
  assert.equal(out.variantesBandas.featured, 'grilla');
  assert.equal(out.subscriptionCTA.variante, 'linea');
});

test('CORTE no toca ningún texto/imagen del dueño — sólo tema/esquemas/orden/variantesBandas/variante', () => {
  const out = contenidoConPresetDeVista(DEFECTO, 'CORTE');
  assert.equal(out.hero.titulo, DEFECTO.hero.titulo);
  assert.equal(out.hero.imagen, DEFECTO.hero.imagen);
  assert.deepEqual(out.testimonials, DEFECTO.testimonials);
  assert.deepEqual(out.paginas, DEFECTO.paginas);
});

test('aplicar CORTE dos veces es idempotente (mismo resultado, misma garantía que mergePresetEnContent)', () => {
  const una = contenidoConPresetDeVista(DEFECTO, 'CORTE');
  const dos = contenidoConPresetDeVista(una, 'CORTE');
  assert.deepEqual(dos, una);
});

// Verificación de fixture: CORTE tiene que seguir validando completo para que estos tests midan
// lo mismo que mide `page.tsx` — si `themes.ts` cambiara y CORTE dejara de validar completo, este
// test lo delata ANTES de que alguien se pregunte por qué el mirador dejó de mostrar sus bandas.
test('fixture: CORTE sigue siendo un preset del catálogo (si esto falla, revisar themes.ts, no este archivo)', () => {
  assert.equal(CORTE.clave, 'CORTE');
});

// EL EJE COMPLETO (§ CORTE-MIRADOR-EJES-COMPLETOS-1). `cssMiradorTema` es la mitad que arma el
// SEGUNDO `<style>`/`<link>` que `page.tsx` emite para que el `:root` deje de leer sólo el content
// PUBLICADO. Afirma las TRES invariantes del spec del lado de esta función: sin override devuelve
// `null` (nada que renderizar); con un override, reusa LOS MISMOS constructores que ya usa el
// layout (mismos valores que `cssPaleta`/`cssFuentes`/`linkFuentePar`/`cssForma` producirían a mano
// contra las raíces/fuentePar/forma de CORTE — no una segunda composición que pudiera divergir).

test('sin override (content === contentPublicado) → null, nada que renderizar de más', () => {
  const out = cssMiradorTema(DEFECTO, DEFECTO);
  assert.equal(out, null);
});

test('con CORTE aplicado → las CUATRO piezas del eje completo, no sólo la paleta', () => {
  const conCorte = contenidoConPresetDeVista(DEFECTO, 'CORTE');
  const out = cssMiradorTema(conCorte, DEFECTO);
  assert.notEqual(out, null);
  // paleta: la tinta CRUDA de CORTE (§ themes.ts, `raices.tinta`) aparece literal — es el mismo
  // valor que hace que el HERO (sin esquema propio, cae a `var(--sf-banda,var(--sf-tinta))`)
  // herede la paleta de CORTE una vez que este `:root` gana por orden de fuente.
  assert.match(out!.paletaCss!, /--sf-tinta:#102407/);
  assert.match(out!.paletaCss!, /--sf-fondo:#fdfbf7/);
  // par tipográfico: CORTE usa 'prensa' (Roboto Serif / Figtree) — NO editorial, así que las
  // cuatro piezas del eje están presentes, no sólo la paleta (§ el hallazgo que motiva el slice:
  // el par y la forma nunca llegaban al `:root`).
  assert.match(out!.fuentesCss!, /--sf-fuente-titulo:'Roboto Serif'/);
  assert.ok(out!.fuentesLink!.includes('Roboto+Serif') && out!.fuentesLink!.includes('Figtree'));
  // forma: CORTE usa 'recta' (radios 0/0/0, la regla explícita del prototipo).
  assert.match(out!.formaCss!, /--radius-3xl:0/);
  assert.match(out!.formaCss!, /--radius-2xl:0/);
  assert.match(out!.formaCss!, /--radius-xl:0/);
});

test('clave inválida o preset incompleto → contenidoConPresetDeVista ya devolvió la MISMA referencia, así que cssMiradorTema también da null', () => {
  const sinCambio = contenidoConPresetDeVista(DEFECTO, 'VITRINA');
  assert.equal(sinCambio, DEFECTO); // fixture: confirma que este caso entra por la rama "sin cambio"
  const out = cssMiradorTema(sinCambio, DEFECTO);
  assert.equal(out, null);
});
