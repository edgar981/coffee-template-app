// El teléfono se PARTE en indicativo + número SÓLO en la FRONTERA DEL FORMULARIO
// (§ Configuración, rediseño de «Datos del negocio» a bloques). El DATO sigue siendo UNA
// sola columna para el WhatsApp del negocio (`SiteSetting.whatsapp`): esta capa no migra
// nada y no toca un solo consumidor — `whatsappUrl`, `formatWhatsappDisplay`, el footer y
// el checkout siguen leyendo el valor COMPUESTO tal cual, como hoy. (El número de pago
// móvil YA NO es una columna aparte: vive dentro de `SiteSetting.metodosPago`, § PAGOS-
// METODOS-MODELO-1 — esta doctrina de partir/componer aplica igual a ese campo.)
//
// Puro (capa 1), sin `server-only`: lo importa el form cliente.

export interface Indicativo {
  valor: string; // "+57"
  label: string; // "CO"
}

// El set del diseño. +57/CO es el DEFECTO (INDICATIVOS[0]) — no lo hornees como la única
// opción: es sólo el arranque del select.
export const INDICATIVOS: Indicativo[] = [
  { valor: '+57',  label: 'CO' },
  { valor: '+52',  label: 'MX' },
  { valor: '+51',  label: 'PE' },
  { valor: '+56',  label: 'CL' },
  { valor: '+54',  label: 'AR' },
  { valor: '+593', label: 'EC' },
  { valor: '+507', label: 'PA' },
  { valor: '+34',  label: 'ES' },
  { valor: '+1',   label: 'US/CA' },
];

export const INDICATIVO_DEFECTO = INDICATIVOS[0].valor; // '+57'

// Los candidatos de matching, del prefijo MÁS LARGO al más corto — ver `partirTelefono`.
const POR_LARGO_DESC = [...INDICATIVOS].sort((a, b) => b.valor.length - a.valor.length);

export interface TelefonoPartido {
  indicativo: string;
  numero: string;
}

/**
 * Parte un valor compuesto ("+57 315 576 6064") en `{ indicativo, numero }`. Matchea el
 * prefijo de `INDICATIVOS` MÁS LARGO que aplique — sin longest-match, un indicativo corto
 * (p.ej. "+1") podría comerse el arranque de un valor que en realidad trae uno más largo y
 * distinto (p.ej. "+507…"), dejando el resto del número mal cortado.
 *
 * Si NINGUNO matchea (un valor guardado SIN indicativo, o vacío), `indicativo` queda `''`
 * y `numero` es el valor ENTERO. NUNCA se inventa un indicativo sobre un valor que no lo
 * traía: eso CORROMPERÍA el dato al volver a componer.
 */
export function partirTelefono(valor: string): TelefonoPartido {
  const v = valor.trim();
  if (!v) return { indicativo: '', numero: '' };

  for (const { valor: prefijo } of POR_LARGO_DESC) {
    if (v.startsWith(prefijo)) {
      return { indicativo: prefijo, numero: v.slice(prefijo.length).trim() };
    }
  }
  return { indicativo: '', numero: v };
}

/**
 * Compone el string a GUARDAR: une indicativo + número con UN espacio, omitiendo las
 * partes vacías (`componerTelefono('', '3155766064') === '3155766064'`).
 */
export function componerTelefono(indicativo: string, numero: string): string {
  return [indicativo, numero]
    .map(p => p.trim())
    .filter(Boolean)
    .join(' ');
}
