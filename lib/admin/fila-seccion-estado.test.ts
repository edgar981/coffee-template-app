import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { filaSeccionEstado, type FilaSeccionEstadoParams } from './fila-seccion-estado';

const BASE: FilaSeccionEstadoParams = {
  ocultable: true,
  formVisible: true,
  esTiendaCreditos: false,
  repeaterItemsKey: undefined,
  items: undefined,
  seMuestraSiCampo: undefined,
  valorCampoGate: undefined,
  pisoCruzadoItems: undefined,
};

describe('filaSeccionEstado — el caso reportado: nosotrosApertura, visible:true, variante "album"', () => {
  test('visible:true, sin repeater, sin seMuestraSiCampo, sin pisoCruzado (nosotrosApertura real) → NO oculta', () => {
    const r = filaSeccionEstado({ ...BASE, formVisible: true });
    assert.equal(r.oculta, false);
    assert.equal(r.repeaterVacio, false);
    assert.equal(r.campoGateVacio, false);
    assert.equal(r.creditosPisoIncompleto, false);
    assert.equal(r.noSeMuestra, false, 'la fila NO debe atenuarse — es exactamente el caso del spec, "visible + álbum → no oculta"');
  });

  test('visible:false → oculta (y noSeMuestra), sea cual sea la composición', () => {
    const r = filaSeccionEstado({ ...BASE, formVisible: false });
    assert.equal(r.oculta, true);
    assert.equal(r.noSeMuestra, true);
  });

  test('la variante ("album" vs "apertura") no entra en el cálculo — el estado no lee `form.variante`', () => {
    // El parámetro NI SIQUIERA admite `variante`: documenta que la regla es agnóstica de composición,
    // así que una variante vieja/nueva no puede colarse como causa.
    const album = filaSeccionEstado({ ...BASE, formVisible: true });
    const apertura = filaSeccionEstado({ ...BASE, formVisible: true });
    assert.deepEqual(album, apertura);
  });

  test('`formVisible` ausente (undefined) — section recién sembrada sin la clave — NO es oculta (sólo `=== false` lo es)', () => {
    const r = filaSeccionEstado({ ...BASE, formVisible: undefined });
    assert.equal(r.oculta, false);
    assert.equal(r.noSeMuestra, false);
  });
});

describe('filaSeccionEstado — ocultable:false (hero) nunca se atenúa por el toggle', () => {
  test('ocultable:false con formVisible:false NO cuenta — no hay interruptor que apagar', () => {
    const r = filaSeccionEstado({ ...BASE, ocultable: false, formVisible: false });
    assert.equal(r.oculta, false);
    assert.equal(r.noSeMuestra, false);
  });
});

describe('filaSeccionEstado — repeater vacío (p.ej. nosotrosEscenas sin ítems)', () => {
  test('repeater declarado y lista vacía → repeaterVacio y noSeMuestra, aunque visible:true', () => {
    const r = filaSeccionEstado({ ...BASE, repeaterItemsKey: 'items', items: [] });
    assert.equal(r.repeaterVacio, true);
    assert.equal(r.noSeMuestra, true);
    assert.equal(r.oculta, false);
  });

  test('repeater declarado con ítems → repeaterVacio false', () => {
    const r = filaSeccionEstado({ ...BASE, repeaterItemsKey: 'items', items: [{ foto: 'a.jpg' }] });
    assert.equal(r.repeaterVacio, false);
    assert.equal(r.noSeMuestra, false);
  });

  test('`items` presente pero no-array (basura) se trata como vacío, no lanza', () => {
    const r = filaSeccionEstado({ ...BASE, repeaterItemsKey: 'items', items: 'no-es-un-array' });
    assert.equal(r.repeaterVacio, true);
  });
});

describe('filaSeccionEstado — seMuestraSiCampo (p.ej. tiendaInterludio sin foto)', () => {
  test('campo gate vacío (string vacía) → campoGateVacio y noSeMuestra', () => {
    const r = filaSeccionEstado({ ...BASE, seMuestraSiCampo: 'imagen', valorCampoGate: '' });
    assert.equal(r.campoGateVacio, true);
    assert.equal(r.noSeMuestra, true);
  });

  test('campo gate con espacios → sigue vacío (se recorta)', () => {
    const r = filaSeccionEstado({ ...BASE, seMuestraSiCampo: 'imagen', valorCampoGate: '   ' });
    assert.equal(r.campoGateVacio, true);
  });

  test('campo gate con valor → campoGateVacio false', () => {
    const r = filaSeccionEstado({ ...BASE, seMuestraSiCampo: 'imagen', valorCampoGate: '/foto.jpg' });
    assert.equal(r.campoGateVacio, false);
    assert.equal(r.noSeMuestra, false);
  });

  test('campo gate ausente (undefined) no lanza — se trata como vacío', () => {
    const r = filaSeccionEstado({ ...BASE, seMuestraSiCampo: 'imagen', valorCampoGate: undefined });
    assert.equal(r.campoGateVacio, true);
  });
});

