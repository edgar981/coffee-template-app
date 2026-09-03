'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import VistaTiendaEnVivo from '@/components/admin/VistaTiendaEnVivo';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { CategoriaCombobox } from '@/components/admin/CategoriaCombobox';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import type { SeccionConfig } from '@/components/admin/tienda-secciones';
import { DEFAULTS } from '@/lib/config/site-content-defaults';
import { MAX_SUBIDA_DIRECTA_MB, ACCEPT_IMAGENES } from '@/constants/upload';

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

export default function TiendaSeccionEditor({ config, categorias = [], categoriasListas = false }: {
  config: SeccionConfig;
  /** Las categorías DERIVADAS del catálogo, para los campos-destino (§ el destino de Presentaciones es
   *  DATO). Sólo las usa la sección con un campo `categoria: true`; las demás las ignoran. */
  categorias?: string[];
  /** Si el catálogo ya cargó — el aviso "no existe" NO se muestra hasta saberlo (un fetch fallido no
   *  puede afirmar que una categoría no existe). */
  categoriasListas?: boolean;
}) {
  const { seccion } = config;
  const defaults = DEFAULTS[seccion] as unknown as Record<string, string | boolean>;

  const [cargando, setCargando]       = useState(true);
  const [errorCarga, setErrorCarga]   = useState<string | null>(null);
  const [form, setForm]               = useState<Datos | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [editando, setEditando]       = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Datos | null>(null); formRef.current = form;

  // El uploader compartido (§ useSubidaImagen): la cáscara lo instancia y lo comparte con el
  // RepeaterEditor por `subida.pedir`. Un solo <input>, un solo `subiendo`.
  const subida = useSubidaImagen({ onError: setErrorServidor });

  // Qué campo-imagen FIJO está subiendo (hero: `imagen`; brandStory: `imagen1..4`), para pegarle la
  // barra de progreso a ESE botón —no a todos—. Se limpia cuando la subida termina. (Las fotos del
  // repeater las rastrea el RepeaterEditor con su propio `subiendoDesde`.)
  const [subiendoCampo, setSubiendoCampo] = useState<string | null>(null);
  useEffect(() => { if (!subida.subiendo) setSubiendoCampo(null); }, [subida.subiendo]);

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

  // Un cambio de campo/toggle: pisa el form, marca borrador y ensucia el autoguardado — SIEMPRE,
  // incluso durante una subida. Una subida directa puede durar minutos y NO puede pausar la edición:
  // el texto se sigue guardando con la url VIEJA (o sin el ítem nuevo, que se crea al terminar), y la
  // url nueva llega en el flush post-subida. Nunca se guarda un ítem a medias (§ subirDirecto).
  const cambiar = (parcial: Datos) => {
    const nf = { ...(formRef.current as Datos), ...parcial };
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
  };

  const set = (name: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => cambiar({ [name]: e.target.value });

  // Pide una subida al uploader compartido y pisa el campo-imagen con la url resultante. El
  // marcar-sucio + flush van EXPLÍCITOS (no por `cambiar`), como en el uploader original: subir,
  // luego guardar. El callback corre con `subiendo` ya en false (§ useSubidaImagen), así que
  // marcarSucio no se descarta.
  const ponerImagen = (campo: string) => {
    setSubiendoCampo(campo); // para pegarle la barra a este botón
    subida.pedir(url => {
      const nf = { ...(formRef.current as Datos), [campo]: url };
      setForm(nf); setHayBorrador(true);
      auto.marcarSucio(nf); auto.flush();
    });
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

  const subiendo = subida.subiendo;
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
  // En EDICIÓN se muestra siempre (incluido "Guardado", que confirma que no hay nada pendiente); en
  // la TARJETA sólo cuando hay algo que decir (`estado !== 'guardado'` o una subida en curso).
  const mostrarEstado = editando || auto.estado !== 'guardado';
  const estadoTexto = auto.estado === 'guardando' ? 'Guardando…'
    : auto.estado === 'error' ? 'No se pudo guardar'
    : 'Guardado';

  // UNA sola definición del indicador, renderizada en las DOS ramas. Vivía sólo en el editor, y eso
  // dejaba INVISIBLE un guardado que fallara DESPUÉS de cerrar: el reintento seguía corriendo y el
  // beforeunload seguía guardando, pero el operador no veía nada (§ un guardado que falla sin
  // decirlo). Dos copias divergirían, así que se comparte, no se duplica.
  const indicadorEstado = mostrarEstado ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
      <span className={enError ? 'duna-field__error' : 'duna-caption'} style={{ margin: 0 }} role={enError ? 'alert' : undefined}>
        {estadoTexto}
      </span>
      {enError && (
        <button type="button" onClick={() => auto.reintentar()} className="duna-btn duna-btn--ghost duna-btn--sm">Reintentar</button>
      )}
    </div>
  ) : null;

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
          {/* El estado va ENTRE el título y la acción: se lee qué es → cómo está → qué hacer. En el
              caso normal ('guardado') no renderiza nada y la tarjeta queda idéntica a antes. */}
          {indicadorEstado}
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
          {/* El indicador de GUARDADO (Guardando… / Guardado / error) va en la cabecera, SIN sticky: el
              guardado es rápido y el error es persistente (el operador sube a verlo). El PROGRESO de la
              subida NO vive acá —vive pegado al botón que la disparó (§ la barra por-botón)—. Un sticky
              acá cortaría la tarjeta: sobre una superficie necesitaría `--duna-surface` y aun así
              partiría la sección; el sticky del head de `.duna-lista` funciona porque sus filas van
              sobre el fondo de PÁGINA, no sobre una tarjeta — esa es la distinción. */}
          {indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        {/* ASIMETRÍA DELIBERADA: Publicar y Descartar esperan al autoguardado (`!puedePublicar`)
            porque MUTAN —publicar con algo pendiente publicaría un borrador viejo—. "Cerrar" NO muta:
            sólo vuelve a la tarjeta, el cambio queda en el borrador. Por eso NUNCA se deshabilita —en
            estado de error (que reintenta solo cada 5 s) apagarlo dejaría al operador sin salida— y no
            hace falta esperar el flush: cerrar no DESMONTA nada (es otra rama del mismo componente, el
            coordinador vive en su ref), y el PUT es fire-and-forget de todos modos. */}
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
          <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Cerrar</button>
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
              <input ref={subida.inputRef} type="file" accept={ACCEPT_IMAGENES} onChange={subida.alElegir} hidden disabled={subiendo} />
              {/* Segundo input para el flujo "elegir sin subir" (alta de vídeo); su `accept` lo fija
                  `subida.elegir` por llamada (vídeo o imagen del póster). */}
              <input ref={subida.inputHoldRef} type="file" onChange={subida.alElegirHold} hidden />

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
                  {/* Sin hint: el operador apaga y ve el resultado en la vista en vivo. El label + el
                      switch bastan (mismo criterio que el toggle de página). */}
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
                      <button type="button" onClick={() => ponerImagen(img.name)} className="duna-btn duna-btn--secondary duna-btn--sm" disabled={subiendo}>
                        <Upload /> Cambiar imagen
                      </button>
                      {!esDefault && (
                        <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                          Usar imagen por defecto
                        </button>
                      )}
                      <span className="duna-field__hint" style={{ margin: 0 }}>
                        {subiendo && subiendoCampo === img.name ? `Subiendo… ${subida.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
                      </span>
                    </div>
                    {/* La barra pegada a ESTE botón (sólo el campo que sube), no en la cabecera. */}
                    {subiendo && subiendoCampo === img.name && (
                      <div style={{ marginTop: 'var(--duna-space-2)' }}><BarraProgreso pct={subida.progreso ?? 0} /></div>
                    )}
                  </div>
                );
              })}

              <div className="duna-form">
                {config.campos.map(campo => {
                  const id = `${seccion}-${campo.name}`;
                  const value = String(form[campo.name] ?? '');
                  // Aviso (b): el destino elegido ya no está en el catálogo → la tarjeta no traería
                  // resultados. NO bloqueante (el combobox permite a propósito una categoría futura), y
                  // sólo si el catálogo YA cargó (un fetch fallido no puede afirmar que no existe).
                  const destinoInexistente = !!campo.categoria && categoriasListas && value.trim() !== '' && !categorias.includes(value);
                  // Rótulo POR TÍTULO (§ ítem 2): el destino se lee «En grano» lleva a: usando el
                  // título en vivo de la misma tarjeta. Vacío el título → el `label` estático (fallback
                  // "Presentación N · lleva a"), que es lo que evita "lleva a:" sin sujeto.
                  const tituloTarjeta = campo.tituloDe ? String(form[campo.tituloDe] ?? '').trim() : '';
                  const etiqueta = campo.tituloDe && tituloTarjeta ? `«${tituloTarjeta}» lleva a:` : campo.label;
                  return (
                    <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`}>
                      <label className="duna-field__label" htmlFor={id}>{etiqueta}</label>
                      {campo.categoria ? (
                        <CategoriaCombobox id={id} value={value} categorias={categorias}
                                           onChange={v => cambiar({ [campo.name]: v })} ariaDescribedby={`${id}-hint`} />
                      ) : campo.textarea ? (
                        <textarea id={id} className="duna-input" rows={2} value={value} onChange={set(campo.name)} aria-describedby={`${id}-hint`} />
                      ) : (
                        <input id={id} className="duna-input" value={value} onChange={set(campo.name)} aria-describedby={`${id}-hint`} />
                      )}
                      {destinoInexistente && (
                        <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)', marginBottom: 0 }}>
                          Ningún producto tiene la categoría «{value}» todavía — la tarjeta no traerá resultados.
                        </p>
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
                    genero={config.repeater.genero}
                    max={config.repeater.max}
                    maxVideo={config.repeater.maxVideo}
                    pedirImagen={subida.pedir}
                    elegir={subida.elegir}
                    subir={subida.subir}
                    onError={setErrorServidor}
                    subiendo={subiendo}
                    progreso={subida.progreso}
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
