import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runScheduledAutomations } from '@/lib/automations/engine';

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

/** Comparación en tiempo constante: una comparación normal filtra el secreto por
 *  temporización, un carácter a la vez. */
function secretoValido(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige longitudes iguales; comparar longitudes primero no filtra
  // nada útil (la longitud del secreto no es el secreto).
  return a.length === b.length && timingSafeEqual(a, b);
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
      { ok: false, degradado: true, error: 'No se pudo leer la configuración de automatizaciones' },
      { status: 503 },
    );
  }

  console.log(
    `[cron] ${report.horaBogota}:00 Bogotá · ejecutadas: ${report.ejecutadas.join(', ') || '(ninguna)'} · ` +
    `runs: ${JSON.stringify(porEstado)} · ${Date.now() - inicio}ms`,
  );

  return NextResponse.json({
    ok:              true,
    horaBogota:      report.horaBogota,
    ejecutadas:      report.ejecutadas,
    omitidasPorHora: report.omitidasPorHora,
    inactivas:       report.inactivas,
    runs:            report.runs,
    porEstado,
    duracionMs:      Date.now() - inicio,
  });
}
