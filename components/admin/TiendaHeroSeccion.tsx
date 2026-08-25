'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import VistaTiendaEnVivo from '@/components/admin/VistaTiendaEnVivo';
import { uploadImagen } from '@/lib/api/upload';
import { DEFAULTS, type HeroContent } from '@/lib/config/site-content-defaults';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS, ACCEPT_IMAGENES } from '@/constants/upload';

// Editor del HERO con VISTA PREVIA EN VIVO + read↔edit. La vista en vivo (componentes reales del
// storefront alimentados por el form) es la LECTURA; "Editar" abre el formulario junto a ella;
// "Listo" cierra. El form AUTOGUARDA mientras se edita (§ lib/autoguardado); la vista cambia en el
// mismo render. Sin gesto de guardar; Publicar y Descartar son las acciones del borrador.

type Campo = { name: keyof HeroContent; label: string; opcional?: boolean; textarea?: boolean; hint: string };

const CAMPOS: Campo[] = [
  { name: 'eyebrow',            label: 'Línea superior',   opcional: true, hint: 'La línea en mayúsculas sobre el titular. Vacío: no se muestra.' },
  { name: 'titulo',             label: 'Titular',          hint: 'Vacío: se usa el texto por defecto.' },
  { name: 'tituloEnfasis',      label: 'Énfasis del titular', opcional: true, hint: 'La palabra en cursiva, en su propia línea bajo el titular. Vacío: no se muestra.' },
  { name: 'subtitulo',          label: 'Subtítulo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
  { name: 'ctaPrimarioLabel',   label: 'Botón principal',  hint: 'Su destino es /tienda (fijo). Vacío: se usa el texto por defecto.' },
  { name: 'ctaSecundarioLabel', label: 'Botón secundario', opcional: true, hint: 'Su destino es /suscripciones (fijo). Vacío: no se muestra.' },
];

export default function TiendaHeroSeccion() {
  const [cargando, setCargando]       = useState(true);
  const [errorCarga, setErrorCarga]   = useState<string | null>(null);
  const [form, setForm]               = useState<HeroContent | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [editando, setEditando]       = useState(false);
  const [fase, setFase]               = useState<null | 'subiendo'>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const formRef = useRef<HeroContent | null>(null); formRef.current = form;
  const faseRef = useRef(fase); faseRef.current = fase;

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

  // beforeunload SÓLO en 'error' (§ decisión): pendiente/guardando es común y recuperable.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  const set = (name: keyof HeroContent) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nf = { ...(formRef.current as HeroContent), [name]: e.target.value };
      setForm(nf);
      setHayBorrador(true);
      // Bloqueo durante la subida: el texto queda en el form y se guarda al terminar (vía formRef).
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
    setFase('subiendo');
    try {
      const { url } = await uploadImagen(file, 'contenido');
      const nf = { ...(formRef.current as HeroContent), imagen: url };
      setForm(nf); setHayBorrador(true);
      auto.marcarSucio(nf); auto.flush();
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setFase(null);
    }
  };

  const usarPorDefecto = () => {
    const nf = { ...(formRef.current as HeroContent), imagen: DEFAULTS.hero.imagen };
    setForm(nf); setHayBorrador(true);
    auto.marcarSucio(nf); auto.flush();
  };

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

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
      await cargar(); // el form vuelve a lo publicado → la vista en vivo también
      toast.success('Cambios descartados — volviste a lo publicado.');
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="duna-card duna-card__pad" role="status">
        <span className="duna-sr-only">Cargando el contenido de la tienda…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '640px', aspectRatio: '16 / 9', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar.'}</p>
      </div>
    );
  }

  const puedePublicar = auto.estado === 'guardado' && !procesando;
  const enError = auto.estado === 'error';
  const mostrarEstado = editando || fase === 'subiendo' || auto.estado !== 'guardado';
  const estadoTexto = fase === 'subiendo' ? 'Subiendo imagen…'
    : auto.estado === 'guardando' ? 'Guardando…'
    : auto.estado === 'error' ? 'No se pudo guardar'
    : 'Guardado';
  const imagenPreview = form.imagen;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Hero de la home</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            Así se ve en la tienda. Edita y los cambios se guardan solos; publica cuando estén listos.{' '}
            <a href="/" target="_blank" rel="noreferrer" className="duna-link">Ver la tienda</a>
          </p>
          {mostrarEstado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)' }}>
              <span className={enError ? 'duna-field__error' : 'duna-caption'} style={{ margin: 0 }} role={enError ? 'alert' : undefined}>
                {estadoTexto}
              </span>
              {enError && (
                <button type="button" onClick={() => auto.reintentar()} className="duna-btn duna-btn--ghost duna-btn--sm">Reintentar</button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
          {!editando ? (
            <button type="button" onClick={() => setEditando(true)} className="duna-btn duna-btn--secondary">
              <Pencil /> Editar
            </button>
          ) : (
            <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Listo</button>
          )}
          {hayBorrador && (
            <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
              Descartar
            </button>
          )}
          {hayBorrador && (
            <button type="button" onClick={publicar} className="duna-btn duna-btn--primary" disabled={!puedePublicar}>
              {procesando ? 'Publicando…' : 'Publicar'}
            </button>
          )}
        </div>
      </div>

      <div className={`tienda-vivo${editando ? ' tienda-vivo--editando' : ''}`} style={{ marginTop: 'var(--duna-space-4)' }}>
        {/* La VISTA — componentes reales alimentados por el form. */}
        <div className="tienda-vivo__vista">
          <VistaTiendaEnVivo hero={form} />
        </div>

        {/* El FORM — sólo al editar, junto a la vista. */}
        {editando && (
          <div className="tienda-vivo__form">
            <div className="duna-card duna-card__pad">
              <div className="duna-field duna-form__full" style={{ marginBottom: 'var(--duna-space-5)' }}>
                <span className="duna-field__label">Imagen de fondo</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagenPreview}
                  alt=""
                  style={{
                    width: '100%', maxWidth: '360px', aspectRatio: '16 / 9', objectFit: 'cover',
                    borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)', marginTop: 'var(--duna-space-1)',
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
          </div>
        )}
      </div>

      {!editando && errorServidor && (
        <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorServidor}</p>
      )}

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
