import { test } from 'node:test';
import assert from 'node:assert/strict';

import { condicionCampoInactiva, resumenBloqueTarjeta, camposPorFilaCreditos, vaciosDeBloqueTarjeta, tiendaCreditosPisoIncompleto } from './editor-orden-y-lienzo';
import { particionarBloques } from './editor-composicion-campos';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { bloquesResueltos } from '@/lib/tienda/bloques';
import type { Product } from '@/types/product';

// ─── item 1: el orden del editor sigue el orden real de la página ─────────────────────────────────
//
// El orden del editor, para una composición dada, es el orden de `bloquesVisibles` (§
// particionarBloques) aplanado por bloque — EXACTAMENTE lo que `TiendaSeccionEditor.tsx` recorre
// para pintar los CAMPOS DE TEXTO (`renderCampo`). Se compara contra el orden REAL, medido leyendo
// el componente del storefront que renderiza cada composición (citado en cada caso).
//
// SÓLO CAMPOS DE TEXTO — las imágenes quedan fuera a propósito: dentro de un bloque `tipo:'seccion'`
// la miniatura de imagen SIEMPRE se dibuja ANTES de los campos (`renderBloqueSeccion`, "imágenes
// (miniatura) + campos" — una convención de TODO el editor, no algo que este slice deba o pueda
// tocar sin reabrir cada sección existente). El pedido del owner y el ejemplo del spec ("rótulo
// superior → tabla → Bolsas…") son sobre TEXTO; comparar imágenes contra la página mezclaría dos
// preguntas distintas.
function ordenEditor(seccion: string, composicion: string | undefined): string[] {
  const config = SECCIONES_TIENDA.find((s) => s.seccion === seccion)!;
  const bloques = bloquesResueltos(config);
  const { visibles } = particionarBloques(bloques, config, composicion);
  return visibles.flatMap((b) => {
    if (b.tipo === 'seccion' || b.tipo === 'tarjeta') return b.campos.map((c) => c.name);
    if (b.tipo === 'lista') return b.slots;
    return [];
  });
}

test('suscripcionPlanes bajo "taquilla": el orden sigue SuscripcionTaquilla.tsx — rótulo, bolsas, ' +
  'frecuencias, molienda, referencia, botón, aviso, créditos, barra fija', () => {
  // § EDITOR-ORDEN-Y-LIENZO-1 — el defecto medido que disparó este slice: antes de reordenar,
  // `credito1-4` vivían ANTES de `taquillaCtaLabel`/`taquillaAviso`/la barra fija, cuando en la
  // página los créditos se ven DESPUÉS del botón y su aviso (§ SuscripcionTaquilla.tsx:180-274).
  const orden = ordenEditor('suscripcionPlanes', 'taquilla');
  const esperado = [
    'taquillaKicker',
    'taquillaEtiquetaBolsas', 'maxBolsas',
    'taquillaEtiquetaFrecuencia', 'frecuencia1', 'frecuencia2', 'frecuencia3', 'frecuencia4',
    'taquillaEtiquetaMolienda',
    'taquillaReferenciaTexto',
    'taquillaCtaLabel', 'taquillaCtaAgotadoLabel',
    'taquillaAviso',
    'credito1Etiqueta', 'credito1Valor', 'credito2Etiqueta', 'credito2Valor',
    'credito3Etiqueta', 'credito3Valor', 'credito4Etiqueta', 'credito4Valor',
    'taquillaBarraCtaLabel', 'taquillaBarraAgotadoLabel',
  ];
  assert.deepEqual(orden, esperado);
});

test('suscripcionPlanes bajo "tarjetas": el orden sigue SuscripcionPlanes.tsx — encabezado, planes, ' +
  'tarjeta por tarjeta con sus beneficios', () => {
  const orden = ordenEditor('suscripcionPlanes', 'tarjetas');
  // Encabezado y "Planes" primero, en ese orden; después cada tarjeta de plan CON sus beneficios
  // antes de pasar a la siguiente (no todos los nombres, luego todas las descripciones).
  assert.deepEqual(orden.slice(0, 4), ['eyebrow', 'titulo', 'tituloEnfasis', 'subtitulo']);
  assert.deepEqual(orden.slice(4, 8), ['planesTitulo', 'planesSubtitulo', 'ctaLabel', 'destacadoSlot']);
  const iNombre1 = orden.indexOf('nombre1');
  const iBen1 = orden.indexOf('ben1_1');
  const iNombre2 = orden.indexOf('nombre2');
  assert.ok(iNombre1 < iBen1 && iBen1 < iNombre2, 'Plan 1 (y sus beneficios) van antes que Plan 2');
});

