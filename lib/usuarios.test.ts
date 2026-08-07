import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accionEstadoUsuario, motivoRechazoCambioEstado, esUltimoOwnerConAcceso,
  ROLES_INVITABLES,
} from './usuarios';

// Las reglas de salida del equipo. Se testean acá —capa 1, sin base— porque son
// decisiones de producto, no detalles de un handler: quién puede sacar a quién, y
// qué acción se le ofrece a cada usuario.

// ─── El invariante del par ───────────────────────────────────────────────────

test('activo → se ofrece Desactivar, y manda activo:false', () => {
  const accion = accionEstadoUsuario({ activo: true });
  assert.equal(accion?.label, 'Desactivar');
  assert.equal(accion?.activo, false);
});

test('inactivo → se ofrece Reactivar, y manda activo:true', () => {
  const accion = accionEstadoUsuario({ activo: false });
  assert.equal(accion?.label, 'Reactivar');
  assert.equal(accion?.activo, true);
});

test('EL INVARIANTE: la acción ofrecida es siempre el INVERSO del estado', () => {
  // Es la lección de "Activar desde el badge", trasladada: lo que hay que
  // garantizar no es el texto del botón sino que nunca se ofrezca el estado en el
  // que el usuario YA está. Ofrecerlo es lo que deja a alguien atrapado, y no
  // rompe ninguna pantalla mientras pasa.
  for (const activo of [true, false]) {
    assert.equal(accionEstadoUsuario({ activo })?.activo, !activo);
  }
});

// ─── Las tres guardas ────────────────────────────────────────────────────────

const OWNER = { id: 'u-owner', role: 'OWNER', activo: true };
const OTRO_OWNER = { id: 'u-owner2', role: 'OWNER', activo: true };
const MANAGER = { id: 'u-mgr', role: 'MANAGER', activo: true };

const ctx = (over: Partial<Parameters<typeof motivoRechazoCambioEstado>[0]>) =>
  motivoRechazoCambioEstado({
    actorRol: 'OWNER', actorId: OWNER.id, objetivo: MANAGER,
    activo: false, ownersActivos: 2, ...over,
  });

test('GUARDA 1 — sólo OWNER puede cambiar el estado', () => {
  assert.match(ctx({ actorRol: 'MANAGER' }) ?? '', /Solo el dueño/);
  assert.match(ctx({ actorRol: 'STAFF' }) ?? '', /Solo el dueño/);
  assert.match(ctx({ actorRol: undefined }) ?? '', /Solo el dueño/);
  assert.equal(ctx({ actorRol: 'OWNER' }), null);
});

test('GUARDA 2 — nadie se desactiva a sí mismo', () => {
  assert.match(ctx({ objetivo: { ...OWNER }, ownersActivos: 2 }) ?? '', /a ti mismo/);
});

test('GUARDA 3 — no se puede desactivar al último dueño ACTIVO', () => {
  assert.match(
    ctx({ actorId: 'otro', objetivo: OTRO_OWNER, ownersActivos: 1 }) ?? '',
    /al menos un dueño activo/,
  );
  // Con dos dueños activos, sacar a uno es legítimo.
  assert.equal(ctx({ actorId: 'otro', objetivo: OTRO_OWNER, ownersActivos: 2 }), null);
});

test('el orden de las guardas no filtra existencia a quien no está autorizado', () => {
  // Un MANAGER preguntando por un id inventado recibe "Solo el dueño", no
  // "Usuario no encontrado": si el orden fuera al revés, el mensaje de error
  // serviría para descubrir qué ids existen.
  assert.match(ctx({ actorRol: 'MANAGER', objetivo: null }) ?? '', /Solo el dueño/);
});

test('usuario inexistente da su propio motivo', () => {
  assert.equal(ctx({ objetivo: null }), 'Usuario no encontrado');
});

