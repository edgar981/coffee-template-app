import { hayCambios } from '@duna/core/forms';

// ─── QUÉ IMPIDE GUARDAR UNA PROGRAMACIÓN DE ENTREGA ──────────────────────────
//
// El caso reportado: "Programar entrega" dejaba Guardar activo aunque no se
// hubiera tocado nada, así que se podía guardar una entrega sin fecha y sin un
// solo cambio. Mismo patrón que `problemaDeNuevaOrden`: se devuelve el PROBLEMA,
// no un booleano, para que el botón deshabilitado diga qué falta.
//
// El "sucio" se mide contra el snapshot PRESENTADO al abrir —el que ya incluye
// los defaults inteligentes (zona sugerida, último mensajero)—, no contra los
// valores crudos del Shipping. Así "abrir sin tocar nada" queda sin cambios
// aunque el sistema haya pre-llenado un par de campos: lo que el operador ve es
// la línea de base, y aceptar una sugerencia sin tocarla no es una edición.

/** Los campos que el operador puede tocar en el modal. Order-owned data (número,
 *  cliente, dirección, costo) no está: viene de la orden y no se edita acá. */
export interface ProgramacionSnapshot {
  zona:           string;
  mensajero:      string;
  fecha:          string;
  notas:          string;
  tipoEnvio:      string;
  transportadora: string;
  numeroGuia:     string;
}

export type CampoProblemaEntrega = 'direccion' | 'sin_cambios';

export interface ProblemaGuardarEntrega {
  campo:   CampoProblemaEntrega;
  mensaje: string;
}

/** ¿La programación difiere de como abrió el modal? El mismo cálculo que usa la
 *  guarda de descarte al cerrar. */
export function hayCambiosProgramacion(
  actual: ProgramacionSnapshot,
  inicial: ProgramacionSnapshot,
): boolean {
  return hayCambios(actual, inicial);
}

/**
 * El PRIMER problema que impide guardar, o `null`.
 *
 * La dirección va primero: sin ella no hay entrega que programar, y su ausencia
 * ya tiene su propio aviso ámbar con el botón de agregarla. El "no hay cambios"
 * es el problema nuevo de esta tanda.
 */
export function problemaGuardarEntrega(
  actual: ProgramacionSnapshot,
  inicial: ProgramacionSnapshot,
  hasAddress: boolean,
): ProblemaGuardarEntrega | null {
  if (!hasAddress) {
    return { campo: 'direccion', mensaje: 'Agrega una dirección de entrega para poder guardar' };
  }
  if (!hayCambiosProgramacion(actual, inicial)) {
    return { campo: 'sin_cambios', mensaje: 'No hay cambios que guardar' };
  }
  return null;
}