test('nosotrosHistoria bajo "relato": eyebrow, título, párrafos — sin `retratoNombre` (campo de Sinopsis)', () => {
  // § EDITOR-ORDEN-Y-LIENZO-1 — hallazgo de este slice, de la MISMA clase que disparó S1: antes de
  // tagguear `titulo`/`parrafo2`/`parrafo3`/`retratoNombre`, los cuatro se mostraban bajo las DOS
  // composiciones (sin `composiciones` declarado = universal). Medido contra
  // `NosotrosHistoriaRelato.tsx` (eyebrow, titulo, parrafo1-3) y `NosotrosHistoriaSinopsis.tsx`
  // (eyebrow, parrafo1, retratoNombre) — ninguno de los dos componentes lee el campo del otro.
  const orden = ordenEditor('nosotrosHistoria', 'relato');
  assert.deepEqual(orden, ['eyebrow', 'titulo', 'parrafo1', 'parrafo2', 'parrafo3']);
  // `titulo`/`parrafo2`/`parrafo3` no deben colarse bajo "sinopsis" — el defecto que motivó el tag.
});

test('nosotrosHistoria bajo "sinopsis": eyebrow, párrafo, nombre del caficultor — sin `titulo`/`parrafo2`/`parrafo3`', () => {
  const orden = ordenEditor('nosotrosHistoria', 'sinopsis');
  assert.deepEqual(orden, ['eyebrow', 'parrafo1', 'retratoNombre']);
  for (const n of ['titulo', 'parrafo2', 'parrafo3']) assert.ok(!orden.includes(n), `"${n}" es sólo de "Relato"`);
});

// ─── item 1, EDITOR-ORDEN-Y-LIENZO-2: extensión del recorrido a `brandStory` — el hallazgo que
// EDITOR-ORDEN-Y-LIENZO-1 dejó abierto como `EDITOR-BS1-CTA-FUERA-DE-ORDEN-COLUMNAS-1` ─────────────
//
// Medido contra `BrandStoryColumnas.tsx` (eyebrow, titulo, parrafo1, parrafo2 — NUNCA ctaLabel/
// ctaDestino, que esa composición no lee), `BrandStoryCentrada.tsx` (idéntico + ctaLabel al final) y
// `BrandStoryFichaDeFinca.tsx` (eyebrow, titulo, [el bloque del medio: lugar → altitudMin/Max/Unidad
// → nombrePunto → subLineaPunto → pieIlustracion → pieMedio], entrada, fila1..6, ctaLabel/ctaDestino
// AL FINAL — antes vivía 2°, tras el titular).

test('brandStory bajo "columnas": eyebrow, título, párrafos — SIN el botón (Columnas nunca lo renderiza)', () => {
  const orden = ordenEditor('brandStory', 'columnas');
  assert.deepEqual(orden, ['eyebrow', 'titulo', 'parrafo1', 'parrafo2']);
  assert.ok(!orden.includes('ctaLabel'), 'BrandStoryColumnas.tsx nunca lee ctaLabel — antes aparecía en el panel prometiendo un botón que no se dibuja');
});

test('brandStory bajo "centrada": eyebrow, título, párrafos, botón AL FINAL', () => {
  const orden = ordenEditor('brandStory', 'centrada');
  assert.deepEqual(orden, ['eyebrow', 'titulo', 'parrafo1', 'parrafo2', 'ctaLabel', 'ctaDestino']);
});

