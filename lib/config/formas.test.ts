import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMAS, FORMA_DEFECTO, CLAVES_FORMAS, resolverForma, formaDeForma, varsDeForma,
} from './formas';
import { cssForma } from './forma-style';
import { paletaEditableSchema } from './palette-schema';
import { resolverTema, DEFAULTS } from './site-content-defaults';

// El SET CERRADO de personalidades de forma y sus derivados (§ eje 4, mitad 1). GEMELO del test de
// `fuentes`/`fuentes-style`. Puro; capa 1.

test('el default es Suave, y NUNCA se guarda: suave/null/basura → null', () => {
  assert.equal(FORMA_DEFECTO.clave, 'suave');
  assert.equal(resolverForma(null), null);
  assert.equal(resolverForma('suave'), null);   // Suave = "sin override", no se guarda
  assert.equal(resolverForma('basura'), null);
  assert.equal(resolverForma(42), null);
});

test('una forma CUSTOM válida se respeta', () => {
  for (const c of ['recta', 'minima'] as const) {
    assert.equal(resolverForma(c), c);
    assert.equal(formaDeForma(c).clave, c);
  }
});

test('formaDeForma(null) = el default Suave', () => {
  assert.equal(formaDeForma(null).clave, 'suave');
});

test('SUAVE es byte-idéntico a HOY: los radios exactos en REM (1.5/1/0.75rem)', () => {
  // La identidad de Nayoli es LITERAL en rem — = los defaults de Tailwind v4, sin depender del root.
  assert.equal(FORMA_DEFECTO.radius3xl, '1.5rem');
  assert.equal(FORMA_DEFECTO.radius2xl, '1rem');
  assert.equal(FORMA_DEFECTO.radiusXl, '0.75rem');
});

test('SUAVE reproduce los NUEVE tokens de HOY — el contrato byte-idéntico que B2 cablea', () => {
  // La segunda mitad (eje 4, superficie) cableó estos 9 a las utilidades `.sf-*` con FALLBACKS =
  // el valor de HOY. Suave es null → cssForma no emite <style> → cada utilidad cae a su fallback,
  // así que Suave queda byte-idéntico. Este test fija esos literales: si alguien cambia un token de
  // Suave, deja de reproducir el de hoy y esto lo caza. (El fallback CSS de la píldora es
  // `calc(infinity*1px)` = el `rounded-full` de Tailwind v4; el '9999px' de acá es la muestra del
  // picker — ambos renderizan una píldora completa para cualquier elemento real.)
  assert.equal(FORMA_DEFECTO.radioLg, '0.75rem');  // = `.sf-radio-lg` fallback (rounded-lg de hoy)
  // = `.sf-radio-tile` fallback (§ NUESTRO-CAFE-RADIO-TILE-1) — el `rounded-3xl` que el riel ya
  // rendía bajo Suave (= --radius-3xl de hoy, 1.5rem), no un valor nuevo.
  assert.equal(FORMA_DEFECTO.radioTile, '1.5rem');
  // = `.sf-radio-imagen`/`.sf-sombra-imagen` fallback (§ HISTORIA-COLLAGE-COMO-PROTOTIPO-1) — el
  // `rounded-2xl shadow-[0_18px_44px_rgba(16,36,7,0.14)]` que el collage ya rendía bajo Suave
  // (= --radius-2xl de hoy, 1rem, más el literal de sombra exacto), no un valor nuevo.
  assert.equal(FORMA_DEFECTO.radioImagen, '1rem');
  assert.equal(FORMA_DEFECTO.sombraImagen, '0 18px 44px rgba(16,36,7,0.14)');
  assert.equal(FORMA_DEFECTO.pildora, '9999px');   // = `.sf-pildora` (fallback ∞)
  // = `.sf-pildora-real` fallback (§ BACKTOTOP-REDONDO-Y-ORDEN-1) — el mismo círculo que `pildora`
  // ya tenía bajo Suave; el rol nuevo sólo separa el círculo del radio de botón para 'recta'.
  assert.equal(FORMA_DEFECTO.pildoraReal, '9999px');
  assert.equal(FORMA_DEFECTO.borde, '1px');        // = `.sf-borde` fallback (hairline de hoy)
  assert.equal(FORMA_DEFECTO.divisor, '1px');      // = `.sf-divisor-*` fallback (divisor de hoy)
  assert.equal(FORMA_DEFECTO.trazo, '2');          // = `.lucide` stroke-width fallback (lucide default)
});

