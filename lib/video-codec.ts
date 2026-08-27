// Lee el CÓDEC de vídeo de un archivo EN EL NAVEGADOR, sin transcodificar, para decidir si el visitante
// lo va a poder reproducir. El eje real es el CÓDEC, no el contenedor: un HEVC dentro de un .mp4 pasa
// cualquier check por contenedor y Chrome/Firefox no lo reproducen —el `<video>` no da error, muestra
// el póster quieto para siempre— (§ Backlog #48). Esto cierra ese hueco, y de paso deja aceptar un
// H.264-en-.mov (la grabación de pantalla del Mac) SIN abrir la puerta a ProRes: el gate es el códec.
//
// COBERTURA: la familia ISO-BMFF (mp4/mov/m4v), que es DONDE VIVE el problema (HEVC de iPhone, ProRes
// de edición). El WebM (contenedor EBML, otro formato binario) NO se parsea — se acepta por CONTENEDOR,
// porque sus códecs reales de entrada (VP8/VP9/AV1) son todos web-amigables y nadie sube un webm
// exótico. Hueco NOMBRADO, menor (§ Backlog #48).
//
// COSTO: lee sólo CABECERAS de boxes con `Blob.slice()` —nunca carga los 200 MB—. Camina los boxes de
// nivel superior saltando el payload de `mdat` (que en una grabación suele ir ANTES de `moov`), baja por
// `moov → trak → mdia → minf → stbl → stsd` y lee el fourcc de la primera sample-entry. Son ~1 KB de
// lecturas ranged, no un parser de contenedor entero: mp4box.js son ~340 KB para leer 4 caracteres.
//
// NO es una barrera de SEGURIDAD, es de CALIDAD: corre en el cliente, así que un admin decidido podría
// saltárselo —pero un admin ya puede subir basura; esto lo protege de PUBLICAR un vídeo que sus clientes
// no verían—. La puerta dura sigue siendo el token (contenedor + tamaño + pathname acotados, § el token).

export type VeredictoCodec =
  | { estado: 'ok'; codec: string } // AVC/H.264 → se reproduce en todos lados
  | { estado: 'rechazado'; codec: string } // HEVC/ProRes/otro no-universal → mensaje accionable
  | { estado: 'ilegible' }; // no se pudo leer → el llamador cae a la red del contenedor

const AVC = new Set(['avc1', 'avc3']);
const HEVC = new Set(['hvc1', 'hev1', 'hvc2', 'hev2']);
const PRORES = new Set(['ap4h', 'ap4x', 'apch', 'apcn', 'apcs', 'apco']);
// Otros fourcc de VÍDEO que un mp4/mov puede traer y que NO son universales (edición o soporte
// desparejo): MPEG-4 Part 2, VP8/VP9-en-mp4 (Safari no los reproduce ahí), AV1 (equipos viejos no),
// Dolby Vision. Se rechazan como "no universal" con el mismo mensaje genérico.
const OTRO_VIDEO = new Set(['mp4v', 'vp08', 'vp09', 'av01', 'dvh1', 'dvhe']);

type Caja = { tipo: string; ini: number; fin: number }; // ini/fin = rango del PAYLOAD (sin la cabecera)

// Lista las cajas hijas dentro de [inicio, fin), leyendo SÓLO cabeceras (16 bytes por caja). Un tamaño
// inválido corta la lista → el llamador lo lee como 'ilegible' y cae a la red del contenedor.
async function cabeceras(blob: Blob, inicio: number, fin: number): Promise<Caja[]> {
  const out: Caja[] = [];
  let off = inicio;
  while (off + 8 <= fin) {
    const dv = new DataView(await blob.slice(off, Math.min(off + 16, fin)).arrayBuffer());
    if (dv.byteLength < 8) break;
    let size = dv.getUint32(0);
    const tipo = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
    let cab = 8;
    if (size === 1) {
      // Tamaño de 64 bits: el número de JS aguanta hasta 2^53, de sobra para un archivo.
      if (dv.byteLength < 16) break;
      size = dv.getUint32(8) * 2 ** 32 + dv.getUint32(12);
      cab = 16;
    } else if (size === 0) {
      size = fin - off; // la caja llega hasta el final del rango
    }
    if (size < cab || off + size > fin) break; // tamaño imposible → cortar
    out.push({ tipo, ini: off + cab, fin: off + size });
    off += size;
  }
  return out;
}

async function primerHijo(blob: Blob, caja: Caja, tipo: string): Promise<Caja | null> {
  const hs = await cabeceras(blob, caja.ini, caja.fin);
  return hs.find((h) => h.tipo === tipo) ?? null;
}

// Baja por la cadena fija de un track y devuelve el fourcc del códec (el tipo de la 1ª sample-entry de
// `stsd`), o null si el track no la tiene (un track sin media resoluble).
async function codecDeTrak(blob: Blob, trak: Caja): Promise<string | null> {
  let caja: Caja | null = trak;
  for (const t of ['mdia', 'minf', 'stbl', 'stsd'] as const) {
    caja = await primerHijo(blob, caja, t);
    if (!caja) return null;
  }
  // Payload de `stsd`: version(1) + flags(3) + entry_count(4) = 8 bytes, luego la 1ª sample-entry, que
  // es una caja: size(4) + fourcc(4) + … El fourcc del códec está a payload+8+4.
  const dv = new DataView(await blob.slice(caja.ini + 8, caja.ini + 16).arrayBuffer());
  if (dv.byteLength < 8) return null;
  return String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
}

/**
 * Veredicto de reproducibilidad por CÓDEC para un archivo de vídeo ISO-BMFF (mp4/mov/m4v). AVC/H.264 →
 * 'ok'; HEVC/ProRes/otro no-universal → 'rechazado' con su fourcc; cualquier fallo de lectura (webm,
 * archivo raro, estructura inesperada, truncado) → 'ilegible', que el llamador trata como "pasa, con el
 * contenedor como red" (rechazar por no poder leer bloquearía archivos válidos por un parser incompleto).
 */
export async function leerCodecVideo(blob: Blob): Promise<VeredictoCodec> {
  try {
    const nivel0 = await cabeceras(blob, 0, blob.size);
    const moov = nivel0.find((c) => c.tipo === 'moov');
    if (!moov) return { estado: 'ilegible' };
    const traks = (await cabeceras(blob, moov.ini, moov.fin)).filter((c) => c.tipo === 'trak');
    for (const trak of traks) {
      const codec = await codecDeTrak(blob, trak);
      if (!codec) continue;
      if (AVC.has(codec)) return { estado: 'ok', codec };
      if (HEVC.has(codec) || PRORES.has(codec) || OTRO_VIDEO.has(codec)) return { estado: 'rechazado', codec };
      // fourcc de un track NO-vídeo (audio: `mp4a`, etc.) o desconocido → seguir buscando el de vídeo.
    }
    return { estado: 'ilegible' }; // ningún track de vídeo reconocible
  } catch {
    return { estado: 'ilegible' };
  }
}
