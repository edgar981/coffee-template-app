import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '@/lib/config/site-content-defaults';
import {
  TIPO_MENSAJE_CONTENIDO_SECCION,
  esMensajeContenidoSeccion,
  esSeccionDelRegistro,
  fusionarContenidoSeccion,
  TIPO_MENSAJE_SECCION_CLICK,
  esMensajeSeccionClick,
  TIPO_MENSAJE_MODO_NAVEGAR,
  esMensajeModoNavegar,
  TIPO_MENSAJE_CAMPO_CAMBIO,
  esMensajeCampoCambio,
  TIPO_MENSAJE_CAMPO_IMAGEN_CLICK,
  esMensajeCampoImagenClick,
} from './editor-puente';

// Capa 1 del puente panel→iframe (§ EDITOR-TIENDA-POSTMESSAGE-1). Puro, sin `window`/`postMessage`/
// zod — lo que se afirma es la forma del mensaje, la membresía en el REGISTRY, y que la fusión de
// una sección reusa EXACTAMENTE las reglas de `resolverSiteContent` (requerido vacío cae al
// default, opcional presente-vacío se respeta, las demás secciones no se tocan).

test('esMensajeContenidoSeccion acepta la forma correcta', () => {
  assert.equal(
    esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: 'hero', datos: { titulo: 'X' } }),
    true,
  );
});

test('esMensajeContenidoSeccion rechaza tipo ausente o distinto', () => {
  assert.equal(esMensajeContenidoSeccion({ seccion: 'hero', datos: {} }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: 'otra-cosa', seccion: 'hero', datos: {} }), false);
});

test('esMensajeContenidoSeccion rechaza seccion ausente, vacía o no-string', () => {
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, datos: {} }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: '', datos: {} }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: '   ', datos: {} }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: 3, datos: {} }), false);
});

test('esMensajeContenidoSeccion rechaza datos ausente, null, array o no-objeto', () => {
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: 'hero' }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: 'hero', datos: null }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: 'hero', datos: [] }), false);
  assert.equal(esMensajeContenidoSeccion({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion: 'hero', datos: 'x' }), false);
});

test('esMensajeContenidoSeccion rechaza cosas que no son objetos (un mensaje ajeno del mismo window)', () => {
  assert.equal(esMensajeContenidoSeccion(null), false);
  assert.equal(esMensajeContenidoSeccion(undefined), false);
  assert.equal(esMensajeContenidoSeccion('hola'), false);
  assert.equal(esMensajeContenidoSeccion(42), false);
});

test('esSeccionDelRegistro acepta secciones reales y rechaza metas y claves inventadas', () => {
  assert.equal(esSeccionDelRegistro('hero'), true);
  assert.equal(esSeccionDelRegistro('marquesina'), true);
  // Las METAS (tema/paginas/cromo…) no son secciones del REGISTRY — sus editores (PaletaSeccion…)
  // quedan fuera de este slice y nunca deberían llegar por este puente.
  assert.equal(esSeccionDelRegistro('tema'), false);
  assert.equal(esSeccionDelRegistro('paginas'), false);
  assert.equal(esSeccionDelRegistro('no-existe'), false);
});

test('fusionarContenidoSeccion aplica el cambio de texto a la sección pedida', () => {
  const resultado = fusionarContenidoSeccion(DEFAULTS, 'hero', {
    ...(DEFAULTS.hero as unknown as Record<string, unknown>),
    titulo: 'Nuevo titular en vuelo',
  });
  assert.equal(resultado.hero.titulo, 'Nuevo titular en vuelo');
});

test('fusionarContenidoSeccion NO TOCA las demás secciones (misma referencia)', () => {
  const resultado = fusionarContenidoSeccion(DEFAULTS, 'hero', {
    ...(DEFAULTS.hero as unknown as Record<string, unknown>),
    titulo: 'Otro titular',
  });
  assert.equal(resultado.marquesina, DEFAULTS.marquesina);
  assert.equal(resultado.brandStory, DEFAULTS.brandStory);
  assert.notEqual(resultado.hero, DEFAULTS.hero);
});

