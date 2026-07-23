'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, MessageCircle, Mail, Pencil, ShoppingBag, DollarSign, CalendarClock,
  MapPin, Phone, AtSign, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { formatCOP } from '@/lib/utils';
import { getCustomer, updateCustomer } from '@/lib/api/customers';
import { customerWhatsappHref } from '@/lib/whatsapp-link';
import { siteConfig } from '@/lib/config/site';
import { CANALES } from '@/constants/customer';
import { BUSINESS_TZ } from '@/lib/timezone';
import type { CustomerWithOrders, CustomerForm } from '@/types/customer';
import type { OrderChannel } from '@/types/order';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { timeZone: BUSINESS_TZ, day: '2-digit', month: 'short', year: 'numeric' });

const buildForm = (c: CustomerWithOrders): CustomerForm => ({
  nombre:    c.nombre,
  email:     c.email     ?? '',
  telefono:  c.telefono  ?? '',
  ciudad:    c.ciudad    ?? '',
  direccion: c.direccion ?? '',
  canal:     c.canal     ?? 'directo',
  notas:     c.notas     ?? '',
  activo:    c.activo,
});

export function CustomerProfile({ id }: { id: string }) {
  const [customer, setCustomer] = useState<CustomerWithOrders | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    let active = true;
    getCustomer(id)
      .then(c => { if (active) setCustomer(c); })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando cliente...</div>;
  }
  if (notFound || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="font-semibold text-lg mb-2">Cliente no encontrado</h2>
        <Button asChild variant="outline" className="gap-2 mt-2">
          <Link href="/admin/clientes"><ArrowLeft className="w-4 h-4" /> Volver a Clientes</Link>
        </Button>
      </div>
    );
  }

  const nombre    = customer.nombre?.trim();
  const saludo    = nombre ? `Hola ${nombre}` : 'Hola';
  const waHref    = customerWhatsappHref(customer.telefono, `${saludo}, te escribimos de ${siteConfig.brand.nombre}.`);
  const mailHref  = customer.email ? `mailto:${customer.email}?subject=${encodeURIComponent(siteConfig.brand.nombre)}` : null;
  const ultima    = customer.orders[0]?.createdAt;

  const metrics = [
    { icon: ShoppingBag, label: 'Órdenes',        value: String(customer.numero_ordenes ?? 0),        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    { icon: DollarSign,  label: 'Total comprado', value: formatCOP(customer.total_compras ?? 0),       color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { icon: CalendarClock, label: 'Última compra', value: ultima ? fmtDate(ultima) : '—',              color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  ];

  const contact = [
    { icon: AtSign, label: 'Email',    value: customer.email },
    { icon: Phone,  label: 'Teléfono', value: customer.telefono },
    { icon: MapPin, label: 'Ciudad',   value: customer.ciudad },
    { icon: Tag,    label: 'Origen',   value: customer.canal ? (CANALES[customer.canal] ?? customer.canal) : undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
            <Link href="/admin/clientes" aria-label="Volver a Clientes"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{nombre?.[0]?.toUpperCase() ?? '?'}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{customer.nombre}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {customer.canal ? (CANALES[customer.canal] ?? customer.canal) : 'Directo'}
              {customer.ciudad ? ` · ${customer.ciudad}` : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={() => setShowEdit(true)}>
          <Pencil className="w-4 h-4" /> Editar
        </Button>
      </div>

      {/* Contact + actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {contact.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium truncate">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
        {(waHref || mailHref) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {waHref && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={waHref} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
              </Button>
            )}
            {mailHref && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={mailHref}><Mail className="w-3.5 h-3.5" /> Email</a>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Order history */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="font-semibold text-sm">Historial de órdenes</h2>
        </div>
        {customer.orders.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingBag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Este cliente no tiene órdenes registradas en el sistema.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Orden', 'Fecha', 'Pago', 'Entrega', 'Total'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customer.orders.map(o => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/ordenes?order=${encodeURIComponent(o.numero_orden)}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {o.numero_orden}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.estado} /></td>
                    <td className="px-5 py-3">
                      {o.shipping && o.shipping.estado !== 'cancelado'
                        ? <StatusBadge status={o.shipping.estado} />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3 font-semibold">{formatCOP(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditCustomerDialog
        open={showEdit}
        customer={customer}
        onOpenChange={setShowEdit}
        onSaved={updated => setCustomer(prev => prev ? { ...prev, ...updated } : prev)}
      />
    </div>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditCustomerDialog({ open, customer, onOpenChange, onSaved }: {
  open: boolean;
  customer: CustomerWithOrders;
  onOpenChange: (o: boolean) => void;
  onSaved: (updated: Partial<CustomerWithOrders>) => void;
}) {
  // The form lives in a child that only mounts while the dialog is open, so it
  // re-seeds from the current customer on every open (no effect needed).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
        {open && <EditForm customer={customer} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ customer, onClose, onSaved }: {
  customer: CustomerWithOrders;
  onClose: () => void;
  onSaved: (updated: Partial<CustomerWithOrders>) => void;
}) {
  const [form, setForm]     = useState<CustomerForm>(() => buildForm(customer));
  const [saving, setSaving] = useState(false);

  const field = (key: keyof CustomerForm) => ({
    value:    form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const updated = await updateCustomer(customer.id, form);
      onSaved(updated);
      toast.success('Cliente actualizado');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar el cliente');
    }
    setSaving(false);
  };

  return (
    <>
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
            <Label>Origen</Label>
            <Select value={form.canal} onValueChange={v => setForm(f => ({ ...f, canal: v as OrderChannel }))}>
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
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || !form.nombre.trim()}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </>
  );
}
