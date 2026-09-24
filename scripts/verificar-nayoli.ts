// scripts/verificar-nayoli.ts — § VERIFICAR-NAYOLI-BYTE-1
//
// LO QUE EL OWNER PIDIÓ, TEXTUAL: "Nayoli byte-idéntico, MEDIDO: build de main y de la rama con
// la config de Nayoli, y diff del HTML renderizado y del CSS generado de sus rutas públicas
// (home, catálogo, producto, checkout). Resultado esperado: diff vacío. 'Por construcción' no
// cuenta como prueba." Este script hace exactamente eso — mide, no asume — y termina con exit
// code ≠ 0 si el diff NO está vacío, para que `pre-merge` lo pueda frenar.
//
// "CONFIG DE NAYOLI = LOS DEFAULTS, SIN PRESET." No se aplica ningún preset de `themes.ts`: el
// seed siembra `SiteSetting` con la identidad real de Nayoli (nombre, tagline, whatsapp…, igual
// que hace `prisma/seed.ts` en cualquier entorno de desarrollo) y **no** siembra `SiteContent`,
// así que el storefront resuelve todo su contenido contra los DEFAULTS del código
// (`lib/config/site-content-defaults.ts`) — el mismo estado que `capturar-seccion.ts` llama
// informalmente "Nayoli" cuando corre sin `--preset` (§ su docstring).
//
// ─── MÉTODO ───────────────────────────────────────────────────────────────────────────────────
//   1. Un Postgres EFÍMERO propio (mismo patrón que `scripts/postgres-efimero.sh`, reimplementado
//      acá en TS — no en un `.sh` — porque `touches:` de este slice es SÓLO este archivo +
//      package.json + DECISIONS.md; no hay `scripts/verificar-nayoli.sh` que tocar).
//   2. `migrate deploy` UNA VEZ sobre esa base (el schema de `main` y el de la rama son
//      IDÉNTICOS — medido con `git diff main..HEAD --stat -- packages/core/prisma/`, sin salida
//      — así que una sola migración sirve a los dos árboles) + el seed CANÓNICO
//      (`prisma/seed.ts`, también sin diff entre las dos ramas) UNA VEZ. Los DOS árboles leen
//      la MISMA base — mismo producto, mismo slug (`cafe-nayoli-grano-250g`), determinista.
//   3. Un `git worktree` de `main` en `.scratch/` (gitignored) — la copia de trabajo actual NO
//      se toca para construir `main`; se levanta un checkout aparte de su HEAD real. Como
//      `node_modules` y `packages/*` NO tienen diff entre las dos ramas (medido: cero archivos
//      cambiados bajo `packages/`, y `package.json`/`package-lock.json` sin diff de
//      dependencias — sólo scripts nuevos), el worktree SYMLINKEA `node_modules` de la rama en
//      vez de reinstalar: ahorra tiempo y red sin perder fidelidad, porque el código que de
//      verdad se compara (`app/`, `components/`, `lib/`) sí vive íntegro en cada árbol.
//   4. `next build` + `next start` de CADA árbol, en su propio puerto, SECUENCIAL (nunca los dos
//      a la vez): cada uno tiene su propio `.next/` físico (el de la rama es el del propio repo;
//      el de `main` vive dentro del worktree), así que no hay pisada de artefacto — pero sí
//      ahorra la complejidad de coordinar dos servidores vivos para una medición que no lo
//      necesita (las cuatro rutas son GET anónimos, no hay estado que compartir entre árboles).
//   5. `fetch()` PLANO de las 4 rutas públicas — NO Playwright. El storefront es
//      `force-dynamic` (`app/(storefront)/layout.tsx`) y las cuatro rutas no dependen de JS del
//      cliente para su HTML inicial (checkout con carrito vacío es el caso límite, verificado
//      abajo): lo que un `fetch` anónimo recibe ES el HTML que Next generó server-side, sin
//      necesidad de un navegador que lo pinte.
//   6. NORMALIZACIÓN, medida empíricamente ANTES de comprometerse a una regla — no adivinada:
//      se corrieron DOS builds independientes de la MISMA rama (código sin tocar entre medio) y
//      se diffearon sus salidas para separar "ruido de build" de "diferencia de fuente". El
//      resultado (documentado en el asiento del slice) fue que TODO el ruido vive en dos sitios:
//        (a) los bloques `<script>…</script>` — cargan tanto los `<script src=…>` de chunks
//            (cuyos NOMBRES sí son estables, medido, pero no hace falta compararlos: el spec no
//            pide diffear JS) como el payload RSC/Flight inline (`self.__next_f.push(...)`), que
//            SÍ es no-determinista build a build: los IDs de módulo internos de Turbopack para
//            las referencias de componente (p. ej. el número que sigue a `f:I[`) NO son estables
//            entre invocaciones separadas de `next build` sobre el MISMO código — se comprobó
//            reconstruyendo dos veces sin cambiar una línea y viendo esos números cambiar. Ese
//            payload es una segunda copia de lo que el HTML YA renderizó (Next lo usa para
//            hidratar sin re-pedir al servidor); no hay señal de "cómo se ve" que viva SÓLO ahí.
//        (b) el ORDEN de los hijos directos de `<head>` — medido: la MISMA build, corrida dos
//            veces, ubica `<meta name="theme-color">` en una posición distinta dentro de
//            `<head>` cada vez (streaming/hoisting de metadata de React 19, no depende del
//            código). El CONTENIDO de cada tag es idéntico; sólo el ORDEN varía.
//      La normalización, entonces: (a) se retiran los `<script>` completos y los `<link
//      rel="preload" as="script">`/`<link rel="modulepreload">` (aviso de carga de esos mismos
//      chunks, mismo ruido); (b) los hijos directos de `<head>` se ORDENAN alfabéticamente antes
//      de comparar. NINGUNA otra normalización demostró hacer falta: con sólo estas dos, dos
//      builds independientes de la MISMA rama dieron HTML NORMALIZADO IDÉNTICO en las 4 rutas —
//      así que cualquier diferencia que sobreviva a esto, comparando main vs. la rama, es una
//      diferencia de FUENTE, no de build. (No hubo que tocar buildId/nonces/timestamps: no
//      aparecen fuera de los `<script>` que ya se retiran — medido, no asumido; ver el asiento.)
//   7. CSS: se juntan los `<link rel="stylesheet">` de las 4 rutas (medido: las 4 enlazan el
//      MISMO único archivo CSS global — un solo `<link>` por HTML, mismo href en las 4), se
//      descarga el contenido de cada href DISTINTO una vez y se compara el CONTENIDO (nunca el
//      nombre del archivo, que lleva un hash).
//   8. `diff -u` (binario del sistema, sin agregar una dependencia npm) sobre archivos temporales
//      normalizados — si no está disponible, cae a un comparador de común-prefijo/sufijo propio
//      (ver `diffTexto`) que igual reporta la región que difiere.
//
// LÍMITE DECLARADO: esto NO reemplaza el gate visual del owner (capa 3) — mide bytes, no gusto.
// Y NO builds `main`/rama con NINGÚN preset de tema: "Nayoli" es exactamente "sin preset, con
// el SiteSetting real de Nayoli sembrado", tal como lo pidió el owner.
import { spawnSync, spawn, type ChildProcess } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORTE_DIR = join(RAIZ, ".scratch", "verificar-nayoli-reporte");

