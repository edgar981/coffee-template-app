import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirAccesoAdmin } from './acceso-admin';

// Sólo `decidirAccesoAdmin` — la mitad PURA del gate. `requerirSesionAdmin` toca Better Auth y
// Prisma (headers(), auth.api.getSession, prisma.user.findUnique) y no se testea en este carril
// (§ CLAUDE.md, "un test que necesite Postgres real va a tests/integracion/"); verificarlo en vivo
// es el gate de capa 3 (sesión real, rol real).

test('decidirAccesoAdmin: sin fila de usuario → inactivo (misma respuesta que desactivado)', () => {
  assert.deepEqual(decidirAccesoAdmin(null), { ok: false, motivo: 'inactivo' });
});

test('decidirAccesoAdmin: usuario desactivado → inactivo, sin importar el rol', () => {
  assert.deepEqual(decidirAccesoAdmin({ role: 'OWNER', activo: false }), { ok: false, motivo: 'inactivo' });
  assert.deepEqual(decidirAccesoAdmin({ role: 'MANAGER', activo: false }), { ok: false, motivo: 'inactivo' });
  assert.deepEqual(decidirAccesoAdmin({ role: 'STAFF', activo: false }), { ok: false, motivo: 'inactivo' });
});

test('decidirAccesoAdmin: activo pero sin rol de panel (STAFF u otro) → sin_acceso', () => {
  assert.deepEqual(decidirAccesoAdmin({ role: 'STAFF', activo: true }), { ok: false, motivo: 'sin_acceso' });
  assert.deepEqual(decidirAccesoAdmin({ role: 'ALGO_RARO', activo: true }), { ok: false, motivo: 'sin_acceso' });
});

test('decidirAccesoAdmin: OWNER activo → entra', () => {
  assert.deepEqual(decidirAccesoAdmin({ role: 'OWNER', activo: true }), { ok: true });
});

test('decidirAccesoAdmin: MANAGER activo → entra', () => {
  assert.deepEqual(decidirAccesoAdmin({ role: 'MANAGER', activo: true }), { ok: true });
});
