import type { MetodoPagoTipo } from '@/lib/checkout/metodos-pago';
import type { AceptacionesWompi, ResultadoCreacionTransaccionWompi, TokenTarjetaWompi } from '@/types/payment';
import { PREFIJO_LLAVE_PASARELA_PRODUCTIVA } from '@/lib/pagos/llaves-pasarela';

export interface CheckoutPayload {
  customer: {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
  };
  shipping: {
    direccion: string;
    direccion_detalle?: string | null;   // "Apto, torre, interior…" optional
    ciudad: string;
    departamento: string;                // drives Bogotá detection server-side
    franja?: string | null;              // slot id ("am"/"pm"); Bogotá only
  };
  payment:
    | {
        // § CHECKOUT-BREB-CAST-1: importa el mismo tipo que el checkout usa para elegir el método
        // (`lib/checkout/metodos-pago.ts`), en vez de repetir sus cinco literales a mano — dos
        // declaraciones del mismo conjunto es la falla que ya se pagó con `CATEGORIAS`/
        // `CATEGORIA_LABELS` y con el schema editable de `presentaciones`.
        metodo: MetodoPagoTipo;
        referencia?: string;
      }
    | {
        // El camino APARTE de la pasarela (§ WOMPI-WIDGET-EN-EL-CANONICO-1) — NUNCA un valor
        // más de `metodo`/`METODOS_PAGO_ORDEN` (ese set cerrado es "lo que el dueño configura
        // en su panel"; la pasarela es un toggle de DESPLIEGUE, (d) — ver
        // `pasarelaDisponibleEnEsteDespliegue` más abajo).
        pasarela: true;
      };
  items: {
    slug: string;
    cantidad: number;
    /** Molienda elegida (debe ser una opción `disponible` del producto) */
    molienda?: string | null;
  }[];
}

/**
 * (d), MITAD ENCENDIDO (§ WOMPI-TOGGLE-DISPONIBILIDAD-1): la CAPACIDAD de pagar con la
 * pasarela es un interruptor de DESPLIEGUE, no un dato de negocio — por eso vive en una env
 * var y no en `SiteSetting`. Un despliegue que NO declara la variable (Nayoli incluida) ve
 * exactamente lo mismo que antes de este slice: la opción no aparece, y un POST directo que
 * la pida se rechaza.
 *
 * `PASARELA`, no `WOMPI`: nombra la CAPACIDAD, no el proveedor — si el agregador cambiara
 * algún día, la variable no quedaría mintiendo (las llaves sí llevan `WOMPI_`, porque ésas
 * son de Wompi). `NEXT_PUBLIC_` porque esta función se lee en el CLIENTE (`checkout/page.tsx`,
 * para mostrar u ocultar "Tarjeta, PSE y más") y en el SERVIDOR (`app/api/checkout/route.ts`,
 * para crear o rechazar el intento) — es la MISMA fuente en los dos lados, así que no pueden
 * divergir sobre si la pasarela está disponible.
 *
 * Es SÓLO el encendido. La redirección tras el pago (la ruta de vuelta del comprador) es (c)
 * y sigue sin construirse — esta función no la habilita.
 */
export function pasarelaDisponibleEnEsteDespliegue(): boolean {
  return process.env.NEXT_PUBLIC_PASARELA_HABILITADA === '1';
}

/**
 * El SEGUNDO interruptor de despliegue (§ API-DIRECTA-CAPTURA-TARJETA-1): cuando la pasarela
 * ESTÁ disponible (arriba), decide QUÉ camino ocupa esa misma ranura — el widget alojado por
 * Wompi (default, comportamiento de hoy) o la captura de tarjeta por API directa que este
 * slice agrega. **NUNCA se dibujan los dos**: son la misma cosa —tarjeta, capturada en dos
 * superficies distintas— y mostrarle las dos al comprador sería la duplicación que el modelo
 * de pagos (widget vs. API directa = DÓNDE se capturó, no una ruta de dinero distinta) existe
 * para evitar (`API-DIRECTA-DECISIONES-PROGRAMA-1` §1, DECISIONS.md).
 *
 * Se lee en el CLIENTE porque decide qué COMPONENTE se monta — no cambia nada del lado del
 * servidor: `POST /api/checkout` responde el mismo bloque `wompi` (con `publicKey` y
 * `aceptaciones`) sin importar cuál camino lo va a consumir. Por eso este interruptor no
 * necesita tocar `app/api/checkout/route.ts`.
 *
 * Sin la variable, el modo sigue siendo WIDGET: el comportamiento de hoy no cambia con este
 * slice a menos que un despliegue la encienda a propósito.
 */
