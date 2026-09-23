// scripts/capturar-seccion.ts — § ARNES-CAPTURA-SECCION-1, § ARNES-INVOCABLE-POR-NPM-1,
// § CROMO-DEV-HIDRATACION-SPA-1.
//
// LA MITAD "APLICACIÓN" DEL ARNÉS DE CAPTURA. `scripts/capturar-seccion.sh` (el entrypoint) ya
// levantó el Postgres efímero, lo migró y exportó DATABASE_URL/DIRECT_DATABASE_URL antes de
// invocar este archivo — acá NO se toca ninguna base que no sea esa. Este script:
//
//   1. aplica el preset pedido sobre la base efímera (`aplicarPreset`, el MISMO runbook que
//      `prisma/aplicar-preset.ts` usa en producción — no se reescribe el merge quirúrgico); sin
//      `--preset` (opcional, § parseCli) NO toca la base y se captura tal cual queda tras migrar
//      (sin fila de `SiteContent` → los defaults del código, el estado que este arnés llama
//      informalmente "Nayoli" en sus dogfoods, § DECISIONS.md);
//   2. construye la app UNA VEZ (`next build`) y la SIRVE con `next start` — NUNCA `next dev`
//      (§ CROMO-DEV-HIDRATACION-SPA-1: medido que bajo `next dev --webpack`, en este sandbox, el
//      `useEffect` que arma el `IntersectionObserver` de una animación `whileInView`/
//      `staggerChildren` de framer-motion NUNCA CORRE — no es que la animación tarde, es que el
//      efecto de React que la dispara no se registra —, así que el componente queda en opacidad 0
//      para siempre y el PNG sale con el color del FONDO, no el del componente. La build de
//      producción sí hidrata: el mismo mecanismo, contra `next build`+`next start`, asienta y
//      captura el color exacto del componente);
//   3. abre Chromium headless (instalado AISLADO, § abajo — nunca como dependencia del repo),
//      captura cada ruta del storefront pedida — para una captura por SELECTOR, primero scrollea
//      el elemento al viewport y espera a que su opacidad computada asiente (§ ARNES-INVOCABLE-
//      POR-NPM-1, cierra `CROMO-ARNES-STAGGER-ANIMACION-1`: con la build de producción el efecto SÍ
//      corre, pero la transición sigue tomando un instante — esta espera es para ESO, no para el
//      hueco de `next dev` que el paso 2 ya cierra) — e imprime los valores computados de las CSS
//      custom properties de tema que esa sección usa;
//   4. captura la sección correspondiente del prototipo (`docs/prototipos/cafeone/`), lado a lado;
//   5. apaga `next start` y deja que `capturar-seccion.sh` se encargue de apagar Postgres.
//
// EL ORDEN preset-ANTES-de-build (paso 1 antes del paso 2) es CINTURÓN-Y-TIRANTES, no una
// necesidad medida: el storefront entero es `force-dynamic` (medido: `app/(storefront)/
// layout.tsx:30` — cada request re-lee SiteSetting/SiteContent de la base, `next build` no hornea
// ninguna ruta del storefront con el contenido del momento de la build). Aplicar el preset antes
// es correcto de todos modos, y sigue siéndolo si una ruta futura dejara de ser dinámica.
//
// EMPAQUETA LO QUE `WORKER-CAPTURA-HEADLESS-CENSO-1` YA PROBÓ A MANO (navegador headless + base
// efímera + app real + screenshot real): este archivo no inventa un mecanismo nuevo, ensambla los
// mismos cuatro pasos en un comando reusable.
//
// INVOCACIÓN CANÓNICA: `npm run capturar:seccion -- <flags>` (§ ARNES-INVOCABLE-POR-NPM-1) — corre
// bajo el tope `npm` que el dispatch de un worker YA concede, sin pedir una aprobación de `bash
// <script>.sh` que en modo no interactivo nadie puede dar. `bash scripts/capturar-seccion.sh
// <flags>` sigue funcionando igual para quien corra esto fuera del dispatch (una terminal humana).
//
// ─── PLAYWRIGHT ES UNA HERRAMIENTA AISLADA, NUNCA UNA DEPENDENCIA DEL REPO ──────────────────────
// `touches:` de este slice no incluye `package.json` ni `package-lock.json`, y aunque lo
// incluyera: un arnés de CAPTURA no tiene por qué inflar el árbol de dependencias de la app que
// audita. Playwright se instala con `npm install --prefix <dir> playwright` — un `--prefix`
// arma un `package.json`/`node_modules` PROPIOS en `<dir>`, sin tocar los del repo (verificado:
// `git status` queda limpio después). El `<dir>` es `.arnes-tooling/playwright/`, gitignoreado
// y PERSISTENTE entre corridas (no se reinstala si ya está) — así el costo de red/descarga se
// paga UNA vez por máquina, no una vez por slice. Se importa con `createRequire` apuntado a ESE
// `package.json`, nunca con un `import 'playwright'` estático — eso mantendría `playwright`
// resoluble para `tsc`/`eslint` sólo si viviera en el `node_modules` del repo, que es justo lo
// que este diseño evita.
//
// PRERREQUISITO (igual que Postgres en `scripts/test-integracion.sh`): red la PRIMERA vez que
// corre en una máquina nueva (descarga el paquete `playwright` + el binario de Chromium, unos
// cientos de MB). Ya cacheado, es rápido — es la medición de `WORKER-CAPTURA-HEADLESS-CENSO-1`.
//
// LÍMITE DECLARADO: este script asume que NINGÚN `npm run dev` real (ni otra corrida de este
// mismo arnés) está corriendo sobre el mismo checkout — `next build` SOBREESCRIBE el `.next/` del
// repo (no hay forma de darle un `distDir` propio sin tocar `next.config.ts`, fuera de
// `touches:`), así que un `next dev` concurrente vería su artefacto reescrito a mitad de corrida.
// Es la misma precondición que ya rige el gate visual (§ PRECONDICIÓN, CLAUDE.md): un solo
// servidor de desarrollo/build a la vez sobre el checkout.
import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, dirname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROTOTIPO_DIR = join(RAIZ, "docs", "prototipos", "cafeone");
const TOOLING_DIR = join(RAIZ, ".arnes-tooling", "playwright");
const CAPTURAS_DIR = join(RAIZ, ".capturas");

