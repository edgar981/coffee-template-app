'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import VistaTiendaEnVivo from '@/components/admin/VistaTiendaEnVivo';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import type { SeccionConfig } from '@/components/admin/tienda-secciones';
import { uploadImagen } from '@/lib/api/upload';
import { DEFAULTS } from '@/lib/config/site-content-defaults';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS, ACCEPT_IMAGENES } from '@/constants/upload';

// LA CÁSCARA del editor de una sección de la tienda, GENÉRICA. Todo lo que NO es específico de la
// sección vive acá —VISTA PREVIA EN VIVO + read↔edit + autoguardado + publicar/descartar + el
// indicador + beforeunload-en-error—; lo específico (campos, imágenes, toggle, identidad) llega por
// `config` (§ tienda-secciones). Segundo consumidor de este patrón: no se duplica la lógica de
// autoguardado ni la de publicación —un bug arreglado en un sitio y no en el otro sería el peor
// modo de falla—.
//
// La vista en vivo (componentes reales del storefront alimentados por el form) es la LECTURA;
// "Editar" abre el formulario junto a ella; "Listo" cierra. El form AUTOGUARDA mientras se edita
// (§ lib/autoguardado); la vista cambia en el mismo render. Sin gesto de guardar; Publicar y
// Descartar son las acciones del borrador.

type Datos = Record<string, unknown>; // strings/booleans planos + el array de items de un repeater

