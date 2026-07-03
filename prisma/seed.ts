// prisma/seed.ts
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { MOCK_CUSTOMERS } from "@/lib/mock/customers";
import { DEMO_PRODUCTS } from "@/lib/mock/products";
import { MOCK_ADMIN_ORDERS } from "@/lib/mock/orders";
import { mockLogs } from "@/lib/mock/inventoryLogs";
import { mockPayments } from "@/lib/mock/payments";
import { MOCK_SHIPPINGS } from "@/lib/mock/shippings";
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
    await prisma.product.upsert({
      where:  { slug: p.slug },
      update: {},
      create: {
        nombre:      p.nombre,
        slug:        p.slug,
        descripcion: p.descripcion  || '',
        categoria:   p.categoria,
        precio:      p.precio,
        costo:       p.costo,
        sku:         p.sku          || null,
        stock:       p.stock,
        stock_minimo: p.stock_minimo ?? 5,
        activo:      p.activo       ?? true,
        peso_gramos: p.peso_gramos  ?? null,
        variante:    p.variante     ?? null,
        origen:      p.origen       ?? null,
        tostado:     p.tostado      ?? null,
        imagen:      p.imagen       || '',
        imagenes:    p.imagenes     || [],
        bestseller:  p.bestseller   ?? false,
        badge:       p.badge        ?? null,
        agotado:     p.agotado      ?? false,
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

  for (const p of mockPayments) {
    await prisma.payment.create({
      data: {
        cliente_nombre: p.cliente_nombre ?? null,
        monto:          p.monto,
        metodo:         p.metodo,
        estado:         p.estado,
        referencia:     p.referencia     ?? null,
        notas:          p.notas          ?? null,
        fecha_pago:     p.fecha_pago     ?? null,
        createdAt:      new Date(p.createdAt),
      },
    });
  }

  console.log('✅ Payments seeded');

  for (const s of MOCK_SHIPPINGS) {
    await prisma.shipping.create({
      data: {
        orden_id:        s.orden_id        ?? null,
        numero_orden:    s.numero_orden    ?? null,
        cliente_nombre:  s.cliente_nombre  ?? null,
        direccion:       s.direccion,
        ciudad:          s.ciudad          ?? 'Bogotá',
        zona:            s.zona            ?? 'centro',
        estado:          s.estado,
        costo_envio:     s.costo_envio     ?? 8000,
        mensajero:       s.mensajero       ?? null,
        notas_entrega:   s.notas_entrega   ?? null,
        fecha_programada: s.fecha_programada ?? null,
        fecha_entrega:   s.fecha_entrega   ?? null,
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