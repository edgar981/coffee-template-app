// One-time purge of production QA/test data. MANUAL ONLY — never imported by the app.
//   Dry-run (read-only, prints the report):  DATABASE_URL=<url> npx tsx scripts/purge-test-data.ts
//   Execute (deletes, after owner approval):  DATABASE_URL=<url> npx tsx scripts/purge-test-data.ts --execute
// DATABASE_URL must be set explicitly (the script does NOT read .env) so it can never
// hit a database by accident; always eyeball the dry-run before adding --execute.

import { PrismaClient } from '@/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─── Criteria (EXPLICIT + conservative) ──────────────────────────────────────
// An identity (customer OR order snapshot) is "test data" if ANY of these hold.
// Derived from inspecting the real DB (2026-07-26): QA smoke tests + the shared
// duplicate-detection phone. Adjust here if new fixtures appear.
const TEST_EMAIL_SUFFIX = '@example.com';

const TEST_NAMES = [
  'QA Bot',
  'QA Prodtransferencia',
  'QA Prodefectivo',
  'QA transferencia',
  'QA efectivo',
  'Nuevo',
  'Cliente 1',
  'Cliente Test',
  'Test Claude', // observed in the real DB (also caught by @example.com)
];

const TEST_PHONES = [
  '+573001112233', // duplicate-detection test phone, shared across QA orders
  '+573001234567', // "Test Claude"
  '+573160498029', // "Nuevo"
];

const TEST_NAME_SET = new Set(TEST_NAMES.map((n) => n.toLowerCase()));
const TEST_PHONE_SET = new Set(TEST_PHONES);

/** True if this identity matches the test criteria. Used for customer candidacy
 *  AND for the per-order snapshot check (point 3). */
