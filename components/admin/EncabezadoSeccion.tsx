'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload, ImageIcon } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { TIPOS_LOGO, ACCEPT_LOGO, MAX_SUBIDA_DIRECTA_MB } from '@/constants/upload';

// ─── Bloque ENCABEZADO — vive en /admin/tienda, junto a Colores y el Menú ────────────────────────
//
// § PANEL-EDITOR-ENCABEZADO-1, ampliado por § MUESTRARIO-DRAWER-MOVIL-TEMA-1, §
// CROMO-NAV-DIRECCION-SCROLL-1, § CROMO-NAV-FILETE-1, § CROMO-NAV-CTA-Y-BADGE-1, §
// CROMO-NAV-POSICION-TEMA-REAL-1 y § CROMO-NAV-EXACTO-PROTOTIPO-1: los DIEZ ejes del nav que hasta
// hoy sólo escribía un preset —logo (`navWordmark.activo`), sub-encabezado (`cromo.navSubtitulo`),
// color del nav (`cromo.navTinta`), tratamiento tipográfico del nav (`navTratamiento.activo`), el
// drawer móvil de pantalla completa (`navDrawerMovil.variante`), el comportamiento por dirección de
// scroll (`navTratamiento.direccion`), el filete inferior del encabezado (`navTratamiento.filete`),
// la forma/color del CTA COMPRAR + el badge de menú (`navTratamiento.cta`), la geometría del
// contenedor de contenido (`navTratamiento.posicion`) y el subrayado al hover de los links
// (`navTratamiento.subrayado`)—. Default = lo que ya trae `content.*` (el preset lo sembró vía
// `mergePresetEnContent`); el dueño lo overridea con el switch, mismo principio que los
// interruptores del hero (§ PANEL-EDITOR-HERO-TOGGLES-1: "el preset pone el punto de partida, el
// dueño lo overridea con el switch").
//
// `navTratamiento.direccion`/`.filete`/`.cta`/`.posicion`/`.subrayado` son CAMPOS MÁS de la MISMA
// clave `navTratamiento` que ya trae `activo` (§ el docstring de `NavTratamientoContent.direccion`/
// `.filete`/`.cta`/`.posicion`/`.subrayado`, `site-content-defaults.ts`) — no una quinta/sexta/
// séptima/octava/novena clave meta. Por eso `wireDe`/`cargar` sólo agregan una propiedad al objeto
// `navTratamiento` que ya armaban, sin tocar el resto del cableado.
//
// PATRÓN `PaletaSeccion`/`MenuSeccion`, NO `TiendaSeccionEditor`: los diez switches viven en CUATRO
// claves META que `SeccionKey` EXCLUYE del REGISTRY (`cromo`, `navWordmark`, `navTratamiento`,
// `navDrawerMovil`, § site-content-defaults.ts) — no son una sección, así que `TiendaSeccionEditor`
// no tiene forma de montarlas (necesitaría una entrada en `SeccionVista`/`SECCIONES_TIENDA` que no
// existe para ellas), y el route GENÉRICO de contenido rechaza publicarlas/descartarlas (`seccion in
// REGISTRY`, § app/api/site-content/route.ts:88). Por eso el Encabezado tiene su PROPIA ruta
// (`/api/site-content/encabezado`, patrón `app/api/site-content/tema/route.ts`).
//
// EL DRAWER MÓVIL ES UN SWITCH (booleano en el FORM) SOBRE UNA VARIANTE (string en el DATO): a
// diferencia de los otros cuatro ejes (booleano de punta a punta), `navDrawerMovil.variante` es un
// set cerrado de DOS composiciones (`'dropdown'`/`'pantallaCompleta'`, § `NavDrawerMovilContent`).
// Con sólo dos miembros, un switch ON/OFF ("¿pantalla completa?") es la UI correcta — no hace falta
// un selector de N opciones para un dominio de 2—, así que `wireDe` traduce el booleano del form al
// string del dato en el borde, sin filtrar esa traducción al resto del componente.
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
// de la MISMA `SeccionConfig` (`CampoBooleano.gatedFields`); acá los diez switches son ejes
// independientes sin ningún campo de texto que atenuar, y esta sección no es una `SeccionConfig` de
// `TiendaSeccionEditor`. Por lo mismo, no hizo falta ningún ajuste en `TiendaSeccionEditor.tsx`.
//
// NOTA DE PRODUCTO: el Logo (`navWordmark.activo`) sólo cambia el ESTILO del wordmark apilado
// (nombre + sub-encabezado) — y ese apilado sólo existe si el Sub-encabezado está encendido
// (`Logo.tsx`: "sólo ajusta la rama subtitle, ya apilada"; `StoreNav.tsx`: `subtitle={cromo.
// navSubtitulo ? tagline : undefined}`). Con el sub-encabezado apagado, prender el Logo no cambia
// nada visible — el hint de abajo lo dice para que el dueño no lo reporte como "no funciona".
//
// LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1, `content.logo`) es un QUINTO bloque, distinto de los
// diez switches: dos imágenes (oscura/clara) + su alt. A diferencia de `cromo`/`navWordmark`/
// `navTratamiento`/`navDrawerMovil` —metas EXCLUIDAS del REGISTRY—, `logo` SÍ es una SECCIÓN de
// verdad (§ `REGISTRY.logo`, site-content-defaults.ts, mismo precedente que `menu`/`footer`): lleva
// imágenes y participa del borrado de blobs GENÉRICO (`imagenesDe`/`blobsHuerfanos`,
// site-content-blobs.ts) sin código propio en esta ruta. Se agrupa acá, en el MISMO borrador/
// publish que el resto del Encabezado, porque es la MISMA decisión de producto para el dueño —"cómo
// se ve mi marca en el encabezado"—, no una sección aparte del selector de páginas. Con AMBAS
// imágenes vacías (el caso de hoy, Nayoli), el storefront no cambia: cae al wordmark de texto (o la
// flor de Nayoli, § STOREFRONT_TIENE_MARK) exactamente como siempre.

