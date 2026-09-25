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
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

// ─── EL SISTEMA DE COLOR — DERIVADO, no una lista a mano (§ GUARDA-COLOR-SISTEMA-LISTA-GAP-1) ──────
//
// `GUARDA-COLOR-NAYOLI-1` (arriba) escribió esta lista A MANO, y eso es EXACTAMENTE el anti-patrón
// que este repo ya resolvió una vez: `lib/config/panel-controles.ts` existe porque "una lista a mano
// de 'campos vs. controles' — eso es exactamente el problema" (§ su propio docstring,
// PANEL-REFLEJA-TIENDA-CHEQUEO-1). Medido al construir esta guarda (`GUARDA-COLOR-NAYOLI-1`): la lista
// a mano dejaba AFUERA `palette-style.ts`, `fuentes-style.ts`, `forma-style.ts`, `palette-schema.ts` y
// `theme-mirador.ts` — cinco archivos que SÍ mueven un píxel de Nayoli sin preset, en silencio, porque
// nadie los agregó a la lista. Este bloque reemplaza la lista por un conjunto DERIVADO.
//
// EL MECANISMO: TRES archivos de `lib/config/` son el MOTOR — `palette-derive.ts` (deriva las tintas
// del storefront desde las 3 raíces), `fuentes.ts` (el catálogo de pares tipográficos) y `formas.ts`
// (el catálogo de radios/formas) — los ÚNICOS tres del directorio que declaran datos crudos de tema
// SIN importar ningún otro archivo de `lib/config/` (verificado: los tres tienen CERO imports
// relativos dentro del directorio — son la hoja del árbol, no un nodo intermedio). Un archivo de
// `lib/config/` entra al sistema si IMPORTA DIRECTAMENTE a uno de esos tres.
//
// "DIRECTAMENTE", no "transitivamente a través de cualquier archivo": `site-content-defaults.ts` es un
// HUB que también importan `menu-editor.ts`, `panel-controles.ts`, `avisos-configuracion.ts` y los
// tres `site-content-{blobs,read,write}.ts`/`site-content.ts` — por razones que NO tienen nada que ver
// con color (tipos de menú, de banda, de blobs). Medido: un cierre TRANSITIVO sin cortar en el hub
// arrastra 20 archivos de `lib/config/`, contra los 12 reales que el censo del owner midió — la misma
// clase de sobre-alcance que "engorda hasta todo el repo". Cortar en "importa DIRECTAMENTE la raíz" es
// la frontera que separa a los NUEVE consumidores reales del motor de los siete que sólo pasan por el
// hub por otro motivo.
//
// `email-colors.ts` entra por esta regla y NO era parte del hueco medido por el owner: importa
// `palette-derive.ts` de verdad (deriva los 6 colores de los correos de la MISMA paleta, § Los
// COLORES de los correos DERIVAN de la paleta). Tocarlo no puede mover un píxel del STOREFRONT — los
// correos son otra superficie, que esta guarda no captura — pero cumple la MISMA propiedad que todos
// los demás miembros: importa el motor directamente. Queda adentro a propósito: correr el diff visual
// de más una vez que un slice edite email-colors.ts es más barato que mantener una segunda regla para
// excluirlo, y esa segunda regla sería otra vez una lista a mano de excepciones.
//
// DOS ANCLAS DECLARADAS — la ÚNICA parte a mano que queda, chica y con su razón, porque la propiedad
// de arriba no las alcanza (§ ANCLAS_DECLARADAS, abajo):
//   - `app/globals.css` no es un módulo TS: no puede aparecer en un grafo de imports construido a
//     partir de `import ... from`. Es el archivo de los defaults `--sf-*` que Nayoli usa SIN preset.
//   - `lib/config/site-content-schema.ts` valida `esquemas` (`esquemasEditableSchema`, el mapa
//     banda→esquema que `esquema-style.ts` consume) al guardar, pero su ÚNICO import relativo es
//     `site-content-defaults.ts` (por `BANDA_IDS`/`MENU_ITEM_IDS`/`MENU_CTA_DESTINOS`, ninguno nombra
//     al motor) — la regla de "importa DIRECTAMENTE la raíz" no lo alcanza sin TAMBIÉN alcanzar a los
//     siete hub-consumers de arriba. Se declara acá, con su razón, en vez de forzar la regla derivada
//     a tragarse el hub entero por un solo archivo.
//
// CALIBRACIÓN (§ `lib/config/guarda-color-lista.test.ts`): el conjunto derivado CONTIENE los 12 del
// censo (7 que ya estaban en la lista vieja + 5 del hueco medido) y NO contiene un archivo ajeno al
// color — `lib/orders.ts`, `lib/checkout/*`, `lib/pagos/*` quedan afuera por CONSTRUCCIÓN: la búsqueda
// está acotada a `lib/config/`, nunca al resto del repo. Vence igual que el resto de las listas de este
// repo (§ CLAUDE.md, "ESTA LISTA VENCE") si el día de mañana el motor deja de tener exactamente estos
// TRES archivos-raíz — re-medir contra el código, no contra este comentario.

