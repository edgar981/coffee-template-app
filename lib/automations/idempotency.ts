import prisma from '@/lib/prisma';
import { BUSINESS_TZ, zonedDayKey, isoWeekKey } from '@/lib/timezone';
import type { AutomationDef } from '@/constants/automations';
import type { AutomationRunEstado } from '@/src/generated/prisma/client';

// LA garantía de "exactamente una vez" de las automatizaciones. Dos mecanismos,
// según la estrategia declarada en el registry (`idempotencia`):
//
//   una_vez / diaria / semanal → el UNIQUE de AutomationRun
//     (automationKey, targetId, periodo). El gate es el INSERT: si choca (P2002),
//     alguien ya lo hizo. Es atómico — dos crons simultáneos no pueden ambos ganar,
//     que es exactamente lo que un `findFirst` + `create` no garantiza.
//
//   cooldown → una CONSULTA de la última corrida dentro de la ventana configurada.
//     El unique no sabe expresar "hace menos de N horas", así que aquí `periodo` es
//     el instante (siempre único) y el gate es la consulta. Ver el comentario del
//     modelo en prisma/schema.prisma.

/** Forma de `AutomationRun.periodo` para esta automatización en este instante. */
export function periodoFor(def: AutomationDef, now: Date): string {
  switch (def.idempotencia) {
    case 'una_vez':  return 'evt';
    case 'diaria':   return zonedDayKey(now, BUSINESS_TZ);
    case 'semanal':  return isoWeekKey(now, BUSINESS_TZ);
    // Siempre único a propósito: deja pasar el INSERT para que el gate sea la
    // consulta de cooldown, no el unique.
    case 'cooldown': return now.toISOString();
  }
}

/**
 * ¿Esta automatización ya corrió para este target dentro de la ventana de cooldown?
 * Sólo aplica a `idempotencia: 'cooldown'`. Cuenta CUALQUIER estado previo —
 * incluido FALLIDO— a propósito: si el canal está caído, reintentar cada minuto
 * sólo multiplica el ruido; el próximo barrido tras la ventana lo reintenta solo.
 */
export async function estaEnCooldown(
  automationKey: string,
  targetId: string,
  cooldownHoras: number,
  now: Date,
): Promise<boolean> {
  const desde = new Date(now.getTime() - cooldownHoras * 3_600_000);
  const previo = await prisma.automationRun.findFirst({
    where:  { automationKey, targetId, createdAt: { gte: desde } },
    select: { id: true },
  });
  return previo !== null;
}

export interface RegistrarRunInput {
  automationKey: string;
  targetType:    string;
  targetId:      string;
  periodo:       string;
  canal:         string;
  estado:        AutomationRunEstado;
  payload?:      unknown;
}

/**
 * Escribe el run. Devuelve `false` si el unique lo rechazó — es decir, "ya estaba
 * hecho", el caso normal de un barrido repetido, NO un error.
 *
 * Nota sobre el orden: el run se escribe DESPUÉS del despacho, para que el payload
 * guarde el resultado real. Eso deja una ventana teórica (despachado y proceso
 * muerto antes de registrar) que duplicaría en el próximo barrido. Se acepta a
 * conciencia: el orden inverso —reservar y luego despachar— cambia ese riesgo por
 * uno peor, que un fallo de escritura del canal deje el target marcado como hecho
 * sin haber avisado a nadie. Perder un mensaje es peor que repetirlo.
 */
export async function registrarRun(input: RegistrarRunInput): Promise<boolean> {
  try {
    await prisma.automationRun.create({
      data: {
        automationKey: input.automationKey,
        targetType:    input.targetType,
        targetId:      input.targetId,
        periodo:       input.periodo,
        canal:         input.canal,
        estado:        input.estado,
        payload:       (input.payload ?? undefined) as never,
      },
    });
    return true;
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
      return false; // ya registrado — idempotencia funcionando
    }
    // Un fallo de bitácora nunca escala: la operación de negocio ya ocurrió.
    console.error(`[automations] no se pudo registrar el run de ${input.automationKey}:`, e);
    return false;
  }
}

/**
 * ¿Ya hay un run para este (key, target, periodo)? Chequeo PREVIO, barato, para no
 * hacer trabajo caro (cargar la orden, renderizar, llamar al canal) sobre targets
 * ya atendidos. NO es el gate — el gate sigue siendo el unique al escribir; esto
 * sólo evita el trabajo inútil.
 */
export async function yaCorrio(
  automationKey: string,
  targetId: string,
  periodo: string,
): Promise<boolean> {
  const previo = await prisma.automationRun.findUnique({
    where:  { automationKey_targetId_periodo: { automationKey, targetId, periodo } },
    select: { id: true },
  });
  return previo !== null;
}
