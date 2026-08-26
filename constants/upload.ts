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

/** Formatos de VÍDEO web (H.264 en mp4, VP8/9 en webm). Lista aparte —un vídeo en un `<img>`/
 *  `next/image` no falla ruidoso, se queda en blanco—, NUNCA se amplía la de imágenes. MOV/HEVC
 *  quedan fuera (medio navegador no los reproduce): se rechazan con mensaje accionable en el cliente. */
export const TIPOS_VIDEO = ['video/mp4', 'video/webm'] as const;

/**
 * El "kind" que el cliente declara al pedir un token de subida directa (§ subirDirecto). Acota qué
 * `allowedContentTypes` firma el token: 'imagen' (portadas, hero, fotos de galería) o 'imagen-o-video'
 * (el slot de vídeo de la galería). Es una de DOS listas CONOCIDAS —nunca un comodín ni los tipos que
 * mande el cliente—, así que un token nunca sirve para "cualquier cosa".
 */
export const KINDS_UPLOAD = ['imagen', 'imagen-o-video'] as const;
export type KindUpload = (typeof KINDS_UPLOAD)[number];

/** Mapea un kind (posiblemente basura del cliente) a su lista de content-types. Un valor DESCONOCIDO
 *  cae a sólo-imágenes: lo más restrictivo, nunca a video por accidente. */
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

/** Mensaje ACCIONABLE al rechazar un formato de vídeo no admitido (el .mov de una grabación del Mac
 *  y el HEVC del iPhone son los casos). Dice QUÉ hacer y CÓMO, con la salida concreta —un "formato
 *  no admitido" sin la ruta es justo lo que esto arregla—. */
export const MSG_VIDEO_NO_ADMITIDO =
  'Sube el video en MP4 o WebM. Para convertir un .mov en Mac: ábrelo en QuickTime → Archivo → ' +
  'Exportar como → 1080p, que lo guarda en MP4. Desde iPhone, compártelo con la opción "Más compatible".';
