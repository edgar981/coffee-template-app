"use client";
import { useState, type ReactNode } from 'react';

import {
  Sheet, SheetPortal, SheetScrim, SheetSurface, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

// ═══ EL SHEET DE DUNA · la costura forma ↔ conducta ═════════════════════════
//
// La FORMA la pone el design-system (`.duna-sheet`, `.duna-scrim`, el grip, la
// safe-area, la curva y el reduced-motion). La CONDUCTA la pone Radix: foco
// atrapado, Escape, click-fuera y bloqueo del scroll del fondo.
//
// Es la decisión del owner para esta tanda, y su razón corta es la misma que
// decidió H6: no reescribir lo que existe y funciona. La larga está en
// `primitives.css` sobre `.duna-sheet` — el paquete no tiene una sola pieza con
// comportamiento, y meterle la primera dentro de una tanda de móvil sería
// cambiarle la naturaleza sin decirlo.
//
// ── EL SCROLL-LOCK, que es lo que decide el gate ────────────────────────────
//
// Viene con Radix (`react-remove-scroll`) y es el motivo de peso para montar
// acá. NO es el `body.style.overflow = 'hidden'` del drawer del Sidebar: ése le
// falta la mitad que importa en iOS Safari —la prevención a nivel de evento
// (`touchmove`/`wheel` con `preventDefault`)— así que ahí el fondo se sigue
// moviendo detrás del modal. Y `react-remove-scroll` nunca toca `position` ni
// `scrollTop`, así que la posición de la lista se preserva por construcción: al
// cerrar se vuelve exactamente a donde estaba.
//
// Lo que NO hay que hacer es el workaround de `position: fixed` con top
// negativo. Ése sí pierde la posición si no se restaura a mano, y es de donde
// viene la fama de "el modal salta al tope".
//
// ── PORTALEA AL SHELL DEL ADMIN, NO A <body> ────────────────────────────────
//
// `duna.css` lo tiene escrito desde antes: lo portaleado a <body> queda fuera de
// `.admin-shell` y no ve el puente de familias tipográficas, así que el sheet
// saldría en la fuente por defecto del sistema mientras la pantalla de atrás usa
// las de Duna. La nota decía que eso "muerde el día que un diálogo se construya
// con el design-system" — muerde acá, y esto lo esquiva sin tocar el layout
// compartido: el contenedor es el propio puente.
//
// El arreglo SISTÉMICO que esa nota propone —montar las variables de fuente en
// <html>— sigue pendiente y sigue siendo el correcto para H6, que va a portalear
// varias superficies. Acá alcanza con elegir el contenedor.
//
// `.admin-shell` no crea contexto de apilamiento (no tiene transform ni filter),
// así que el `position: fixed` del sheet sigue siendo relativo a la ventana.

/** Fallback declarado: `null` deja que Radix use <body>. No puede pasar en la
 *  práctica —este componente sólo se monta bajo el layout del admin— pero si
 *  pasara, el sheet funciona y se ve con otra fuente, que es degradado y no
 *  roto. */
const buscarContenedor = () =>
  typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.admin-shell');

export function DunaSheet({
  abierto, onCerrar, titulo, descripcion, children,
}: {
  abierto: boolean;
  /** Recibe el cierre y nada más. Quien llama decide qué significa —acá,
   *  limpiar el parámetro de la URL— porque el sheet no es dueño de la
   *  selección. */
  onCerrar: () => void;
  /** OBLIGATORIOS los dos, y van `sr-only`. Radix avisa por consola sin
   *  descripción, pero el motivo real no es el aviso: sin ellos el lector de
   *  pantalla anuncia un diálogo sin decir de qué trata (§ CLAUDE.md — todo
   *  DialogContent lleva DialogDescription). Van ocultos porque el contenido ya
   *  se lo explica a quien ve, y una línea de chrome bajo el título competiría
   *  con la respuesta que el detalle existe para dar primero. */
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  // Inicializador perezoso: se evalúa una vez, en el primer render del cliente,
  // cuando `.admin-shell` ya es un ancestro montado. No es un efecto — un
  // `setState` en efecto agregaría un render y dejaría el primero sin contenedor.
  const [contenedor] = useState(buscarContenedor);

  return (
    <Sheet open={abierto} onOpenChange={(nuevo) => { if (!nuevo) onCerrar(); }}>
      <SheetPortal container={contenedor ?? undefined}>
        <SheetScrim className="duna-scrim" />
        {/* `duna` además de las de la superficie: la tipografía base del sistema
            no la hereda del árbol porque esto vive en un portal, fuera del `.duna`
            de la pantalla. Es la misma clase que la pantalla se pone a sí misma.

            Y el ANCLAJE es explícito. `.duna-sheet` es la superficie y no se ancla
            a ningún borde por su cuenta: desde H6 hay dos anclajes —`--abajo` para
            esto y `--lado` para los drawers de formulario— y el sistema no elige
            uno por default a propósito, para que olvidarlo se vea como lo que es. */}
        <SheetSurface className="duna duna-sheet duna-sheet--abajo">
          {/* Señal, no control: dice "esto sube desde abajo". Sin gesto de
              arrastre en esta versión (§ duna-os.NOTES.md), y sale del árbol de
              accesibilidad porque no hay nada que anunciar. */}
          <div className="duna-sheet__grip" aria-hidden="true" />
          <SheetTitle className="duna-sr-only">{titulo}</SheetTitle>
          <SheetDescription className="duna-sr-only">{descripcion}</SheetDescription>
          <div className="duna-sheet__body">{children}</div>
        </SheetSurface>
      </SheetPortal>
    </Sheet>
  );
}
