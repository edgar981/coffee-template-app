import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partirAyuda } from './AyudaCampo';

// § EDITOR-VISUAL-NIVELES-1 — `partirAyuda` es la mitad PURA de la ayuda corta del panel (la otra
// mitad, `AyudaCampo`, es JSX y se verifica por captura/gate visual). Capa 1, sin DOM.

test('un hint corto se queda tal cual, sin "completa" que mostrar detrás de un «?»', () => {
  const r = partirAyuda('Vacío: se usa el texto por defecto.');
  assert.equal(r.corta, 'Vacío: se usa el texto por defecto.');
  assert.equal(r.completa, null);
});

test('string vacío no revienta: corta vacía, sin completa', () => {
  const r = partirAyuda('');
  assert.equal(r.corta, '');
  assert.equal(r.completa, null);
});

test('un hint largo con una primera oración corta se trunca en el punto, conservando el original completo', () => {
  const hint = 'Vacío: no se muestra. Es la línea bajo el titular que aparece sólo con las composiciones "media" o "sticky", en cursiva, para dar énfasis a una palabra del mensaje.';
  const r = partirAyuda(hint);
  assert.equal(r.corta, 'Vacío: no se muestra.');
  assert.equal(r.completa, hint);
});

test('un hint largo SIN una primera oración corta se trunca por palabra con elipsis', () => {
  const hint = 'Sólo con la composición "sticky" y el velo encendido, controla qué tan oscuro se pone el velo que cubre el video de fondo mientras el visitante hace scroll por la página de inicio';
  const r = partirAyuda(hint);
  assert.ok(r.corta.endsWith('…'), `esperaba elipsis al final, dio "${r.corta}"`);
  assert.ok(r.corta.length <= 71, `esperaba <=70 chars + elipsis, dio ${r.corta.length}`);
  // La corta nunca parte una palabra a la mitad: siempre corta en un espacio.
  assert.ok(hint.startsWith(r.corta.slice(0, -1)), 'la corta debe ser un prefijo literal del original');
  assert.equal(r.completa, hint);
});

test('un hint EXACTAMENTE en el umbral no lleva «?»', () => {
  const hint = 'x'.repeat(70);
  const r = partirAyuda(hint);
  assert.equal(r.corta, hint);
  assert.equal(r.completa, null);
});

test('un hint de 71 caracteres, sin oraciones ni espacios, se trunca a 70 + elipsis', () => {
  const hint = 'x'.repeat(71);
  const r = partirAyuda(hint);
  assert.equal(r.corta, `${'x'.repeat(70)}…`);
  assert.equal(r.completa, hint);
});

// § EDITOR-ESTADO-PAGINAS-1 (G8) — el recorte nunca deja sólo «Ej.» o «p. ej.»: el `". "` de una
// abreviatura conocida no cuenta como fin de oración.

test('«Ej. …» al principio del hint no se toma como fin de oración — la corta nunca queda en "Ej."', () => {
  const hint = 'Ej. "Presentación Clásica". Vacío: se usa el texto por defecto. No aplica si el tema activo usa la composición "riel" — ahí las tarjetas son los productos del catálogo.';
  const r = partirAyuda(hint);
  assert.ok(!r.corta.trim().match(/^Ej\.$/), `la corta no debe quedar en "Ej.", dio "${r.corta}"`);
  // Las DOS primeras oraciones reales (después de "Ej. ...Clásica".) entran en el presupuesto —
  // la corta las incluye enteras, no sólo la primera.
  assert.equal(r.corta, 'Ej. "Presentación Clásica". Vacío: se usa el texto por defecto.');
  assert.equal(r.completa, hint);
});

test('«p. ej. …» en medio del hint tampoco corta ahí — la corta no termina en "p."', () => {
  const hint = 'Opcional, como TEXTO: escribe la moneda y la unidad, p. ej. «$ 45.000/mes» o «desde $ 40.000». Vacío: no se muestra.';
  const r = partirAyuda(hint);
  assert.ok(!r.corta.trim().endsWith('p.'), `la corta no debe terminar en "p.", dio "${r.corta}"`);
  assert.equal(r.completa, hint);
});

test('dos oraciones cortas que juntas entran en el presupuesto se muestran ENTERAS, no sólo la primera', () => {
  const primera = 'Vacío: no se muestra.';
  const segunda = 'No aplica con "riel".';
  const hint = `${primera} ${segunda} Más texto que ya no entra en el presupuesto de setenta caracteres de ninguna forma.`;
  const r = partirAyuda(hint);
  // Las dos oraciones cortas juntas entran bajo el presupuesto — la corta las trae a las DOS, no
  // se detiene en la primera por "ya hay una oración que entra, no sigas buscando".
  assert.equal(r.corta, `${primera} ${segunda}`);
  assert.equal(r.completa, hint);
});

test('una advertencia que NO entra se omite entera detrás del «?», nunca cortada a la mitad', () => {
  const primera = 'Vacío: se usa el texto por defecto.';
  const advertencia = 'No aplica si el tema activo usa la composición "riel", porque ahí las tarjetas que se muestran son directamente los productos del catálogo elegido';
  const hint = `${primera} ${advertencia}.`;
  const r = partirAyuda(hint);
  assert.equal(r.corta, primera); // sólo la oración que SÍ entra completa
  assert.ok(!r.corta.includes('No aplica'), 'la advertencia no debe aparecer a medias en la corta');
  assert.equal(r.completa, hint);
});
