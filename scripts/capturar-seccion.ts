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
// servidor de desarrollo/build a la vez sobre el checkout. Esto NO aplica al modo `--url` de abajo
// (no toca `.next/`, no arranca ningún servidor local para la app).
//
// ─── MODO `--url`: EL MUESTRARIO YA DESPLEGADO, NO UNA BASE FRESCA (§ ARNES-CAPTURA-MUESTRARIO-
// REAL-1) ─────────────────────────────────────────────────────────────────────────────────────
// Con `--url <URL>` este script SALTEA TODO LO DE ARRIBA — Postgres efímero, preset, `next
// build`/`next start` — y navega Playwright DIRECTO contra la URL dada (el muestrario en
// producción/preview de Vercel). Es una bifurcación ADITIVA: sin `--url` el comportamiento es
// EXACTAMENTE el de siempre (§ arriba). `--url` y `--preset` son MUTUAMENTE EXCLUYENTES — no hay
// base local que un preset pudiera tocar cuando el destino es una URL ya servida. Sin `--ruta`,
// el modo `--url` asume una única ruta implícita (`/`) — el ejemplo canónico de este modo no
// repite `--ruta /` porque la URL ya la trae.
//
// LA TRAMPA DE DEPLOYMENT PROTECTION SE MIDE AL NAVEGAR, NUNCA SE ASUME. Un deployment de Vercel
// con Deployment Protection encendida responde 401 o redirige al SSO de Vercel
// (`vercel.com/login`/`sso-api`) — un headless que reciba eso y siga capturando estaría
// screenshoteando una pantalla de login, no el muestrario. `verificarSinProteccion` (abajo) lee el
// `Response` que el propio `page.goto` ya devuelve tras cada navegación en modo `--url` y PARA la
// corrida entera (sin escribir ni un PNG) si detecta cualquiera de las dos señales. Si la
// navegación da 200, sigue — medido así contra el muestrario real de este repo antes de escribir
// esto (`fetch` desde Node: status 200, sin redirect). Este script NUNCA hardcodea un token de
// bypass (`x-vercel-protection-bypass`) — si la protección está encendida, apagarla o pasarle un
// bypass al arnés es decisión del owner, no de este script.
//
// TRES CAPACIDADES NUEVAS, LAS TRES OPERACIONES ESTÁNDAR DE PLAYWRIGHT — cierran los límites a/b/c
// que la cadena `CROMO-VOLVER-ARRIBA-1`/`CROMO-RIEL-SOCIAL-1`/`CROMO-NAV-TRATAMIENTO-1` midió y
// dejó como open followups (`CROMO-CAPTURA-ARNES-SCROLL-FIJO-1`, `-VIEWPORT-FIJO-1`,
// `-ESTILO-ELEMENTO-1`), y funcionan en LOS DOS MODOS (con o sin `--url`) porque son capacidades
// genéricas del arnés, no exclusivas del modo URL:
//   - `--scroll <px>` — `window.scrollTo(0, px)` tras cada navegación (app Y prototipo), antes de
//     capturar: revela chrome fijo-por-scroll (el botón "volver arriba", que sólo aparece con
//     `scrollY > innerHeight`, § `components/storefront/BackToTop.tsx`).
//   - `--ancho <px>` / `--alto <px>` — el viewport de Playwright ya NO está hardcodeado a
//     1280×900: revela chrome fijo-por-ancho (el riel social, `min-width:1560px`).
//   - `--estilo-elemento <propiedad>` (repetible) — además de los `--var` de `:root`, imprime
//     `getComputedStyle(nodo)[propiedad]` del NODO que `--selector-app`/`--selector-prototipo` ya
//     localizó — no sólo custom properties de `:root`. El default
//     (`PROPS_ESTILO_ELEMENTO_POR_DEFECTO`, abajo) ya cubre `text-transform`/`letter-spacing`/
//     `font-weight`/`font-family`/`color`/`position` — el set que `CROMO-NAV-TRATAMIENTO-1` tuvo
//     que verificar por el rodeo (screenshot + grep del artefacto compilado) porque este mecanismo
//     no existía todavía.
import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, dirname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
// `import type` se borra por completo en compilación (§ TS, verbatimModuleSyntax) — no ejecuta el
// módulo de `@duna/core` ni exige env vars sólo para tipar `Prisma.InputJsonValue`
// (§ sembrarSpotlight, abajo, § NUESTRO-CAFE-COMO-MUESTRARIO-1). El VALOR (`prisma`, el cliente) se
// sigue cargando con `import()` dinámico, como el resto de este archivo.
import type { Prisma } from "@duna/core";

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

// § ARNES-CAPTURA-MUESTRARIO-REAL-1 — el set por defecto de propiedades DIRECTAS del nodo
// seleccionado (no custom properties de `:root`, § `--var`/VARS_TEMA_POR_DEFECTO arriba). Cubre
// exactamente lo que un tratamiento tipográfico como el de `CROMO-NAV-TRATAMIENTO-1` necesita
// verificar y que hasta ahora sólo se podía leer por el rodeo (grep del artefacto compilado).
const PROPS_ESTILO_ELEMENTO_POR_DEFECTO = [
  "text-transform",
  "letter-spacing",
  "font-weight",
  "font-family",
  "color",
  "position",
];

// ─── Mínimo de tipos que este script usa de Playwright — evita `import 'playwright'` estático
// (§ arriba) sin caer en `any` suelto por el repo (el lint del template trata `no-explicit-any`
// como señal real, § eslint.config.mjs). No es la superficie completa del SDK, sólo la que se
// invoca acá.
interface PlaywrightResponse {
  status(): number;
  url(): string;
}
interface PlaywrightPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<PlaywrightResponse | null>;
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
  // § COMPRA-LINEAS-FIDELIDAD-1 — `.first()`/`.click()`, para `ejecutarAccionPrevia` (abajo): el
  // resto del archivo nunca necesitó clickear nada, sólo screenshotear lo que ya estaba en pantalla.
  first(): PlaywrightLocator;
  click(opts?: { timeout?: number }): Promise<void>;
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
  url: string | undefined;
  rutas: string[];
  selectoresApp: (string | undefined)[];
  prototipos: string[];
  selectoresPrototipo: (string | undefined)[];
  nombre: string;
  varsExtra: string[];
  puertoApp: number;
  scrollPx: number | undefined;
  anchoPx: number;
  altoPx: number;
  estiloElementoExtra: string[];
  sembrarSpotlight: boolean;
  sembrarOrigen: boolean;
  // COMPRA-LINEAS-FIDELIDAD-1 — ver el docstring de `sembrarCompra`/`ejecutarAccionPrevia`, abajo.
  sembrarCompra: "onix" | "chamisas" | undefined;
  accionesPrevias: (string | undefined)[];
  sinPrototipo: boolean;
  // CHAMISAS-SUSCRIPCIONES-CASILLAS-1 — ver el docstring de `sembrarCasillas`, abajo.
  sembrarCasillas: boolean;
  // CHAMISAS-NOSOTROS-ALBUM-1 — ver el docstring de `sembrarAlbumNosotros`, abajo.
  sembrarAlbumNosotros: boolean;
  // ONIX-TAQUILLA-FILETES-1 — ver el docstring de `sembrarTaquillaOnix`, abajo.
  sembrarTaquillaOnix: boolean;
}

