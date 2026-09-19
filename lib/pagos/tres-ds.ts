// ── LA AUTENTICACIÓN 3DS PARA TARJETA — SIN FRICCIÓN (API-DIRECTA-3DS-SIN-CHALLENGE-1) Y CON
// DESAFÍO (API-DIRECTA-3DS-CON-CHALLENGE-1) ──────────────────────────────────────────────────
//
// 3DS existe para trasladar la responsabilidad por un contracargo fraudulento del negocio al
// emisor de la tarjeta, cuando la autenticación se completa. **SE PIDE SIEMPRE PARA TARJETA —
// NO HAY INTERRUPTOR** (§ el reporte de API-DIRECTA-3DS-SIN-CHALLENGE-1, §0): un toggle le
// pediría al dueño entender responsabilidad por fraude para elegir algo cuyo default es obvio,
// la misma familia de "no se le da un control que sólo puede usar mal" que ya rige la pasarela
// (no es toggle de panel) y el enum de método (no se parte).
//
// CUANDO EL EMISOR PIDE UN DESAFÍO, su pantalla —que no es nuestra y no controlamos— llega
// codificada dentro de la transacción YA CREADA y hay que decodificarla UNA vez, acá, en un
// lugar puro y testeado (`extraerContenidoDesafio3ds`), antes de que el componente cliente la
// embeba en un marco aislado (`components/storefront/checkout/DesafioTarjeta.tsx`). Ese marco
// dibuja la marca de la red PORQUE EL ESQUEMA LO EXIGE, no porque el producto lo elija — es una
// decisión de producto del owner, marcada como tal en el reporte de este slice.
//
// ESTE ARCHIVO TIENE DOS MITADES:
//   - PURA (`construirPayloadNavegador3ds`, `clasificarAutenticacion3ds`,
//     `extraerContenidoDesafio3ds`, `esperaSondeoSiguienteMs`): sin red, sin DOM — testeada en
//     `tres-ds.test.ts` (capa 1, sin base). `extraerContenidoDesafio3ds` corre en el SERVIDOR
//     (usa `Buffer`, global de Node — nunca invocada desde el componente cliente, que sólo
//     recibe el HTML YA decodificado) pero sigue siendo pura: sin red, sin I/O, determinista.
//   - CLIENTE (`recolectarDatosNavegador3ds`): lee `window`/`screen`/`navigator` — SÓLO se
//     invoca desde un componente `'use client'` (`FormularioTarjeta.tsx`). No se testea acá (el
//     repo no tiene jsdom, § CLAUDE.md — "El glob NO incluye *.test.tsx: los tests de
//     COMPONENTE necesitan jsdom, que el repo no tiene"); su forma la confirma el gate visual
//     del owner.
//
// LOS NOMBRES DE CAMPO DEL WIRE (`browser_color_depth`, `browser_java_enabled`,
// `browser_language`, `browser_screen_height`, `browser_screen_width`, `browser_tz`,
// `browser_user_agent`) Y LA FORMA DE LA RESPUESTA DEL PROVEEDOR
// (`payment_method.extra.three_ds_auth.{current_step,current_step_status,step_data}`) NO ESTÁN
// MEDIDOS CONTRA EL SANDBOX — ningún slice de este programa tuvo acceso a red, y el spike que sí
// corrió contra el sandbox real lo declaró explícitamente afuera de su alcance («Todo 3DS —
// explícitamente fuera del alcance de los dos spikes», `API-DIRECTA-SPIKE-SANDBOX-1`,
// DECISIONS.md). Son la convención pública del proveedor tal como la documenta, LEÍDA, no
// verificada — misma salvedad que ya llevan `consultarAceptaciones`/`crearTransaccion`
// (`lib/pagos/wompi-api.ts`) y `tokenizarTarjeta` (`services/checkout.service.ts`) para sus
// propios campos no medidos.
//
// **`step_data` EN PARTICULAR ES LA MENOS MEDIDA DE TODAS** — es DECISIÓN DE ESTE SLICE, no una
// convención confirmada en ningún lado: se asume un STRING plano, base64, con HTML del emisor
// (el "auto-post CReq" que el estándar EMV 3DS2 usa para el desafío embebido). Podría ser una
// forma distinta (un objeto anidado, una URL para navegar en vez de HTML para embeber). El gate
// visual del owner, contra el sandbox real, es lo ÚNICO que confirma o corrige esto — ver el
// reporte del slice, que lo marca como el riesgo más grande de esta entrega.

/** Lo que el proveedor pide del NAVEGADOR del comprador para evaluar el riesgo de la
 *  autenticación — NUNCA un dato de la tarjeta (ver la cabecera del archivo, y el reporte del
 *  slice §B: "ni un solo campo de la tarjeta viaja acá"). */
