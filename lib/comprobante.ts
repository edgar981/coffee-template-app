import {
  TIPOS_COMPROBANTE, MAX_COMPROBANTE_BYTES, MAX_COMPROBANTE_MB,
} from '@/constants/comprobante';
import type { SemaphoreTone } from '@/components/ui/StatusBadge';

// ─── Las reglas del comprobante, puras ───────────────────────────────────────
//
// `Payment` es la plata; `Comprobante` es la evidencia (documento Duna §3.1). De
// esa separación salen decisiones que NO son de presentación y que por eso viven
// acá, testeadas en capa 1:
//
//   • qué archivo se acepta —la MISMA función la corren el formulario (aviso
//     temprano) y el endpoint (la que manda), para que no puedan discrepar sobre
//     qué es un comprobante válido;
//   • qué pasa al VERIFICAR, que depende de si la plata ya existe;
//   • qué transiciones de estado son legales.

export type ComprobanteEstado = 'RECIBIDO' | 'VERIFICADO' | 'RECHAZADO';

// ─── Validación del archivo ──────────────────────────────────────────────────

export interface ArchivoComprobante {
  type: string;
  size: number;
  name?: string;
}

/**
 * `null` = el archivo sirve. Si no, LA FRASE que se le muestra al operador.
 *
 * Devuelve el mensaje y no un booleano porque el mensaje es el punto: "formato no
 * admitido" sin decir cuáles se admiten obliga a adivinar, y adivinar con un
 * archivo de 4 MB cuesta una subida.
 */
export function validarArchivoComprobante(archivo: ArchivoComprobante): string | null {
  if (!archivo.size) return 'El archivo está vacío.';

  if (!(TIPOS_COMPROBANTE as readonly string[]).includes(archivo.type)) {
    return `Formato no admitido (${archivo.type || 'desconocido'}). Usa JPG, PNG, WebP o PDF.`;
  }

  if (archivo.size > MAX_COMPROBANTE_BYTES) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(1);
    return `El archivo pesa ${mb} MB y el máximo es ${MAX_COMPROBANTE_MB} MB.`;
  }

  return null;
}

/**
 * ¿Se muestra como IMAGEN o como documento?
 *
 * Un PDF no tiene miniatura: se rotula con un chip y se abre en pestaña nueva.
 * Nunca en el lightbox ni en un visor embebido — un `<img>` con un PDF adentro
 * no falla ruidosamente, se queda en blanco, y el operador cree que el
 * comprobante llegó roto cuando el archivo está perfecto.
 */
