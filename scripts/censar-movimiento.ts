// scripts/censar-movimiento.ts — § ARNES-CENSO-MOVIMIENTO-1
//
// POR QUÉ EXISTE, TEXTUAL DEL OWNER (2026-09-27): «las transiciones es de las cosas que más ha
// costado implementar… ¿hay alguna forma de construir una base que entienda o analice las páginas
// de tal forma que me sea fácil explicarte la idea cuando pido una transición?». El costo está
// MEDIDO, no estimado: el marquee del hero llevó TRES rondas de gate del owner
// (`CORTE-HERO-STICKY-RONDA-2-1`, `CORTE-HERO-MARQUEE-REVELA-1`, `CORTE-HERO-VELO-OFF-Y-TICKER-1`),
// y la causa de raíz de las tres fue la MISMA: el movimiento se DESCRIBIÓ con palabras y se leyó
// del HTML estático, cuando había que MEDIRLO en ejecución — un `curl` trae el markup, no lo
// ejecuta, y una captura de pantalla congela justo lo que importa.
//
// ESTE ARNÉS CAMBIA EL PROTOCOLO: el owner señala ("esa banda, en esa página") y la herramienta
// MIDE qué se mueve, cómo, y con qué. Nadie describe.
//
// ─── QUÉ HACE ─────────────────────────────────────────────────────────────────────────────────
// Carga `--url` con Playwright, arma un plan de posiciones de scroll (arriba del todo → el final
// del documento, en pasos parejos) y, EN CADA posición, muestrea varios instantes de tiempo — así
// se puede separar lo que cambia por SCROLL de lo que cambia por TIEMPO (la mitad pura que hace esa
// separación vive en `lib/movimiento/clasificar.ts`, con su propio test). Sólo interesan los
// elementos que CAMBIAN: los que dan lo mismo en todas las muestras se descartan del reporte (pero
// se cuentan, para que el reporte diga cuántos candidatos se barrieron).
//
// Deja `docs/movimiento/<nombre>.md` (legible) y `docs/movimiento/<nombre>.json` (la traza cruda,
// citable por scrollY/t/valor) — con fecha y URL en la cabecera de los dos, la misma regla que ya
// rige toda captura de este repo: una traza sin fecha se cita meses después como si fuera de hoy.
//
// ─── LÍMITE DECLARADO: `hover` QUEDA FUERA DE ALCANCE ────────────────────────────────────────────
// Este arnés muestrea scroll y tiempo — nunca mueve el puntero ni simula `:hover`/`:focus`. Un
// elemento cuyo ÚNICO movimiento depende de un estado de interacción (un botón que sólo se revela
// al pasar el cursor, `group-hover:opacity-100`) se clasifica `estatico` acá — no porque el arnés
// se equivoque, sino porque esa clase de movimiento no la ejercita. Documentado también en
// `docs/movimiento/README.md`; si algún día hace falta, es una CAPACIDAD NUEVA (simular
// `page.hover()` sobre cada candidato, en cada posición de scroll — multiplica el costo de la
// corrida), no un ajuste de esta versión.
//
// ─── REUSA EL ARNÉS DE CAPTURA — NO DUPLICA EL ARRANQUE DE PLAYWRIGHT ────────────────────────────
// `cargarPlaywright` y los tipos mínimos de Playwright (`PlaywrightModule`/`PlaywrightBrowser`/
// `PlaywrightPage`/`PlaywrightResponse`) se IMPORTAN de `scripts/verificar-nayoli-visual.ts` — el
// MISMO mecanismo que `scripts/guarda-color.ts` ya usa (import directo entre scripts del arnés, sin
// tocar el archivo importado). Es genuinamente el mismo `TOOLING_DIR`
// (`.arnes-tooling/playwright/`), así que la instalación aislada de Playwright/Chromium se comparte
// entre los tres arneses — no se paga la descarga tres veces. `scripts/capturar-seccion.ts` (el
// otro arnés que abre una URL externa, § ARNES-CAPTURA-MUESTRARIO-REAL-1) NO exporta nada
// importable (todo vive dentro de su `main()`), así que lo que de ÉL se reusa es el PATRÓN, citado
// en los comentarios de abajo: el mismo directorio de instalación aislada, y la misma verificación
// de Deployment Protection al navegar.
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  RAIZ,
  cargarPlaywright,
  type PlaywrightPage,
  type PlaywrightResponse,
} from "./verificar-nayoli-visual";
import {
  clasificarElemento,
  type GrupoScroll,
  type MuestraTiempo,
  type ResultadoClasificacion,
} from "../lib/movimiento/clasificar";

