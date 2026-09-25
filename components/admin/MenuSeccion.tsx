'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload, ImageIcon } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import { MENU_ITEM_IDS, MENU_CTA_DESTINOS, resolverOrdenMenu, type MenuContent, type MenuItemId } from '@/lib/config/site-content-defaults';
import { CAMPO_LABEL_MENU, etiquetaOpcionMenu, intercambiarPosicionMenu, parAMedias, type CampoPosicionMenu } from '@/lib/config/menu-editor';
import { MAX_SUBIDA_DIRECTA_MB, ACCEPT_IMAGENES } from '@/constants/upload';

// ─── Bloque MENÚ DEL NAV — vive en /admin/tienda, editor BESPOKE SIN vista previa ────────────────
//
// § CROMO-MENU-PANEL-EDITOR-1, sobre el modelo ya construido y probado de § CROMO-MENU-COMO-DATO-1:
// ítems CONOCIDOS con etiqueta editable + reorden por TRES campos escalares + un CTA opcional sobre
// un set cerrado; default = el menú de HOY, byte-idéntico. Este bloque suma SÓLO la superficie de
// edición — el modelo, el schema y `StoreNav.tsx` NO se tocan.
//
// PATRÓN `PaletaSeccion`, NO `TiendaSeccionEditor` — la RULING de `CROMO-MENU-COMO-DATO-1` la
// resolvió el owner (2026-09-21, "se parece al prototipo"): el pipeline genérico de vista previa en
// vivo (`VistaTiendaEnVivo`) monta cada sección en un `Record<SeccionVista, ComponentType>`
// EXHAUSTIVO, y agregar 'menu' ahí obliga a una entrada que renderice `StoreNav` — medido en esa
// sesión: `StoreNav` importa `useCartStore`/`useSiteSettings` (los del storefront), que LANZAN
// fuera de su árbol (§ CLAUDE.md, "Montar un componente en OTRO árbol de providers"), y el archivo
// que haría falta tocar (`VistaTiendaEnVivo.tsx`) queda FUERA de `touches:` de este slice. Un editor
// BESPOKE —como `PaletaSeccion` para `tema`— evita las dos cosas: no importa `StoreNav`, no toca
// `tienda-secciones.ts` ni `VistaTiendaEnVivo.tsx`.
//
// LA ESCRITURA, a diferencia de `tema` (que tiene su propio endpoint `/api/site-content/tema`
// porque NO es una sección del REGISTRY), va por el camino GENÉRICO: `menu` SÍ está en `REGISTRY`
// (§ site-content-defaults.ts), así que el PUT/POST de `/api/site-content` —el mismo que usa
// `TiendaSeccionEditor` para cada sección (`guardarBorrador`/`publicarSeccion`/`descartarSeccion`)—
// ya lo acepta sin cambio. No se inventa una segunda vía de escritura.
//
// SIN VISTA PREVIA (owner): el menú es cromo transversal (aparece en TODA página), no contenido de
// una página — meterlo al pipeline de preview-en-vivo lo acopla a `VistaTiendaEnVivo` por lo de
// arriba. El resumen de lectura es TEXTO ("Tienda · Suscripciones · Nosotros"), no una miniatura.
//
// EL REORDEN ES POR SWAP, no por tres selects independientes que puedan chocar: elegir un ítem para
// una posición que YA ocupa otra posición intercambia las dos (§ `intercambiarPosicionMenu`,
// lib/config/menu-editor.ts). El estado resultante es SIEMPRE una permutación válida de
// `MENU_ITEM_IDS` — el 400 del `.refine()` de `menuEditableSchema` (dos posiciones con el mismo
// ítem) queda IMPOSIBLE de producir desde este editor, no rechazado después de intentarlo.
//
// EL PANEL DESPLEGABLE (mega-menu, § MUESTRARIO-MEGA-MENU-1) sigue el MISMO patrón que el BADGE:
// `panelItem` elige QUÉ ítem lo lleva (set cerrado `MENU_ITEM_IDS` + "Ninguno" = sin panel, el
// default byte-idéntico); sus 27 campos (intro+CTA, dos columnas de hasta 3 enlaces, la tarjeta) se
// atenúan sin ítem elegido, mismo tratamiento visual que `badgeTexto`. La imagen de la tarjeta sube
// por `useSubidaImagen` (§ el uploader compartido de la cáscara) — es el ÚNICO campo-imagen de este
// bloque, así que no hace falta el `subiendoCampo` que rastrea TiendaSeccionEditor entre varios.

