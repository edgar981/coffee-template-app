import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { paletaEditableSchema } from '@/lib/config/palette-schema';

// Las RAÍCES de paleta del storefront (commit 4). Sub-ruta propia porque su write es
// distinto del de los campos planos (`/api/site-settings`): son 3 hex (o null para volver a
// los defaults), no el formulario de identidad. La VALIDACIÓN es la que MANDA
// (`paletaEditableSchema`) — un valor basura devuelve 400 y no llega al motor de derivación.
// Guardado a OWNER/MANAGER, con re-chequeo de rol acá (defensa en profundidad, igual que
// el resto de /api/*).

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = paletaEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  // Las 3 raíces, o null (volver a los defaults de código). El motor deriva las 17
  // restantes en el layout del storefront; acá sólo se guardan las raíces.
  await prisma.siteSetting.update({
    where: { id: 'default' },
    data: {
      paletaFondo:  d.paletaFondo,
      paletaTinta:  d.paletaTinta,
      paletaAcento: d.paletaAcento,
    },
  });
  return NextResponse.json({ ok: true });
}