export function esImagen(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/** `1,2 MB` · `840 KB`. Para el chip de documento, donde el peso es el dato. */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

// ─── Presentación del estado ─────────────────────────────────────────────────

export interface EstadoComprobante {
  etiqueta: string;
  tono: SemaphoreTone;
  detalle: string;
}

/**
 * El badge del comprobante, con el semáforo ÚNICO de `StatusBadge`.
 *
 * RECHAZADO va NEUTRO y no rojo: el rojo del admin está reservado a lo que exige
 * una acción, y un comprobante rechazado ya se resolvió — alguien lo miró y
 * decidió. Pintarlo de alerta dejaría una orden vieja gritando para siempre por
 * algo que ya está cerrado.
 */
export function estadoComprobante(estado: ComprobanteEstado): EstadoComprobante {
  switch (estado) {
    case 'VERIFICADO':
      return {
        etiqueta: 'Verificado', tono: 'ok',
        detalle: 'Un humano confirmó que la plata entró.',
      };
    case 'RECHAZADO':
      return {
        etiqueta: 'Rechazado', tono: 'neutral',
        detalle: 'Se revisó y no sirve como soporte. El archivo se conserva.',
      };
    default:
      return {
        etiqueta: 'Recibido', tono: 'warn',
        detalle: 'Llegó el soporte, pero nadie lo ha verificado todavía.',
      };
  }
}

// ─── Qué pasa al verificar ───────────────────────────────────────────────────

/**
 * **La verificación CREA la plata, no al revés** (§3.1). Verificar un comprobante
 * de una orden que todavía no tiene Payment no puede limitarse a sellar la fila:
 * dejaría un comprobante "verificado" sobre una orden pendiente, que es
 * exactamente la contradicción que esta entidad existe para evitar.
 *
 * - `cobrar`: no hay plata todavía → se abre Registrar Pago pre-llenado, y el
 *   sello viene DESPUÉS del Payment.
 * - `sellar`: la plata ya está → verificar sólo estampa quién y cuándo.
 *
 * El ORDEN importa y no es reversible: primero el dinero, después la evidencia.
 * Si el sello falla tras un pago exitoso, queda una orden pagada con un
 * comprobante RECIBIDO — un segundo click lo cierra, porque ahí ya cae en
 * `sellar`. Al revés (sellar y que falle el pago) dejaría una evidencia
 * afirmando un cobro que nunca ocurrió.
 */
export type AccionVerificar = 'cobrar' | 'sellar';

export function accionAlVerificar(ordenEstado: string): AccionVerificar {
  return ordenEstado === 'pendiente' ? 'cobrar' : 'sellar';
}

/**
 * Transiciones legales. Sólo un `RECIBIDO` se verifica o se rechaza: los otros
 * dos ya son un veredicto humano, y re-verificar reescribiría quién decidió y
 * cuándo — el dato de auditoría que hace útil a la tabla.
 *
 * El servidor la corre igual que la UI; acá decide qué botones se ofrecen, allá
 * decide qué se acepta.
 */
export function puedeDecidirse(estado: ComprobanteEstado): boolean {
  return estado === 'RECIBIDO';
}

/**
 * CUÁNTOS soportes están sin mirar. Es la definición base de "sin verificar" —
 * el booleano de abajo se DERIVA de acá, no al revés.
 *
 * La inversión no es estética: el motivo de atención del detalle dice "1
 * comprobante sin verificar" con su número, y si contara por su cuenta habría dos
 * lugares donde el predicado `estado === 'RECIBIDO'` puede cambiar. Un conteo y un
 * booleano que discrepen sobre lo mismo es el modo de falla que este repo ya pagó
 * con helpers duplicados.
 */
export function cuantosSinVerificar(
  comprobantes: { estado: ComprobanteEstado }[],
): number {
  return comprobantes.filter(c => c.estado === 'RECIBIDO').length;
}

/**
 * ¿Esta orden tiene un soporte pendiente de mirar? Es lo que enciende el
 * indicador de la lista de Pagos y lo que un futuro aviso de la campana
 * consumiría — una sola definición, para que no diverjan.
 */
export function tienePendienteDeVerificar(
  comprobantes: { estado: ComprobanteEstado }[],
): boolean {
  return cuantosSinVerificar(comprobantes) > 0;
}

/**
 * Nombre legible del archivo, derivado de la URL del blob.
 *
 * NO hay columna `nombre_archivo`, y es deliberado: `storage.put` construye el
 * pathname con el nombre original ya saneado, así que la URL ya lo lleva —
 * duplicarlo en una columna sería un segundo lugar donde el mismo dato puede
 * decir otra cosa (el proveedor le agrega un sufijo aleatorio para hacerlo
 * único, y ese sufijo se conserva acá: es lo que distingue dos soportes subidos
 * con el mismo nombre).
 *
 * Cae a "Comprobante" si la URL no tiene nada aprovechable — un chip sin texto
 * no se puede clickear con confianza.
 */
export function nombreArchivo(url: string): string {
  try {
    const ultimo = new URL(url).pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(ultimo ?? '') || 'Comprobante';
  } catch {
    // URL relativa o basura: no se rompe la vista por un nombre.
    const ultimo = url.split('?')[0].split('/').filter(Boolean).pop();
    return ultimo || 'Comprobante';
  }
}
