// Método with which a customer DECLARES they'll pay at checkout (stored on
// Order.metodo_pago). Lowercase, free-ish — distinct from the enum below, which
// is the method actually used for a REGISTERED payment.
export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'nequi'
  | 'daviplata'
  | 'tarjeta'
  | 'otro';

// Mirrors the Prisma `MetodoPago` enum — the method of a registered payment.
export type MetodoPago =
  | 'NEQUI'
  | 'DAVIPLATA'
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'OTRO';

export const METODOS_PAGO: MetodoPago[] = [
  'NEQUI', 'DAVIPLATA', 'EFECTIVO', 'TRANSFERENCIA', 'OTRO',
];

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  NEQUI:         'Nequi',
  DAVIPLATA:     'Daviplata',
  EFECTIVO:      'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  OTRO:          'Otro',
};

// ─── Payment categories (PRESENTATION ONLY) ───────────────────────────────────
// Groups the registered-payment methods for the "Por método" summary card. The
// Payment enum and rows never change — this is only how the summary buckets them.
// The ledger table + its per-method filter keep the individual methods.
export type PaymentCategoria = 'EFECTIVO' | 'TRANSFERENCIA' | 'OTRO';

export const METODO_CATEGORIA: Record<MetodoPago, PaymentCategoria> = {
  EFECTIVO:      'EFECTIVO',
  NEQUI:         'TRANSFERENCIA',
  DAVIPLATA:     'TRANSFERENCIA',
  TRANSFERENCIA: 'TRANSFERENCIA',
  OTRO:          'OTRO',
};

export const PAYMENT_CATEGORIA_LABEL: Record<PaymentCategoria, string> = {
  EFECTIVO:      'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  OTRO:          'Otro',
};

// Display order for the summary + filter groups.
export const PAYMENT_CATEGORIAS: PaymentCategoria[] = ['EFECTIVO', 'TRANSFERENCIA', 'OTRO'];

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
  order?: { numero_orden: string; cliente_nombre: string | null } | null;
}

// Payload the admin submits from the "Registrar pago" modal. No monto/cliente —
// the server snapshots both from the order.
export interface RegisterPaymentInput {
  metodo:      MetodoPago;
  referencia?: string;
  notas?:      string;
}
