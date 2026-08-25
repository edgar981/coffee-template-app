'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { uploadImagen } from '@/lib/api/upload';
import { DEFAULTS, type HeroContent } from '@/lib/config/site-content-defaults';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS, ACCEPT_IMAGENES } from '@/constants/upload';

// Editor del HERO en el flujo borrador/publicado con AUTOGUARDADO: el guardado no es un gesto —el
// borrador se persiste solo mientras el dueño edita (§ lib/autoguardado)—. El form está SIEMPRE
// abierto (no hay read↔edit ni Guardar/Cancelar; el preview es la lectura). Las únicas acciones
// son Publicar (en vivo) y Descartar (volver a lo publicado). El schema es SOFT/todo-opcional, así
// que no hay validación que bloquee el autoguardado.

type Campo = { name: keyof HeroContent; label: string; opcional?: boolean; textarea?: boolean; hint: string };

const CAMPOS: Campo[] = [
  { name: 'eyebrow',            label: 'Línea superior',   opcional: true, hint: 'La línea en mayúsculas sobre el titular. Vacío: no se muestra.' },
  { name: 'titulo',             label: 'Titular',          hint: 'Vacío: se usa el texto por defecto.' },
  { name: 'tituloEnfasis',      label: 'Énfasis del titular', opcional: true, hint: 'La palabra en cursiva, en su propia línea bajo el titular. Vacío: no se muestra.' },
  { name: 'subtitulo',          label: 'Subtítulo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
  { name: 'ctaPrimarioLabel',   label: 'Botón principal',  hint: 'Su destino es /tienda (fijo). Vacío: se usa el texto por defecto.' },
  { name: 'ctaSecundarioLabel', label: 'Botón secundario', opcional: true, hint: 'Su destino es /suscripciones (fijo). Vacío: no se muestra.' },
];

export default function TiendaHeroSeccion({ onGuardado }: { onGuardado?: () => void }) {
  const [cargando, setCargando]       = useState(true);
  const [errorCarga, setErrorCarga]   = useState<string | null>(null);
  const [form, setForm]               = useState<HeroContent | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [fase, setFase]               = useState<null | 'subiendo'>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false); // publicar / descartar en vuelo
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Refs con el último valor, para los handlers async (subida) y el efecto del preview.
  const formRef = useRef<HeroContent | null>(null); formRef.current = form;
  const faseRef = useRef(fase); faseRef.current = fase;
  const onGuardadoRef = useRef(onGuardado); onGuardadoRef.current = onGuardado;

  // El PUT del autoguardado. Lanza en fallo → el coordinador pasa a 'error' y reintenta.
  const guardarHero = useCallback(async (data: HeroContent) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarHero);

  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setForm(d.contenido.hero);
      setHayBorrador(!!d.sinPublicar?.hero);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar el contenido.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión): pendiente/guardando es común y su pérdida es una
  // frase recuperable; un guardado que FALLÓ y no se persiste es el caso grave.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  // El preview se recarga al ASENTARSE un guardado (transición guardando→guardado), tras una
  // pausa —NO en cada PUT—: recargar el iframe cada tecla es inaceptable. Si arranca otro guardado
  // antes, se cancela y se espera. Publicar/descartar recargan aparte (cambio discreto).
  const prevEstado = useRef(auto.estado);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const prev = prevEstado.current;
    prevEstado.current = auto.estado;
    if (auto.estado === 'guardando' && reloadTimer.current) {
      clearTimeout(reloadTimer.current); reloadTimer.current = null;
    }
    if (prev === 'guardando' && auto.estado === 'guardado') {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => { onGuardadoRef.current?.(); reloadTimer.current = null; }, 1500);
    }
  }, [auto.estado]);
  useEffect(() => () => { if (reloadTimer.current) clearTimeout(reloadTimer.current); }, []);

  const set = (name: keyof HeroContent) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nf = { ...(formRef.current as HeroContent), [name]: e.target.value };
      setForm(nf);
      setHayBorrador(true);
      // BLOQUEO durante la subida de imagen: no se dispara el PUT (llevaría la URL vieja); el
      // texto queda en el form y se guarda al terminar la subida (vía formRef). No se pierde.
      if (faseRef.current !== 'subiendo') auto.marcarSucio(nf);
    };

  const elegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
      setErrorServidor('Formato no admitido. Usa JPG, PNG o WebP.'); return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorServidor(`La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`); return;
    }
    setErrorServidor(null);
    setPreviewLocal(URL.createObjectURL(file));
    setFase('subiendo'); // bloquea el autoguardado del texto mientras sube
    try {
      const { url } = await uploadImagen(file, 'contenido');
      // formRef.current YA incluye lo que se tecleó DURANTE la subida → nada se pierde.
      const nf = { ...(formRef.current as HeroContent), imagen: url };
      setForm(nf); setPreviewLocal(null); setHayBorrador(true);
      auto.marcarSucio(nf); auto.flush(); // imagen = cambio discreto: guarda ya
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : 'No se pudo subir la imagen');
      setPreviewLocal(null);
    } finally {
      setFase(null);
    }
  };

  const usarPorDefecto = () => {
    const nf = { ...(formRef.current as HeroContent), imagen: DEFAULTS.hero.imagen };
    setForm(nf); setPreviewLocal(null); setHayBorrador(true);
    auto.marcarSucio(nf); auto.flush();
  };

  const publicar = async () => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'publicar', seccion: 'hero' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null); setErrorServidor(d?.error ?? 'No se pudo publicar.'); return; }
      setHayBorrador(false);
      toast.success('Publicado — ya está en vivo.');
      onGuardadoRef.current?.();
    } finally { setProcesando(false); }
  };

  const descartarBorrador = async () => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'descartar', seccion: 'hero' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null); setErrorServidor(d?.error ?? 'No se pudo descartar.'); return; }
      await cargar(); // el form vuelve a lo publicado
      toast.success('Cambios descartados — volviste a lo publicado.');
      onGuardadoRef.current?.();
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <>
        <h2 className="duna-title">Hero de la home</h2>
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <p className="duna-caption">Cargando…</p>
        </div>
      </>
    );
  }
  if (errorCarga || !form) {
    return (
      <>
        <h2 className="duna-title">Hero de la home</h2>
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar.'}</p>
        </div>
      </>
    );
  }

  const imagenPreview = previewLocal ?? form.imagen;
  const puedePublicar = auto.estado === 'guardado' && !procesando; // sólo con el borrador ya persistido
  const enError = auto.estado === 'error';
  const estadoTexto = fase === 'subiendo' ? 'Subiendo imagen…'
    : auto.estado === 'guardando' ? 'Guardando…'
    : auto.estado === 'error' ? 'No se pudo guardar'
    : 'Guardado';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Hero de la home</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            La primera pantalla del storefront. Los cambios se guardan solos; publica cuando estén listos.
          </p>
          {/* Indicador de autoguardado — persistente, no un toast por tecla. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)' }}>
            <span className={enError ? 'duna-field__error' : 'duna-caption'} style={{ margin: 0 }} role={enError ? 'alert' : undefined}>
              {estadoTexto}
            </span>
            {enError && (
              <button type="button" onClick={() => auto.reintentar()} className="duna-btn duna-btn--ghost duna-btn--sm">
                Reintentar
              </button>
            )}
          </div>
        </div>
        {hayBorrador && (
          <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
            <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
              Descartar
            </button>
            <button type="button" onClick={publicar} className="duna-btn duna-btn--primary" disabled={!puedePublicar}>
              {procesando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        )}
      </div>

      <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
        {/* Imagen — se sube al elegirla; el autoguardado del texto se bloquea mientras sube. */}
        <div className="duna-field duna-form__full" style={{ marginBottom: 'var(--duna-space-5)' }}>
          <span className="duna-field__label">Imagen de fondo</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagenPreview}
            alt=""
            style={{
              width: '100%', maxWidth: '360px', aspectRatio: '16 / 9', objectFit: 'cover',
              borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)',
              marginTop: 'var(--duna-space-1)',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-3)', alignItems: 'center', marginTop: 'var(--duna-space-3)' }}>
            <input ref={fileRef} type="file" accept={ACCEPT_IMAGENES} onChange={elegirArchivo} hidden disabled={fase === 'subiendo'} />
            <button type="button" onClick={() => fileRef.current?.click()} className="duna-btn duna-btn--secondary duna-btn--sm" disabled={fase === 'subiendo'}>
              <Upload /> Cambiar imagen
            </button>
            {form.imagen !== DEFAULTS.hero.imagen && (
              <button type="button" onClick={usarPorDefecto} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={fase === 'subiendo'}>
                Usar imagen por defecto
              </button>
            )}
            <span className="duna-field__hint" style={{ margin: 0 }}>
              {fase === 'subiendo' ? 'Subiendo…' : `JPG, PNG o WebP · máx ${MAX_UPLOAD_MB} MB`}
            </span>
          </div>
        </div>

        <div className="duna-form">
          {CAMPOS.map(campo => {
            const id = `hero-${campo.name}`;
            const value = String(form[campo.name] ?? '');
            return (
              <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`}>
                <label className="duna-field__label" htmlFor={id}>{campo.label}</label>
                {campo.textarea ? (
                  <textarea id={id} className="duna-input" rows={2} value={value} onChange={set(campo.name)} aria-describedby={`${id}-hint`} />
                ) : (
                  <input id={id} className="duna-input" value={value} onChange={set(campo.name)} aria-describedby={`${id}-hint`} />
                )}
                <p className="duna-field__hint" id={`${id}-hint`}>{campo.hint}</p>
              </div>
            );
          })}
        </div>

        {errorServidor && (
          <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorServidor}</p>
        )}
      </div>

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); descartarBorrador(); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a lo que está publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
