import prisma from '@duna/core';
import type { Role } from '@duna/core';

// LA DURACIÓN de una invitación — UNA fuente para crear (`POST /api/users/invite`) y renovar
// (`POST /api/users/invite/[id]`, "Reenviar"): dos copias del mismo número es cómo una de las dos
// queda desactualizada el día que cambie.
export const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000;

// ─── Invitaciones pendientes: LISTAR y CANCELAR ──────────────────────────────
//
// El POST de `/api/users/invite` crea la fila y hasta acá no había forma de VERLA
// ni de anularla: una invitación pendiente sólo se conocía por el correo que
// salió (§ Backlog #1). Peor: el propio POST rechaza invitar si hay una viva
// (`usedAt: null`, sin vencer), así que un correo mal tecleado BLOQUEA esa
// dirección 48 horas sin salida desde el panel. Listar + cancelar es esa salida.
//
// ── POR QUÉ ES UNA FUNCIÓN Y NO SÓLO EL `where` DEL ROUTE ────────────────────
//
// Se extrae la CONSULTA para poder afirmarla contra Postgres real (el carril no
// monta HTTP). Lo que hay que probar no es la forma de un objeto sino QUÉ FILAS
// vuelven: que una invitación ACEPTADA o VENCIDA no aparezca, y que cancelar no
// toque una ya aceptada. Un test con mocks pasa en verde contra un `where`
// defectuoso —el defecto vive en el filtro, no en el mapeo—; sólo releer la base
// lo delata.

export interface InvitacionPendiente {
  id:        string;
  email:     string;
  name:      string | null;
  role:      Role;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Las invitaciones que siguen VIVAS: sin aceptar (`usedAt: null`) Y sin vencer
 * (`expiresAt > ahora`). Las DOS condiciones importan, y es la misma pareja que
 * el POST usa para decidir si una dirección está bloqueada — por eso lo que se
 * lista es exactamente lo que se puede cancelar para desbloquearla.
 *
 * Una invitación VENCIDA no se lista a propósito: ya no bloquea (el POST la
 * ignora), así que re-invitar simplemente funciona y no hay nada que cancelar.
 * Mostrarla sería un estado ("Vencida") sin acción detrás.
 *
 * `ahora` es parámetro para que el carril afirme el borde del vencimiento sin
 * depender del reloj; el route lo llama con el default.
 */
export async function listarInvitacionesPendientes(ahora: Date = new Date()): Promise<InvitacionPendiente[]> {
  return prisma.invitation.findMany({
    where:   { usedAt: null, expiresAt: { gt: ahora } },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
  });
}

/**
 * Cancela una invitación por id. Sólo toca una SIN ACEPTAR (`usedAt: null`): si
 * la persona ya aceptó entre el listado y el clic, el usuario existe y no hay
 * nada que cancelar —borrar esa fila perdería el registro de que la invitación se
 * usó—. `deleteMany` con el `usedAt` en el `where` lo hace en UNA sentencia, así
 * que dos cancelaciones concurrentes no pueden ambas creerse la que borró.
 *
 * Devuelve `true` si borró algo, `false` si no había una pendiente con ese id
 * (ya aceptada, ya cancelada, o inexistente). El route traduce el `false` a un
 * 404 con su frase.
 */
export async function cancelarInvitacion(id: string): Promise<boolean> {
  const { count } = await prisma.invitation.deleteMany({ where: { id, usedAt: null } });
  return count > 0;
}

// ─── Reenviar — "renueva el vencimiento" (§ PANEL-CONFIG-BLOQUES-1) ─────────────────────────
//
// `POST /api/users/invite` RECHAZA invitar si ya hay una viva para ese correo (§ el route, el
// `existingInvite` del gate). Así que un correo mal recibido —spam, borrado sin querer— no se
// puede "re-invitar": hay que RENOVAR la fila que ya existe, con un token nuevo (el viejo deja de
// servir) y 48 h más desde ahora. Son DOS pasos separados a propósito, y el ORDEN es la decisión:
// primero se manda el correo con el link nuevo, y sólo si el envío funciona se persiste el nuevo
// token — igual que el POST (`invitation.create` → enviar → si falla, borrar la fila fresca). Acá
// no hay fila fresca que borrar (la invitación YA EXISTÍA), así que invertir el orden —persistir
// primero— dejaría, si el correo fallara, una invitación VIVA cuyo ÚNICO token válido nadie
// recibió: ni el viejo (ya rotado) ni el nuevo (nunca llegó). Mandar primero evita ese hueco; el
// costo es una ventana angosta —entre que el correo sale y la fila se actualiza— en la que una
// cancelación concurrente dejaría un correo con un link que no persiste. Documentado, no resuelto:
// la misma clase de ventana que ya acepta el resto del repo en flujos de un solo request.

export interface InvitacionParaRenovar {
  id:    string;
  email: string;
  name:  string | null;
  role:  Role;
}

/** La invitación PENDIENTE (`usedAt: null`) con ese id — o `null` si no hay una viva, el mismo
 *  caso que ya traduce `cancelarInvitacion` a 404. Se usa ANTES de mandar el correo: hace falta
 *  el `email`/`name` para armarlo. */
export async function invitacionParaRenovar(id: string): Promise<InvitacionParaRenovar | null> {
  return prisma.invitation.findFirst({
    where:  { id, usedAt: null },
    select: { id: true, email: true, name: true, role: true },
  });
}

/**
 * Persiste el token/vencimiento NUEVOS de una renovación cuyo correo YA SALIÓ. Misma guarda que
 * `cancelarInvitacion` —`updateMany` con `usedAt: null` en el `where`, una sola sentencia—: si la
 * invitación se aceptó o canceló mientras el correo viajaba, esto no toca nada y devuelve `false`.
 */
export async function confirmarRenovacion(id: string, tokenHash: string, expiresAt: Date): Promise<boolean> {
  const { count } = await prisma.invitation.updateMany({
    where: { id, usedAt: null },
    data:  { tokenHash, expiresAt },
  });
  return count > 0;
}
