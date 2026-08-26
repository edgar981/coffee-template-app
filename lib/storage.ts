import { put as blobPut, del as blobDel } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { PREFIJOS_UPLOAD } from '@/constants/upload';

// ─── Adaptador de storage de archivos ────────────────────────────────────────
// LA única frontera con el proveedor de blobs. Ningún otro archivo del repo
// importa `@vercel/blob`: la elección de proveedor es REVISABLE (R2 es candidato
// al pasar a multitenant) y el costo del cambio debe quedarse en "reimplementar
// este archivo", nunca en tocar los call sites. Por eso la interfaz de acá abajo
// es propia y mínima —`put` / `delete` / `emitirTokenSubida`, `{ url }` como
// única salida— y no expone ni un tipo del SDK.
//
// NOTA — la SUBIDA DIRECTA (client upload) suma una CARA CLIENTE a esta frontera:
// `@vercel/blob/client` tiene `upload` (navegador) además de `handleUpload`
// (server, acá). `handleUpload` se queda en este archivo (el server importa el
// SDK sólo desde acá); el `upload` del navegador vivirá en su propio helper
// cliente (commit 2). Al cambiar de proveedor se reimplementan las DOS caras.
//
// El store es PÚBLICO por decisión: cualquiera con el link lee el archivo. Es lo
// correcto para imágenes de catálogo (van a un storefront abierto) y es lo que
// permite que `next/image` las optimice sin reenviar credenciales. NO usar este
// adaptador para documentos, adjuntos ni datos de clientes sin revisar antes esa
// decisión — ver la sección de CLAUDE.md.

/** Salida del adaptador: la URL pública y nada más. */
export interface PutResult {
  url: string;
}

export interface PutOptions {
  /**
   * Carpeta lógica dentro del store. Es el futuro SCOPE POR TIENDA: cuando
   * exista el modelo de tenant, el prefijo pasa a ser `<storeId>/productos` y
   * los call sites siguen sin saber nada del proveedor. Por eso es parámetro
   * con default y no una constante incrustada en cada llamada.
   */
  prefix?: string;
  /** Nombre original; si se omite se usa el del File. */
  filename?: string;
  contentType?: string;
}

export const DEFAULT_PREFIX = 'productos';

/**
 * Prefijo de AISLAMIENTO POR ENTORNO. A diferencia de Neon, el store de Blob es
 * uno solo para todos los entornos: no hay ramas. El aislamiento se hace acá,
 * anteponiendo `dev/` a todo lo que no sea la producción de Vercel — así los
 * uploads de prueba (local y previews) viven bajo `dev/productos/` y limpiarlos
 * jamás puede tocar un blob real.
 *
 * Solo `VERCEL_ENV === 'production'` cuenta como producción, misma condición que
 * ya usa el `migrate deploy` del build. Es deliberadamente conservador: sin esa
 * variable (local, CI, un `next start` cualquiera) se asume NO producción, de
 * modo que el error posible es ensuciar `dev/`, nunca el prefijo real.
 */
export function envPrefix(env: NodeJS.ProcessEnv = process.env): string {
  return env.VERCEL_ENV === 'production' ? '' : 'dev/';
}

/** Deja el nombre en algo seguro para una ruta, conservando la extensión. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo';
  const limpio = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // sin tildes
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '');
  return limpio || 'archivo';
}

/**
 * Ruta final dentro del store: `[dev/]<prefix>/<archivo>`. El sufijo aleatorio
 * que hace única la URL lo agrega el proveedor (`addRandomSuffix`), no esta
 * función — ver la nota sobre inmutabilidad en `put`.
 */
