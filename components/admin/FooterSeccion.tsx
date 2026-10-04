'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { Upload, ImageIcon } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import { AyudaCampo } from '@/components/admin/editor/AyudaCampo';
import type { CampoItem } from '@/components/admin/tienda-secciones';
import type { FooterContent } from '@/lib/config/site-content-defaults';
import { MAX_SUBIDA_DIRECTA_MB, ACCEPT_IMAGENES } from '@/constants/upload';
import { sonIguales, type PasoHistorial } from '@/lib/admin/historial-editor';
import type { EstadoAutoguardado } from '@/lib/autoguardado';
import { fusionCampoEditable } from '@/lib/storefront/campo-editable';

// § EDITOR-TIENDA-CROMO-1 — gemelo de `MenuSeccionHandle` (mismo contrato). `escribirCampo` es
// EXTRA sobre `MenuSeccionHandle`: el Pie es el único de los tres cromo que gana marcadores
// `CampoEditable` sobre textos simples (`columnaTienda`/`columnaAyuda`/`columnaEmpresa`,
// `tarjetaTexto`, `items.N.label`, § `StoreFooter.tsx`) — un clic ahí dentro del iframe manda
// `{seccion:'footer', campo, valor}` y `TiendaPaginas` lo resuelve a ESTE método, nunca a
// `escribirCampo` de una `SeccionVista` (que no existe para `footer`).
export interface FooterSeccionHandle {
  abrir: () => void;
  cerrar: () => void;
  marcarPublicado: () => void;
  restaurarDesdePublicado: (valor: Record<string, unknown>) => void;
  escribirCampo: (campo: string, valor: string) => void;
}

export interface FooterSeccionProps {
  /** Ver el docstring de `MenuSeccionProps.enEditor` — mismo contrato. */
  enEditor?: boolean;
  onAbrir?: () => void;
  onCerrar?: () => void;
  onCambio?: (datos: Record<string, unknown>) => void;
  onPaso?: (paso: PasoHistorial) => void;
  onEstado?: (info: { hayBorrador: boolean; estado: EstadoAutoguardado }) => void;
}

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
//
// LA TARJETA DE IMAGEN (§ MUESTRARIO-FOOTER-TARJETA-IMAGEN-1, la última pieza CONSTRUIBLE de
// MUESTRARIO-FOOTER-TEMA-1 — el newsletter queda pendiente de una decisión de producto del owner,
// § el docstring de `FooterContent`): mismo uploader compartido que `MenuSeccion.tsx`
// (`useSubidaImagen`, `carpeta:'contenido'`), sin vista previa propia por la misma razón de arriba.

type Form = FooterContent;

const DESCRIPTORES_ITEM: CampoItem[] = [
  { name: 'label', label: 'Texto del enlace', tipo: 'texto', resumen: 'principal', hint: 'Ej. "Política de privacidad".' },
  { name: 'href', label: 'Destino (URL o ruta)', tipo: 'texto', resumen: 'detalle', hint: 'Ej. "/legal/privacidad".' },
];