const SALIDA_DIR = join(RAIZ, "docs", "movimiento");

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────
interface Opciones {
  url: string;
  nombre: string;
  pasos: number;
  instantes: number;
  esperaInstanteMs: number;
  esperaScrollMs: number;
  anchoPx: number;
  altoPx: number;
  pasosAdaptativos: number;
}

function ayuda(): string {
  return `
Uso:
  npm run censar:movimiento -- --url <URL> [--nombre <slug>] [--pasos <n>] \\
    [--instantes <n>] [--espera-instante-ms <ms>] [--espera-scroll-ms <ms>] \\
    [--ancho <px>] [--alto <px>]

--url es REQUERIDO — la página a censar (propia o de un tercero, cualquiera que
Playwright pueda cargar).
--nombre es OPCIONAL — el slug de \`docs/movimiento/<nombre>.md\`/\`.json\`. Sin
él, se deriva del host+path de la URL.
--pasos (default 6) — cuántas posiciones de scroll se muestrean, parejas entre
el tope del documento y el final (0% .. 100% del alto scrolleable). Con un
documento sin scroll posible, se usa una sola posición (0).
--instantes (default 3) — cuántos instantes de TIEMPO se muestrean en CADA
posición de scroll, para poder distinguir cambio-por-tiempo de cambio-por-scroll.
--espera-instante-ms (default 400) — separación en ms entre instantes dentro de
una misma posición.
--espera-scroll-ms (default 300) — espera tras cada \`scrollTo\`, antes del
primer instante, para dar tiempo a que listeners/observers reaccionen.
--ancho / --alto (default 1280×900) — el viewport de Playwright.
--pasos-adaptativos (default 3) — § ARNES-CENSO-MOVIMIENTO-CALIBRACION-1: cuántas posiciones DE MÁS
se insertan DENTRO de cada tramo donde la pasada gruesa detectó un \`revelado\` (un parallax que
completa su recorrido entre dos \`--pasos\` consecutivos se ve, a esa resolución, como un salto único
— más resolución local revela si en verdad es continuo). \`0\` desactiva la calibración (para cuando
sólo importa el costo, no la precisión).

Ejemplo:
  npm run censar:movimiento -- --url https://x-cafeone.myshopify.com/ --nombre cafeone-home
`.trim();
}