test('brandStory bajo "fichaDeFinca": el botón vive AL FINAL (tras la ficha de filas), no 2° tras el titular', () => {
  const orden = ordenEditor('brandStory', 'fichaDeFinca');
  assert.deepEqual(orden, [
    'eyebrow', 'titulo', 'medio',
    'lugar', 'altitudMin', 'altitudMax', 'altitudUnidad', 'nombrePunto', 'subLineaPunto', 'pieIlustracion', 'pieMedio',
    'entrada',
    'fila1Rotulo', 'fila1Valor', 'fila1SubLinea',
    'fila2Rotulo', 'fila2Valor', 'fila2SubLinea',
    'fila3Rotulo', 'fila3Valor', 'fila3SubLinea',
    'fila4Rotulo', 'fila4Valor', 'fila4SubLinea',
    'fila5Rotulo', 'fila5Valor', 'fila5SubLinea',
    'fila6Rotulo', 'fila6Valor', 'fila6SubLinea',
    'ctaLabel', 'ctaDestino',
  ]);
  // El defecto original, afirmado directamente: el botón ya NO es el 3er nombre de la lista.
  assert.ok(orden.indexOf('ctaLabel') > orden.indexOf('fila6SubLinea'), 'el botón va DESPUÉS de la última fila, nunca 2° tras el titular');
});

// ─── item 1, EDITOR-ORDEN-Y-LIENZO-2: la pieza compartida `Apertura.tsx` (imagen → rótulos →
// título) — `tiendaEncabezado`/`nosotrosApertura` tenían `titulo` PRIMERO en su `campos`, cuando la
// tienda lo pinta ÚLTIMO bajo "Apertura" ──────────────────────────────────────────────────────────

test('tiendaEncabezado bajo "apertura": los rótulos van ANTES del título (Apertura.tsx: imagen → rótulos → título)', () => {
  const orden = ordenEditor('tiendaEncabezado', 'apertura');
  const iIzq = orden.indexOf('rotuloIzquierda');
  const iDer = orden.indexOf('rotuloDerecha');
  const iTitulo = orden.indexOf('titulo');
  assert.ok(iIzq >= 0 && iDer >= 0 && iTitulo >= 0);
  assert.ok(iIzq < iDer && iDer < iTitulo, `esperado rotuloIzquierda < rotuloDerecha < titulo, fue [${orden.join(', ')}]`);
});

test('tiendaEncabezado bajo "actual": título, leyenda — sin rótulos de Apertura', () => {
  const orden = ordenEditor('tiendaEncabezado', 'actual');
  assert.deepEqual(orden.filter((n) => n !== 'sticker'), ['titulo', 'leyenda']);
});

test('tiendaEncabezado bajo "carta": título, sticker, intro, título del selector — igual que TiendaCarta', () => {
  const orden = ordenEditor('tiendaEncabezado', 'carta');
  assert.deepEqual(orden, ['titulo', 'sticker', 'intro', 'antojoTitulo']);
});

test('nosotrosApertura bajo "apertura": rotuloIzquierda, rotuloDerecha, título — igual que Apertura.tsx', () => {
  const orden = ordenEditor('nosotrosApertura', 'apertura');
  assert.deepEqual(orden, ['rotuloIzquierda', 'rotuloDerecha', 'titulo']);
});

test('nosotrosApertura bajo "album": rotuloIzquierda (eyebrow), título, bajada, sticker', () => {
  const orden = ordenEditor('nosotrosApertura', 'album');
  assert.deepEqual(orden, ['rotuloIzquierda', 'titulo', 'bajada', 'sticker']);
});

test('suscripcionApertura (una sola composición, sin selector): rótulos antes del título — misma pieza Apertura.tsx', () => {
  // Esta sección no declara `composiciones` (un solo layout posible, § SuscripcionApertura.tsx), así
  // que `ordenEditor(seccion, undefined)` devuelve el `campos` TAL CUAL se declaró — no hay filtro
  // de composición que lo recorte.
  const orden = ordenEditor('suscripcionApertura', undefined);
  assert.deepEqual(orden, ['rotuloIzquierda', 'rotuloDerecha', 'titulo']);
});

// ─── item 2: la colisión de slots entre "Plan N" y "Crédito N" ─────────────────────────────────────

