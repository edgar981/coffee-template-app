import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '@/lib/config/site-content-defaults';
import { varsDeTemaEnVivo } from '@/lib/config/esquema-style';
import { varsDeForma, FORMA_DEFECTO } from '@/lib/config/formas';
import { varsDeFuentePar, PAR_DEFECTO } from '@/lib/config/fuentes';
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
  TIPO_MENSAJE_SESION_VENCIDA,
  esMensajeSesionVencida,
  datosDeOrden,
  datosDeTema,
  mensajesDeZonaHero,
  mensajeEstiloElemento,
  mensajesQuitarEstiloElemento,
  fusionarContenidoInstancia,
  TIPO_MENSAJE_AGREGAR_SECCION,
  esMensajeAgregarSeccion,
  ATRIBUTO_EDITOR_AGREGAR_SECCION,
  ATRIBUTO_EDITOR_CHROME,
  esClicEnChromeEditor,
} from './editor-puente';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';

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
  // 'orden' (§ EDITOR-TIENDA-ORDEN-1) también es META, aunque SÍ reusa TIPO_MENSAJE_CONTENIDO_SECCION
  // — `EditorPuenteVivo.tsx` la intercepta ANTES de llamar a esta función, así que acá sigue dando
  // `false` igual que las demás metas.
  assert.equal(esSeccionDelRegistro('orden'), false);
});

// § EDITOR-TIENDA-ORDEN-1 — el sexto mensaje, REUTILIZADO: `TIPO_MENSAJE_CONTENIDO_SECCION` con
// `seccion: 'orden'` y `datos: { valor: [...] }`. `datosDeOrden` es sólo la validación ESTRUCTURAL
// (¿hay un array ahí?) — el contenido semántico (ids conocidos, sin repetir) lo decide
// `resolverOrden`, SOFT, en el llamador (`EditorPuenteVivo.tsx`), no acá.

test('datosDeOrden devuelve el array cuando datos.valor es un array', () => {
  assert.deepEqual(datosDeOrden({ valor: ['hero', 'marquesina'] }), ['hero', 'marquesina']);
  assert.deepEqual(datosDeOrden({ valor: [] }), []);
});

test('datosDeOrden devuelve null cuando datos.valor no es un array (o está ausente)', () => {
  assert.equal(datosDeOrden({}), null);
  assert.equal(datosDeOrden({ valor: 'hero' }), null);
  assert.equal(datosDeOrden({ valor: null }), null);
  assert.equal(datosDeOrden({ valor: { 0: 'hero' } }), null);
});

// § EDITOR-TIENDA-TEMA-1 — el séptimo mensaje, REUTILIZADO: `TIPO_MENSAJE_CONTENIDO_SECCION` con
// `seccion: 'tema'` y `datos: { vars: {...} }`. `datosDeTema` es sólo la validación ESTRUCTURAL
// (¿es un objeto plano de string→string?) — qué claves CSS son, las decide `varsDeTemaEnVivo` en
// el llamador (el panel), nunca acá.

test('datosDeTema devuelve el mapa cuando datos.vars es un objeto plano de string→string', () => {
  assert.deepEqual(datosDeTema({ vars: { '--sf-fondo': '#ffffff', '--sf-tinta': '#111111' } }), {
    '--sf-fondo': '#ffffff', '--sf-tinta': '#111111',
  });
  assert.deepEqual(datosDeTema({ vars: {} }), {});
});

test('datosDeTema devuelve null cuando datos.vars está ausente, no es objeto, es array, o un valor no es string', () => {
  assert.equal(datosDeTema({}), null);
  assert.equal(datosDeTema({ vars: null }), null);
  assert.equal(datosDeTema({ vars: 'x' }), null);
  assert.equal(datosDeTema({ vars: [] }), null);
  assert.equal(datosDeTema({ vars: ['--sf-fondo'] }), null);
  assert.equal(datosDeTema({ vars: { '--sf-fondo': 123 } }), null);
  assert.equal(datosDeTema({ vars: { '--sf-fondo': null } }), null);
});

// `varsDeTemaEnVivo` (§ `lib/config/esquema-style.ts`) es lo que el panel manda como `datos.vars`
// de este mensaje — se afirma ACÁ, junto al puente que lo transporta, no en un archivo de test
// propio de `esquema-style.ts` (fuera de `touches:` de este slice).

