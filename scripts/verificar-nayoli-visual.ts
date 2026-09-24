// scripts/verificar-nayoli-visual.ts — § VERIFICAR-NAYOLI-VISUAL-1
//
// LO QUE EL OWNER PIDIÓ, TEXTUAL: "'Nayoli visualmente idéntico, medido' = captura headless en
// claro forzado de TODAS las rutas públicas de Nayoli (home, catálogo, producto, checkout,
// /nosotros, /suscripciones, y cada variante de ProductCard que Nayoli renderiza), main contra la
// rama, con diff de píxeles. Esperado: cero diferencias salvo antialiasing, y cada píxel distinto
// se reporta, no se juzga. Si la tienda responde a prefers-color-scheme, repite en oscuro."
//
// ÉSTA ES OTRA VARA QUE `verificar-nayoli.ts` (VERIFICAR-NAYOLI-BYTE-1) — aquélla mide BYTES
// (HTML normalizado + CSS); ésta mide el RESULTADO VISUAL (píxeles renderizados). Las dos existen
// porque dos bytes distintos pueden resolver al MISMO píxel (un fallback de CSS custom property
// que cae al mismo color, medido en VERIFICAR-NAYOLI-BYTE-1: 3 rutas con diff de bytes y 0 de
// esas diferencias con efecto visual) — la vara de bytes NO responde "¿se ve igual?", sólo esta lo
// hace.
//
// ─── MEDIDO ANTES DE ESCRIBIR EL ARNÉS: ¿la tienda responde a `prefers-color-scheme`? ───────────
// `grep -rn "prefers-color-scheme"` sobre el repo (excluido `node_modules`/`.scratch`) da SÓLO
// tres apariciones, las tres en `app/(admin)/layout.tsx` (los `<meta name="theme-color">` del
// PANEL, no del storefront) y un comentario en `app/globals.css` sobre la estrategia de next-themes
// (no una media query real). `grep -rn "dark:" app/(storefront)/ components/storefront/` da CERO
// resultados. Y `components/theme/StorefrontThemeProvider.tsx` monta
// `<NextThemesProvider attribute="class" forcedTheme="light">` — el storefront está FORZADO a
// claro, sin excepción, con su propio comentario diciéndolo ("light-only, sin toggle"). Con las
// tres señales apuntando al mismo hecho, CLARO FORZADO alcanza: no hay estado oscuro del
// storefront que este arnés pudiera dejar sin medir. Si algún día el storefront gana un modo
// oscuro real, este archivo es el que hay que tocar — no antes.
//
// ─── MÉTODO ───────────────────────────────────────────────────────────────────────────────────
//   1. El MISMO arnés de base que `verificar-nayoli.ts`: Postgres efímero propio (puerto/base
//      DISTINTOS, para poder correr al lado del otro sin pisarse), `migrate deploy` + el seed
//      CANÓNICO (`prisma/seed.ts`) UNA VEZ contra esa base, un `git worktree` de `main` en
//      `.scratch/` (symlink de `node_modules`, sin `packages/core`/`design-system` propios — el
//      mismo razonamiento medido en VERIFICAR-NAYOLI-BYTE-1, no repetido acá), `next build` +
//      `next start` de CADA árbol, SECUENCIAL, contra la MISMA base.
//   2. TRAS el seed canónico, este arnés SIEMBRA CINCO PRODUCTOS SINTÉTICOS más (§ abajo,
//      `sembrarEstadosProductCard`) — leyendo `components/storefront/ProductCard.tsx` el catálogo
//      canónico de Nayoli (4 productos) NO ejercita todos sus estados condicionales: los 4 tienen
//      imagen, los 4 tienen `notas` no vacías, los 4 tienen `disponible=true` (stock>0), y los 4
//      resuelven `decidirMolienda` a `'automatica'` (una sola opción disponible) — nunca `'eleccion'`
//      ni `'agotada'`. Sin sembrar más, "cada estado visual de ProductCard que Nayoli renderiza"
//      sería sólo un subconjunto. Los 5 sintéticos se insertan por SQL crudo (vía `psql`, no
//      Prisma) DESPUÉS del seed canónico — con `createdAt` EXPLÍCITO (§ GUARDA-COLOR-NAYOLI-1,
//      `sqlProductoSintetico`: el default `now()` de la columna NO alcanzaba — medido, contradice
//      lo que esta línea afirmaba desde VERIFICAR-NAYOLI-VISUAL-1 — un mismatch de huso horario
//      entre la sesión de `psql` y la de Prisma hacía que los 5 sintéticos GANARAN por 5 horas a
//      los 4 canónicos) para que NO entren en los primeros 4 de `FeaturedProductsCuadricula`
//      (`catalog.slice(0, 4)`, home) y la home siga mostrando exactamente los 4 de siempre — no se
//      contamina una superficie que no hacía falta tocar.
//   3. Chromium headless AISLADO (Playwright instalado con `npm install --prefix
//      .arnes-tooling/playwright`, el MISMO mecanismo y el MISMO directorio persistente que
//      `capturar-seccion.ts` — reusa la instalación si ya está cacheada; `touches:` de este slice
//      no incluye ese directorio porque está gitignoreado, § .gitignore) — `newPage({ viewport,
//      colorScheme: 'light' })`: el forzado de esquema de color vive en el CONTEXTO de Playwright,
//      no depende de que el storefront lo respete (que además no lo hace, § arriba) — es
//      cinturón-y-tirantes.
//   4. Por cada ruta pública (`/`, `/tienda`, `/tienda/<slug>`, `/checkout`, `/nosotros`,
//      `/suscripciones`): `goto` con `waitUntil: 'networkidle'`, SCROLL COMPLETO DE LA PÁGINA en
//      pasos del alto del viewport (dispara todos los `IntersectionObserver` de `whileInView` que
//      framer-motion arma en el storefront — el hero, las bandas con `fadeUp`, el grid de
//      productos con stagger), vuelta al tope, y una espera FIJA de settle (§ el porqué de fija,
//      no por-elemento, abajo) antes de `page.screenshot({ fullPage: true, animations: 'disabled'
//      })`. `animations: 'disabled'` completa instantáneamente cualquier transición CSS/WAAPI en
//      vuelo (el hover del botón "Agregar", el `hover:shadow-lg` de la card); no cubre animaciones
//      puramente `requestAnimationFrame` de framer-motion (que no son CSS/WAAPI) — de ÉSAS se
//      encarga el scroll-completo-y-espera de arriba.
//   5. POR QUÉ LA ESPERA ES UN TIEMPO FIJO Y NO UN POLL DE OPACIDAD POR-ELEMENTO (como
//      `esperarAsentamiento` de `capturar-seccion.ts`): ese mecanismo existe para UN selector
//      conocido de antemano (una sección concreta) y funciona porque se sabe que ESE nodo debe
//      terminar en opacidad ~1. Una captura de PÁGINA COMPLETA no tiene un selector: caminar
//      "todos los elementos" y exigirles opacidad ≥0.98 rompería contra el propio
//      `ProductCard.tsx`, que tiene un botón con `opacity-0` PERMANENTE en reposo (`opacity-0
//      ... group-hover:opacity-100` — nunca llega a 1 sin hover, por diseño, no por animación a
//      medias). Un poll ciego marcaría ESE botón como "nunca asienta" y expiraría en cada ruta.
//      Por eso acá el settle es temporal: TOPE_SETTLE_MS tras el scroll completo, generoso frente
//      a las duraciones medidas en el propio repo (`transition-all duration-300`,
//      `duration-500`, stagger de `delay: i * 0.08` sobre ≤4 tarjetas) — sin pretender que cubre
//      cualquier animación futura; es una medida, no una garantía.
//
//      MEDIDO, NO TEÓRICO: hay una fuente CONCRETA de ruido que ningún settle temporal cierra.
//      Corrida esta herramienta 3 veces sobre el MISMO par de árboles (sin tocar código entre
//      medio), `/` (home) dio IDÉNTICO una vez y DIFIRIÓ las otras dos (~160/4.631.040 px,
//      0.0035%, con la caja del diff acotada a `[614,730]–[665,751]`). Rastreado pixel por pixel:
//      la caja cae exactamente sobre el indicador "Scroll" del hero
//      (`components/storefront/home/HeroCurtina.tsx:233-240`), que anima
//      `animate={{ y: [0, 8, 0] }}, transition={{ duration: 2, repeat: Infinity }}` — un LOOP
//      INFINITO, sin estado final. Un settle temporal —por definición— sólo espera a que una
//      animación TERMINE; una que se repite para siempre no tiene ese punto, así que la captura
//      cae en una fase distinta del ciclo de 2s cada vez que el harness completo (build+start+
//      navegar+scrollear) tarda un pelo distinto entre corridas — ruido de TIMING, no una
//      diferencia de código entre main y la rama. Es la MISMA familia que el botón `opacity-0`
//      permanente del punto 5 (un elemento sin "estado final" rompe cualquier heurística de
//      settle), en su variante temporal: ahí el settle no debía ESPERAR nada; acá no hay NADA que
//      esperar, porque el ciclo nunca termina. Documentado, no arreglado — el spec pide medir y
//      reportar el hallazgo, no silenciarlo forzando el fin de una animación en loop.
//   6. DIFF DE PÍXELES con `pixelmatch` (agregado a `package.json`/`package-lock.json`, a
//      diferencia de Playwright: acá SÍ es una dependencia real del REPO, el propio spec lo pide
//      —"agregá la dep si hace falta"—, y a diferencia de Playwright no hay huella de proceso de
//      build que evitar: `pixelmatch`/`pngjs` sólo los importa este script). Se corre DOS VECES por
//      captura: con `includeAA: false` (el modo "consciente de antialiasing" — pixelmatch DETECTA
//      pixeles de antialiasing y no los cuenta como diferencia) y con `includeAA: true` (el CONTEO
//      CRUDO que el owner pidió explícitamente, "cada píxel distinto se reporta, no se juzga"). Se
//      reportan los DOS números. Si las dimensiones de main y rama difieren para una misma ruta,
//      pixelmatch no puede correr pixel a pixel — se reporta como HALLAZGO ESTRUCTURAL aparte
//      (tamaño de página distinto), sin intentar recortar/rellenar para forzar una comparación que
//      mentiría.
//   7. ESTADOS ADICIONALES DE `ProductCard` QUE SÓLO SE VEN EN HOVER (el ícono cambia entre
//      `ShoppingBag` —modo `'automatica'`/`'ninguna'`— y `SlidersHorizontal` —modo `'eleccion'`/
//      `'agotada'`—, el botón entero es `opacity-0` en reposo): además de las 6 capturas de página
//      completa, se capturan 2 recortes de UNA card puntual, tras `page.hover()` sobre su botón —
//      una card en modo `'automatica'` (canónica, `cafe-nayoli-grano-250g`) y una en modo
//      `'eleccion'` (`verificar-visual-eleccion`, sintética) — para que el diff de píxeles alcance
//      también al estado que sólo el mouse revela.
//
// LÍMITE DECLARADO (mismo que VERIFICAR-NAYOLI-BYTE-1): esto NO reemplaza el gate visual del owner
// (capa 3) — mide píxeles, no gusto. Nayoli es "los defaults, sin preset" — no se aplica ningún
// preset de `themes.ts`.
//
// ─── § GUARDA-COLOR-NAYOLI-1 — CERRÓ LOS DOS REFINAMIENTOS DE ARRIBA ────────────────────────────
// La "DESVIACIÓN DECLARADA" de abajo (fixture no commiteada) y el ruido de timing del punto 5
// (scroll-cue en loop) quedan CERRADOS por esta tanda, no por la que sigue:
//
//   (a) CAPTURA DETERMINISTA (§ `activarRelojCongelado`, abajo): congela
//       `requestAnimationFrame`/`performance.now()` a un valor CONSTANTE vía `page.addInitScript`
//       — con "ahora" fijo, todo cálculo `elapsed = ahora − inicio` de framer-motion da SIEMPRE 0,
//       así que el loop `y:[0,8,0], repeat:Infinity` del scroll-cue (§ punto 5, arriba) queda
//       pinneado en su PRIMER keyframe desde el primer frame, sin depender de CUÁNDO en tiempo
//       real montó el componente. Se descartaron las otras dos opciones que el dispatch permitía
//       medir: `MotionGlobalConfig.skipAnimations=true` exige que la APP lo invoque (ningún
//       componente está en `touches` de esta tanda); `animations:'disabled'` de Playwright YA
//       estaba activo (línea de `capturarRutaCompleta`) y NO alcanzaba — opera sobre
//       `document.getAnimations()`, que sólo ve Web Animations NATIVAS (CSS/WAAPI), y el scroll-
//       cue se prueba JS-RAF-driven precisamente porque ese flag no lo tocaba (medido en
//       VERIFICAR-NAYOLI-VISUAL-1, 3 corridas, ~160px intermitente pese al flag activo).
//       RIESGO EVALUADO: ¿congelar `now()` rompe las entradas `whileInView` (fade-up) que el
//       scroll-completo-y-espera existe para revelar? Medido que NO: las 7 rutas restantes YA
//       daban 0px SIN este freeze (scroll+espera real ya las asentaba), lo que indica que corren
//       vía Web Animations nativas (insensibles al freeze de JS, driven por el reloj del
//       compositor) o completan antes de que la página quede quieta — el freeze sólo tiene efecto
//       OBSERVABLE sobre el loop RAF-driven que ya sabíamos que `animations:'disabled'` no
//       alcanzaba. Confirmado por inspección visual de la captura resultante (§ asiento).
//   (b) EL "cinturón-y-tirantes" de `transition-duration:0s` (antes un `addStyleTag` suelto tras
//       `newPage()`) SE MOVIÓ AL MISMO `addInitScript`: `addStyleTag` inyecta en el documento
//       ACTUAL y NO sobrevive una navegación (`page.goto`) — confirmado contra los tipos de
//       Playwright ("Raw CSS content to be injected into FRAME", sin la garantía de
//       reinyección-en-cada-navegación que `addInitScript` sí documenta explícitamente: "Whenever
//       the page is navigated"). El `addStyleTag` original, llamado UNA vez sobre `about:blank`
//       antes del primer `goto()` del loop de rutas, se perdía en la primera navegación y nunca
//       aplicaba a ninguna de las 6 rutas capturadas — bug preexistente, corregido de paso porque
//       cae dentro del mismo mecanismo que esta tanda ya está tocando.
//   (c) LA FIXTURE FIJA SE COMMITEA (§ tests/visual/nayoli/*.png): el `touches` de
//       GUARDA-COLOR-NAYOLI-1 SÍ nombra `tests/visual/nayoli/` sin acotar a `.gitkeep`, así que la
//       restricción que forzó la desviación de abajo ya no aplica. El modo `--generar-fixture` de
//       `main()` (al final del archivo) escribe ahí.
//
// ─── DESVIACIÓN HISTÓRICA (VERIFICAR-NAYOLI-VISUAL-1): LA FIXTURE FIJA NO SE COMMITEABA ─────────
// El spec de esa tanda decía, textual: "dejá las capturas de main como fixture fijo… decidí vos si
// las commiteás como PNG o como firma compacta". PERO `touches:` de esa tanda sólo nombraba
// `tests/visual/nayoli/.gitkeep` bajo ese directorio — ningún archivo `.png` ni ningún otro nombre.
// El contrato del dispatch es tajante: "YOUR DIFF MUST STAY INSIDE touches… If the work turns out
// to need a file outside it, stop and say so — do not widen it yourself." Entre el texto del spec
// (que sugiere commitear) y el campo `touches` (que sólo autorizaba el `.gitkeep`), ganó `touches`.
// Esa tanda creó el directorio `tests/visual/nayoli/` con SÓLO su `.gitkeep` (scaffold), y dejó el
// commit de la fixture real como follow-up (`VERIFICAR-NAYOLI-VISUAL-FIXTURE-COMMIT-1`) — el que
// esta tanda, GUARDA-COLOR-NAYOLI-1, cierra en (c) arriba.
import { spawnSync, spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA_DIR = join(RAIZ, ".scratch", "verificar-nayoli-visual");
const CAPTURAS_DIR = join(SALIDA_DIR, "capturas");
const DIFF_DIR = join(SALIDA_DIR, "diffs");
const TOOLING_DIR = join(RAIZ, ".arnes-tooling", "playwright");

// El fixture fijo que GUARDA-COLOR-NAYOLI-1 commitea — mismo directorio que lee `guarda-color.ts`.
export const FIXTURE_DIR = join(RAIZ, "tests", "visual", "nayoli");

// Puertos y base PROPIOS — distintos de test-integracion.sh (55432), capturar-seccion.sh
// (55434/3477) y verificar-nayoli.ts (55438/3491/3492), para poder correr los cuatro arneses uno
// al lado del otro sin pisarse. `guarda-color.ts` usa los SUYOS propios (55440/3495), declarados
// en ese archivo — nunca corre a la vez que éste, pero comparten el mismo mecanismo de "puerto
// propio" para poder correr en paralelo si alguna vez hiciera falta.
const PUERTO_PG = 55439;
const BASE_PG = "verificarnayolivisual";
const PUERTO_MAIN = 3493;
const PUERTO_RAMA = 3494;
export const ANCHO_VIEWPORT = 1280;
export const ALTO_VIEWPORT = 900;

const WORKTREE_MAIN = join(RAIZ, ".scratch", "verificar-nayoli-visual-main");

// El producto canónico del seed (§ prisma/seed-products.ts), slug ESTABLE en main y en la rama.
export const SLUG_PRODUCTO = "cafe-nayoli-grano-250g";
export const SLUG_ELECCION = "verificar-visual-eleccion";

export const RUTAS: { path: string; nombre: string }[] = [
  { path: "/", nombre: "home" },
  { path: "/tienda", nombre: "tienda" },
  { path: `/tienda/${SLUG_PRODUCTO}`, nombre: "producto" },
  { path: "/checkout", nombre: "checkout" },
  { path: "/nosotros", nombre: "nosotros" },
  { path: "/suscripciones", nombre: "suscripciones" },
];

// Los NOMBRES de fixture, en el mismo orden que `RUTAS` + los 2 hovers — la única lista que
// `guarda-color.ts` necesita para saber qué archivos leer de `FIXTURE_DIR`.
export const CLAVES_FIXTURE: string[] = [
  ...RUTAS.map((r) => `ruta-${r.nombre}`),
  "hover-automatica",
  "hover-eleccion",
];

// ─── Postgres efímero — MISMO mecanismo que verificar-nayoli.ts (reimplementado acá porque
// `touches:` de este slice no incluye un `.sh` compartido) ───────────────────────────────────────
export interface PgEfimero {
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

export async function levantarPostgres(puerto: number, base: string): Promise<PgEfimero> {
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

  const datadir = join(mkdtempSync(join(tmpdir(), "verificar-nayoli-visual-pg-")), "pg");
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
    databaseUrl,
    detener() {
      spawnSync("pg_ctl", ["-D", datadir, "stop", "-m", "immediate"], { stdio: "inherit" });
      rmSync(dirname(datadir), { recursive: true, force: true });
    },
  };
}

export function migrarYSembrar(env: NodeJS.ProcessEnv): void {
  console.log("▸ Aplicando migraciones (una vez, sirve a los dos árboles)…");
  let r = spawnSync("npm", ["run", "--silent", "db:deploy", "-w", "@duna/core"], { cwd: RAIZ, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("migrate deploy falló.");

  console.log("▸ Sembrando (prisma/seed.ts — la identidad real de Nayoli + el catálogo canónico)…");
  r = spawnSync("npx", ["tsx", "prisma/seed.ts"], { cwd: RAIZ, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("El seed falló.");
}

// ─── Los 5 productos sintéticos que ejercitan los estados de ProductCard que Nayoli NO cubre ────
// (§ cabecera, punto 2). SQL crudo vía `psql`, no Prisma: evita depender de que el proceso de este
// script pueda importar `@duna/core` con `DATABASE_URL` ya resuelto en tiempo de import estático
// (el cliente generado lee `process.env.DATABASE_URL` al construirse — `packages/core/client.ts` —
// y una importación ESM estática se evalúa ANTES de que este script pueda fijar esa env var).
// `id` = `slug` en los 5, legible y sin colisión con los `cuid()` del seed canónico.
// `createdAt` EXPLÍCITO — § GUARDA-COLOR-NAYOLI-1, bug propio encontrado y corregido acá.
// Ya NO se deja al default de columna (`now()`/`CURRENT_TIMESTAMP`). MEDIDO (diagnóstico directo
// contra una base descartable, sin build): con el default, los 5 sintéticos (insertados por
// `psql -f`, SESIÓN PROPIA) caían en `2026-09-24 16:43:28.35x`, y los 4 canónicos (insertados por
// `prisma.product.upsert`, SESIÓN de Prisma) en `2026-09-24 21:43:28.0xx` — **5 HORAS DE
// DIFERENCIA, sintéticos "antes"** — pese a que los sintéticos se insertan DESPUÉS en tiempo real.
// La columna es `TIMESTAMP(3)` SIN zona horaria: `CURRENT_TIMESTAMP` se graba tal cual la ve la
// SESIÓN, y `psql` (con el cluster efímero en `America/Bogota`, § `levantarPostgres`) y el cliente
// de Prisma no comparten esa sesión ni, evidentemente, la misma referencia horaria — así que
// `ORDER BY "createdAt" ASC` (`/api/catalog`) ponía los 5 sintéticos COMO SI fueran más viejos que
// los 4 canónicos, y `catalog.slice(0,4)` (`FeaturedProductsCuadricula`) mostraba los sintéticos en
// vez de los 4 de siempre — exactamente lo que el comentario original de esta función prometía que
// NO iba a pasar. Y por si esto solo no bastara: 2 pares de los 5 sintéticos EMPATABAN al
// milisegundo (`.357`/`.357`, `.358`/`.358`/`.358`) — un empate que Postgres no garantiza resolver
// igual entre dos corridas (dos clusters efímeros DISTINTOS, § GUARDA-COLOR-NAYOLI-1: el fixture y
// el guard corren en clusters separados), y que produjo el hallazgo original de este slice: un
// "self-run" del guard contra su propio fixture (misma rama, mismo código) NO daba 0px — 3 rutas
// con diffs de miles de píxeles en la zona de la grilla de productos, nada que ver con color.
//
// LA CORRECCIÓN: `createdAt` EXPLÍCITO, un literal fijo en el año 2099 + `orden` SEGUNDOS —
// ni depende de qué sesión evalúa "ahora" (elimina el mismatch de huso horario) ni dos filas
// pueden empatar (el segundo entero, no el milisegundo de ejecución, decide el orden). 2099 está
// muy por delante de cualquier `now()` real (Prisma o `psql`, en cualquier huso), así que los 5
// sintéticos quedan DESPUÉS de los 4 canónicos por construcción, no por suerte de timing.
function sqlProductoSintetico(p: {
  id: string;
  nombre: string;
  categoria: string;
  imagen: string;
  notas: string[];
  bestseller: boolean;
  badge: string | null;
  stock: number;
  moliendas: { nombre: string; metodo: string; disponible: boolean }[];
  orden: number;
}): string {
  const notasSql = `ARRAY[${p.notas.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ")}]::text[]`;
  const badgeSql = p.badge === null ? "NULL" : `'${p.badge.replace(/'/g, "''")}'`;
  const moliendasJson = JSON.stringify(p.moliendas).replace(/'/g, "''");
  const descripcion = `Producto sintético de VERIFICAR-NAYOLI-VISUAL-1 — ejercita un estado de ProductCard que el catálogo canónico de Nayoli no cubre.`;
  const createdAtSql = `TIMESTAMP '2099-01-01 00:00:00.000' + (${p.orden} * INTERVAL '1 second')`;
  return `
INSERT INTO "Product" (id, nombre, slug, categoria, descripcion, precio, costo, stock, activo, imagen, notas, bestseller, badge, "moliendasOpciones", "createdAt", "updatedAt")
VALUES (
  '${p.id}', '${p.nombre.replace(/'/g, "''")}', '${p.id}', '${p.categoria}', '${descripcion}',
  20000, 14000, ${p.stock}, true, '${p.imagen}', ${notasSql}, ${p.bestseller}, ${badgeSql},
  '${moliendasJson}'::jsonb, ${createdAtSql}, ${createdAtSql}
);`;
}

export function sembrarEstadosProductCard(databaseUrl: string): void {
  console.log("▸ Sembrando 5 productos sintéticos — los estados de ProductCard que Nayoli no cubre…");
  const automatica = [{ nombre: "Grano entero", metodo: "Muele en casa a tu gusto", disponible: true }];
  const eleccion = [
    { nombre: "Media", metodo: "Filtro / Greca tradicional", disponible: true },
    { nombre: "Fina", metodo: "Moka / Espresso", disponible: true },
  ];
  const agotadaMolienda = [
    { nombre: "Media", metodo: "Filtro / Greca tradicional", disponible: false },
    { nombre: "Fina", metodo: "Moka / Espresso", disponible: false },
  ];

  const sql = [
    // Sin imagen (`imagen && <Image/>` falsy → cae al fondo crema del contenedor).
    sqlProductoSintetico({
      id: "verificar-visual-sin-imagen",
      nombre: "Verificar Visual — Sin imagen",
      categoria: "Café en Grano",
      imagen: "",
      notas: ["Nota de prueba"],
      bestseller: false,
      badge: null,
      stock: 10,
      moliendas: automatica,
      orden: 0,
    }),
    // Agotado (`stock=0` → `disponible=false` en /api/catalog → etiqueta "Agotado", sin botón) +
    // badge presente CON `bestseller=false` (color `--sf-tostado`, el que el catálogo canónico no
    // ejercita — sus 2 badges son siempre `bestseller=true`).
    sqlProductoSintetico({
      id: "verificar-visual-agotado",
      nombre: "Verificar Visual — Agotado",
      categoria: "Café en Grano",
      imagen: "/images/cafe-nayoli-250g-grano.webp",
      notas: ["Nota de prueba"],
      bestseller: false,
      badge: "Edición limitada",
      stock: 0,
      moliendas: automatica,
      orden: 1,
    }),
    // Sin notas de cata (`notas` no puede ser NULL — la columna es `String[] @default([])` — así
    // que "sin ellas" es un array VACÍO, el estado real que la base puede producir) + badge CON
    // `bestseller=true` (color `--sf-acento`).
    sqlProductoSintetico({
      id: "verificar-visual-sin-notas",
      nombre: "Verificar Visual — Sin notas",
      categoria: "Café en Grano",
      imagen: "/images/cafe-nayoli-500g-grano-v2.webp",
      notas: [],
      bestseller: true,
      badge: "Oferta",
      stock: 10,
      moliendas: automatica,
      orden: 2,
    }),
    // `decidirMolienda` → 'eleccion' (2 disponibles): ícono SlidersHorizontal en vez de
    // ShoppingBag, sólo visible en hover (§ cabecera, punto 7).
    sqlProductoSintetico({
      id: SLUG_ELECCION,
      nombre: "Verificar Visual — Elección de molienda",
      categoria: "Café Molido",
      imagen: "/images/cafe-nayoli-250g-molido.webp",
      notas: ["Nota de prueba"],
      bestseller: false,
      badge: null,
      stock: 10,
      moliendas: eleccion,
      orden: 3,
    }),
    // `decidirMolienda` → 'agotada' (declara opciones, ninguna disponible): `product.disponible`
    // sigue en `true` (hay stock), así que el botón se muestra igual que 'automatica' — la única
    // diferencia es el ícono/aria-label en hover.
    sqlProductoSintetico({
      id: "verificar-visual-agotada-molienda",
      nombre: "Verificar Visual — Molienda agotada",
      categoria: "Café Molido",
      imagen: "/images/cafe-nayoli-500g-molido-v2.webp",
      notas: ["Nota de prueba"],
      bestseller: false,
      badge: null,
      stock: 10,
      moliendas: agotadaMolienda,
      orden: 4,
    }),
  ].join("\n");

  mkdirSync(SALIDA_DIR, { recursive: true });
  const sqlFile = join(SALIDA_DIR, "productos-sinteticos.sql");
  writeFileSync(sqlFile, sql);
  const r = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", sqlFile], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("La siembra de productos sintéticos falló — ver el SQL arriba.");
}

// ─── El worktree de `main` — MISMO mecanismo que verificar-nayoli.ts (ver ese archivo para el
// porqué completo de cada decisión: symlink de node_modules, borrado de packages/core/design-
// system propios) ─────────────────────────────────────────────────────────────────────────────
function prepararWorktreeMain(): string {
  if (existsSync(WORKTREE_MAIN)) {
    console.log("▸ Removiendo un worktree de main dejado por una corrida anterior…");
    spawnSync("git", ["worktree", "remove", "--force", WORKTREE_MAIN], { cwd: RAIZ, stdio: "inherit" });
    rmSync(WORKTREE_MAIN, { recursive: true, force: true });
  }
  console.log("▸ Creando worktree de `main` en " + WORKTREE_MAIN + " (detached, HEAD real de main)…");
  const r = spawnSync("git", ["worktree", "add", "--detach", WORKTREE_MAIN, "main"], { cwd: RAIZ, stdio: "inherit" });
  if (r.status !== 0) throw new Error("git worktree add falló.");

  symlinkSync(join(RAIZ, "node_modules"), join(WORKTREE_MAIN, "node_modules"), "dir");
  rmSync(join(WORKTREE_MAIN, "packages", "core"), { recursive: true, force: true });
  rmSync(join(WORKTREE_MAIN, "packages", "design-system"), { recursive: true, force: true });
  return WORKTREE_MAIN;
}

function quitarWorktreeMain(): void {
  spawnSync("git", ["worktree", "remove", "--force", WORKTREE_MAIN], { cwd: RAIZ, stdio: "inherit" });
  rmSync(WORKTREE_MAIN, { recursive: true, force: true });
}

// ─── Build + start de un árbol — MISMO mecanismo que verificar-nayoli.ts ────────────────────────
export function entornoArbol(puerto: number, databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PORT: String(puerto),
    DATABASE_URL: databaseUrl,
    DIRECT_DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: "verificar-nayoli-visual-secreto-inerte-0123456789",
    BETTER_AUTH_URL: `http://127.0.0.1:${puerto}`,
  };
}

export function construir(cwd: string, env: NodeJS.ProcessEnv, etiqueta: string): void {
  console.log(`▸ [${etiqueta}] next build…`);
  const r = spawnSync("npx", ["next", "build"], { cwd, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`[${etiqueta}] next build falló.`);
  console.log(`✔ [${etiqueta}] build listo.`);
}

export function arrancar(cwd: string, env: NodeJS.ProcessEnv, puerto: number): ChildProcess {
  return spawn("npx", ["next", "start", "-p", String(puerto)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

export async function detener(child: ChildProcess): Promise<void> {
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

export async function esperarListo(url: string, timeoutMs: number): Promise<void> {
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

// ─── Playwright AISLADO — MISMO mecanismo que capturar-seccion.ts (§ su cabecera): nunca una
// dependencia del repo, instalado con --prefix en un directorio gitignoreado y persistente entre
// corridas. Reusa la instalación de capturar-seccion.ts si ya está cacheada (mismo TOOLING_DIR). ─
export interface PlaywrightResponse {
  status(): number;
}
export interface PlaywrightLocator {
  screenshot(opts: { path: string }): Promise<Buffer>;
  hover(opts?: { timeout?: number }): Promise<void>;
  waitFor(opts?: { timeout?: number }): Promise<void>;
}
export interface PlaywrightPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<PlaywrightResponse | null>;
  screenshot(opts: { path: string; fullPage?: boolean; animations?: "disabled" | "allow" }): Promise<Buffer>;
  locator(selector: string): PlaywrightLocator;
  evaluate<T, Arg = undefined>(fn: (arg: Arg) => T, arg: Arg): Promise<T>;
  addStyleTag(opts: { content: string }): Promise<unknown>;
  addInitScript(opts: { content: string }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}
export interface PlaywrightBrowser {
  newPage(opts?: {
    viewport?: { width: number; height: number };
    colorScheme?: "light" | "dark" | "no-preference";
  }): Promise<PlaywrightPage>;
  close(): Promise<void>;
}
export interface PlaywrightModule {
  chromium: { launch(opts?: { headless?: boolean }): Promise<PlaywrightBrowser> };
}

export function cargarPlaywright(): PlaywrightModule {
  const pkgJson = join(TOOLING_DIR, "package.json");
  if (!existsSync(pkgJson)) {
    console.log(`▸ Playwright no está instalado (aislado) — instalando en ${TOOLING_DIR}…`);
    mkdirSync(TOOLING_DIR, { recursive: true });
    const r = spawnSync("npm", ["install", "--prefix", TOOLING_DIR, "playwright"], {
      stdio: "inherit",
      cwd: RAIZ,
    });
    if (r.status !== 0) {
      throw new Error("No se pudo instalar Playwright de forma aislada — ver la salida de npm arriba.");
    }
  }
  const cliJs = join(TOOLING_DIR, "node_modules", "playwright", "cli.js");
  console.log("▸ Verificando Chromium (vía la instalación aislada)…");
  const instalado = spawnSync(process.execPath, [cliJs, "install", "chromium"], {
    stdio: "inherit",
    cwd: RAIZ,
  });
  if (instalado.status !== 0) {
    throw new Error("No se pudo instalar/verificar el binario de Chromium.");
  }
  const req = createRequire(pkgJson);
  return req("playwright") as PlaywrightModule;
}

// ─── MODO DETERMINISTA — congela el reloj de animación (§ GUARDA-COLOR-NAYOLI-1, punto (a)) ─────
// `requestAnimationFrame`/`performance.now()` quedan FIJOS a un valor CONSTANTE, inyectados vía
// `page.addInitScript` — corre ANTES de cualquier script de la página, en CADA navegación de este
// `BrowserContext` (a diferencia de `addStyleTag`, que sólo alcanza al documento actual — por eso
// el `transition-duration:0s` cinturón-y-tirantes también se movió acá, § punto (b) del asiento de
// cabecera). Con "ahora" fijo, `elapsed = ahora − inicio` da SIEMPRE 0 para cualquier animación
// JS-RAF-driven de framer-motion — el loop del scroll-cue (`HeroCurtina.tsx`, `y:[0,8,0],
// repeat:Infinity`) queda pinneado en su primer keyframe, desde el primer frame, sin depender de
// CUÁNDO en tiempo real montó el componente. Se sigue llamando al `requestAnimationFrame` NATIVO
// (el navegador sigue pintando) — sólo se falsea el TIMESTAMP que recibe el callback.
const RELOJ_CONGELADO_MS = 1_000;

export async function activarModoDeterminista(page: PlaywrightPage): Promise<void> {
  await page.addInitScript({
    content: `
      (function () {
        var FIJO = ${RELOJ_CONGELADO_MS};
        var rafReal = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = function (cb) {
          return rafReal(function () { cb(FIJO); });
        };
        try {
          Object.defineProperty(window.performance, "now", {
            value: function () { return FIJO; },
            configurable: true,
          });
        } catch (e) {
          window.performance.now = function () { return FIJO; };
        }
        function inyectarCss() {
          var s = document.createElement("style");
          s.textContent = "*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;}";
          (document.head || document.documentElement).appendChild(s);
        }
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", inyectarCss);
        } else {
          inyectarCss();
        }
      })();
    `,
  });
}

// ─── Scroll completo + settle temporal (§ cabecera, puntos 4-5) ─────────────────────────────────
const TOPE_SETTLE_MS = 1800;

async function scrollearYAsentar(page: PlaywrightPage): Promise<void> {
  const alto = await page.evaluate<number, undefined>(() => document.body.scrollHeight, undefined);
  const pasos = Math.max(1, Math.ceil(alto / ALTO_VIEWPORT));
  for (let i = 1; i <= pasos; i++) {
    await page.evaluate<void, number>((y) => window.scrollTo(0, y), i * ALTO_VIEWPORT);
    await page.waitForTimeout(220);
  }
  await page.evaluate<void, undefined>(() => window.scrollTo(0, 0), undefined);
  await page.waitForTimeout(TOPE_SETTLE_MS);
}

async function capturarRutaCompleta(page: PlaywrightPage, origen: string, ruta: string, destino: string): Promise<void> {
  await page.goto(`${origen}${ruta}`, { waitUntil: "networkidle", timeout: 30_000 });
  await scrollearYAsentar(page);
  await page.screenshot({ path: destino, fullPage: true, animations: "disabled" });
}

// Recorte de UNA card tras hover sobre su botón (§ cabecera, punto 7). `selectorCard` localiza por
// el `href` real del <Link> (`/tienda/<slug>`) — no por una clase CSS que un rediseño puede
// renombrar sin cambiar el estado que esto mide.
async function capturarCardEnHover(page: PlaywrightPage, origen: string, slug: string, destino: string): Promise<void> {
  await page.goto(`${origen}/tienda`, { waitUntil: "networkidle", timeout: 30_000 });
  await scrollearYAsentar(page);
  const card = page.locator(`a[href="/tienda/${slug}"]`);
  await card.waitFor({ timeout: 10_000 });
  const boton = page.locator(`a[href="/tienda/${slug}"] button`);
  await boton.waitFor({ timeout: 10_000 });
  await boton.hover({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await card.screenshot({ path: destino });
}

export interface CapturaArbol {
  rutas: Record<string, string>;
  hoverAutomatica: string;
  hoverEleccion: string;
}

export async function capturarArbol(browser: PlaywrightBrowser, origen: string, etiqueta: string, dir: string): Promise<CapturaArbol> {
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: ANCHO_VIEWPORT, height: ALTO_VIEWPORT },
    colorScheme: "light",
  });
  // `animations:'disabled'` en `page.screenshot` ya inmoviliza CSS/WAAPI nativo; el modo
  // determinista (§ arriba) cierra lo que ESE flag no alcanza — el loop RAF-driven del scroll-cue
  // — Y lleva el `transition-duration:0s` de las transiciones nativas de Tailwind DENTRO del
  // `addInitScript`, así sobrevive cada navegación (`addStyleTag` no lo hacía, § asiento de
  // cabecera, punto (b)).
  await activarModoDeterminista(page);
  const rutas: Record<string, string> = {};
  for (const { path, nombre } of RUTAS) {
    console.log(`  [${etiqueta}] GET ${path} (captura de página completa)…`);
    const destino = join(dir, `ruta-${nombre}.png`);
    await capturarRutaCompleta(page, origen, path, destino);
    rutas[nombre] = destino;
  }
  console.log(`  [${etiqueta}] hover — card en modo 'automatica' (${SLUG_PRODUCTO})…`);
  const hoverAutomatica = join(dir, "hover-automatica.png");
  await capturarCardEnHover(page, origen, SLUG_PRODUCTO, hoverAutomatica);
  console.log(`  [${etiqueta}] hover — card en modo 'eleccion' (${SLUG_ELECCION})…`);
  const hoverEleccion = join(dir, "hover-eleccion.png");
  await capturarCardEnHover(page, origen, SLUG_ELECCION, hoverEleccion);
  await page.close();
  return { rutas, hoverAutomatica, hoverEleccion };
}

async function buildStartCapturar(cwd: string, puerto: number, databaseUrl: string, etiqueta: string, browser: PlaywrightBrowser): Promise<CapturaArbol> {
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
    return await capturarArbol(browser, origen, etiqueta, join(CAPTURAS_DIR, etiqueta));
  } finally {
    await detener(child);
  }
}

// ─── Diff de píxeles ─────────────────────────────────────────────────────────────────────────
export interface ResultadoDiff {
  clave: string;
  identico: boolean;
  dimensionesDistintas: { main: string; rama: string } | null;
  pixelesDistintosConscienteAA: number | null;
  pixelesDistintosCrudo: number | null;
  totalPixeles: number | null;
  cajaDiff: { x0: number; y0: number; x1: number; y1: number } | null;
}

export function compararPng(pathMain: string, pathRama: string, clave: string, diffOutPath: string): ResultadoDiff {
  const bufA = readFileSync(pathMain);
  const bufB = readFileSync(pathRama);
  const pngA = PNG.sync.read(bufA);
  const pngB = PNG.sync.read(bufB);

  if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
    return {
      clave,
      identico: false,
      dimensionesDistintas: { main: `${pngA.width}x${pngA.height}`, rama: `${pngB.width}x${pngB.height}` },
      pixelesDistintosConscienteAA: null,
      pixelesDistintosCrudo: null,
      totalPixeles: null,
      cajaDiff: null,
    };
  }

  const { width, height } = pngA;
  const totalPixeles = width * height;
  const diffImg = new PNG({ width, height });
  // `diffColor` FIJADO explícito (aunque coincide con el default): es el color exacto que se busca
  // abajo para ubicar la caja del diff, y dejarlo implícito ataría esa búsqueda a un default de la
  // librería que podría cambiar sin que este archivo lo note.
  const DIFF_COLOR: [number, number, number] = [255, 0, 0];
  const consciente = pixelmatch(pngA.data, pngB.data, diffImg.data, width, height, {
    threshold: 0.1,
    includeAA: false,
    diffColor: DIFF_COLOR,
  });
  // Segunda pasada SÓLO para el conteo crudo (el owner pidió el número sin filtrar) — sin volcar
  // una segunda imagen de diff, ya que la primera (consciente de AA, la que importa para juzgar)
  // es la que se persiste.
  const crudo = pixelmatch(pngA.data, pngB.data, undefined, width, height, {
    threshold: 0.1,
    includeAA: true,
  });

  // OJO — `pixelmatch` pinta CADA pixel del output con alfa 255, matcheado o no (los matcheados
  // reciben una versión en gris atenuado de la imagen original, § `drawGrayPixel` en su fuente;
  // sólo los MARCADOS reciben el color exacto de `diffColor`/`aaColor`, sin blending). Comprobado
  // contra el propio código de la librería tras un primer intento que usaba "alfa != 0" como señal
  // — daba TODA la imagen como "distinta" (alfa 255 en cada pixel, matcheado o no) y habría
  // reportado una caja [0,0]–[ancho,alto] siempre, aun con 1 solo pixel real de diferencia. La
  // señal correcta es el COLOR EXACTO de `diffColor` (rojo puro) — un pixel AA-detectado (con
  // `includeAA:false`) sale en `aaColor` (amarillo), no en rojo, y no cuenta para esta caja: la
  // caja debe acotar los MISMOS píxeles que `consciente` está contando, no los AA descartados.
  let cajaDiff: { x0: number; y0: number; x1: number; y1: number } | null = null;
  if (consciente > 0) {
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) * 4;
        if (
          diffImg.data[idx] === DIFF_COLOR[0] &&
          diffImg.data[idx + 1] === DIFF_COLOR[1] &&
          diffImg.data[idx + 2] === DIFF_COLOR[2]
        ) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    cajaDiff = { x0, y0, x1, y1 };
    mkdirSync(dirname(diffOutPath), { recursive: true });
    writeFileSync(diffOutPath, PNG.sync.write(diffImg));
  }

  return {
    clave,
    identico: consciente === 0,
    dimensionesDistintas: null,
    pixelesDistintosConscienteAA: consciente,
    pixelesDistintosCrudo: crudo,
    totalPixeles,
    cajaDiff,
  };
}

// ─── `--generar-fixture` — GUARDA-COLOR-NAYOLI-1, § el fixture, del árbol ACTUAL ────────────────
// Construye y arranca SÓLO la rama actual (§0 del dispatch: "no hace falta rebuildear main sólo
// para eso" — la rama ya se midió visualmente idéntica a main, § VERIFICAR-NAYOLI-VISUAL-1), la
// captura DOS VECES en modo determinista (prueba de determinismo: las dos deben dar 0px), copia la
// primera tanda a `tests/visual/nayoli/` como fixture fijo, y calibra el pipeline de diff inyectando
// un override de `--sf-fondo` sobre la home ya capturada — debe dar ≠0px, o el diff no atrapa nada.
function rutaDeClave(captura: CapturaArbol, clave: string): string {
  if (clave === "hover-automatica") return captura.hoverAutomatica;
  if (clave === "hover-eleccion") return captura.hoverEleccion;
  const nombre = clave.replace(/^ruta-/, "");
  const ruta = captura.rutas[nombre];
  if (!ruta) throw new Error(`Clave de fixture desconocida: ${clave}`);
  return ruta;
}

async function generarFixture(): Promise<void> {
  console.log("─".repeat(78));
  console.log("GUARDA-COLOR-NAYOLI-1 — generando el fixture fijo desde el árbol ACTUAL");
  console.log("(una sola build; NO se rebuildea main — § externo NAYOLI_IDENTICA_VISUAL).");
  console.log("─".repeat(78));

  mkdirSync(SALIDA_DIR, { recursive: true });
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const playwright = cargarPlaywright();

  const pg = await levantarPostgres(PUERTO_PG, BASE_PG);
  try {
    const envMigra = {
      ...process.env,
      DATABASE_URL: pg.databaseUrl,
      DIRECT_DATABASE_URL: pg.databaseUrl,
      BETTER_AUTH_SECRET: "verificar-nayoli-visual-secreto-inerte-0123456789",
      BETTER_AUTH_URL: `http://127.0.0.1:${PUERTO_RAMA}`,
    };
    migrarYSembrar(envMigra);
    sembrarEstadosProductCard(pg.databaseUrl);

    const env = entornoArbol(PUERTO_RAMA, pg.databaseUrl);
    construir(RAIZ, env, "fixture");
    console.log(`▸ [fixture] next start en :${PUERTO_RAMA}…`);
    const child = arrancar(RAIZ, env, PUERTO_RAMA);
    let salida = "";
    child.stdout?.on("data", (d) => (salida += String(d)));
    child.stderr?.on("data", (d) => (salida += String(d)));
    const origen = `http://127.0.0.1:${PUERTO_RAMA}`;
    try {
      await esperarListo(`${origen}/`, 90_000).catch((e) => {
        throw new Error(`[fixture] next start no respondió a tiempo: ${e}\n\n── stdout/stderr ──\n${salida}`);
      });
      console.log("✔ [fixture] next start responde.");

      const browser = await playwright.chromium.launch({ headless: true });
      try {
        console.log("▸ Captura #1 (se convierte en la fixture)…");
        const captura1 = await capturarArbol(browser, origen, "fixture-1", join(SALIDA_DIR, "fixture-1"));
        console.log("▸ Captura #2 (prueba de determinismo — misma corrida de servidor, página nueva)…");
        const captura2 = await capturarArbol(browser, origen, "fixture-2", join(SALIDA_DIR, "fixture-2"));

        console.log("\n" + "─".repeat(78));
        console.log("PRUEBA DE DETERMINISMO — misma árbol, 2 capturas, modo determinista activo:");
        console.log("─".repeat(78));
        let determinista = true;
        for (const clave of CLAVES_FIXTURE) {
          const pA = rutaDeClave(captura1, clave);
          const pB = rutaDeClave(captura2, clave);
          const r = compararPng(pA, pB, clave, join(SALIDA_DIR, "diffs-determinismo", `${clave}.png`));
          if (r.dimensionesDistintas) {
            determinista = false;
            console.log(`  ${clave} → TAMAÑOS DISTINTOS entre las 2 capturas — inesperado.`);
          } else if (r.identico) {
            console.log(`  ${clave} → 0/${r.totalPixeles} px (determinista)`);
          } else {
            determinista = false;
            console.log(`  ${clave} → DIFIERE entre las 2 capturas: ${r.pixelesDistintosConscienteAA}/${r.totalPixeles} px — el freeze NO eliminó el ruido.`);
          }
        }

        console.log("\n▸ Copiando la captura #1 a " + FIXTURE_DIR + " (fixture fijo, se commitea)…");
        for (const clave of CLAVES_FIXTURE) {
          const origenPng = rutaDeClave(captura1, clave);
          const destinoPng = join(FIXTURE_DIR, `${clave}.png`);
          writeFileSync(destinoPng, readFileSync(origenPng));
          console.log(`  ✔ ${clave}.png`);
        }

        // ── Calibración: inyectar un override de --sf-fondo y diffear contra el fixture recién
        // escrito. Debe dar ≠0px — si diera 0, el pipeline de captura+diff no está atrapando nada.
        console.log("\n" + "─".repeat(78));
        console.log("CALIBRACIÓN — override de --sf-fondo sobre la home, diff contra el fixture:");
        console.log("─".repeat(78));
        const pageCalib = await browser.newPage({
          viewport: { width: ANCHO_VIEWPORT, height: ALTO_VIEWPORT },
          colorScheme: "light",
        });
        await activarModoDeterminista(pageCalib);
        await pageCalib.goto(`${origen}/`, { waitUntil: "networkidle", timeout: 30_000 });
        await pageCalib.addStyleTag({ content: ":root{--sf-fondo:#ff00ff !important;}" });
        await scrollearYAsentar(pageCalib);
        const destinoCalib = join(SALIDA_DIR, "calibracion-home.png");
        await pageCalib.screenshot({ path: destinoCalib, fullPage: true, animations: "disabled" });
        await pageCalib.close();
        const rCalib = compararPng(join(FIXTURE_DIR, "ruta-home.png"), destinoCalib, "calibracion:ruta-home", join(SALIDA_DIR, "diffs-calibracion", "ruta-home.png"));
        let calibracionOk: boolean;
        if (rCalib.dimensionesDistintas) {
          calibracionOk = false;
          console.log("  ✗ tamaños distintos — no se pudo calibrar.");
        } else if (rCalib.identico) {
          calibracionOk = false;
          console.log("  ✗ 0 px de diferencia — la calibración debía dar ≠0. El pipeline NO está atrapando el cambio inyectado.");
        } else {
          calibracionOk = true;
          console.log(`  ✔ DIFIERE, como se esperaba: ${rCalib.pixelesDistintosConscienteAA}/${rCalib.totalPixeles} px (consciente de AA) — el pipeline atrapa un cambio de color real.`);
        }

        console.log("\n" + "─".repeat(78));
        if (determinista && calibracionOk) {
          console.log("✔ Fixture escrito, determinismo confirmado (0px en las 2 corridas), calibración confirma que el pipeline atrapa un cambio (≠0px).");
          process.exitCode = 0;
        } else {
          console.log("✗ Algo no midió lo esperado — ver arriba antes de confiar en el fixture recién escrito.");
          process.exitCode = 1;
        }
      } finally {
        await browser.close();
      }
    } finally {
      await detener(child);
    }
  } finally {
    pg.detener();
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (process.argv.includes("--generar-fixture")) {
    return generarFixture();
  }
  console.log("─".repeat(78));
  console.log("VERIFICAR-NAYOLI-VISUAL-1 — captura headless en claro forzado, main vs. rama,");
  console.log("diff de píxeles de las rutas públicas de Nayoli + cada estado de ProductCard.");
  console.log("Medido: el storefront está forzado a claro (forcedTheme='light') y no tiene");
  console.log("estilos oscuros — CLARO FORZADO alcanza, no se repite en oscuro (§ cabecera).");
  console.log("─".repeat(78));

  mkdirSync(SALIDA_DIR, { recursive: true });
  const playwright = cargarPlaywright();

  const pg = await levantarPostgres(PUERTO_PG, BASE_PG);
  let worktreeListo = false;
  try {
    const envMigra = {
      ...process.env,
      DATABASE_URL: pg.databaseUrl,
      DIRECT_DATABASE_URL: pg.databaseUrl,
      BETTER_AUTH_SECRET: "verificar-nayoli-visual-secreto-inerte-0123456789",
      BETTER_AUTH_URL: `http://127.0.0.1:${PUERTO_RAMA}`,
    };
    migrarYSembrar(envMigra);
    sembrarEstadosProductCard(pg.databaseUrl);

    const worktreeMain = prepararWorktreeMain();
    worktreeListo = true;

    const browser = await playwright.chromium.launch({ headless: true });
    let capturaMain: CapturaArbol;
    let capturaRama: CapturaArbol;
    try {
      // SECUENCIAL, como verificar-nayoli.ts: cada árbol tiene su propio .next/ físico y su propio
      // puerto; nunca los dos next start a la vez.
      capturaMain = await buildStartCapturar(worktreeMain, PUERTO_MAIN, pg.databaseUrl, "main", browser);
      capturaRama = await buildStartCapturar(RAIZ, PUERTO_RAMA, pg.databaseUrl, "rama", browser);
    } finally {
      await browser.close();
    }

    // ── Diff por ruta + los 2 hovers ──
    const resultados: ResultadoDiff[] = [];
    for (const { nombre } of RUTAS) {
      resultados.push(
        compararPng(capturaMain.rutas[nombre], capturaRama.rutas[nombre], `ruta:${nombre}`, join(DIFF_DIR, `ruta-${nombre}.png`)),
      );
    }
    resultados.push(
      compararPng(capturaMain.hoverAutomatica, capturaRama.hoverAutomatica, "hover:automatica", join(DIFF_DIR, "hover-automatica.png")),
    );
    resultados.push(
      compararPng(capturaMain.hoverEleccion, capturaRama.hoverEleccion, "hover:eleccion", join(DIFF_DIR, "hover-eleccion.png")),
    );

    console.log("\n" + "─".repeat(78));
    console.log("RESULTADO MEDIDO — diff de píxeles, Nayoli (sin preset), main vs. rama:");
    console.log("─".repeat(78));
    let huboDiferencia = false;
    for (const r of resultados) {
      if (r.dimensionesDistintas) {
        huboDiferencia = true;
        console.log(`  ${r.clave} → TAMAÑOS DISTINTOS: main ${r.dimensionesDistintas.main} vs. rama ${r.dimensionesDistintas.rama} — no comparable pixel a pixel.`);
      } else if (r.identico) {
        console.log(`  ${r.clave} → IDÉNTICO (0/${r.totalPixeles} px, consciente de antialiasing; crudo: ${r.pixelesDistintosCrudo})`);
      } else {
        huboDiferencia = true;
        const caja = r.cajaDiff ? ` — caja [${r.cajaDiff.x0},${r.cajaDiff.y0}]–[${r.cajaDiff.x1},${r.cajaDiff.y1}]` : "";
        console.log(
          `  ${r.clave} → DIFIERE: ${r.pixelesDistintosConscienteAA}/${r.totalPixeles} px (consciente de AA), ${r.pixelesDistintosCrudo}/${r.totalPixeles} px (crudo)${caja}`,
        );
      }
    }
    console.log(`\nCapturas: ${CAPTURAS_DIR}`);
    console.log(`Diffs (de haberlos): ${DIFF_DIR}`);

    if (huboDiferencia) {
      console.log("\n✗ HAY diferencias de píxeles más allá de antialiasing — ver arriba. Es un");
      console.log("  HALLAZGO para el owner (posible bloqueo de merge), no un juicio de este script.");
      process.exitCode = 1;
    } else {
      console.log("\n✔ Cero diferencias salvo antialiasing en las 6 rutas + los 2 hovers.");
      process.exitCode = 0;
    }
  } finally {
    if (worktreeListo) quitarWorktreeMain();
    pg.detener();
  }
}

// Sólo corre `main()` cuando este archivo es el ENTRYPOINT (invocado directo, `tsx
// scripts/verificar-nayoli-visual.ts`) — `guarda-color.ts` (§ GUARDA-COLOR-NAYOLI-1) IMPORTA varias
// funciones de este módulo, y sin esta guarda ese import dispararía el `main()` completo (build de
// main + rama) como efecto secundario de cargar el archivo.
//
// `pathToFileURL`, NO una concatenación `file://${...}` a mano: el repo vive bajo una ruta CON
// ESPACIO ("All Projects"), y `import.meta.url` codifica ese espacio como `%20` mientras
// `process.argv[1]` es la ruta CRUDA del filesystem — la concatenación nunca matchea y la guarda
// quedaba SIEMPRE en `false`, silenciando el `main()` incluso invocado directo (medido: la primera
// corrida de `--generar-fixture` salió con exit 0 y CERO output — el entrypoint nunca se detectó
// como tal). `pathToFileURL(...).href` aplica la MISMA codificación que `import.meta.url`, así que
// las dos cadenas coinciden byte a byte.
const esEntrypoint = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  } catch {
    return false;
  }
})();

if (esEntrypoint) {
  main().catch((e) => {
    console.error("❌ verificar-nayoli-visual falló:", e instanceof Error ? e.stack ?? e.message : e);
    process.exitCode = 1;
  });
}
