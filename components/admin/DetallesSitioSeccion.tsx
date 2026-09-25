'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';

// ─── Bloque DETALLES DEL SITIO — vive en /admin/tienda, junto a Colores/Menú/Encabezado/Pie ─────────
//
// § PANEL-DETALLES-SITIO-1: el nombre que el owner le dio (2026-09-23) a "volver arriba y redes
// sociales" — los DOS ejes de chrome que `PANEL-EDITOR-ENCABEZADO-1` dejó explícitamente FUERA de su
// alcance ("son 'Detalles del sitio', fuera de este slice, con su propio disparador futuro"). Cerró
// las DOS últimas entradas del grupo `PANEL-EDITOR-CHROME-METAS-1` en `PENDIENTE_PANEL`
// (`lib/config/panel-controles.ts`): `volverArriba.visible`, `rielSocial.visible`.
//
// § MUESTRARIO-CARRITO-BARRA-ENVIO-1 sumó un TERCER switch a esta MISMA sección: la barra de
// progreso de envío gratis del carrito (`carritoEnvio.visible`). No cerró ninguna entrada de
// `PENDIENTE_PANEL` —nace YA controlada, nunca pasó por ahí— así que el techo del trinquete
// (`lib/config/panel-controles.test.ts`) no bajó por este cambio.
//
// PATRÓN `EncabezadoSeccion`/`PaletaSeccion`/`MenuSeccion`, NO `TiendaSeccionEditor`: los tres
// switches viven en TRES claves META que `SeccionKey` EXCLUYE del REGISTRY (`volverArriba`,
// `rielSocial`, `carritoEnvio`, § site-content-defaults.ts) — no son una sección, así que
// `TiendaSeccionEditor` no tiene forma de montarlas, y el route GENÉRICO de contenido rechaza
// publicarlas/descartarlas (`seccion in REGISTRY`, § app/api/site-content/route.ts:88). Por eso
// tienen su PROPIA ruta (`/api/site-content/detalles`, patrón `tema`/`encabezado`).
//
// A DIFERENCIA de `EncabezadoSeccion` (que lee por el GET GENÉRICO `/api/site-content`, con
// `sinPublicar.encabezado` calculado en `lib/config/site-content-read.ts`), esta sección lee por el
// GET PROPIO de su ruta (`/api/site-content/detalles`) — decisión de ALCANCE de este slice, no una
// segunda forma de resolver el borrador: `lib/config/site-content-read.ts` no está en `touches:`, así
// que sumarle una clave ahí habría ensanchado un archivo compartido fuera de lo declarado. Ver el
// docstring de la ruta para el porqué completo.
//
// CADA SWITCH ES UN EJE INDEPENDIENTE DE UN OBJETO DE UNA SOLA CLAVE (`{visible: boolean}`) — a
// diferencia de `cromo` (tres claves, con `navBadge` reenviado sin editor propio), acá NO hay ningún
// campo que reenviar: el wire de cada meta es su forma COMPLETA por construcción.
//
// SIN VISTA PREVIA EN VIVO (mismo motivo que `EncabezadoSeccion`/`MenuSeccion`/`FooterSeccion`): los
// TRES componentes reales del storefront (`BackToTop`, `RielSocial`, el pie de `CartDrawer`)
// importan hooks (`useCartStore`/`useSiteSettings`/`useSiteContent`) que LANZAN fuera de su árbol de
// providers (§ CLAUDE.md, "Montar un componente en OTRO árbol de providers"). El resumen de lectura
// es TEXTO, como en esas tres.

interface Form {
  volverArriba: boolean; // volverArriba.visible
  rielSocial: boolean;   // rielSocial.visible
  carritoEnvio: boolean; // carritoEnvio.visible
}

interface Wire {
  volverArriba: { visible: boolean };
  rielSocial: { visible: boolean };
  carritoEnvio: { visible: boolean };
}

const CONTROLES: { name: keyof Form; label: string; hint: string }[] = [
  { name: 'volverArriba', label: 'Botón "volver arriba"', hint: 'Un botón flotante que aparece al bajar por la página y lleva de vuelta al inicio.' },
  { name: 'rielSocial', label: 'Riel social', hint: 'Un riel fijo a un lado de la pantalla con tus redes sociales — usa las que ya cargaste en Configuración. Sólo se ve en pantallas anchas, y sólo si hay al menos una red cargada.' },
  { name: 'carritoEnvio', label: 'Barra de progreso de envío gratis', hint: 'En el carrito, muestra una barra que se llena a medida que el cliente se acerca al envío gratis, en vez del texto fijo de siempre.' },
];

export default function DetallesSitioSeccion() {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // El WIRE que viaja al PUT: las tres metas COMPLETAS — cada una un objeto de una sola clave, así
  // que no hay nada que reenviar sin editar (a diferencia de `cromo.navBadge` en `EncabezadoSeccion`).
  const wireDe = (f: Form): Wire => ({
    volverArriba: { visible: f.volverArriba },
    rielSocial: { visible: f.rielSocial },
    carritoEnvio: { visible: f.carritoEnvio },
  });

  const guardarDetalles = useCallback(async (w: Wire) => {
    const res = await fetch('/api/site-content/detalles', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(w),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarDetalles);

  // Carga el draft-merged de las dos metas por el GET PROPIO de la ruta (§ el docstring de arriba).
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content/detalles');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const contenido = (d.contenido ?? {}) as {
        volverArriba?: { visible?: unknown };
        rielSocial?: { visible?: unknown };
        carritoEnvio?: { visible?: unknown };
      };
      setForm({
        volverArriba: !!contenido.volverArriba?.visible,
        rielSocial: !!contenido.rielSocial?.visible,
        carritoEnvio: !!contenido.carritoEnvio?.visible,
      });
      setHayBorrador(!!d.sinPublicar);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudieron cargar los detalles del sitio.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión), igual que las secciones y `EncabezadoSeccion`/
  // `MenuSeccion`/`PaletaSeccion`: pendiente/guardando es común y recuperable; un guardado que FALLÓ y
  // no persiste es el caso grave.
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
    auto.marcarSucio(wireDe(nf));
  };

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  // Publicar / Descartar el borrador de Detalles del sitio (POST /api/site-content/detalles, que
  // mueve/limpia las DOS metas juntas, § la ruta).
  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content/detalles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
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
        <span className="duna-sr-only">Cargando los detalles del sitio…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', height: '80px', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudieron cargar los detalles del sitio.'}</p>
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

  const resumenActivos = CONTROLES.filter((c) => form[c.name]).map((c) => c.label);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Detalles del sitio</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          {!editando && (
            <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
              El botón para volver arriba y el riel de redes sociales.
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
            {resumenActivos.length > 0 ? resumenActivos.join(' · ') : 'Sin ajustes activos — el sitio de siempre.'}
          </p>
        </div>
      ) : (
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
            {CONTROLES.map((c) => {
              const on = form[c.name];
              return (
                <div key={c.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
                    <button
                      type="button" role="switch" aria-checked={on} aria-label={c.label}
                      onClick={() => cambiar({ [c.name]: !on } as Partial<Form>)}
                      className={`duna-switch${on ? ' is-on' : ''}`}
                    >
                      <span className="duna-switch__thumb" />
                    </button>
                    <span className="duna-field__label" style={{ margin: 0 }}>{c.label}</span>
                  </div>
                  <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>{c.hint}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a los detalles del sitio publicados. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
