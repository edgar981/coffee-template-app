// scripts/capturar-compra.ts — § COMPRA-LINEAS-FIDELIDAD-2.
//
// EL HUECO QUE ESTO CIERRA: `capturar-seccion.ts` (`sembrarCompra`) seguía la paleta y la
// tipografía APROXIMADAS a mano desde el `<style>` inline de la maqueta (`.ln-onix`/`.ln-ch` en
// `.scratch/lanzamiento/maqueta-compra/compra.html`), nunca el tema REAL ya publicado en los dos
// muestrarios desplegados. El orquestador midió la consecuencia: los pares de
// `COMPRA-LINEAS-FIDELIDAD-1` comparaban contra Playfair/Inter (la tipografía de FÁBRICA, `fuentePar:
// null`) cuando las dos tiendas reales corren 'prensa' (Roboto Serif/Figtree) — "comparaste contra
// otra tienda".
//
// ESTE ARCHIVO TIENE DOS MITADES:
//
//   1. `medirTemaReal(url)` — PURA (salvo el propio `fetch`): lee el tema REAL de un muestrario
//      YA DESPLEGADO, por EJECUCIÓN, nunca a mano. La reimporta `capturar-seccion.ts`
//      (`sembrarCompra`) para sembrar la base efímera con el tema MEDIDO en vez de uno aproximado —
//      así el camino de compra COMPLETO (cajón, los dos pasos del checkout, la confirmación real,
//      el seguimiento) se captura, de ahora en más, bajo el tema correcto. Esa mitad NO importa
//      nada de `capturar-seccion.ts` (evita el ciclo de imports; la carga de Playwright se duplica
//      abajo, es chica).
//
//   2. El CLI (`main`, invocado DIRECTO — `node --import tsx scripts/capturar-compra.ts`, sin
//      Postgres: no toca ninguna base) — cubre las piezas que el camino de compra interactivo NO
//      puede mostrar sin fabricar un pago real: la página de estado en sus CINCO estados
//      (aprobado/pendiente/rechazado/manual/sin_referencia — un pedido de verdad sólo llega a UNO)
//      y el seguimiento en sus TRES estados (cumplido/activo/pendiente, a la vez, con
//      `currentStep` elegido — igual que el preview del editor, § `CompraSeccion.tsx`,
//      `PreviewCompra`). El CAJÓN se captura ACÁ TAMBIÉN, con datos de muestra controlados (un
//      departamento ya elegido, § abajo) — la pieza PURA `CajonPanel` (`CartDrawer.tsx`, ya
//      `renderToStaticMarkup`-eable, § su docstring) lo permite sin estado de carrito real.
//
//      Monta cada pieza con `renderToStaticMarkup` (React, sin Next) a una PÁGINA ESTÁTICA (un
//      documento HTML standalone) que carga: (a) el CSS COMPILADO de la app — `.next/static/
//      chunks/*.css`, el artefacto de un `next build` YA CORRIDO (por el harness de
//      `capturar-seccion.ts`, que esta corrida reusa — ver `leerCssStorefront`, abajo, para el
//      prerrequisito exacto); (b) el `:root{...}` MEDIDO por `medirTemaReal` — inyectado VERBATIM,
//      después del CSS compilado, para que gane por orden de fuente (misma especificidad); y (c)
//      el `<link>` de Google Fonts del muestrario real. Captura con Chromium (el MISMO mecanismo
//      aislado de Playwright que `capturar-seccion.ts`, duplicado acá para no crear un import
//      circular entre los dos scripts) a 390 y 1440, al lado de la captura `v-*` equivalente de la
//      maqueta (`.scratch/lanzamiento/maqueta-compra/capturas/`).
//
// PRERREQUISITO: un `next build` reciente de ESTA rama tiene que existir en `.next/` — lo deja
// cualquier corrida de `npm run capturar:seccion -- --sembrar-compra <tienda> ...` (el mismo
// comando que ya produce las capturas del cajón/checkout/confirmación/seguimiento interactivos).
// Sin eso, `leerCssStorefront` falla con un mensaje que dice exactamente qué correr primero.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CajonPanel, type CajonPanelItem } from "../components/storefront/CartDrawer";
import EstadoPedido, { type ResumenEstadoPedido } from "../components/storefront/checkout/EstadoPedido";
import { SeguimientoTimeline } from "../app/(storefront)/rastrear-pedido/page";
import { SiteContentProvider } from "../components/storefront/SiteContentProvider";
import { DEFAULTS, type SiteContentData, type VendedorContent } from "../lib/config/site-content-defaults";
import { PARES_FUENTES, type ClaveFuentePar } from "../lib/config/fuentes";
import { FORMAS, type ClaveForma } from "../lib/config/formas";
import type { EstadoPedidoPagina } from "../lib/checkout/estado-pedido";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA_DIR = join(RAIZ, ".scratch", "revision-owner", "pares-compra-2");
const MAQUETA_CAPTURAS_DIR = join(RAIZ, ".scratch", "lanzamiento", "maqueta-compra", "capturas");

