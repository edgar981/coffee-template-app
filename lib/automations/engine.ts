import { BUSINESS_TZ, zonedHour } from '@/lib/timezone';
import { AUTOMATION_MAP } from '@/constants/automations';
import { loadAutomationStates, type AutomationState } from './settings';
import { periodoFor, registrarRun, estaEnCooldown, yaCorrio } from './idempotency';
import { dispatch } from './channels';
import { EVENT_HANDLERS, SCHEDULED_HANDLERS } from './handlers';
import { esOmitido, type AutomationEvent, type Objetivo } from './types';

// ─── EL motor ────────────────────────────────────────────────────────────────
// Dos entradas, un solo cuerpo. `runEventAutomations` la llaman los code paths de
// negocio POST-COMMIT; `runScheduledAutomations` la llama el cron horario. Ambas
// hacen lo mismo para cada automatización candidata:
//
//   cargar settings → saltar si está inactiva → evaluar el disparador →
//   verificar idempotencia → renderizar → despachar al canal → registrar el run
//
// REGLA INVIOLABLE: nada de esto puede afectar la operación de negocio. La venta ya
// ocurrió y está comiteada antes de que se llame a nada de aquí. Todo error se
// convierte en un run FALLIDO + un console.error; ninguna excepción escapa hacia
// arriba. `runEventAutomations` devuelve void y jamás lanza — es fire-and-forget
// por diseño, no por descuido del que la llama.

export interface RunSummary {
  automationKey: string;
  targetId:      string;
  estado:        'ENVIADO' | 'PENDIENTE_CANAL' | 'FALLIDO' | 'OMITIDO' | 'DUPLICADO';
}

/**
 * Ejecuta UN objetivo: idempotencia → canal → bitácora. Devuelve el resultado para
 * el resumen del cron. Nunca lanza.
 */
async function ejecutarObjetivo(
  state: AutomationState,
  objetivo: Objetivo,
  now: Date,
): Promise<RunSummary> {
  const { def, config } = state;
  const periodo = periodoFor(def, now);
  const base    = { automationKey: def.key, targetId: objetivo.targetId };

  try {
    // Gate de idempotencia. Para 'cooldown' es la consulta de ventana; para el
    // resto, un chequeo previo barato (el gate DURO sigue siendo el unique al
    // escribir el run, más abajo).
    if (def.idempotencia === 'cooldown') {
      const horas = Number(config.cooldownHoras ?? 24);
      if (await estaEnCooldown(def.key, objetivo.targetId, horas, now)) {
        return { ...base, estado: 'DUPLICADO' };
      }
    } else if (await yaCorrio(def.key, objetivo.targetId, periodo)) {
      return { ...base, estado: 'DUPLICADO' };
    }

    // Nada que despachar, pero sí que registrar (sin teléfono, sin correo…).
    if (esOmitido(objetivo)) {
      await registrarRun({
        ...base, targetType: def.targetType, periodo, canal: def.canal,
        estado: 'OMITIDO', payload: { motivo: objetivo.omitir },
      });
      return { ...base, estado: 'OMITIDO' };
    }

    const resultado = await dispatch(objetivo.dispatch);
    const escrito = await registrarRun({
      ...base, targetType: def.targetType, periodo, canal: def.canal,
      estado: resultado.estado, payload: resultado.payload,
    });

    // El unique lo rechazó: otro proceso ganó la carrera entre el chequeo previo y
    // esta escritura. Se reporta como duplicado, sin ruido.
    return { ...base, estado: escrito ? resultado.estado : 'DUPLICADO' };
  } catch (e) {
    console.error(`[automations] ${def.key} falló sobre ${objetivo.targetId}:`, e);
    await registrarRun({
      ...base, targetType: def.targetType, periodo, canal: def.canal,
      estado: 'FALLIDO', payload: { error: e instanceof Error ? e.message : String(e) },
    });
    return { ...base, estado: 'FALLIDO' };
  }
}

// ─── Automatizaciones por EVENTO ─────────────────────────────────────────────

/**
 * La llaman los code paths de negocio DESPUÉS del commit. Fire-and-forget: no
 * devuelve nada útil y no lanza nunca — una automatización rota jamás puede tumbar
 * una venta, un despacho ni un ajuste de inventario.
 */
export async function runEventAutomations(event: AutomationEvent): Promise<void> {
  try {
    const now = new Date();
    const { states } = await loadAutomationStates();

    for (const state of states) {
      if (state.def.tipo !== 'evento' || !state.activo) continue;

      const handler = EVENT_HANDLERS[state.def.key];
      if (!handler) continue;

      try {
        const objetivo = await handler(event, { config: state.config, now });
        if (objetivo) await ejecutarObjetivo(state, objetivo, now);
      } catch (e) {
        console.error(`[automations] handler de evento ${state.def.key} falló:`, e);
      }
    }
  } catch (e) {
    console.error('[automations] runEventAutomations falló:', e);
  }
}

// ─── Automatizaciones PROGRAMADAS ────────────────────────────────────────────

export interface ScheduledReport {
  /** Hora local (Bogotá) que vio esta corrida — el reloj contra el que se decide. */
  horaBogota: number;
  ejecutadas: string[];
  omitidasPorHora: string[];
  inactivas: string[];
  runs: RunSummary[];
  /**
   * No se pudo leer la configuración: lo de abajo son los defaults del registry
   * (todo apagado), NO lo que el owner configuró. Sin esto, una DB caída se
   * reporta igual que una hora sin trabajo pendiente.
   */
  degradado: boolean;
}

/**
 * La llama el cron (horario). Cada automatización programada declara SU hora en
 * reloj de Bogotá; aquí se convierte el instante UTC a esa hora local y se comparan.
 * Ninguna hora UTC está escrita a mano en ningún lado.
 *
 * Si el cron se salta una hora (o corre de más), la idempotencia por `periodo`
 * absorbe el desfase: el reporte semanal de la semana 31 se manda una sola vez, sin
 * importar cuántas veces se dispare el barrido dentro de esa hora.
 */
export async function runScheduledAutomations(now: Date = new Date()): Promise<ScheduledReport> {
  const horaBogota = zonedHour(now, BUSINESS_TZ);
  const { states, degradado } = await loadAutomationStates();

  const report: ScheduledReport = {
    horaBogota, ejecutadas: [], omitidasPorHora: [], inactivas: [], runs: [], degradado,
  };

  for (const state of states) {
    const { def, config, activo } = state;
    if (def.tipo !== 'programada') continue;

    if (!activo) { report.inactivas.push(def.key); continue; }

    // Cada programada corre en SU hora local. Sin hora configurada, cada corrida
    // del cron es candidata y la idempotencia por periodo hace el resto.
    const horaObjetivo = config.hora === undefined ? undefined : Number(config.hora);
    if (horaObjetivo !== undefined && horaObjetivo !== horaBogota) {
      report.omitidasPorHora.push(def.key);
      continue;
    }

    const handler = SCHEDULED_HANDLERS[def.key];
    if (!handler) continue;

    try {
      const objetivos = await handler({ config, now });
      for (const objetivo of objetivos) {
        report.runs.push(await ejecutarObjetivo(state, objetivo, now));
      }
      report.ejecutadas.push(def.key);
    } catch (e) {
      // Una automatización que revienta no puede cancelar las demás del barrido.
      console.error(`[automations] barrido de ${def.key} falló:`, e);
      report.runs.push({ automationKey: def.key, targetId: 'global', estado: 'FALLIDO' });
    }
  }

  return report;
}

/** Re-export por comodidad de los call sites de negocio. */
export { AUTOMATION_MAP };
export type { AutomationEvent } from './types';
