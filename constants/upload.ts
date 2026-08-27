// ─── Límites de upload de imágenes ───────────────────────────────────────────
// Compartidos por el endpoint (validación que MANDA) y por el formulario (aviso
// temprano, para no gastar una subida que el server va a rechazar). Viven acá y
// no en el route handler porque ese módulo importa auth y el SDK del storage:
// reexportarlos desde ahí arrastraría código de server al bundle del cliente.

/**
 * Tope de tamaño. El body de una función serverless de Vercel está limitado a
 * 4.5 MB: por encima de eso la plataforma corta la petición ANTES de que el
 * handler llegue a correr, y el operador vería un error genérico de red en vez
 * de un mensaje del formulario. Se declara en 4 MB para dejar margen al overhead
 * del multipart y quedarnos siempre del lado que sí puede responder un 400 claro.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

/**
 * Tope de la SUBIDA DIRECTA a Blob (client upload). No pasa por la función serverless —el archivo va
 * del navegador a Blob—, así que el límite de 4.5 MB del body NO aplica; el tope es de producto
 * (200 MB deja subir un plano de finca de un par de minutos sin obligar a recortar antes). Se
 * codifica EN EL TOKEN (`maximumSizeInBytes`), así que Blob lo impone en la subida, no es sólo un
 * chequeo previo. NO reemplaza a `MAX_UPLOAD_BYTES`: ése sigue rigiendo el path server (legacy)
 * mientras la migración del cliente no llegue.
 */
export const MAX_SUBIDA_DIRECTA_BYTES = 200 * 1024 * 1024;

export const MAX_SUBIDA_DIRECTA_MB = MAX_SUBIDA_DIRECTA_BYTES / (1024 * 1024);

/** Formatos aceptados. Lista blanca explícita, no un `startsWith('image/')`. */
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Contenedores de VÍDEO aceptados. Lista aparte —un vídeo en un `<img>`/`next/image` no falla ruidoso,
 *  se queda en blanco—, NUNCA se amplía la de imágenes. Incluye `video/quicktime` (.mov) SÓLO porque la
 *  PUERTA DURA pasó a ser el CÓDEC (§ lib/video-codec): un .mov con H.264 se reproduce en todos lados y
 *  ahora se acepta; uno con ProRes/HEVC lo rechaza el gate de códec, no el contenedor. **No leer
 *  "aceptamos quicktime" como un aflojamiento** — sin el parser de códec SÍ lo sería (un HEVC-en-mp4 pasa
 *  el contenedor y no se reproduce). El WebM no se parsea (EBML, otro formato) y pasa por contenedor: sus
 *  códecs reales de entrada (VP8/9/AV1) son todos web-amigables. */
export const TIPOS_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

/**
 * El "kind" que el cliente declara al pedir un token de subida directa (§ subirDirecto). Acota qué
 * `allowedContentTypes` firma el token: 'imagen' (portadas, hero, fotos de galería) o 'imagen-o-video'
 * (el slot de vídeo de la galería). Es una de DOS listas CONOCIDAS —nunca un comodín ni los tipos que
 * mande el cliente—, así que un token nunca sirve para "cualquier cosa".
 */
export const KINDS_UPLOAD = ['imagen', 'imagen-o-video'] as const;
export type KindUpload = (typeof KINDS_UPLOAD)[number];

/** Mapea un kind (posiblemente basura del cliente) a su lista de content-types para el TOKEN. Un valor
 *  DESCONOCIDO cae a sólo-imágenes: lo más restrictivo, nunca a vídeo por accidente. El token acota el
 *  CONTENEDOR (+ tamaño + pathname); el CÓDEC lo filtra el cliente antes de subir (§ lib/video-codec),
 *  que es un gate de CALIDAD, no de seguridad —un admin ya puede subir basura; el gate lo protege de
 *  PUBLICAR un vídeo que sus clientes no verían—. */
export function contentTypesParaKind(kind: unknown): string[] {
  return kind === 'imagen-o-video' ? [...TIPOS_PERMITIDOS, ...TIPOS_VIDEO] : [...TIPOS_PERMITIDOS];
}

