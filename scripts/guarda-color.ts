// scripts/guarda-color.ts — § GUARDA-COLOR-NAYOLI-1
//
// LO QUE EL OWNER PIDIÓ, TEXTUAL: hacer PERMANENTE la vara "Nayoli visualmente idéntico, medido" —
// (a) captura DETERMINISTA, (b) FIXTURE de referencia commiteado, (c) GUARDA AUTOMÁTICA que corre
// el diff visual contra el fixture cuando un slice toca tokens/roles/presets, y falla si difiere
// más allá de antialiasing.
//
// LA DOCTRINA QUE ESTE ARCHIVO INSTAURA (§ asiento en DECISIONS.md, GUARDA-COLOR-NAYOLI-1): la
// regla pasa de "Nayoli byte-idéntico" (VERIFICAR-NAYOLI-BYTE-1, `verificar-nayoli.ts`) a "Nayoli
// VISUALMENTE idéntico, MEDIDO en cada slice que toca el sistema de color". El diff de bytes no es
// la vara — un fallback de CSS custom property puede resolver al MISMO color con bytes distintos
// (medido en VERIFICAR-NAYOLI-BYTE-1: 3 rutas con diff de bytes, 0 con efecto visual). La vara es
// el PÍXEL, y por eso esta guarda diffea PÍXELES (§ `verificar-nayoli-visual.ts`, GUARDA-COLOR-
// NAYOLI-1 — el modo determinista y el fixture fijo que este archivo consume viven ahí), no bytes.
//
// ─── MÉTODO ───────────────────────────────────────────────────────────────────────────────────
//   1. `git diff --name-only` entre el MERGE-BASE de `HEAD` con `main` y `HEAD` — TODO lo que la
//      rama actual cambia frente a `main`, no sólo el último commit (una rama de varios slices
//      puede tocar color en un slice temprano y no en el último; el gate corre sobre la RAMA
//      completa, no sobre un commit aislado — § `merge_gated`, el owner gatea la rama entera).
//   2. Se intersecta contra `SISTEMA_DE_COLOR` (abajo, UN lugar nombrado, con el motivo de cada
//      entrada). Intersección VACÍA → sale con `exit 0` SIN levantar Postgres ni Playwright ni
//      compilar nada — el costo de esta guarda para un slice que no toca color es un `git diff` y
//      una intersección de arrays: milisegundos.
//   3. Intersección NO vacía → construye y arranca la rama ACTUAL (reusa el mismo arnés que
//      `verificar-nayoli-visual.ts` — Postgres efímero propio, `migrate deploy` + el seed canónico
//      + los 5 productos sintéticos, Playwright aislado, el mismo modo DETERMINISTA), captura las
//      mismas 6 rutas + 2 hovers, y diffea cada una contra el fixture commiteado en
//      `tests/visual/nayoli/`. Un píxel más allá de antialiasing → `exit 1` con el reporte por
//      ruta. Actualizar el fixture (un cambio DELIBERADO a Nayoli) es decisión del owner — corre
//      `tsx scripts/verificar-nayoli-visual.ts --generar-fixture` a mano, nunca en silencio desde
//      esta guarda.
//
// ─── PUERTOS Y BASE PROPIOS ──────────────────────────────────────────────────────────────────────
// Distintos de los otros tres arneses (test-integracion.sh: 55432; capturar-seccion.sh:
// 55434/3477; verificar-nayoli.ts: 55438/3491/3492; verificar-nayoli-visual.ts: 55439/3493/3494) —
// puede correr al lado de cualquiera de ellos sin pisarse.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  RAIZ,
  FIXTURE_DIR,
  CLAVES_FIXTURE,
  levantarPostgres,
  migrarYSembrar,
  sembrarEstadosProductCard,
  entornoArbol,
  construir,
  arrancar,
  detener,
  esperarListo,
  cargarPlaywright,
  capturarArbol,
  compararPng,
  type CapturaArbol,
} from "./verificar-nayoli-visual";

const PUERTO_PG = 55440;
const BASE_PG = "guardacolor";
const PUERTO_APP = 3495;

