'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAccionesPorFila } from '@/hooks/useAccionGuardada';
import { updateShipping } from '@/lib/api/shippings';
import type { Shipping, ShippingEstado } from '@/types/shipping';

// ─── LAS transiciones de fulfillment, una sola vez ───────────────────────────
//
// Despachar / marcar entregada / marcar fallida, con la confirmación explícita
// del despacho SIN PAGO. Vivía inline en el board de Entregas; ahora también las
// necesita el detalle de la orden, y dos copias de la misma transición es cómo
// vuelven a divergir (el precedente del repo: `razonDelServidor` duplicado en
// `lib/api/products.ts`, `cruzoMinimo` duplicado en los dos emisores).
//
// El servidor sigue siendo la autoridad: acá no hay ni un gate nuevo. La regla
// de "pagada o confirmación" se replica del lado del cliente sólo para PREGUNTAR
// antes de mandar — el 409 de `/api/shippings/[id]` es el que manda, y su mensaje
// se propaga tal cual.
//
// La guarda es POR ID (`useAccionesPorFila`) y no global, incluso cuando el
// llamador tiene una sola entrega: le sirve igual al detalle y es lo que le
// permite al board seguir despachando varias filas seguidas sin trabarse.

export interface EntregaEnCurso {
  /** id del Shipping. */
  id: string;
  /**
   * ¿La ORDEN detrás de esta entrega ya tiene pago registrado? Lo aporta quien
   * llama porque cada vista lo tiene en una forma distinta —el board lo lee del
   * `order` anidado del Shipping, el detalle de la orden que ya tiene en mano— y
   * derivarlo acá obligaría a una de las dos a fabricar un objeto que no tiene.
   */
  ordenPagada: boolean;
  /** Sólo para nombrar la orden en el diálogo de confirmación. */
  numeroOrden?: string | null;
}

export interface TransicionEntrega {
  /** ¿ESTA entrega está en vuelo? Va al `disabled` de sus botones. */
  enVuelo: (id: string) => boolean;
  /** preparando → en_ruta. Pide confirmación si la orden no tiene pago. */
  despachar: (entrega: EntregaEnCurso) => void;
  /** en_ruta → entregado. */
  marcarEntregado: (id: string) => void;
  /** en_ruta → fallido (devuelve el stock, server-side). */
  marcarFallido: (id: string) => void;
  /** Props del `<ConfirmDespachoSinPago>`. */
  confirmacion: {
    numeroOrden: string | null;
    abierto: boolean;
    onOpenChange: (abierto: boolean) => void;
    onConfirmar: () => void;
  };
}

export function useTransicionEntrega({ onUpdated, onError }: {
  /** El Shipping ya actualizado que devuelve el servidor. */
  onUpdated: (shipping: Shipping) => void;
  /**
   * Qué hacer con el error del servidor. Sin esto, `toast.error` — correcto en
   * una PÁGINA. Dentro de un diálogo se pasa el `mostrar` de `useErrorDialogo`:
   * el error tiene que vivir donde está mirando el operador (§ Toast = éxito,
   * inline = error).
   */
  onError?: (e: unknown) => void;
}): TransicionEntrega {
  const filas = useAccionesPorFila();
  const [porConfirmar, setPorConfirmar] = useState<EntregaEnCurso | null>(null);

  const transicionar = useCallback((
    id: string,
    estado: ShippingEstado,
    confirmarSinPago?: boolean,
  ) => filas.ejecutar(id, async () => {
    try {
      // `fecha_entrega` la captura el servidor en la transición a entregado.
      const updated = await updateShipping(id, {
        estado,
        ...(confirmarSinPago ? { confirmarSinPago: true } : {}),
      });
      onUpdated(updated);
      toast.success('Estado actualizado');
    } catch (e) {
      // El mensaje del SERVIDOR: un despacho bloqueado (stock insuficiente, sin
      // pago sin confirmar) tiene que decir por qué, no un error genérico.
      if (onError) onError(e);
      else toast.error(e instanceof Error ? e.message : 'Error al actualizar el estado');
    }
  }), [filas, onUpdated, onError]);

  const despachar = useCallback((entrega: EntregaEnCurso) => {
    if (entrega.ordenPagada) transicionar(entrega.id, 'en_ruta');
    else setPorConfirmar(entrega);
  }, [transicionar]);

  return {
    enVuelo:         filas.enVuelo,
    despachar,
    marcarEntregado: useCallback((id: string) => { transicionar(id, 'entregado'); }, [transicionar]),
    marcarFallido:   useCallback((id: string) => { transicionar(id, 'fallido');   }, [transicionar]),
    confirmacion: {
      numeroOrden:  porConfirmar?.numeroOrden ?? null,
      abierto:      !!porConfirmar,
      onOpenChange: (abierto: boolean) => { if (!abierto) setPorConfirmar(null); },
      onConfirmar:  () => {
        if (porConfirmar) transicionar(porConfirmar.id, 'en_ruta', true);
        setPorConfirmar(null);
      },
    },
  };
}
