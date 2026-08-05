import type { ResumenMargen } from '@/lib/metrics/margen';
import type { ResumenCartera } from '@/lib/metrics/cartera';
import type { Concentracion } from '@/lib/metrics/concentracion';
import type { PeriodoKey } from '@/lib/metrics/periodo';

// El payload de GET /api/analytics REUSA los tipos de los predicados puros en vez
// de redeclararlos. No es economía de líneas: una copia local de `FilaMargen` que
// se quedara sin un campo haría que el server calculara algo que la página no
// pinta, y en silencio — el compilador no puede avisar de una divergencia entre
// dos tipos que nunca se comparan.

/** Un mes de la serie de TRAYECTORIA. */
export interface PuntoTrayectoria {
  /** `YYYY-MM` en America/Bogota. */
  month:    string;
  /** `ago 26` — la etiqueta del eje X. */
  label:    string;
  /** Pagos recibidos ese mes. INCLUYE el costo de envío. */
  ingresos: number;
  /** Margen estimado de mercancía (sin envío) con costos ACTUALES. */
  margen:   number;
  /** Órdenes cobradas ese mes: la base de MUESTRA de los insights, no el valor. */
  ordenes:  number;
  /** `false` para el mes en curso (incompleto) — los insights lo descartan. */
  cerrado:  boolean;
}

export interface CanalDistribucion {
  name:  string;
  /** Órdenes del canal (el valor absoluto, no el %). */
  value: number;
  /** % sobre el total del año. Suma 100 entre todos los canales. */
  pct:   number;
  fill?: string;
}

export interface Recurrencia {
  recurrentes: number;
  /** Total de clientes — el denominador del "N de M". */
  clientes:    number;
  pct:         number;
}

export interface AnalyticsData {
  /** Day key `YYYY-MM-DD` (Bogotá) del servidor. Ancla los links de la cartera. */
  hoy:           string;
  periodo:       { key: PeriodoKey; label: string };
  rentabilidad:  ResumenMargen;
  cartera:       ResumenCartera;
  trayectoria:   PuntoTrayectoria[];
  concentracion: Concentracion;
  recurrencia:   Recurrencia;
  canales:       CanalDistribucion[];
}

export interface WeekData {
  dia:      string;
  ordenes:  number;
  ingresos: number;
}

/**
 * Payload of GET /api/analytics/weekly — ONE specific Monday–Sunday week
 * (America/Bogota) for the Actividad Semanal card, zero-filled Lun→Dom.
 * `week` echoes the normalized Monday day-key so the client can match
 * in-flight responses to the visible week.
 */
export interface WeeklyActivityData {
  week: string;
  days: WeekData[];
}
