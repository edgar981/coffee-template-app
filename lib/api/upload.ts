// Cliente del endpoint de upload. Los límites se validan en el server; el
// formulario los consulta desde `constants/upload` para avisar antes.

import type { PrefijoUpload } from '@/constants/upload';

/**
 * Sube una imagen y devuelve su URL pública. Lanza con el mensaje del server. El `prefijo`
 * elige la "carpeta" del store (default 'productos'); el hero del storefront usa 'contenido'.
 */
export async function uploadImagen(file: File, prefijo?: PrefijoUpload): Promise<{ url: string }> {
  const body = new FormData();
  body.append('file', file);
  if (prefijo) body.append('prefix', prefijo);

  const res = await fetch('/api/upload', { method: 'POST', body });
  if (!res.ok) {
    const msg = await res.json().then((d) => d?.error).catch(() => null);
    throw new Error(msg || 'No se pudo subir la imagen');
  }
  return res.json();
}
