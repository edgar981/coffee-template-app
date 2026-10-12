'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import type { VendedorContent } from '@/lib/config/site-content-defaults';
import { camposVendedorFaltantes, lineaVendedor } from '@/lib/legal/plantillas';

// ─── Bloque IDENTIDAD DEL VENDEDOR — vive en el editor, junto a Detalles del sitio ────────────────
//
// § TIENDA-LEGAL-1 — los 14 campos que sustituyen la plantilla fija de las cuatro páginas legales
// (`/legal/…`), el bloque «Vendedor» del checkout, la línea del pie y la del cajón del carrito
// (ver el docstring de `VendedorContent`, site-content-defaults.ts, para el porqué de cada campo y
// de que vivan en `SiteContent` — JSON, sin migración — y no en `SiteSetting`).
//
// PATRÓN `MenuSeccion`/`FooterSeccion`, NO `TiendaSeccionEditor`: `vendedor` SÍ está en `REGISTRY`
// (así que el PUT/POST GENÉRICO de `/api/site-content` ya la acepta, sin tocar ese archivo), pero
// no hay una página real del storefront a la que esta identidad "pertenezca" — no es contenido de
// /tienda, /nosotros ni /suscripciones—, así que forzarla a `SECCIONES_TIENDA` exigiría un
// `pagina: PaginaKey` arbitrario y una entrada nueva en el `Record<SeccionVista, ComponentType>`
// EXHAUSTIVO de `VistaTiendaEnVivo.tsx` para algo que no tiene nada que previsualizar — el mismo
// argumento que ya descartó ese camino para `menu`/`footer`.
//
// SIN VISTA PREVIA EN VIVO, por lo mismo. En su lugar, una LÍNEA DE MUESTRA («Así se vería: …») que
// usa `lineaVendedor(form, 'editor')` — el modo que marca «[dato pendiente]» en vez de ocultar el
// hueco (§ el spec: "muestra el hueco como «[dato pendiente]» sólo en la vista del editor"). Es la
// ÚNICA superficie que lo hace: el checkout, el pie y el cajón llaman a la MISMA función en modo
// 'publico', que nunca deja ver un hueco a un comprador.
//
// EL AVISO DE QUÉ FALTA (§ el spec: "el panel avisa qué falta") usa `camposVendedorFaltantes` —
// la MISMA función que decide si las páginas legales se enlazan (`vendedorEstaCompleto`), nunca
// una segunda lista de "campos obligatorios" que pudiera divergir.

type Form = Omit<VendedorContent, 'visible'>;

interface CampoVendedor {
  name: Exclude<keyof Form, 'tipoPersona' | 'documentoTipo'>;
  label: string;
  placeholder?: string;
}

const CAMPOS_TEXTO: CampoVendedor[] = [
  { name: 'nombreCompleto', label: 'Nombre completo o razón social', placeholder: 'Ej. Juana Pérez Gómez' },
  { name: 'documentoNumero', label: 'Número de documento' },
  { name: 'nombreComercial', label: 'Nombre comercial (si vende con otro nombre)', placeholder: 'Ej. La Casa del Café' },
  { name: 'direccion', label: 'Dirección de notificación' },
  { name: 'ciudad', label: 'Ciudad' },
  { name: 'correo', label: 'Correo de contacto' },
  { name: 'telefono', label: 'Teléfono / WhatsApp de atención' },
  { name: 'horarioAtencion', label: 'Horario de atención', placeholder: 'Ej. Lunes a viernes, 8am a 5pm' },
  { name: 'municipioDespacho', label: 'Despacha desde (municipio)' },
  { name: 'transportadoras', label: 'Transportadora(s)', placeholder: 'Ej. Servientrega, o "mensajero propio"' },
  { name: 'diasPreparacionHabiles', label: 'Días hábiles para preparar un pedido', placeholder: 'Ej. 2' },
  { name: 'ventanaCambiosDias', label: 'Días para pedir un cambio por gusto', placeholder: 'Ej. 5' },
];

const LABEL_CAMPO_REQUERIDO: Record<string, string> = {
  nombreCompleto: 'Nombre completo o razón social',
  documentoNumero: 'Número de documento',
  ciudad: 'Ciudad',
  correo: 'Correo de contacto',
  telefono: 'Teléfono / WhatsApp de atención',
};

