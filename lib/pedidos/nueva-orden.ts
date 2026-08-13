import type { OrderForm, OrderLineForm } from '@/types/order';

// ─── QUÉ FALTA PARA CREAR UN PEDIDO · UNA definición, DOS consumidores ────────
//
// La consumen el BOTÓN (para deshabilitarse) y el SUBMIT (para decir qué falta).
// Que sea una sola función no es economía: mientras fueron dos, ya divergían.
//
// ── LA DIVERGENCIA QUE ESTO CIERRA, que estaba viva ─────────────────────────
//
// En `/admin/ordenes` el `disabled` del botón y la cadena de validaciones del
// submit afirmaban cosas distintas sobre el mismo formulario:
//
//   · el `disabled` miraba `!form.cliente_nombre` SIN `trim`, y el submit con él
//     → un nombre de puros espacios habilitaba el botón y moría en un toast;
//   · el `disabled` no sabía nada de la molienda ni del "pago ya recibido"
//     → esos dos sólo aparecían DESPUÉS de pulsar, con el formulario completo.
//
// Ninguna de las dos es "la correcta": el defecto es que fueran dos.
//
// ── POR QUÉ DEVUELVE EL PROBLEMA Y NO UN BOOLEANO ───────────────────────────
//
// Porque el booleano se deriva del problema y no al revés. Con el problema, el
// botón puede deshabilitarse Y DECIR qué falta — que es la única forma en que
// este repo admite un control deshabilitado (§ "Marcar en ruta" sin mensajero:
// se muestra deshabilitado diciendo qué falta, porque esconderlo mandaría al
// operador a buscar la acción en otra pantalla). Un botón muerto y mudo es una
// pregunta.
//
// El ORDEN de los chequeos es el orden en que se llena el formulario, no un
// ranking de gravedad: el operador tiene que encontrar lo que falta donde está
// mirando, no que lo manden al final del formulario y de vuelta arriba.

/** Lo que la regla necesita saber de un producto del catálogo. Estructural, no
 *  el tipo `Product` entero: así el test arma un catálogo de dos líneas. */
export interface ProductoParaLinea {
  slug:   string;
  nombre: string;
  moliendasOpciones?: { nombre: string; disponible: boolean }[] | null;
}

export type CampoNuevaOrden =
  | 'cliente_nombre' | 'contacto' | 'items' | 'molienda' | 'metodoPagoPrevisto';

export interface ProblemaNuevaOrden {
  /** Qué campo lo causa — para que la UI pueda marcarlo, no sólo contarlo. */
  campo:   CampoNuevaOrden;
  /** El texto que ve el operador. Vive acá, con la regla, por lo de siempre:
   *  el vocabulario ES la decisión, y así se puede afirmar en la capa 1. */
  mensaje: string;
}

/** Las líneas que cuentan: las que tienen producto elegido. Una fila vacía es
 *  una fila que el operador todavía no llenó, no un error. */
export const lineasConProducto = (form: OrderForm): OrderLineForm[] =>
  form.items.filter(l => l.slug);

/**
 * El PRIMER problema que impide crear el pedido, o `null` si no hay ninguno.
 *
 * Espeja las reglas del servidor a propósito —el server sigue siendo el que
 * manda— pero acá el objetivo es otro: que el operador no gaste un viaje para
 * enterarse de algo que se sabe en el navegador.
 */
export function problemaDeNuevaOrden(
  form: OrderForm,
  catalogo: readonly ProductoParaLinea[],
): ProblemaNuevaOrden | null {
  // `trim` en las TRES, y es lo que el `disabled` no hacía: un espacio no es un
  // nombre, ni un teléfono, ni un correo.
  if (!form.cliente_nombre.trim()) {
    return { campo: 'cliente_nombre', mensaje: 'El nombre del cliente es requerido' };
  }

  // Al menos UNO de los dos. Los pedidos reales llegan por WhatsApp, así que un
  // teléfono solo alcanza — exigir correo dejaría fuera al caso normal.
  if (!form.cliente_email.trim() && !form.cliente_telefono.trim()) {
    return { campo: 'contacto', mensaje: 'Ingresa al menos un teléfono o correo del cliente' };
  }

  const lineas = lineasConProducto(form);
  if (lineas.length === 0) {
    return { campo: 'items', mensaje: 'Agrega al menos un producto' };
  }

  // La molienda es obligatoria SÓLO si el producto ofrece opciones. Un producto
  // en grano no tiene ninguna y no debe pedir nada.
  for (const l of lineas) {
    const p = catalogo.find(x => x.slug === l.slug);
    const ofrece = (p?.moliendasOpciones?.length ?? 0) > 0;
    if (ofrece && !l.molienda) {
      return {
        campo:   'molienda',
        mensaje: `Selecciona la molienda para ${p?.nombre ?? 'el producto'}`,
      };
    }
  }

  // "Ya pagado" necesita un método CONCRETO: un Payment sin instrumento no es un
  // asiento, es una afirmación. `EFECTIVO` no llega acá — el formulario lo
  // desmarca al elegirlo (efectivo ⇒ contraentrega, se cobra al entregar).
  if (form.pagoRecibido && !form.metodoPagoPrevisto) {
    return {
      campo:   'metodoPagoPrevisto',
      mensaje: 'Selecciona el método de pago para marcar la orden como pagada',
    };
  }

  return null;
}
