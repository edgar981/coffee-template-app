import { test } from 'node:test';
import assert from 'node:assert/strict';

// § COMPRA-FIDELIDAD-3 — `CampoFlotante` es SSR-eable (sin Context, sin hooks de router), así que
// se afirma por EJECUCIÓN con `renderToStaticMarkup` — el mismo mecanismo que ya usa
// `SeguimientoTimeline` (§ `rastrear-pedido/page.test.ts`) para sus piezas sin Context. La
// VALIDACIÓN (cuándo mostrar el error) es del LLAMADOR (`errorVisible`, § `app/(storefront)/
// checkout/page.tsx`, sin cambios de esta tanda) — lo que se afirma acá es que el componente
// RENDERIZA lo que le llega: el rótulo flota con valor, el error aparece cuando el prop lo trae, y
// el tratamiento de línea cambia la caja sin tocar la mecánica.

async function render(props: Record<string, unknown>) {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: CampoFlotante } = await import('./CampoFlotante');
  return renderToStaticMarkup(React.createElement(CampoFlotante, props as never));
}

test('CampoFlotante: con valor, el rótulo flota (clase de escala/posición "arriba") sin necesitar foco', async () => {
  const html = await render({ id: 'f1', label: 'Correo electrónico', value: 'hola@ejemplo.com', onChange: () => {}, linea: 'comun' });
  assert.match(html, /scale-\[0\.72\]/);
});

test('CampoFlotante: sin valor y sin foco, el rótulo descansa centrado (no flota)', async () => {
  const html = await render({ id: 'f2', label: 'Correo electrónico', value: '', onChange: () => {}, linea: 'comun' });
  assert.doesNotMatch(html, /scale-\[0\.72\]/);
});

test('CampoFlotante: con `error`, muestra el mensaje con el ícono "!" y `aria-invalid="true"`', async () => {
  const html = await render({ id: 'f3', label: 'Correo', value: 'x', onChange: () => {}, linea: 'comun', error: 'Ingresa un correo válido.' });
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /Ingresa un correo válido\./);
});

test('CampoFlotante: sin `error`, NO hay `aria-invalid="true"` y se muestra la `ayuda` en su lugar', async () => {
  const html = await render({ id: 'f4', label: 'Celular', value: '300', onChange: () => {}, linea: 'comun', ayuda: 'No enviamos publicidad.' });
  assert.doesNotMatch(html, /aria-invalid="true"/);
  assert.match(html, /No enviamos publicidad\./);
});

test('CampoFlotante: `opcional` agrega "(opcional)" al rótulo y no marca `required`', async () => {
  const html = await render({ id: 'f5', label: 'Detalle', value: '', onChange: () => {}, linea: 'comun', opcional: true });
  assert.match(html, /\(opcional\)/);
  assert.doesNotMatch(html, /required=""/);
});

test('CampoFlotante: `requerido` (el default sin `opcional`) SÍ marca `required`, nativo', async () => {
  const html = await render({ id: 'f6', label: 'Dirección', value: '', onChange: () => {}, linea: 'comun' });
  assert.match(html, /required=""/);
});

test('CampoFlotante: `linea="ficha"` (Onix) pinta el rótulo en versal con tracking, sin caja', async () => {
  const html = await render({ id: 'f7', label: 'Nombre', value: '', onChange: () => {}, linea: 'ficha' });
  assert.match(html, /uppercase tracking-\[0\.12em\]/);
  assert.match(html, /border-0 border-b/);
});

test('CampoFlotante: `linea="tejido"` (Las Chamisas) pinta la caja punteada en reposo', async () => {
  const html = await render({ id: 'f8', label: 'Nombre', value: '', onChange: () => {}, linea: 'tejido' });
  assert.match(html, /border-dashed/);
});

