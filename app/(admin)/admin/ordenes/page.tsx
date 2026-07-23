'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ShoppingCart, Truck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { getOrders, createOrder, updateOrder } from '@/lib/api/orders';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import { RegisterPaymentModal } from '@/components/admin/RegisterPaymentModal';
import type { Order, OrderForm, OrderStatus, OrderChannel } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';
import type { Shipping } from '@/types/shipping';
import { formatCOP } from '@/lib/utils';
import { findSlotLabel } from '@/lib/shipping-config';
import { isScheduledShipping } from '@/constants/shippings';

// ─── Constants ────────────────────────────────────────────────────────────────

// Order status is payment-only now. Fulfillment lives on Shipping.
const ESTADOS: OrderStatus[] = ['pendiente', 'pagado', 'cancelado'];

const CANALES: OrderChannel[] = ['whatsapp', 'instagram', 'directo', 'referido'];

const METODOS_PAGO: PaymentMethod[] = [
  'efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'otro',
];

// Linear payment phases for the order-detail timeline (cancelado is non-linear).
const TIMELINE_ESTADOS: OrderStatus[] = ['pendiente', 'pagado'];

const EMPTY_FORM: OrderForm = {
  cliente_nombre:    '',
  cliente_telefono:  '',
  canal:             'whatsapp',
  estado:            'pendiente',
  metodo_pago:       '',
  total:             '',
  costo_envio:       '0',
  direccion_entrega: '',
  ciudad_entrega:    '',
  notas_internas:    '',
  notas_entrega:     '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Ordenes() {
  const [orders, setOrders]             = useState<Order[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [estadoFilter, setEstadoFilter] = useState<OrderStatus | 'all'>('all');
  const [selected, setSelected]         = useState<Order | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<OrderForm>(EMPTY_FORM);
  // Order whose delivery is being scheduled (opens the pre-filled modal).
  const [scheduleOrder, setScheduleOrder] = useState<Order | null>(null);
  // Order whose payment is being registered (opens the pre-filled modal).
  const [paymentOrder, setPaymentOrder]   = useState<Order | null>(null);

  useEffect(() => {
    getOrders().then(data => {
      setOrders(data);
      setLoading(false);
      // Deep-link from the Pagos ledger: /admin/ordenes?order=CN-123 opens detail.
      const num = new URLSearchParams(window.location.search).get('order');
      if (num) {
        const match = data.find(o => o.numero_orden === num);
        if (match) setSelected(match);
      }
    });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = orders.filter(o => {
  const matchSearch =
    o.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
    o.numero_orden?.toLowerCase().includes(search.toLowerCase());
  const matchEstado = estadoFilter === 'all' || o.estado === estadoFilter;
  return matchSearch && matchEstado;
});

  const stats = ESTADOS.reduce<Record<OrderStatus, number>>((acc, e) => {
    acc[e] = orders.filter(o => o.estado === e).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.cliente_nombre || !form.total) {
      toast.error('Cliente y total son requeridos');
      return;
    }
    const created = await createOrder({
      ...form,
      total:       Number(form.total),
      costo_envio: Number(form.costo_envio),
      metodo_pago: form.metodo_pago || undefined,
      items:       [],
    });
    setOrders(prev => [created, ...prev]);
    toast.success('Orden creada');
    setShowForm(false);
    setForm(EMPTY_FORM);
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

  const field = (key: keyof OrderForm) => ({
    value:    form[key] as string,
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
        <Button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva Orden
        </Button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all' as const, label: 'Todas', count: orders.length },
          ...ESTADOS.map(e => ({ key: e, label: e.charAt(0).toUpperCase() + e.slice(1), count: stats[e] })),
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setEstadoFilter(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              estadoFilter === s.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {s.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              estadoFilter === s.key ? 'bg-primary-foreground/20' : 'bg-background'
            }`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente u orden..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState onNew={() => { setForm(EMPTY_FORM); setShowForm(true); }} />
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
                    onClick={() => setSelected(o)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{o.numero_orden}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.cliente_nombre}</p>
                      {o.cliente_telefono && (
                        <p className="text-xs text-muted-foreground">{o.cliente_telefono}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded">{o.canal}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCOP(o.total)}</td>
                    {/* Estado = payment only (Pendiente/Pagado/Cancelado). */}
                    <td className="px-4 py-3"><StatusBadge status={o.estado} /></td>
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
                        {/* Only when the delivery needs (re)scheduling — hidden once
                            it's en ruta/entregado (real fulfillment record) or the
                            order is cancelled. The scheduled date lives on Entregas. */}
                        {o.estado !== 'cancelado' && (o.shipping?.estado === 'preparando' || o.shipping?.estado === 'fallido') && (
                          <Button
                            variant="outline" size="sm" className="h-7 gap-1 text-xs whitespace-nowrap"
                            onClick={() => setScheduleOrder(o)}
                          >
                            <Truck className="w-3.5 h-3.5" /> {
                              o.shipping?.estado === 'fallido'
                                ? 'Reprogramar'
                                : isScheduledShipping(o.shipping) ? 'Editar entrega' : 'Programar entrega'
                            }
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
        declaredMetodo={paymentOrder?.metodo_pago ?? null}
        onClose={() => setPaymentOrder(null)}
        onSaved={({ order }) => handleOrderUpdate(order)}
      />

      {/* Order Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orden {selected?.numero_orden}</DialogTitle>
          </DialogHeader>
          {selected && (
            <OrderDetail
              order={selected}
              onClose={() => setSelected(null)}
              onUpdate={handleOrderUpdate}
              onRegisterPayment={(o) => { setSelected(null); setPaymentOrder(o); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva Orden</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nombre del Cliente *</Label>
              <Input {...field('cliente_nombre')} className="mt-1" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input {...field('cliente_telefono')} className="mt-1" />
            </div>
            <div>
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
            <div>
              <Label>Total *</Label>
              <Input type="number" {...field('total')} className="mt-1" />
            </div>
            <div>
              <Label>Costo de Envío</Label>
              <Input type="number" {...field('costo_envio')} className="mt-1" />
            </div>
            <div>
              <Label>Método de Pago</Label>
              <Select value={form.metodo_pago} onValueChange={v => setForm(f => ({ ...f, metodo_pago: v as PaymentMethod }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as OrderStatus }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(e => (
                    <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Dirección de Entrega</Label>
              <Input {...field('direccion_entrega')} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notas Internas</Label>
              <textarea
                {...field('notas_internas')}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-16 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.cliente_nombre || !form.total}>
              Crear Orden
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
        <InfoRow label="Cliente"         value={order.cliente_nombre} />
        <InfoRow label="Teléfono"        value={order.cliente_telefono ?? '—'} />
        <InfoRow label="Canal"           value={order.canal} />
        <InfoRow label="Método de Pago"  value={order.metodo_pago ?? '—'} />
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