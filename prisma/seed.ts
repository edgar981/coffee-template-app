// prisma/seed.ts
import prisma from "@duna/core";
import { Prisma } from "@duna/core";
import { auth } from "@/lib/auth";
import { MOCK_CUSTOMERS } from "@/lib/mock/customers";
import { DEMO_PRODUCTS } from "@/prisma/seed-products";
import { mockLogs } from "@/lib/mock/inventoryLogs";
import { SHIPPING_SEED_TEMPLATES } from "@/lib/mock/shippings";
import { BUSINESS_TZ, startOfZonedDay } from "@duna/core/timezone";
import { normalizeCustomerPhone } from "@duna/core/orders";

// ── Demo customer identities ─────────────────────────────────────────────────
// Demo orders MUST carry the identity of a real seeded Customer. They used to
// invent names and phone numbers, so no order resolved to anybody: the Clientes
// page showed 10 customers who had never ordered, and 97 orders belonging to
// nobody. Drawing from MOCK_CUSTOMERS (the same rows seeded below) makes the
// data internally consistent and lets Order.cliente_id backfill.
//
// The phone is stored NORMALIZED (+57XXXXXXXXXX) because that is what
// createOrderWithCustomer writes for real orders; MOCK_CUSTOMERS keeps display
// formatting ("+57 310 234 5678"). Matching depends on normalizing both sides.
//
// WhatsApp orders deliberately carry NO email — that is the real shape of a
// WhatsApp sale, and it exercises the phone branch of the identity rules
// (email first, else normalized phone) instead of letting email match everything.
function demoIdentity(index: number, canal: string) {
  const c = MOCK_CUSTOMERS[index % MOCK_CUSTOMERS.length];
  return {
    cliente_nombre:   c.nombre,
    cliente_email:    canal === 'whatsapp' ? null : (c.email || null),
    cliente_telefono: normalizeCustomerPhone(c.telefono),
  };
}

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
    const canal = CANALES[n % CANALES.length];
    return {
      numero_orden: `SN-D${String(n).padStart(3, '0')}`,
      ...demoIdentity(n - 1, canal),
      canal,
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

// ── CN- demo orders, DAILY across the last 90 days ───────────────────────────
// The dashboard chart module buckets by DAY and excludes `SN-` (grandfathered
// demo fixtures), so the monthly SN- set above cannot drive it — all three
// ranges would render empty. These are deliberately `CN-` (the real-order
// series) because "only CN- counts" is the rule the chart enforces.
//
// DELETE THIS BLOCK for a production seed; the SN- fixtures above are unaffected.
//
// Deliberate shape, so the chart is actually exercised:
//   · gaps on ~1 day in 3          → zero-fill is visible
//   · late-evening orders (21–22h) → Bogotá-vs-UTC day bucketing is provable
//   · all 4 payment methods        → Efectivo / Transferencia series both fill
//   · a few `pendiente` + 1 `cancelado` → the confirmed-only filter is exercised
const DAILY_DEMO_DAYS = 90;
const DEMO_METODOS = ['NEQUI', 'DAVIPLATA', 'EFECTIVO', 'TRANSFERENCIA'] as const;

function buildDailyDemoOrders(now: Date, products: SeedProduct[]) {
  const P = Object.fromEntries(products.map((p) => [p.slug, p]));
  const SLUGS = ['cafe-nayoli-grano-250g', 'cafe-nayoli-molido-250g', 'cafe-nayoli-grano-500g', 'cafe-nayoli-molido-500g'];
  const molienda = (slug: string) => {
    const ops = (P[slug].moliendasOpciones ?? []) as { nombre: string; disponible: boolean }[];
    return (Array.isArray(ops) ? ops.find((o) => o.disponible)?.nombre : null) ?? null;
  };

  // Deterministic PRNG (LCG) — a re-seed reproduces the SAME dataset, so the
  // upserts below stay idempotent and the demo numbers don't drift.
  let seed = 20260723;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];

  const CANALES = ['whatsapp', 'directo', 'instagram', 'referido'];
  // Late slots (21h, 22h) land in the NEXT UTC day — the case that proves day
  // bucketing runs in America/Bogota and not UTC.
  const HORAS = [9, 11, 14, 16, 18, 21, 22];

  const orders = [];
  let n = 0;

  for (let offset = DAILY_DEMO_DAYS - 1; offset >= 0; offset--) {
    // ~1 day in 3 has no orders at all. The last 6 days always do, so the
    // "Últimos 7 días" range is never near-empty.
    if (offset > 5 && rnd() < 0.34) continue;
    const perDay = rnd() < 0.25 ? 2 : 1;

    for (let k = 0; k < perDay; k++) {
      n++;
      const lines = Array.from({ length: rnd() < 0.3 ? 2 : 1 }, () => ({
        slug:     pick(SLUGS),
        cantidad: rnd() < 0.2 ? 2 : 1,
      }));
      const items = lines.map((l) => {
        const p = P[l.slug];
        return {
          producto_id: p.id, producto_nombre: p.nombre, moliendaSeleccionada: molienda(l.slug),
          cantidad: l.cantidad, precio_unitario: p.precio, subtotal: p.precio * l.cantidad,
        };
      });
      const subtotal    = items.reduce((s, i) => s + i.subtotal, 0);
      const costo_envio = subtotal >= 120000 ? 0 : 8000;

      // One cancelled order mid-window (its payment must NOT count as revenue);
      // ~1 in 9 left pending (no payment at all).
      const estado = offset === 44 ? 'cancelado' : n % 9 === 0 ? 'pendiente' : 'pagado';
      const metodo = estado === 'pendiente' ? null : DEMO_METODOS[n % DEMO_METODOS.length];

      const dayStart = startOfZonedDay(now, BUSINESS_TZ, -offset);
      const createdAt = new Date(dayStart.getTime() + pick(HORAS) * 3_600_000);

      const canal = pick(CANALES);
      orders.push({
        numero_orden:     `CN-9${String(n).padStart(5, '0')}`,
        ...demoIdentity(n - 1, canal),
        canal,
        estado,
        // Declared at checkout (lowercase free text) — mirrors the real flow.
        // The CHART reads Payment.metodo, not this field.
        metodo_pago:      metodo ? metodo.toLowerCase() : null,
        metodo,
        costo_envio,
        total:            subtotal + costo_envio,
        createdAt,
        items,
      });
    }
  }

  return orders;
}

