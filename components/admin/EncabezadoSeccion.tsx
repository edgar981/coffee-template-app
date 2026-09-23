'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';

// ─── Bloque ENCABEZADO — vive en /admin/tienda, junto a Colores y el Menú ────────────────────────
//
// § PANEL-EDITOR-ENCABEZADO-1: los CUATRO ejes del nav que hasta hoy sólo escribía un preset —logo
// (`navWordmark.activo`), sub-encabezado (`cromo.navSubtitulo`), color del nav (`cromo.navTinta`),
// tratamiento tipográfico del nav (`navTratamiento.activo`)—. Default = lo que ya trae `content.*`
// (el preset lo sembró vía `mergePresetEnContent`); el dueño lo overridea con el switch, mismo
// principio que los interruptores del hero (§ PANEL-EDITOR-HERO-TOGGLES-1: "el preset pone el punto
// de partida, el dueño lo overridea con el switch").
//
// PATRÓN `PaletaSeccion`/`MenuSeccion`, NO `TiendaSeccionEditor`: los cuatro switches viven en TRES
// claves META que `SeccionKey` EXCLUYE del REGISTRY (`cromo`, `navWordmark`, `navTratamiento`,
// § site-content-defaults.ts) — no son una sección, así que `TiendaSeccionEditor` no tiene forma de
// montarlas (necesitaría una entrada en `SeccionVista`/`SECCIONES_TIENDA` que no existe para ellas),
// y el route GENÉRICO de contenido rechaza publicarlas/descartarlas (`seccion in REGISTRY`, § app/
// api/site-content/route.ts:88). Por eso el Encabezado tiene su PROPIA ruta
// (`/api/site-content/encabezado`, patrón `app/api/site-content/tema/route.ts`).
//
// SIN VISTA PREVIA EN VIVO (como `MenuSeccion`, por la MISMA razón): el nav es cromo TRANSVERSAL
// (aparece en toda página, no contenido de una sola), y el nav real del storefront (`StoreNav`)
// importa `useCartStore`/`useSiteSettings` — hooks del storefront que LANZAN fuera de su árbol
// (§ CLAUDE.md, "Montar un componente en OTRO árbol de providers"). Montarlo acá exigiría los
// mismos providers locales que `PaletaSeccion` monta para su fragmento, y ese costo no está en el
// alcance de este slice (el resumen de lectura es TEXTO, como en `MenuSeccion`).
//
// `cromo.navBadge` NO TIENE CONTROL ACÁ, y es DELIBERADO: el badge de cosecha se mudó al ítem de
// menú (§ CORTE-BADGE-COSECHA-EN-MENU-1) — su control real es `menu.badgeItem`/`badgeTexto` en
// `MenuSeccion.tsx` (exento en `PENDIENTE_PANEL`, `lib/config/panel-controles.ts`, cierra
// PANEL-EDITOR-MENU-BADGE-1). Pero `cromo` es UN objeto de TRES claves (`navTinta`, `navSubtitulo`,
// `navBadge`) y el write REEMPLAZA la clave `cromo` ENTERA al guardar/publicar (`guardarBorrador`/
// `publicarSeccion` hacen spread por CLAVE TOP-LEVEL, no merge por sub-campo) — así que esta sección
// LEE y REENVÍA el `navBadge` vigente sin editarlo en cada guardado: omitirlo lo borraría en
// silencio la primera vez que el dueño toque un switch de este bloque.
//
// `gatePorCampo`/`campoAtenuado` (§ PANEL-EDITOR-HERO-TOGGLES-1, `tienda-secciones.ts`) NO APLICAN
// acá y no se importan: ese mecanismo atenúa OTROS campos de TEXTO que un interruptor gatea dentro
// de la MISMA `SeccionConfig` (`CampoBooleano.gatedFields`); acá los cuatro switches son ejes
// independientes sin ningún campo de texto que atenuar, y esta sección no es una `SeccionConfig` de
// `TiendaSeccionEditor`. Por lo mismo, no hizo falta ningún ajuste en `TiendaSeccionEditor.tsx`.
//
// NOTA DE PRODUCTO: el Logo (`navWordmark.activo`) sólo cambia el ESTILO del wordmark apilado
// (nombre + sub-encabezado) — y ese apilado sólo existe si el Sub-encabezado está encendido
// (`Logo.tsx`: "sólo ajusta la rama subtitle, ya apilada"; `StoreNav.tsx`: `subtitle={cromo.
// navSubtitulo ? tagline : undefined}`). Con el sub-encabezado apagado, prender el Logo no cambia
// nada visible — el hint de abajo lo dice para que el dueño no lo reporte como "no funciona".

