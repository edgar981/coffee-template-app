'use client';

import { useEffect, useRef, useState } from 'react';
import { crearAutoguardado, type Autoguardado, type EstadoAutoguardado } from '@/lib/autoguardado';

// Envuelve el coordinador puro (§ lib/autoguardado) con estado de React. La lógica delicada
// (debounce, encolado, reintento) vive y se prueba en el coordinador; esto sólo expone su estado
// y hace flush al desmontar —para que cambiar de sección o salir de la pantalla no pierda lo
// último tecleado—.
export function useAutoguardado<T>(guardar: (data: T) => Promise<void>, retrasoMs = 1000): {
  estado: EstadoAutoguardado;
  marcarSucio: (data: T) => void;
  flush: () => void;
  reintentar: () => void;
} {
  const [estado, setEstado] = useState<EstadoAutoguardado>('guardado');

  // `guardar` puede cambiar de identidad entre renders; el coordinador se crea UNA vez, así que
  // lee siempre la última versión por ref.
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;

  const ref = useRef<Autoguardado<T> | null>(null);
  if (ref.current === null) {
    ref.current = crearAutoguardado<T>({
      guardar: (d) => guardarRef.current(d),
      retrasoMs,
      onEstado: setEstado,
    });
  }

  // Al desmontar: FLUSH (dispara lo pendiente — cubre cambiar de sección Y salir de la pantalla)
  // y luego limpia timers. El PUT del flush es fire-and-forget: sigue aunque el componente ya no
  // esté; su `setEstado` posterior es no-op sobre un componente desmontado.
  useEffect(() => {
    const a = ref.current!;
    return () => { a.flush(); a.destruir(); };
  }, []);

  return {
    estado,
    marcarSucio: (d) => ref.current!.marcarSucio(d),
    flush: () => ref.current!.flush(),
    reintentar: () => ref.current!.reintentar(),
  };
}
