// prisma/seed.ts
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { auth } from "@/lib/auth";
import { MOCK_CUSTOMERS } from "@/lib/mock/customers";
import { DEMO_PRODUCTS } from "@/prisma/seed-products";
import { mockLogs } from "@/lib/mock/inventoryLogs";
import { SHIPPING_SEED_TEMPLATES } from "@/lib/mock/shippings";
import { AUTOMATION_TEMPLATES } from "@/lib/mock/automations";

// ── Demo order fixtures dated RELATIVE to `now` ───────────────────────────────
// The Dashboard trend pills compare the CURRENT calendar month vs the PREVIOUS
// complete month, gated by an anti-noise floor (≥5 orders in the previous month;
// see lib/metrics/trend.ts). Hardcoded month dates broke as real time advanced
// (the curated June data drifted out of the trend window). Generating dates
// relative to `now` keeps a healthy previous + current month whenever the demo is
// (re)seeded: 6 paid orders last month (clears the floor) and 8 this month up to
// today (shows growth). Prices come from the real catalog so totals are authentic;
// items are real product lines; SN- marks demo fixtures (real orders use CN-).
type DemoLine = { slug: string; cantidad: number };
// Real seeded products (DB-generated ids — NOT the mock ids in DEMO_PRODUCTS), so
// OrderItem.producto_id satisfies its FK to Product.
type SeedProduct = { id: string; slug: string; nombre: string; precio: number; moliendasOpciones: unknown };
function buildDemoOrders(now: Date, products: SeedProduct[]) {
  const P = Object.fromEntries(products.map((p) => [p.slug, p]));
  const molienda = (slug: string) => {
    const ops = (P[slug].moliendasOpciones ?? []) as { nombre: string; disponible: boolean }[];
    return (Array.isArray(ops) ? ops.find((o) => o.disponible)?.nombre : null) ?? null;
  };
  // `day` of the month `monthsAgo` back, at local midday (Bogotá ≈ UTC-5).
  const at = (monthsAgo: number, day: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day, 17, 0, 0));

  const NOMBRES = ['Valentina Torres', 'Andrés Castro', 'Laura Jiménez', 'Juan Camilo Ríos', 'Sofía Mendoza', 'Diego Hernández', 'Camila Vargas', 'Carlos Mora', 'Mariana López', 'Ricardo Peña', 'Paula Gómez', 'Felipe Ramírez', 'Daniela Ospina', 'Sebastián Ruiz', 'Isabela Cardona', 'Tomás Restrepo', 'Lucía Herrera', 'Mateo Vargas'];
  const TELS = ['+573001112233', '+573012223344', '+573023334455', '+573104445566', '+573115556677', '+573126667788', '+573207778899', '+573218889900', '+573159990011', '+573001234567'];
  const CANALES = ['whatsapp', 'directo', 'instagram', 'whatsapp', 'directo', 'referido'];
  const METODOS = ['nequi', 'transferencia', 'daviplata', 'efectivo'];

  let n = 0;
  const mk = (monthsAgo: number, day: number, lines: DemoLine[], estado = 'pagado') => {
    n++;
    const items = lines.map((l) => {
      const p = P[l.slug];
      return {
        producto_id: p.id, producto_nombre: p.nombre, moliendaSeleccionada: molienda(l.slug),
        cantidad: l.cantidad, precio_unitario: p.precio, subtotal: p.precio * l.cantidad,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const costo_envio = subtotal >= 120000 ? 0 : 8000; // envío gratis en pedidos grandes
    return {
      numero_orden: `SN-D${String(n).padStart(3, '0')}`,
      cliente_nombre: NOMBRES[(n - 1) % NOMBRES.length],
      cliente_telefono: TELS[(n - 1) % TELS.length],
      canal: CANALES[n % CANALES.length],
      estado,
      metodo_pago: estado === 'pagado' ? METODOS[n % METODOS.length] : null,
      costo_envio,
      total: subtotal + costo_envio,
      createdAt: at(monthsAgo, day),
      items,
    };
  };

  // Current-month order days spread across the elapsed part of THIS month only
  // (never in the future).
  const today = now.getUTCDate();
  const curDay = (f: number) => Math.max(1, Math.min(today, Math.round(today * f)));

  return [
    // 2 months ago — depth for the monthly sales chart
    mk(2, 5,  [{ slug: 'cafe-nayoli-grano-250g', cantidad: 1 }]),
    mk(2, 12, [{ slug: 'cafe-nayoli-molido-500g', cantidad: 1 }]),
    mk(2, 19, [{ slug: 'cafe-nayoli-molido-250g', cantidad: 2 }]),
    mk(2, 26, [{ slug: 'cafe-nayoli-grano-500g', cantidad: 1 }, { slug: 'cafe-nayoli-molido-250g', cantidad: 1 }]),
    // Previous complete month — 6 paid → clears the ≥5 anti-noise floor
    mk(1, 4,  [{ slug: 'cafe-nayoli-grano-500g', cantidad: 1 }, { slug: 'cafe-nayoli-molido-250g', cantidad: 1 }]),
    mk(1, 9,  [{ slug: 'cafe-nayoli-molido-500g', cantidad: 2 }]),
    mk(1, 15, [{ slug: 'cafe-nayoli-grano-250g', cantidad: 2 }]),
    mk(1, 20, [{ slug: 'cafe-nayoli-molido-250g', cantidad: 1 }]),
    mk(1, 24, [{ slug: 'cafe-nayoli-grano-500g', cantidad: 1 }]),
    mk(1, 28, [{ slug: 'cafe-nayoli-molido-500g', cantidad: 1 }, { slug: 'cafe-nayoli-grano-250g', cantidad: 1 }]),
    // Current month (up to today) — 8 orders (7 paid + 1 pending) → growth
    mk(0, curDay(0.12), [{ slug: 'cafe-nayoli-molido-500g', cantidad: 1 }, { slug: 'cafe-nayoli-molido-250g', cantidad: 1 }]),
    mk(0, curDay(0.25), [{ slug: 'cafe-nayoli-grano-500g', cantidad: 2 }]),
    mk(0, curDay(0.38), [{ slug: 'cafe-nayoli-grano-250g', cantidad: 1 }]),
    mk(0, curDay(0.50), [{ slug: 'cafe-nayoli-molido-250g', cantidad: 2 }]),
    mk(0, curDay(0.62), [{ slug: 'cafe-nayoli-molido-500g', cantidad: 1 }]),
    mk(0, curDay(0.75), [{ slug: 'cafe-nayoli-grano-500g', cantidad: 1 }, { slug: 'cafe-nayoli-molido-250g', cantidad: 1 }]),
    mk(0, curDay(0.85), [{ slug: 'cafe-nayoli-molido-250g', cantidad: 1 }, { slug: 'cafe-nayoli-grano-250g', cantidad: 1 }]),
    mk(0, curDay(0.95), [{ slug: 'cafe-nayoli-molido-500g', cantidad: 2 }], 'pendiente'),
  ];
}

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

  const seedProducts = await prisma.product.findMany({
    select: { id: true, slug: true, nombre: true, precio: true, moliendasOpciones: true },
  });
  for (const o of buildDemoOrders(new Date(), seedProducts)) {
    await prisma.order.upsert({
      where:  { numero_orden: o.numero_orden },
      update: {},
      create: {
        numero_orden:     o.numero_orden,
        cliente_nombre:   o.cliente_nombre,
        cliente_telefono: o.cliente_telefono,
        canal:            o.canal,
        estado:           o.estado,
        metodo_pago:      o.metodo_pago,
        total:            o.total,
        costo_envio:      o.costo_envio,
        // Backdated createdAt (only on create — `update: {}` never rewrites an
        // existing row's date). A clean re-seed needs the old rows deleted first
        // so these relative dates apply (see DEPLOY.md).
        createdAt:        o.createdAt,
        items: {
          create: o.items.map(item => ({
            producto_id:          item.producto_id,
            producto_nombre:      item.producto_nombre,
            moliendaSeleccionada: item.moliendaSeleccionada,
            cantidad:             item.cantidad,
            precio_unitario:      item.precio_unitario,
            subtotal:             item.subtotal,
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