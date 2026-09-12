import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarPaleta, derivarEsquema, pisoContraste, contraste, mezclar, type RaicesPaleta, type EsquemaId } from './palette-derive';

// El motor de color del storefront — puro, así que los tests son propiedades sobre la
// derivación. Se corre con `npm test` (capa 1). NO borrar: es lo único que afirma que el
// PISO DE CONTRASTE se aplica a los roles correctos y a ninguno más.

const NAYOLI: RaicesPaleta = { fondo: '#faf7f4', tinta: '#1a0f08', acento: '#8b4513' };
const NEON:   RaicesPaleta = { fondo: '#f6f5f3', tinta: '#1c1a18', acento: '#e5ff00' };
// Acento de luminancia MEDIA (0.3111) — NAYOLI (0.0979) y NEON (0.8818) nunca pasan por acá, que
// es justo donde el umbral crudo de `direccionDePiso` (§ TEMAS-P6-MOTOR-1) elegía la dirección
// equivocada: 'aclarar' (por luminancia<0.5) cuando 'oscurecer' es la que más contraste alcanza.
const MEDIO: RaicesPaleta = { fondo: '#16120e', tinta: '#080605', acento: '#d98324' };

test('las 3 raíces se copian tal cual', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(p.fondo, '#faf7f4');
  assert.equal(p.tinta, '#1a0f08');
  assert.equal(p.acento, '#8b4513');
});

test('deriva las 28 tintas (3 raíces + 18 de la RECETA + acento-txt + tarjeta/sobre + los 4 pares de §TEMAS-P6-FAMILIAS-1)', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(Object.keys(p).length, 28);
  for (const k of ['superficie','linea','superficie-2','tinta-2','acento-2','acento-3','acento-4','acento-texto','acento-txt','texto','texto-suave','tostado','tostado-2','tostado-3','tostado-4','tostado-5','tostado-6','tostado-7','tostado-8','tarjeta','sobre','sobre-superficie','sobre-superficie-suave','sobre-tarjeta','sobre-tarjeta-suave']) {
    assert.match(p[k], /^#[0-9a-f]{6}$/, `${k} debe ser hex`);
  }
});

test('tarjeta/sobre del esquema crema/default: BLANCO fijo (byte-idéntico a bg-white/text-white de hoy)', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(p.tarjeta, '#ffffff');
  assert.equal(p.sobre, '#ffffff');
});

test('acento-txt (texto del BOTÓN): blanco para acento oscuro (byte-idéntico con text-white), tinta para uno claro', () => {
  // Nayoli (acento oscuro) → gana el blanco → #ffffff EXACTO = el `text-white` de hoy → byte-idéntico.
  assert.equal(derivarPaleta(NAYOLI)['acento-txt'], '#ffffff');
  // Neón (acento claro) → gana la tinta oscura, y el texto del botón queda legible sobre el neón.
  const neon = derivarPaleta(NEON)['acento-txt'];
  assert.notEqual(neon, '#ffffff');
  assert.ok(contraste(neon, NEON.acento) >= 4.5, `texto del botón sobre neón (fue ${contraste(neon, NEON.acento).toFixed(2)})`);
});

test('acento oscuro (Nayoli): acento-texto = el acento EXACTO — el split es byte-idéntico', () => {
  // #8b4513 ya contrasta ~7:1 sobre crema, así que el piso no lo toca y el guard a===b
  // evita el round-trip. Es lo que mantiene los 39 sitios re-mapeados idénticos.
  const p = derivarPaleta(NAYOLI);
  assert.equal(p['acento-texto'], '#8b4513');
  assert.ok(contraste(p['acento-texto'], p.fondo) >= 4.5);
});

test('acento NEÓN: el piso hace legibles los roles de TEXTO sobre fondo (≥4.5:1)', () => {
  const p = derivarPaleta(NEON);
  for (const rol of ['acento-texto', 'texto', 'texto-suave']) {
    assert.ok(contraste(p[rol], p.fondo) >= 4.5, `${rol} debe pasar AA sobre fondo (fue ${contraste(p[rol], p.fondo).toFixed(2)})`);
  }
});

test('acento NEÓN: el piso NO se pasa — los decorativos claros NO se oscurecen', () => {
  // La regla de dirección: sólo texto-sobre-claro pisa hacia oscuro. `tostado` es
  // decorativo/claro-sobre-oscuro, así que con un neón SIGUE claro (no floreado). Si
  // alguien "completa la simetría" floreándolo, este test se cae.
  const p = derivarPaleta(NEON);
  assert.ok(contraste(p.tostado, p.fondo) < 4.5, 'tostado NO debe estar floreado (es claro, decorativo)');
});

