import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '../../lib/config/site-content-write';
import { readSiteContent } from '../../lib/config/site-content-read';
import { tarjetasDePresentaciones } from '../../lib/storefront/presentaciones';

// EL VIAJE DE PUNTA A PUNTA de Presentaciones (§ Backlog #65-B): el editor manda el form → el ROUTE lo
// pasa por `siteContentEditableSchema` → `guardarBorrador` → `publicarSeccion` → y el visitante lo lee
// por `readSiteContent`. El bug #65-B vivía en el SCHEMA (strip silencioso de `categoria1/2` y los slots
// 3-4), así que un test que llame a `guardarBorrador` DIRECTO —como borrador-endpoints— NO lo atrapa:
// hay que pasar por el schema, como el route. Por eso ESTE test existe aparte, y por eso el bug vivió
// desde C1 sin que nadie lo viera ("todos probaban el helper, no el viaje").
//
// Los DOS casos son las dos caras del mismo bug: el slot 3-4 (la tarjeta desaparecía) y el destino
// `categoria` (revertía al default de Nayoli — el que mordió en el gate).

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// Simula EXACTAMENTE el paso del route: parsea el body con el schema real (donde zod strippearía lo no
// declarado) y guarda el resultado. Si el schema strippea un campo, no llega a `guardarBorrador`.
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse({ presentaciones: data });
  await guardarBorrador(parsed);
}

test('OR de punta a punta: una tarjeta 3 con TÍTULO y SIN imagen sobrevive borrador→publicar→releer', async () => {
  // El criterio OR de la cardinalidad variable: título O imagen muestra la tarjeta. Antes del fix, el
  // schema strippeaba label3/imagen3/categoria3 → la tarjeta se perdía al guardar, sin explicación.
  await guardarComoElRoute({ label3: 'Cápsulas', copy3: 'Para tu cafetera', imagen3: '', categoria3: 'Cápsulas' });
  await publicarSeccion('presentaciones');

  const pres = (await readSiteContent()).presentaciones;
  // El dato del slot 3 sobrevivió el SCHEMA (no se strippeó) y el viaje completo.
  assert.equal(pres.label3, 'Cápsulas', 'label3 debe sobrevivir el schema');
  assert.equal(pres.imagen3, '', 'imagen3 VACÍA debe sobrevivir — el OR no la descarta por faltar la foto');
  assert.equal(pres.categoria3, 'Cápsulas', 'categoria3 (el destino de la tarjeta 3) debe sobrevivir');
  // Y el STOREFRONT la muestra: visible por su TÍTULO, aunque no tenga imagen (el hueco es visible, no roto).
  const tarjetas = tarjetasDePresentaciones(pres);
  assert.ok(tarjetas.some(t => t.slot === 3 && t.label === 'Cápsulas'),
    'la tarjeta 3 (título sin imagen) debe estar VISIBLE en el storefront');
});

test('categoria de punta a punta: editar un destino NO revierte al default de Nayoli', async () => {
  // La otra cara: `categoria1` faltaba en el schema → editar el destino se strippeaba → al releer, el
  // resolver lo rellenaba con el DEFAULT de Nayoli ('Café en Grano'). Es el que mordió en el gate.
  await guardarComoElRoute({ categoria1: 'Café Especial' });
  await publicarSeccion('presentaciones');

  const pres = (await readSiteContent()).presentaciones;
  assert.equal(pres.categoria1, 'Café Especial', 'el destino editado NO debe revertir al default');
  // Sanity: el default ES distinto, así que la aserción de arriba prueba algo (no un valor que ya estaba).
  assert.notEqual(pres.categoria1, 'Café en Grano');
});
