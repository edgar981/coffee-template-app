// prisma/sembrar-copy-nayoli.ts
//
// EL SEMBRADO de la opción B (§ CONTENIDO-CAFE-A-DATO-B-1, decisión del owner 2026-09-21,
// revirtiendo la opción A). El copy café de CINCO superficies —la franja de garantías
// (`TrustBadges`), el placeholder del buscador del nav, el subtítulo y el placeholder de /tienda,
// el vacío del carrito, y las dos frases de /rastrear-pedido— dejó de estar horneado en los
// componentes y pasó a `SiteContent` con DEFAULT NEUTRO (§ site-content-defaults.ts,
// `DEFAULTS.trustBadges`/`DEFAULTS.microcopy`). Este script es lo que le devuelve a NAYOLI su copy
// café real, como DATO — nunca vuelve a vivir en el código.
//
// EXTENDIDO en § CONTENIDO-CAFE-A-DATO-B-EXT-1 con los DOS últimos reductos café, para que el
// sembrado sobre la base viva de Nayoli sea UNA sola corrida: los ÍCONOS de `TrustBadges`
// (`badgeNIcono`, antes ESTRUCTURA por posición — Leaf/Coffee/Truck/Shield — ahora DATO, un NOMBRE
// del set cerrado de `components/storefront/badge-iconos.ts`) y la SEXTA superficie que la tanda B-1
// dejó fuera de alcance a propósito (`CONTENIDO-CAFE-TIENDA-SLUG-TRUSTBADGES-1`): los TRES badges de
// la ficha de producto (`productoBadges`, texto + ícono), que vivían como un array literal aparte en
// `app/(storefront)/tienda/[slug]/page.tsx`.
//
// LAS DOS GUARDAS DE ESCRITURA, MISMO MOLDE que `prisma/aplicar-preset.ts` (el precedente exacto:
// un script genérico que reescribe contenido de una tienda, corrido contra la base equivocada, le
// cambia el sitio a un cliente vivo sin que nadie lo note hasta que llama):
//
//   1. IMPRIME contra qué base está conectado y a QUIÉN va a tocar — host + nombre de la base
//      (NUNCA credenciales) y el `SiteSetting.nombre` que esa base tiene AHORA MISMO — antes de
//      escribir un solo byte.
//   2. EXIGE que el operador TIPEE ese mismo nombre para confirmar. Cualquier otra cosa —vacío, un
//      nombre que no coincide, "y"/"s"— ABORTA sin escribir. Sin terminal interactiva el default
//      es NO ESCRIBIR; la vía no-interactiva es `CONFIRMAR_TENANT`, que repite el nombre EXACTO —
//      no es un `--force` ciego, es la MISMA comprobación por otro canal.
//
// IDEMPOTENTE: correrlo dos veces deja el MISMO estado — `mergeCopyNayoliEnContent` es una función
// PURA del `content` actual + las cadenas/nombres fijos, sin acumular (mismo criterio que
// `mergePresetEnContent`/`aplicarPreset`). Sólo toca `trustBadges`, `productoBadges` y `microcopy`;
// el resto de `content` (hero, brandStory, tema, orden…) queda intacto — el spread preserva
// cualquier otro campo que esas tres secciones ya tuvieran (p. ej. `trustBadges.visible`, si algún
// día se edita).
//
// Uso (necesita DATABASE_URL del entorno — tsx no carga .env solo):
//   npx tsx --env-file=.env prisma/sembrar-copy-nayoli.ts
// o, equivalente:
//   npm run db:sembrar-copy-nayoli
//
// Confirmación NO-INTERACTIVA (CI, un script sin terminal — nunca un `--force` ciego):
//   CONFIRMAR_TENANT="<nombre EXACTO del tenant>" npx tsx --env-file=.env prisma/sembrar-copy-nayoli.ts
//
// ESTE SCRIPT NO SE CORRIÓ TODAVÍA. La aprobación del owner sobre este slice autoriza la ESCRITURA
// del código (los defaults neutros + este script), nunca el MERGE de la rama ni correr el sembrado
// — los dos son pasos del OWNER, después de este slice (§ el orden: sembrado → verificación → merge).

