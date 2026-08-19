'use client';

import { useCallback, useState } from 'react';
import { cn } from '@duna/core/utils';
import { DunaTooltip } from '@/components/admin/DunaTooltip';

// ─── El error vive DONDE el operador está mirando ────────────────────────────
// División de vehículos, y es la regla que este módulo instala:
//
//   toast  = ÉXITO. Efímero, porque la acción ya cerró y no hay nada que hacer.
//   inline = ERROR. Persistente, porque hay algo que corregir donde estás parado.
//
// Los modales de mutación usaban `toast.error` como único vehículo — 11 puntos
// de error repartidos en 9 archivos, según la auditoría por grep. El contrato de
// cierre ya garantizaba lo difícil —el diálogo queda ABIERTO y con los datos
// intactos—, pero el motivo aparecía en una esquina de la pantalla, se desvanecía
// solo, y podía perderse justo cuando la atención estaba clavada en el diálogo.
//
// El precedente es del propio repo: login y aceptar-invitación ya usan error
// inline (`AvisoError` en `PreAuthShell`), con el argumento de que "en pre-auth
// el toast se pierde". Dentro de un modal aplica igual — la atención está
// capturada por el diálogo, que es precisamente lo que un modal hace.
//
// MISMO LENGUAJE VISUAL que `AvisoError`: tinte destructive del tema, `role`
// de alerta. Lo que cambia es la COLOCACIÓN, y por una razón concreta.

/**
 * El error de un diálogo, para montar DENTRO de su fila de acciones.
 *
 * **La posición es estable a propósito.** Va como un hermano flexible a la
 * IZQUIERDA de los botones, ocupando espacio horizontal que la fila ya tenía
 * libre — no como un banner encima que empuja el layout. Un banner que aparece
 * al fallar mueve los botones justo cuando el cursor está encima del que se
 * acaba de clickear, y el reintento cae sobre otro control. El error explicando
 * el fallo no puede ser, además, la causa del siguiente.
 *
 * Como la altura de la fila la fija el botón (h-9 ≈ 36 px) y esto es texto `xs`
 * (≈16 px de línea), un mensaje de una o dos líneas entra sin mover nada. Uno
 * más largo hace crecer la fila unos pocos píxeles: se acota a 3 líneas y el
 * texto completo queda en un `DunaTooltip` (el `asChild` no agrega envoltorio, así
 * que la ranura sigue desapareciendo con el mensaje).
 *
 * Devuelve `null` sin mensaje, así que en el caso normal no ocupa nada.
 */
export function ErrorDialogo({ mensaje, className }: { mensaje: string | null; className?: string }) {
  if (!mensaje) return null;
  return (
    <DunaTooltip content={mensaje}>
      <p
        role="alert"
        className={cn(
          'min-w-0 flex-1 line-clamp-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-left text-xs text-destructive',
          // La RANURA la nombra quien llama (`duna-modal__aviso` en los diálogos
          // Duna). Va en el propio elemento y no en un envoltorio a propósito: sin
          // mensaje esto devuelve `null`, así que la ranura desaparece con él. Un
          // div envolviéndolo seguiría ocupando su `flex-basis` sin error y movería
          // los botones — el defecto que la colocación existe para evitar.
          className,
        )}
      >
        {mensaje}
      </p>
    </DunaTooltip>
  );
}

export interface ErrorDialogoControl {
  /** El mensaje a mostrar, o `null`. Va directo a `<ErrorDialogo mensaje=… />`. */
  mensaje: string | null;
  /**
   * Guarda el motivo del fallo. Toma el `unknown` del `catch` y saca el mensaje
   * REAL del servidor; el fallback sólo cubre lo que no es un `Error` (un throw
   * raro, un fallo de red sin mensaje).
   *
   * Centralizar esto es parte del punto: mientras fue un
   * `e instanceof Error ? e.message : '…'` repetido en cada catch, cada modal
   * podía decidir por su cuenta tragarse el mensaje del server — y varios lo
   * hacían.
   */
  mostrar: (e: unknown, fallback: string) => void;
  /**
   * Cuando el mensaje YA es un string —una rama que decide el texto por código
   * de estado, sin `Error` de por medio— para no tener que pasar un `null`
   * postizo por el parámetro del catch.
   */
  mostrarMensaje: (texto: string) => void;
  /** Borra el error. Se llama al reintentar y al cerrar/reabrir el diálogo. */
  limpiar: () => void;
}

/**
 * Estado del error de UN diálogo.
 *
 * Es un hook y no dos `useState` sueltos por el mismo motivo que
 * `useAccionGuardada`: la parte que se olvida no es mostrar el error, es
 * LIMPIARLO. Un error viejo que sobrevive a un reintento exitoso, o que reaparece
 * al reabrir el modal, es peor que no tener error inline — afirma un fallo que ya
 * no existe. Con el hook, las dos limpiezas son una llamada con nombre.
 */
export function useErrorDialogo(): ErrorDialogoControl {
  const [mensaje, setMensaje] = useState<string | null>(null);

  const mostrar = useCallback((e: unknown, fallback: string) => {
    setMensaje(e instanceof Error && e.message ? e.message : fallback);
  }, []);

  const mostrarMensaje = useCallback((texto: string) => setMensaje(texto), []);
  const limpiar = useCallback(() => setMensaje(null), []);

  return { mensaje, mostrar, mostrarMensaje, limpiar };
}
