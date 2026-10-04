'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { Upload, ImageIcon } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import { AyudaCampo } from '@/components/admin/editor/AyudaCampo';
import { TIPOS_LOGO, ACCEPT_LOGO, MAX_SUBIDA_DIRECTA_MB } from '@/constants/upload';
import { modoLogoResuelto } from '@/lib/config/marca-logo';
import { sonIguales, type PasoHistorial } from '@/lib/admin/historial-editor';
import type { EstadoAutoguardado } from '@/lib/autoguardado';

// § EDITOR-TIENDA-CROMO-1 — gemelo de `MenuSeccionHandle`. Sin `escribirCampo`: el Encabezado no
// gana marcadores `CampoEditable` en esta tanda (§ el asiento de este slice en DECISIONS.md — la
// "tagline" que el spec nombra es `SiteSetting.tagline`, otro modelo, fuera de alcance de este
// mecanismo).
export interface EncabezadoSeccionHandle {
  abrir: () => void;
  cerrar: () => void;
  marcarPublicado: () => void;
  restaurarDesdePublicado: (valor: Record<string, unknown>) => void;
}

export interface EncabezadoSeccionProps {
  /** Ver el docstring de `MenuSeccionProps.enEditor` — mismo contrato. */
  enEditor?: boolean;
  onAbrir?: () => void;
  onCerrar?: () => void;
  /** A DIFERENCIA de `MenuSeccionProps.onCambio`: esta tarjeta edita DOS cosas de naturaleza
   *  distinta — las CUATRO metas combinadas (`seccion:'encabezado'`, § `datosDeEncabezado`,
   *  `lib/storefront/editor-puente.ts`) y la sección `logo` del REGISTRY (`seccion:'logo'`) — así
   *  que el callback lleva CUÁL de las dos cambió, en vez de asumir una sola. */
  onCambio?: (seccion: 'encabezado' | 'logo', datos: Record<string, unknown>) => void;
  onPaso?: (paso: PasoHistorial) => void;
  onEstado?: (info: { hayBorrador: boolean; estado: EstadoAutoguardado }) => void;
}

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
//
// EL ÍCONO DE LA PESTAÑA (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1, `content.logo.icono`) es un SEXTO
// campo de la MISMA sección `logo` — no un bloque aparte: es "cómo me ve el navegador" igual que el
// logo de arriba, viaja en el MISMO borrador/publish, y su borrado de blobs lo cubre el MISMO
// mecanismo genérico (`REGISTRY.logo.imagenes` ya lo nombra). Vacío → los íconos ESTÁTICOS de Nayoli
// (favicon/apple-touch/PWA), vía `lib/config/metadata-tienda.ts` — consumido por
// `app/(storefront)/layout.tsx`, `app/not-found.tsx` y `app/api/manifest/route.ts`.
//
// CÓMO SE MUESTRA LA MARCA EN EL NAV (§ NAV-LOGO-Y-NOMBRE-1, `content.logo.modo`) es un SÉPTIMO
// campo de la MISMA sección `logo`, no un bloque aparte: sigue siendo "cómo se ve mi marca",
// decisión que ya vive en esta tarjeta. Tres opciones — "Sólo nombre", "Sólo logo" y "Logo en el
// teléfono, logo y nombre en escritorio" (Café Las Chamisas la usará con su sello redondo) —, pero
// el control NO es un switch: un `<select>` nativo, el mismo patrón que `footer.variante`
// (`FooterSeccion.tsx`) para un set cerrado de más de dos strings. El `value` mostrado es el
// RESUELTO (`modoLogoResuelto`, lib/config/marca-logo.ts — la MISMA función que interpreta
// `Logo.tsx` en el storefront, para que panel y tienda nunca discrepen sobre qué significa un
// valor guardado), nunca el `''` crudo: mostrar una cuarta opción en blanco por "no elegido todavía"
// sería inventar una opción que el spec no pide. Elegir cualquiera de las tres, aun la que ya
// estaba en efecto, la hace EXPLÍCITA (`cambiar({ logoModo: … })`) — ningún tenant la cambia sin
// tocar el `<select>`.

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
  // § NAV-MOVIL-SIN-BUSCAR-1 — ¿el ícono de buscar aparece en la barra del encabezado en ancho de
  // teléfono? Default `true` (HOY: se muestra). SÓLO TIENE EFECTO con `drawerMovil` encendido —
  // el drawer `'dropdown'` (default) no trae buscar en su propio panel, así que apagarlo ahí dejaría
  // al visitante sin ninguna vía de búsqueda en el teléfono; `StoreNav.tsx` lo ignora fuera de
  // `pantallaCompleta`, igual que el render no lo expone acá (§ el bloque anidado, abajo).
  buscarMovil: boolean;      // navTratamiento.buscarMovil
  // LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1): tres strings, NO un switch — '' = esa versión no
  // está subida. `logo.oscuro`/`logo.claro`/`logo.alt`.
  logoOscuro: string;
  logoClaro: string;
  logoAlt: string;
  // EL ÍCONO DE LA PESTAÑA (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1): UN string, campo propio —
  // DISTINTO del logo de arriba (ese es el wordmark/mark del nav, típicamente rectangular; esto es
  // un ícono cuadrado para favicon/apple-touch/PWA). '' = sin ícono subido, cae a los estáticos de
  // Nayoli (§ `lib/config/metadata-tienda.ts`).
  logoIcono: string;
  // CÓMO SE MUESTRA LA MARCA EN EL NAV (§ NAV-LOGO-Y-NOMBRE-1): '' mientras el dueño no elige nada
  // —el `<select>` MUESTRA el valor RESUELTO (`modoLogoResuelto`), pero el FORM guarda '' hasta que
  // se toca el control, así que ningún tenant lo cambia sin elegirlo— o uno de los tres valores de
  // `ModoLogo` una vez elegido.
  logoModo: string;
}