const FooterSeccion = forwardRef<FooterSeccionHandle, FooterSeccionProps>(function FooterSeccion({
  enEditor = false, onAbrir, onCerrar, onCambio, onPaso, onEstado,
}, ref) {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [errorImagenTarjeta, setErrorImagenTarjeta] = useState<string | null>(null);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // El uploader COMPARTIDO de la cáscara (§ useSubidaImagen), el mismo que `MenuSeccion.tsx` usa
  // para `panelTarjetaImagen` — sube DIRECTO a Blob, `carpeta:'contenido'`.
  const subidaImagen = useSubidaImagen({ onError: setErrorImagenTarjeta });

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

  // § EDITOR-TIENDA-CROMO-1 — EL PUNTO ÚNICO de mutación del form, mismo patrón que
  // `MenuSeccion.tsx`/`TiendaSeccionEditor.tsx`.
  const loteAntesRef = useRef<Form | null>(null);
  const aplicandoHistorialRef = useRef(false);
  const aplicarCambioForm = (nf: Form) => {
    if (loteAntesRef.current === null) loteAntesRef.current = formRef.current as Form;
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
    onCambio?.(nf as unknown as Record<string, unknown>);
  };

  const cambiar = (parcial: Partial<Form>) => {
    aplicarCambioForm({ ...(formRef.current as Form), ...parcial });
  };

  const cambiarItems = (items: Record<string, unknown>[]) =>
    cambiar({ items: items as unknown as Form['items'] });

  // Deshacer/rehacer, mismo criterio que `MenuSeccion.restaurarForm`.
  const restaurarForm = (valor: Form) => {
    aplicandoHistorialRef.current = true;
    aplicarCambioForm(valor);
    auto.flush();
  };

  const prevEstadoAutoRef = useRef(auto.estado);
  useEffect(() => {
    const prevEstado = prevEstadoAutoRef.current;
    prevEstadoAutoRef.current = auto.estado;
    if (prevEstado === auto.estado || auto.estado !== 'guardado') return;
    const antes = loteAntesRef.current;
    loteAntesRef.current = null;
    const fueHistorial = aplicandoHistorialRef.current;
    aplicandoHistorialRef.current = false;
    if (fueHistorial || antes === null) return;
    const despues = formRef.current as Form;
    if (sonIguales(antes, despues)) return;
    onPaso?.({ deshacer: () => restaurarForm(antes), rehacer: () => restaurarForm(despues) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismo criterio que `MenuSeccion.tsx`.
  }, [auto.estado]);

  useEffect(() => {
    onEstado?.({ hayBorrador, estado: auto.estado });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismo criterio que `MenuSeccion.tsx`.
  }, [hayBorrador, auto.estado]);

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  const prevEditandoRef = useRef(editando);
  useEffect(() => {
    if (!enEditor) return;
    if (prevEditandoRef.current === editando) return;
    prevEditandoRef.current = editando;
    if (editando) onAbrir?.(); else onCerrar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismo criterio que `MenuSeccion.tsx`.
  }, [editando, enEditor]);

  useImperativeHandle(ref, () => ({
    abrir: () => setEditando(true),
    cerrar: cerrarEdicion,
    marcarPublicado: () => setHayBorrador(false),
    restaurarDesdePublicado: (valor: Record<string, unknown>) => {
      setForm(valor as unknown as Form);
      setHayBorrador(false);
    },
    // § EDITOR-TIENDA-CROMO-1 — el campo flotante del iframe (§ `StoreFooter.tsx`, `CampoEditable`):
    // mismo `fusionCampoEditable` que ya usa `TiendaSeccionEditor.escribirCampo` — nunca reimplementa
    // la fusión de un ítem de repeater a mano una segunda vez. Abre la edición si estaba cerrada
    // (SIN desplazar — el dueño ya está mirando el campo dentro del iframe), mismo criterio que
    // `TiendaSeccionEditorHandle.escribirCampo`.
    escribirCampo: (campo: string, valor: string) => {
      const parcial = fusionCampoEditable(formRef.current as unknown as Record<string, unknown>, campo, valor);
      if (!parcial) return;
      if (!editando) setEditando(true);
      aplicarCambioForm({ ...(formRef.current as Form), ...(parcial as Partial<Form>) });
    },
  }));

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

  // § EDITOR-VISUAL-PANEL-1 — LECTURA: una FILA compacta, no la tarjeta grande con el resumen de
  // columnas en prosa (§ CLAUDE.md "sin tarjetas grandes con botón Editar"). El resumen que mostraba
  // (`resumen`, columnas + conteo de enlaces legales) no tenía otro consumidor dentro de la edición
  // —a diferencia de `resumenOrden` en `MenuSeccion.tsx`— así que se retira entero con la fila, no
  // sólo de su render.
  if (!editando) {
    return (
      <FilaSeccion
        icono={<IconoFila tipo="footer" />}
        titulo="Pie de página"
        hayBorrador={hayBorrador}
        onAbrir={() => setEditando(true)}
      />
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Pie de página</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          {indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0, flexWrap: 'wrap' }}>
          <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Cerrar</button>
          {/* § EDITOR-TIENDA-CROMO-1 — ver el comentario de `MenuSeccion.tsx`: dentro del editor
              de pantalla completa, Publicar/Descartar viven en la barra GLOBAL. */}
          {!enEditor && hayBorrador && (
            <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
              Descartar
            </button>
          )}
          {!enEditor && hayBorrador && (
            <button type="button" onClick={() => accionBorrador('publicar')} className="duna-btn duna-btn--primary" disabled={!puedePublicar}>
              {procesando ? 'Publicando…' : 'Publicar'}
            </button>
          )}
        </div>
      </div>
      {errorServidor && (
        <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-2)', marginBottom: 0 }}>{errorServidor}</p>
      )}

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
              <AyudaCampo texto="Vacío: se usa el texto por defecto." />
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-tienda">Enlace — Todos los productos</label>
              <input id="footer-link-tienda" className="duna-input" value={form.linkTienda} onChange={(e) => cambiar({ linkTienda: e.target.value })} />
              <AyudaCampo texto="Va a /tienda. Vacío: se usa el texto por defecto." />
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-suscripciones">Enlace — Suscripciones</label>
              <input id="footer-link-suscripciones" className="duna-input" value={form.linkSuscripciones} onChange={(e) => cambiar({ linkSuscripciones: e.target.value })} />
              <AyudaCampo texto="Va a /suscripciones (se oculta si esa página está apagada). Vacío: se usa el texto por defecto." />
            </div>

            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-col-ayuda">Encabezado — Ayuda</label>
              <input id="footer-col-ayuda" className="duna-input" value={form.columnaAyuda} onChange={(e) => cambiar({ columnaAyuda: e.target.value })} />
              <AyudaCampo texto="Vacío: se usa el texto por defecto." />
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-rastrear">Enlace — Rastrear Pedido</label>
              <input id="footer-link-rastrear" className="duna-input" value={form.linkRastrearPedido} onChange={(e) => cambiar({ linkRastrearPedido: e.target.value })} />
              <AyudaCampo texto="Va a /rastrear-pedido. Vacío: se usa el texto por defecto." />
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-faq">Enlace — Preguntas Frecuentes</label>
              <input id="footer-link-faq" className="duna-input" value={form.linkPreguntasFrecuentes} onChange={(e) => cambiar({ linkPreguntasFrecuentes: e.target.value })} />
              <AyudaCampo texto="Va a /preguntas-frecuentes (se oculta si la FAQ está vacía). Vacío: se usa el texto por defecto." />
            </div>

            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-col-empresa">Encabezado — Empresa</label>
              <input id="footer-col-empresa" className="duna-input" value={form.columnaEmpresa} onChange={(e) => cambiar({ columnaEmpresa: e.target.value })} />
              <AyudaCampo texto="Vacío: se usa el texto por defecto." />
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-link-nosotros">Enlace — Nuestra Historia</label>
              <input id="footer-link-nosotros" className="duna-input" value={form.linkNuestraHistoria} onChange={(e) => cambiar({ linkNuestraHistoria: e.target.value })} />
              <AyudaCampo texto="Va a /nosotros (se oculta si esa página está apagada). Vacío: se usa el texto por defecto." />
            </div>

            {/* LA TARJETA DE IMAGEN opcional (§ MUESTRARIO-FOOTER-TARJETA-IMAGEN-1): en el muestrario
                es el mapa con marcador — una imagen que el dueño SUBE, no un proveedor de mapas.
                Sólo la muestra la composición "Marca arriba, columnas debajo"; vacía = sin tarjeta.
                Misma miniatura + botón "Subir" que la tarjeta promocional del menú (§ MenuSeccion.tsx). */}
            <div className="duna-field">
              <span className="duna-field__label">Tarjeta de imagen (opcional)</span>
              <AyudaCampo texto={'Sólo se ve con la composición "Marca arriba, columnas debajo". Vacía: no se muestra.'} />
              <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-2)' }}>
                <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                  {form.tarjetaImagen
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={form.tarjetaImagen} alt="" />
                    : <ImageIcon aria-hidden width={20} height={20} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => subidaImagen.pedir((url) => cambiar({ tarjetaImagen: url }))}
                    className="duna-btn duna-btn--secondary duna-btn--sm"
                    disabled={subidaImagen.subiendo}
                  >
                    <Upload /> {form.tarjetaImagen ? 'Cambiar' : 'Subir imagen'}
                  </button>
                  <span className="duna-field__hint" style={{ margin: 0 }}>
                    {subidaImagen.subiendo ? `Subiendo… ${subidaImagen.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
                  </span>
                  {subidaImagen.subiendo && <BarraProgreso pct={subidaImagen.progreso ?? 0} />}
                  {errorImagenTarjeta && <p className="duna-field__error" role="alert">{errorImagenTarjeta}</p>}
                </div>
              </div>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="footer-tarjeta-texto">Tarjeta de imagen — pie de texto</label>
              <input id="footer-tarjeta-texto" className="duna-input" value={form.tarjetaTexto} onChange={(e) => cambiar({ tarjetaTexto: e.target.value })} />
              <AyudaCampo texto={'Ej. "San Adolfo, Huila". Vacío: sin pie de texto.'} />
            </div>

            {/* § PIE-HECHO-POR-DUNA-1: el crédito de la plataforma, en la franja baja del pie — el
                texto y el destino (https://duna.solutions) son fijos, este switch sólo lo apaga. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
              <button
                type="button" role="switch" aria-checked={form.creditoDunaVisible}
                aria-label="Mostrar &quot;Hecho por Duna&quot;"
                onClick={() => cambiar({ creditoDunaVisible: !form.creditoDunaVisible })}
                className={`duna-switch${form.creditoDunaVisible ? ' is-on' : ''}`}
              >
                <span className="duna-switch__thumb" />
              </button>
              <div>
                <span className="duna-field__label" style={{ margin: 0 }}>Mostrar &quot;Hecho por Duna&quot;</span>
                <AyudaCampo texto="Una línea discreta en la franja más baja del pie, con un enlace a duna.solutions." />
              </div>
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

            <input ref={subidaImagen.inputRef} type="file" accept={ACCEPT_IMAGENES} onChange={subidaImagen.alElegir} hidden disabled={subidaImagen.subiendo} />
          </div>
        </div>

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
});

export default FooterSeccion;
