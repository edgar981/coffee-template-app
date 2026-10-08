// LA MECÁNICA PURA del deslizador del editor (§ EDITOR-PANEL-DESLIZADORES-1, pedido del owner:
// «Fondo: oscurecer para leer mejor» deja de ser cuatro botones y pasa a ser un deslizador continuo,
// con las cuatro posiciones de hoy marcadas, y el tamaño de un elemento se elige con un deslizador
// por pasos). Módulo PURO —sin React, sin `window`— para que el componente visual
// (`components/admin/editor/Deslizador.tsx`, el panel) y el render bespoke de la barra flotante
// (`HeroMediaMarquesina.tsx`, el storefront público, § el docstring de esa composición) comparten la
// MISMA aritmética sin compartir JSX: el storefront no puede traer Tailwind/el design-system del
// panel (§ EstiloElementoControles.tsx, "ese documento es el storefront público"), pero sí puede
// importar un `.ts` sin React — mismo patrón que `lib/admin/editor-iframe.ts` ya usan
// `EditorPuenteVivo.tsx`/`CampoEditable.tsx` (storefront) y el panel por igual.

export function clampDeslizador(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min;
  return Math.min(max, Math.max(min, valor));
}

/** El valor tras UNA flecha de teclado: `direccion` es +1 (derecha/arriba) o -1 (izquierda/abajo),
 *  `paso` la magnitud del salto (5 para el velo del hero, 1 para un deslizador por pasos discretos
 *  como el tamaño de un elemento). Siempre clampado al rango — una flecha nunca saca el valor de
 *  `[min, max]`. */
export function pasoTeclado(valor: number, direccion: 1 | -1, paso: number, min: number, max: number): number {
  return clampDeslizador(valor + direccion * paso, min, max);
}

/**
 * ¿`valor` cae dentro de `umbral` de alguna marca? Si varias están dentro del umbral, gana la MÁS
 * CERCANA — nunca una ambigüedad silenciosa. Si ninguna está cerca, `valor` vuelve sin cambios. Es
 * la "atracción" de la perilla hacia las posiciones de hoy: soltar cerca de una marca cae EXACTO en
 * ella, en vez de dejar un valor vecino que no corresponde a ningún paso conocido.
 */
export function atraerAMarca(valor: number, marcas: readonly number[], umbral: number): number {
  let mejor: number | null = null;
  let mejorDistancia = Infinity;
  for (const m of marcas) {
    const distancia = Math.abs(valor - m);
    if (distancia <= umbral && distancia < mejorDistancia) {
      mejor = m;
      mejorDistancia = distancia;
    }
  }
  return mejor ?? valor;
}

export interface MarcaEtiquetada {
  valor: number;
  etiqueta: string;
}

/**
 * La etiqueta de la marca MÁS CERCANA a `valor` — nunca interpola entre dos nombres ("Suave y medio"
 * no es una palabra). Un deslizador continuo necesita una palabra aunque el dueño lo deje a mitad de
 * camino entre dos marcas; ésta es la regla: la más cercana gana, y un empate exacto gana la PRIMERA
 * de la lista (el orden de `marcas` es la decisión del llamador, no de esta función).
 */
export function etiquetaCercana(valor: number, marcas: readonly MarcaEtiquetada[]): string {
  if (marcas.length === 0) return '';
  let mejor = marcas[0];
  let mejorDistancia = Math.abs(valor - marcas[0].valor);
  for (const marca of marcas.slice(1)) {
    const distancia = Math.abs(valor - marca.valor);
    if (distancia < mejorDistancia) {
      mejor = marca;
      mejorDistancia = distancia;
    }
  }
  return mejor.etiqueta;
}