function slugDeUrl(url: string): string {
  const u = new URL(url);
  const base = `${u.hostname}${u.pathname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "pagina";
}

function parseCli(argv: string[]): Opciones {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      nombre: { type: "string" },
      pasos: { type: "string" },
      instantes: { type: "string" },
      "espera-instante-ms": { type: "string" },
      "espera-scroll-ms": { type: "string" },
      ancho: { type: "string" },
      alto: { type: "string" },
      "pasos-adaptativos": { type: "string" },
      ayuda: { type: "boolean" },
      help: { type: "boolean" },
    },
    allowPositionals: false,
  });

  if (values.ayuda || values.help) {
    console.log(ayuda());
    process.exit(0);
  }
  if (!values.url) {
    throw new Error(`Falta --url.\n\n${ayuda()}`);
  }

  const pasos = values.pasos ? Number(values.pasos) : 6;
  const instantes = values.instantes ? Number(values.instantes) : 3;
  // Default 3 — § ARNES-CENSO-MOVIMIENTO-CALIBRACION-1: suficiente para separar un salto único (una
  // sola de las 4 micro-transiciones resultantes cambia) de un continuo (la mayoría cambia), sin
  // multiplicar el costo de la corrida por un número grande. Ver `gapsARefinar`/`posicionesIntermedias`
  // más abajo para el criterio completo.
  const pasosAdaptativos = values["pasos-adaptativos"] ? Number(values["pasos-adaptativos"]) : 3;
  if (pasos < 1) throw new Error("--pasos debe ser ≥ 1.");
  if (instantes < 1) throw new Error("--instantes debe ser ≥ 1.");
  if (pasosAdaptativos < 0) throw new Error("--pasos-adaptativos debe ser ≥ 0 (0 desactiva).");

  return {
    url: values.url,
    nombre: values.nombre ?? slugDeUrl(values.url),
    pasos,
    instantes,
    esperaInstanteMs: values["espera-instante-ms"] ? Number(values["espera-instante-ms"]) : 400,
    esperaScrollMs: values["espera-scroll-ms"] ? Number(values["espera-scroll-ms"]) : 300,
    anchoPx: values.ancho ? Number(values.ancho) : 1280,
    altoPx: values.alto ? Number(values.alto) : 900,
    pasosAdaptativos,
  };
}

// ─── La trampa de Deployment Protection, medida al navegar — MISMO patrón que
// `capturar-seccion.ts` (§ ARNES-CAPTURA-MUESTRARIO-REAL-1), reescrito acá porque ese archivo no
// exporta nada importable. Un 401 o una redirección al SSO de Vercel significa que lo que se está
// por censar es una pantalla de login, no la página pedida — PARA la corrida entera antes de
// muestrear un solo frame. Nunca hardcodea un bypass.
function verificarSinProteccion(response: PlaywrightResponse | null, urlIntentada: string): void {
  const status = response?.status() ?? 0;
  if (status === 401) {
    throw new Error(
      `Deployment Protection detectada navegando ${urlIntentada} (status 401) — PARANDO, no se ` +
        `censa nada. El owner decide si apaga la protección del deployment; este script no ` +
        `hardcodea ningún bypass.`,
    );
  }
}

interface LecturaCruda {
  transform: string;
  opacity: string;
  enViewport: boolean;
}

// ─── CALIBRACIÓN (a) — el eje de TIEMPO se muestrea sólo en posiciones donde el elemento está EN
// PANTALLA — § ARNES-CENSO-MOVIMIENTO-CALIBRACION-1 ─────────────────────────────────────────────────
// MEDIDO contra el primer censo real: `xo-marquee-item` (cafeone.myshopify.com) estuvo en viewport
// SÓLO en la posición scrollY=0 de las 6 muestreadas (`docs/movimiento/cafeone-home.json`, elemento
// [2] antes de esta calibración) — en las otras 5, el arnés IGUAL tomó 3 instantes de tiempo, y como
// el widget aparentemente pausa su animación fuera de vista, esos 5 grupos aportaban "no cambia" al
// cálculo de mayoría (`UMBRAL_MAYORIA_TICKER`, `lib/movimiento/clasificar.ts`) — diluyendo la señal
// real del único grupo donde SÍ había algo que ver. La captura de los N instantes por posición NO
// cambia (es barata y uniforme, y saber que un grupo NO cambió mientras el elemento SÍ estaba
// oculto sigue siendo un dato, no ruido); lo que cambia es qué llega a `clasificarElemento`: un
// grupo donde NINGUNA muestra estuvo en el viewport se COLAPSA a su ÚLTIMA muestra antes de
// clasificar, así queda fuera de `gruposConVarios` (que exige `muestras.length >= 2`) sin perder su
// valor representativo para el eje de SCROLL (scrub/revelado no dependen de la visibilidad — un
// elemento puede animarse de verdad fuera de vista, y eso es un hecho legítimo del DOM).
//
// CRITERIO DE "EN PANTALLA" para un grupo: basta que ALGUNA de sus muestras haya estado en el
// viewport (no las tres) — a scrollY fijo la visibilidad de un elemento normalmente no cambia entre
// instantes separados por unos cientos de ms, salvo que el propio elemento se esté moviendo dentro o
// fuera del viewport por su cuenta (un caso raro, y tratarlo como "visible" es el lado seguro: preferir
// de más datos de tiempo a de menos).
function grupoDentroDeVista(g: GrupoScroll): GrupoScroll {
  const algunaVisible = g.muestras.some((m) => m.enViewport);
  if (algunaVisible) return g;
  return { ...g, muestras: [g.muestras[g.muestras.length - 1]] };
}

// Lo que efectivamente se le pasa a `clasificarElemento` — nunca lo que se persiste en el `.json`
// (la traza cruda guarda TODOS los instantes tomados, con su `enViewport`, para que sea citable; el
// filtro de calibración (a) es sólo una VISTA sobre esos datos para la clasificación).
function paraClasificar(grupos: GrupoScroll[]): GrupoScroll[] {
  return grupos.map(grupoDentroDeVista);
}

/** Cuántas de las posiciones de scroll muestreadas tuvieron al elemento en el viewport en ALGUNA de
 *  sus muestras — el dato que calibración (a) pide "decir en la traza" cuando da 0 (nunca visible):
 *  la clasificación por TIEMPO no pudo verificarse en vista, así que cualquier `ticker` que hubiera
 *  quedaría invisible para este muestreo por completo (§ el límite de `hover`, misma familia: no es
 *  que el arnés se equivoque, es que no lo ejercitó). */
function resumenVisibilidad(grupos: GrupoScroll[]): { visibles: number; total: number } {
  const total = grupos.length;
  const visibles = grupos.filter((g) => g.muestras.some((m) => m.enViewport)).length;
  return { visibles, total };
}

// ─── CALIBRACIÓN (b) — PASOS ADAPTATIVOS dentro de un tramo `revelado` — § ARNES-CENSO-MOVIMIENTO-
// CALIBRACION-1 ───────────────────────────────────────────────────────────────────────────────────
// MEDIDO contra el primer censo real: TODOS los `<xo-parallax-scroll>` de cafeone.myshopify.com
// clasificaron `revelado` con 6 pasos Y con 20 (§ `docs/movimiento/README.md`) — su recorrido cabe
// dentro de una sección, más angosto que cualquier paso parejo razonable. Subir `--pasos` GLOBALMENTE
// no ayuda: reparte la resolución nueva por TODO el documento, no dentro del tramo angosto donde hace
// falta. La salida es LOCAL: `ClasificacionRevelado.ventanaScrollY` (§ `lib/movimiento/clasificar.ts`)
// le dice al arnés EXACTAMENTE qué tramo de la pasada gruesa produjo el `revelado`; acá se
// re-muestrea ESE tramo con `pasosAdaptativos` posiciones intermedias, se fusiona con la traza y se
// reclasifica con el conjunto ampliado — si el mecanismo real es continuo, la proporción de
// transiciones que cambian (ahora medida a resolución fina, dentro de ese tramo) cruza
// `UMBRAL_FRACCION_REVELADO` y pasa a `scrub`; si sigue siendo un salto único incluso ahí, se queda
// `revelado`, con una ventana más angosta y más precisa que antes.
//
// El criterio se aplica a TODOS los `revelado` de la pasada gruesa (no sólo los de una transición): un
// tramo de revelado que abarca VARIAS transiciones consecutivas también puede estar sub-resuelto en
// cada una de ellas.

/** Ubica el ÍNDICE de un `scrollY` dentro del array de posiciones GRUESAS ya muestreadas — las
 *  ventanas de un `revelado`/`scrub` de la pasada gruesa SIEMPRE citan un `scrollY` que es un
 *  elemento exacto de ese array (nunca uno inventado), así que la búsqueda no puede fallar salvo que
 *  se le pase la ventana de una clasificación hecha sobre una traza YA fusionada — no es el caso acá,
 *  porque los tramos a refinar se calculan ANTES de fusionar nada. */
function indiceDePosicion(posiciones: number[], scrollY: number): number {
  const i = posiciones.indexOf(scrollY);
  if (i === -1) {
    throw new Error(
      `Invariante roto: scrollY=${scrollY} no está entre las posiciones gruesas muestreadas ` +
        `(${posiciones.join(", ")}) — la ventana de un revelado de la pasada gruesa debería citar ` +
        `siempre una de ellas.`,
    );
  }
  return i;
}

/** El conjunto de índices de TRAMOS (el tramo `g` es el par `[posiciones[g], posiciones[g+1]]`) que
 *  algún elemento marcó como `revelado` en la clasificación PRELIMINAR — la UNIÓN de todos, porque
 *  refinar un tramo no cuesta más por tener varios candidatos (se muestrea la página entera de
 *  todos modos en cada posición nueva). */
function gapsARefinar(
  resultadosPreliminares: Map<string, ResultadoClasificacion>,
  posicionesGruesas: number[],
): Set<number> {
  const gaps = new Set<number>();
  for (const resultado of resultadosPreliminares.values()) {
    for (const clase of resultado.clases) {
      if (clase.clase !== "revelado") continue;
      const i1 = indiceDePosicion(posicionesGruesas, clase.ventanaScrollY.desde);
      const i2 = indiceDePosicion(posicionesGruesas, clase.ventanaScrollY.hasta);
      for (let g = i1; g < i2; g++) gaps.add(g);
    }
  }
  return gaps;
}

/** `n` posiciones parejas estrictamente ENTRE `desde` y `hasta` (nunca en los extremos, que ya están
 *  muestreados). Un tramo de menos de 2px no se subdivide — no hay resolución de píxel entera que
 *  ganar ahí, y evita un `Math.round` produciendo un duplicado de uno de los extremos. */
function posicionesIntermedias(desde: number, hasta: number, n: number): number[] {
  if (n <= 0 || hasta - desde < 2) return [];
  const candidatas = Array.from({ length: n }, (_, k) => Math.round(desde + ((hasta - desde) * (k + 1)) / (n + 1)));
  return [...new Set(candidatas)].filter((p) => p > desde && p < hasta);
}

async function main(): Promise<void> {
  const inicio = Date.now();
  const opciones = parseCli(process.argv.slice(2));

  console.log(
    "─".repeat(78) +
      "\nESTE ARNÉS MIDE MOVIMIENTO EN EJECUCIÓN — no lee el HTML estático ni adivina por el nombre" +
      "\nde una clase. Clasifica ticker/scrub/revelado/estatico; \"hover\" queda fuera de alcance." +
      "\n" +
      "─".repeat(78),
  );
  console.log(`▸ URL: ${opciones.url}`);

  const playwright = cargarPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  let elementosCandidatos = 0;
  const grupos = new Map<string, GrupoScroll[]>();
  const descriptores = new Map<string, string>();
  // Metadata de calibración (b) para el reporte — poblada dentro del `try` si hubo algo que refinar;
  // queda declarada acá afuera porque se usa recién al escribir el `.md`/`.json`, después de cerrar
  // el navegador.
  const tramosRefinados: Array<{ desde: number; hasta: number; posicionesInsertadas: number[] }> = [];

  try {
    // `reducedMotion` no está en el tipo mínimo de `newPage` importado de `verificar-nayoli-visual.ts`
    // (ese arnés nunca lo necesitó) — se arma la opción en una variable APARTE, no en un literal
    // inline, para que la comprobación de propiedades-excedentes de TS no la rechace: Playwright
    // real SÍ acepta `reducedMotion` en `newPage`, el tipo local sólo no lo declaraba.
    //
    // EXPLÍCITO, no confiado al default del entorno (§ el spec lo pide): si el sistema que corre
    // este arnés tuviera `prefers-reduced-motion: reduce` activo, Playwright lo heredaría y toda
    // animación por `MotionConfig`/CSS quedaría instantánea — se mediría una página QUIETA y se
    // concluiría mal que no hay movimiento donde sí lo hay.
    const opcionesPagina = {
      viewport: { width: opciones.anchoPx, height: opciones.altoPx },
      reducedMotion: "no-preference" as const,
    };
    const page: PlaywrightPage = await browser.newPage(opcionesPagina);

    const respuesta = await page.goto(opciones.url, { waitUntil: "networkidle", timeout: 30_000 });
    verificarSinProteccion(respuesta, opciones.url);
    console.log("✔ Página cargada.");
    await page.waitForTimeout(500); // asentar carga inicial (fuentes, primer paint de observers)

    // Init: tagueamos cada elemento del <body> con un id estable para esta sesión, y capturamos su
    // descriptor legible. El tag vive SÓLO en esta página headless descartable — no persiste nada.
    elementosCandidatos = await page.evaluate<number, undefined>(() => {
      const els = Array.from(document.body.querySelectorAll("*"));
      els.forEach((el, i) => el.setAttribute("data-arnes-mv-id", String(i)));
      return els.length;
    }, undefined);
    console.log(`▸ Elementos candidatos (todo el <body>): ${elementosCandidatos}`);

    // Descriptor legible por elemento — NO es un selector CSS reversible, sólo una etiqueta
    // estable para el reporte (tag + id + primera clase). Varios elementos pueden compartir el
    // mismo descriptor; el índice numérico que el reporte antepone es lo que los distingue.
    const mapaDescriptores = await page.evaluate<Record<string, string>, undefined>(() => {
      const out: Record<string, string> = {};
      document.querySelectorAll("[data-arnes-mv-id]").forEach((el) => {
        const id = el.getAttribute("data-arnes-mv-id");
        if (!id) return;
        const tag = el.tagName.toLowerCase();
        const idAttr = el.id ? `#${el.id}` : "";
        const cls = el.classList.length ? `.${el.classList[0]}` : "";
        out[id] = `${tag}${idAttr}${cls}`;
      });
      return out;
    }, undefined);
    for (const [id, descriptor] of Object.entries(mapaDescriptores)) descriptores.set(id, descriptor);

    const alturaScrolleable = await page.evaluate<number, undefined>(
      () => document.documentElement.scrollHeight - window.innerHeight,
      undefined,
    );
    const posicionesScroll =
      alturaScrolleable > 0
        ? Array.from({ length: opciones.pasos }, (_, i) =>
            opciones.pasos === 1 ? 0 : Math.round((alturaScrolleable * i) / (opciones.pasos - 1)),
          )
        : [0];
    console.log(
      `▸ Alto scrolleable: ${alturaScrolleable}px — ${posicionesScroll.length} posición(es): ` +
        `${posicionesScroll.join(", ")}`,
    );

    // Muestrea UNA posición de scroll: la deja fija, espera a que se asiente, y toma `instantes`
    // lecturas de TODOS los elementos taggeados, separadas por `esperaInstanteMs`. Extraída para que
    // la pasada gruesa y el re-muestreo adaptativo (calibración (b), abajo) compartan EXACTAMENTE el
    // mismo procedimiento — dos implementaciones del mismo muestreo es cómo divergen entre sí.
    async function muestrearPosicion(
      scrollY: number,
    ): Promise<{ muestrasPorId: Map<string, MuestraTiempo[]>; tAbsolutoUltimaMuestraMs: number }> {
      await page.evaluate<void, number>((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(opciones.esperaScrollMs);

      const muestrasPorId = new Map<string, MuestraTiempo[]>();
      let tAbsolutoUltimaMuestraMs = Date.now();
      for (let i = 0; i < opciones.instantes; i++) {
        if (i > 0) await page.waitForTimeout(opciones.esperaInstanteMs);
        const t = i * opciones.esperaInstanteMs;
        const lecturas = await page.evaluate<Record<string, LecturaCruda>, undefined>(() => {
          const out: Record<string, { transform: string; opacity: string; enViewport: boolean }> = {};
          document.querySelectorAll("[data-arnes-mv-id]").forEach((el) => {
            const id = el.getAttribute("data-arnes-mv-id");
            if (!id) return;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const enViewport =
              r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
            out[id] = { transform: cs.transform, opacity: cs.opacity, enViewport };
          });
          return out;
        }, undefined);
        // Marca de tiempo REAL (Node, no del navegador) de ESTA lectura — usamos la del ÚLTIMO
        // instante (§ `GrupoScroll.tAbsolutoUltimaMuestraMs` en `lib/movimiento/clasificar.ts`): es
        // lo que le permite a la clasificación descontar el avance que un ticker infinito acumula
        // por el simple paso del tiempo real ENTRE posiciones de scroll, en vez de leerlo como si
        // el scroll lo hubiera movido.
        tAbsolutoUltimaMuestraMs = Date.now();

        for (const [id, lectura] of Object.entries(lecturas)) {
          const lista = muestrasPorId.get(id) ?? [];
          lista.push({ t, transform: lectura.transform, opacity: Number(lectura.opacity), enViewport: lectura.enViewport });
          muestrasPorId.set(id, lista);
        }
      }
      return { muestrasPorId, tAbsolutoUltimaMuestraMs };
    }

    // ── Pasada GRUESA — las `pasos` posiciones parejas de siempre ──
    for (const scrollY of posicionesScroll) {
      const { muestrasPorId, tAbsolutoUltimaMuestraMs } = await muestrearPosicion(scrollY);
      for (const [id, muestras] of muestrasPorId) {
        const lista = grupos.get(id) ?? [];
        lista.push({ scrollY, muestras, tAbsolutoUltimaMuestraMs });
        grupos.set(id, lista);
      }
      console.log(`  · scrollY=${scrollY}: ${muestrasPorId.size} elementos muestreados`);
    }

    // ── CALIBRACIÓN (b): pasos adaptativos dentro de cada tramo `revelado` de la pasada gruesa ──
    // Se clasifica PRELIMINARMENTE (con calibración (a) ya aplicada, § `paraClasificar`) para
    // encontrar qué tramos de la pasada gruesa produjeron un `revelado` — esos son los candidatos a
    // estar sub-resueltos (§ el comentario de cabecera de `gapsARefinar`).
    if (opciones.pasosAdaptativos > 0 && posicionesScroll.length >= 2) {
      const preliminares = new Map<string, ResultadoClasificacion>();
      for (const [id, gruposDelElemento] of grupos) {
        preliminares.set(id, clasificarElemento(paraClasificar(gruposDelElemento)));
      }
      const gaps = gapsARefinar(preliminares, posicionesScroll);
      if (gaps.size > 0) {
        const nuevasPosiciones: number[] = [];
        for (const g of [...gaps].sort((a, b) => a - b)) {
          const desde = posicionesScroll[g];
          const hasta = posicionesScroll[g + 1];
          const insertadas = posicionesIntermedias(desde, hasta, opciones.pasosAdaptativos);
          tramosRefinados.push({ desde, hasta, posicionesInsertadas: insertadas });
          nuevasPosiciones.push(...insertadas);
        }
        console.log(
          `▸ Calibración adaptativa: ${gaps.size} tramo(s) marcado(s) por un \`revelado\` preliminar → ` +
            `${nuevasPosiciones.length} posición(es) extra: ${nuevasPosiciones.join(", ") || "(ninguna, tramos <2px)"}`,
        );
        for (const scrollY of nuevasPosiciones) {
          const { muestrasPorId, tAbsolutoUltimaMuestraMs } = await muestrearPosicion(scrollY);
          for (const [id, muestras] of muestrasPorId) {
            const lista = grupos.get(id) ?? [];
            lista.push({ scrollY, muestras, tAbsolutoUltimaMuestraMs });
            grupos.set(id, lista);
          }
          console.log(`  · [adaptativo] scrollY=${scrollY}: ${muestrasPorId.size} elementos muestreados`);
        }
        // Fusionar: cada elemento queda con sus grupos gruesos + los finos, en ORDEN de scrollY — la
        // clasificación asume una secuencia ascendente (ventanas, índices de transición).
        for (const [, gruposDelElemento] of grupos) gruposDelElemento.sort((a, b) => a.scrollY - b.scrollY);
      } else {
        console.log("▸ Calibración adaptativa: ningún tramo marcado (0 `revelado` en la pasada gruesa).");
      }
    }

    await page.close();
  } finally {
    await browser.close();
  }

  // ─── Clasificar (con calibración (a) aplicada) sobre la traza YA fusionada, y descartar lo que da
  // lo mismo en todas las muestras (§ el spec) ────────────────────────────────────────────────────
  interface ElementoConMovimiento {
    id: string;
    descriptor: string;
    resultado: ResultadoClasificacion;
    grupos: GrupoScroll[];
    visibilidad: { visibles: number; total: number };
  }
  const conMovimiento: ElementoConMovimiento[] = [];
  for (const [id, gruposDelElemento] of grupos) {
    const resultado = clasificarElemento(paraClasificar(gruposDelElemento));
    const esSoloEstatico = resultado.clases.length === 1 && resultado.clases[0].clase === "estatico";
    if (esSoloEstatico) continue;
    conMovimiento.push({
      id,
      descriptor: descriptores.get(id) ?? `#${id}`,
      resultado,
      grupos: gruposDelElemento,
      visibilidad: resumenVisibilidad(gruposDelElemento),
    });
  }

  const duracionMs = Date.now() - inicio;
  console.log(
    `✔ ${conMovimiento.length} de ${elementosCandidatos} elementos candidatos muestran movimiento ` +
      `(${(duracionMs / 1000).toFixed(1)}s).`,
  );

  mkdirSync(SALIDA_DIR, { recursive: true });
  const generadoEn = new Date().toISOString();

  // ─── El .json — traza cruda, SÓLO de los elementos con movimiento (§ "sólo interesan los que
  // cambian" del spec: la traza de miles de elementos estáticos no aporta nada citable y sólo
  // infla el archivo). Se cuenta cuántos se descartaron, para que el reporte sea transparente
  // sobre el barrido sin cargar con su dato inerte.
  const traza = {
    url: opciones.url,
    nombre: opciones.nombre,
    generadoEn,
    viewport: { ancho: opciones.anchoPx, alto: opciones.altoPx },
    plan: {
      pasos: opciones.pasos,
      instantes: opciones.instantes,
      esperaInstanteMs: opciones.esperaInstanteMs,
      esperaScrollMs: opciones.esperaScrollMs,
      pasosAdaptativos: opciones.pasosAdaptativos,
    },
    // § ARNES-CENSO-MOVIMIENTO-CALIBRACION-1, calibración (b) — vacío si `pasosAdaptativos` era 0 o
    // si la pasada gruesa no produjo ningún `revelado` que marcar.
    calibracionAdaptativa: {
      tramosRefinados,
      posicionesExtraTotal: tramosRefinados.reduce((n, t) => n + t.posicionesInsertadas.length, 0),
    },
    elementosCandidatosTotal: elementosCandidatos,
    elementosConMovimiento: conMovimiento.length,
    elementosDescartadosPorEstaticos: elementosCandidatos - conMovimiento.length,
    duracionCorridaMs: duracionMs,
    elementos: conMovimiento.map((e) => ({
      descriptor: e.descriptor,
      clases: e.resultado.clases,
      // § calibración (a) — cuántas de las posiciones de scroll (gruesas + adaptativas) tuvieron a
      // este elemento en el viewport en alguna de sus muestras. `visibles: 0` es el caso que la
      // calibración pide declarar: la clasificación por TIEMPO no se pudo verificar en vista.
      posicionesEnViewport: e.visibilidad,
      grupos: e.grupos,
    })),
  };
  const jsonPath = join(SALIDA_DIR, `${opciones.nombre}.json`);
  writeFileSync(jsonPath, JSON.stringify(traza, null, 2) + "\n");

  // ─── El .md — legible: una tabla de resumen + un detalle acotado (primer/mitad/último grupo) por
  // elemento, para no repetir la traza completa (que ya vive en el .json).
  const filasResumen = conMovimiento.map((e, i) => {
    const clasesTexto = e.resultado.clases
      .map((c) => {
        if (c.clase === "ticker") return `ticker (${c.velocidadAproxPorSegundo?.toFixed(1) ?? "?"} u/s)`;
        if (c.clase === "scrub") return `scrub (scrollY ${c.ventanaScrollY.desde}–${c.ventanaScrollY.hasta})`;
        if (c.clase === "revelado") {
          const dur = c.duracionMs !== null ? `, ${c.duracionMs}ms` : "";
          return `revelado (Δ≈${c.desplazamientoAprox?.toFixed(1) ?? "?"}, scrollY ${c.ventanaScrollY.desde}–${c.ventanaScrollY.hasta}${dur})`;
        }
        return c.clase;
      })
      .join(" + ");
    const visNota = e.visibilidad.visibles === 0 ? " ⚠" : "";
    return `| ${i} | \`${e.descriptor}\` | ${clasesTexto} | ${e.visibilidad.visibles}/${e.visibilidad.total}${visNota} |`;
  });

  const detalle = conMovimiento
    .map((e, i) => {
      const idxs = [0, Math.floor(e.grupos.length / 2), e.grupos.length - 1];
      const idxsUnicos = [...new Set(idxs)];
      const muestras = idxsUnicos
        .map((idx) => {
          const g = e.grupos[idx];
          const primera = g.muestras[0];
          const ultima = g.muestras[g.muestras.length - 1];
          const tiempoTexto =
            g.muestras.length > 1
              ? `t=${primera.t}→${ultima.t}: opacity ${primera.opacity.toFixed(3)}→${ultima.opacity.toFixed(3)}, transform ${primera.transform} → ${ultima.transform}`
              : `t=${primera.t}: opacity ${primera.opacity.toFixed(3)}, transform ${primera.transform}`;
          return `  - scrollY=${g.scrollY}: ${tiempoTexto}`;
        })
        .join("\n");
      const visNota =
        e.visibilidad.visibles === 0
          ? "\n- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL."
          : "";
      return `### [${i}] \`${e.descriptor}\`\n- clases: ${e.resultado.clases.map((c) => c.clase).join(", ")}\n- en viewport durante el muestreo: ${e.visibilidad.visibles}/${e.visibilidad.total} posiciones${visNota}\n- muestras (resumen — primer/mitad/último grupo de scroll):\n${muestras}`;
    })
    .join("\n\n");

  const tramosTexto = tramosRefinados
    .map(
      (t) =>
        `- scrollY ${t.desde}–${t.hasta} → +${t.posicionesInsertadas.length} posición(es): ${t.posicionesInsertadas.join(", ") || "(ninguna, tramo <2px)"}`,
    )
    .join("\n");
  const seccionAdaptativa =
    opciones.pasosAdaptativos <= 0
      ? "Desactivada (\`--pasos-adaptativos 0\`)."
      : tramosRefinados.length > 0
        ? `${tramosRefinados.length} tramo(s) de la pasada gruesa marcado(s) por un \`revelado\` preliminar, ` +
          `refinados con ${opciones.pasosAdaptativos} sub-paso(s) cada uno:\n\n${tramosTexto}`
        : "Ningún tramo marcado — la pasada gruesa no produjo ningún \`revelado\` (todo lo que cambia lo hace ya \`ticker\`/\`scrub\`, o no cambia).";

  const md = `# Censo de movimiento — ${opciones.nombre}

- URL: ${opciones.url}
- Generado: ${generadoEn}
- Viewport: ${opciones.anchoPx}×${opciones.altoPx}
- Plan: ${opciones.pasos} posición(es) de scroll × ${opciones.instantes} instante(s) de tiempo (cada ${opciones.esperaInstanteMs}ms)
- Elementos candidatos (todo el \`<body>\`): ${elementosCandidatos}
- Elementos con movimiento detectado: ${conMovimiento.length} (${elementosCandidatos - conMovimiento.length} descartados por estáticos en todas las muestras)
- Duración de esta corrida: ${(duracionMs / 1000).toFixed(1)}s

**LÍMITE DECLARADO: \`hover\` queda fuera de alcance** — este arnés no simula el puntero, así que un
elemento cuyo único movimiento depende de \`:hover\`/\`:focus\` se clasifica \`estatico\` acá. Ver
\`docs/movimiento/README.md\`.

## Calibración adaptativa (§ ARNES-CENSO-MOVIMIENTO-CALIBRACION-1)

${seccionAdaptativa}

La columna "en viewport" de la tabla de abajo es \`visibles/total\` posiciones de scroll (gruesas +
adaptativas) donde el elemento intersectó el viewport en alguna muestra — \`0/N\` (marcado con ⚠)
significa que el eje de TIEMPO nunca se pudo observar en vista para ese elemento (calibración (a)).

## Elementos con movimiento

| # | selector | clases | en viewport |
| --- | --- | --- | --- |
${filasResumen.join("\n") || "| — | (ninguno) | — | — |"}

## Detalle por elemento

${detalle || "(sin elementos con movimiento)"}

La traza cruda completa (todos los grupos de scroll, todas las muestras de tiempo) vive en
\`${opciones.nombre}.json\`, al lado de este archivo.
`;
  const mdPath = join(SALIDA_DIR, `${opciones.nombre}.md`);
  writeFileSync(mdPath, md);

  console.log(`\n✔ Reporte en ${mdPath}\n✔ Traza cruda en ${jsonPath}`);
}

main().catch((e) => {
  console.error("❌ censar-movimiento falló:", e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
