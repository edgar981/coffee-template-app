"use client";
import type { ReactNode } from 'react';

import {
  Sheet, SheetPortal, SheetScrim, SheetSurface, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';

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

export function DunaSheet({
  abierto, onCerrar, titulo, descripcion, anclaje = 'abajo', children,
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
  /**
   * De qué borde sale. `abajo` es el detalle en angosto —el caso con el que nació
   * esta costura— y `lado` es el drawer de los flujos con formulario.
   *
   * El default es `abajo` PARA EL COMPONENTE, no para el CSS: la clase base del
   * sistema no ancla a nada a propósito. Acá sí hay default porque un componente
   * de React puede tenerlo sin que se vuelva invisible — el que llama ve el prop
   * en la firma.
   */
  anclaje?: 'abajo' | 'lado';
  children: ReactNode;
}) {
  const contenedor = useContenedorDunaPortal();

  return (
    <Sheet open={abierto} onOpenChange={(nuevo) => { if (!nuevo) onCerrar(); }}>
      <SheetPortal container={contenedor}>
        <SheetScrim className="duna-scrim" />
        {/* `duna` además de las de la superficie: la tipografía base del sistema
            no la hereda del árbol porque esto vive en un portal, fuera del `.duna`
            de la pantalla. Es la misma clase que la pantalla se pone a sí misma.

            Y el ANCLAJE viaja como clase: `.duna-sheet` es la superficie y no se
            ancla a ningún borde por su cuenta. */}
        <SheetSurface className={`duna duna-sheet duna-sheet--${anclaje}`}>
          {/* EL GRIP ES SÓLO DEL ANCLAJE DE ABAJO. Dice "esto se despliega desde
              abajo", así que en un drawer lateral sería una señal que apunta al
              borde equivocado. Sin gesto de arrastre en ninguno de los dos
              (§ duna-os.NOTES.md), y fuera del árbol de accesibilidad porque no
              hay nada que anunciar. */}
          {anclaje === 'abajo' && <div className="duna-sheet__grip" aria-hidden="true" />}
          <SheetTitle className="duna-sr-only">{titulo}</SheetTitle>
          <SheetDescription className="duna-sr-only">{descripcion}</SheetDescription>
          {/* EL CUERPO LO COMPONE QUIEN LLAMA, y no se envuelve acá. Las dos
              formas quieren estructuras distintas: el sheet de abajo es un solo
              `__body` que scrollea, y el drawer es `__head` + `__body` + `__foot`
              con la cabecera y el pie quietos. Envolver siempre en `__body`
              obligaría al drawer a anidar su pie DENTRO del área que scrollea,
              que es justo lo que el pie no debe hacer.
              Esta costura garantiza la superficie y el NOMBRE accesible; la
              anatomía es del flujo. */}
          {children}
        </SheetSurface>
      </SheetPortal>
    </Sheet>
  );
}