test('suscripcionPlanes: "Plan N" y "Crédito N" comparten slot (1-4) pero NUNCA título — la clave ' +
  'por título (no por slot) hace la colisión imposible', () => {
  const config = SECCIONES_TIENDA.find((s) => s.seccion === 'suscripcionPlanes')!;
  const tarjetas = (config.bloques ?? []).filter((b) => b.tipo === 'tarjeta') as Extract<
    NonNullable<typeof config.bloques>[number], { tipo: 'tarjeta' }
  >[];
  // La colisión que EDITOR-SLOT-COLISION-PLANES-CREDITOS-1 nombra: existe de verdad.
  const porSlot = new Map<number, string[]>();
  for (const t of tarjetas) porSlot.set(t.slot, [...(porSlot.get(t.slot) ?? []), t.titulo]);
  assert.ok(porSlot.get(1)!.length >= 2, 'el slot 1 debería tener MÁS de un bloque ("Plan 1" y "Crédito 1")');
  // La clave que SÍ identifica cada bloque sin ambigüedad: el título — ninguno se repite.
  const titulos = tarjetas.map((t) => t.titulo);
  assert.equal(new Set(titulos).size, titulos.length, 'los títulos de las tarjetas deben ser todos distintos');
});

// ─── item 2: el resumen de una tarjeta colapsada ───────────────────────────────────────────────────

test('resumenBloqueTarjeta: junta los dos primeros campos con valor, como "Pedido · Por WhatsApp"', () => {
  const campos = [{ name: 'credito1Etiqueta' }, { name: 'credito1Valor' }];
  const form = { credito1Etiqueta: 'Pedido', credito1Valor: 'Por WhatsApp' };
  assert.equal(resumenBloqueTarjeta(campos, form), 'Pedido · Por WhatsApp');
});

test('resumenBloqueTarjeta: un campo vacío se omite, no deja un " · " colgando', () => {
  const campos = [{ name: 'credito1Etiqueta' }, { name: 'credito1Valor' }];
  assert.equal(resumenBloqueTarjeta(campos, { credito1Etiqueta: 'Pedido', credito1Valor: '' }), 'Pedido');
  assert.equal(resumenBloqueTarjeta(campos, { credito1Etiqueta: '', credito1Valor: '' }), '');
});

test('resumenBloqueTarjeta: sólo mira los dos PRIMEROS campos del bloque (un tercero no entra)', () => {
  const campos = [{ name: 'nombre1' }, { name: 'descripcion1' }, { name: 'precio1' }];
  const form = { nombre1: 'Plan Básico', descripcion1: 'Cada mes', precio1: '$ 45.000' };
  assert.equal(resumenBloqueTarjeta(campos, form), 'Plan Básico · Cada mes');
});

// ─── item 2 (cierre), EDITOR-ORDEN-Y-LIENZO-2: EDITOR-TARJETA-GENERICA-QUITAR-SIN-TEST-1 ───────────
//
// El bug que `vaciosDeBloqueTarjeta` corrigió, reproducido EXACTO: el primer intento del "Quitar"
// genérico reusaba `quitarTarjeta` de Presentaciones (`label${slot}`/`copy${slot}`/`categoria${slot}`/
// `imagen${slot}`) — campos que NO existen en brandStory/suscripcionPlanes. El test afirma que el
// parcial usa los nombres REALES del bloque recibido, nunca un nombre derivado del slot.

test('vaciosDeBloqueTarjeta: vacía los campos REALES de "Fila 3" de brandStory — nunca label3/copy3/categoria3', () => {
  const bloqueFila3 = {
    slot: 3,
    titulo: 'Fila 3 (opcional)',
    campos: [{ name: 'fila3Rotulo' }, { name: 'fila3Valor' }, { name: 'fila3SubLinea' }],
  };
  const vacios = vaciosDeBloqueTarjeta(bloqueFila3);
  assert.deepEqual(vacios, { fila3Rotulo: '', fila3Valor: '', fila3SubLinea: '' });
  for (const n of ['label3', 'copy3', 'categoria3', 'imagen3']) {
    assert.ok(!(n in vacios), `"${n}" es el nombre de Presentaciones — el bug que esto corrige lo habría escrito acá`);
  }
});

