import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// EL MODO EDITOR DEJÓ DE SER UNA COOKIE (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1, gate del owner,
// 2026-10-01: *"Los cambios que hice en el panel, sin dar click en publicar, se veían en la página
// real, enseguida."*). Antes este endpoint PONÍA (`POST`) y QUITABA (`DELETE`) una cookie de 2h que
// activaba el borrador para TODO el tráfico de ese navegador — y el `DELETE` de limpieza al salir
// (`components/admin/ModoEditorActivo.tsx`) no corría de forma fiable al cerrar la pestaña, así que
// la cookie sobrevivía y filtraba el borrador a la tienda real.
//
// El mecanismo nuevo es POR REQUEST (`?editor=1` en la URL del iframe → `proxy.ts` lo traduce a un
// header → `lib/config/modo-editor-gate.ts` lo valida contra la sesión EN ESA MISMA request): no
// hay nada que encender ni apagar entre requests, así que el `POST` se RETIRA entero.
//
// El `DELETE` SE QUEDA, único, SIN chequeo de sesión, por una sola razón: LIMPIAR la cookie vieja
// que pudo quedar puesta en un navegador real que haya visitado el preview antes de este cambio
// (el deploy de `EDITOR-TIENDA-IFRAME-VISTA-1` ya estaba público). `modo-editor-gate.ts` ya NO lee
// esa cookie para nada —`marcaModoEditorDesdeHeaders` sólo mira el header—, así que dejarla puesta
// es inofensivo, pero borrarla es higiene barata y sin motivo para pedir sesión (borrar una cookie
// que ya no hace nada no concede nada). `ModoEditorActivo.tsx` la llama una vez al montar.
export async function DELETE() {
  const jar = await cookies();
  jar.delete('modo_editor_tienda');
  return NextResponse.json({ ok: true });
}
