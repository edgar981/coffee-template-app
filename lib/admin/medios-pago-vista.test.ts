import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MetodoPagoGuardado } from '@/lib/checkout/metodos-pago';
import type { MetodoPasarelaCruzado } from '@/lib/pagos/metodos-pasarela';
import {
  INICIALES_MEDIO, NOTA_CONTRAENTREGA, nombreMedioPago, datoClaveMedioPago, filaMedioPago,
  filasMediosPago, vistaClienteMetodos, vistaClientePasarela, nombreVisiblePasarela, chipsPasarela,
} from './medios-pago-vista';

// Capa 1 — puro. Afirma el FORMATO de la lista «Cómo te pueden pagar», no la regla de "¿se
// muestra?" (ésa es de `metodoIncompleto`/`metodosDisponibles`, ya testeada en
// `lib/checkout/metodos-pago.test.ts` — si existiera; este archivo no la repite).

test('las cinco iniciales son fijas, dos letras cada una', () => {
  assert.deepEqual(INICIALES_MEDIO, {
    nequi: 'NQ', daviplata: 'DP', breb: 'BB', transferencia: 'TR', efectivo: 'EF',
  });
});

test('nombreMedioPago: transferencia con banco pega el banco al label', () => {
  const m: MetodoPagoGuardado = { tipo: 'transferencia', datos: { banco: 'Bancolombia' } };
  assert.equal(nombreMedioPago(m), 'Transferencia Bancaria · Bancolombia');
});

test('nombreMedioPago: transferencia SIN banco es sólo el label', () => {
  const m: MetodoPagoGuardado = { tipo: 'transferencia', datos: {} };
  assert.equal(nombreMedioPago(m), 'Transferencia Bancaria');
});

test('nombreMedioPago: los demás tipos son siempre sólo el label', () => {
  assert.equal(nombreMedioPago({ tipo: 'nequi', datos: { numero: '3105550142' } }), 'Nequi');
  assert.equal(nombreMedioPago({ tipo: 'efectivo', datos: {} }), 'Contra entrega');
});

test('datoClaveMedioPago: nequi/daviplata es el número tal cual, o null sin él', () => {
  assert.equal(datoClaveMedioPago({ tipo: 'nequi', datos: { numero: '310 555 0142' } }), '310 555 0142');
  assert.equal(datoClaveMedioPago({ tipo: 'nequi', datos: {} }), null);
  assert.equal(datoClaveMedioPago({ tipo: 'daviplata', datos: { numero: '' } }), null);
});

test('datoClaveMedioPago: breb es la llave tal cual, o null sin ella', () => {
  assert.equal(datoClaveMedioPago({ tipo: 'breb', datos: { llave: '@fincasanadolfo' } }), '@fincasanadolfo');
  assert.equal(datoClaveMedioPago({ tipo: 'breb', datos: {} }), null);
});

test('datoClaveMedioPago: transferencia enmascara la cuenta a los últimos 4 dígitos', () => {
  const m: MetodoPagoGuardado = {
    tipo: 'transferencia',
    datos: { banco: 'Bancolombia', tipoCuenta: 'Ahorros', numeroCuenta: '1234567884821', titular: 'Finca San Adolfo SAS' },
  };
  assert.equal(datoClaveMedioPago(m), 'Ahorros ···· 4821 · Finca San Adolfo SAS');
});

test('datoClaveMedioPago: transferencia sin titular omite la última parte', () => {
  const m: MetodoPagoGuardado = {
    tipo: 'transferencia',
    datos: { banco: 'Bancolombia', tipoCuenta: 'Ahorros', numeroCuenta: '4821', titular: '' },
  };
  assert.equal(datoClaveMedioPago(m), 'Ahorros ···· 4821');
});

test('datoClaveMedioPago: transferencia con sólo 3 dígitos de cuenta muestra el número completo', () => {
  const m: MetodoPagoGuardado = {
    tipo: 'transferencia',
    datos: { banco: 'Bancolombia', tipoCuenta: 'Ahorros', numeroCuenta: '821', titular: '' },
  };
  assert.equal(datoClaveMedioPago(m), 'Ahorros ···· 821');
});

test('datoClaveMedioPago: transferencia sin NADA de cuenta es null (incompleto)', () => {
  const m: MetodoPagoGuardado = { tipo: 'transferencia', datos: {} };
  assert.equal(datoClaveMedioPago(m), null);
});

test('datoClaveMedioPago: efectivo es siempre la regla de contraentrega', () => {
  assert.equal(datoClaveMedioPago({ tipo: 'efectivo', datos: {} }), NOTA_CONTRAENTREGA);
});