// ─── EL SISTEMA DE COLOR — un lugar nombrado, un motivo por entrada ─────────────────────────────
// Lo que un archivo de esta lista cambia puede mover un PÍXEL de Nayoli sin preset. La lista NO
// es "todo lo que menciona un color" — es lo que participa en la CADENA que resuelve `--sf-*` (o
// lo que declara los defaults/schema que esa cadena consume) para un despliegue SIN preset. Vence
// igual que el resto de las listas de este repo (§ CLAUDE.md, "ESTA LISTA VENCE") — re-medir
// contra el código, no contra el nombre.
const SISTEMA_DE_COLOR: { ruta: string; motivo: string }[] = [
  { ruta: "lib/config/palette-derive.ts", motivo: "el motor: deriva las ~32 tintas del storefront desde las 3 raíces (fondo·tinta·acento)" },
  { ruta: "lib/config/themes.ts", motivo: "el catálogo de PRESETS (temas completos por-cliente) y su merge sobre content" },
  { ruta: "app/globals.css", motivo: "los defaults --sf-* que Nayoli usa SIN preset (§ byte-idéntico/visualmente-idéntico)" },
  { ruta: "lib/config/esquema-style.ts", motivo: "emite el CSS del eje ESQUEMA — rol distinto de la paleta, mismo storefront" },
  { ruta: "lib/config/site-content-defaults.ts", motivo: "los defaults de content.tema/ejes/esquemas — lo que Nayoli resuelve sin fila en SiteContent" },
  { ruta: "lib/config/site-content-schema.ts", motivo: "valida tema/esquemas al guardar — un schema más laxo/estricto cambia qué llega a pintarse" },
  { ruta: "lib/config/fuentes.ts", motivo: "catálogo de pares tipográficos del storefront" },
  { ruta: "lib/config/formas.ts", motivo: "catálogo de presets de FORMA (radios, bordes) del storefront" },
];

export function archivosDelSistemaDeColor(): string[] {
  return SISTEMA_DE_COLOR.map((e) => e.ruta);
}

