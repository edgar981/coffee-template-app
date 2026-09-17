// ── LA AUTENTICACIÓN 3DS PARA TARJETA, CAMINO SIN FRICCIÓN (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) ──
//
// 3DS existe para trasladar la responsabilidad por un contracargo fraudulento del negocio al
// emisor de la tarjeta, cuando la autenticación se completa. **SE PIDE SIEMPRE PARA TARJETA —
// NO HAY INTERRUPTOR** (§ el reporte del slice, §0): un toggle le pediría al dueño entender
// responsabilidad por fraude para elegir algo cuyo default es obvio, la misma familia de "no se
// le da un control que sólo puede usar mal" que ya rige la pasarela (no es toggle de panel) y el
// enum de método (no se parte). Este archivo cubre SÓLO el camino SIN FRICCIÓN —el emisor
// autentica sin pedirle nada al comprador—; el camino CON DESAFÍO es su propio slice, por
// instrucción explícita del owner (§ el reporte).
//
// ESTE ARCHIVO TIENE DOS MITADES:
//   - PURA (`construirPayloadNavegador3ds`, `clasificarAutenticacion3ds`,
//     `esperaSondeoSiguienteMs`): sin red, sin DOM — testeada en `tres-ds.test.ts` (capa 1, sin
//     base).
//   - CLIENTE (`recolectarDatosNavegador3ds`): lee `window`/`screen`/`navigator` — SÓLO se
//     invoca desde un componente `'use client'` (`FormularioTarjeta.tsx`). No se testea acá (el
//     repo no tiene jsdom, § CLAUDE.md — "El glob NO incluye *.test.tsx: los tests de
//     COMPONENTE necesitan jsdom, que el repo no tiene"); su forma la confirma el gate visual
//     del owner.
//
// LOS NOMBRES DE CAMPO DEL WIRE (`browser_color_depth`, `browser_java_enabled`,
// `browser_language`, `browser_screen_height`, `browser_screen_width`, `browser_tz`,
// `browser_user_agent`) Y LA FORMA DE LA RESPUESTA DEL PROVEEDOR
// (`payment_method.extra.three_ds_auth.{current_step,current_step_status}`) NO ESTÁN MEDIDOS
// CONTRA EL SANDBOX — este slice no tiene acceso a red, y el spike que sí corrió contra el
// sandbox real lo declaró explícitamente afuera de su alcance («Todo 3DS — explícitamente fuera
// del alcance de los dos spikes», `API-DIRECTA-SPIKE-SANDBOX-1`, DECISIONS.md). Son la
// convención pública del proveedor tal como la documenta, LEÍDA, no verificada — misma
// salvedad que ya llevan `consultarAceptaciones`/`crearTransaccion` (`lib/pagos/wompi-api.ts`)
// y `tokenizarTarjeta` (`services/checkout.service.ts`) para sus propios campos no medidos. El
// gate visual del owner, contra el sandbox real, es lo que confirma o corrige esto.

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

/** La forma mínima que `clasificarAutenticacion3ds` necesita leer de la transacción YA CREADA
 *  (`TransaccionWompi`, `lib/pagos/wompi-api.ts`) — estructural, no importa ese tipo para evitar
 *  un ciclo de módulos (`wompi-api.ts` no depende de este archivo). */
export interface TransaccionConAutenticacion3ds {
  payment_method?: {
    extra?: {
      three_ds_auth?: {
        current_step?: string;
        current_step_status?: string;
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

export function esperaSondeoSiguienteMs(intento: number): number {
  const segundos = BACKOFF_SONDEO_SEGUNDOS[intento] ?? BACKOFF_SONDEO_SEGUNDOS[BACKOFF_SONDEO_SEGUNDOS.length - 1];
  return segundos * 1000;
}