test('vaciosDeBloqueTarjeta: vacía los campos de "Plan 2" de suscripcionPlanes — nombre/descripción/precio/beneficios', () => {
  const bloquePlan2 = {
    slot: 2,
    titulo: 'Plan 2 (opcional)',
    campos: [{ name: 'nombre2' }, { name: 'descripcion2' }, { name: 'precio2' }],
  };
  assert.deepEqual(vaciosDeBloqueTarjeta(bloquePlan2), { nombre2: '', descripcion2: '', precio2: '' });
});

test('vaciosDeBloqueTarjeta: incluye la imagen del bloque, si tiene', () => {
  const bloqueConImagen = { slot: 1, titulo: 'X', campos: [{ name: 'a' }], imagen: { name: 'fotoX' } };
  assert.deepEqual(vaciosDeBloqueTarjeta(bloqueConImagen), { a: '', fotoX: '' });
});

test('vaciosDeBloqueTarjeta: sin imagen, no agrega ninguna clave de más', () => {
  const bloqueSinImagen = { slot: 1, titulo: 'X', campos: [{ name: 'a' }] };
  assert.deepEqual(vaciosDeBloqueTarjeta(bloqueSinImagen), { a: '' });
});

// ─── item 3, EDITOR-ORDEN-Y-LIENZO-2: EDITOR-CREDITOSFILAS-INDICE-ORIGINAL-1 ───────────────────────

test('camposPorFilaCreditos: una fila a medias en el MEDIO no corre el mapeo de las de abajo', () => {
  // La reproducción exacta del defecto nombrado: 3 ítems, el del medio incompleto. `filasCompletas`
  // (o `creditosDeTaquilla`) filtra y deja SÓLO los dos completos — sin este mapeo, wirear por
  // índice VISIBLE (0, 1) apuntaría el segundo al ítem 1 (el incompleto) en vez de al 2 (el real).
  const original = [
    { etiqueta: 'Pago', valor: 'Contraentrega' },
    { etiqueta: 'Envío', valor: '' }, // incompleto — filtrado
    { etiqueta: 'Pausa', valor: 'Cuando quieras' },
  ];
  const visibles = original.filter((f) => f.etiqueta.trim() && f.valor.trim());
  assert.equal(visibles.length, 2);
  const campos = camposPorFilaCreditos(original, visibles, (i) => ({
    etiqueta: `tiendaCreditos.items.${i}.etiqueta`,
    valor: `tiendaCreditos.items.${i}.valor`,
  }));
  assert.deepEqual(campos, [
    { etiqueta: 'tiendaCreditos.items.0.etiqueta', valor: 'tiendaCreditos.items.0.valor' },
    { etiqueta: 'tiendaCreditos.items.2.etiqueta', valor: 'tiendaCreditos.items.2.valor' }, // NO el 1
  ]);
});

test('camposPorFilaCreditos: slots fijos (suscripcionPlanes) — el campo usa el NÚMERO de slot, no la posición visible', () => {
  const original = [
    { etiqueta: '', valor: '' },               // credito1: vacío, filtrado
    { etiqueta: 'Envío', valor: 'Gratis' },     // credito2
    { etiqueta: 'Pausa', valor: 'Cuando quieras' }, // credito3
    { etiqueta: '', valor: '' },               // credito4: vacío, filtrado
  ];
  const visibles = original.filter((f) => f.etiqueta.trim() && f.valor.trim());
  const campos = camposPorFilaCreditos(original, visibles, (i) => ({
    etiqueta: `suscripcionPlanes.credito${i + 1}Etiqueta`,
    valor: `suscripcionPlanes.credito${i + 1}Valor`,
  }));
  assert.deepEqual(campos, [
    { etiqueta: 'suscripcionPlanes.credito2Etiqueta', valor: 'suscripcionPlanes.credito2Valor' },
    { etiqueta: 'suscripcionPlanes.credito3Etiqueta', valor: 'suscripcionPlanes.credito3Valor' },
  ]);
});

test('camposPorFilaCreditos: sin filas visibles, mapeo vacío', () => {
  assert.deepEqual(camposPorFilaCreditos([], [], (i) => ({ etiqueta: `x.${i}`, valor: `y.${i}` })), []);
});

