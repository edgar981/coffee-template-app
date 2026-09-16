import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runScheduledAutomations } from '@/lib/automations/engine';
import prisma from '@duna/core';
import { lockOrderForPayment, registerOrderPaymentTx } from '@duna/core/orders';
import { createNotification } from '@duna/core/notifications';
import { correrReconciliador, type ReconciliadorDb } from '@duna/core/pagos/reconciliador';
import { consultarTransaccionesPorReferencia } from '@/lib/pagos/wompi-api';
import { hrefOrden } from '@/constants/automations';
import { esDespliegueDemo } from '@/next.config';

// EL disparador de las automatizaciones programadas. Lo invoca un workflow de
// GitHub Actions cada hora en punto (.github/workflows/automations-cron.yml); NO
// los cron de Vercel, porque el plan Hobby sólo los corre una vez al día. Ver
// CLAUDE.md.
//
// El motor decide qué toca según la hora de Bogotá y la idempotencia, así que un
// disparo de más no hace daño y uno de menos se recupera en el siguiente. Por eso
// basta un único job horario en vez de uno por automatización.
//
// AUTENTICACIÓN: `Authorization: Bearer ${CRON_SECRET}`. Es un endpoint público
// (no hay sesión de admin en un cron) que escribe en la DB y despacha mensajes —
// sin el secreto, cualquiera podría forzar barridos. POST y no GET: no es una
// lectura, y Next nunca cachea POST.
//
// EL RECONCILIADOR DE WOMPI (h)+(i) (WOMPI-RECONCILIADOR-HI-1) es un PASO
// PROPIO de este mismo POST, junto a `runScheduledAutomations`, NUNCA dentro
// de él: el motor de automatizaciones es MENSAJE-céntrico (un `Objetivo` es
// «despachar o omitir un aviso»), y reconciliar —consultar una API externa y
// crear un `Payment` bajo lock— no encaja en ese loop. Se activa SÓLO si
// `WOMPI_PRIVATE_KEY` está configurada — un despliegue sin Wompi sigue
// corriendo exactamente como antes, sin ruido. El host de la API
// (`sandbox.wompi.co` vs `production.wompi.co`) se deriva de
// `esDespliegueDemo()` — la MISMA fuente única que ya gobierna si el
// despliegue puede arrancar con la llave pública productiva
// (`instrumentation.ts`, `PASARELA-LLAVES-COHERENTES-1`) — en vez de una
// segunda env var que podría desincronizarse de esa decisión.
//
// Un fallo del reconciliador (Wompi caído, un error inesperado) NO tumba el
// resto del cron: se loguea y el resto de las automatizaciones programadas
// corre igual — el mismo principio de aislamiento que ya rige el motor de
// automatizaciones (una automatización rota no puede tumbar una venta).

/** Comparación en tiempo constante: una comparación normal filtra el secreto por
 *  temporización, un carácter a la vez. */
function secretoValido(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige longitudes iguales; comparar longitudes primero no filtra
  // nada útil (la longitud del secreto no es el secreto).
  return a.length === b.length && timingSafeEqual(a, b);
}

/** El adaptador sobre el `prisma` real que satisface `ReconciliadorDb` — mismo
 *  criterio que `dbReal` en `app/api/webhooks/wompi/route.ts` (`lockOrderForPayment`/
 *  `registerOrderPaymentTx` de `@duna/core/orders`, `createNotification` de
 *  `@duna/core/notifications`), extendido con lo propio del barrido. */
