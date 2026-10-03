import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MetodoPagoTipo } from './metodos-pago';

// ─── La prueba de que el cliente creó esta orden: un CÓDIGO PRIVADO, no un dato público ──────
//
// `POST /api/orders/[id]/comprobante-cliente` es público y SIN sesión: "nunca basta el id de la
// orden" (numero_orden es un string corto, enumerable — 6 dígitos, como ya documenta
// `app/api/orders/track/route.ts`). Hacía falta algo MÁS que el id, y había dos caminos:
//
//   a) un token firmado (HMAC) con vencimiento corto, emitido por el endpoint que CREA la orden
//      (`app/api/checkout/route.ts`) y devuelto SÓLO en esa respuesta;
//   b) el MISMO mecanismo que ya usa `/api/orders/track`: numero_orden + el correo que el
//      cliente escribió al pagar.
//
// `CHECKOUT-COMPROBANTE-CLIENTE-1` eligió (b) — y la única razón fue de ALCANCE, no de
// seguridad: `app/api/checkout/route.ts` NO estaba en el `touches:` de ese slice (Tier 1, sin
// aprobación todavía). Quedó escrito ahí mismo que (a) era la alternativa descartada por eso, no
// porque (b) fuera mejor. Y no lo era: el correo NO es un secreto — cualquiera que vea la
// factura, el paquete, o que simplemente ADIVINE un correo común puede intentarlo. La ruta
// rate-limita por IP y responde genérico, pero el espacio de ataque seguía siendo "numero_orden
// (6 dígitos) × un correo plausible", no "numero_orden × un secreto de 256 bits".
//
// `CHECKOUT-COMPROBANTE-TOKEN-1` cierra esa puerta: con `app/api/checkout/route.ts` ya en el
// `touches:` (aprobado por el owner), la opción (a) deja de estar fuera de alcance y es la que
// corresponde. EL CORREO DEJA DE AUTORIZAR NADA EN ESTA RUTA.
//
// EL CÓDIGO es una firma HMAC-SHA256 sobre `numero_orden` + un vencimiento, con una clave
// derivada de `BETTER_AUTH_SECRET` (§ `claveFirma`, abajo) — NUNCA el secreto crudo, por
// SEPARACIÓN DE DOMINIO: así una firma calculada con el MISMO secreto para OTRO propósito (la
// sesión de Better Auth, o cualquier otro HMAC futuro que reuse esta variable) nunca verifica
// acá por accidente, y viceversa. Lo emite `POST /api/checkout` al crear la orden —sólo en la
// respuesta a ESE navegador— y lo guarda el checkout (memoria de la página + `sessionStorage`,
// nunca la URL) para reenviarlo al subir el comprobante, incluido un reintento posterior.
//
// Mismo criterio que `lib/pagos/wompi-firma.ts`: este módulo NUNCA lee `process.env` — el
// secreto entra como parámetro, y es la RUTA (`app/api/checkout/route.ts` para emitir,
// `app/api/orders/[id]/comprobante-cliente/route.ts` para verificar) quien decide de dónde sale.

/**
 * Los métodos del checkout que ACEPTAN comprobante de cliente — el MISMO subconjunto
 * que ya decidía qué mostrar el campo "Referencia de pago" (hoy reemplazado por este
 * campo): instrumentos que dejan evidencia (transferencia/pago móvil), nunca
 * `efectivo` (no hay nada que fotografiar) ni la pasarela (el cobro se confirma solo,
 * sin que nadie mire una foto — § Decisión de pasarela, CLAUDE.md).
 */
export const METODOS_CON_COMPROBANTE_CLIENTE: readonly MetodoPagoTipo[] = [
  'nequi', 'daviplata', 'breb', 'transferencia',
];

/** `null`/`'wompi'`/`'efectivo'` → `false`, sin excepción. */
export function aceptaComprobanteCliente(metodoPago: string | null): boolean {
  return metodoPago !== null && (METODOS_CON_COMPROBANTE_CLIENTE as readonly string[]).includes(metodoPago);
}

