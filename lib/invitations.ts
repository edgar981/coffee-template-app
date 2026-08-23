import prisma from '@duna/core';
import type { Role } from '@duna/core';

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
