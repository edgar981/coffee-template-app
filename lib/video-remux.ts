// Re-envasa un .mov (H.264/AVC en contenedor QuickTime) a .mp4 EN EL NAVEGADOR, SIN re-codificar: toma el
// track de vídeo H.264 y copia sus samples tal cual a un contenedor mp4 (fragmentado, fMP4). Resuelve el
// hueco de Firefox —que no reproduce el contenedor .mov— sin pedirle al operador que convierta nada: sube
// su .mov y el navegador lo convierte solo. MEDIDO sobre el .mov real de 180 MB: ~4 s, salida `video/mp4`
// que reproduce (loadeddata OK). NO comprime —el peso sigue siendo #20, otro problema—.
//
// VIDEO-ONLY: dropea el audio A PROPÓSITO (la galería reproduce muted) → un solo track, un fMP4 simple y
// válido (init + media). mp4box entra por import DINÁMICO (~17 KB gzip) → sólo se descarga al subir un .mov,
// nunca en el bundle de quien no sube vídeo.
//
// STREAMING de la ENTRADA: el File se lee por chunks y se van appendeando —no hay una segunda copia del
// archivo—. La SALIDA sí se acumula en memoria (los segmentos juntos). El llamador ya acotó el tamaño al
// tope de galería (§ MAX_VIDEO_GALERIA_BYTES = 20 MB, con pre-chequeo generoso), así que acá nunca llega
// nada grande —la memoria del remux es ~60–90 MB, segura en cualquier móvil—. Es una conversión de
// conveniencia, no una barrera de seguridad.

// El shape de mp4box (0.5.2) que usamos. Pinneado a 0.5.2 A PROPÓSITO: el 2.x (reescritura con rolldown)
// cambió `initializeSegmentation` y su `onSegment` NO emitía media en este flujo —medido, salía el init
// solo, cero frames—. 0.5.2 está MEDIDO produciendo un .mp4 que reproduce. `initializeSegmentation()`
// devuelve el ARRAY de inits por track (acá, uno: el de vídeo).
type InfoMp4 = { videoTracks?: Array<{ id: number }> };
type ArchivoMp4 = {
  onReady: (info: InfoMp4) => void;
  onError: (e: unknown) => void;
  onSegment: (id: number, user: unknown, buffer: ArrayBuffer) => void;
  setSegmentOptions: (id: number, user: unknown, opts: { nbSamples: number }) => void;
  initializeSegmentation: () => Array<{ buffer: ArrayBuffer }>;
  start: () => void;
  appendBuffer: (data: ArrayBuffer & { fileStart: number }) => void;
  flush: () => void;
};

type ModMp4 = { createFile: () => ArchivoMp4; Log?: { error?: (...a: unknown[]) => void } };

export async function remuxMovAMp4(file: File): Promise<File> {
  const mod = (await import('mp4box')) as unknown as ModMp4;
  // mp4box loguea con `Log.error` (→ console.error) los boxes que declaran un tamaño mayor que su
  // contenedor —datos de relleno/borde al final del stream troceado; CONFIRMADO en su fuente (BoxParser,
  // "has a size … greater than its container"): NO aborta, devuelve ERR_NOT_ENOUGH_DATA y el output sale
  // completo—. Es ruido BENIGNO en la consola del OPERADOR. Se silencia SÓLO durante el remux (nuestro
  // `onError` + el guard de segmentos-vacíos es la ruta real de fallo, y sigue intacto: `Log.error` es el
  // logger interno, distinto del callback `onError`), y se restaura en el finally.
  const logErrorOriginal = mod.Log?.error;
  if (mod.Log) mod.Log.error = () => {};
  try {
    return await hacerRemux(mod.createFile(), file);
  } finally {
    if (mod.Log && logErrorOriginal) mod.Log.error = logErrorOriginal;
  }
}

async function hacerRemux(mp4: ArchivoMp4, file: File): Promise<File> {
  const segmentos: Uint8Array[] = [];
  let error: string | null = null;
  let listo = false;

  mp4.onError = (e) => { if (!error) error = String(e); };
  mp4.onSegment = (_id, _user, buffer) => { segmentos.push(new Uint8Array(buffer)); };
  mp4.onReady = (info) => {
    const vt = info.videoTracks?.[0];
    if (!vt) { error = 'sin pista de vídeo'; return; }
    // Un solo segmento con TODOS los samples (nbSamples enorme): un fMP4 de una pieza, no un stream
    // troceado. Sólo se segmenta el track de vídeo → los inits salen video-only, el audio se cae.
    mp4.setSegmentOptions(vt.id, null, { nbSamples: 1e9 });
    for (const s of mp4.initializeSegmentation()) segmentos.push(new Uint8Array(s.buffer));
    mp4.start();
    listo = true;
  };

  const reader = file.stream().getReader();
  let offset = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || error) break;
    const ab = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer & { fileStart: number };
    ab.fileStart = offset;
    offset += ab.byteLength;
    mp4.appendBuffer(ab);
  }
  mp4.flush();

  if (error) throw new Error(`No se pudo convertir el video (${error}).`);
  if (!listo || segmentos.length === 0) throw new Error('No se pudo leer el video para convertirlo.');

  const nombre = file.name.replace(/\.[^.]+$/, '') + '.mp4';
  return new File([new Blob(segmentos as BlobPart[], { type: 'video/mp4' })], nombre, { type: 'video/mp4' });
}
