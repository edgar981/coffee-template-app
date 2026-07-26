import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@/lib/whatsapp-link';

// Proactive duplicate detection for the admin "Nueva Orden" modal: given a phone
// and/or email, return the existing customer that the order upsert WOULD match,
// so the operator can adopt it instead of creating a duplicate. Read-only, never
// creates anything. Same matching rule as createOrderWithCustomer: email first,
// else normalized phone.

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
  if (!parsed.success) return NextResponse.json({ customer: null });

  const email    = parsed.data.email || null;
  const telefono = normalizeCustomerPhone(parsed.data.telefono);
  if (!email && !telefono) return NextResponse.json({ customer: null });

  // Email wins (unique), else normalized phone (findFirst — phone isn't unique;
  // shared phones are legal, so we surface the first/most relevant match).
  const customer = email
    ? await prisma.customer.findUnique({ where: { email }, select: { id: true, nombre: true } })
    : await prisma.customer.findFirst({ where: { telefono: telefono! }, select: { id: true, nombre: true } });

  if (!customer) return NextResponse.json({ customer: null });

  // Order count via the FK — the exact link, format-proof.
  const ordenes = await prisma.order.count({ where: { cliente_id: customer.id } });
  return NextResponse.json({ customer: { id: customer.id, nombre: customer.nombre, ordenes } });
}
