// ─── QUÉ CUENTA UN CARRIL · cola o acumulador ────────────────────────────────
//
// La regla es del SISTEMA, no de una pantalla, y por eso el tipo vive acá y no
// dentro de `lib/pedidos/filtros` ni de `lib/clientes/filtros`: las dos lo
// importan, y cualquier vertical futura con carriles también.
//
//   Un pill lleva número si cuenta una COLA QUE SE VACÍA.
//   No lo lleva si cuenta un ACUMULADOR QUE SOLO CRECE.
//
// ── LA DIFERENCIA NO ES DE TAMAÑO, ES DE NATURALEZA ─────────────────────────
//
// Una COLA cuenta cosas en estado transitorio esperando una acción. Se vacía sola
// cuando el trabajo se hace, su número es chico y accionable, y —esto es lo que
// la define— su valor CRECE con la escala del negocio: "3 por cobrar" importa más
// con mil pedidos al mes que con diez.
//
// Un ACUMULADOR cuenta todo lo que alguna vez pasó por ahí. Nunca se vacía, sólo
// crece, y no pide ninguna acción: ¿qué se hace con "Entregados 987"? Su valor
// DECRECE con la escala — a los tres meses es ruido con dígitos.
//
// ── Y EL EFECTO QUE SE BUSCA ES EL CONTRARIO DE "QUITAR" ────────────────────
//
// En una fila donde SÓLO ALGUNOS pills tienen número, el número se vuelve SEÑAL:
// "3" resalta contra los que no dicen nada. Con siete números, ninguno resalta.
// Quitar los que no significan es lo que hace legibles a los que sí.
//
// Es la misma decisión con la que ya se retiró el conteo bajo el título ("12
// pedidos", "13 clientes") y la fila de stats de Clientes: el histórico no es
// operativo. Dejarlo en el pill de al lado sería incoherente.
//
// ── POR QUÉ ES UN CAMPO OBLIGATORIO Y NO UN `if` EN EL RENDER ───────────────
//
// Porque un carril nuevo tiene que DECLARAR qué es, y no puede olvidarse: sin el
// campo no compila. Con la decisión en el JSX, el próximo carril hereda el
// comportamiento del que tenga al lado — que es como se llega a siete números
// otra vez sin que nadie lo decida.

/**
 * Qué clase de número cuenta un carril.
 *
 * `cola` — transitorio, se vacía al hacer el trabajo. LLEVA número.
 * `acumulador` — histórico, sólo crece. NO lleva número; el carril se queda,
 *   porque filtrar por él sigue sirviendo.
 */
export type TipoDeCarril = 'cola' | 'acumulador';

/** Lo que todo carril de todo registro tiene que declarar. */
export interface CarrilBase<K extends string> {
  key:   K;
  label: string;
  /**
   * Qué cuenta. OBLIGATORIO: es la diferencia entre un número que se lee y ruido
   * con dígitos, y no debe poder omitirse por descuido.
   */
  tipo:  TipoDeCarril;
}

/**
 * Conteos de las COLAS únicamente.
 *
 * Es `Partial` a propósito, y no un `Record` completo con ceros: un acumulador no
 * tiene "conteo 0", tiene AUSENCIA de conteo. Que el tipo lo diga hace que el
 * render no pueda pintar un número que la regla prohíbe — no queda un valor a
 * mano que alguien pueda mostrar sin querer.
 */
export type ConteosDeCola<K extends string> = Partial<Record<K, number>>;

/**
 * Cuenta SÓLO los carriles de cola, sobre la lista que se está mostrando.
 *
 * Los acumuladores ni siquiera se recorren: dejar de mostrarlos es también dejar
 * de calcularlos. Con siete carriles eso son tres pasadas menos por render.
 */
export function conteosDeCola<K extends string, T>(
  carriles: readonly (CarrilBase<K> & { aplica?: (x: T) => boolean })[],
  items: T[],
): ConteosDeCola<K> {
  const acc: ConteosDeCola<K> = {};
  for (const c of carriles) {
    if (c.tipo !== 'cola') continue;
    // Un carril de cola SIN predicado contaría la lista entera, que es
    // exactamente un acumulador con otro nombre. No debería existir; si aparece,
    // se cuenta lo que hay y el tipo del registro es lo que hay que revisar.
    acc[c.key] = c.aplica ? items.filter(c.aplica).length : items.length;
  }
  return acc;
}
