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

/** Contenedores de VÍDEO que se SUBEN (y que el token firma): mp4 y webm. El .mov (`video/quicktime`) NO
 *  está acá porque **nunca se sube como .mov**: se re-envasa a .mp4 en el navegador antes de subir
 *  (§ lib/video-remux, § CONTENEDORES_REMUXEABLES). Firefox no reproduce el contenedor .mov, así que
 *  guardarlo dejaría al visitante de Firefox viendo el póster fijo —por eso se convierte, no se guarda—.
 *  El WebM no se parsea (EBML, otro formato) y pasa por contenedor: sus códecs reales de entrada
 *  (VP8/9/AV1) son todos web-amigables. */
export const TIPOS_VIDEO = ['video/mp4', 'video/webm'] as const;

/** Contenedores que se ACEPTAN en el picker pero NO se suben tal cual: se re-envasan a .mp4 en el
 *  navegador (§ lib/video-remux) y se sube el .mp4. Hoy sólo el .mov (QuickTime con H.264): resuelve el
 *  hueco de Firefox sin pedirle al operador que convierta nada. El token nunca firma estos tipos —el .mov
 *  no llega a Blob—; el gate de códec los revisa igual (un .mov con HEVC se rechaza, el remux no arregla
 *  un códec). */
export const CONTENEDORES_REMUXEABLES = ['video/quicktime'] as const;

/** Tope de peso para un vídeo de GALERÍA. NO es una limitación arbitraria: una galería de finca son loops
 *  CORTOS, no un documental —es la forma del contenido—, y es lo que hace que un cliente en MÓVIL lo vea
 *  (166 MB tardan minutos; 20 MB cargan en segundos). Comprimir no resolvería lo que duele: 3 minutos aun
 *  comprimidos siguen siendo ~87 MB (medido) — la DURACIÓN manda, no el bitrate. El tope aplica a lo que se
 *  SUBE (post-remux). El de remux de 250 MB se retiró: con este tope, al remux nunca le llega nada grande
 *  (§ useSubidaImagen: pre-chequeo del original), así que su riesgo de memoria desaparece. */
export const MAX_VIDEO_GALERIA_BYTES = 20 * 1024 * 1024;

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
 *  CONTENEDOR a mp4/webm (+ imágenes) —NO quicktime: el .mov se re-envasa a .mp4 antes de subir, así que
 *  nunca llega a Blob como .mov (§ TIPOS_VIDEO, § lib/video-remux)—, más tamaño + pathname; el CÓDEC lo
 *  filtra el cliente antes de subir (§ lib/video-codec), que es un gate de CALIDAD, no de seguridad —un
 *  admin ya puede subir basura; el gate lo protege de PUBLICAR un vídeo que sus clientes no verían—. */
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
 * El `accept` del picker de vídeo es DELIBERADAMENTE `video/*` (no `video/mp4,video/webm`). Un `accept`
 * acotado deja el .mov en GRIS en el diálogo del sistema. Con `video/*` el .mov SE ELIGE, se re-envasa a
 * .mp4 (§ lib/video-remux) y se sube; un contenedor NO admitido (.avi/.mkv) recibe `MSG_VIDEO_NO_ADMITIDO`.
 */
export const ACCEPT_VIDEO = 'video/*';

/** Rechazo por CONTENEDOR no admitido (.avi, .mkv, …). MP4, WebM y MOV se aceptan (el .mov se convierte a
 *  .mp4 solo, § lib/video-remux), así que no hay conversión que pedir para ésos. */
export const MSG_VIDEO_NO_ADMITIDO = 'Ese formato de video no se admite. Súbelo en MP4, WebM o MOV.';

/** Rechazo por CÓDEC HEVC (§ lib/video-codec, § mensajeCodecRechazado). NO promete una conversión: no hay
 *  una práctica que el operador logre (iMovie no funcionó, QuickTime da .mov) y el remux no arregla el
 *  códec —copia el HEVC a .mp4 y sigue sin reproducir—. Dice lo que SÍ se puede hacer: grabar en "Más
 *  compatible" (H.264) la próxima vez. El caso común es el iPhone. */
export const MSG_VIDEO_HEVC =
  'Ese video usa H.265 (HEVC), que Chrome y Firefox no siempre reproducen —tus clientes verían una imagen ' +
  'fija—. Para las próximas grabaciones, en iPhone activa Ajustes → Cámara → Formatos → "Más compatible", ' +
  'que las guarda en H.264.';

/** Rechazo por ProRes u otro códec de edición. Viene de software profesional (Final Cut, Premiere), que
 *  SÍ exporta H.264 —a diferencia del HEVC, acá hay ruta—; el mensaje no nombra una herramienta concreta. */
export const MSG_VIDEO_PRORES =
  'Ese video no está en un formato que los navegadores reproduzcan (por ejemplo ProRes). Súbelo en H.264 (MP4).';

/** Rechazo por TAMAÑO de un vídeo de galería (§ MAX_VIDEO_GALERIA_BYTES). Pide un clip corto Y dice el
 *  orden de magnitud —el operador necesita saber QUÉ es corto—, con el porqué (que cargue en el móvil). */
export const MSG_VIDEO_GALERIA_LARGO =
  'Ese video pesa demasiado para la galería. Súbelo como un clip corto —unos 15 a 30 segundos— para que ' +
  'cargue rápido en el celular de tus clientes.';

/** Elige el mensaje de rechazo según el fourcc que devolvió el parser: HEVC (hvc1/hev1/…) → la palanca
 *  del iPhone; el resto → el genérico de H.264. */
export function mensajeCodecRechazado(codec: string): string {
  return codec.startsWith('hv') || codec.startsWith('he') ? MSG_VIDEO_HEVC : MSG_VIDEO_PRORES;
}
