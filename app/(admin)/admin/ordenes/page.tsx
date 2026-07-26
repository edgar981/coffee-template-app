'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { Plus, Search, ShoppingCart, Truck, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BUSINESS_TZ, zonedDayKey } from '@/lib/timezone';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { getOrders, createOrder, updateOrder } from '@/lib/api/orders';
import { ensureOrderShipping } from '@/lib/api/shippings';
import { getCatalog } from '@/lib/api/products';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import { RegisterPaymentModal } from '@/components/admin/RegisterPaymentModal';
import type { Order, OrderForm, OrderLineForm, OrderStatus, OrderChannel } from '@/types/order';
import { CONDICION_PAGO_LABEL } from '@/types/order';
import type { Product } from '@/types/product';
import type { Shipping } from '@/types/shipping';
import { formatCOP } from '@/lib/utils';
import { findSlotLabel } from '@/lib/shipping-config';
import { isScheduledShipping } from '@/constants/shippings';
import { isPorCobrar } from '@/lib/metrics/order-stat-filters';
import { METODOS_PAGO, METODO_PAGO_LABEL, metodoPrevistoLabel } from '@/types/payment';

// ─── Constants ────────────────────────────────────────────────────────────────

// Order status is payment-only now. Fulfillment lives on Shipping.
const ESTADOS: OrderStatus[] = ['pendiente', 'pagado', 'cancelado'];

const CANALES: OrderChannel[] = ['whatsapp', 'instagram', 'directo', 'referido'];

// Sentinel for the empty "Por definir" option — Radix Select forbids value="".
// Mapped to '' (no metodoPagoPrevisto) in form state.
const POR_DEFINIR = '__por_definir__';

// Linear payment phases for the order-detail timeline (cancelado is non-linear).
const TIMELINE_ESTADOS: OrderStatus[] = ['pendiente', 'pagado'];

const EMPTY_FORM: OrderForm = {
  cliente_nombre:    '',
  cliente_email:     '',
  cliente_telefono:  '',
  canal:             'whatsapp',
  costo_envio:       '0',
  direccion_entrega: '',
  notas_internas:    '',
  items:             [{ slug: '', cantidad: 1, molienda: '' }],
  metodoPagoPrevisto: '',
  pagoRecibido:       false,
};

