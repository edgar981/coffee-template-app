'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { subirDirecto } from '@/lib/api/upload';
import { leerCodecVideo } from '@/lib/video-codec';
import {
  MAX_SUBIDA_DIRECTA_BYTES, MAX_SUBIDA_DIRECTA_MB, MAX_VIDEO_GALERIA_BYTES, TIPOS_PERMITIDOS,
  CONTENEDORES_REMUXEABLES, mensajeCodecRechazado, MSG_VIDEO_GALERIA_LARGO, type KindUpload,
} from '@/constants/upload';

// EL UPLOADER de imágenes de contenido, compartido por la cáscara (campos-imagen fijos) y el
// RepeaterEditor (foto por ítem). Sube DIRECTO a Blob (§ subirDirecto): el archivo va del navegador
// a Blob, sin el límite de 4.5 MB del serverless, hasta 200 MB. Expone `progreso` (0–100) para la
// barra y `subiendo` para bloquear los DISPARADORES de subida (no el formulario: una subida de
// minutos no puede congelar la edición — el texto se sigue editando y autoguardando).
//
// Mecánica: posee el <input type=file> (el consumidor lo renderiza con inputRef/alElegir), valida
// tipo y tamaño, sube con progreso, y entrega la url (y las dims para el masonry) por el callback
// `onUrl`. `subiendoRef` es la lectura SÍNCRONA para ordenar el flush post-subida.

export type Dims = { w: number; h: number };

async function dimsDeArchivo(file: File): Promise<Dims | undefined> {
  if (file.type.startsWith('video/')) return dimsDeVideo(file);
  try {
    const bitmap = await createImageBitmap(file);
    const d = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return d.w > 0 && d.h > 0 ? d : undefined;
  } catch {
    return undefined;
  }
}

// Las dimensiones de un VÍDEO salen de `videoWidth`/`videoHeight` tras `loadedmetadata` —del ELEMENTO
// vídeo, no del póster (el póster puede venir recortado; la celda la gobierna el vídeo)—. FALLA SUAVE
// como la imagen: si la metadata no llega (error, o un timeout de 8 s por si el archivo cuelga), se
// resuelve `undefined` → el ítem se crea SIN dims y el masonry usa su fallback 4/3. Nunca bloquea la
// subida. `preload='metadata'` carga sólo la metadata, no el vídeo entero.
function dimsDeVideo(file: File): Promise<Dims | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let listo = false;
    const terminar = (d: Dims | undefined) => {
      if (listo) return;
      listo = true;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    const t = setTimeout(() => terminar(undefined), 8000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { clearTimeout(t); terminar(v.videoWidth > 0 && v.videoHeight > 0 ? { w: v.videoWidth, h: v.videoHeight } : undefined); };
    v.onerror = () => { clearTimeout(t); terminar(undefined); };
    v.src = url;
  });
}