export interface DatosNavegador3ds {
  colorDepth: number;
  javaEnabled: boolean;
  language: string;
  screenHeight: number;
  screenWidth: number;
  /** Minutos de diferencia con UTC, con el SIGNO que ya usa `Date.prototype.getTimezoneOffset()`
   *  (positivo al OESTE de UTC) — la convención de JS, no la de ISO 8601. Bogotá (UTC-5) → 300. */
  timezoneOffsetMin: number;
  userAgent: string;
}

/**
 * Arma el sub-objeto que viaja en el body de `crearTransaccion` (`lib/pagos/wompi-api.ts`) para
 * pedir la autenticación 3DS — puro, sin red. Los NOMBRES DE CAMPO no están medidos (ver la
 * cabecera del archivo).
 */
export function construirPayloadNavegador3ds(datos: DatosNavegador3ds): Record<string, unknown> {
  return {
    browser_color_depth: String(datos.colorDepth),
    browser_java_enabled: datos.javaEnabled,
    browser_language: datos.language,
    browser_screen_height: datos.screenHeight,
    browser_screen_width: datos.screenWidth,
    browser_tz: datos.timezoneOffsetMin,
    browser_user_agent: datos.userAgent,
  };
}

/**
 * Lee el entorno del NAVEGADOR del comprador — SÓLO invocable desde el cliente (ver la
 * cabecera del archivo). No se testea en este slice por la misma razón que ningún `.tsx` de
 * este repo se testea: exige DOM, y el repo no tiene jsdom.
 */
export function recolectarDatosNavegador3ds(): DatosNavegador3ds {
  return {
    colorDepth: window.screen.colorDepth,
    javaEnabled: typeof navigator.javaEnabled === 'function' ? navigator.javaEnabled() : false,
    language: navigator.language,
    screenHeight: window.screen.height,
    screenWidth: window.screen.width,
    timezoneOffsetMin: new Date().getTimezoneOffset(),
    userAgent: navigator.userAgent,
  };
}

// ── LA CLASIFICACIÓN DEL RESULTADO — SIN FRICCIÓN vs DESAFÍO, pura ──────────────────────────

export type Resultado3ds = 'sin_friccion' | 'desafio' | 'desconocido';

/** La forma mínima que `clasificarAutenticacion3ds`/`extraerContenidoDesafio3ds` necesitan leer
 *  de la transacción YA CREADA (`TransaccionWompi`, `lib/pagos/wompi-api.ts`) — estructural, no
 *  importa ese tipo para evitar un ciclo de módulos (`wompi-api.ts` no depende de este archivo,
 *  y no está en `touches:` de este slice — ver la cabecera del archivo). `step_data` es
 *  OPCIONAL a propósito: `TransaccionWompi` no lo declara (no está en `touches:`), y como es
 *  optativo acá, un valor de ese tipo estructuralmente compatible se sigue pudiendo pasar sin
 *  que TypeScript exija el campo — en RUNTIME, si el proveedor lo trae, sigue presente en el
 *  objeto (nada lo recorta al pasar por `esTransaccionWompi`, que no valida `payment_method`). */
export interface TransaccionConAutenticacion3ds {
  payment_method?: {
    extra?: {
      three_ds_auth?: {
        current_step?: string;
        current_step_status?: string;
        /** El contenido del DESAFÍO, codificado — NO MEDIDO (§ la cabecera del archivo). */
        step_data?: string;
      };
    };
  };
}

/**
 * Clasifica la transacción YA CREADA (§ API-DIRECTA-CREACION-TRANSACCION-1,
 * `clasificarCreacionTransaccion` → `tipo: 'creada'`) según si el emisor autenticó SIN pedirle
 * nada al comprador, o si exige un DESAFÍO —fuera de alcance de este slice, ver la cabecera del
 * archivo—. `'desconocido'` cuando el proveedor no trae el sub-objeto de 3DS, o trae un
 * `current_step_status` que este slice no reconoce — NUNCA se inventa un veredicto sobre un
 * dato ausente o irreconocible (§ el reporte del slice, §C: "si el sondeo se agota sin estado
 * final, no inventes un veredicto" — el mismo principio aplica acá, un nivel antes).
 */
export function clasificarAutenticacion3ds(transaccion: TransaccionConAutenticacion3ds): Resultado3ds {
  const auth = transaccion.payment_method?.extra?.three_ds_auth;
  if (!auth) return 'desconocido';
  if (auth.current_step_status === 'PENDING') return 'desafio';
  if (auth.current_step_status === 'APPROVED') return 'sin_friccion';
  return 'desconocido';
}

// ── EL CONTENIDO DEL DESAFÍO — decodificado UNA vez, acá (§ API-DIRECTA-3DS-CON-CHALLENGE-1) ──

