'use client';

import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// ─── Lightbox de inspección ──────────────────────────────────────────────────
// Ver una miniatura en grande, nada más: sin zoom, sin navegar entre imágenes,
// sin librerías. Se monta sobre el Dialog que el admin ya usa, así que cerrar
// con Esc, con clic afuera y con la X viene de Radix — no hay manejo de teclado
// propio que pueda desincronizarse del resto de los modales.

interface ImageLightboxProps {
  /** URL a mostrar; `null` mantiene el overlay cerrado. */
  src: string | null;
  /** Texto para el lector de pantalla y el alt de la imagen. */
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  // Un object URL local (`blob:`) NO puede pasar por el optimizador de imágenes
  // —vive solo en esta pestaña, el servidor no lo puede leer—, así que las
  // pendientes van en `img` crudo y las guardadas por `next/image`. Es la misma
  // razón por la que el preview del formulario no usa next/image.
  const esLocal = src?.startsWith('blob:') ?? false;

  return (
    <Dialog open={!!src} onOpenChange={o => { if (!o) onClose(); }}>
      {/* La X la renderiza el propio DialogContent, y acá queda sobre la IMAGEN,
          no sobre el fondo del diálogo: sin tratamiento propio hereda el color de
          texto del tema y desaparece en cuanto la foto tiene esa misma
          luminosidad — el caso real es el empaque negro, que en tema claro se
          come una X oscura. Se le da su propia pastilla con tokens (`background`
          translúcido + `foreground`), que invierte junto con el tema: en claro es
          chip claro con aspa oscura, en oscuro chip oscuro con aspa clara. Así el
          contraste lo garantiza el chip y no lo que haya detrás.
          El selector apunta al botón que inyecta DialogContent — el contenido de
          este overlay es solo la imagen, así que no hay otro `button` que tocar. */}
      <DialogContent
        className="max-w-3xl border-none bg-transparent p-0 shadow-none
          [&>button]:right-2 [&>button]:top-2 [&>button]:rounded-full
          [&>button]:bg-background/80 [&>button]:p-2 [&>button]:text-foreground
          [&>button]:opacity-100 [&>button]:shadow-lg [&>button]:backdrop-blur-sm
          [&>button]:ring-1 [&>button]:ring-border
          [&>button]:transition-colors hover:[&>button]:bg-background"
      >
        {/* Radix exige un título accesible; acá el contenido es la imagen. */}
        <DialogTitle className="sr-only">{alt || 'Vista ampliada de la imagen'}</DialogTitle>
        {src && (
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-background">
            {esLocal ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ''} className="h-full w-full object-contain" />
            ) : (
              <Image
                src={src}
                alt={alt ?? ''}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-contain"
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Clases de una miniatura INSPECCIONABLE. Se usa junto al `button` que envuelve
 * el thumbnail: cursor de lupa y anillo de foco, para que "esto se puede abrir"
 * se note con el mouse y con el teclado.
 */
export const THUMB_INSPECCIONABLE =
  'cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
