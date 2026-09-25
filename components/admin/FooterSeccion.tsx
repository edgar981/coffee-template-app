'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import type { CampoItem } from '@/components/admin/tienda-secciones';
import type { FooterContent } from '@/lib/config/site-content-defaults';

// ─── Bloque PIE DE PÁGINA — vive en /admin/tienda, editor BESPOKE SIN vista previa ─────────────
//
// § MUESTRARIO-FOOTER-TEMA-1, MISMO precedente EXACTO que `MenuSeccion.tsx` (§ CROMO-MENU-PANEL-
// EDITOR-1): el pipeline genérico de vista previa en vivo (`VistaTiendaEnVivo`) monta cada sección
// en un `Record<SeccionVista, ComponentType>` EXHAUSTIVO, y `StoreFooter` importa
// `useSiteSettings()` del storefront —que LANZA fuera de su árbol de providers (§ CLAUDE.md,
// "Montar un componente en OTRO árbol de providers")—, igual que `StoreNav` con `useCartStore`/
// `useSiteSettings`. Sumar 'footer' a ese Record exigiría además tocar `VistaTiendaEnVivo.tsx`
// para envolver un `SiteSettingsProvider` que hoy no existe ahí. Un editor BESPOKE —patrón
// `MenuSeccion`/`PaletaSeccion`— evita las dos cosas.
//
// LA ESCRITURA va por el camino GENÉRICO: `footer` SÍ está en `REGISTRY` (§ site-content-
// defaults.ts), así que el PUT/POST de `/api/site-content` —el mismo que `TiendaSeccionEditor`
// usa para cada sección— ya lo acepta sin cambio.
//
// SIN VISTA PREVIA (mismo argumento que Menú): el pie es cromo transversal (aparece en TODA
// página), no contenido de una página. El resumen de lectura es TEXTO, no una miniatura.

type Form = FooterContent;

const DESCRIPTORES_ITEM: CampoItem[] = [
  { name: 'label', label: 'Texto del enlace', tipo: 'texto', resumen: 'principal', hint: 'Ej. "Política de privacidad".' },
  { name: 'href', label: 'Destino (URL o ruta)', tipo: 'texto', resumen: 'detalle', hint: 'Ej. "/legal/privacidad".' },
];