/**
 * Extrae y decodifica el contenido del DESAFÍO de la transacción YA CREADA — SIEMPRE `null` si
 * falta, si no es texto, o si lo decodificado no parece un documento HTML (no arranca con `<`
 * tras recortar espacios). **Nunca lanza**: un contenido inválido no puede romper la pantalla
 * (§ el reporte del slice, §2) — el llamador (`FormularioTarjeta.tsx` vía la ruta PATCH) trata
 * un `null` igual que la ausencia total del dato, y el componente cliente cae al texto honesto
 * de espera sin iframe (el comportamiento que ya existía antes de este slice).
 *
 * INDEPENDIENTE de `clasificarAutenticacion3ds`: se puede clasificar `'desafio'` (por
 * `current_step_status: 'PENDING'`) sin que `step_data` traiga nada decodificable — los dos
 * hechos (hay desafío / hay contenido para embeberlo) no están garantizados a viajar juntos.
 *
 * El decodificador de Node (`Buffer.from(x, 'base64')`) NUNCA lanza sobre una entrada
 * inválida —ignora en silencio los caracteres que no son base64—, así que el `try/catch` no
 * cubre el decode en sí: cubre exclusivamente contra un `step_data` cuyo TIPO en runtime no sea
 * el `string` que la interfaz declara (un objeto/array, si el proveedor cambia la forma sin que
 * el tipo estático de este archivo se entere).
 */
export function extraerContenidoDesafio3ds(transaccion: TransaccionConAutenticacion3ds): string | null {
  const stepData = transaccion.payment_method?.extra?.three_ds_auth?.step_data;
  if (typeof stepData !== 'string' || stepData.trim() === '') return null;

  let html: string;
  try {
    html = Buffer.from(stepData, 'base64').toString('utf-8');
  } catch {
    return null;
  }

  const recortado = html.trim();
  if (recortado === '' || !recortado.startsWith('<')) return null;
  return recortado;
}

// ── EL SONDEO CON ESPERA CRECIENTE — MISMA POLÍTICA QUE LA RUTA DE RETORNO ──────────────────
//
// (§ API-DIRECTA-3DS-SIN-CHALLENGE-1, §C del reporte del slice). `app/(storefront)/checkout/
// retorno/RetornoCliente.tsx` (WOMPI-RUTA-DE-RETORNO-1) YA tiene el sondeo con espera creciente
// para el MISMO caso —esperar a que el webhook cierre un `PaymentIntent` `EN_VUELO`—, pero ese
// archivo NO está en `touches:` de este slice, así que no se pudo EXTRAER a un módulo que los
// dos importen (habría exigido editar ese archivo para que también importara de acá). Lo que SÍ
// se hizo fue copiar la MISMA política —los MISMOS valores, el MISMO algoritmo
// (`BACKOFF_SEGUNDOS`/`esperaSiguienteMs` de `RetornoCliente.tsx`)— a un lugar canónico para el
// código NUEVO de este slice, para no escribir un segundo sondeo con otra política. Queda
// anotado como deviation/open_followup en el reporte: el archivo viejo sigue con su copia
// propia hasta que alguien lo migre a importar de acá.
export const BACKOFF_SONDEO_SEGUNDOS = [2, 4, 8, 16, 30];
export const TECHO_SONDEO_MS = 5 * 60 * 1000;

// EL TECHO DEL DESAFÍO ES SU PROPIO VALOR, MÁS ALTO QUE `TECHO_SONDEO_MS` (§ API-DIRECTA-3DS-
// CON-CHALLENGE-1, §2 del spec del slice: "con su techo propio, porque acá hay una persona
// interactuando y allá no"). El sin-fricción no tiene a nadie tecleando nada — 5 minutos ya son
// generosos para que el emisor resuelva solo. El desafío SÍ tiene a alguien completando un paso
// en la pantalla del banco (un OTP, esperar un SMS), y cortar la espera a los 5 minutos
// declararía "sigue sin resolver" sobre un comprador que todavía está a mitad del formulario.
// 15 MINUTOS ES PROVISIONAL/TODO(cliente) — no hay medición de cuánto tarda un desafío real
// contra el sandbox (§ la cabecera del archivo, "todo 3DS... explícitamente fuera del alcance
// de los dos spikes"). El ALGORITMO de backoff es el MISMO (arriba); sólo cambia cuándo se
// declara el techo.
export const TECHO_SONDEO_DESAFIO_MS = 15 * 60 * 1000;

export function esperaSondeoSiguienteMs(intento: number): number {
  const segundos = BACKOFF_SONDEO_SEGUNDOS[intento] ?? BACKOFF_SONDEO_SEGUNDOS[BACKOFF_SONDEO_SEGUNDOS.length - 1];
  return segundos * 1000;
}
