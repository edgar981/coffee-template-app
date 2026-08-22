import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { loadAutomationStates } from '@/lib/automations/settings';
import { waOperativo } from '@/lib/automations/whatsapp-operativo';

// Estado de TODAS las automatizaciones del registry + la evidencia de que están
// vivas (cuántas veces corrieron y las 3 más recientes). Lectura PURA: a diferencia
// del endpoint anterior, no hace upsert de filas al listar — una automatización sin
// fila corre con los defaults del registry, y así el catálogo puede crecer sin
// escribir en la DB por el simple hecho de abrir la página.

const RECIENTES = 3;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { states: todos, degradado } = await loadAutomationStates();
  // Si no se pudo leer la configuración, esto son defaults: NO mostrar toggles
  // apagados como si fueran la decisión del owner.
  if (degradado) {
    return NextResponse.json({ error: 'No se pudo leer la configuración' }, { status: 503 });
  }

  // Las automatizaciones de WhatsApp NO se renderizan hasta que el canal esté
  // operativo (§ waOperativo): su sender no puede enviar sin las credenciales de
  // Meta, así que mostrarlas vivas aparentaría un envío que no ocurre. Es la MISMA
  // condición que gatea el sender —una sola definición—, consumida acá para el
  // render. Sus handlers y su código NO se tocan; sólo se omiten de la respuesta.
  const states = waOperativo() ? todos : todos.filter(s => s.def.canal !== 'whatsapp');

  // Un groupBy para los totales y UNA consulta para las recientes — no N+1 por card.
  const [conteos, ultimos] = await Promise.all([
    prisma.automationRun.groupBy({ by: ['automationKey'], _count: { _all: true } }),
    prisma.automationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take:    RECIENTES * states.length,
      select:  { automationKey: true, estado: true, targetId: true, createdAt: true },
    }),
  ]);

  const totalPorKey = new Map(conteos.map(c => [c.automationKey, c._count._all]));
  const porKey = new Map<string, typeof ultimos>();
  for (const run of ultimos) {
    const lista = porKey.get(run.automationKey) ?? [];
    if (lista.length < RECIENTES) { lista.push(run); porKey.set(run.automationKey, lista); }
  }

  return NextResponse.json(
    states.map(({ def, activo, config }) => ({
      key:         def.key,
      activo,
      config,
      ejecuciones: totalPorKey.get(def.key) ?? 0,
      recientes:   porKey.get(def.key) ?? [],
    })),
  );
}
