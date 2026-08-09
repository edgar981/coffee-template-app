// One-time backfill for Order.cliente_id (migration 20260723230000).
//
// Resolves each order to a Customer using the SAME identity priority as
// createOrderWithCustomer, so a backfilled order links exactly where a freshly
// created one would:
//   a) by cliente_email  (Customer.email is unique)
//   b) else by NORMALIZED cliente_telefono
//
// Phones must be normalized on BOTH sides: orders store E.164 (+573...) because
// createOrderWithCustomer normalizes on write, but Customer rows seeded from
// lib/mock/customers.ts hold display formatting ("+57 310 234 5678"). A raw
// equality join silently matches nothing.
//
// NEVER GUESSES. A phone matching two customers is ambiguous and left null — the
// email-vs-phone duplicate limitation documented in lib/orders.ts means that is
// a real possibility, and a wrong link is worse than no link.
//
// Idempotent: only touches rows where cliente_id IS NULL. Pass --apply to write;
// the default is a dry run.
//
//   npx tsx prisma/backfill-order-cliente-id.ts            # dry run
//   npx tsx prisma/backfill-order-cliente-id.ts --apply    # write

import 'dotenv/config';
import prisma from '@duna/core';
import { normalizeCustomerPhone } from '@/lib/orders';

type Resolution = 'email' | 'phone' | 'ambiguous' | 'unresolved';

async function main() {
  const apply = process.argv.includes('--apply');

  const customers = await prisma.customer.findMany({
    select: { id: true, email: true, telefono: true },
  });

  const byEmail = new Map<string, string>();
  for (const c of customers) {
    const key = c.email?.toLowerCase().trim();
    if (key) byEmail.set(key, c.id);
  }

  // Many ids per phone — a duplicate makes every order on it ambiguous.
  const byPhone = new Map<string, string[]>();
  for (const c of customers) {
    const key = normalizeCustomerPhone(c.telefono);
    if (key) byPhone.set(key, [...(byPhone.get(key) ?? []), c.id]);
  }

  const orders = await prisma.order.findMany({
    where:  { cliente_id: null },
    select: { id: true, numero_orden: true, cliente_email: true, cliente_telefono: true },
  });

  const counts: Record<Resolution, number> = { email: 0, phone: 0, ambiguous: 0, unresolved: 0 };
  const updates: { id: string; clienteId: string }[] = [];
  const skipped: string[] = [];

  for (const order of orders) {
    const email = order.cliente_email?.toLowerCase().trim();
    const emailHit = email ? byEmail.get(email) : undefined;
    if (emailHit) {
      counts.email++;
      updates.push({ id: order.id, clienteId: emailHit });
      continue;
    }

    const phone = normalizeCustomerPhone(order.cliente_telefono);
    const phoneHits = phone ? byPhone.get(phone) : undefined;
    if (phoneHits?.length === 1) {
      counts.phone++;
      updates.push({ id: order.id, clienteId: phoneHits[0] });
      continue;
    }

    if (phoneHits && phoneHits.length > 1) {
      counts.ambiguous++;
      skipped.push(`${order.numero_orden} — phone ${phone} matches ${phoneHits.length} customers`);
      continue;
    }

    counts.unresolved++;
    skipped.push(`${order.numero_orden} — no customer for email=${order.cliente_email ?? '—'} phone=${phone ?? '—'}`);
  }

  if (apply && updates.length > 0) {
    // Grouped by customer so this is a handful of updateMany calls, not one per order.
    const byCustomer = new Map<string, string[]>();
    for (const u of updates) byCustomer.set(u.clienteId, [...(byCustomer.get(u.clienteId) ?? []), u.id]);
    await prisma.$transaction(
      [...byCustomer.entries()].map(([clienteId, orderIds]) =>
        prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { cliente_id: clienteId } }),
      ),
    );
  }

  console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'} — ${orders.length} orders with cliente_id IS NULL`);
  console.log(`  resolved by email : ${counts.email}`);
  console.log(`  resolved by phone : ${counts.phone}`);
  console.log(`  ambiguous (null)  : ${counts.ambiguous}`);
  console.log(`  unresolved (null) : ${counts.unresolved}`);
  console.log(`  → would write     : ${updates.length}`);

  if (skipped.length > 0) {
    console.log(`\nLeft null (${skipped.length}), first 15:`);
    for (const line of skipped.slice(0, 15)) console.log(`  ${line}`);
  }
  if (!apply) console.log('\nNothing was written. Re-run with --apply to commit.');
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