test('varsDeTemaEnVivo: con los TRES ejes en su default (fábrica/Editorial/Suave), rellena fuente y forma con sus valores CONCRETOS — nunca `{}`', () => {
  const vars = varsDeTemaEnVivo({
    fondo: null, tinta: null, acento: null, fuentePar: null, forma: null,
    origenTexto: null, origenAccion: null, escalaDisplay: null,
  });
  assert.equal(vars['--sf-fuente-titulo'], PAR_DEFECTO.titulo);
  assert.equal(vars['--sf-fuente-cuerpo'], PAR_DEFECTO.cuerpo);
  assert.equal(vars['--sf-peso-cuerpo'], '400'); // PAR_DEFECTO (Editorial) no declara pesoCuerpo
  assert.equal(vars['--radius-3xl'], FORMA_DEFECTO.radius3xl);
  assert.equal(vars['--radius-2xl'], FORMA_DEFECTO.radius2xl);
  assert.equal(vars['--radius-xl'], FORMA_DEFECTO.radiusXl);
  assert.equal(vars['--sf-radio-lg'], FORMA_DEFECTO.radioLg);
  assert.equal(vars['--sf-radio-tile'], FORMA_DEFECTO.radioTile);
  assert.equal(vars['--sf-radio-imagen'], FORMA_DEFECTO.radioImagen);
  assert.equal(vars['--sf-sombra-imagen'], FORMA_DEFECTO.sombraImagen);
  assert.equal(vars['--sf-pildora'], FORMA_DEFECTO.pildora);
  assert.equal(vars['--sf-pildora-real'], FORMA_DEFECTO.pildoraReal);
  assert.equal(vars['--sf-borde'], FORMA_DEFECTO.borde);
  assert.equal(vars['--sf-divisor'], FORMA_DEFECTO.divisor);
  assert.equal(vars['--sf-trazo'], FORMA_DEFECTO.trazo);
  assert.equal(vars['--sf-badge-caja'], FORMA_DEFECTO.badgeCaja);
  assert.equal(vars['--sf-badge-tracking'], FORMA_DEFECTO.badgeTracking);
  // La paleta nunca necesita relleno — ya sale completa de `varsDeTienda`.
  assert.equal(vars['--sf-fondo'], '#faf7f4'); // RAICES_DEFECTO.fondo (Nayoli)
});