import prisma from "@duna/core";
import * as readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// Las VEINTE cadenas que este slice + su extensión sacaron de los componentes, BYTE A BYTE (el
// copy real de Nayoli, medido contra el código antes de tocarlo — § el asiento en DECISIONS.md).
// Los `badgeNIcono` son NOMBRES del set cerrado de `components/storefront/badge-iconos.ts`
// (`NOMBRES_ICONO_BADGE`), no texto libre: el orden Leaf/Coffee/Truck/Shield de `TrustBadges.tsx`
// (antes ESTRUCTURA por posición) y Truck/RotateCcw/CheckCircle de la ficha de producto (antes un
// array literal en `[slug]/page.tsx`), preservado byte a byte.
export const COPY_NAYOLI = {
  trustBadges: {
    badge1: "Origen 100% colombiano", badge1Icono: "leaf",
    badge2: "Tostado artesanal semanal", badge2Icono: "coffee",
    badge3: "Envío a todo el país", badge3Icono: "truck",
    badge4: "Garantía de frescura", badge4Icono: "shield",
  },
  productoBadges: {
    badge1: "Envío a todo Colombia · Gratis +$150.000", badge1Icono: "truck",
    badge2: "Garantía de frescura de 30 días", badge2Icono: "rotate",
    badge3: "Tostado dentro de los 7 días previos al envío", badge3Icono: "check",
  },
  microcopy: {
    navBuscarPlaceholder: "Buscar café, origen, categoría...",
    tiendaSubtitulo: "Origen colombiano",
    tiendaBuscarPlaceholder: "Buscar café...",
    carritoVacioTexto: "Explora nuestros productos y agrega tu café favorito.",
    rastreoPagadoDesc: "Hemos confirmado tu pago y preparamos tu café.",
    rastreoEntregadoDesc: "Pedido entregado. ¡Disfruta tu café!",
  },
} as const;

/**
 * EL MERGE QUIRÚRGICO, puro (§ precedente `mergePresetEnContent`, themes.ts). Sólo reemplaza los
 * campos de TEXTO/ÍCONO de `trustBadges`/`productoBadges`/`microcopy`; preserva cualquier otro
 * campo que esas tres secciones ya tuvieran (p. ej. `trustBadges.visible` si algún día se edita) y
 * CUALQUIER otra sección de `content` (hero, brandStory, tema, orden…), intacta. Aplicarlo dos
 * veces sobre su propio resultado da el MISMO `content` — no acumula, no duplica.
 */
export function mergeCopyNayoliEnContent(content: unknown): Record<string, unknown> {
  const c = esObj(content) ? content : {};
  const trustBadgesPrevio = esObj(c.trustBadges) ? c.trustBadges : {};
  const productoBadgesPrevio = esObj(c.productoBadges) ? c.productoBadges : {};
  const microcopyPrevio = esObj(c.microcopy) ? c.microcopy : {};
  return {
    ...c,
    trustBadges: { ...trustBadgesPrevio, ...COPY_NAYOLI.trustBadges },
    productoBadges: { ...productoBadgesPrevio, ...COPY_NAYOLI.productoBadges },
    microcopy: { ...microcopyPrevio, ...COPY_NAYOLI.microcopy },
  };
}

