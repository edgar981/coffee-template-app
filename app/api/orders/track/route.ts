import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

// Public, UNAUTHENTICATED order-tracking lookup.
//
// Order numbers are enumerable, so this endpoint deliberately requires BOTH the
// order number AND the customer email, and returns a heavily trimmed payload —
// never the phone number or the full street address. Any failure (missing
// field, unknown order, or email mismatch) returns the same generic 404 so a
// caller can't tell which field was wrong (no enumeration oracle).

export const dynamic = 'force-dynamic';

const trackSchema = z.object({
  numero: z.string().trim().min(1),
  email:  z.string().trim().email(),
});

const NOT_FOUND = NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  // Rate-limit by IP to blunt enumeration of the order-number space.
  const rl = rateLimit(`track:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NOT_FOUND;
  }

  const parsed = trackSchema.safeParse(raw);
  // Missing/invalid order number or email → indistinguishable "not found".
  if (!parsed.success) return NOT_FOUND;

  const { numero, email } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { numero_orden: numero },
    select: {
      numero_orden:   true,
      estado:         true,
      createdAt:      true,
      total:          true,
      costo_envio:    true,
      ciudad_entrega: true,
      cliente_email:  true,
      items: {
        select: { producto_nombre: true, cantidad: true, subtotal: true },
      },
    },
  });

  // Unknown order OR email mismatch → same generic response. Normalize both
  // sides (trim + lowercase) so a customer who checked out with "Juan@Gmail.com"
  // can track with "juan@gmail.com". The stored email is written as-typed at
  // checkout, so the comparison must do the normalizing. Missing stored email
  // is treated as a non-match.
  if (
    !order ||
    !order.cliente_email ||
    order.cliente_email.trim().toLowerCase() !== email.trim().toLowerCase()
  ) {
    return NOT_FOUND;
  }

  // Subtotal isn't stored on the order; derive it from the line items so we
  // never have to expose internal cost fields.
  const subtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);

  // Whitelist the response: order number, status, date, line items, money
  // breakdown and destination city ONLY. No phone, no street address.
  return NextResponse.json({
    numero_orden:   order.numero_orden,
    estado:         order.estado,
    createdAt:      order.createdAt,
    ciudad_entrega: order.ciudad_entrega,
    subtotal,
    costo_envio:    order.costo_envio,
    total:          order.total,
    items: order.items.map((i) => ({
      producto_nombre: i.producto_nombre,
      cantidad:        i.cantidad,
      subtotal:        i.subtotal,
    })),
  });
}
