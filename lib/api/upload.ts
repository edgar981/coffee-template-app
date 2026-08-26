'use client';

import { upload } from '@vercel/blob/client';
import { sanitizeFilename } from '@/lib/storage-path';
import type { PrefijoUpload } from '@/constants/upload';

// SUBIDA DIRECTA a Blob (client upload). El archivo va del NAVEGADOR a Blob, sin pasar por la función
// serverless —así el límite de 4.5 MB del body no aplica y sube hasta 200 MB (§ el endpoint del
// token)—. Reemplaza al `uploadImagen` que iba por `/api/upload` (server put), retirado: dejar los
// dos sería dos caminos y el tope de 4 MB sobreviviendo donde nadie lo espera.
//
// El SDK (`@vercel/blob/client`) es la cara CLIENTE de la frontera del proveedor; la server vive en
// `lib/storage.ts`. Al cambiar de proveedor se reimplementan las dos.

// El navegador no ve `VERCEL_ENV`, así que pregunta el prefijo de entorno (`''` | `'dev/'`) al server
// una vez y lo cachea. Sin él, una subida de dev aterrizaría en el namespace de producción. Un fallo
// NO se cachea (para reintentar).
let prefijoPromesa: Promise<string> | null = null;
function envPrefijo(): Promise<string> {
  if (!prefijoPromesa) {
    prefijoPromesa = fetch('/api/upload/token', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No autorizado para subir'))))
      .then((d) => d.prefijo as string)
      .catch((e) => { prefijoPromesa = null; throw e; });
  }
  return prefijoPromesa;
}

/**
 * Sube una imagen DIRECTO a Blob y devuelve su URL pública. `carpeta` es la "carpeta" del store
 * ('productos' | 'contenido'); el pathname se arma `[dev/]<carpeta>/<archivo saneado>` para que el
 * endpoint del token lo acepte (mismo saneo que valida el server). `onProgress` recibe el porcentaje
 * 0–100. Lanza con el mensaje del error (el token venció, red caída, tipo/tamaño rechazado por Blob).
 */
export async function subirDirecto(
  file: File,
  { carpeta, onProgress }: { carpeta: PrefijoUpload; onProgress?: (pct: number) => void },
): Promise<{ url: string }> {
  const prefijo = await envPrefijo();
  const pathname = `${prefijo}${carpeta}/${sanitizeFilename(file.name)}`;

  const { url } = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload/token',
    multipart: true, // en PARTES: una conexión lenta sólo tarda más, no hay un timeout único que la mate
    contentType: file.type || undefined,
    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
  });

  return { url };
}
