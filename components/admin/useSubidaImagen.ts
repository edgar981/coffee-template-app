'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { subirDirecto } from '@/lib/api/upload';
import { MAX_SUBIDA_DIRECTA_BYTES, MAX_SUBIDA_DIRECTA_MB, TIPOS_PERMITIDOS } from '@/constants/upload';

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

  return { pedir, subiendo, subiendoRef, progreso, inputRef, alElegir };
}