const reconciliadorDb: ReconciliadorDb = {
  paymentIntent: {
    updateMany: (args) => prisma.paymentIntent.updateMany(args),
  },
  transaccionConOrdenLockeada: (ordenId, fn) =>
    prisma.$transaction(async (tx) => {
      const orden = await lockOrderForPayment(tx, ordenId);
      return fn(orden, {
        paymentIntent: { updateMany: (args) => tx.paymentIntent.updateMany(args) },
        registrarPago: async ({ monto, referencia }) => {
          await registerOrderPaymentTx(tx, ordenId, { monto, metodo: 'WOMPI', referencia });
        },
      });
    }),
  paymentIntentsEnVuelo: (limite) =>
    prisma.paymentIntent.findMany({
      where:   { estado: 'EN_VUELO' },
      select:  { id: true, orden_id: true, reference: true, monto_esperado: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take:    limite,
    }),
  cerrarVencido: async (id) => {
    // Sin `pspTransactionId` ni `estado_crudo_psp`: nunca hubo evidencia
    // positiva de Wompi — ver el comentario de `cerrarVencido` en
    // `packages/core/src/pagos/reconciliador.ts`.
    const { count } = await prisma.paymentIntent.updateMany({
      where: { id, estado: 'EN_VUELO' },
      data:  { estado: 'FALLIDO' },
    });
    return { count };
  },
  notificarAtencion: (input) => createNotification(input),
};

/** Corre el barrido del reconciliador si `WOMPI_PRIVATE_KEY` está configurada
 *  — un despliegue sin Wompi lo omite sin ruido. Un fallo del barrido
 *  (Wompi caído, un error inesperado) se loguea y se devuelve como `error`,
 *  NUNCA se propaga: no debe tumbar el resto del cron. */
async function correrPasoReconciliador(): Promise<
  | { omitido: true }
  | { omitido: false; error: string }
  | ({ omitido: false } & Awaited<ReturnType<typeof correrReconciliador>>)
> {
  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  if (!privateKey) {
    return { omitido: true };
  }
  const baseUrl = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';
  try {
    const reporte = await correrReconciliador(
      new Date(),
      (reference) => consultarTransaccionesPorReferencia(reference, privateKey, baseUrl),
      hrefOrden,
      reconciliadorDb,
    );
    return { omitido: false, ...reporte };
  } catch (e) {
    console.error('[cron] el reconciliador de Wompi falló:', e);
    return { omitido: false, error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  const esperado = process.env.CRON_SECRET;
  // Sin secreto configurado el endpoint queda CERRADO, no abierto. Un despliegue al
  // que se le olvidó la env var debe fallar ruidosamente, no quedar expuesto.
  if (!esperado) {
    console.error('[cron] CRON_SECRET no está configurado — endpoint deshabilitado');
    return NextResponse.json({ error: 'Cron no configurado' }, { status: 503 });
  }

  const header = req.headers.get('authorization') ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !secretoValido(token, esperado)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const inicio = Date.now();
  const report = await runScheduledAutomations(new Date());

  // El reconciliador corre INDEPENDIENTE de las automatizaciones programadas
  // (ver la cabecera del archivo) — incluido el caso `degradado` de abajo: un
  // problema con la config de automatizaciones no debe bloquear la
  // reconciliación de pagos, que es plata, no un mensaje.
  const reconciliador = await correrPasoReconciliador();

  // Resumen por estado — lo que queda en el log de Actions y permite ver de un
  // vistazo si un barrido está fallando sin abrir el panel.
  const porEstado = report.runs.reduce<Record<string, number>>((acc, r) => {
    acc[r.estado] = (acc[r.estado] ?? 0) + 1;
    return acc;
  }, {});

  // Degradado = no se pudo leer la configuración, así que "cero runs" NO significa
  // "no había trabajo". Se responde 503 para que el job de Actions FALLE y quede
  // visible: un barrido silenciosamente inerte es peor que uno que grita.
  if (report.degradado) {
    console.error('[cron] configuración ilegible — barrido abortado sin disparar nada');
    return NextResponse.json(
      {
        ok: false, degradado: true, error: 'No se pudo leer la configuración de automatizaciones',
        reconciliador,
      },
      { status: 503 },
    );
  }

  console.log(
    `[cron] ${report.horaBogota}:00 Bogotá · ejecutadas: ${report.ejecutadas.join(', ') || '(ninguna)'} · ` +
    `runs: ${JSON.stringify(porEstado)} · reconciliador: ${JSON.stringify(reconciliador)} · ` +
    `${Date.now() - inicio}ms`,
  );

  return NextResponse.json({
    ok:              true,
    horaBogota:      report.horaBogota,
    ejecutadas:      report.ejecutadas,
    omitidasPorHora: report.omitidasPorHora,
    inactivas:       report.inactivas,
    runs:            report.runs,
    porEstado,
    reconciliador,
    duracionMs:      Date.now() - inicio,
  });
}