// El matiz del owner, impreso EN CADA CORRIDA (§ ARNES-CAPTURA-SECCION-1, punto 2 del spec): una
// guarda que no dice lo que NO cubre se lee como si cubriera todo.
const BANNER = [
  "─".repeat(78),
  "ESTA CAPTURA PRUEBA QUE EL TEMA SE APLICÓ Y LA BANDA RENDERIZA.",
  "NO PRUEBA QUE SE VEA BIEN. El gate de gusto es del owner.",
  "─".repeat(78),
].join("\n");

const VARS_TEMA_POR_DEFECTO = ["--sf-fondo", "--sf-tinta", "--sf-acento"];

// ─── Mínimo de tipos que este script usa de Playwright — evita `import 'playwright'` estático
// (§ arriba) sin caer en `any` suelto por el repo (el lint del template trata `no-explicit-any`
// como señal real, § eslint.config.mjs). No es la superficie completa del SDK, sólo la que se
// invoca acá.
interface PlaywrightPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  screenshot(opts: { path: string; fullPage?: boolean }): Promise<Buffer>;
  locator(selector: string): PlaywrightLocator;
  evaluate<T, Arg = undefined>(fn: (arg: Arg) => T, arg: Arg): Promise<T>;
  waitForFunction(
    fn: (arg: string) => boolean,
    arg: string,
    opts?: { timeout?: number; polling?: number | "raf" },
  ): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}
interface PlaywrightLocator {
  screenshot(opts: { path: string }): Promise<Buffer>;
  waitFor(opts?: { timeout?: number }): Promise<void>;
}
interface PlaywrightBrowser {
  newPage(opts?: { viewport?: { width: number; height: number } }): Promise<PlaywrightPage>;
  close(): Promise<void>;
}
interface PlaywrightModule {
  chromium: { launch(opts?: { headless?: boolean }): Promise<PlaywrightBrowser> };
}