export default function VendedorSeccion() {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // AUTOGUARDADO del borrador — la MISMA máquina que `menu`/`footer`, pero el PUT va por el
  // endpoint GENÉRICO de contenido (`vendedor` es una sección de REGISTRY), no por uno propio.
  const guardarVendedor = useCallback(async (data: Form) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedor: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarVendedor);

  // Carga el draft-merged (GET /api/site-content → `contenido.vendedor` + `sinPublicar.vendedor`) —
  // el mismo endpoint que lee cada sección; sólo se toma la rebanada de ésta.
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setForm(d.contenido.vendedor as Form);
      setHayBorrador(!!d.sinPublicar?.vendedor);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar la identidad del vendedor.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión, igual que las otras secciones): pendiente/guardando
  // es común y recuperable; un guardado que FALLÓ y no persiste es el caso grave.
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
        body: JSON.stringify({ accion, seccion: 'vendedor' }),
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
        <span className="duna-sr-only">Cargando la identidad del vendedor…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', height: '80px', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar la identidad del vendedor.'}</p>
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

  // La lectura resumida dice CUÁNTO FALTA — "N de M, qué falta" — no sólo "incompleta": el dueño
  // tiene que poder decidir si entra a completar sin abrir el editor primero.
  const faltantes = camposVendedorFaltantes({ ...form, visible: true });
  const resumenLectura = faltantes.length === 0
    ? 'Completa — las páginas legales ya pueden publicarse.'
    : `Falta: ${faltantes.map((c) => LABEL_CAMPO_REQUERIDO[c] ?? c).join(', ')}.`;

  if (!editando) {
    return (
      <FilaSeccion
        icono={<IconoFila tipo="generico" />}
        titulo="Identidad del vendedor"
        hayBorrador={hayBorrador}
        dim={faltantes.length > 0}
        onAbrir={() => setEditando(true)}
      />
    );
  }

  const linea = lineaVendedor({ ...form, visible: true }, 'editor');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Identidad del vendedor</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          <p className="duna-caption" style={{ marginTop: 'var(--duna-space-1)' }}>
            Sustituye los textos legales de la tienda (términos, tratamiento de datos, envíos y
            devoluciones, cookies) y aparece en el checkout y en el pie. Se guarda y publica aparte
            del resto de la tienda — no cuenta en el "Publicar" de la barra de arriba.
          </p>
          <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)', color: faltantes.length > 0 ? 'var(--duna-sol-ink)' : undefined }}>
            {resumenLectura}
          </p>
          {linea && (
            <p className="duna-caption" style={{ marginTop: 'var(--duna-space-2)' }}>
              Así se ve: <strong>{linea}</strong>
            </p>
          )}
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
            <label className="duna-field__label" htmlFor="vendedor-tipo-persona">Tipo</label>
            <select
              id="vendedor-tipo-persona" className="duna-input duna-select"
              value={form.tipoPersona} onChange={(e) => cambiar('tipoPersona', e.target.value)}
            >
              <option value="">Sin elegir</option>
              <option value="natural">Persona natural</option>
              <option value="juridica">Persona jurídica (sociedad)</option>
            </select>
          </div>
          <div className="duna-field">
            <label className="duna-field__label" htmlFor="vendedor-documento-tipo">Documento</label>
            <select
              id="vendedor-documento-tipo" className="duna-input duna-select"
              value={form.documentoTipo} onChange={(e) => cambiar('documentoTipo', e.target.value)}
            >
              <option value="">Sin elegir</option>
              <option value="cc">C.C.</option>
              <option value="nit">NIT</option>
            </select>
          </div>
          {CAMPOS_TEXTO.map((c) => (
            <div key={c.name} className="duna-field">
              <label className="duna-field__label" htmlFor={`vendedor-${c.name}`}>{c.label}</label>
              <input
                id={`vendedor-${c.name}`} className="duna-input"
                value={form[c.name]} placeholder={c.placeholder}
                onChange={(e) => cambiar(c.name, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a la identidad del vendedor publicada. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