export default function FooterSeccion() {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // AUTOGUARDADO del borrador — la MISMA máquina que las secciones (§ useAutoguardado), pero el PUT
  // va por el endpoint GENÉRICO de contenido (`footer` es una sección de REGISTRY).
  const guardarFooter = useCallback(async (data: Form) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ footer: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarFooter);

  // Carga el pie draft-merged (GET /api/site-content → `contenido.footer` + `sinPublicar.footer`).
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setForm(d.contenido.footer as Form);
      setHayBorrador(!!d.sinPublicar?.footer);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar el pie de página.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error', igual que Menú/las secciones.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  const cambiar = (parcial: Partial<Form>) => {
    const nf = { ...(formRef.current as Form), ...parcial };
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
  };

  const cambiarItems = (items: Record<string, unknown>[]) =>
    cambiar({ items: items as unknown as Form['items'] });

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  // Publicar / Descartar el borrador de esta sección (POST /api/site-content, el mismo camino que
  // TiendaSeccionEditor usa para cada sección).
  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion: 'footer' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorServidor(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
        return;
      }
      if (accion === 'publicar') { setHayBorrador(false); toast.success('Publicado — ya está en vivo.'); }
      else { await cargar(); toast.success('Cambios descartados — volviste a lo publicado.'); }
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="duna-card duna-card__pad" role="status">
        <span className="duna-sr-only">Cargando el pie de página…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', height: '72px', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar el pie de página.'}</p>
      </div>
    );
  }

  const puedePublicar = auto.estado === 'guardado' && !procesando;
  const enError = auto.estado === 'error';
  const mostrarEstado = editando || auto.estado !== 'guardado';
  const estadoTexto = auto.estado === 'guardando' ? 'Guardando…' : auto.estado === 'error' ? 'No se pudo guardar' : 'Guardado';
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

  const resumen = `${form.columnaTienda} · ${form.columnaAyuda} · ${form.columnaEmpresa}${form.items.length > 0 ? ` · ${form.items.length} legal` : ''}`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Pie de página</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          {!editando && (
            <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
              Los encabezados y enlaces del pie, y la composición con la que se muestran.
            </p>
          )}
          {editando && indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        {!editando ? (
          <button type="button" onClick={() => setEditando(true)} className="duna-btn duna-btn--secondary" style={{ flexShrink: 0 }}>
            <Pencil /> Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0, flexWrap: 'wrap' }}>
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
        )}
      </div>
      {editando && errorServidor && (
        <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-2)', marginBottom: 0 }}>{errorServidor}</p>
      )}

      {!editando ? (
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <p className="duna-sub" style={{ margin: 0 }}>{resumen}</p>
        </div>
      ) : (
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div className="duna-form">
            <div>
              <span className="duna-field__label">Composición</span>
              <select
                className="duna-input duna-select"
                value={form.variante}
                onChange={(e) => cambiar({ variante: e.target.value })}
              >
                <option value="franjas">Columnas lado a lado (la de hoy)</option>
                <option value="apilado">Marca arriba, columnas debajo</option>
              </select>
            </div>

            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-col-tienda">Encabezado — Tienda</label>
              <input id="footer-col-tienda" className="duna-input" value={form.columnaTienda} onChange={(e) => cambiar({ columnaTienda: e.target.value })} />
              <p className="duna-field__hint">Vacío: se usa el texto por defecto.</p>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-tienda">Enlace — Todos los productos</label>
              <input id="footer-link-tienda" className="duna-input" value={form.linkTienda} onChange={(e) => cambiar({ linkTienda: e.target.value })} />
              <p className="duna-field__hint">Va a /tienda. Vacío: se usa el texto por defecto.</p>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-suscripciones">Enlace — Suscripciones</label>
              <input id="footer-link-suscripciones" className="duna-input" value={form.linkSuscripciones} onChange={(e) => cambiar({ linkSuscripciones: e.target.value })} />
              <p className="duna-field__hint">Va a /suscripciones (se oculta si esa página está apagada). Vacío: se usa el texto por defecto.</p>
            </div>

            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-col-ayuda">Encabezado — Ayuda</label>
              <input id="footer-col-ayuda" className="duna-input" value={form.columnaAyuda} onChange={(e) => cambiar({ columnaAyuda: e.target.value })} />
              <p className="duna-field__hint">Vacío: se usa el texto por defecto.</p>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-rastrear">Enlace — Rastrear Pedido</label>
              <input id="footer-link-rastrear" className="duna-input" value={form.linkRastrearPedido} onChange={(e) => cambiar({ linkRastrearPedido: e.target.value })} />
              <p className="duna-field__hint">Va a /rastrear-pedido. Vacío: se usa el texto por defecto.</p>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-faq">Enlace — Preguntas Frecuentes</label>
              <input id="footer-link-faq" className="duna-input" value={form.linkPreguntasFrecuentes} onChange={(e) => cambiar({ linkPreguntasFrecuentes: e.target.value })} />
              <p className="duna-field__hint">Va a /preguntas-frecuentes (se oculta si la FAQ está vacía). Vacío: se usa el texto por defecto.</p>
            </div>

            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-col-empresa">Encabezado — Empresa</label>
              <input id="footer-col-empresa" className="duna-input" value={form.columnaEmpresa} onChange={(e) => cambiar({ columnaEmpresa: e.target.value })} />
              <p className="duna-field__hint">Vacío: se usa el texto por defecto.</p>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-nosotros">Enlace — Nuestra Historia</label>
              <input id="footer-link-nosotros" className="duna-input" value={form.linkNuestraHistoria} onChange={(e) => cambiar({ linkNuestraHistoria: e.target.value })} />
              <p className="duna-field__hint">Va a /nosotros (se oculta si esa página está apagada). Vacío: se usa el texto por defecto.</p>
            </div>

            <div>
              <span className="duna-field__label">Enlaces legales (opcional)</span>
              <RepeaterEditor
                items={form.items as unknown as Record<string, unknown>[]}
                descriptores={DESCRIPTORES_ITEM}
                itemLabel="Enlace legal"
                genero="m"
                onChange={cambiarItems}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás al pie publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
