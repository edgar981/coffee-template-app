'use client';

import { useCallback, useRef, useState } from 'react';

// ─── LA GUARDA DE DESCARTE · cerrar un drawer con cambios sin guardar ─────────
//
// Un clic-fuera o Escape cerraba el drawer y perdía lo escrito, en silencio. La
// salida NO es persistir borradores (males propios: reaparecen días después, hay
// que versionarlos por entidad, y el operador no sabe si los escribió él). Es
// preguntar antes de descartar — y sólo si hay algo que descartar.
//
// ── VIVE EN EL ENVOLTORIO, y el cuerpo le REPORTA su estado 'sucio' ─────────
//
// El `onCerrar` que dispara Escape/scrim lo recibe el envoltorio (§ DunaSheet),
// pero el estado del formulario vive en el CUERPO. Así que el cuerpo empuja su
// "¿hay cambios?" a un ref (en un efecto), y el envoltorio lo lee al intentar
// cerrar. Un ref y no estado: reportar el sucio no debe re-renderizar el modal en
// cada tecla, y el envoltorio sólo lo consulta en el evento de cierre.
//
// ── COMPONE CON LA GUARDA EN-VUELO (§ Doble-submit) ─────────────────────────
//
// `enVuelo` primero: mientras la mutación viaja no se cierra por ningún camino
// —ni para preguntar—, porque cerrar a mitad no cancela nada en el server y deja
// al operador sin saber si se aplicó. Es la MISMA tercera-salida que
// `ConfirmDeleteDialog` cierra con su `if (loading) return`.

export interface DescarteDeDrawer {
  /** Va en `DunaSheet.onCerrar`. Con la mutación en vuelo no cierra; con cambios
   *  pregunta; sin cambios cierra directo. */
  intentarCerrar: () => void;
  /** El cuerpo reporta acá si tiene cambios sin guardar (desde un efecto). */
  marcarCambios: (hay: boolean) => void;
  /** ¿Se está mostrando la confirmación de descarte? */
  confirmando: boolean;
  /** Descartar los cambios y cerrar. */
  descartar: () => void;
  /** Seguir editando: cierra la confirmación y deja el drawer abierto. */
  seguirEditando: () => void;
}

export function useDescarteDeDrawer({ enVuelo, onCerrar }: {
  /** `true` mientras una mutación del drawer viaja. Bloquea todo cierre. */
  enVuelo: boolean;
  /** El cierre REAL (limpiar la selección / el parámetro de la URL). */
  onCerrar: () => void;
}): DescarteDeDrawer {
  const cambiosRef = useRef(false);
  const [confirmando, setConfirmando] = useState(false);

  const marcarCambios = useCallback((hay: boolean) => { cambiosRef.current = hay; }, []);

  const intentarCerrar = useCallback(() => {
    if (enVuelo) return;                       // no cerrar a mitad de la mutación
    if (cambiosRef.current) setConfirmando(true);
    else onCerrar();
  }, [enVuelo, onCerrar]);

  const descartar = useCallback(() => { setConfirmando(false); onCerrar(); }, [onCerrar]);
  const seguirEditando = useCallback(() => setConfirmando(false), []);

  return { intentarCerrar, marcarCambios, confirmando, descartar, seguirEditando };
}
