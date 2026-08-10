import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@duna/core/whatsapp-link';
import { rankPhoneMatches } from '@duna/core/orders';

const MATCH_CAP = 5;

// Proactive duplicate detection for the admin "Nueva Orden" modal: given a phone
// and/or email, return the existing customers an order WOULD match — a phone can
// be shared, so this is an ARRAY (capped, most-orders-first, the same order the
// server's silent auto-attach uses). Read-only; never creates anything.

const querySchema = z.object({
  telefono: z.string().trim().optional(),
  email:    z.string().trim().email().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const parsed = querySchema.safeParse({
    telefono: req.nextUrl.searchParams.get('telefono') ?? undefined,
    email:    req.nextUrl.searchParams.get('email') ?? undefined,
  });
  // An unparseable email just means "no match to offer" — not an error the modal
  // should surface. Return empty rather than 400 so the banner simply stays hidden.
  if (!parsed.success) return NextResponse.json({ customers: [] });

  const email    = parsed.data.email || null;
  const telefono = normalizeCustomerPhone(parsed.data.telefono);
  if (!email && !telefono) return NextResponse.json({ customers: [] });

  // Email wins (unique) → at most one. Else the deterministic phone ranking
  // (shared here with the server's auto-attach), capped.
  if (email) {
    const c = await prisma.customer.findUnique({ where: { email }, select: { id: true, nombre: true, email: true, telefono: true } });
    if (!c) return NextResponse.json({ customers: [] });
    const ordenes = await prisma.order.count({ where: { cliente_id: c.id } });
    return NextResponse.json({ customers: [{ id: c.id, nombre: c.nombre, ordenes, telefono: c.telefono, email: c.email }] });
  }

  const ranked = await rankPhoneMatches(prisma, telefono!);
  return NextResponse.json({ customers: ranked.slice(0, MATCH_CAP) });
}
