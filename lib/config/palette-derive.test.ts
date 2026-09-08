import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarPaleta, derivarEsquema, pisoContraste, contraste, mezclar, type RaicesPaleta, type EsquemaId } from './palette-derive';

// El motor de color del storefront — puro, así que los tests son propiedades sobre la
// derivación. Se corre con `npm test` (capa 1). NO borrar: es lo único que afirma que el
// PISO DE CONTRASTE se aplica a los roles correctos y a ninguno más.

const NAYOLI: RaicesPaleta = { fondo: '#faf7f4', tinta: '#1a0f08', acento: '#8b4513' };
const NEON:   RaicesPaleta = { fondo: '#f6f5f3', tinta: '#1c1a18', acento: '#e5ff00' };

test('las 3 raíces se copian tal cual', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(p.fondo, '#faf7f4');
  assert.equal(p.tinta, '#1a0f08');
  assert.equal(p.acento, '#8b4513');
});

test('deriva las 24 tintas (3 raíces + 18 de la RECETA + acento-txt + tarjeta/sobre, § eje 5b)', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(Object.keys(p).length, 24);
  for (const k of ['superficie','linea','superficie-2','tinta-2','acento-2','acento-3','acento-4','acento-texto','acento-txt','texto','texto-suave','tostado','tostado-2','tostado-3','tostado-4','tostado-5','tostado-6','tostado-7','tostado-8','tarjeta','sobre']) {
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
  for (const raices of [NAYOLI, NEON]) {
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