function ayuda(): string {
  return `
Uso (modo base fresca — Postgres efímero + \`next build\`/\`next start\`):
  node --import tsx scripts/capturar-seccion.ts [--preset <CLAVE>] \\
    --ruta <path-storefront> --prototipo <archivo-bajo-docs/prototipos/cafeone> \\
    [--selector-app <css>] [--selector-prototipo <css>] \\
    [--nombre <slug-de-salida>] [--var <--custom-property>] [--puerto-app <n>] \\
    [--scroll <px>] [--ancho <px>] [--alto <px>] [--estilo-elemento <propiedad>]

Uso (modo --url — el muestrario YA DESPLEGADO, § ARNES-CAPTURA-MUESTRARIO-REAL-1):
  node --import tsx scripts/capturar-seccion.ts --url <URL> \\
    [--ruta <path>] --prototipo <archivo-bajo-docs/prototipos/cafeone> \\
    [--selector-app <css>] [--selector-prototipo <css>] [--nombre <slug-de-salida>] \\
    [--scroll <px>] [--ancho <px>] [--alto <px>] [--estilo-elemento <propiedad>]

--ruta y --prototipo se emparejan POR ÍNDICE (la 1ª --ruta con el 1º --prototipo,
etc.) — deben venir en la misma cantidad. --prototipo es SIEMPRE requerido.
--ruta es requerido EN MODO BASE FRESCA; en modo --url es OPCIONAL y, si se
omite, se asume una única ruta implícita ("/") — la URL ya trae el destino.
--selector-app / --selector-prototipo son OPCIONALES y también se emparejan por
índice; sin selector para un índice dado, esa captura es de PÁGINA COMPLETA.
--preset es OPCIONAL y sólo válido en modo base fresca (mutuamente excluyente
con --url — no hay base local que un preset pudiera tocar contra una URL ya
servida): sin él, la base efímera NO se toca (queda tal cual migró, sin fila de
SiteContent → los defaults del código) — es cómo se captura el estado "sin
preset" para comparar contra un preset aplicado.
--url activa el modo que navega la URL YA DESPLEGADA (producción o preview de
Vercel) en vez de levantar Postgres efímero + build/start locales. Mide la
trampa de Deployment Protection AL NAVEGAR: si la respuesta es 401 o redirige
al SSO de Vercel, PARA sin capturar nada — no hardcodea ningún bypass.
--var agrega una CSS custom property más a la lista impresa desde \`:root\`
(el default ya incluye --sf-fondo, --sf-tinta, --sf-acento).
--scroll hace window.scrollTo(0, px) tras cada navegación (app y prototipo),
antes de capturar — revela chrome fijo-por-SCROLL (el botón "volver arriba").
--ancho / --alto fijan el viewport de Playwright (default 1280×900 si no se
pasan) — revela chrome fijo-por-ANCHO (el riel social, min-width:1560px).
--estilo-elemento agrega una propiedad CSS más a las que se leen con
getComputedStyle DEL NODO seleccionado (no de :root) — repetible. El default ya
incluye text-transform, letter-spacing, font-weight, font-family, color,
position. Sólo se reporta cuando hay --selector-app/--selector-prototipo (un
nodo necesita un selector para existir).
--sembrar-spotlight (§ NUESTRO-CAFE-COMO-MUESTRARIO-1) siembra, sobre la base
efímera y DESPUÉS de aplicar --preset (si se pasó), dos productos reales — el
pineado (2 moliendas, notas de cata, 250 g) y su "otra talla" (500 g) — y
publica content.spotlight con el eyebrow/título/badge/nota del prototipo, para
capturar la banda con el MISMO contenido que .spotlight muestra (index.html:
160-224) en vez de un catálogo vacío (sin siembra, productoSpotlight([], …)
da null y la banda no rinde nada — hide-on-empty). SÓLO válido en modo base
fresca (mutuamente excluyente con --url: no hay base local que sembrar contra
una URL ya desplegada, cuyo catálogo es el que sea que tenga ese entorno).
--sembrar-origen (§ ORIGEN-DATOS-EXACTO-1) siembra, sobre la base efímera y
DESPUÉS de aplicar --preset (si se pasó), los 4 pares dato + los 3 contadores
de la banda origen con el MISMO contenido que .spec-list/.stats muestra
(index.html:295-308), y publica content.origen con visible:true — sin
siembra, los 8 campos nacen VACÍOS (§ el docstring de OrigenContent) y la
lista/los contadores no rinden nada (hide-on-empty). SÓLO válido en modo base
fresca (mismo motivo que --sembrar-spotlight).
--sembrar-compra <onix|chamisas> (§ COMPRA-LINEAS-FIDELIDAD-1) siembra, sobre
la base efímera, DESPUÉS de --preset/--sembrar-spotlight/--sembrar-origen (si
se pasaron): la paleta (content.tema: fondo/tinta/acento MEDIDOS contra la
maqueta aprobada, .scratch/lanzamiento/maqueta-compra/compra.html, líneas
.ln-onix/.ln-ch), los TRES ejes de content.compra para esa tienda (Onix:
creditos/boleto/escaleta — Las Chamisas: album/lamina/album), un vendedor
completo (para la línea "Vende…"), UN producto sin moliendas (agrega directo
al carrito, sin modal) y SiteSetting.metodosPago con 'efectivo' (el único que
no pide credenciales de pasarela) para que el checkout pueda completarse.
SÓLO válido en modo base fresca (mismo motivo que --sembrar-spotlight).
--accion-previa <nombre> (repetible, se empareja por ÍNDICE con --ruta, como
--selector-app — "" es el placeholder de "sin acción para este índice")
ejecuta una interacción de Playwright ANTES de capturar esa ruta. SIETE
nombres fijos: 'abrir-carrito' (agrega el primer producto del catálogo y abre
el cajón solo); 'checkout-pago' (completa el paso 1 de /checkout y avanza al
paso 2, método efectivo); 'completar-pedido' (como checkout-pago, y además
acepta términos + confirma — crea una orden REAL y aterriza en la
confirmación); 'rastrear-noencontrado' (busca en /rastrear-pedido con datos
que no matchean nada); 'rastrear-resultado' (busca el pedido que la ÚLTIMA
completar-pedido de esta misma corrida acaba de crear — requiere una
completar-pedido en un índice ANTERIOR); 'casillas-dos-cafes' (§ CHAMISAS-
SUSCRIPCIONES-CASILLAS-1: suma una bolsa de Bourbon Rosado y una de Pacamara —
requiere --sembrar-casillas); 'casillas-quincenal' (elige la frecuencia "15
días" — requiere --sembrar-casillas). Las que dependen del carrito/de una
orden ya creada necesitan su acción previa en un índice ANTERIOR, en la MISMA
corrida (mismo browser context, § el docstring de ejecutarAccionPrevia).
Ver ese docstring para el porqué de nombres fijos y no un DSL de clicks genérico.
--sin-prototipo salta la mitad "prototipo" de la captura — sin ella NO hace
falta --prototipo. Pensado para comparar contra una maqueta que NO vive bajo
docs/prototipos/cafeone/ (§ COMPRA-LINEAS-FIDELIDAD-1: la maqueta de este
slice es un SPA de un solo archivo con estado en JS, no páginas estáticas por
sección — automatizar sus transiciones duplicaría las capturas que ya existen
en .scratch/lanzamiento/maqueta-compra/capturas/); el par se arma a mano
contra esas capturas YA EXISTENTES, no contra una captura nueva del prototipo.
--sembrar-casillas (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, actualizado por
§ CHAMISAS-CASILLAS-POR-CAFE-1) siembra, sobre la base efímera y DESPUÉS de
--preset (si se pasó): la paleta/tipografía/forma MEDIDAS contra el muestrario
real de Las Chamisas (fondo #FAF4EB, tinta #2A2522, acento #B8461A, par
"prensa" = Roboto Serif/Figtree, forma "recta" — leídas del :root que ese
despliegue ya inyecta server-side, § DECISIONS.md), TRES productos (Bourbon
Rosado/Pacamara/Papayo, los TRES bajo la MISMA categoría «Café de
especialidad» y la MISMA bolsa de 340 g — la forma real del catálogo público;
la fila de «Casillas» es el CAFÉ, no la categoría, § derivarCasillasCafes en
lib/storefront/casillas-cafes.ts), y publica suscripcionPlanes.variante:
'casillas' + SiteSetting.nombre/whatsapp. SÓLO válido en modo base fresca
(mismo motivo que --sembrar-spotlight).
--sembrar-album-nosotros (§ CHAMISAS-NOSOTROS-ALBUM-1) siembra, sobre la base
efímera: la MISMA paleta/tipografía/forma de --sembrar-casillas (medidas contra
el muestrario real de Las Chamisas), TRES productos (Bourbon Rosado/Pacamara/
Papayo, para los stickers del Interludio y las filas de "Créditos: ficha de
origen"), y publica las SEIS secciones de /nosotros con el tratamiento Chamisas
(nosotrosApertura.variante:'album', nosotrosHistoria.variante:'partida',
nosotrosEscenas.variante:'album' con 5 láminas, nosotrosFicha.variante:
'etiqueta', nosotrosInterludio.variante:'stickers', nosotrosCierre.variante:
'costura') + SiteSetting.nombre/whatsapp. SÓLO válido en modo base fresca
(mismo motivo que --sembrar-spotlight).
--sembrar-taquilla-onix (§ ONIX-TAQUILLA-FILETES-1) siembra, sobre la base
efímera: el tema real de Onix (medido con el mismo medirTemaReal que
--sembrar-compra), un catálogo 2×2 (Café en Grano/Café Molido × 250/500 g, SIN
moliendas — la selección default queda sin fila de molienda, así que la fila de
frecuencia "Cada" es la ÚLTIMA, el caso que reportó el owner) y
suscripcionPlanes.variante:'taquilla' (las 3 frecuencias ya son el default de
DEFAULTS.suscripcionPlanes) + SiteSetting.nombre/whatsapp. MUTUAMENTE
EXCLUYENTE con --sembrar-compra (catálogos distintos que romperían la matriz
2×2 si convivieran) y con --url (mismo motivo que --sembrar-spotlight).

Ejemplo (base fresca):
  node --import tsx scripts/capturar-seccion.ts --preset CORTE \\
    --ruta / --selector-app "#hero" \\
    --prototipo index.html --selector-prototipo ".hero" \\
    --nombre hero

Ejemplo (--sembrar-spotlight, § NUESTRO-CAFE-COMO-MUESTRARIO-1):
  node --import tsx scripts/capturar-seccion.ts --preset CORTE --sembrar-spotlight \\
    --ruta / --selector-app "#producto" \\
    --prototipo index.html --selector-prototipo ".spotlight" \\
    --nombre spotlight

Ejemplo (--sembrar-origen, § ORIGEN-DATOS-EXACTO-1):
  node --import tsx scripts/capturar-seccion.ts --preset CORTE --sembrar-origen \\
    --ruta / --selector-app "#origen" \\
    --prototipo index.html --selector-prototipo "#origen" \\
    --nombre origen

Ejemplo (--url, el muestrario real):
  node --import tsx scripts/capturar-seccion.ts \\
    --url https://coffee-template-app-onix.vercel.app/ \\
    --selector-app "header nav a" \\
    --prototipo index.html --selector-prototipo ".nav-link" \\
    --nombre muestrario-nav

Ejemplo (--sembrar-compra + --accion-previa + --sin-prototipo, § COMPRA-LINEAS-FIDELIDAD-1 — el
cajón de Onix, abierto con un producto):
  node --import tsx scripts/capturar-seccion.ts --sembrar-compra onix --sin-prototipo \\
    --ruta /tienda --accion-previa abrir-carrito \\
    --nombre onix-cajon

Ejemplo (--sembrar-casillas + --sin-prototipo, § CHAMISAS-SUSCRIPCIONES-CASILLAS-1):
  node --import tsx scripts/capturar-seccion.ts --sembrar-casillas --sin-prototipo \\
    --ruta /suscripciones \\
    --nombre chamisas-casillas

Ejemplo (--sembrar-album-nosotros + --sin-prototipo, § CHAMISAS-NOSOTROS-ALBUM-1):
  node --import tsx scripts/capturar-seccion.ts --sembrar-album-nosotros --sin-prototipo \\
    --ruta /nosotros \\
    --nombre chamisas-album-nosotros

Ejemplo (--sembrar-taquilla-onix + --sin-prototipo, § ONIX-TAQUILLA-FILETES-1):
  node --import tsx scripts/capturar-seccion.ts --sembrar-taquilla-onix --sin-prototipo \\
    --ruta /suscripciones \\
    --nombre onix-taquilla-filetes
`.trim();
}

