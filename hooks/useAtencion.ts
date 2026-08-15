'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getAtencion } from '@/lib/api/atencion';
import type { MapaAtencion } from '@/lib/atencion/registro';

/** Generoso a propósito: un panel de operación no gana nada preguntando más
 *  seguido, y el punto no es una alarma en tiempo real sino una promesa de que
 *  hay algo esperando. 45s es el de la campana, que sí notifica; 60 acá evita
 *  que los dos ciclos queden en fase y golpeen juntos. */
const POLL_MS = 60_000;

/**
 * ¿Qué secciones piden atención? Alimenta el punto sol del nav.
 *
 * ── UNA CONSULTA PARA TODAS LAS SECCIONES ───────────────────────────────────
 *
 * Devuelve el MAPA completo, no un booleano por sección: era `useAtencionPedidos`
 * y respondía sólo por Pedidos, y la generalización a varias secciones se hizo con
 * UN endpoint (§ `app/api/atencion`) justamente para no multiplicar el problema
 * que este archivo ya tenía anotado abajo — un hook por sección serían N timers
 * preguntando lo mismo para siempre.
 *
 * ── SE MONTA UNA SOLA VEZ, Y NO ES UN DETALLE ───────────────────────────────
 *
 * Va en `Sidebar`, que es único, y el dato BAJA por props. Dentro de `SidebarNav`
 * o de `NavRow` correría DOBLE: con el rail colapsado hay dos `SidebarNav`
 * montados a la vez (uno oculto por CSS), así que serían dos timers preguntando
 * lo mismo para siempre. `MobileNav` tiene la suya y no comparte ésta: las dos
 * superficies nunca están montadas al mismo tiempo.
 *
 * ── REFRESCO ────────────────────────────────────────────────────────────────
 *
 * Tres disparadores, y cada uno cubre lo que los otros no:
 *   · al montar        — el estado inicial
 *   · cada 60s         — un punto que sólo se actualiza al recargar miente
 *                        durante toda una sesión larga
 *   · al cambiar RUTA  — es el momento en que el operador ACABA de resolver algo
 *                        (cobró, programó, repuso) y sale de la pantalla; sin
 *                        esto el punto se quedaría encendido hasta un minuto
 *                        después de que ya no haya nada que atender
 *
 * Y el timer se PARA con la pestaña oculta, con refresco inmediato al volver.
 * Es la misma convención de `NotificationBell`, no una segunda: el navegador ya
 * estrangula los timers de fondo, y despertar la pestaña sólo gasta batería y
 * cuota de la base.
 */
export function useAtencion(): MapaAtencion {
  const [mapa, setMapa] = useState<MapaAtencion>({});
  const pathname = usePathname();

  // `pathname` en las deps es lo que hace el refresco por ruta: cambia la ruta →
  // cambia `load` → el efecto se reinicia y vuelve a preguntar.
  const load = useCallback(async () => {
    setMapa(await getAtencion());
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- `pathname` NO se usa dentro: es el disparador del refresco por navegación

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const arrancar = () => { if (timer === null) timer = setInterval(load, POLL_MS); };
    const parar    = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

    const onVisibilidad = () => {
      if (document.hidden) parar();
      else { load(); arrancar(); }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial: el estado lo escribe el callback del fetch, no el cuerpo del efecto
    load();
    if (!document.hidden) arrancar();
    document.addEventListener('visibilitychange', onVisibilidad);
    return () => { parar(); document.removeEventListener('visibilitychange', onVisibilidad); };
  }, [load]);

  return mapa;
}
