import type { CustomerForm } from '@/types/customer';
import { hayCambios } from '@duna/core/forms';

// ─── QUÉ IMPIDE GUARDAR UN CLIENTE · UNA definición, DOS consumidores ─────────
//
// Espeja `problemaDeNuevaOrden`: devuelve el PROBLEMA y no un booleano, para que
// el botón pueda deshabilitarse Y DECIR qué falta. La diferencia con crear un
// pedido es que acá el drawer también EDITA un cliente que ya existe, así que
// aparece un problema nuevo: que no haya nada que guardar.
//
// El "no hay cambios" sólo aplica en EDICIÓN. En el alta el estado inicial vacío
// es legítimo —el operador todavía no escribió nada— y el obligatorio (nombre)
// ya bloquea el botón; por eso `inicial` es `null` cuando se está creando.

export type CampoProblemaCliente = 'nombre' | 'sin_cambios';

export interface ProblemaGuardarCliente {
  campo:   CampoProblemaCliente;
  mensaje: string;
}

/** ¿El formulario difiere del cliente con el que abrió? Es el mismo cálculo que
 *  usa la guarda de descarte al cerrar — un solo "sucio" para las dos preguntas. */
export function hayCambiosCliente(form: CustomerForm, inicial: CustomerForm): boolean {
  return hayCambios(form, inicial);
}

/**
 * El PRIMER problema que impide guardar, o `null`. El orden es el del
 * formulario: el nombre está arriba, así que su falta se reporta antes que "no
 * hay cambios".
 *
 * @param inicial El cliente con el que abrió el drawer, o `null` en alta.
 */
export function problemaGuardarCliente(
  form: CustomerForm,
  inicial: CustomerForm | null,
): ProblemaGuardarCliente | null {
  if (!form.nombre.trim()) {
    return { campo: 'nombre', mensaje: 'El nombre es requerido' };
  }
  if (inicial && !hayCambiosCliente(form, inicial)) {
    return { campo: 'sin_cambios', mensaje: 'No hay cambios que guardar' };
  }
  return null;
}
