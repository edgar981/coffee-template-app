import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarAceptaciones, type AceptacionesCrudas } from './aceptaciones';

const COMPLETAS: AceptacionesCrudas = {
  terminos:        { token: 'tok-terminos', enlace: 'https://wompi.co/terminos.pdf' },
  datosPersonales: { token: 'tok-datos',    enlace: 'https://wompi.co/datos.pdf' },
};

test('las dos completas → las dos aceptaciones, con su token y su enlace', () => {
  const r = evaluarAceptaciones(COMPLETAS);
  assert.ok(r);
  assert.deepEqual(r, {
    terminos:        { token: 'tok-terminos', enlace: 'https://wompi.co/terminos.pdf' },
    datosPersonales: { token: 'tok-datos',    enlace: 'https://wompi.co/datos.pdf' },
  });
});

test('falta el TOKEN de una de las dos → null (no a medias)', () => {
  assert.equal(evaluarAceptaciones({ ...COMPLETAS, terminos: { ...COMPLETAS.terminos, token: null } }), null);
  assert.equal(evaluarAceptaciones({ ...COMPLETAS, datosPersonales: { ...COMPLETAS.datosPersonales, token: '' } }), null);
  assert.equal(evaluarAceptaciones({ ...COMPLETAS, terminos: { ...COMPLETAS.terminos, token: '   ' } }), null); // sólo espacios
});

test('falta el ENLACE de una de las dos → null (un token sin enlace no sirve)', () => {
  assert.equal(evaluarAceptaciones({ ...COMPLETAS, terminos: { ...COMPLETAS.terminos, enlace: null } }), null);
  assert.equal(evaluarAceptaciones({ ...COMPLETAS, datosPersonales: { ...COMPLETAS.datosPersonales, enlace: '' } }), null);
});

test('la respuesta no trae nada de esto → null', () => {
  const vacia: AceptacionesCrudas = {
    terminos:        { token: null, enlace: null },
    datosPersonales: { token: null, enlace: null },
  };
  assert.equal(evaluarAceptaciones(vacia), null);
});
