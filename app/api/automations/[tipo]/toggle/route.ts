import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { tipo } = await params;

  const current = await prisma.automation.upsert({
    where:  { tipo },
    update: {},
    create: {
      tipo,
      nombre:          tipo,
      canal:           'interno',
      activa:          false,
      veces_ejecutada: 0,
    },
  });

  const updated = await prisma.automation.update({
    where: { tipo },
    data:  { activa: !current.activa },
  });

  // If stock_bajo was just turned ON, immediately scan for low stock products
  if (tipo === 'stock_bajo' && updated.activa) {
    const origin = _req.headers.get('origin') ?? 'http://localhost:3000';
    fetch(`${origin}/api/inventory/check-stock`, {
      method:  'POST',
      headers: { cookie: _req.headers.get('cookie') ?? '' },
    }).catch(console.error); // fire and forget
  }

  const all = await prisma.automation.findMany();
  return NextResponse.json(all);
}