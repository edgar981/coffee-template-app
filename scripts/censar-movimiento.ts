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
  if (pasos < 1) throw new Error("--pasos debe ser ≥ 1.");
  if (instantes < 1) throw new Error("--instantes debe ser ≥ 1.");

  return {
    url: values.url,
    nombre: values.nombre ?? slugDeUrl(values.url),
    pasos,
    instantes,
    esperaInstanteMs: values["espera-instante-ms"] ? Number(values["espera-instante-ms"]) : 400,
    esperaScrollMs: values["espera-scroll-ms"] ? Number(values["espera-scroll-ms"]) : 300,
    anchoPx: values.ancho ? Number(values.ancho) : 1280,
    altoPx: values.alto ? Number(values.alto) : 900,
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

    for (const scrollY of posicionesScroll) {
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

      for (const [id, muestras] of muestrasPorId) {
        const lista = grupos.get(id) ?? [];
        lista.push({ scrollY, muestras, tAbsolutoUltimaMuestraMs });
        grupos.set(id, lista);
      }
      console.log(`  · scrollY=${scrollY}: ${muestrasPorId.size} elementos muestreados`);
    }

    await page.close();
  } finally {
    await browser.close();
  }

  // ─── Clasificar, y descartar lo que da lo mismo en todas las muestras (§ el spec) ─────────────
  interface ElementoConMovimiento {
    id: string;
    descriptor: string;
    resultado: ResultadoClasificacion;
    grupos: GrupoScroll[];
  }
  const conMovimiento: ElementoConMovimiento[] = [];
  for (const [id, gruposDelElemento] of grupos) {
    const resultado = clasificarElemento(gruposDelElemento);
    const esSoloEstatico = resultado.clases.length === 1 && resultado.clases[0].clase === "estatico";
    if (esSoloEstatico) continue;
    conMovimiento.push({ id, descriptor: descriptores.get(id) ?? `#${id}`, resultado, grupos: gruposDelElemento });
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
    },
    elementosCandidatosTotal: elementosCandidatos,
    elementosConMovimiento: conMovimiento.length,
    elementosDescartadosPorEstaticos: elementosCandidatos - conMovimiento.length,
    duracionCorridaMs: duracionMs,
    elementos: conMovimiento.map((e) => ({
      descriptor: e.descriptor,
      clases: e.resultado.clases,
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
          return `revelado (Δ≈${c.desplazamientoAprox?.toFixed(1) ?? "?"}${dur})`;
        }
        return c.clase;
      })
      .join(" + ");
    return `| ${i} | \`${e.descriptor}\` | ${clasesTexto} |`;
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
      return `### [${i}] \`${e.descriptor}\`\n- clases: ${e.resultado.clases.map((c) => c.clase).join(", ")}\n- muestras (resumen — primer/mitad/último grupo de scroll):\n${muestras}`;
    })
    .join("\n\n");

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

## Elementos con movimiento

| # | selector | clases |
| --- | --- | --- |
${filasResumen.join("\n") || "| — | (ninguno) | — |"}

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
