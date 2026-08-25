import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { storage, DEFAULT_PREFIX } from '@/lib/storage';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS, PREFIJOS_UPLOAD } from '@/constants/upload';

// Upload de imágenes del admin. NO importa el SDK del proveedor: todo pasa por
// `lib/storage.ts` (ver la nota del adaptador sobre por qué esa frontera existe).
// Esta es la validación que MANDA — la del formulario es solo aviso temprano.

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Petición inválida: se esperaba multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }

  // El content-type lo declara el cliente, así que es un filtro de conveniencia,
  // no una garantía. El riesgo residual está acotado: el store es público y de
  // solo lectura para terceros, y quien llega hasta acá ya es OWNER/MANAGER.
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: `Formato no admitido (${file.type || 'desconocido'}). Usa JPG, PNG o WebP.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return NextResponse.json(
      { error: `La imagen pesa ${mb} MB y el máximo es ${MAX_UPLOAD_MB} MB.` },
      { status: 400 },
    );
  }

  // El prefijo lo elige el cliente pero contra una WHITELIST: 'productos' (default) o
  // 'contenido'. Un valor fuera de la lista cae al default — nunca escribe en una ruta
  // arbitraria del store.
  const prefixRaw = form.get('prefix');
  const prefix = (PREFIJOS_UPLOAD as readonly string[]).includes(prefixRaw as string)
    ? (prefixRaw as string)
    : DEFAULT_PREFIX;

  try {
    const { url } = await storage.put(file, { prefix });
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    console.error('[upload] falló la subida', e);
    return NextResponse.json({ error: 'No se pudo subir la imagen' }, { status: 502 });
  }
}
