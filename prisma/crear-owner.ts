// prisma/crear-owner.ts
//
// Crea el PRIMER usuario OWNER de un despliegue nuevo — Y NADA MÁS. No siembra
// SiteSetting (esa fila ya nace NEUTRA por su propia migración, ver
// packages/core/prisma/migrations/20260824120000_add_site_setting), no crea
// SiteContent, ni Customer, ni Product, ni Order, ni AutomationSetting.
//
// EXISTE PORQUE prisma/seed.ts es INSEPARABLE de la demo de Café Nayoli: crea el
// OWNER y sigue de largo sembrando 10 clientes falsos, 4 productos de café y
// ~110 órdenes. Correrlo contra la base de un CLIENTE REAL le deja encima el
// catálogo de OTRO negocio — y confiar en un borrado posterior "completo" es
// justo el riesgo que este script existe para no correr (§ CLAUDE.md,
// "Imágenes en public/" / la doctrina de "no ensuciar, aunque cueste código").
//
// Uso (necesita DATABASE_URL + BETTER_AUTH_SECRET del entorno, igual que el
// seed — tsx no carga .env solo):
//   npx tsx --env-file=.env prisma/crear-owner.ts
// o, equivalente:
//   npm run db:crear-owner
//
// REUSA EL MISMO CAMINO DE AUTH que prisma/seed.ts: auth.api.signUpEmail de
// Better Auth. NO hashea contraseñas a mano — un hash que no coincida con el
// formato de Better Auth deja al owner sin poder loguearse, y el error
// aparecería recién en el login, lejos de esta pantalla.
//
// IDEMPOTENTE: si el usuario ya existe (mismo email), no se crea de nuevo; el
// script sólo se asegura de que su rol sea OWNER y termina en éxito. Correrlo
// dos veces es seguro.

import prisma from "@duna/core";
import { auth } from "@/lib/auth";

// SEED_OWNER_EMAIL y ADMIN_PASSWORD son REQUERIDAS a propósito — a diferencia
// de prisma/seed.ts, que cae a credenciales PÚBLICAS por defecto
// (admin@sierranativa.co / ChangeMe123!, documentadas en .env.example) porque
// ahí el destino es siempre una base de demo/dev. Este script crea el OWNER de
// un despliegue que puede ser de un cliente real: un default público ahí sería
// dejar la puerta de entrada abierta con una llave que cualquiera conoce. Sin
// alguna de las dos, el script PARA con un mensaje que dice cuál falta y sale
// con código distinto de 0 — nunca inventa una credencial.
//
// ADMIN_NAME sí conserva el default del seed ("Administrador"): es sólo el
// nombre para mostrar, no una credencial, y no vale la pena bloquear el script
// por un dato cosmético.
const REQUIRED_ENV = ["SEED_OWNER_EMAIL", "ADMIN_PASSWORD"] as const;

function envFaltantes(): string[] {
  return REQUIRED_ENV.filter((key) => !process.env[key]);
}

// Código que Better Auth pone en `e.body.code` cuando el email ya está
// registrado (mismo discriminador que ya usa app/api/users/accept-invite/route.ts
// para separar "ya existe" de un error real). Cualquier otro código, o la
// ausencia de uno, es un fallo de verdad y no se traga en silencio.
const USER_ALREADY_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

async function main() {
  const faltan = envFaltantes();
  if (faltan.length > 0) {
    console.error("❌ Faltan variables de entorno requeridas para crear el OWNER:\n");
    for (const key of faltan) console.error(`   ${key}`);
    console.error(
      "\nDefinilas en tu .env (ver .env.example, sección \"Seed del demo\") y" +
        " volvé a correr:\n   npx tsx --env-file=.env prisma/crear-owner.ts\n",
    );
    process.exit(1);
  }

  const email = process.env.SEED_OWNER_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const name = process.env.ADMIN_NAME ?? "Administrador";

  let creado = false;
  try {
    await auth.api.signUpEmail({ body: { email, password, name } });
    creado = true;
  } catch (e) {
    const code = (e as { body?: { code?: string } })?.body?.code;
    if (code !== USER_ALREADY_EXISTS_CODE) {
      console.error("❌ No se pudo crear el usuario OWNER:", e);
      process.exit(1);
    }
    // Ya existe con ese email: seguimos para asegurar el rol (idempotencia).
  }

  await prisma.user.update({
    where: { email },
    data: { role: "OWNER" },
  });

  console.log(
    creado
      ? "✅ Usuario creado."
      : "ℹ️ El usuario ya existía; se aseguró que su rol sea OWNER.",
  );
  console.log(`✅ OWNER listo: ${email}`);
  console.log(
    "\nEste script no creó nada más: ni catálogo, ni clientes, ni pedidos, ni" +
      " SiteSetting (esa fila ya nace con valores neutros por su migración —" +
      " \"Configura tu tienda\" — y se edita desde Configuración una vez adentro).",
  );
}

main()
  .catch((error) => {
    console.error("❌ crear-owner falló:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
