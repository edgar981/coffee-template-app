// El CRUCE entre lo GUARDADO (`SiteSetting.metodosPasarela`, lo que el dueño eligió ofrecer)
// y lo que la CUENTA del proveedor tiene realmente habilitado (`consultarMetodosAceptados`,
// `lib/pagos/wompi-api.ts`) — puro, capa 1 (§ API-DIRECTA-PANEL-METODOS-1). La pantalla sólo
// dibuja lo que esta función devuelve; no reimplementa el cruce.
//
// TRES ESTADOS, y son los únicos que un tipo puede tener:
//   - 'disponible'            : está en las DOS listas — el dueño lo ofrece y su cuenta lo
//                                sostiene. Editable: apagarlo lo saca de lo guardado.
//   - 'guardado_no_disponible': está guardado, pero la cuenta YA NO lo tiene. No se borra
//                                solo (sería una escritura que nadie pidió, y escondería el
//                                desalineo) — el dueño lo ve marcado y sólo puede QUITARLO.
//   - 'disponible_no_ofrecido': la cuenta lo tiene, pero el dueño no lo ofrece todavía.
//                                Editable: prenderlo lo agrega a lo guardado.

export type EstadoMetodoPasarela = 'disponible' | 'guardado_no_disponible' | 'disponible_no_ofrecido';

export interface MetodoPasarelaCruzado {
  tipo: string;
  estado: EstadoMetodoPasarela;
}

/**
 * Cruza la lista GUARDADA contra la lista de la CUENTA. El orden del resultado es: primero
 * los tipos de la CUENTA (en el orden que el proveedor los devuelve, que es la lista que el
 * dueño va a leer para decidir qué prender), y al final los GUARDADOS que la cuenta ya no
 * sostiene — para que un método rancio no se mezcle entre los vigentes.
 */
export function cruzarMetodosPasarela(guardados: string[], cuenta: string[]): MetodoPasarelaCruzado[] {
  const guardadosSet = new Set(guardados);
  const cuentaSet = new Set(cuenta);

  const out: MetodoPasarelaCruzado[] = cuenta.map(tipo => ({
    tipo,
    estado: guardadosSet.has(tipo) ? 'disponible' : 'disponible_no_ofrecido',
  }));

  for (const tipo of guardados) {
    if (!cuentaSet.has(tipo)) out.push({ tipo, estado: 'guardado_no_disponible' });
  }

  return out;
}
