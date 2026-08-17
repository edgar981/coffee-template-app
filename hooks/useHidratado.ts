'use client';
import { useEffect, useState } from 'react';

// ─── ¿YA HIDRATÓ EL CLIENTE? ─────────────────────────────────────────────────
//
// `false` en el servidor y en el PRIMER render del cliente; `true` desde el
// primer efecto en adelante. Sirve para que un efecto NO decida contra un valor
// que todavía es el del prerender.
//
// El caso que lo instaura: `useDetalleAlLado` reporta `true` ("al lado") en el
// servidor a propósito (no hay ventana que medir), y en un cliente angosto hidrata
// a `false`. Un efecto que corra en ese instante —el auto-select— lo ve `true` y
// escribe `?pedido` como si fuera escritorio; la corrección de la hidratación
// re-renderiza a `false` PERO el `?pedido` ya quedó escrito. La guarda no es
// táctica: un hook que reporta una cosa en servidor y otra en cliente filtra por
// cualquier efecto que actúe antes de que el valor se asiente, y `useHidratado`
// es la línea que los hace esperar.
//
// Es un `setState` en efecto A PROPÓSITO —el único dato que no existe en el
// prerender es "ya estoy en el cliente"—, con el mismo descargo que el hidratado
// del rail en `AdminChrome`.
export function useHidratado(): boolean {
  const [hidratado, setHidratado] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- flip único post-hidratación (no hay forma de saberlo en el prerender)
  useEffect(() => { setHidratado(true); }, []);
  return hidratado;
}
