'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageCircle, Mail, Plus, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '@/lib/utils';
import { scheduleDelivery } from '@/lib/api/shippings';
import { getDeliveryContext, updateOrderAddress } from '@/lib/api/orders';
import type { Shipping, ShippingZona } from '@/types/shipping';
import type { DeliveryContext, OrderAddressResult } from '@/types/order';
import { ZONAS, SHIPPING_ESTADO_LABEL, isScheduledShipping } from '@/constants/shippings';
import { COLOMBIA_DEPARTMENTS } from '@/lib/colombia-departments';
import { customerWhatsappHref } from '@/lib/whatsapp-link';
import { siteConfig } from '@/lib/config/site';

// The modal now takes just the Shipping — it fetches the order's delivery
// context (contact + address + linked customer) itself, so it behaves the same
// from Entregas and Ordenes and always reflects the latest address.
export interface ScheduleTarget {
  shipping: Shipping;
}

export function ScheduleDeliveryModal({ target, onClose, onSaved, onAddressAdded }: {
  target: ScheduleTarget | null;
  onClose: () => void;
  onSaved: (shipping: Shipping) => void;
  // Fired after an address is added to the order, so the parent list can reflect
  // it without a full reload.
  onAddressAdded?: (orderId: string, address: { direccion_entrega: string; ciudad_entrega: string }) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{target ? titleFor(target.shipping) : 'Programar entrega'}</DialogTitle>
        </DialogHeader>
        {target && (
          <ScheduleBody
            key={target.shipping.id}
            shipping={target.shipping}
            onClose={onClose}
            onSaved={onSaved}
            onAddressAdded={onAddressAdded}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function titleFor(shipping: Shipping): string {
  if (shipping.estado === 'fallido') return 'Reprogramar entrega';
  return isScheduledShipping(shipping) ? 'Editar entrega' : 'Programar entrega';
}

function ScheduleBody({ shipping, onClose, onSaved, onAddressAdded }: {
  shipping: Shipping;
  onClose: () => void;
  onSaved: (shipping: Shipping) => void;
  onAddressAdded?: (orderId: string, address: { direccion_entrega: string; ciudad_entrega: string }) => void;
}) {
  const [ctx, setCtx]             = useState<DeliveryContext | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);

  // Operator-supplied scheduling fields.
  const [zona, setZona]           = useState<ShippingZona>((shipping.zona as ShippingZona) ?? 'centro');
  const [mensajero, setMensajero] = useState(shipping.mensajero ?? '');
  const [fecha, setFecha]         = useState(shipping.fecha_programada ?? '');
  const [notas, setNotas]         = useState(shipping.notas_entrega ?? '');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    let active = true;
    getDeliveryContext(shipping.orden_id)
      .then(c => { if (active) setCtx(c); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shipping.orden_id]);

  const hasAddress   = !!ctx?.direccion_entrega?.trim();
  const isReschedule = shipping.estado === 'fallido';

  const handleSchedule = async () => {
    setSaving(true);
    try {
      const updated = await scheduleDelivery(shipping.id, {
        zona,
        mensajero:        mensajero.trim() || null,
        fecha_programada: fecha || null,
        notas_entrega:    notas.trim() || null,
      });
      onSaved(updated);
      toast.success(isReschedule ? 'Entrega reprogramada' : 'Entrega programada');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al programar la entrega');
    }
    setSaving(false);
  };

  const handleAddressSaved = (result: OrderAddressResult) => {
    setCtx(c => c ? {
      ...c,
      direccion_entrega: result.direccion_entrega,
      ciudad_entrega:    result.ciudad_entrega,
      direccion_detalle: result.direccion_detalle,
      telefono:          result.cliente_telefono ?? c.telefono,
    } : c);
    setShowAddrForm(false);
    onAddressAdded?.(shipping.orden_id, {
      direccion_entrega: result.direccion_entrega ?? '',
      ciudad_entrega:    result.ciudad_entrega ?? '',
    });
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Cargando datos de la orden…</div>;
  }
  if (loadError || !ctx) {
    return <div className="py-10 text-center text-sm text-red-600">No se pudieron cargar los datos de la orden.</div>;
  }

  const nombre  = ctx.cliente_nombre?.trim();
  const saludo  = nombre ? `Hola ${nombre}` : 'Hola';
  const waHref  = customerWhatsappHref(
    ctx.telefono,
    `${saludo}, te escribimos de ${siteConfig.brand.nombre} por tu pedido ${ctx.numero_orden}`,
  );
  const mailHref = ctx.cliente_email
    ? `mailto:${ctx.cliente_email}?subject=${encodeURIComponent(`Tu pedido ${ctx.numero_orden} — ${siteConfig.brand.nombre}`)}`
    : null;
  const addressLine = [ctx.direccion_entrega, ctx.ciudad_entrega].filter(Boolean).join(', ') || '—';

  return (
    <div className="space-y-4">
      {/* Contact + read-only context — all pulled from the order */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Orden" value={ctx.numero_orden} />
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            {ctx.customer ? (
              <Link
                href={`/admin/clientes/${ctx.customer.id}`}
                className="mt-0.5 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {nombre ?? '—'} <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <p className="mt-0.5 font-medium">{nombre ?? '—'}</p>
            )}
          </div>
        </div>

        {/* Direct contact — only when there's data */}
        {(waHref || mailHref) && (
          <div className="flex flex-wrap gap-2">
            {waHref && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={waHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </Button>
            )}
            {mailHref && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={mailHref}>
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Costo de envío" value={formatCOP(shipping.costo_envio)} />
          <InfoRow label="Estado entrega" value={SHIPPING_ESTADO_LABEL[shipping.estado] ?? shipping.estado} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dirección</p>
          <p className="mt-0.5 font-medium">{addressLine}</p>
          {ctx.direccion_detalle?.trim() && (
            <p className="text-xs text-muted-foreground">{ctx.direccion_detalle}</p>
          )}
        </div>
      </div>

      {/* Missing address → warning + inline add form */}
      {!hasAddress && !showAddrForm && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
          <span>Esta orden no tiene dirección de entrega.</span>
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => setShowAddrForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Agregar dirección
          </Button>
        </div>
      )}
      {showAddrForm && (
        <AddressForm
          orderId={shipping.orden_id}
          initialPhone={ctx.telefono}
          onCancel={() => setShowAddrForm(false)}
          onSaved={handleAddressSaved}
        />
      )}

      {/* Operator fills only these */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Mensajero</Label>
          <Input value={mensajero} onChange={e => setMensajero(e.target.value)} className="mt-1" placeholder="Nombre del mensajero" />
        </div>
        <div>
          <Label>Zona *</Label>
          <Select value={zona} onValueChange={v => setZona(v as ShippingZona)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ZONAS.map(z => <SelectItem key={z} value={z} className="capitalize">{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fecha programada</Label>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label>Notas de entrega</Label>
          <Input value={notas} onChange={e => setNotas(e.target.value)} className="mt-1" placeholder="Instrucciones especiales..." />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSchedule} disabled={saving || !hasAddress}>
          {saving ? 'Guardando...' : isReschedule ? 'Reprogramar' : 'Guardar entrega'}
        </Button>
      </div>
    </div>
  );
}

// Inline add-address form — same fields the checkout uses. Saves to the ORDER
// (validated server-side to the same standard as checkout).
function AddressForm({ orderId, initialPhone, onCancel, onSaved }: {
  orderId: string;
  initialPhone: string | null;
  onCancel: () => void;
  onSaved: (result: OrderAddressResult) => void;
}) {
  const [direccion, setDireccion]       = useState('');
  const [detalle, setDetalle]           = useState('');
  const [ciudad, setCiudad]             = useState('');
  const [departamento, setDepartamento] = useState('');
  // Pre-fill the phone from the resolved order/customer phone (strip +57).
  const [tel, setTel]                   = useState((initialPhone ?? '').replace(/^\+?57/, ''));
  const [saving, setSaving]             = useState(false);

  const digits     = tel.replace(/\D/g, '');
  const phoneValid = /^3\d{9}$/.test(digits);
  const canSave    = !!direccion.trim() && !!ciudad.trim() && !!departamento && phoneValid;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateOrderAddress(orderId, {
        direccion:         direccion.trim(),
        direccion_detalle: detalle.trim() || null,
        ciudad:            ciudad.trim(),
        departamento,
        telefono:          `+57${digits}`,  // normalize like checkout
      });
      toast.success('Dirección agregada a la orden');
      onSaved(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la dirección');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agregar dirección de entrega</p>
      <div>
        <Label className="text-xs">Dirección *</Label>
        <Input value={direccion} onChange={e => setDireccion(e.target.value)} className="mt-1" placeholder="Calle, Carrera, número" />
      </div>
      <div>
        <Label className="text-xs">Detalles adicionales</Label>
        <Input value={detalle} onChange={e => setDetalle(e.target.value)} className="mt-1" placeholder="Apto, torre, interior, indicaciones…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Ciudad / Municipio *</Label>
          <Input value={ciudad} onChange={e => setCiudad(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Departamento *</Label>
          <Select value={departamento} onValueChange={setDepartamento}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {COLOMBIA_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Teléfono *</Label>
        <Input
          type="tel" inputMode="numeric" value={tel}
          onChange={e => setTel(e.target.value)} className="mt-1" placeholder="300 000 0000"
        />
        {tel.trim() && !phoneValid && (
          <p className="mt-1 text-xs text-red-600">Celular colombiano inválido (10 dígitos, empieza por 3).</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Guardando…' : 'Guardar dirección'}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