/**
 * Prefijos de storage que el upload acepta del cliente — WHITELIST, no un valor libre: el
 * prefijo es un segmento de la ruta del blob, y dejarlo abierto permitiría escribir en
 * cualquier "carpeta" del store. `productos` (portadas y galería) y `contenido` (imágenes
 * del storefront editable, p. ej. el hero). El día del multi-tenant, el prefijo real gana el
 * `<storeId>/` por delante (§ Storage).
 */
export const PREFIJOS_UPLOAD = ['productos', 'contenido'] as const;
export type PrefijoUpload = (typeof PREFIJOS_UPLOAD)[number];

/** Para el `accept` del input de archivo. */
export const ACCEPT_IMAGENES = TIPOS_PERMITIDOS.join(',');

/**
 * El `accept` del picker de vídeo es DELIBERADAMENTE más ancho que `TIPOS_VIDEO` (`video/*`, no
 * `video/mp4,video/webm`). Un `accept` acotado deja el .mov en GRIS en el diálogo del sistema: el
 * operador no puede elegir su grabación del Mac y no recibe ninguna explicación. Con `video/*` el
 * .mov SE ELIGE y la validación contra `TIPOS_VIDEO` (en `elegir`) lo rechaza con
 * `MSG_VIDEO_NO_ADMITIDO` — el mensaje accionable en vez del silencio. La ÚNICA puerta es la
 * validación de `file.type` (un `video/quicktime` no está en `TIPOS_VIDEO`); el `accept` sólo abre
 * el picker. (Esto NO cierra el hueco del HEVC-en-mp4, que pasa por `file.type: 'video/mp4'` — ése
 * es el fix por CÓDEC declarado en el § Backlog #48.)
 */
export const ACCEPT_VIDEO = 'video/*';

/** Rechazo por CONTENEDOR no admitido (un .avi/.mkv): dice los contenedores que sí. El .mov ya entra
 *  —lo decide el CÓDEC, no el contenedor (§ lib/video-codec)—, así que no aparece como rechazado acá. */
export const MSG_VIDEO_NO_ADMITIDO =
  'Ese formato de video no se admite. Súbelo en MP4, WebM o MOV (con códec H.264).';

/** Rechazo por CÓDEC (§ lib/video-codec, § mensajeCodecRechazado). El HEVC llega de DOS orígenes —el
 *  iPhone Y la grabación de pantalla de macOS, que graba en H.265 por defecto—, así que el mensaje cubre
 *  los dos. La ruta de Mac REAL: QuickTime → Exportar como → 1080p RE-CODIFICA a H.264 (queda en .mov, que
 *  ahora se acepta porque el gate es el códec) — es lo que el mensaje viejo pedía mal (creía que daba .mp4;
 *  da .mov, y bajo el gate de contenedor eso se rechazaba). El de ProRes va al genérico. Ambos nombran la
 *  consecuencia real: el cliente vería una imagen fija. */
export const MSG_VIDEO_HEVC =
  'Ese video usa H.265 (HEVC), que Chrome y Firefox no siempre reproducen —tus clientes verían una imagen ' +
  'fija—. Conviértelo a H.264: en Mac, ábrelo en QuickTime → Archivo → Exportar como → 1080p (re-codifica ' +
  'a H.264; queda en .mov, y eso ahora se acepta). En iPhone, activa Ajustes → Cámara → Formatos → ' +
  '"Más compatible" para las próximas grabaciones.';

export const MSG_VIDEO_PRORES =
  'Ese video no está en un formato que los navegadores reproduzcan (por ejemplo ProRes). Expórtalo o ' +
  'conviértelo a H.264 (MP4) antes de subirlo.';

/** Elige el mensaje de rechazo según el fourcc que devolvió el parser: HEVC (hvc1/hev1/…) → la palanca
 *  del iPhone; el resto → el genérico de H.264. */
export function mensajeCodecRechazado(codec: string): string {
  return codec.startsWith('hv') || codec.startsWith('he') ? MSG_VIDEO_HEVC : MSG_VIDEO_PRORES;
}
