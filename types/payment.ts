import type { ComprobanteEstado } from "./comprobante";
// Método with which a customer DECLARES they'll pay at checkout (stored on
// Order.metodo_pago). Lowercase, free-ish — distinct from the enum below, which
// is the method actually used for a REGISTERED payment.
export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'nequi'
  | 'daviplata'
  | 'breb'
  | 'tarjeta'
  | 'otro';

// Mirrors the Prisma `MetodoPago` enum — the method of a registered payment.
//
// ES UN ESPEJO A MANO, no un `import` de `@duna/core` (§ PAGOS-METODOS-MODELO-1 §6, el censo
// que lo destapó): este archivo alimenta la UI admin del dinero (RegisterPaymentModal, la
// página de Pagos, PagosCurva, el informe PDF) sin importar Prisma. Un valor nuevo del enum
// de Prisma que no se sume ACÁ se pierde en silencio del desglose «Por método» del PDF
// (`lib/pagos/informe.ts` itera `Object.keys(METODO_PAGO_LABEL)`) — un documento financiero
// cuyas partes no suman su total, sin que nada avise. `lib/pagos/metodos-pago-enum.test.ts`
// ata las dos declaraciones: falla NOMBRANDO el valor que falte.
export type MetodoPago =
  | 'NEQUI'
  | 'DAVIPLATA'
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'OTRO'
  | 'BREB'
  | 'WOMPI';

export const METODOS_PAGO: MetodoPago[] = [
  'NEQUI', 'DAVIPLATA', 'EFECTIVO', 'TRANSFERENCIA', 'OTRO', 'BREB', 'WOMPI',
];

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  NEQUI:         'Nequi',
  DAVIPLATA:     'Daviplata',
  EFECTIVO:      'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  OTRO:          'Otro',
  BREB:          'Bre-B',
  // De cara al OPERADOR (admin), no al comprador: nombra el proveedor a propósito — a
  // diferencia del checkout, acá no hay razón para esconderlo (§ WOMPI-ENUM-METODO-F-1).
  WOMPI:         'Pasarela (Wompi)',
};

// Coerce a loose string (e.g. Order.metodo_pago "nequi", or a form value) to the
// canonical `MetodoPago` enum, or null when it isn't one. The single normalizer
// used by the payment preselection and the "método previsto" label.
export function toMetodoPago(value: string | null | undefined): MetodoPago | null {
  const up = (value ?? '').trim().toUpperCase();
  return (METODOS_PAGO as string[]).includes(up) ? (up as MetodoPago) : null;
}

// The order's DECLARED payment method ("previsto"), resolved from either the
// typed `metodoPagoPrevisto` (admin orders) or the legacy free-string
// `metodo_pago` (checkout orders), as a friendly label. null when neither is set.
export function metodoPrevistoLabel(order: {
  metodoPagoPrevisto?: MetodoPago | null;
  metodo_pago?: string | null;
}): string | null {
  const metodo = order.metodoPagoPrevisto ?? toMetodoPago(order.metodo_pago);
  return metodo ? METODO_PAGO_LABEL[metodo] : null;
}

// ─── Payment categories (PRESENTATION ONLY) ───────────────────────────────────
// Groups the registered-payment methods for the "Por método" summary card. The
// Payment enum and rows never change — this is only how the summary buckets them.
// The ledger table + its per-method filter keep the individual methods.
// PASARELA (§ WOMPI-ENUM-METODO-F-1): categoría PROPIA para WOMPI, no un cuarto nombre para
// el residual OTRO. Es plata que un webhook acredita solo, sin que un operador la registre a
// mano — distinta de EFECTIVO (nadie la cuenta en persona), de TRANSFERENCIA (no es un riel
// digital que el operador teclea tras verla) y de OTRO (no es "no sé clasificarla": se sabe
// exactamente qué es, y por eso se nombra).
export type PaymentCategoria = 'EFECTIVO' | 'TRANSFERENCIA' | 'OTRO' | 'PASARELA';

export const METODO_CATEGORIA: Record<MetodoPago, PaymentCategoria> = {
  EFECTIVO:      'EFECTIVO',
  NEQUI:         'TRANSFERENCIA',
  DAVIPLATA:     'TRANSFERENCIA',
  TRANSFERENCIA: 'TRANSFERENCIA',
  OTRO:          'OTRO',
  // Bre-B es plata que llega por un riel digital, no efectivo — mismo bucket que Nequi/Daviplata.
  BREB:          'TRANSFERENCIA',
  WOMPI:         'PASARELA',
};

export const PAYMENT_CATEGORIA_LABEL: Record<PaymentCategoria, string> = {
  EFECTIVO:      'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  OTRO:          'Otro',
  PASARELA:      'Pasarela',
};

// Display order for the summary + filter groups.
export const PAYMENT_CATEGORIAS: PaymentCategoria[] = ['EFECTIVO', 'TRANSFERENCIA', 'OTRO', 'PASARELA'];