test('pisoContraste: oscurece un color claro hasta el objetivo; deja quieto uno ya oscuro', () => {
  assert.ok(contraste(pisoContraste('#e5ff00', '#faf7f4'), '#faf7f4') >= 4.5); // neón → oscurece
  assert.equal(pisoContraste('#1a0f08', '#faf7f4'), '#1a0f08'); // ya contrasta → sin cambio (exacto)
});

test('mezclar es identidad al 0 y al 1', () => {
  assert.equal(mezclar('#8b4513', '#faf7f4', 0), '#8b4513');
  assert.equal(mezclar('#8b4513', '#faf7f4', 1), '#faf7f4');
});

// ── pisoContraste GANA DIRECCIÓN (§ eje 5b) ──────────────────────────────────
// El único call site de producción (`derivarPaleta`, sobre la raíz `fondo`, CLARA en Nayoli)
// no pasa `dir`: la dirección se DERIVA de la luminancia de `bg`. Esto afirma que la derivación
// automática reproduce byte-a-byte lo que el mismo call site daba ANTES de que `dir` existiera.

test('pisoContraste SIN dir explícito: bg CLARO deriva "oscurecer" — byte-idéntico al comportamiento de antes', () => {
  // Antes de este parámetro, pisoContraste SIEMPRE oscurecía. Sobre un fondo claro (Nayoli) la
  // dirección derivada debe seguir siendo esa, y el resultado byte-idéntico.
  assert.equal(pisoContraste('#e5ff00', '#faf7f4'), pisoContraste('#e5ff00', '#faf7f4', 4.5, 'oscurecer'));
  assert.equal(pisoContraste('#1a0f08', '#faf7f4'), '#1a0f08'); // ya contrasta → sin cambio, exacto
});

test('pisoContraste con bg OSCURO deriva "aclarar", nunca oscurece', () => {
  // Sobre una superficie oscura, oscurecer un candidato ya oscuro (p.ej. la tinta) lo hunde en
  // negro y el contraste NUNCA mejora. La dirección derivada debe aclarar en su lugar.
  const out = pisoContraste('#8b4513', '#1a0f08'); // acento crudo sobre una superficie tinta
  assert.equal(out, pisoContraste('#8b4513', '#1a0f08', 4.5, 'aclarar'));
  assert.ok(contraste(out, '#1a0f08') >= 4.5, `debe alcanzar AA aclarando (fue ${contraste(out, '#1a0f08').toFixed(2)})`);
});

test('pisoContraste: dir explícito SE RESPETA aunque contradiga la dirección derivada de bg', () => {
  // `dir` es un override deliberado. Con un candidato de contraste bajo (1.28, necesita piso en
  // cualquier caso) sobre un bg CLARO —donde la dirección DERIVADA sería 'oscurecer'—, forzar
  // 'aclarar' tiene que MOVER la L hacia arriba igual (aunque, por estar del lado equivocado de
  // bg, no siempre alcance el objetivo — eso es física del contraste, no un bug de `dir`): el
  // resultado debe DIFERIR del que da la dirección derivada, y nunca coincidir con ella.
  const candidato = '#e8dace'; // 'linea', contraste 1.28 contra fondo
  const bg = '#faf7f4';
  assert.ok(contraste(candidato, bg) < 4.5, 'precondición: el candidato debe necesitar piso');
  const derivado = pisoContraste(candidato, bg, 4.5); // sin dir → deriva 'oscurecer' (bg claro)
  const forzadoAclarar = pisoContraste(candidato, bg, 4.5, 'aclarar');
  const forzadoOscurecer = pisoContraste(candidato, bg, 4.5, 'oscurecer');
  assert.equal(derivado, forzadoOscurecer, 'sin dir, debe coincidir con la dirección derivada');
  assert.notEqual(forzadoAclarar, forzadoOscurecer, 'el override debe producir un resultado distinto');
  assert.ok(contraste(forzadoOscurecer, bg) >= 4.5, 'la dirección correcta SÍ alcanza el objetivo');
});

// ── derivarEsquema (§ eje 5b) — INERTE: nadie la llama todavía ───────────────

test('derivarEsquema("crema", …) es EXACTO a derivarPaleta(…) — byte-idéntico', () => {
  assert.deepEqual(derivarEsquema(NAYOLI, 'crema'), derivarPaleta(NAYOLI));
  assert.deepEqual(derivarEsquema(NEON, 'crema'), derivarPaleta(NEON));
});