// ─── item 4: la condición de la molienda ───────────────────────────────────────────────────────────

function producto(moliendasOpciones: unknown): Product {
  return { moliendasOpciones } as unknown as Product;
}

test('condicionCampoInactiva: sin condición declarada, nunca avisa', () => {
  assert.equal(condicionCampoInactiva(undefined, [], true), null);
});

test('condicionCampoInactiva: mientras el catálogo no cargó, calla (no afirma sobre un dato que no tiene)', () => {
  assert.equal(condicionCampoInactiva('molienda-multiple', [], false), null);
});

test('condicionCampoInactiva: "molienda-multiple" con catálogo de UNA sola molienda por producto — avisa', () => {
  const catalogo = [
    producto([{ nombre: 'Media', metodo: 'Goteo', disponible: true }]),
    producto([]),
  ];
  const r = condicionCampoInactiva('molienda-multiple', catalogo, true);
  assert.ok(r, 'debería avisar: ningún producto ofrece elegir');
  assert.match(r!.mensaje, /más de una molienda disponible/);
  assert.equal(r!.enlace?.href, '/admin/productos');
});

test('condicionCampoInactiva: "molienda-multiple" con AL MENOS un producto de varias moliendas disponibles — no avisa', () => {
  const catalogo = [
    producto([{ nombre: 'Media', metodo: 'Goteo', disponible: true }]),
    producto([
      { nombre: 'Media', metodo: 'Goteo', disponible: true },
      { nombre: 'Gruesa', metodo: 'Prensa', disponible: true },
    ]),
  ];
  assert.equal(condicionCampoInactiva('molienda-multiple', catalogo, true), null);
});

test('condicionCampoInactiva: dos moliendas declaradas pero sólo UNA disponible no cuenta como elección', () => {
  // `decidirMolienda` exige 2+ DISPONIBLES — una opción agotada no la vuelve una elección real.
  const catalogo = [
    producto([
      { nombre: 'Media', metodo: 'Goteo', disponible: true },
      { nombre: 'Gruesa', metodo: 'Prensa', disponible: false },
    ]),
  ];
  const r = condicionCampoInactiva('molienda-multiple', catalogo, true);
  assert.ok(r, 'una sola disponible sigue siendo "automática", no "elección" — debería avisar');
});

// ─── item 5, EDITOR-ORDEN-Y-LIENZO-2: el PISO de `tiendaCreditos` como CUARTO motivo de
// `noSeMuestra` — "secciones sin foto o sin titular" ────────────────────────────────────────────

test('tiendaCreditosPisoIncompleto: con 4 ítems y sólo 2 completos (ninguno vacío) — true', () => {
  const items = [
    { etiqueta: 'Pago', valor: 'Contraentrega' },
    { etiqueta: 'Envío', valor: '' },
    { etiqueta: 'Pausa', valor: 'Cuando quieras' },
    { etiqueta: '', valor: '' },
  ];
  assert.equal(tiendaCreditosPisoIncompleto('tiendaCreditos', false, items), true);
});

test('tiendaCreditosPisoIncompleto: con 3+ filas completas — false (sí se muestra)', () => {
  const items = [
    { etiqueta: 'Pago', valor: 'Contraentrega' },
    { etiqueta: 'Envío', valor: 'Gratis' },
    { etiqueta: 'Pausa', valor: 'Cuando quieras' },
  ];
  assert.equal(tiendaCreditosPisoIncompleto('tiendaCreditos', false, items), false);
});

test('tiendaCreditosPisoIncompleto: lista vacía — false (ya lo cubre `repeaterVacio`, nunca los dos a la vez)', () => {
  assert.equal(tiendaCreditosPisoIncompleto('tiendaCreditos', true, []), false);
});

test('tiendaCreditosPisoIncompleto: otra sección (p. ej. un repeater cualquiera) — siempre false', () => {
  const items = [{ etiqueta: 'x', valor: '' }];
  assert.equal(tiendaCreditosPisoIncompleto('nosotrosGaleria', false, items as never), false);
});