async function main() {
  // SEED_OWNER_EMAIL: el LOGIN de la cuenta OWNER que siembra el seed. Es un dato
  // distinto del destinatario runtime de los reportes (SiteSetting.adminEmail), y por
  // eso lleva otro nombre — antes ambos eran ADMIN_EMAIL y esa doble función era la
  // trampa (§ total_compras). ADMIN_PASSWORD/ADMIN_NAME siguen siendo sólo del seed.
  const email = process.env.SEED_OWNER_EMAIL ?? "admin@sierranativa.co";
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

  // SiteSetting — la fila singleton de config del negocio (fase 1 multi-tenant). En
  // PRODUCCIÓN la crea la MIGRACIÓN (el seed no corre allá); esto es para resets de dev.
  // Valores HARDCODEADOS (no de `siteConfig`) a propósito: coinciden con el INSERT de la
  // migración y sobreviven al retiro de los campos planos de `siteConfig` (commit 7).
  // `update: {}` = idempotente, no pisa ediciones de dev en un re-seed.
  await prisma.siteSetting.upsert({
    where:  { id: 'default' },
    update: {},
    create: {
      id:                'default',
      nombre:            'Café Nayoli',
      tagline:           'Supatá · Cundinamarca',
      descripcionFooter: 'Café de especialidad colombiano. De nuestra finca en Supatá a tu taza.',
      whatsapp:          '+573155766064',
      instagram:         'cafenayoliorigen',
      emailRemitente:    'Café Nayoli <pedidos@mail.duna.solutions>',
    },
  });
  console.log("✅ SiteSetting singleton listo");


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
      // Identity snapshots ARE refreshed on an existing demo row: rows seeded
      // before these identities came from MOCK_CUSTOMERS point at customers who
      // do not exist, so they can never resolve a cliente_id. Repairing them in
      // place avoids deleting demo history. Nothing else is rewritten — notably
      // createdAt, which must keep the date it was seeded with.
      update: {
        cliente_nombre:   o.cliente_nombre,
        cliente_email:    o.cliente_email,
        cliente_telefono: o.cliente_telefono,
      },
      create: {
        numero_orden:     o.numero_orden,
        cliente_nombre:   o.cliente_nombre,
        cliente_email:    o.cliente_email,
        cliente_telefono: o.cliente_telefono,
        canal:            o.canal,
        estado:           o.estado,
        metodo_pago:      o.metodo_pago,
        total:            o.total,
        costo_envio:      o.costo_envio,
        // Backdated createdAt (only on create — the `update` above never
        // rewrites an existing row's date). A clean re-seed needs the old rows
        // deleted first so these relative dates apply (see DEPLOY.md).
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

  // CN- daily demo set (see buildDailyDemoOrders). Order + its Payment are
  // created together, mirroring the real flow where registering a payment is
  // what moves an order to `pagado`. Idempotent: an existing row only has its
  // identity snapshot repaired (same reason as the SN- block above), and the
  // payment is only created for a brand-new order.
  for (const o of buildDailyDemoOrders(new Date(), seedProducts)) {
    const existing = await prisma.order.findUnique({ where: { numero_orden: o.numero_orden } });
    if (existing) {
      await prisma.order.update({
        where: { numero_orden: o.numero_orden },
        data: {
          cliente_nombre:   o.cliente_nombre,
          cliente_email:    o.cliente_email,
          cliente_telefono: o.cliente_telefono,
        },
      });
      continue;
    }
    const order = await prisma.order.create({
      data: {
        numero_orden:     o.numero_orden,
        cliente_nombre:   o.cliente_nombre,
        cliente_email:    o.cliente_email,
        cliente_telefono: o.cliente_telefono,
        canal:            o.canal,
        estado:           o.estado,
        metodo_pago:      o.metodo_pago,
        total:            o.total,
        costo_envio:      o.costo_envio,
        createdAt:        o.createdAt,
        items: { create: o.items },
      },
    });
    if (o.metodo) {
      await prisma.payment.create({
        data: {
          orden_id:              order.id,
          monto:                 order.total,
          metodo:                o.metodo,
          registrado_por_nombre: 'Seed',
          // Same instant as the order — the chart buckets this into a Bogotá day.
          fecha:                 o.createdAt,
          createdAt:             o.createdAt,
        },
      });
    }
  }

  console.log('✅ CN- daily demo orders + payments seeded');

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

  // Las automatizaciones NO se siembran: su catálogo vive en el código
  // (constants/automations.ts) y `AutomationSetting` sólo guarda overrides. Sin
  // fila = todo por default, que es exactamente el estado inicial deseado (las 9
  // apagadas). Sembrar filas vacías sólo crearía ruido que mantener.
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });