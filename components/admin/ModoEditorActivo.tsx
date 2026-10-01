'use client';

import { useEffect } from 'react';

// ENCIENDE/APAGA la cookie de modo editor (§ EDITOR-TIENDA-IFRAME-VISTA-1, sobre el gate de
// EDITOR-TIENDA-IFRAME-GATE-1) mientras /admin/tienda está montado: POST al entrar, DELETE al
// salir — así el iframe de esta misma pantalla ve el BORRADOR aplicado (§ resolverSegunModo,
// lib/config/site-content.ts) y un visitante real nunca hereda el modo editor de una pestaña de
// admin que quedó abierta.
//
// Sin UI propia: es un efecto puro de ciclo de vida, montado UNA vez por `app/(admin)/admin/
// tienda/page.tsx` (toda la pantalla, no por pestaña de página dentro de `TiendaPaginas`) — las
// piezas store-wide (Paleta, Menú, Encabezado, Detalles, Pie) también quieren el borrador activo
// mientras se edita acá, aunque esta tanda no les dé vista previa propia.
//
// El DELETE va con `fetch` normal (no `navigator.sendBeacon`, que sólo admite POST): cubre salir
// de la pantalla DENTRO del panel (navegación client-side, donde el efecto de limpieza SÍ corre).
// Un cierre abrupto de la pestaña (cerrar el navegador, Alt+F4) no dispara el cleanup de React —
// la cookie expira sola a las 2h (§ MODO_EDITOR_MAX_AGE_S), el mismo riesgo ya aceptado al diseñar
// el gate (§ DISENO.md, "vida CORTA y RENOVABLE").
export default function ModoEditorActivo() {
  useEffect(() => {
    fetch('/api/site-content/modo-editor', { method: 'POST' }).catch(() => {});
    return () => {
      fetch('/api/site-content/modo-editor', { method: 'DELETE' }).catch(() => {});
    };
  }, []);
  return null;
}