export function pasarelaModoApiDirecta(): boolean {
  return process.env.NEXT_PUBLIC_PASARELA_MODO_API_DIRECTA === '1';
}

export interface CheckoutResultItem {
  producto_nombre: string;
  // La instantánea de la portada (§ CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1, `OrderItem.
  // producto_imagen`) — NUNCA se resuelve contra el producto vivo, misma razón que
  // `producto_nombre`/`precio_unitario` de abajo. Cadena vacía si el producto no tenía foto
  // al comprar; el render la pasa por `imagenPortada()` para el fallback, no acá.
  producto_imagen: string;
  moliendaSeleccionada?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

/**
 * La transacción de la pasarela, YA FIRMADA por el servidor (`app/api/checkout/route.ts`,
 * `firmarIntegridadWompi` — nunca firmada en el cliente). Presente SÓLO cuando el comprador
 * eligió pagar con la pasarela; ausente en cualquier otro método, byte-idéntico a antes de
 * este slice (§ WOMPI-WIDGET-EN-EL-CANONICO-1).
 */
export interface CheckoutResultWompi {
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  /** La llave PÚBLICA de la pasarela — del navegador, no es secreta (§ lib/pagos/llaves-pasarela.ts). */
  publicKey: string;
  /** Las DOS aceptaciones del comprador —términos de uso, tratamiento de datos personales—, cada
   *  una con su token y su enlace al documento del proveedor (§ API-DIRECTA-ACEPTACIONES-
   *  SERVIDOR-1). El servidor sólo arma el bloque `wompi` cuando las dos llegaron completas, así
   *  que este campo nunca es un objeto a medias — no opcional. */
  aceptaciones: AceptacionesWompi;
}

export interface CheckoutResult {
  numero_orden: string;
  estado: string;
  subtotal: number;
  costo_envio: number;
  total: number;
  metodo_envio?: string;      // shipping method id, resolved to a label at render
  franja?: string | null;     // slot id ("am"/"pm"), resolved to a label at render
  direccion_detalle?: string | null;
  items: CheckoutResultItem[];
  wompi?: CheckoutResultWompi;
}

// Error de checkout que conserva los IDs de producto rechazados por stock, para
// que la UI marque las líneas afectadas sin perder el resto del carrito.
export class CheckoutError extends Error {
  productosSinStock?: string[];
  constructor(message: string, productosSinStock?: string[]) {
    super(message);
    this.name = 'CheckoutError';
    this.productosSinStock = productosSinStock;
  }
}

// Thin client wrapper over the unauthenticated guest-checkout route handler,
// which owns all DB access (Prisma) and server-side price recomputation.
export async function createOrder(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  const res = await fetch('/api/checkout', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new CheckoutError(
      data?.error ?? 'Error al procesar la orden',
      Array.isArray(data?.productosSinStock) ? data.productosSinStock : undefined,
    );
  }

  return res.json();
}

// ── § CHECKOUT-UNA-SOLA-PANTALLA-1: el bloque de aceptación de pasarela, SIN ORDEN ────────
//
// `GET /api/pasarela/aceptaciones` (`app/api/pasarela/aceptaciones/route.ts`) arma el MISMO
// bloque que antes sólo viajaba pegado a la respuesta de `POST /api/checkout` — así que el
// checkout puede pedirlo apenas el comprador entra al paso de Pago, y mostrar el formulario
// de pasarela AHÍ MISMO, sin que exista todavía ninguna orden. La orden se sigue creando recién
// al apretar el botón que confirma (`crearOrdenPasarela` en `checkout/page.tsx`).

export interface BloqueAceptacionPasarela {
  aceptaciones: AceptacionesWompi;
  publicKey: string;
  /** Los tipos QUE NO SON TARJETA disponibles para este comprador — § etiquetaMetodoPasarela
   *  (`lib/pagos/aceptaciones.ts`) arma la etiqueta del selector a partir de esta lista. */
  metodosOtros: string[];
}

/**
 * `null` cuando el bloque no se pudo armar (la respuesta no vino `ok`, o el envelope no trae
 * lo esperado) — el LLAMADOR decide qué hacer: acá, no ofrecer la opción de pasarela en el
 * paso de Pago (§ el reporte del slice: "si las dos completas no se consiguen, la opción de
 * pasarela NO se ofrece"). Nunca lanza — un fallo de red al pedir esto no debe tumbar el resto
 * del checkout, que sigue funcionando con los métodos manuales.
 */
export async function consultarBloqueAceptacionPasarela(): Promise<BloqueAceptacionPasarela | null> {
  let res: Response;
  try {
    res = await fetch('/api/pasarela/aceptaciones');
  } catch {
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const envelope = body as { ok?: unknown; aceptaciones?: unknown; publicKey?: unknown; metodosOtros?: unknown } | null;
  if (!envelope?.ok || !envelope.aceptaciones || typeof envelope.publicKey !== 'string' || !Array.isArray(envelope.metodosOtros)) {
    return null;
  }

  return {
    aceptaciones: envelope.aceptaciones as AceptacionesWompi,
    publicKey:    envelope.publicKey,
    metodosOtros: envelope.metodosOtros.filter((v): v is string => typeof v === 'string'),
  };
}

/** Los tres estados de `PaymentIntentEstado` (`packages/core/prisma/schema.prisma`),
 *  tal como los devuelve `/api/checkout/retorno` — SIN reinterpretarlos. */
export type RetornoWompiEstado = 'EN_VUELO' | 'APROBADO' | 'FALLIDO';

export interface RetornoWompiResult {
  estado:       RetornoWompiEstado;
  numero_orden: string;
}

/**
 * (c), la ruta de retorno (§ WOMPI-RUTA-DE-RETORNO-1): consulta el estado REAL de un
 * intento de pago por pasarela — NUNCA el `status` que Wompi puede pasar en el query
 * del redirect. La verdad es `PaymentIntent.estado`, que sólo el webhook actualiza; esta
 * función sólo LEE lo que el servidor ya sabe.
 *
 * Exige `reference` + `email` (segundo factor TECLEADO, como `trackOrder`/
 * `/api/orders/track`): la `reference` sola viaja en una URL de retorno que un tercero
 * podría leer (historial, referrer, analítica), y no puede revelar el estado de un pago
 * ajeno sin que el comprador confirme además el correo de su compra.
 *
 * Devuelve `null` ante cualquier fallo NO transitorio (referencia inexistente, o email
 * que no coincide) — el servidor responde el MISMO 404 genérico en los dos casos para no
 * dar un oráculo de enumeración (mismo patrón que `trackOrder`). Un 429 (límite de
 * consultas) SÍ se distingue: lanza, porque no es "no encontrado" — es "esperá un poco".
 */
export async function consultarRetornoPago(
  reference: string,
  email: string,
): Promise<RetornoWompiResult | null> {
  const res = await fetch('/api/checkout/retorno', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ reference, email }),
  });
  if (res.status === 429) throw new Error('Demasiadas solicitudes. Intenta de nuevo en un momento.');
  if (!res.ok) return null;
  return res.json();
}

