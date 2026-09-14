import { createHash, timingSafeEqual } from 'node:crypto';

// ── EL VERIFICADOR DE FIRMA DE EVENTOS DE WOMPI ──────────────────────────────
//
// Primera pieza del webhook: pura, sin ruta, sin base, sin `process.env`. Verifica
// que un evento recibido lo firmó Wompi con el secreto de eventos de la cuenta.
//
// LA FÓRMULA (medida contra la doc y confirmada por el spike de sandbox,
// `WOMPI-SPIKE-SANDBOX-1`):
//
//   sha256_hex( <valores de los campos que `signature.properties` lista, EN ESE
//               ORDEN, resueltos dentro de `data`>
//               + timestamp
//               + <secreto de eventos> )
//
// Concatenación PLANA, sin separadores. El resultado llega en el header
// `X-Event-Checksum` y también en `signature.checksum` del cuerpo — medidos como
// el MISMO valor.
//
// TRES REGLAS QUE NO SE NEGOCIAN, cada una pagada con una medición (ver el spec
// del slice, `WOMPI-FIRMA-VERIFICADOR-1`):
//
//   a) `properties` SE LEE DEL EVENTO, nunca de una lista fija — la propia doc de
//      Wompi advierte que varía por evento y en el tiempo.
//   b) Los `properties` son RUTAS CON PUNTOS dentro de `data` (`transaction.id` =
//      `data.transaction.id`), resueltas a CUALQUIER PROFUNDIDAD.
//   c) NO SE CALIBRA CONTRA EL EJEMPLO NUMÉRICO DE LA DOC — está medido que no
//      reproduce (la concatenación, confirmada carácter a carácter, da un sha256
//      distinto del que la página afirma). La fórmula en prosa no está en duda; su
//      ejemplo sí. **La doc de Wompi no es fuente de verdad** (regla ya en el
//      ledger: cinco discrepancias medidas contra el sandbox).
//
// EL CHECKSUM RECIBIDO SE TOMA DE `evento.signature.checksum` (el cuerpo), no de un
// header: esta función recibe "el evento ya parseado", y un header no es parte de
// eso — leerlo es responsabilidad de la ruta (Tier 1, slice siguiente), que si
// quiere puede pasarlo acá como `checksumHeader`. Cuando se pasa, y DIFIERE del que
// trae el cuerpo, la discrepancia se trata como una firma inválida — no se elige
// cuál de los dos "creer": dos fuentes que deberían decir lo mismo y no coinciden
// es una señal de manipulación por derecho propio, así que se falla cerrado sin
// intentar decidir cuál ganaría.
//
// UNA RUTA QUE NO RESUELVE (`properties` con un campo ausente, `null`, o un objeto
// en vez de un escalar) hace que la función LANCE `RutaDePropertyNoResuelveError`,
// en vez de devolver `false` en silencio. Es una decisión: una ruta rota no es "la
// firma no coincide" (que compara HASHES), es "el evento no tiene la forma que
// `properties` promete" — un caso distinto que el llamador debe poder distinguir
// de un intento de forjar la firma, y que callar dentro de un `false` genérico
// escondería. Fallar con un error específico, documentado y con test, es lo que
// evita la trampa: rellenar el hueco con `''` u otro valor por defecto metería un
// dato inventado dentro del hash, lo que podría validar (o invalidar) una firma
// por una razón que nadie decidió a propósito.

/** Un evento de Wompi ya parseado (el body del webhook), en lo mínimo que hace
 * falta para verificar su firma. */
export interface EventoWompi {
  /** El payload del evento; los `properties` son rutas dentro de este objeto. */
  data: Record<string, unknown>;
  /** El timestamp que participa en la fórmula, tal como llega en el evento. */
  timestamp: number | string;
  signature: {
    /** Los campos a concatenar, EN ESE ORDEN — se leen de acá, nunca de una lista fija. */
    properties: string[];
    /** El checksum que Wompi calculó, tal como viaja en el cuerpo. */
    checksum: string;
  };
}

/** Una ruta de `signature.properties` no resolvió a un valor escalar dentro de
 * `data` (campo ausente, `null`, o un objeto/array en el destino). */
export class RutaDePropertyNoResuelveError extends Error {
  constructor(public readonly ruta: string) {
    super(`El property "${ruta}" no resuelve a un valor escalar dentro de \`data\``);
    this.name = 'RutaDePropertyNoResuelveError';
  }
}

function resolverRuta(data: Record<string, unknown>, ruta: string): string {
  let actual: unknown = data;
  for (const parte of ruta.split('.')) {
    if (actual === null || typeof actual !== 'object') {
      throw new RutaDePropertyNoResuelveError(ruta);
    }
    actual = (actual as Record<string, unknown>)[parte];
  }
  if (actual === null || actual === undefined) throw new RutaDePropertyNoResuelveError(ruta);
  const tipo = typeof actual;
  if (tipo !== 'string' && tipo !== 'number' && tipo !== 'boolean') {
    throw new RutaDePropertyNoResuelveError(ruta);
  }
  return String(actual);
}

/** Compara dos strings en tiempo constante. `timingSafeEqual` lanza si los largos
 * difieren, así que ese caso se resuelve ANTES y devuelve `false` derecho — el largo
 * de un sha256 hex es fijo (64) y público, no depende del secreto, así que
 * compararlo primero no filtra nada que la firma ya no exponga. */
function compararConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifica la firma de un evento de Wompi.
 *
 * @param evento El evento ya parseado (el body del webhook).
 * @param secretoEventos El secreto de eventos de la cuenta Wompi. Entra como
 *   parámetro — la función no lee `process.env`; quien la llame decide de dónde sale.
 * @param checksumHeader Opcional: el checksum leído del header `X-Event-Checksum`,
 *   si el llamador lo tiene. Si se pasa y difiere de `evento.signature.checksum`,
 *   la firma se da por inválida (ver el porqué arriba).
 * @throws {RutaDePropertyNoResuelveError} si algún campo de `signature.properties`
 *   no resuelve a un escalar dentro de `data`.
 */
export function verificarFirmaWompi(
  evento: EventoWompi,
  secretoEventos: string,
  checksumHeader?: string,
): boolean {
  const checksumCuerpo = evento.signature.checksum;

  if (checksumHeader !== undefined && !compararConstante(checksumHeader, checksumCuerpo)) {
    return false;
  }

  const valores = evento.signature.properties.map((ruta) => resolverRuta(evento.data, ruta));
  const cadena = valores.join('') + String(evento.timestamp) + secretoEventos;
  const checksumCalculado = createHash('sha256').update(cadena).digest('hex');

  return compararConstante(checksumCalculado, checksumCuerpo);
}
