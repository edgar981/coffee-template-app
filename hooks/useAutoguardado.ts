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
  //
  // OJO — read↔edit NO desmonta: cerrar el editor es otra rama de render del MISMO componente, así
  // que el coordinador sigue vivo en su ref y este cleanup no corre. Lo que desmonta de verdad es
  // salir de la pantalla.
  //
  // HUECO CONOCIDO (preexistente, menor, nombrado): `destruir()` cancela el timer de REINTENTO, así
  // que si al desmontar el PUT del flush FALLA, no hay reintento — ese cambio se pierde en silencio.
  // La ventana es mínima (navegar fuera dentro del ~1 s del debounce/vuelo Y que justo ese PUT
  // falle) y el `beforeunload` no cubre la navegación client-side. NO va al backlog a propósito: no
  // tiene disparador observable —nadie puede reportar "no se reintentó"—, así que sería una entrada
  // sin criterio de cierre. Si alguna vez hay que arreglarlo, el fix es local: subir el coordinador
  // a la página (que sobrevive a la sección) o esperar el flush antes de navegar.
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
