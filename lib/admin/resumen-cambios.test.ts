import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenCambios } from './resumen-cambios';

// EL RESUMEN DE PUBLICAR (§ EDITOR-TIENDA-PUBLICAR-RESUMEN-1) — las CUATRO categorías que pide el
// spec de cierre (texto, composición, estilo, orden), más los casos que el módulo también cubre
// (imagen, booleano, repeater) para que una regresión en ellos no pase sin test.

function heroBase(): Record<string, unknown> {
  return {
    puntoFocal: 'centro', eyebrow: '', titulo: 'Productos que cuentan', tituloEnfasis: '',
    subtitulo: 'Subtítulo de fábrica', ctaPrimarioLabel: 'Ver café', ctaSecundarioLabel: '',
    fraseAlPie: '', veloIntensidad: 'media', tickerVelocidad: 'normal', alto: 'justo',
    veloCombo: 'nada', texto: '', productoSlug: '',
    variante: 'curtina', titularVisible: true, subtituloVisible: true, ctasVisibles: true,
    cueDesliza: true, alturaLlena: false, veloVisible: false,
    imagen: '/images/hero.webp', imagenMovil: '', imagenMovilPoster: '',
    estilos: {
      titulo: { fuente: null, tamano: null, color: null, alinear: null },
      subtitulo: { fuente: null, tamano: null, color: null, alinear: null },
      fraseAlPie: { fuente: null, tamano: null, color: null, alinear: null },
      ctaPrimarioLabel: { fuente: null, tamano: null, color: null, alinear: null },
      ctaSecundarioLabel: { fuente: null, tamano: null, color: null, alinear: null },
    },
  };
}

// ── 1 · TEXTO ───────────────────────────────────────────────────────────────────────────────────

test('texto: un campo que pasa de vacío a lleno es "nuevo"', () => {
  const publicado = heroBase();
  const borrador = { ...heroBase(), fraseAlPie: 'Desde 1998' };
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Frase al pie');
  assert.ok(item, 'debe reportar el campo opcional recién llenado');
  assert.equal(item!.tipo, 'nuevo');
  assert.equal(item!.etiqueta, 'Hero de la home · Frase al pie · nuevo');
});

test('texto: un campo con valor que cambia a otro valor es "cambiado"', () => {
  const publicado = heroBase();
  const borrador = { ...heroBase(), titulo: 'Un nuevo titular' };
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Titular');
  assert.ok(item);
  assert.equal(item!.tipo, 'cambiado');
  assert.equal(item!.etiqueta, 'Hero de la home · Titular · cambiado');
});

test('texto: un campo opcional que pasa de lleno a vacío es "quitado"', () => {
  const publicado = { ...heroBase(), tituloEnfasis: 'café' };
  const borrador = heroBase(); // tituloEnfasis vuelve a ''
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Énfasis del titular');
  assert.ok(item);
  assert.equal(item!.tipo, 'quitado');
});

test('texto: sin diferencias no reporta nada', () => {
  const contenido = heroBase();
  const cambios = resumenCambios(['hero'], { hero: contenido }, { hero: { ...contenido } });
  assert.deepEqual(cambios, []);
});

test('texto: un campo CRUZADO (marquesina.texto, mostrado en la tarjeta del hero) se resuelve contra MARQUESINA, no contra HERO', () => {
  const marquesinaPublicado = { imagenTipo: 'imagen', transicion: 'subir', fraseBanda: '', texto: '', productoSlug: '' };
  const marquesinaBorrador = { ...marquesinaPublicado, texto: 'Café de origen único' };
  const cambios = resumenCambios(
    ['marquesina'],
    { marquesina: marquesinaBorrador },
    { marquesina: marquesinaPublicado },
  );
  const item = cambios.find((c) => c.elemento === 'Texto del loop (marquesina)');
  assert.ok(item, 'el campo cruzado debe aparecer bajo la sección que REALMENTE lo guarda');
  assert.equal(item!.tituloSeccion, 'Marquesina');
  assert.equal(item!.tipo, 'nuevo');
});

// ── 2 · COMPOSICIÓN ─────────────────────────────────────────────────────────────────────────────

test('composición: cambiar hero.variante se resume con el NOMBRE de la elegida, entre comillas, sin la palabra "cambiado"', () => {
  const publicado = heroBase();
  const borrador = { ...heroBase(), variante: 'media' };
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Composición');
  assert.ok(item);
  assert.equal(item!.etiqueta, 'Hero de la home · Composición «Portada»');
  assert.equal(item!.clave, 'hero');
});

