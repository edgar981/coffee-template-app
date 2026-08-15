import type { InventoryMovementType } from '@/types/inventory';

// ─── LA CANTIDAD DE UN AJUSTE · qué significa el número según el TIPO ─────────
//
// El campo Cantidad no quiere decir lo mismo en los cuatro movimientos, y ésa es
// toda la decisión de este archivo:
//
//   `ajuste`                  → ABSOLUTO. Fija el stock en lo que se escriba.
//   `entrada` / `devolucion`  → DELTA. Suma al stock actual.
//   `salida`                  → DELTA. Resta del stock actual.
//
// Vive en `lib/` y no dentro del modal por el criterio de siempre: un `if`
// cambiado dentro del JSX rompería la diferencia entre "dejar 27" y "sumar 27"
// sin que nada lo notara, y esa diferencia es stock real.

/** ¿El número que se teclea REEMPLAZA al stock, o lo mueve? */
export const esAbsoluto = (tipo: InventoryMovementType): boolean => tipo === 'ajuste';

/**
 * Con qué valor arranca el campo Cantidad.
 *
 * ── PRE-LLENA SÓLO EL ABSOLUTO, Y LA ASIMETRÍA ES EL PUNTO ──────────────────
 *
 * En `ajuste` el operador CORRIGE desde el valor real: la operación normal es
 * "conté y hay 25, no 27", así que arrancar en blanco lo obliga a recordar el
 * número de la pantalla de atrás y a escribirlo entero. Arranca en el stock.
 *
 * En los DELTA arranca VACÍO, y no es una omisión: sembrar el stock actual ahí
 * significaría "sumar 27" o "restar 27" de un solo Enter. El pre-llenado que
 * ayuda en un tipo es un error grave en los otros tres, y por eso esto es una
 * función con un test y no un `defaultValue` en el JSX.
 *
 * Sin producto todavía elegido no hay stock que sembrar: vacío.
 */
export function cantidadInicial(tipo: InventoryMovementType, stock?: number | null): string {
  if (!esAbsoluto(tipo)) return '';
  return typeof stock === 'number' ? String(stock) : '';
}

/**
 * Los límites del campo, por tipo.
 *
 * `salida` no puede dejar el stock NEGATIVO — es lo que el servidor rechaza con
 * un 409 (`InsufficientStockError`). El tope acá no reemplaza esa guarda: la
 * anticipa, para que el operador vea el límite antes de gastar un viaje. El
 * servidor sigue siendo el que manda, y tiene que seguir siéndolo porque entre
 * que se abre el modal y se aplica, otro movimiento pudo cambiar el stock.
 *
 * El mínimo de los DELTA es 1: un movimiento de cero no es un movimiento, y
 * dejarlo pasar ensuciaría el kardex con asientos que no movieron nada. El de
 * `ajuste` es 0, que sí es un valor legítimo — "no queda ninguno".
 */
export function limitesDeCantidad(
  tipo: InventoryMovementType,
  stock?: number | null,
): { min: number; max?: number } {
  if (esAbsoluto(tipo)) return { min: 0 };
  if (tipo === 'salida' && typeof stock === 'number') return { min: 1, max: stock };
  return { min: 1 };
}

/**
 * El motivo por el que esta cantidad no se puede aplicar, o `null`.
 *
 * Devuelve la FRASE y no un booleano porque el mensaje es el que va inline bajo
 * el campo (§ Controles de formulario: el error de campo vive al lado del
 * problema). Un booleano obligaría a redactar el texto en el JSX, que es donde
 * las frases se desincronizan de la regla que las produce.
 *
 * Vacío no es un error: es un campo sin llenar, y de eso se encarga el botón
 * deshabilitado. Marcar en rojo lo que todavía no se escribió es regañar por
 * estar escribiendo.
 */
export function errorDeCantidad(
  tipo: InventoryMovementType,
  cantidad: string,
  stock?: number | null,
): string | null {
  const texto = cantidad.trim();
  if (!texto) return null;

  const n = Number(texto);
  if (!Number.isFinite(n)) return 'Escribe un número.';
  if (!Number.isInteger(n)) return 'El stock se mueve en unidades enteras.';

  const { min, max } = limitesDeCantidad(tipo, stock);
  if (n < min) {
    return min === 0
      ? 'La cantidad no puede ser negativa.'
      : 'Un movimiento de cero no mueve nada.';
  }
  if (typeof max === 'number' && n > max) {
    // Se nombra el número disponible en vez de decir "excede el stock": el
    // operador tiene que corregir a UN valor, y decírselo le ahorra volver a la
    // pantalla de atrás.
    return max === 1
      ? 'Sólo hay 1 unidad disponible.'
      : `Sólo hay ${max} unidades disponibles.`;
  }
  return null;
}