test('filaMedioPago: completo → activo, sin faltante', () => {
  const fila = filaMedioPago({ tipo: 'nequi', datos: { numero: '3105550142' } });
  assert.equal(fila.activo, true);
  assert.equal(fila.faltante, null);
  assert.equal(fila.iniciales, 'NQ');
});

test('filaMedioPago: incompleto → no activo, con la frase de qué falta', () => {
  const fila = filaMedioPago({ tipo: 'daviplata', datos: {} });
  assert.equal(fila.activo, false);
  assert.equal(fila.faltante, 'Falta el número');
});

test('filasMediosPago: respeta el orden CANÓNICO, no el de guardado', () => {
  const metodos: MetodoPagoGuardado[] = [
    { tipo: 'efectivo', datos: {} },
    { tipo: 'nequi', datos: { numero: '3105550142' } },
    { tipo: 'breb', datos: { llave: 'x' } },
  ];
  assert.deepEqual(filasMediosPago(metodos).map(f => f.tipo), ['nequi', 'breb', 'efectivo']);
});

test('filasMediosPago: omite lo que no está guardado, sin inventar filas', () => {
  const metodos: MetodoPagoGuardado[] = [{ tipo: 'nequi', datos: {} }];
  assert.deepEqual(filasMediosPago(metodos).map(f => f.tipo), ['nequi']);
});

test('vistaClienteMetodos: reusa metodosDisponibles — un método incompleto no aparece', () => {
  const metodos: MetodoPagoGuardado[] = [
    { tipo: 'nequi', datos: { numero: '3105550142' } },
    { tipo: 'daviplata', datos: {} },
  ];
  const vista = vistaClienteMetodos(metodos);
  assert.deepEqual(vista.map(o => o.id), ['nequi']);
});

test('vistaClientePasarela: usa el copy real del checkout (subtituloPagoPasarela)', () => {
  const op = vistaClientePasarela([]);
  assert.equal(op.label, 'Pago en línea');
  assert.equal(op.desc, 'Tarjeta · se confirma al instante');
});

test('nombreVisiblePasarela: CARD es "Tarjeta", el resto sale del registro de descriptores', () => {
  assert.equal(nombreVisiblePasarela('CARD'), 'Tarjeta');
  assert.equal(nombreVisiblePasarela('NEQUI'), 'Nequi');
});

test('nombreVisiblePasarela: un tipo sin descriptor cae al tipo crudo', () => {
  assert.equal(nombreVisiblePasarela('PSE'), 'PSE');
});

test('chipsPasarela: disponible → encendido, interactivo, sin advertencia', () => {
  const cruzado: MetodoPasarelaCruzado[] = [{ tipo: 'NEQUI', estado: 'disponible' }];
  const [chip] = chipsPasarela(cruzado);
  assert.equal(chip.tipo, 'NEQUI');
  assert.equal(chip.nombre, 'Nequi');
  assert.equal(chip.on, true);
  assert.equal(chip.interactivo, true);
  assert.equal(chip.rancio, false);
  assert.equal(chip.titulo, undefined);
});

test('chipsPasarela: disponible_no_ofrecido → apagado, interactivo (tocarlo lo encendería)', () => {
  const cruzado: MetodoPasarelaCruzado[] = [{ tipo: 'CARD', estado: 'disponible_no_ofrecido' }];
  const [chip] = chipsPasarela(cruzado);
  assert.equal(chip.on, false);
  assert.equal(chip.interactivo, true);
  assert.equal(chip.rancio, false);
  assert.equal(chip.titulo, undefined);
});

test('chipsPasarela: guardado_no_disponible → encendido pero RANCIO, interactivo (tocarlo lo quita)', () => {
  const cruzado: MetodoPasarelaCruzado[] = [{ tipo: 'NEQUI', estado: 'guardado_no_disponible' }];
  const [chip] = chipsPasarela(cruzado);
  assert.equal(chip.on, true);
  assert.equal(chip.interactivo, true);
  assert.equal(chip.rancio, true);
  assert.ok(chip.titulo && chip.titulo.length > 0);
});

test('chipsPasarela: no_implementado y no_cobrable → apagado, NO interactivo, con tooltip', () => {
  const cruzado: MetodoPasarelaCruzado[] = [
    { tipo: 'PSE', estado: 'no_implementado' },
    { tipo: 'BANCOLOMBIA', estado: 'no_cobrable' },
  ];
  const chips = chipsPasarela(cruzado);
  for (const chip of chips) {
    assert.equal(chip.on, false);
    assert.equal(chip.interactivo, false);
    assert.equal(chip.rancio, false);
    assert.ok(chip.titulo && chip.titulo.length > 0);
  }
});
