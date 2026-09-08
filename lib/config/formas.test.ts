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

test('SUAVE reproduce los CINCO tokens de HOY — el contrato byte-idéntico que B2 cablea', () => {
  // La segunda mitad (eje 4, superficie) cableó estos 5 a las utilidades `.sf-*` con FALLBACKS =
  // el valor de HOY. Suave es null → cssForma no emite <style> → cada utilidad cae a su fallback,
  // así que Suave queda byte-idéntico. Este test fija esos literales: si alguien cambia un token de
  // Suave, deja de reproducir el de hoy y esto lo caza. (El fallback CSS de la píldora es
  // `calc(infinity*1px)` = el `rounded-full` de Tailwind v4; el '9999px' de acá es la muestra del
  // picker — ambos renderizan una píldora completa para cualquier elemento real.)
  assert.equal(FORMA_DEFECTO.radioLg, '0.75rem');  // = `.sf-radio-lg` fallback (rounded-lg de hoy)
  assert.equal(FORMA_DEFECTO.pildora, '9999px');   // = `.sf-pildora` (fallback ∞)
  assert.equal(FORMA_DEFECTO.borde, '1px');        // = `.sf-borde` fallback (hairline de hoy)
  assert.equal(FORMA_DEFECTO.divisor, '1px');      // = `.sf-divisor-*` fallback (divisor de hoy)
  assert.equal(FORMA_DEFECTO.trazo, '2');          // = `.lucide` stroke-width fallback (lucide default)
});

test('varsDeForma: Suave/null → {} (cae a los radios de hoy); CUSTOM → las 8 vars', () => {
  assert.deepEqual(varsDeForma(null), {});
  assert.deepEqual(varsDeForma('suave'), {});
  const v = varsDeForma('recta');
  // los 3 escalones var-backed LEÍDOS hoy
  assert.equal(v['--radius-3xl'], '0');
  assert.equal(v['--radius-2xl'], '0');
  assert.equal(v['--radius-xl'], '0');
  // los 5 tokens propios (INERTES en esta mitad, emitidos igual)
  assert.equal(v['--sf-radio-lg'], '2px');
  assert.equal(v['--sf-pildora'], '0');
  assert.equal(v['--sf-borde'], '1.5px');
  assert.equal(v['--sf-divisor'], '1px');
  assert.equal(v['--sf-trazo'], '1.25');
  assert.equal(Object.keys(v).length, 8);
});

test('cssForma: Suave/null/basura → null (sin <style> → los radios de hoy → byte-idéntico)', () => {
  assert.equal(cssForma(null), null);
  assert.equal(cssForma('suave'), null);
  assert.equal(cssForma('basura' as never), null);
});

test('cssForma: una forma CUSTOM → `:root{}` con las 8 vars', () => {
  const css = cssForma('minima');
  assert.ok(css);
  assert.match(css!, /^:root\{/);
  assert.match(css!, /\}$/);
  assert.match(css!, /--radius-3xl:10px/);
  assert.match(css!, /--radius-2xl:8px/);
  assert.match(css!, /--radius-xl:6px/);
  assert.match(css!, /--sf-radio-lg:6px/);
  assert.match(css!, /--sf-pildora:8px/);
  assert.match(css!, /--sf-borde:1px/);
  assert.match(css!, /--sf-divisor:0/);
  assert.match(css!, /--sf-trazo:1.5/);
  // las 3 var-backed + las 5 propias = 8 declaraciones, ni una de más
  assert.equal((css!.match(/;/g) ?? []).length + 1, 8);
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
