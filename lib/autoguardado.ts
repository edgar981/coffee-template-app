// EL COORDINADOR de autoguardado — framework-agnóstico (sin React) para poder afirmar su lógica
// delicada con relojes falsos: el debounce (una ráfaga de teclas = UN guardado), el encolado
// (editar durante un guardado en vuelo no se pierde), y el reintento tras un fallo. El hook de
// React (`useAutoguardado`) sólo lo envuelve.
//
// Estados que ve la UI: 'guardando' (hay cambios viajando o esperando el debounce) · 'guardado'
// (todo persistido) · 'error' (el último guardado falló; se reintenta solo). El beforeunload del
// editor avisa SÓLO en 'error' (§ decisión): pendiente/guardando es común y su pérdida es una
// frase recuperable; el error es el caso grave.

export type EstadoAutoguardado = 'guardado' | 'guardando' | 'error';

export interface Autoguardado<T> {
  readonly estado: EstadoAutoguardado;
  /** El dueño editó: guarda tras el debounce (reiniciándolo en cada llamada). */
  marcarSucio(data: T): void;
  /** Guarda YA lo pendiente, sin esperar el debounce (blur, unmount). */
  flush(): void;
  /** Reintento manual desde el estado de error. */
  reintentar(): void;
  /** Cancela timers pendientes (al desmontar). */
  destruir(): void;
}

export function crearAutoguardado<T>(opciones: {
  guardar: (data: T) => Promise<void>;
  retrasoMs?: number;
  reintentoMs?: number;
  onEstado?: (estado: EstadoAutoguardado) => void;
}): Autoguardado<T> {
  const { guardar, retrasoMs = 1000, reintentoMs = 5000, onEstado } = opciones;

  let estado: EstadoAutoguardado = 'guardado';
  // Envuelto en un objeto para distinguir "sin pendiente" (null) de un dato pendiente cualquiera.
  let pendiente: { data: T } | null = null;
  let enVuelo = false;
  let tDebounce: ReturnType<typeof setTimeout> | null = null;
  let tReintento: ReturnType<typeof setTimeout> | null = null;

  const setEstado = (e: EstadoAutoguardado) => {
    if (e === estado) return;
    estado = e;
    onEstado?.(e);
  };
  const cancelar = (t: ReturnType<typeof setTimeout> | null) => { if (t !== null) clearTimeout(t); };

  function intentar() {
    // Un guardado consume la ventana del debounce y cualquier reintento programado.
    cancelar(tDebounce); tDebounce = null;
    cancelar(tReintento); tReintento = null;
    if (enVuelo || pendiente === null) return; // ya hay uno en vuelo (recogerá lo pendiente al terminar), o no hay nada
    const { data } = pendiente;
    pendiente = null;
    enVuelo = true;
    setEstado('guardando');
    guardar(data).then(
      () => {
        enVuelo = false;
        // ENCOLADO: si se editó mientras este guardado viajaba, `pendiente` trae lo nuevo → guardar de nuevo.
        if (pendiente !== null) intentar();
        else setEstado('guardado');
      },
      () => {
        enVuelo = false;
        // El dato que falló vuelve a la cola para reintentar —salvo que ya haya uno más nuevo—.
        if (pendiente === null) pendiente = { data };
        setEstado('error');
        tReintento = setTimeout(intentar, reintentoMs);
      },
    );
  }

  return {
    get estado() { return estado; },
    marcarSucio(data: T) {
      pendiente = { data };
      setEstado('guardando'); // desde la primera tecla la UI dice "Guardando…" (incluye la espera del debounce)
      cancelar(tDebounce);
      tDebounce = setTimeout(intentar, retrasoMs);
    },
    flush() {
      cancelar(tDebounce); tDebounce = null;
      intentar();
    },
    reintentar() { intentar(); },
    destruir() { cancelar(tDebounce); cancelar(tReintento); },
  };
}