/**
 * Tope de comprobantes que el CLIENTE puede adjuntar por orden, sin sesión. No es el
 * tope que algún día tenga un operador (ilimitado) — es el freno de un endpoint
 * público: alcanza para que un comprador se equivoque de foto y la corrija dos veces,
 * y no alcanza para convertir la ruta en un vertedero de archivos sobre una sola
 * orden. `TODO(cliente)`: el número es un placeholder razonable, no una cifra medida.
 */
export const TOPE_COMPROBANTES_CLIENTE = 3;

/** Lo mínimo de la orden que la admisión necesita — ya leído de la base. `cliente_email` salió
 *  de acá: el correo ya no autoriza nada en esta ruta (§ el docstring de cabecera). */
export interface OrdenParaComprobanteCliente {
  estado: string;
  metodo_pago: string | null;
}

// ─── El CÓDIGO — emitir y verificar ──────────────────────────────────────────────────────────

/** Separador de dominio del HMAC: así una firma calculada con el MISMO `BETTER_AUTH_SECRET` para
 *  OTRO propósito (la sesión de Better Auth, cualquier HMAC futuro que reuse esta variable)
 *  nunca verifica acá, y viceversa. La clave derivada es el secreto PREFIJADO, no un hash
 *  adicional — alcanza para la separación de dominio y evita un paso extra sin ganar nada. */
const DOMINIO_FIRMA = 'comprobante-cliente:';

function claveFirma(secretoServidor: string): string {
  return `${DOMINIO_FIRMA}${secretoServidor}`;
}

/**
 * Cuánto dura un código antes de vencer. 24 horas: lo bastante para que el comprador complete
 * una transferencia (Nequi/Daviplata/Bre-B/transferencia bancaria pueden tardar minutos u horas
 * en confirmarse del otro lado) y vuelva a la MISMA sesión de checkout a adjuntar la foto —
 * `sessionStorage` vive mientras la pestaña esté abierta, así que esto no ESTIRA esa ventana; la
 * ACOTA, para que un código filtrado no valga indefinidamente.
 */
export const VENCIMIENTO_CODIGO_COMPROBANTE_MS = 24 * 60 * 60 * 1000;

/** Compara dos strings en tiempo constante — mismo criterio que `lib/pagos/wompi-firma.ts`:
 *  el largo de un sha256 hex es fijo (64) y público, así que resolver el caso de largos
 *  distintos ANTES no filtra nada que la firma ya no exponga. */
function compararConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Emite el código de subida para ESTA orden. Sólo `POST /api/checkout` lo llama, con
 * `process.env.BETTER_AUTH_SECRET` — este módulo nunca lee `process.env` (§ el docstring de
 * cabecera); el secreto entra como parámetro.
 *
 * `null` sin secreto — FALLA CERRADA: sin él no hay con qué firmar, y una clave por defecto
 * sería peor que no ofrecer el código (el campo de comprobante, en ese caso, no se ofrece en la
 * respuesta). En cualquier despliegue real `BETTER_AUTH_SECRET` existe siempre — Better Auth
 * entero depende de él —, así que esta rama es defensiva, no un caso que se espere disparar.
 */
export function emitirCodigoComprobante(
  numeroOrden: string,
  secretoServidor: string | undefined,
  ahora: number = Date.now(),
): string | null {
  if (!secretoServidor) return null;
  const vence = ahora + VENCIMIENTO_CODIGO_COMPROBANTE_MS;
  const payload = `${numeroOrden}.${vence}`;
  const firma = createHmac('sha256', claveFirma(secretoServidor)).update(payload).digest('hex');
  return `${payload}.${firma}`;
}