type Form = MenuContent;

const POSICIONES: readonly CampoPosicionMenu[] = ['posicion1', 'posicion2', 'posicion3'];

// Las DOS columnas del panel, cada una con su título y hasta TRES enlaces — declarado como datos
// para recorrer con `.map` en vez de escribir el mismo bloque de campos seis veces (dos columnas ×
// tres enlaces). Los nombres son las claves REALES de `MenuContent` (§ site-content-defaults.ts).
interface CampoEnlacePanel { etiqueta: keyof Form; nota: keyof Form; destino: keyof Form; }
interface CampoColumnaPanel { titulo: keyof Form; enlaces: CampoEnlacePanel[]; }
const COLUMNAS_PANEL: readonly CampoColumnaPanel[] = [
  {
    titulo: 'panelCol1Titulo',
    enlaces: [
      { etiqueta: 'panelCol1Link1Etiqueta', nota: 'panelCol1Link1Nota', destino: 'panelCol1Link1Destino' },
      { etiqueta: 'panelCol1Link2Etiqueta', nota: 'panelCol1Link2Nota', destino: 'panelCol1Link2Destino' },
      { etiqueta: 'panelCol1Link3Etiqueta', nota: 'panelCol1Link3Nota', destino: 'panelCol1Link3Destino' },
    ],
  },
  {
    titulo: 'panelCol2Titulo',
    enlaces: [
      { etiqueta: 'panelCol2Link1Etiqueta', nota: 'panelCol2Link1Nota', destino: 'panelCol2Link1Destino' },
      { etiqueta: 'panelCol2Link2Etiqueta', nota: 'panelCol2Link2Nota', destino: 'panelCol2Link2Destino' },
      { etiqueta: 'panelCol2Link3Etiqueta', nota: 'panelCol2Link3Nota', destino: 'panelCol2Link3Destino' },
    ],
  },
];

