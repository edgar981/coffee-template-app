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
import type { Shipping, ShippingZona, TipoEnvio } from '@/types/shipping';
import { TIPO_ENVIO_LABEL } from '@/types/shipping';
import type { DeliveryContext, OrderAddressResult } from '@/types/order';
import { ZONAS, SHIPPING_ESTADO_LABEL, hasScheduleData, missingToDispatch } from '@/constants/shippings';
import { sugerirZona } from '@/lib/zona-config';
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
  // Título = presentación: hay datos de programación → se está editando, aunque
  // todavía falte el mensajero para poder despachar.
  return hasScheduleData(shipping) ? 'Editar entrega' : 'Programar entrega';
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
  // LOCAL (mensajero propio) o NACIONAL (transportadora + guía).
  const [tipoEnvio, setTipoEnvio]           = useState<TipoEnvio>(shipping.tipo_envio ?? 'LOCAL');
  const [transportadora, setTransportadora] = useState(shipping.transportadora ?? '');
  const [numeroGuia, setNumeroGuia]         = useState(shipping.numero_guia ?? '');
  const [saving, setSaving]       = useState(false);

  // Zona sugerida por la dirección (heurística de texto, lib/zona-config.ts).
  // Se guarda aparte de `zona` porque viaja al servidor como auditoría: la
  // corrección del operador se deriva de `zona_sugerida !== zona`.
  const [zonaSugerida, setZonaSugerida] = useState<ShippingZona | null>(null);
  // El operador movió el Select en ESTA sesión del modal. A partir de ahí la
  // heurística no vuelve a tocar la zona (ni siquiera si cambia la dirección):
  // una elección humana no se pisa sola.
  const [zonaTouched, setZonaTouched]   = useState(false);

  // Solo se pre-selecciona cuando no hay ninguna decisión humana que pisar:
  // entrega recién auto-creada, sin zona, sin mensajero y sin fecha. NO se usa
  // `hasScheduleData` aquí: una entrega `fallido` la incumple y sin embargo fue
  // programada por una persona (por eso falló) — sugerirle encima sería
  // sobreescribir esa decisión al reprogramar.
  const nuncaProgramada =
    !shipping.zona && !shipping.mensajero?.trim() && !shipping.fecha_programada?.trim();

  useEffect(() => {
    let active = true;
    getDeliveryContext(shipping.orden_id)
      .then(c => {
        if (!active) return;
        setCtx(c);
        const sug = sugerirZona(c.direccion_entrega, c.ciudad_entrega);
        setZonaSugerida(sug);
        // `null` = la heurística no supo: se deja el default actual y no se
        // marca nada como sugerido.
        if (sug && nuncaProgramada) setZona(sug);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shipping.orden_id, nuncaProgramada]);

  const hasAddress   = !!ctx?.direccion_entrega?.trim();
  const isReschedule = shipping.estado === 'fallido';
  // Estado ORIGINAL al abrir (el prop es estable: ScheduleBody se remonta por
  // key={shipping.id}). Discrimina "programar" de "actualizar" en el toast —
  // calcularlo sobre la respuesta del servidor haría que toda primera
  // programación dijera "actualizada".
  const wasScheduled = hasScheduleData(shipping);

  // Vista previa del resultado de guardar, sobre lo que el operador está
  // escribiendo ahora: el aviso aparece/desaparece mientras edita, sin guardar.
  // Reprogramar un `fallido` lo devuelve a `preparando` (lo hace el servidor),
  // así que el borrador usa ese estado para que el aviso también aplique ahí.
  const draft = {
    estado:           isReschedule ? 'preparando' : shipping.estado,
    mensajero,
    fecha_programada: fecha,
  };
  // Solo con al menos un dato puesto: en una entrega recién creada (nada
  // diligenciado) no hay nada que reclamar todavía.
  const faltaParaDespachar = hasScheduleData(draft) ? missingToDispatch(draft) : null;

  const handleSchedule = async () => {
    setSaving(true);
    try {
      const updated = await scheduleDelivery(shipping.id, {
        // `zona` es SIEMPRE lo que quedó en el Select; la sugerencia viaja
        // aparte y solo para auditar la heurística (nunca la reemplaza).
        zona,
        zona_sugerida:    zonaSugerida,
        mensajero:        mensajero.trim() || null,
        fecha_programada: fecha || null,
        notas_entrega:    notas.trim() || null,
        tipo_envio:       tipoEnvio,
        transportadora:   transportadora.trim() || null,
        numero_guia:      numeroGuia.trim() || null,
      });
      onSaved(updated);
      // Identifica la orden y distingue programar de actualizar. Si el
      // resultado GUARDADO todavía no alcanza para despachar, se dice — el
      // label ya pasó a "Editar entrega" y esa brecha no puede quedar muda.
      const orden = ctx?.numero_orden;
      const titulo =
        isReschedule  ? (orden ? `Orden ${orden} reprogramada para entrega` : 'Entrega reprogramada')
        : wasScheduled ? (orden ? `Orden ${orden}: entrega actualizada`     : 'Entrega actualizada')
        :                (orden ? `Orden ${orden} programada para entrega`  : 'Entrega programada');
      const falta = missingToDispatch(updated);
      toast.success(titulo, falta ? {
        description: `Falta asignar ${falta === 'mensajero' ? 'mensajero' : 'la fecha programada'} para despachar.`,
      } : undefined);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al programar la entrega');
    }
    setSaving(false);
  };

  const handleAddressSaved = (result: OrderAddressResult) => {
    // La dirección cambió → la sugerencia se recalcula. Si el operador ya movió
    // el Select en esta sesión, se actualiza la auditoría pero NO la selección.
    const sug = sugerirZona(result.direccion_entrega, result.ciudad_entrega);
    setZonaSugerida(sug);
    if (sug && !zonaTouched) setZona(sug);

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
        <div className="col-span-2">
          <Label>Tipo de envío</Label>
          <Select value={tipoEnvio} onValueChange={v => setTipoEnvio(v as TipoEnvio)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['LOCAL', 'NACIONAL'] as TipoEnvio[]).map(t => (
                <SelectItem key={t} value={t}>{TIPO_ENVIO_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tipoEnvio === 'NACIONAL' && (
          <>
            <div>
              <Label>Transportadora</Label>
              <Input value={transportadora} onChange={e => setTransportadora(e.target.value)} className="mt-1" placeholder="Servientrega, Coordinadora…" />
            </div>
            <div>
              <Label>Número de guía</Label>
              <Input value={numeroGuia} onChange={e => setNumeroGuia(e.target.value)} className="mt-1" placeholder="Guía de rastreo" />
            </div>
          </>
        )}
        <div>
          <Label>Mensajero</Label>
          <Input value={mensajero} onChange={e => setMensajero(e.target.value)} className="mt-1" placeholder="Nombre del mensajero" />
        </div>
        <div>
          <Label>Zona *</Label>
          <Select value={zona} onValueChange={v => { setZona(v as ShippingZona); setZonaTouched(true); }}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ZONAS.map(z => <SelectItem key={z} value={z} className="capitalize">{z}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Debajo del Select, no junto al Label: en esta columna (media
              rejilla) el texto al lado partía "Zona *" en dos líneas. Muted y
              sin pill — la sugerencia no es un estado ni una alerta. Se cae en
              cuanto el operador elige otra cosa. */}
          {zonaSugerida && !zonaTouched && zona === zonaSugerida && (
            <p className="mt-1 text-xs text-muted-foreground">Sugerida según la dirección</p>
          )}
        </div>
        <div>
          <Label>Fecha programada</Label>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="mt-1" />
        </div>
        {/* La brecha, dicha: se puede guardar con datos parciales (el mensajero
            NO es obligatorio para agendar), pero despachar exige ambos. */}
        {faltaParaDespachar && (
          <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
            {faltaParaDespachar === 'mensajero'
              ? 'Falta asignar mensajero para poder despachar.'
              : 'Falta asignar la fecha programada para poder despachar.'}
          </p>
        )}
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