export function useSubidaImagen({ onError }: { onError: (msg: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendienteRef = useRef<((url: string, dims?: Dims) => void) | null>(null);
  const subiendoRef = useRef(false);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null); // 0–100 mientras sube; null si no

  const marcarSubiendo = (v: boolean) => { subiendoRef.current = v; setSubiendo(v); };

  const pedir = (onUrl: (url: string, dims?: Dims) => void) => {
    pendienteRef.current = onUrl;
    inputRef.current?.click();
  };

  const alElegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const onUrl = pendienteRef.current;
    pendienteRef.current = null;
    if (!file || !onUrl) return;
    if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
      onError('Formato no admitido. Usa JPG, PNG o WebP.'); return;
    }
    if (file.size > MAX_SUBIDA_DIRECTA_BYTES) {
      onError(`La imagen pesa ${(file.size / (1024 * 1024)).toFixed(0)} MB y el máximo es ${MAX_SUBIDA_DIRECTA_MB} MB.`); return;
    }
    onError(null);
    marcarSubiendo(true);
    setProgreso(0);
    let url: string;
    try {
      ({ url } = await subirDirecto(file, { carpeta: 'contenido', onProgress: setProgreso }));
    } catch (err) {
      // Falla a mitad: el consumidor NO recibe url, así que el ítem/campo queda con su valor VIEJO
      // (o no se crea, si era un "Agregar"): se pierde la subida, no el trabajo. El error invita a
      // reintentar.
      marcarSubiendo(false);
      setProgreso(null);
      onError(err instanceof Error ? err.message : 'No se pudo subir la imagen. Reintenta.');
      return;
    }
    const dims = await dimsDeArchivo(file);
    // subiendo=false ANTES del callback: el flush del consumidor corre con la url ya lista.
    marcarSubiendo(false);
    setProgreso(null);
    onUrl(url, dims);
  };

  // ── ELEGIR / SUBIR desacoplados (para el alta de VÍDEO, § galería) ─────────────────────────────
  // El camino de arriba (pedir/alElegir/inputRef) es pick+subir ATÓMICO y NO se toca —lo usan las
  // imágenes en 5 sitios—. Lo de acá es ADITIVO: un SEGUNDO input propio y sus métodos, para el flujo
  // "elegir los dos (vídeo + póster) y subir al final" (así cancelar el póster no deja un vídeo
  // huérfano — no hay nada subido hasta que están los dos, § la decisión del alta).
  const inputHoldRef = useRef<HTMLInputElement>(null);
  const holdRef = useRef<{ onFile: (f: File) => void; tipos: readonly string[]; msgError: string } | null>(null);

  /** Abre el picker, valida tipo/tamaño, y ENTREGA el File sin subirlo (lo retiene el consumidor). */
  const elegir = (onFile: (f: File) => void, { tipos, accept, msgError }: { tipos: readonly string[]; accept: string; msgError: string }) => {
    holdRef.current = { onFile, tipos, msgError };
    const el = inputHoldRef.current;
    if (el) { el.accept = accept; el.click(); }
  };

  const alElegirHold = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const h = holdRef.current;
    holdRef.current = null;
    if (!file || !h) return;
    // El .mov (remuxeable) se ACEPTA aunque no esté en `h.tipos`: se re-envasa a .mp4 antes de subir
    // (§ subirVideoYPoster → lib/video-remux).
    const remuxeable = (CONTENEDORES_REMUXEABLES as readonly string[]).includes(file.type);
    if (!(h.tipos as readonly string[]).includes(file.type) && !remuxeable) { onError(h.msgError); return; }
    // TOPE DE TAMAÑO por caso. Un vídeo de galería tope a 20 MB —loops cortos, § MAX_VIDEO_GALERIA_BYTES—.
    if (remuxeable) {
      // .mov: el tope EXACTO va post-remux (lo que se sube, § subirVideoYPoster); acá sólo un pre-chequeo
      // generoso (1.5×) para no gastar el remux en un archivo obviamente muy grande (el caso de 180 MB).
      if (file.size > MAX_VIDEO_GALERIA_BYTES * 1.5) { onError(MSG_VIDEO_GALERIA_LARGO); return; }
    } else if (file.type.startsWith('video/')) {
      // mp4/webm: lo que se elige es lo que se sube → el tope de galería exacto.
      if (file.size > MAX_VIDEO_GALERIA_BYTES) { onError(MSG_VIDEO_GALERIA_LARGO); return; }
    } else if (file.size > MAX_SUBIDA_DIRECTA_BYTES) {
      // imágenes: el tope de la subida directa.
      onError(`El archivo pesa ${(file.size / (1024 * 1024)).toFixed(0)} MB y el máximo es ${MAX_SUBIDA_DIRECTA_MB} MB.`); return;
    }
    // GATE DE CÓDEC (sólo vídeo), ANTES del remux: el contenedor no dice si el visitante lo verá —un
    // HEVC-en-mp4 pasa el check de contenedor y medio navegador no lo reproduce (§ lib/video-codec)—. AVC
    // pasa; HEVC/ProRes se rechazan con su mensaje SIN intentar convertir (el remux copia el códec, no lo
    // arregla). ILEGIBLE (archivo raro, webm) → se DEJA pasar con el contenedor como red. Lee sólo
    // cabeceras (rápido, aun en 250 MB), antes de retener el File.
    if (file.type.startsWith('video/')) {
      const v = await leerCodecVideo(file);
      if (v.estado === 'rechazado') { onError(mensajeCodecRechazado(v.codec)); return; }
    }
    onError(null);
    h.onFile(file); // HOLD: NO sube — el consumidor decide cuándo (§ subir de abajo)
  };

  /** Sube un File YA elegido (con su kind) y devuelve url + dims. Gestiona subiendo/progreso; el
   *  LABEL del paso ("póster"/"vídeo") lo pone el consumidor. Lanza si falla (el consumidor limpia). */
  const subir = async (file: File, { kind }: { kind: KindUpload }): Promise<{ url: string; dims?: Dims }> => {
    marcarSubiendo(true);
    setProgreso(0);
    try {
      const { url } = await subirDirecto(file, { carpeta: 'contenido', kind, onProgress: setProgreso });
      const dims = await dimsDeArchivo(file);
      return { url, dims };
    } finally {
      marcarSubiendo(false);
      setProgreso(null);
    }
  };

  return { pedir, subiendo, subiendoRef, progreso, inputRef, alElegir, inputHoldRef, alElegirHold, elegir, subir };
}
