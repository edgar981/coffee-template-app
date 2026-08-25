'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload } from 'lucide-react';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { uploadImagen } from '@/lib/api/upload';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { DEFAULTS, type HeroContent } from '@/lib/config/site-content-defaults';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS, ACCEPT_IMAGENES } from '@/constants/upload';

// Editor lectura↔edición del HERO de la home. Reusa la cáscara de DatosNegocioSeccion
// (read-view/edit-view + useDescarteDeDrawer + ConfirmDescartarDialog); DIFIERE en la
// IMAGEN, que usa la etapa 'subiendo'/'guardando' de ProductFormModal (uploadImagen) —el
// único campo que no es texto—.
//
// Loader SOFT: los opcionales vacíos SE OMITEN en el storefront (no caen al default), y el
// hint de cada campo lo dice. Hero es `ocultable:false` → sin toggle de visibilidad.

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
  const guarda = useAccionGuardada();

  const [cargando, setCargando]       = useState(true);
  const [errorCarga, setErrorCarga]   = useState<string | null>(null);
  const [hero, setHero]               = useState<HeroContent | null>(null); // lo guardado (resuelto)
  const [editando, setEditando]       = useState(false);
  const [form, setForm]               = useState<HeroContent | null>(null); // buffer de edición
  const [imagenFile, setImagenFile]   = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [fase, setFase]               = useState<null | 'subiendo' | 'guardando'>(null);
  const [errores, setErrores]         = useState<Partial<Record<keyof HeroContent, string>>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/site-content')
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (vivo) { setHero(d.hero); setCargando(false); } })
      .catch(() => { if (vivo) { setErrorCarga('No se pudo cargar el contenido.'); setCargando(false); } });
    return () => { vivo = false; };
  }, []);

  const salir = () => {
    setEditando(false);
    setImagenFile(null); setPreviewLocal(null);
    setErrores({}); setErrorServidor(null);
  };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salir });

  const sucio = editando && !!form && hero
    ? JSON.stringify(form) !== JSON.stringify(hero) || !!imagenFile
    : false;
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrir = () => {
    if (!hero) return;
    setForm({ ...hero });
    setImagenFile(null); setPreviewLocal(null);
    setErrores({}); setErrorServidor(null);
    setEditando(true);
  };

  const set = (name: keyof HeroContent) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => (f ? { ...f, [name]: e.target.value } : f));

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo
    if (!f) return;
    // Aviso temprano; la validación que MANDA está en /api/upload.
    if (!(TIPOS_PERMITIDOS as readonly string[]).includes(f.type)) {
      setErrorServidor('Formato no admitido. Usa JPG, PNG o WebP.');
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setErrorServidor(`La imagen pesa ${(f.size / (1024 * 1024)).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setErrorServidor(null);
    setImagenFile(f);
    setPreviewLocal(URL.createObjectURL(f));
  };

  const usarPorDefecto = () => {
    setImagenFile(null); setPreviewLocal(null);
    setForm(f => (f ? { ...f, imagen: DEFAULTS.hero.imagen } : f));
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErrorServidor(null);

    const parsed = siteContentEditableSchema.safeParse({ hero: form });
    if (!parsed.success) {
      const errs: Partial<Record<keyof HeroContent, string>> = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path[1] as keyof HeroContent; // path = ['hero', <campo>]
        if (campo && !errs[campo]) errs[campo] = issue.message;
      }
      setErrores(errs);
      return;
    }
    setErrores({});

    guarda.ejecutar(async () => {
      // SUBIR → GUARDAR. Si la subida falla, no se guarda nada; si el PUT falla, el blob
      // nuevo queda huérfano (basura barata) pero tampoco se guardó — el dueño ve el error.
      let imagenUrl = form.imagen;
      let etapa: 'subiendo' | 'guardando' = 'subiendo';
      try {
        if (imagenFile) {
          setFase('subiendo');
          imagenUrl = (await uploadImagen(imagenFile, 'contenido')).url;
        }
        etapa = 'guardando';
        setFase('guardando');
        const res = await fetch('/api/site-content', {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ hero: { ...form, imagen: imagenUrl } }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          setErrorServidor(d?.error ?? 'No se pudo guardar. Intenta de nuevo.');
          return;
        }
        const nuevo = { ...form, imagen: imagenUrl };
        setHero(nuevo);
        setEditando(false);
        setImagenFile(null); setPreviewLocal(null);
        toast.success('Contenido del hero guardado.');
      } catch (err) {
        setErrorServidor(
          etapa === 'subiendo'
            ? (err instanceof Error ? err.message : 'No se pudo subir la imagen')
            : 'No se pudo guardar. Intenta de nuevo.',
        );
      } finally {
        setFase(null);
      }
    });
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
  if (errorCarga || !hero) {
    return (
      <>
        <h2 className="duna-title">Hero de la home</h2>
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar.'}</p>
        </div>
      </>
    );
  }

  const imagenPreview = previewLocal ?? (editando ? form?.imagen : hero.imagen) ?? hero.imagen;
  const bloqueado = guarda.enVuelo;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="duna-title">Hero de la home</h2>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            La primera pantalla del storefront: imagen de fondo, titular y botones.
          </p>
        </div>
        {!editando && (
          <button type="button" onClick={abrir} className="duna-btn duna-btn--secondary" style={{ flexShrink: 0 }}>
            <Pencil /> Editar
          </button>
        )}
      </div>

      <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
        {/* Imagen — el único campo que no es texto */}
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
          {editando && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-3)', alignItems: 'center', marginTop: 'var(--duna-space-3)' }}>
              <input ref={fileRef} type="file" accept={ACCEPT_IMAGENES} onChange={elegirArchivo} hidden disabled={bloqueado} />
              <button type="button" onClick={() => fileRef.current?.click()} className="duna-btn duna-btn--secondary duna-btn--sm" disabled={bloqueado}>
                <Upload /> Cambiar imagen
              </button>
              {form && form.imagen !== DEFAULTS.hero.imagen && (
                <button type="button" onClick={usarPorDefecto} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={bloqueado}>
                  Usar imagen por defecto
                </button>
              )}
              <span className="duna-field__hint" style={{ margin: 0 }}>
                {imagenFile ? imagenFile.name : `JPG, PNG o WebP · máx ${MAX_UPLOAD_MB} MB`}
              </span>
            </div>
          )}
        </div>

        {editando && form ? (
          <form onSubmit={guardar} className="duna-form" noValidate>
            {CAMPOS.map(campo => {
              const err = errores[campo.name];
              const id  = `hero-${campo.name}`;
              const describedBy = err ? `${id}-err` : `${id}-hint`;
              const value = String(form[campo.name] ?? '');
              return (
                <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`}>
                  <label className="duna-field__label" htmlFor={id}>{campo.label}</label>
                  {campo.textarea ? (
                    <textarea id={id} className="duna-input" rows={2} value={value} onChange={set(campo.name)}
                      aria-invalid={err ? true : undefined} aria-describedby={describedBy} disabled={bloqueado} />
                  ) : (
                    <input id={id} className="duna-input" value={value} onChange={set(campo.name)}
                      aria-invalid={err ? true : undefined} aria-describedby={describedBy} disabled={bloqueado} />
                  )}
                  {err
                    ? <p className="duna-field__error" id={`${id}-err`}>{err}</p>
                    : <p className="duna-field__hint" id={`${id}-hint`}>{campo.hint}</p>}
                </div>
              );
            })}

            <div className="duna-form__full" style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
              <button type="submit" className="duna-btn duna-btn--primary" disabled={bloqueado}>
                {fase === 'subiendo' ? 'Subiendo imagen…' : fase === 'guardando' ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={descarte.intentarCerrar} className="duna-btn duna-btn--ghost" disabled={bloqueado}>
                Cancelar
              </button>
              {errorServidor && <p className="duna-field__error" role="alert" style={{ margin: 0 }}>{errorServidor}</p>}
            </div>
          </form>
        ) : (
          <dl className="duna-form" style={{ margin: 0 }}>
            {CAMPOS.map(campo => {
              const texto = String(hero[campo.name] ?? '').trim();
              return (
                <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`}>
                  <dt className="duna-field__label">{campo.label}</dt>
                  <dd className="duna-body" style={{ margin: 0, wordBreak: 'break-word' }}>
                    {texto || <span style={{ color: 'var(--duna-muted)' }}>{campo.opcional ? 'No se muestra' : 'Por defecto'}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>

      {!editando && errorServidor && (
        <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorServidor}</p>
      )}

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />
    </>
  );
}