// Muted/outline pill marking a contraentrega order (both themes via tokens).
function CondicionBadge({ condicion }: { condicion?: string | null }) {
  if (condicion !== 'CONTRAENTREGA') return null;
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
      Contraentrega
    </span>
  );
}

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
  // Create-order submit guards. `saving` disables the button; `savingRef` blocks
  // a re-entrant handleSave synchronously (fast double-click). `idemKeyRef` holds
  // ONE idempotency key per opened form, so both clicks send the SAME key and the
  // server dedups even if two requests slip through.
  const [saving, setSaving]               = useState(false);
  const savingRef                         = useRef(false);
  const idemKeyRef                        = useRef<string>('');
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Opens the New Order form with a FRESH idempotency key — one key per intended
  // order, reused across double-clicks of that same form so the server can dedup.
  const openNewOrder = () => {
    idemKeyRef.current = crypto.randomUUID();
    setForm(EMPTY_FORM);
    setShowForm(true);
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

  const handleSave = async () => {
    // Synchronous re-entrancy guard: a second (fast) click returns immediately.
    if (savingRef.current) return;
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
    // Guarantee a key even if the form was opened without openNewOrder.
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();

    savingRef.current = true;
    setSaving(true);
    try {
      const created = await createOrder({
        cliente_nombre:    form.cliente_nombre,
        cliente_email:     form.cliente_email || undefined,
        cliente_telefono:  form.cliente_telefono || undefined,
        canal:             form.canal,
        costo_envio:       Number(form.costo_envio) || 0,
        direccion_entrega: form.direccion_entrega || undefined,
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la orden');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, estado: OrderStatus) => {
    // Same single write path as the modal: the response includes the (possibly
    // just auto-created) shipping, so "Programar entrega" appears immediately.
    const updated = await updateOrder(id, { estado });
    setOrders(prev => prev.map(o => o.id === id ? updated : o));
    toast.success(`Estado actualizado: ${estado}`);
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
  const openSchedule = async (o: Order) => {
    if (o.shipping) { setScheduleOrder(o); return; }
    try {
      const shipping = await ensureOrderShipping(o.id);
      const updated: Order = { ...o, shipping };
      setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
      setScheduleOrder(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo preparar la entrega');
    }
  };

  // Whether an order can be scheduled from the table now, and the button label.
  // Any non-cancelled order can "Preparar envío" — preparing is harmless (no
  // stock moves); the real gate is the confirmation at dispatch. Server-enforced.
  const canSchedule = (o: Order) =>
    o.estado !== 'cancelado' && (
      o.shipping?.estado === 'preparando' ||
      o.shipping?.estado === 'fallido' ||
      (!o.shipping && o.estado === 'pendiente')
    );

  const scheduleLabel = (o: Order) =>
    !o.shipping ? (o.estado === 'pendiente' ? 'Preparar envío' : 'Programar entrega')
    : o.shipping.estado === 'fallido' ? 'Reprogramar'
    : isScheduledShipping(o.shipping) ? 'Editar entrega'
    : 'Programar entrega';

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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {s.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                active ? 'bg-primary-foreground/20' : 'bg-background'
              }`}>
                {s.count}
              </span>
            </button>
          );
        })}
        {/* "Por cobrar" — contraentrega despachada sin pago (la definición
            compartida con el dashboard: isPorCobrar). */}
        <button
          onClick={() => setParams({ estado: null, cobrar: porCobrar ? null : '1' })}
          aria-pressed={porCobrar}
          title="Contraentrega despachada, pago pendiente"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            porCobrar
              ? 'bg-amber-500 text-white'
              : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
          }`}
        >
          Por cobrar
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${porCobrar ? 'bg-white/25' : 'bg-background'}`}>
            {porCobrarCount}
          </span>
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
                  {['#Orden', 'Cliente', 'Canal', 'Total', 'Estado', 'Fecha', 'Acciones', 'Entrega'].map(h => (
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
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{o.numero_orden}</td>
                    <td className="px-4 py-3">
                      <CustomerLink id={o.cliente_id} nombre={o.cliente_nombre} className="font-medium" />
                      {o.cliente_telefono && (
                        <p className="text-xs text-muted-foreground">{o.cliente_telefono}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded">{o.canal}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCOP(o.total)}</td>
                    {/* Estado = payment only (Pendiente/Pagado/Cancelado); the
                        muted pill marks contraentrega orders. */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={o.estado} />
                        <CondicionBadge condicion={o.condicion_pago} />
                      </div>
                    </td>
                    {/* Entrega = derived fulfillment status from the Shipping.
                        Only Preparando/En ruta/Entregado/Fallido — suppressed for
                        cancelled orders (don't repeat "Cancelado") and orders with
                        no Shipping (pendiente). */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Select value={o.estado} onValueChange={v => handleUpdateStatus(o.id, v as OrderStatus)}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ESTADOS.map(e => (
                              <SelectItem key={e} value={e} className="text-xs capitalize">{e}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Registrar pago — solo para órdenes pendientes de pago.
                            Confirma pago + pasa a Pagado + crea la entrega. */}
                        {o.estado === 'pendiente' && (
                          <Button
                            variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
                            onClick={() => setPaymentOrder(o)}
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Registrar pago
                          </Button>
                        )}
                        {/* Programar entrega — hidden once en ruta/entregado (real
                            fulfillment record) or cancelled. Under ALLOW_UNPAID it
                            also shows for an unpaid order with no Shipping yet, and
                            creates it on click (server-guarded). Scheduled date
                            lives on Entregas. */}
                        {canSchedule(o) && (
                          <Button
                            variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
                            onClick={() => openSchedule(o)}
                          >
                            <Truck className="w-3.5 h-3.5" /> {scheduleLabel(o)}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.shipping && o.shipping.estado !== 'cancelado'
                        ? <StatusBadge status={o.shipping.estado} />
                        : <span className="text-muted-foreground">—</span>}
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
        target={scheduleOrder && scheduleOrder.shipping ? { shipping: scheduleOrder.shipping } : null}
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
        onSaved={({ order }) => handleOrderUpdate(order)}
      />

      {/* Order Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={closeDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orden {selected?.numero_orden}</DialogTitle>
          </DialogHeader>
          {selected && (
            <OrderDetail
              order={selected}
              onClose={closeDetail}
              onUpdate={handleOrderUpdate}
              onRegisterPayment={(o) => { closeDetail(); setPaymentOrder(o); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva Orden</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre del Cliente *</Label>
                <Input {...field('cliente_nombre')} className="mt-1" />
              </div>
              <div>
                <Label>Correo electrónico</Label>
                <Input type="email" {...field('cliente_email')} className="mt-1" placeholder="Opcional" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input {...field('cliente_telefono')} className="mt-1" placeholder="300 000 0000" />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground">* Ingresa al menos un teléfono o correo del cliente.</p>
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
              <div>
                <Label>Notas Internas</Label>
                <textarea
                  {...field('notas_internas')}
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-16 resize-none"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.cliente_nombre || (!form.cliente_email.trim() && !form.cliente_telefono.trim()) || !hasProduct}
            >
              {saving ? 'Creando…' : 'Crear Orden'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── OrderDetail ──────────────────────────────────────────────────────────────

interface OrderDetailProps {
  order:    Order;
  onClose:  () => void;
  onUpdate: (updated: Order) => void;
  onRegisterPayment: (order: Order) => void;
}

function OrderDetail({ order, onClose, onUpdate, onRegisterPayment }: OrderDetailProps) {
  const [estado, setEstado] = useState<OrderStatus>(order.estado);
  const [notas, setNotas]   = useState(order.notas_internas ?? '');

  const handleUpdate = async () => {
    const updated = await updateOrder(order.id, { estado, notas_internas: notas });
    toast.success('Orden actualizada');
    onUpdate(updated);
    onClose();
  };

  const currentIdx = TIMELINE_ESTADOS.indexOf(order.estado);

  return (
    <div className="space-y-5">
      {/* Timeline */}
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {TIMELINE_ESTADOS.map((t, i) => (
          <div key={t} className="flex items-center gap-1 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full ${i <= currentIdx ? 'bg-primary' : 'bg-border'}`} />
            <span className={`text-xs ${i <= currentIdx ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
            {i < TIMELINE_ESTADOS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <CustomerLink id={order.cliente_id} nombre={order.cliente_nombre} className="mt-0.5 font-medium capitalize" />
        </div>
        <InfoRow label="Teléfono"        value={order.cliente_telefono ?? '—'} />
        <InfoRow label="Canal"           value={order.canal} />
        {/* DECLARED method (intent). The REAL method of a registered payment lives
            on the Payment (see Pagos); this is what the customer said they'd use. */}
        <InfoRow label="Método previsto" value={metodoPrevistoLabel(order) ?? '—'} />
        <div>
          <p className="text-xs text-muted-foreground">Condición de pago</p>
          <p className="mt-0.5 font-medium">
            {CONDICION_PAGO_LABEL[order.condicion_pago] ?? order.condicion_pago}
          </p>
          {/* Despachada sin pago: la plata está en la calle — hint sutil. */}
          {isPorCobrar(order) && (
            <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Por cobrar
            </span>
          )}
        </div>
        <InfoRow label="Total"           value={formatCOP(order.total)} strong />
        <InfoRow label="Envío"           value={formatCOP(order.costo_envio)} />
        <div className="col-span-2">
          <InfoRow label="Dirección" value={order.direccion_entrega ?? '—'} />
        </div>
        <div className="col-span-2">
          <InfoRow label="Detalles adicionales" value={order.direccion_detalle ?? '—'} />
        </div>
        <div className="col-span-2">
          <InfoRow label="Franja de entrega" value={findSlotLabel(order.deliverySlot) ?? '—'} />
        </div>
      </div>

      {/* Items */}
      {(order.items?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Productos</p>
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
        </div>
      )}

      {/* Update */}
      <div className="space-y-3 border-t border-border pt-4">
        {/* Registrar pago — solo para órdenes pendientes. Cierra el detalle y abre
            el modal de pago (cliente/monto de solo lectura). */}
        {order.estado === 'pendiente' && (
          <Button onClick={() => onRegisterPayment(order)} className="w-full gap-2">
            <CreditCard className="w-4 h-4" /> Registrar pago
          </Button>
        )}
        <div>
          <Label className="text-xs">Cambiar Estado</Label>
          <Select value={estado} onValueChange={v => setEstado(v as OrderStatus)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTADOS.map(e => (
                <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Notas Internas</Label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-20 resize-none"
          />
        </div>
        <Button onClick={handleUpdate} className="w-full">Guardar Cambios</Button>
      </div>
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
      className={`block w-fit rounded text-primary underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
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