interface Wire {
  cromo: { navTinta: boolean; navSubtitulo: boolean; navBadge: string };
  navWordmark: { activo: boolean; taglineColor: string };
  navTratamiento: { activo: boolean; direccion: boolean; filete: boolean; cta: boolean; posicion: boolean; subrayado: boolean; badgeColor: string | null; buscarMovil: boolean };
  navDrawerMovil: { variante: 'dropdown' | 'pantallaCompleta' };
  logo: { oscuro: string; claro: string; alt: string; icono: string; modo: string };
}

const HEX6_BADGE = /^#[0-9a-fA-F]{6}$/;

const CONTROLES: { name: Exclude<keyof Form, 'badgeColor' | 'logoOscuro' | 'logoClaro' | 'logoAlt' | 'logoIcono' | 'logoModo'>; label: string; hint: string }[] = [
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

// § EDITOR-TIENDA-CROMO-1 — la extracción contenido→{form,navBadge,taglineColor} de `cargar()`
// (abajo), de vuelta en una función PROPIA: `restaurarDesdePublicado` (el handle imperativo tras
// un "Descartar" EN LOTE) necesita la MISMA traducción sobre un `contenido` que YA tiene en mano
// (el refetch único de `TiendaPaginas`), sin volver a pedirlo por su cuenta. Una sola definición
// de la traducción — dos llamadores no pueden divergir sobre qué significa cada clave.
type ContenidoEncabezado = {
  cromo?: { navTinta?: unknown; navSubtitulo?: unknown; navBadge?: unknown };
  navWordmark?: { activo?: unknown; taglineColor?: unknown };
  navTratamiento?: { activo?: unknown; direccion?: unknown; filete?: unknown; cta?: unknown; posicion?: unknown; subrayado?: unknown; badgeColor?: unknown; buscarMovil?: unknown };
  navDrawerMovil?: { variante?: unknown };
  logo?: { oscuro?: unknown; claro?: unknown; alt?: unknown; icono?: unknown; modo?: unknown };
};

function estadoDesdeContenido(contenido: ContenidoEncabezado): { form: Form; navBadge: string; taglineColor: string } {
  return {
    form: {
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
      buscarMovil: contenido.navTratamiento?.buscarMovil !== false,
      logoOscuro: typeof contenido.logo?.oscuro === 'string' ? contenido.logo.oscuro : '',
      logoClaro: typeof contenido.logo?.claro === 'string' ? contenido.logo.claro : '',
      logoAlt: typeof contenido.logo?.alt === 'string' ? contenido.logo.alt : '',
      logoIcono: typeof contenido.logo?.icono === 'string' ? contenido.logo.icono : '',
      logoModo: typeof contenido.logo?.modo === 'string' ? contenido.logo.modo : '',
    },
    navBadge: String(contenido.cromo?.navBadge ?? ''),
    taglineColor: typeof contenido.navWordmark?.taglineColor === 'string' ? contenido.navWordmark.taglineColor : 'atenuado',
  };
}

const EncabezadoSeccion = forwardRef<EncabezadoSeccionHandle, EncabezadoSeccionProps>(function EncabezadoSeccion({
  enEditor = false, onAbrir, onCerrar, onCambio, onPaso, onEstado,
}, ref) {
  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [navBadge, setNavBadge]           = useState('');   // reenviado, no editable acá (§ arriba)
  // `navWordmark.taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1, TAGLINE-COLOR-CIERRE-1): mismo patrón
  // de reenvío que `navBadge` de arriba — sin editor en el panel todavía (§ su exención en
  // `panel-controles.ts`), así que esta sección debe REENVIAR el valor vigente en cada guardado o
  // `wireDe` reescribiría la clave `navWordmark` entera (sólo `activo`) y borraría en silencio el
  // color que la operación de datos de NAV-LOGO-MOVIL-CON-AIRE-1 haya puesto.
  const [taglineColor, setTaglineColor]   = useState('atenuado');
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  // LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1) Y EL ÍCONO DE LA PESTAÑA (§ METADATA-ICONOS-Y-LANG-
  // POR-TIENDA-1): `subiendoCual` nombra QUÉ versión está subiendo — el uploader compartido
  // (`useSubidaImagen`) es UNA sola instancia (las TRES subidas son secuenciales, nunca a la vez),
  // así que sin esto no habría forma de mostrar el progreso/error bajo el botón correcto.
  const [subiendoCual, setSubiendoCual] = useState<'oscuro' | 'claro' | 'icono' | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const formRef = useRef<Form | null>(null); formRef.current = form;
  const navBadgeRef = useRef(''); navBadgeRef.current = navBadge;
  const taglineColorRef = useRef('atenuado'); taglineColorRef.current = taglineColor;
  const subidaImagen = useSubidaImagen({ onError: setErrorLogo });

  // El WIRE que viaja al PUT: las CUATRO metas COMPLETAS (`cromo` con su `navBadge` reenviado tal
  // cual, § arriba; `navWordmark` con su `taglineColor` reenviado tal cual, § TAGLINE-COLOR-
  // CIERRE-1) MÁS la sección `logo` COMPLETA — nunca un objeto parcial, porque el write reemplaza
  // cada clave entera.
  const wireDe = (f: Form, badge: string, colorTagline: string): Wire => ({
    cromo: { navTinta: f.colorNav, navSubtitulo: f.subEncabezado, navBadge: badge },
    navWordmark: { activo: f.logo, taglineColor: colorTagline },
    navTratamiento: {
      activo: f.tratamientoNav, direccion: f.direccionScroll, filete: f.filete, cta: f.ctaBadge,
      posicion: f.posicion, subrayado: f.subrayado,
      badgeColor: HEX6_BADGE.test(f.badgeColor) ? f.badgeColor : null,
      buscarMovil: f.buscarMovil,
    },
    navDrawerMovil: { variante: f.drawerMovil ? 'pantallaCompleta' : 'dropdown' },
    logo: { oscuro: f.logoOscuro, claro: f.logoClaro, alt: f.logoAlt, icono: f.logoIcono, modo: f.logoModo },
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
      const contenido = (d.contenido ?? {}) as ContenidoEncabezado;
      const estado = estadoDesdeContenido(contenido);
      setForm(estado.form);
      setNavBadge(estado.navBadge);
      setTaglineColor(estado.taglineColor);
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

  // § EDITOR-TIENDA-CROMO-1 — EL PUNTO ÚNICO de mutación del form, mismo patrón que
  // `MenuSeccion.tsx`/`FooterSeccion.tsx`/`TiendaSeccionEditor.tsx`. `onCambio` manda las DOS
  // mitades que esta tarjeta posee, cada una por su propia clave (§ el docstring de
  // `EncabezadoSeccionProps.onCambio`): el Wire completo ya las separa, así que basta con
  // desestructurar `logo` afuera del resto.
  const loteAntesRef = useRef<Form | null>(null);
  const aplicandoHistorialRef = useRef(false);
  const aplicarCambioForm = (nf: Form) => {
    if (loteAntesRef.current === null) loteAntesRef.current = formRef.current as Form;
    setForm(nf);
    setHayBorrador(true);
    const wire = wireDe(nf, navBadgeRef.current, taglineColorRef.current);
    auto.marcarSucio(wire);
    const { logo: logoWire, ...encabezadoWire } = wire;
    onCambio?.('encabezado', encabezadoWire);
    onCambio?.('logo', logoWire);
  };

  const cambiar = (parcial: Partial<Form>) => {
    aplicarCambioForm({ ...(formRef.current as Form), ...parcial });
  };

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
      const estado = estadoDesdeContenido(valor as ContenidoEncabezado);
      setForm(estado.form);
      setNavBadge(estado.navBadge);
      setTaglineColor(estado.taglineColor);
      setHayBorrador(false);
    },
  }));

  // EL CAMPO del form que cada variante escribe (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1 suma
  // 'icono' a las dos de § MARCA-LOGO-IMAGEN-1) — una tabla, no un ternario de dos ramas que ya no
  // alcanza para tres.
  const CAMPO_DE_VARIANTE = { oscuro: 'logoOscuro', claro: 'logoClaro', icono: 'logoIcono' } as const;

  // SUBIR una versión del logo, o el ícono de la pestaña (§ MARCA-LOGO-IMAGEN-1, § METADATA-ICONOS-
  // Y-LANG-POR-TIENDA-1). Usa el camino "elegir sin subir / subir aparte" de `useSubidaImagen`
  // (`elegir`+`subir`, NO el `pedir` simple) porque las tres aceptan SVG —`pedir`/`alElegir` validan
  // contra `TIPOS_PERMITIDOS`, que NO incluye SVG—, así que hace falta pasar `tipos`/`accept`
  // propios. Subida ATÓMICA (elige y sube en el mismo gesto, a diferencia del video+póster del
  // hero): ninguna de las tres tiene un segundo archivo que esperar.
  const subirLogo = (cual: 'oscuro' | 'claro' | 'icono') => {
    setErrorLogo(null);
    subidaImagen.elegir(
      async (file) => {
        setSubiendoCual(cual);
        try {
          const { url } = await subidaImagen.subir(file, { kind: 'logo' });
          cambiar({ [CAMPO_DE_VARIANTE[cual]]: url } as Partial<Form>);
        } catch (err) {
          setErrorLogo(err instanceof Error ? err.message : 'No se pudo subir la imagen. Reintenta.');
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

  // § MARCA-LOGO-IMAGEN-1 — `tieneLogoImagen` sigue viva: la lee la vista de edición (más abajo) para
  // decidir el valor por defecto del modo de logo. `tieneIconoPropio`/`resumenActivos` SE RETIRARON
  // (§ EDITOR-VISUAL-PANEL-1, arriba): eran sólo del resumen de lectura, que ya no existe.
  const tieneLogoImagen = form.logoOscuro.trim() !== '' || form.logoClaro.trim() !== '';
  // § NAV-LOGO-Y-NOMBRE-1 — el modo resuelto lo usa el `value` del select de la vista de edición
  // (nunca `form.logoModo` crudo, § su propio comentario más abajo).
  const logoComoObjeto = { visible: true, oscuro: form.logoOscuro, claro: form.logoClaro, alt: form.logoAlt, icono: form.logoIcono, modo: form.logoModo };
  const modoActual = modoLogoResuelto(logoComoObjeto);

  // § EDITOR-VISUAL-PANEL-1 — LECTURA: una FILA compacta (icono + «Encabezado»), no la tarjeta
  // grande con resumen en prosa ("Imagen de logo · Ícono de pestaña propio · …", § CLAUDE.md "sin
  // tarjetas grandes con botón Editar"). El resumen en palabras SE RETIRA —no se mueve a ningún
  // otro sitio—: los switches de la vista de edición YA muestran su propio estado, así que la frase
  // sólo repetía, en otra forma, lo que el formulario dice al abrirlo.
  if (!editando) {
    return (
      <FilaSeccion
        icono={<IconoFila tipo="nav" />}
        titulo="Encabezado"
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
            <h2 className="duna-title">Encabezado</h2>
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

      <>
        {/* LA IMAGEN DEL LOGO (§ MARCA-LOGO-IMAGEN-1) — tarjeta PROPIA, antes de los switches: es
            una decisión distinta ("¿tengo un logo?"), no un ajuste más del nav. */}
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <h3 className="duna-field__label" style={{ margin: 0, fontSize: '0.9375rem' }}>Imagen del logo</h3>
          <div style={{ marginTop: '4px' }}>
            <AyudaCampo texto={`Reemplaza el nombre en texto del encabezado, el pie de página y el menú móvil. Sin ninguna imagen, se muestra el nombre de tu negocio (o la flor, si tu despliegue la tiene). SVG o PNG con fondo transparente, máx ${MAX_SUBIDA_DIRECTA_MB} MB. Si subes sólo una versión, se usa también para la otra.`} />
          </div>
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
                          onClick={() => cambiar({ [CAMPO_DE_VARIANTE[cual]]: '' } as Partial<Form>)}
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
          {/* `errorLogo` es el ÚNICO canal de error de las TRES subidas de esta sección (oscuro,
              claro, icono) — se muestra UNA vez acá, no repetido en la tarjeta del ícono de abajo. */}
          {errorLogo && <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-2)' }}>{errorLogo}</p>}
          <div className="duna-field" style={{ marginTop: 'var(--duna-space-3)' }}>
            <label className="duna-field__label" htmlFor="enc-logo-alt">Texto alternativo</label>
            <input
              id="enc-logo-alt" className="duna-input"
              value={form.logoAlt} onChange={(e) => cambiar({ logoAlt: e.target.value })}
              placeholder="Ej. Logo de Café Las Chamisas"
            />
            <AyudaCampo texto="Vacío: se usa el nombre de tu negocio." />
          </div>
          {/* CÓMO SE MUESTRA LA MARCA EN EL NAV (§ NAV-LOGO-Y-NOMBRE-1) — DENTRO de esta tarjeta,
              no de los switches de abajo: sigue siendo la MISMA decisión ("¿cómo se ve mi marca?"),
              no un ajuste más del nav. El `value` es el RESUELTO (`modoActual`), nunca `form.
              logoModo` crudo — mostrar un `''` como cuarta opción en blanco no es una de las tres
              que el spec pide. */}
          <div className="duna-field" style={{ marginTop: 'var(--duna-space-3)' }}>
            <label className="duna-field__label" htmlFor="enc-logo-modo">Cómo se muestra la marca</label>
            <select
              id="enc-logo-modo" className="duna-input duna-select"
              value={modoActual}
              onChange={(e) => cambiar({ logoModo: e.target.value })}
            >
              <option value="soloNombre">Sólo nombre</option>
              <option value="soloLogo">Sólo logo</option>
              <option value="logoYNombre">Logo en el teléfono, logo y nombre en escritorio</option>
            </select>
            <AyudaCampo texto={tieneLogoImagen
              ? 'Sin elegir, se usa sólo el logo en todos los anchos — el comportamiento de hoy.'
              : 'Sin una imagen subida arriba, siempre se muestra el nombre, sea cual sea esta opción.'} />
          </div>
          <input ref={subidaImagen.inputHoldRef} type="file" onChange={subidaImagen.alElegirHold} hidden />
        </div>
        {/* EL ÍCONO DE LA PESTAÑA (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1) — tarjeta PROPIA, aparte
            del logo de arriba: es un ícono CUADRADO para favicon/apple-touch/PWA, distinto del
            wordmark/mark del nav (que suele ser rectangular y se vería mal recortado a 16×16). Sin
            ícono propio, la tienda usa los de Café Nayoli (§ `lib/config/metadata-tienda.ts`). */}
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <h3 className="duna-field__label" style={{ margin: 0, fontSize: '0.9375rem' }}>Ícono de la pestaña</h3>
          <div style={{ marginTop: '4px' }}>
            <AyudaCampo texto={`El ícono de la pestaña del navegador, de la vista previa al compartir y de la pantalla de inicio si tu tienda se instala como app. Sin uno propio, se usa el de Café Nayoli. Cuadrado, SVG o PNG, máx ${MAX_SUBIDA_DIRECTA_MB} MB.`} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-3)' }}>
            <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
              {form.logoIcono
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={form.logoIcono} alt="" />
                : <ImageIcon aria-hidden width={20} height={20} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => subirLogo('icono')}
                  className="duna-btn duna-btn--secondary duna-btn--sm"
                  disabled={subidaImagen.subiendo}
                >
                  <Upload /> {form.logoIcono ? 'Cambiar' : 'Subir imagen'}
                </button>
                {form.logoIcono && (
                  <button
                    type="button"
                    onClick={() => cambiar({ logoIcono: '' })}
                    className="duna-btn duna-btn--ghost duna-btn--sm"
                    disabled={subidaImagen.subiendo}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <span className="duna-field__hint" style={{ margin: 0 }}>
                {subiendoCual === 'icono' ? `Subiendo… ${subidaImagen.progreso ?? 0}%` : 'Recomendado: cuadrado, de al menos 192×192 px.'}
              </span>
              {subiendoCual === 'icono' && <BarraProgreso pct={subidaImagen.progreso ?? 0} />}
            </div>
          </div>
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
                  <div style={{ marginTop: 'var(--duna-space-2)' }}><AyudaCampo texto={c.hint} /></div>
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
                        <div style={{ marginTop: '6px' }}>
                          <AyudaCampo texto="Vacío: el badge sigue con el color de acento cálido de siempre." />
                        </div>
                      )}
                    </div>
                  )}
                  {/* Sub-control de "Drawer móvil de pantalla completa" (§ NAV-MOVIL-SIN-BUSCAR-1):
                      SÓLO tiene efecto con ESE switch encendido — es el ÚNICO drawer móvil que trae
                      su propio buscar en la cabecera (verificado leyendo `StoreNav.tsx`); el drawer
                      `'dropdown'` de hoy no lo tiene, así que ahí apagarlo dejaría al visitante sin
                      ninguna vía de búsqueda en el teléfono. Por eso NO es una entrada más de
                      `CONTROLES` (quedaría encendida/ofrecida también para `'dropdown'`): se anida
                      bajo su hint, mismo patrón que `badgeColor` bajo `ctaBadge`. */}
                  {c.name === 'drawerMovil' && form.drawerMovil && (
                    <div style={{ marginTop: 'var(--duna-space-3)', marginLeft: 'calc(2.5rem + var(--duna-space-3))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
                        <button
                          type="button" role="switch" aria-checked={form.buscarMovil}
                          aria-label="Mostrar buscar en la barra del teléfono"
                          onClick={() => cambiar({ buscarMovil: !form.buscarMovil })}
                          className={`duna-switch${form.buscarMovil ? ' is-on' : ''}`}
                        >
                          <span className="duna-switch__thumb" />
                        </button>
                        <span className="duna-field__label" style={{ margin: 0 }}>Mostrar buscar en la barra del teléfono</span>
                      </div>
                      <div style={{ marginTop: 'var(--duna-space-2)' }}>
                        <AyudaCampo texto="En el teléfono, el ícono de buscar aparece en la barra del encabezado. Apágalo para quitarlo de ahí — sigue disponible dentro del menú." />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>

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
});

export default EncabezadoSeccion;