export function buildPathname(
  filename: string,
  prefix: string = DEFAULT_PREFIX,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${envPrefix(env)}${prefix}/${sanitizeFilename(filename)}`;
}

/** Host de los blobs del proveedor actual — detalle privado del adaptador. */
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

/**
 * ¿Esta URL la administra este adaptador? Sirve de guarda del borrado: las
 * imágenes estáticas de `public/` (rutas relativas tipo `/images/x.jpg`) y
 * cualquier URL externa NO son nuestras y no se tocan. La regla de inmutabilidad
 * de `public/` vive en CLAUDE.md; esto la hace imposible de violar por accidente
 * desde el admin.
 */
export function isManaged(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;   // relativa o basura → no es nuestra
  }
}

/**
 * ¿Este entorno tiene DERECHO a borrar este blob?
 *
 * Producción borra sin restricción de prefijo: sus blobs son suyos. Cualquier
 * otro entorno solo puede borrar bajo su propio `dev/`; un blob del prefijo real
 * se trata como si no fuera nuestro (no-op).
 *
 * El motivo NO es teórico. La base `development` se re-crea por reset desde
 * `production`, así que después de cada reset las filas de dev apuntan a los
 * blobs REALES que producción está sirviendo. Sin esta guarda, probar un
 * reemplazo de imagen en local dispara el borrado del `PATCH` sobre esa URL
 * heredada y tumba la imagen del catálogo en vivo. El aislamiento de `put` (que
 * escribe en `dev/`) no cubre este caso: lo que se borra no es lo que subimos,
 * es lo que vino en la copia de la base.
 *
 * El `dev/` sale de `envPrefix`, no de un literal aparte, para que la ruta que
 * se escribe y la que se permite borrar no puedan divergir.
 */
export function isDeletable(url: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isManaged(url)) return false;
  const prefix = envPrefix(env);
  if (!prefix) return true;                       // producción
  return new URL(url).pathname.startsWith(`/${prefix}`);
}

/**
 * ¿El pathname que el cliente propone para una SUBIDA DIRECTA es aceptable?
 *
 * En la subida directa el archivo NO pasa por el server, así que este es el único
 * lugar donde se acota DÓNDE puede escribir el token. Exige exactamente
 * `[dev/]<prefijo>/<archivo>`:
 *  - el segmento `dev/` DEBE coincidir con el del entorno (`envPrefix`) — así una
 *    subida de dev no puede aterrizar en el prefijo de producción, ni al revés
 *    (mismo aislamiento que `put`/`isDeletable`, § Storage);
 *  - `<prefijo>` ∈ la whitelist (`productos` | `contenido`), no una carpeta libre;
 *  - `<archivo>` es un solo segmento saneado (sin `/`, sin `..`): nada de subir
 *    a una ruta anidada o escaparse con traversal.
 *
 * El sufijo aleatorio que hace única la URL lo agrega Blob al subir
 * (`addRandomSuffix`), así que acá se valida el pathname BASE, sin el sufijo.
 */
export function pathnameSubidaValido(pathname: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const m = pathname.match(/^(dev\/)?([^/]+)\/([^/]+)$/);
  if (!m) return false;
  const [, dev, prefijo, archivo] = m;
  if ((dev ?? '') !== envPrefix(env)) return false;                        // aislamiento por entorno
  if (!(PREFIJOS_UPLOAD as readonly string[]).includes(prefijo)) return false; // prefijo permitido
  if (archivo.includes('..') || archivo !== sanitizeFilename(archivo)) return false; // sin traversal
  return true;
}

export const storage = {
  /**
   * Emite el TOKEN de una subida directa (client upload). Envuelve `handleUpload`
   * del SDK para que el import del proveedor no salga de este archivo; el
   * `token` (BLOB_READ_WRITE_TOKEN) lo inyecta el SDK por convención.
   *
   * La AUTORIZACIÓN vive en el `onBeforeGenerateToken` que pasa el route (sesión,
   * rol, pathname): este adaptador no conoce `auth`. Lo que devuelva ese callback
   * —`allowedContentTypes`, `maximumSizeInBytes`, `validUntil`— queda CODIFICADO
   * en el token y Blob lo impone en la subida.
   */
  emitirTokenSubida(opts: Omit<Parameters<typeof handleUpload>[0], 'token'>) {
    return handleUpload(opts);
  },

  /**
   * Sube un archivo y devuelve su URL pública.
   *
   * `addRandomSuffix: true` cumple de fábrica la regla del repo de que el nombre
   * lleve hash automático: dos subidas del mismo `logo.png` producen URLs
   * distintas, así que la URL es una clave de caché inmutable y el navegador o
   * el optimizador de Next nunca sirven contenido viejo bajo una URL conocida.
   */
  async put(file: File | Blob, opts: PutOptions = {}): Promise<PutResult> {
    const filename = opts.filename
      ?? (file instanceof File ? file.name : 'archivo');
    const pathname = buildPathname(filename, opts.prefix ?? DEFAULT_PREFIX);

    const { url } = await blobPut(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: opts.contentType ?? (file.type || undefined),
    });

    return { url };
  },

  /**
   * Borra un archivo por su URL. Dos guardas, y ambas son no-op (nunca lanzan):
   *
   * 1. La URL no la administra este adaptador (`isManaged`) — una estática de
   *    `public/` o una externa. No-op silencioso: es el caso normal de editar un
   *    producto que todavía apunta a `/images/*.webp`.
   * 2. La administra, pero este entorno no puede tocarla (`isDeletable`): un
   *    entorno de dev intentando borrar un blob del prefijo de producción. Eso
   *    SÍ se loguea — no es rutina, es la señal de que la base local trae URLs
   *    heredadas de un reset desde production.
   */
  async delete(url: string): Promise<void> {
    if (!isManaged(url)) return;
    if (!isDeletable(url)) {
      console.warn(
        `[storage] borrado OMITIDO: ${url} está fuera del prefijo "${envPrefix()}" de este entorno. ` +
        'Suele significar que la base local hereda blobs de producción tras un reset.',
      );
      return;
    }
    await blobDel(url);
  },
};
