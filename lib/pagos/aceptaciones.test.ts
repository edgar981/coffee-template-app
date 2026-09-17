import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarAceptaciones, etiquetaMetodoPasarela, unirNombresConY, type AceptacionesCrudas } from './aceptaciones';

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

// § CHECKOUT-UNA-SOLA-PANTALLA-1: la etiqueta se GENERA desde `metodosOtros`, nunca un texto fijo.

test('unirNombresConY: cero, uno, dos y tres nombres', () => {
  assert.equal(unirNombresConY([]), '');
  assert.equal(unirNombresConY(['Nequi']), 'Nequi');
  assert.equal(unirNombresConY(['Nequi', 'Daviplata']), 'Nequi y Daviplata');
  assert.equal(unirNombresConY(['Nequi', 'Daviplata', 'Bre-B']), 'Nequi, Daviplata y Bre-B');
});

test('etiquetaMetodoPasarela: sin métodos adicionales → sólo tarjeta', () => {
  assert.equal(etiquetaMetodoPasarela([]), 'Tarjeta de crédito o débito');
});

test('etiquetaMetodoPasarela: con un método adicional del registro → lo nombra', () => {
  assert.equal(etiquetaMetodoPasarela(['NEQUI']), 'Tarjeta y Nequi');
});

test('etiquetaMetodoPasarela: un tipo SIN descriptor en el registro se omite en silencio, nunca revienta', () => {
  assert.equal(etiquetaMetodoPasarela(['PSE']), 'Tarjeta de crédito o débito');
  assert.equal(etiquetaMetodoPasarela(['NEQUI', 'PSE']), 'Tarjeta y Nequi');
});

test('etiquetaMetodoPasarela: nunca menciona el nombre del proveedor', () => {
  assert.ok(!etiquetaMetodoPasarela(['NEQUI']).toLowerCase().includes('wompi'));
});