test('SUAVE reproduce los DOS tokens de badge de HOY — el remate 1 (tipografía)', () => {
  // Gemelo del test de arriba, para los dos tokens que cierra el remate 1. `.sf-badge` cae a estos
  // fallbacks sin <style> → caja natural y sin tracking, lo que un badge de hoy ya tiene.
  assert.equal(FORMA_DEFECTO.badgeCaja, 'none');       // = `.sf-badge` fallback (sin versalitas)
  assert.equal(FORMA_DEFECTO.badgeTracking, 'normal'); // = `.sf-badge` fallback (sin tracking)
});

test('varsDeForma: Suave/null → {} (cae a los radios de hoy); CUSTOM → las 14 vars', () => {
  assert.deepEqual(varsDeForma(null), {});
  assert.deepEqual(varsDeForma('suave'), {});
  const v = varsDeForma('recta');
  // § RADIOS-UN-SOLO-RITMO-1: los SIETE radios de 'recta' (los 3 escalones var-backed LEÍDOS hoy +
  // radioLg/radioTile/radioImagen/pildora) compartieron el MISMO valor chico — ya no 0/2/20/16px por
  // separado. `pildoraReal` es la ÚNICA excepción (círculo, decisión anterior). § RADIO-UN-POCO-MAS-1
  // subió ese valor único de 2px a 4px (gate del owner: "un poco más redondeado, sin llegar a Mínima").
  // § RADIO-TARJETAS-IMAGEN-1 separó `radioTile`/`radioImagen` de ese valor único (gate del owner: "un
  // poco de redondeo, pero sólo a las card de imágenes") — ver más abajo, donde divergen a 10px.
  assert.equal(v['--radius-3xl'], '4px');
  assert.equal(v['--radius-2xl'], '4px');
  assert.equal(v['--radius-xl'], '4px');
  // los 9 tokens propios de superficie (§ NUESTRO-CAFE-RADIO-TILE-1: radioTile YA cableado, no inerte;
  // § BACKTOTOP-REDONDO-Y-ORDEN-1: pildoraReal, ídem; § HISTORIA-COLLAGE-COMO-PROTOTIPO-1: radioImagen/
  // sombraImagen, ídem — los tres nacen ya conectados, no en el período inerte de la mitad 1)
  assert.equal(v['--sf-radio-lg'], '4px');
  // § RADIO-TARJETAS-IMAGEN-1: radioTile/radioImagen YA NO comparten el valor único de arriba — era
  // 20px (§ RADIOS-UN-SOLO-RITMO-1), luego 4px (§ RADIO-UN-POCO-MAS-1), ahora 10px, su PROPIO radio,
  // más grande que el del resto del chrome.
  assert.equal(v['--sf-radio-tile'], '10px');
  assert.equal(v['--sf-radio-imagen'], '10px');
  assert.equal(v['--sf-sombra-imagen'], '0 18px 44px rgba(16,36,7,0.14)'); // la sombra NO se toca
  assert.equal(v['--sf-pildora'], '4px'); // UNIFICADO — era 0 (§ RADIOS-UN-SOLO-RITMO-1), luego 4px (§ RADIO-UN-POCO-MAS-1)
  // la excepción explícita: `pildoraReal` (el círculo genuino, § el docstring de `Forma.pildoraReal`)
  // sigue siendo un círculo completo — "el volver-arriba sigue siendo un círculo" (decisión anterior).
  assert.equal(v['--sf-pildora-real'], '9999px'); // MEDIDO contra el prototipo (tokens.css:170)
  assert.equal(v['--sf-borde'], '1.5px');
  assert.equal(v['--sf-divisor'], '1px');
  assert.equal(v['--sf-trazo'], '1.25');
  // los 2 tokens de badge (§ remate 1)
  assert.equal(v['--sf-badge-caja'], 'uppercase');
  assert.equal(v['--sf-badge-tracking'], '0.12em');
  assert.equal(Object.keys(v).length, 14);
});

test('varsDeForma: Mínima lleva versalitas con MENOS tracking que Recta (mismo tratamiento, otro grado)', () => {
  const v = varsDeForma('minima');
  assert.equal(v['--sf-badge-caja'], 'uppercase');          // el MISMO tratamiento que Recta
  assert.equal(v['--sf-badge-tracking'], '0.05em');          // tracking MENOR que Recta (0.12em)
});