test('fusionarContenidoSeccion: un REQUERIDO vaciado a mitad de edición cae al DEFAULT — igual que al publicar, no al valor viejo', () => {
  const actual = fusionarContenidoSeccion(DEFAULTS, 'hero', {
    ...(DEFAULTS.hero as unknown as Record<string, unknown>),
    titulo: 'Un titulo que ya estaba puesto',
  });
  const resultado = fusionarContenidoSeccion(actual, 'hero', {
    ...(actual.hero as unknown as Record<string, unknown>),
    titulo: '',
  });
  // Ni vacío ni "Un titulo que ya estaba puesto" — el DEFAULT de código, como resolverSiteContent
  // ya hace para cualquier requerido vacío.
  assert.equal(resultado.hero.titulo, DEFAULTS.hero.titulo);
  assert.notEqual(resultado.hero.titulo, '');
  assert.notEqual(resultado.hero.titulo, 'Un titulo que ya estaba puesto');
});

test('fusionarContenidoSeccion: un OPCIONAL presente-y-vacío se RESPETA (se omite en el render), no cae al default', () => {
  const resultado = fusionarContenidoSeccion(DEFAULTS, 'hero', {
    ...(DEFAULTS.hero as unknown as Record<string, unknown>),
    tituloEnfasis: '',
  });
  assert.equal(resultado.hero.tituloEnfasis, '');
});

test('fusionarContenidoSeccion: una seccion fuera del REGISTRY (meta o inventada) devuelve el contenido SIN TOCAR', () => {
  const resultado1 = fusionarContenidoSeccion(DEFAULTS, 'tema', { fondo: '#000000' });
  assert.equal(resultado1, DEFAULTS);
  const resultado2 = fusionarContenidoSeccion(DEFAULTS, 'no-existe', { x: 1 });
  assert.equal(resultado2, DEFAULTS);
});

// § EDITOR-TIENDA-SELECCION-1 — los dos mensajes nuevos de la selección en contexto (§ 4.1).

test('esMensajeSeccionClick acepta la forma correcta', () => {
  assert.equal(esMensajeSeccionClick({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion: 'hero' }), true);
});

test('esMensajeSeccionClick rechaza tipo ausente/distinto y seccion ausente/vacía/no-string', () => {
  assert.equal(esMensajeSeccionClick({ seccion: 'hero' }), false);
  assert.equal(esMensajeSeccionClick({ tipo: 'otra-cosa', seccion: 'hero' }), false);
  assert.equal(esMensajeSeccionClick({ tipo: TIPO_MENSAJE_SECCION_CLICK }), false);
  assert.equal(esMensajeSeccionClick({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion: '' }), false);
  assert.equal(esMensajeSeccionClick({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion: '   ' }), false);
  assert.equal(esMensajeSeccionClick({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion: 3 }), false);
});

test('esMensajeSeccionClick rechaza cosas que no son objetos', () => {
  assert.equal(esMensajeSeccionClick(null), false);
  assert.equal(esMensajeSeccionClick(undefined), false);
  assert.equal(esMensajeSeccionClick('hola'), false);
});

test('esMensajeModoNavegar acepta la forma correcta, en los dos sentidos', () => {
  assert.equal(esMensajeModoNavegar({ tipo: TIPO_MENSAJE_MODO_NAVEGAR, navegar: true }), true);
  assert.equal(esMensajeModoNavegar({ tipo: TIPO_MENSAJE_MODO_NAVEGAR, navegar: false }), true);
});

test('esMensajeModoNavegar rechaza tipo ausente/distinto y navegar no-booleano', () => {
  assert.equal(esMensajeModoNavegar({ navegar: true }), false);
  assert.equal(esMensajeModoNavegar({ tipo: 'otra-cosa', navegar: true }), false);
  assert.equal(esMensajeModoNavegar({ tipo: TIPO_MENSAJE_MODO_NAVEGAR }), false);
  assert.equal(esMensajeModoNavegar({ tipo: TIPO_MENSAJE_MODO_NAVEGAR, navegar: 'si' }), false);
  assert.equal(esMensajeModoNavegar({ tipo: TIPO_MENSAJE_MODO_NAVEGAR, navegar: 1 }), false);
});

test('esMensajeModoNavegar rechaza cosas que no son objetos', () => {
  assert.equal(esMensajeModoNavegar(null), false);
  assert.equal(esMensajeModoNavegar(undefined), false);
  assert.equal(esMensajeModoNavegar(42), false);
});

