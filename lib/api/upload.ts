'use client';

import { upload } from '@vercel/blob/client';
import { sanitizeFilename } from '@/lib/storage-path';
import type { PrefijoUpload, KindUpload } from '@/constants/upload';

// SUBIDA DIRECTA a Blob (client upload). El archivo va del NAVEGADOR a Blob, sin pasar por la función
// serverless —así el límite de 4.5 MB del body no aplica y sube hasta 200 MB (§ el endpoint del
// token)—. Reemplaza al `uploadImagen` que iba por `/api/upload` (server put), retirado: dejar los
// dos sería dos caminos y el tope de 4 MB sobreviviendo donde nadie lo espera.
//
// El SDK (`@vercel/blob/client`) es la cara CLIENTE de la frontera del proveedor; la server vive en
// `lib/storage.ts`. Al cambiar de proveedor se reimplementan las dos.

/**
 * Mensaje que ve el dueño cuando la subida se rechaza porque su SESIÓN del panel venció (o su rol ya
 * no alcanza) — el mismo gate de `GET /api/upload/token` que firma el token de subida
 * (`sesionAdmin`, § app/api/upload/token/route.ts). Exportado para que `esSesionVencida` (abajo) y el
 * editor lo reconozcan y ofrezcan "vuelve a iniciar sesión" en vez de un "reintenta" que no arregla
 * nada —la sesión sigue vencida hasta que vuelva a entrar— (§ PANEL-ERROR-SUBIDA-VISIBLE-1).
 */
export const MSG_SESION_VENCIDA = 'Tu sesión expiró. Vuelve a iniciar sesión y reintenta la subida.';

/** Compara CONTRA el mensaje exacto de arriba —nunca un substring— porque es la ÚNICA fuente que lo
 *  produce (`envPrefijo`, abajo): un match más laxo podría confundir un error genuino que mencione
 *  "sesión" de pasada con el caso real. */
export function esSesionVencida(msg: string): boolean {
  return msg === MSG_SESION_VENCIDA;
}

// El navegador no ve `VERCEL_ENV`, así que pregunta el prefijo de entorno (`''` | `'dev/'`) al server
// una vez y lo cachea. Sin él, una subida de dev aterrizaría en el namespace de producción. Un fallo
// NO se cachea (para reintentar).
//
// EL 401 DE ESTE GET ES EL MISMO GATE QUE FIRMA EL TOKEN (`sesionAdmin`): si la sesión venció o el rol
// ya no alcanza, este GET devuelve 401 —y es la ÚNICA de las dos peticiones que `subirDirecto` hace
// (ésta, y la interna del SDK abajo) cuyo status SÍ se puede leer acá—, así que es donde se distingue
// el rechazo por sesión de cualquier otro fallo (§ PANEL-ERROR-SUBIDA-VISIBLE-1). El POST que firma el
// token (dentro de `upload()`, del SDK `@vercel/blob/client`) pasa por el MISMO gate, pero el SDK no
// expone el status de esa respuesta —sólo un mensaje genérico, "Failed to retrieve the client
// token"—, así que esa mitad queda SIN distinguir; declarado, no resuelto acá (§ el reporte del
// slice: si la sesión vence DESPUÉS de que este GET ya cacheó un prefijo válido, el siguiente fallo de
// `upload()` no se reconoce como sesión vencida).
let prefijoPromesa: Promise<string> | null = null;
function envPrefijo(): Promise<string> {
  if (!prefijoPromesa) {
    prefijoPromesa = fetch('/api/upload/token', { method: 'GET' })
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 401) return Promise.reject(new Error(MSG_SESION_VENCIDA));
        return Promise.reject(new Error('No se pudo autorizar la subida.'));
      })
      .then((d) => d.prefijo as string)
      .catch((e) => { prefijoPromesa = null; throw e; });
  }
  return prefijoPromesa;
}

/**
 * Sube un archivo DIRECTO a Blob y devuelve su URL pública. `carpeta` es la "carpeta" del store
 * ('productos' | 'contenido'); el pathname se arma `[dev/]<carpeta>/<archivo saneado>` para que el
 * endpoint del token lo acepte (mismo saneo que valida el server). `kind` (default 'imagen') declara
 * qué acepta el token —'imagen' o 'imagen-o-video'—; viaja como `clientPayload` y el server lo mapea
 * a una lista CONOCIDA (nunca un comodín). `onProgress` recibe el porcentaje 0–100. Lanza con el
 * mensaje del error (el token venció, red caída, tipo/tamaño rechazado por Blob).
 */
export async function subirDirecto(
  file: File,
  { carpeta, kind = 'imagen', onProgress }: { carpeta: PrefijoUpload; kind?: KindUpload; onProgress?: (pct: number) => void },
): Promise<{ url: string }> {
  const prefijo = await envPrefijo();
  const pathname = `${prefijo}${carpeta}/${sanitizeFilename(file.name)}`;

  const { url } = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload/token',
    multipart: true, // en PARTES: una conexión lenta sólo tarda más, no hay un timeout único que la mate
    contentType: file.type || undefined,
    clientPayload: JSON.stringify({ kind }),
    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
  });

  return { url };
}