test('cssForma: Suave/null/basura → null (sin <style> → los radios de hoy → byte-idéntico)', () => {
  assert.equal(cssForma(null), null);
  assert.equal(cssForma('suave'), null);
  assert.equal(cssForma('basura' as never), null);
});

test('cssForma: una forma CUSTOM → `:root{}` con las 14 vars', () => {
  const css = cssForma('minima');
  assert.ok(css);
  assert.match(css!, /^:root\{/);
  assert.match(css!, /\}$/);
  assert.match(css!, /--radius-3xl:10px/);
  assert.match(css!, /--radius-2xl:8px/);
  assert.match(css!, /--radius-xl:6px/);
  assert.match(css!, /--sf-radio-lg:6px/);
  assert.match(css!, /--sf-radio-tile:10px/); // = radius3xl de Mínima — "corto y parejo", sin salto
  // radioImagen sigue la MISMA razón que radioTile (§ HISTORIA-COLLAGE-COMO-PROTOTIPO-1, formas.ts):
  // sin prototipo propio para Mínima, reusa el valor del otro rol de media grande — sin salto nuevo.
  assert.match(css!, /--sf-radio-imagen:10px/);
  assert.match(css!, /--sf-sombra-imagen:0 18px 44px rgba\(16,36,7,0\.14\)/);
  assert.match(css!, /--sf-pildora:8px/);
  // Mínima no está en el muestrario (§ el docstring de `Forma.pildoraReal`): 9999px en las tres
  // formas, mismo valor que su `pildora` YA tenía — no hay cambio visible para este preset.
  assert.match(css!, /--sf-pildora-real:9999px/);
  assert.match(css!, /--sf-borde:1px/);
  assert.match(css!, /--sf-divisor:0/);
  assert.match(css!, /--sf-trazo:1.5/);
  assert.match(css!, /--sf-badge-caja:uppercase/);
  assert.match(css!, /--sf-badge-tracking:0.05em/);
  // las 3 var-backed + las 9 de superficie + las 2 de badge = 14 declaraciones, ni una de más
  assert.equal((css!.match(/;/g) ?? []).length + 1, 14);
});

test('el tuple CLAVES_FORMAS ⊆ las claves de FORMAS (una sola fuente con el tipo)', () => {
  assert.deepEqual([...CLAVES_FORMAS], FORMAS.map((f) => f.clave));
});

// El VIAJE schema → resolver — la defensa del #65-B: una clave que el schema no declara se pierde
// en silencio al guardar. `forma` es REQUERIDA en el schema (gemela de `fuentePar`) y sobrevive
// intacta hasta el resolver.
test('#65-B · forma sobrevive el schema y el resolver (no se strippea, no se resetea)', () => {
  const base = { paletaFondo: null, paletaTinta: null, paletaAcento: null, fuentePar: null };
  // el schema NO strippea forma
  const ok = paletaEditableSchema.safeParse({ ...base, forma: 'recta' });
  assert.ok(ok.success);
  assert.equal(ok.data.forma, 'recta');
  // el schema la EXIGE (omitirla = resetearla en silencio → se rechaza)
  assert.ok(!paletaEditableSchema.safeParse(base).success);
  // fuera del set cerrado → rechazado
  assert.ok(!paletaEditableSchema.safeParse({ ...base, forma: 'redonda' }).success);
  // el resolver la respeta (CUSTOM), y normaliza suave/ausente/basura → null (= Suave)
  assert.equal(resolverTema({ forma: 'recta' }, DEFAULTS.tema).forma, 'recta');
  assert.equal(resolverTema({ forma: 'minima' }, DEFAULTS.tema).forma, 'minima');
  assert.equal(resolverTema({ forma: 'suave' }, DEFAULTS.tema).forma, null);
  assert.equal(resolverTema({ forma: 'inexistente' }, DEFAULTS.tema).forma, null);
  assert.equal(resolverTema({}, DEFAULTS.tema).forma, null);
});

