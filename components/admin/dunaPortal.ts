"use client";
import { useState } from 'react';

// ─── DÓNDE SE MONTAN LAS SUPERFICIES PORTALEADAS DE DUNA ─────────────────────
//
// Un solo sitio, y por eso existe este archivo en vez de una función copiada en
// cada costura.
//
// ── POR QUÉ NO A `<body>`, QUE ES EL DEFAULT ────────────────────────────────
//
// `duna.css` lo tiene escrito desde antes de que mordiera: el puente de familias
// tipográficas vive en `.admin-shell`, que es un DIV, así que lo portaleado a
// `<body>` queda FUERA y no lo ve. Una superficie del design-system montada ahí
// saldría en la fuente por defecto del sistema mientras la pantalla de atrás usa
// las de Duna. La nota decía que eso "muerde el día que un diálogo se construya
// con el design-system" — mordió, y esto lo esquiva eligiendo el contenedor.
//
// `.admin-shell` no crea contexto de apilamiento (no tiene `transform`, `filter`
// ni `contain`), así que el `position: fixed` de las superficies sigue siendo
// relativo a la ventana. Si algún día se le agrega uno, TODAS las superficies
// portaleadas se anclan a él en vez de a la pantalla — es el efecto que hay que
// mirar antes de tocar ese wrapper.
//
// ── EL ARREGLO SISTÉMICO SIGUE PENDIENTE, Y ES OTRO ─────────────────────────
//
// Lo correcto de fondo es montar las variables de fuente en `<html>`, como ya se
// hace con la clase `admin` (§ `AdminScope`). No se hizo acá porque `<html>` lo
// emite el layout RAÍZ, compartido con el storefront: poner ahí las clases
// `.variable` de `next/font` haría que Next considere usadas las cinco fuentes
// del panel en TODAS las rutas — justo lo que `app/(admin)/fonts.ts` declara
// evitar. La salida sería que `AdminScope` las estampe en runtime.
//
// DISPARADOR: cuando el chrome del panel migre al design-system y `.admin-shell`
// deje de existir como concepto, este contenedor se queda sin destino y el
// arreglo de `<html>` pasa a ser obligatorio.

/** El puente app↔design-system. Ver `app/(admin)/duna.css`. */
const SELECTOR_DEL_PUENTE = '.admin-shell';

/**
 * El contenedor donde portalear, o `null` para que Radix use `<body>`.
 *
 * `null` es un fallback DECLARADO y no puede ocurrir en la práctica —estas
 * superficies sólo se montan bajo el layout del admin—, pero si ocurriera el
 * diálogo funciona y sólo se ve con otra fuente: degradado, no roto.
 */
export function contenedorDunaPortal(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(SELECTOR_DEL_PUENTE);
}

/**
 * El contenedor, resuelto UNA vez en el primer render del cliente.
 *
 * Inicializador perezoso y no un efecto: un `setState` en efecto agregaría un
 * render y dejaría el primero sin contenedor —o sea, portaleando a `<body>` justo
 * en la apertura, que es cuando se ve—. Cuando este hook corre, `.admin-shell` ya
 * es un ancestro montado.
 */
export function useContenedorDunaPortal(): HTMLElement | undefined {
  const [contenedor] = useState(contenedorDunaPortal);
  return contenedor ?? undefined;
}
