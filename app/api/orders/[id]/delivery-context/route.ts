import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';

// Everything the "Programar entrega" modal needs about an order's delivery:
// contact (name/email/phone), the address (read from the ORDER, the single
// source of truth), and the linked Customer if one exists. Fetched fresh when
// the modal opens, so it stays caller-agnostic (Entregas and Ordenes both use it)
// and always reflects the latest address.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      numero_orden: true, cliente_nombre: true, cliente_email: true, cliente_telefono: true,
      cliente_id: true,
      direccion_entrega: true, ciudad_entrega: true, direccion_detalle: true,
    },
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  // El cliente se resuelve por la FK `cliente_id`, IGUAL que el detalle de la
  // orden — así el enlace del drawer aparece en los MISMOS casos que allá. El
  // comentario viejo decía "no hay FK": es falso desde que existe `Order.cliente`,
  // y resolver por correo dejaba SIN enlace a las órdenes por teléfono (sin
  // correo) que sí tienen cliente vinculado — el defecto que esto cierra. Sólo si
  // no hay FK (órdenes previas a la relación) se cae al lookup por correo.
  const customer = order.cliente_id
    ? await prisma.customer.findUnique({
        where:  { id: order.cliente_id },
        select: { id: true, nombre: true, telefono: true },
      })
    : order.cliente_email
      ? await prisma.customer.findUnique({
          where:  { email: order.cliente_email },
          select: { id: true, nombre: true, telefono: true },
        })
      : null;

  // Phone priority: order snapshot first, then the Customer record.
  const telefono = order.cliente_telefono ?? customer?.telefono ?? null;

  // ÚLTIMO MENSAJERO USADO — default inteligente del campo, no configuración.
  // La fuente es el último Shipping que tenga uno: cero columnas nuevas, cero
  // tablas de preferencias, y el dato se mantiene solo porque ES el historial de
  // despachos. Una tienda usa uno o dos mensajeros durante meses; teclear el
  // mismo nombre en cada entrega es una decisión que el admin no debería pedir.
  //
  // Es una SUGERENCIA, no una decisión: el modal la usa solo para pre-llenar un
  // campo vacío y lo que se guarda es siempre lo que quedó en el input. Por eso
  // no viaja al server como dato propio ni se persiste en ningún lado.
  //
  // Se resuelve ACÁ y no en el cliente porque el modal se abre desde Órdenes y
  // desde Entregas, y solo una de las dos tiene la lista de envíos cargada. En el
  // server las dos entradas ven exactamente lo mismo, con la fetch que el modal ya
  // hacía — sin endpoint nuevo.
  const ultimo = await prisma.shipping.findFirst({
    where:   { mensajero: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select:  { mensajero: true },
  });
  // `not: null` no descarta la cadena vacía ni los espacios; el trim lo hace.
  const ultimoMensajero = ultimo?.mensajero?.trim() || null;

  return NextResponse.json({
    numero_orden:      order.numero_orden,
    cliente_nombre:    order.cliente_nombre,
    cliente_email:     order.cliente_email,
    telefono,
    direccion_entrega: order.direccion_entrega,
    ciudad_entrega:    order.ciudad_entrega,
    direccion_detalle: order.direccion_detalle,
    customer:          customer ? { id: customer.id, nombre: customer.nombre } : null,
    ultimoMensajero,
  });
}