test('CampoFlotante: `linea="comun"` no lleva ni el subrayado de ficha ni el punteado de tejido', async () => {
  const html = await render({ id: 'f9', label: 'Nombre', value: '', onChange: () => {}, linea: 'comun' });
  assert.doesNotMatch(html, /uppercase tracking-\[0\.12em\]/);
  assert.doesNotMatch(html, /border-dashed/);
});

test('CampoFlotante: `tipo="select"` renderiza un `<select>` con sus opciones', async () => {
  const html = await render({
    id: 'f10', label: 'Departamento', value: '', onChange: () => {}, linea: 'comun', tipo: 'select',
    opciones: [{ value: '', label: 'Selecciona', disabled: true }, { value: 'Huila', label: 'Huila' }],
  });
  assert.match(html, /<select/);
  assert.match(html, /<option value="Huila">Huila<\/option>/);
});

test('CampoFlotante: `tipo="textarea"` con `maxLength` muestra el contador "N/Max"', async () => {
  const html = await render({ id: 'f11', label: 'Notas', value: 'hola', onChange: () => {}, linea: 'comun', tipo: 'textarea', maxLength: 200 });
  assert.match(html, /<textarea/);
  assert.match(html, />4\/200</);
});

test('CampoFlotante: `valido` con valor y sin error muestra el ✓; con error, nunca', async () => {
  const conOk = await render({ id: 'f12', label: 'Correo', value: 'a@b.com', onChange: () => {}, linea: 'comun', valido: true });
  assert.match(conOk, /bg-emerald-600/);
  const conError = await render({ id: 'f13', label: 'Correo', value: 'a@b.com', onChange: () => {}, linea: 'comun', valido: true, error: 'Mal.' });
  assert.doesNotMatch(conError, /bg-emerald-600/);
});

test('CampoFlotante: el prefijo (+57) sólo aplica a `tipo="tel"`, y va oculto hasta que el rótulo flota', async () => {
  const sinValor = await render({ id: 'f14', label: 'Celular', value: '', onChange: () => {}, linea: 'comun', tipo: 'tel', prefijo: '+57' });
  assert.match(sinValor, /opacity-0/);
  const conValor = await render({ id: 'f15', label: 'Celular', value: '300', onChange: () => {}, linea: 'comun', tipo: 'tel', prefijo: '+57' });
  assert.match(conValor, /\+57/);
  assert.match(conValor, /opacity-100/);
});

// § COMPRA-FIDELIDAD-4 — el rótulo EN REPOSO y la `ayuda` van en `--chk-tinta-suave` (NUNCA
// `--sf-texto-suave`, que en Onix sale casi del mismo rojo que el botón — § el docstring de
// `page.tsx`), y el error en `--chk-error` (NUNCA un literal `red-*` de Tailwind, para que las
// TRES composiciones compartan el mismo tono de error, derivado de la paleta).

test('CampoFlotante: el rótulo en reposo usa --chk-tinta-suave, nunca --sf-texto-suave', async () => {
  const html = await render({ id: 'f16', label: 'Correo', value: '', onChange: () => {}, linea: 'comun' });
  assert.match(html, /text-\[var\(--chk-tinta-suave\)\]/);
});

test('CampoFlotante: la `ayuda` usa --chk-tinta-suave, nunca --sf-texto-suave', async () => {
  const html = await render({ id: 'f17', label: 'Celular', value: '300', onChange: () => {}, linea: 'comun', ayuda: 'No enviamos publicidad.' });
  assert.match(html, /text-\[var\(--chk-tinta-suave\)\]/);
});

test('CampoFlotante: el error usa --chk-error (texto, ícono y borde) en las TRES composiciones, nunca un literal red-*', async () => {
  for (const linea of ['comun', 'ficha', 'tejido'] as const) {
    const html = await render({ id: `f18-${linea}`, label: 'Correo', value: 'x', onChange: () => {}, linea, error: 'Mal.' });
    assert.match(html, /chk-error/, `linea=${linea} debe usar --chk-error`);
    assert.doesNotMatch(html, /red-\d/, `linea=${linea} no debe llevar un literal red-* de Tailwind`);
  }
});
