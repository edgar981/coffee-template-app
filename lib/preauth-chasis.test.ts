import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contraste } from './config/palette-derive';

// ─── PANEL-LOGIN-CENTRADO-Y-CLARO-1 ─────────────────────────────────────────────────────────
//
// No hay DOM en este carril (§ CLAUDE.md, § El glob NO incluye *.test.tsx: los tests de
// COMPONENTE necesitan jsdom, que el repo no tiene) — así que este archivo NO puede afirmar
// dónde cae un píxel en pantalla. Lo que SÍ se puede afirmar sin DOM, y es lo que afirma:
//
//   1. que el selector de recoloreo de `duna.css` apunta a las líneas NEUTRAS de `DuneLines`
//      (nunca a las de acento), DERIVADO del propio código fuente de `DuneLines.tsx` — no de un
//      "5" copiado a mano que puede quedar desincronizado si el componente cambia (autorizado
//      por el owner) el umbral de acento;
//   2. que el wrapper (`PreAuthShell.tsx`) engancha esa clase, y que el fondo/texto del pie
//      CONMUTAN por tema en vez de quedar fijos;
//   3. que el bug de centrado (un `paddingBottom` atado al alto de `DuneLines`) no vuelve;
//   4. el CONTRASTE real (WCAG, con la misma función `contraste()` que usa el motor de color del
//      storefront) del pie en los dos temas — esto SÍ es matemática pura, afirmable sin DOM.
//
// El centrado en sí (¿dónde queda el CENTRO del bloque en la pantalla?) y si el pie se ve
// cruzado por una línea en un caso real: eso es geometría de layout + SVG animado por
// `requestAnimationFrame`, y el gate de esas dos cosas son los OJOS DEL OWNER (§ SPEC, § el
// comentario grande en PreAuthShell.tsx) — no este archivo.

function leer(rutaRelativaDesdeAca: string): string {
  const ruta = path.join(fileURLToPath(new URL('.', import.meta.url)), rutaRelativaDesdeAca);
  return readFileSync(ruta, 'utf8');
}

