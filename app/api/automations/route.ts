import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { AUTOMATION_TEMPLATES } from '@/lib/mock/automations';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Upsert all templates so every one exists in DB
  const automations = await Promise.all(
    AUTOMATION_TEMPLATES.map(t =>
      prisma.automation.upsert({
        where:  { tipo: t.tipo },
        update: {},
        create: {
          tipo:   t.tipo,
          nombre: t.nombre,
          canal:  t.canal,
          activa: false,
        },
      })
    )
  );

  return NextResponse.json(automations);
}