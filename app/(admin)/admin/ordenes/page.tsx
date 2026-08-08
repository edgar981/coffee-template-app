'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { Plus, Search, ShoppingCart, Truck, CreditCard, X, CheckCircle, AlertCircle, RotateCcw, Pencil, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BUSINESS_TZ, zonedDayKey } from '@/lib/timezone';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { useAccionGuardada, useAccionesPorFila } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { getOrders, createOrder, updateOrder } from '@/lib/api/orders';
import { ensureOrderShipping } from '@/lib/api/shippings';
import { getCatalog } from '@/lib/api/products';
import { lookupCustomers, type CustomerMatch } from '@/lib/api/customers';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import { RegisterPaymentModal } from '@/components/admin/RegisterPaymentModal';
import type { Order, OrderForm, OrderLineForm, OrderStatus, OrderChannel } from '@/types/order';
import { CONDICION_PAGO_LABEL } from '@/types/order';
import type { Product } from '@/types/product';
import type { Shipping } from '@/types/shipping';
import { formatCOP } from '@/lib/utils';
import { formatFecha } from '@/lib/format-fecha';
import { findSlotLabel } from '@/lib/shipping-config';
import { hasScheduleData, isScheduledShipping, missingToDispatch } from '@/constants/shippings';
import { estadoEntrega, accionFilaEntrega, fechaEntrega } from '@/lib/entrega-estado';
import { useTransicionEntrega, type TransicionEntrega } from '@/hooks/useTransicionEntrega';
import { ConfirmDespachoSinPago } from '@/components/admin/ConfirmDespachoSinPago';
import { Pliegue } from '@/components/admin/Pliegue';
import { ImageLightbox } from '@/components/admin/ImageLightbox';
import {
  ComprobanteVista, SelectorComprobante, AyudaComprobante, useLightboxComprobante,
} from '@/components/admin/Comprobantes';
import { subirComprobante, decidirComprobante, getComprobantes } from '@/lib/api/comprobantes';
import { accionAlVerificar, puedeDecidirse, nombreArchivo } from '@/lib/comprobante';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { MAX_COMPROBANTE_MB } from '@/constants/comprobante';
import type { Comprobante } from '@/types/comprobante';
import { filterChip, filterChipTono, FILTER_CHIP_COUNT } from '@/constants/filter-chip';
import { COLOMBIA_DEPARTMENTS } from '@/lib/colombia-departments';
import { isPorCobrar } from '@/lib/metrics/order-stat-filters';
import { METODOS_PAGO, METODO_PAGO_LABEL, metodoPrevistoLabel } from '@/types/payment';

// ─── Constants ────────────────────────────────────────────────────────────────

// Order status is payment-only now. Fulfillment lives on Shipping. `pendiente`/
// `pagado` (el eje de COBRO) NO se escriben desde ningún control: se derivan del
// Payment (§ el estado de cobro lo escribe SOLO el path de pago). Estos valores
// siguen usándose para LEER — filtros, tabs, StatusBadge —, nunca para escribir.
const ESTADOS: OrderStatus[] = ['pendiente', 'pagado', 'cancelado'];

// Copy ÚNICO de "Cancelar orden", compartido por la acción de fila y la del
// detalle para que las dos digan exactamente lo mismo (una sola fuente evita que
// diverjan). `cancelado` es la otra cara de `Order.estado` —la de CANCELACIÓN, no
// cobro— y sí es una transición legítima que el server acepta.
// Qué le pasa al Payment al cancelar: NADA — `transitionOrder` anula el envío y
// reintegra el stock despachado, pero no toca el pago. La decisión de negocio de
// "pagos sobre canceladas" es una conversación aparte (pendiente con Luis); acá
// solo se conserva y se declara el comportamiento actual.
const CANCELAR_ORDEN_COPY = {
  title:        'Cancelar orden',
  consequence:  'La orden se marca como CANCELADA (no se elimina: es un registro auditable). Si tiene un envío, se anula y el stock ya despachado se reintegra. Un pago registrado, si lo hubiera, NO se modifica aquí.',
  confirmLabel: 'Cancelar orden',
} as const;

const CANALES: OrderChannel[] = ['whatsapp', 'instagram', 'directo', 'referido'];

// Sentinel for the empty "Por definir" option — Radix Select forbids value="".
// Mapped to '' (no metodoPagoPrevisto) in form state.
const POR_DEFINIR = '__por_definir__';

// Radix Select no admite '' como value; este centinela representa "sin
// departamento" y se traduce a '' (omitido en el payload) al guardar.
const NINGUN_DEPARTAMENTO = '__ninguno__';

const EMPTY_FORM: OrderForm = {
  cliente_nombre:    '',
  cliente_email:     '',
  cliente_telefono:  '',
  canal:             'whatsapp',
  costo_envio:       '0',
  direccion_entrega: '',
  ciudad_entrega:    '',
  departamento:      '',
  notas_internas:    '',
  items:             [{ slug: '', cantidad: 1, molienda: '' }],
  metodoPagoPrevisto: '',
  pagoRecibido:       false,
};

// ─── URL-driven filters ───────────────────────────────────────────────────────
// The filter view lives in the query string, so a filtered list is shareable and
// the back button restores it for free. Params:
//   ?estado=pendiente[,pagado]  comma-separated; empty/absent = all
//   ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   inclusive, America/Bogota days
//   ?order=CN-123               opens that order's detail dialog
// `search` is deliberately NOT in the URL — it's a scratch input, not a view.
//
// Every value is parsed leniently: anything invalid falls back to the default
// silently (`.catch`), so a hand-edited URL can never crash the page.

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const dayKeySchema = z.string().regex(DAY_KEY);

const filterParamsSchema = z.object({
  estado: z.string().optional().catch(undefined),
  desde:  dayKeySchema.optional().catch(undefined),
  hasta:  dayKeySchema.optional().catch(undefined),
  order:  z.string().trim().min(1).optional().catch(undefined),
  cobrar: z.string().optional().catch(undefined),
});

interface OrderFilters {
  /** Empty = no estado filter ("Todas"). */
  estados: OrderStatus[];
  desde:   string | null;
  hasta:   string | null;
  /** numero_orden whose detail dialog should be open. */
  order:   string | null;
  /** "Por cobrar" chip active (`cobrar=1`) — contraentrega despachada sin pago. */
  porCobrar: boolean;
  /** `cobrar=0` — EXCLUDE the por-cobrar set (the dashboard's pendientes link). */
  excludeCobrar: boolean;
}

function parseFilters(params: URLSearchParams): OrderFilters {
  const raw = filterParamsSchema.parse({
    estado: params.get('estado') ?? undefined,
    desde:  params.get('desde')  ?? undefined,
    hasta:  params.get('hasta')  ?? undefined,
    order:  params.get('order')  ?? undefined,
    cobrar: params.get('cobrar') ?? undefined,
  });

  // Unknown estado tokens are dropped, not rejected — `?estado=pendiente,bogus`
  // still filters to pendiente.
  const estados = [...new Set(
    (raw.estado ?? '')
      .split(',')
      .map(s => s.trim())
      .filter((s): s is OrderStatus => (ESTADOS as string[]).includes(s)),
  )];

  // An inverted range would silently show nothing; treat it as unset instead.
  let { desde, hasta } = raw;
  if (desde && hasta && desde > hasta) { desde = undefined; hasta = undefined; }

  return {
    estados,
    desde: desde ?? null,
    hasta: hasta ?? null,
    order: raw.order ?? null,
    porCobrar:     raw.cobrar === '1',
    excludeCobrar: raw.cobrar === '0',
  };
}

/** `Date` → the America/Bogota day key the filters compare against. */
const orderDayKey = (iso: string) => zonedDayKey(new Date(iso), BUSINESS_TZ);

// ─── Page ─────────────────────────────────────────────────────────────────────

// useSearchParams() needs a Suspense boundary — same pattern as the storefront
// shop page.
export default function OrdenesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <Ordenes />
    </Suspense>
  );
}

