'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { Pencil, Maximize2 } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ProductCard from '@/components/storefront/ProductCard';
import { Logo } from '@/components/storefront/Logo';
import { STOREFRONT_TIENE_MARK } from '@/lib/config/storefront-marca';
import TrustBadges from '@/components/storefront/home/TrustBadges';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type TemaContent } from '@/lib/config/site-content-defaults';
import { EscalaDesktop } from '@/components/admin/EscalaDesktop';
import { CartProvider } from '@/lib/cartStore';
import type { Product } from '@/types/product';
import { derivarPaleta, contraste, RAICES_DEFECTO, type EjesPaleta, type OrigenTexto, type OrigenAccion } from '@/lib/config/palette-derive';
import { varsDeTienda, varsDeTemaEnVivo } from '@/lib/config/esquema-style';
import { PARES_FUENTES, linkFuentesTodas, resolverFuentePar, type ClaveFuentePar } from '@/lib/config/fuentes';
import { FORMAS, resolverForma, type ClaveForma } from '@/lib/config/formas';
import type { PresetTema } from '@/lib/config/themes';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { Combinaciones } from '@/components/admin/editor/Combinaciones';

// ─── Bloque COLORES DE LA TIENDA — vive en /admin/tienda, SOBRE el selector de página ────────────
//
// La paleta es la PIEL de TODO el storefront (nav, footer, cada página), ortogonal a las páginas —
// por eso su bloque va SOBRE `TiendaPaginas`, no dentro de una pestaña—. El cliente elige 3 RAÍCES
// —fondo·tinta·acento—; el motor deriva las demás y las inyecta el layout del storefront.
//
// Adopta el CONTRATO de borrador de las secciones vecinas (§ TiendaSeccionEditor): read↔edit +
// AUTOGUARDADO del borrador (`useAutoguardado`) + píldora "Sin publicar" + Publicar/Descartar +
// `ConfirmDescartarDialog`. Una sola conducta en la pantalla —Tienda es "lo que se publica"; la
// paleta se mudó de SiteSetting (donde guardar=publicar al instante) a `content.tema` para ganar
// ese flujo (§ doctrina: la frontera borrador/no-borrador es de PANTALLA).
//
// DOS diferencias con las secciones, ambas por la validación DURA de la paleta (hex-6, todo-o-nada):
//  · el autoguardado dispara SÓLO en estados VÁLIDOS (§ el guard `esValido`): un acento a medio
//    teclear no es un guardado parcial, es un 400 — el error inline lo cubre y guarda solo al volver
//    a ser válido;
//  · "Usar el tema por defecto" es un RESET DIRECTO —publica las 3 raíces en NULL al instante (misma
//    clase que el toggle de página: config, no contenido en revisión)—, con CONFIRMACIÓN porque borra
//    el trabajo sin publicar y resetea lo publicado sin vuelta atrás.
//
// HÍBRIDO (owner): BASES curadas para fondo+tinta (garantizan el contraste bg↔texto) + picker LIBRE
// para el acento. El PISO de contraste y el auto-flip cubren lo derivado; el aviso, lo que el cliente
// elige. Avisa, NO bloquea — es su tienda.

// Los defaults de código (§ globals.css `--sf-*`) = la paleta de Nayoli. Raíces null → estos.
// FUENTE ÚNICA con los correos (§ email-colors): mismo `RAICES_DEFECTO` de palette-derive.
const DEFAULT_RAICES = RAICES_DEFECTO;

// Bases fondo+tinta CURADAS (todas ≥AA de texto sobre fondo, medido). El cliente elige una;
// el acento va aparte. La PRIMERA es NEUTRA a propósito (gris cálido): un rubro concreto de
// primera —'Café' liderando— pondría la marca de Nayoli como punto de partida de todo cliente
// nuevo. 'Crema' (la base de Nayoli) va después, y su nombre ya no evoca el rubro.
//
// DISPARADOR de una QUINTA base: NO es "otra base más". Las cuatro son lienzos CLAROS (fondo
// claro, texto oscuro), y el reparto —acento libre carga la identidad, base callada— las sostiene
// para v1. El único faltante real es un lienzo OSCURO, y ése NO es una base: es MODO OSCURO del
// storefront —los componentes asumen fondo claro, así que un fondo oscuro exige que cada uno
// maneje el lienzo invertido, como el dark-mode del panel—. Se agrega cuando un cliente pida
// tienda oscura, no antes.
const BASES: { label: string; fondo: string; tinta: string }[] = [
  { label: 'Neutro',  fondo: '#f6f5f3', tinta: '#1c1a18' },
  { label: 'Crema',   fondo: '#faf7f4', tinta: '#1a0f08' },
  { label: 'Taupe',   fondo: '#f5f4f2', tinta: '#1b1a17' },
  { label: 'Pizarra', fondo: '#f5f6f7', tinta: '#191a1c' },
];

// EXPORTADO (junto con `FragmentoTienda`, abajo) para que `admin-tienda-preset.test.ts` pueda
// renderizarlo directo, sin pasar por el fetch/estado `cargando` del componente por defecto — el
// mismo motivo que exporta `FragmentoTienda`, ver su docstring.
export interface Form { fondo: string; tinta: string; acento: string }

const HEX6 = /^#[0-9a-fA-F]{6}$/;

// EL ESCENARIO se ACOTA al viewport para que el preview Y la regleta quepan sin scroll. Su alto NO
// es un literal: se DERIVA del top real medido (§ el cálculo en el componente). Constantes del cálculo:
const ESCENA_MIN     = 240; // piso: nunca colapsa por debajo de esto
const ESCENA_COLCHON = 16;  // aire bajo el escenario, para no pegar contra el borde del viewport
const MOBNAV_ALTO    = 64;  // la barra inferior fija (`.duna-mobnav`, <960) que tapa el fondo en angosto

// `useLayoutEffect` isomórfico: en el CLIENTE mide antes del paint (sin parpadeo del alto del escenario);
// en SSR cae a `useEffect` para no emitir el warning de React (la pieza es 'use client' y se SSR-renderiza).
const useLayoutSeguro = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// El seed de cada raíz para el FORM (que renderiza pickers, y por eso siempre necesita un hex) cae al
// default cuando el valor guardado en `content.tema` NO es un hex válido —null (fábrica), undefined,
// vacío o basura—, no sólo cuando es nullish. El `content.tema` ya viene resuelto por `resolverTema`
// (hex-o-null), así que en la práctica se recibe hex o null; esta función mapea el null de fábrica al
// hex de defecto para que el picker tenga algo que mostrar. La distinción fábrica/custom NO sale de
// acá —sale de si la raíz venía en null— (§ `esFabrica` en el componente).
function raizValida(v: string | null, def: string): string {
  return v && HEX6.test(v) ? v : def;
}