// ─── MITAD 1 — el tema REAL, medido por EJECUCIÓN ────────────────────────────────────────────────

export interface TemaMedido {
  fondo: string;
  tinta: string;
  acento: string;
  /** El par cerrado de `lib/config/fuentes.ts` que coincide EXACTO con el `--sf-fuente-titulo`/
   *  `--sf-fuente-cuerpo` medidos. `null` = 'editorial' (fábrica) — el valor que `guardarTemaBorrador`
   *  espera para "sin override" (§ `fuentes.ts`, "`editorial` NUNCA se guarda"). */
  fuentePar: ClaveFuentePar | null;
  /** La forma cerrada de `lib/config/formas.ts` que coincide con el `--radius-3xl` medido. `null` =
   *  'suave' (fábrica), mismo criterio que `fuentePar`. */
  forma: ClaveForma | null;
  /** El `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` del muestrario, o `null`
   *  si el tema es fábrica (sin link propio — el `@import` de Inter/Playfair ya viaja en el CSS
   *  compilado, § `leerCssStorefront`). */
  googleFontsHref: string | null;
  /** Los bloques `:root{...}` MEDIDOS, concatenados tal cual aparecieron en el HTML servido
   *  (paleta + fuente + forma — son `<style>` SEPARADOS, § el hallazgo de este slice: inyectarlos
   *  TODOS, no sólo el primero, es lo que distingue esto de una medición a medias). */
  rootCssTexto: string;
}

/** Lee el TEMA REAL de un muestrario YA DESPLEGADO, por EJECUCIÓN (`fetch`, sin Playwright: el
 *  storefront es `force-dynamic` e inyecta `cssPaleta`/`cssFuentes`/`cssFormas` como `<style>`
 *  LITERAL en el HTML servido — medido antes de escribir esto, el HTML crudo ya trae el mismo
 *  valor final que `getComputedStyle(document.documentElement)` leería en un navegador, así que
 *  `fetch` es equivalente y no paga el costo de un browser sólo para esto). Lanza si el muestrario
 *  no responde 200, si no hay bloque `:root{--sf-fondo…}`, o si el par de fuentes medido no está en
 *  el set CERRADO de `lib/config/fuentes.ts` — un tema real fuera de ese catálogo sería un defecto
 *  del catálogo, no algo que absorber en silencio. */
export async function medirTemaReal(url: string): Promise<TemaMedido> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`medirTemaReal: ${url} respondió ${r.status} — ¿el muestrario está arriba?`);
  const html = await r.text();

  // Los TRES bloques :root{...} que el storefront inyecta (paleta · fuente · forma, § el docstring
  // de cabecera de `sembrarCasillas` en capturar-seccion.ts) viven en `<style>` SEPARADOS. Un
  // regex global los junta a TODOS — no sólo el primero — para que un tema custom con fuente y/o
  // forma propias no pierda esas dos partes.
  const bloques = [...html.matchAll(/<style>(:root\{[^}]*\})<\/style>/g)].map((m) => m[1]);
  const rootCssTexto = bloques.join("");
  if (!rootCssTexto.includes("--sf-fondo")) {
    throw new Error(`medirTemaReal: no se encontró ningún bloque :root{...--sf-fondo...} en ${url}`);
  }

  const leer = (nombre: string): string | null => {
    const m = rootCssTexto.match(new RegExp(`${nombre}:([^;]+);`));
    return m ? m[1] : null;
  };

  const fondo = leer("--sf-fondo");
  const tinta = leer("--sf-tinta");
  const acento = leer("--sf-acento");
  if (!fondo || !tinta || !acento) {
    throw new Error(`medirTemaReal: faltan --sf-fondo/--sf-tinta/--sf-acento en ${url} (bloques medidos: ${bloques.length})`);
  }

  const fuenteTitulo = leer("--sf-fuente-titulo");
  const fuenteCuerpo = leer("--sf-fuente-cuerpo");
  let fuentePar: ClaveFuentePar | null = null;
  if (fuenteTitulo && fuenteCuerpo) {
    const par = PARES_FUENTES.find((p) => p.titulo === fuenteTitulo && p.cuerpo === fuenteCuerpo);
    if (!par) {
      throw new Error(
        `medirTemaReal: el par medido (titulo="${fuenteTitulo}" cuerpo="${fuenteCuerpo}") de ${url} no está ` +
          `en CLAVES_FUENTES (lib/config/fuentes.ts) — el set cerrado no lo cubre, o el catálogo quedó desactualizado.`,
      );
    }
    // 'editorial' es el default — `guardarTemaBorrador` espera `null` para "sin override"
    // (§ fuentes.ts: "editorial NUNCA se guarda").
    fuentePar = par.clave === "editorial" ? null : par.clave;
  }

  const radius3xl = leer("--radius-3xl");
  let forma: ClaveForma | null = null;
  if (radius3xl) {
    const f = FORMAS.find((f) => f.radius3xl === radius3xl);
    forma = f && f.clave !== "suave" ? f.clave : null;
  }

  const linkMatch = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/);
  const googleFontsHref = linkMatch ? linkMatch[1].replace(/&amp;/g, "&") : null;

  return { fondo, tinta, acento, fuentePar, forma, googleFontsHref, rootCssTexto };
}