interface Form {
  logo: boolean;           // navWordmark.activo
  subEncabezado: boolean;  // cromo.navSubtitulo
  colorNav: boolean;       // cromo.navTinta
  tratamientoNav: boolean; // navTratamiento.activo
}

interface Wire {
  cromo: { navTinta: boolean; navSubtitulo: boolean; navBadge: string };
  navWordmark: { activo: boolean };
  navTratamiento: { activo: boolean };
}

const CONTROLES: { name: keyof Form; label: string; hint: string }[] = [
  { name: 'logo', label: 'Logo', hint: 'El nombre y el sub-encabezado del logo cambian de estilo. Sólo se nota con el sub-encabezado encendido.' },
  { name: 'subEncabezado', label: 'Sub-encabezado', hint: 'Muestra el eslogan de tu negocio bajo el nombre, en el encabezado.' },
  { name: 'colorNav', label: 'Color del encabezado', hint: 'El encabezado se ve con un fondo de color sólido, en vez del que usa hoy.' },
  { name: 'tratamientoNav', label: 'Tratamiento del menú', hint: 'Los enlaces del menú van en mayúscula, con más espacio entre letras.' },
];

export default function EncabezadoSeccion() {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [navBadge, setNavBadge]           = useState('');   // reenviado, no editable acá (§ arriba)
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Form | null>(null); formRef.current = form;
  const navBadgeRef = useRef(''); navBadgeRef.current = navBadge;

  // El WIRE que viaja al PUT: las tres metas COMPLETAS (`cromo` con su `navBadge` reenviado tal
  // cual, § arriba) — nunca un objeto parcial, porque el write reemplaza cada clave entera.
  const wireDe = (f: Form, badge: string): Wire => ({
    cromo: { navTinta: f.colorNav, navSubtitulo: f.subEncabezado, navBadge: badge },
    navWordmark: { activo: f.logo },
    navTratamiento: { activo: f.tratamientoNav },
  });

  const guardarEncabezado = useCallback(async (w: Wire) => {
    const res = await fetch('/api/site-content/encabezado', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(w),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarEncabezado);

  // Carga el encabezado draft-merged (GET /api/site-content → `contenido.{cromo,navWordmark,
  // navTratamiento}` + `sinPublicar.encabezado`) — el mismo endpoint que lee cada sección; sólo se
  // toma la rebanada de estas tres metas.
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const contenido = (d.contenido ?? {}) as {
        cromo?: { navTinta?: unknown; navSubtitulo?: unknown; navBadge?: unknown };
        navWordmark?: { activo?: unknown };
        navTratamiento?: { activo?: unknown };
      };
      setForm({
        logo: !!contenido.navWordmark?.activo,
        subEncabezado: !!contenido.cromo?.navSubtitulo,
        colorNav: !!contenido.cromo?.navTinta,
        tratamientoNav: !!contenido.navTratamiento?.activo,
      });
      setNavBadge(String(contenido.cromo?.navBadge ?? ''));
      setHayBorrador(!!d.sinPublicar?.encabezado);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudo cargar el encabezado.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión), igual que las secciones y `MenuSeccion`/
  // `PaletaSeccion`: pendiente/guardando es común y recuperable; un guardado que FALLÓ y no
  // persiste es el caso grave.
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
    auto.marcarSucio(wireDe(nf, navBadgeRef.current));
  };

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  // Publicar / Descartar el borrador del Encabezado (POST /api/site-content/encabezado, que mueve/
  // limpia las TRES metas juntas, § la ruta).
  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content/encabezado', {
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
        <span className="duna-sr-only">Cargando el encabezado…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', height: '96px', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar el encabezado.'}</p>
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
            <h2 className="duna-title">Encabezado</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          {!editando && (
            <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
              El logo, el sub-encabezado y cómo se ve la navegación de tu tienda.
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
            {resumenActivos.length > 0 ? resumenActivos.join(' · ') : 'Sin ajustes activos — el encabezado de siempre.'}
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
        descripcion="Volverás al encabezado publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