function isTestIdentity(
  nombre?: string | null,
  email?: string | null,
  telefono?: string | null,
): boolean {
  if (email && email.toLowerCase().endsWith(TEST_EMAIL_SUFFIX)) return true;
  if (nombre && TEST_NAME_SET.has(nombre.trim().toLowerCase())) return true;
  if (telefono && TEST_PHONE_SET.has(telefono.trim())) return true;
  return false;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrderRow {
  id: string;
  numero_orden: string;
  total: number;
  estado: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
}

interface IncludedCustomer {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  orders: OrderRow[];
}

interface ExcludedCustomer {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  orders: OrderRow[];
  offending: OrderRow[]; // the non-test orders that triggered the exclusion
}

interface Plan {
  included: IncludedCustomer[];
  excluded: ExcludedCustomer[];
  orphanOrders: OrderRow[]; // test orders with no owning candidate customer
  orderIds: string[];       // every order id the execute phase will delete
  customerIds: string[];    // every customer id the execute phase will delete
  protectedOrderIds: Set<string>; // orders of excluded customers — never delete
}

const ORDER_SELECT = {
  id: true,
  numero_orden: true,
  total: true,
  estado: true,
  cliente_id: true,
  cliente_nombre: true,
  cliente_email: true,
  cliente_telefono: true,
} as const;

// ─── Dry-run: compute the plan (READ-ONLY) ────────────────────────────────────
async function computePlan(prisma: PrismaClient): Promise<Plan> {
  // 1. Candidate customers by the explicit criteria.
  const candidates = await prisma.customer.findMany({
    where: {
      OR: [
        { email: { endsWith: TEST_EMAIL_SUFFIX, mode: 'insensitive' } },
        { nombre: { in: TEST_NAMES } },
        { telefono: { in: TEST_PHONES } },
      ],
    },
    select: { id: true, nombre: true, email: true, telefono: true },
    orderBy: { createdAt: 'asc' },
  });

  const included: IncludedCustomer[] = [];
  const excluded: ExcludedCustomer[] = [];
  const protectedOrderIds = new Set<string>();

  for (const c of candidates) {
    // Gather EVERY order that belongs to this customer — by FK and by the
    // email/phone snapshot (legacy orders may not carry cliente_id).
    const orders: OrderRow[] = await prisma.order.findMany({
      where: {
        OR: [
          { cliente_id: c.id },
          ...(c.email ? [{ cliente_email: c.email }] : []),
          ...(c.telefono ? [{ cliente_telefono: c.telefono }] : []),
        ],
      },
      select: ORDER_SELECT,
    });

    // Point 3: if ANY order does not look like test data, exclude the WHOLE
    // customer (better to leave junk than delete a real sale).
    const offending = orders.filter(
      (o) => !isTestIdentity(o.cliente_nombre, o.cliente_email, o.cliente_telefono),
    );
    if (offending.length > 0) {
      excluded.push({ ...c, orders, offending });
      for (const o of orders) protectedOrderIds.add(o.id);
    } else {
      included.push({ ...c, orders });
    }
  }

  const includedOrderIds = new Set(included.flatMap((c) => c.orders.map((o) => o.id)));

  // 2. Orphan test orders: match the criteria by snapshot, have no owning
  //    customer (cliente_id null), and aren't already accounted for. These are
  //    the "QA Bot" style orders that never persisted a Customer row.
  const orphanRaw: OrderRow[] = await prisma.order.findMany({
    where: {
      cliente_id: null,
      OR: [
        { cliente_email: { endsWith: TEST_EMAIL_SUFFIX, mode: 'insensitive' } },
        { cliente_nombre: { in: TEST_NAMES } },
        { cliente_telefono: { in: TEST_PHONES } },
      ],
    },
    select: ORDER_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  const orphanOrders = orphanRaw.filter(
    (o) => !includedOrderIds.has(o.id) && !protectedOrderIds.has(o.id),
  );

  const orderIds = [...includedOrderIds, ...orphanOrders.map((o) => o.id)];
  const customerIds = included.map((c) => c.id);

  return { included, excluded, orphanOrders, orderIds, customerIds, protectedOrderIds };
}

// ─── Report ───────────────────────────────────────────────────────────────────
const money = (n: number) => `$${n.toLocaleString('es-CO')}`;
const orderLine = (o: OrderRow) =>
  `      ${o.numero_orden}  ${money(o.total).padStart(12)}  ${o.estado.padEnd(10)}  ${o.cliente_nombre ?? '—'} / ${o.cliente_email ?? '—'} / ${o.cliente_telefono ?? '—'}`;

async function printReport(prisma: PrismaClient, plan: Plan) {
  const [payCount, shipCount, itemCount] = plan.orderIds.length
    ? await Promise.all([
        prisma.payment.count({ where: { orden_id: { in: plan.orderIds } } }),
        prisma.shipping.count({ where: { orden_id: { in: plan.orderIds } } }),
        prisma.orderItem.count({ where: { orden_id: { in: plan.orderIds } } }),
      ])
    : [0, 0, 0];

  console.log('\n════════════════════ PURGE PLAN (dry-run) ════════════════════');

  console.log(`\n▶ INCLUDED customers (${plan.included.length}) — will be deleted with their orders:`);
  for (const c of plan.included) {
    console.log(`  • ${c.nombre} | ${c.email ?? '—'} | ${c.telefono ?? '—'} | id=${c.id}`);
    if (c.orders.length === 0) console.log('      (no orders)');
    for (const o of c.orders) console.log(orderLine(o));
  }

  console.log(`\n▶ ORPHAN test orders (${plan.orphanOrders.length}) — no owning customer, will be deleted:`);
  for (const o of plan.orphanOrders) console.log(orderLine(o));

  console.log(`\n▶ EXCLUDED candidates (${plan.excluded.length}) — kept (a non-test order raised doubt):`);
  for (const c of plan.excluded) {
    console.log(`  • ${c.nombre} | ${c.email ?? '—'} | ${c.telefono ?? '—'} | id=${c.id}`);
    console.log(`      reason: ${c.offending.length} order(s) do NOT match test criteria:`);
    for (const o of c.offending) console.log(orderLine(o));
  }

  console.log('\n── Totals to delete ─────────────────────────────');
  console.log(`   customers: ${plan.customerIds.length}`);
  console.log(`   orders:    ${plan.orderIds.length}`);
  console.log(`   orderItems:${itemCount}`);
  console.log(`   payments:  ${payCount}`);
  console.log(`   shippings: ${shipCount}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ─── Execute: delete ONLY the planned ids, in dependency order ─────────────────
async function execute(prisma: PrismaClient, plan: Plan) {
  const { orderIds, customerIds } = plan;
  console.log('⚠  EXECUTE mode — deleting the planned ids in a transaction…');

  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.deleteMany({ where: { orden_id: { in: orderIds } } });
    const pays = await tx.payment.deleteMany({ where: { orden_id: { in: orderIds } } });
    const ships = await tx.shipping.deleteMany({ where: { orden_id: { in: orderIds } } });
    const orders = await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    const customers = await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    return { items: items.count, pays: pays.count, ships: ships.count, orders: orders.count, customers: customers.count };
  });

  console.log(`   deleted → orderItems=${result.items} payments=${result.pays} shippings=${result.ships} orders=${result.orders} customers=${result.customers}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function maskHost(url: string) {
  const m = url.match(/@([^/]+)\//);
  return m ? m[1] : '(unknown host)';
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('✗ DATABASE_URL is required. Set it explicitly (this script never reads .env).');
    process.exit(1);
  }
  const doExecute = process.argv.includes('--execute');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log(`Target DB host: ${maskHost(url)}   mode: ${doExecute ? 'EXECUTE (deletes)' : 'dry-run (read-only)'}`);

    const [beforeOrders, beforeCustomers] = await Promise.all([
      prisma.order.count(),
      prisma.customer.count(),
    ]);
    console.log(`Before: orders=${beforeOrders} customers=${beforeCustomers}`);

    const plan = await computePlan(prisma);
    await printReport(prisma, plan);

    if (!doExecute) {
      console.log('Dry-run only. Re-run with --execute (after approving the plan) to delete.');
      return;
    }

    await execute(prisma, plan);

    const [afterOrders, afterCustomers] = await Promise.all([
      prisma.order.count(),
      prisma.customer.count(),
    ]);
    console.log(`\nAfter:  orders=${afterOrders} customers=${afterCustomers}`);
    console.log(`Delta:  orders -${beforeOrders - afterOrders}, customers -${beforeCustomers - afterCustomers}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
