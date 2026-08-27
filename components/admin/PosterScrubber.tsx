'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';

// Captura el PÓSTER de un frame del vídeo LOCAL, antes de subir nada: un scrubber sobre el `<video>` por
// objectURL + `canvas.toBlob()`. Así el alta pasa de DOS archivos a UNO —eliges el vídeo, mueves el
// scrubber, el frame es el póster— con "subir una imagen propia" como ALTERNATIVA, no camino principal.
//
// MEDIDO en el panel (Chrome 148): un objectURL LOCAL es same-origin, así que el canvas NO se contamina
// (`getImageData`/`toBlob` funcionan) — el taint sólo aparece con vídeo remoto sin CORS, no con el
// archivo del propio operador. El frame sale con las DIMS DEL VÍDEO (`videoWidth`/`videoHeight`), no del
// elemento en pantalla. El póster capturado entra al MISMO camino (poster primero, § subirVideoYPoster),
// así que el orden anti-huérfano de 200 MB no cambia.
//
// EL FRAME POR DEFECTO es el 10% de la duración, no el 0: el primer frame suele ser NEGRO (fade-in, o el
// arranque de una grabación); el 10% cae ya en contenido. El SEEK cae al keyframe más cercano en algunos
// códecs, así que el frame visible puede no ser el segundo exacto del slider — por eso el `<video>` ES la
// verdad (muestra el frame real) y la etiqueta de tiempo es `currentTime` REAL tras el seek, nunca el
// pedido: lo que se ve es lo que se captura, y el número no miente sobre el frame.

const FRAC_DEFAULT = 0.1;

function fmt(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PosterScrubber({
  video,
  onPoster,
  onSubirImagen,
  onCancelar,
}: {
  video: File;
  /** Recibe el frame capturado como un File JPEG, para subirlo como el póster (poster primero). */
  onPoster: (poster: File) => void;
  /** La ALTERNATIVA: abrir el picker y subir una imagen propia en vez de capturar un frame. */
  onSubirImagen: () => void;
  onCancelar: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const capturandoRef = useRef(false); // guarda SÍNCRONA contra el doble-click en la ventana del toBlob
  const [capturando, setCapturando] = useState(false);
  const [dur, setDur] = useState(0);
  const [pedido, setPedido] = useState(0); // tiempo que pide el slider
  const [real, setReal] = useState(0); // tiempo REAL al que cayó el seek (keyframe más cercano) → la etiqueta
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const url = URL.createObjectURL(video);
    v.src = url;
    const onMeta = () => {
      setDur(v.duration || 0);
      const inicio = (v.duration || 0) * FRAC_DEFAULT;
      setPedido(inicio);
      v.currentTime = inicio;
    };
    const onSeek = () => { setReal(v.currentTime); setListo(true); };
    const onErr = () => setFallo(true);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('seeked', onSeek);
    v.addEventListener('error', onErr);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('seeked', onSeek);
      v.removeEventListener('error', onErr);
      URL.revokeObjectURL(url);
    };
  }, [video]);

  const capturar = () => {
    if (capturandoRef.current) return; // el toBlob es asíncrono: sin esto, dos clicks capturan dos veces
    const v = ref.current;
    if (!v || !v.videoWidth) return;
    capturandoRef.current = true;
    setCapturando(true);
    const c = document.createElement('canvas');
    c.width = v.videoWidth; // DIMS DEL VÍDEO, no del elemento escalado en pantalla
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (b) => {
        if (b) {
          onPoster(new File([b], 'poster.jpg', { type: 'image/jpeg' })); // el padre arranca la subida → se desmonta
        } else {
          capturandoRef.current = false; // toBlob falló (raro): liberar para reintentar
          setCapturando(false);
        }
      },
      'image/jpeg', // JPEG, no WebP: es un frame FOTOGRÁFICO (dominio del JPEG) y decodifica en todos lados;
      0.85, // el ahorro de WebP en UN póster es marginal y no vale el riesgo de compatibilidad.
    );
  };

  return (
    <div className="duna-card" style={{ padding: 'var(--duna-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      <span className="duna-caption" style={{ margin: 0 }}>
        Vídeo elegido: <strong>{video.name}</strong>. Elige el frame para el <strong>póster</strong> —la imagen que se ve antes de reproducir—.
      </span>
      {fallo ? (
        <p className="duna-field__hint" style={{ margin: 0 }}>No se pudo previsualizar el vídeo. Sube una imagen para el póster.</p>
      ) : (
        <>
          {/* El `<video>` ES el preview: muestra el frame real al que cayó el seek. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={ref} muted playsInline preload="auto" style={{ width: '100%', maxWidth: '360px', borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)', background: '#000' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
            <input
              type="range"
              min={0}
              max={dur || 0}
              step={0.05}
              value={pedido}
              disabled={!listo || capturando}
              onChange={(e) => { const t = Number(e.target.value); setPedido(t); const v = ref.current; if (v) v.currentTime = t; }}
              aria-label="Momento del vídeo para el póster"
              style={{ flex: 1 }}
            />
            <span className="duna-sub" style={{ minWidth: '2.75rem', textAlign: 'right' }}>{fmt(real)}</span>
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        {!fallo && (
          <button type="button" onClick={capturar} disabled={!listo || capturando} className="duna-btn duna-btn--primary duna-btn--sm">
            <Camera className="h-3.5 w-3.5" /> Usar este frame
          </button>
        )}
        <button type="button" onClick={onSubirImagen} disabled={capturando} className="duna-btn duna-btn--ghost duna-btn--sm">
          <Upload className="h-3.5 w-3.5" /> Subir una imagen
        </button>
        <button type="button" onClick={onCancelar} disabled={capturando} className="duna-btn duna-btn--ghost duna-btn--sm">
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}