test('varsDeTemaEnVivo: con fuentePar/forma CUSTOM, coincide EXACTAMENTE con lo que varsDeFuentePar/varsDeForma ya emiten — no se reinventa un segundo valor', () => {
  const vars = varsDeTemaEnVivo({
    fondo: '#000000', tinta: '#ffffff', acento: '#ff0000', fuentePar: 'prensa', forma: 'recta',
    origenTexto: null, origenAccion: null, escalaDisplay: null,
  });
  const fuenteEsperada = varsDeFuentePar('prensa');
  const formaEsperada = varsDeForma('recta');
  for (const [clave, valor] of Object.entries(fuenteEsperada)) assert.equal(vars[clave], valor, clave);
  for (const [clave, valor] of Object.entries(formaEsperada)) assert.equal(vars[clave], valor, clave);
  // 'prensa' SÍ declara pesoCuerpo (440) — el `??` de relleno nunca debió dispararse para esta clave.
  assert.equal(vars['--sf-peso-cuerpo'], '440');
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

// ─── fusionarContenidoInstancia (§ SECCIONES-INSTANCIAS-1) ──────────────────────────────────────

test('fusionarContenidoInstancia: escribe la instancia resuelta en seccionesHome[id], sin tocar el resto del contenido', () => {
  const resultado = fusionarContenidoInstancia(DEFAULTS, 'inst:a', { tipo: 'texto', titulo: 'Un título nuevo' });
  assert.equal((resultado.seccionesHome['inst:a'] as { titulo: string }).titulo, 'Un título nuevo');
  assert.equal(resultado.hero, DEFAULTS.hero, 'el resto del contenido no se toca — misma referencia');
});

test('fusionarContenidoInstancia: un id SIN el prefijo de instancia devuelve el contenido SIN TOCAR', () => {
  const resultado = fusionarContenidoInstancia(DEFAULTS, 'hero', { tipo: 'texto', titulo: 'x' });
  assert.equal(resultado, DEFAULTS);
});

test('fusionarContenidoInstancia: datos con un tipo desconocido devuelven el contenido SIN TOCAR (preferir callar)', () => {
  const resultado = fusionarContenidoInstancia(DEFAULTS, 'inst:a', { tipo: 'carrusel-inventado', titulo: 'x' });
  assert.equal(resultado, DEFAULTS);
});

test('fusionarContenidoInstancia: actualizar DOS instancias distintas no se pisan entre sí', () => {
  const unaVez = fusionarContenidoInstancia(DEFAULTS, 'inst:a', { tipo: 'texto', titulo: 'A' });
  const dosVeces = fusionarContenidoInstancia(unaVez, 'inst:b', { tipo: 'banner', titulo: 'B' });
  assert.equal((dosVeces.seccionesHome['inst:a'] as { titulo: string }).titulo, 'A');
  assert.equal((dosVeces.seccionesHome['inst:b'] as { titulo: string }).titulo, 'B');
});

// EL MECANISMO REAL de `EditorPuenteVivo.tsx` (component .tsx, sin test propio — el glob del gate
// no incluye `.test.tsx`, § CLAUDE.md): extrae el sub-schema de UNA instancia con
// `siteContentEditableSchema.shape.seccionesHome.unwrap().valueType` — `.valueType`, NO
// `.valueSchema` (el nombre de zod 3; este repo corre zod 4, verificado contra
// `node_modules/zod/package.json`). Este test afirma el MISMO patrón de extracción, para que un
// upgrade de zod que renombre otra vez esa propiedad lo rompa ACÁ, en capa 1, en vez de fallar en
// silencio dentro de un componente sin cobertura automatizada.
test('el patrón de extracción que usa EditorPuenteVivo.tsx — shape.seccionesHome.unwrap().valueType.safeParse — funciona de punta a punta contra el schema real', () => {
  const subSchema = (siteContentEditableSchema.shape.seccionesHome as unknown as {
    unwrap: () => { valueType: { safeParse: (v: unknown) => { success: boolean; data?: unknown } } };
  }).unwrap().valueType;
  const parsed = subSchema.safeParse({ tipo: 'texto', titulo: 'Desde el mensaje' });
  assert.equal(parsed.success, true);
  const resultado = fusionarContenidoInstancia(DEFAULTS, 'inst:a', parsed.data as Record<string, unknown>);
  assert.equal((resultado.seccionesHome['inst:a'] as { titulo: string }).titulo, 'Desde el mensaje');

  // Y el rechazo también se propaga de punta a punta: un tipo inválido no produce datos que fusionar.
  const rechazado = subSchema.safeParse({ tipo: 'carrusel-inventado', titulo: 'x' });
  assert.equal(rechazado.success, false);
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

// § EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1 — el quinto mensaje, panel→iframe para el aviso de sesión
// vencida dentro del campo flotante abierto.

test('esMensajeSesionVencida acepta la forma correcta, vencida true y false, con y sin mensaje', () => {
  assert.equal(
    esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: 'hero', vencida: true, mensaje: 'Tu sesión expiró.' }),
    true,
  );
  assert.equal(
    esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: 'hero', vencida: false }),
    true,
  );
});

test('esMensajeSesionVencida rechaza tipo ausente/distinto', () => {
  assert.equal(esMensajeSesionVencida({ seccion: 'hero', vencida: true }), false);
  assert.equal(esMensajeSesionVencida({ tipo: 'otra-cosa', seccion: 'hero', vencida: true }), false);
  // No se confunde con el mensaje de modo-navegar (otro panel→iframe con un booleano suelto).
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_MODO_NAVEGAR, navegar: true }), false);
});

test('esMensajeSesionVencida rechaza seccion ausente/vacía/no-string, y vencida no-booleano', () => {
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, vencida: true }), false);
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: '', vencida: true }), false);
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: '   ', vencida: true }), false);
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: 3, vencida: true }), false);
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: 'hero' }), false);
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: 'hero', vencida: 'si' }), false);
});

test('esMensajeSesionVencida rechaza un `mensaje` no-string cuando está presente', () => {
  assert.equal(esMensajeSesionVencida({ tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion: 'hero', vencida: true, mensaje: 42 }), false);
});