// Puertos y base PROPIOS — distintos de los que ya usan test-integracion.sh (55432/3477 no
// aplica ahí) y capturar-seccion.sh (55434, 3477), para poder correr uno al lado del otro sin
// pisarse si alguna vez hiciera falta.
const PUERTO_PG = 55438;
const BASE_PG = "verificarnayoli";
const PUERTO_MAIN = 3491;
const PUERTO_RAMA = 3492;

const WORKTREE_MAIN = join(RAIZ, ".scratch", "verificar-nayoli-main");

// El producto sembrado por `prisma/seed-products.ts` con slug ESTABLE — el mismo en main y en
// la rama, porque ese archivo no tiene diff entre las dos (medido).
const SLUG_PRODUCTO = "cafe-nayoli-grano-250g";
const RUTAS = ["/", "/tienda", `/tienda/${SLUG_PRODUCTO}`, "/checkout"] as const;

// ─── Postgres efímero, reimplementado acá (no en un .sh — ver la cabecera) ──────────────────────
// Mismo mecanismo que `scripts/postgres-efimero.sh`: cluster propio en un temp dir, sólo TCP
// (`-k ''`: el datadir vive bajo un path que puede superar los 103 bytes del socket unix),
// puerto propio, teardown garantizado.
interface PgEfimero {
  datadir: string;
  databaseUrl: string;
  detener(): void;
}