// Productos de MUESTRA para la vista previa. Nombres GENÉRICOS a propósito —no cafés de Nayoli—
// para que nadie los confunda con productos reales. Sin imagen (ProductCard cae a su fondo de
// superficie). Uno `bestseller` + `badge` para que el chip de acento (bg acento + texto
// `acento-txt`, el flip) se vea SIN hover —el botón "agregar" es hover-only y bajo
// `pointer-events:none` no aparece, así que el badge es quien muestra el acento en estático—.
const PRODUCTOS_MUESTRA: Product[] = [
  {
    id: 'muestra-1', nombre: 'Producto de muestra', slug: 'muestra-1',
    categoria: 'cafe_bolsa', precio: 45000, costo: 20000, sku: null, stock: 12,
    activo: true, disponible: true, descripcion: 'Producto de ejemplo para la vista previa de la paleta.',
    bestseller: true, badge: 'Destacado', notas: ['Suave', 'Equilibrado'],
  },
  {
    id: 'muestra-2', nombre: 'Otro producto de muestra', slug: 'muestra-2',
    categoria: 'cafe_bolsa', precio: 38000, costo: 18000, sku: null, stock: 8,
    activo: true, disponible: true, descripcion: 'Segundo producto de ejemplo para la vista previa.',
    notas: ['Frutal', 'Cítrico'],
  },
  {
    id: 'muestra-3', nombre: 'Tercer producto de muestra', slug: 'muestra-3',
    categoria: 'cafe_bolsa', precio: 52000, costo: 24000, sku: null, stock: 6,
    activo: true, disponible: true, descripcion: 'Tercer producto de ejemplo para la vista previa.',
    notas: ['Chocolate', 'Nuez'],
  },
];

/** EL FRAGMENTO: un pedazo de tienda que se lee como pantalla, con COMPONENTES REALES del
 *  storefront —no un croquis—: una barra con el wordmark (`Logo`), la franja de garantías
 *  (`TrustBadges`) y tres `ProductCard`, sobre `--sf-fondo` y alimentados por la paleta DERIVADA
 *  del form. INERTE (`pointer-events:none` en la raíz: sin carrito, sin navegación, sin hover — en
 *  el inline el clic lo captura el wrapper de ampliar; en el overlay es sólo para ver).
 *
 *  Es UNA sola pieza: la renderizan tanto el preview inline (`EscalaDesktop` grande) como el
 *  overlay de ampliar (`EscalaDesktop` compacto). NO diverge entre los dos —lo único que cambia es
 *  el MODO de EscalaDesktop, que va afuera—, así que no hay segunda representación que mienta.
 *
 *  Layout de ESCRITORIO interno (`max-w-6xl` centrado, TrustBadges en sus 4 columnas a 1280,
 *  tarjetas en `repeat(3,1fr)`): a 1280 se ve natural, no dos tarjetas gigantes escaladas.
 *
 *  Qué se monta sin fetch (censo del gate): `Logo` por PROP sin providers; `TrustBadges` YA NO es
 *  estático (§ CORTE-TRUSTBADGES-OCULTABLE-1: lee `useSiteContent()`) y `ProductCard` GANÓ la misma
 *  lectura (§ RIEL-SCROLL-Y-BADGE-DORADO-1: el fondo del badge, `navTratamiento.badgeColor`) — los
 *  DOS necesitan el MISMO `SiteContentProvider` local, así que comparten UNO (abajo), no dos
 *  idénticos; `StoreNav` quedó FUERA (3 providers + chrome inerte). `ProductCard` además necesita
 *  `CartProvider` local e inerte (§ Las tres capas — montar un componente en otro árbol de
 *  providers; landmine medido y cerrado por `ADMIN-TIENDA-ROTO-CON-PRESET-1`, DECISIONS.md, y por
 *  esta misma tanda para el segundo consumidor). `DEFAULTS` alcanza: la muestra de paleta no
 *  necesita reflejar el toggle real de `trustBadges.visible` ni un `badgeColor` de preset, sólo no
 *  reventar — los dos defaults (`true`/`null`) dejan la franja y el badge como hasta ahora.
 *
 *  EXPORTADO (§ ADMIN-TIENDA-ROTO-CON-PRESET-1) para que `admin-tienda-preset.test.ts` pueda
 *  renderizarlo DIRECTO, con las raíces/fuente/forma que resulten de cada preset del catálogo — es
 *  la ÚNICA pieza de `/admin/tienda` que monta componentes REALES del storefront alimentados por
 *  contenido derivable de un preset, así que es la única con este tipo de landmine posible. El
 *  componente por DEFECTO (`PaletaSeccion`) no se puede renderizar así: arranca en `cargando` y
 *  sólo llega a montar esto tras un `fetch` que un render SSR (sin jsdom, § CLAUDE.md) no ejecuta.
 *
 *  `ejes` (§ PANEL-PREVIEW-COLORES-REALES-1, `EjesPaleta`, `palette-derive.ts`) es OPCIONAL —ausente
 *  reproduce el `derivarPaleta(raices)` de SIEMPRE—: hasta este slice el preview de esta pieza NUNCA
 *  los pasaba, así que bajo un tema que declare `origenTexto`/`origenAccion` (hoy sólo CORTE) el
 *  texto/acción de la muestra salía de la RECETA de siempre (nacida del acento) en vez del origen
 *  real publicado — la misma familia de defecto que `/tienda` tuvo antes de `TIENDA-ENCABEZADO-Y-
 *  FILTRAR-ORDENAR-1`, acá en el PANEL. `PaletaSeccion` no EDITA estos dos ejes (no hay campo en
 *  `paletaEditableSchema` ni en este editor, § panel-controles.ts, `PANEL-EDITOR-TEMA-EJES-1`) — sólo
 *  los LEE del tema publicado/borrador para que el preview no mienta; el `wireDe` que arma el PUT
 *  sigue sin tocarlos.
 *
 *  LAS VARS SALEN DE `varsDeTienda` (§ esquema-style.ts, PANEL-PREVIEW-COLORES-REALES-1), NO DE UNA
 *  COMPOSICIÓN PROPIA: hasta este slice esta pieza armaba `{ paleta, fuente, forma }` a mano —la
 *  MISMA composición que `varsDeTienda` hace ahora, pero una segunda vez, con el riesgo de que las
 *  dos diverjan (era, de hecho, la que le faltaban los `ejes`). `raices`/`fuentePar`/`forma`/`ejes`
 *  se empacan en un `TemaContent` sintético —sin banda (esta pieza no tiene una), `escalaDisplay`
 *  fijo en `null` (esa clave no produce ninguna var CSS, § su docstring en site-content-defaults.ts)—
 *  para llamar a la MISMA función que consume `VistaTiendaEnVivo.tsx`. */
export function FragmentoTienda({ raices, nombre, fuentePar, forma, ejes }: { raices: Form; nombre: string; fuentePar: ClaveFuentePar | null; forma: ClaveForma | null; ejes?: EjesPaleta }) {
  const temaSintetico: TemaContent = {
    fondo: raices.fondo, tinta: raices.tinta, acento: raices.acento,
    fuentePar, forma,
    origenTexto: ejes?.origenTexto ?? null, origenAccion: ejes?.origenAccion ?? null,
    escalaDisplay: null,
  };
  const vars = varsDeTienda(temaSintetico) as CSSProperties;
  return (
    <div className="font-inter" style={{ ...vars, background: 'var(--sf-fondo)', pointerEvents: 'none' }}>
      {/* Barra superior con el wordmark real (centrada como el nav) */}
      <div className="mx-auto max-w-6xl px-6 py-4">
        <Logo nombre={nombre} conMark={STOREFRONT_TIENE_MARK} />
      </div>
      {/* Provider LOCAL con DEFAULTS, sobre TODO el resto del fragmento — no sólo `TrustBadges`.
          `ProductCard` (§ RIEL-SCROLL-Y-BADGE-DORADO-1) ganó su propia lectura de
          `useSiteContent()` (el fondo del badge, `navTratamiento.badgeColor`), así que la landmine
          que el docstring de arriba ya documenta ("montar sin el mismo tipo de provider revienta
          en runtime, ni tsc ni el build lo atrapan") se repetiría acá si el provider siguiera
          cerrando antes del `CartProvider`/`ProductCard` de abajo. Un solo provider que cubra los
          DOS consumidores es más simple que dos providers locales idénticos. */}
      <SiteContentProvider value={DEFAULTS}>
        {/* Franja de garantías real (su propio `border-y` la separa; a 1280 usa sus 4 columnas). */}
        <TrustBadges />
        {/* Tres tarjetas reales en fila de escritorio, bajo un CartProvider local inerte */}
        <CartProvider>
          <div className="mx-auto max-w-6xl px-6 py-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {PRODUCTOS_MUESTRA.map(pr => <ProductCard key={pr.id} product={pr} />)}
          </div>
        </CartProvider>
      </SiteContentProvider>
    </div>
  );
}

