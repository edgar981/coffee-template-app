'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '@/lib/utils';
import { registerOrderPayment } from '@/lib/api/payments';
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
  onSaved: (result: { payment: Payment; order: Order }) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
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
  onSaved: (result: { payment: Payment; order: Order }) => void;
}) {
  const [metodo, setMetodo]         = useState<MetodoPago>(defaultMetodo(declaredMetodo));
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas]           = useState('');
  const [saving, setSaving]         = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await registerOrderPayment(target.id, {
        metodo,
        referencia: referencia.trim() || undefined,
        notas:      notas.trim() || undefined,
      });
      onSaved(result);
      toast.success('Pago registrado — orden marcada como pagada');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar el pago');
    }
    setSaving(false);
  };

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
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
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
