'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { uploadImagen } from '@/lib/api/upload';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS } from '@/constants/upload';

// EL UPLOADER de imágenes de contenido, EXTRAÍDO de TiendaSeccionEditor para que lo compartan la
// CÁSCARA (los campos-imagen fijos del hero y de brandStory) y el RepeaterEditor (la foto de un
// ítem de galería). Antes vivía inline en la cáscara; duplicar la validación + subida en el repeater
// sería dos definiciones de lo mismo —el modo de falla de razonDelServidor/cruzoMinimo—. Se
// instancia UNA vez (en la cáscara) y se comparte hacia abajo por `pedir`, así hay un solo <input>
// y un solo `subiendo` que bloquea todo mientras una imagen viaja.
//
// Mecánica: posee el <input type=file> —el consumidor lo renderiza con `inputRef`/`alElegir`—, valida
// tipo y tamaño, sube a Blob bajo el prefijo 'contenido', y expone `subiendo` (para bloquear en el
// render) + `subiendoRef` (lectura SÍNCRONA, para el marcar-sucio que NO debe correr durante una
// subida). La url resultante se entrega por el callback `onUrl` que el consumidor pasó a `pedir`, así
// cada llamador decide qué hacer con ella: la cáscara pisa un campo del form, el repeater un campo
// del ítem. El hook no sabe nada de secciones ni de galerías.

// Las dimensiones naturales de la imagen, para que la galería reserve el alto de cada celda por su
// proporción (masonry sin salto de layout, § NosotrosGaleria). Se leen del ARCHIVO local (no de la
// red). Si el navegador no puede decodificarla, `undefined` → la galería cae a una proporción por
// defecto; nunca bloquea la subida.
export type Dims = { w: number; h: number };

async function dimsDeArchivo(file: File): Promise<Dims | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const d = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return d.w > 0 && d.h > 0 ? d : undefined;
  } catch {
    return undefined;
  }
}

export function useSubidaImagen({ onError }: { onError: (msg: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendienteRef = useRef<((url: string, dims?: Dims) => void) | null>(null);
  const subiendoRef = useRef(false);
  const [subiendo, setSubiendo] = useState(false);

  // El estado (render) y el ref (lectura síncrona) se mueven JUNTOS, como el faseRef que reemplaza.
  const marcarSubiendo = (v: boolean) => { subiendoRef.current = v; setSubiendo(v); };

  // `onUrl` recibe la url y —cuando se pudo leer— las dimensiones. La cáscara (campos-imagen fijos)
  // ignora el segundo argumento; la galería lo usa. Un callback de un solo parámetro es asignable.
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
    if (file.size > MAX_UPLOAD_BYTES) {
      onError(`La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`); return;
    }
    onError(null);
    marcarSubiendo(true);
    let url: string;
    try {
      ({ url } = await uploadImagen(file, 'contenido'));
    } catch (err) {
      marcarSubiendo(false);
      onError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
      return;
    }
    // Las dimensiones se leen del archivo local (falla suave a undefined). Va DESPUÉS de la subida
    // para no computarlas si la subida falló.
    const dims = await dimsDeArchivo(file);
    // subiendo=false ANTES del callback: el marcar-sucio del consumidor (p. ej. `cambiar` de la
    // cáscara, que un ítem de galería atraviesa vía onChange) NO corre durante una subida, así que
    // la url no se guardaría si el flag siguiera en true al entregarla. El callback es síncrono, así
    // que no hay ventana visible sin "Subiendo…".
    marcarSubiendo(false);
    onUrl(url, dims);
  };

  return { pedir, subiendo, subiendoRef, inputRef, alElegir };
}
