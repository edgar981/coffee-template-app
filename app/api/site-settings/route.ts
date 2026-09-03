import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';

// Config del negocio (SiteSetting), sólo campos PLANOS. Editable por el panel; el
// storefront la LEE por el loader server-only (lib/config/site-settings.ts). GET/PATCH
// guardados a OWNER/MANAGER, con re-chequeo de rol acá (defensa en profundidad, igual
// que el resto de /api/*).

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  // findUniqueOrThrow como el loader: la fila la garantiza la migración; su ausencia es
  // un deploy roto y debe fallar, no degradar a datos de código.
  const s = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 'default' } });
  return NextResponse.json(s);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = siteSettingsEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  // Write COMPLETO (el editor manda todo el formulario): sin la trampa del PATCH
  // parcial. `'' → null` en los opcionales para no guardar cadenas vacías.
  await prisma.siteSetting.update({
    where: { id: 'default' },
    data: {
      nombre:            d.nombre,
      tagline:           d.tagline,
      descripcionFooter: d.descripcionFooter,
      whatsapp:          d.whatsapp,
      instagram:         d.instagram,
      emailRemitente:    d.emailRemitente,
      emailReplyTo:      d.emailReplyTo || null,
      adminEmail:        d.adminEmail || null,
      bancoNombre:       d.bancoNombre || null,
      bancoTipoCuenta:   d.bancoTipoCuenta || null,
      bancoNumeroCuenta: d.bancoNumeroCuenta || null,
      bancoTitular:      d.bancoTitular || null,
      pagoNequiActivo:         d.pagoNequiActivo,
      pagoDaviplataActivo:     d.pagoDaviplataActivo,
      pagoTransferenciaActivo: d.pagoTransferenciaActivo,
      pagoEfectivoActivo:      d.pagoEfectivoActivo,
      pagoMovilNumero:         d.pagoMovilNumero || null,
    },
  });
  return NextResponse.json({ ok: true });
}
