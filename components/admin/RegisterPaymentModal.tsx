'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { formatCOP } from '@/lib/utils';
import { registerOrderPayment } from '@/lib/api/payments';
import { subirComprobante } from '@/lib/api/comprobantes';
import { SelectorComprobante, AyudaComprobante } from '@/components/admin/Comprobantes';
import { formatearTamano } from '@/lib/comprobante';
import type { Comprobante } from '@/types/comprobante';
import type { Order } from '@/types/order';
import type { Payment, MetodoPago } from '@/types/payment';
import { METODOS_PAGO, METODO_PAGO_LABEL } from '@/types/payment';

// Registrar pago desde una orden. Cliente y monto son de SOLO LECTURA (vienen de
// la orden, no se digitan); el admin elige método y opcionalmente referencia y
// notas. El monto real se snapshotea server-side desde order.total.
export interface RegisterPaymentTarget {
  id:      string;
  numero:  string;
  cliente: string | null;
  monto:   number;
}

// Preselect the payment method from the order's declared method when it maps to
// an enum value (nequi → NEQUI); otherwise default to Nequi (the common case).
function defaultMetodo(declared?: string | null): MetodoPago {
  const up = (declared ?? '').toUpperCase();
  return (METODOS_PAGO as string[]).includes(up) ? (up as MetodoPago) : 'NEQUI';
}

export function RegisterPaymentModal({ target, declaredMetodo, onClose, onSaved }: {
  target: RegisterPaymentTarget | null;
  declaredMetodo?: string | null;
  onClose: () => void;
  onSaved: (result: { payment: Payment; order: Order; comprobante?: Comprobante }) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription className="sr-only">
            Cliente y monto vienen de la orden y no se digitan. Elige el método y, si aplica, la referencia.
          </DialogDescription>
        </DialogHeader>
        {target && (
          <RegisterForm
            key={target.id}
            target={target}
            declaredMetodo={declaredMetodo}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RegisterForm({ target, declaredMetodo, onClose, onSaved }: {
  target: RegisterPaymentTarget;
  declaredMetodo?: string | null;
  onClose: () => void;
  onSaved: (result: { payment: Payment; order: Order; comprobante?: Comprobante }) => void;
}) {
  const [metodo, setMetodo]         = useState<MetodoPago>(defaultMetodo(declaredMetodo));
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas]           = useState('');
  const [saving, setSaving]         = useState(false);
  // Soporte OPCIONAL. Se elige acá y se sube DESPUÉS del pago (ver el orden en
  // handleSave): el comprobante es evidencia sobre una plata que primero tiene
  // que existir.
  const [archivo, setArchivo]       = useState<File | null>(null);

  // `saving` ya deshabilitaba el botón; falta la mitad SÍNCRONA, que es la única
  // que corta dos clicks del mismo tick. El server acá es idempotente (SELECT …
  // FOR UPDATE + chequeo de estado devuelve 409 al segundo), así que esto es
  // consistencia — pero la guarda es del botón, no del endpoint.
  const guarda = useAccionGuardada();
  const error  = useErrorDialogo();
  const handleSave = () => guarda.ejecutar(async () => {
    error.limpiar();
    setSaving(true);
    try {
      const result = await registerOrderPayment(target.id, {
        metodo,
        referencia: referencia.trim() || undefined,
        notas:      notas.trim() || undefined,
      });

      // PRIMERO la plata, DESPUÉS la evidencia. Si la subida falla, el pago YA
      // quedó registrado y se avisa que el soporte no subió — el operador lo
      // adjunta desde el detalle. Al revés (subir y que falle el pago) dejaría un
      // comprobante colgado de una orden que nadie cobró.
      let comprobante: Comprobante | undefined;
      if (archivo) {
        try {
          comprobante = await subirComprobante(target.id, archivo);
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'No se pudo subir el comprobante',
            { description: 'El pago SÍ quedó registrado. Adjunta el soporte desde el detalle de la orden.' },
          );
        }
      }

      onSaved({ ...result, comprobante });
      toast.success(
        'Pago registrado — orden marcada como pagada',
        comprobante ? { description: 'Comprobante adjuntado.' } : undefined,
      );
      onClose();
    } catch (e) {
      error.mostrar(e, 'Error al registrar el pago');
    }
    setSaving(false);
  });

  return (
    <div className="space-y-4">
      {/* Read-only — pulled from the order, never re-typed by the operator */}
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
        <InfoRow label="Orden"   value={target.numero} />
        <InfoRow label="Cliente" value={target.cliente ?? '—'} />
        <div className="col-span-2">
          <InfoRow label="Monto a registrar" value={formatCOP(target.monto)} strong />
        </div>
      </div>

      {/* Operator fills only these */}
      <div className="space-y-4">
        <div>
          <Label>Método de pago *</Label>
          <Select value={metodo} onValueChange={v => setMetodo(v as MetodoPago)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METODOS_PAGO.map(m => (
                <SelectItem key={m} value={m}>{METODO_PAGO_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Referencia / Comprobante</Label>
          <Input
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            className="mt-1"
            placeholder="Número de transacción (opcional)"
          />
        </div>
        <div>
          <Label>Notas</Label>
          <Input
            value={notas}
            onChange={e => setNotas(e.target.value)}
            className="mt-1"
            placeholder="Opcional"
          />
        </div>

        {/* Comprobante OPCIONAL. Un pago sin soporte es legítimo —el efectivo no
            tiene nada que fotografiar—, así que esto jamás bloquea el registro. */}
        <div>
          <Label>Comprobante</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {archivo ? (
              <span className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="max-w-[12rem] truncate font-medium">{archivo.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatearTamano(archivo.size)}</span>
                <button
                  type="button"
                  onClick={() => setArchivo(null)}
                  disabled={saving}
                  aria-label="Quitar comprobante"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <SelectorComprobante onArchivo={setArchivo} disabled={saving} label="Adjuntar" />
            )}
            <AyudaComprobante />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Opcional. Se sube después de registrar el pago.
          </p>
        </div>
      </div>

      {/* El error comparte la fila de los botones: ocupa el espacio libre de la
          izquierda, así que aparecer no los mueve. */}
      <div className="flex items-center justify-end gap-3">
        <ErrorDialogo mensaje={error.mensaje} />
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Registrando...' : 'Registrar pago'}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium ${strong ? 'text-base font-bold' : ''}`}>{value}</p>
    </div>
  );
}