// § CORTE-CUERPO-LETRA-E-ICONOS-1 (2026-09-28): CORTE necesitaba un trazo de ícono más grueso que
// 'recta' para los dos íconos del encabezado (medido contra el prototipo), pero 'recta' es
// COMPARTIDA con PLIEGO — bumpearla habría movido el trazo de TODOS los íconos de PLIEGO en
// silencio. La salida (§ el docstring de `Forma.trazo`, y `.sf-icono-nav-exacto` en
// `app/globals.css`) vive FUERA de este catálogo, así que este test es el GUARDIÁN: 'recta' debe
// seguir en 1.25 para las tres formas, sin excepción.
test("'recta' conserva su trazo de HOY (1.25) tras § CORTE-CUERPO-LETRA-E-ICONOS-1 — PLIEGO no se tocó", () => {
  const recta = FORMAS.find((f) => f.clave === 'recta')!;
  assert.equal(recta.trazo, '1.25');
});

// § RADIOS-UN-SOLO-RITMO-1 (2026-10-01) — el GUARDIÁN del "un solo radio" nació afirmando que las
// SIETE claves de radio de 'recta' (menos `pildoraReal`) eran EXACTAMENTE el mismo valor, para que un
// valor que volviera a divergir reintrodujera a propósito el ritmo quebrado que el owner reportó
// ("hay cards con puntas un poco redondeadas pero hay otras totalmente rectas"). § RADIO-TARJETAS-
// IMAGEN-1 (2026-10-02) VOLVIÓ a hacerlas divergir, A PROPÓSITO y por pedido del owner ("un poco de
// redondeo, pero sólo a las card de imágenes; botones y demás se quedan como están"): ya no son
// SIETE las que convergen, son CINCO (el chrome: radius3xl/2xl/xl, radioLg, pildora); `radioTile`/
// `radioImagen` ganan su PROPIO valor, mayor, junto con `pildoraReal` (el círculo) como las dos
// excepciones nombradas. El guardián pasa a afirmar las DOS mitades del eje, no una sola convergencia.
// 'minima' sigue sin afirmarse acá: el owner no pidió su unificación interna.
test("'recta' — CINCO claves de CHROME convergen a UN radio chico; radioTile/radioImagen tienen su PROPIO radio más grande; pildoraReal sigue siendo círculo", () => {
  const recta = FORMAS.find((f) => f.clave === 'recta')!;
  const chrome = [recta.radius3xl, recta.radius2xl, recta.radiusXl, recta.radioLg, recta.pildora];
  assert.ok(chrome.every((r) => r === chrome[0]), `no todas iguales: ${JSON.stringify(chrome)}`);
  assert.equal(chrome[0], '4px');
  // las DOS claves de imagen/tile (§ RADIO-TARJETAS-IMAGEN-1): su propio valor, mayor que el chrome,
  // y las dos IGUALES entre sí (el pedido del owner no distinguió "tile" de "imagen").
  assert.equal(recta.radioTile, '10px');
  assert.equal(recta.radioImagen, '10px');
  assert.notEqual(recta.radioTile, chrome[0]);
  // la excepción nombrada: un círculo real, no un radio chico — y tampoco el radio de imagen/tile.
  assert.equal(recta.pildoraReal, '9999px');
  assert.notEqual(recta.pildoraReal, chrome[0]);
  assert.notEqual(recta.pildoraReal, recta.radioTile);
});

// § RADIO-UN-POCO-MAS-1 (2026-10-01) — el PISO que justifica "4px no se parece a Mínima": el radio más
// chico de 'minima' (`radiusXl`/`radioLg`, 6px) tiene que seguir por ENCIMA del único valor de 'recta'.
// Si algún día 'minima' bajara ese piso, este test lo dice ANTES de que alguien suba 'recta' sin mirar.
test("'minima' — su radio más chico (6px) sigue por encima del único valor de 'recta' (4px)", () => {
  const recta = FORMAS.find((f) => f.clave === 'recta')!;
  const minima = FORMAS.find((f) => f.clave === 'minima')!;
  const pisoMinima = Math.min(
    ...[minima.radius3xl, minima.radius2xl, minima.radiusXl, minima.radioLg, minima.radioTile, minima.radioImagen, minima.pildora]
      .map((v) => parseFloat(v)),
  );
  assert.equal(pisoMinima, 6);
  assert.ok(parseFloat(recta.radius3xl) < pisoMinima, `'recta' (${recta.radius3xl}) debe quedar por debajo del piso de 'minima' (${pisoMinima}px)`);
});
