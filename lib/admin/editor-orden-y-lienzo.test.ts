import { test } from 'node:test';
import assert from 'node:assert/strict';

import { condicionCampoInactiva, resumenBloqueTarjeta } from './editor-orden-y-lienzo';
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