function Ordenes() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [orders, setOrders]             = useState<Order[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<OrderForm>(EMPTY_FORM);
  // Order whose delivery is being scheduled (opens the pre-filled modal).
  const [scheduleOrder, setScheduleOrder] = useState<Order | null>(null);
  // Order whose payment is being registered (opens the pre-filled modal).
  const [paymentOrder, setPaymentOrder]   = useState<Order | null>(null);
  // Orden que se está por CANCELAR (abre el confirm compartido). Reemplaza al
  // viejo dropdown de estado de la fila: cancelar es la única transición que ese
  // control escribía de verdad (cobro dejó de escribirse a mano).
  const [cancelando, setCancelando]       = useState<Order | null>(null);
  // Guarda de envío de Nueva Orden, en la primitiva compartida. `idemKeyRef`
  // sigue aparte porque resuelve otra cosa: mantiene UNA clave de idempotencia
  // por formulario abierto, así que si dos peticiones se escaparan igual, el
  // server las dedupea. La guarda evita el segundo click; la clave cubre el caso
  // en que el click no fue el problema (un reintento de red, por ejemplo).
  const guardaCrear                       = useAccionGuardada();
  const saving                            = guardaCrear.enVuelo;
  const idemKeyRef                        = useRef<string>('');
  // Proactive duplicate detection in the New Order modal. `customerMatches` are the
  // existing customers the phone/email would match (a phone can be shared → many);
  // `decision` is the operator's explicit choice from the banner. Submit is gated
  // until they decide when matches exist.
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [decision, setDecision] = useState<{ tipo: 'usar'; clienteId: string } | { tipo: 'nuevo' } | null>(null);
  const [gateBlocked, setGateBlocked] = useState(false); // "elige el cliente" message + ring
  const [gatePulse, setGatePulse]     = useState(false); // brief attention pulse
  const bannerRef      = useRef<HTMLDivElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  // Real catalog for the New Order line selectors (same source as the storefront).
  const [catalog, setCatalog]             = useState<Product[]>([]);

  useEffect(() => { getCatalog().then(setCatalog).catch(() => setCatalog([])); }, []);

  useEffect(() => {
    getOrders()
      .then(data => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── URL state ──────────────────────────────────────────────────────────────

  const { estados, desde, hasta, order: openNumero, porCobrar, excludeCobrar } = parseFilters(new URLSearchParams(searchParams.toString()));

  // Filter changes `replace` (no history spam, no scroll reset); opening an order
  // `push`es, so Back closes the dialog instead of leaving the page.
  const setParams = useCallback((patch: Record<string, string | null>, mode: 'push' | 'replace' = 'replace') => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // The open order is DERIVED from the URL + the loaded list rather than held in
  // state: the dialog is deep-linkable, Back closes it, and an edit made through
  // onUpdate is reflected immediately (a state snapshot used to go stale).
  const selected = openNumero
    ? orders.find(o => o.numero_orden === openNumero) ?? null
    : null;
  const closeDetail = () => setParams({ order: null });

  const filtered = orders.filter(o => {
    const term = search.toLowerCase();
    const matchSearch =
      o.cliente_nombre?.toLowerCase().includes(term) ||
      o.numero_orden?.toLowerCase().includes(term);
    const matchEstado = estados.length === 0 || estados.includes(o.estado);
    // Date bounds are inclusive and compared as America/Bogota day keys —
    // YYYY-MM-DD sorts lexicographically, so string compare IS date compare.
    const day = orderDayKey(o.createdAt);
    const matchDesde = !desde || day >= desde;
    const matchHasta = !hasta || day <= hasta;
    // "Por cobrar" is orthogonal to the estado pills (it implies pendiente); the
    // two are never active together (selecting one clears the other).
    // cobrar=1 narrows TO the por-cobrar set; cobrar=0 EXCLUDES it (the
    // dashboard's "Órdenes Pendientes" link — its number omits por-cobrar).
    const matchCobrar = porCobrar ? isPorCobrar(o) : excludeCobrar ? !isPorCobrar(o) : true;
    return matchSearch && matchEstado && matchDesde && matchHasta && matchCobrar;
  });

  // Count of receivables — drives the "Por cobrar" chip badge (ALLOW_UNPAID only).
  const porCobrarCount = orders.filter(isPorCobrar).length;

  const stats = ESTADOS.reduce<Record<OrderStatus, number>>((acc, e) => {
    acc[e] = orders.filter(o => o.estado === e).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  // Single reset for the whole filter bar: estado pills, "Por cobrar", the date
  // range (all URL-driven) AND the scratch `search`. `order` (the open dialog) is
  // deliberately untouched. Shown only when at least one filter is active.
  const hasActiveFilters =
    estados.length > 0 || !!desde || !!hasta || porCobrar || excludeCobrar || search.trim() !== '';
  const clearFilters = () => {
    setSearch('');
    setParams({ estado: null, desde: null, hasta: null, cobrar: null });
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Opens the New Order form with a FRESH idempotency key — one key per intended
  // order, reused across double-clicks of that same form so the server can dedup.
  const resetCustomerDetection = () => { setCustomerMatches([]); setDecision(null); setGateBlocked(false); setGatePulse(false); };

  const openNewOrder = () => {
    idemKeyRef.current = crypto.randomUUID();
    setForm(EMPTY_FORM);
    resetCustomerDetection();
    setShowForm(true);
  };

  // Look up the customers this phone/email would match, on blur of those fields.
  // Read-only; never blocks. Skipped once a decision was made (adopt/new).
  const detectCustomer = async () => {
    if (decision) return;
    const matches = await lookupCustomers({
      telefono: form.cliente_telefono || undefined,
      email:    form.cliente_email || undefined,
    });
    setCustomerMatches(matches);
  };

  // Adopt one match: the order carries its cliente_id (no upsert); its name fills
  // the form. Editing phone/email afterwards resets the decision (below).
  const chooseUsar = (m: CustomerMatch) => {
    setDecision({ tipo: 'usar', clienteId: m.id });
    setForm(f => ({ ...f, cliente_nombre: m.nombre }));
    setGateBlocked(false); setGatePulse(false);
  };

  // "Crear cliente nuevo" — an explicit, server-honored decision (forzarClienteNuevo)
  // so the upsert can't silently re-match. Conscious duplicate; shared phones legal.
  const chooseNuevo = () => {
    setDecision({ tipo: 'nuevo' });
    setGateBlocked(false); setGatePulse(false);
  };

  // Changing an identity field invalidates any prior detection/decision.
  const onIdentityChange = () => { if (decision || customerMatches.length) resetCustomerDetection(); };

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Submit was blocked because matches exist and no decision was made: pull the
  // banner into view, focus its first action, and flag the ring + message. The
  // pulse is brief and skipped under reduced-motion (the static ring stays).
  const nudgeToDecide = () => {
    setGateBlocked(true);
    bannerRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    firstActionRef.current?.focus();
    if (!prefersReducedMotion()) {
      setGatePulse(true);
      setTimeout(() => setGatePulse(false), 1200);
    }
  };

  // ── New-order line editing ───────────────────────────────────────────────
  const productBySlug = (slug: string) => catalog.find(p => p.slug === slug);
  // First available molienda (mirrors the storefront's default selection).
  const defaultMolienda = (slug: string) =>
    (productBySlug(slug)?.moliendasOpciones ?? []).find(o => o.disponible)?.nombre ?? '';
  const setLines = (items: OrderLineForm[]) => setForm(f => ({ ...f, items }));
  const addLine = () => setLines([...form.items, { slug: '', cantidad: 1, molienda: '' }]);
  const removeLine = (i: number) =>
    setLines(form.items.length > 1 ? form.items.filter((_, idx) => idx !== i) : form.items);
  const updateLine = (i: number, patch: Partial<OrderLineForm>) =>
    setLines(form.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Display-only totals — the SERVER recomputes authoritatively from the catalog
  // on create (the admin never types the total).
  const itemsSubtotal = form.items.reduce((sum, l) => {
    const p = productBySlug(l.slug);
    return sum + (p ? p.precio * l.cantidad : 0);
  }, 0);
  const calcTotal = itemsSubtotal + (Number(form.costo_envio) || 0);
  const hasProduct = form.items.some(l => l.slug);

  const errorCrear = useErrorDialogo();
  const handleSave = () => guardaCrear.ejecutar(async () => {
    errorCrear.limpiar();
    if (!form.cliente_nombre.trim()) {
      toast.error('El nombre del cliente es requerido');
      return;
    }
    // Mirror the server rule: at least one contact (email OR phone). Real orders
    // arrive by WhatsApp, so a phone alone is enough.
    if (!form.cliente_email.trim() && !form.cliente_telefono.trim()) {
      toast.error('Ingresa al menos un teléfono o correo del cliente');
      return;
    }
    const lines = form.items.filter(l => l.slug);
    if (lines.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    // Molido products require an available molienda (the server enforces it too).
    for (const l of lines) {
      const p = productBySlug(l.slug);
      if ((p?.moliendasOpciones?.length ?? 0) > 0 && !l.molienda) {
        toast.error(`Selecciona la molienda para ${p?.nombre ?? 'el producto'}`);
        return;
      }
    }
    // Mirror the server rule: "ya pagado" needs a concrete method, not "Por definir".
    if (form.pagoRecibido && !form.metodoPagoPrevisto) {
      toast.error('Selecciona el método de pago para marcar la orden como pagada');
      return;
    }
    // Decision gate (UX, never blocks the SALE — only asks): matches exist but the
    // operator hasn't chosen. Don't submit; pull them to the banner to decide.
    if (customerMatches.length > 0 && decision === null) {
      nudgeToDecide();
      return;
    }
    // Guarantee a key even if the form was opened without openNewOrder.
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();

    try {
      const created = await createOrder({
        cliente_nombre:    form.cliente_nombre,
        cliente_email:     form.cliente_email || undefined,
        cliente_telefono:  form.cliente_telefono || undefined,
        cliente_id:         decision?.tipo === 'usar' ? decision.clienteId : undefined,
        forzarClienteNuevo: decision?.tipo === 'nuevo' ? true : undefined,
        canal:             form.canal,
        costo_envio:       Number(form.costo_envio) || 0,
        direccion_entrega: form.direccion_entrega || undefined,
        // Opcionales: se omiten cuando están vacíos para no romper la creación
        // rápida (el server los valida solo si llegan).
        ciudad_entrega:    form.ciudad_entrega || undefined,
        departamento:      form.departamento || undefined,
        notas_internas:    form.notas_internas || undefined,
        metodoPagoPrevisto: form.metodoPagoPrevisto || undefined,
        pagoRecibido:      form.pagoRecibido,
        items:             lines.map(l => ({ slug: l.slug, cantidad: l.cantidad, molienda: l.molienda || null })),
        idempotencyKey:    idemKeyRef.current,
      });
      setOrders(prev => [created, ...prev]);
      toast.success(created.estado === 'pagado' ? 'Orden creada y pago registrado' : 'Orden creada');
      setShowForm(false);
      setForm(EMPTY_FORM);
      resetCustomerDetection();
    } catch (e) {
      errorCrear.mostrar(e, 'No se pudo crear la orden');
    }
  });

  // Guarda POR FILA y no global: el operador prepara envíos de varias órdenes
  // seguidas, y bloquear la tabla entera convertiría la guarda en una traba — que
  // es justo el roce que hace que la gente vuelva a clickear. (Cancelar tiene su
  // propia guarda dentro del ConfirmDeleteDialog, así que no necesita una fila.)
  const filasPrepara = useAccionesPorFila();

  // Cancelar es lo ÚNICO que la fila escribe sobre `Order.estado` ahora. `estado:
  // 'cancelado'` es la única transición que el PATCH acepta (el eje de cobro lo
  // rechaza server-side → 422). Lanza si el server rechaza: el confirm queda
  // abierto y muestra el motivo inline (su contrato).
  const handleCancelar = async (id: string) => {
    const updated = await updateOrder(id, { estado: 'cancelado' });
    setOrders(prev => prev.map(o => o.id === id ? updated : o));
  };

  const handleOrderUpdate = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const handleScheduled = (orderId: string, shipping: Shipping) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, shipping } : o));
  };

  // Open the schedule modal. If the order has no Shipping yet (an unpaid order
  // under ALLOW_UNPAID), create it first via the guarded endpoint — the server
  // is the enforcement point, so a rejection (cancelled, or REQUIRE_PAYMENT) is
  // surfaced here — then open the modal on the fresh Shipping.
  // El server es idempotente de verdad acá —chequea el existente dentro de la
  // transacción y `Shipping.orden_id` es único—, así que la guarda no protege el
  // dato: protege al operador. Sin ella, el botón se queda mudo mientras viaja y
  // no hay nada que distinga "está creando el envío" de "no pasó nada".
  const openSchedule = (o: Order) => {
    if (o.shipping) { setScheduleOrder(o); return; }
    return filasPrepara.ejecutar(o.id, async () => {
    try {
      const shipping = await ensureOrderShipping(o.id);
      const updated: Order = { ...o, shipping };
      setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
      setScheduleOrder(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo preparar la entrega');
    }
    });
  };

  // ─── Comprobantes: el dato vive ACÁ, no dentro del diálogo ─────────────────
  //
  // Estaban dentro de `OrderDetail` y ése fue el defecto del gate del
  // 2026-08-06: el resultado de la subida dependía de que el modal siguiera
  // montado. Cuando el detalle se remontó con el POST en vuelo —la página
  // recarga, `orders` vuelve a `[]`, `selected` pasa a `null` y el diálogo se
  // cierra y reabre solo— la continuación cayó sobre un componente muerto: la
  // fila SÍ se escribió en la base y el blob SÍ subió, pero ni el comprobante ni
  // el error llegaron a pantalla. Tres síntomas, una causa.
  //
  // `Ordenes` es el componente de la ruta y dueño de `orders`: sobrevive a que el
  // diálogo se cierre. Con la mutación acá, un remonte del detalle deja de poder
  // tragarse una subida — el peor caso pasa a ser que el modal reabra ya con el
  // comprobante puesto.
  const guardaComprobante = useAccionGuardada();
  const filasComprobante  = useAccionesPorFila();
  const errorComprobante  = useErrorDialogo();

  // La VERDAD la trae el servidor al abrir. Es la otra mitad: si algo se perdió
  // en el camino (una subida cuya continuación murió, otra pestaña), el detalle
  // se cura solo al abrirse en vez de mostrar un vacío que la base contradice.
  const refrescarComprobantes = useCallback(async (ordenId: string) => {
    try {
      const lista = await getComprobantes(ordenId);
      setOrders(prev => prev.map(o => o.id === ordenId ? { ...o, comprobantes: lista } : o));
    } catch (e) {
      // Silencioso a propósito: es un REFRESCO, no una acción que el operador
      // pidió. Lo que ya estaba en pantalla se queda; el log deja el rastro.
      console.error('[comprobantes] no se pudo refrescar', e);
    }
  }, []);

  const adjuntarComprobante = (ordenId: string, file: File) =>
    guardaComprobante.ejecutar(async () => {
      errorComprobante.limpiar();
      try {
        const creado = await subirComprobante(ordenId, file);
        setOrders(prev => prev.map(o => o.id === ordenId
          ? { ...o, comprobantes: [...(o.comprobantes ?? []), creado] }
          : o));
        // Adjuntar NO registra un pago ni mueve la orden: sólo entra la evidencia.
        toast.success('Comprobante adjuntado', { description: 'Queda RECIBIDO hasta que lo verifiques.' });
      } catch (e) {
        errorComprobante.mostrar(e, 'No se pudo subir el comprobante');
      }
    });

  // LANZA en vez de tragarse el error: quién lo muestra depende de por dónde se
  // pidió. Rechazar va detrás de un confirm y ése tiene su propio error inline
  // (y se queda abierto al fallar); verificar no, y lo manda al de la sección.
  const resolverComprobante = async (ordenId: string, id: string, accion: 'verificar' | 'rechazar') => {
    await filasComprobante.ejecutar(id, async () => {
      const actualizado = await decidirComprobante(id, accion);
      setOrders(prev => prev.map(o => o.id === ordenId
        ? { ...o, comprobantes: (o.comprobantes ?? []).map(c => c.id === id ? actualizado : c) }
        : o));
      toast.success(accion === 'verificar' ? 'Comprobante verificado' : 'Comprobante rechazado');
    });
  };

  const controlComprobantes: ControlComprobantes = {
    adjuntar:     adjuntarComprobante,
    decidir:      resolverComprobante,
    refrescar:    refrescarComprobantes,
    subiendo:     guardaComprobante.enVuelo,
    enVuelo:      filasComprobante.enVuelo,
    error:        errorComprobante.mensaje,
    mostrarError: errorComprobante.mostrar,
    limpiarError: errorComprobante.limpiar,
  };

  // TERCERA montura de las transiciones (board, detalle, y ahora la fila). La
  // fila ofrece UNA sola —la que el estado permite, resuelta por
  // `accionFilaEntrega`— y nunca la de reprogramar: eso exige ver por qué falló y
  // vive en el detalle.
  //
  // Toast y no error inline: la fila no está dentro de ningún diálogo, así que
  // aplica la mitad de la división de vehículos que corresponde a una página.
  const transicionFila = useTransicionEntrega({
    onUpdated: (sh) => setOrders(prev => prev.map(o => o.shipping?.id === sh.id ? { ...o, shipping: sh } : o)),
  });

  // Only the plain string text/textarea fields — the canal, product lines,
  // método previsto (Select) and pagoRecibido (Checkbox) have bespoke controls.
  const field = (key: Exclude<keyof OrderForm, 'items' | 'canal' | 'metodoPagoPrevisto' | 'pagoRecibido'>) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órdenes</h1>
          <p className="text-sm text-muted-foreground">{orders.length} órdenes en total</p>
        </div>
        <Button onClick={openNewOrder} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva Orden
        </Button>
      </div>

      {/* Status pills — a pill is active when its estado is in the URL set, so a
          multi-estado link (e.g. from "Órdenes del mes") lights up both. Selecting
          an estado pill clears "Por cobrar" and vice versa (they're orthogonal). */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all' as const, label: 'Todas', count: orders.length },
          ...ESTADOS.map(e => ({ key: e, label: e.charAt(0).toUpperCase() + e.slice(1), count: stats[e] })),
        ].map(s => {
          const active = !porCobrar && (s.key === 'all' ? estados.length === 0 : estados.includes(s.key));
          return (
            <button
              key={s.key}
              onClick={() => setParams({ estado: s.key === 'all' ? null : s.key, cobrar: null })}
              aria-pressed={active}
              className={filterChip(active)}
            >
              {s.label}
              <span className={FILTER_CHIP_COUNT}>{s.count}</span>
            </button>
          );
        })}
        {/* "Por cobrar" — contraentrega despachada sin pago (la definición
            compartida con el dashboard: isPorCobrar). */}
        <button
          onClick={() => setParams({ estado: null, cobrar: porCobrar ? null : '1' })}
          aria-pressed={porCobrar}
          title="Contraentrega despachada, pago pendiente"
          // Conserva su ámbar muted (espera) en los dos estados; lo que dice
          // "aplicado" es el borde, igual que en los chips neutros de al lado.
          className={filterChipTono(
            porCobrar,
            'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50',
          )}
        >
          Por cobrar
          <span className={FILTER_CHIP_COUNT}>{porCobrarCount}</span>
        </button>
      </div>

      {/* Search + date range */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente u orden..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <DateRangePicker
          desde={desde}
          hasta={hasta}
          onChange={(d, h) => setParams({ desde: d, hasta: h })}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
            <X className="w-3.5 h-3.5" /> Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState onNew={openNewOrder} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['#Orden', 'Cliente', 'Canal', 'Total', 'Estado', 'Entrega', 'Programada', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                    onClick={() => setParams({ order: o.numero_orden }, 'push')}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{o.numero_orden}</td>
                    {/* Solo el nombre (link → perfil, con WhatsApp). El teléfono
                        se quitó de la lista: es dato de caso-normal; el contacto
                        vive en el perfil y en el diálogo de la orden. */}
                    <td className="px-4 py-3">
                      <CustomerLink id={o.cliente_id} nombre={o.cliente_nombre} className="font-medium" />
                    </td>
                    {/* Canal en texto plano (sin chip): el canal es dato de
                        caso-normal; consistencia sobre condicionalidad. */}
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize text-muted-foreground">{o.canal}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCOP(o.total)}</td>
                    {/* Estado = pago (Pendiente/Pagado/Cancelado). Se etiqueta la
                        EXCEPCIÓN donde importa (diálogo de la orden, tarjetas de
                        Entregas, "Por cobrar" del dashboard), no el default en la
                        lista → aquí NO va el badge Contraentrega. */}
                    <td className="px-4 py-3">
                      <StatusBadge status={o.estado} />
                    </td>
                    {/* Entrega va JUNTO a Estado —los dos ciclos de la orden se
                        leen de un vistazo, sin cruzar la tabla— y Acciones cierra
                        la fila, que es donde la mano la busca. */}
                    <td className="px-4 py-3">
                      <CeldaEntrega orden={o} />
                    </td>
                    {/* "Programada" = la fecha de la ENTREGA (la real si ya
                        llegó), no la de creación. La fecha en que se creó una
                        orden no mueve ninguna decisión del día; la de entrega sí,
                        y ahora se escanea en vertical en vez de ir colgada del
                        chip. La creación vive en el detalle. */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fechaEntrega(o)}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {/* Registrar pago — solo para órdenes pendientes de pago.
                            Confirma pago + pasa a Pagado + crea la entrega. Es EL
                            único camino a `pagado`: el viejo dropdown de estado ya
                            no está (escribía cobro a mano y fabricaba plata
                            fantasma). */}
                        {o.estado === 'pendiente' && (
                          <Button
                            variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
                            onClick={() => setPaymentOrder(o)}
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Registrar pago
                          </Button>
                        )}
                        <AccionEntregaFila
                          orden={o}
                          transicion={transicionFila}
                          preparando={filasPrepara.enVuelo(o.id)}
                          onProgramar={() => openSchedule(o)}
                        />
                        {/* Cancelar — la única transición de estado que la fila
                            escribe ahora, tras un confirm. Solo si NO está ya
                            cancelada (nada que cancelar). `destructiveGhost`: tinte
                            rojo suave, no sólido — es de fila, no la acción
                            principal de la vista (Amber Minimal). */}
                        {o.estado !== 'cancelado' && (
                          <Button
                            variant="destructiveGhost" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
                            onClick={() => setCancelando(o)}
                          >
                            <Ban className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                        )}
                        {/* Terciario y al final: la fila entera ya abre el detalle
                            y el número se lee como link, pero ninguna de las dos
                            cosas se ANUNCIA. La redundancia ES la señal — un
                            operador que no descubre el detalle no usa nada de lo
                            que vive adentro. */}
                        <Button
                          variant="ghost" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap text-muted-foreground"
                          onClick={() => setParams({ order: o.numero_orden }, 'push')}
                        >
                          Ver detalle
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Delivery Dialog — pre-filled from a paid order */}
      <ScheduleDeliveryModal
        target={scheduleOrder && scheduleOrder.shipping
          ? { shipping: scheduleOrder.shipping, ordenId: scheduleOrder.id }
          : null}
        onClose={() => setScheduleOrder(null)}
        onSaved={(sh) => { if (scheduleOrder) handleScheduled(scheduleOrder.id, sh); }}
        onAddressAdded={(orderId, address) => setOrders(prev => prev.map(o =>
          o.id === orderId
            ? { ...o, direccion_entrega: address.direccion_entrega, ciudad_entrega: address.ciudad_entrega }
            : o
        ))}
      />

      {/* Register Payment Dialog — cliente/monto read-only from the order */}
      <RegisterPaymentModal
        target={paymentOrder ? {
          id:      paymentOrder.id,
          numero:  paymentOrder.numero_orden,
          cliente: paymentOrder.cliente_nombre ?? null,
          monto:   paymentOrder.total,
        } : null}
        declaredMetodo={paymentOrder?.metodoPagoPrevisto ?? paymentOrder?.metodo_pago ?? null}
        onClose={() => setPaymentOrder(null)}
        onSaved={({ order: actualizada, comprobante }) => handleOrderUpdate(
          // El soporte se sube DESPUÉS del Payment, así que no viene en la
          // respuesta de la orden: se concatena. Sin esto, adjuntar desde la
          // fila dejaría el comprobante invisible hasta recargar.
          comprobante
            ? { ...actualizada, comprobantes: [...(actualizada.comprobantes ?? []), comprobante] }
            : actualizada,
        )}
      />

      {/* Despachar sin pago desde la FILA — la misma confirmación del board y
          del detalle, tercera montura. */}
      <ConfirmDespachoSinPago {...transicionFila.confirmacion} />

      {/* Cancelar orden — UN solo confirm para la fila Y el detalle (el detalle
          dispara `onCancelar` → `setCancelando(order)`). `handleCancelar` escribe
          `estado: 'cancelado'` y actualiza `orders`; como el detalle deriva su
          orden de esa lista, se refresca solo a "Cancelada" sin cerrarse. Rojo por
          severidad (terminal, anula envío, reintegra stock) con `busyLabel` propio
          porque NO borra. Lanza si el server rechaza: el confirm queda abierto con
          el motivo inline. */}
      <ConfirmDeleteDialog
        open={!!cancelando}
        onOpenChange={(abierto) => { if (!abierto) setCancelando(null); }}
        title={CANCELAR_ORDEN_COPY.title}
        entityLabel={cancelando ? `Orden ${cancelando.numero_orden}${cancelando.cliente_nombre ? ` · ${cancelando.cliente_nombre}` : ''}` : ''}
        consequence={CANCELAR_ORDEN_COPY.consequence}
        confirmLabel={CANCELAR_ORDEN_COPY.confirmLabel}
        busyLabel="Cancelando…"
        successMessage="Orden cancelada"
        onConfirm={async () => {
          if (!cancelando) return;
          await handleCancelar(cancelando.id);
          setCancelando(null);
        }}
      />

      {/* Order Detail Dialog */}
      {/* `onOpenChange` recibe el estado NUEVO. `closeDetail` lo ignoraba y
          cerraba siempre, así que cualquier `onOpenChange(true)` habría borrado
          el parámetro de la URL — nada debe cerrarse sin que Radix lo pida. */}
      <Dialog open={!!selected} onOpenChange={(abierto) => { if (!abierto) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orden {selected?.numero_orden}</DialogTitle>
            {/* `sr-only`: Radix EXIGE una descripción (o un
                `aria-describedby={undefined}` explícito) y sin ella el lector de
                pantalla anuncia un diálogo sin decir de qué trata. Va oculta
                porque el contenido ya lo dice a la vista, y una línea de chrome
                encima competiría con la respuesta — que es lo que este diálogo
                existe para dar primero. Mismo patrón que el ⌘K. */}
            <DialogDescription className="sr-only">
              Estado de entrega y de pago de la orden, con las acciones disponibles según su estado.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <OrderDetail
              order={selected}
              onClose={closeDetail}
              onUpdate={handleOrderUpdate}
              onCancelar={() => setCancelando(selected)}
              comprobantes={controlComprobantes}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) errorCrear.limpiar(); setShowForm(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden</DialogTitle>
            <DialogDescription className="sr-only">
              Crea una orden manual: cliente, productos, costo de envío y método de pago previsto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre del Cliente *</Label>
                <Input {...field('cliente_nombre')} className="mt-1" />
              </div>
              <div>
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  value={form.cliente_email}
                  onChange={e => { setForm(f => ({ ...f, cliente_email: e.target.value })); onIdentityChange(); }}
                  onBlur={detectCustomer}
                  className="mt-1" placeholder="Opcional"
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.cliente_telefono}
                  onChange={e => { setForm(f => ({ ...f, cliente_telefono: e.target.value })); onIdentityChange(); }}
                  onBlur={detectCustomer}
                  className="mt-1" placeholder="300 000 0000"
                />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground">* Ingresa al menos un teléfono o correo del cliente.</p>

              {/* Detección proactiva de duplicado — banner NO bloqueante (pero el
                  submit exige elegir; ver el gate en handleSave). Lista TODOS los
                  clientes que comparten estos datos, uno por fila. */}
              {customerMatches.length > 0 && !decision && (
                <div
                  ref={bannerRef}
                  className={`col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 ${gateBlocked ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background' : ''} ${gatePulse ? 'animate-pulse' : ''}`}
                >
                  <p className="mb-2 text-amber-900 dark:text-amber-200">
                    {customerMatches.length === 1
                      ? <>Estos datos ya pertenecen a un cliente:</>
                      : <>Estos datos pertenecen a <strong>{customerMatches.length} clientes</strong>:</>}
                  </p>
                  <ul className="space-y-1.5">
                    {customerMatches.map((mtch, i) => (
                      <li key={mtch.id} className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2.5 py-1.5">
                        <span className="min-w-0 truncate">
                          <strong className="font-medium">{mtch.nombre}</strong>
                          <span className="text-muted-foreground"> · {mtch.ordenes} {mtch.ordenes === 1 ? 'orden' : 'órdenes'}</span>
                        </span>
                        <Button ref={i === 0 ? firstActionRef : undefined} type="button" size="sm" className="shrink-0" onClick={() => chooseUsar(mtch)}>Usar</Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={chooseNuevo}>Crear cliente nuevo</Button>
                  </div>
                </div>
              )}

              {/* Decisión tomada: adjuntar a un cliente existente. */}
              {decision?.tipo === 'usar' && (
                <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
                  <span className="text-emerald-900 dark:text-emerald-200">
                    Vinculado a <strong>{form.cliente_nombre}</strong> — la orden se adjunta a este cliente.
                  </span>
                  <button type="button" onClick={() => setDecision(null)} aria-label="Cambiar decisión" className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Decisión tomada: crear cliente nuevo pese al match. */}
              {decision?.tipo === 'nuevo' && (
                <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Se creará un <strong className="text-foreground">cliente nuevo</strong> (duplicado consciente).</span>
                  <button type="button" onClick={() => setDecision(null)} aria-label="Cambiar decisión" className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="col-span-2">
                <Label>Canal</Label>
                <Select value={form.canal} onValueChange={v => setForm(f => ({ ...f, canal: v as OrderChannel }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANALES.map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Productos — líneas reales; el total lo calcula el servidor */}
            <div className="border-t border-border pt-3">
              <Label>Productos *</Label>
              <div className="mt-2 space-y-2">
                {form.items.map((line, i) => {
                  const product = productBySlug(line.slug);
                  const opciones = product?.moliendasOpciones ?? [];
                  const lineSubtotal = product ? product.precio * line.cantidad : 0;
                  return (
                    <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
                      <div className="min-w-[180px] flex-1">
                        <span className="text-xs text-muted-foreground">Producto</span>
                        <Select value={line.slug} onValueChange={v => updateLine(i, { slug: v, molienda: defaultMolienda(v) })}>
                          <SelectTrigger className="mt-0.5 h-9"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                          <SelectContent>
                            {catalog.map(p => (
                              <SelectItem key={p.slug} value={p.slug} disabled={p.disponible === false}>
                                {p.nombre}{p.disponible === false ? ' (Agotado)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-16">
                        <span className="text-xs text-muted-foreground">Cant.</span>
                        <Input
                          type="number" min={1}
                          value={line.cantidad}
                          onChange={e => updateLine(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                          className="mt-0.5 h-9"
                        />
                      </div>
                      {opciones.length > 0 && (
                        <div className="min-w-[130px]">
                          <span className="text-xs text-muted-foreground">Molienda</span>
                          <Select value={line.molienda} onValueChange={v => updateLine(i, { molienda: v })}>
                            <SelectTrigger className="mt-0.5 h-9"><SelectValue placeholder="Molienda" /></SelectTrigger>
                            <SelectContent>
                              {opciones.map(o => (
                                <SelectItem key={o.nombre} value={o.nombre} disabled={!o.disponible}>
                                  {o.nombre}{!o.disponible ? ' (Próximamente)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-2 pb-1">
                        <span className="text-sm font-medium tabular-nums">{formatCOP(lineSubtotal)}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          disabled={form.items.length === 1}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                          aria-label="Quitar producto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="mt-2 gap-1">
                <Plus className="w-3.5 h-3.5" /> Agregar producto
              </Button>
            </div>

            {/* Envío (manual) + total calculado (solo lectura) */}
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
              <div>
                <Label>Costo de Envío</Label>
                <Input type="number" min={0} {...field('costo_envio')} className="mt-1" />
              </div>
              <div className="self-end space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCOP(itemsSubtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Envío</span><span className="tabular-nums">{formatCOP(Number(form.costo_envio) || 0)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-bold"><span>Total</span><span className="tabular-nums">{formatCOP(calcTotal)}</span></div>
              </div>
            </div>

            {/* Pago previsto — método declarado (opcional). NO cobra ni marca la
                orden como pagada por sí solo; la orden nace Pendiente. La CONDICIÓN
                de pago ya no se pregunta: se DERIVA del método (Efectivo ⇒
                Contraentrega). El checkbox registra el pago en el mismo acto
                (requiere un método que NO sea Efectivo). */}
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <Label>Método de pago</Label>
                <Select
                  value={form.metodoPagoPrevisto || POR_DEFINIR}
                  onValueChange={v => {
                    const metodo = (v === POR_DEFINIR ? '' : v) as OrderForm['metodoPagoPrevisto'];
                    // Sin método, o Efectivo (⇒ contraentrega), "ya pagado" no aplica.
                    setForm(f => ({ ...f, metodoPagoPrevisto: metodo, pagoRecibido: metodo && metodo !== 'EFECTIVO' ? f.pagoRecibido : false }));
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={POR_DEFINIR}>Por definir</SelectItem>
                    {METODOS_PAGO.map(m => (
                      <SelectItem key={m} value={m}>{METODO_PAGO_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.metodoPagoPrevisto === 'EFECTIVO' && (
                <p className="text-xs text-muted-foreground">
                  Efectivo = contraentrega: el envío podrá prepararse y despacharse con la orden pendiente; el pago se registra al entregar.
                </p>
              )}
              <label className={`flex items-start gap-2 ${form.metodoPagoPrevisto && form.metodoPagoPrevisto !== 'EFECTIVO' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <Checkbox
                  checked={form.pagoRecibido}
                  disabled={!form.metodoPagoPrevisto || form.metodoPagoPrevisto === 'EFECTIVO'}
                  onCheckedChange={c => setForm(f => ({ ...f, pagoRecibido: c === true }))}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  El pago ya fue recibido
                  {!form.metodoPagoPrevisto && (
                    <span className="block text-xs text-muted-foreground">
                      Selecciona un método de pago para poder marcarlo.
                    </span>
                  )}
                  {form.metodoPagoPrevisto === 'EFECTIVO' && (
                    <span className="block text-xs text-muted-foreground">
                      No aplica en efectivo (contraentrega) — el pago se registra al entregar.
                    </span>
                  )}
                </span>
              </label>
            </div>

            {/* Dirección + notas */}
            <div className="space-y-4 border-t border-border pt-3">
              <div>
                <Label>Dirección de Entrega</Label>
                <Input {...field('direccion_entrega')} className="mt-1" />
              </div>
              {/* Ciudad y departamento OPCIONALES — la orden manual se sigue
                  creando sin ellos. La ciudad no es decorativa: sin ella el
                  modal de "Programar entrega" no puede sugerir zona (la
                  heurística exige ciudad para saber si es local). */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ciudad / Municipio</Label>
                  <Input {...field('ciudad_entrega')} className="mt-1" placeholder="Opcional" />
                </div>
                <div>
                  <Label>Departamento</Label>
                  <Select
                    value={form.departamento || NINGUN_DEPARTAMENTO}
                    onValueChange={v => setForm(f => ({ ...f, departamento: v === NINGUN_DEPARTAMENTO ? '' : v }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value={NINGUN_DEPARTAMENTO}>Sin especificar</SelectItem>
                      {COLOMBIA_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.ciudad_entrega.trim() === '' && form.direccion_entrega.trim() !== '' && (
                <p className="text-xs text-muted-foreground">
                  Sin ciudad no se podrá sugerir la zona al programar la entrega.
                </p>
              )}
              <div>
                <Label>Notas Internas</Label>
                <textarea
                  {...field('notas_internas')}
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-16 resize-none"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 pt-2">
            {gateBlocked && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Elige el cliente antes de crear la orden.</p>
            )}
            <div className="flex w-full items-center justify-end gap-3">
              <ErrorDialogo mensaje={errorCrear.mensaje} />
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.cliente_nombre || (!form.cliente_email.trim() && !form.cliente_telefono.trim()) || !hasProduct}
              >
                {saving ? 'Creando…' : 'Crear Orden'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── AccionEntregaFila ────────────────────────────────────────────────────────
// UNA acción de fulfillment por fila: la que el estado permite. Cuál es lo
// decide `accionFilaEntrega` (puro, testeado) — acá sólo se pinta.
//
// "Editar entrega" ya no existe en la fila. Editar una programación hecha,
// reprogramar una fallida y cualquier caso raro viven en el detalle, que es
// donde está el contexto para decidirlos; la fila es el carril rápido.

function AccionEntregaFila({ orden, transicion, preparando, onProgramar }: {
  orden:      Order;
  transicion: TransicionEntrega;
  preparando: boolean;
  onProgramar: () => void;
}) {
  const accion   = accionFilaEntrega(orden);
  const shipping = orden.shipping ?? null;
  // Guarda D+R: el `disabled` sale del estado del hook y el ref síncrono de
  // `useAccionesPorFila` corta el segundo click del mismo tick. El texto
  // intermedio es la otra mitad — sin él el botón se queda mudo mientras viaja,
  // que es lo que hace que el operador vuelva a clickear.
  const enVuelo = shipping ? transicion.enVuelo(shipping.id) : false;

  if (accion.tipo === 'ninguna') return null;

  if (accion.tipo === 'programar') {
    return (
      <Button
        variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
        disabled={preparando}
        onClick={onProgramar}
      >
        <Truck className="w-3.5 h-3.5" />
        {preparando ? 'Preparando…' : 'Programar entrega'}
      </Button>
    );
  }

  // Las tres restantes operan sobre un Shipping existente (el resolver lo
  // garantiza; el guard es para el compilador).
  if (!shipping) return null;

  if (accion.tipo === 'despachar_bloqueado') {
    const motivo = accion.falta === 'mensajero'
      ? 'Asigna un mensajero para despachar'
      : 'Asigna una fecha programada para despachar';
    // El `span` lleva el title: un button deshabilitado se traga el hover. Se
    // muestra y no se esconde — lo que falta se completa en el detalle, y una
    // acción ausente mandaría a buscarla a otra pantalla.
    return (
      <span className="inline-flex cursor-not-allowed" title={motivo}>
        <Button variant="outline" size="sm" disabled className="h-7 gap-1 text-xs whitespace-nowrap" aria-label={motivo}>
          <Truck className="w-3.5 h-3.5" /> Marcar En Ruta
        </Button>
      </span>
    );
  }

  if (accion.tipo === 'despachar') {
    return (
      <Button
        variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
        disabled={enVuelo}
        onClick={() => transicion.despachar({
          id:          shipping.id,
          ordenPagada: orden.estado === 'pagado',
          numeroOrden: orden.numero_orden,
        })}
      >
        <Truck className="w-3.5 h-3.5" />
        {enVuelo ? 'Despachando…' : 'Marcar En Ruta'}
      </Button>
    );
  }

  return (
    <Button
      variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
      disabled={enVuelo}
      onClick={() => transicion.marcarEntregado(shipping.id)}
    >
      <CheckCircle className="w-3.5 h-3.5" />
      {enVuelo ? 'Marcando…' : 'Marcar Entregado'}
    </Button>
  );
}

// ─── CeldaEntrega ─────────────────────────────────────────────────────────────
// La columna "Entrega" de la lista. Todo lo que decide vive en `estadoEntrega`
// (puro, testeado); acá sólo se pinta — con el semáforo ÚNICO de StatusBadge y
// no con un mapa de colores propio.
//
// El `title` lleva el matiz que no merece una palabra en la columna: qué separa
// una orden sin registro de envío de un envío creado y vacío. Existe para
// diagnóstico, no para la lectura de un vistazo.

function CeldaEntrega({ orden }: { orden: Order }) {
  const entrega = estadoEntrega(orden);

  if (entrega.key === 'ninguno') {
    return <span className="text-muted-foreground" title={entrega.detalle}>—</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge
        tone={entrega.tono}
        label={entrega.etiqueta}
        title={entrega.detalle}
        className="whitespace-nowrap"
      />
      {entrega.porCobrar && <BadgePorCobrar />}
    </div>
  );
}

// Contraentrega despachada sin cobro: la plata está en la calle. Es la ÚNICA
// excepción de pago que se etiqueta fuera de la columna Estado — el default no
// lleva badge, que es lo que mantiene la lista legible.
function BadgePorCobrar() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      Por cobrar
    </span>
  );
}

// ─── OrderDetail ──────────────────────────────────────────────────────────────
// El detalle es el CENTRO DE MANDO de una orden: crear → programar → despachar →
// entregar (o reprogramar) → cobrar, sin salir de acá. Las acciones no son
// nuevas: son las MISMAS de Entregas y las mismas del modal de pago, montadas
// desde otra puerta. Los gates del servidor no se relajan ni se replican — se
// consultan (`isScheduledShipping`) sólo para decidir qué botón ofrecer.
//
// Jerarquía (§ Analítica — la respuesta primero): arriba el estado de entrega y
// el de pago con sus acciones; la evidencia densa —contacto, dirección,
// productos, edición manual— vive en pliegues. El timeline de dos puntos que
// había antes se retiró: la sección Pago dice el mismo hecho Y ofrece la acción.

/**
 * Todo lo que el detalle necesita para operar comprobantes SIN ser el dueño del
 * dato. Vive en la página (§ Comprobantes: el dato vive acá): así una subida no
 * puede perderse porque el diálogo se cerró en medio.
 */
export interface ControlComprobantes {
  adjuntar:     (ordenId: string, file: File) => void;
  /** LANZA si el servidor rechaza; quien llama decide dónde mostrar el motivo. */
  decidir:      (ordenId: string, id: string, accion: 'verificar' | 'rechazar') => Promise<void>;
  /** Trae del SERVIDOR y mergea. Se llama al abrir el detalle. */
  refrescar:    (ordenId: string) => void;
  subiendo:     boolean;
  enVuelo:      (id: string) => boolean;
  error:        string | null;
  mostrarError: (e: unknown, fallback: string) => void;
  limpiarError: () => void;
}

interface OrderDetailProps {
  order:        Order;
  onClose:      () => void;
  onUpdate:     (updated: Order) => void;
  // Abre el confirm de cancelación (owned por la página, uno solo para fila y
  // detalle). El detalle no muta el estado por su cuenta: cobro ya no se escribe y
  // cancelar pasa por el mismo confirm que la fila.
  onCancelar:   () => void;
  comprobantes: ControlComprobantes;
}

function OrderDetail({ order, onClose, onUpdate, onCancelar, comprobantes: control }: OrderDetailProps) {
  // Solo notas. El estado de COBRO (pagado/pendiente) ya NO se edita desde aquí:
  // se deriva del Payment y el server rechaza escribirlo (§ El eje de cobro no se
  // escribe crudo). Con eso desaparece de raíz el bug de la copia congelada —
  // "Guardar Cambios" ya no reenvía un `estado` que pudiera revertir un pago.
  const [notas, setNotas] = useState(order.notas_internas ?? '');

  const guardaDetalle = useAccionGuardada();
  const errorDetalle  = useErrorDialogo();
  // El panel de detalle se monta por orden (`key`), así que cerrar y reabrir lo
  // desmonta y el error se va con él — no hace falta limpiarlo a mano.
  const handleUpdate = () => guardaDetalle.ejecutar(async () => {
    errorDetalle.limpiar();
    // Cierre SOLO tras confirmación. El server puede rechazar (p. ej. nada que
    // guardar es benigno, pero un 409 de otra validación debe llegar con el
    // detalle todavía abierto).
    let updated: Order;
    try {
      updated = await updateOrder(order.id, { notas_internas: notas });
    } catch (e) {
      errorDetalle.mostrar(e, 'No se pudo actualizar la orden');
      return;
    }
    toast.success('Notas guardadas');
    onUpdate(updated);
    onClose();
  });

  // ── Fulfillment ────────────────────────────────────────────────────────────
  const shipping = order.shipping ?? null;
  const entrega  = estadoEntrega(order);

  // Entrega que se está programando (abre el modal COMPARTIDO, el mismo de
  // Entregas). Se guarda aparte del prop porque "Preparar envío" tiene que
  // abrirlo sobre el Shipping recién creado.
  const [programando, setProgramando] = useState<Shipping | null>(null);
  const [cobrando, setCobrando]       = useState(false);

  // ── Comprobantes ───────────────────────────────────────────────────────────
  // El detalle sólo RENDERIZA: las mutaciones y el error viven en la página, que
  // sobrevive a que este diálogo se cierre.
  const comprobantes = order.comprobantes ?? [];
  const lightbox     = useLightboxComprobante();

  // Al abrir, la lista se recontrasta contra el servidor. Es lo que cura el caso
  // en que una subida anterior perdió su continuación: en vez de mostrar un
  // vacío que la base contradice, el modal abierto se ACTUALIZA. Depende sólo de
  // `order.id`, así que el merge que provoca no lo vuelve a disparar.
  const refrescar = control.refrescar;
  useEffect(() => { refrescar(order.id); }, [order.id, refrescar]);

  /**
   * Comprobante EN VERIFICACIÓN. Guarda el objeto y no sólo el id porque el modal
   * de pago lo muestra: entrar por "Verificar" tiene que decir de cuál soporte
   * se está hablando antes de que el operador confirme una plata.
   *
   * Existe porque verificar un soporte de una orden sin plata no puede limitarse
   * a sellar la fila: la verificación CREA la plata (§3.1), así que primero se
   * abre Registrar Pago y el sello viene después.
   */
  const [enVerificacion, setEnVerificacion] = useState<Comprobante | null>(null);

  // Rechazar pasa por confirmación: el copy es lo que vuelve DESCUBRIBLE que
  // rechazar no borra y que se puede adjuntar el correcto.
  const [rechazando, setRechazando] = useState<Comprobante | null>(null);

  // Verificar: con la orden pendiente abre Registrar Pago y deja el sello
  // pendiente; con la plata ya adentro, sella directo.
  const verificar = (c: Comprobante) => {
    control.limpiarError();
    if (accionAlVerificar(order.estado) === 'cobrar') {
      setEnVerificacion(c);
      setCobrando(true);
      return;
    }
    control.decidir(order.id, c.id, 'verificar')
      .catch(e => control.mostrarError(e, 'No se pudo verificar el comprobante'));
  };

  const guardaPreparar = useAccionGuardada();
  const errorEntrega   = useErrorDialogo();

  // Las transiciones, del hook COMPARTIDO con el board — dos puertas al mismo
  // endpoint. `onError` inline y no toast: estamos dentro de un diálogo, y ahí
  // es donde está mirando el operador (§ Toast = éxito, inline = error).
  const transicion = useTransicionEntrega({
    onUpdated: (sh) => onUpdate({ ...order, shipping: sh }),
    onError:   (e)  => errorEntrega.mostrar(e, 'No se pudo actualizar la entrega'),
  });

  // Crea el Shipping si falta (server-guarded, idempotente) y abre el modal. La
  // guarda no protege el dato —el server lo hace— sino al operador: sin ella el
  // botón se queda mudo mientras viaja.
  const abrirProgramar = () => guardaPreparar.ejecutar(async () => {
    errorEntrega.limpiar();
    if (shipping) { setProgramando(shipping); return; }
    try {
      const creado = await ensureOrderShipping(order.id);
      onUpdate({ ...order, shipping: creado });
      setProgramando(creado);
    } catch (e) {
      errorEntrega.mostrar(e, 'No se pudo preparar la entrega');
    }
  });

  const enVuelo = shipping ? transicion.enVuelo(shipping.id) : false;
  const falta   = missingToDispatch(shipping);

  // Lo que ya se decidió de la entrega, en una línea. Sólo lo que EXISTE — un
  // "Mensajero: —" ocuparía el mismo espacio para no decir nada.
  const evidencia = shipping
    ? [
        shipping.mensajero?.trim() && `Mensajero: ${shipping.mensajero.trim()}`,
        shipping.zona && `Zona: ${shipping.zona}`,
        shipping.fecha_programada?.trim() && `Programada: ${formatFecha(shipping.fecha_programada)}`,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="space-y-5">
      {/* Cliente + fecha — el encabezado mínimo; el resto del contacto se pliega */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CustomerLink id={order.cliente_id} nombre={order.cliente_nombre} className="font-medium capitalize" />
        <span className="text-xs text-muted-foreground">Creada el {formatFecha(order.createdAt)}</span>
      </div>

      {/* ── ENTREGA ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entrega</p>
          {entrega.key === 'ninguno'
            ? <span className="text-xs text-muted-foreground" title={entrega.detalle}>—</span>
            : <StatusBadge tone={entrega.tono} label={entrega.etiqueta} title={entrega.detalle} />}
        </div>

        {evidencia && <p className="text-xs capitalize text-muted-foreground">{evidencia}</p>}

        {/* Las acciones que el ESTADO permite — ni una más. Las que no aplican no
            se deshabilitan: no están, porque un botón muerto es una pregunta. La
            excepción es "Marcar En Ruta" sin mensajero o sin fecha, que sí se
            deshabilita DICIENDO qué falta (esconderla haría que el operador
            buscara la acción en otra pantalla). */}
        <div className="flex flex-wrap items-center gap-2">
          {order.estado === 'cancelado' ? (
            <p className="text-xs text-muted-foreground">La orden está cancelada: no hay entrega que gestionar.</p>
          ) : !shipping ? (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={guardaPreparar.enVuelo} onClick={abrirProgramar}>
              <Truck className="w-3.5 h-3.5" />
              {guardaPreparar.enVuelo ? 'Preparando…' : 'Preparar envío'}
            </Button>
          ) : shipping.estado === 'preparando' ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={guardaPreparar.enVuelo} onClick={abrirProgramar}>
                {hasScheduleData(shipping)
                  ? <><Pencil className="w-3.5 h-3.5" /> Editar entrega</>
                  : <><Truck className="w-3.5 h-3.5" /> Programar entrega</>}
              </Button>
              {isScheduledShipping(shipping) ? (
                <Button
                  variant="outline" size="sm" className="gap-1.5" disabled={enVuelo}
                  onClick={() => transicion.despachar({
                    id:          shipping.id,
                    ordenPagada: order.estado === 'pagado',
                    numeroOrden: order.numero_orden,
                  })}
                >
                  <Truck className="w-3.5 h-3.5" /> Marcar En Ruta
                </Button>
              ) : hasScheduleData(shipping) && (
                // El `span` es el que lleva el title: un button deshabilitado se
                // traga el hover. Mismo criterio que el tooltip del board.
                <span
                  className="inline-flex cursor-not-allowed"
                  title={falta === 'mensajero'
                    ? 'Asigna un mensajero para despachar'
                    : 'Asigna una fecha programada para despachar'}
                >
                  <Button variant="outline" size="sm" disabled className="gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Marcar En Ruta
                  </Button>
                </span>
              )}
            </>
          ) : shipping.estado === 'en_ruta' ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={enVuelo} onClick={() => transicion.marcarEntregado(shipping.id)}>
                <CheckCircle className="w-3.5 h-3.5" /> Marcar Entregado
              </Button>
              <Button variant="destructiveGhost" size="sm" className="gap-1.5" disabled={enVuelo} onClick={() => transicion.marcarFallido(shipping.id)}>
                <AlertCircle className="w-3.5 h-3.5" /> Marcar Fallido
              </Button>
            </>
          ) : shipping.estado === 'fallido' ? (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={guardaPreparar.enVuelo} onClick={abrirProgramar}>
              <RotateCcw className="w-3.5 h-3.5" /> Reprogramar
            </Button>
          ) : shipping.estado === 'entregado' ? (
            <p className="text-xs text-muted-foreground">Entrega completada.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Entrega anulada.</p>
          )}
        </div>

        <ErrorDialogo mensaje={errorEntrega.mensaje} />
      </section>

      {/* ── PAGO ────────────────────────────────────────────────────────────── */}
      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pago</p>
          {/* SIN badge "Por cobrar" acá, a diferencia de la columna de la lista.
              En el detalle el hecho ya está dicho dos veces —"Saldo pendiente"
              con su monto, y "Contraentrega" en la línea de abajo—; el chip era
              una tercera. En la LISTA sí va, porque ahí no hay ninguna de las
              dos y el recorte "despachada sin cobrar" no se puede deducir de una
              fila. Etiquetar la excepción es útil donde no hay contexto; donde
              lo hay, es ruido. */}
          <StatusBadge status={order.estado} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {order.estado === 'pagado' ? 'Total cobrado' : 'Saldo pendiente'}
            </p>
            <p className="text-base font-bold">{formatCOP(order.total)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {CONDICION_PAGO_LABEL[order.condicion_pago] ?? order.condicion_pago}
              {metodoPrevistoLabel(order) ? ` · ${metodoPrevistoLabel(order)}` : ''}
              {order.costo_envio > 0 ? ` · Envío ${formatCOP(order.costo_envio)}` : ''}
            </p>
          </div>
          {order.estado === 'pendiente' && (
            <Button onClick={() => setCobrando(true)} className="gap-2">
              <CreditCard className="w-4 h-4" /> Registrar pago
            </Button>
          )}
        </div>

        {/* ── Comprobantes ─────────────────────────────────────────────────
            La EVIDENCIA, no la plata. Vive bajo Pago porque es sobre el pago
            que habla, pero su estado no mueve la orden: eso lo hace el Payment
            y sólo él (§3.1). Por eso un comprobante VERIFICADO sobre una orden
            pendiente no puede existir — verificar cobra primero. */}
        {/* VACÍA colapsa a UNA LÍNEA. El bloque grande se gana con evidencia:
            una caja con borde, texto explicativo y línea de formatos ocupaba en
            el caso normal —que es no tener soportes— el espacio de la sección que
            sí responde algo. Los formatos pasan al `title` del botón, donde el
            que va a adjuntar los encuentra y el que no, no los lee.

            El botón Adjuntar SE QUEDA en el detalle: "el cliente mandó la foto,
            verifico después" es el caso de uso central, y adjuntar desde
            Registrar Pago coexiste sin reemplazarlo. */}
        {comprobantes.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Comprobantes (0)
              {order.estado === 'cancelado' && ' · la orden está cancelada'}
            </p>
            {order.estado !== 'cancelado' && (
              <SelectorComprobante
                onArchivo={(file) => control.adjuntar(order.id, file)}
                disabled={control.subiendo}
                label={control.subiendo ? 'Subiendo…' : 'Adjuntar'}
                title={`JPG, PNG, WebP o PDF · máx. ${MAX_COMPROBANTE_MB} MB. Adjuntar no registra el pago.`}
              />
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Comprobantes ({comprobantes.length})
              </p>
              <div className="flex items-center gap-2">
                <AyudaComprobante />
                <SelectorComprobante
                  onArchivo={(file) => control.adjuntar(order.id, file)}
                  disabled={control.subiendo || order.estado === 'cancelado'}
                  label={control.subiendo ? 'Subiendo…' : 'Adjuntar'}
                />
              </div>
            </div>

            <div className="space-y-2">
              {comprobantes.map(c => (
                <ComprobanteVista
                  key={c.id}
                  comprobante={c}
                  onAmpliar={lightbox.ampliar}
                  acciones={puedeDecidirse(c.estado) ? (
                    <>
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        disabled={control.enVuelo(c.id)}
                        onClick={() => verificar(c)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {control.enVuelo(c.id) ? 'Verificando…' : 'Verificar'}
                      </Button>
                      <Button
                        size="sm" variant="destructiveGhost" className="h-7 gap-1 text-xs"
                        disabled={control.enVuelo(c.id)}
                        onClick={() => { control.limpiarError(); setRechazando(c); }}
                      >
                        <AlertCircle className="h-3.5 w-3.5" /> Rechazar
                      </Button>
                    </>
                  ) : undefined}
                />
              ))}
            </div>
          </div>
        )}
        {/* El error va FUERA de la caja: tiene que verse igual con la caja
            colapsada, que es justo cuando falla la primera subida. */}
        <ErrorDialogo mensaje={control.error} />
      </section>

      {/* ── La evidencia, plegada ───────────────────────────────────────────── */}
      <Pliegue label="Contacto y dirección">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Teléfono" value={order.cliente_telefono ?? '—'} />
          <InfoRow label="Canal"    value={order.canal} />
          {/* DECLARED method (intent). The REAL method of a registered payment
              lives on the Payment (see Pagos); this is what the customer said
              they'd use. */}
          <InfoRow label="Método previsto" value={metodoPrevistoLabel(order) ?? '—'} />
          <InfoRow label="Franja de entrega" value={findSlotLabel(order.deliverySlot) ?? '—'} />
          <div className="col-span-2">
            <InfoRow label="Dirección" value={order.direccion_entrega ?? '—'} />
          </div>
          <div className="col-span-2">
            <InfoRow label="Detalles adicionales" value={order.direccion_detalle ?? '—'} />
          </div>
        </div>
      </Pliegue>

      {(order.items?.length ?? 0) > 0 && (
        <Pliegue label={`Productos (${order.items!.length})`}>
          <div className="space-y-1.5">
            {order.items!.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm bg-muted/30 rounded-lg px-3 py-2">
                <span>
                  {item.producto_nombre} × {item.cantidad}
                  {item.moliendaSeleccionada && (
                    <span className="block text-xs text-muted-foreground">Molienda: {item.moliendaSeleccionada}</span>
                  )}
                </span>
                <span className="font-medium">{formatCOP(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </Pliegue>
      )}

      <Pliegue label="Editar orden (notas)">
        <div className="space-y-3">
          {/* Sin "Cambiar Estado": el eje de cobro se deriva del Payment y su
              único camino es Registrar Pago (arriba, sección Pago). Lo que queda
              editable a mano son las notas. */}
          <div>
            <Label className="text-xs">Notas Internas</Label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-20 resize-none"
            />
          </div>
          <Button onClick={handleUpdate} disabled={guardaDetalle.enVuelo} className="w-full">
            {guardaDetalle.enVuelo ? 'Guardando…' : 'Guardar Cambios'}
          </Button>
          {/* EXCEPCIÓN de colocación: este botón es `w-full`, así que no queda
              espacio horizontal a su lado. El error va DEBAJO y no encima, que es
              lo que mantiene quieto al botón — su posición la fija el contenido de
              arriba, que no cambia. El diálogo tiene `max-h-[85vh]` con scroll, así
              que a esa altura el crecimiento lo absorbe el scroll. */}
          <ErrorDialogo mensaje={errorDetalle.mensaje} />

          {/* Cancelar la orden — misma acción y mismo confirm que la fila
              (`onCancelar` abre el confirm de la página). Solo si NO está ya
              cancelada. Separada de "Guardar Cambios" por severidad: una es
              editar notas, la otra es terminal. */}
          {order.estado !== 'cancelado' && (
            <div className="border-t border-border/60 pt-3">
              <Button
                variant="destructiveGhost" size="sm" className="w-full gap-1"
                onClick={onCancelar}
              >
                <Ban className="w-4 h-4" /> Cancelar orden
              </Button>
            </div>
          )}
        </div>
      </Pliegue>

      {/* Los MISMOS modales que usa la tabla, montados desde acá. El detalle no
          se cierra: queda debajo y se refresca solo, porque la orden abierta se
          deriva de la lista por número. */}
      <ScheduleDeliveryModal
        target={programando ? { shipping: programando, ordenId: order.id } : null}
        onClose={() => setProgramando(null)}
        onSaved={(sh) => onUpdate({ ...order, shipping: sh })}
        onAddressAdded={(_, address) => onUpdate({
          ...order,
          direccion_entrega: address.direccion_entrega,
          ciudad_entrega:    address.ciudad_entrega,
        })}
      />

      <RegisterPaymentModal
        target={cobrando ? {
          id:      order.id,
          numero:  order.numero_orden,
          cliente: order.cliente_nombre ?? null,
          monto:   order.total,
        } : null}
        declaredMetodo={order.metodoPagoPrevisto ?? order.metodo_pago ?? null}
        verificando={enVerificacion}
        onClose={() => { setCobrando(false); setEnVerificacion(null); }}
        onSaved={({ order: actualizada, comprobante }) => {
          // La respuesta del pago no incluye el soporte recién subido (se sube
          // DESPUÉS del Payment), así que se concatena en vez de confiar en el
          // payload.
          const previos = actualizada.comprobantes ?? comprobantes;
          onUpdate({
            ...actualizada,
            comprobantes: comprobante ? [...previos, comprobante] : previos,
          });
          // EL ENLACE: entrar por Verificar deja este comprobante marcado, y al
          // volver el pago se sella con verificado_por/at. Va DESPUÉS y por
          // separado — si falla, la orden ya quedó pagada y un segundo click en
          // Verificar lo cierra (ahí ya cae en `sellar`). Al revés se afirmaría
          // un cobro que no ocurrió.
          if (enVerificacion) {
            const id = enVerificacion.id;
            setEnVerificacion(null);
            control.decidir(order.id, id, 'verificar')
              .catch(e => control.mostrarError(e, 'El pago quedó registrado, pero no se pudo sellar el comprobante. Vuelve a pulsar Verificar.'));
          }
        }}
      />

      {/* Rechazar CONFIRMA, y el copy declara el camino: el mecanismo de
          corrección ya existía —adjuntar otro— pero nada lo decía, así que era
          invisible justo cuando hace falta. `confirmKind='default'` porque no
          destruye nada: ámbar, no rojo. */}
      <ConfirmDeleteDialog
        open={!!rechazando}
        onOpenChange={(abierto) => { if (!abierto) setRechazando(null); }}
        title="Rechazar comprobante"
        entityLabel={rechazando ? nombreArchivo(rechazando.url) : ''}
        consequence="Quedará marcado como rechazado y NO se elimina: el archivo se conserva como constancia de que se revisó. Podrás adjuntar el comprobante correcto en esta misma orden."
        confirmLabel="Rechazar comprobante"
        confirmKind="default"
        onConfirm={async () => {
          if (!rechazando) return;
          // Lanza si el servidor rechaza: el diálogo se queda abierto y lo
          // muestra inline, que es su contrato.
          await control.decidir(order.id, rechazando.id, 'rechazar');
          setRechazando(null);
        }}
      />

      {/* El lightbox COMPARTIDO. Sólo lo abren las imágenes: un PDF sale a una
          pestaña nueva (ver ComprobanteVista). */}
      <ImageLightbox
        src={lightbox.abierto?.src ?? null}
        alt={lightbox.abierto?.alt}
        onClose={lightbox.cerrar}
      />

      <ConfirmDespachoSinPago {...transicion.confirmacion} />
    </div>
  );
}

// ─── CustomerLink ─────────────────────────────────────────────────────────────
// The customer name, as a link to their profile ONLY when the order actually
// resolves to one. Orders that predate the FK (or that the backfill could not
// resolve) render plain text — no dead link, no cursor-pointer promising a
// navigation that won't happen.
//
// stopPropagation matters: the table row is itself clickable (it opens the
// order), so without it a click on the name would BOTH navigate and open the
// order dialog.

function CustomerLink({ id, nombre, className = '' }: {
  id?: string | null;
  nombre?: string | null;
  className?: string;
}) {
  const label = nombre || '—';
  if (!id) return <p className={className}>{label}</p>;

  return (
    <Link
      href={`/admin/clientes/${id}`}
      onClick={e => e.stopPropagation()}
      title={`Ver perfil de ${label}`}
      className={`block w-fit rounded text-foreground underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {label}
    </Link>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label:  string;
  value?:  string;
  strong?: boolean;
}

function InfoRow({ label, value, strong }: InfoRowProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 capitalize ${strong ? 'font-bold text-base' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
        <ShoppingCart className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Sin órdenes aún</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Crea tu primera orden manualmente o espera que lleguen desde tus canales de venta.
      </p>
      <Button onClick={onNew} className="gap-2"><Plus className="w-4 h-4" /> Crear Orden</Button>
    </div>
  );
}