test('esMensajeSesionVencida rechaza cosas que no son objetos', () => {
  assert.equal(esMensajeSesionVencida(null), false);
  assert.equal(esMensajeSesionVencida(undefined), false);
  assert.equal(esMensajeSesionVencida('hola'), false);
  assert.equal(esMensajeSesionVencida(42), false);
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

// ─── LAS ZONAS DEL HERO (§ EDITOR-TIENDA-ZONAS-1, `mensajesDeZonaHero`) ────────────────────────

test('mensajesDeZonaHero: un solo par produce UN mensaje, siempre para la sección "hero"', () => {
  const mensajes = mensajesDeZonaHero('titularVisible', 'true', null, null);
  assert.deepEqual(mensajes, [
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'titularVisible', valor: 'true' },
  ]);
});

test('mensajesDeZonaHero: el segundo par (opcional) agrega un SEGUNDO mensaje — el caso del velo combinado', () => {
  const mensajes = mensajesDeZonaHero('veloVisible', 'true', 'veloIntensidad', 'suave');
  assert.deepEqual(mensajes, [
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'veloVisible', valor: 'true' },
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'veloIntensidad', valor: 'suave' },
  ]);
});

test('mensajesDeZonaHero: sin el campo principal (o sin su valor), no manda NADA — un nodo mal marcado no es un mensaje a medias', () => {
  assert.deepEqual(mensajesDeZonaHero(null, 'true', null, null), []);
  assert.deepEqual(mensajesDeZonaHero('alto', null, null, null), []);
});

test('mensajesDeZonaHero: el segundo par A MEDIAS (sólo el campo, o sólo el valor) se ignora en silencio — nunca un mensaje con `campo: null`', () => {
  const soloCampo2 = mensajesDeZonaHero('alto', 'pantalla', 'alturaLlena', null);
  assert.deepEqual(soloCampo2, [{ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'alto', valor: 'pantalla' }]);
  const soloValor2 = mensajesDeZonaHero('alto', 'pantalla', null, 'true');
  assert.deepEqual(soloValor2, [{ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'alto', valor: 'pantalla' }]);
});

// ─── LA BARRA FLOTANTE (§ EDITOR-TIENDA-BARRA-FLOTANTE-1, `mensajeEstiloElemento`/
// `mensajesQuitarEstiloElemento`) ───────────────────────────────────────────────────────────────

test('mensajeEstiloElemento: construye la ruta "estilos.<elemento>.<subcampo>" sobre el MISMO tipo de mensaje que cualquier campo de texto', () => {
  assert.deepEqual(mensajeEstiloElemento('hero', 'titulo', 'tamano', 'enorme'), {
    tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'estilos.titulo.tamano', valor: 'enorme',
  });
  assert.deepEqual(mensajeEstiloElemento('hero', 'ctaPrimarioLabel', 'color', 'acento'), {
    tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'estilos.ctaPrimarioLabel.color', valor: 'acento',
  });
});

test('mensajesQuitarEstiloElemento: los CUATRO subcampos, cada uno con "" — el orden es estable', () => {
  const mensajes = mensajesQuitarEstiloElemento('hero', 'titulo');
  assert.deepEqual(mensajes, [
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'estilos.titulo.fuente', valor: '' },
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'estilos.titulo.tamano', valor: '' },
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'estilos.titulo.color', valor: '' },
    { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: 'estilos.titulo.alinear', valor: '' },
  ]);
});

test('mensajesQuitarEstiloElemento: cada mensaje que produce es un MensajeCampoCambio válido (esMensajeCampoCambio)', () => {
  for (const m of mensajesQuitarEstiloElemento('hero', 'subtitulo')) assert.equal(esMensajeCampoCambio(m), true);
});

// ─── EL DÉCIMO MENSAJE (§ EDITOR-AGREGAR-SECCION-LIENZO-1) ─────────────────────────────────────

test('esMensajeAgregarSeccion acepta la forma correcta — una banda y una instancia', () => {
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: 'hero' }), true);
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: 'inst:a1b2' }), true);
  // El borde 'featured' viaja TAL CUAL — es el bandaId de spotlight, no la SeccionVista
  // 'spotlight' que produciría `seccionDesdeMarcador('featured')` (§ el docstring del mensaje).
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: 'featured' }), true);
});

test('esMensajeAgregarSeccion rechaza tipo ausente o distinto (no se confunde con sus hermanos)', () => {
  assert.equal(esMensajeAgregarSeccion({ despuesDe: 'hero' }), false);
  assert.equal(esMensajeAgregarSeccion({ tipo: 'otra-cosa', despuesDe: 'hero' }), false);
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion: 'hero' }), false);
});

