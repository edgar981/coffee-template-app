import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  listarInvitacionesPendientes, cancelarInvitacion, invitacionParaRenovar, confirmarRenovacion,
} from '@/lib/invitations';
import { prisma } from './fixtures';

// UNA INVITACIÓN PENDIENTE ES SIN ACEPTAR *Y* SIN VENCER — las dos condiciones.
//
// El listado y el gate del POST comparten la misma pareja (`usedAt: null` +
// `expiresAt > ahora`), así que lo que se muestra es exactamente lo que se puede
// cancelar para desbloquear una dirección. Este test afirma QUÉ FILAS vuelven —no
// la forma de un objeto—: una aceptada o una vencida no pueden colarse, y cancelar
// no puede tocar una ya aceptada.
//
// ── POR QUÉ VA EN EL CARRIL ─────────────────────────────────────────────────
//
// El defecto vive en el `where`, no en el mapeo: un test con mocks pasa en verde
// contra un filtro que olvide una de las dos condiciones. Sólo releer una base con
// las tres clases de fila (viva / aceptada / vencida) lo delata. Se lo vio fallar
// quitando `usedAt: null` (la aceptada se cuela) y quitando `expiresAt` (la vencida
// se cuela). **No borrar** al tocar `lib/invitations.ts`.

// Las invitaciones no cuelgan de nada que `limpiar()` toque (no hay FK), así que se
// limpian aparte.
const limpiarInvitaciones = () => prisma.invitation.deleteMany({});

before(() => limpiarInvitaciones());
beforeEach(() => limpiarInvitaciones());
after(async () => { await limpiarInvitaciones(); await prisma.$disconnect(); });