test('REACTIVAR al último dueño no se bloquea — la guarda es sobre quitar acceso', () => {
  // Con un solo dueño activo, reactivar a OTRO usuario no puede estar prohibido:
  // la regla protege que quede alguien, no que no entre nadie más.
  assert.equal(
    ctx({ actorId: 'otro', objetivo: { ...MANAGER, activo: false }, activo: true, ownersActivos: 1 }),
    null,
  );
});

test('el MISMO motivo sirve para el servidor y para el botón deshabilitado', () => {
  // La pantalla no reimplementa las guardas: llama a esta función con los datos
  // que ya tiene cargados y muestra la frase que devuelve. Por eso el motivo
  // tiene que ser una frase legible por un humano y no un código de error — es
  // literalmente lo que el operador lee bajo el botón gris.
  const propio = motivoRechazoCambioEstado({
    actorRol: 'OWNER', actorId: OWNER.id, objetivo: OWNER,
    activo: false, ownersActivos: 2,
  });
  assert.equal(propio, 'No puedes desactivarte a ti mismo');
});

test('la sesión del cliente puede traer el rol en null y la regla no revienta', () => {
  // `authClient.useSession()` tipa el rol como nullable. Si esto lanzara, la fila
  // entera dejaría de renderizar por un dato ausente.
  assert.match(
    motivoRechazoCambioEstado({
      actorRol: null, actorId: 'x', objetivo: MANAGER, activo: false, ownersActivos: 2,
    }) ?? '',
    /Solo el dueño/,
  );
});

// ─── La regla compartida con el cambio de rol ────────────────────────────────

test('`esUltimoOwnerConAcceso` cubre las DOS vías de perder el acceso', () => {
  // Desactivar…
  assert.equal(esUltimoOwnerConAcceso({ objetivo: OTRO_OWNER, activo: false, ownersActivos: 1 }), true);
  // …y degradar el rol. Es la misma regla y por eso es una sola función: dos
  // definiciones de "el último dueño" es cómo se llega a un panel sin dueño.
  assert.equal(esUltimoOwnerConAcceso({ objetivo: OTRO_OWNER, nuevoRol: 'MANAGER', ownersActivos: 1 }), true);
});

test('un OWNER YA inactivo no cuenta como el último con acceso', () => {
  // El caso que la protección vieja no miraba: contaba `role: OWNER` a secas.
  const ownerInactivo = { role: 'OWNER', activo: false };
  assert.equal(esUltimoOwnerConAcceso({ objetivo: ownerInactivo, activo: false, ownersActivos: 1 }), false);
});

test('sobre un no-OWNER la regla no aplica nunca', () => {
  assert.equal(esUltimoOwnerConAcceso({ objetivo: MANAGER, activo: false, ownersActivos: 1 }), false);
  assert.equal(esUltimoOwnerConAcceso({ objetivo: MANAGER, nuevoRol: 'STAFF', ownersActivos: 1 }), false);
});

test('mantener OWNER como OWNER no dispara la guarda', () => {
  assert.equal(esUltimoOwnerConAcceso({ objetivo: OTRO_OWNER, nuevoRol: 'OWNER', ownersActivos: 1 }), false);
});

// ─── Roles invitables ────────────────────────────────────────────────────────

test('STAFF NO se ofrece al invitar — es un rol sin puerta', () => {
  // El gate del panel exige OWNER o MANAGER, así que un invitado STAFF crearía su
  // contraseña y se estrellaría contra el redirect. El valor del enum se queda
  // (append-only); lo que desaparece es la oferta.
  assert.ok(!ROLES_INVITABLES.includes('STAFF'));
});

test('OWNER tampoco se invita: se otorga cambiando el rol de alguien que ya entró', () => {
  assert.ok(!ROLES_INVITABLES.includes('OWNER'));
});

test('queda al menos un rol invitable — si no, "Invitar" sería un botón muerto', () => {
  assert.ok(ROLES_INVITABLES.length > 0);
});