interface Form {
  logo: boolean;             // navWordmark.activo
  subEncabezado: boolean;    // cromo.navSubtitulo
  colorNav: boolean;         // cromo.navTinta
  tratamientoNav: boolean;   // navTratamiento.activo
  drawerMovil: boolean;      // navDrawerMovil.variante === 'pantallaCompleta'
  direccionScroll: boolean;  // navTratamiento.direccion
  filete: boolean;           // navTratamiento.filete
  ctaBadge: boolean;         // navTratamiento.cta
  posicion: boolean;         // navTratamiento.posicion
  subrayado: boolean;        // navTratamiento.subrayado
  // '' = null (sigue pintando con `--sf-tostado`); un hex = el override (§ RIEL-SCROLL-Y-BADGE-
  // DORADO-1). SÓLO tiene efecto con `ctaBadge` encendido — el badge fijo es lo que este color
  // pinta; sin `ctaBadge` el badge sigue el par translúcido de `navClaro`, que este campo no toca.
  badgeColor: string;        // navTratamiento.badgeColor
  // LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1): tres strings, NO un switch — '' = esa versión no
  // está subida. `logo.oscuro`/`logo.claro`/`logo.alt`.
  logoOscuro: string;
  logoClaro: string;
  logoAlt: string;
}

interface Wire {
  cromo: { navTinta: boolean; navSubtitulo: boolean; navBadge: string };
  navWordmark: { activo: boolean };
  navTratamiento: { activo: boolean; direccion: boolean; filete: boolean; cta: boolean; posicion: boolean; subrayado: boolean; badgeColor: string | null };
  navDrawerMovil: { variante: 'dropdown' | 'pantallaCompleta' };
  logo: { oscuro: string; claro: string; alt: string };
}

const HEX6_BADGE = /^#[0-9a-fA-F]{6}$/;

