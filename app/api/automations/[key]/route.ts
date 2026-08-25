import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { AUTOMATION_MAP } from '@/constants/automations';
import { saveAutomationSetting, loadAutomationState } from '@/lib/automations/settings';
import { reporteSinDestinatario } from '@/lib/automations/destinatario-reporte';

// Guarda la decisión del owner sobre UNA automatización: encenderla/apagarla y/o
// cambiar su configuración. Un solo endpoint para ambas cosas — el toggle y el
// diálogo de "Configurar" son la misma escritura con distinto campo.
//
// La `key` se valida contra el REGISTRY antes de tocar la DB: una key inventada da
// 404, nunca crea una fila fantasma. La config la valida `saveAutomationSetting`
// contra el `configSchema` de la automatización, así que lo que entra a la columna
// ya es válido.

const patchSchema = z.object({
  activo: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { key } = await params;
  if (!AUTOMATION_MAP[key]) {
    return NextResponse.json({ error: 'Automatización desconocida' }, { status: 404 });
  }

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }); }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  if (parsed.data.activo === undefined && parsed.data.config === undefined) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  // Encender un reporte al equipo SIN destinatario efectivo lo dejaría prendido y luego
  // OMITIENDO en silencio en cada corrida (config vacía Y sin correo del negocio). Se
  // IMPIDE el estado inconsistente en la puerta, no se reporta después. La config a
  // evaluar es la EFECTIVA tras este PATCH: la existente sobreescrita por lo que llega.
  if (parsed.data.activo === true) {
    const actual = await loadAutomationState(key);
    const configEfectiva = { ...(actual?.config ?? {}), ...(parsed.data.config ?? {}) };
    if (await reporteSinDestinatario(key, configEfectiva)) {
      return NextResponse.json(
        {
          error:
            'Este reporte no tiene a quién enviarse. Agrega un destinatario en los ' +
            'Ajustes de la automatización, o define el correo del negocio en Configuración.',
        },
        { status: 400 },
      );
    }
  }

  const state = await saveAutomationSetting(key, parsed.data);
  if (!state) return NextResponse.json({ error: 'Automatización desconocida' }, { status: 404 });

  return NextResponse.json({ key, activo: state.activo, config: state.config });
}
