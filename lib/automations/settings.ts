import prisma from '@duna/core';
import {
  AUTOMATIONS, AUTOMATION_MAP, isAutomationKey, parseAutomationConfig,
  type AutomationDef,
} from '@/constants/automations';

// Lectura/escritura del estado de las automatizaciones. THE gate entre la tabla
// (AutomationSetting: activo + overrides crudos) y el resto del código, que sólo
// ve configuración YA fusionada con los defaults del registry.
//
// Sin fila = todo por default (registry). Esa es la razón de que el catálogo pueda
// crecer sin migraciones ni backfills: una automatización nueva simplemente no
// tiene fila hasta que alguien la toque.

export interface AutomationState {
  def:    AutomationDef;
  activo: boolean;
  config: Record<string, unknown>;
}

function stateFromRow(
  def: AutomationDef,
  row: { activo: boolean; config: unknown } | undefined,
): AutomationState {
  return {
    def,
    activo: row?.activo ?? def.defaultActivo,
    config: parseAutomationConfig(def, row?.config),
  };
}

export interface AutomationStates {
  states: AutomationState[];
  /**
   * La lectura de la tabla falló y esto son los defaults del registry, no lo que
   * el owner configuró. Los llamadores DEBEN propagarlo: sin esta bandera, una
   * degradación se ve idéntica a "no había nada que hacer" — todo apagado, cero
   * runs, 200 OK. Un barrido que no dispara nada porque no pudo leer la
   * configuración tiene que ser distinguible de uno que no tenía trabajo.
   */
  degradado: boolean;
}

/**
 * Estado de TODAS las automatizaciones del registry, con o sin fila en la tabla.
 * Una fila cuya key ya no existe en el registry se ignora (misma política que los
 * widgets: una key retirada se cae, no revienta).
 *
 * Un fallo de DB degrada a los defaults del registry en vez de tumbar el barrido:
 * con todo en `defaultActivo: false` eso significa "no dispares nada", que es el
 * lado seguro del error — pero se REPORTA (ver `degradado`).
 */
export async function loadAutomationStates(): Promise<AutomationStates> {
  let rows: { key: string; activo: boolean; config: unknown }[] = [];
  let degradado = false;
  try {
    rows = await prisma.automationSetting.findMany();
  } catch (e) {
    degradado = true;
    console.error('[automations] lectura de settings falló; usando defaults del registry:', e);
  }
  const byKey = new Map(rows.filter(r => isAutomationKey(r.key)).map(r => [r.key, r]));
  return { states: AUTOMATIONS.map(def => stateFromRow(def, byKey.get(def.key))), degradado };
}

/** Estado de UNA automatización. `null` si la key no está en el registry. */
export async function loadAutomationState(key: string): Promise<AutomationState | null> {
  const def = AUTOMATION_MAP[key];
  if (!def) return null;
  try {
    const row = await prisma.automationSetting.findUnique({ where: { key } });
    return stateFromRow(def, row ?? undefined);
  } catch (e) {
    console.error(`[automations] lectura de settings ${key} falló; usando defaults:`, e);
    return stateFromRow(def, undefined);
  }
}

/**
 * Guarda la decisión del owner. La config se valida contra el `configSchema` ANTES
 * de persistir: lo que entra a la columna ya es una configuración válida, y el
 * parseo de lectura queda como defensa en profundidad (no como única barrera).
 * Devuelve el estado resultante.
 */
export async function saveAutomationSetting(
  key: string,
  patch: { activo?: boolean; config?: unknown },
): Promise<AutomationState | null> {
  const def = AUTOMATION_MAP[key];
  if (!def) return null;

  const config = patch.config === undefined ? undefined : parseAutomationConfig(def, patch.config);

  const row = await prisma.automationSetting.upsert({
    where:  { key },
    update: {
      ...(patch.activo === undefined ? {} : { activo: patch.activo }),
      ...(config === undefined ? {} : { config: config as never }),
    },
    create: {
      key,
      activo: patch.activo ?? def.defaultActivo,
      config: (config ?? def.configSchema.parse({})) as never,
    },
  });

  return stateFromRow(def, row);
}
