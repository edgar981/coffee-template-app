import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@duna/core/whatsapp-link';
import { nonCancelledOrderCountByCustomer, paidTotalByCustomer, lastOrderDateByCustomer } from '@duna/core/metrics/customer-order-stats';
import { pedidosPorAtenderPorCliente } from '@/lib/clientes/atencion';
import type { OrderStatus } from '@/types/order';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const [customers, ordenesById, pagadoById, ultimaById, ordenesParaAtencion] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      // Referential order count = raw FK references (Order.cliente_id), NO filter —
      // the SAME thing the delete guard counts, so the row's delete affordance can
      // match it exactly (no deletable row that still 409s). Distinct from the
      // DISPLAYED count below, which excludes cancelled.
      include: { _count: { select: { orders: true } } },
    }),
    nonCancelledOrderCountByCustomer(),
    paidTotalByCustomer(),
    lastOrderDateByCustomer(),
    // ── LO QUE LA REGLA DE ATENCIÓN NECESITA MIRAR, Y NADA MÁS ───────────────
    //
    // Es una consulta NUEVA: este endpoint no cargaba ni una orden. Se carga
    // porque angostar la regla para que quepa en los datos que ya había sería
    // inventar un criterio distinto del de Pedidos, y dos criterios para el mismo
    // sol es lo que hace que el punto lleve a una lista donde no hay nada marcado.
    //
    // El costo: un `findMany` con `select` angosto sobre las órdenes vivas — sin
    // items, sin cliente, sin totales. Es la MISMA forma de consulta que ya corre
    // `/api/atencion`, que además se poletea cada 60 s desde cualquier
    // pantalla del panel; ésta corre una vez por carga de Clientes.
    //
    // Los dos filtros del `where` son ATAJOS QUE NO PUEDEN MENTIR, no una
    // traducción de la regla a SQL: para una orden cancelada `necesitaAtencion` ya
    // devuelve lista vacía, y una sin `cliente_id` no se le atribuye a nadie. Si
    // este `where` desapareciera el resultado sería idéntico, sólo más lento.
    prisma.order.findMany({
      where:  { estado: { not: 'cancelado' }, cliente_id: { not: null } },
      select: {
        cliente_id:     true,
        estado:         true,
        condicion_pago: true,
        shipping:     { select: { estado: true, mensajero: true, fecha_programada: true } },
        comprobantes: { select: { estado: true } },
      },
    }),
  ]);

  // El cast vive en la FRONTERA, no dentro de la regla: `Order.estado` es una
  // columna String (cada eje tiene su vocabulario) y `OrderStatus` es la lectura
  // que hace la app. Igual que en `/api/atencion`.
  const atencionById = pedidosPorAtenderPorCliente(
    ordenesParaAtencion.map(o => ({ ...o, estado: o.estado as OrderStatus })),
  );

  const withStats = customers.map(({ _count, ...c }) => ({
    ...c,
    // `ordenes` (visible "N órdenes") = LIVE non-cancelled count — a pending order
    // IS an order. The client reads THIS, not the spread-through `numero_ordenes`
    // (seed-only, never incremented at order creation → 0 for runtime customers).
    ordenes:       ordenesById.get(c.id) ?? 0,
    // `$` = real money paid (sum of Payments); overrides the demo `total_compras`.
    total_compras: pagadoById.get(c.id) ?? 0,
    // Referential (delete affordance + 409 guard) — includes cancelled.
    ordenesRef:    _count.orders,
    // Cuántos de sus pedidos piden acción HOY. Enciende el sol de la fila, y el
    // número es lo que permite que el punto lleve a esos pedidos en vez de ser
    // mudo. 0 (no `undefined`) cuando no hay ninguno: el mapa es disperso porque
    // sólo ve órdenes, pero acá sí se conoce al cliente y "ninguno" es un hecho.
    pedidosPorAtender: atencionById.get(c.id) ?? 0,
    // Recencia, para decirla como TEXTO en la fila ("hace 3 días"). `null` cuando
    // el cliente no tiene ninguna orden viva — y ese null es la respuesta, no un
    // hueco: quien nunca compró no tiene última compra, y la pantalla no debe
    // inventarle una fecha ni caerse a `createdAt` del cliente (que responde otra
    // pregunta: cuándo lo registramos).
    ultimaOrden: ultimaById.get(c.id)?.toISOString() ?? null,
  }));

  return NextResponse.json(withStats);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();

  const customer = await prisma.customer.create({
    data: {
      nombre:    body.nombre,
      email:     body.email     || null,
      // Canonicalize on write (same normalizer as order matching) so a manually
      // added customer is found by the order upsert instead of duplicated. Falls
      // back to the raw input when it isn't a Colombian mobile (keep what they typed).
      telefono:  normalizeCustomerPhone(body.telefono) ?? (body.telefono || null),
      ciudad:    body.ciudad    || null,
      direccion: body.direccion || null,
      canal:     body.canal     || 'directo',
      notas:     body.notas     || null,
      activo:    body.activo    ?? true,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}