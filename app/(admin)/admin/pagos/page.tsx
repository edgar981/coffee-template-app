'use client';

import { useState, useEffect } from 'react';
import { Plus, CreditCard, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { getPayments, createPayment, markPaymentComplete } from '@/lib/api/payments';
import type { Payment, PaymentForm, PaymentMethod, PaymentStatus, MetodoStat } from '@/types/payment';

// ─── Constants ────────────────────────────────────────────────────────────────

const METODOS: PaymentMethod[] = [
  'efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'otro',
];

const STATUS_FILTERS: Array<PaymentStatus | 'all'> = [
  'all', 'pendiente', 'completado', 'fallido', 'reembolsado',
];

const EMPTY_FORM: PaymentForm = {
  cliente_nombre: '',
  monto:          '',
  metodo:         'nequi',
  estado:         'pendiente',
  referencia:     '',
  notas:          '',
  fecha_pago:     '',
};

const formatCOP = (n?: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n ?? 0);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pagos() {
  const [pagos, setPagos]       = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<PaymentForm>(EMPTY_FORM);
  const [filter, setFilter]     = useState<PaymentStatus | 'all'>('all');

  useEffect(() => {
    getPayments().then(data => { setPagos(data); setLoading(false); });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = filter === 'all' ? pagos : pagos.filter(p => p.estado === filter);

  const totalCompletado = pagos
    .filter(p => p.estado === 'completado')
    .reduce((sum, p) => sum + p.monto, 0);

  const totalPendiente = pagos
    .filter(p => p.estado === 'pendiente')
    .reduce((sum, p) => sum + p.monto, 0);

  const metodosStats: MetodoStat[] = METODOS.map(m => ({
    metodo: m,
    count:  pagos.filter(p => p.metodo === m).length,
    total:  pagos
      .filter(p => p.metodo === m && p.estado === 'completado')
      .reduce((sum, p) => sum + p.monto, 0),
  })).filter(m => m.count > 0);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.monto) { toast.error('El monto es requerido'); return; }
    const created = await createPayment({
      ...form,
      monto: Number(form.monto),
    });
    setPagos(prev => [created, ...prev]);
    toast.success('Pago registrado');
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const handleMarkComplete = async (id: string) => {
    const updated = await markPaymentComplete(id);
    setPagos(prev => prev.map(p => p.id === id ? updated : p));
    toast.success('Pago marcado como completado');
  };

  const field = (key: keyof PaymentForm) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagos</h1>
          <p className="text-sm text-muted-foreground">Gestión de transacciones</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar Pago
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <DollarSign className="w-5 h-5 text-emerald-500 mb-3" />
          <p className="text-xl font-bold text-emerald-600">{formatCOP(totalCompletado)}</p>
          <p className="text-xs text-muted-foreground">Cobrado</p>
        </div>
        <div className="stat-card">
          <AlertCircle className="w-5 h-5 text-amber-500 mb-3" />
          <p className="text-xl font-bold text-amber-600">{formatCOP(totalPendiente)}</p>
          <p className="text-xs text-muted-foreground">Por cobrar</p>
        </div>
        <div className="stat-card">
          <CheckCircle className="w-5 h-5 text-blue-500 mb-3" />
          <p className="text-xl font-bold">{pagos.filter(p => p.estado === 'completado').length}</p>
          <p className="text-xs text-muted-foreground">Pagos completados</p>
        </div>
        <div className="stat-card">
          <CreditCard className="w-5 h-5 text-violet-500 mb-3" />
          <p className="text-xl font-bold">{pagos.filter(p => p.estado === 'pendiente').length}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Cliente', 'Monto', 'Método', 'Referencia', 'Estado', 'Fecha', 'Acción'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{p.cliente_nombre ?? '—'}</td>
                        <td className="px-4 py-3 font-bold">{formatCOP(p.monto)}</td>
                        <td className="px-4 py-3 text-xs capitalize">
                          <span className="bg-muted px-2 py-0.5 rounded">{p.metodo}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.referencia ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.estado} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {p.fecha_pago ?? new Date(p.createdAt).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-4 py-3">
                          {p.estado === 'pendiente' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleMarkComplete(p.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Confirmar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Por Método de Pago</h3>
            <div className="space-y-3">
              {metodosStats.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin datos</p>
              ) : metodosStats.map(m => (
                <div key={m.metodo} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">{m.metodo}</p>
                    <p className="text-xs text-muted-foreground">{m.count} transacciones</p>
                  </div>
                  <p className="text-sm font-bold">{formatCOP(m.total)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Integraciones Próximamente</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                  Stripe, Mercado Pago y Wompi estarán disponibles para pagos en línea automáticos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pago</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Cliente</Label>
              <Input {...field('cliente_nombre')} className="mt-1" />
            </div>
            <div>
              <Label>Monto *</Label>
              <Input type="number" {...field('monto')} className="mt-1" />
            </div>
            <div>
              <Label>Método de Pago</Label>
              <Select value={form.metodo} onValueChange={v => setForm(f => ({ ...f, metodo: v as PaymentMethod }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS.map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as PaymentStatus }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referencia / Comprobante</Label>
              <Input {...field('referencia')} className="mt-1" placeholder="Número de transacción" />
            </div>
            <div>
              <Label>Notas</Label>
              <Input {...field('notas')} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.monto}>Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}