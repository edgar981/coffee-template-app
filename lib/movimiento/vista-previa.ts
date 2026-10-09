// LA MINIATURA DEL SELECTOR (§ MOVIMIENTO-EDITOR-EXPOSICION-1) — módulo PURO (sin DOM), el MISMO
// criterio que `lib/animation.ts` ya usa para `estiloTarjetaTransicion`/`SelectorTransicion.tsx`:
// una miniatura ILUSTRATIVA, NO el motor de GSAP real (`components/storefront/movimiento/
// animaciones.ts`) corriendo a escala de card — nunca se monta GSAP dentro de un selector con una
// docena de tarjetas a la vez. Devuelve un `transform`/`opacity`/`clipPath` a partir de un PROGRESO
// 0→1 que avanza solo (§ `progresoLoopTarjetaTransicion`, `lib/animation.ts`, reusada tal cual por
// el componente — este módulo no inventa un segundo reloj).
//
// `indice` desfasa la FASE de una pieza dentro de un grupo que entra en cascada (las "líneas" de
// texto, las "tarjetas") — mismo propósito que el `stagger` de GSAP, aproximado sin GSAP.

export interface EstiloMiniaturaMovimiento {
  transform: string;
  opacity: number;
  clipPath?: string;
}

/** Fracción del ciclo que separa la fase de una pieza de la siguiente, en los ids que entran en
 *  cascada (T01/T02/T03/C01). */
const PASO_CASCADA = 0.12;

/** Fracción del ciclo que dura la "entrada" de una pieza antes de asentarse — el resto del ciclo la
 *  deja en su posición final, igual que el prototipo real (que entra una vez y no vuelve a moverse
 *  dentro de la ventana de la demo). */
const VENTANA_ENTRADA = 0.35;

function faseDeEntrada(progreso: number, indice: number): number {
  const fase = ((progreso - indice * PASO_CASCADA) % 1 + 1) % 1;
  return Math.min(1, fase / VENTANA_ENTRADA);
}

function dentroDeEntrada(progreso: number, indice: number): boolean {
  const fase = ((progreso - indice * PASO_CASCADA) % 1 + 1) % 1;
  return fase < VENTANA_ENTRADA;
}

const REPOSO: EstiloMiniaturaMovimiento = { transform: 'none', opacity: 1 };

/** El estilo de UNA pieza (línea de texto, foto o tarjeta) para el id elegido, en el progreso dado.
 *  `estatico` (reposo o `prefers-reduced-motion`) siempre da el CUADRO FINAL — nunca una posición a
 *  medio camino —, el mismo contrato que `estiloTarjetaTransicion`. */
export function estiloMiniaturaMovimiento(id: string, progreso: number, estatico: boolean, indice = 0): EstiloMiniaturaMovimiento {
  if (estatico) return REPOSO;
  switch (id) {
    // ── texto: líneas que suben mientras funden opacidad ──
    case 'T01':
    case 'T02':
    case 'C01': {
      if (!dentroDeEntrada(progreso, indice)) return REPOSO;
      const t = faseDeEntrada(progreso, indice);
      return { transform: `translateY(${(1 - t) * 60}%)`, opacity: t };
    }
    // ── texto: letra a letra, con una leve rotación al asentar ──
    case 'T03': {
      if (!dentroDeEntrada(progreso, indice)) return REPOSO;
      const t = faseDeEntrada(progreso, indice);
      return { transform: `translateY(${(1 - t) * 50}%) rotate(${(1 - t) * 6}deg)`, opacity: t };
    }
    // ── texto: palabra resaltada / por bloque — un desplazamiento más corto, sin cascada ──
    case 'T04':
    case 'T05': {
      if (!dentroDeEntrada(progreso, indice)) return REPOSO;
      const t = faseDeEntrada(progreso, indice);
      return { transform: `translateY(${(1 - t) * 20}%)`, opacity: t };
    }
    // ── imagen: máscara que se abre, de abajo hacia arriba ──
    case 'I01': {
      if (!dentroDeEntrada(progreso, indice)) return { ...REPOSO, clipPath: 'inset(0% 0% 0% 0%)' };
      const t = faseDeEntrada(progreso, indice);
      return { transform: 'none', opacity: 1, clipPath: `inset(${(1 - t) * 100}% 0% 0% 0%)` };
    }
    // ── imagen: escala suave, se asienta a tamaño real ──
    case 'I02': {
      if (!dentroDeEntrada(progreso, indice)) return REPOSO;
      const t = faseDeEntrada(progreso, indice);
      return { transform: `scale(${1 + (1 - t) * 0.18})`, opacity: 1 };
    }
    // ── imagen: parallax — scrub continuo, sin fase de entrada, sube y baja todo el ciclo ──
    case 'I03': {
      const y = Math.sin(progreso * Math.PI * 2) * 8;
      return { transform: `translateY(${y}%)`, opacity: 1 };
    }
    // ── tarjetas: elevar al pasar el mouse — una leve subida que vuelve, en bucle ──
    case 'C02': {
      const fase = ((progreso - indice * PASO_CASCADA) % 1 + 1) % 1;
      const alza = fase < 0.5 ? fase / 0.5 : (1 - fase) / 0.5;
      return { transform: `translateY(${-alza * 10}%)`, opacity: 1 };
    }
    default:
      return REPOSO;
  }
}