test('composición: sin cambio en variante no aparece "Composición" en la lista', () => {
  const contenido = heroBase();
  const cambios = resumenCambios(['hero'], { hero: contenido }, { hero: { ...contenido } });
  assert.equal(cambios.some((c) => c.elemento === 'Composición'), false);
});

test('composición: una sección sin `composiciones` (p. ej. marquesina) nunca reporta "Composición"', () => {
  const marquesinaPublicado = { imagenTipo: 'imagen', transicion: 'subir', fraseBanda: 'Hola', texto: '', productoSlug: '' };
  const marquesinaBorrador = { ...marquesinaPublicado, imagenTipo: 'video' };
  const cambios = resumenCambios(['marquesina'], { marquesina: marquesinaBorrador }, { marquesina: marquesinaPublicado });
  assert.equal(cambios.some((c) => c.elemento === 'Composición'), false);
  // pero SÍ el select de opciones fijas que cambió, con el mismo trato "valor entre comillas":
  const item = cambios.find((c) => c.elemento === 'Tipo de fondo');
  assert.ok(item);
  assert.equal(item!.etiqueta, 'Marquesina · Tipo de fondo «Video»');
});

// ── 3 · ESTILO ──────────────────────────────────────────────────────────────────────────────────

test('estilo (tema/Estilo): un color cambiado se resume bajo "Estilo", con el nombre del eje', () => {
  const publicado = { fondo: null, tinta: null, acento: null, fuentePar: null, forma: null };
  const borrador = { ...publicado, acento: '#ff0000' };
  const cambios = resumenCambios(['tema'], { tema: borrador }, { tema: publicado });
  assert.deepEqual(cambios, [{
    clave: 'tema', tituloSeccion: 'Estilo', elemento: 'Acento de marca', tipo: 'cambiado',
    etiqueta: 'Estilo · Acento de marca · cambiado',
  }]);
});

test('estilo (tema/Estilo): volver a "Por defecto" (de un hex a null) también se reporta', () => {
  const publicado = { fondo: '#111111', tinta: null, acento: null, fuentePar: null, forma: null };
  const borrador = { ...publicado, fondo: null };
  const cambios = resumenCambios(['tema'], { tema: borrador }, { tema: publicado });
  const item = cambios.find((c) => c.elemento === 'Fondo');
  assert.ok(item, 'volver al default es un cambio real, no "nada que reportar"');
});

test('estilo (tema/Estilo): sin diferencias en los cinco ejes no reporta nada', () => {
  const tema = { fondo: '#111111', tinta: null, acento: '#ff0000', fuentePar: 'calido', forma: 'recta' };
  const cambios = resumenCambios(['tema'], { tema }, { tema: { ...tema } });
  assert.deepEqual(cambios, []);
});

test('estilo (por elemento): cambiar hero.estilos.titulo se resume como "Estilo de Titular"', () => {
  const publicado = heroBase();
  const borrador = {
    ...heroBase(),
    estilos: { ...heroBase().estilos as Record<string, unknown>, titulo: { fuente: 'calido', tamano: 'grande', color: 'acento', alinear: 'centro' } },
  };
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Estilo de Titular');
  assert.ok(item);
  assert.equal(item!.etiqueta, 'Hero de la home · Estilo de Titular · cambiado');
});

test('estilo (por elemento): una sección sin elementos estilizables (marquesina) nunca reporta "Estilo de…"', () => {
  const marquesinaPublicado = { imagenTipo: 'imagen', transicion: 'subir', fraseBanda: 'Hola', texto: '', productoSlug: '' };
  const cambios = resumenCambios(['marquesina'], { marquesina: { ...marquesinaPublicado, fraseBanda: 'Chao' } }, { marquesina: marquesinaPublicado });
  assert.equal(cambios.some((c) => c.elemento.startsWith('Estilo de')), false);
});

// ── 4 · ORDEN ───────────────────────────────────────────────────────────────────────────────────

test('orden: reordenar las bandas del home reporta UN solo ítem', () => {
  const publicado = ['hero', 'brandStory', 'testimonials'];
  const borrador = ['hero', 'testimonials', 'brandStory'];
  const cambios = resumenCambios(['orden'], { orden: borrador }, { orden: publicado });
  assert.deepEqual(cambios, [{
    clave: 'orden', tituloSeccion: 'Orden de las secciones', elemento: 'Orden', tipo: 'cambiado',
    etiqueta: 'Orden de las secciones · cambiado',
  }]);
});