// ─── MITAD 2 — el CLI: piezas puras, renderizadas a una página estática ──────────────────────────

interface TiendaConfig {
  clave: "onix" | "chamisas";
  url: string;
  nombreCompleto: string;
  ciudad: string;
  cajon: "creditos" | "album";
  confirmacion: "boleto" | "lamina";
  seguimiento: "escaleta" | "album";
  // § COMPRA-FIDELIDAD-3 — el cuarto eje (los pasos de Entrega/Pago del checkout).
  pasos: "ficha" | "tejido";
}

const TIENDAS: TiendaConfig[] = [
  {
    clave: "onix",
    url: "https://cafe-onix.vercel.app/",
    nombreCompleto: "Café Onix",
    ciudad: "Pitalito, Huila",
    cajon: "creditos",
    confirmacion: "boleto",
    seguimiento: "escaleta",
    pasos: "ficha",
  },
  {
    clave: "chamisas",
    url: "https://coffee-template-app-las-chamisas.vercel.app/",
    nombreCompleto: "Las Chamisas",
    ciudad: "San Adolfo, Huila",
    cajon: "album",
    confirmacion: "lamina",
    seguimiento: "album",
    pasos: "tejido",
  },
];

const ANCHOS = [390, 1440] as const;

function vendedorDeMuestra(t: TiendaConfig): VendedorContent {
  return {
    visible: true,
    nombreCompleto: t.nombreCompleto,
    tipoPersona: "natural",
    documentoTipo: "cc",
    documentoNumero: "0000000000",
    nombreComercial: "",
    direccion: "Calle Falsa 123",
    ciudad: t.ciudad,
    correo: "contacto@ejemplo.com",
    telefono: "+573000000000",
    horarioAtencion: "",
    municipioDespacho: "",
    transportadoras: "",
    diasPreparacionHabiles: "2 a 3",
    ventanaCambiosDias: "5",
  };
}

// ── CSS compilado — § el docstring de cabecera, prerrequisito ──
//
// Turbopack (este repo, Next 16) parte el CSS en `.next/static/chunks/*.css` con nombres
// HASHEADOS — no hay un nombre fijo que leer. Se identifica el chunk del STOREFRONT por
// CONTENIDO (una clase que sólo él declara, `sf-divisor-b`), no por nombre, porque el hash
// cambia en cada build. Si hay más de uno que la declare (improbable, pero el glob no lo asume),
// se concatenan todos.
const MARCADOR_CSS_STOREFRONT = "sf-divisor-b";

