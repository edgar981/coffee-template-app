'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import type { CompraContent } from '@/lib/config/site-content-defaults';

// ─── Bloque CAMINO DE COMPRA — vive en el editor, junto a Identidad del vendedor ──────────────────
//
// § COMPRA-LINEAS-ONIX-CHAMISAS-1 — los TRES ejes de composición del camino de compra: el cajón del
// carrito, la confirmación/página de estado, y el seguimiento. Cada uno es un `<select>` nativo
// (§ CLAUDE.md, "el select es NATIVO" — una lista CERRADA y corta, sin competencia con otra lista
// visible en esta misma pantalla).
//
// PATRÓN `VendedorSeccion`, NO `TiendaSeccionEditor`: `compra` SÍ está en `REGISTRY` (así que el
// PUT/POST GENÉRICO de `/api/site-content` ya la acepta, sin tocar ese archivo), pero no hay una
// página real del storefront a la que esta elección "pertenezca" para armar una vista previa en
// vivo — el cajón necesita estado de carrito, la confirmación un pedido ya creado, el seguimiento
// una búsqueda. El MISMO argumento que ya descartó ese camino para `vendedor`/`menu`/`footer`.
//
// SIN VISTA PREVIA EN VIVO, por lo mismo — en su lugar, el nombre del tratamiento elegido.

type Form = Omit<CompraContent, never>;

interface OpcionCompra<K extends keyof Form> {
  value: Form[K];
  label: string;
}

const OPCIONES_CAJON: OpcionCompra<'cajon'>[] = [
  { value: 'comun', label: 'Común — el cajón de hoy' },
  { value: 'creditos', label: 'Créditos — filas de taquilla, pie de créditos (Onix)' },
  { value: 'album', label: 'Álbum — franja de tejido, miniatura sobre el color del café (Las Chamisas)' },
];

const OPCIONES_CONFIRMACION: OpcionCompra<'confirmacion'>[] = [
  { value: 'comun', label: 'Sobria — la confirmación de hoy' },
  { value: 'boleto', label: 'Boleto — bloque de acento con muescas y línea troquelada (Onix)' },
  { value: 'lamina', label: 'Lámina — tarjeta de álbum con sticker de estado (Las Chamisas)' },
];

const OPCIONES_SEGUIMIENTO: OpcionCompra<'seguimiento'>[] = [
  { value: 'comun', label: 'Común — el seguimiento de hoy' },
  { value: 'escaleta', label: 'Escaleta — filete vertical, estado en mayúsculas (Onix)' },
  { value: 'album', label: 'Álbum — estados cumplidos como sticker pegado (Las Chamisas)' },
];

function etiquetaDe<K extends keyof Form>(opciones: OpcionCompra<K>[], valor: Form[K]): string {
  return opciones.find((o) => o.value === valor)?.label ?? valor;
}

export default function CompraSeccion() {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // AUTOGUARDADO del borrador — la MISMA máquina que `vendedor`, por el endpoint GENÉRICO de
  // contenido (`compra` es una sección de REGISTRY), no uno propio.
  const guardarCompra = useCallback(async (data: Form) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compra: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarCompra);

  // Carga el draft-merged (GET /api/site-content → `contenido.compra` + `sinPublicar.compra`).
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setForm(d.contenido.compra as Form);
      setHayBorrador(!!d.sinPublicar?.compra);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar el camino de compra.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión, igual que `vendedor`): pendiente/guardando es común y
  // recuperable; un guardado que FALLÓ y no persiste es el caso grave.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  const cambiar = (campo: keyof Form, valor: string) => {
    const nf = { ...(formRef.current as Form), [campo]: valor };
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
  };

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion: 'compra' }),
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
        <span className="duna-sr-only">Cargando el camino de compra…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', height: '80px', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar el camino de compra.'}</p>
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

  const resumenLectura = `Cajón: ${etiquetaDe(OPCIONES_CAJON, form.cajon)} · Confirmación: ${etiquetaDe(OPCIONES_CONFIRMACION, form.confirmacion)} · Seguimiento: ${etiquetaDe(OPCIONES_SEGUIMIENTO, form.seguimiento)}`;

  if (!editando) {
    return (
      <FilaSeccion
        icono={<IconoFila tipo="generico" />}
        titulo="Camino de compra"
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
            <h2 className="duna-title">Camino de compra</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          <p className="duna-caption" style={{ marginTop: 'var(--duna-space-1)' }}>
            El tratamiento del cajón del carrito, la confirmación/página de estado, y el seguimiento
            del pedido. &ldquo;Común&rdquo;/&ldquo;Sobria&rdquo; es la estructura de siempre —
            eligiendo otra, se ve distinto sin tocar el carrito, la confirmación ni el seguimiento ajenos.
          </p>
          <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>{resumenLectura}</p>
          {indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
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
      </div>
      {errorServidor && (
        <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-2)', marginBottom: 0 }}>{errorServidor}</p>
      )}

      <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="compra-cajon">Cajón del carrito</label>
            <select
              id="compra-cajon" className="duna-input duna-select"
              value={form.cajon} onChange={(e) => cambiar('cajon', e.target.value)}
            >
              {OPCIONES_CAJON.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="compra-confirmacion">Confirmación y página de estado</label>
            <select
              id="compra-confirmacion" className="duna-input duna-select"
              value={form.confirmacion} onChange={(e) => cambiar('confirmacion', e.target.value)}
            >
              {OPCIONES_CONFIRMACION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="compra-seguimiento">Seguimiento del pedido</label>
            <select
              id="compra-seguimiento" className="duna-input duna-select"
              value={form.seguimiento} onChange={(e) => cambiar('seguimiento', e.target.value)}
            >
              {OPCIONES_SEGUIMIENTO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás al camino de compra publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
