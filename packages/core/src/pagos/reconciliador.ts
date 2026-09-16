import {
  aplicarResultadoWompi,
  bucketDeStatus,
  type AplicarResultadoDb,
  type NotificacionAtencion,
} from './aplicar-resultado-wompi';

// ── (h)+(i) EL RECONCILIADOR — una sola función, por la EDAD del intento ────
//
// (WOMPI-RECONCILIADOR-HI-1). El censo lo midió y coincide con el owner: «no
// son dos esperas, es una» — la decisión es SIEMPRE por la edad del intento
// `EN_VUELO`: joven → se consulta a Wompi y se espera; vencido → Wompi ya
// desistió (reintentos hasta 24 h, WOMPI-REGLAS-IMPLEMENTACION-1) y nuestra
// ventana de holgura también se agotó, así que se cierra.
//
// POR QUÉ (i) SOLA SERÍA PELIGROSA — la razón de que estén FUSIONADAS: cerrar
// un intento vencido por el simple paso del tiempo, SIN consultar antes a
// Wompi, marcaría FALLIDO un intento que Wompi SÍ aprobó pero cuyo webhook se
// perdió (una entrega que nunca llegó, un secreto rotado a medias, una caída
// de red del lado de Wompi). Eso es plata real dada por perdida. Por eso
// `reconciliarIntentoPago` SIEMPRE consulta primero, para TODO intento
// `EN_VUELO` que mira — joven o vencido —, y sólo cierra por edad cuando esa
// MISMA consulta no trajo un terminal. Nunca hay un camino que cierre
// `FALLIDO` sin haber preguntado.
//
// LA REGLA DEL ARRAY VACÍO (medida, WOMPI-REGLAS-IMPLEMENTACION-1): un `200
// {"data":[]}` de Wompi NUNCA significa "no pagada" — significa "la
// transacción no existe todavía" (o, acá, "sigue sin resolverse"). Es
// indistinguible por status HTTP de "existe pero no resolvió", así que las
// dos se tratan IGUAL: sin terminal, se decide por edad.
//
// EL CLIENTE HTTP (`lib/pagos/wompi-api.ts`) SE RECIBE INYECTADO
// (`consultarWompi`), nunca se importa: `packages/core` no importa de `lib/`
// (medido antes de este slice: cero imports runtime de `@/` fuera de `import
// type` en todo `packages/core/src` — sólo `@/types/*`, nunca `@/lib/*`).
// Mismo criterio que `PaymentIntentDb.notificarAtencion` en `route.ts`: la
// pieza que habla con el mundo exterior la ensambla quien invoca, no el
// núcleo. `hrefOrden` se inyecta por la misma razón (vive en `constants/
// automations.ts`, nivel app).

/** El `PaymentIntent` `EN_VUELO`, en lo mínimo que este barrido necesita. */
export interface PaymentIntentEnVueloRow {
  id: string;
  orden_id: string;
  reference: string;
  monto_esperado: number;
  createdAt: Date;
}

/** Una transacción de Wompi, en lo mínimo que `bucketDeStatus` y
 *  `aplicarResultadoWompi` necesitan leer. */
export interface TransaccionWompiTerminal {
  id: string;
  status: string;
  amount_in_cents: number;
}

/**
 * La interfaz que este módulo necesita de su llamador. Extiende
 * `AplicarResultadoDb` (la comparte con el camino APROBADO, sin redeclararla:
 * `transaccionConOrdenLockeada`) y agrega lo propio del barrido: cerrar
 * FALLIDO por veredicto de Wompi (mismo criterio que (g) — sin lock, no hay
 * decisión de dinero que proteger), encontrar lo `EN_VUELO` y cerrar lo
 * vencido.
 */
export interface ReconciliadorDb extends AplicarResultadoDb {
  paymentIntent: {
    updateMany(args: {
      where: { id: string; estado: 'EN_VUELO' };
      data: { pspTransactionId: string; estado: 'FALLIDO'; estado_crudo_psp: string };
    }): Promise<{ count: number }>;
  };
  paymentIntentsEnVuelo(limite: number): Promise<PaymentIntentEnVueloRow[]>;
  /**
   * Cierra un intento VENCIDO —sin resolución de Wompi—, SIN
   * `pspTransactionId` ni `estado_crudo_psp`: nunca hubo evidencia positiva,
   * y esa ausencia SIGNIFICA algo (mismo criterio que el comentario de
   * `estado_crudo_psp` en `schema.prisma`) — no se rellena con un centinela.
   * Transición condicional, como el resto: `count===0` si otra entrega ya lo
   * cerró entre la lectura y esta escritura.
   */
  cerrarVencido(id: string): Promise<{ count: number }>;
  notificarAtencion(input: NotificacionAtencion): Promise<void>;
}