function parseCli(argv: string[]): Opciones {
  const { values } = parseArgs({
    args: argv,
    options: {
      preset: { type: "string" },
      url: { type: "string" },
      ruta: { type: "string", multiple: true },
      "selector-app": { type: "string", multiple: true },
      prototipo: { type: "string", multiple: true },
      "selector-prototipo": { type: "string", multiple: true },
      nombre: { type: "string" },
      var: { type: "string", multiple: true },
      "puerto-app": { type: "string" },
      scroll: { type: "string" },
      ancho: { type: "string" },
      alto: { type: "string" },
      "estilo-elemento": { type: "string", multiple: true },
      "sembrar-spotlight": { type: "boolean" },
      "sembrar-origen": { type: "boolean" },
      "sembrar-compra": { type: "string" },
      "accion-previa": { type: "string", multiple: true },
      "sin-prototipo": { type: "boolean" },
      "sembrar-casillas": { type: "boolean" },
      "sembrar-album-nosotros": { type: "boolean" },
      "sembrar-taquilla-onix": { type: "boolean" },
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
  const url = values.url;
  if (url && preset) {
    throw new Error(
      `--url y --preset son mutuamente excluyentes: --url navega el muestrario YA DESPLEGADO — no ` +
        `hay base local que un preset pudiera tocar. Corré sin --url si necesitás aplicar un preset.\n\n${ayuda()}`,
    );
  }
  const sembrarSpotlight = values["sembrar-spotlight"] === true;
  if (sembrarSpotlight && url) {
    throw new Error(
      `--sembrar-spotlight y --url son mutuamente excluyentes: no hay base local que sembrar contra ` +
        `una URL ya desplegada (§ NUESTRO-CAFE-COMO-MUESTRARIO-1).\n\n${ayuda()}`,
    );
  }
  const sembrarOrigen = values["sembrar-origen"] === true;
  if (sembrarOrigen && url) {
    throw new Error(
      `--sembrar-origen y --url son mutuamente excluyentes: no hay base local que sembrar contra ` +
        `una URL ya desplegada (§ ORIGEN-DATOS-EXACTO-1).\n\n${ayuda()}`,
    );
  }
  const sembrarCompraIn = values["sembrar-compra"];
  if (sembrarCompraIn !== undefined && sembrarCompraIn !== "onix" && sembrarCompraIn !== "chamisas") {
    throw new Error(`--sembrar-compra sólo acepta "onix" o "chamisas" (recibido: «${sembrarCompraIn}»).\n\n${ayuda()}`);
  }
  const sembrarCompra = sembrarCompraIn as "onix" | "chamisas" | undefined;
  if (sembrarCompra && url) {
    throw new Error(
      `--sembrar-compra y --url son mutuamente excluyentes: no hay base local que sembrar contra ` +
        `una URL ya desplegada (§ COMPRA-LINEAS-FIDELIDAD-1).\n\n${ayuda()}`,
    );
  }
  const sinPrototipo = values["sin-prototipo"] === true;
  const sembrarCasillas = values["sembrar-casillas"] === true;
  if (sembrarCasillas && url) {
    throw new Error(
      `--sembrar-casillas y --url son mutuamente excluyentes: no hay base local que sembrar contra ` +
        `una URL ya desplegada (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1).\n\n${ayuda()}`,
    );
  }
  const sembrarAlbumNosotros = values["sembrar-album-nosotros"] === true;
  if (sembrarAlbumNosotros && url) {
    throw new Error(
      `--sembrar-album-nosotros y --url son mutuamente excluyentes: no hay base local que sembrar ` +
        `contra una URL ya desplegada (§ CHAMISAS-NOSOTROS-ALBUM-1).\n\n${ayuda()}`,
    );
  }
  const sembrarTaquillaOnix = values["sembrar-taquilla-onix"] === true;
  if (sembrarTaquillaOnix && url) {
    throw new Error(
      `--sembrar-taquilla-onix y --url son mutuamente excluyentes: no hay base local que sembrar ` +
        `contra una URL ya desplegada (§ ONIX-TAQUILLA-FILETES-1).\n\n${ayuda()}`,
    );
  }
  if (sembrarTaquillaOnix && sembrarCompra) {
    throw new Error(
      `--sembrar-taquilla-onix y --sembrar-compra son mutuamente excluyentes: los dos catálogos no ` +
        `comparten productos y mezclarlos rompería la validez de la matriz 2×2 de la Taquilla ` +
        `(§ el docstring de sembrarTaquillaOnix).\n\n${ayuda()}`,
    );
  }

  // En modo --url, sin --ruta se asume una única ruta implícita ("/") — la URL ya trae el
  // destino (§ ARNES-CAPTURA-MUESTRARIO-REAL-1, el ejemplo canónico del modo no repite --ruta /).
  const rutas = values.ruta ?? (url ? ["/"] : []);
  // § COMPRA-LINEAS-FIDELIDAD-1 — con --sin-prototipo, --prototipo deja de ser obligatorio (no hay
  // mitad "prototipo" que capturar); sin la bandera, el comportamiento de siempre se mantiene.
  const prototipos = values.prototipo ?? [];
  if (rutas.length === 0 || (!sinPrototipo && prototipos.length === 0)) {
    throw new Error(`Hacen falta --ruta y --prototipo (al menos uno de cada uno) — o --ruta y --sin-prototipo.\n\n${ayuda()}`);
  }
  if (!sinPrototipo && rutas.length !== prototipos.length) {
    throw new Error(
      `--ruta (${rutas.length}) y --prototipo (${prototipos.length}) tienen que venir en la MISMA cantidad — se emparejan por índice.`,
    );
  }
  if (sinPrototipo && prototipos.length > 0) {
    throw new Error(`--sin-prototipo y --prototipo son mutuamente excluyentes — sin la mitad "prototipo" no hay nada que emparejarle.\n\n${ayuda()}`);
  }
  const selectoresAppIn = values["selector-app"] ?? [];
  const selectoresProtoIn = values["selector-prototipo"] ?? [];
  if (selectoresAppIn.length > 0 && selectoresAppIn.length !== rutas.length) {
    throw new Error(`--selector-app, si se pasa, tiene que venir una vez por --ruta (${rutas.length}).`);
  }
  if (selectoresProtoIn.length > 0 && selectoresProtoIn.length !== prototipos.length) {
    throw new Error(`--selector-prototipo, si se pasa, tiene que venir una vez por --prototipo (${prototipos.length}).`);
  }
  const accionesPreviasIn = values["accion-previa"] ?? [];
  if (accionesPreviasIn.length > 0 && accionesPreviasIn.length !== rutas.length) {
    throw new Error(`--accion-previa, si se pasa, tiene que venir una vez por --ruta (${rutas.length}).`);
  }
  // "" es el placeholder de "sin acción para este índice" — el mismo patrón que `--selector-app`/
  // `--selector-prototipo` ya usan (una cadena vacía es falsy, así que el índice cae al
  // comportamiento de siempre, § el `if (accionPrevia)` del loop principal).
  const ACCIONES_VALIDAS = [
    "abrir-carrito", "checkout-pago", "completar-pedido", "rastrear-noencontrado", "rastrear-resultado",
    "casillas-dos-cafes", "casillas-quincenal",
  ];
  for (const a of accionesPreviasIn) {
    if (a !== "" && !ACCIONES_VALIDAS.includes(a)) {
      throw new Error(`--accion-previa sólo acepta "" (sin acción) o una de: ${ACCIONES_VALIDAS.join(", ")} (recibido: «${a}»).\n\n${ayuda()}`);
    }
  }

  return {
    preset,
    url,
    rutas,
    selectoresApp: rutas.map((_, i) => selectoresAppIn[i]),
    prototipos,
    selectoresPrototipo: sinPrototipo ? rutas.map(() => undefined) : prototipos.map((_, i) => selectoresProtoIn[i]),
    nombre:
      values.nombre ??
      (url ? `muestrario-real-${Date.now()}` : `${preset ? preset.toLowerCase() : "sin-preset"}-${Date.now()}`),
    varsExtra: values.var ?? [],
    puertoApp: values["puerto-app"] ? Number(values["puerto-app"]) : 3477,
    scrollPx: values.scroll !== undefined ? Number(values.scroll) : undefined,
    anchoPx: values.ancho ? Number(values.ancho) : 1280,
    altoPx: values.alto ? Number(values.alto) : 900,
    estiloElementoExtra: values["estilo-elemento"] ?? [],
    sembrarCompra,
    accionesPrevias: rutas.map((_, i) => accionesPreviasIn[i]),
    sinPrototipo,
    sembrarSpotlight,
    sembrarOrigen,
    sembrarCasillas,
    sembrarAlbumNosotros,
    sembrarTaquillaOnix,
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

// ─── La trampa de Deployment Protection, medida al navegar (§ ARNES-CAPTURA-MUESTRARIO-REAL-1) ──
//
// Sólo se llama en modo `--url`: en modo base fresca la navegación es siempre a 127.0.0.1, que
// nunca puede estar protegida por Vercel. Un 401 es la señal directa; una redirección al dominio
// de SSO de Vercel (`vercel.com/login` o `vercel.com/sso-api`, las dos rutas que Vercel usa para
// el flujo de autenticación de Deployment Protection) es la señal indirecta — Playwright sigue los
// redirects por defecto, así que `response.url()` ya refleja el destino final. PARA la corrida
// entera ANTES de escribir un solo PNG: capturar una pantalla de login no es "capturar con una
// advertencia", es dogfoodear sobre el dato equivocado.
function verificarSinProteccion(response: PlaywrightResponse | null, urlIntentada: string): void {
  const status = response?.status() ?? 0;
  const urlFinal = response?.url() ?? urlIntentada;
  const esSso = /vercel\.com\/(login|sso-api)/i.test(urlFinal);
  if (status === 401 || esSso) {
    throw new Error(
      `Deployment Protection detectada navegando ${urlIntentada} (status ${status}, destino final ` +
        `${urlFinal}) — PARANDO, no se captura nada. El owner decide si apaga la protección del ` +
        `deployment o si el arnés debe pasar el bypass (x-vercel-protection-bypass); este script no ` +
        `hardcodea ningún token.`,
    );
  }
}

// ─── El computed style DEL NODO (no de :root), § ARNES-CAPTURA-MUESTRARIO-REAL-1 ────────────────
// Cierra `CROMO-CAPTURA-ARNES-ESTILO-ELEMENTO-1`: además de las custom properties que `--var` lee
// de `document.documentElement`, esto lee propiedades DIRECTAS del nodo que el selector ya
// localizó — `text-transform`/`letter-spacing`/`font-weight`/… no son heredables como valor
// computado desde `:root`, así que sólo se pueden leer del elemento mismo.
async function leerEstiloElemento(
  page: PlaywrightPage,
  selector: string,
  propsExtra: string[],
): Promise<Record<string, string> | null> {
  const props = [...PROPS_ESTILO_ELEMENTO_POR_DEFECTO, ...propsExtra];
  return page.evaluate<Record<string, string> | null, { sel: string; props: string[] }>(
    (arg) => {
      const nodo = document.querySelector(arg.sel);
      if (!nodo) return null;
      const cs = getComputedStyle(nodo);
      const out: Record<string, string> = {};
      for (const p of arg.props) out[p] = cs.getPropertyValue(p);
      return out;
    },
    { sel: selector, props },
  );
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

// ─── SEMBRAR SPOTLIGHT (§ NUESTRO-CAFE-COMO-MUESTRARIO-1) ────────────────────────────────────────
//
// Sin producto pineado el catálogo de la base efímera está VACÍO (§ el hallazgo de este slice: la
// base sólo migra, nunca siembra — `productoSpotlight([], slug)` cae a `null`, hide-on-empty, y la
// banda no rinde un solo nodo), así que capturar `.spotlight`/`#producto` contra una base sin
// sembrar compararía el prototipo lleno contra un hueco vacío. Esto siembra DOS productos reales —
// el pineado (2 moliendas, notas de cata, 250 g, § MOLIENDAS/NOTAS abajo) y su "otra talla" (500
// g) — vía Prisma DIRECTO (mismos campos que `prisma/seed-products.ts`, no un mecanismo nuevo) y
// publica `content.spotlight` con el eyebrow/título/badge/nota del prototipo (`index.html:
// 164-165,169,212`) por el camino de escritura REAL del panel (`guardarBorrador` +
// `publicarSeccion('spotlight')`, § `site-content-write.ts` — no un `UPDATE` a mano que pudiera
// divergir de lo que el editor realmente escribe).
//
// Usa `@duna/core` (el cliente Prisma generado) y `lib/config/site-content-write` con `import()`
// DINÁMICO, igual que el bloque de `--preset` de arriba — mismo motivo: sólo se cargan cuando hace
// falta, y el script sigue arrancando sin tocar Prisma en modo `--url`.
async function sembrarSpotlight(): Promise<void> {
  console.log(
    "▸ --sembrar-spotlight: creando 2 productos (pineado + otra talla) y publicando content.spotlight…",
  );
  const { default: prisma } = await import("@duna/core");
  const { guardarBorrador, publicarSeccion } = await import("../lib/config/site-content-write");

  // Medido contra `.spotlight` (index.html:184-193): las dos moliendas y las tres notas de cata
  // del mockup, tal cual.
  const MOLIENDAS = [
    { nombre: "Molido", metodo: "Filtro / Greca tradicional", disponible: true },
    { nombre: "En grano", metodo: "Muele en casa a tu gusto", disponible: true },
  ];
  const NOTAS_CATA = ["Panela", "Frutos rojos", "Chocolate"];
  const DESCRIPCION =
    "Cultivamos entre 1.500 y 1.800 msnm, recogemos solo el grano maduro y lo secamos al sol " +
    "sobre marquesinas. Una taza limpia y dulce.";
  // Imágenes reales YA en `public/images/` (§ prisma/seed-products.ts) — ninguna sube a Blob.
  const SLUG_PINEADO = "arnes-spotlight-san-adolfo-250";
  const SLUG_OTRA_TALLA = "arnes-spotlight-san-adolfo-500";

  const datosBase = {
    nombre: "Café Finca San Adolfo",
    descripcion: DESCRIPCION,
    categoria: "Café en Grano",
    activo: true,
    // Cast del Json (§ prisma/seed.ts:315, el mismo patrón) — Prisma tipa la columna como
    // `Prisma.InputJsonValue`, que un array de objetos planos no satisface estructuralmente sin él.
    moliendasOpciones: MOLIENDAS as unknown as Prisma.InputJsonValue,
    notasCata: NOTAS_CATA,
  };

  await prisma.product.upsert({
    where: { slug: SLUG_PINEADO },
    update: { ...datosBase, precio: 38000, costo: 20000, peso_gramos: 250, imagen: "/images/cafe-nayoli-250g-molido.webp" },
    create: { ...datosBase, slug: SLUG_PINEADO, precio: 38000, costo: 20000, peso_gramos: 250, imagen: "/images/cafe-nayoli-250g-molido.webp" },
  });
  await prisma.product.upsert({
    where: { slug: SLUG_OTRA_TALLA },
    update: { ...datosBase, nombre: "Café Finca San Adolfo 500 g", precio: 68000, costo: 38000, peso_gramos: 500, imagen: "/images/cafe-nayoli-500g-molido-v2.webp" },
    create: { ...datosBase, nombre: "Café Finca San Adolfo 500 g", slug: SLUG_OTRA_TALLA, precio: 68000, costo: 38000, peso_gramos: 500, imagen: "/images/cafe-nayoli-500g-molido-v2.webp" },
  });

  // Copy del eyebrow/título/badge/nota MEDIDO contra `.spotlight` (index.html:164-165,169,212) —
  // el `\n` del título reproduce los `<br>` del `<h2>` del prototipo (nuestro `whitespace-pre-line`
  // ya respeta saltos de línea, § Spotlight.tsx).
  await guardarBorrador({
    spotlight: {
      visible: true,
      eyebrow: "Nuestro café",
      titulo: "Un solo origen,\ncuidado de principio\na fin.",
      badge: "Cosecha 2026",
      productoSlug: SLUG_PINEADO,
      otroTamanoSlug: SLUG_OTRA_TALLA,
      notaPrecio: "COP · impuestos incluidos",
    },
  });
  await publicarSeccion("spotlight");

  console.log("✔ Spotlight sembrado (2 productos + content.spotlight publicado).");
}

// ─── SEMBRAR ORIGEN (§ ORIGEN-DATOS-EXACTO-1) ────────────────────────────────────────────────────
//
// Los 8 campos de `content.origen` (4 pares dato + 3 contadores) NACEN VACÍOS (§ el docstring de
// `OrigenContent`, site-content-defaults.ts — `mergePresetEnContent` sólo enciende `visible`,
// JAMÁS escribe texto/dato de sección), así que capturar `.spec-list`/`.stats` contra la base
// efímera SIN sembrar compararía el prototipo lleno contra una lista/contadores VACÍOS
// (hide-on-empty, § `datosDeOrigen`/`statsDeOrigen` en `Origen.tsx`) — mismo hallazgo que
// `sembrarSpotlight` ya resolvió para `.spotlight`. Escribe los valores MEDIDOS del prototipo
// (`docs/prototipos/cafeone/index.html:295-308`) por el camino de escritura REAL del panel
// (`guardarBorrador` + `publicarSeccion('origen')`), no un `UPDATE` a mano.
async function sembrarOrigen(): Promise<void> {
  console.log("▸ --sembrar-origen: publicando content.origen con los 4 datos + 3 contadores del prototipo…");
  const { guardarBorrador, publicarSeccion } = await import("../lib/config/site-content-write");

  await guardarBorrador({
    origen: {
      visible: true,
      dato1Label: "Altitud", dato1Valor: "1.500 – 1.800 msnm",
      dato2Label: "Variedad", dato2Valor: "Caturra y Colombia",
      dato3Label: "Proceso", dato3Valor: "Lavado, secado al sol",
      dato4Label: "Cosecha", dato4Valor: "Marzo – junio",
      statNumero1: "1600", statEtiqueta1: "msnm promedio",
      statNumero2: "12", statEtiqueta2: "hectáreas sembradas",
      statNumero3: "52", statEtiqueta3: "años de tradición",
    },
  });
  await publicarSeccion("origen");

  console.log("✔ Origen sembrado (content.origen publicado con los datos/contadores del prototipo).");
}

// ─── SEMBRAR COMPRA (§ COMPRA-LINEAS-FIDELIDAD-1, re-medido en § COMPRA-LINEAS-FIDELIDAD-2) ──────
//
// SIN esto, activar el cajón «Créditos»/«Álbum» (§ `compra.cajon`) en un navegador real exige: (a)
// una paleta que de verdad diferencie la tienda del Nayoli de fábrica (si no, "se ve igual" sería
// cierto por motivos ajenos al tratamiento), (b) los TRES ejes de `content.compra` elegidos, (c) un
// producto SIN moliendas en el catálogo (si no, el carrito queda vacío y las tres composiciones se
// ven idénticas — vacías), y (d) un método de pago que el checkout pueda ofrecer SIN credenciales de
// pasarela (`efectivo`, el único — § `lib/checkout/metodos-pago.ts`). Este es exactamente el hueco
// que el reporte del orquestador nombra: "COMPRA-LINEAS-ONIX-CHAMISAS-1 verificó sólo con render en
// memoria... el dato llega; el tratamiento no está" — llegaba el DATO (`compra.cajon`), pero sin (a)/
// (c)/(d) nunca había nada que ver.
//
// EL TEMA (paleta + tipografía + forma) ES EL REAL, MEDIDO POR EJECUCIÓN CONTRA EL MUESTRARIO YA
// DESPLEGADO — § COMPRA-LINEAS-FIDELIDAD-2, que reemplazó la versión anterior de este comentario.
// Hasta ese slice, `fondo`/`tinta`/`acento` salían a mano de `.ln-onix`/`.ln-ch` en la maqueta
// APROBADA (`.scratch/lanzamiento/maqueta-compra/compra.html`) y `fuentePar`/`forma` quedaban
// `null` (fábrica) — el orquestador midió la consecuencia: la tipografía salía Playfair/Inter
// cuando las DOS tiendas reales corren 'prensa' (Roboto Serif/Figtree), y Las Chamisas perdía su
// acento real (`#B8461A`) por el `acento: tinta` que la maqueta usa de mockup. `medirTemaReal`
// (`scripts/capturar-compra.ts`) lee el `:root{...}` que el storefront YA inyecta por request
// (`force-dynamic`) contra `https://cafe-onix.vercel.app` / `https://coffee-template-app-
// las-chamisas.vercel.app` — el MISMO mecanismo que ya validó `sembrarCasillas`/
// `sembrarAlbumNosotros` (abajo) con un `fetch()` suelto, ahora reusable y re-corrido en cada
// invocación (así una próxima deriva del tema real en producción se refleja sola, sin que alguien
// tenga que volver a medir a mano).
async function sembrarCompra(tienda: "onix" | "chamisas"): Promise<void> {
  console.log(`▸ --sembrar-compra ${tienda}: tema real (medido) + content.compra + vendedor + 1 producto + método efectivo…`);
  const { default: prisma } = await import("@duna/core");
  const { guardarBorrador, publicarSeccion, guardarTemaBorrador } = await import("../lib/config/site-content-write");
  const { medirTemaReal } = await import("./capturar-compra");

  const URL_MUESTRARIO: Record<"onix" | "chamisas", string> = {
    onix: "https://cafe-onix.vercel.app/",
    chamisas: "https://coffee-template-app-las-chamisas.vercel.app/",
  };
  const tema = await medirTemaReal(URL_MUESTRARIO[tienda]);
  console.log(
    `  tema medido: fondo=${tema.fondo} tinta=${tema.tinta} acento=${tema.acento} ` +
      `fuentePar=${tema.fuentePar ?? "(fábrica)"} forma=${tema.forma ?? "(fábrica)"}`,
  );

  const COMPRA: Record<"onix" | "chamisas", { cajon: string; confirmacion: string; seguimiento: string }> = {
    onix: { cajon: "creditos", confirmacion: "boleto", seguimiento: "escaleta" },
    chamisas: { cajon: "album", confirmacion: "lamina", seguimiento: "album" },
  };
  const VENDEDOR: Record<"onix" | "chamisas", { nombreCompleto: string; ciudad: string }> = {
    onix: { nombreCompleto: "Café Onix", ciudad: "Pitalito, Huila" },
    chamisas: { nombreCompleto: "Las Chamisas", ciudad: "San Adolfo, Huila" },
  };

  await guardarTemaBorrador({ fondo: tema.fondo, tinta: tema.tinta, acento: tema.acento, fuentePar: tema.fuentePar, forma: tema.forma });
  await publicarSeccion("tema");

  const compra = COMPRA[tienda];
  const vendedor = VENDEDOR[tienda];
  await guardarBorrador({
    compra: { cajon: compra.cajon, confirmacion: compra.confirmacion, seguimiento: compra.seguimiento },
    vendedor: {
      visible: true,
      nombreCompleto: vendedor.nombreCompleto,
      tipoPersona: "natural",
      documentoTipo: "cc",
      documentoNumero: "0000000000",
      nombreComercial: "",
      direccion: "Calle Falsa 123",
      ciudad: vendedor.ciudad,
      correo: "contacto@ejemplo.com",
      telefono: "+573000000000",
      horarioAtencion: "",
      municipioDespacho: "",
      transportadoras: "",
      diasPreparacionHabiles: "2 a 3",
      ventanaCambiosDias: "5",
    },
  });
  await publicarSeccion("compra");
  await publicarSeccion("vendedor");

  // UN producto SIN `moliendasOpciones` (array vacío → `decidirMolienda` da `modo:'ninguna'` →
  // `agregaDirecto=true`, § `ProductCard.tsx`): "Agregar al carrito" lo agrega en UN click, sin
  // abrir el modal de molienda — lo que `ejecutarAccionPrevia('abrir-carrito')`, abajo, necesita
  // para no depender de un flujo de selección que varía por producto. `stock` POSITIVO es
  // OBLIGATORIO — `Product.stock` nace en `0` (`@default(0)`, schema.prisma), y con `0` la card
  // se pinta "Agotado" y NO renderiza "Agregar al carrito" (medido: la PRIMERA corrida de este
  // arnés falló acá — `locator.waitFor` agotó sus 10s porque el botón nunca existió).
  const SLUG_PRODUCTO = `arnes-compra-${tienda}`;
  await prisma.product.upsert({
    where: { slug: SLUG_PRODUCTO },
    update: { activo: true, stock: 42, moliendasOpciones: [] as unknown as Prisma.InputJsonValue },
    create: {
      slug: SLUG_PRODUCTO,
      nombre: "Café de muestra",
      descripcion: "Café de muestra para verificar el camino de compra.",
      categoria: "Café en Grano",
      activo: true,
      stock: 42,
      precio: 35000,
      costo: 18000,
      peso_gramos: 250,
      imagen: "/images/cafe-nayoli-250g-molido.webp",
      moliendasOpciones: [] as unknown as Prisma.InputJsonValue,
    },
  });

  // `efectivo` es el ÚNICO método que el checkout puede ofrecer sin credenciales de pasarela
  // (§ el docstring de arriba) — y sólo se OFRECE en Bogotá D.C. (`isBogota`, § metodos-pago.ts),
  // así que `ejecutarAccionPrevia('checkout-pago')` elige ese departamento a propósito. `nombre`/
  // `tagline` reemplazan el placeholder neutro de la migración ("Configura tu tienda", § CLAUDE.md
  // "El código compartido no NACE siendo Nayoli") — sin esto el nav/footer/pestaña seguirían
  // diciendo el placeholder bajo la paleta de la tienda, una mezcla que no está en ninguna captura
  // de la maqueta.
  await prisma.siteSetting.update({
    where: { id: "default" },
    data: {
      nombre: vendedor.nombreCompleto,
      tagline: "San Adolfo · Huila",
      whatsapp: "+573160498092",
      metodosPago: [{ tipo: "efectivo", datos: {} }] as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`✔ Compra sembrada (${tienda}): paleta + content.compra + vendedor + producto + efectivo.`);
}

// ─── SEMBRAR LA TAQUILLA DE SUSCRIPCIÓN DE ONIX (§ ONIX-TAQUILLA-FILETES-1) ──────────────────────
//
// `--sembrar-compra onix` (arriba) ya mide el tema real de Onix y siembra UN producto SIN
// moliendas — para el camino de COMPRA, no para la Taquilla (`derivarMatrizTaquilla` exige que la
// matriz fila×columna quede COMPLETA, y ese único producto no la cierra). Esta siembra es
// INDEPENDIENTE —no compone con `--sembrar-compra`— porque los dos necesitan catálogos distintos y
// mezclarlos rompería la validez de la matriz (un producto de más, en una categoría o peso que no
// cierra el 2×2, hace que `derivarMatrizTaquilla` devuelva `null` y la sección caiga entera a
// «Tarjetas»).
//
// EL CATÁLOGO: 2 categorías (Café en Grano/Café Molido) × 2 pesos (250/500 g) — el MISMO fixture
// de forma que `catalogoOnix2x2` en `lib/storefront/suscripcion-taquilla.test.ts` (2 categorías ×
// 2 pesos, matriz completa), SIN moliendas en ningún producto: la selección default (última fila ×
// primera columna, § el docstring de `SuscripcionTaquilla.tsx`) es "Café Molido" × 250 g, y sin
// moliendas ahí `decidirMolienda` da modo 'ninguna' → la fila de frecuencia ("Cada") queda como la
// ÚLTIMA fila — el caso EXACTO que el owner reportó (la última fila no cerraba abajo).
//
// TRES FRECUENCIAS (§ el spec de este slice: "al menos tres"): `suscripcionPlanes.variante:
// 'taquilla'` basta — `frecuencia1/2/3` ya son "15 días"/"Mes"/"2 meses" en `DEFAULTS`
// (`lib/config/site-content-defaults.ts`), así que no hace falta declararlas de nuevo acá; una
// segunda copia del mismo valor es cómo dos fuentes divergen el día que alguien edite sólo una.
async function sembrarTaquillaOnix(): Promise<void> {
  console.log("▸ --sembrar-taquilla-onix: tema real de Onix (medido) + catálogo 2×2 + suscripcionPlanes.variante:'taquilla'…");
  const { default: prisma } = await import("@duna/core");
  const { guardarBorrador, publicarSeccion, guardarTemaBorrador } = await import("../lib/config/site-content-write");
  const { medirTemaReal } = await import("./capturar-compra");

  const tema = await medirTemaReal("https://cafe-onix.vercel.app/");
  console.log(
    `  tema medido: fondo=${tema.fondo} tinta=${tema.tinta} acento=${tema.acento} ` +
      `fuentePar=${tema.fuentePar ?? "(fábrica)"} forma=${tema.forma ?? "(fábrica)"}`,
  );
  await guardarTemaBorrador({ fondo: tema.fondo, tinta: tema.tinta, acento: tema.acento, fuentePar: tema.fuentePar, forma: tema.forma });
  await publicarSeccion("tema");

  const PRODUCTOS_TAQUILLA = [
    { slug: "arnes-taquilla-onix-grano-250", nombre: "Café Onix — En grano 250 g", categoria: "Café en Grano", peso: 250, precio: 20000 },
    { slug: "arnes-taquilla-onix-grano-500", nombre: "Café Onix — En grano 500 g", categoria: "Café en Grano", peso: 500, precio: 35000 },
    { slug: "arnes-taquilla-onix-molido-250", nombre: "Café Onix — Molido 250 g", categoria: "Café Molido", peso: 250, precio: 20000 },
    { slug: "arnes-taquilla-onix-molido-500", nombre: "Café Onix — Molido 500 g", categoria: "Café Molido", peso: 500, precio: 35000 },
  ];
  for (const p of PRODUCTOS_TAQUILLA) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { activo: true, stock: 42, categoria: p.categoria, peso_gramos: p.peso, precio: p.precio, moliendasOpciones: [] as unknown as Prisma.InputJsonValue },
      create: {
        slug: p.slug, nombre: p.nombre, descripcion: "Café de muestra para la Taquilla de suscripción.",
        categoria: p.categoria, activo: true, stock: 42, precio: p.precio, costo: Math.round(p.precio * 0.55),
        peso_gramos: p.peso, moliendasOpciones: [] as unknown as Prisma.InputJsonValue,
        imagen: "/images/cafe-nayoli-250g-molido.webp",
      },
    });
  }

  await guardarBorrador({ suscripcionPlanes: { variante: "taquilla" } });
  await publicarSeccion("suscripcionPlanes");

  await prisma.siteSetting.update({
    where: { id: "default" },
    data: { nombre: "Café Onix", tagline: "Pitalito · Huila", whatsapp: "+573000000000" },
  });

  console.log("✔ Taquilla de Onix sembrada: tema + catálogo 2×2 (sin moliendas) + variante publicada.");
}

// ─── SEMBRAR CASILLAS (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1) ──────────────────────────────────────
//
// La paleta/tipografía/forma vienen MEDIDAS contra el muestrario REAL de Las Chamisas —no contra
// la paleta aproximada `.ln-ch` de `sembrarCompra` (arriba), que usa `acento: tinta` por ser una
// referencia de MOCKUP, no del despliegue—. Medido con un `fetch()` plano (sin Playwright: el
// storefront es `force-dynamic` e inyecta `cssPaleta`/`cssFuentes`/`cssFormas` como `<style>`
// LITERAL en el HTML servido, así que el HTML crudo YA contiene el mismo valor final que
// `getComputedStyle(document.documentElement)` leería en un navegador — no hay cascada adicional
// que un render real pudiera cambiar) contra `https://coffee-template-app-las-chamisas.vercel.app/`
// el 2026-10-12: `:root{--sf-fondo:#FAF4EB;--sf-tinta:#2A2522;--sf-acento:#B8461A;…}` y
// `:root{--sf-fuente-titulo:'Roboto Serif', serif;--sf-fuente-cuerpo:'Figtree', sans-serif;…}` +
// `--radius-3xl:4px` (el radio de 'recta', § lib/config/formas.ts). `fuentePar:'prensa'` es la
// ÚNICA clave de `CLAVES_FUENTES` (lib/config/fuentes.ts) cuyo par es exactamente Roboto Serif/
// Figtree.
//
// TRES PRODUCTOS DE MUESTRA, AHORA CON LA FORMA DEL CATÁLOGO REAL (§ CHAMISAS-CASILLAS-POR-CAFE-1,
// medido contra GET /api/catalog de Las Chamisas el 2026-10-14): los TRES bajo la MISMA
// `categoria` («Café de especialidad») y el MISMO `peso_gramos` (340 g) — exactamente lo que hacía
// caer la sección a «Tarjetas» bajo `derivarMatrizTaquilla` (tres productos reclamando la misma
// celda categoría×peso). La fila de «Casillas» ya no es la categoría: es el CAFÉ, derivado del
// `nombre` (`nombreBaseProducto`, lib/tienda/taquilla.ts) — por eso `nombre` es el nombre del café
// A SECAS, sin sufijo de peso (el catálogo real no lo necesita: declara un solo tamaño). Antes de
// este fix, cada café llevaba su PROPIA categoría (una distinción que la matriz de Taquilla
// necesitaba para no colisionar, pero que el catálogo real NUNCA tuvo) — se corrige acá para que
// esta siembra reproduzca el defecto observado, no un catálogo que ya lo evitaba por accidente.
// Cada producto declara `moliendasOpciones` (En grano/Molido, ambas disponibles) y `notas` (las
// notas de cata de la maqueta aprobada) para que la tarjeta de cada café y el chooser de molienda
// del paso 2 tengan algo real que mostrar.
async function sembrarCasillas(): Promise<void> {
  console.log("▸ --sembrar-casillas: paleta/tipografía/forma de Las Chamisas + 3 cafés + content.suscripcionPlanes…");
  const { default: prisma } = await import("@duna/core");
  const { guardarBorrador, publicarSeccion, guardarTemaBorrador } = await import("../lib/config/site-content-write");

  // Medido en vivo contra el despliegue real (§ el docstring de cabecera) — NO la paleta `.ln-ch`
  // de mockup que `sembrarCompra` usa para otro propósito.
  await guardarTemaBorrador({ fondo: "#FAF4EB", tinta: "#2A2522", acento: "#B8461A", fuentePar: "prensa", forma: "recta" });
  await publicarSeccion("tema");

  const CONMOLIENDA = [
    { nombre: "En grano", metodo: "Muele en casa a tu gusto", disponible: true },
    { nombre: "Molido", metodo: "Filtro / Greca tradicional", disponible: true },
  ] as unknown as Prisma.InputJsonValue;
  // Notas de cata + precios MEDIDOS contra refero-chamisas.md §4 ("tres cafés… con la bolsa
  // recortada, notas, precio de /tienda"), tomados del asiento ya citado en este archivo
  // (DECISIONS.md, § CHAMISAS-SUSCRIPCIONES-CASILLAS-1) — no inventados para esta captura.
  const CAFES = [
    { slug: "arnes-casillas-bourbon", nombre: "Bourbon Rosado", notas: ["Floral", "Frutos rojos", "Dulce"], precio: 52000 },
    { slug: "arnes-casillas-pacamara", nombre: "Pacamara", notas: ["Chocolate", "Tropical", "Cremoso"], precio: 48000 },
    { slug: "arnes-casillas-papayo", nombre: "Papayo", notas: ["Caramelo", "Cítrico", "Balanceado"], precio: 44000 },
  ];
  // LA MISMA categoría para los TRES (§ CHAMISAS-CASILLAS-POR-CAFE-1) — el catálogo real de Las
  // Chamisas no distingue sus cafés por categoría, los distingue por NOMBRE. `nombre` es el del
  // café a secas, sin sufijo de peso (un solo tamaño declarado): la FILA de «Casillas» ya no es la
  // categoría, es el café (`nombreBaseProducto`), así que esta siembra reproduce el defecto
  // observado en vez de un catálogo que ya lo evitaba por tener una categoría por café.
  const CATEGORIA_UNICA = "Café de especialidad";
  for (const cafe of CAFES) {
    await prisma.product.upsert({
      where: { slug: cafe.slug },
      update: {
        activo: true, stock: 42, categoria: CATEGORIA_UNICA, precio: cafe.precio, peso_gramos: 340,
        notas: cafe.notas, moliendasOpciones: CONMOLIENDA,
      },
      create: {
        slug: cafe.slug, nombre: cafe.nombre, descripcion: `${cafe.nombre}, bolsa de 340 g.`,
        categoria: CATEGORIA_UNICA, activo: true, stock: 42, precio: cafe.precio, costo: Math.round(cafe.precio * 0.55),
        peso_gramos: 340, notas: cafe.notas, moliendasOpciones: CONMOLIENDA,
        imagen: "/images/cafe-nayoli-250g-molido.webp",
      },
    });
  }

  // `suscripcionPasos.variante:'casillas'` — el tratamiento "Así funciona" de álbum (§ el spec,
  // item 5 de refero-chamisas.md §4) — y `suscripcionCierre.variante:'costura'` — la "banda
  // punteada" (§ el spec, item 6) — se verifican JUNTO con Planes, nunca solos: las tres son la
  // composición completa que el content guide (.scratch/chamisas-paginas/
  // contenido-suscripciones-para-el-panel.md) recomienda activar a la vez. `franjaTejido` queda
  // vacío (sin asset de tejido para esta captura) — la sección sigue mostrando el marco punteado y
  // el botón relleno, sólo sin la franja arriba (mismo criterio que `tiendaCierre` sin imagen).
  await guardarBorrador({
    suscripcionPlanes: { variante: "casillas" },
    suscripcionPasos: { variante: "casillas" },
    // `ctaDestino` sólo acepta el set cerrado de rutas internas (`MENU_CTA_DESTINOS` —
    // site-content-defaults.ts: '/tienda'|'/suscripciones'|'/nosotros', NUNCA "whatsapp"; a
    // diferencia de `tiendaCierre.boton`, que resuelve WhatsApp con su propio `botonCierre()`,
    // § CLAUDE.md "el día del multitenant"/`CONTROLADOS_*`). Para esta captura, '/tienda' — la
    // maqueta pide "Escribir por WhatsApp" como destino, que esta sección no puede representar
    // hoy; queda nombrado como límite conocido en el content guide (§ CHAMISAS-SUSCRIPCIONES-
    // CASILLAS-1, DECISIONS.md).
    suscripcionCierre: {
      variante: "costura",
      frase: "¿Prefieres hablarlo primero?",
      ctaLabel: "Ver el catálogo",
      ctaDestino: "/tienda",
    },
  });
  await publicarSeccion("suscripcionPlanes");
  await publicarSeccion("suscripcionPasos");
  await publicarSeccion("suscripcionCierre");

  await prisma.siteSetting.update({
    where: { id: "default" },
    data: { nombre: "Café Las Chamisas", tagline: "San Adolfo · Huila", whatsapp: "+573000000000" },
  });

  console.log("✔ Casillas sembrado: paleta/tipografía/forma de Las Chamisas + 3 cafés + variante publicada.");
}

// ─── SEMBRAR ÁLBUM DE NOSOTROS (§ CHAMISAS-NOSOTROS-ALBUM-1) ─────────────────────────────────────
//
// Paleta/tipografía/forma: las MISMAS medidas de `sembrarCasillas` (arriba) — el muestrario real de
// Las Chamisas, un solo despliegue, un solo tema. Repetir la medición acá sería una segunda fuente
// que podría divergir de la primera si alguna vez cambia.
//
// TRES PRODUCTOS (Bourbon Rosado/Pacamara/Papayo — los mismos nombres que `sembrarCasillas`, en
// slugs PROPIOS para no colisionar si algún día se siembran los dos a la vez): alimentan el
// Interludio «Stickers» (un sticker de color por café, enlazando a su ficha) y "Créditos: ficha de
// origen" en /tienda (que la Ficha «Etiqueta» LEE directo, § NosotrosFicha.tsx — nunca una copia
// propia).
//
// EL CONTENIDO ES EL DE refero-chamisas.md §3, no inventado para esta captura: la frase de la bolsa
// ("Nuestro territorio, sus manos, nuestro orgullo."), las cinco láminas (01 El territorio … 05 La
// bolsa, con el pie «Imagen ilustrativa» en las que el spec marca como generadas por IA — 01, 02 y
// 04), y los datos CONFIRMADOS de la ficha (San Adolfo Huila; los tres cafés; altitud 1.600–2.000
// m s.n.m.). Proceso/cosecha/familias van con el sufijo «[ejemplo]» tal como el spec exige
// (refero-chamisas.md §3 punto 4: "van marcados [ejemplo] hasta que la finca los confirme").
//
// SIN ASSET DE TEJIDO PARA ESTE ARNÉS (mismo límite que `sembrarCasillas`): el Interludio «Stickers»
// necesita `imagen` no-vacía para montar (es su gate, § NosotrosInterludio.tsx) — se usa una foto
// EXISTENTE del repo como placeholder, documentado como lo que es, nunca una franja de tejido real.
// `nosotrosApertura.franjaTejido`/`nosotrosCierre.franjaTejido` SÍ pueden quedar vacíos (son
// opcionales, § sus componentes) y se dejan así.
async function sembrarAlbumNosotros(): Promise<void> {
  console.log("▸ --sembrar-album-nosotros: paleta/tipografía/forma de Las Chamisas + 3 cafés + las 6 secciones de /nosotros…");
  const { default: prisma } = await import("@duna/core");
  const { guardarBorrador, publicarSeccion, guardarTemaBorrador } = await import("../lib/config/site-content-write");

  // Medido en vivo contra el despliegue real (§ el docstring de `sembrarCasillas`, arriba).
  await guardarTemaBorrador({ fondo: "#FAF4EB", tinta: "#2A2522", acento: "#B8461A", fuentePar: "prensa", forma: "recta" });
  await publicarSeccion("tema");

  const CONMOLIENDA = [
    { nombre: "En grano", metodo: "Muele en casa a tu gusto", disponible: true },
    { nombre: "Molido", metodo: "Filtro / Greca tradicional", disponible: true },
  ] as unknown as Prisma.InputJsonValue;
  const CAFES = [
    { slug: "arnes-album-bourbon", nombre: "Bourbon Rosado", notas: ["Floral", "Frutos rojos", "Dulce"], precio: 52000 },
    { slug: "arnes-album-pacamara", nombre: "Pacamara", notas: ["Chocolate", "Tropical", "Cremoso"], precio: 48000 },
    { slug: "arnes-album-papayo", nombre: "Papayo", notas: ["Caramelo", "Cítrico", "Balanceado"], precio: 44000 },
  ];
  for (const cafe of CAFES) {
    await prisma.product.upsert({
      where: { slug: cafe.slug },
      update: {
        activo: true, stock: 42, categoria: cafe.nombre, precio: cafe.precio, peso_gramos: 340,
        notas: cafe.notas, moliendasOpciones: CONMOLIENDA,
      },
      create: {
        slug: cafe.slug, nombre: `${cafe.nombre} 340 g`, descripcion: `${cafe.nombre}, bolsa de 340 g.`,
        categoria: cafe.nombre, activo: true, stock: 42, precio: cafe.precio, costo: Math.round(cafe.precio * 0.55),
        peso_gramos: 340, notas: cafe.notas, moliendasOpciones: CONMOLIENDA,
        imagen: "/images/cafe-nayoli-250g-molido.webp",
      },
    });
  }

  await guardarBorrador({
    nosotrosApertura: {
      visible: true,
      variante: "album",
      rotuloIzquierda: "Nosotros · San Adolfo, Huila",
      titulo: "Nuestro territorio, sus manos, nuestro orgullo.",
      bajada: "Somos mujeres y familias que cultivan café en San Adolfo, Huila.",
      imagen: "/images/hero-cerezas-v1.jpg",
      sticker: "Cosecha 2026",
    },
    nosotrosHistoria: {
      variante: "partida",
      titulo: "Cada bolsa nace en las mismas manos que la cierran.",
      parrafo1: "Bolsas de 340 g y 500 g, siempre del mismo lote: lo que cosechamos esta semana es lo que te llega.",
      parrafo2: "No tercerizamos nada — del cafetal a la bolsa pasa por las mismas familias de San Adolfo.",
    },
    nosotrosEscenas: {
      visible: true,
      variante: "album",
      esquineros: true,
      // `eyebrow`/`titulo` (§ CHAMISAS-APERTURA-ALBUM-AJUSTES-1): el encabezado de la maqueta
      // ("Álbum de finca" / "Cinco láminas, de la montaña a la bolsa", refero-chamisas.md §3).
      eyebrow: "Álbum de finca",
      titulo: "Cinco láminas, de la montaña a la bolsa",
      items: [
        { foto: "/images/historia-1-v1.jpg", titulo: "El territorio", descripcion: "San Adolfo, Huila: ladera, niebla y sombra, 1.600–2.000 m s.n.m.", credito1Etiqueta: "", credito1Valor: "", credito2Etiqueta: "", credito2Valor: "", pie: "Imagen ilustrativa" },
        { foto: "/images/historia-2-v1.jpg", titulo: "La cosecha", descripcion: "Grano por grano, a mano, sólo la cereza madura.", credito1Etiqueta: "", credito1Valor: "", credito2Etiqueta: "", credito2Valor: "", pie: "Imagen ilustrativa" },
        { foto: "/images/historia-3-v1.jpg", titulo: "Las manos", descripcion: "Las mismas familias, cosecha tras cosecha.", credito1Etiqueta: "", credito1Valor: "", credito2Etiqueta: "", credito2Valor: "", pie: "" },
        { foto: "/images/historia-4-v1.jpg", titulo: "El secado", descripcion: "Al sol, en patios propios, hasta el punto justo.", credito1Etiqueta: "", credito1Valor: "", credito2Etiqueta: "", credito2Valor: "", pie: "Imagen ilustrativa" },
        { foto: "/images/hero-beans-v1.jpg", titulo: "La bolsa", descripcion: "Tostado en los 7 días antes de salir hacia tu casa.", credito1Etiqueta: "", credito1Valor: "", credito2Etiqueta: "", credito2Valor: "", pie: "" },
      ],
    },
    nosotrosFicha: {
      visible: true,
      variante: "etiqueta",
      eyebrow: "Ficha de origen",
      // `titulo`/`bajada`/`tituloTarjeta`/`notaPie` (§ CHAMISAS-APERTURA-ALBUM-AJUSTES-1): los
      // cuatro campos nuevos que cierran el defecto medido (el dueño escribía la bajada dentro de
      // `sello`) — contenido verbatim de la maqueta (refero-chamisas.md §3 punto 4).
      titulo: "De dónde viene cada bolsa",
      bajada: "Los mismos datos de la etiqueta de la bolsa, en grande y con sello.",
      tituloTarjeta: "Café Las Chamisas · origen",
      notaPie: "Café de origen · 100 % colombiano.",
      sello: "San Adolfo",
    },
    nosotrosInterludio: {
      visible: true,
      variante: "stickers",
      imagen: "/images/hero-beans-v1.jpg",
    },
    nosotrosCierre: {
      visible: true,
      variante: "costura",
      titulo: "Tres cafés, una finca.",
      ctaLabel: "Ver los tres cafés",
      ctaDestino: "/tienda",
      ctaSecundarioLabel: "Recibirlo cada mes",
      ctaSecundarioDestino: "/suscripciones",
    },
    // "Créditos: ficha de origen" (/tienda) — la Ficha «Etiqueta» de /nosotros LEE estas mismas
    // filas (§ NosotrosFicha.tsx), nunca una copia propia. Datos CONFIRMADOS (refero-chamisas.md §3
    // punto 4) + los marcados [ejemplo] hasta que la finca los confirme.
    tiendaCreditos: {
      visible: true,
      items: [
        { etiqueta: "Finca", valor: "San Adolfo, Huila" },
        { etiqueta: "Variedades", valor: "Bourbon Rosado, Pacamara y Papayo" },
        { etiqueta: "Altitud", valor: "1.600 – 2.000 m s.n.m." },
        { etiqueta: "Proceso", valor: "Lavado [ejemplo]" },
        { etiqueta: "Cosecha principal", valor: "Marzo – junio [ejemplo]" },
        { etiqueta: "Familias", valor: "12 familias [ejemplo]" },
      ],
    },
  });
  await publicarSeccion("nosotrosApertura");
  await publicarSeccion("nosotrosHistoria");
  await publicarSeccion("nosotrosEscenas");
  await publicarSeccion("nosotrosFicha");
  await publicarSeccion("nosotrosInterludio");
  await publicarSeccion("nosotrosCierre");
  await publicarSeccion("tiendaCreditos");

  await prisma.siteSetting.update({
    where: { id: "default" },
    data: { nombre: "Café Las Chamisas", tagline: "San Adolfo · Huila", whatsapp: "+573000000000" },
  });

  console.log("✔ Álbum de /nosotros sembrado: paleta/tipografía/forma de Las Chamisas + 3 cafés + las 6 secciones publicadas.");
}

// ─── ACCIONES PREVIAS A LA CAPTURA (§ COMPRA-LINEAS-FIDELIDAD-1) ─────────────────────────────────
//
// NOMBRES FIJOS, no un DSL de clicks genérico: un DSL (una secuencia arbitraria de selectores +
// acciones pasada por CLI) es más flexible pero también MÁS CÓDIGO DE LO QUE ESTE SLICE NECESITA —
// el spec pide interacciones CONCRETAS ("abrir el cajón, avanzar al paso 2"), no un lenguaje de
// automatización general. Si un slice futuro necesita una interacción más, agregarla acá cuesta una
// función más; construir el DSL ahora sería infraestructura por adelantado para los casos de hoy.
//
// TODAS COMPARTEN EL MISMO `BrowserContext` (la variable `page` de `main`, abajo): el carrito que
// `abrir-carrito` arma con `localStorage` sobrevive a la navegación SIGUIENTE (`checkout-pago`/
// `completar-pedido` navegan a `/checkout` con el MISMO `page`), y la orden que `completar-pedido`
// crea sobrevive en `window.name` hasta `rastrear-resultado` (§ más abajo) — así que una corrida con
// las rutas `[/tienda, /checkout, /checkout, /rastrear-pedido]` y las acciones `[abrir-carrito,
// checkout-pago, completar-pedido, rastrear-resultado]` recorre el camino de compra entero con el
// MISMO carrito y la MISMA orden, sin re-sembrar nada entre pasos.
async function ejecutarAccionPrevia(page: PlaywrightPage, accion: string): Promise<void> {
  if (accion === "abrir-carrito") {
    console.log("  ▸ accion-previa abrir-carrito: agregando el primer producto (el cajón se abre solo)…");
    // `title="Agregar al carrito"` es EXACTO para un producto `agregaDirecto` (§ el docstring de
    // `sembrarCompra` — el producto sembrado no tiene moliendas). `addItem` llama `setIsOpen(true)`
    // incondicionalmente (`lib/cartStore.tsx`), así que un solo click agrega Y abre el cajón — no
    // hace falta un segundo click sobre el ícono de la bolsa.
    const agregar = page.locator('button[title="Agregar al carrito"]').first();
    await agregar.waitFor({ timeout: 10_000 });
    await agregar.click();
    // 4.5s: la animación de entrada del cajón asienta en <1s, pero el toast de confirmación
    // ("… agregado al carrito", `position:'top-right'`, `ProductCard.tsx`) se queda encima del
    // encabezado del cajón hasta que `sonner` lo descarta solo (duración por defecto ~4s) — medido
    // en la primera corrida de este arnés: sin esperar, "TU PEDIDO (1)" queda tapado por el toast.
    await page.waitForTimeout(4500);
    return;
  }

  if (accion === "checkout-pago" || accion === "completar-pedido") {
    console.log(`  ▸ accion-previa ${accion}: completando el paso 1 y avanzando al paso 2…`);
    await llenarPaso1Checkout(page);
    await page.waitForTimeout(500);

    if (accion === "completar-pedido") {
      // § COMPRA-LINEAS-FIDELIDAD-1 — acepta términos y confirma: EL ÚNICO camino, en este arnés,
      // a una confirmación REAL (`estado:'manual'`, § `EstadoPedido.tsx`) y a una orden real que
      // `rastrear-pedido` pueda ENCONTRAR (§ la acción `rastrear-resultado`, abajo). `efectivo` es
      // el único método sembrado (§ `sembrarCompra`), así que el checkout ya lo preselecciona sin
      // que haga falta clickear un radio.
      //
      // `page.locator(...).click()`, NO `page.evaluate(...).click()` — medido: el evaluate dispara
      // un click SINTÉTICO que no pasa por las comprobaciones de "actionability" de Playwright
      // (visible, no cubierto, asentado tras la transición de paso), y la primera corrida de esta
      // acción clickeó la casilla ANTES de que el paso 2 terminara de montar — la casilla quedaba
      // sin marcar y "Confirmar pedido" nunca llegaba a disparar `handleOrder`. El `.waitFor()` de
      // cada locator es lo que falta para esperar el montaje real del paso 2.
      // `#casilla-terminos` es el DIV que ENVUELVE la casilla y su párrafo de dos enlaces
      // (`app/(storefront)/checkout/page.tsx`) — NO el `<input>`. Medido: clickear el DIV cae en
      // el CENTRO de su caja, que es el párrafo de texto, no el checkbox — la primera corrida de
      // esta acción navegó a "/legal/tratamiento-de-datos" en vez de marcar la casilla. El
      // `<input type="checkbox">` real está DENTRO, sin id propio.
      const casilla = page.locator('#casilla-terminos input[type="checkbox"]');
      await casilla.waitFor({ timeout: 10_000 });
      await casilla.click();
      await page.waitForTimeout(200);
      await page.evaluate<void, undefined>(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const confirmar = btns.find((b) => b.textContent?.trim() === "Confirmar pedido");
        confirmar?.click();
      }, undefined);
      // La creación de la orden es un POST real (§ `app/api/checkout/route.ts`, fuera de
      // `touches:` — este arnés sólo LO LLAMA, no lo edita) — un margen más largo que el resto de
      // las esperas de este archivo, para la respuesta del servidor + el render de la confirmación.
      await page.waitForTimeout(2500);
      // `window.name` SOBREVIVE a un `page.goto` en la MISMA pestaña (a diferencia de cualquier
      // variable de JS) — es el único canal para que `rastrear-resultado` (abajo), en un ÍNDICE
      // posterior de la MISMA corrida, sepa el número real que el servidor acaba de asignar (nunca
      // se conoce de antemano: lo decide `app/api/checkout/route.ts`). El número vive junto al
      // botón "Copiar número de orden" (`EstadoPedido.tsx`, hermano anterior en el mismo `div`).
      await page.evaluate<void, undefined>(() => {
        const copiar = document.querySelector('[aria-label="Copiar número de orden"]');
        const numero = copiar?.previousElementSibling?.textContent?.trim();
        if (numero) window.name = numero;
      }, undefined);
    }
    return;
  }

  if (accion === "rastrear-noencontrado" || accion === "rastrear-resultado") {
    console.log(`  ▸ accion-previa ${accion}: buscando un pedido en /rastrear-pedido…`);
    const datos =
      accion === "rastrear-noencontrado"
        ? { orden: "CN-000000", email: "nadie@ejemplo.com" }
        // El MISMO correo que `completar-pedido` usa para crear la orden (§ arriba) — el número
        // de orden lo decide el servidor, así que esta acción sólo puede usarse DESPUÉS de una
        // `completar-pedido` en un índice anterior Y con el número real pasado por `--dato-previo`
        // (§ `main`, abajo, lo lee de `registro` y lo sustituye acá vía `window.name` — el único
        // canal que sobrevive a un `page.goto` sin reinyectar un script).
        : { orden: "__ORDEN__", email: "compradora@ejemplo.com" };
    // SIN una función anidada con NOMBRE (§ el hallazgo: esbuild/tsx inyecta una llamada a
    // `__name(...)` para nombrar funciones con fines de depuración, y ese helper SÓLO existe en el
    // contexto de Node — `page.evaluate` serializa el cuerpo y lo corre en el navegador, donde
    // `__name` no está definido, y la corrida entera fallaba con `ReferenceError: __name is not
    // defined`). Un ARRAY de pares + un `for` inline evita por completo declarar una función.
    await page.evaluate<void, { orden: string; email: string }>((d) => {
      const pares: [string, string][] = [
        ["track-orden", d.orden === "__ORDEN__" ? window.name || "" : d.orden],
        ["track-email", d.email],
      ];
      for (const [id, valor] of pares) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (!el) continue;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, valor);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, datos);
    await page.evaluate<void, undefined>(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const buscar = btns.find((b) => b.textContent?.trim().startsWith("Buscar"));
      buscar?.click();
    }, undefined);
    await page.waitForTimeout(1200); // la búsqueda es un fetch — margen para la respuesta + el render
    return;
  }

  // § CHAMISAS-SUSCRIPCIONES-CASILLAS-1 — dos cafés elegidos (Bourbon Rosado + Pacamara, las dos
  // primeras filas alfabéticas de `sembrarCasillas`, § arriba) y la frecuencia quincenal (slot 1 —
  // "15 días" es `DEFAULTS.suscripcionPlanes.frecuencia1`, § site-content-defaults.ts). Los
  // botones +/− no llevan id propio: `aria-label="Sumar una bolsa de {categoria}"`
  // (§ SuscripcionCasillas.tsx) es el selector estable, igual que el resto de este archivo
  // localiza por atributo semántico en vez de por clase CSS.
  if (accion === "casillas-dos-cafes") {
    console.log("  ▸ accion-previa casillas-dos-cafes: sumando una bolsa de Bourbon Rosado y una de Pacamara…");
    for (const categoria of ["Bourbon Rosado", "Pacamara"]) {
      const sumar = page.locator(`button[aria-label="Sumar una bolsa de ${categoria}"]`);
      await sumar.waitFor({ timeout: 10_000 });
      await sumar.click();
    }
    await page.waitForTimeout(300); // el sticker que se pega en la nota (180ms, § SuscripcionCasillas.tsx)
    return;
  }

  if (accion === "casillas-quincenal") {
    console.log('  ▸ accion-previa casillas-quincenal: eligiendo la frecuencia "15 días" (quincenal)…');
    await page.evaluate<void, undefined>(() => {
      const grupo = document.querySelector('[role="group"][aria-label="Frecuencia"]');
      const boton = Array.from(grupo?.querySelectorAll("button") ?? []).find((b) => b.textContent?.trim() === "15 días");
      (boton as HTMLButtonElement | undefined)?.click();
    }, undefined);
    await page.waitForTimeout(300); // la cascada de 30ms/casilla (§ SuscripcionCasillas.tsx) asienta rápido, margen generoso
    return;
  }

  throw new Error(
    `Acción previa desconocida: «${accion}» (sólo "abrir-carrito"/"checkout-pago"/"completar-pedido"/` +
      `"rastrear-noencontrado"/"rastrear-resultado"/"casillas-dos-cafes"/"casillas-quincenal").`,
  );
}

// Factoreado de "checkout-pago"/"completar-pedido" (§ arriba): las dos empiezan llenando el mismo
// paso 1 — sólo "completar-pedido" sigue hasta el submit final.
async function llenarPaso1Checkout(page: PlaywrightPage): Promise<void> {
  // SIN función anidada con NOMBRE (§ el hallazgo documentado en "rastrear-noencontrado"/
  // "rastrear-resultado", arriba) — el mismo patrón de array + `for` inline.
  await page.evaluate<void, { email: string; tel: string; nombre: string; apellido: string; direccion: string; ciudad: string }>(
    (datos) => {
      const pares: [string, string][] = [
        ["campo-email", datos.email],
        ["campo-telefono", datos.tel],
        ["campo-nombre", datos.nombre],
        ["campo-apellido", datos.apellido],
        ["campo-ciudad", datos.ciudad],
        ["campo-direccion", datos.direccion],
      ];
      for (const [id, valor] of pares) {
        const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        if (!el) continue;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, valor);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    { email: "compradora@ejemplo.com", tel: "3001234567", nombre: "Nombre", apellido: "Ejemplo", direccion: "Calle Falsa 123", ciudad: "Bogotá" },
  );
  // El `<select>` de departamento necesita su propio evento de React (controlado) — "Bogotá D.C."
  // además de llenar el campo, habilita `efectivo` (§ el docstring de `sembrarCompra`: sólo se
  // ofrece con `isBogota`).
  await page.evaluate<void, undefined>(() => {
    const sel = document.getElementById("campo-departamento") as HTMLSelectElement | null;
    if (!sel) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    setter?.call(sel, "Bogotá D.C."); // EXACTO — `BOGOTA_DC` (`packages/core/src/colombia-departments.ts`), sin coma
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, undefined);
  await page.waitForTimeout(300); // la franja horaria (Bogotá) aparece condicional al departamento
  // `<input type="radio" name="slot">`, no un `<button>` (§ medido contra el markup real —
  // `app/(storefront)/checkout/page.tsx`: la franja es un radio dentro de un `<label>`).
  await page.evaluate<void, undefined>(() => {
    const franja = document.querySelector('#campo-franja input[type="radio"]') as HTMLInputElement | null;
    franja?.click();
  }, undefined);
  await page.waitForTimeout(200);
  await page.evaluate<void, undefined>(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const continuar = btns.find((b) => b.textContent?.trim() === "Continuar al pago");
    continuar?.click();
  }, undefined);
}

// ─── main ─────────────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(BANNER);
  const opciones = parseCli(process.argv.slice(2));
  const modoUrl = opciones.url !== undefined;

  if (modoUrl) {
    console.log(
      `▸ Modo --url (§ ARNES-CAPTURA-MUESTRARIO-REAL-1): capturando el muestrario YA DESPLEGADO en ` +
        `${opciones.url} — sin Postgres efímero, sin \`next build\`/\`next start\` locales.`,
    );
  } else {
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

    // § NUESTRO-CAFE-COMO-MUESTRARIO-1 — DESPUÉS del preset (si lo hay), por la MISMA razón
    // cinturón-y-tirantes de arriba: el orden entre los dos no importa para el resultado (el
    // storefront es force-dynamic), pero seguir el mismo orden declarado evita una sorpresa si
    // algún día dejara de serlo.
    if (opciones.sembrarSpotlight) {
      await sembrarSpotlight();
    }

    if (opciones.sembrarOrigen) {
      await sembrarOrigen();
    }

    if (opciones.sembrarCompra) {
      await sembrarCompra(opciones.sembrarCompra);
    }

    if (opciones.sembrarCasillas) {
      await sembrarCasillas();
    }

    if (opciones.sembrarAlbumNosotros) {
      await sembrarAlbumNosotros();
    }

    if (opciones.sembrarTaquillaOnix) {
      await sembrarTaquillaOnix();
    }

    if (!(await puertoLibre(opciones.puertoApp))) {
      throw new Error(
        `El puerto ${opciones.puertoApp} está ocupado — ¿hay un \`npm run dev\` corriendo? ` +
          `Este arnés no puede compartirlo (usa --puerto-app para elegir otro).`,
      );
    }

    construirNext(opciones.puertoApp);
  }

  mkdirSync(CAPTURAS_DIR, { recursive: true });
  const salidaDir = join(CAPTURAS_DIR, opciones.nombre);
  mkdirSync(salidaDir, { recursive: true });

  const playwright = cargarPlaywright();
  // Local const para que TS lo estreche a `number` dentro del `if` de abajo, en las dos
  // navegaciones — `opciones.scrollPx` es `number | undefined` y no se narrowea de forma fiable
  // a través de un `await` intermedio si se lee como propiedad en cada sitio.
  const scrollPx = opciones.scrollPx;

  // El origen de la app: la URL viva (modo --url) o el `next start` local (modo base fresca).
  const origenApp = modoUrl ? (opciones.url as string).replace(/\/+$/, "") : `http://127.0.0.1:${opciones.puertoApp}`;

  let appProc: ChildProcess | undefined;
  let salidaApp = "";
  if (!modoUrl) {
    console.log(`▸ Arrancando \`next start\` (la build de arriba) en :${opciones.puertoApp}…`);
    appProc = arrancarNextStart(opciones.puertoApp);
    appProc.stdout?.on("data", (d) => (salidaApp += String(d)));
    appProc.stderr?.on("data", (d) => (salidaApp += String(d)));
  }

  const servidorProto = await levantarServidorPrototipo();

  const registro: Record<string, unknown> = {
    preset: opciones.preset ?? null,
    url: opciones.url ?? null,
    generadoEn: new Date().toISOString(),
    capturas: [] as unknown[],
  };

  try {
    if (!modoUrl) {
      await esperarListo(`${origenApp}/`, 90_000).catch((e) => {
        throw new Error(`\`next start\` no respondió a tiempo: ${e}\n\n── stdout/stderr ──\n${salidaApp}`);
      });
      console.log("✔ `next start` responde.");
    }

    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: opciones.anchoPx, height: opciones.altoPx } });

      for (let i = 0; i < opciones.rutas.length; i++) {
        const ruta = opciones.rutas[i];
        const selectorApp = opciones.selectoresApp[i];
        const prototipo = opciones.prototipos[i];
        const selectorProto = opciones.selectoresPrototipo[i];

        const urlApp = `${origenApp}${ruta}`;
        console.log(`▸ [${i}] app ${urlApp}${selectorApp ? ` (${selectorApp})` : " (página completa)"}`);
        const respuestaApp = await page.goto(urlApp, { waitUntil: "networkidle", timeout: 30_000 });
        if (modoUrl) {
          // La trampa se mide ACÁ, antes de escribir un solo PNG (§ ARNES-CAPTURA-MUESTRARIO-REAL-1).
          verificarSinProteccion(respuestaApp, urlApp);
        }
        await page.waitForTimeout(300); // margen corto para animaciones de entrada / fuentes

        // § COMPRA-LINEAS-FIDELIDAD-1 — la interacción (si la hay) corre DESPUÉS de que la ruta
        // asentó y ANTES de capturar: lo que esta ruta muestra depende de lo que la acción acaba
        // de hacer (abrir el cajón, avanzar al paso 2).
        const accionPrevia = opciones.accionesPrevias[i];
        if (accionPrevia) {
          await ejecutarAccionPrevia(page, accionPrevia);
        }

        if (scrollPx !== undefined) {
          await page.evaluate((y: number) => window.scrollTo(0, y), scrollPx);
          await page.waitForTimeout(300); // margen para que el chrome fijo-por-scroll reaccione
        }

        const appPng = join(salidaDir, `app-${i}.png`);
        let estiloElementoApp: Record<string, string> | null = null;
        if (selectorApp) {
          const loc = page.locator(selectorApp);
          await loc.waitFor({ timeout: 10_000 });
          await esperarAsentamiento(page, selectorApp);
          estiloElementoApp = await leerEstiloElemento(page, selectorApp, opciones.estiloElementoExtra);
          await loc.screenshot({ path: appPng });
        } else {
          // § CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1 — UN `fullPage: true` SIN HABER SCROLLEADO DEJA
          // INVISIBLE TODO `whileInView`/`viewport:{once:true}` (framer-motion) MÁS ALLÁ DEL ALTO
          // INICIAL DEL VIEWPORT. Medido con el caso real: `NosotrosCierre`/`NosotrosInterludio
          // Stickers` (de /nosotros, composiciones «costura»/«stickers») tienen el DATO y el HTML
          // correctos (confirmado con `renderToStaticMarkup` contra el mismo contenido) pero la
          // captura los mostraba EN BLANCO — opacity:0 congelado, porque el `IntersectionObserver`
          // de cada sección sólo dispara cuando el VIEWPORT REAL del navegador llega a
          // intersectarla, y un `fullPage` COMPONE el documento entero sin que el navegador haya
          // scrolleado nunca. Esto NO es exclusivo de esta página: cualquier sección con animación
          // de entrada por scroll, en cualquier ruta, bajo el alto inicial del viewport, cae en el
          // mismo hueco.
          //
          // EL FIX: si el documento es más alto que el viewport Y nadie pidió `--scroll` explícito
          // (ese flag tiene su propio propósito —revelar chrome fijo-por-scroll en la posición QUE
          // SE PIDIÓ, § arriba—, y pisarlo volvería a esta sección dueña de dos comportamientos a la
          // vez), se scrollea al FONDO del documento una vez —un salto, no scroll incremental:
          // `IntersectionObserver` recalcula contra la posición FINAL, no contra los pasos
          // intermedios, así que un solo salto dispara TODAS las secciones que haya de paso— se
          // espera a que asienten las transiciones, y se vuelve al tope ANTES de capturar, para no
          // alterar qué chrome fijo-por-scroll muestra el PNG final.
          if (scrollPx === undefined) {
            const altoDocumento = await page.evaluate<number, undefined>(() => document.documentElement.scrollHeight, undefined);
            if (altoDocumento > opciones.altoPx) {
              await page.evaluate((y: number) => window.scrollTo(0, y), altoDocumento);
              await page.waitForTimeout(500);
              await page.evaluate<void, undefined>(() => window.scrollTo(0, 0), undefined);
              await page.waitForTimeout(100);
            }
          }
          await page.screenshot({ path: appPng, fullPage: true });
        }

        const varsAPedir = [...VARS_TEMA_POR_DEFECTO, ...opciones.varsExtra];
        const valores = await page.evaluate((vars: string[]) => {
          const raiz = getComputedStyle(document.documentElement);
          const out: Record<string, string> = {};
          for (const v of vars) out[v] = raiz.getPropertyValue(v).trim();
          return out;
        }, varsAPedir);
        console.log(`  valores computados de :root (${ruta}):`, valores);
        if (estiloElementoApp) console.log(`  estilo computado del nodo (${selectorApp}):`, estiloElementoApp);

        // § COMPRA-LINEAS-FIDELIDAD-1 — con `--sin-prototipo`, `prototipo`/`selectorProto` son
        // siempre `""`/`undefined` (§ `parseCli`: `prototipos` queda `[]`), así que esta mitad se
        // salta entera — el par se arma a mano contra una captura YA EXISTENTE de la maqueta
        // (§ el docstring de `ejecutarAccionPrevia`), no contra una nueva captura del prototipo.
        let protoPng: string | null = null;
        let estiloElementoProto: Record<string, string> | null = null;
        if (!opciones.sinPrototipo) {
          console.log(`▸ [${i}] prototipo ${prototipo}${selectorProto ? ` (${selectorProto})` : " (página completa)"}`);
          await page.goto(`http://127.0.0.1:${servidorProto.puerto}/${prototipo}`, { waitUntil: "networkidle", timeout: 30_000 });
          await page.waitForTimeout(300);
          if (scrollPx !== undefined) {
            await page.evaluate((y: number) => window.scrollTo(0, y), scrollPx);
            await page.waitForTimeout(300);
          }

          protoPng = join(salidaDir, `prototipo-${i}.png`);
          if (selectorProto) {
            const loc = page.locator(selectorProto);
            await loc.waitFor({ timeout: 10_000 });
            await esperarAsentamiento(page, selectorProto);
            estiloElementoProto = await leerEstiloElemento(page, selectorProto, opciones.estiloElementoExtra);
            await loc.screenshot({ path: protoPng });
          } else {
            await page.screenshot({ path: protoPng, fullPage: true });
          }
          if (estiloElementoProto) console.log(`  estilo computado del nodo (${selectorProto}):`, estiloElementoProto);
        }

        (registro.capturas as unknown[]).push({
          indice: i,
          ruta,
          selectorApp: selectorApp ?? null,
          appPng,
          estiloElementoApp,
          prototipo: opciones.sinPrototipo ? null : prototipo,
          selectorPrototipo: selectorProto ?? null,
          protoPng,
          estiloElementoPrototipo: estiloElementoProto,
          valoresComputados: valores,
        });
      }

      await page.close();
    } finally {
      await browser.close();
    }
  } finally {
    await servidorProto.cerrar();
    if (appProc) await detenerProceso(appProc);
  }

  const leeme = [
    BANNER,
    "",
    modoUrl ? `URL: ${String(opciones.url)}` : `Preset: ${opciones.preset ?? "(ninguno — base sin tocar)"}`,
    `Viewport: ${opciones.anchoPx}×${opciones.altoPx}${opciones.scrollPx !== undefined ? ` · scroll ${opciones.scrollPx}px` : ""}`,
    `Generado: ${String(registro.generadoEn)}`,
    "",
    ...(registro.capturas as Array<Record<string, unknown>>).map(
      (c) =>
        `[${c.indice}] app-${c.indice}.png (${c.ruta}${c.selectorApp ? `, ${c.selectorApp}` : ""})` +
        (c.prototipo
          ? ` ↔ prototipo-${c.indice}.png (${c.prototipo}${c.selectorPrototipo ? `, ${c.selectorPrototipo}` : ""})`
          : " (--sin-prototipo: sin captura del prototipo — emparejar a mano contra la referencia)") +
        `\n    valores :root: ${JSON.stringify(c.valoresComputados)}` +
        (c.estiloElementoApp ? `\n    estilo nodo app: ${JSON.stringify(c.estiloElementoApp)}` : "") +
        (c.estiloElementoPrototipo ? `\n    estilo nodo prototipo: ${JSON.stringify(c.estiloElementoPrototipo)}` : ""),
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