// ── API-DIRECTA-CAPTURA-TARJETA-1: tokenizar la tarjeta CONTRA EL PROVEEDOR ──────────────
//
// «la tokenizacion de la tarjeta se hace contra la API del proveedor SIN que los datos de
// tarjeta pasen por ningun servidor propio» (MEDIDO — `API-DIRECTA-SPIKES-ASIENTO-1`,
// DECISIONS.md). Esta función es la ÚNICA que sale de este cliente directo al navegador→Wompi;
// nunca pasa por `/api/checkout` ni por ninguna ruta nuestra, y los datos de la tarjeta no
// viajan por ningún otro lado del código de este repo — ni a un log, ni a un estado que otra
// función pueda leer.
//
// EL ENDPOINT Y LOS NOMBRES DE CAMPO (`/v1/tokens/cards`, `number`/`cvc`/`exp_month`/
// `exp_year`/`card_holder`) NO ESTÁN MEDIDOS CONTRA EL SANDBOX — este slice no tiene acceso a
// red. Son la convención pública del proveedor tal como la documenta, LEÍDA, no verificada
// (misma distinción que ya corrigió `API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1`, DECISIONS.md:
// una lectura de documentación no es una medición, y la doc de Wompi ya mintió dos veces el
// mismo día sobre otros dos hechos de este mismo programa). El gate visual del owner es lo que
// confirma o corrige esto contra el sandbox real.

