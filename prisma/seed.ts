// prisma/seed.ts
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { auth } from "@/lib/auth";
import { MOCK_CUSTOMERS } from "@/lib/mock/customers";
import { DEMO_PRODUCTS } from "@/prisma/seed-products";
import { MOCK_ADMIN_ORDERS } from "@/lib/mock/orders";
import { mockLogs } from "@/lib/mock/inventoryLogs";
import { SHIPPING_SEED_TEMPLATES } from "@/lib/mock/shippings";
import { AUTOMATION_TEMPLATES } from "@/lib/mock/automations";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@sierranativa.co";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.ADMIN_NAME ?? "Administrador";

  // Create (or reuse) user
  try {
    await auth.api.signUpEmail({
      body: { email, password, name, },
    });
    console.log("✅ Admin created");
  } catch {
    console.log("ℹ️ Admin already exists");
  }

  await prisma.user.update({
    where: { email},
    data: { role: "OWNER", },
  });

  console.log(
    "✅ OWNER role assigned"
  );


  for (const c of MOCK_CUSTOMERS) {
    await prisma.customer.upsert({
      where:  { email: c.email ?? `no-email-${c.id}@placeholder.co` },
      update: {},
      create: {
        nombre:         c.nombre,
        email:          c.email          || null,
        telefono:       c.telefono       || null,
        ciudad:         c.ciudad         || null,
        direccion:      c.direccion      || null,
        canal:          c.canal          || 'directo',
        notas:          c.notas          || null,
        activo:         c.activo         ?? true,
        numero_ordenes: c.numero_ordenes ?? 0,
        total_compras:  c.total_compras  ?? 0,
      },
    });
  }

  for (const p of DEMO_PRODUCTS) {
    // Ficha técnica + copy: se actualizan también en filas existentes para que
    // un re-seed propague el contenido real del empaque. Lo operativo (stock,
    // precios, activo) solo se define al crear — nunca se pisa.
    const contenido = {
      descripcion:      p.descripcion      || '',
      descripcionCorta: p.descripcionCorta ?? null,
      origen:           p.origen           ?? null,
      tostado:          p.tostado          ?? null,
      variedad:         p.variedad         ?? null,
      proceso:          p.proceso          ?? null,
      altitudMin:       p.altitudMin       ?? null,
      altitudMax:       p.altitudMax       ?? null,
      molienda:         p.molienda         ?? null,
      // Json de opciones de molienda (nombre/método/disponible) — el admin
      // activa moliendas cambiando `disponible`.
      moliendasOpciones: (p.moliendasOpciones ?? []) as unknown as Prisma.InputJsonValue,
      notasCata:        p.notasCata        ?? [],
      notas:            p.notas            ?? [],
    };
    await prisma.product.upsert({
      where:  { slug: p.slug },
      update: contenido,
      create: {
        nombre:      p.nombre,
        slug:        p.slug,
        categoria:   p.categoria,
        precio:      p.precio,
        costo:       p.costo,
        sku:         p.sku          || null,
        stock:       p.stock,
        stock_minimo: p.stock_minimo ?? 5,
        activo:      p.activo       ?? true,
        peso_gramos: p.peso_gramos  ?? null,
        variante:    p.variante     ?? null,
        imagen:      p.imagen       || '',
        imagenes:    p.imagenes     || [],
        bestseller:  p.bestseller   ?? false,
        badge:       p.badge        ?? null,
        agotado:     p.agotado      ?? false,
        ...contenido,
      },
    });
  }

  console.log('✅ Products seeded');

  for (const o of MOCK_ADMIN_ORDERS) {
    await prisma.order.upsert({
      where:  { numero_orden: o.numero_orden },
      update: {},
      create: {
        numero_orden:      o.numero_orden,
        cliente_nombre:    o.cliente_nombre    ?? null,
        cliente_telefono:  o.cliente_telefono  ?? null,
        canal:             o.canal             ?? 'directo',
        estado:            o.estado,
        metodo_pago:       o.metodo_pago       ?? null,
        total:             o.total,
        costo_envio:       o.costo_envio       ?? 0,
        direccion_entrega: o.direccion_entrega ?? null,
        ciudad_entrega:    o.ciudad_entrega    ?? null,
        notas_internas:    o.notas_internas    ?? null,
        notas_entrega:     o.notas_entrega     ?? null,
        // Persist the mock's backdated createdAt (only on create — existing rows
        // use `update: {}`, so this never rewrites already-seeded dates). Lets the
        // demo carry orders dated to prior months for the dashboard trends.
        ...(o.createdAt ? { createdAt: new Date(o.createdAt) } : {}),
        items: {
          create: (o.items ?? []).map(item => ({
            producto_nombre: item.producto_nombre,
            cantidad:        item.cantidad,
            subtotal:        item.subtotal,
          })),
        },
      },
    });
  }

  console.log('✅ Orders seeded');

  for (const l of mockLogs) {
    await prisma.inventoryLog.create({
      data: {
        producto_id:     l.producto_id,
        producto_nombre: l.producto_nombre,
        tipo:            l.tipo,
        cantidad:        l.cantidad,
        stock_anterior:  l.stock_anterior,
        stock_nuevo:     l.stock_nuevo,
        motivo:          l.motivo ?? null,
        createdAt:       new Date(l.createdAt),
      },
    });
  }

  console.log('✅ Inventory logs seeded');

  // A Payment is an event OF an order: seed one per already-`pagado` order,
  // mirroring the real flow (a paid order has a registered payment). monto is
  // snapshotted from the order total; método rotates. Idempotent per order.
  const ordersForPayment = await prisma.order.findMany({ where: { estado: 'pagado' } });
  const METODOS_SEED = ['NEQUI', 'DAVIPLATA', 'EFECTIVO', 'TRANSFERENCIA'] as const;
  let pmi = 0;
  for (const order of ordersForPayment) {
    const already = await prisma.payment.count({ where: { orden_id: order.id } });
    if (already > 0) continue;
    await prisma.payment.create({
      data: {
        orden_id:              order.id,
        monto:                 order.total,
        metodo:                METODOS_SEED[pmi % METODOS_SEED.length],
        registrado_por_nombre: 'Seed',
        fecha:                 order.createdAt,
        createdAt:             order.createdAt,
      },
    });
    pmi++;
  }

  console.log('✅ Payments seeded');

  // One Shipping per paid order (1:1). Number/customer/address are read via the
  // relation; only costo_envio is snapshotted. Operator fields come from the
  // templates. Idempotent — the unique orden_id skips already-seeded orders.
  const paidOrders = await prisma.order.findMany({ where: { estado: 'pagado' } });
  let ti = 0;
  for (const order of paidOrders) {
    const already = await prisma.shipping.count({ where: { orden_id: order.id } });
    if (already > 0) continue;
    const t = SHIPPING_SEED_TEMPLATES[ti % SHIPPING_SEED_TEMPLATES.length];
    ti++;
    await prisma.shipping.create({
      data: {
        orden_id:         order.id,
        zona:             t.zona,
        estado:           t.estado,
        costo_envio:      order.costo_envio,
        mensajero:        t.mensajero,
        notas_entrega:    t.notas_entrega,
        fecha_programada: t.fecha_programada,
        fecha_entrega:    t.fecha_entrega,
      },
    });
  }

  console.log('✅ Shippings seeded');

  for (const t of AUTOMATION_TEMPLATES) {
    await prisma.automation.upsert({
      where:  { tipo: t.tipo },
      update: {},
      create: {
        tipo:            t.tipo,
        nombre:          t.nombre,
        canal:           t.canal,
        activa:          false,
        veces_ejecutada: 0,
      },
    });
  }

  console.log('✅ Automations seeded');

}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });