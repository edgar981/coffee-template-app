import type { Role } from '@/types/admin';

// Las reglas de estado de un USUARIO del equipo: qué acción se le ofrece y
// quién puede ejecutarla. Puras y sin Prisma, para poder afirmarlas sin base
// (§ Las tres capas de verificación) — el endpoint pasa los datos ya leídos.
//
// Mismo criterio que `accionEstadoProducto`: la decisión de producto vive en
// lib/ y no dentro del JSX, porque un `if` cambiado en una pantalla rompería la
// respuesta a "¿cómo saco a alguien del equipo?" sin que nada lo notara.

export interface AccionEstadoUsuario {
  label: string;
  /** El estado que se va a ESCRIBIR — siempre el inverso del actual. */
  activo: boolean;
  successMessage: string;
}

/**
 * La acción que se ofrece sobre un usuario, derivada de su estado.
 *
 * Existe por la lección de "Activar desde el badge": el producto tuvo durante
 * meses una puerta sin su inversa —se podía desactivar y no reactivar— y la
 * única salida era la base. Acá el par nace completo, y el invariante ("la
 * acción es siempre el inverso del estado") está testeado para que siga así.
 */
export function accionEstadoUsuario(
  usuario: { activo: boolean } | null | undefined,
): AccionEstadoUsuario | undefined {
  if (!usuario) return undefined;
  return usuario.activo
    ? { label: 'Desactivar', activo: false, successMessage: 'Usuario desactivado' }
    : { label: 'Reactivar',  activo: true,  successMessage: 'Usuario reactivado' };
}

/** Lo que el servidor necesita saber para decidir. Todo ya leído de la base. */
export interface ContextoCambioEstado {
  /** Rol de quien ejecuta. Admite `null` porque el cliente lo lee de la sesión
   *  de Better Auth, donde el campo es nullable — y la MISMA función corre en el
   *  navegador (para mostrar el motivo) y en el servidor (para decidir). */
  actorRol: Role | string | null | undefined;
  /** Id de quien ejecuta. */
  actorId: string;
  /** El usuario objetivo, tal como está HOY en la base. */
  objetivo: { id: string; role: Role | string; activo: boolean } | null;
  /** Estado que se quiere escribir. */
  activo: boolean;
  /** Cuántos OWNER ACTIVOS hay ahora mismo, incluido el objetivo si lo es. */
  ownersActivos: number;
}

/**
 * `null` = la operación procede. Un string = el motivo del rechazo, listo para
 * viajar como `{ error }` del endpoint (§ razonDelServidor: la frase dice qué
 * corregir, no "Error al guardar").
 *
 * El ORDEN de las guardas importa y no es casual: primero autorización (¿quién
 * sos?), después existencia (¿a quién?), y al final las reglas de negocio. Al
 * revés, un MANAGER podría descubrir por el mensaje de error si un id existe.
 */
export function motivoRechazoCambioEstado(ctx: ContextoCambioEstado): string | null {
  if (ctx.actorRol !== 'OWNER') {
    return 'Solo el dueño puede activar o desactivar usuarios';
  }
  if (!ctx.objetivo) {
    return 'Usuario no encontrado';
  }
  // Desactivarse a uno mismo deja al panel sin quien lo administre desde la
  // sesión que acaba de perder el acceso — y el operador se queda mirando un
  // redirect sin entender qué pasó.
  if (ctx.objetivo.id === ctx.actorId) {
    return 'No puedes desactivarte a ti mismo';
  }
  // MISMA regla que protege el cambio de rol, con la corrección que `activo`
  // obliga: lo que hay que preservar es al menos un dueño CON ACCESO. Un OWNER
  // desactivado no puede administrar nada, así que contarlo dejaría al panel sin
  // dueño efectivo por una vía que la protección vieja no miraba.
  if (esUltimoOwnerConAcceso(ctx)) {
    return 'Debe quedar al menos un dueño activo';
  }
  return null;
}

/**
 * ¿Esta operación dejaría al panel sin ningún OWNER activo?
 *
 * Se exporta aparte porque la comparten DOS caminos —desactivar y degradar el
 * rol— y son la misma regla: el `PATCH /role` contaba `role: OWNER` sin mirar
 * `activo`, así que con esta columna nueva su cuenta pasó a poder incluir dueños
 * sin acceso. Dos definiciones de "el último dueño" es cómo se llega a un panel
 * que nadie puede administrar.
 */
export function esUltimoOwnerConAcceso(ctx: {
  objetivo: { role: Role | string; activo: boolean } | null;
  /** El cambio que se quiere hacer: desactivar, o degradar de rol. */
  activo?: boolean;
  nuevoRol?: Role | string;
  ownersActivos: number;
}): boolean {
  const o = ctx.objetivo;
  if (!o || o.role !== 'OWNER' || !o.activo) return false;

  // Pierde el acceso de dueño si se lo desactiva, o si deja de ser OWNER.
  const dejaDeSerOwnerActivo =
    (ctx.activo === false) || (ctx.nuevoRol !== undefined && ctx.nuevoRol !== 'OWNER');

  return dejaDeSerOwnerActivo && ctx.ownersActivos <= 1;
}

/**
 * Roles que el formulario de invitación OFRECE.
 *
 * `STAFF` sale de la lista y el valor del enum SE QUEDA (append-only: hay filas
 * y sesiones que lo tienen). El motivo es que hoy es un rol MUERTO —el gate del
 * panel exige OWNER o MANAGER, así que un invitado STAFF crea su contraseña y se
 * estrella contra el redirect a /login sin explicación—. Invitar a alguien a una
 * puerta que no abre es peor que no ofrecerlo.
 *
 * Vuelve a la lista el día que STAFF tenga superficie propia; hasta entonces,
 * ofrecerlo es prometer un acceso que no existe.
 */
export const ROLES_INVITABLES: Role[] = ['MANAGER'];