// Categories that bucket more than one method — the only ones worth offering as a
// grouped filter option (a single-method category is identical to its method).
export const PAYMENT_CATEGORIAS_MULTI: PaymentCategoria[] = PAYMENT_CATEGORIAS.filter(
  cat => METODOS_PAGO.filter(m => METODO_CATEGORIA[m] === cat).length > 1,
);

// Short label for a method inside a category breakdown. TRANSFERENCIA shows as
// "Bancaria" to disambiguate the bank-transfer method from the "Transferencia"
// category name (the ledger + filter still label it "Transferencia").
export const METODO_DESGLOSE_LABEL: Record<MetodoPago, string> = {
  ...METODO_PAGO_LABEL,
  TRANSFERENCIA: 'Bancaria',
};

// Lo que el checkout necesita para mostrar las DOS casillas de aceptación de Wompi
// (§ API-DIRECTA-DECISIONES-PROGRAMA-1 §4, DECISIONS.md: "SON DOS CASILLAS SEPARADAS, NO
// UNA"). Cada campo es un token de aceptación + el enlace público al documento que describe
// — nada de secretos: los dos viajan del proveedor al navegador porque la creación de la
// transacción los necesita en el body, y el enlace es lo que el comprador tiene que poder
// abrir antes de marcar la casilla.
export interface AceptacionWompi {
  token:  string;
  enlace: string;
}

export interface AceptacionesWompi {
  terminos:        AceptacionWompi;
  datosPersonales: AceptacionWompi;
}

// El token que Wompi devuelve al tokenizar una tarjeta por API directa
// (§ API-DIRECTA-CAPTURA-TARJETA-1) — un identificador OPACO que la creación de la
// transacción (slice siguiente) va a usar. NUNCA lleva datos de la tarjeta; sólo se declara
// el campo que este programa necesita leer, no el sobre completo del proveedor (que no está
// medido contra el sandbox — ver `services/checkout.service.ts`, `tokenizarTarjeta`).
export interface TokenTarjetaWompi {
  id: string;
}

// El resultado clasificado que devuelve `PATCH /api/checkout` al crear la transacción de
// tarjeta por API directa (§ API-DIRECTA-CREACION-TRANSACCION-1) — la forma DE RED (JSON) del
// mismo discriminador que `lib/pagos/creacion-transaccion.ts` clasifica del lado del servidor.
// El cableado del cliente que consume esto (`FormularioTarjeta.tsx`) no tiene que reinventar
// los cuatro casos. `error` es el texto PROVISIONAL para el comprador —
// pendiente de copy del owner, igual que el resto de los mensajes nuevos de este programa—;
// las tres ramas de fallo comparten forma a propósito, porque el cliente no necesita
// distinguirlas para decidir qué mostrar (todas terminan en "no se pudo, intenta de nuevo o
// usa otro método"); lo que SÍ distingue es `tipo`, por si un consumidor futuro quisiera
// tratarlas distinto (p. ej. loguear métricas separadas).
//
// `autenticacion3ds` (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) SÓLO va en la rama `'creada'`: es la
// clasificación de `clasificarAutenticacion3ds` (`lib/pagos/tres-ds.ts`) sobre la transacción
// YA CREADA — 'sin_friccion' (el emisor autenticó sin pedirle nada al comprador), 'desafio' (el
// emisor pide un paso adicional) o 'desconocido' (el proveedor no trajo el dato — nunca se
// inventa un veredicto). Es un ESPEJO A MANO de `Resultado3ds` (`lib/pagos/tres-ds.ts`) y no un
// `import type` de ese módulo — mismo criterio que `MetodoPago` arriba: este archivo alimenta
// también la UI, y la forma DE RED se declara acá, no se hereda del tipo interno del servidor.
//
// `desafioHtml` (§ API-DIRECTA-3DS-CON-CHALLENGE-1) SÓLO viaja cuando `autenticacion3ds ===
// 'desafio'` Y el servidor pudo decodificar el contenido (`extraerContenidoDesafio3ds`,
// `lib/pagos/tres-ds.ts`, corrida UNA vez en el servidor — el cliente nunca decodifica nada,
// sólo embebe este HTML YA decodificado). AUSENTE (no `null`: `undefined` se omite del JSON) en
// los otros dos casos, y también ausente si el desafío se detectó pero el contenido no se pudo
// decodificar — el cliente trata la ausencia igual que antes de este slice: cae al texto
// honesto de espera, sin iframe, sin inventar una pantalla que no tiene con qué dibujarse.
export type ResultadoCreacionTransaccionWompi =
  | { tipo: 'creada'; id: string; status: string; autenticacion3ds: 'sin_friccion' | 'desafio' | 'desconocido'; desafioHtml?: string }
  | { tipo: 'metodo_no_habilitado'; error: string }
  | { tipo: 'firma_invalida'; error: string }
  | { tipo: 'otro_fallo'; error: string };

// ── LOS MÉTODOS DE PASARELA QUE NO SON TARJETA (§ API-DIRECTA-OTROS-METODOS-1) ──────────────