export type AccionReconciliador = 'aprobado' | 'fallido_wompi' | 'vencido' | 'en_vuelo' | 'error';

export interface ResultadoReconciliarIntento {
  accion: AccionReconciliador;
  motivo: string;
}

export interface ReconciliadorReporte {
  /** Cuántos `PaymentIntent` `EN_VUELO` trajo el barrido (antes de procesar). */
  consultados: number;
  aprobados: number;
  fallidosPorWompi: number;
  vencidos: number;
  dejadosEnVuelo: number;
  errores: number;
}

// UMBRAL: 24 h es el piso duro de reintentos de Wompi (WOMPI-REGLAS-
// IMPLEMENTACION-1) + una ventana ENTERA de holgura propia = 48 h. NO
// CAMBIAR sin una nueva medición — está decidido, no es un placeholder.
export const UMBRAL_VENCIDO_MS = 48 * 60 * 60 * 1000;

// CAP DEL BARRIDO — deliberadamente DISTINTO del `TOPE_POR_BARRIDO = 50` de
// las automatizaciones programadas (`lib/automations/handlers/
// programadas.ts`): aquel es sólo lectura/escritura de base (rápido y
// acotado); ÉSTE hace una llamada HTTP a Wompi POR FILA, con su propio
// timeout (`TIMEOUT_MS` en `lib/pagos/wompi-api.ts`). No hay `maxDuration`
// explícito en la función serverless (medido, CLAUDE.md § El disparo), así
// que el peor caso (TODAS las consultas agotando su timeout) tiene que
// quedar cómodo bajo el default de 300 s de Vercel Functions, dejando
// margen para `runScheduledAutomations` (que corre en el MISMO POST) y para
// las escrituras de cada fila. Con el timeout de 6 s de `wompi-api.ts`:
// 20 × 6 s = 120 s en el peor caso — bajo la mitad del presupuesto.
export const TOPE_POR_BARRIDO = 20;

/**
 * De TODAS las transacciones que Wompi trae para una referencia, un
 * APROBADO manda sobre cualquier FALLIDO: si alguno de los intentos del
 * comprador terminó acreditado, eso es lo que importa, sin importar cuántos
 * fallaron antes. A falta de un APROBADO, se toma el primer FALLIDO.
 * Ninguna terminal (array vacío, o todas `PENDING`) ⇒ `null`.
 */
function elegirTerminal(transacciones: TransaccionWompiTerminal[]): TransaccionWompiTerminal | null {
  let fallido: TransaccionWompiTerminal | null = null;
  for (const t of transacciones) {
    const bucket = bucketDeStatus(t.status);
    if (bucket === 'APROBADO') return t;
    if (bucket === 'FALLIDO' && !fallido) fallido = t;
  }
  return fallido;
}

/**
 * La decisión, por EDAD, de UN `PaymentIntent` `EN_VUELO` — SIEMPRE consulta
 * a Wompi primero (ver la cabecera del archivo, § por qué (i) sola sería
 * peligrosa).
 */
