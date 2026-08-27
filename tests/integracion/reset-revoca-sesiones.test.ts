import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from './fixtures';

// EL RESET MATA LAS SESIONES PREVIAS — el corazón del flujo de recuperación.
//
// Quien resetea porque le robaron la clave NO debe dejar viva la sesión del
// ladrón. Lo garantiza `emailAndPassword.revokeSessionsOnPasswordReset: true` en
// `lib/auth.ts`: al resetear, Better Auth borra TODAS las sesiones del usuario.
//
// El invariante que este test afirma: una sesión que EXISTÍA antes del reset ya no
// vale después (su fila se borró). Se ve fallar apagando el flag —sin él la sesión
// sobrevive—; si pasara en los dos casos, no discriminaría nada.
//
// Va en el CARRIL y no en la suite pura porque lo que se afirma es un EFECTO sobre
// la base (la fila de sesión desaparece), atravesando el motor real de Better Auth
// —no una función pura—.
//
// `auth` entra por import DINÁMICO tras fijar el entorno: `TEST=true` hace que
// Better Auth se salte el chequeo de origen (no hay request HTTP en el carril), y
// el import estático se evaluaría ANTES de poder fijarlo (hoisting de ESM).

const EMAIL = 'reset-carril@duna.local';
let auth: typeof import('@/lib/auth')['auth'];

async function limpiarAuth() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL } });
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: 'reset-password:' } } });
  if (u) {
    await prisma.session.deleteMany({ where: { userId: u.id } });
    await prisma.account.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
}

before(async () => {
  process.env.TEST = 'true';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
  ({ auth } = await import('@/lib/auth'));
  await limpiarAuth();
});
after(async () => { await limpiarAuth(); await prisma.$disconnect(); });

test('tras un reset, una sesión previa deja de valer', async () => {
  // Un operador con credencial (como los invites: signUpEmail in-process,
  // autoSignIn:false → NO crea sesión).
  await auth.api.signUpEmail({ body: { email: EMAIL, password: 'ClaveVieja123', name: 'Operador Carril' } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

  // Una sesión que EXISTÍA antes del reset — la del operador logueado en otra
  // pestaña, o la del ladrón. Vigente (expira en 8 h).
  await prisma.session.create({
    data: {
      id:        randomUUID(),
      token:     randomUUID(),
      userId:    user.id,
      expiresAt: new Date(Date.now() + 8 * 3_600_000),
    },
  });
  assert.equal(
    await prisma.session.count({ where: { userId: user.id } }), 1,
    'precondición: la sesión previa existe',
  );

  // El reset, con un token generado por el flujo real (como al hacer clic en el correo).
  await auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: '/recuperar-clave/nueva' } });
  const v = await prisma.verification.findFirstOrThrow({
    where:   { identifier: { startsWith: 'reset-password:' } },
    orderBy: { createdAt: 'desc' },
  });
  const token = v.identifier.replace('reset-password:', '');
  await auth.api.resetPassword({ body: { newPassword: 'ClaveNueva456', token } });

  // EL INVARIANTE: la sesión previa ya no vale — su fila se borró. Sin el flag
  // `revokeSessionsOnPasswordReset` sobreviviría, y este assert se cae (visto).
  assert.equal(
    await prisma.session.count({ where: { userId: user.id } }), 0,
    'el reset mató la sesión previa',
  );

  // Y la clave NUEVA autentica — prueba que el reset ocurrió de verdad (la sesión
  // no se borró por otra razón). Esto crea una sesión nueva, del operador que entra
  // limpio; por eso va DESPUÉS de afirmar el 0.
  const entrada = await auth.api.signInEmail({ body: { email: EMAIL, password: 'ClaveNueva456' } });
  assert.ok(entrada?.user?.id === user.id, 'la clave nueva autentica al mismo usuario');
});