test('derivarEsquema: los 4 esquemas dan texto/texto-suave/acento-texto ≥4.5:1 contra su propia superficie', () => {
  const ids: EsquemaId[] = ['crema', 'superficie', 'oscuro', 'acento'];
  for (const raices of [NAYOLI, NEON, MEDIO]) {
    for (const id of ids) {
      const p = derivarEsquema(raices, id);
      const superficie = p.fondo;
      for (const rol of ['texto', 'texto-suave', 'acento-texto'] as const) {
        assert.ok(
          contraste(p[rol], superficie) >= 4.5,
          `${id}.${rol} debe pasar AA sobre su superficie (fue ${contraste(p[rol], superficie).toFixed(2)})`,
        );
      }
    }
  }
});

test('derivarEsquema("acento", …): esquema VÁLIDO — superficie = la raíz acento, texto flooreado', () => {
  const p = derivarEsquema(NAYOLI, 'acento');
  assert.equal(p.fondo, NAYOLI.acento);
  assert.ok(contraste(p.texto, p.fondo) >= 4.5);
});

test('derivarEsquema: "oscuro" y "acento" aclaran (nunca oscurecen) el piso de texto', () => {
  // Regresión directa del defecto que este eje cierra: antes, un esquema de superficie oscura
  // sólo podía OSCURECER, lo que hunde el texto en negro sin mejorar el contraste.
  const oscuro = derivarEsquema(NAYOLI, 'oscuro');
  const acentoEsq = derivarEsquema(NAYOLI, 'acento');
  assert.notEqual(oscuro.texto, '#000000');
  assert.notEqual(acentoEsq.texto, '#000000');
});

// ── EL TEXTO DE LOS ESQUEMAS OSCUROS ES CÁLIDO Y BRILLANTE, NO UN PISO RASO ──────────────────
// Regresión del defecto que esta pasada del eje cierra: florear el rol `texto` oscuro (una
// mezcla acento/tinta) hasta el mínimo daba un piso RASO —~4.5–4.6:1, apenas AA, un gris
// apagado sin identidad de marca—. `texto` sobre una superficie OSCURA debe reusar un candidato
// CLARO ya derivado (`tostado`/`acento-txt`) y quedar con HOLGURA sobre el piso, no pegado a él.

test('derivarEsquema: "oscuro"/"acento" — texto es CÁLIDO con holgura (≥6.5:1), no un piso raso a 4.5', () => {
  const oscuro = derivarEsquema(NAYOLI, 'oscuro');
  const acentoEsq = derivarEsquema(NAYOLI, 'acento');
  assert.ok(
    contraste(oscuro.texto, oscuro.fondo) >= 6.5,
    `oscuro.texto debe tener holgura, no quedar raso a 4.5 (fue ${contraste(oscuro.texto, oscuro.fondo).toFixed(2)})`,
  );
  assert.ok(
    contraste(acentoEsq.texto, acentoEsq.fondo) >= 6.5,
    `acento.texto debe tener holgura, no quedar raso a 4.5 (fue ${contraste(acentoEsq.texto, acentoEsq.fondo).toFixed(2)})`,
  );
});

test('derivarEsquema: contraste por esquema, medido contra Nayoli — cerca de las figuras del doc (§ eje 5b-motor-2)', () => {
  // Las figuras del doc (superficie · texto · texto-suave): crema 9.97/7.70 (= derivarPaleta de
  // hoy, sin cambios), superficie 8.71/6.73 (sin cambios), oscuro 8.49/4.52, acento 7.10/4.56.
  // Tolerancia generosa (±0.3) porque el piso avanza en pasos discretos de L y no siempre puede
  // pisar el número exacto — la meta es ACERCARSE, no calzar al centavo (el piso de 4.5 SÍ es
  // exacto, y ya lo cubre el test de arriba).
  const FIGURAS: Record<EsquemaId, { texto: number; textoSuave: number }> = {
    crema: { texto: 9.97, textoSuave: 7.70 },
    superficie: { texto: 8.71, textoSuave: 6.73 },
    oscuro: { texto: 8.49, textoSuave: 4.52 },
    acento: { texto: 7.10, textoSuave: 4.56 },
  };
  for (const [id, objetivo] of Object.entries(FIGURAS) as [EsquemaId, { texto: number; textoSuave: number }][]) {
    const p = derivarEsquema(NAYOLI, id);
    const cTexto = contraste(p.texto, p.fondo);
    const cSuave = contraste(p['texto-suave'], p.fondo);
    assert.ok(
      Math.abs(cTexto - objetivo.texto) <= 0.3,
      `${id}.texto lejos del objetivo ${objetivo.texto} (fue ${cTexto.toFixed(2)})`,
    );
    assert.ok(
      Math.abs(cSuave - objetivo.textoSuave) <= 0.3,
      `${id}.texto-suave lejos del objetivo ${objetivo.textoSuave} (fue ${cSuave.toFixed(2)})`,
    );
  }
});

