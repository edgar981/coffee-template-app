'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Paperclip, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { formatFecha } from '@/lib/format-fecha';
import {
  esImagen, formatearTamano, estadoComprobante, nombreArchivo,
  puedeDecidirse, validarArchivoComprobante,
} from '@/lib/comprobante';
import { ACCEPT_COMPROBANTE, MAX_COMPROBANTE_MB } from '@/constants/comprobante';
import type { Comprobante } from '@/types/comprobante';

// ─── La evidencia, en pantalla ───────────────────────────────────────────────
// Un comprobante es una FILA con su propio estado, no un campo del pago: puede
// existir sin Payment (el cliente mandó la foto, nadie verificó) y el Payment
// puede existir sin él (efectivo). Por eso tiene badge propio y acciones propias.

/**
 * Un soporte. Imagen → miniatura clickeable (lightbox). PDF → chip de documento
 * que abre en PESTAÑA NUEVA.
 *
 * La asimetría no es estética: un PDF dentro de un `<img>` o de un lightbox no
 * falla ruidosamente, se queda en blanco — y el operador concluye que el
 * comprobante llegó roto cuando el archivo está perfecto. El navegador ya tiene
 * un visor de PDF bueno; embeber uno propio sería competir con él y perder.
 */
export function ComprobanteVista({ comprobante, onAmpliar, acciones }: {
  comprobante: Comprobante;
  /** Sólo para imágenes: abre el lightbox compartido. */
  onAmpliar: (url: string, alt: string) => void;
  /** Verificar / Rechazar. Se omite donde el comprobante sólo se muestra. */
  acciones?: React.ReactNode;
}) {
  const badge  = estadoComprobante(comprobante.estado);
  const imagen = esImagen(comprobante.content_type);
  const nombre = nombreArchivo(comprobante.url);
  const peso   = formatearTamano(comprobante.size_bytes);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5">
      {imagen ? (
        <button
          type="button"
          onClick={() => onAmpliar(comprobante.url, `Comprobante ${nombre}`)}
          title="Ver en grande"
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image src={comprobante.url} alt={`Comprobante ${nombre}`} fill sizes="56px" className="object-cover" />
        </button>
      ) : (
        // Chip de documento: nombre + peso, y sale del admin al visor del
        // navegador. `rel="noopener"` porque abre en otra pestaña.
        <a
          href={comprobante.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en una pestaña nueva"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block max-w-[11rem] truncate text-xs font-medium">{nombre}</span>
            <span className="block text-[11px] text-muted-foreground">PDF · {peso}</span>
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </a>
      )}

      <div className="min-w-0 flex-1">
        <StatusBadge tone={badge.tono} label={badge.etiqueta} title={badge.detalle} />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {imagen ? `${peso} · ` : ''}
          {comprobante.subido_por_nombre
            ? `Subido por ${comprobante.subido_por_nombre}`
            : 'Subido'} el {formatFecha(comprobante.createdAt)}
        </p>
        {/* El veredicto, con quién y cuándo — es el dato de auditoría que hace
            útil a la tabla, así que se muestra en vez de quedarse en la fila. */}
        {!puedeDecidirse(comprobante.estado) && comprobante.verificado_at && (
          <p className="text-[11px] text-muted-foreground">
            {comprobante.estado === 'VERIFICADO' ? 'Verificado' : 'Rechazado'}
            {comprobante.verificado_por_nombre ? ` por ${comprobante.verificado_por_nombre}` : ''}
            {' '}el {formatFecha(comprobante.verificado_at)}
          </p>
        )}
        {comprobante.notas_verificacion && (
          <p className="mt-0.5 text-[11px] italic text-muted-foreground">
            {comprobante.notas_verificacion}
          </p>
        )}
      </div>

      {acciones && <div className="flex shrink-0 flex-wrap gap-1.5">{acciones}</div>}
    </div>
  );
}

/**
 * El control de adjuntar. Valida con la MISMA función que el endpoint
 * (`validarArchivoComprobante`) para no gastar una subida de 4 MB que el
 * servidor va a rechazar — pero la que MANDA sigue siendo la del servidor.
 *
 * `onArchivo` recibe un archivo ya validado. Quién lo sube y cuándo lo decide
 * el llamador: el detalle lo manda de una, y el modal de pago espera a que el
 * Payment exista (primero la plata, después la evidencia).
 */
export function SelectorComprobante({ onArchivo, disabled, label = 'Adjuntar comprobante', title }: {
  onArchivo: (file: File) => void;
  disabled?: boolean;
  label?: string;
  /** Formatos y tope, cuando la caja está colapsada y no hay sitio para la línea. */
  title?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // El input se limpia SIEMPRE, incluso al fallar la validación: sin esto,
    // volver a elegir el mismo archivo no dispara `change` y el operador cree
    // que el botón dejó de responder.
    e.target.value = '';
    if (!file) return;

    const problema = validarArchivoComprobante({ type: file.type, size: file.size, name: file.name });
    if (problema) { toast.error(problema); return; }

    onArchivo(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_COMPROBANTE}
        onChange={elegir}
        className="hidden"
      />
      <Button
        type="button" variant="outline" size="sm" className="gap-1.5"
        disabled={disabled}
        title={title}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-3.5 w-3.5" /> {label}
      </Button>
    </>
  );
}

/**
 * El comprobante que se está verificando, dentro del modal de Registrar Pago.
 *
 * Es la MISMA entidad que `ComprobanteVista` pero en su forma mínima: sin badge
 * (su estado es obvio — se está verificando), sin acciones (la acción es el pago)
 * y sin lightbox (ampliar es del detalle, que quedó abierto detrás). Lo que hace
 * es responder "¿de cuál soporte estamos hablando?" antes de que el operador
 * confirme una plata.
 */
export function ComprobanteEnVerificacion({ comprobante }: { comprobante: Comprobante }) {
  const imagen = esImagen(comprobante.content_type);
  const nombre = nombreArchivo(comprobante.url);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
      {imagen ? (
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
          <Image src={comprobante.url} alt={`Comprobante ${nombre}`} fill sizes="48px" className="object-cover" />
        </span>
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium">Verificando este comprobante</p>
        <p className="truncate text-[11px] text-muted-foreground">{nombre}</p>
        <p className="text-[11px] text-muted-foreground">
          {imagen ? 'Imagen' : 'PDF'} · {formatearTamano(comprobante.size_bytes)}
        </p>
      </div>
    </div>
  );
}

/** La línea que dice qué se acepta. Va junto al selector, no dentro de un tooltip. */
export function AyudaComprobante() {
  return (
    <p className="text-[11px] text-muted-foreground">
      JPG, PNG, WebP o PDF · máx. {MAX_COMPROBANTE_MB} MB
    </p>
  );
}

/** Estado local del lightbox, para no repetirlo en cada consumidor. */
export function useLightboxComprobante() {
  const [abierto, setAbierto] = useState<{ src: string; alt: string } | null>(null);
  return {
    abierto,
    ampliar: (src: string, alt: string) => setAbierto({ src, alt }),
    cerrar:  () => setAbierto(null),
  };
}