export default function TiendaSeccionEditor({ config }: { config: SeccionConfig }) {
  const { seccion } = config;
  const defaults = DEFAULTS[seccion] as unknown as Record<string, string | boolean>;

  const [cargando, setCargando]       = useState(true);
  const [errorCarga, setErrorCarga]   = useState<string | null>(null);
  const [form, setForm]               = useState<Datos | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [editando, setEditando]       = useState(false);
  const [fase, setFase]               = useState<null | 'subiendo'>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const campoImagenRef = useRef<string | null>(null); // qué campo-imagen se está reemplazando

  const formRef = useRef<Datos | null>(null); formRef.current = form;
  const faseRef = useRef(fase); faseRef.current = fase;

  const guardarSeccion = useCallback(async (data: Datos) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [seccion]: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, [seccion]);
  const auto = useAutoguardado(guardarSeccion);

  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setForm(d.contenido[seccion]);
      setHayBorrador(!!d.sinPublicar?.[seccion]);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar el contenido.'); setCargando(false); }
    }
  }, [seccion]);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión): pendiente/guardando es común y recuperable.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  // Un cambio de campo/toggle: pisa el form, marca borrador y ensucia el autoguardado —salvo durante
  // una subida, donde el valor queda en formRef y se guarda al terminar (no se pierde).
  const cambiar = (parcial: Datos) => {
    const nf = { ...(formRef.current as Datos), ...parcial };
    setForm(nf);
    setHayBorrador(true);
    if (faseRef.current !== 'subiendo') auto.marcarSucio(nf);
  };

  const set = (name: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => cambiar({ [name]: e.target.value });

  const pedirArchivo = (campo: string) => { campoImagenRef.current = campo; fileRef.current?.click(); };

  const elegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const campo = campoImagenRef.current;
    if (!file || !campo) return;
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
      const nf = { ...(formRef.current as Datos), [campo]: url };
      setForm(nf); setHayBorrador(true);
      auto.marcarSucio(nf); auto.flush();
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setFase(null);
    }
  };

  const usarPorDefecto = (campo: string) => {
    const nf = { ...(formRef.current as Datos), [campo]: defaults[campo] };
    setForm(nf); setHayBorrador(true);
    auto.marcarSucio(nf); auto.flush();
  };

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorServidor(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
        return;
      }
      if (accion === 'publicar') {
        setHayBorrador(false);
        toast.success('Publicado — ya está en vivo.');
      } else {
        await cargar(); // el form vuelve a lo publicado → la vista en vivo también
        toast.success('Cambios descartados — volviste a lo publicado.');
      }
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

  const subiendo = fase === 'subiendo';
  const puedePublicar = auto.estado === 'guardado' && !procesando;
  const enError = auto.estado === 'error';
  // `oculta` = el TOGGLE apagado (para el badge "Oculta"). `repeaterVacio` = una lista sin ítems, que
  // también hace que la sección no se renderice (hide-on-empty). `noSeMuestra` cubre las dos para el
  // placeholder de la vista/tarjeta: sin él, un repeater vacío deja la vista en BLANCO, que se lee como
  // roto. El mensaje distingue el porqué (toggle vs lista vacía).
  const oculta = config.ocultable && form.visible === false;
  const items = config.repeater ? form[config.repeater.itemsKey] : undefined;
  const repeaterVacio = !!config.repeater && !(Array.isArray(items) && items.length > 0);
  const noSeMuestra = oculta || repeaterVacio;
  const avisoNoSeMuestra = oculta
    ? 'Actívala con el interruptor para verla aquí.'
    : 'La lista está vacía — agrega el primero para verla aquí.';
  const mostrarEstado = editando || subiendo || auto.estado !== 'guardado';
  const estadoTexto = subiendo ? 'Subiendo imagen…'
    : auto.estado === 'guardando' ? 'Guardando…'
    : auto.estado === 'error' ? 'No se pudo guardar'
    : 'Guardado';

  // ── LECTURA: la sección es una TARJETA compacta (miniatura + título + estado + Editar). La vista
  //    grande (con sticky) sólo existe en edición; en lectura no hay scroller interno que atrape la
  //    página. Publicar/Descartar viven en la vista expandida.
  if (!editando) {
    return (
      <div className="tienda-tarjeta">
        <div className="tienda-tarjeta__thumb" onClick={() => setEditando(true)}>
          {noSeMuestra ? (
            <div className="tienda-tarjeta__oculta">
              <span className="duna-caption" style={{ margin: 0 }}>No se muestra en la tienda</span>
            </div>
          ) : (
            <VistaTiendaEnVivo seccion={seccion} valor={form} compacto />
          )}
        </div>
        <div className="tienda-tarjeta__meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">{config.titulo}</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
            {oculta && <span className="duna-badge duna-badge--neutral">Oculta</span>}
          </div>
          <div>
            <button type="button" onClick={() => setEditando(true)} className="duna-btn duna-btn--secondary">
              <Pencil /> Editar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EDICIÓN: la vista grande (sticky) + el form. El hero conserva su comportamiento exacto.
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">{config.titulo}</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
            {oculta && <span className="duna-badge duna-badge--neutral">Oculta</span>}
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
          <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Listo</button>
          {hayBorrador && (
            <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
              Descartar
            </button>
          )}
          {hayBorrador && (
            <button type="button" onClick={() => accionBorrador('publicar')} className="duna-btn duna-btn--primary" disabled={!puedePublicar}>
              {procesando ? 'Publicando…' : 'Publicar'}
            </button>
          )}
        </div>
      </div>

      <div className="tienda-vivo tienda-vivo--editando" style={{ marginTop: 'var(--duna-space-4)' }}>
        {/* La VISTA — componentes reales alimentados por el form. Oculta: la sección se auto-oculta
            en el storefront (self-gate), así que la vista quedaría vacía; se muestra un aviso.
            `tienda-vivo__vista` es sticky: sólo existe en edición, así que al dar "Listo" se
            desmonta y no queda ningún elemento pinneado. */}
        <div className="tienda-vivo__vista">
          {noSeMuestra ? (
            <div className="duna-card duna-card__pad" style={{ display: 'grid', placeItems: 'center', minHeight: '160px', textAlign: 'center' }}>
              <div>
                <p className="duna-title" style={{ margin: 0 }}>No se muestra en la tienda</p>
                <p className="duna-sub" style={{ marginTop: '4px' }}>{avisoNoSeMuestra}</p>
              </div>
            </div>
          ) : (
            <VistaTiendaEnVivo seccion={seccion} valor={form} />
          )}
        </div>

        {/* El FORM — junto a la vista (esta rama es siempre edición). */}
        <div className="tienda-vivo__form">
            <div className="duna-card duna-card__pad">
              <input ref={fileRef} type="file" accept={ACCEPT_IMAGENES} onChange={elegirArchivo} hidden disabled={subiendo} />

              {config.ocultable && (
                <div className="duna-field duna-form__full" style={{ marginBottom: 'var(--duna-space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.visible !== false}
                      aria-label="Mostrar esta sección en la tienda"
                      onClick={() => cambiar({ visible: form.visible === false })}
                      className={`duna-switch${form.visible !== false ? ' is-on' : ''}`}
                    >
                      <span className="duna-switch__thumb" />
                    </button>
                    <span className="duna-field__label" style={{ margin: 0 }}>Mostrar en la tienda</span>
                  </div>
                  <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>
                    Si la apagas, esta sección desaparece de la home.
                  </p>
                </div>
              )}

              {config.imagenes.map(img => {
                const val = String(form[img.name] ?? '');
                const esDefault = val === String(defaults[img.name] ?? '');
                return (
                  <div key={img.name} className="duna-field duna-form__full" style={{ marginBottom: 'var(--duna-space-5)' }}>
                    <span className="duna-field__label">{img.label}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={val}
                      alt=""
                      style={{
                        width: '100%', maxWidth: '360px', aspectRatio: '16 / 9', objectFit: 'cover',
                        borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)', marginTop: 'var(--duna-space-1)',
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-3)', alignItems: 'center', marginTop: 'var(--duna-space-3)' }}>
                      <button type="button" onClick={() => pedirArchivo(img.name)} className="duna-btn duna-btn--secondary duna-btn--sm" disabled={subiendo}>
                        <Upload /> Cambiar imagen
                      </button>
                      {!esDefault && (
                        <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                          Usar imagen por defecto
                        </button>
                      )}
                      <span className="duna-field__hint" style={{ margin: 0 }}>
                        {subiendo ? 'Subiendo…' : `JPG, PNG o WebP · máx ${MAX_UPLOAD_MB} MB`}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="duna-form">
                {config.campos.map(campo => {
                  const id = `${seccion}-${campo.name}`;
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

              {/* Sección de LISTA (repeater): cada cambio del RepeaterEditor —editar, agregar, quitar,
                  mover— pasa por `cambiar`, el mismo marcar-sucio + autoguardado que un campo plano. */}
              {config.repeater && (
                <div style={{ marginTop: 'var(--duna-space-5)' }}>
                  <RepeaterEditor
                    items={Array.isArray(form[config.repeater.itemsKey]) ? (form[config.repeater.itemsKey] as Record<string, unknown>[]) : []}
                    descriptores={config.repeater.campos}
                    itemLabel={config.repeater.itemLabel}
                    onChange={nuevos => cambiar({ [config.repeater!.itemsKey]: nuevos })}
                  />
                </div>
              )}

              {errorServidor && (
                <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorServidor}</p>
              )}
            </div>
        </div>
      </div>

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a lo que está publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