test('derivarEsquema: tarjeta/sobre por esquema no-crema NO son blanco fijo (se re-derivan de la superficie)', () => {
  for (const id of ['superficie', 'oscuro', 'acento'] as const) {
    const p = derivarEsquema(NAYOLI, id);
    assert.notEqual(p.tarjeta, '#ffffff', `${id}.tarjeta no debe quedar en el blanco fijo del default`);
    assert.ok(contraste(p.sobre, p.tarjeta) >= 4.5, `${id}.sobre debe leerse sobre ${id}.tarjeta`);
  }
});

// ── FAMILIA `superficie` (§ TEMAS-P6-FAMILIAS-1) — REGRESIÓN del defecto que el par nuevo cierra ──
// `--sf-superficie` es RAÍZ (RECETA, nunca esquema-scoped), y hoy la leen ProductChip/ProductCard
// con tokens de OTRAS familias (`--sf-tostado-3`, `--sf-tinta`, `--sf-texto`) que NUNCA se florearon
// contra ella. Este test afirma el defecto tal cual estaba ANTES de este slice, con los exports que
// YA existían (`derivarPaleta`, `contraste`) — VISTO FALLAR (node --import tsx --test
// lib/config/palette-derive.test.ts) antes de agregar `sobre-superficie`: NAYOLI tostado-3/superficie
// = 3.412 (medido, cerca de la cifra del censo, 3.41) y MEDIO texto/superficie = 4.186 — los dos bajo
// 4.5. Éste es el discriminador de §4(c): un test que nunca se vio fallar no prueba nada.
test('REGRESIÓN §2.2: los tokens de OTRAS familias que ProductChip/ProductCard leían hoy sobre `--sf-superficie` NO pasan AA de forma confiable', () => {
  const pNayoli = derivarPaleta(NAYOLI);
  const pMedio = derivarPaleta(MEDIO);
  assert.ok(
    contraste(pNayoli['tostado-3'], pNayoli.superficie) < 4.5,
    `defecto esperado: tostado-3/superficie de NAYOLI debía estar bajo AA (fue ${contraste(pNayoli['tostado-3'], pNayoli.superficie).toFixed(3)})`,
  );
  assert.ok(
    contraste(pMedio.texto, pMedio.superficie) < 4.5,
    `defecto esperado: texto/superficie de MEDIO debía estar bajo AA (fue ${contraste(pMedio.texto, pMedio.superficie).toFixed(3)})`,
  );
});

// ── FAMILIA `superficie`: su PROPIO par, floreado contra `--sf-superficie` (§ TEMAS-P6-FAMILIAS-1) ──
// `--sf-superficie` es RAÍZ (RECETA), no esquema-scoped —a diferencia de `tarjeta`/`banda`, ningún
// esquema la re-deriva—, así que su par vive en `derivarPaleta`, no en `esquemaStyle`. SIN default en
// `globals.css` a propósito (mismo patrón que `--sf-sobre-banda`): los consumidores traen su propio
// fallback al token de hoy, así que Nayoli (raíces null → `cssPaleta` no inyecta nada) no cambia.
test('derivarPaleta: sobre-superficie/sobre-superficie-suave ≥4.5:1 contra `superficie`, en las 3 raíces del test', () => {
  for (const raices of [NAYOLI, NEON, MEDIO]) {
    const p = derivarPaleta(raices);
    for (const rol of ['sobre-superficie', 'sobre-superficie-suave']) {
      assert.ok(
        contraste(p[rol], p.superficie) >= 4.5,
        `${rol} debe pasar AA sobre superficie (fue ${contraste(p[rol], p.superficie).toFixed(2)})`,
      );
    }
  }
});

test('derivarPaleta: sobre-superficie y sobre-superficie-suave son DISTINTOS — la jerarquía principal/secundaria no se colapsa', () => {
  for (const raices of [NAYOLI, NEON, MEDIO]) {
    const p = derivarPaleta(raices);
    assert.notEqual(p['sobre-superficie'], p['sobre-superficie-suave']);
  }
});