/** Los TRES archivos-raíz del motor de tema — hoja del árbol de imports de `lib/config/` (cero
 *  imports relativos dentro del directorio). Es la ÚNICA lista a mano que decide QUIÉN es "la raíz";
 *  todo lo demás se deriva de acá. */
const RAICES_MOTOR = ["palette-derive.ts", "fuentes.ts", "formas.ts"] as const;

/** Las DOS anclas declaradas — lo que la propiedad derivada no puede alcanzar, con su razón (§ el
 *  comentario de cabecera de este bloque). Lista chica, y CADA entrada dice por qué está acá en vez
 *  de derivarse. */
const ANCLAS_DECLARADAS: { ruta: string; motivo: string }[] = [
  {
    ruta: "app/globals.css",
    motivo: "los defaults --sf-* que Nayoli usa SIN preset — no es un módulo TS, no entra al grafo de imports",
  },
  {
    ruta: "lib/config/site-content-schema.ts",
    motivo:
      "valida `esquemas` (banda→esquema) al guardar, el eje que esquema-style.ts consume — su único import relativo es site-content-defaults.ts (el hub), no un archivo-raíz directo",
  },
];

const LIB_CONFIG_DIR = join(RAIZ, "lib", "config");

// `import` o `export ... from` relativos (`./archivo`), incluidos los que abren en una línea y cierran
// varias después (`[^;]` matchea saltos de línea igual que cualquier char, sin necesitar el flag `s`).
const IMPORT_O_EXPORT_RELATIVO = /^(?:import|export)[^;]*from\s+["'](\.[^"']+)["'];?/gm;

/** Los specifiers `./archivo` que UN archivo de `lib/config/` importa (o re-exporta), normalizados a
 *  nombre de archivo con extensión `.ts` — para comparar contra `RAICES_MOTOR` sin resolver módulos de
 *  verdad (barato: un `readFileSync` + una regex, nada de TS compiler API). */
function importsRelativosDe(archivo: string): string[] {
  const src = readFileSync(join(LIB_CONFIG_DIR, archivo), "utf8");
  IMPORT_O_EXPORT_RELATIVO.lastIndex = 0;
  const specs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = IMPORT_O_EXPORT_RELATIVO.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith("./")) continue;
    specs.add(`${spec.slice(2).replace(/\.(ts|tsx|js)$/, "")}.ts`);
  }
  return [...specs];
}

/** Todo `.ts` de `lib/config/`, sin sus tests — el universo sobre el que corre la derivación. */
export function archivosLibConfig(): string[] {
  return readdirSync(LIB_CONFIG_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();
}

/** Los archivos de `lib/config/` (sin los `RAICES_MOTOR` mismos) que importan DIRECTAMENTE uno de
 *  ellos — el primer salto desde la raíz, nunca a través de un hub. */
export function importadoresDirectosDeRaices(): { ruta: string; motivo: string }[] {
  const raices = new Set<string>(RAICES_MOTOR);
  const resultado: { ruta: string; motivo: string }[] = [];
  for (const archivo of archivosLibConfig()) {
    if (raices.has(archivo)) continue;
    const importados = importsRelativosDe(archivo).filter((d) => raices.has(d));
    if (importados.length === 0) continue;
    resultado.push({
      ruta: `lib/config/${archivo}`,
      motivo: `importa directamente ${importados.map((r) => `lib/config/${r}`).join(" y ")}`,
    });
  }
  return resultado;
}

/** Descripciones fijas de los tres archivos-raíz, conservadas de la lista vieja (§ arriba: son las
 *  únicas tres entradas cuyo motivo no se puede derivar de "a quién importan" — son la raíz). */
const MOTIVO_RAIZ: Record<(typeof RAICES_MOTOR)[number], string> = {
  "palette-derive.ts": "el motor: deriva las ~32 tintas del storefront desde las 3 raíces (fondo·tinta·acento)",
  "fuentes.ts": "catálogo de pares tipográficos del storefront",
  "formas.ts": "catálogo de presets de FORMA (radios, bordes) del storefront",
};

/** El conjunto DERIVADO completo: los tres archivos-raíz + quien los importa directamente + las dos
 *  anclas declaradas. Único punto que `main()` y el gate consultan — nunca una lista a mano. */
export function sistemaDeColorDerivado(): { ruta: string; motivo: string }[] {
  const raices = RAICES_MOTOR.map((r) => ({ ruta: `lib/config/${r}`, motivo: MOTIVO_RAIZ[r] }));
  return [...raices, ...importadoresDirectosDeRaices(), ...ANCLAS_DECLARADAS].sort((a, b) =>
    a.ruta.localeCompare(b.ruta),
  );
}

const SISTEMA_DE_COLOR: { ruta: string; motivo: string }[] = sistemaDeColorDerivado();

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