// § EDITOR-TIENDA-CAMPO-EDITABLE-1 — el tercer mensaje, iframe→panel para el campo editable.

test('esMensajeCampoCambio acepta la forma correcta', () => {
  assert.equal(
    esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'titulo', valor: 'Texto nuevo' }),
    true,
  );
});

test('esMensajeCampoCambio acepta campo de ítem de repeater y valor vacío', () => {
  assert.equal(
    esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'testimonials', campo: 'items.0.text', valor: '' }),
    true,
  );
});

test('esMensajeCampoCambio rechaza tipo ausente/distinto', () => {
  assert.equal(esMensajeCampoCambio({ seccion: 'hero', campo: 'titulo', valor: 'x' }), false);
  assert.equal(esMensajeCampoCambio({ tipo: 'otra-cosa', seccion: 'hero', campo: 'titulo', valor: 'x' }), false);
});

test('esMensajeCampoCambio rechaza seccion/campo ausentes, vacíos o no-string', () => {
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, campo: 'titulo', valor: 'x' }), false);
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: '', campo: 'titulo', valor: 'x' }), false);
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', valor: 'x' }), false);
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: '   ', valor: 'x' }), false);
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 3, campo: 'titulo', valor: 'x' }), false);
});

test('esMensajeCampoCambio rechaza valor ausente o no-string', () => {
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'titulo' }), false);
  assert.equal(esMensajeCampoCambio({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'titulo', valor: 3 }), false);
});

test('esMensajeCampoCambio rechaza cosas que no son objetos', () => {
  assert.equal(esMensajeCampoCambio(null), false);
  assert.equal(esMensajeCampoCambio(undefined), false);
  assert.equal(esMensajeCampoCambio('hola'), false);
});

// § EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1 — el cuarto mensaje, iframe→panel para el clic en imagen/video.

test('esMensajeCampoImagenClick acepta la forma correcta (sin `valor`, a diferencia del campo de texto)', () => {
  assert.equal(
    esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: 'hero', campo: 'imagen' }),
    true,
  );
  assert.equal(
    esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: 'hero', campo: 'imagenPoster' }),
    true,
  );
});

test('esMensajeCampoImagenClick rechaza tipo ausente/distinto', () => {
  assert.equal(esMensajeCampoImagenClick({ seccion: 'hero', campo: 'imagen' }), false);
  assert.equal(esMensajeCampoImagenClick({ tipo: 'otra-cosa', seccion: 'hero', campo: 'imagen' }), false);
  // No se confunde con el mensaje HERMANO (campo-cambio, que SÍ lleva `valor`): un mismo shape salvo
  // el discriminador no debe pasar por casualidad.
  assert.equal(esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'imagen', valor: 'x' }), false);
});

test('esMensajeCampoImagenClick rechaza seccion/campo ausentes, vacíos o no-string', () => {
  assert.equal(esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, campo: 'imagen' }), false);
  assert.equal(esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: '', campo: 'imagen' }), false);
  assert.equal(esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: 'hero' }), false);
  assert.equal(esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: 'hero', campo: '   ' }), false);
  assert.equal(esMensajeCampoImagenClick({ tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: 3, campo: 'imagen' }), false);
});

test('esMensajeCampoImagenClick rechaza cosas que no son objetos', () => {
  assert.equal(esMensajeCampoImagenClick(null), false);
  assert.equal(esMensajeCampoImagenClick(undefined), false);
  assert.equal(esMensajeCampoImagenClick('hola'), false);
  assert.equal(esMensajeCampoImagenClick(42), false);
});

test('fusionarContenidoSeccion resuelve un REPEATER (testimonials) igual que el servidor', () => {
  // `name`/`text` son los REQUERIDOS del ítem (§ REGISTRY.testimonials.repeater.campos); `stars` no
  // está declarado ahí — el resolver lo pasa tal cual (passthrough, § resolverItems).
  const unTestimonio = { name: 'Ana', text: 'Excelente café', stars: 5 };
  const resultado = fusionarContenidoSeccion(DEFAULTS, 'testimonials', {
    ...(DEFAULTS.testimonials as unknown as Record<string, unknown>),
    items: [unTestimonio],
  });
  assert.deepEqual((resultado.testimonials as unknown as { items: unknown[] }).items, [
    { name: 'Ana', text: 'Excelente café', stars: 5, city: '', product: '' },
  ]);
});
