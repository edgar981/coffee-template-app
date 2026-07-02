'use client';

import { useState, useEffect } from 'react';
import { Plus, Truck, MapPin, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { formatCOP } from '@/lib/utils';
import { getShippings, createShipping, updateShipping } from '@/lib/api/shippings';
import type { Shipping, ShippingEstado, ShippingFilter, ShippingForm, ShippingZona } from '@/types/shipping';
import { ESTADOS, ZONA_COLORS, ZONAS, EMPTY_FORM } from '@/constants/shippings';

export default function Entregas() {
  const [entregas, setEntregas] = useState<Shipping[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<ShippingForm>(EMPTY_FORM);
  const [filter, setFilter]     = useState<ShippingFilter>('all');

  useEffect(() => {
    getShippings().then(data => { setEntregas(data); setLoading(false); });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = filter === 'all'
    ? entregas
    : entregas.filter(e => e.estado === filter);

  const stats = {
    programados: entregas.filter(e => e.estado === 'programado').length,
    en_ruta:     entregas.filter(e => e.estado === 'en_ruta').length,
    entregados:  entregas.filter(e => e.estado === 'entregado').length,
    fallidos:    entregas.filter(e => e.estado === 'fallido').length,
    cancelados:  entregas.filter(e => e.estado === 'cancelado').length,
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.direccion) { toast.error('La dirección es requerida'); return; }
    try {
      const created = await createShipping({
        ...form,
        costo_envio: Number(form.costo_envio),
      });
      setEntregas(prev => [created, ...prev]);
      toast.success('Entrega programada');
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch {
      toast.error('Error al programar la entrega');
    }
  };

  const updateEstado = async (id: string, estado: ShippingEstado) => {
    try {
      const payload: Partial<Shipping> = { estado };
      if (estado === 'entregado') {
        payload.fecha_entrega = new Date().toISOString().split('T')[0];
      }
      const updated = await updateShipping(id, payload);
      setEntregas(prev => prev.map(e => e.id === id ? updated : e));
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entregas</h1>
          <p className="text-sm text-muted-foreground">Gestión de despachos y domicilios</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Programar Entrega
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Clock,        label: 'Programados', value: stats.programados, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
          { icon: Truck,        label: 'En Ruta',     value: stats.en_ruta,     color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400' },
          { icon: CheckCircle,  label: 'Entregados',  value: stats.entregados,  color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
          { icon: AlertCircle,  label: 'Fallidos',    value: stats.fallidos,    color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
          { icon: XCircle,      label: 'Cancelados',  value: stats.cancelados,  color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...ESTADOS] as ShippingFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f === 'all' ? 'Todos' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Sin entregas</h3>
            <p className="text-sm text-muted-foreground mb-4">No hay entregas en este estado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Orden', 'Cliente', 'Dirección', 'Zona', 'Mensajero', 'Costo', 'Estado', 'Fecha', 'Acción'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{e.numero_orden ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{e.cliente_nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-32">{e.direccion}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ZONA_COLORS[e.zona ?? 'centro'] ?? 'bg-muted text-muted-foreground'}`}>
                        {e.zona}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{e.mensajero ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">{formatCOP(e.costo_envio)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.estado} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.fecha_programada ?? '—'}</td>
                    <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                      <Select value={e.estado} onValueChange={v => updateEstado(e.id, v as ShippingEstado)}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ESTADOS.map(s => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">
                              {s.replace('_', ' ')}
                            </SelectItem>
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Programar Entrega</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Nro. Orden</Label>
              <Input value={form.numero_orden ?? ''} onChange={e => setForm(f => ({ ...f, numero_orden: e.target.value }))} className="mt-1" placeholder="SN-0041" />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input value={form.cliente_nombre ?? ''} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Dirección *</Label>
              <Input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Zona</Label>
              <Select value={form.zona ?? 'centro'} onValueChange={v => setForm(f => ({ ...f, zona: v as ShippingZona }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZONAS.map(z => (
                    <SelectItem key={z} value={z} className="capitalize">{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensajero</Label>
              <Input value={form.mensajero ?? ''} onChange={e => setForm(f => ({ ...f, mensajero: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Costo de Envío</Label>
              <Input type="number" value={form.costo_envio} onChange={e => setForm(f => ({ ...f, costo_envio: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label>Fecha Programada</Label>
              <Input type="date" value={form.fecha_programada ?? ''} onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Estado Inicial</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as ShippingEstado }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notas de Entrega</Label>
              <Input value={form.notas_entrega ?? ''} onChange={e => setForm(f => ({ ...f, notas_entrega: e.target.value }))} className="mt-1" placeholder="Instrucciones especiales..." />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.direccion}>Programar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}