export class TokenizacionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenizacionError';
  }
}

/** Los cuatro campos del formulario, YA VALIDADOS por `lib/checkout/tarjeta.ts` y normalizados
 *  (número sin espacios, mes/año de 2 dígitos) — esta función no vuelve a validar, sólo arma la
 *  llamada. */
export interface DatosTarjetaTokenizable {
  numero: string;
  /** '01'..'12' */
  mes: string;
  /** 2 dígitos */
  anio: string;
  cvv: string;
  nombreTitular: string;
}

/**
 * El HOST de la API de Wompi se deriva del PREFIJO de la llave pública —el mismo hecho
 * MEDIDO por el owner contra el dashboard del proveedor que ya usa
 * `verificarLlavePasarelaCoherente` (`lib/pagos/llaves-pasarela.ts`)—, no de una segunda
 * variable de entorno leída en el cliente: `esDespliegueDemo()` lee `VERCEL_ENV`/`NOINDEX`,
 * que NO son `NEXT_PUBLIC_` y por tanto no existen en el navegador (se inlinean sólo las
 * variables con ese prefijo). El chequeo de arranque del servidor (`instrumentation.ts`)
 * hace IMPOSIBLE que un despliegue DEMO corra con una llave que empiece con el prefijo
 * productivo, así que esta derivación coincide con `esDespliegueDemo()` del servidor en el
 * caso que ese chequeo protege — SALVO la ventana transicional en la que una producción real
 * siguiera con llaves de sandbox (aceptable: la tokenización fallaría con un error de
 * autenticación del proveedor, no con un envío de datos al host equivocado en silencio).
 */
function baseUrlPasarelaDesdeLlave(publicKey: string): string {
  return publicKey.startsWith(PREFIJO_LLAVE_PASARELA_PRODUCTIVA)
    ? 'https://production.wompi.co'
    : 'https://sandbox.wompi.co';
}

/**
 * Tokeniza la tarjeta CONTRA WOMPI, desde el navegador, con la llave pública que ya trajo la
 * respuesta de `/api/checkout` (`CheckoutResultWompi.publicKey`). Devuelve el ID del token —
 * un identificador OPACO, nunca datos de la tarjeta— o lanza `TokenizacionError` con un
 * mensaje para mostrar en el formulario.
 *
 * NO CREA NINGUNA TRANSACCIÓN: eso exige el secreto de integridad (§ `firmarIntegridadWompi`)
 * y es el slice siguiente. Acá termina el alcance: token obtenido.
 */