/** El preview de LECTURA: el fragmento escalado por ancho (`EscalaDesktop` grande) dentro del pane
 *  COMÚN de las vistas en vivo (`.tienda-vivo-pane`, § alineado con VistaTiendaEnVivo). El escenario
 *  de EDICIÓN usa su propio pane (`.tienda-escena__pane`), así que "Ampliar" ya no vive acá —es un
 *  chip del escenario—: en lectura el owner no está afinando nada y no lo necesita. */
function PreviewTiendaReal({ raices, nombre, fuentePar, forma, ejes }: { raices: Form; nombre: string; fuentePar: ClaveFuentePar | null; forma: ClaveForma | null; ejes?: EjesPaleta }) {
  return (
    <EscalaDesktop className="tienda-vivo-pane">
      <FragmentoTienda raices={raices} nombre={nombre} fuentePar={fuentePar} forma={forma} ejes={ejes} />
    </EscalaDesktop>
  );
}

/** El overlay de AMPLIAR: el MISMO fragmento (vivo por construcción — las mismas raíces) en el
 *  `Dialog` del admin (Esc, clic-afuera, foco atrapado, X, scroll-lock, todo de Radix — NO
 *  ImageLightbox, que es image-only). `EscalaDesktop` COMPACTO lo encaja entero en la caja
 *  (scale-to-fit, letterbox), como una foto en un visor. */
function AmpliarOverlay({ abierto, onCerrar, raices, nombre, fuentePar, forma, ejes }: { abierto: boolean; onCerrar: () => void; raices: Form; nombre: string; fuentePar: ClaveFuentePar | null; forma: ClaveForma | null; ejes?: EjesPaleta }) {
  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[92vw] max-w-[1400px] p-4 sm:p-6"
      >
        <DialogTitle className="sr-only">Vista previa ampliada de la apariencia de la tienda</DialogTitle>
        {/* Alto EXPLÍCITO (vh), no `height:100%`: compacto necesita una caja de alto definido para
            el scale-to-fit, y una cadena de `100%` a través del padding del Dialog es frágil. */}
        <EscalaDesktop compacto style={{ width: '100%', height: '82vh', overflow: 'hidden' }}>
          <FragmentoTienda raices={raices} nombre={nombre} fuentePar={fuentePar} forma={forma} ejes={ejes} />
        </EscalaDesktop>
      </DialogContent>
    </Dialog>
  );
}

/** Un aviso de contraste, PEGADO al control que lo causa (§ Fix 3) — ámbar (`--duna-sol-ink` =
 *  atención), no rojo: avisa, no bloquea (es su tienda). */
function Aviso({ children }: { children: string }) {
  return (
    <p className="duna-caption" role="status"
       style={{ color: 'var(--duna-sol-ink)', lineHeight: 1.4, marginTop: 'var(--duna-space-2)', marginBottom: 0 }}>
      ⚠ {children}
    </p>
  );
}

export interface PaletaSeccionProps {
  /** § EDITOR-TIENDA-TEMA-1 — `true` cuando se monta DENTRO de la pestaña «Tema» del editor de
   *  pantalla completa (`/editor/tienda`), en vez de en su sitio histórico (`/admin/tienda`).
   *  AUSENTE/`false` (el default) reproduce EXACTAMENTE el render de siempre — la lectura con
   *  `PreviewTiendaReal`, el escenario con el pane escalado + "Ampliar" + "Lo que se calcula
   *  solo" — para no mover ni un byte del smoke test existente
   *  (`lib/config/admin-tienda-preset.test.ts`, fuera de `touches:`, que renderiza
   *  `<PaletaSeccion/>` a secas). `true` cambia SÓLO la FORMA de la lectura/edición (fila
   *  `.tienda-tarjeta` + regleta sin pane, el mismo patrón "sin miniatura propia" que
   *  `TiendaSeccionEditor` ya adoptó cuando el iframe compartido se volvió la vista en vivo):
   *  la PÁGINA REAL al lado (el iframe de `VistaTiendaIframe`) reemplaza al fragmento sintético
   *  como preview, así que repetirlo acá sería la duplicación que el spec pide evitar. NINGUNA
   *  lógica de datos (carga/validación/autoguardado/publicar/descartar/reset-fábrica) cambia con
   *  este prop — es el MISMO control, § el spec: "el MISMO componente/lógica, no una copia". */
  enEditor?: boolean;
  /** § EDITOR-TIENDA-TEMA-1 — llamado con las variables CSS YA RESUELTAS (`varsDeTemaEnVivo`,
   *  SIEMPRE completas) cada vez que el tema en edición cambia — al sembrar el borrador cargado y
   *  en cada edición válida (acento a medio teclear NO dispara, mismo guard que el autoguardado,
   *  § el efecto abajo). El padre (`TiendaPaginas.tsx`) las reenvía al iframe compartido por el
   *  MISMO puente que ya usa 'orden' (`seccion: 'tema'`, § `editor-puente.ts`). Ausente = no se
   *  llama a nada (el standalone de `/admin/tienda` no tiene iframe que avisar). */
  onCambioEnVivo?: (vars: Record<string, string>) => void;
}