/** El dato que el comprador tecleó para un método de pasarela QUE NO ES TARJETA — `tipo`
 *  nombra el descriptor (`lib/pagos/metodos-pasarela.ts`, `DESCRIPTORES_METODO_PASARELA`) y
 *  `dato` es el valor TAL COMO el comprador lo tecleó, sin validar todavía: el servidor valida
 *  con el MISMO descriptor (`campos[0].validar` — LEGACY, § abajo) antes de usarlo — nunca
 *  confía en que el cliente ya lo hizo.
 *
 *  § API-DIRECTA-FORMA-TRES-DIMENSIONES-1: LA FORMA DEL DESCRIPTOR YA ADMITE VARIOS CAMPOS
 *  (`DescriptorMetodoPasarela.campos: CampoMetodoPasarela[]`), pero ESTA interfaz —el WIRE
 *  hacia `PATCH /api/checkout`— NO CAMBIÓ: sigue siendo UN SOLO `dato: string`, porque
 *  `app/api/checkout/route.ts` es Tier 1 y quedó fuera de `touches` de ese slice (§ su
 *  reporte). Es lo que hace que hoy `dato` sólo pueda llevar el valor del PRIMER campo del
 *  descriptor — un tipo con más de un campo no puede describirse con esta interfaz todavía;
 *  necesitaría un `valores: Record<string,string>` y el cambio correspondiente en la ruta. */
export interface DatosMetodoPasarelaOtro {
  tipo: string;
  dato: string;
}

/**
 * La respuesta de `PATCH /api/checkout` para el camino QUE NO ES TARJETA. HONESTA sobre el
 * límite de este slice: `lib/pagos/wompi-api.ts` (`crearTransaccionTarjeta`, fuera de
 * `touches` de este slice) siempre manda `payment_method: {type: 'CARD', ...}` — generalizarla
 * para que acepte el `payment_method` que `construirDatosCreacionTransaccion`
 * (`lib/pagos/creacion-transaccion.ts`, ya probado) arma es el trabajo que falta. Por eso esta
 * respuesta NUNCA pretende que Wompi contestó algo que nunca se le preguntó — el único
 * `tipo` que existe hoy lo dice explícito. `error` es el texto para el comprador — PROVISIONAL,
 * PENDIENTE DE COPY DEL OWNER, igual que el resto de los mensajes nuevos de este programa.
 */
export interface ResultadoCreacionTransaccionOtroMetodo {
  tipo: 'no_implementado';
  error: string;
}

// La respuesta de `POST /api/pasarela/redireccion` (§ API-DIRECTA-MECANISMO-REDIRECCION-1): UN
// intento de RELECTURA de la transacción, buscando la dirección externa a la que hay que mandar
// al comprador para un método que navega fuera del checkout (dimensión C de
// `lib/pagos/metodos-pasarela.ts`, `RedireccionMetodoPasarela` — "la creación de la transacción
// no devuelve la dirección; aparece DESPUÉS, releyendo la transacción", medido,
// API-DIRECTA-PSE-SPIKE-ASIENTO-1).
//
// `url: null` ES EL CASO NORMAL "todavía no aparece" — NUNCA un error ni un veredicto de fallo:
// el cliente (`components/storefront/checkout/EsperaRedireccionPasarela.tsx`) decide, con el
// MISMO backoff que ya reusa de `lib/pagos/tres-ds.ts`, si reintenta o se rinde al llegar al
// techo. Un fallo TRANSITORIO de la consulta (red, timeout) es una respuesta DISTINTA
// (`{ error }`, 502) — nunca se aplana contra `url: null`, para no confundir "sigue sin
// aparecer" con "no se pudo ni preguntar".
export interface ResultadoRedireccionPasarela {
  url: string | null;
}

// A registered payment as returned by the ledger endpoint. `monto` is the order
// total snapshotted at registration; `order` is a light live snapshot for display.
export interface Payment {
  id:                     string;
  orden_id:               string;
  monto:                  number;
  metodo:                 MetodoPago;
  referencia?:            string | null;
  notas?:                 string | null;
  registrado_por?:        string | null;
  registrado_por_nombre?: string | null;
  fecha:                  string;
  createdAt:              string;
  /**
   * Datos de la orden, leídos en vivo por la relación. `comprobantes` viene con
   * lo mínimo para el indicador: los soportes cuelgan de la ORDEN, no del pago
   * — un pago en efectivo no tiene ninguno y una orden puede tener uno sin que
   * exista pago (§3.1).
   */
  order?: {
    numero_orden:   string;
    /** FK al Customer, para el enlace al perfil. Nullable: `onDelete: SetNull`
     *  deja el `cliente_nombre` snapshot vivo pero sin id al borrar el cliente. */
    cliente_id:     string | null;
    cliente_nombre: string | null;
    comprobantes?:  { id: string; estado: ComprobanteEstado }[];
  } | null;
}

// Payload the admin submits from the "Registrar pago" modal. No monto/cliente —
// the server snapshots both from the order. `fecha` es CLAVE DE DÍA (`YYYY-MM-DD`);
// el server la ancla a Bogotá. Omitida → default now().
export interface RegisterPaymentInput {
  metodo:      MetodoPago;
  referencia?: string;
  notas?:      string;
  fecha?:      string;
}
