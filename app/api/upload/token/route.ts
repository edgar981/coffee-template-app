import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { storage, pathnameSubidaValido, envPrefix } from '@/lib/storage';
import { TIPOS_PERMITIDOS, MAX_SUBIDA_DIRECTA_BYTES } from '@/constants/upload';

async function sesionAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return ['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '') ? session : null;
}

// GET: el CLIENTE de la subida directa pregunta el prefijo de ENTORNO (`''` o `'dev/'`) para armar
// un pathname que el POST acepte —el navegador no ve `VERCEL_ENV`, y sin este dato una subida de dev
// aterrizaría en el namespace de producción (§ aislamiento)—. Gateado como el resto: sólo admin.
export async function GET() {
  if (!(await sesionAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return NextResponse.json({ prefijo: envPrefix() });
}

// Emite el TOKEN de la SUBIDA DIRECTA a Blob (client upload). El archivo NO pasa por acá —va del
// navegador a Blob—; este endpoint sólo FIRMA un token acotado. Por eso el gate de sesión de ESTE
// route es lo único que impide que un tercero suba a tu Blob: la autorización se hace en
// `onBeforeGenerateToken` ANTES de firmar, y las restricciones que devuelve quedan CODIFICADAS EN EL
// TOKEN (Blob las impone en la subida, no son un chequeo que se pueda saltar).
//
// `handleUpload` sirve DOS peticiones por el mismo route: la de TOKEN (corre onBeforeGenerateToken) y
// el webhook UPLOAD-COMPLETED que Blob manda al terminar (SIN sesión). Por eso el gate va DENTRO del
// callback, no arriba del todo —arriba bloquearía el webhook—. En localhost el webhook no llega
// (Blob no alcanza localhost); el cliente usa la URL que devuelve `upload()`, así que no dependemos
// de él.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Petición inválida' }, { status: 400 });

  try {
    const json = await storage.emitirTokenSubida({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // 1. SESIÓN + ROL. Sin esto, cualquiera firmaría un token para tu Blob.
        if (!(await sesionAdmin())) throw new Error('No autorizado');

        // 2. PATHNAME. Acota DÓNDE puede escribir (prefijo whitelisted + aislamiento `dev/` por
        //    entorno + sin traversal). El token queda ligado a este pathname; no sirve para otra
        //    carpeta. Es el único control de destino —el archivo no pasa por el server—.
        if (!pathnameSubidaValido(pathname)) throw new Error('Ruta de subida no permitida');

        // 3. RESTRICCIONES EN EL TOKEN. Blob las impone al subir, no es un chequeo previo salteable:
        //    SÓLO imágenes (el vídeo es la tanda B — un token de hoy no puede subir un mp4) y
        //    ≤200 MB. `validUntil` generoso (60 min) para que una subida lenta de 200 MB por
        //    multipart no se quede sin token a mitad.
        return {
          allowedContentTypes: [...TIPOS_PERMITIDOS],
          maximumSizeInBytes: MAX_SUBIDA_DIRECTA_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo autorizar la subida';
    const status = msg === 'No autorizado' ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
