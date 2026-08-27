import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { datosDelPatch } from '@duna/core/customer-update';
import { prisma, limpiar } from './fixtures';

// UN PATCH PARCIAL DE CLIENTE NO PUEDE TOCAR NADA MÁS — el gemelo del defecto que
// destruyó datos en Productos, todavía vivo acá el día que se escribió este test.
//
// El endpoint escribía los OCHO campos sin condición, con fallbacks sobre claves
// ausentes (`body.email || null`, `canal || 'directo'`, `activo ?? true`). Ningún
// control manda hoy un campo suelto —el modal manda el formulario completo— así
// que es una MINA, no una herida: el día que exista un control que mande sólo
// `{ activo: false }` (el toggle de desactivar cliente del backlog #8-A), ese
// click vaciaría correo, teléfono, ciudad, dirección y notas, y pondría el origen
// en `directo`. Sobreviviría `nombre` sólo porque su `undefined` lo ignora Prisma
// —el mismo mecanismo que mantuvo invisible el daño en Productos—.
//
// POR QUÉ VA EN EL CARRIL Y NO EN LA SUITE PURA: lo que se afirma no es la forma
// del objeto que se construye, es lo que la fila TIENE DESPUÉS de escribir. Un
// test con mocks habría pasado en verde contra el código defectuoso —el objeto
// que se armaba era exactamente el que Prisma escribió—; lo que delata el bug es
// releer la fila. Mismo criterio que `patch-producto-parcial`.
//
// El carril no monta handlers HTTP, así que se ejercita `datosDelPatch` —la
// función que el endpoint usa para decidir qué escribe— contra una base real.
// Lo que queda fuera y sigue siendo del checklist manual: la sesión, los roles y
// el fetch del navegador.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Un cliente POBLADO: cada campo con un valor que se note si desaparece. */
async function crearClienteCompleto() {
  return prisma.customer.create({
    data: {
      nombre:    'Valentina Torres',
      email:     'valentina.torres@gmail.com',
      telefono:  '+573001234567',
      ciudad:    'Bogotá',
      direccion: 'Calle 123 #45-67',
      canal:     'whatsapp',
      notas:     'Prefiere entrega en la mañana.',
      activo:    true,
    },
  });
}

/** Aplica un body como lo hace el endpoint y devuelve la fila releída. */
async function patch(id: string, body: Record<string, unknown>) {
  await prisma.customer.update({
    where: { id },
    data:  { ...datosDelPatch(body), updatedAt: new Date() },
  });
  return prisma.customer.findUniqueOrThrow({ where: { id } });
}

// ─── LA REGRESIÓN — LA MINA DE #8-A ──────────────────────────────────────────

test('{ activo: false } cambia SOLO `activo` — la fila entera queda igual', async () => {
  const antes = await crearClienteCompleto();

  const despues = await patch(antes.id, { activo: false });

  // La afirmación es sobre la fila COMPLETA y no sobre una lista de campos
  // elegidos a mano: así, una columna nueva que alguien agregue al schema queda
  // cubierta el día que la agrega. `updatedAt` es lo único que un PATCH siempre
  // mueve, por diseño.
  assert.deepEqual(
    { ...despues, updatedAt: null },
    { ...antes, activo: false, updatedAt: null },
  );
});

test('reactivar tampoco toca nada: el ida y vuelta deja la fila idéntica', async () => {
  const antes = await crearClienteCompleto();

  await patch(antes.id, { activo: false });
  const despues = await patch(antes.id, { activo: true });

  assert.deepEqual({ ...despues, updatedAt: null }, { ...antes, updatedAt: null });
});

// ─── Que el arreglo no haya vuelto mudo al endpoint ──────────────────────────

test('un PATCH completo sigue escribiendo todo lo que trae', async () => {
  const antes = await crearClienteCompleto();

  const despues = await patch(antes.id, {
    nombre:    'Valentina Torres Ramírez',
    email:     'valentina.tr@gmail.com',
    telefono:  '3009998888',
    ciudad:    'Medellín',
    direccion: 'Carrera 70 #1-23',
    canal:     'directo',
    notas:     'Cambió de ciudad.',
    activo:    false,
  });

  assert.equal(despues.nombre, 'Valentina Torres Ramírez');
  assert.equal(despues.email, 'valentina.tr@gmail.com');
  // El teléfono se canoniza igual que en el matching de órdenes: 10 dígitos → +57.
  assert.equal(despues.telefono, '+573009998888');
  assert.equal(despues.ciudad, 'Medellín');
  assert.equal(despues.direccion, 'Carrera 70 #1-23');
  assert.equal(despues.canal, 'directo');
  assert.equal(despues.notas, 'Cambió de ciudad.');
  assert.equal(despues.activo, false);
});

test('vaciar un campo A PROPÓSITO se distingue de no mandarlo', async () => {
  // La razón de mirar la PRESENCIA de la clave y no la verdad del valor: `''`
  // es una edición legítima (borrar el correo, la ciudad) y tiene que escribirse.
  const antes = await crearClienteCompleto();

  const despues = await patch(antes.id, { email: '', ciudad: '', notas: '' });

  assert.equal(despues.email, null);   // `'' || null` → null, como siempre
  assert.equal(despues.ciudad, null);
  assert.equal(despues.notas, null);
  // …y lo que no se mandó sigue intacto.
  assert.equal(despues.nombre, antes.nombre);
  assert.equal(despues.telefono, antes.telefono);
  assert.equal(despues.direccion, antes.direccion);
  assert.equal(despues.canal, antes.canal);
});

test('una clave con `undefined` cuenta como AUSENTE, no como borrado', async () => {
  // Es lo que manda un cliente que arma el body con campos opcionales.
  const antes = await crearClienteCompleto();

  const despues = await patch(antes.id, { activo: false, email: undefined, ciudad: undefined });

  assert.equal(despues.email, antes.email);
  assert.equal(despues.ciudad, antes.ciudad);
});

test('un body VACÍO no cambia ningún campo', async () => {
  const antes = await crearClienteCompleto();

  const despues = await patch(antes.id, {});

  assert.deepEqual({ ...despues, updatedAt: null }, { ...antes, updatedAt: null });
});