test('orden: el mismo orden no reporta nada', () => {
  const orden = ['hero', 'brandStory', 'testimonials'];
  const cambios = resumenCambios(['orden'], { orden }, { orden: [...orden] });
  assert.deepEqual(cambios, []);
});

// ── BONUS · imagen, booleano, repeater ──────────────────────────────────────────────────────────

test('imagen: reemplazar la portada del hero es "cambiado"', () => {
  const publicado = heroBase();
  const borrador = { ...heroBase(), imagen: '/images/otra.webp' };
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Imagen de fondo');
  assert.ok(item);
  assert.equal(item!.tipo, 'cambiado');
});

test('booleano: apagar un interruptor de capacidad se resume con el nuevo estado', () => {
  const publicado = heroBase();
  const borrador = { ...heroBase(), cueDesliza: false };
  const cambios = resumenCambios(['hero'], { hero: borrador }, { hero: publicado });
  const item = cambios.find((c) => c.elemento === 'Mostrar el indicador "Desliza"');
  assert.ok(item);
  assert.equal(item!.etiqueta, 'Hero de la home · Mostrar el indicador "Desliza": No');
});

test('repeater: agregar un ítem al final es "nuevo" en su posición', () => {
  const publicado = { eyebrow: '', titulo: 'Lo que dicen', items: [{ name: 'Ana', city: '', text: 'Excelente', product: '', stars: 5 }] };
  const borrador = {
    ...publicado,
    items: [
      { name: 'Ana', city: '', text: 'Excelente', product: '', stars: 5 },
      { name: 'Luis', city: '', text: 'Muy bueno', product: '', stars: 4 },
    ],
  };
  const cambios = resumenCambios(['testimonials'], { testimonials: borrador }, { testimonials: publicado });
  assert.deepEqual(cambios, [{
    clave: 'testimonials', tituloSeccion: 'Testimonios', elemento: 'Testimonio 2', tipo: 'nuevo',
    etiqueta: 'Testimonios · Testimonio 2 · nuevo',
  }]);
});

test('repeater: quitar el único ítem es "quitado"', () => {
  const publicado = { eyebrow: '', titulo: 'Lo que dicen', items: [{ name: 'Ana', city: '', text: 'Excelente', product: '', stars: 5 }] };
  const borrador = { ...publicado, items: [] };
  const cambios = resumenCambios(['testimonials'], { testimonials: borrador }, { testimonials: publicado });
  assert.deepEqual(cambios, [{
    clave: 'testimonials', tituloSeccion: 'Testimonios', elemento: 'Testimonio 1', tipo: 'quitado',
    etiqueta: 'Testimonios · Testimonio 1 · quitado',
  }]);
});

test('repeater: editar el texto del mismo ítem (misma posición) es "cambiado"', () => {
  const publicado = { eyebrow: '', titulo: 'Lo que dicen', items: [{ name: 'Ana', city: '', text: 'Excelente', product: '', stars: 5 }] };
  const borrador = { ...publicado, items: [{ ...publicado.items[0], text: 'Excelente, repetiría' }] };
  const cambios = resumenCambios(['testimonials'], { testimonials: borrador }, { testimonials: publicado });
  assert.deepEqual(cambios, [{
    clave: 'testimonials', tituloSeccion: 'Testimonios', elemento: 'Testimonio 1', tipo: 'cambiado',
    etiqueta: 'Testimonios · Testimonio 1 · cambiado',
  }]);
});

// ── VARIOS A LA VEZ, Y CLAVES DESCONOCIDAS ──────────────────────────────────────────────────────

test('varias claves pendientes a la vez agregan sus cambios en el orden recibido', () => {
  const heroPublicado = heroBase();
  const heroBorrador = { ...heroBase(), titulo: 'Otro titular' };
  const cambios = resumenCambios(
    ['hero', 'orden'],
    { hero: heroBorrador, orden: ['brandStory', 'hero'] },
    { hero: heroPublicado, orden: ['hero', 'brandStory'] },
  );
  assert.equal(cambios.length, 2);
  assert.equal(cambios[0].clave, 'hero');
  assert.equal(cambios[1].clave, 'orden');
});

test('una clave sin config conocida se ignora en silencio, sin lanzar', () => {
  assert.doesNotThrow(() => resumenCambios(['algo-que-no-existe'], {}, {}));
  assert.deepEqual(resumenCambios(['algo-que-no-existe'], {}, {}), []);
});
