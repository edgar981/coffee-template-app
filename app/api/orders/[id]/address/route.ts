import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { deliveryAddressSchema } from '@/lib/validation/address';
import { BUSINESS_TZ } from '@/lib/timezone';

// Agregar/actualizar la dirección de entrega DE una orden. The address lives on
// the ORDER (direccion_entrega/ciudad_entrega/direccion_detalle + cliente_telefono)
// — never on the Shipping record, which reads it through the relation. Validated
// to the SAME standard as guest checkout (shared lib/validation/address), so no
// second definition of a valid address. Records a manual-edit note on the order
// for simple traceability.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => null);

  const parsed = deliveryAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const order = await prisma.order.findUnique({
    where:  { id },
    select: { id: true, notas_internas: true },
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  const stamp = new Intl.DateTimeFormat('es-CO', {
    timeZone: BUSINESS_TZ, dateStyle: 'short', timeStyle: 'short',
  }).format(new Date());
  const quien = session.user.name ?? session.user.email ?? 'admin';
  const auditLine = `[${stamp}] Dirección de entrega agregada manualmente por ${quien}.`;
  const notas_internas = order.notas_internas ? `${order.notas_internas}\n${auditLine}` : auditLine;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      direccion_entrega: data.direccion,
      ciudad_entrega:    data.ciudad,
      direccion_detalle: data.direccion_detalle ?? null,
      cliente_telefono:  data.telefono,
      notas_internas,
      updatedAt:         new Date(),
    },
    select: {
      id: true, numero_orden: true,
      direccion_entrega: true, ciudad_entrega: true, direccion_detalle: true,
      cliente_telefono: true, notas_internas: true,
    },
  });

  return NextResponse.json(updated);
}
