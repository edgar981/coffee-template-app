// ── LA SELECCIÓN DE RANGO DEL CALENDARIO, EN DOS CLICS ──────────────────────
//
// El picker construye un rango con DOS clics, y el estado A MEDIAS —un solo día
// elegido, esperando el segundo— vive DENTRO del picker y no sale nunca: `onChange`
// se llama SÓLO con rangos completos. Por qué el contrato es estrecho: el medio-rango
// no le pertenece a las pantallas que consumen el picker. Cuando escapaba, Pagos
// crasheaba (`dayKeyStart('')`) y Pedidos/Inventario disparaban una consulta de rango
// abierto — siete oportunidades de olvidarse repartidas en tres archivos. Un contrato
// que sólo emite rangos completos no hay que recordarlo.
//
// LA PREMISA QUE HAY QUE TENER CLARA, y que costó la primera versión de este archivo:
// **react-day-picker NUNCA produce un `to: null`.** Un clic suelto es `{from:X, to:X}`
// (medido con `addToRange`), y sobre un rango completo mueve `to` al día clickeado
// dejando `from` clavado —de ahí el bug original: no se podía empezar un rango que
// arrancara después del `from` vigente—. La primera versión inventó un `to: null` que
// la librería no usa y lo derramó a los consumidores; toda esa versión partía de una
// premisa falsa.
//
// Por eso este modelo NO consulta la sugerencia de RDP: se maneja por el DÍA CLICKEADO
// y nada más. Puro y determinista, testeable en capa 1 sin depender de las mañas de la
// librería.

/**
 * El resultado de un clic en el calendario, dado el día pendiente (el primer clic de
 * un rango en curso, o `null` si no hay ninguno) y el día que se acaba de clickear.
 *
 * - `arranca`: no había pendiente → este clic ABRE un rango nuevo. No se emite nada;
 *   el picker guarda el ancla y espera el segundo clic.
 * - `completa`: ya había un ancla → este clic CIERRA el rango. Se emite completo, con
 *   los extremos ordenados (el segundo clic puede caer antes del primero).
 */
export type PasoSeleccion =
  | { fase: 'arranca'; pendiente: string }
  | { fase: 'completa'; desde: string; hasta: string };

/**
 * Avanza la selección de rango con un clic. `pendiente` y `diaClic` son day keys
 * (`YYYY-MM-DD`), así que la comparación lexicográfica ES la cronológica.
 */
export function avanzarSeleccion(pendiente: string | null, diaClic: string): PasoSeleccion {
  if (pendiente === null) return { fase: 'arranca', pendiente: diaClic };
  // El segundo clic puede caer ANTES del ancla: se ordenan, no se asume que el
  // primero es el menor. (Elegir "del 20 al 16" es tan válido como "del 16 al 20".)
  const [desde, hasta] = pendiente <= diaClic ? [pendiente, diaClic] : [diaClic, pendiente];
  return { fase: 'completa', desde, hasta };
}
