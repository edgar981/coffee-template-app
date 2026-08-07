import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { ROLES } from '@/constants/roles';
import { esUltimoOwnerConAcceso } from '@/lib/usuarios';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || (session.user as any).role !== 'OWNER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await req.json();
  const currentUser = session.user as any;

  if(!ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  if (id === currentUser.id) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol",}, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, role: true, activo: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // MISMA regla que la de desactivar, no una segunda copia: lo que se preserva es
  // al menos un dueño CON ACCESO. Antes acá se contaba `role: OWNER` a secas, y
  // desde que existe `activo` esa cuenta podía incluir dueños desactivados —
  // degradar al único dueño con acceso habría pasado el filtro dejando el panel
  // sin quien lo administre.
  const ownersActivos = await prisma.user.count({ where: { role: "OWNER", activo: true } });

  if (esUltimoOwnerConAcceso({ objetivo: targetUser, nuevoRol: role, ownersActivos })) {
    return NextResponse.json({ error: "Debe quedar al menos un dueño activo" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data:  { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}