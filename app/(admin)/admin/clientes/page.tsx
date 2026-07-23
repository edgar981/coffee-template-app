'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Edit2, Trash2, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '@/lib/utils';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/api/customers';
import type { Customer, CustomerForm } from '@/types/customer';
import type { OrderChannel } from '@/types/order';
import { CANALES, EMPTY_CUSTOMER_FORM } from '@/constants/customer';


export default function Clientes() {
  const [clientes, setClientes]   = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Customer | null>(null);
  const [form, setForm]           = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);
  const router = useRouter();

  useEffect(() => {
    getCustomers().then(data => { setClientes(data); setLoading(false); });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono?.includes(search)
  );

  const topClientes = [...clientes]
    .sort((a, b) => (b.total_compras ?? 0) - (a.total_compras ?? 0))
    .slice(0, 5);

  const totalVentas  = clientes.reduce((sum, c) => sum + (c.total_compras ?? 0), 0);
  const recurrentes  = clientes.filter(c => (c.numero_ordenes ?? 0) > 1).length;
  const tasaRecurr   = clientes.length
    ? `${Math.round((recurrentes / clientes.length) * 100)}%`
    : '0%';

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openNew  = () => { setEditing(null); setForm(EMPTY_CUSTOMER_FORM); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      nombre:    c.nombre,
      email:     c.email     ?? '',
      telefono:  c.telefono  ?? '',
      ciudad:    c.ciudad    ?? '',
      direccion: c.direccion ?? '',
      canal:     c.canal     ?? 'directo',
      notas:     c.notas     ?? '',
      activo:    c.activo,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre) { toast.error('El nombre es requerido'); return; }

    if (editing) {
      const updated = await updateCustomer(editing.id, form);
      setClientes(prev => prev.map(c => c.id === editing.id ? updated : c));
      toast.success('Cliente actualizado');
    } else {
      const created = await createCustomer(form);
      setClientes(prev => [created, ...prev]);
      toast.success('Cliente creado');
    }

    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    await deleteCustomer(id);
    setClientes(prev => prev.filter(c => c.id !== id));
    toast.success('Cliente eliminado');
  };

  const field = (key: keyof CustomerForm) => ({
    value:    form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  // "Compras totales" = suma del campo denormalizado `total_compras` de TODOS los
  // clientes (histórico por cliente, dato semilla). NO son ingresos reales — esos
  // se calculan desde Payments y viven en Dashboard/Analítica.
  const stats = [
    { label: 'Total Clientes',   value: clientes.length,       sublabel: undefined as string | undefined, icon: Users, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Recurrentes',      value: recurrentes,           sublabel: undefined as string | undefined, icon: Star,  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    { label: 'Tasa Recurrencia', value: tasaRecurr,            sublabel: undefined as string | undefined, icon: Star,  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { label: 'Compras totales',  value: formatCOP(totalVentas),sublabel: 'Histórico de clientes',          icon: Users, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clientes.length} clientes registrados</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            {s.sublabel && (
              <p className="text-[10px] leading-tight text-muted-foreground/70">{s.sublabel}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando...</div>
            ) : filtered.length === 0 ? (
              <EmptyState onNew={openNew} />
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/clientes/${c.id}`)}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {c.nombre?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{c.nombre}</p>
                        {(c.numero_ordenes ?? 0) > 2 && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email ?? c.telefono ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCOP(c.total_compras ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">{c.numero_ordenes ?? 0} órdenes</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={e => { e.stopPropagation(); openEdit(c); }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                        onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Top 5 */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Top 5 Clientes</h3>
            <div className="space-y-3">
              {topClientes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin datos</p>
              ) : topClientes.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{c.nombre?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.numero_ordenes ?? 0} órdenes</p>
                  </div>
                  <p className="text-xs font-bold text-primary">{formatCOP(c.total_compras ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input {...field('nombre')} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input {...field('email')} className="mt-1" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input {...field('telefono')} className="mt-1" />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input {...field('ciudad')} className="mt-1" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select
                value={form.canal}
                onValueChange={v => setForm(f => ({ ...f, canal: v as OrderChannel }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CANALES) as [OrderChannel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Dirección</Label>
              <Input {...field('direccion')} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <textarea
                {...field('notas')}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-16 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <h3 className="font-semibold mb-1">Sin clientes</h3>
      <p className="text-sm text-muted-foreground mb-4">Agrega tu primer cliente al sistema.</p>
      <Button size="sm" onClick={onNew}><Plus className="w-3 h-3 mr-1" /> Agregar Cliente</Button>
    </div>
  );
}