function leerCssStorefront(): string {
  const chunksDir = join(RAIZ, ".next", "static", "chunks");
  if (!existsSync(chunksDir)) {
    throw new Error(
      `leerCssStorefront: no existe ${chunksDir} — hace falta un \`next build\` de esta rama en disco. ` +
        `Corré primero \`npm run capturar:seccion -- --sembrar-compra onix --sin-prototipo --ruta /tienda ` +
        `--accion-previa abrir-carrito --ancho 390 --alto 900 --nombre compra-build\` (o cualquier corrida ` +
        `equivalente) y volvé a intentar.`,
    );
  }
  const candidatos = readdirSync(chunksDir).filter((f) => f.endsWith(".css"));
  const encontrados = candidatos.filter((f) => readFileSync(join(chunksDir, f), "utf8").includes(MARCADOR_CSS_STOREFRONT));
  if (encontrados.length === 0) {
    throw new Error(
      `leerCssStorefront: ninguno de los ${candidatos.length} chunks .css de ${chunksDir} contiene ` +
        `"${MARCADOR_CSS_STOREFRONT}" — el build en disco no parece tener el CSS del storefront (¿un build viejo, ` +
        `de otra rama?). Volvé a correr \`npm run capturar:seccion -- --sembrar-compra …\` sobre ESTA rama.`,
    );
  }
  return encontrados.map((f) => readFileSync(join(chunksDir, f), "utf8")).join("\n");
}

// ── Piezas puras, por tienda ──

const ITEM_CAJON_MUESTRA = (t: TiendaConfig): CajonPanelItem => ({
  key: "muestra-1",
  id: "muestra-1",
  nombre: "Café de muestra",
  imagen: "",
  precio: 35_000,
  quantity: 1,
  options: { molienda: "En grano" },
  // El peso que `sembrarCompra` ya le da al producto sembrado (§ capturar-seccion.ts) — mismo
  // número, para que esta captura y la del camino interactivo no diverjan sin motivo.
  peso_gramos: 250,
});

function renderCajon(t: TiendaConfig): string {
  return renderToStaticMarkup(
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "384px",
          minHeight: "70vh",
          background: "var(--sf-tarjeta,#fff)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,.25)",
        },
      },
      React.createElement(CajonPanel, {
        cajon: t.cajon,
        carrito: { variante: "anclado" },
        // Un departamento YA elegido (§ el docstring de cabecera): la maqueta captura el cajón con
        // el bloque "Envío a" resuelto, no vacío — un departamento sin elegir es un estado
        // distinto, ya cubierto por la captura del camino interactivo (`--accion-previa
        // abrir-carrito`, que arranca sin departamento a propósito).
        departamento: "Bogotá D.C.",
        // `visible: true` SÓLO para esta verificación (§ el docstring de cabecera de
        // `BarraEnvioGratis`, CartDrawer.tsx): confirma el fix del filete fino/tejido sin tocar el
        // toggle real de ninguna tienda — `content.carritoEnvio.visible` sigue en `false` para
        // onix/chamisas en `sembrarCompra`, decisión de PRODUCTO que este slice no toca.
        carritoEnvio: { visible: true },
        coloresPorProducto: {},
        items: [ITEM_CAJON_MUESTRA(t)],
        vendedor: vendedorDeMuestra(t),
        onClose: () => {},
        onUpdateQuantity: () => {},
        onRemoveItem: () => {},
        onDepartamentoChange: () => {},
      }),
    ),
  );
}

const ESTADOS: EstadoPedidoPagina[] = ["aprobado", "pendiente", "rechazado", "manual", "sin_referencia"];
const NUMERO_ORDEN_MUESTRA = "CN-482910";
const RESUMEN_MUESTRA: ResumenEstadoPedido = {
  items: [{ nombre: "Café de muestra", cantidad: 1, subtotal: 35_000, molienda: "En grano" }],
  subtotal: 35_000,
  envio: 12_000,
  total: 47_000,
  metodoEnvioLabel: "Bogotá D.C.",
  direccionDetalle: null,
};

function contenidoCompra(t: TiendaConfig): SiteContentData {
  return {
    ...DEFAULTS,
    compra: { cajon: t.cajon, confirmacion: t.confirmacion, seguimiento: t.seguimiento, pasos: t.pasos },
    vendedor: vendedorDeMuestra(t),
  };
}

function renderEstado(t: TiendaConfig, estado: EstadoPedidoPagina): string {
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: contenidoCompra(t),
      children: React.createElement(
        "div",
        {
          style: {
            minHeight: "100vh",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--sf-fondo)",
            padding: "2rem 1rem",
          },
        },
        React.createElement(EstadoPedido, {
          estado,
          metodo: estado === "sin_referencia" ? null : "nequi",
          numeroOrden: estado === "sin_referencia" ? null : NUMERO_ORDEN_MUESTRA,
          correo: "correo@ejemplo.com",
          nombre: "Nombre de ejemplo",
          resumen: estado === "sin_referencia" ? null : RESUMEN_MUESTRA,
          acciones: [],
        }),
      ),
    }),
  );
}

