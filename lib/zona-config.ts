import type { ShippingZona } from '@/types/shipping';
import { normalize } from '@/lib/utils';

// Zonas operativas de reparto — los cortes NO son geografía oficial, son
// las rutas del cliente. TODO: umbrales placeholder pendientes de validar
// con el cliente (mismo estatus que los precios de shipping-config.ts).
// Multitenant futuro: este objeto migra a DB scopeado por tienda; el
// resolver de abajo no cambia.
export const ZONA_CONFIG = {
  ciudadBase: 'Bogotá',
  // Umbrales sobre la nomenclatura bogotana (placeholder):
  calleNorteDesde: 100,   // Calle >= 100 → norte
  calleCentroHasta: 26,   // Calle < 26 (sin sufijo Sur) → centro
  carreraOccidenteDesde: 68, // Carrera >= 68 → occidente
} as const;

export type ZonaConfig = typeof ZONA_CONFIG;

// Nomenclatura bogotana. Se aceptan las abreviaturas que el operador escribe a
// mano ("cl 127", "cra 80", "kr 80"), con punto opcional. El número se limita a
// 3 dígitos: en "Calle 127 # 15-30" el `#` corta antes de la placa, pero una
// dirección sin `#` ("calle 127 1530") no debe leerse como calle 1530.
//
// Los dos ejes agrupan sus variantes reales porque comparten la numeración:
//   • eje CALLE (oriente–occidente): calle, avenida calle (`ac`) y diagonal
//     (`dg`), que se numera dentro de la serie de calles.
//   • eje CARRERA (sur–norte): carrera, avenida carrera (`ak`) y transversal
//     (`tv`), numerada dentro de la serie de carreras.
// `ak`/`ac` van explícitos porque `\b…k` NO los captura: en "ak 58" no hay
// frontera de palabra antes de la k, así que sin esta entrada la dirección más
// común del cliente no matcheaba nada.
const RE_CALLE   = /\b(?:calles?|cll?|cl|avenida\s+calles?|av\.?\s*calles?|ac|diagonal|dg)\s*\.?\s*(\d{1,3})\b/;
const RE_CARRERA = /\b(?:carreras?|cra|crr|kra|kr|k|avenida\s+carreras?|av\.?\s*carreras?|ak|transversal|tv)\s*\.?\s*(\d{1,3})\b/;
// El sufijo "sur" de la nomenclatura, escrito completo ("calle 40 sur") o
// abreviado tras el número ("cl 40 s"). Va PRIMERO porque manda sobre el
// umbral de calle: la Calle 40 Sur no es centro.
const RE_SUR     = /\bsur\b|\b\d{1,3}\s*s\b/;

/**
 * Sugiere la zona de reparto a partir de la dirección de la orden. Heurística
 * de TEXTO — sin geocoding, sin red, pura y determinista: es una SUGERENCIA
 * que el operador confirma o corrige en el Select del modal, nunca un valor
 * que se escriba solo.
 *
 * `null` = "no me consta": el modal cae a su default sin marcar nada como
 * sugerido. Preferimos callar antes que sugerir mal — una sugerencia
 * equivocada que el operador acepta sin mirar cuesta más que ninguna.
 *
 * Casos de referencia (no hay runner de tests configurado en el repo — ver el
 * reporte de la tarea; estos son los casos a portar cuando lo haya):
 *
 *   dirección                      | ciudad    | resultado
 *   -------------------------------|-----------|-----------
 *   'Calle 127 # 15-30'            | 'Bogotá'  | 'norte'
 *   'Cl 40 Sur # 12-3'             | 'Bogotá'  | 'sur'
 *   'Carrera 80 # 8-20'            | 'Bogotá'  | 'occidente'
 *   'Calle 12 # 4-56'              | 'Bogotá'  | 'centro'
 *   'Calle 127 # 15-30'            | 'Medellín'| 'exterior'
 *   'Calle 127 # 15-30'            | 'bogota'  | 'norte'  (sin tilde/mayúscula)
 *   'Conjunto Los Cedros, torre 3' | 'Bogotá'  | null
 *   'Calle 127 # 15-30'            | null      | null
 *   'Ak 80 # 8-20'                 | 'Bogotá'  | 'occidente' (avenida carrera)
 *   'Ac 127 # 15-30'               | 'Bogotá'  | 'norte'     (avenida calle)
 *   'Ak 58 # 169a-25'              | 'Bogotá'  | null  ← carrera 58 < 68: el
 *     umbral de occidente la deja sin sugerencia. Es la dirección más común de
 *     los datos actuales, así que HOY la heurística acierta poco en la práctica.
 */
export function sugerirZona(
  direccion: string | null | undefined,
  ciudad: string | null | undefined,
  config: ZonaConfig = ZONA_CONFIG,
): ShippingZona | null {
  // 1. Sin ciudad no hay nada que decidir: ni siquiera sabemos si es local.
  if (!ciudad?.trim()) return null;

  // 2. Fuera de la ciudad base es `exterior` sin mirar la dirección — la
  //    nomenclatura de otra ciudad no significa lo mismo.
  if (normalize(ciudad.trim()) !== normalize(config.ciudadBase)) return 'exterior';

  // 3. Ciudad base: se lee la nomenclatura de la dirección.
  const dir = direccion?.trim() ? normalize(direccion) : '';
  if (!dir) return null;

  if (RE_SUR.test(dir)) return 'sur';

  const calle = matchNumero(dir, RE_CALLE);
  if (calle !== null) {
    if (calle >= config.calleNorteDesde)  return 'norte';
    if (calle <  config.calleCentroHasta) return 'centro';
    // Calle intermedia (26–99): `null` EXPLÍCITO, decisión del owner
    // (2026-07-29) — no se inventan cortes para ese rango hasta que el cliente
    // defina sus rutas reales. Tampoco se cae a la regla de carrera: mezclar
    // los dos ejes (calle 50 con carrera 80) daría sugerencias que el operador
    // corregiría seguido.
    // TODO(cliente): definir el corte del rango 26–99 (y revisar
    // `carreraOccidenteDesde`, hoy 68, que deja sin sugerencia direcciones tan
    // comunes como "Ak 58"). Los umbrales de ZONA_CONFIG siguen siendo
    // placeholder; `zona_sugerida` en DB es la fuente para calibrarlos.
    return null;
  }

  const carrera = matchNumero(dir, RE_CARRERA);
  if (carrera !== null && carrera >= config.carreraOccidenteDesde) return 'occidente';

  // Texto libre atípico (conjuntos, "Autopista Norte Km X", veredas): sin
  // sugerencia.
  return null;
}

function matchNumero(dir: string, re: RegExp): number | null {
  const m = re.exec(dir);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