export default function PaletaSeccion({ enEditor = false, onCambioEnVivo }: PaletaSeccionProps = {}) {
  const settings = useSiteSettings(); // sólo para el `nombre` del wordmark del preview

  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [esFabrica, setEsFabrica]         = useState(true);   // las 3 raíces en null (colores de fábrica); NO habla del par
  const [fuentePar, setFuentePar]         = useState<ClaveFuentePar | null>(null);   // null = Editorial (el par por defecto)
  const [forma, setForma]                 = useState<ClaveForma | null>(null);       // null = Suave (la forma por defecto)
  // LOS DOS EJES, SÓLO LECTURA (§ PANEL-PREVIEW-COLORES-REALES-1) — este editor no los escribe (no
  // hay campo en `paletaEditableSchema` ni acá, § panel-controles.ts `PANEL-EDITOR-TEMA-EJES-1`); se
  // guardan sólo para que el PREVIEW de esta pieza derive con el mismo origen que la tienda real
  // (`FragmentoTienda`, más abajo). `wireDe`/`guardarTema`/`resetFabrica` NO los tocan.
  const [origenTexto, setOrigenTexto]     = useState<OrigenTexto | null>(null);
  const [origenAccion, setOrigenAccion]   = useState<OrigenAccion | null>(null);
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [confirmandoFabrica, setConfirmandoFabrica]   = useState(false);
  const [ampliado, setAmpliado]           = useState(false);
  const [grupoActivo, setGrupoActivo]     = useState<'base' | 'acento' | 'tipo' | 'forma'>('base'); // regleta ANGOSTA: qué eje se ve
  const [verCalculado, setVerCalculado]   = useState(false); // la capa de derivados sobre el pane
  const [altoEscena, setAltoEscena]       = useState<number>(); // alto del escenario, DERIVADO del top medido

  const formRef = useRef<Form | null>(null); formRef.current = form;
  const fuenteParRef = useRef<ClaveFuentePar | null>(null); fuenteParRef.current = fuentePar;
  const formaRef = useRef<ClaveForma | null>(null); formaRef.current = forma;
  const esFabricaRef = useRef(true); esFabricaRef.current = esFabrica;
  const escenaRef = useRef<HTMLDivElement | null>(null);
  const cabeceraRef = useRef<HTMLDivElement | null>(null);

  // EL ALTO DEL ESCENARIO — DERIVADO, sin literal (§ la decisión del owner). Medimos el TOP real del
  // escenario en el documento (`rect.top + scrollY`, estable ante el scroll: `main` scrollea con la
  // ventana porque /admin/tienda NO opta por alto fijo —tiene TiendaPaginas abajo—) y restamos del
  // viewport. Así el número sale de la PANTALLA —topbar + título + cabecera + aire, lo que sea— y no
  // de un 76 horneado que se rompe en silencio si el título cambia de alto.
  const medirEscena = useCallback(() => {
    const el = escenaRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    // En angosto la barra inferior fija (`.duna-mobnav`) tapa el fondo del viewport. El umbral 960 es
    // el MISMO que la enciende (primitives.css) — se mueven juntos, como el par CSS↔hook del split.
    const angosto = window.matchMedia('(max-width: 959.98px)').matches;
    const alto = Math.round(window.innerHeight - top - ESCENA_COLCHON - (angosto ? MOBNAV_ALTO : 0));
    setAltoEscena(Math.max(ESCENA_MIN, alto));
  }, []);

  // Re-mide al entrar en edición, cuando cambia el alto de la CABECERA (píldora "Sin publicar",
  // indicador de guardado, error del servidor → ResizeObserver) o el viewport (resize). El
  // ResizeObserver sobre la cabecera no puede entrar en bucle: su alto no depende del alto del escenario.
  // GATEADO también a `!enEditor` (§ EDITOR-TIENDA-TEMA-1): el EMBED no monta ningún `.tienda-escena`
  // —sólo la regleta, sin pane que dimensionar—, así que no hay nada que medir.
  useLayoutSeguro(() => {
    if (!editando || enEditor) return;
    medirEscena();
    const ro = new ResizeObserver(medirEscena);
    if (cabeceraRef.current) ro.observe(cabeceraRef.current);
    window.addEventListener('resize', medirEscena);
    return () => { ro.disconnect(); window.removeEventListener('resize', medirEscena); };
  }, [editando, enEditor, medirEscena]);

  // El TEMA que viaja al PUT: las 3 raíces (NULL si los colores siguen en fábrica → se preserva
  // byte-idéntico; hexes si el cliente eligió colores) + el par. Elegir FUENTE no fuerza los colores a
  // custom, ni al revés: cada eje conserva su default. `marcarSucio` recibe este objeto ya resuelto.
  type TemaWire = { paletaFondo: string | null; paletaTinta: string | null; paletaAcento: string | null; fuentePar: ClaveFuentePar | null; forma: ClaveForma | null };
  const wireDe = (f: Form, coloresFabrica: boolean, fp: ClaveFuentePar | null, fm: ClaveForma | null): TemaWire => ({
    paletaFondo:  coloresFabrica ? null : f.fondo,
    paletaTinta:  coloresFabrica ? null : f.tinta,
    paletaAcento: coloresFabrica ? null : f.acento,
    fuentePar: fp,
    forma: fm,
  });

  // AUTOGUARDADO del borrador del tema — la MISMA máquina que las secciones (§ useAutoguardado). Sólo
  // se ensucia con una paleta VÁLIDA (§ `cambiar`); un PUT con un hex a medias sería un 400.
  const guardarTema = useCallback(async (w: TemaWire) => {
    const res = await fetch('/api/site-content/tema', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(w),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarTema);

  // El `<link>` que carga TODOS los pares para el PANEL (§ fuentes): el picker muestra una muestra por
  // par y la vista previa refleja el elegido, así que el editor necesita las familias de los 5. Se
  // inyecta UNA vez en <head> (idempotente por id). NO se limpia al desmontar: dejar la hoja evita el
  // re-fetch si se re-monta, y es el panel (interno) — no toca al storefront.
  useEffect(() => {
    const ID = 'duna-fuentes-preview';
    if (document.getElementById(ID)) return;
    const link = document.createElement('link');
    link.id = ID; link.rel = 'stylesheet'; link.href = linkFuentesTodas();
    document.head.appendChild(link);
  }, []);

  // Carga el tema draft-merged (GET /api/site-content → `contenido.tema` + `sinPublicar.tema`). El
  // FORM siempre tiene hexes (el picker los necesita); la distinción fábrica/custom sale de si la
  // raíz venía en null.
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const t = (d.contenido?.tema ?? {}) as { fondo?: string | null; tinta?: string | null; acento?: string | null; fuentePar?: unknown; forma?: unknown; origenTexto?: unknown; origenAccion?: unknown };
      setForm({
        fondo:  raizValida(t.fondo  ?? null, DEFAULT_RAICES.fondo),
        tinta:  raizValida(t.tinta  ?? null, DEFAULT_RAICES.tinta),
        acento: raizValida(t.acento ?? null, DEFAULT_RAICES.acento),
      });
      setEsFabrica(t.fondo == null);          // sin raíces guardadas = colores de fábrica (defaults de código)
      setFuentePar(resolverFuentePar(t.fuentePar));  // par CUSTOM válido, o null (Editorial)
      setForma(resolverForma(t.forma));              // forma CUSTOM válida, o null (Suave)
      // SÓLO LECTURA (§ arriba): ningún preset real hoy salvo CORTE los declara; el `??`/tipo laxo
      // no valida más allá de lo que `derivarPaleta` ya tolera (un valor ajeno cae en el `if` de
      // ningún caso conocido y se comporta como ausente).
      setOrigenTexto((t.origenTexto === 'tinta' ? 'tinta' : null));
      setOrigenAccion((t.origenAccion === 'acento' ? 'acento' : null));
      setHayBorrador(!!d.sinPublicar?.tema);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudieron cargar los colores.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión), igual que las secciones: pendiente/guardando es común
  // y recuperable; un guardado que FALLÓ y no persiste es el caso grave.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  const esValido = (f: Form) => HEX6.test(f.fondo) && HEX6.test(f.tinta) && HEX6.test(f.acento);

  // § EDITOR-TIENDA-TEMA-1 — EL EMPUJE EN VIVO al iframe compartido (sólo si `enEditor`). Reactivo
  // sobre el ESTADO, como `onCambio` de `TiendaSeccionEditor` (nunca llamado inline dentro de
  // `cambiar`/`cambiarFuente`/`cambiarForma`): así dispara TAMBIÉN al sembrar el borrador cargado
  // (primera vez que `form` deja de ser `null`), no sólo en cada edición — el iframe debe arrancar
  // mostrando el BORRADOR, no lo publicado, si hay uno sin publicar. Mismo guard `esValido` que el
  // autoguardado: un acento a medio teclear no empuja nada —ya hay un error inline que lo cubre, y
  // empujar ahí pintaría la tienda real con un color basura (`derivarPaleta` no tira con hex roto,
  // pero el resultado no significa nada)—.
  useEffect(() => {
    if (!enEditor || !onCambioEnVivo || !form || !esValido(form)) return;
    const temaActual: TemaContent = {
      fondo: form.fondo, tinta: form.tinta, acento: form.acento, fuentePar, forma,
      origenTexto, origenAccion, escalaDisplay: null,
    };
    onCambioEnVivo(varsDeTemaEnVivo(temaActual));
  }, [enEditor, onCambioEnVivo, form, fuentePar, forma, origenTexto, origenAccion]);

  // Un cambio de raíz: pisa el form y —SI queda válido— marca borrador y ensucia el autoguardado. Si
  // el acento quedó inválido (a medio teclear), NO se guarda: el error inline lo cubre, y el PRÓXIMO
  // cambio que lo devuelva a hex válido dispara el autoguardado SOLO, sin que el operador toque nada
  // más. El picker de BASE y el `type=color` siempre producen hex válido.
  const cambiar = (parcial: Partial<Form>) => {
    const nf = { ...(formRef.current as Form), ...parcial };
    setForm(nf);
    setEsFabrica(false);                 // elegir COLORES = colores custom (no toca el par)
    if (esValido(nf)) { setHayBorrador(true); auto.marcarSucio(wireDe(nf, false, fuenteParRef.current, formaRef.current)); }
  };

  // Elegir FUENTE: un par siempre es VÁLIDO (set cerrado), así que siempre ensucia el autoguardado —a
  // diferencia del acento a medio teclear—. NO toca `esFabrica`: cambiar la tipografía no fuerza los
  // colores a custom (si estaban en fábrica, siguen en null → byte-idéntico). `null` = Editorial.
  const cambiarFuente = (fp: ClaveFuentePar | null) => {
    setFuentePar(fp);
    setHayBorrador(true);
    auto.marcarSucio(wireDe(formRef.current as Form, esFabricaRef.current, fp, formaRef.current));
  };

  // Elegir FORMA: una forma siempre es VÁLIDA (set cerrado), así que siempre ensucia el autoguardado.
  // NO toca `esFabrica` ni el par: cambiar la forma no fuerza los colores ni la tipografía a custom
  // (cada eje conserva su default). `null` = Suave (§ formas).
  const cambiarForma = (fm: ClaveForma | null) => {
    setForma(fm);
    setHayBorrador(true);
    auto.marcarSucio(wireDe(formRef.current as Form, esFabricaRef.current, fuenteParRef.current, fm));
  };

  const elegirBase = (b: (typeof BASES)[number]) => cambiar({ fondo: b.fondo, tinta: b.tinta });

  // COMBINACIONES (§ EDITOR-TIENDA-SHELL-1, `components/admin/editor/Combinaciones.tsx` — ver su
  // docstring para el ALCANCE acotado y por qué: sólo raíces + par + forma, nunca la composición
  // completa del `PresetTema`). UNA sola escritura de estado con los TRES valores NUEVOS juntos —no
  // `cambiar()` + `cambiarFuente()` + `cambiarForma()` en secuencia, que leerían `formRef`/
  // `fuenteParRef`/`formaRef` TODAVÍA VIEJOS (los refs se sincronizan en el render, no dentro del
  // mismo handler síncrono) y mandarían al autoguardado un wire a medio aplicar la combinación.
  // `resolverFuentePar`/`resolverForma` normalizan la clave CANÓNICA del preset ('editorial'/'suave')
  // a `null`, igual que hace `mergePresetEnContent` — "Editorial nunca se guarda" (§ fuentes.ts).
  const aplicarCombinacion = (preset: PresetTema) => {
    const nf: Form = { ...preset.raices };
    const fp = resolverFuentePar(preset.fuentePar);
    const fm = resolverForma(preset.forma);
    setForm(nf);
    setEsFabrica(false);
    setFuentePar(fp);
    setForma(fm);
    setHayBorrador(true);
    auto.marcarSucio(wireDe(nf, false, fp, fm));
  };

  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  // Publicar / Descartar el borrador del tema (POST /api/site-content/tema). Publicar deja lo editado
  // en vivo; descartar recarga el form a lo publicado (el preview también vuelve).
  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content/tema', {
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

  // Volver a FÁBRICA: publica las 3 raíces Y el par en NULL al instante (RESET DIRECTO, misma clase que
  // el toggle de página — config, no contenido en revisión). NULL, no los hexes/Editorial de Nayoli:
  // publicar los hexes los pasaría por el motor de derivación y dejaría una APROXIMACIÓN; el null → sin
  // <style> → los `--sf-*` exactos de globals.css y las fuentes del `@import` (§ byte-idéntico). CONFIRMA
  // porque borra el trabajo sin publicar Y resetea lo publicado sin vuelta atrás. (Cubre "me perdí" →
  // fábrica; NO "volver a mi tema custom anterior", que es historial y sigue descartado — § Backlog #55.)
  const resetFabrica = async () => {
    setConfirmandoFabrica(false);
    setErrorServidor(null); setProcesando(true);
    try {
      const put = await fetch('/api/site-content/tema', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paletaFondo: null, paletaTinta: null, paletaAcento: null, fuentePar: null, forma: null }),
      });
      if (!put.ok) { const d = await put.json().catch(() => null); setErrorServidor(d?.error ?? 'No se pudo aplicar el tema por defecto.'); return; }
      const post = await fetch('/api/site-content/tema', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'publicar' }),
      });
      if (!post.ok) { const d = await post.json().catch(() => null); setErrorServidor(d?.error ?? 'No se pudo aplicar el tema por defecto.'); return; }
      await cargar();
      toast.success('Volviste al tema por defecto.');
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="duna-card duna-card__pad" role="status">
        <span className="duna-sr-only">Cargando los colores de la tienda…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', aspectRatio: '3 / 4', borderRadius: 14 }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudieron cargar los colores.'}</p>
      </div>
    );
  }

  // Derivados (form ya no es null). El mapa COMPLETO lo da `derivarPaleta`; con un acento inválido
  // (a medio teclear) los derivados salen basura, así que lo dependiente del acento se muestra sólo
  // cuando es válido (el error inline cubre el ínterin).
  const baseActiva = BASES.find(b => b.fondo === form.fondo && b.tinta === form.tinta);
  const acentoInvalido = !HEX6.test(form.acento);
  // El origen REAL del tema (sólo lectura, § arriba) — se pasa a CADA preview de esta pieza para que
  // ninguna muestre un texto/acción que nace del acento cuando el tema publicado ya declaró que nace
  // de la tinta (CORTE). `undefined` en vez de `null`: es lo que `EjesPaleta`/`derivarPaleta` esperan
  // para "sin declarar" (§ palette-derive.ts).
  const ejes: EjesPaleta = { origenTexto: origenTexto ?? undefined, origenAccion: origenAccion ?? undefined };
  const derivada = derivarPaleta(form, ejes);
  const acentoTxt = derivada['acento-txt'];
  // Los 19 DERIVADOS (todo menos las 3 raíces editables), en el orden en que los produce el motor.
  const derivados = Object.keys(derivada).filter(k => k !== 'fondo' && k !== 'tinta' && k !== 'acento');
  const razon = (a: string, b: string) => contraste(a, b).toFixed(1); // "8.4" — la razón que contraste() calcula
  // Los AVISOS de contraste van PEGADOS al control que los causa (§ Fix 3), no en una pila bajo el
  // preview. Base → texto sobre fondo; Acento → texto del botón (auto-flip) y acento contra fondo.
  // § EDITOR-TIENDA-SHELL-1 — SIN AVISO DE CONTRASTE en el editor nuevo (decisión del owner,
  // 2026-10-02, § la aprobación de este slice: "Colores por rol… y SIN aviso de contraste"). Se
  // apaga en la FUENTE (`!enEditor &&`), no en cada sitio que lo consume (la pastilla de la pestaña
  // Y los tres `<Aviso>`): un solo interruptor no puede quedar la mitad prendida. El standalone
  // (`/admin/tienda`, `enEditor=false`) conserva el aviso tal cual.
  const avisoBaseTexto   = !enEditor && !acentoInvalido && contraste(form.tinta, form.fondo) < 4.5;
  const avisoBotonTexto  = !enEditor && !acentoInvalido && contraste(acentoTxt, form.acento) < 4.5;
  const avisoAcentoFondo = !enEditor && !acentoInvalido && contraste(form.acento, form.fondo) < 1.35;

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

  // El TEMA es de fábrica cuando los colores están en fábrica Y el par es Editorial (el default). El
  // botón de fábrica se ofrece cuando hay algo NO-fábrica que resetear (colores custom, par custom, o
  // un borrador). El par elegido (Editorial si es null) para la copy de lectura.
  const temaEsFabrica = esFabrica && fuentePar == null && forma == null;
  const puedeResetear = !temaEsFabrica || hayBorrador;
  const parActual = PARES_FUENTES.find(p => p.clave === (fuentePar ?? 'editorial'))!;
  const formaActual = FORMAS.find(f => f.clave === (forma ?? 'suave'))!;

  // CABECERA — EXTRAÍDA a una variable (§ EDITOR-TIENDA-TEMA-1) porque el EMBED (`enEditor`) la
  // envuelve distinto (fila `.tienda-tarjeta__meta`, sin `cabeceraRef`) que el standalone (`<div
  // ref={cabeceraRef}>`, § la medición del escenario). El contenido no cambió un carácter frente
  // a lo que vivía acá antes de este slice.
  const cabeceraContenido = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Colores y tipografía</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          {!editando && (
            <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
              El color y las fuentes — la piel de todo el storefront. Eliges el fondo, la tinta y el
              acento (el resto de la paleta se calcula sola) y un par tipográfico; publica cuando esté listo.
            </p>
          )}
          {editando && indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        {/* LECTURA: Editar. EDICIÓN: Usar el tema por defecto / Cerrar / Descartar / Publicar. El reset
            baja de la columna del form (que ya no existe en el escenario) a la cabecera. Publicar y
            Descartar esperan al autoguardado (`!puedePublicar`) porque MUTAN; "Cerrar" NO muta (el
            borrador queda), así que nunca se deshabilita. Publicar además se apaga con el acento inválido. */}
        {!editando ? (
          <button type="button" onClick={() => setEditando(true)} className="duna-btn duna-btn--secondary" style={{ flexShrink: 0 }}>
            <Pencil /> Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0, flexWrap: 'wrap' }}>
            {puedeResetear && (
              <button type="button" onClick={() => setConfirmandoFabrica(true)} disabled={procesando} className="duna-btn duna-btn--ghost">
                Usar el tema por defecto
              </button>
            )}
            <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Cerrar</button>
            {hayBorrador && (
              <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
                Descartar
              </button>
            )}
            {hayBorrador && (
              <button type="button" onClick={() => accionBorrador('publicar')} className="duna-btn duna-btn--primary" disabled={!puedePublicar || acentoInvalido}>
                {procesando ? 'Publicando…' : 'Publicar'}
              </button>
            )}
          </div>
        )}
      </div>
      {editando && errorServidor && (
        <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-2)', marginBottom: 0 }}>{errorServidor}</p>
      )}
    </>
  );

  // LA REGLETA — EXTRAÍDA a una variable (§ EDITOR-TIENDA-TEMA-1): el EMBED la monta SIN el pane
  // de preview (la página REAL en el iframe compartido ya hace ese trabajo, § el spec — repetirlo
  // con el fragmento sintético sería la duplicación que pide evitar), pero son EXACTAMENTE los
  // mismos controles, sin cambiar un carácter. `.tienda-regleta` no depende de vivir dentro de
  // `.tienda-escena` (es un flex-row self-contained, § `app/(admin)/duna.css`).
  const regleta = (
    <div className="tienda-regleta" data-grupo={grupoActivo}>
      <div className="tienda-regleta__tabs" role="tablist" aria-label="Eje a editar">
        {([
          { clave: 'base',   label: 'Base',                         aviso: avisoBaseTexto },
          { clave: 'acento', label: 'Acento',                       aviso: avisoBotonTexto || avisoAcentoFondo },
          // § EDITOR-TIENDA-SHELL-1 — "› Letras" es el nombre que pide REDISENO.md § 6 para el editor
          // nuevo; el standalone conserva "Tipografía" (mismo criterio que el aviso de arriba: un
          // solo sitio decide por `enEditor`, nunca dos copias del rótulo que puedan divergir).
          { clave: 'tipo',   label: enEditor ? 'Letras' : 'Tipografía', aviso: false },
          { clave: 'forma',  label: 'Forma',                        aviso: false },
        ] as const).map(t => {
          const on = grupoActivo === t.clave;
          return (
            <button
              key={t.clave} type="button" role="tab" aria-selected={on} onClick={() => setGrupoActivo(t.clave)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                padding: '5px 10px', borderRadius: 'var(--duna-r-full)', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
                border: on ? '1px solid var(--duna-border-2)' : '1px solid transparent',
                background: on ? 'var(--duna-surface)' : 'none',
                color: on ? 'var(--duna-ink)' : 'var(--duna-muted)',
                boxShadow: on ? 'var(--duna-shadow-1)' : 'none',
              }}
            >
              <span>{t.label}</span>
              {t.aviso && !on && <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--duna-sol)', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* PIEZA · BASE: muestras "Aa" (tinta sobre fondo). En el strip el contraste va en UNA línea
          (el de la base activa), no por-chip; el aviso se pega ACÁ. */}
      <div className="tienda-regleta__pieza tienda-regleta__pieza--base">
        <span className="duna-field__label">Base (fondo y texto)</span>
        {/* § EDITOR-TIENDA-SHELL-1 — "las tres raíces en palabras" (REDISENO.md § 6), sólo en el
            editor nuevo: el nombre del rol, no el mecanismo (la base curada + el picker de acento se
            quedan intactos — ver Combinaciones.tsx para por qué no se reemplazan por tres pickers
            libres). Fondo y Tinta comparten esta pieza porque la base elegida fija los dos juntos. */}
        {enEditor && (
          <p className="duna-caption" style={{ margin: '2px 0 0' }}>Fondo: el papel de tus páginas · Tinta: títulos y textos</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {BASES.map(b => {
            const activa = baseActiva?.label === b.label;
            return (
              <button
                key={b.label} type="button" onClick={() => elegirBase(b)} aria-pressed={activa}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 5px',
                  borderRadius: 'var(--duna-r-m)', cursor: 'pointer',
                  border: `1px solid ${activa ? 'var(--duna-ink)' : 'var(--duna-border)'}`,
                  background: activa ? 'var(--duna-surface)' : 'transparent',
                  boxShadow: activa ? 'var(--duna-shadow-1)' : 'none',
                }}
              >
                <span aria-hidden style={{
                  display: 'grid', placeItems: 'center', width: 30, height: 24, borderRadius: 8,
                  background: b.fondo, color: b.tinta, border: '1px solid var(--duna-border)',
                  fontWeight: 700, fontSize: 12, lineHeight: 1, flexShrink: 0,
                }}>Aa</span>
                <span className="duna-body" style={{ fontSize: 11, fontWeight: activa ? 600 : 500, whiteSpace: 'nowrap' }}>{b.label}</span>
              </button>
            );
          })}
        </div>
        <p className="duna-caption" style={{ margin: '6px 0 0' }}>Texto sobre fondo: {razon(form.tinta, form.fondo)}:1</p>
        {avisoBaseTexto && <Aviso>El texto principal puede costar de leer sobre este fondo. Prueba una base más contrastada.</Aviso>}
      </div>

      {/* PIEZA · ACENTO (picker libre): con el auto-flip del texto del botón DECLARADO. */}
      <div className="tienda-regleta__pieza tienda-regleta__pieza--acento">
        <label className="duna-field__label" htmlFor="pal-acento">Acento de marca</label>
        {enEditor && <p className="duna-caption" style={{ margin: '2px 0 0' }}>Botones y detalles de marca</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: '6px' }}>
          <input
            id="pal-acento" type="color"
            value={HEX6.test(form.acento) ? form.acento : '#8b4513'}
            onChange={e => cambiar({ acento: e.target.value })}
            style={{ width: 34, height: 30, padding: 0, border: '1px solid var(--duna-border)', borderRadius: 'var(--duna-r-m)', background: 'none', cursor: 'pointer' }}
            aria-label="Elegir color de acento"
          />
          <input
            className="duna-input" style={{ width: 110, fontFamily: 'var(--duna-font-mono)' }}
            value={form.acento} onChange={e => cambiar({ acento: e.target.value })}
            aria-invalid={acentoInvalido || undefined}
          />
        </div>
        {acentoInvalido ? (
          <p className="duna-field__error" style={{ marginTop: '4px', marginBottom: 0 }}>Usa un hex de 6 dígitos, p. ej. #8b4513.</p>
        ) : (
          // AUTO-FLIP DECLARADO: el texto del botón de acento es FIJO (blanco o tinta, el que más
          // contraste). Se dice cuál y con cuánto, en vez de dejarlo como un valor invisible.
          <p className="duna-caption" style={{ marginTop: '6px', marginBottom: 0 }}>
            Texto del botón: <b>{acentoTxt.toLowerCase() === '#ffffff' ? 'blanco' : 'oscuro'}</b> · contraste {razon(acentoTxt, form.acento)}:1
          </p>
        )}
        {avisoBotonTexto && <Aviso>El texto del botón puede costar de leer sobre este acento. Prueba un acento más oscuro o más claro.</Aviso>}
        {avisoAcentoFondo && <Aviso>El acento casi no se distingue del fondo: los botones y detalles pueden perderse.</Aviso>}
      </div>

      {/* PIEZA · TIPOGRAFÍA: "Ag" en la fuente DISPLAY del par + el nombre, del SET CERRADO (§ fuentes).
          En el strip la muestra es compacta (sin la descripción del cuerpo); el control es el mismo. */}
      <div className="tienda-regleta__pieza tienda-regleta__pieza--tipo">
        <span className="duna-field__label">{enEditor ? 'Letras' : 'Tipografía'}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {PARES_FUENTES.map(par => {
            const activo = (fuentePar ?? 'editorial') === par.clave;
            return (
              <button
                key={par.clave} type="button" aria-pressed={activo}
                onClick={() => cambiarFuente(par.clave === 'editorial' ? null : par.clave)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 56,
                  padding: '6px 4px', borderRadius: 'var(--duna-r-m)', cursor: 'pointer',
                  border: `1px solid ${activo ? 'var(--duna-ink)' : 'var(--duna-border)'}`,
                  background: activo ? 'var(--duna-surface)' : 'transparent',
                  boxShadow: activo ? 'var(--duna-shadow-1)' : 'none',
                }}
              >
                <span aria-hidden style={{
                  display: 'grid', placeItems: 'center', width: 34, height: 28, borderRadius: 8,
                  background: 'var(--duna-bg)', border: '1px solid var(--duna-border)',
                  fontFamily: par.titulo, fontSize: 18, lineHeight: 1, color: 'var(--duna-ink)',
                }}>Ag</span>
                <span style={{
                  fontFamily: par.titulo, fontSize: 11, fontWeight: 600, color: 'var(--duna-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                }}>{par.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PIEZA · FORMA: una tarjeta-muestra con las esquinas de la personalidad (`--radius-2xl`, el
          escalón representativo) + el nombre, del SET CERRADO (§ formas). Suave = null. Es el gemelo
          del picker de tipografía: la muestra dibuja lo que la forma HACE (el radio), no una letra. */}
      <div className="tienda-regleta__pieza tienda-regleta__pieza--forma">
        <span className="duna-field__label">Forma</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {FORMAS.map(f => {
            const activo = (forma ?? 'suave') === f.clave;
            return (
              <button
                key={f.clave} type="button" aria-pressed={activo} title={f.descripcion}
                onClick={() => cambiarForma(f.clave === 'suave' ? null : f.clave)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 56,
                  padding: '6px 4px', borderRadius: 'var(--duna-r-m)', cursor: 'pointer',
                  border: `1px solid ${activo ? 'var(--duna-ink)' : 'var(--duna-border)'}`,
                  background: activo ? 'var(--duna-surface)' : 'transparent',
                  boxShadow: activo ? 'var(--duna-shadow-1)' : 'none',
                }}
              >
                <span aria-hidden style={{
                  width: 30, height: 24, borderRadius: f.radius2xl,
                  background: 'var(--duna-bg)', border: '1.5px solid var(--duna-ink)',
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--duna-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* CABECERA — su alto (píldora, indicador de guardado, error del servidor) mueve el TOP del
          escenario, así que va OBSERVADA (`cabeceraRef`) para re-derivar el alto — SÓLO en el
          standalone: el EMBED no mide ningún escenario (§ el efecto `useLayoutSeguro`, gateado
          también a `!enEditor`). En EDICIÓN el subtítulo se oculta: su alto es el que el
          escenario necesita. */}
      {enEditor ? (
        editando ? (
          <div>{cabeceraContenido}</div>
        ) : (
          // LECTURA EMBEBIDA: la MISMA fila `.tienda-tarjeta` que ya usa cada `TiendaSeccionEditor`
          // (§ EDITOR-TIENDA-IFRAME-VISTA-1 — "sin miniatura propia", el iframe compartido YA es la
          // vista en vivo) — sin eso, "Tema" sería la única tarjeta de la lista con una forma distinta.
          <div className="tienda-tarjeta">
            <div className="tienda-tarjeta__meta">{cabeceraContenido}</div>
          </div>
        )
      ) : (
        <div ref={cabeceraRef}>{cabeceraContenido}</div>
      )}

      {editando ? (
        enEditor ? (
          // EDICIÓN EMBEBIDA: la página REAL ya está al lado, en el iframe compartido de
          // `VistaTiendaIframe` (§ el spec: "con la página real al lado reflejando el cambio al
          // instante"); repetir el fragmento sintético acá sería la duplicación que el spec pide
          // evitar (§ "/admin/tienda deja de duplicar la paleta si queda en el editor"). "Ampliar"
          // queda fuera a propósito: el iframe real ya resuelve lo que ese chip existía para suplir.
          //
          // § EDITOR-TIENDA-SHELL-1 agrega DOS piezas que antes no vivían acá, ambas pedidas por
          // REDISENO.md § 6: las COMBINACIONES arriba de la regleta (`aplicarCombinacion`, ver su
          // docstring para el alcance), y «Se calculan solos» EN SOLO LECTURA debajo — antes sólo
          // existía en el standalone, como capa sobre el `tienda-escena__pane` que el embed no tiene;
          // acá es un `<details>` simple con la MISMA grilla de derivados, reusando `verCalculado`.
          <div style={{ marginTop: 'var(--duna-space-4)', display: 'grid', gap: 'var(--duna-space-4)' }}>
            <Combinaciones onElegir={aplicarCombinacion} />
            {regleta}
            {!acentoInvalido && (
              <details open={verCalculado} onToggle={(e) => setVerCalculado(e.currentTarget.open)}>
                <summary className="duna-field__label" style={{ cursor: 'pointer' }}>Se calculan solos</summary>
                <p className="duna-caption" style={{ marginTop: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-2)' }}>
                  El resto de la paleta se deriva de tus tres colores. No se edita.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--duna-space-2)' }}>
                  {derivados.map(nombre => (
                    <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span aria-hidden style={{ width: 18, height: 18, borderRadius: 5, background: derivada[nombre], border: '1px solid var(--duna-border)', flexShrink: 0 }} />
                      <span className="duna-caption" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          // EDICIÓN STANDALONE (sin cambios frente a antes de este slice): EL ESCENARIO — el
          // preview a ANCHO COMPLETO con los controles como REGLETA acoplada a su borde inferior,
          // en el MISMO marco (§ el escenario). Esta pieza NO usa `.tienda-vivo--editando` (las
          // otras cuatro secciones sí). El alto lo fija `altoEscena` (DERIVADO del top medido).
          // "Ampliar" queda como chip, no como remedio.
          <div ref={escenaRef} className="tienda-escena" style={{ height: altoEscena, marginTop: 'var(--duna-space-4)' }}>
            <div className="tienda-escena__pane">
              {/* El fragmento REAL, scale-to-fit dentro del pane (EscalaDesktop COMPACTO, el mismo del
                  overlay de Ampliar). El pane toma el alto que el flexbox le deja bajo la regleta. */}
              <EscalaDesktop compacto style={{ width: '100%', height: '100%' }}>
                <FragmentoTienda raices={form} nombre={settings.nombre} fuentePar={fuentePar} forma={forma} ejes={ejes} />
              </EscalaDesktop>

              {/* Ampliar (chip arriba-der): abre el overlay con el mismo fragmento en grande. */}
              <button
                type="button" className="tienda-escena__chip" style={{ top: 8, right: 8, cursor: 'zoom-in' }}
                onClick={() => setAmpliado(true)} aria-label="Ampliar la vista previa de la tienda"
              >
                <Maximize2 size={13} /> Ampliar
              </button>

              {/* «Lo que se calcula solo» (chip abajo-izq) → CAPA sobre el pane (§ Fix: de <details> en la
                  columna a capa sobre el pane). Sólo con acento VÁLIDO: a medio teclear los derivados salen basura.
                  El chip SE OCULTA mientras la capa está abierta (§ el fix del gate): un disparador que sigue
                  flotando sobre lo que abrió TAPA sus propios derivados. Con la capa abierta el cierre vive en el
                  "Cerrar" de la capa (abajo), no en el chip — el mismo lugar que el mockup. */}
              {!acentoInvalido && !verCalculado && (
                <button
                  type="button" className="tienda-escena__chip" style={{ bottom: 8, left: 8 }}
                  onClick={() => setVerCalculado(true)} aria-expanded={false}
                >
                  Lo que se calcula solo
                </button>
              )}
              {!acentoInvalido && verCalculado && (
                <div className="tienda-escena__capa">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-3)', marginBottom: 'var(--duna-space-2)' }}>
                    <span className="duna-field__label">Lo que se calcula solo</span>
                    <button type="button" onClick={() => setVerCalculado(false)} className="duna-btn duna-btn--ghost duna-btn--sm">Cerrar</button>
                  </div>
                  <p className="duna-caption" style={{ marginTop: 0, marginBottom: 'var(--duna-space-2)' }}>
                    El resto de la paleta se deriva de tus tres colores. No se edita.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--duna-space-3)' }}>
                    {derivados.map(nombre => (
                      <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span aria-hidden style={{ width: 22, height: 22, borderRadius: 6, background: derivada[nombre], border: '1px solid var(--duna-border)', flexShrink: 0 }} />
                        <span style={{ minWidth: 0 }}>
                          <span className="duna-caption" style={{ display: 'block', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
                          <span style={{ display: 'block', fontFamily: 'var(--duna-font-mono)', fontSize: 11, color: 'var(--duna-muted)' }}>{derivada[nombre]}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* LA REGLETA: Base · Acento · Tipografía. ANCHO (≥1080): las tres a la vista. ANGOSTO
                (<1080): la columna de tabs + la pieza del `data-grupo` activo (todo por CSS; el estado
                sólo elige el eje). Las piezas se mueven ENTERAS: ni un control cambia de comportamiento. */}
            {regleta}
          </div>
        )
      ) : (
        enEditor ? null : (
          <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-5)', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px', maxWidth: 440 }}>
                <PreviewTiendaReal raices={form} nombre={settings.nombre} fuentePar={fuentePar} forma={forma} ejes={ejes} />
              </div>
              <p className="duna-sub" style={{ margin: 0, maxWidth: '24rem' }}>
                {temaEsFabrica
                  ? <>Estás usando la apariencia de fábrica. Edita para elegir la tuya.</>
                  : <>{esFabrica ? <>Colores de fábrica</> : <>Base <b>{baseActiva?.label ?? 'personalizada'}</b></>}, tipografía <b>{parActual.label}</b>, forma <b>{formaActual.label}</b>. Así se ve tu tienda.</>}
              </p>
            </div>
          </div>
        )
      )}

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a los colores publicados. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />

      <ConfirmDescartarDialog
        abierto={confirmandoFabrica}
        onDescartar={resetFabrica}
        onSeguir={() => setConfirmandoFabrica(false)}
        titulo="¿Volver al tema por defecto?"
        descripcion="La tienda vuelve a los colores de fábrica al instante. Se descarta cualquier cambio sin publicar y no se puede deshacer."
        confirmLabel="Usar el tema por defecto"
        seguirLabel="Conservar mis colores"
      />

      {/* Ampliar: el mismo fragmento en grande con las raíces + el par actuales → vivo por construcción.
          Sólo standalone — el EMBED no lo ofrece (§ arriba, misma razón que la escena). */}
      {!enEditor && (
        <AmpliarOverlay abierto={ampliado} onCerrar={() => setAmpliado(false)} raices={form} nombre={settings.nombre} fuentePar={fuentePar} forma={forma} ejes={ejes} />
      )}
    </>
  );
}
