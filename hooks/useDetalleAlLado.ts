"use client";
import { useSyncExternalStore } from 'react';
import { DUNA_MQ_DETALLE_AL_LADO } from '@duna/design-system/layout';

// ─── ¿EL DETALLE VA AL LADO DE LA LISTA? ─────────────────────────────────────
//
// `true` = hay ancho para DOS columnas: el detalle es el panel del split, al lado
// de la lista. `false` = una sola columna y el detalle sube como sheet. Es el
// EFECTO —dónde se monta el detalle—, no una descripción del layout ni "¿es
// móvil?": el nombre viejo (`useEsMovil`) preguntaba por la pantalla táctil, que
// es OTRA pregunta (§ el rail y la barra inferior, que siguen en su breakpoint).
//
// La consulta la trae el design-system (`DUNA_MQ_DETALLE_AL_LADO`), no se escribe
// acá: el umbral es una decisión del SISTEMA y ya tiene su gemelo en el CSS del
// colapso de `.duna-split`. Un tercer sitio con el número sería el que se queda
// atrás — y el colapso CSS y esta decisión JS TIENEN que moverse juntos, o el
// detalle queda montado en un panel que ya colapsó.
//
// ── POR QUÉ HACE FALTA JS SI EL CSS YA CAMBIA SOLO ──────────────────────────
//
// Porque debajo del umbral el detalle no se ESCONDE: se monta en otro sitio (un
// sheet, portaleado). Eso es una decisión de árbol, no de estilo, y el CSS no la
// puede tomar. Montarlo en los dos lados para que uno se oculte tampoco sirve:
// serían dos copias vivas del mismo detalle, con sus efectos y su lugar en el
// árbol de accesibilidad — y el sheet, que es un diálogo, atraparía el foco
// también con el panel al lado.
//
// ── `useSyncExternalStore` Y NO `useState` + `useEffect` ────────────────────
//
// Un `setState` síncrono dentro del efecto dispara renders en cascada y el lint
// lo marca; es el mismo criterio con el que Analítica DERIVA su `loading` en vez
// de setearlo. Acá además evita el parpadeo: el valor se lee en el primer render
// del cliente, no un tick después.
//
// El snapshot del SERVIDOR es `true` —al lado, escritorio— y eso importa: en el
// prerender no hay ventana que medir, así que hay que elegir un lado. Se elige el
// que NO monta el diálogo. Si se eligiera `false`, el HTML del servidor traería
// un sheet abierto que la hidratación tendría que desmontar, y un diálogo que
// aparece y se va solo es peor que uno que llega un tick tarde. Además es
// invisible: estas pantallas piden sus datos en un efecto, así que en el primer
// paint no hay nada seleccionado que un sheet pudiera mostrar.

let lista: MediaQueryList | null = null;
const consultar = () => (lista ??= window.matchMedia(DUNA_MQ_DETALLE_AL_LADO));

// Estables a nivel de módulo: `useSyncExternalStore` se re-suscribe cada vez que
// `subscribe` cambia de identidad, y una función creada en el render cambia
// siempre.
const suscribir = (avisar: () => void) => {
  const mq = consultar();
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
};
// La consulta es "¿estoy DEBAJO del umbral?" (max-width); el detalle va al lado
// cuando NO lo estoy, así que se niega.
const leer           = () => !consultar().matches;
const leerEnServidor = () => true;

export function useDetalleAlLado(): boolean {
  return useSyncExternalStore(suscribir, leer, leerEnServidor);
}
