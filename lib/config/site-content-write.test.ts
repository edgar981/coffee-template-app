import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionarTema } from './site-content-write';

// Capa 1, SIN base (`lib/**/*.test.ts` es el glob DB-FREE del carril rápido, § CLAUDE.md "El carril
// rápido cubre `app/`" — la MISMA regla aplicada a `lib/`): `site-content-write.ts` importa
// `prisma from '@duna/core'`, así que esta suite SÓLO ejercita `fusionarTema` — la mitad PURA del
// archivo, sin `tx` ni prisma — nunca `guardarTemaBorrador` (que exige Postgres real y vive probado
// en `tests/integracion/paleta-ejes.test.ts`).
//
// § PALETA-GUARDAR-CONSERVA-EJES-1: antes de este fix, `guardarTemaBorrador` reemplazaba `tema`
// ENTERO con los cinco campos del panel — `{...borrador, tema}`. Esta suite afirma el reemplazo que
// lo sustituyó: `{ ...base, ...nuevo }` conserva cualquier campo de `base` que `nuevo` no declara.

const CINCO_CAMPOS = { fondo: '#ffffff', tinta: '#102407', acento: '#a70004', fuentePar: 'prensa', forma: 'recta' } as const;

test('fusionarTema: sobre una base VACÍA, el resultado es exactamente los cinco campos nuevos', () => {
  const r = fusionarTema({}, CINCO_CAMPOS);
  assert.deepEqual(r, { ...CINCO_CAMPOS });
});

test('fusionarTema: preserva los ejes aditivos (origenTexto/origenAccion/escalaDisplay) que el panel no declara', () => {
  // La base simula `content.tema` tras aplicar el preset CORTE (§ themes.ts): las 3 raíces + par +
  // forma de CORTE, MÁS los dos ejes aditivos y la escala de display que SÓLO `mergePresetEnContent`
  // escribe — el panel nunca los manda (`paletaEditableSchema` no los declara).
  const baseConCorte = {
    fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004', fuentePar: 'prensa', forma: 'recta',
    origenTexto: 'tinta', origenAccion: 'acento', escalaDisplay: 'amplia',
  };
  // El dueño edita SÓLO el fondo desde el panel; `wireDe` (PaletaSeccion.tsx) manda el objeto
  // COMPLETO de los cinco campos que SÍ controla, con el resto reenviado tal cual estaba.
  const r = fusionarTema(baseConCorte, {
    fondo: '#ffffff', tinta: '#102407', acento: '#a70004', fuentePar: 'prensa', forma: 'recta',
  });
  assert.equal(r.fondo, '#ffffff', 'el campo editado SÍ cambia');
  assert.equal(r.origenTexto, 'tinta', 'origenTexto del preset sobrevive — el panel no lo declaró');
  assert.equal(r.origenAccion, 'acento', 'origenAccion del preset sobrevive — el panel no lo declaró');
  assert.equal(r.escalaDisplay, 'amplia', 'escalaDisplay del preset sobrevive — el panel no lo declaró');
});

test('fusionarTema: un campo nuevo en null SÍ pisa el valor existente (editar a fábrica es una edición real)', () => {
  // `fusionarTema` fusiona por CLAVE, no por "valor truthy": una raíz que el dueño vuelve a null
  // (fábrica) debe PISAR el hex que hubiera, no conservarlo — `nuevo` manda sobre `base` para las
  // claves que SÍ declara.
  const r = fusionarTema({ fondo: '#fdfbf7', origenTexto: 'tinta' }, { ...CINCO_CAMPOS, fondo: null });
  assert.equal(r.fondo, null, 'null es un valor válido que SÍ debe sobreescribir');
  assert.equal(r.origenTexto, 'tinta', 'lo no declarado por `nuevo` sigue intacto');
});

test('fusionarTema: aplicado dos veces seguidas (simulando dos guardados) sigue preservando lo ajeno', () => {
  const baseConCorte = { fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004', origenAccion: 'acento' };
  const primerGuardado = fusionarTema(baseConCorte, { fondo: '#ffffff', tinta: '#102407', acento: '#a70004', fuentePar: null, forma: null });
  const segundoGuardado = fusionarTema(primerGuardado, { fondo: '#eeeeee', tinta: '#102407', acento: '#a70004', fuentePar: null, forma: null });
  assert.equal(segundoGuardado.fondo, '#eeeeee');
  assert.equal(segundoGuardado.origenAccion, 'acento', 'el segundo guardado fusiona sobre lo que el primero ya preservó');
});
