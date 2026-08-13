'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAccionGuardada, useAccionesPorFila } from '@/hooks/useAccionGuardada';
import { useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { subirComprobante, decidirComprobante, getComprobantes } from '@/lib/api/comprobantes';
import type { Comprobante } from '@/types/comprobante';

// ─── Comprobantes: el dato vive en LA PÁGINA, no dentro del diálogo ──────────
//
// Estaban dentro de `OrderDetail` y ése fue el defecto del gate del 2026-08-06:
// el resultado de la subida dependía de que el modal siguiera montado. Cuando el
// detalle se remontó con el POST en vuelo —la página recarga, la lista vuelve a
// `[]`, la selección pasa a `null` y el diálogo se cierra y reabre solo— la
// continuación cayó sobre un componente muerto: la fila SÍ se escribió en la base
// y el blob SÍ subió, pero ni el comprobante ni el error llegaron a pantalla.
// Tres síntomas, una causa.
//
// Por eso esto lo monta el componente de la RUTA, que es dueño de la lista y
// sobrevive a que el diálogo se cierre. Con la mutación ahí, un remonte del
// detalle deja de poder tragarse una subida.
//
// ── POR QUÉ ES UN HOOK ──────────────────────────────────────────────────────
//
// Vivía dentro de `Ordenes`, así que estaba acoplado POR UBICACIÓN, no por
// diseño. La segunda pantalla que opera pedidos (`/admin/pedidos`) necesita
// exactamente lo mismo, y copiarlo habría dejado dos implementaciones de la
// misma cadena —incluido el orden pago→sello y el criterio de qué error va a
// dónde—. Es el mismo movimiento que ya recibió `useTransicionEntrega` cuando
// pasó de vivir en el board a montarse en tres lugares.

/** Lo que el detalle necesita para operar los comprobantes de una orden. */
export interface ControlComprobantes {
  adjuntar:     (ordenId: string, file: File) => void;
  /** LANZA si el servidor rechaza; quien llama decide dónde mostrar el motivo. */
  decidir:      (ordenId: string, id: string, accion: 'verificar' | 'rechazar') => Promise<void>;
  /** Trae del SERVIDOR y mergea. Se llama al abrir el detalle. */
  refrescar:    (ordenId: string) => void;
  subiendo:     boolean;
  enVuelo:      (id: string) => boolean;
  error:        string | null;
  mostrarError: (e: unknown, fallback: string) => void;
  limpiarError: () => void;
}

/**
 * Cómo le avisa el hook a la página que los comprobantes de una orden cambiaron.
 *
 * Recibe un ACTUALIZADOR y no la lista nueva, y eso es lo que mantiene al hook
 * agnóstico de cómo la página guarda sus órdenes: adjuntar y decidir se computan
 * a partir de los comprobantes PREVIOS, que sólo la página tiene. Es la misma
 * forma de un `setState(prev => …)`, que es exactamente lo que el llamador va a
 * hacer con esto.
 */
export type CambioComprobantes = (
  ordenId: string,
  actualizar: (previos: Comprobante[]) => Comprobante[],
) => void;

export function useControlComprobantes(onCambio: CambioComprobantes): ControlComprobantes {
  const guarda = useAccionGuardada();
  const filas  = useAccionesPorFila();
  const error  = useErrorDialogo();

  // La VERDAD la trae el servidor al abrir. Es la otra mitad: si algo se perdió
  // en el camino (una subida cuya continuación murió, otra pestaña), el detalle
  // se cura solo al abrirse en vez de mostrar un vacío que la base contradice.
  const refrescar = useCallback(async (ordenId: string) => {
    try {
      const lista = await getComprobantes(ordenId);
      onCambio(ordenId, () => lista);
    } catch (e) {
      // Silencioso a propósito: es un REFRESCO, no una acción que el operador
      // pidió. Lo que ya estaba en pantalla se queda; el log deja el rastro.
      console.error('[comprobantes] no se pudo refrescar', e);
    }
  }, [onCambio]);

  const adjuntar = (ordenId: string, file: File) =>
    guarda.ejecutar(async () => {
      error.limpiar();
      try {
        const creado = await subirComprobante(ordenId, file);
        onCambio(ordenId, previos => [...previos, creado]);
        // Adjuntar NO registra un pago ni mueve la orden: sólo entra la evidencia.
        toast.success('Comprobante adjuntado', { description: 'Queda RECIBIDO hasta que lo verifiques.' });
      } catch (e) {
        error.mostrar(e, 'No se pudo subir el comprobante');
      }
    });

  // LANZA en vez de tragarse el error: quién lo muestra depende de por dónde se
  // pidió. Rechazar va detrás de un confirm y ése tiene su propio error inline
  // (y se queda abierto al fallar); verificar no, y lo manda al de la sección.
  const decidir = async (ordenId: string, id: string, accion: 'verificar' | 'rechazar') => {
    await filas.ejecutar(id, async () => {
      const actualizado = await decidirComprobante(id, accion);
      onCambio(ordenId, previos => previos.map(c => c.id === id ? actualizado : c));
      toast.success(accion === 'verificar' ? 'Comprobante verificado' : 'Comprobante rechazado');
    });
  };

  return {
    adjuntar,
    decidir,
    refrescar,
    subiendo:     guarda.enVuelo,
    enVuelo:      filas.enVuelo,
    error:        error.mensaje,
    mostrarError: error.mostrar,
    limpiarError: error.limpiar,
  };
}
