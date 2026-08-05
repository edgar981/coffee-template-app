'use client';

import { useCallback, useRef, useState } from 'react';

// LA guarda de doble-submit, como primitiva y no como par de líneas a recordar.
//
// El patrón son DOS mitades y no son redundantes (ver CLAUDE.md § Doble-submit):
// un ref SÍNCRONO que corta la re-entrada del mismo tick, y un estado que
// deshabilita el control y le pone texto intermedio. La razón de que esto sea un
// hook y no una receta es empírica: la auditoría de 2026-08-04 encontró ocho
// modales con la mitad de estado y sin la síncrona. Escribir una sin la otra era
// posible; con esto deja de serlo.
//
// El estado se libera SIEMPRE en `finally`, así que una validación que retorna
// temprano, un throw o un modal que se cierra en el éxito no dejan el control
// trabado.

export interface AccionGuardada {
  /** `true` mientras la acción viaja. Va al `disabled` y al texto del botón. */
  enVuelo: boolean;
  /**
   * Corre la acción una sola vez. Un segundo llamado mientras la primera sigue
   * en vuelo se descarta en silencio y devuelve `undefined` — el llamador no
   * tiene que distinguir "no corrió" de "corrió y devolvió undefined": si le
   * importa el resultado, ya está dentro de la acción.
   */
  ejecutar: <T>(accion: () => Promise<T>) => Promise<T | undefined>;
}

/** Para un control único: el botón de un modal, "marcar todas", un confirm. */
export function useAccionGuardada(): AccionGuardada {
  const [enVuelo, setEnVuelo] = useState(false);
  // El ref es lo ÚNICO que cierra la ventana del mismo tick: `enVuelo` depende de
  // un re-render, así que dos clicks seguidos lo leen `false` los dos.
  const ref = useRef(false);

  const ejecutar = useCallback(async <T,>(accion: () => Promise<T>): Promise<T | undefined> => {
    if (ref.current) return undefined;
    ref.current = true;
    setEnVuelo(true);
    try {
      return await accion();
    } finally {
      ref.current = false;
      setEnVuelo(false);
    }
  }, []);

  return { enVuelo, ejecutar };
}

export interface AccionesPorFila {
  /** Id de la fila en vuelo, o `null`. Compararlo por fila para el `disabled`. */
  enVueloId: string | null;
  /** ¿ESTA fila está en vuelo? */
  enVuelo: (id: string) => boolean;
  ejecutar: <T>(id: string, accion: () => Promise<T>) => Promise<T | undefined>;
}

/**
 * Para listas donde cada fila tiene su acción (el tablero de Entregas).
 *
 * La guarda es POR FILA y no global a propósito: bloquear la tabla entera
 * mientras una entrega se despacha convertiría una guarda en una traba —el
 * operador despacha varias seguidas— y ese roce es justo lo que hace que la
 * gente clickee de nuevo. Lo que se impide es repetir la MISMA fila.
 */
export function useAccionesPorFila(): AccionesPorFila {
  const [enVueloId, setEnVueloId] = useState<string | null>(null);
  const ref = useRef<Set<string>>(new Set());

  const ejecutar = useCallback(async <T,>(id: string, accion: () => Promise<T>): Promise<T | undefined> => {
    if (ref.current.has(id)) return undefined;
    ref.current.add(id);
    setEnVueloId(id);
    try {
      return await accion();
    } finally {
      ref.current.delete(id);
      // Solo se limpia si sigue siendo ESTA fila: con dos filas distintas en
      // vuelo, la primera en terminar no debe borrar el indicador de la otra.
      setEnVueloId(actual => (actual === id ? null : actual));
    }
  }, []);

  const enVuelo = useCallback((id: string) => enVueloId === id, [enVueloId]);

  return { enVueloId, enVuelo, ejecutar };
}
