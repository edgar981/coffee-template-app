// Las DOS aceptaciones que el comprador tiene que marcar para pagar por la pasarela — puro,
// SEPARADO de la llamada HTTP (`lib/pagos/wompi-api.ts`, `consultarAceptaciones`) para poder
// testear la regla sin red (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1).
//
// UN TOKEN SIN SU ENLACE NO SIRVE: el comprador tiene que poder ABRIR el documento que está
// aceptando, no sólo mandar un token opaco a la pasarela. Y las DOS aceptaciones —términos y
// condiciones de uso, autorización de tratamiento de datos personales, § API-DIRECTA-
// DECISIONES-PROGRAMA-1 §4, DECISIONS.md— tienen que llegar completas LAS DOS: sin cualquiera
// de las dos la transacción no se puede crear, así que el checkout no puede ofrecer el pago
// con sólo una.
//
// EL RESULTADO ES `null` PARA "FALTA ALGO" — nunca un objeto vacío ni uno a medias. Mismo
// patrón que ya usa `opcionTransferencia` (`lib/checkout/transferencia.ts`) para su propio
// "no a medias": el llamador nunca puede confundir "incompleto" con "completo pero vacío",
// porque esa forma intermedia no existe.

import type { AceptacionWompi, AceptacionesWompi } from '@/types/payment';
import { DESCRIPTORES_METODO_PASARELA } from './metodos-pasarela';

/**
 * Un campo tal como llegó del proveedor, SIN validar si sirve — `null` si faltó, si no era
 * texto, o si el sobre entero no se pudo leer. La capa HTTP (`wompi-api.ts`) lo extrae; esta
 * capa decide si es usable.
 */
export interface AceptacionCruda {
  token:  string | null;
  enlace: string | null;
}

export interface AceptacionesCrudas {
  terminos:        AceptacionCruda;
  datosPersonales: AceptacionCruda;
}

function completa(cruda: AceptacionCruda): AceptacionWompi | null {
  const token = (cruda.token ?? '').trim();
  const enlace = (cruda.enlace ?? '').trim();
  if (!token || !enlace) return null;
  return { token, enlace };
}

/**
 * Las dos aceptaciones, o `null` si a CUALQUIERA de las dos le falta el token o el enlace.
 * Nunca un resultado a medias: o las dos completas, o nada — porque sin las dos la
 * transacción no se puede crear (§ arriba).
 */
export function evaluarAceptaciones(crudas: AceptacionesCrudas): AceptacionesWompi | null {
  const terminos = completa(crudas.terminos);
  const datosPersonales = completa(crudas.datosPersonales);
  if (!terminos || !datosPersonales) return null;
  return { terminos, datosPersonales };
}

// § CHECKOUT-UNA-SOLA-PANTALLA-1: la etiqueta de la opción de pasarela en el selector de
// método — antes un texto FIJO ("Tarjeta de crédito o débito") que era falso en cuanto la
// cuenta ofrecía un método más (Nequi…): el comprador elegía esa opción esperando SÓLO
// tarjeta y se encontraba un selector con más adentro. Se GENERA desde los tipos QUE NO SON
// TARJETA que el servidor ya calculó para este comprador (`metodosOtros`, § el bloque de
// `obtenerBloqueAceptacionPasarela`) — nunca se recalcula acá qué tipos están disponibles.
//
// NUNCA el nombre del proveedor: el comprador le compra a la tienda, no a Wompi — y ésta es
// justo la etiqueta del modo API DIRECTA, que existe para no mostrar la marca de la pasarela.
//
// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice, igual que el resto
// del copy de este programa).

/** Une una lista de nombres en español con comas y un "y" final — "Nequi", "Nequi y
 *  Daviplata", "Nequi, Daviplata y Bre-B". Exportada aparte de `etiquetaMetodoPasarela` para
 *  poder afirmar el ARMADO de la lista sin depender de cuántas entradas tenga hoy el registro
 *  de descriptores. */
export function unirNombresConY(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export function etiquetaMetodoPasarela(metodosOtros: string[]): string {
  const nombres = metodosOtros
    .map((tipo) => DESCRIPTORES_METODO_PASARELA[tipo]?.nombreVisible)
    .filter((n): n is string => Boolean(n));
  if (nombres.length === 0) return 'Tarjeta de crédito o débito';
  return unirNombresConY(['Tarjeta', ...nombres]);
}
