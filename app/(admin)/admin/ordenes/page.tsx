'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { getOrders, createOrder, updateOrderStatus, updateOrder } from '@/lib/api/orders';
import type { Order, OrderForm, OrderStatus, OrderChannel } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';
import { formatCOP } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADOS: OrderStatus[] = [
  'pendiente', 'confirmado', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado',
];

const CANALES: OrderChannel[] = ['whatsapp', 'instagram', 'directo', 'referido'];

const METODOS_PAGO: PaymentMethod[] = [
  'efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'otro',
];

const TIMELINE_ESTADOS: OrderStatus[] = [
  'pendiente', 'confirmado', 'pagado', 'preparando', 'enviado', 'entregado',
];

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

  useEffect(() => {
    getOrders().then(data => { setOrders(data); setLoading(false); });
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
    const updated = await updateOrderStatus(id, estado);
    setOrders(prev => prev.map(o => o.id === id ? updated : o));
    toast.success(`Estado actualizado: ${estado}`);
  };

  const handleOrderUpdate = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
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
                  {['#Orden', 'Cliente', 'Canal', 'Total','Estado', 'Fecha', 'Acciones'].map(h => (
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
                    <td className="px-4 py-3"><StatusBadge status={o.estado} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <Select value={o.estado} onValueChange={v => handleUpdateStatus(o.id, v as OrderStatus)}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ESTADOS.map(e => (
                            <SelectItem key={e} value={e} className="text-xs capitalize">{e}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
}

function OrderDetail({ order, onClose, onUpdate }: OrderDetailProps) {
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
      </div>

      {/* Items */}
      {(order.items?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Productos</p>
          <div className="space-y-1.5">
            {order.items!.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm bg-muted/30 rounded-lg px-3 py-2">
                <span>{item.producto_nombre} × {item.cantidad}</span>
                <span className="font-medium">{formatCOP(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update */}
      <div className="space-y-3 border-t border-border pt-4">
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