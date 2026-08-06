'use client';

import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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
    <AlertDialog open={abierto} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Despachar sin pago registrado</AlertDialogTitle>
          <AlertDialogDescription>
            La orden {numeroOrden ?? ''} no tiene un pago registrado.
            Al despacharla quedará <strong>contraentrega</strong> y aparecerá como
            «Por cobrar» hasta que registres el pago. ¿Continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar}>Despachar sin pago</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
