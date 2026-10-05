'use client';

import { useEffect, useState } from 'react';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';

// ─── La cuenta de PASARELA (§ API-DIRECTA-PANEL-METODOS-1) — COMPARTIDA entre bloques ────────
//
// Vivía DENTRO de `DatosNegocioSeccion` porque esa era la única consumidora. Partido en bloques,
// los CUATRO que tocan SiteSetting (Identidad, Contacto y redes, Correos, Pagos y cobros)
// necesitan el MISMO dato: `metodosPasarela` no vive en `SiteSettings` (sólo el derivado
// `metodoPasarelaDesalineado`, § site-settings-read.ts), así que cada uno tiene que saber qué
// hay GUARDADO para reenviarlo sin tocarlo (`payloadBaseDesdeSettings`,
// `lib/admin/configuracion-partes.ts`) — no sólo el bloque Pagos, que además lo EDITA.
//
// Como la página muestra UNA subsección a la vez (§ `?parte=`), sólo UN bloque de estos cuatro
// está montado en un momento dado, así que cada uno llamando a este hook dispara COMO MUCHO una
// consulta — no cuatro en paralelo.

export type CuentaPasarelaEstado =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; metodos: string[]; guardado: string[] }
  | { tipo: 'error'; guardado: string[] };

type RespuestaPasarelaMetodos =
  | { ok: true; metodos: string[]; guardado: string[] }
  | { ok: false; error: string; guardado: string[] };

/** `[]` si todavía no se leyó (tipo 'cargando') o si la capacidad está apagada en este despliegue. */
export function guardadoDe(estado: CuentaPasarelaEstado): string[] {
  return estado.tipo === 'cargando' ? [] : estado.guardado;
}

export function useCuentaPasarela() {
  const [estado, setEstado] = useState<CuentaPasarelaEstado>({ tipo: 'cargando' });

  useEffect(() => {
    if (!pasarelaDisponibleEnEsteDespliegue()) return;
    let cancelado = false;
    fetch('/api/pasarela/metodos')
      .then(res => res.json())
      .then((data: RespuestaPasarelaMetodos) => {
        if (cancelado) return;
        setEstado(data.ok
          ? { tipo: 'ok', metodos: data.metodos, guardado: data.guardado }
          : { tipo: 'error', guardado: data.guardado });
      })
      .catch(() => { if (!cancelado) setEstado({ tipo: 'error', guardado: [] }); });
    return () => { cancelado = true; };
  }, []);

  return { estado, setEstado };
}