export async function reconciliarIntentoPago(
  fila: PaymentIntentEnVueloRow,
  now: Date,
  consultarWompi: (reference: string) => Promise<TransaccionWompiTerminal[]>,
  hrefOrden: (numeroOrden: string) => string,
  db: ReconciliadorDb,
): Promise<ResultadoReconciliarIntento> {
  let transacciones: TransaccionWompiTerminal[];
  try {
    transacciones = await consultarWompi(fila.reference);
  } catch (e) {
    // Un error de red o de la API NUNCA cierra el intento —ni siquiera si ya
    // venció por edad—: cerrar sin haber logrado preguntarle a Wompi es
    // exactamente el riesgo que la cabecera del archivo describe. Se
    // reintenta el próximo tick.
    console.error(`[wompi-reconciliador] fallo consultando Wompi por ${fila.reference}:`, e);
    return { accion: 'error', motivo: 'fallo de consulta a Wompi' };
  }

  const terminal = elegirTerminal(transacciones);

  if (terminal) {
    // `elegirTerminal` sólo devuelve transacciones cuyo status ya pasó por
    // `bucketDeStatus`, así que esto nunca es `null` acá — el `if` es sólo
    // para que TS lo sepa sin duplicar la lógica de `bucketDeStatus`.
    const bucket = bucketDeStatus(terminal.status);
    if (bucket) {
      const montoConfirmado = terminal.amount_in_cents / 100;
      if (montoConfirmado !== fila.monto_esperado) {
        // Mismo registro que hacía el webhook (g) para TODO evento terminal
        // con monto discrepante, no sólo el que termina pagando.
        console.error(
          `[wompi-reconciliador] discrepancia de monto en ${fila.reference}: esperado` +
            ` ${fila.monto_esperado}, Wompi confirma ${montoConfirmado}`,
        );
      }

      if (bucket === 'FALLIDO') {
        // FALLIDO no toca la Order — mismo criterio que (g): no hay lock que
        // tomar porque no hay decisión de dinero que proteger.
        const { count } = await db.paymentIntent.updateMany({
          where: { id: fila.id, estado: 'EN_VUELO' },
          data: { pspTransactionId: terminal.id, estado: 'FALLIDO', estado_crudo_psp: terminal.status },
        });
        if (count === 0) {
          return { accion: 'en_vuelo', motivo: 'cerrado por otra entrega concurrente' };
        }
        return { accion: 'fallido_wompi', motivo: 'cerrado fallido (Wompi)' };
      }

      // bucket === 'APROBADO' — la lógica de dinero, compartida con (g).
      const resultado = await aplicarResultadoWompi(
        { id: fila.id, orden_id: fila.orden_id, monto_esperado: fila.monto_esperado },
        terminal.id,
        terminal.status,
        montoConfirmado,
        hrefOrden,
        db,
      );
      if (resultado.notificar) {
        try {
          await db.notificarAtencion(resultado.notificar);
        } catch (e) {
          // Guardado: una notificación que falla no puede volver a intentar
          // la transacción de dinero, que ya comiteó.
          console.error(`[wompi-reconciliador] no se pudo notificar al carril de atención:`, e);
        }
      }
      return { accion: 'aprobado', motivo: resultado.motivo };
    }
  }

  // Sin terminal: array vacío, o todo `PENDING`. Se distingue por EDAD —la
  // consulta de arriba YA CORRIÓ, así que cerrar por edad acá es seguro.
  const edadMs = now.getTime() - fila.createdAt.getTime();
  if (edadMs < UMBRAL_VENCIDO_MS) {
    return { accion: 'en_vuelo', motivo: 'joven, sigue en vuelo' };
  }

  const { count } = await db.cerrarVencido(fila.id);
  if (count === 0) {
    return { accion: 'en_vuelo', motivo: 'cerrado por otra entrega concurrente' };
  }
  return { accion: 'vencido', motivo: 'vencido sin resolver — cerrado FALLIDO' };
}

/**
 * El BARRIDO — un paso del cron, no una automatización de mensaje (el motor
 * de automatizaciones es MENSAJE-céntrico; reconciliar no encaja en ese
 * loop). Recorre lo `EN_VUELO`, capado por `TOPE_POR_BARRIDO`. SECUENCIAL, no
 * en paralelo: acota la carga sobre la API de Wompi y sobre la base a la vez
 * — el orden entre filas es irrelevante (el cierre es idempotente por
 * transición de estado, no por marca de tiempo).
 */
export async function correrReconciliador(
  now: Date,
  consultarWompi: (reference: string) => Promise<TransaccionWompiTerminal[]>,
  hrefOrden: (numeroOrden: string) => string,
  db: ReconciliadorDb,
): Promise<ReconciliadorReporte> {
  const filas = await db.paymentIntentsEnVuelo(TOPE_POR_BARRIDO);
  const reporte: ReconciliadorReporte = {
    consultados: filas.length,
    aprobados: 0,
    fallidosPorWompi: 0,
    vencidos: 0,
    dejadosEnVuelo: 0,
    errores: 0,
  };

  for (const fila of filas) {
    const resultado = await reconciliarIntentoPago(fila, now, consultarWompi, hrefOrden, db);
    switch (resultado.accion) {
      case 'aprobado':      reporte.aprobados++; break;
      case 'fallido_wompi':  reporte.fallidosPorWompi++; break;
      case 'vencido':        reporte.vencidos++; break;
      case 'en_vuelo':       reporte.dejadosEnVuelo++; break;
      case 'error':          reporte.errores++; break;
    }
  }

  return reporte;
}