export default function MenuSeccion() {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [errorImagenPanel, setErrorImagenPanel] = useState<string | null>(null);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // El uploader de la imagen de la tarjeta promocional (§ MUESTRARIO-MEGA-MENU-1) — el mismo hook
  // compartido que la cáscara y el repeater (§ useSubidaImagen.ts), un `<input>` propio, `subiendo`.
  const subidaImagen = useSubidaImagen({ onError: setErrorImagenPanel });

  // AUTOGUARDADO del borrador — la MISMA máquina que las secciones (§ useAutoguardado), pero el PUT
  // va por el endpoint GENÉRICO de contenido (`menu` es una sección de REGISTRY), no por uno propio.
  const guardarMenu = useCallback(async (data: Form) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarMenu);

  // Carga el menú draft-merged (GET /api/site-content → `contenido.menu` + `sinPublicar.menu`) —
  // el mismo endpoint que lee cada sección; sólo se toma la rebanada de esta.
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setForm(d.contenido.menu as Form);
      setHayBorrador(!!d.sinPublicar?.menu);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar el menú.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión), igual que las secciones: pendiente/guardando es
  // común y recuperable; un guardado que FALLÓ y no persiste es el caso grave.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  const cambiar = (parcial: Partial<Form>) => {
    if (Object.keys(parcial).length === 0) return; // el swap-no-op de `intercambiarPosicionMenu`
    const nf = { ...(formRef.current as Form), ...parcial };
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
  };

  const cambiarPosicion = (campo: CampoPosicionMenu, nuevoId: MenuItemId) =>
    cambiar(intercambiarPosicionMenu(formRef.current as Form, campo, nuevoId));

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  // Helpers GENÉRICOS para los 27 campos planos del panel (§ MUESTRARIO-MEGA-MENU-1): leer/escribir
  // por CLAVE, en vez de repetir `form.panelX ?? ''` / `cambiar({panelX: …})` a mano en cada campo.
  const valorCampo = (campo: keyof Form): string => (formRef.current?.[campo] as string | undefined) ?? '';
  const setCampo = (campo: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    cambiar({ [campo]: e.target.value } as Partial<Form>);

  // El destino de un enlace del panel (intro, cada enlace de columna, la tarjeta) es del MISMO SET
  // CERRADO `MENU_CTA_DESTINOS` que el CTA del menú — un `<select>` nativo, repetido seis veces.
  const renderDestino = (campo: keyof Form, id: string) => (
    <select id={id} className="duna-input duna-select" value={valorCampo(campo)} onChange={setCampo(campo)}>
      <option value="">Sin destino</option>
      {MENU_CTA_DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
  );

  // Publicar / Descartar el borrador de esta sección (POST /api/site-content, el mismo camino que
  // TiendaSeccionEditor usa para cada sección).
  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion: 'menu' }),
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
        <span className="duna-sr-only">Cargando el menú…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', height: '72px', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar el menú.'}</p>
      </div>
    );
  }

  const orden = resolverOrdenMenu([form.posicion1, form.posicion2, form.posicion3]);
  const resumenOrden = orden.map((id) => etiquetaOpcionMenu(form, id)).join(' · ');
  const ctaLabelPresente = form.ctaLabel.trim() !== '';
  const ctaDestinoPresente = (MENU_CTA_DESTINOS as readonly string[]).includes(form.ctaDestino);
  const ctaCompleto = ctaLabelPresente && ctaDestinoPresente;
  const ctaAMedias = parAMedias(form.ctaLabel, form.ctaDestino);
  const badgeTextoAtenuado = (form.badgeItem ?? '') === ''; // sin ítem elegido, el texto no se muestra
  const panelAtenuado = (form.panelItem ?? '') === ''; // sin ítem elegido, el panel no se muestra
  const panelIntroCtaAMedias = parAMedias(form.panelIntroCtaLabel ?? '', form.panelIntroCtaDestino ?? '');
  const panelTarjetaCtaAMedias = parAMedias(form.panelTarjetaCtaLabel ?? '', form.panelTarjetaCtaDestino ?? '');

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

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Menú del nav</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          {!editando && (
            <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
              Los enlaces de la barra de navegación: renombra cada uno, cambia el orden, y agrega un
              botón adicional si quieres.
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
          <p className="duna-sub" style={{ margin: 0 }}>
            {resumenOrden}
            {ctaCompleto && <> · botón «{form.ctaLabel}»</>}
          </p>
        </div>
      ) : (
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div className="duna-form">
            {/* Las TRES etiquetas — el destino de cada una es ESTRUCTURA (fijo), sólo el texto se
                edita. `posicionX` (abajo) hace las tres COLGABLES en el orden que se muestran. */}
            {MENU_ITEM_IDS.map((id) => {
              const campoLabel = CAMPO_LABEL_MENU[id];
              return (
                <div key={id} className="duna-field">
                  <label className="duna-field__label" htmlFor={`menu-label-${id}`}>
                    Etiqueta — {etiquetaOpcionMenu(form, id)}
                  </label>
                  <input
                    id={`menu-label-${id}`} className="duna-input"
                    value={form[campoLabel]}
                    onChange={(e) => cambiar({ [campoLabel]: e.target.value } as Partial<Form>)}
                  />
                  <p className="duna-field__hint">Vacío: se usa el texto por defecto.</p>
                </div>
              );
            })}

            {/* EL ORDEN — tres selects nativos de opciones fijas (§ Controles de formulario, el
                select es NATIVO), uno por posición. Elegir un ítem que ya está en otra posición
                las INTERCAMBIA (§ `intercambiarPosicionMenu`) — nunca produce un duplicado. */}
            <div>
              <span className="duna-field__label">Orden</span>
              <div style={{ display: 'flex', gap: 'var(--duna-space-3)', flexWrap: 'wrap', marginTop: 'var(--duna-space-2)' }}>
                {POSICIONES.map((campo, i) => (
                  <div key={campo} className="duna-field" style={{ flex: '1 1 160px' }}>
                    <label className="duna-field__label" htmlFor={`menu-${campo}`}>{`Posición ${i + 1}`}</label>
                    <select
                      id={`menu-${campo}`} className="duna-input duna-select"
                      value={form[campo]}
                      onChange={(e) => cambiarPosicion(campo, e.target.value as MenuItemId)}
                    >
                      {MENU_ITEM_IDS.map((idOpcion) => (
                        <option key={idOpcion} value={idOpcion}>{etiquetaOpcionMenu(form, idOpcion)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="duna-field__hint">Así se ve hoy: {resumenOrden}</p>
            </div>

            {/* EL CTA — opcional, apagado por defecto. Su destino es del SET CERRADO
                `MENU_CTA_DESTINOS` (mismo patrón que `HERO_HREFS`): el dueño ELIGE entre rutas que
                ya existen, nunca escribe una libre. */}
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="menu-cta-label">Botón adicional (opcional)</label>
              <input
                id="menu-cta-label" className="duna-input"
                value={form.ctaLabel}
                onChange={(e) => cambiar({ ctaLabel: e.target.value })}
                placeholder="Ej. Contáctanos"
              />
              <p className="duna-field__hint">Vacío: no se muestra ningún botón.</p>
            </div>
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="menu-cta-destino">Destino del botón</label>
              <select
                id="menu-cta-destino" className="duna-input duna-select"
                value={form.ctaDestino}
                onChange={(e) => cambiar({ ctaDestino: e.target.value })}
              >
                <option value="">Sin destino</option>
                {MENU_CTA_DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {ctaAMedias && (
                <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)' }}>
                  ⚠ Falta {ctaLabelPresente ? 'el destino' : 'el texto'} — el botón no se muestra hasta completar los dos.
                </p>
              )}
            </div>

            {/* EL BADGE (§ CORTE-BADGE-COSECHA-EN-MENU-1) — qué ítem lo lleva y su texto. `badgeItem`
                es del SET CERRADO `MENU_ITEM_IDS` + "Ninguno" (`''`, el default byte-idéntico: sin
                badge); `badgeTexto` es texto libre. Sin ítem elegido, el texto no hace nada —se
                muestra ATENUADO (mismo tratamiento visual que un campo gateado por un interruptor
                apagado, § gatePorCampo/campoAtenuado en tienda-secciones.ts), el dato se conserva
                editable para cuando se elija un ítem. */}
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="menu-badge-item">Ítem con badge (opcional)</label>
              <select
                id="menu-badge-item" className="duna-input duna-select"
                value={form.badgeItem ?? ''}
                onChange={(e) => cambiar({ badgeItem: e.target.value })}
              >
                <option value="">Ninguno</option>
                {MENU_ITEM_IDS.map((id) => <option key={id} value={id}>{etiquetaOpcionMenu(form, id)}</option>)}
              </select>
              <p className="duna-field__hint">Ninguno: no se muestra ningún badge.</p>
            </div>
            <div className="duna-field" style={badgeTextoAtenuado ? { opacity: 0.6 } : undefined}>
              <label className="duna-field__label" htmlFor="menu-badge-texto">Texto del badge</label>
              <input
                id="menu-badge-texto" className="duna-input"
                value={form.badgeTexto ?? ''}
                onChange={(e) => cambiar({ badgeTexto: e.target.value })}
                placeholder="Ej. Cosecha 2026"
              />
              <p className="duna-field__hint">
                {badgeTextoAtenuado ? 'Elige un ítem arriba para que este texto se muestre.' : 'Vacío: no se muestra ningún badge.'}
              </p>
            </div>

            {/* EL PANEL DESPLEGABLE (mega-menu, § MUESTRARIO-MEGA-MENU-1) — medido contra el
                prototipo (docs/prototipos/cafeone/index.html:57-89, #mega-cafe): copy introductorio
                + su CTA, DOS columnas de sub-enlaces, una tarjeta promocional. MISMO patrón que el
                badge de arriba: `panelItem` elige QUÉ ítem lo lleva (set cerrado `MENU_ITEM_IDS` +
                "Ninguno" = sin panel, el default byte-idéntico); el resto se ATENÚA sin ítem
                elegido, el dato se conserva editable para cuando se elija uno. Vacío/a-medias
                (§ `panelDeMenuItem`) el ítem sigue siendo un enlace simple — preferir callar a un
                desplegable sin nada adentro. */}
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="menu-panel-item">Ítem con panel desplegable (opcional)</label>
              <select
                id="menu-panel-item" className="duna-input duna-select"
                value={form.panelItem ?? ''}
                onChange={(e) => cambiar({ panelItem: e.target.value })}
              >
                <option value="">Ninguno</option>
                {MENU_ITEM_IDS.map((id) => <option key={id} value={id}>{etiquetaOpcionMenu(form, id)}</option>)}
              </select>
              <p className="duna-field__hint">Ninguno: el ítem sigue siendo un enlace simple, sin desplegable.</p>
            </div>

            <div style={panelAtenuado ? { opacity: 0.6 } : undefined}>
              <div className="duna-field">
                <label className="duna-field__label" htmlFor="menu-panel-intro">Texto introductorio</label>
                <textarea
                  id="menu-panel-intro" className="duna-input" rows={2}
                  value={form.panelIntro ?? ''} onChange={setCampo('panelIntro')}
                />
                <p className="duna-field__hint">Vacío: no se muestra ningún texto.</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--duna-space-3)', flexWrap: 'wrap' }}>
                <div className="duna-field" style={{ flex: '1 1 200px' }}>
                  <label className="duna-field__label" htmlFor="menu-panel-intro-cta-label">Botón del texto introductorio</label>
                  <input
                    id="menu-panel-intro-cta-label" className="duna-input"
                    value={form.panelIntroCtaLabel ?? ''} onChange={setCampo('panelIntroCtaLabel')}
                    placeholder="Ej. Ver producto"
                  />
                </div>
                <div className="duna-field" style={{ flex: '1 1 160px' }}>
                  <label className="duna-field__label" htmlFor="menu-panel-intro-cta-destino">Destino del botón</label>
                  {renderDestino('panelIntroCtaDestino', 'menu-panel-intro-cta-destino')}
                </div>
              </div>
              {panelIntroCtaAMedias && (
                <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)' }}>
                  ⚠ Falta {(form.panelIntroCtaLabel ?? '').trim() !== '' ? 'el destino' : 'el texto'} — el botón no se muestra hasta completar los dos.
                </p>
              )}

              {/* LAS DOS COLUMNAS de sub-enlaces (§ COLUMNAS_PANEL, arriba). Cada enlace vacío de
                  etiqueta simplemente no se muestra (§ `resolverEnlacePanel`) — no hace falta un
                  botón "Agregar"/"Quitar": los TRES slots por columna ya están ahí, como los
                  bullets de Suscripción. */}
              {COLUMNAS_PANEL.map((col, i) => (
                <div key={col.titulo} style={{ marginTop: 'var(--duna-space-4)' }}>
                  <div className="duna-field">
                    <label className="duna-field__label" htmlFor={`menu-${col.titulo}`}>{`Columna ${i + 1} — encabezado`}</label>
                    <input id={`menu-${col.titulo}`} className="duna-input" value={valorCampo(col.titulo)} onChange={setCampo(col.titulo)} />
                  </div>
                  {col.enlaces.map((en, j) => (
                    <div key={en.etiqueta} style={{ display: 'flex', gap: 'var(--duna-space-3)', flexWrap: 'wrap', marginTop: 'var(--duna-space-2)' }}>
                      <div className="duna-field" style={{ flex: '1 1 160px' }}>
                        <label className="duna-field__label" htmlFor={`menu-${en.etiqueta}`}>{`Enlace ${j + 1} — etiqueta`}</label>
                        <input id={`menu-${en.etiqueta}`} className="duna-input" value={valorCampo(en.etiqueta)} onChange={setCampo(en.etiqueta)} />
                      </div>
                      <div className="duna-field" style={{ flex: '1 1 120px' }}>
                        <label className="duna-field__label" htmlFor={`menu-${en.nota}`}>Nota (opcional)</label>
                        <input id={`menu-${en.nota}`} className="duna-input" value={valorCampo(en.nota)} onChange={setCampo(en.nota)} />
                      </div>
                      <div className="duna-field" style={{ flex: '1 1 140px' }}>
                        <label className="duna-field__label" htmlFor={`menu-${en.destino}`}>Destino</label>
                        {renderDestino(en.destino, `menu-${en.destino}`)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* LA TARJETA promocional: imagen + título + CTA. Misma miniatura + botón "Subir" que
                  usan hero/brandStory (§ TiendaSeccionEditor.tsx, `renderMiniatura`) — sin "Por
                  defecto": no hay una imagen de fábrica para una tarjeta que hoy nadie declara. */}
              <div className="duna-field" style={{ marginTop: 'var(--duna-space-4)' }}>
                <span className="duna-field__label">Tarjeta promocional — imagen</span>
                <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
                  <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                    {form.panelTarjetaImagen
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={form.panelTarjetaImagen} alt="" />
                      : <ImageIcon aria-hidden width={20} height={20} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => subidaImagen.pedir((url) => cambiar({ panelTarjetaImagen: url }))}
                      className="duna-btn duna-btn--secondary duna-btn--sm"
                      disabled={subidaImagen.subiendo}
                    >
                      <Upload /> {form.panelTarjetaImagen ? 'Cambiar' : 'Subir imagen'}
                    </button>
                    <span className="duna-field__hint" style={{ margin: 0 }}>
                      {subidaImagen.subiendo ? `Subiendo… ${subidaImagen.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
                    </span>
                    {subidaImagen.subiendo && <BarraProgreso pct={subidaImagen.progreso ?? 0} />}
                    {errorImagenPanel && <p className="duna-field__error" role="alert">{errorImagenPanel}</p>}
                  </div>
                </div>
              </div>
              <div className="duna-field">
                <label className="duna-field__label" htmlFor="menu-panel-tarjeta-titulo">Tarjeta promocional — título</label>
                <input id="menu-panel-tarjeta-titulo" className="duna-input" value={form.panelTarjetaTitulo ?? ''} onChange={setCampo('panelTarjetaTitulo')} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--duna-space-3)', flexWrap: 'wrap' }}>
                <div className="duna-field" style={{ flex: '1 1 200px' }}>
                  <label className="duna-field__label" htmlFor="menu-panel-tarjeta-cta-label">Tarjeta promocional — botón</label>
                  <input
                    id="menu-panel-tarjeta-cta-label" className="duna-input"
                    value={form.panelTarjetaCtaLabel ?? ''} onChange={setCampo('panelTarjetaCtaLabel')}
                    placeholder="Ej. Explorar"
                  />
                </div>
                <div className="duna-field" style={{ flex: '1 1 160px' }}>
                  <label className="duna-field__label" htmlFor="menu-panel-tarjeta-cta-destino">Destino del botón</label>
                  {renderDestino('panelTarjetaCtaDestino', 'menu-panel-tarjeta-cta-destino')}
                </div>
              </div>
              {panelTarjetaCtaAMedias && (
                <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)' }}>
                  ⚠ Falta {(form.panelTarjetaCtaLabel ?? '').trim() !== '' ? 'el destino' : 'el texto'} — el botón no se muestra hasta completar los dos.
                </p>
              )}
              <p className="duna-field__hint">
                {panelAtenuado ? 'Elige un ítem arriba para que este panel se muestre.' : 'El panel se muestra cuando tenga al menos un texto, un enlace o la tarjeta completos.'}
              </p>
            </div>

            <input ref={subidaImagen.inputRef} type="file" accept={ACCEPT_IMAGENES} onChange={subidaImagen.alElegir} hidden disabled={subidaImagen.subiendo} />
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás al menú publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
