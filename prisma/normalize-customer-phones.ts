// One-time data fix: canonicalize every Customer.telefono to the same format the
// order-matching normalizer produces ("+57" + 10-digit mobile), so the phone
// branch of createOrderWithCustomer finds existing customers instead of creating
// duplicates. Idempotent — re-running is a no-op for already-canonical rows.
//
// It ONLY rewrites Customer.telefono. Order snapshots (cliente_telefono) are left
// intact (historical record; orders link by cliente_id). It does NOT merge the
// duplicate groups it finds — merging is a human decision (a future feature); the
// groups are just LISTED here for the owner.
//
// Run:  npx tsx --env-file=.env prisma/normalize-customer-phones.ts
import prisma from "@/lib/prisma";
import { normalizeCustomerPhone } from "@/lib/whatsapp-link";

async function main() {
  const customers = await prisma.customer.findMany({
    select: { id: true, nombre: true, email: true, telefono: true, numero_ordenes: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // (a) Canonicalize — only rows that are a Colombian mobile in a non-canonical
  //     format. Non-mobile / unparseable phones are left as typed (nothing to
  //     canonicalize to).
  let updated = 0;
  for (const c of customers) {
    if (!c.telefono) continue;
    const canonical = normalizeCustomerPhone(c.telefono);
    if (canonical && canonical !== c.telefono) {
      await prisma.customer.update({ where: { id: c.id }, data: { telefono: canonical } });
      console.log(`  fix ${c.id.slice(-8)}  "${c.telefono}" → "${canonical}"`);
      updated++;
    }
  }
  console.log(`\nCanonicalizados: ${updated} de ${customers.length} clientes.`);

  // (b) List groups sharing a phone AFTER normalization (NO merge).
  const fresh = await prisma.customer.findMany({
    select: { id: true, nombre: true, email: true, telefono: true, numero_ordenes: true },
  });
  const byPhone = new Map<string, typeof fresh>();
  for (const c of fresh) {
    if (!c.telefono) continue;
    if (!byPhone.has(c.telefono)) byPhone.set(c.telefono, []);
    byPhone.get(c.telefono)!.push(c);
  }

  console.log("\n=== Grupos de clientes que comparten teléfono (decisión de merge: HUMANA) ===");
  let groups = 0;
  for (const [phone, members] of byPhone) {
    if (members.length < 2) continue;
    groups++;
    console.log(`\n[${phone}] → ${members.length} clientes:`);
    for (const c of members) {
      console.log(`  id=${c.id}  nombre="${c.nombre}"  email=${c.email ?? "∅"}  ordenes=${c.numero_ordenes}`);
    }
  }
  console.log(groups === 0 ? "\n(ningún grupo con teléfono compartido)" : `\nTotal grupos: ${groups}`);
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