function renderSeguimiento(t: TiendaConfig): string {
  return renderToStaticMarkup(
    React.createElement(
      "div",
      {
        style: {
          minHeight: "100vh",
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          background: "var(--sf-fondo)",
          padding: "2rem 1rem",
        },
      },
      // `currentStep=2`, igual que `PreviewCompra` (§ CompraSeccion.tsx): ni el primer paso ni el
      // último, para que CUMPLIDO/ACTIVO/PENDIENTE (los "tres estados" del spec) se vean a la vez.
      React.createElement(SeguimientoTimeline, {
        seguimiento: t.seguimiento,
        currentStep: 2,
        fechaPedido: new Date("2026-10-12T15:00:00.000Z").toISOString(),
      }),
    ),
  );
}

// ── El documento HTML standalone ──

function construirDocumento(piezaHtml: string, tema: TemaMedido, cssStorefront: string, titulo: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
${tema.googleFontsHref ? `<link rel="stylesheet" href="${tema.googleFontsHref}">` : ""}
<style>${cssStorefront}</style>
<style>${tema.rootCssTexto}</style>
<style>html,body{margin:0;padding:0;background:var(--sf-fondo);}</style>
</head>
<body>
${piezaHtml}
</body>
</html>`;
}

// ── Servidor estático chico: sirve `public/` y traduce `/_next/image?url=...` a su archivo crudo
//    (next/image, renderizado FUERA de un server Next real, no tiene optimizador detrás — se sirve
//    el archivo tal cual para que la miniatura de muestra no quede rota en la captura). ──

const TIPOS_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function servirEstatico(paginas: Map<string, string>) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);

    const pagina = paginas.get(pathname);
    if (pagina !== undefined) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(pagina);
      return;
    }

    if (pathname === "/_next/image") {
      const destino = url.searchParams.get("url");
      if (destino) pathname = decodeURIComponent(destino);
    }

    const publicDir = join(RAIZ, "public");
    const destino = resolve(join(publicDir, pathname));
    if (!destino.startsWith(publicDir)) {
      response.writeHead(403).end("Fuera de public/");
      return;
    }
    if (!existsSync(destino)) {
      response.writeHead(404).end(`No existe: ${pathname}`);
      return;
    }
    const tipo = TIPOS_MIME[extname(destino).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": tipo });
    response.end(readFileSync(destino));
  };
}

async function levantarServidor(paginas: Map<string, string>): Promise<{ puerto: number; cerrar: () => Promise<void> }> {
  const server = createServer(servirEstatico(paginas));
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  const puerto = (server.address() as AddressInfo).port;
  return { puerto, cerrar: () => new Promise<void>((res) => server.close(() => res())) };
}

// ── Playwright, instalación aislada — duplicado de `cargarPlaywright` en `capturar-seccion.ts`
//    (§ el docstring de cabecera: evita el import circular entre los dos scripts). ──

interface PlaywrightPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  screenshot(opts: { path: string; fullPage?: boolean }): Promise<Buffer>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}
interface PlaywrightBrowser {
  newPage(opts?: { viewport?: { width: number; height: number } }): Promise<PlaywrightPage>;
  close(): Promise<void>;
}
interface PlaywrightModule {
  chromium: { launch(opts?: { headless?: boolean }): Promise<PlaywrightBrowser> };
}

const TOOLING_DIR = join(RAIZ, ".arnes-tooling", "playwright");

function cargarPlaywright(): PlaywrightModule {
  const pkgJson = join(TOOLING_DIR, "package.json");
  if (!existsSync(pkgJson)) {
    console.log(`▸ Playwright no está instalado (aislado) — instalando en ${TOOLING_DIR}…`);
    mkdirSync(TOOLING_DIR, { recursive: true });
    const r = spawnSync("npm", ["install", "--prefix", TOOLING_DIR, "playwright"], { stdio: "inherit", cwd: RAIZ });
    if (r.status !== 0) throw new Error("No se pudo instalar Playwright de forma aislada.");
  }
  const cliJs = join(TOOLING_DIR, "node_modules", "playwright", "cli.js");
  console.log("▸ Verificando Chromium (instalación aislada)…");
  const instalado = spawnSync(process.execPath, [cliJs, "install", "chromium"], { stdio: "inherit", cwd: RAIZ });
  if (instalado.status !== 0) throw new Error("No se pudo instalar/verificar el binario de Chromium.");
  const req = createRequire(pkgJson);
  return req("playwright") as PlaywrightModule;
}

// ── main ──

interface Pieza {
  nombre: string; // slug de archivo, p.ej. "onix-cajon"
  html: string;
  maquetaRef: string | null; // nombre de archivo dentro de MAQUETA_CAPTURAS_DIR, SIN sufijo -d/-m
}

async function main(): Promise<void> {
  console.log("─".repeat(78));
  console.log("CAPTURA DEL CAMINO DE COMPRA — tema REAL, medido por ejecución (§ COMPRA-LINEAS-FIDELIDAD-2)");
  console.log("No prueba que se vea bien — prueba que el tema y el tratamiento sean los correctos.");
  console.log("─".repeat(78));

  const cssStorefront = leerCssStorefront();
  console.log(`✔ CSS del storefront leído (${(cssStorefront.length / 1024).toFixed(0)} KB).`);

  mkdirSync(SALIDA_DIR, { recursive: true });

  const playwright = cargarPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });

  const resumen: Record<string, unknown>[] = [];

  try {
    for (const t of TIENDAS) {
      console.log(`▸ Midiendo el tema real de ${t.clave} (${t.url})…`);
      const tema = await medirTemaReal(t.url);
      console.log(`  fondo=${tema.fondo} tinta=${tema.tinta} acento=${tema.acento} fuentePar=${tema.fuentePar ?? "(fábrica)"} forma=${tema.forma ?? "(fábrica)"}`);

      const piezas: Pieza[] = [
        { nombre: `${t.clave}-cajon`, html: renderCajon(t), maquetaRef: "carrito-cajon" },
        ...ESTADOS.map((e): Pieza => ({
          nombre: `${t.clave}-estado-${e === "sin_referencia" ? "sinref" : e}`,
          html: renderEstado(t, e),
          maquetaRef: `estado-${e === "sin_referencia" ? "sinref" : e}`,
        })),
        { nombre: `${t.clave}-seguimiento`, html: renderSeguimiento(t), maquetaRef: "rastrear-resultado" },
      ];

      const paginas = new Map<string, string>();
      for (const p of piezas) {
        paginas.set(`/pieza/${p.nombre}.html`, construirDocumento(p.html, tema, cssStorefront, p.nombre));
      }
      const servidor = await levantarServidor(paginas);

      try {
        for (const ancho of ANCHOS) {
          const sufijoAncho = ancho === 390 ? "m" : "d";
          const page = await browser.newPage({ viewport: { width: ancho, height: 1400 } });
          try {
            for (const p of piezas) {
              const url = `http://127.0.0.1:${servidor.puerto}/pieza/${p.nombre}.html`;
              await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
              await page.waitForTimeout(250); // margen para que las fuentes de Google asienten
              const destino = join(SALIDA_DIR, `${p.nombre}-${sufijoAncho}-app.png`);
              await page.screenshot({ path: destino, fullPage: true });

              let maquetaCopiada: string | null = null;
              if (p.maquetaRef) {
                const origenMaqueta = join(MAQUETA_CAPTURAS_DIR, `v-${t.clave}-${sufijoAncho}-${p.maquetaRef}.jpg`);
                if (existsSync(origenMaqueta)) {
                  maquetaCopiada = `${p.nombre}-${sufijoAncho}-maqueta.jpg`;
                  copyFileSync(origenMaqueta, join(SALIDA_DIR, maquetaCopiada));
                }
              }

              resumen.push({ pieza: p.nombre, ancho, app: `${p.nombre}-${sufijoAncho}-app.png`, maqueta: maquetaCopiada });
              console.log(`  ✔ ${p.nombre} @ ${ancho}px${maquetaCopiada ? ` ↔ ${maquetaCopiada}` : " (sin ref de maqueta)"}`);
            }
          } finally {
            await page.close();
          }
        }
      } finally {
        await servidor.cerrar();
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(SALIDA_DIR, "valores.json"), JSON.stringify(resumen, null, 2) + "\n");
  console.log(`\n✔ Capturas en ${SALIDA_DIR}`);
}

// Sólo correr `main` cuando este archivo se invoca DIRECTO (no cuando `capturar-seccion.ts`
// importa `medirTemaReal`).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error("❌ capturar-compra falló:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
