import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { historialDe } from '@/lib/automations/historial-server';

// GET /api/automations/[key]/history — lo que UNA automatización hizo.
// Lee AutomationRun, que ya se escribe en cada disparo: capacidad nueva, sin tabla
// nueva. El corte (ENVIADO+FALLIDO) y el cap (50) los aplica `historialDe`.
//
// Endpoint aparte del de la lista a propósito: el historial se pide sólo al abrir
// el acordeón de una tarjeta, no en cada carga de la página — cargarlo siempre
// sería traer runs de las ocho para el que quizá no abre ninguno.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const { key } = await params;
  return NextResponse.json(await historialDe(key));
}
