'use client';

import { DunaDialog } from '@/components/admin/DunaDialog';

// La confirmación explícita de despachar SIN pago registrado. Sale de `<div>`s
// sueltos al final del board de Entregas porque el detalle de la orden es ahora
// la otra puerta al MISMO endpoint, y la advertencia tiene que decir exactamente
// lo mismo desde las dos — es la frase que explica que la orden va a quedar
// contraentrega y "por cobrar".
//
// El servidor exige el flag igual (`confirmarSinPago`, 409 sin él): esto no es
// el gate, es la pregunta.
export function ConfirmDespachoSinPago({ numeroOrden, abierto, onOpenChange, onConfirmar }: {
  numeroOrden: string | null;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onConfirmar: () => void;
}) {
  return (
    <DunaDialog
      abierto={abierto}
      onOpenChange={onOpenChange}
      titulo="Despachar sin pago registrado"
      descripcion={<>
        La orden {numeroOrden ?? ''} no tiene un pago registrado.
        Al despacharla quedará <strong>contraentrega</strong> y aparecerá como
        «Por cobrar» hasta que registres el pago. ¿Continuar?
      </>}
    >
      {/* NO lleva `--danger`: despachar sin cobrar no destruye nada, registra un
          hecho. El destructivo está reservado a lo que no se recupera desde el
          panel (§ el tinte destructivo del sistema). */}
      <div className="duna-modal__foot">
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={() => { onConfirmar(); onOpenChange(false); }}>
            Despachar sin pago
          </button>
        </div>
      </div>
    </DunaDialog>
  );
}
