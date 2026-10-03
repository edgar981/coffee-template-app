import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearRutaCampo, fusionCampoEditable, estiloCampoFlotante } from './campo-editable';

// Capa 1 del campo editable (§ EDITOR-TIENDA-CAMPO-EDITABLE-1). Puro, sin DOM/React/postMessage —
// lo que se afirma es el parseo de la ruta que `CampoEditable` marca en el DOM, la fusión que
// produce el parcial de `cambiar()`, y la forma del `style` del overlay.

test('parsearRutaCampo: plano — el primer punto separa sección y campo', () => {
  assert.deepEqual(parsearRutaCampo('hero.titulo'), { seccion: 'hero', campo: 'titulo' });
});

test('parsearRutaCampo: de ítem de repeater — el resto queda del lado del campo', () => {
  assert.deepEqual(parsearRutaCampo('testimonials.items.0.text'), { seccion: 'testimonials', campo: 'items.0.text' });
});

test('parsearRutaCampo: rechaza rutas sin sección, sin campo, o sin punto', () => {
  assert.equal(parsearRutaCampo('titulo'), null);
  assert.equal(parsearRutaCampo('hero.'), null);
  assert.equal(parsearRutaCampo('.titulo'), null);
  assert.equal(parsearRutaCampo(''), null);
});

test('fusionCampoEditable: campo PLANO — un parcial de una sola clave', () => {
  assert.deepEqual(fusionCampoEditable({ titulo: 'Viejo', subtitulo: 'Sin tocar' }, 'titulo', 'Nuevo'), {
    titulo: 'Nuevo',
  });
});

test('fusionCampoEditable: campo plano con nombre vacío (ruta mal formada) se ignora', () => {
  assert.equal(fusionCampoEditable({}, '', 'x'), null);
});

test('fusionCampoEditable: ítem de repeater — reemplaza SÓLO ese subcampo de ESE ítem', () => {
  const form = { items: [{ name: 'Ana', text: 'Viejo' }, { name: 'Luis', text: 'Otro' }] };
  const resultado = fusionCampoEditable(form, 'items.0.text', 'Nuevo texto');
  assert.deepEqual(resultado, { items: [{ name: 'Ana', text: 'Nuevo texto' }, { name: 'Luis', text: 'Otro' }] });
  // NO muta el array/ítem originales — mismo criterio de inmutabilidad que `cambiar`.
  assert.deepEqual(form.items[0], { name: 'Ana', text: 'Viejo' });
});

test('fusionCampoEditable: el segundo ítem del repeater no se toca al editar el primero', () => {
  const form = { items: [{ text: 'A' }, { text: 'B' }] };
  const resultado = fusionCampoEditable(form, 'items.0.text', 'A editado');
  assert.equal((resultado!.items as unknown[])[1], form.items[1]); // misma referencia, no tocado
});

test('fusionCampoEditable: índice fuera de rango se ignora (null)', () => {
  const form = { items: [{ text: 'A' }] };
  assert.equal(fusionCampoEditable(form, 'items.5.text', 'x'), null);
});

test('fusionCampoEditable: items ausente o no-array se ignora (sección sin cargar / no es repeater)', () => {
  assert.equal(fusionCampoEditable({}, 'items.0.text', 'x'), null);
  assert.equal(fusionCampoEditable({ items: 'no-es-array' }, 'items.0.text', 'x'), null);
});

test('fusionCampoEditable: un ítem que no es objeto (array/null/primitivo) se ignora', () => {
  assert.equal(fusionCampoEditable({ items: [null] }, 'items.0.text', 'x'), null);
  assert.equal(fusionCampoEditable({ items: [['no-objeto']] }, 'items.0.text', 'x'), null);
  assert.equal(fusionCampoEditable({ items: ['string'] }, 'items.0.text', 'x'), null);
});

test('fusionCampoEditable: una forma que no es plana ni items.N.campo se ignora', () => {
  assert.equal(fusionCampoEditable({}, 'items.0', 'x'), null); // sólo dos partes
  assert.equal(fusionCampoEditable({}, 'otraCosa.0.campo', 'x'), null); // no empieza con 'items'
  assert.equal(fusionCampoEditable({ items: [{}] }, 'items.0.a.b', 'x'), null); // cuatro partes
});

test('fusionCampoEditable: índice negativo o no entero se ignora', () => {
  const form = { items: [{ text: 'A' }] };
  assert.equal(fusionCampoEditable(form, 'items.-1.text', 'x'), null);
  assert.equal(fusionCampoEditable(form, 'items.1.5.text', 'x'), null);
});

test('estiloCampoFlotante: geometría en fixed + tipografía spread + z-index al tope', () => {
  const estilo = estiloCampoFlotante(
    { top: 10, left: 20, width: 300, height: 40 },
    {
      fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', fontStyle: 'normal',
      lineHeight: '24px', letterSpacing: '0px', textAlign: 'left', textTransform: 'none',
      color: 'rgb(0, 0, 0)', padding: '0px',
    },
  );
  assert.equal(estilo.position, 'fixed');
  assert.equal(estilo.top, 10);
  assert.equal(estilo.left, 20);
  assert.equal(estilo.width, 300);
  assert.equal(estilo.height, 40);
  assert.equal(estilo.fontFamily, 'Inter');
  assert.equal(estilo.color, 'rgb(0, 0, 0)');
  assert.equal(estilo.background, 'transparent');
  assert.equal(estilo.border, 'none');
  assert.equal(estilo.boxSizing, 'border-box');
  assert.equal(estilo.zIndex, 2147483647);
});