const CONTROLES: { name: Exclude<keyof Form, 'badgeColor' | 'logoOscuro' | 'logoClaro' | 'logoAlt'>; label: string; hint: string }[] = [
  { name: 'logo', label: 'Estilo del nombre', hint: 'El nombre y el sub-encabezado del logo cambian de estilo. Sólo se nota con el sub-encabezado encendido, y sólo si no subiste una imagen de logo abajo — con imagen, este interruptor no tiene efecto.' },
  { name: 'subEncabezado', label: 'Sub-encabezado', hint: 'Muestra el eslogan de tu negocio bajo el nombre, en el encabezado.' },
  { name: 'colorNav', label: 'Color del encabezado', hint: 'En la portada, al bajar el encabezado se ve con un fondo de color sólido en vez del que usa hoy. En las demás páginas de la tienda el encabezado siempre queda claro (§ NAV-INTERNAS-CLARO-Y-OFFSET-1).' },
  { name: 'tratamientoNav', label: 'Tratamiento del menú', hint: 'Los enlaces del menú van en mayúscula, con más espacio entre letras.' },
  { name: 'drawerMovil', label: 'Drawer móvil de pantalla completa', hint: 'En el teléfono, el menú se abre a pantalla completa en vez del panel angosto de hoy.' },
  { name: 'direccionScroll', label: 'Ocultar al bajar', hint: 'Al bajar, el encabezado se oculta; al subir, reaparece con su color sólido. Arriba del todo se ve como siempre.' },
  { name: 'filete', label: 'Filete inferior', hint: 'Una línea fina separa el encabezado del contenido, sin llegar a los bordes de la pantalla.' },
  { name: 'ctaBadge', label: 'Botón Comprar y badge del menú', hint: 'El botón Comprar se ve sólido y se muda al final del encabezado, después del carrito; el badge de un ítem de menú toma un color fijo.' },
  { name: 'posicion', label: 'Posición del encabezado', hint: 'El encabezado se abre hacia los costados y con más espacio vertical, en vez del ancho y la altura de hoy. También ensancha el contenido de cada banda de la tienda, para que sus bordes queden alineados con los del encabezado.' },
  { name: 'subrayado', label: 'Subrayado al pasar el mouse', hint: 'Los enlaces del menú dibujan una línea debajo al pasar el mouse por encima.' },
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
  // LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1): `subiendoCual` nombra QUÉ versión está subiendo —
  // el uploader compartido (`useSubidaImagen`) es UNA sola instancia (las dos subidas son
  // secuenciales, nunca a la vez), así que sin esto no habría forma de mostrar el progreso/error
  // bajo el botón correcto.
  const [subiendoCual, setSubiendoCual] = useState<'oscuro' | 'claro' | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const formRef = useRef<Form | null>(null); formRef.current = form;
  const navBadgeRef = useRef(''); navBadgeRef.current = navBadge;
  const subidaImagen = useSubidaImagen({ onError: setErrorLogo });

  // El WIRE que viaja al PUT: las CUATRO metas COMPLETAS (`cromo` con su `navBadge` reenviado tal
  // cual, § arriba) MÁS la sección `logo` COMPLETA — nunca un objeto parcial, porque el write
  // reemplaza cada clave entera.
  const wireDe = (f: Form, badge: string): Wire => ({
    cromo: { navTinta: f.colorNav, navSubtitulo: f.subEncabezado, navBadge: badge },
    navWordmark: { activo: f.logo },
    navTratamiento: {
      activo: f.tratamientoNav, direccion: f.direccionScroll, filete: f.filete, cta: f.ctaBadge,
      posicion: f.posicion, subrayado: f.subrayado,
      badgeColor: HEX6_BADGE.test(f.badgeColor) ? f.badgeColor : null,
    },
    navDrawerMovil: { variante: f.drawerMovil ? 'pantallaCompleta' : 'dropdown' },
    logo: { oscuro: f.logoOscuro, claro: f.logoClaro, alt: f.logoAlt },
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
  // navTratamiento,logo}` + `sinPublicar.encabezado`) — el mismo endpoint que lee cada sección;
  // sólo se toma la rebanada de estas CUATRO metas/secciones.
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const contenido = (d.contenido ?? {}) as {
        cromo?: { navTinta?: unknown; navSubtitulo?: unknown; navBadge?: unknown };
        navWordmark?: { activo?: unknown };
        navTratamiento?: { activo?: unknown; direccion?: unknown; filete?: unknown; cta?: unknown; posicion?: unknown; subrayado?: unknown; badgeColor?: unknown };
        navDrawerMovil?: { variante?: unknown };
        logo?: { oscuro?: unknown; claro?: unknown; alt?: unknown };
      };
      setForm({
        logo: !!contenido.navWordmark?.activo,
        subEncabezado: !!contenido.cromo?.navSubtitulo,
        colorNav: !!contenido.cromo?.navTinta,
        tratamientoNav: !!contenido.navTratamiento?.activo,
        drawerMovil: contenido.navDrawerMovil?.variante === 'pantallaCompleta',
        direccionScroll: !!contenido.navTratamiento?.direccion,
        filete: !!contenido.navTratamiento?.filete,
        ctaBadge: !!contenido.navTratamiento?.cta,
        posicion: !!contenido.navTratamiento?.posicion,
        subrayado: !!contenido.navTratamiento?.subrayado,
        badgeColor: typeof contenido.navTratamiento?.badgeColor === 'string' ? contenido.navTratamiento.badgeColor : '',
        logoOscuro: typeof contenido.logo?.oscuro === 'string' ? contenido.logo.oscuro : '',
        logoClaro: typeof contenido.logo?.claro === 'string' ? contenido.logo.claro : '',
        logoAlt: typeof contenido.logo?.alt === 'string' ? contenido.logo.alt : '',
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

  // SUBIR una versión del logo (§ MARCA-LOGO-IMAGEN-1). Usa el camino "elegir sin subir / subir
  // aparte" de `useSubidaImagen` (`elegir`+`subir`, NO el `pedir` simple) porque el logo acepta SVG
  // —`pedir`/`alElegir` validan contra `TIPOS_PERMITIDOS`, que NO incluye SVG—, así que hace falta
  // pasar `tipos`/`accept` propios. Subida ATÓMICA (elige y sube en el mismo gesto, a diferencia del
  // video+póster del hero): una imagen de logo no tiene un segundo archivo que esperar.
  const subirLogo = (cual: 'oscuro' | 'claro') => {
    setErrorLogo(null);
    subidaImagen.elegir(
      async (file) => {
        setSubiendoCual(cual);
        try {
          const { url } = await subidaImagen.subir(file, { kind: 'logo' });
          cambiar(cual === 'oscuro' ? { logoOscuro: url } : { logoClaro: url });
        } catch (err) {
          setErrorLogo(err instanceof Error ? err.message : 'No se pudo subir el logo. Reintenta.');
        } finally {
          setSubiendoCual(null);
        }
      },
      { tipos: TIPOS_LOGO, accept: ACCEPT_LOGO, msgError: 'Formato no admitido. Usa SVG o PNG.' },
    );
  };

  // Publicar / Descartar el borrador del Encabezado (POST /api/site-content/encabezado, que mueve/
  // limpia las CUATRO metas + la sección `logo` juntas, § la ruta).
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

  // § MARCA-LOGO-IMAGEN-1 — el resumen de lectura nombra el logo subido ANTES que los switches:
  // es el cambio de mayor impacto visual del bloque (reemplaza mark+wordmark enteros).
  const tieneLogoImagen = form.logoOscuro.trim() !== '' || form.logoClaro.trim() !== '';
  const resumenActivos = [
    ...(tieneLogoImagen ? ['Imagen de logo'] : []),
    ...CONTROLES.filter((c) => form[c.name]).map((c) => c.label),
  ];

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
        <>
        {/* LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1) — tarjeta PROPIA, antes de los switches: es
            una decisión distinta ("¿tengo un logo?"), no un ajuste más del nav. */}
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <h3 className="duna-field__label" style={{ margin: 0, fontSize: '0.9375rem' }}>Imagen del logo</h3>
          <p className="duna-field__hint" style={{ marginTop: '4px' }}>
            Reemplaza el nombre en texto del encabezado, el pie de página y el menú móvil. Sin ninguna imagen,
            se muestra el nombre de tu negocio (o la flor, si tu despliegue la tiene). SVG o PNG con fondo
            transparente, máx {MAX_SUBIDA_DIRECTA_MB} MB. Si subes sólo una versión, se usa también para la otra.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-4)', marginTop: 'var(--duna-space-3)' }}>
            {([
              { cual: 'oscuro' as const, url: form.logoOscuro, titulo: 'Versión oscura', hint: 'Para fondos claros — páginas internas, encabezado sólido.' },
              { cual: 'claro' as const, url: form.logoClaro, titulo: 'Versión clara', hint: 'Para fondos oscuros — la portada flotando, el pie de página.' },
            ]).map(({ cual, url, titulo, hint }) => (
              <div key={cual} style={{ flex: '1 1 260px', minWidth: 0 }}>
                <span className="duna-field__label">{titulo}</span>
                <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
                  <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                    {url
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" />
                      : <ImageIcon aria-hidden width={20} height={20} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => subirLogo(cual)}
                        className="duna-btn duna-btn--secondary duna-btn--sm"
                        disabled={subidaImagen.subiendo}
                      >
                        <Upload /> {url ? 'Cambiar' : 'Subir imagen'}
                      </button>
                      {url && (
                        <button
                          type="button"
                          onClick={() => cambiar(cual === 'oscuro' ? { logoOscuro: '' } : { logoClaro: '' })}
                          className="duna-btn duna-btn--ghost duna-btn--sm"
                          disabled={subidaImagen.subiendo}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <span className="duna-field__hint" style={{ margin: 0 }}>
                      {subiendoCual === cual ? `Subiendo… ${subidaImagen.progreso ?? 0}%` : hint}
                    </span>
                    {subiendoCual === cual && <BarraProgreso pct={subidaImagen.progreso ?? 0} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {errorLogo && <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-2)' }}>{errorLogo}</p>}
          <div className="duna-field" style={{ marginTop: 'var(--duna-space-3)' }}>
            <label className="duna-field__label" htmlFor="enc-logo-alt">Texto alternativo</label>
            <input
              id="enc-logo-alt" className="duna-input"
              value={form.logoAlt} onChange={(e) => cambiar({ logoAlt: e.target.value })}
              placeholder="Ej. Logo de Café Las Chamisas"
            />
            <p className="duna-field__hint">Vacío: se usa el nombre de tu negocio.</p>
          </div>
          <input ref={subidaImagen.inputHoldRef} type="file" onChange={subidaImagen.alElegirHold} hidden />
        </div>
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
                  {/* Sub-control de "Botón Comprar y badge del menú" (§ RIEL-SCROLL-Y-BADGE-
                      DORADO-1): sólo tiene efecto con ESE switch encendido — el badge fijo es lo
                      que este color pinta. Anidado bajo su hint, no una entrada más de
                      `CONTROLES` (no es un booleano ON/OFF). */}
                  {c.name === 'ctaBadge' && form.ctaBadge && (
                    <div style={{ marginTop: 'var(--duna-space-3)', marginLeft: 'calc(2.5rem + var(--duna-space-3))' }}>
                      <label className="duna-field__label" htmlFor="enc-badge-color">Color del badge</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: '6px' }}>
                        <input
                          id="enc-badge-color" type="color"
                          value={HEX6_BADGE.test(form.badgeColor) ? form.badgeColor : '#d8a378'}
                          onChange={(e) => cambiar({ badgeColor: e.target.value })}
                          style={{ width: 34, height: 30, padding: 0, border: '1px solid var(--duna-border)', borderRadius: 'var(--duna-r-m)', background: 'none', cursor: 'pointer' }}
                          aria-label="Elegir color del badge"
                        />
                        <input
                          className="duna-input" style={{ width: 110, fontFamily: 'var(--duna-font-mono)' }}
                          value={form.badgeColor} onChange={(e) => cambiar({ badgeColor: e.target.value })}
                          placeholder="#d8a378"
                          aria-invalid={form.badgeColor !== '' && !HEX6_BADGE.test(form.badgeColor) || undefined}
                        />
                        {form.badgeColor !== '' && (
                          <button type="button" onClick={() => cambiar({ badgeColor: '' })} className="duna-btn duna-btn--ghost duna-btn--sm">
                            Restablecer
                          </button>
                        )}
                      </div>
                      {form.badgeColor !== '' && !HEX6_BADGE.test(form.badgeColor) ? (
                        <p className="duna-field__error" style={{ marginTop: '4px', marginBottom: 0 }}>Usa un hex de 6 dígitos, p. ej. #f5b36a.</p>
                      ) : (
                        <p className="duna-field__hint" style={{ marginTop: '6px', marginBottom: 0 }}>
                          Vacío: el badge sigue con el color de acento cálido de siempre.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </>
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