test('el selector de recoloreo en duna.css apunta a las líneas NEUTRAS, derivado del umbral real de DuneLines.tsx', () => {
  const fuenteDuneLines = leer('../components/admin/DuneLines.tsx');

  const matchLines = fuenteDuneLines.match(/const LINES = (\d+);/);
  assert.ok(matchLines, 'DuneLines.tsx debería declarar `const LINES = N;` — si el nombre cambió, hay que releer el componente, no reescribir este test a ciegas');
  const lines = Number(matchLines![1]);

  const matchUmbral = fuenteDuneLines.match(/stroke=\{i < (\d+) \?/);
  assert.ok(matchUmbral, 'DuneLines.tsx debería fijar el color con `stroke={i < N ? ... }` — el umbral de acento vive ahí');
  const umbralAcento = Number(matchUmbral![1]);

  // índice 0-based `umbralAcento` es el primer índice NEUTRO (i >= umbralAcento);
  // nth-child es 1-based, así que el primer hijo neutro es nth-child(umbralAcento + 1).
  const primerNthChildNeutro = umbralAcento + 1;
  assert.equal(primerNthChildNeutro, 5, 'sale del código real de DuneLines.tsx (4 líneas de acento), no de un literal fijo acá');
  assert.equal(lines - umbralAcento, 11, 'las líneas neutras son LINES menos las de acento');

  const fuenteDunaCss = leer('../app/(admin)/duna.css');
  const selectorEsperado = `.admin-preauth-lineas path:nth-child(n+${primerNthChildNeutro})`;
  assert.ok(
    fuenteDunaCss.includes(selectorEsperado),
    `duna.css debería recolorear con "${selectorEsperado}", derivado del umbral real de DuneLines.tsx — si esto falla, o el componente cambió (el owner lo autorizó) o el CSS se desincronizó`,
  );

  // Scoped a MODO CLARO (nunca en oscuro, donde la crema ya es correcta) y sólo toca `stroke` —
  // la opacidad y el grosor son del owner y esta regla no los nombra.
  const escapado = selectorEsperado.replace(/[.[\]()+]/g, '\\$&');
  const reglaRegex = new RegExp(String.raw`html\.admin:not\(\.dark\)\s+${escapado}\s*\{\s*stroke:\s*var\(--duna-ink\);?\s*\}`);
  assert.match(fuenteDunaCss, reglaRegex, 'la regla debe ir scoped a html.admin:not(.dark) y sólo tocar `stroke`');

  const bloqueDeLaRegla = fuenteDunaCss.slice(fuenteDunaCss.indexOf(selectorEsperado));
  const cierreDelBloque = bloqueDeLaRegla.indexOf('}');
  const cuerpoDeLaRegla = bloqueDeLaRegla.slice(0, cierreDelBloque);
  assert.doesNotMatch(cuerpoDeLaRegla, /opacity\s*:/, 'la opacidad es del owner — esta regla no la toca');
  assert.doesNotMatch(cuerpoDeLaRegla, /stroke-width\s*:/, 'el grosor es del owner — esta regla no lo toca');
});

test('PreAuthShell engancha `admin-preauth-lineas` en DuneLines (el gancho del recoloreo)', () => {
  const fuente = leer('../components/admin/PreAuthShell.tsx');
  assert.match(
    fuente,
    /<DuneLines className="[^"]*\badmin-preauth-lineas\b[^"]*"/,
    'sin esta clase, el selector de duna.css no tiene nada que alcanzar',
  );
});

test('el chasis NO reserva un paddingBottom atado al alto de DuneLines para centrar (la causa medida del descentrado)', () => {
  const fuente = leer('../components/admin/PreAuthShell.tsx');
  assert.doesNotMatch(
    fuente,
    /style=\{\{\s*paddingBottom/,
    'reintroducir un paddingBottom fijo es exactamente el bug que PANEL-LOGIN-CENTRADO-Y-CLARO-1 cierra',
  );
  assert.match(
    fuente,
    /\bpy-10\b/,
    'el centrado depende de un padding SIMÉTRICO (py-10) — top y bottom iguales, no sólo pt-10',
  );
});

test('el fondo y el texto del pie conmutan por tema — el literal del owner sólo en OSCURO', () => {
  const fuente = leer('../components/admin/PreAuthShell.tsx');
  assert.match(
    fuente,
    /bg-background[^"]*dark:bg-\[#1B1712\]/,
    'en claro debe resolver a un TOKEN (bg-background); el literal oscuro sólo bajo dark:',
  );
  assert.match(
    fuente,
    /text-foreground\/70[^"]*dark:text-white\/70/,
    'el pie debe conmutar de color con el fondo — un color fijo falla AA en alguno de los dos temas',
  );
});

test('el pie pasa AA (4.5:1) en los dos temas, con los tokens/colores que esta página REALMENTE usa', () => {
  // Valores copiados de `packages/design-system/tokens/tokens.css` (:root) — los que
  // `bg-background`/`text-foreground` resuelven en el admin, porque `--duna-bg`/`--duna-ink`
  // SIEMPRE están definidos ahí y ganan sobre el fallback `hsl(var(--background))`
  // (§ app/globals.css:155-156: `var(--duna-bg, hsl(var(--background)))`).
  const BG_CLARO = '#F7F6F2';     // --duna-bg, :root
  const INK_CLARO = '#141311';    // --duna-ink, :root
  const BG_OSCURO_LITERAL = '#1B1712'; // el literal fijo del owner (PANEL-LOGIN-DUNELINES-OWNER-1)
  const BLANCO = '#FFFFFF';

  const alphaBlend = (fgHex: string, alpha: number, bgHex: string): string => {
    const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const fg = hexToRgb(fgHex), bg = hexToRgb(bgHex);
    const out = fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
    return '#' + out.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  };

  const claroEfectivo = alphaBlend(INK_CLARO, 0.7, BG_CLARO);
  const oscuroEfectivo = alphaBlend(BLANCO, 0.7, BG_OSCURO_LITERAL);

  const contrasteClaro = contraste(claroEfectivo, BG_CLARO);
  const contrasteOscuro = contraste(oscuroEfectivo, BG_OSCURO_LITERAL);

  assert.ok(
    contrasteClaro >= 4.5,
    `text-foreground/70 en claro da ${contrasteClaro.toFixed(2)}:1 — por debajo del piso AA (4.5:1) para texto normal`,
  );
  assert.ok(
    contrasteOscuro >= 4.5,
    `dark:text-white/70 da ${contrasteOscuro.toFixed(2)}:1 — por debajo del piso AA (4.5:1) para texto normal`,
  );
});