describe('filaSeccionEstado — el piso de tiendaCreditos CONSIGO MISMA (la fila "Créditos: ficha de origen")', () => {
  test('tiendaCreditos CON ítems pero menos de 3 completos → creditosPisoIncompleto, noSeMuestra, repeaterVacio false', () => {
    const r = filaSeccionEstado({
      ...BASE, esTiendaCreditos: true, repeaterItemsKey: 'items',
      items: [{ etiqueta: 'Origen', valor: 'San Adolfo' }, { etiqueta: 'Sin valor', valor: '' }],
    });
    assert.equal(r.repeaterVacio, false);
    assert.equal(r.creditosPisoIncompleto, true);
    assert.equal(r.noSeMuestra, true);
  });

  test('tiendaCreditos con 3+ filas completas → creditosPisoIncompleto false', () => {
    const r = filaSeccionEstado({
      ...BASE, esTiendaCreditos: true, repeaterItemsKey: 'items',
      items: [
        { etiqueta: 'Origen', valor: 'San Adolfo' },
        { etiqueta: 'Altitud', valor: '1.600 m' },
        { etiqueta: 'Variedades', valor: 'Bourbon, Pacamara' },
      ],
    });
    assert.equal(r.creditosPisoIncompleto, false);
    assert.equal(r.noSeMuestra, false);
  });

  test('tiendaCreditos con la lista VACÍA → repeaterVacio cubre el caso, creditosPisoIncompleto NO se duplica (evita el mensaje doble)', () => {
    const r = filaSeccionEstado({ ...BASE, esTiendaCreditos: true, repeaterItemsKey: 'items', items: [] });
    assert.equal(r.repeaterVacio, true);
    assert.equal(r.creditosPisoIncompleto, false);
    assert.equal(r.noSeMuestra, true);
  });
});

describe('filaSeccionEstado — el piso CRUZADO (nosotrosFicha dependiendo de tiendaCreditos.items)', () => {
  test('pisoCruzadoItems con menos de 3 filas completas → creditosPisoIncompleto, aunque esta sección no tenga repeater propio', () => {
    const r = filaSeccionEstado({
      ...BASE,
      pisoCruzadoItems: [{ etiqueta: 'Origen', valor: 'San Adolfo' }],
    });
    assert.equal(r.repeaterVacio, false, 'nosotrosFicha no es un repeater — esta causa no le aplica nunca');
    assert.equal(r.creditosPisoIncompleto, true);
    assert.equal(r.noSeMuestra, true);
  });

  test('pisoCruzadoItems VACÍO (longitud 0) TAMBIÉN cuenta — a diferencia del caso propio, acá no hay repeaterVacio que lo cubra', () => {
    const r = filaSeccionEstado({ ...BASE, pisoCruzadoItems: [] });
    assert.equal(r.creditosPisoIncompleto, true);
    assert.equal(r.noSeMuestra, true);
  });

  test('pisoCruzadoItems con 3+ filas completas → creditosPisoIncompleto false, la ficha se muestra', () => {
    const r = filaSeccionEstado({
      ...BASE,
      pisoCruzadoItems: [
        { etiqueta: 'Origen', valor: 'San Adolfo' },
        { etiqueta: 'Altitud', valor: '1.600 m' },
        { etiqueta: 'Variedades', valor: 'Bourbon, Pacamara' },
      ],
    });
    assert.equal(r.creditosPisoIncompleto, false);
    assert.equal(r.noSeMuestra, false);
  });

  test('pisoCruzadoItems AUSENTE (undefined, la sección no declara pisoCruzado) → nunca aplica, aunque esTiendaCreditos sea false', () => {
    const r = filaSeccionEstado({ ...BASE, pisoCruzadoItems: undefined });
    assert.equal(r.creditosPisoIncompleto, false);
  });

  test('esTiendaCreditos y pisoCruzadoItems son RUTAS DISTINTAS — esTiendaCreditos manda cuando ambas estarían presentes (no debería pasar en la práctica, pero no debe duplicar el chequeo)', () => {
    const r = filaSeccionEstado({
      ...BASE, esTiendaCreditos: true, repeaterItemsKey: 'items',
      items: [
        { etiqueta: 'Origen', valor: 'San Adolfo' },
        { etiqueta: 'Altitud', valor: '1.600 m' },
        { etiqueta: 'Variedades', valor: 'Bourbon, Pacamara' },
      ],
      pisoCruzadoItems: [], // dato espurio que NO debería leerse en esta rama
    });
    assert.equal(r.creditosPisoIncompleto, false, 'con esTiendaCreditos:true, el piso se evalúa sobre `items`, nunca sobre `pisoCruzadoItems`');
  });
});

describe('filaSeccionEstado — las causas se combinan sin pisarse', () => {
  test('oculta Y creditosPisoIncompleto a la vez siguen dando noSeMuestra true (no hay doble negación)', () => {
    const r = filaSeccionEstado({ ...BASE, formVisible: false, pisoCruzadoItems: [] });
    assert.equal(r.oculta, true);
    assert.equal(r.creditosPisoIncompleto, true);
    assert.equal(r.noSeMuestra, true);
  });
});
