// LAS CASILLAS DE FRECUENCIA (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4-5). PURA
// (capa 1): sin red, sin DOM, sin fecha implícita — `hoy` siempre llega por parámetro, para que el
// test ancle un día fijo en vez de correr contra `new Date()`.
//
// PIEZA REUTILIZABLE, agnóstica de "qué es una marca" (§ refero-chamisas.md §5: "Nuevas, elegibles
// por otras tiendas — Casillas de frecuencia: cada línea pone su marca (sticker, punto o sello)").
// `M` es el tipo de la marca que cada tienda decide pintar en una casilla con envío — un sticker de
// café para Las Chamisas, podría ser un punto o un sello para otra. Este módulo NUNCA sabe qué es
// `M`; sólo decide CUÁNTAS casillas, CUÁLES tienen envío, y si esa casilla es doble ("×2").
//
// LA ESTRUCTURA DE FRECUENCIA (`FrecuenciaEnvio`) ES INDEPENDIENTE DEL TEXTO LIBRE QUE EL DUEÑO
// ESCRIBE (`SuscripcionPlanesContent.frecuencia1..4`, lib/config/site-content-defaults.ts): esos
// campos son ETIQUETAS de display ("Cada 15 días"), sin semántica de calendario adjunta — el mapeo
// etiqueta→estructura es una convención de la composición «Casillas» (§ `frecuenciaEstructuraPorSlot`,
// lib/storefront/suscripcion-taquilla.ts), no de este módulo. Mantenerlos separados es lo que permite
// que este archivo sirva a una tienda que ni siquiera tenga el concepto de "slot 1 a 4".

/** La frecuencia, en términos de CALENDARIO — nunca de texto. `enviosPorMes` distingue la quincenal
 *  (2 envíos dentro del mismo mes, pintados en una sola casilla con el badge "×2": la maqueta
 *  aprobada no abre una casilla por envío, abre una por MES) de la mensual (1). `cadaNMeses` decide
 *  qué meses, de los `n` que se piden, llevan envío: 1 = todos; 2 = de dos en dos; etc. */
export interface FrecuenciaEnvio {
  enviosPorMes: 1 | 2;
  cadaNMeses: number;
}

export interface CasillaFrecuencia<M> {
  /** Mes 0-11 (`Date.getMonth()`), YA normalizado — un `cadaNMeses+1+i` que cruza diciembre avanza
   *  el año, nunca un mes negativo ni mayor a 11. */
  mes: number;
  anio: number;
  conEnvio: boolean;
  /** `enviosPorMes === 2` Y esta casilla lleva envío — el badge "×2" (§ refero-chamisas.md §4). */
  dosVeces: boolean;
  /** Las marcas a pintar en esta casilla — SIEMPRE `[]` si `conEnvio` es falso (nada que marcar en
   *  un mes sin envío) o si el llamador no pasó ninguna marca (p. ej. ningún café elegido todavía:
   *  la casilla queda "vacía con el sello en tono", § refero-chamisas.md §4, aun en un mes con
   *  envío programado). */
  marcas: readonly M[];
}

const MESES_POR_ANIO = 12;

/** ¿Este mes (offset `i`, 0-indexado desde el PRÓXIMO mes tras `hoy`) lleva envío, según la
 *  cadencia? `cadaNMeses <= 1` envía siempre — el caso mensual/quincenal, que son "todos los meses"
 *  en términos de calendario y sólo difieren en `enviosPorMes` dentro del mes. */
function mesConEnvio(i: number, cadaNMeses: number): boolean {
  if (cadaNMeses <= 1) return true;
  return i % cadaNMeses === 0;
}

/**
 * Las próximas `n` casillas (default 6, § refero-chamisas.md §4: "seis casillas para los próximos
 * meses"), calculadas desde `hoy` — SIEMPRE el mes SIGUIENTE al de `hoy` primero (offset 0 = el mes
 * que viene, nunca el mes en curso: el envío de este mes, si lo hay, ya se coordinó).
 */
export function casillasDeFrecuencia<M>(
  frecuencia: FrecuenciaEnvio,
  marcas: readonly M[],
  hoy: Date,
  n = 6,
): CasillaFrecuencia<M>[] {
  const casillas: CasillaFrecuencia<M>[] = [];
  const mesBase = hoy.getMonth() + 1; // el mes siguiente, puede exceder 11 — normalizado abajo
  const anioBase = hoy.getFullYear();
  for (let i = 0; i < n; i++) {
    const total = mesBase + i;
    const mes = ((total % MESES_POR_ANIO) + MESES_POR_ANIO) % MESES_POR_ANIO;
    const anio = anioBase + Math.floor(total / MESES_POR_ANIO);
    const conEnvio = mesConEnvio(i, frecuencia.cadaNMeses);
    casillas.push({
      mes,
      anio,
      conEnvio,
      dosVeces: conEnvio && frecuencia.enviosPorMes === 2,
      marcas: conEnvio ? marcas : [],
    });
  }
  return casillas;
}

/** El total de envíos en la ventana de `n` casillas (default 6) — "6 envíos en 6 meses" /
 *  "12 envíos en 6 meses" (quincenal) / "3 envíos en 6 meses" (bimestral), § refero-chamisas.md §4.
 *  Cuenta cada casilla doble ("×2") como DOS envíos, nunca uno. */
export function totalEnviosEnVentana(frecuencia: FrecuenciaEnvio, n = 6): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (mesConEnvio(i, frecuencia.cadaNMeses)) total += frecuencia.enviosPorMes;
  }
  return total;
}

/** Los nombres de mes abreviados, es-CO — para la etiqueta de cada casilla ("nov", "dic"…). Lista
 *  PROPIA (no `Intl`, que exigiría un `Date` real por mes para formatear): esta pieza ya recibe el
 *  índice 0-11 directo de `casillasDeFrecuencia`, así que una tabla fija es más barata y más clara
 *  que construir un `Date` sólo para tirarlo. */
export const NOMBRES_MES_ABREV = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;
