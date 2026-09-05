import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletaEditableSchema } from './palette-schema';

// La puerta de validación del tema (raíces de paleta + par tipográfico). NO borrar: es lo que impide
// que un string basura del editor llegue al motor de derivación. `fuentePar` es REQUERIDO —el editor
// escribe el tema WHOLESALE, así que el wire siempre carga el par (omitirlo lo resetearía en silencio)—.

test('3 hex de 6 dígitos válidos + par: pasa', () => {
  const r = paletaEditableSchema.safeParse({ paletaFondo: '#faf7f4', paletaTinta: '#1a0f08', paletaAcento: '#8b4513', fuentePar: 'calido' });
  assert.ok(r.success);
});

test('las tres en null + par null (usar defaults): pasa', () => {
  const r = paletaEditableSchema.safeParse({ paletaFondo: null, paletaTinta: null, paletaAcento: null, fuentePar: null });
  assert.ok(r.success);
});

test('"rojo" se rechaza — no es un hex', () => {
  const r = paletaEditableSchema.safeParse({ paletaFondo: 'rojo', paletaTinta: '#1a0f08', paletaAcento: '#8b4513', fuentePar: null });
  assert.ok(!r.success);
});

test('un hex de 3/4/8 dígitos se rechaza — exige 6', () => {
  for (const malo of ['#f00', '#f000', '#f00000ff', '8b4513', '#GGGGGG']) {
    const r = paletaEditableSchema.safeParse({ paletaFondo: malo, paletaTinta: '#1a0f08', paletaAcento: '#8b4513', fuentePar: null });
    assert.ok(!r.success, `${malo} debe rechazarse`);
  }
});

test('paleta A MEDIAS (una raíz sí, otra null) se rechaza — el motor necesita las 3', () => {
  const r = paletaEditableSchema.safeParse({ paletaFondo: '#faf7f4', paletaTinta: null, paletaAcento: '#8b4513', fuentePar: null });
  assert.ok(!r.success);
});

test('un par FUERA del set cerrado se rechaza; los 5 del set pasan (+ null)', () => {
  const base = { paletaFondo: null, paletaTinta: null, paletaAcento: null };
  assert.ok(!paletaEditableSchema.safeParse({ ...base, fuentePar: 'comic-sans' }).success);
  for (const par of ['editorial', 'calido', 'moderno', 'clasico', 'nitido', null]) {
    assert.ok(paletaEditableSchema.safeParse({ ...base, fuentePar: par }).success, `${par} debe pasar`);
  }
});

test('fuentePar AUSENTE se rechaza — el wire del tema debe cargar el par siempre (no resetearlo en silencio)', () => {
  const r = paletaEditableSchema.safeParse({ paletaFondo: null, paletaTinta: null, paletaAcento: null });
  assert.ok(!r.success);
});