// ── FAMILIA `tarjeta`: el par completo — `--sf-sobre-tarjeta`/`-suave` (§ TEMAS-P6-FAMILIAS-1) ──
// `--sf-sobre` YA EXISTE pero es INSEGURO para este rol: (a) es la MISMA var que el resto del
// storefront usa como "texto sobre TINTA" (footer, botones, nav — su default de :root es #ffffff
// para ESE rol, no para tarjeta), y (b) para el esquema 'crema' (tarjeta blanca fija) su valor
// queda degenerado — blanco sobre blanco, 1:1, medido —. Reusarlo habría dejado el nombre del
// producto invisible en CUALQUIER página sin esquema asignado (que es el caso real de Nayoli hoy en
// /tienda, /suscripciones, y en el home mientras nadie asigne un esquema): `--sf-tarjeta` y
// `--sf-sobre` son AMBOS #ffffff por default de `globals.css`, y ningún fallback CSS puede rescatar
// una var que YA tiene default (var(--sf-sobre,X) nunca cae a X: la var siempre está definida). Por
// eso el par nuevo lleva NOMBRE PROPIO, sin default en globals.css (mismo patrón que sobre-banda):
// los 4 consumidores de esta pasada usan `var(--sf-sobre-tarjeta,var(--sf-tinta))` — Nayoli (sin
// esquema en ningún lado) cae exactamente al texto de hoy.
test('derivarPaleta: sobre-tarjeta (crema/default) es byte-idéntico al texto de HOY (tinta/acento-texto), no al degenerado --sf-sobre', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(p.tarjeta, '#ffffff');
  assert.equal(p.sobre, '#ffffff'); // el token viejo, sin tocar: sigue degenerado para 'crema'
  assert.equal(p['sobre-tarjeta'], NAYOLI.tinta, 'sobre-tarjeta debe ganarle al blanco degenerado y dar la tinta');
  assert.equal(p['sobre-tarjeta-suave'], NAYOLI.acento, 'sobre-tarjeta-suave = acento-texto de hoy, sin cambio (ya pasaba AA)');
});

test('derivarEsquema: sobre-tarjeta/sobre-tarjeta-suave ≥4.5:1 contra `tarjeta`, en los 4 esquemas × 3 raíces', () => {
  const ids: EsquemaId[] = ['crema', 'superficie', 'oscuro', 'acento'];
  for (const raices of [NAYOLI, NEON, MEDIO]) {
    for (const id of ids) {
      const p = derivarEsquema(raices, id);
      for (const rol of ['sobre-tarjeta', 'sobre-tarjeta-suave']) {
        assert.ok(
          contraste(p[rol], p.tarjeta) >= 4.5,
          `${id}.${rol} debe pasar AA sobre tarjeta (fue ${contraste(p[rol], p.tarjeta).toFixed(2)})`,
        );
      }
    }
  }
});

test('derivarEsquema: sobre-tarjeta y sobre-tarjeta-suave son DISTINTOS en los 4 esquemas — la jerarquía no se colapsa', () => {
  for (const id of ['crema', 'superficie', 'oscuro', 'acento'] as const) {
    const p = derivarEsquema(NAYOLI, id);
    assert.notEqual(p['sobre-tarjeta'], p['sobre-tarjeta-suave'], `${id}: principal y secundario no deben coincidir`);
  }
});

test('derivarEsquema: sobre-tarjeta CIERRA el hueco medido (1.215/1.249 con NAYOLI, tokens raíz sobre tarjeta esquemada)', () => {
  // El defecto que motivó esta familia: `--sf-tinta` (root) contra la tarjeta de 'oscuro' daba
  // 1.215:1, y `--sf-acento-texto` (root) contra la tarjeta de 'acento' daba 1.249:1 — los dos
  // MEDIDOS contra el código de hoy, antes de este fix (§ el reporte de la tanda).
  const oscuro = derivarEsquema(NAYOLI, 'oscuro');
  const acentoEsq = derivarEsquema(NAYOLI, 'acento');
  assert.ok(contraste(NAYOLI.tinta, oscuro.tarjeta) < 4.5, 'precondición: el defecto viejo debía existir en oscuro');
  assert.ok(contraste(derivarPaleta(NAYOLI)['acento-texto'], acentoEsq.tarjeta) < 4.5, 'precondición: el defecto viejo debía existir en acento');
  assert.ok(contraste(oscuro['sobre-tarjeta'], oscuro.tarjeta) >= 4.5);
  assert.ok(contraste(acentoEsq['sobre-tarjeta-suave'], acentoEsq.tarjeta) >= 4.5);
});
