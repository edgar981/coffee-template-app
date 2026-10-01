'use client';

import { useEffect } from 'react';

// YA NO ENCIENDE/APAGA NADA (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1, reemplaza a EDITOR-TIENDA-IFRAME-
// GATE-1/EDITOR-TIENDA-IFRAME-VISTA-1). El modo editor dejó de ser una cookie de sesión —hoy es un
// parámetro POR REQUEST (`?editor=1`) que `VistaTiendaIframe` pone en la URL del iframe, válido
// sólo para ESA request y sólo si la sesión en vuelo es OWNER/MANAGER (§ `modo-editor-gate.ts`). No
// hay nada que "prender" al entrar a `/admin/tienda`: no afecta a ninguna otra pestaña ni persiste.
//
// Este componente se queda SÓLO para LIMPIAR la cookie vieja (`modo_editor_tienda`) que un
// navegador real pudo haber recibido mientras el mecanismo retirado estaba en pie —el deploy de
// `EDITOR-TIENDA-IFRAME-VISTA-1` ya era público—: un DELETE, UNA vez, al montar. El gate de hoy ni
// siquiera lee esa cookie (`marcaModoEditorDesdeHeaders` sólo mira el header), así que dejarla
// puesta es inofensivo; borrarla es higiene, no corrección de un bug activo.
//
// Sigue montado por `app/(admin)/admin/tienda/page.tsx` sin cambios ahí: retirar el componente
// entero habría exigido tocar ese archivo, fuera de `touches:` de este slice.
export default function ModoEditorActivo() {
  useEffect(() => {
    fetch('/api/site-content/modo-editor', { method: 'DELETE' }).catch(() => {});
  }, []);
  return null;
}
