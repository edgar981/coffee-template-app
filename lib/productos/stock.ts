import { isLowStock, type StockRef } from '@duna/core/metrics/inventory-filters';

// ─── LO QUE LA TARJETA DICE DEL STOCK ────────────────────────────────────────
//
// DUNA-DS.md pide "un indicador de inventario de cuántos quedan, número en color
// diferencial si el producto se está agotando" y "un chip que indique si el
// producto está disponible o agotado". Esto resuelve las dos cosas, y vive en
// `lib/` y no dentro del componente por el criterio de siempre: el vocabulario ES
// la decisión de producto, y un `if` cambiado dentro del JSX rompería la respuesta
// a "¿tengo que reponer esto?" sin que nada lo notara.
//
// ── SIN BARRA · DECISIÓN DEL OWNER ──────────────────────────────────────────
//
// `.duna-stock-meter` existe en el sistema y NO se usa. Una barra a media asta
// afirma "estás a la mitad de algo", y ese algo sería `stock_minimo × K`
// inventado: el dominio no tiene `stock_maximo`. El operador no puede saber que
// el denominador es arbitrario, así que la barra afirmaría una proporción que
// nadie decidió. El número en color dice lo mismo sin mentir.
//
// Y "qué tan por encima del punto de reposición estoy" es LA PREGUNTA DE
// INVENTARIO, no de Productos: meterla en la ficha sería mover la vista de
// reposición al sitio equivocado, contra la frontera que se acordó.
//
// DISPARADOR: si algún día existe `stock_maximo`, el medidor tiene su dato y esta
// decisión se revisa.

/** Qué dice el NÚMERO de un producto. */
export type NivelStock = 'agotado' | 'bajo' | 'ok';

// ── LA COSTURA QUE HAY QUE TENER ESCRITA ────────────────────────────────────
//
// Hay DOS preguntas distintas sobre el mismo stock y no siempre dan lo mismo:
//
//   `nivelStock`  — el HECHO del número. Ignora `activo`: 0 unidades es 0
//                   unidades esté el producto publicado o no.
//   `isLowStock`  — la ALERTA. Excluye los inactivos a propósito, porque un
//                   producto despublicado no es una reposición pendiente. Es la
//                   que cuentan la card del dashboard, el filtro de Inventario,
//                   el punto sol del nav y la automatización `stock_bajo`.
//
// Divergen EXACTAMENTE en un caso: un producto INACTIVO bajo su mínimo. Su
// tarjeta dice "3 · por reponer" y el carril "Por reponer" no lo cuenta. Eso es
// correcto y no es una incoherencia de las que este repo persigue: la tarjeta
// DESCRIBE lo que tiene delante, el carril CONVOCA trabajo. Y la tarjeta de un
// inactivo ya lleva su badge "Inactivo", que es el hecho más importante sobre él.
//
// Se escribe acá porque es justo el tipo de rareza que en dos meses alguien
// reporta como defecto — igual que "Por cobrar $0 con 20 pendientes".

/**
 * El nivel del número, sin mirar `activo`.
 *
 * `agotado` gana sobre `bajo` porque cero es un hecho más fuerte que "poco", y
 * porque la tienda ya no lo puede vender. El umbral de `bajo` sale del MISMO
 * predicado que la alerta (`isLowStock`), forzando `activo: true` para preguntar
 * sólo por el número — así el corte no puede desincronizarse del que cuenta el
 * dashboard.
 */
export function nivelStock(p: StockRef): NivelStock {
  if (p.stock === 0) return 'agotado';
  return isLowStock({ ...p, activo: true }) ? 'bajo' : 'ok';
}

/** La palabra que acompaña al número. `null` cuando no hay nada que decir. */
export function etiquetaStock(p: StockRef): string | null {
  switch (nivelStock(p)) {
    case 'agotado': return 'Agotado';
    case 'bajo':    return 'Por reponer';
    // EL ESTADO NORMAL NO SE ETIQUETA. Un "Disponible" en cada tarjeta teñiría la
    // lista entera de una palabra que no mueve ninguna decisión — la misma regla
    // por la que un cliente sin pendientes no lleva badge y "Sin programar" va
    // neutro. Se etiqueta la EXCEPCIÓN.
    case 'ok':      return null;
  }
}

/**
 * La clase del sistema para el número, según su nivel.
 *
 * `.duna-stock-txt` sólo define `is-low` e `is-out`: el estado normal no tiene
 * clase porque no tiene tratamiento. Devolver `''` y no una clase vacía inventada
 * mantiene esa propiedad a la vista.
 */
export function claseStock(p: StockRef): string {
  const nivel = nivelStock(p);
  if (nivel === 'agotado') return 'duna-stock-txt is-out';
  if (nivel === 'bajo')    return 'duna-stock-txt is-low';
  return 'duna-stock-txt';
}
