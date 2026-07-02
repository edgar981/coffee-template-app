import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { ROLES } from '@/constants/roles';

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

  const targetUser =
    await prisma.user.findUnique({
      where: { id },
    });

  if (!targetUser) {
    return NextResponse.json({ error: "Usuario no encontrado", }, { status: 404 }); 
  }

  if (targetUser.role === "OWNER" && role !== "OWNER") {
    const ownerCount = await prisma.user.count({
        where: {
          role: "OWNER",
        },
      });

    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Debe existir al menos un dueño", }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data:  { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}