test('esMensajeAgregarSeccion rechaza despuesDe ausente, vacío, en blanco o no-string', () => {
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION }), false);
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: '' }), false);
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: '   ' }), false);
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: null }), false);
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: 3 }), false);
});

test('esMensajeAgregarSeccion rechaza cosas que no son objetos', () => {
  assert.equal(esMensajeAgregarSeccion(null), false);
  assert.equal(esMensajeAgregarSeccion(undefined), false);
  assert.equal(esMensajeAgregarSeccion('hola'), false);
  assert.equal(esMensajeAgregarSeccion(42), false);
});

test('ATRIBUTO_EDITOR_AGREGAR_SECCION: el literal que EditorPuenteVivo.tsx escribe y lee', () => {
  assert.equal(ATRIBUTO_EDITOR_AGREGAR_SECCION, 'data-editor-agregar-seccion');
});

// IDA Y VUELTA: el marcador que llega en `despuesDe` es exactamente el id que
// `TiendaPaginas.tsx` (`abrirBiblioteca`/`ordenLocal`) necesita — SIN pasar por
// `seccionDesdeMarcador` (que resolvería 'featured' a la SeccionVista 'spotlight', el valor
// EQUIVOCADO para este propósito). Afirmado contra las ocho bandas reales de `BANDA_IDS`
// (site-content-defaults.ts) + el caso spotlight/featured.
test('esMensajeAgregarSeccion + el despuesDe de cada banda real: el marcador ES el bandaId, nunca la SeccionVista', () => {
  for (const bandaId of ['hero', 'marquesina', 'trustBadges', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials']) {
    const m = { tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: bandaId };
    assert.equal(esMensajeAgregarSeccion(m), true, bandaId);
    assert.equal(esMensajeAgregarSeccion(m) && m.despuesDe, bandaId);
  }
  // spotlight ocupa el slot 'featured' (§ tienda-secciones.ts, SPOTLIGHT.bandaId); el mensaje
  // lleva ese bandaId tal cual, no 'spotlight'.
  assert.equal(esMensajeAgregarSeccion({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe: 'featured' }), true);
});

// ─── EDITOR-BARRA-ESTILO-CLIC-1 — la excepción que deja pasar el chrome propio del editor ────────
//
// `destino` nunca es un DOM real acá (el repo no tiene jsdom, § CLAUDE.md "el glob NO incluye
// *.test.tsx") — un objeto mínimo con `.closest()` basta para afirmar la DECISIÓN sin montar nada
// en un navegador; `EditorPuenteVivo.tsx` es quien hace el `closest()` real contra `e.target`.

test('ATRIBUTO_EDITOR_CHROME: el literal que EditorPuenteVivo.tsx marca en su chrome (overlay, aviso de sesión, barra flotante) y lee en el listener de clic', () => {
  assert.equal(ATRIBUTO_EDITOR_CHROME, 'data-editor-chrome');
});

test('esClicEnChromeEditor: un clic con destino DENTRO de un control del editor NO se intercepta', () => {
  const destino = { closest: (sel: string) => (sel === `[${ATRIBUTO_EDITOR_CHROME}]` ? ({} as unknown) : null) };
  assert.equal(esClicEnChromeEditor(destino), true);
});

test('esClicEnChromeEditor: un clic en la PÁGINA (fuera de todo chrome del editor) SÍ se intercepta', () => {
  const destino = { closest: () => null };
  assert.equal(esClicEnChromeEditor(destino), false);
});

test('esClicEnChromeEditor: busca EXACTAMENTE el selector del atributo — no cualquier closest truthy', () => {
  let selectorRecibido: string | null = null;
  const destino = { closest: (sel: string) => { selectorRecibido = sel; return null; } };
  esClicEnChromeEditor(destino);
  assert.equal(selectorRecibido, `[${ATRIBUTO_EDITOR_CHROME}]`);
});

test('esClicEnChromeEditor: sin destino (null/undefined) se intercepta — preferir interceptar de más a dejar pasar un clic sin clasificar', () => {
  assert.equal(esClicEnChromeEditor(null), false);
  assert.equal(esClicEnChromeEditor(undefined), false);
});