function fallar(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

/**
 * De una `DATABASE_URL` de Postgres, el HOST y el NOMBRE de la base — nunca usuario ni contraseña
 * (`URL.username`/`URL.password` son campos aparte de `hostname`/`pathname`, y esta función no los
 * toca). Puro: no abre conexión. `null` si la cadena no se puede parsear — nunca imprime el valor
 * crudo en ese caso, porque podría llevar el secreto adentro. (Mismo mecanismo que
 * `prisma/aplicar-preset.ts`, duplicado acá a propósito: ese script vive en OTRA rama, sin mergear
 * a la base de ésta, así que no hay de dónde importarlo sin salir de `touches:`.)
 */
export function conexionVisible(databaseUrl: string): { host: string; base: string } | null {
  try {
    const u = new URL(databaseUrl);
    return { host: u.hostname, base: u.pathname.replace(/^\//, "") };
  } catch {
    return null;
  }
}

/**
 * LA GUARDA ENTERA, pura. ¿El valor tipeado/pasado confirma la escritura contra ESTE tenant? Exige
 * coincidencia EXACTA con `nombreTenant`, recortando sólo espacio en blanco de los BORDES. Vacío,
 * "y", "s", o cualquier nombre que no sea el del tenant, NO confirma.
 */
export function confirmacionValida(nombreTenant: string, valorIngresado: string | null | undefined): boolean {
  if (typeof valorIngresado !== "string") return false;
  const v = valorIngresado.trim();
  return v.length > 0 && v === nombreTenant;
}

async function pedirConfirmacionInteractiva(nombreTenant: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(`Escribe el nombre EXACTO del tenant para confirmar («${nombreTenant}»): `);
  } finally {
    rl.close();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? fallar("❌ Falta DATABASE_URL en el entorno.");

  const conexion = conexionVisible(databaseUrl);
  console.log(
    conexion
      ? `→ Conectado a: ${conexion.host} / ${conexion.base}`
      : "→ Conectado a: (no se pudo leer host/base de DATABASE_URL)",
  );

  let settings: { nombre: string };
  try {
    settings = await prisma.siteSetting.findUniqueOrThrow({ where: { id: "default" }, select: { nombre: true } });
  } catch (e) {
    return fallar(`❌ No se pudo leer SiteSetting de esta base (¿migró? ¿es la base correcta?): ${e}`);
  }

  console.log(`→ Vas a sembrar el copy café de Nayoli sobre: ${settings.nombre}`);
  console.log(
    "→ Secciones afectadas: trustBadges (4 textos + 4 íconos), productoBadges (3 textos + 3 íconos), " +
      "microcopy (6 textos) — 20 cadenas en total.",
  );

  const desdeEnv = process.env.CONFIRMAR_TENANT;
  let valorIngresado: string;
  if (typeof desdeEnv === "string") {
    valorIngresado = desdeEnv;
  } else if (process.stdin.isTTY) {
    valorIngresado = await pedirConfirmacionInteractiva(settings.nombre);
  } else {
    return fallar(
      "\n❌ No hay terminal interactiva y no llegó CONFIRMAR_TENANT — no se escribe nada.\n" +
        "   Para correr sin terminal, repetí el nombre EXACTO del tenant:\n" +
        `   CONFIRMAR_TENANT="${settings.nombre}" npx tsx --env-file=.env prisma/sembrar-copy-nayoli.ts\n`,
    );
  }

  if (!confirmacionValida(settings.nombre, valorIngresado)) {
    return fallar("\n❌ No coincide con el nombre del tenant — abortado, no se escribió nada.\n");
  }

  const row = await prisma.siteContent.findUnique({ where: { id: "default" } });
  const nuevoContent = mergeCopyNayoliEnContent(row?.content);

  await prisma.siteContent.upsert({
    where: { id: "default" },
    update: { content: nuevoContent as object },
    create: { id: "default", content: nuevoContent as object },
  });

  console.log(`✅ Copy café sembrado sobre «${settings.nombre}».`);
}

// GATE DE ENTRYPOINT (mismo mecanismo que `prisma/aplicar-preset.ts`): `main()` sólo corre cuando
// este archivo es el ejecutado directo, nunca cuando `lib/config/copy-b.test.ts`/`copy-b-ext.test.ts`
// importan `mergeCopyNayoliEnContent`/`confirmacionValida`/`conexionVisible` para probarlas en aislamiento.
// Comparación por `pathToFileURL`, no por string crudo: `import.meta.url` percent-codifica espacios
// (este repo vive bajo una ruta con espacios) y `process.argv[1]` no.
const esEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEntryPoint) {
  main()
    .catch((error) => {
      console.error("❌ sembrar-copy-nayoli falló:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
