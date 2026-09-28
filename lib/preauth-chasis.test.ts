import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contraste } from './config/palette-derive';

// ─── PANEL-LOGIN-CENTRADO-Y-CLARO-1 / PANEL-LOGIN-PIE-FUERA-DE-LINEAS-1 ─────────────────────
//
// No hay DOM en este carril (§ CLAUDE.md, § El glob NO incluye *.test.tsx: los tests de
// COMPONENTE necesitan jsdom, que el repo no tiene) — así que este archivo NO puede afirmar
// dónde cae un píxel en pantalla. Lo que SÍ se puede afirmar sin DOM, y es lo que afirma:
//
//   1. que el selector de recoloreo de `duna.css` apunta a las líneas NEUTRAS de `DuneLines`
//      (nunca a las de acento), DERIVADO del propio código fuente de `DuneLines.tsx` — no de un
//      "5" copiado a mano que puede quedar desincronizado si el componente cambia (autorizado
//      por el owner) el umbral de acento;
//   2. que el wrapper (`PreAuthShell.tsx`) engancha esa clase, y que el fondo del wrapper
//      CONMUTA por tema en vez de quedar fijo;
//   3. que el bug de centrado (un `paddingBottom` atado al alto de `DuneLines`) no vuelve;
//   4. que el pie vive DENTRO de la card (`PANEL-LOGIN-PIE-FUERA-DE-LINEAS-1`) — la superficie
//      opaca que garantiza que ninguna línea de `DuneLines` pueda cruzarlo, en vez de un
//      argumento geométrico sobre dónde cae en promedio cada línea;
//   5. el CONTRASTE real (WCAG, con la misma función `contraste()` que usa el motor de color del
//      storefront) del pie contra la superficie de la CARD (`--duna-surface`) en los dos temas —
//      esto SÍ es matemática pura, afirmable sin DOM.
//
// El centrado en sí (¿dónde queda el CENTRO del bloque en la pantalla?) y si la banda se ve
// bien detrás de la card en un caso real: eso es geometría de layout + SVG animado por
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

