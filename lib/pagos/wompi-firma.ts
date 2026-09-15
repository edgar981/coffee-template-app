import { createHash, timingSafeEqual } from 'node:crypto';

// ── LAS DOS FIRMAS DE WOMPI ───────────────────────────────────────────────────
//
// Este archivo cubre las DOS mitades de "wompi-firma": la que VERIFICAMOS (un
// evento que Wompi nos manda) y la que CALCULAMOS (una petición que NOSOTROS
// iniciamos). Son fórmulas y secretos DISTINTOS — `WOMPI_EVENTS_SECRET` para la
// primera, `WOMPI_INTEGRITY_SECRET` para la segunda — y confundirlas es el error
// clásico que el nombre de cada variable ya existe para evitar
// (`WOMPI-REGLAS-IMPLEMENTACION-1`, DECISIONS.md). Hasta `WOMPI-CREADOR-DE-
// INTENTOS-1` este archivo sólo tenía la primera mitad — verificado con grep
// antes de tocarlo: cero referencias a `WOMPI_INTEGRITY_SECRET` en todo el repo.
//
// Las dos comparten el mismo principio de diseño: NUNCA leen `process.env` — el
// secreto entra como parámetro, y es la RUTA quien decide de dónde sale.
//
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

// ── LA CONVERSIÓN A CENTAVOS — un `Float` que se multiplica por 100 NO SIEMPRE
// da el entero que parece ────────────────────────────────────────────────────
//
// Wompi cobra un ENTERO de centavos (`amount_in_cents`). Nuestros montos son
// `Float` en pesos (`Order.total`, `PaymentIntent.monto_esperado`) — y en COP no
// hay fracción de peso, pero el TIPO sí la permite, y ahí está la trampa: medido
// en Node, `4.35 * 100 === 434.99999999999994` y `19.99 * 100 ===
// 1998.9999999999998`. Truncar (`Math.trunc`, `| 0`) esos valores da 434/1998 —
// UN CENTAVO MENOS que el monto real. El error de coma flotante de un monto real
// es de una fracción minúscula de centavo, muy por debajo del umbral de 0.5 que
// `Math.round` necesita para cambiar de dirección, así que redondear es la
// corrección exacta, nunca una aproximación.
export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

// ── LA FIRMA DE INTEGRIDAD — la petición que NOSOTROS iniciamos ─────────────
//
// A diferencia de `verificarFirmaWompi` (que verifica un evento que WOMPI nos
// manda), ésta CALCULA la firma de una petición que iniciamos nosotros — crear
// una transacción. Fórmula medida contra el sandbox y verificada byte a byte
// contra el ejemplo de la doc (a diferencia del ejemplo de checksum de eventos,
// que NO reproduce — ver arriba): `WOMPI-REGLAS-IMPLEMENTACION-1`, DECISIONS.md.
//
//   sha256_hex(reference + amount_in_cents + currency + <secreto de integridad>)
//
// Concatenación PLANA, sin separadores, en ese orden — mismo patrón que el
// verificador de eventos. `amount_in_cents` participa como STRING decimal (sin
// separadores de miles, sin signo), igual que cualquier otro campo de la cadena.
/**
 * @param reference La referencia del `PaymentIntent` (formato "<numero_orden>:
 *   <cuid de la fila>" — ver el comentario del modelo en schema.prisma).
 * @param amountInCents El monto en CENTAVOS — el mismo valor, calculado UNA sola
 *   vez, que se guarda como snapshot y se le manda a Wompi (`pesosACentavos`
 *   arriba). Pasar dos cálculos distintos del mismo monto es cómo la firma
 *   termina describiendo un cobro que no es el que se registra.
 * @param currency El código de moneda ISO tal como lo espera Wompi (`'COP'`).
 * @param secretoIntegridad El secreto de integridad de la cuenta Wompi. Entra
 *   como parámetro — este módulo no lee `process.env`.
 */
export function firmarIntegridadWompi(
  reference: string,
  amountInCents: number,
  currency: string,
  secretoIntegridad: string,
): string {
  const cadena = reference + String(amountInCents) + currency + secretoIntegridad;
  return createHash('sha256').update(cadena).digest('hex');
}
