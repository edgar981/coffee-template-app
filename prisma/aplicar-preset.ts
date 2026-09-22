// prisma/aplicar-preset.ts
//
// EL ÚNICO LLAMADOR de `aplicarPreset` (lib/config/site-content-write.ts). La composición de un
// theme (esquema · orden · variante) se arma en ONBOARDING, NUNCA en el panel del cliente
// (DECISIONS.md, retiro de EJE-5-ORDEN-EDITOR-1/EJE-5-VARIANTES-EDITOR — «la rigidez es la
// garantía de que ninguna tienda de Duna se ve mal»), así que este script ES la puerta: sin él,
// `aplicarPreset` no tenía un solo caller (MUESTRARIO-DESPLIEGUE-CENSO-1).
//
// LAS DOS GUARDAS, y por qué son las DOS (ONBOARDING-APLICAR-PRESET-SCRIPT-2, condición del
// owner): un script genérico que reescribe el tema de una tienda, corrido contra la base
// equivocada, le cambia el sitio a un cliente vivo sin que nadie lo note hasta que el cliente
// llama.
//
//   1. IMPRIME contra qué base está conectado y a QUIÉN va a tocar — host + nombre de la base
//      (NUNCA credenciales: ni usuario, ni contraseña, ni el `DATABASE_URL` completo) y el
//      `SiteSetting.nombre` que esa base tiene AHORA MISMO — antes de escribir un solo byte.
//   2. EXIGE que el operador TIPEE ese mismo nombre para confirmar. Cualquier otra cosa —vacío,
//      un nombre que no coincide, "y"/"s"— ABORTA sin escribir. Sin terminal interactiva (un CI,
//      un pipe) el default es NO ESCRIBIR — nunca "como no puedo preguntar, asumo que sí"—; la
//      vía no-interactiva es la env var `CONFIRMAR_TENANT`, que tiene que repetir el nombre
//      EXACTO del tenant — no es un `--force` ciego que salta la comprobación, es la MISMA
//      comprobación por otro canal.
//
// GENÉRICO, no específico de ningún cliente: toma la CLAVE del preset como argumento y la busca
// en el catálogo común (`PRESETS`, themes.ts). El próximo tenant usa otro preset; nada acá nombra
// a un cliente.
//
// REUSA `aplicarPreset` Y `PRESETS` TAL CUAL — no reescribe el merge quirúrgico ni el catálogo de
// presets. Sigue el molde de `prisma/crear-owner.ts`: mismo patrón de lectura de env, mismo fallo
// RUIDOSO (nunca un fallback silencioso), misma forma de exponerse en `package.json`.
//
// Uso (necesita DATABASE_URL del entorno, igual que crear-owner.ts — tsx no carga .env solo):
//   npx tsx --env-file=.env prisma/aplicar-preset.ts <CLAVE>
// o, equivalente:
//   npm run db:aplicar-preset -- <CLAVE>
//
// Confirmación NO-INTERACTIVA (CI, un script sin terminal — nunca un `--force` ciego):
//   CONFIRMAR_TENANT="<nombre EXACTO del tenant>" npx tsx --env-file=.env prisma/aplicar-preset.ts <CLAVE>

import prisma from "@duna/core";
import * as readline from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { PRESETS, type PresetTema } from "@/lib/config/themes";
import { aplicarPreset, PresetIncompletoError } from "@/lib/config/site-content-write";

function fallar(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

/**
 * De una `DATABASE_URL` de Postgres, el HOST y el NOMBRE de la base — nunca usuario ni
 * contraseña (`URL.username`/`URL.password` son campos aparte de `hostname`/`pathname`, y esta
 * función no los toca). Puro: no abre conexión ni toca el proceso, así que se afirma sin una base
 * real. `null` si la cadena no se puede parsear como URL — nunca imprime el valor crudo en ese
 * caso, porque podría llevar el secreto adentro.
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
 * LA GUARDA ENTERA, en una función pura (§ condición 2 del owner). ¿El valor tipeado/pasado
 * confirma la escritura contra ESTE tenant? Exige coincidencia EXACTA con `nombreTenant` —
 * recortando sólo espacio en blanco de los BORDES (lo único que un `readline` o una env var
 * pueden colar por accidente, nunca del contenido)—. Vacío, "y", "s", o cualquier nombre que no
 * sea el del tenant, NO confirma. `aplicarPreset` no se llama si esto devuelve `false`.
 */
export function confirmacionValida(nombreTenant: string, valorIngresado: string | null | undefined): boolean {
  if (typeof valorIngresado !== "string") return false;
  const v = valorIngresado.trim();
  return v.length > 0 && v === nombreTenant;
}

function presetPorClave(clave: string | undefined): PresetTema {
  const preset = clave ? PRESETS.find((p) => p.clave === clave) : undefined;
  if (!preset) {
    return fallar(
      `❌ Preset «${clave ?? ""}» desconocido.\n` +
        `   Presets del catálogo: ${PRESETS.map((p) => p.clave).join(", ")}\n` +
        `   Uso: npx tsx --env-file=.env prisma/aplicar-preset.ts <CLAVE>`,
    );
  }
  return preset;
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
  const preset = presetPorClave(process.argv[2]);

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

  console.log(`→ Vas a reescribir el TEMA de: ${settings.nombre}`);
  console.log(`→ Preset a aplicar: ${preset.clave} (${preset.label})`);

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
        `   CONFIRMAR_TENANT="${settings.nombre}" npx tsx --env-file=.env prisma/aplicar-preset.ts ${preset.clave}\n`,
    );
  }

  if (!confirmacionValida(settings.nombre, valorIngresado)) {
    return fallar("\n❌ No coincide con el nombre del tenant — abortado, no se escribió nada.\n");
  }

  try {
    await aplicarPreset(preset);
  } catch (e) {
    if (e instanceof PresetIncompletoError) {
      return fallar(`❌ ${e.message}`);
    }
    return fallar(`❌ No se pudo aplicar el preset: ${e}`);
  }

  console.log(`✅ Preset «${preset.clave}» aplicado sobre «${settings.nombre}».`);
}

// GATE DE ENTRYPOINT: `main()` sólo corre cuando este archivo es el ejecutado directo (tsx
// <este-archivo>), NUNCA cuando otro módulo lo importa. Sin esto, el test de capa 1 que importa
// `confirmacionValida`/`conexionVisible` (`lib/config/aplicar-preset-guardas.test.ts`) dispararía
// todo el runbook al cargar el módulo — y como no hay `DATABASE_URL` en el entorno del test,
// `fallar()` mataría el proceso entero con `process.exit(1)` antes de correr un solo `assert`.
// Comparación por `pathToFileURL`, no por string crudo: `import.meta.url` percent-codifica
// espacios (este repo vive bajo una ruta con espacios) y `process.argv[1]` no — una comparación
// de strings a secas daría `false` incluso corriendo como entrypoint.
const esEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEntryPoint) {
  main()
    .catch((error) => {
      console.error("❌ aplicar-preset falló:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
