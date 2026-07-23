import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { fireOrderTrigger } from '@/lib/automations/triggers';
import { createOrderWithCustomer, normalizeCustomerPhone, OrderCustomerIdentityError } from '@/lib/orders';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const orders = await prisma.order.findMany({
    // shipping drives the "Programar entrega" edit flow and fulfillment display.
    include:  { items: true, shipping: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

// Admin manual order. Unlike checkout, customer identity is flexible: email is
// OPTIONAL, but AT LEAST ONE of email or a valid Colombian mobile is required —
// validated here (server-side), not just in the modal. Totals are trusted as
// entered (manual bookkeeping); the storefront checkout is the path that
// recomputes prices from Product records.
const adminOrderSchema = z
  .object({
    cliente_nombre:    z.string().trim().min(1, 'El nombre del cliente es requerido'),
    cliente_email:     z.preprocess(
      (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
      z.string().email('Correo inválido').optional(),
    ),
    cliente_telefono:  z.string().trim().optional(),
    canal:             z.string().trim().optional(),
    estado:            z.enum(['pendiente', 'pagado', 'cancelado']).optional(),
    metodo_pago:       z.string().trim().optional(),
    total:             z.coerce.number().nonnegative().optional(),
    costo_envio:       z.coerce.number().nonnegative().optional(),
    direccion_entrega: z.string().trim().optional(),
    ciudad_entrega:    z.string().trim().optional(),
    notas_internas:    z.string().trim().optional(),
    notas_entrega:     z.string().trim().optional(),
    items: z
      .array(z.object({
        producto_nombre: z.string().trim().min(1),
        cantidad:        z.number().int().positive(),
        subtotal:        z.number(),
      }))
      .optional()
      .default([]),
  })
  // At least one usable identity — a non-empty but unparseable phone with no
  // email is rejected (the phone would otherwise silently drop).
  .refine(
    (d) => Boolean(d.cliente_email) || Boolean(normalizeCustomerPhone(d.cliente_telefono)),
    { message: 'Ingresa un correo válido o un teléfono (celular colombiano)', path: ['cliente_telefono'] },
  );

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 }); }

  const parsed = adminOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  try {
    // Same creation path as checkout → the order always gets a Customer. A
    // `pagado` order auto-creates its Shipping inside the shared transaction.
    const result = await createOrderWithCustomer({
      customer:          { nombre: b.cliente_nombre, email: b.cliente_email ?? null, telefono: b.cliente_telefono ?? null },
      canal:             b.canal || 'whatsapp',
      estado:            b.estado || undefined,
      metodo_pago:       b.metodo_pago || null,
      total:             b.total ?? 0,
      costo_envio:       b.costo_envio ?? 0,
      direccion_entrega: b.direccion_entrega || null,
      ciudad_entrega:    b.ciudad_entrega || null,
      notas_internas:    b.notas_internas || null,
      notas_entrega:     b.notas_entrega || null,
      items:             b.items,
      numeroPrefix:      'SN',
    });

    fireOrderTrigger('nueva_orden', result as never).catch(console.error);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OrderCustomerIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Admin order creation failed:', error);
    return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
  }
}