'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { createCustomer, updateCustomer } from '@/lib/api/customers';
import { CANALES, EMPTY_CUSTOMER_FORM } from '@/constants/customer';
import type { Customer, CustomerForm } from '@/types/customer';
import type { OrderChannel } from '@/types/order';

// ─── ALTA Y EDICIÓN DE CLIENTE ───────────────────────────────────────────────
//
// Es un modal shadcn REUSADO, no una primitiva del design-system: el DS todavía no
// tiene diálogo (H6) y construir uno acá sería inventar. La mezcla visual es
// temporal y está declarada, igual que en Pedidos.
//
// ── SE MONTA EN LA PÁGINA, NUNCA EN EL PANEL ─────────────────────────────────
//
// El panel de detalle se desmonta al cambiar de cliente, y una mutación montada
// ahí puede perder su continuación — es el incidente del 2026-08-06 con los
// comprobantes. Acá arriba el peor caso es que el panel reabra ya con el cambio
// aplicado.
//
// ── EL FORMULARIO VIVE EN UN HIJO QUE SÓLO EXISTE MIENTRAS ESTÁ ABIERTO ──────
//
// Así se re-siembra del cliente actual en cada apertura sin un solo efecto, y el
// error inline se limpia solo al cerrar (§ toast = éxito, inline = error). El
// patrón es el de `EditCustomerDialog` de la pantalla vieja, que ya lo hacía así.

const buildForm = (c: Customer): CustomerForm => ({
  nombre:    c.nombre,
  email:     c.email     ?? '',
  telefono:  c.telefono  ?? '',
  ciudad:    c.ciudad    ?? '',
  direccion: c.direccion ?? '',
  canal:     c.canal     ?? 'directo',
  notas:     c.notas     ?? '',
  activo:    c.activo,
});

export function CustomerFormModal({ open, customer, onOpenChange, onSaved }: {
  open: boolean;
  /** `null` = alta. Con cliente, edición. */
  customer: Customer | null;
  onOpenChange: (o: boolean) => void;
  onSaved: (c: Customer, modo: 'creado' | 'actualizado') => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          {/* Radix la exige, y dice qué se puede HACER, no qué es. `sr-only`: el
              contenido ya lo explica a quien ve. */}
          <DialogDescription className="sr-only">
            Datos de contacto del cliente: nombre, correo, teléfono, ciudad, origen,
            dirección y notas. No modifica sus pedidos.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <Cuerpo
            customer={customer}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Cuerpo({ customer, onClose, onSaved }: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer, modo: 'creado' | 'actualizado') => void;
}) {
  const [form, setForm] = useState<CustomerForm>(() => customer ? buildForm(customer) : EMPTY_CUSTOMER_FORM);

  // Las DOS mitades de la guarda, del hook — no escritas a mano. El ref corta la
  // re-entrada del mismo tick (que es lo único que la cierra) y el estado le pone
  // texto intermedio al botón; sin esa señal el operador vuelve a clickear.
  const guarda = useAccionGuardada();
  const error  = useErrorDialogo();

  const campo = (key: keyof CustomerForm) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const guardar = () => guarda.ejecutar(async () => {
    // Se limpia al REINTENTAR, no sólo al cerrar: un error que sobrevive a un
    // reintento exitoso afirma un fallo que ya no existe.
    error.limpiar();
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    try {
      if (customer) {
        onSaved(await updateCustomer(customer.id, form), 'actualizado');
      } else {
        onSaved(await createCustomer(form), 'creado');
      }
      // Cierre SÓLO tras confirmación del servidor. Si falla, el diálogo se queda
      // abierto con lo que el operador escribió y el motivo a la vista.
      onClose();
    } catch (e) {
      error.mostrar(e, 'No se pudo guardar el cliente');
    }
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 py-2">
        <div className="col-span-2">
          <Label>Nombre *</Label>
          <Input {...campo('nombre')} className="mt-1" />
        </div>
        <div>
          <Label>Correo</Label>
          <Input {...campo('email')} className="mt-1" />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input {...campo('telefono')} className="mt-1" />
        </div>
        <div>
          <Label>Ciudad</Label>
          <Input {...campo('ciudad')} className="mt-1" />
        </div>
        <div>
          {/* "Origen" y no "Canal" — UNA sola etiqueta, declarada. Las dos
              pantallas viejas la llaman distinto (la lista "Canal", el perfil
              "Origen") para el MISMO campo. Se elige "Origen" porque para una
              PERSONA el campo dice de dónde llegó; "canal" en el resto del panel
              es cómo entró un PEDIDO. Son dos objetos distintos, y darles la misma
              palabra es lo que los hace parecer el mismo dato. */}
          <Label>Origen</Label>
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
          <Input {...campo('direccion')} className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label>Notas</Label>
          <textarea
            {...campo('notas')}
            className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-16 resize-none"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 pt-2">
        {/* El error INLINE, a la izquierda de los botones y no como banner encima:
            un banner que aparece al fallar empuja el layout y mueve el botón que
            se acaba de clickear. */}
        <ErrorDialogo mensaje={error.mensaje} />
        <Button variant="outline" onClick={onClose} disabled={guarda.enVuelo}>Cancelar</Button>
        <Button onClick={guardar} disabled={guarda.enVuelo || !form.nombre.trim()}>
          {guarda.enVuelo ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </>
  );
}