function cargarPlaywright(): PlaywrightModule {
  const pkgJson = join(TOOLING_DIR, "package.json");
  if (!existsSync(pkgJson)) {
    console.log(`▸ Playwright no está instalado (aislado) — instalando en ${TOOLING_DIR}…`);
    mkdirSync(TOOLING_DIR, { recursive: true });
    // SIN --save-exact/--no-package-lock: --prefix ya arma un árbol propio, aislado del repo
    // (verificado con git status limpio en ARNES-CAPTURA-SECCION-1).
    const r = spawnSync("npm", ["install", "--prefix", TOOLING_DIR, "playwright"], {
      stdio: "inherit",
      cwd: RAIZ,
    });
    if (r.status !== 0) {
      throw new Error("No se pudo instalar Playwright de forma aislada — ver la salida de npm arriba.");
    }
  }
  const cliJs = join(TOOLING_DIR, "node_modules", "playwright", "cli.js");
  console.log("▸ Verificando Chromium (npx-less, vía la instalación aislada)…");
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

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────
interface Opciones {
  preset: string | undefined;
  rutas: string[];
  selectoresApp: (string | undefined)[];
  prototipos: string[];
  selectoresPrototipo: (string | undefined)[];
  nombre: string;
  varsExtra: string[];
  puertoApp: number;
}

function ayuda(): string {
  return `
Uso:
  node --import tsx scripts/capturar-seccion.ts [--preset <CLAVE>] \\
    --ruta <path-storefront> --prototipo <archivo-bajo-docs/prototipos/cafeone> \\
    [--selector-app <css>] [--selector-prototipo <css>] \\
    [--nombre <slug-de-salida>] [--var <--custom-property>] [--puerto-app <n>]

--ruta y --prototipo son REQUERIDOS, repetibles, y se emparejan POR ÍNDICE (la
1ª --ruta con el 1º --prototipo, etc.) — deben venir en la misma cantidad.
--selector-app / --selector-prototipo son OPCIONALES y también se emparejan por
índice; sin selector para un índice dado, esa captura es de PÁGINA COMPLETA.
--preset es OPCIONAL: sin él, la base efímera NO se toca (queda tal cual migró,
sin fila de SiteContent → los defaults del código) — es cómo se captura el
estado "sin preset" para comparar contra un preset aplicado.
--var agrega una CSS custom property más a la lista impresa (el default ya
incluye --sf-fondo, --sf-tinta, --sf-acento).

Ejemplo:
  node --import tsx scripts/capturar-seccion.ts --preset CORTE \\
    --ruta / --selector-app "#hero" \\
    --prototipo index.html --selector-prototipo ".hero" \\
    --nombre hero
`.trim();
}

function parseCli(argv: string[]): Opciones {
  const { values } = parseArgs({
    args: argv,
    options: {
      preset: { type: "string" },
      ruta: { type: "string", multiple: true },
      "selector-app": { type: "string", multiple: true },
      prototipo: { type: "string", multiple: true },
      "selector-prototipo": { type: "string", multiple: true },
      nombre: { type: "string" },
      var: { type: "string", multiple: true },
      "puerto-app": { type: "string" },
      ayuda: { type: "boolean" },
      help: { type: "boolean" },
    },
    allowPositionals: false,
  });

  if (values.ayuda || values.help) {
    console.log(ayuda());
    process.exit(0);
  }

  const preset = values.preset;
  const rutas = values.ruta ?? [];
  const prototipos = values.prototipo ?? [];
  if (rutas.length === 0 || prototipos.length === 0) {
    throw new Error(`Hacen falta --ruta y --prototipo (al menos uno de cada uno).\n\n${ayuda()}`);
  }
  if (rutas.length !== prototipos.length) {
    throw new Error(
      `--ruta (${rutas.length}) y --prototipo (${prototipos.length}) tienen que venir en la MISMA cantidad — se emparejan por índice.`,
    );
  }
  const selectoresAppIn = values["selector-app"] ?? [];
  const selectoresProtoIn = values["selector-prototipo"] ?? [];
  if (selectoresAppIn.length > 0 && selectoresAppIn.length !== rutas.length) {
    throw new Error(`--selector-app, si se pasa, tiene que venir una vez por --ruta (${rutas.length}).`);
  }
  if (selectoresProtoIn.length > 0 && selectoresProtoIn.length !== prototipos.length) {
    throw new Error(`--selector-prototipo, si se pasa, tiene que venir una vez por --prototipo (${prototipos.length}).`);
  }

  return {
    preset,
    rutas,
    selectoresApp: rutas.map((_, i) => selectoresAppIn[i]),
    prototipos,
    selectoresPrototipo: prototipos.map((_, i) => selectoresProtoIn[i]),
    nombre: values.nombre ?? `${preset ? preset.toLowerCase() : "sin-preset"}-${Date.now()}`,
    varsExtra: values.var ?? [],
    puertoApp: values["puerto-app"] ? Number(values["puerto-app"]) : 3477,
  };
}

// ─── El servidor estático del prototipo, con el parche de `assets/` ─────────────────────────────
//
// HALLAZGO (§ ARNES-CAPTURA-SECCION-1, medido — no arreglado, porque `docs/` no está en
// `touches:`): `index.html` y `producto.html` referencian `assets/css/…` y `assets/js/…`, pero el
// árbol real de este repo NO tiene carpeta `assets/` — los archivos viven en `css/`, `js/`, `ds/`
// directo bajo `docs/prototipos/cafeone/` (confirmado: `find docs/prototipos/cafeone -type d` da
// sólo esos tres). Servido tal cual, el prototipo cargaría SIN estilos — una captura inútil para
// comparar contra la app. Este servidor reescribe `/assets/<algo>` → `/<algo>` AL SERVIR, sin
// tocar los `.html` del prototipo. Ver DECISIONS.md, § ARNES-CAPTURA-SECCION-1, para el
// seguimiento (alguien con `docs/` en su `touches:` decide si el fix real va en el HTML).
const TIPOS_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function servirPrototipo(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  // El parche: `assets/x` no existe, el archivo real es `x` (§ el hallazgo, arriba).
  pathname = pathname.replace(/^\/assets\//, "/");
  if (pathname === "/") pathname = "/index.html";

  const destino = normalize(join(PROTOTIPO_DIR, pathname));
  // No salir de PROTOTIPO_DIR — ni por accidente (un selector/ruta mal armado no debe poder leer
  // fuera de la carpeta del prototipo).
  if (!destino.startsWith(PROTOTIPO_DIR + sep) && destino !== PROTOTIPO_DIR) {
    response.writeHead(403).end("Fuera de docs/prototipos/cafeone/");
    return;
  }
  if (!existsSync(destino)) {
    response.writeHead(404).end(`No existe: ${pathname}`);
    return;
  }
  const tipo = TIPOS_MIME[extname(destino).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": tipo });
  response.end(readFileSync(destino));
}

async function levantarServidorPrototipo(): Promise<{ puerto: number; cerrar: () => Promise<void> }> {
  const server = createServer(servirPrototipo);
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  const puerto = (server.address() as AddressInfo).port;
  return {
    puerto,
    cerrar: () => new Promise<void>((res) => server.close(() => res())),
  };
}

// ─── Esperar a que un puerto HTTP responda ───────────────────────────────────────────────────────
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

// ─── Esperar a que asiente una animación de entrada (framer-motion) antes de capturar ────────────
//
// § ARNES-INVOCABLE-POR-NPM-1, cierra `CROMO-ARNES-STAGGER-ANIMACION-1`: un elemento envuelto en
// `whileInView`/`staggerChildren` (el CTA de Suscripción, el hero con stagger de ARRANQUE, …)
// arranca en opacidad 0 y sólo llega a 1 cuando su `IntersectionObserver` dispara Y la transición
// termina. Sin esto, el arnés capturaba el elemento a mitad de transición — el valor CSS
// computado de `:root` ya era correcto, pero el PNG salía semi-transparente (medido en
// `CROMO-EJES-PALETA-AL-RENDER-1`: el promedio de color del botón daba el fondo de la banda, no el
// del botón). Se scrollea el elemento al centro del viewport (dispara la intersección) y se
// espera, con TOPE, a que su opacidad computada asiente — nunca cuelga: una animación que no
// asienta en el tope se captura igual, con una advertencia por consola, para que un `motion` roto
// no pueda trabar el arnés entero.
//
// LA OPACIDAD SE REVISA POR LA CADENA DE ANCESTROS, NO SÓLO DEL ELEMENTO — MEDIDO, no supuesto: el
// `motion.div` que framer-motion anima con `initial="hidden"`/`whileInView="visible"` casi siempre
// es un ANCESTRO del selector que un slice pide capturar (el CTA de Suscripción, p. ej., es un
// `<a>` DENTRO del `motion.div` que trae la opacidad 0→1), y `getComputedStyle(el).opacity` del
// propio `<a>` da SIEMPRE "1" — el CSS `opacity` no es heredado como valor computado; lo que se ve
// transparente en pantalla es la COMPOSICIÓN visual de los ancestros, no una propiedad del nodo
// hoja. Chequear sólo el nodo hoja resuelve el `waitForFunction` de inmediato y el PNG sigue
// saliendo semi-transparente — se verificó EN LA PRIMERA CORRIDA de este arnés contra el CTA real
// (centro del PNG: rgb(253,251,247), el fondo de la página, no el rojo `#a70004` del acento) antes
// de corregir esto. El chequeo camina el elemento Y cada ancestro hasta `<html>`.
const TIMEOUT_ASENTAMIENTO_MS = 4000;

async function esperarAsentamiento(page: PlaywrightPage, selector: string): Promise<void> {
  await page.evaluate<void, string>((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  }, selector);
  const asentada = await page
    .waitForFunction(
      (sel) => {
        let nodo: Element | null = document.querySelector(sel);
        if (!nodo) return true; // el selector no resuelve — no le compete a esta espera, `waitFor` ya lo cubrió antes
        while (nodo) {
          const opacidad = parseFloat(getComputedStyle(nodo).opacity);
          if (!Number.isNaN(opacidad) && opacidad < 0.98) return false;
          nodo = nodo.parentElement;
        }
        return true;
      },
      selector,
      { timeout: TIMEOUT_ASENTAMIENTO_MS, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
  if (!asentada) {
    console.log(
      `  ⚠ "${selector}" no asentó su opacidad en ${TIMEOUT_ASENTAMIENTO_MS}ms — se captura igual (§ CROMO-ARNES-STAGGER-ANIMACION-1)`,
    );
  }
}

function puertoLibre(puerto: number): Promise<boolean> {
  return new Promise((res) => {
    const probe = createServer();
    probe.once("error", () => res(false));
    probe.listen(puerto, "127.0.0.1", () => probe.close(() => res(true)));
  });
}

// ─── El entorno que comparten `next build` y `next start` (DATABASE_URL ya está en el proceso) ──
function entornoApp(puerto: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PORT: String(puerto),
    // Dummies defensivos: el storefront no importa lib/auth (verificado — proxy.ts sólo
    // gatea /admin(.*) y el layout del storefront no lo importa), pero `next build` SÍ recorre
    // (para "Collecting page data") las rutas de admin/API que sí lo importan — si algo
    // transitivo llegara a leer estos valores al construir o al servir, que sea un dummy inerte
    // y no el `.env` real del checkout.
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "arnes-captura-secreto-inerte",
    BETTER_AUTH_URL: `http://127.0.0.1:${puerto}`,
  };
}

// ─── `next build` UNA VEZ, bloqueante — § CROMO-DEV-HIDRATACION-SPA-1 (arriba, cabecera) ────────
function construirNext(puerto: number): void {
  console.log("▸ Construyendo la app (`next build`, una vez — puede tardar más que un arranque de `next dev`)…");
  const r = spawnSync("npx", ["next", "build"], {
    cwd: RAIZ,
    env: entornoApp(puerto),
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error(
      "`next build` falló (ver la salida arriba) — el arnés no puede capturar sin una build de " +
        "producción: bajo `next dev` los efectos de React que disparan una animación de entrada " +
        "no corren en este sandbox (§ CROMO-DEV-HIDRATACION-SPA-1) y la captura saldría con el " +
        "color del fondo, no el del componente.",
    );
  }
  console.log("✔ `next build` terminó.");
}

// ─── `next start` (la build de arriba, servida) contra la base efímera ──────────────────────────
//
// § ARNES-NEXT-START-PROCESO-HUERFANO-1: MEDIDO en el dogfood de `CROMO-DEV-HIDRATACION-SPA-1` que
// el proceso que sirve el puerto NO es este `child` — `npx` resuelve y lanza `next`, que a su vez
// termina corriendo como un `next-server (v…)` (el binario se renombra vía `process.title`, ver
// `next/dist/server/lib/start-server.js`) en un proceso HIJO de éste, no en el proceso mismo que
// `spawn` devuelve. Matar sólo `child` (como hacía `detenerProceso` antes) mata al padre; el
// `next-server` que de verdad tiene el puerto abierto se REPARENTA a init y queda HUÉRFANO,
// reteniendo el puerto — uno por corrida.
//
// EL ARREGLO: `detached: true` hace de ESTE hijo el LÍDER de un grupo de procesos NUEVO
// (pgid === su propio pid). Ningún paso de la cadena (`npx` → `next` → `next-server`) se
// desprende de ese grupo por su cuenta — nada acá llama `setsid`/`detached` de nuevo—, así que
// TODO el árbol queda en el mismo grupo y `detenerProceso` lo mata de una sola señal, dirigida al
// PID NEGATIVO (`process.kill(-pid, …)`, la convención POSIX para "todo el grupo", no un PID
// suelto). Cada corrida arranca su PROPIO grupo (pgid = pid del `npx` de ESA corrida), así que
// esto nunca alcanza a un `next-server` de otro checkout u otra corrida — sólo al árbol que este
// `arrancarNextStart` acaba de lanzar.
function arrancarNextStart(puerto: number): ChildProcess {
  return spawn(
    "npx",
    ["next", "start", "-p", String(puerto)],
    {
      cwd: RAIZ,
      env: entornoApp(puerto),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
}

async function detenerProceso(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  const pid = child.pid;
  // Manda la señal al GRUPO (§ arriba), no al PID suelto — así alcanza también al `next-server`
  // huérfano. Si el grupo ya no existe (ESRCH — todo el árbol salió solo entre el chequeo y acá),
  // cae al `child.kill` de siempre como red; cualquier otro error también cae ahí.
  const matarArbol = (señal: NodeJS.Signals) => {
    if (pid === undefined) {
      child.kill(señal);
      return;
    }
    try {
      process.kill(-pid, señal);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") child.kill(señal);
    }
  };
  await new Promise<void>((res) => {
    child.once("exit", () => res());
    matarArbol("SIGTERM");
    // `next start` a veces tarda en soltar el puerto; si a los 5s el padre sigue vivo, KILL al
    // árbol entero (no sólo al padre — el huérfano que este fix cierra no reacciona a un KILL
    // dirigido sólo al PID que ya no lo controla).
    setTimeout(() => {
      if (child.exitCode === null) matarArbol("SIGKILL");
    }, 5000);
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(BANNER);
  const opciones = parseCli(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta DATABASE_URL en el entorno — este script se corre a través de scripts/capturar-seccion.sh, " +
        "que levanta el Postgres efímero y lo exporta ANTES de llamar acá. No correrlo suelto.",
    );
  }

  // El preset se aplica ANTES de `next build` (cinturón-y-tirantes: el storefront es
  // force-dynamic, § cabecera del archivo — ninguna ruta capturada hornea contenido de build,
  // pero aplicar antes es correcto de todos modos y no cuesta nada extra).
  if (opciones.preset) {
    console.log(`▸ Aplicando el preset «${opciones.preset}» sobre la base efímera…`);
    const { aplicarPreset, PresetIncompletoError } = await import("../lib/config/site-content-write");
    const { PRESETS } = await import("../lib/config/themes");
    const preset = PRESETS.find((p) => p.clave === opciones.preset);
    if (!preset) {
      throw new Error(`Preset «${opciones.preset}» desconocido. Catálogo: ${PRESETS.map((p) => p.clave).join(", ")}`);
    }
    try {
      await aplicarPreset(preset);
    } catch (e) {
      if (e instanceof PresetIncompletoError) {
        throw new Error(`El preset «${opciones.preset}» está incompleto — no se puede aplicar: ${e.message}`);
      }
      throw e;
    }
    console.log(`✔ Preset «${opciones.preset}» aplicado.`);
  } else {
    console.log(
      "▸ Sin --preset: la base efímera NO se toca (queda tal cual migró, sin fila de SiteContent → " +
        "los defaults del código).",
    );
  }

  if (!(await puertoLibre(opciones.puertoApp))) {
    throw new Error(
      `El puerto ${opciones.puertoApp} está ocupado — ¿hay un \`npm run dev\` corriendo? ` +
        `Este arnés no puede compartirlo (usa --puerto-app para elegir otro).`,
    );
  }

  construirNext(opciones.puertoApp);

  mkdirSync(CAPTURAS_DIR, { recursive: true });
  const salidaDir = join(CAPTURAS_DIR, opciones.nombre);
  mkdirSync(salidaDir, { recursive: true });

  const playwright = cargarPlaywright();

  console.log(`▸ Arrancando \`next start\` (la build de arriba) en :${opciones.puertoApp}…`);
  const appProc = arrancarNextStart(opciones.puertoApp);
  let salidaApp = "";
  appProc.stdout?.on("data", (d) => (salidaApp += String(d)));
  appProc.stderr?.on("data", (d) => (salidaApp += String(d)));

  const servidorProto = await levantarServidorPrototipo();

  const registro: Record<string, unknown> = {
    preset: opciones.preset ?? null,
    generadoEn: new Date().toISOString(),
    capturas: [] as unknown[],
  };

  try {
    await esperarListo(`http://127.0.0.1:${opciones.puertoApp}/`, 90_000).catch((e) => {
      throw new Error(`\`next start\` no respondió a tiempo: ${e}\n\n── stdout/stderr ──\n${salidaApp}`);
    });
    console.log("✔ `next start` responde.");

    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

      for (let i = 0; i < opciones.rutas.length; i++) {
        const ruta = opciones.rutas[i];
        const selectorApp = opciones.selectoresApp[i];
        const prototipo = opciones.prototipos[i];
        const selectorProto = opciones.selectoresPrototipo[i];

        console.log(`▸ [${i}] app ${ruta}${selectorApp ? ` (${selectorApp})` : " (página completa)"}`);
        await page.goto(`http://127.0.0.1:${opciones.puertoApp}${ruta}`, { waitUntil: "networkidle", timeout: 30_000 });
        await page.waitForTimeout(300); // margen corto para animaciones de entrada / fuentes

        const appPng = join(salidaDir, `app-${i}.png`);
        if (selectorApp) {
          const loc = page.locator(selectorApp);
          await loc.waitFor({ timeout: 10_000 });
          await esperarAsentamiento(page, selectorApp);
          await loc.screenshot({ path: appPng });
        } else {
          await page.screenshot({ path: appPng, fullPage: true });
        }

        const varsAPedir = [...VARS_TEMA_POR_DEFECTO, ...opciones.varsExtra];
        const valores = await page.evaluate((vars: string[]) => {
          const raiz = getComputedStyle(document.documentElement);
          const out: Record<string, string> = {};
          for (const v of vars) out[v] = raiz.getPropertyValue(v).trim();
          return out;
        }, varsAPedir);
        console.log(`  valores computados (${ruta}):`, valores);

        console.log(`▸ [${i}] prototipo ${prototipo}${selectorProto ? ` (${selectorProto})` : " (página completa)"}`);
        await page.goto(`http://127.0.0.1:${servidorProto.puerto}/${prototipo}`, { waitUntil: "networkidle", timeout: 30_000 });
        await page.waitForTimeout(300);

        const protoPng = join(salidaDir, `prototipo-${i}.png`);
        if (selectorProto) {
          const loc = page.locator(selectorProto);
          await loc.waitFor({ timeout: 10_000 });
          await esperarAsentamiento(page, selectorProto);
          await loc.screenshot({ path: protoPng });
        } else {
          await page.screenshot({ path: protoPng, fullPage: true });
        }

        (registro.capturas as unknown[]).push({
          indice: i,
          ruta,
          selectorApp: selectorApp ?? null,
          appPng,
          prototipo,
          selectorPrototipo: selectorProto ?? null,
          protoPng,
          valoresComputados: valores,
        });
      }

      await page.close();
    } finally {
      await browser.close();
    }
  } finally {
    await servidorProto.cerrar();
    await detenerProceso(appProc);
  }

  const leeme = [
    BANNER,
    "",
    `Preset: ${opciones.preset ?? "(ninguno — base sin tocar)"}`,
    `Generado: ${String(registro.generadoEn)}`,
    "",
    ...(registro.capturas as Array<Record<string, unknown>>).map(
      (c) =>
        `[${c.indice}] app-${c.indice}.png (${c.ruta}${c.selectorApp ? `, ${c.selectorApp}` : ""}) ` +
        `↔ prototipo-${c.indice}.png (${c.prototipo}${c.selectorPrototipo ? `, ${c.selectorPrototipo}` : ""})\n` +
        `    valores: ${JSON.stringify(c.valoresComputados)}`,
    ),
  ].join("\n");
  writeFileSync(join(salidaDir, "LEEME.txt"), leeme + "\n");
  writeFileSync(join(salidaDir, "valores.json"), JSON.stringify(registro, null, 2) + "\n");

  console.log(`\n✔ Capturas en ${salidaDir}`);
  console.log(BANNER);
}

main().catch((e) => {
  console.error("❌ capturar-seccion falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