/**
 * Verifica que `codigo` sea un código VIGENTE, SIN ALTERAR, emitido PARA `numeroOrden` — las
 * tres cosas a la vez. Un código de otra orden no sirve (la firma cubre `numero_orden`, así que
 * cambiarlo en el payload invalida la firma; esto además confirma que lo que trae el código
 * coincide con la orden que la URL pide), uno vencido no autoriza, y uno alterado o inventado
 * tampoco — los tres casos devuelven `false`, sin distinguir cuál fue.
 *
 * `false` también sin secreto — simétrico con `emitirCodigoComprobante`: si no hay con qué
 * firmar, tampoco hay con qué verificar.
 */
export function verificarCodigoComprobante(
  codigo: string,
  numeroOrden: string,
  secretoServidor: string | undefined,
  ahora: number = Date.now(),
): boolean {
  if (!secretoServidor) return false;
  const partes = codigo.split('.');
  if (partes.length !== 3) return false;
  const [ordenFirmada, venceTexto, firmaRecibida] = partes;
  const vence = Number(venceTexto);
  if (!Number.isFinite(vence)) return false;
  const payload = `${ordenFirmada}.${venceTexto}`;
  const firmaEsperada = createHmac('sha256', claveFirma(secretoServidor)).update(payload).digest('hex');
  if (!compararConstante(firmaRecibida, firmaEsperada)) return false;
  if (ordenFirmada !== numeroOrden) return false;
  if (ahora > vence) return false;
  return true;
}

export type MotivoRechazoComprobanteCliente =
  | 'codigo_invalido'
  | 'no_pendiente'
  | 'metodo_no_admite'
  | 'tope_alcanzado';

export type VeredictoAdmision =
  | { ok: true }
  | { ok: false; motivo: MotivoRechazoComprobanteCliente };

/**
 * La regla de admisión completa, en el ORDEN en que se evalúa — y el orden es la decisión: la
 * prueba de identidad (el código, ya verificado por el llamador con `verificarCodigoComprobante`)
 * se evalúa ANTES de decir nada sobre el estado de la orden. Si el código no es válido, el
 * llamador (la ruta) responde EXACTAMENTE lo mismo que si la orden no existiera — este motivo
 * nunca debe traducirse a un mensaje distinto de "no encontrada" (mismo criterio que el
 * `email_no_coincide` que reemplaza, ver el docstring de cabecera): un código roto no distingue
 * "la orden no existe" de "la orden existe pero éste no es su código", y no hay por qué dárselo
 * a elegir a quien lo intenta.
 *
 * Las otras tres razones SÍ pueden mostrarse al cliente tal cual: para llegar ahí, el código ya
 * probó que es quien creó la orden.
 */
export function admiteComprobanteCliente(
  orden: OrdenParaComprobanteCliente,
  codigoValido: boolean,
  comprobantesExistentes: number,
): VeredictoAdmision {
  if (!codigoValido) return { ok: false, motivo: 'codigo_invalido' };
  if (orden.estado !== 'pendiente') return { ok: false, motivo: 'no_pendiente' };
  if (!aceptaComprobanteCliente(orden.metodo_pago)) return { ok: false, motivo: 'metodo_no_admite' };
  if (comprobantesExistentes >= TOPE_COMPROBANTES_CLIENTE) return { ok: false, motivo: 'tope_alcanzado' };
  return { ok: true };
}

/**
 * La frase para el motivo de rechazo — SÓLO para los tres que el cliente puede ver
 * (nunca `codigo_invalido`, que la ruta trata como "no encontrada"). Vive acá para
 * que la ruta y el test no repitan el mismo texto por su cuenta.
 */
export function mensajeRechazoComprobanteCliente(
  motivo: Exclude<MotivoRechazoComprobanteCliente, 'codigo_invalido'>,
): string {
  switch (motivo) {
    case 'no_pendiente':
      return 'Esta orden ya no admite comprobantes.';
    case 'metodo_no_admite':
      return 'Este pedido no necesita comprobante de pago.';
    case 'tope_alcanzado':
      return 'Ya adjuntaste el máximo de comprobantes para este pedido.';
  }
}