let n = 0;
async function crearInvitacion(opts: {
  email:     string;
  usedAt?:   Date | null;
  expiresAt: Date;
  createdAt?: Date;
}) {
  return prisma.invitation.create({
    data: {
      email:     opts.email,
      name:      'Invitado',
      role:      'MANAGER',
      tokenHash: `hash-${n++}-${opts.email}`,   // @unique: uno por fila
      usedAt:    opts.usedAt ?? null,
      expiresAt: opts.expiresAt,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

const enFuturo = () => new Date(Date.now() + 24 * 3_600_000);
const enPasado = () => new Date(Date.now() - 1 * 3_600_000);

test('sólo la VIVA aparece: la aceptada y la vencida quedan fuera', async () => {
  await crearInvitacion({ email: 'viva@x.com',     expiresAt: enFuturo() });
  await crearInvitacion({ email: 'aceptada@x.com', expiresAt: enFuturo(), usedAt: new Date() });
  await crearInvitacion({ email: 'vencida@x.com',  expiresAt: enPasado() });

  const pendientes = await listarInvitacionesPendientes();

  assert.equal(pendientes.length, 1, 'sólo la viva; una aceptada o vencida se coló');
  assert.equal(pendientes[0].email, 'viva@x.com');
});

test('el orden es por creación, la más nueva primero', async () => {
  await crearInvitacion({ email: 'vieja@x.com',  expiresAt: enFuturo(), createdAt: new Date(Date.now() - 10_000) });
  await crearInvitacion({ email: 'nueva@x.com',  expiresAt: enFuturo(), createdAt: new Date() });

  const pendientes = await listarInvitacionesPendientes();
  assert.deepEqual(pendientes.map(p => p.email), ['nueva@x.com', 'vieja@x.com']);
});

test('cancelar una pendiente la saca del listado', async () => {
  const inv = await crearInvitacion({ email: 'porcancelar@x.com', expiresAt: enFuturo() });

  const ok = await cancelarInvitacion(inv.id);
  assert.equal(ok, true);

  const pendientes = await listarInvitacionesPendientes();
  assert.equal(pendientes.length, 0);
});

test('cancelar NO toca una ya aceptada: el registro de que se usó se conserva', async () => {
  const inv = await crearInvitacion({ email: 'yaacepto@x.com', expiresAt: enFuturo(), usedAt: new Date() });

  const ok = await cancelarInvitacion(inv.id);
  assert.equal(ok, false, 'una aceptada no se puede cancelar');

  // La fila sigue existiendo (no se borró), con su `usedAt` intacto.
  const sigue = await prisma.invitation.findUnique({ where: { id: inv.id } });
  assert.ok(sigue, 'la invitación aceptada fue borrada — se perdió el registro');
  assert.ok(sigue!.usedAt, 'perdió su marca de aceptación');
});

test('cancelar un id inexistente devuelve false, no revienta', async () => {
  assert.equal(await cancelarInvitacion('no-existe'), false);
});

// REENVIAR (§ PANEL-CONFIG-BLOQUES-1): `invitacionParaRenovar` + `confirmarRenovacion` son las
// dos mitades de "Reenviar" — la primera trae lo que hace falta para armar el correo (ANTES de
// mandarlo), la segunda persiste el token/vencimiento nuevos (DESPUÉS de que el correo salió). El
// `where` de las dos comparte la guarda `usedAt: null` con `cancelarInvitacion`/
// `listarInvitacionesPendientes` — una invitación ACEPTADA no se puede "revivir" por ninguna vía.

test('invitacionParaRenovar: trae email/name/role de una pendiente', async () => {
  const inv = await crearInvitacion({ email: 'renovar@x.com', expiresAt: enFuturo() });

  const encontrada = await invitacionParaRenovar(inv.id);
  assert.ok(encontrada);
  assert.equal(encontrada!.email, 'renovar@x.com');
  assert.equal(encontrada!.role, 'MANAGER');
});

test('invitacionParaRenovar: una ACEPTADA no se puede renovar', async () => {
  const inv = await crearInvitacion({ email: 'yaacepto2@x.com', expiresAt: enFuturo(), usedAt: new Date() });
  assert.equal(await invitacionParaRenovar(inv.id), null);
});

test('invitacionParaRenovar: un id inexistente devuelve null', async () => {
  assert.equal(await invitacionParaRenovar('no-existe'), null);
});

test('confirmarRenovacion: renueva token y vencimiento de una pendiente', async () => {
  const inv = await crearInvitacion({ email: 'confirmar@x.com', expiresAt: enPasado() }); // casi vencida

  const nuevoVencimiento = enFuturo();
  const ok = await confirmarRenovacion(inv.id, 'nuevo-hash-renovado', nuevoVencimiento);
  assert.equal(ok, true);

  const fila = await prisma.invitation.findUnique({ where: { id: inv.id } });
  assert.equal(fila!.tokenHash, 'nuevo-hash-renovado');
  assert.equal(fila!.expiresAt.getTime(), nuevoVencimiento.getTime());
});

test('confirmarRenovacion: NO toca una ya aceptada — devuelve false y el token viejo sobrevive', async () => {
  const inv = await crearInvitacion({ email: 'aceptada3@x.com', expiresAt: enFuturo(), usedAt: new Date() });
  const tokenHashOriginal = (await prisma.invitation.findUnique({ where: { id: inv.id } }))!.tokenHash;

  const ok = await confirmarRenovacion(inv.id, 'hash-que-no-deberia-quedar', enFuturo());
  assert.equal(ok, false);

  const fila = await prisma.invitation.findUnique({ where: { id: inv.id } });
  assert.equal(fila!.tokenHash, tokenHashOriginal, 'el token de una aceptada se sobrescribió');
});

test('confirmarRenovacion: un id inexistente devuelve false, no revienta', async () => {
  assert.equal(await confirmarRenovacion('no-existe', 'hash', enFuturo()), false);
});

test('reenviar DEJA la invitación pendiente — listarInvitacionesPendientes la sigue viendo con el vencimiento nuevo', async () => {
  const inv = await crearInvitacion({ email: 'viajecompleto@x.com', expiresAt: enPasado() });

  await invitacionParaRenovar(inv.id); // la mitad "antes de mandar"
  const nuevoVencimiento = enFuturo();
  await confirmarRenovacion(inv.id, 'hash-viaje-completo', nuevoVencimiento);

  const pendientes = await listarInvitacionesPendientes();
  const encontrada  = pendientes.find(p => p.email === 'viajecompleto@x.com');
  assert.ok(encontrada, 'la invitación renovada debe seguir pendiente');
  assert.equal(encontrada!.expiresAt.getTime(), nuevoVencimiento.getTime());
});
