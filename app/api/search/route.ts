import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { SEARCH_MIN_CHARS, SEARCH_GROUP_LIMIT } from '@/types/search';
import type { AdminSearchResults } from '@/types/search';

// Global admin search. Sensitive (exposes customer PII), so it re-checks session
// + panel role like every other /api/* handler. `q` is validated/sanitized with
// zod; the three entity groups are queried IN PARALLEL and capped server-side.
const querySchema = z.object({
  q: z.string().trim().min(SEARCH_MIN_CHARS).max(100),
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // A too-short/absent query isn't an error — it just has no server matches. The
  // client already gates on SEARCH_MIN_CHARS; this keeps the contract total.
  const parsed = querySchema.safeParse({ q: req.nextUrl.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    const empty: AdminSearchResults = { ordenes: [], clientes: [], productos: [] };
    return NextResponse.json(empty);
  }
  const q = parsed.data.q;
  const contains = { contains: q, mode: 'insensitive' as const };

  const [ordenes, clientes, productos] = await Promise.all([
    prisma.order.findMany({
      where:   { OR: [{ numero_orden: contains }, { cliente_nombre: contains }] },
      select:  { id: true, numero_orden: true, cliente_nombre: true, estado: true, total: true },
      orderBy: { createdAt: 'desc' },
      take:    SEARCH_GROUP_LIMIT,
    }),
    prisma.customer.findMany({
      where:   { OR: [{ nombre: contains }, { email: contains }, { telefono: contains }] },
      select:  { id: true, nombre: true, email: true, telefono: true },
      orderBy: { updatedAt: 'desc' },
      take:    SEARCH_GROUP_LIMIT,
    }),
    prisma.product.findMany({
      where:   { nombre: contains },
      select:  { id: true, nombre: true, categoria: true },
      orderBy: { nombre: 'asc' },
      take:    SEARCH_GROUP_LIMIT,
    }),
  ]);

  const results: AdminSearchResults = { ordenes, clientes, productos };
  return NextResponse.json(results);
}