export function archivosCambiados(baseRef: string): string[] {
  const merge = spawnSync("git", ["merge-base", "HEAD", baseRef], { cwd: RAIZ, encoding: "utf8" });
  if (merge.status !== 0) {
    throw new Error(`git merge-base HEAD ${baseRef} falló: ${merge.stderr}`);
  }
  const baseSha = merge.stdout.trim();
  const diff = spawnSync("git", ["diff", "--name-only", `${baseSha}..HEAD`], { cwd: RAIZ, encoding: "utf8" });
  if (diff.status !== 0) {
    throw new Error(`git diff --name-only ${baseSha}..HEAD falló: ${diff.stderr}`);
  }
  return diff.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function interseccionSistemaColor(cambiados: string[]): string[] {
  const sistema = new Set(archivosDelSistemaDeColor());
  return cambiados.filter((c) => sistema.has(c));
}

function rutaDeClave(captura: CapturaArbol, clave: string): string {
  if (clave === "hover-automatica") return captura.hoverAutomatica;
  if (clave === "hover-eleccion") return captura.hoverEleccion;
  const nombre = clave.replace(/^ruta-/, "");
  const ruta = captura.rutas[nombre];
  if (!ruta) throw new Error(`Clave de fixture desconocida: ${clave}`);
  return ruta;
}

function verificarFixtureCompleto(): void {
  const faltantes = CLAVES_FIXTURE.filter((c) => !existsSync(join(FIXTURE_DIR, `${c}.png`)));
  if (faltantes.length > 0) {
    throw new Error(
      `Falta(n) archivo(s) de fixture en ${FIXTURE_DIR}: ${faltantes.join(", ")}.\n` +
        `Generalos con: tsx scripts/verificar-nayoli-visual.ts --generar-fixture`,
    );
  }
}

async function main(): Promise<void> {
  console.log("─".repeat(78));
  console.log("GUARDA-COLOR-NAYOLI-1 — ¿la rama toca el sistema de color de Nayoli?");
  console.log("─".repeat(78));

  const cambiados = archivosCambiados("main");
  const tocados = interseccionSistemaColor(cambiados);

  if (tocados.length === 0) {
    console.log("✔ La rama (contra main) NO toca ningún archivo del sistema de color — guarda no aplica.");
    console.log(`  (${cambiados.length} archivo(s) cambiados en total, ninguno de la lista de § SISTEMA_DE_COLOR.)`);
    process.exitCode = 0;
    return;
  }

  console.log(`✗ La rama SÍ toca el sistema de color — ${tocados.length} archivo(s):`);
  for (const t of tocados) {
    const motivo = SISTEMA_DE_COLOR.find((e) => e.ruta === t)?.motivo ?? "";
    console.log(`    ${t}${motivo ? ` — ${motivo}` : ""}`);
  }
  console.log("\n▸ Corriendo el diff visual contra el fixture fijo de Nayoli (tests/visual/nayoli/)…");

  verificarFixtureCompleto();

  const playwright = cargarPlaywright();
  const pg = await levantarPostgres(PUERTO_PG, BASE_PG);
  try {
    const envMigra = {
      ...process.env,
      DATABASE_URL: pg.databaseUrl,
      DIRECT_DATABASE_URL: pg.databaseUrl,
      BETTER_AUTH_SECRET: "guarda-color-secreto-inerte-0123456789",
      BETTER_AUTH_URL: `http://127.0.0.1:${PUERTO_APP}`,
    };
    migrarYSembrar(envMigra);
    sembrarEstadosProductCard(pg.databaseUrl);

    const env = entornoArbol(PUERTO_APP, pg.databaseUrl);
    construir(RAIZ, env, "guarda-color");
    console.log(`▸ [guarda-color] next start en :${PUERTO_APP}…`);
    const child = arrancar(RAIZ, env, PUERTO_APP);
    let salida = "";
    child.stdout?.on("data", (d) => (salida += String(d)));
    child.stderr?.on("data", (d) => (salida += String(d)));
    const origen = `http://127.0.0.1:${PUERTO_APP}`;
    try {
      await esperarListo(`${origen}/`, 90_000).catch((e) => {
        throw new Error(`[guarda-color] next start no respondió a tiempo: ${e}\n\n── stdout/stderr ──\n${salida}`);
      });
      console.log("✔ [guarda-color] next start responde.");

      const browser = await playwright.chromium.launch({ headless: true });
      let captura: CapturaArbol;
      try {
        captura = await capturarArbol(browser, origen, "guarda-color", join(RAIZ, ".scratch", "guarda-color", "capturas"));
      } finally {
        await browser.close();
      }

      console.log("\n" + "─".repeat(78));
      console.log("RESULTADO MEDIDO — diff de píxeles, rama actual vs. fixture de Nayoli:");
      console.log("─".repeat(78));
      let huboDiferencia = false;
      for (const clave of CLAVES_FIXTURE) {
        const pFixture = join(FIXTURE_DIR, `${clave}.png`);
        const pRama = rutaDeClave(captura, clave);
        const r = compararPng(pFixture, pRama, clave, join(RAIZ, ".scratch", "guarda-color", "diffs", `${clave}.png`));
        if (r.dimensionesDistintas) {
          huboDiferencia = true;
          console.log(`  ${clave} → TAMAÑOS DISTINTOS: fixture ${r.dimensionesDistintas.main} vs. rama ${r.dimensionesDistintas.rama}.`);
        } else if (r.identico) {
          console.log(`  ${clave} → IDÉNTICO (0/${r.totalPixeles} px, consciente de AA; crudo: ${r.pixelesDistintosCrudo})`);
        } else {
          huboDiferencia = true;
          const caja = r.cajaDiff ? ` — caja [${r.cajaDiff.x0},${r.cajaDiff.y0}]–[${r.cajaDiff.x1},${r.cajaDiff.y1}]` : "";
          console.log(
            `  ${clave} → DIFIERE: ${r.pixelesDistintosConscienteAA}/${r.totalPixeles} px (consciente de AA), ${r.pixelesDistintosCrudo}/${r.totalPixeles} px (crudo)${caja}`,
          );
        }
      }

      if (huboDiferencia) {
        console.log("\n✗ Nayoli sin preset se ve DISTINTO — más allá de antialiasing. Si es un cambio");
        console.log("  DELIBERADO, actualizá el fixture a mano (nunca en silencio desde esta guarda):");
        console.log("  tsx scripts/verificar-nayoli-visual.ts --generar-fixture");
        process.exitCode = 1;
      } else {
        console.log("\n✔ Nayoli sin preset se ve IDÉNTICO al fixture — 0 diferencias más allá de antialiasing.");
        process.exitCode = 0;
      }
    } finally {
      await detener(child);
    }
  } finally {
    pg.detener();
  }
}

// Sólo corre si este archivo es el ENTRYPOINT — mismo motivo, y el mismo fix de `pathToFileURL`,
// que la guarda de `verificar-nayoli-visual.ts` (§ ese archivo: el repo vive bajo una ruta con
// espacio, y una concatenación `file://${...}` a mano nunca matchea `import.meta.url`).
const esEntrypoint = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  } catch {
    return false;
  }
})();

if (esEntrypoint) {
  main().catch((e) => {
    console.error("❌ guarda-color falló:", e instanceof Error ? e.stack ?? e.message : e);
    process.exitCode = 1;
  });
}
