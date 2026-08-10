import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { motivoRechazoCambioEstado } from '@duna/core/usuarios';

// Activar / desactivar el acceso de un usuario al panel. NO borra: un usuario es
// actor de registros auditables (quién registró un pago, quién verificó un
// comprobante) y salir del equipo es un hecho reversible.
//
// Las guardas viven en `lib/usuarios` (puras, testeadas) y acá sólo se leen los
// datos que necesitan. El cliente esconde lo que no aplica, pero quien MANDA es
// esto: un MANAGER que arme el PATCH a mano recibe 403 igual.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const actor = session.user as { id: string; role?: string };
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }); }

  const activo = (body as { activo?: unknown })?.activo;
  if (typeof activo !== 'boolean') {
    return NextResponse.json({ error: 'Falta el estado a aplicar' }, { status: 400 });
  }

  const objetivo = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, role: true, activo: true },
  });

  // Se cuentan los dueños CON ACCESO, no los que tienen el rol: un OWNER
  // desactivado no puede administrar nada, así que incluirlo dejaría pasar la
  // desactivación del último dueño efectivo.
  const ownersActivos = await prisma.user.count({ where: { role: 'OWNER', activo: true } });

  const motivo = motivoRechazoCambioEstado({
    actorRol: actor.role,
    actorId:  actor.id,
    objetivo,
    activo,
    ownersActivos,
  });
  if (motivo) {
    // 403 cuando el rechazo es de autorización; 404 si el usuario no existe; 400
    // para las reglas de negocio. El mensaje viaja tal cual — es la frase que le
    // dice al operador qué corregir.
    const status = motivo.startsWith('Solo el dueño') ? 403
                 : motivo === 'Usuario no encontrado' ? 404
                 : 400;
    return NextResponse.json({ error: motivo }, { status });
  }

  const updated = await prisma.user.update({
    where:  { id },
    data:   { activo },
    select: { id: true, name: true, email: true, role: true, activo: true },
  });

  // REVOCACIÓN. El gate del panel ya cortaría el acceso en el siguiente request
  // —`getSession` consulta la base cada vez, no hay cookieCache—, pero la fila de
  // sesión seguiría viva hasta expirar (8 h). Borrarla es lo que hace que no
  // quede una credencial válida colgando; `session.deleteMany` es la primitiva de
  // Better Auth para esto y no hace falta nada más.
  //
  // Va DESPUÉS del update y sin poder tumbarlo: si el borrado fallara, el acceso
  // ya está cortado por el gate y lo que queda es una sesión inerte. Al revés
  // —revocar y que el update falle— echaría a alguien que sigue activo.
  if (!activo) {
    try {
      await prisma.session.deleteMany({ where: { userId: id } });
    } catch (e) {
      console.error(`[users/activo] no se pudieron revocar las sesiones de ${id}:`, e);
    }
  }

  return NextResponse.json(updated);
}