function puertoLibre(puerto: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(puerto, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

async function levantarPostgres(puerto: number, base: string): Promise<PgEfimero> {
  for (const bin of ["initdb", "pg_ctl", "psql"]) {
    const chequeo = spawnSync("which", [bin]);
    if (chequeo.status !== 0) {
      throw new Error(
        `Falta el binario "${bin}" de Postgres. Instálalo con: brew install postgresql@14 (y añade su bin al PATH).`,
      );
    }
  }
  if (!(await puertoLibre(puerto))) {
    throw new Error(`El puerto ${puerto} está ocupado — ¿quedó un cluster de una corrida anterior?`);
  }

  const datadir = join(mkdtempSync(join(tmpdir(), "verificar-nayoli-pg-")), "pg");
  const log = datadir + ".log";

  console.log(`▸ Levantando Postgres efímero en :${puerto}…`);
  let r = spawnSync("initdb", ["-D", datadir, "-U", "postgres", "--auth=trust"], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("initdb falló.");

  r = spawnSync(
    "pg_ctl",
    ["-D", datadir, "-o", `-p ${puerto} -k '' -h 127.0.0.1`, "-l", log, "-w", "start"],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("pg_ctl start falló — ver el log arriba.");

  const databaseUrl = `postgresql://postgres@127.0.0.1:${puerto}/${base}`;
  r = spawnSync("psql", [`postgresql://postgres@127.0.0.1:${puerto}/postgres`, "-q", "-c", `CREATE DATABASE ${base};`], {
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("CREATE DATABASE falló.");

  return {
    datadir,
    databaseUrl,
    detener() {
      spawnSync("pg_ctl", ["-D", datadir, "stop", "-m", "immediate"], { stdio: "inherit" });
      rmSync(dirname(datadir), { recursive: true, force: true });
    },
  };
}

// ─── Migrar + sembrar UNA vez (schema y seed idénticos en main y en la rama, medido) ────────────
function migrarYSembrar(env: NodeJS.ProcessEnv): void {
  console.log("▸ Aplicando migraciones (una vez, sirve a los dos árboles)…");
  let r = spawnSync("npm", ["run", "--silent", "db:deploy", "-w", "@duna/core"], { cwd: RAIZ, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("migrate deploy falló.");

  console.log("▸ Sembrando (prisma/seed.ts — la identidad real de Nayoli + el catálogo, sin SiteContent)…");
  r = spawnSync("npx", ["tsx", "prisma/seed.ts"], { cwd: RAIZ, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("El seed falló.");
}

// ─── El worktree de `main` ───────────────────────────────────────────────────────────────────
function prepararWorktreeMain(): string {
  if (existsSync(WORKTREE_MAIN)) {
    console.log("▸ Removiendo un worktree de main dejado por una corrida anterior…");
    spawnSync("git", ["worktree", "remove", "--force", WORKTREE_MAIN], { cwd: RAIZ, stdio: "inherit" });
    rmSync(WORKTREE_MAIN, { recursive: true, force: true });
  }
  console.log("▸ Creando worktree de `main` en " + WORKTREE_MAIN + " (detached, HEAD real de main)…");
  const r = spawnSync("git", ["worktree", "add", "--detach", WORKTREE_MAIN, "main"], { cwd: RAIZ, stdio: "inherit" });
  if (r.status !== 0) throw new Error("git worktree add falló.");

  // node_modules y packages/* no tienen diff entre main y la rama (medido) — symlinkear en vez
  // de `npm install` ahorra tiempo/red sin perder fidelidad: el código bajo prueba (app/,
  // components/, lib/) SÍ vive completo y propio dentro del worktree.
  symlinkSync(join(RAIZ, "node_modules"), join(WORKTREE_MAIN, "node_modules"), "dir");

  // `packages/*` del PROPIO checkout del worktree se BORRAN, sin reemplazo — medido el porqué:
  // symlinkear esa carpeta (en vez de borrarla) deja DOS rutas reales para "el mismo" tipo de
  // Prisma — una alcanzada por `node_modules/@duna/core` (que ya resuelve, vía el symlink de
  // arriba, a `RAIZ/packages/core`) y otra por la ruta PROPIA del worktree
  // (`<worktree>/packages/core/…`, que el `include: ["**/*.ts"]` de tsconfig escanea como
  // ARCHIVO RAÍZ del proyecto, con SU PROPIA identidad de módulo, sin colapsar al realpath de
  // RAIZ) — y TypeScript trata a los dos como módulos NOMINALMENTE distintos: "Type
  // 'AggregateOrder[P][P]' is not assignable to type '… AggregateOrder[P][P] : never'" entre
  // dos `generated/prisma/models/Order` (uno bajo `.scratch/…`, otro bajo la raíz), aun
  // symlinkeando la carpeta entera. La única forma de que sólo exista UNA ruta de acceso es que
  // el worktree NO tenga su propio `packages/core`/`design-system` en absoluto: nada de
  // `app/`/`components/`/`lib/` los importa por ruta relativa (medido, `grep` sin resultados) —
  // TODO pasa por el specifier `@duna/*`, que node_modules ya resuelve al ÚNICO
  // `RAIZ/packages/*` real. Borrarlos no pierde nada de "main": ese contenido no tiene diff
  // entre main y la rama (medido), así que no hay una versión de main que se esté dejando de
  // usar.
  rmSync(join(WORKTREE_MAIN, "packages", "core"), { recursive: true, force: true });
  rmSync(join(WORKTREE_MAIN, "packages", "design-system"), { recursive: true, force: true });
  return WORKTREE_MAIN;
}

function quitarWorktreeMain(): void {
  spawnSync("git", ["worktree", "remove", "--force", WORKTREE_MAIN], { cwd: RAIZ, stdio: "inherit" });
  rmSync(WORKTREE_MAIN, { recursive: true, force: true });
}

// ─── Build + start de un árbol ───────────────────────────────────────────────────────────────
function entornoArbol(puerto: number, databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PORT: String(puerto),
    DATABASE_URL: databaseUrl,
    DIRECT_DATABASE_URL: databaseUrl,
    // Dummies defensivos, mismo criterio que capturar-seccion.ts: el storefront no importa
    // lib/auth, pero `next build` recorre (para "Collecting page data") rutas de admin/API que
    // sí lo hacen, y las páginas pre-auth (login, aceptar-invitación…) se PRERENDERIZAN al build
    // — necesitan poder leer SiteSetting de la base efímera, y better-auth necesita un secret.
    BETTER_AUTH_SECRET: "verificar-nayoli-secreto-inerte-0123456789",
    BETTER_AUTH_URL: `http://127.0.0.1:${puerto}`,
  };
}

function construir(cwd: string, env: NodeJS.ProcessEnv, etiqueta: string): void {
  console.log(`▸ [${etiqueta}] next build…`);
  const r = spawnSync("npx", ["next", "build"], { cwd, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`[${etiqueta}] next build falló.`);
  console.log(`✔ [${etiqueta}] build listo.`);
}

// Mismo mecanismo de grupo-de-procesos que capturar-seccion.ts (§ ARNES-NEXT-START-PROCESO-
// HUERFANO-1): `npx` → `next` → el `next-server` real quedan en el MISMO grupo (detached=true
// hace de este hijo el líder), así que matar el grupo con PID negativo alcanza al proceso que de
// verdad tiene el puerto abierto, no sólo al `npx` de arriba.
function arrancar(cwd: string, env: NodeJS.ProcessEnv, puerto: number): ChildProcess {
  return spawn("npx", ["next", "start", "-p", String(puerto)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function detener(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  const pid = child.pid;
  const matarArbol = (señal: NodeJS.Signals) => {
    if (pid === undefined) return void child.kill(señal);
    try {
      process.kill(-pid, señal);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") child.kill(señal);
    }
  };
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    matarArbol("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) matarArbol("SIGKILL");
    }, 5000);
  });
}

async function esperarListo(url: string, timeoutMs: number): Promise<void> {
  const limite = Date.now() + timeoutMs;
  let ultimoError: unknown;
  while (Date.now() < limite) {
    try {
      await fetch(url);
      return;
    } catch (e) {
      ultimoError = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`${url} no respondió en ${timeoutMs}ms (último error: ${String(ultimoError)})`);
}

// ─── Fetch de las rutas + recolección de CSS ─────────────────────────────────────────────────
interface CapturaArbol {
  htmlPorRuta: Record<string, string>;
  cssPorHref: Record<string, string>;
}

function extraerHrefsCss(html: string): string[] {
  const hrefs: string[] = [];
  const re = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

async function capturarArbol(origen: string, etiqueta: string): Promise<CapturaArbol> {
  const htmlPorRuta: Record<string, string> = {};
  const cssHrefs = new Set<string>();
  for (const ruta of RUTAS) {
    const res = await fetch(`${origen}${ruta}`);
    const html = await res.text();
    console.log(`  [${etiqueta}] GET ${ruta} → ${res.status}, ${html.length} bytes`);
    if (res.status !== 200) {
      throw new Error(`[${etiqueta}] ${ruta} respondió ${res.status}, esperaba 200 — no se puede medir el HTML.`);
    }
    htmlPorRuta[ruta] = html;
    for (const href of extraerHrefsCss(html)) cssHrefs.add(href);
  }
  const cssPorHref: Record<string, string> = {};
  for (const href of cssHrefs) {
    const url = href.startsWith("http") ? href : `${origen}${href}`;
    const res = await fetch(url);
    cssPorHref[href] = await res.text();
  }
  return { htmlPorRuta, cssPorHref };
}

async function buildStartCapturar(cwd: string, puerto: number, databaseUrl: string, etiqueta: string): Promise<CapturaArbol> {
  const env = entornoArbol(puerto, databaseUrl);
  construir(cwd, env, etiqueta);
  console.log(`▸ [${etiqueta}] next start en :${puerto}…`);
  const child = arrancar(cwd, env, puerto);
  let salida = "";
  child.stdout?.on("data", (d) => (salida += String(d)));
  child.stderr?.on("data", (d) => (salida += String(d)));
  const origen = `http://127.0.0.1:${puerto}`;
  try {
    await esperarListo(`${origen}/`, 90_000).catch((e) => {
      throw new Error(`[${etiqueta}] next start no respondió a tiempo: ${e}\n\n── stdout/stderr ──\n${salida}`);
    });
    console.log(`✔ [${etiqueta}] next start responde.`);
    return await capturarArbol(origen, etiqueta);
  } finally {
    await detener(child);
  }
}

// ─── Normalización — medida empíricamente, ver la cabecera (§6) ────────────────────────────────
// Dos builds INDEPENDIENTES de la MISMA rama, sin tocar una línea de código entre medio, dieron
// HTML normalizado IDÉNTICO en las 4 rutas con SÓLO estas dos reglas — ver el asiento del slice
// para la medición completa (qué se vio variar antes de normalizar, y qué no).
function normalizarHtml(html: string): string {
  // (a) Los bloques <script>…</script> — cargan el payload RSC/Flight (IDs de módulo de
  // Turbopack no-deterministas entre builds, medido) y las referencias a chunks JS (cuyo
  // CONTENIDO no es parte de lo que este slice mide). Ninguna de las dos cosas es "lo que el
  // visitante ve": Next SSR-ea el DOM real directamente en el HTML: fuera de <script> están los
  // mismos textos/atributos/clases que ese payload sólo repite para poder hidratar sin un
  // segundo viaje al servidor.
  let out = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  // Los <link> de precarga de esos mismos chunks — mismo ruido, sin contenido visible propio.
  out = out.replace(/<link[^>]*\bas="script"[^>]*\/?>/gi, "");
  out = out.replace(/<link[^>]*rel="modulepreload"[^>]*\/?>/gi, "");
  // (b) El ORDEN de los hijos directos de <head> no es estable entre renders (streaming de
  // metadata de React 19, medido con dos builds idénticas dando dos órdenes distintas) — el
  // CONTENIDO de cada tag sí lo es. Se ordenan alfabéticamente antes de comparar; cualquier tag
  // que sobre o falte de un lado sigue aaproviendo como diff (el multiset cambia).
  out = out.replace(/<head>([\s\S]*?)<\/head>/, (_m, inner: string) => {
    const tags = inner.match(/<[^>]+>/g) ?? [];
    tags.sort();
    return `<head>${tags.join("")}</head>`;
  });
  return out;
}

// ─── Diff — `diff -u` del sistema; sin él, un comparador de común-prefijo/sufijo propio ─────────
function tieneDiffBinario(): boolean {
  return spawnSync("which", ["diff"]).status === 0;
}

function diffConBinario(a: string, b: string, nombreA: string, nombreB: string): string {
  mkdirSync(REPORTE_DIR, { recursive: true });
  const pa = join(REPORTE_DIR, `${nombreA}.txt`);
  const pb = join(REPORTE_DIR, `${nombreB}.txt`);
  writeFileSync(pa, a);
  writeFileSync(pb, b);
  const r = spawnSync("diff", ["-u", pa, pb], { encoding: "utf8" });
  return r.stdout ?? "";
}

// Respaldo sin dependencias si `diff` no está en PATH: común-prefijo/sufijo, reporta el tramo
// que difiere en cada lado (truncado) — no es un unified diff, pero muestra el diff REAL.
function diffPropio(a: string, b: string): string {
  let inicio = 0;
  const min = Math.min(a.length, b.length);
  while (inicio < min && a[inicio] === b[inicio]) inicio++;
  let finA = a.length;
  let finB = b.length;
  while (finA > inicio && finB > inicio && a[finA - 1] === b[finB - 1]) {
    finA--;
    finB--;
  }
  const CTX = 80;
  const TOPE = 2000;
  return [
    `contexto antes: ${JSON.stringify(a.slice(Math.max(0, inicio - CTX), inicio))}`,
    `LADO A (${finA - inicio} bytes distintos, primeros ${TOPE}): ${JSON.stringify(a.slice(inicio, finA).slice(0, TOPE))}`,
    `LADO B (${finB - inicio} bytes distintos, primeros ${TOPE}): ${JSON.stringify(b.slice(inicio, finB).slice(0, TOPE))}`,
    `contexto después: ${JSON.stringify(a.slice(finA, finA + CTX))}`,
  ].join("\n");
}

function diffTexto(a: string, b: string, nombreA: string, nombreB: string): string {
  if (a === b) return "";
  return tieneDiffBinario() ? diffConBinario(a, b, nombreA, nombreB) : diffPropio(a, b);
}

// ─── main ─────────────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("─".repeat(78));
  console.log("VERIFICAR-NAYOLI-BYTE-1 — mide, no asume: build de main y de la rama con la");
  console.log("config de Nayoli (sin preset), diff del HTML renderizado + el CSS generado.");
  console.log("─".repeat(78));

  const pg = await levantarPostgres(PUERTO_PG, BASE_PG);
  let worktreeListo = false;
  try {
    const envMigra = {
      ...process.env,
      DATABASE_URL: pg.databaseUrl,
      DIRECT_DATABASE_URL: pg.databaseUrl,
      BETTER_AUTH_SECRET: "verificar-nayoli-secreto-inerte-0123456789",
      BETTER_AUTH_URL: `http://127.0.0.1:${PUERTO_RAMA}`,
    };
    migrarYSembrar(envMigra);

    const worktreeMain = prepararWorktreeMain();
    worktreeListo = true;

    // SECUENCIAL a propósito (§ cabecera, punto 4): sin necesidad de coordinar dos servidores
    // vivos para cuatro GETs anónimos.
    const capturaMain = await buildStartCapturar(worktreeMain, PUERTO_MAIN, pg.databaseUrl, "main");
    const capturaRama = await buildStartCapturar(RAIZ, PUERTO_RAMA, pg.databaseUrl, "rama");

    // ── Diff por ruta ──
    let huboDiferenciaReal = false;
    const resumen: string[] = [];
    for (const ruta of RUTAS) {
      const a = normalizarHtml(capturaMain.htmlPorRuta[ruta]);
      const b = normalizarHtml(capturaRama.htmlPorRuta[ruta]);
      const slug = ruta.replace(/\//g, "_") || "_raiz";
      const diff = diffTexto(a, b, `html-main${slug}`, `html-rama${slug}`);
      if (diff === "") {
        resumen.push(`  ${ruta} → VACÍO (idéntico, normalizado)`);
      } else {
        huboDiferenciaReal = true;
        resumen.push(`  ${ruta} → DIFIERE:\n${diff}`);
      }
    }

    // ── Diff de CSS — todos los hrefs distintos vistos en cualquiera de las 4 rutas, en CADA
    // árbol, concatenados en orden ESTABLE (ordenado por href) con un encabezado por archivo
    // para poder atribuir una diferencia a un archivo concreto si el set de hrefs difiriera. ──
    const hrefsMain = Object.keys(capturaMain.cssPorHref).sort();
    const hrefsRama = Object.keys(capturaRama.cssPorHref).sort();
    const cssMain = hrefsMain.map((h) => `/* ARCHIVO: ${h} */\n${capturaMain.cssPorHref[h]}`).join("\n");
    const cssRama = hrefsRama.map((h) => `/* ARCHIVO: ${h} */\n${capturaRama.cssPorHref[h]}`).join("\n");
    const diffCss = diffTexto(cssMain, cssRama, "css-main", "css-rama");
    if (diffCss === "") {
      resumen.push(`  CSS (${hrefsRama.length} archivo(s): ${hrefsRama.join(", ")}) → VACÍO (idéntico)`);
    } else {
      huboDiferenciaReal = true;
      resumen.push(`  CSS → DIFIERE (main: ${hrefsMain.join(", ") || "(ninguno)"}; rama: ${hrefsRama.join(", ") || "(ninguno)"}):\n${diffCss}`);
    }

    console.log("\n" + "─".repeat(78));
    console.log("RESULTADO MEDIDO — Nayoli (sin preset), main vs. rama:");
    console.log("─".repeat(78));
    for (const linea of resumen) console.log(linea);
    console.log("\nNormalizado: (a) bloques <script> + <link as=\"script\"/modulepreload> retirados");
    console.log("(payload RSC/Flight — IDs de módulo no-deterministas entre builds, medido);");
    console.log("(b) hijos de <head> ordenados alfabéticamente (orden de streaming no-determinista,");
    console.log("medido; el contenido de cada tag no se toca).");
    console.log(`\nReporte completo (de haber diffs) en: ${REPORTE_DIR}`);

    if (huboDiferenciaReal) {
      console.log("\n✗ HAY DIFERENCIAS reales tras normalizar — ver arriba. Esto es un HALLAZGO para");
      console.log("  el owner, no necesariamente un defecto: cada diferencia debe caracterizarse");
      console.log("  (¿cambia lo que Nayoli ve, o es un cambio de bytes sin efecto visual?).");
      process.exitCode = 1;
    } else {
      console.log("\n✔ VACÍO en las 4 rutas y en el CSS — Nayoli byte-idéntica, MEDIDA.");
      process.exitCode = 0;
    }
  } finally {
    if (worktreeListo) quitarWorktreeMain();
    pg.detener();
  }
}

main().catch((e) => {
  console.error("❌ verificar-nayoli falló:", e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
