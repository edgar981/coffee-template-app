'use client';

import { createContext, useContext, type ReactNode } from 'react';

// El SEÑALADOR de "esto se renderiza en una VISTA PREVIA" — la del editor de /admin/tienda, que
// renderiza los componentes REALES del storefront alimentados por el estado del formulario. En
// preview los componentes van ESTÁTICOS: la flecha en bucle del hero se apaga (una invitación a
// scrollear no significa nada dentro del marco del panel) y las animaciones de entrada no corren.
// La tienda pública NO monta este provider → `useIsPreview()` es `false` por defecto y todo se ve
// y se comporta normal.
//
// (Antes esto era el modo `?preview=1` del IFRAME, con `pointer-events:none`. El iframe se retiró
// —la vista previa pasó a componentes reales alimentados por el form—, así que queda sólo la señal
// de contexto; el wrapper del iframe y la lectura de `?preview` se fueron con él.)

const PreviewContext = createContext(false);

/** `true` dentro de una vista previa. Default `false` (sin provider / tienda pública). */
export function useIsPreview(): boolean {
  return useContext(PreviewContext);
}

/** Marca el subárbol como vista previa (componentes estáticos). Lo monta la vista en vivo del panel. */
export function PreviewProvider({ children }: { children: ReactNode }) {
  return <PreviewContext.Provider value={true}>{children}</PreviewContext.Provider>;
}
