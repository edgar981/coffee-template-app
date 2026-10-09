import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estiloMiniaturaMovimiento } from './vista-previa';

test('estiloMiniaturaMovimiento: estatico siempre da el cuadro final, sin importar el id ni el progreso', () => {
  for (const id of ['T01', 'T05', 'I01', 'I02', 'I03', 'C01', 'C02', 'no-existe']) {
    const r = estiloMiniaturaMovimiento(id, 0.5, true);
    assert.equal(r.transform, 'none');
    assert.equal(r.opacity, 1);
    assert.equal(r.clipPath, undefined);
  }
});

test('estiloMiniaturaMovimiento: un id desconocido da el cuadro final aunque no sea estático', () => {
  const r = estiloMiniaturaMovimiento('no-existe', 0.5, false);
  assert.deepEqual(r, { transform: 'none', opacity: 1 });
});

test('estiloMiniaturaMovimiento: "T01" entra (opacidad 0, desplazado) al inicio de su fase y se asienta antes del final del ciclo', () => {
  const inicio = estiloMiniaturaMovimiento('T01', 0, false, 0);
  assert.equal(inicio.opacity, 0);
  const final = estiloMiniaturaMovimiento('T01', 0.9, false, 0);
  assert.equal(final.transform, 'none');
  assert.equal(final.opacity, 1);
});

test('estiloMiniaturaMovimiento: el `indice` desfasa la fase -- dos índices en el mismo progreso NO están en el mismo punto de su entrada', () => {
  const a = estiloMiniaturaMovimiento('C01', 0.05, false, 0);
  const b = estiloMiniaturaMovimiento('C01', 0.05, false, 1);
  assert.notDeepEqual(a, b);
});

test('estiloMiniaturaMovimiento: "I01" usa clipPath -- 100% (oculto) al iniciar su fase, 0% (visible) al asentar', () => {
  const inicio = estiloMiniaturaMovimiento('I01', 0, false, 0);
  assert.equal(inicio.clipPath, 'inset(100% 0% 0% 0%)');
  const final = estiloMiniaturaMovimiento('I01', 0.9, false, 0);
  assert.equal(final.clipPath, 'inset(0% 0% 0% 0%)');
});

test('estiloMiniaturaMovimiento: "I03" (parallax/scrub) nunca está "estática" dentro del ciclo -- no depende de una ventana de entrada', () => {
  const a = estiloMiniaturaMovimiento('I03', 0.0, false);
  const b = estiloMiniaturaMovimiento('I03', 0.25, false);
  assert.notEqual(a.transform, b.transform);
});

test('estiloMiniaturaMovimiento: "C02" (hover) oscila arriba y abajo en bucle, sin ventana de entrada', () => {
  const reposo = estiloMiniaturaMovimiento('C02', 0, false, 0);
  const pico = estiloMiniaturaMovimiento('C02', 0.25, false, 0);
  assert.equal(reposo.transform, 'translateY(0%)');
  assert.notEqual(pico.transform, reposo.transform);
});
