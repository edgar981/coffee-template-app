import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearProductoConAsiento, aplicarPatchProducto } from '@duna/core/product-update';
import { aplicarAjusteInventario } from '@duna/core/inventory';
import { prisma, limpiar } from './fixtures';

// LA AUDITORÍA DICE QUIÉN — POR LAS DOS PUERTAS.
//
// El kardex pasa a ser LA vista de auditoría de la vertical de Inventario, y una
// auditoría cuyo asiento no dice quién lo hizo está coja justo en su razón de ser.
// El stock se escribe por DOS puertas (decisión del owner, 2026-08-05):
// `aplicarAjusteInventario` (Ajustar Stock) y `aplicarPatchProducto` /
// `crearProductoConAsiento` (edición de ficha). Las DOS tienen que capturar al
// actor: si sólo una lo hace, la auditoría miente A MEDIAS — lo peor, porque
// PARECE completa (unas filas con nombre, otras vacías, sin nada que lo explique).
//
// Va en el carril y no en la suite pura por el motivo de siempre: lo que se afirma
// es qué quedó ESCRITO en la fila después de la transacción, no la forma de un
// objeto. Un test con mocks pasaría en verde contra una puerta que no escribe el
// actor. Se verificó neutralizando la escritura del actor en cada puerta por
// separado y viendo fallar su rama.

const ANA  = { id: 'user-ana',  nombre: 'Ana Ruiz' };
const BETO = { id: 'user-beto', nombre: 'Beto Díaz' };

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

async function crearProducto(stock: number, actor?: { id: string; nombre: string | null }) {
  return crearProductoConAsiento({
    nombre:       'Café de prueba',
    slug:         `cafe-prueba-${stock}`,
    descripcion:  'Una descripción cualquiera.',
    categoria:    'cafe_grano',
    precio:       20000,
    stock,
    stock_minimo: 5,
  }, actor);
}

const kardexDe = (id: string) =>
  prisma.inventoryLog.findMany({ where: { producto_id: id }, orderBy: { createdAt: 'asc' } });

// ─── PUERTA 0 · el asiento inaugural (crearProductoConAsiento) ────────────────

test('crear un producto: el asiento inaugural captura al actor', async () => {
  const p = await crearProducto(42, ANA);
  const [inaugural] = await kardexDe(p.id);
  assert.equal(inaugural.ajustado_por, ANA.id);
  assert.equal(inaugural.ajustado_por_nombre, ANA.nombre);
});

// ─── PUERTA 1 · Ajustar Stock (aplicarAjusteInventario) ──────────────────────

test('Ajustar Stock captura al actor de ESA operación', async () => {
  const p = await crearProducto(10, ANA);
  await aplicarAjusteInventario({ producto_id: p.id, tipo: 'entrada', cantidad: 5 }, BETO);

  const asientos = await kardexDe(p.id);
  const ajuste = asientos.at(-1)!;
  assert.equal(ajuste.stock_nuevo, 15);          // el movimiento se aplicó
  assert.equal(ajuste.ajustado_por, BETO.id);    // y lo firmó Beto, no Ana
  assert.equal(ajuste.ajustado_por_nombre, BETO.nombre);
});

// ─── PUERTA 2 · edición de ficha (aplicarPatchProducto) ──────────────────────

test('Editar la ficha (campo Stock del modal) captura al actor', async () => {
  const p = await crearProducto(28, ANA);
  await aplicarPatchProducto(p.id, { stock: 40 }, BETO);

  const asientos = await kardexDe(p.id);
  const edicion = asientos.at(-1)!;
  assert.equal(edicion.stock_nuevo, 40);
  assert.equal(edicion.ajustado_por, BETO.id);
  assert.equal(edicion.ajustado_por_nombre, BETO.nombre);
});

// ─── LAS DOS PUERTAS, EN UNA SOLA CADENA, CADA ASIENTO CON SU DUEÑO ──────────
//
// Es la afirmación que da nombre al archivo: si sólo una puerta capturara, este
// test mostraría un asiento con nombre y otro sin él sobre el MISMO producto —
// la auditoría a medias.

test('las dos puertas firman su propio asiento sobre el mismo producto', async () => {
  const p = await crearProducto(10, ANA);                                   // inaugural: Ana
  await aplicarPatchProducto(p.id, { stock: 25 }, ANA);                     // puerta 2: Ana
  await aplicarAjusteInventario({ producto_id: p.id, tipo: 'salida', cantidad: 5 }, BETO); // puerta 1: Beto

  const asientos = await kardexDe(p.id);
  assert.equal(asientos.length, 3);
  // NINGUNO quedó sin firmar — el modo de falla de "sólo una puerta captura".
  assert.ok(asientos.every(a => a.ajustado_por_nombre), 'un asiento quedó sin actor');
  assert.equal(asientos[0].ajustado_por_nombre, ANA.nombre);   // inaugural
  assert.equal(asientos[1].ajustado_por_nombre, ANA.nombre);   // edición de ficha
  assert.equal(asientos[2].ajustado_por_nombre, BETO.nombre);  // ajuste de inventario
});

// ─── SIN ACTOR · null es honesto (asiento del sistema, sin humano) ───────────

test('sin actor el asiento queda en null — no se inventa un dueño', async () => {
  const p = await crearProducto(10);                                        // sin actor
  await aplicarAjusteInventario({ producto_id: p.id, tipo: 'entrada', cantidad: 3 }); // sin actor

  const asientos = await kardexDe(p.id);
  assert.ok(asientos.every(a => a.ajustado_por === null && a.ajustado_por_nombre === null));
});