test('el fondo del wrapper conmuta por tema — el literal del owner sólo en OSCURO', () => {
  const fuente = leer('../components/admin/PreAuthShell.tsx');
  assert.match(
    fuente,
    /bg-background[^"]*dark:bg-\[#1B1712\]/,
    'en claro debe resolver a un TOKEN (bg-background); el literal oscuro sólo bajo dark:',
  );
});

test('el pie vive DENTRO de la card (misma superficie opaca del formulario), ya no como sibling suelto', () => {
  // PANEL-LOGIN-PIE-FUERA-DE-LINEAS-1: el pie se mudó de sibling-después-de-la-card a
  // último-hijo-de-la-card, para que `bg-card` (opaco, sin alfa) lo separe de `DuneLines` sin
  // depender de la fase de la animación ni del alto de la ventana. Este test afirma la
  // ESTRUCTURA (el pie sigue dentro del mismo <div> que {children}), no la geometría en pantalla.
  const fuente = leer('../components/admin/PreAuthShell.tsx');

  // `{children}` aparece DOS veces en el archivo: una en `AvisoError` (arriba, no forma parte
  // de la card) y otra en `PreAuthShell` (la que importa acá). Se busca desde donde arranca
  // `PreAuthShell` para no confundir la primera con la segunda.
  const idxFuncion = fuente.indexOf('export function PreAuthShell');
  assert.ok(idxFuncion > -1, 'el archivo debe declarar `export function PreAuthShell`');
  const cuerpo = fuente.slice(idxFuncion);

  const idxChildren = cuerpo.indexOf('{children}');
  const idxPie = cuerpo.indexOf('El sistema operativo de tu negocio.');
  assert.ok(idxChildren > -1, 'el archivo debe declarar {children} dentro de PreAuthShell');
  assert.ok(idxPie > -1, 'el archivo debe declarar el texto del pie dentro de PreAuthShell');
  assert.ok(
    idxPie > idxChildren,
    'el pie debe aparecer DESPUÉS de {children} en el JSX — es el último hijo de la card, no el formulario',
  );

  // El primer `</div>` que aparece DESPUÉS de {children} tiene que cerrar DESPUÉS del pie (es
  // decir, el pie está DENTRO de ese div) — si cerrara ANTES, el pie volvió a ser un sibling
  // suelto, fuera de la superficie opaca de la card.
  const resto = cuerpo.slice(idxChildren);
  const idxPrimerCierre = resto.indexOf('</div>');
  const idxPieEnResto = resto.indexOf('El sistema operativo de tu negocio.');
  assert.ok(idxPrimerCierre > -1, 'debe haber al menos un </div> después de {children} (el de la card)');
  assert.ok(
    idxPrimerCierre > idxPieEnResto,
    'el primer </div> tras {children} cierra ANTES del pie — el pie quedó fuera de la card otra vez',
  );

  // El pie ya NO necesita blindaje por tema propio (`dark:text-white/70`): vive sobre `bg-card`,
  // que conmuta solo. Ese literal reapareciendo en SU classList sería la señal de que alguien lo
  // sacó de la card sin actualizar el color. Se busca el `className` del `<p>` que precede
  // inmediatamente al texto del pie — no el archivo entero, porque el literal SÍ puede aparecer
  // legítimamente en comentarios que documentan la decisión anterior.
  const idxPieAbs = fuente.indexOf('El sistema operativo de tu negocio.');
  const classNameDelPie = fuente.slice(Math.max(0, idxPieAbs - 200), idxPieAbs);
  assert.doesNotMatch(
    classNameDelPie,
    /dark:text-white\/70/,
    'el <p> del pie ya no necesita un literal de color por tema — vive sobre bg-card, que conmuta solo',
  );
});

test('el pie pasa AA (4.5:1) en los dos temas, contra la superficie REAL de la card (bg-card)', () => {
  // Valores copiados de `packages/design-system/tokens/tokens.css` — `--duna-muted` (el token de
  // `text-muted-foreground`) y `--duna-surface` (el token de `bg-card`, § app/globals.css:172:
  // `var(--duna-surface, hsl(var(--card)))`, siempre definido en el grupo admin).
  const MUTED_CLARO = '#746F64';    // --duna-muted, :root
  const SURFACE_CLARO = '#FFFFFF';  // --duna-surface, :root
  const MUTED_OSCURO = '#9A958A';   // --duna-muted, :root.dark
  const SURFACE_OSCURO = '#1F1E1B'; // --duna-surface, :root.dark

  const contrasteClaro = contraste(MUTED_CLARO, SURFACE_CLARO);
  const contrasteOscuro = contraste(MUTED_OSCURO, SURFACE_OSCURO);

  assert.ok(
    contrasteClaro >= 4.5,
    `text-muted-foreground en claro da ${contrasteClaro.toFixed(2)}:1 contra bg-card — por debajo del piso AA (4.5:1)`,
  );
  assert.ok(
    contrasteOscuro >= 4.5,
    `text-muted-foreground en oscuro da ${contrasteOscuro.toFixed(2)}:1 contra bg-card — por debajo del piso AA (4.5:1)`,
  );

  const fuente = leer('../components/admin/PreAuthShell.tsx');
  assert.match(
    fuente,
    /El sistema operativo de tu negocio\.\s*<\/p>/,
    'el texto del pie debe seguir siendo exactamente éste (sin cambio de copy en esta tanda)',
  );
  const idxPie = fuente.indexOf('El sistema operativo de tu negocio.');
  const antesDelPie = fuente.slice(Math.max(0, idxPie - 400), idxPie);
  assert.match(
    antesDelPie,
    /<p className="[^"]*\btext-muted-foreground\b[^"]*">\s*$/,
    'el <p> del pie debe usar `text-muted-foreground` — el token medido arriba',
  );
});