export async function tokenizarTarjeta(
  datos: DatosTarjetaTokenizable,
  publicKey: string,
): Promise<string> {
  const baseUrl = baseUrlPasarelaDesdeLlave(publicKey);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/tokens/cards`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${publicKey}`,
      },
      body: JSON.stringify({
        number:      datos.numero,
        cvc:         datos.cvv,
        exp_month:   datos.mes,
        exp_year:    datos.anio,
        card_holder: datos.nombreTitular,
      }),
    });
  } catch (e) {
    throw new TokenizacionError(
      e instanceof Error ? `No pudimos comunicarnos con la pasarela: ${e.message}` : 'No pudimos comunicarnos con la pasarela.',
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new TokenizacionError('La pasarela respondió algo que no pudimos leer. Intenta de nuevo.');
  }

  if (!res.ok) {
    const razon = (body as { error?: { reason?: string; messages?: Record<string, string[]> } } | null)?.error;
    const detalle = razon?.reason
      ?? Object.values(razon?.messages ?? {}).flat()[0];
    throw new TokenizacionError(detalle ?? 'No pudimos verificar tu tarjeta. Revisa los datos e intenta de nuevo.');
  }

  const token = (body as { data?: TokenTarjetaWompi } | null)?.data?.id;
  if (typeof token !== 'string' || !token) {
    throw new TokenizacionError('La pasarela no devolvió un token válido. Intenta de nuevo.');
  }
  return token;
}

// ── API-DIRECTA-DESALINEO-CABLEADO-1: confirmar la transacción CONTRA NUESTRO SERVIDOR ──
//
// Envuelve `PATCH /api/checkout` (§ API-DIRECTA-CREACION-TRANSACCION-1,
// `app/api/checkout/route.ts`), NUNCA a Wompi directo — el secreto de integridad que esa
// ruta necesita para firmar no puede viajar al navegador. Ese handler ya devuelve la
// respuesta CLASIFICADA (`ResultadoCreacionTransaccionWompi`, `types/payment.ts`); este
// wrapper no la reinterpreta, sólo la traduce a una promesa que resuelve en éxito o
// lanza `CreacionTransaccionError` con el `tipo` intacto — es el llamador
// (`FormularioTarjeta.tsx`) quien decide qué hacer con cada rama.

export class CreacionTransaccionError extends Error {
  tipo: 'metodo_no_habilitado' | 'firma_invalida' | 'otro_fallo';
  constructor(tipo: 'metodo_no_habilitado' | 'firma_invalida' | 'otro_fallo', message: string) {
    super(message);
    this.name = 'CreacionTransaccionError';
    this.tipo = tipo;
  }
}

const TEXTO_CREACION_TRANSACCION_GENERICO = 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.';

/**
 * Confirma, contra NUESTRO servidor, el intento de pago que el POST de `/api/checkout` ya
 * creó — con el token de tarjeta (§ `tokenizarTarjeta`, arriba) y las DOS aceptaciones que
 * el comprador marcó. Resuelve sin valor cuando Wompi acepta la transacción (queda
 * PENDING — el webhook, cuando exista, la cierra a APROBADO/FALLIDO); en cualquier otro
 * caso lanza `CreacionTransaccionError` con el `tipo` que el servidor ya clasificó, para
 * que el llamador distinga lo ESTRUCTURAL (`metodo_no_habilitado` — la cuenta del dueño no
 * soporta el método; reintentar con otra tarjeta no cambia nada) de lo que SÍ podría ser
 * transitorio (`firma_invalida`, `otro_fallo`).
 */
export async function confirmarTransaccionTarjeta(input: {
  reference: string;
  tokenTarjeta: string;
  aceptaciones: { terminos: string; datosPersonales: string };
}): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/checkout', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
    });
  } catch (e) {
    throw new CreacionTransaccionError(
      'otro_fallo',
      e instanceof Error ? `No pudimos comunicarnos con el servidor: ${e.message}` : TEXTO_CREACION_TRANSACCION_GENERICO,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CreacionTransaccionError('otro_fallo', 'El servidor respondió algo que no pudimos leer. Intenta de nuevo.');
  }

  const resultado = body as Partial<ResultadoCreacionTransaccionWompi> | null;
  if (resultado?.tipo === 'creada') return;

  const tipo: 'metodo_no_habilitado' | 'firma_invalida' | 'otro_fallo' =
    resultado?.tipo === 'metodo_no_habilitado' || resultado?.tipo === 'firma_invalida'
      ? resultado.tipo
      : 'otro_fallo';
  const mensaje = resultado && 'error' in resultado && typeof resultado.error === 'string'
    ? resultado.error
    : TEXTO_CREACION_TRANSACCION_GENERICO;
  throw new CreacionTransaccionError(tipo, mensaje);
}
