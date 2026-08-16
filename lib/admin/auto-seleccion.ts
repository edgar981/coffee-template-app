// ─── AUTO-SELECCIÓN del split en escritorio ──────────────────────────────────
//
// Qué debe estar seleccionado cuando el CONJUNTO VISIBLE cambia (cambió el
// carril, el rango de fechas, o el buscador — todos alimentan la misma lista
// filtrada). Compartida por Pedidos y Clientes; pura y testeable para poder
// afirmar el mecanismo (la re-evaluación) sin montar la pantalla.
//
// La regla (decidida por el owner):
//   · el seleccionado SIGUE en el carril nuevo → se conserva. Filtrar acota, no
//     deselecciona.
//   · NO está en el carril nuevo → se selecciona el primero de la lista.
//   · carril nuevo VACÍO → se limpia (placeholder, no panel rancio).
//   · en la PRIMERA evaluación (carga inicial) el deep link `?pedido=`/`?cliente=`
//     GANA: una selección venida de la URL se respeta aunque no esté en el carril.
//     Sin selección, se auto-selecciona el primero como siempre.
//
// El defecto que cierra: el efecto viejo bailaba con `if (… seleccion …) return`,
// así que sólo corría al montar y nunca re-evaluaba al cambiar el conjunto — y el
// panel resolvía el elegido contra la lista COMPLETA, no la filtrada, dejando un
// pedido de otro carril en pantalla.

export type SeleccionAuto =
  | { tipo: 'conservar' }
  | { tipo: 'seleccionar'; id: string }
  | { tipo: 'limpiar' };

export function autoSeleccion({ seleccion, idsVisibles, primeraVez }: {
  /** Lo seleccionado hoy (de la URL), o `null`. */
  seleccion: string | null;
  /** Los ids del conjunto VISIBLE (ya filtrado por carril/rango/búsqueda), en
   *  orden — el primero es el que se auto-selecciona. */
  idsVisibles: readonly string[];
  /** ¿Es la primera evaluación tras cargar? Ahí el deep link gana. */
  primeraVez: boolean;
}): SeleccionAuto {
  if (primeraVez) {
    // El deep link gana: si la URL trae selección, se respeta tal cual.
    if (seleccion !== null) return { tipo: 'conservar' };
    return idsVisibles.length > 0 ? { tipo: 'seleccionar', id: idsVisibles[0] } : { tipo: 'conservar' };
  }
  // Evaluaciones posteriores: el conjunto visible cambió.
  if (seleccion !== null && idsVisibles.includes(seleccion)) return { tipo: 'conservar' };
  if (idsVisibles.length > 0) return { tipo: 'seleccionar', id: idsVisibles[0] };
  // Vacío: sólo hay algo que limpiar si había una selección.
  return seleccion !== null ? { tipo: 'limpiar' } : { tipo: 'conservar' };
}
