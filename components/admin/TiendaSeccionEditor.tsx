'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload, Plus, ImageIcon, X, Film, ArrowUp, ArrowDown, Check, ChevronsUpDown } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import PosterScrubber from '@/components/admin/PosterScrubber';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { CategoriaCombobox } from '@/components/admin/CategoriaCombobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import { esSesionVencida } from '@/lib/api/upload';
import { getProducts } from '@/lib/api/products';
import type { Product } from '@/types/product';
import { cn } from '@duna/core/utils';
import type { SeccionConfig, CampoTexto, CampoImagen, CampoBooleano, SeccionVista } from '@/components/admin/tienda-secciones';
import { gatePorCampo } from '@/components/admin/tienda-secciones';
import { bloquesResueltos, type BloqueResuelto } from '@/lib/tienda/bloques';
import { slotOpcional, slotVacio } from '@/lib/tienda/puente-tarjetas';
import { quitar as quitarDeLista, mover as moverEnLista, ultimoLleno } from '@/lib/tienda/lista-plana';
import { opcionesDestaque } from '@/lib/storefront/planes-suscripcion';
import { remuxMovAMp4 } from '@/lib/video-remux';
import { DEFAULTS, type SuscripcionPlanesContent } from '@/lib/config/site-content-defaults';
import {
  MAX_SUBIDA_DIRECTA_MB, ACCEPT_IMAGENES, TIPOS_PERMITIDOS, TIPOS_VIDEO, ACCEPT_VIDEO,
  MSG_VIDEO_NO_ADMITIDO, CONTENEDORES_REMUXEABLES, MAX_VIDEO_HERO_BYTES, MSG_VIDEO_HERO_LARGO,
} from '@/constants/upload';

// LA CÁSCARA del editor de una sección de la tienda, GENÉRICA. Todo lo que NO es específico de la
// sección vive acá —read↔edit + autoguardado + publicar/descartar + el indicador +
// beforeunload-en-error—; lo específico (campos, imágenes, toggle, identidad) llega por `config`
// (§ tienda-secciones). Segundo consumidor de este patrón: no se duplica la lógica de autoguardado
// ni la de publicación —un bug arreglado en un sitio y no en el otro sería el peor modo de falla—.
//
// LA VISTA EN VIVO YA NO ES LOCAL (§ EDITOR-TIENDA-IFRAME-VISTA-1): hasta este slice, cada sección
// montaba su propia `VistaTiendaEnVivo` —una SEGUNDA implementación del cálculo de colores/
// tipografía/forma que la página real ya resuelve, la causa de fondo de más de un bug (§ DISENO.md,
// § 1.3)—. Ahora `TiendaPaginas` monta UN solo `VistaTiendaIframe` que navega a la ruta REAL del
// storefront en modo borrador; esta cáscara es SÓLO form —"Editar" abre los campos, "Listo" cierra,
// el autoguardado dispara como siempre— y notifica al padre por los dos callbacks opcionales
// (`onAbrir`/`onCambioPublicado`) para que el iframe compartido se desplace o se recargue. `config`,
// `carga`, `categorias`/`categoriasListas` y `resaltar` no cambiaron de contrato.

type Datos = Record<string, unknown>; // strings/booleans planos + el array de items de un repeater

// ── EL CATÁLOGO REAL, PARA EL PICKER DE PRODUCTO (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) ─────
//
// MISMO patrón que `cargarEsquemaTemaReal` arriba, por la MISMA razón: `TiendaPaginas.tsx` (el
// padre) YA fetchea el catálogo completo —para derivar `categorias`, § `categoriasDelCatalogo`— pero
// queda FUERA de `touches:` de este slice (no se le puede agregar la prop que baje el catálogo
// entero a cada editor sin tocarlo), así que este editor hace su PROPIO fetch, compartido entre las
// N instancias montadas en la misma carga de página vía una promesa a nivel de módulo — nunca un
// fetch por instancia. Se usa SÓLO en la sección `spotlight` (el único picker de producto hoy); las
// demás secciones nunca llaman a `cargarCatalogoReal`.
//
// `getProducts()` (no `getCatalog()`): el picker necesita ver TODO el catálogo —incluidos
// inactivos/agotados, que el dueño puede querer destacar igual— y `getProducts` es el endpoint ADMIN
// (con sesión), el mismo que ya usa `TiendaPaginas.tsx` para derivar categorías.
let promesaCatalogoReal: Promise<Product[]> | null = null;
function cargarCatalogoReal() {
  if (!promesaCatalogoReal) {
    promesaCatalogoReal = getProducts().catch(() => []);
  }
  return promesaCatalogoReal;
}

// ── EL COMBOBOX DE PRODUCTO · elegir de la lista por nombre + foto, nunca un slug a mano ──────────
//
// MISMO ensamblaje que `CategoriaCombobox` (Popover + Command de cmdk, § su docstring: "no es una
// primitiva nueva, es lo que shadcn ya trae"), portaleado al MISMO puente (`useContenedorDunaPortal`)
// por la MISMA razón (aparece sobre el sheet del editor). La diferencia es la FORMA de la lista: acá
// cada fila lleva una MINIATURA además del nombre —"selector con nombre y foto", el gate del
// owner—, así que es un componente separado en vez de una opción más de `CategoriaCombobox` (las dos
// listas, productos-con-foto y categorías-de-texto, no comparten forma de fila).
//
// Vive en ESTE archivo (no en uno propio) porque `touches:` de este slice no declara un path nuevo
// para una primitiva — es LOCAL a `TiendaSeccionEditor.tsx`, su único consumidor hoy (el campo
// `producto: true` del picker de Spotlight). El día que un segundo consumidor lo necesite, se
// extrae, mismo criterio que ya aplicó `CategoriaCombobox` antes de existir como archivo propio.
function ProductoCombobox({ value, onChange, productos, productosListos, id, placeholder = 'Elige un producto', ariaDescribedby }: {
  value: string;
  onChange: (v: string) => void;
  /** El catálogo REAL (§ cargarCatalogoReal, arriba). Puede venir vacío mientras el fetch no resolvió. */
  productos: Product[];
  /** Si el catálogo YA cargó — el aviso de "ya no existe" no se muestra hasta saberlo (mismo
   *  criterio que `categoriasListas` de `CategoriaCombobox`: un fetch fallido no puede afirmar que
   *  un producto no existe). */
  productosListos: boolean;
  id?: string;
  placeholder?: string;
  ariaDescribedby?: string;
}) {
  const contenedor = useContenedorDunaPortal();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');

  const seleccionado = productos.find((p) => p.slug === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtrados = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;

  const elegir = (slug: string) => { onChange(slug); setQuery(''); setAbierto(false); };

  return (
    <Popover open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        {/* `duna-input` para medir y verse EXACTAMENTE como los campos de al lado (como
            `CategoriaCombobox`/`DateField`): es un campo, no un botón que abre algo. */}
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-describedby={ariaDescribedby}
          className="duna-input"
          style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {seleccionado ? (
              <>
                <span className="duna-tile" style={{ width: 24, height: 24, flexShrink: 0 }}>
                  {seleccionado.imagen
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={seleccionado.imagen} alt="" />
                    : <ImageIcon aria-hidden width={12} height={12} />}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seleccionado.nombre}</span>
              </>
            ) : (
              <span style={{ color: 'var(--duna-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value || placeholder}
              </span>
            )}
          </span>
          <ChevronsUpDown style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" container={contenedor} style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '16rem' }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar producto…" value={query} onValueChange={setQuery} />
          <CommandList>
            {!productosListos && <CommandEmpty>Cargando catálogo…</CommandEmpty>}
            {productosListos && filtrados.length === 0 && <CommandEmpty>Ningún producto coincide.</CommandEmpty>}
            {value && (
              <CommandGroup>
                <CommandItem value="__quitar__" onSelect={() => elegir('')}>
                  <X className="mr-2 h-4 w-4" /> Quitar
                </CommandItem>
              </CommandGroup>
            )}
            {filtrados.length > 0 && (
              <CommandGroup heading="Productos">
                {filtrados.map((p) => (
                  <CommandItem key={p.slug} value={p.slug} onSelect={() => elegir(p.slug)}>
                    <span className="duna-tile" style={{ width: 20, height: 20, marginRight: 8, flexShrink: 0 }}>
                      {p.imagen
                        ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imagen} alt="" />
                        : <ImageIcon aria-hidden width={10} height={10} />}
                    </span>
                    <Check className={cn('mr-2 h-4 w-4', value === p.slug ? 'opacity-100' : 'opacity-0')} />
                    {p.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function TiendaSeccionEditor({ config, categorias = [], categoriasListas = false, resaltar = null, carga, onAbrir, onCambioPublicado }: {
  config: SeccionConfig;
  /** Las categorías DERIVADAS del catálogo, para los campos-destino (§ el destino de Presentaciones es
   *  DATO). Sólo las usa la sección con un campo `categoria: true`; las demás las ignoran. */
  categorias?: string[];
  /** Si el catálogo ya cargó — el aviso "no existe" NO se muestra hasta saberlo (un fetch fallido no
   *  puede afirmar que una categoría no existe). */
  categoriasListas?: boolean;
  /** DEEP-LINK del aviso de config del Dashboard (§ Backlog #65): abrir la edición de ESTA sección y
   *  resaltar+scrollear el bloque del `slot` (reusa el puente vista→formulario). `null` = sin deep-link.
   *  `slot` null = abrir la sección sin resaltar un bloque (para secciones sin tarjetas, futuro). */
  resaltar?: { seccion: string; slot: number | null } | null;
  /** EL CONTENIDO lo carga TiendaPaginas UNA vez y baja la rebanada de esta sección (§ fetch 6→1): antes
   *  cada editor fetcheaba `/api/site-content` COMPLETO y usaba sólo su slice — N requests idénticos. El
   *  editor SIEMBRA su `form` local desde `valor` (una vez), y de ahí es dueño de su form. `recargar`
   *  re-lee el doc COMPLETO y devuelve lo fresco, para re-sembrar tras "Descartar" (el wrinkle del refetch). */
  carga: {
    valor?: Datos;          // valor draft-merged de esta sección; undefined = aún cargando
    sinPublicar: boolean;   // el flag `sinPublicar[seccion]` bajado por el padre
    listo: boolean;         // el padre terminó de cargar el doc
    error: boolean;         // el fetch del padre falló
    recargar: () => Promise<{ contenido?: Record<string, unknown>; sinPublicar?: Record<string, boolean> }>;
  };
  /** Se llama al abrir esta sección (manual o por deep-link) — el padre (`TiendaPaginas`) lo usa para
   *  desplazar+resaltar el iframe compartido hasta el marcador de esta sección (§ EDITOR-TIENDA-
   *  IFRAME-VISTA-1). Ausente = sin iframe que notificar (no debería ocurrir fuera de un test). */
  onAbrir?: (seccion: SeccionVista) => void;
  /** Se llama cuando el autoguardado ASIENTA (transición real 'guardando'→'guardado', nunca en el
   *  montaje) y tras Publicar/Descartar exitosos — el padre recarga el iframe compartido preservando
   *  el scroll. Un 'error' de autoguardado NO dispara esto: nada cambió para el visitante todavía. */
  onCambioPublicado?: () => void;
}) {
  const { seccion } = config;
  const defaults = DEFAULTS[seccion] as unknown as Record<string, string | boolean>;

  // El catálogo REAL (§ cargarCatalogoReal, arriba) — SÓLO para `spotlight`, el único picker de
  // producto hoy; las demás secciones nunca disparan este fetch. `productosListos` distingue
  // "cargando" de "catálogo vacío de verdad" (mismo criterio que `categoriasListas`, arriba).
  const [catalogoReal, setCatalogoReal] = useState<Product[]>([]);
  const [productosListos, setProductosListos] = useState(false);
  useEffect(() => {
    if (seccion !== 'spotlight') return;
    let vivo = true;
    cargarCatalogoReal().then((v) => { if (vivo) { setCatalogoReal(v); setProductosListos(true); } });
    return () => { vivo = false; };
  }, [seccion]);

  const [form, setForm]               = useState<Datos | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [editando, setEditando]       = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  // El CONTROL al que pertenece `errorServidor` —el nombre del campo-imagen (hero, brandStory…), o
  // `null` para un error SIN control propio en este editor (publicar/descartar, o un ítem del
  // repeater, que no tiene una ubicación direccionable acá). Sólo así el mensaje puede pintarse JUNTO
  // al control que lo disparó (§ PANEL-ERROR-SUBIDA-VISIBLE-1) sin heredar el campo de un error viejo
  // cuando el dueño toca un control distinto o pide publicar/descartar.
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Datos | null>(null); formRef.current = form;

  // ── EL RESALTE de tarjeta, SÓLO Presentaciones ────────────────────────────────────────────────
  // `tarjetaActiva` es el SLOT que el deep-link del aviso de config (§ más abajo) pide resaltar; el
  // bloque del form se marca "puesto" (`is-activo`) y recibe scroll. HASTA ESTE SLICE también lo
  // escribía un clic DENTRO de la vista previa local (el puente vista→formulario, § Backlog #46) —
  // ese disparador se fue CON la vista previa local (§ EDITOR-TIENDA-IFRAME-VISTA-1, arriba): no hay
  // más `VistaTiendaEnVivo`/`data-sf-tarjeta` que clickear acá. La dirección iframe→form (clic en la
  // tarjeta DENTRO del iframe compartido) es selección en contexto, `EDITOR-TIENDA-SELECCION-1` —
  // slice 4 del plan, fuera de `touches:` de éste.
  const puenteTarjetas = seccion === 'presentaciones';
  const [tarjetaActiva, setTarjetaActiva] = useState<number | null>(null);
  // Los BLOQUES-tarjeta del form, por SLOT — el destino del scroll. Callback ref que limpia al
  // desmontar (un nodo viejo tras remontaje es el defecto del observer, § EscalaDesktop).
  const bloquesRef = useRef<Map<number, HTMLElement>>(new Map());

  // ── LA PIEZA OPCIONAL (rule 3) — SÓLO Presentaciones ──────────────────────────────────────────
  // Una tarjeta opcional (slot 3-4) con TODOS sus campos en blanco NO aparece: se ofrece con "+
  // Agregar tarjeta". Al agregarla se EXPANDE (su bloque se monta) y no se vuelve a colapsar sola;
  // "Quitar" vacía sus campos y la devuelve a "+ Agregar". Los slots siguen siendo campos PLANOS
  // fijos (presentación del editor, no un repeater). INVARIANTE: una tarjeta VISIBLE nunca está vacía
  // (§ slotVacio) → su bloque siempre está montado y expandido, nunca detrás de "+ Agregar".
  // Cuántas filas mostrar en CADA lista plana (rule 2), POR LISTA (clave = su primer slot). Es un Map
  // porque una sección puede tener VARIAS listas —los beneficios POR PLAN de Suscripción (§ Backlog
  // #49): una lista por plan—, y "+ Agregar" en la de un plan no debe mover la de otro. Ausente para
  // una clave → deriva del último lleno; "+ Agregar" / "×" la mueven. Se resetea al abrir/cerrar.
  const [mostradosLista, setMostradosLista] = useState<Map<string, number>>(new Map());
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const colapsado = (slot: number): boolean =>
    puenteTarjetas && slotOpcional(config, slot)
    && slotVacio(form as Record<string, unknown>, slot) && !expandidos.has(slot);
  const expandir = (slot: number) => setExpandidos(prev => new Set(prev).add(slot));
  // "Quitar" (rule 3): vacía los campos de la tarjeta y la saca de los expandidos → vuelve a colapsar.
  const quitarTarjeta = (slot: number) => {
    cambiar({ [`label${slot}`]: '', [`copy${slot}`]: '', [`categoria${slot}`]: '', [`imagen${slot}`]: '' });
    setExpandidos(prev => { const n = new Set(prev); n.delete(slot); return n; });
  };

  // Muestra un error de SUBIDA: lo guarda, lo ata al CONTROL que lo disparó (si se conoce), y lo
  // anuncia con un toast (aviso flotante) — así se ve SIN hacer scroll, además de quedar junto al
  // control (§ PANEL-ERROR-SUBIDA-VISIBLE-1). El rechazo por sesión (§ esSesionVencida) suma un
  // enlace para volver a entrar — un "Reintenta" ahí no arregla nada, la sesión sigue vencida.
  const anunciarError = useCallback((msg: string, campo: string | null) => {
    setErrorServidor(msg);
    setErrorCampo(campo);
    toast.error(msg, esSesionVencida(msg)
      ? { action: { label: 'Iniciar sesión', onClick: () => { window.location.href = '/login'; } } }
      : undefined);
  }, []);

  // Qué campo-imagen FIJO ESTÁ EN VUELO (pidiendo el archivo o subiéndolo) — el uploader compartido es
  // UNA sola instancia para toda la cáscara (hero, brandStory, presentaciones…) y el repeater, así que
  // su `onError` no sabe por sí solo a qué control atribuir un fallo. Este ref lo dice: se fija al
  // EMPEZAR una acción propia de esta cáscara (`marcarCampoActivo`) y se CONSUME (vuelve a null) en
  // cuanto esa acción concluye —éxito o error—, para que un fallo del REPEATER (que llama a
  // `subida.pedir`/`.elegir` directo, sin pasar por acá) nunca herede el campo de una acción anterior
  // de la cáscara y quede pegado al control equivocado.
  const campoActivoRef = useRef<string | null>(null);
  const marcarCampoActivo = (campo: string) => {
    campoActivoRef.current = campo;
    setSubiendoCampo(campo);
    setErrorServidor(null); setErrorCampo(null); // una acción nueva no debe mostrar el error viejo pegado a OTRO control
  };

  // El uploader compartido (§ useSubidaImagen): la cáscara lo instancia y lo comparte con el
  // RepeaterEditor por `subida.pedir`. Un solo <input>, un solo `subiendo`. Su `onError` es lo único
  // que ve TODOS los fallos de validación de `pedir`/`elegir` (los del repeater incluidos, § arriba);
  // `null` (limpieza previa a una subida, § useSubidaImagen.alElegir) no consume el ref —el fallo real
  // de ESA MISMA acción puede llegar después y necesita seguir viendo el campo correcto—.
  const subida = useSubidaImagen({
    onError: (msg) => {
      if (msg === null) { setErrorServidor(null); setErrorCampo(null); return; }
      const campo = campoActivoRef.current;
      campoActivoRef.current = null;
      anunciarError(msg, campo);
    },
  });

  // Qué campo-imagen FIJO está subiendo (hero: `imagen`; brandStory: `imagen1..4`), para pegarle la
  // barra de progreso a ESE botón —no a todos—. Se limpia cuando la subida termina. (Las fotos del
  // repeater las rastrea el RepeaterEditor con su propio `subiendoDesde`.)
  const [subiendoCampo, setSubiendoCampo] = useState<string | null>(null);
  useEffect(() => { if (!subida.subiendo) setSubiendoCampo(null); }, [subida.subiendo]);

  // ── EL VIDEO DEL HERO (§ HERO-VIDEO-COMO-DATO-1) — SÓLO se usa cuando `seccion === 'hero'` ─────
  // La secuencia es la MISMA que `subirVideoYPoster` de RepeaterEditor —video elegido y RETENIDO
  // hasta elegir el póster (cancelar no deja un video huérfano), remux si es .mov, EL PÓSTER SUBE
  // PRIMERO (si el video grande falla después, el huérfano es una imagen chica, no un video de
  // varios MB)—, adaptada a un CAMPO PLANO: el hero no es una lista, así que no hay índice de ítem
  // ni RepeaterEditor que reusar. NO se extrae un hook compartido con RepeaterEditor en este slice
  // —serían dos formas (ítem de array vs campo plano) por una única sección nueva; queda anotado en
  // el reporte del slice como algo medido y no resuelto, no como un descuido—.
  const [heroVideoPendiente, setHeroVideoPendiente] = useState<File | null>(null);
  const [heroConvirtiendo, setHeroConvirtiendo] = useState(false);
  const [heroSubiendoPaso, setHeroSubiendoPaso] = useState<'convirtiendo' | 'póster' | 'vídeo' | null>(null);
  const heroOcupado = subida.subiendo || heroConvirtiendo;
  const heroTextoPaso = () => (heroSubiendoPaso === 'convirtiendo' ? 'Convirtiendo el video…' : `Subiendo ${heroSubiendoPaso}… ${subida.progreso ?? 0}%`);

  // El TOPE del video del hero es EL SUYO (§ MAX_VIDEO_HERO_BYTES, 8 MB — menos de la mitad que la
  // galería: el hero SIEMPRE está en el viewport, así que no hay forma de diferir la descarga si se
  // quiere que reproduzca). `subida.elegir`/`alElegirHold` (§ useSubidaImagen.ts, GENÉRICO y fuera
  // de `touches:` de este slice) validan tipo + CÓDEC + el tope de la GALERÍA (20 MB, hardcodeado
  // ahí) al elegir — no conocen al hero. Este chequeo cierra ENCIMA con el tope y el mensaje
  // CORRECTOS del hero: un archivo entre 8 y 20 MB lo rechaza ACÁ con el mensaje del hero; uno por
  // encima de 20 MB (o de 30 MB pre-remux para un .mov) ya lo rechazó `alElegirHold` ANTES de
  // llegar acá, con el mensaje GENÉRICO de la galería — un residuo de REDACCIÓN, documentado en
  // DECISIONS.md, no un hueco de TAMAÑO: en ningún caso sube al storage un video de hero por
  // encima de su propio tope.
  const agregarVideoHero = () => {
    marcarCampoActivo('imagen'); // desde ACÁ (el picker) ya es del hero: un rechazo de tipo/códec/tamaño debe verse junto a su control, no sólo al pie
    subida.elegir(f => {
      const esMov = (CONTENEDORES_REMUXEABLES as readonly string[]).includes(f.type);
      const limite = esMov ? MAX_VIDEO_HERO_BYTES * 1.5 : MAX_VIDEO_HERO_BYTES;
      if (f.size > limite) { anunciarError(MSG_VIDEO_HERO_LARGO, 'imagen'); return; }
      setHeroVideoPendiente(f);
    }, { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };

  const subirVideoYPosterHero = async (video: File, poster: File) => {
    marcarCampoActivo('imagen');
    try {
      let videoFinal = video;
      if ((CONTENEDORES_REMUXEABLES as readonly string[]).includes(video.type)) {
        setHeroSubiendoPaso('convirtiendo');
        setHeroConvirtiendo(true);
        try { videoFinal = await remuxMovAMp4(video); }
        finally { setHeroConvirtiendo(false); }
        // El tope EXACTO del hero sobre lo que se SUBE (post-remux): un .mov que pasó el
        // pre-chequeo (1.5×) pero cuya salida video-only sigue > 8 MB se rechaza acá.
        if (videoFinal.size > MAX_VIDEO_HERO_BYTES) throw new Error(MSG_VIDEO_HERO_LARGO);
      }
      setHeroSubiendoPaso('póster');
      const { url: posterUrl } = await subida.subir(poster, { kind: 'imagen' });
      setHeroSubiendoPaso('vídeo');
      const { url: videoUrl } = await subida.subir(videoFinal, { kind: 'imagen-o-video' });
      // LOS TRES A LA VEZ (§ el orden es la garantía): nunca un estado persistido con video sin
      // póster, ni con `imagenTipo` desincronizado de qué url hay en `imagen`.
      const nf = { ...(formRef.current as Datos), imagen: videoUrl, imagenPoster: posterUrl, imagenTipo: 'video' };
      setForm(nf); setHayBorrador(true);
      auto.marcarSucio(nf); auto.flush();
      campoActivoRef.current = null; // éxito: no queda pegado a un error de otro control
    } catch (err) {
      anunciarError(err instanceof Error ? err.message : 'No se pudo subir el video. Reintenta.', 'imagen');
    } finally {
      setHeroVideoPendiente(null);
      setHeroSubiendoPaso(null);
    }
  };

  const elegirPosterParaHero = () => {
    const v = heroVideoPendiente;
    if (!v) return;
    marcarCampoActivo('imagen');
    subida.elegir(poster => subirVideoYPosterHero(v, poster), { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };

  // Volver a IMAGEN: cae al valor por defecto de `imagen` —el mismo gesto que "Por defecto" ya
  // ofrece para las demás imágenes fijas—, porque `imagen` guarda hoy la URL del VIDEO y no sirve
  // como imagen. Nunca deja `imagenTipo:'video'` apuntando a una url que no es video, ni viceversa.
  const volverAImagenHero = () => {
    const nf = { ...(formRef.current as Datos), imagenTipo: 'imagen', imagen: defaults.imagen, imagenPoster: '' };
    setForm(nf); setHayBorrador(true);
    auto.marcarSucio(nf); auto.flush();
  };

  const guardarSeccion = useCallback(async (data: Datos) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [seccion]: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, [seccion]);
  const auto = useAutoguardado(guardarSeccion);

  // RECARGA EL IFRAME COMPARTIDO cuando el autoguardado ASIENTA (§ EDITOR-TIENDA-IFRAME-VISTA-1):
  // la transición REAL 'guardando'→'guardado', nunca el estado inicial (que YA es 'guardado' al
  // montar, § `useAutoguardado`) ni un 'error' (nada cambió para el visitante todavía). El ref evita
  // re-disparar en renders donde `auto.estado` no cambió.
  const estadoAnteriorRef = useRef(auto.estado);
  useEffect(() => {
    if (estadoAnteriorRef.current === 'guardando' && auto.estado === 'guardado') onCambioPublicado?.();
    estadoAnteriorRef.current = auto.estado;
  }, [auto.estado, onCambioPublicado]);

  // SIEMBRA del form desde el dato que bajó el padre (§ fetch 6→1). Una sola vez —guarda `form === null`—;
  // de ahí en más el editor es DUEÑO de su form (edita/autoguarda local), así que un re-render del padre
  // (p. ej. otro editor descartó y el doc se recargó) NO pisa los cambios de esta sección. `cargando`/
  // `errorCarga` DERIVAN del estado del padre — ya no hay fetch propio.
  useEffect(() => {
    if (form !== null || !carga.listo || carga.valor === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- siembra única del form desde el dato bajado por el padre (guarda `form === null`); no hay fetch que esperar
    setForm(carga.valor); setHayBorrador(carga.sinPublicar);
  }, [carga.listo, carga.valor, carga.sinPublicar, form]);
  const cargando = form === null && !carga.error;
  const errorCarga = carga.error ? 'No se pudo cargar el contenido.' : null;

  // beforeunload SÓLO en 'error' (§ decisión): pendiente/guardando es común y recuperable.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  // Un cambio de campo/toggle: pisa el form, marca borrador y ensucia el autoguardado — SIEMPRE,
  // incluso durante una subida. Una subida directa puede durar minutos y NO puede pausar la edición:
  // el texto se sigue guardando con la url VIEJA (o sin el ítem nuevo, que se crea al terminar), y la
  // url nueva llega en el flush post-subida. Nunca se guarda un ítem a medias (§ subirDirecto).
  const cambiar = (parcial: Datos) => {
    const nf = { ...(formRef.current as Datos), ...parcial };
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
  };

  const set = (name: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => cambiar({ [name]: e.target.value });

  // Pide una subida al uploader compartido y pisa el campo-imagen con la url resultante. El
  // marcar-sucio + flush van EXPLÍCITOS (no por `cambiar`), como en el uploader original: subir,
  // luego guardar. El callback corre con `subiendo` ya en false (§ useSubidaImagen), así que
  // marcarSucio no se descarta.
  const ponerImagen = (campo: string) => {
    marcarCampoActivo(campo); // para pegarle la barra Y un eventual error a este botón
    subida.pedir(url => {
      campoActivoRef.current = null; // éxito: no queda pegado a un error de otro control
      const nf = { ...(formRef.current as Datos), [campo]: url };
      setForm(nf); setHayBorrador(true);
      auto.marcarSucio(nf); auto.flush();
    });
  };

  const usarPorDefecto = (campo: string) => {
    const nf = { ...(formRef.current as Datos), [campo]: defaults[campo] };
    setForm(nf); setHayBorrador(true);
    auto.marcarSucio(nf); auto.flush();
  };

  // Vacía un campo-imagen OPCIONAL (§ CampoImagen.opcional, HISTORIA-COMO-MUESTRARIO-1) — DISTINTO de
  // `usarPorDefecto`: ésa pisa con `defaults[campo]` (para brandStory, un asset REAL de Nayoli, no una
  // cadena vacía — "Por defecto" y "Quitar" son dos destinos distintos). `''` es lo que
  // `REGISTRY.<seccion>.campos[campo] === 'opcional'` ya trata como AUSENTE al resolver (se OMITE,
  // nunca cae al default — § site-content-defaults.ts, "la frontera fina de defaults-como-fallback"):
  // este botón sólo agrega el CONTROL para escribir ese vacío, no cambia qué hace el resolver con él.
  const vaciarImagen = (campo: string) => {
    const nf = { ...(formRef.current as Datos), [campo]: '' };
    setForm(nf); setHayBorrador(true);
    auto.marcarSucio(nf); auto.flush();
  };

  // Abrir/cerrar edición RESETEA el estado efímero del editor —tarjeta activa del puente y grupos
  // expandidos a mano—. El componente NO se desmonta al cerrar (es otra rama del mismo render, § la
  // pantalla), así que `useState(new Set())` no vuelve a correr; sin este reset, un grupo opcional
  // que abrí a mano seguiría abierto al reabrir. El colapso DERIVA de los datos (vacío → colapsado);
  // la expansión manual vive sólo mientras el editor está abierto (§ Fix 2).
  // `heroVideoPendiente`/`heroSubiendoPaso` se resetean igual que `expandidos`/`tarjetaActiva`: es
  // estado efímero de UI (el `File` elegido nunca se persistió), así que reabrir empieza limpio. Un
  // upload YA en vuelo (heroOcupado) sigue corriendo en segundo plano —fire-and-forget, como el
  // resto de las mutaciones de esta cáscara— y su `finally` limpia estos mismos estados al terminar.
  // `campoActivoRef` se limpia en las dos puntas (abrir/cerrar): es un ref de vida CORTA —sólo vale
  // mientras la acción que lo fijó está en vuelo (§ marcarCampoActivo)— y un ciclo cerrar→reabrir no
  // debe dejarlo apuntando a un control de una sesión de edición anterior.
  // `onAbrir` (§ EDITOR-TIENDA-IFRAME-VISTA-1): abrir NO muta nada —ni autoguardado ni borrador—,
  // así que notificar al padre acá es seguro incluso si el iframe todavía no cargó.
  const abrirEdicion = () => { setEditando(true); setExpandidos(new Set()); setTarjetaActiva(null); setMostradosLista(new Map()); setHeroVideoPendiente(null); setHeroSubiendoPaso(null); campoActivoRef.current = null; onAbrir?.(seccion); };
  const cerrarEdicion = () => { auto.flush(); setEditando(false); setExpandidos(new Set()); setTarjetaActiva(null); setMostradosLista(new Map()); setHeroVideoPendiente(null); setHeroSubiendoPaso(null); campoActivoRef.current = null; };

  // ── DEEP-LINK del aviso de config del Dashboard (§ Backlog #65) ────────────────────────────────
  // El enlace del aviso aterriza EN EL DEFECTO: abre la edición de ESTA sección y resalta+scrollea el
  // bloque del slot, reusando la MISMA maquinaria del puente (`tarjetaActiva` → `is-activo`, `bloquesRef`
  // → scrollIntoView). Abrir edición NO muta (no autosave, no borrador, no "Sin publicar") → no pelea el
  // contrato de borrador. Una sola vez, tras cargar el contenido:
  //  1. edición cerrada → abrirla y marcar el slot (como abrirEdicion, pero SIN nullear tarjetaActiva);
  //  2. edición abierta → el bloque ya montó (una tarjeta con defecto está SIEMPRE visible, § el invariante),
  //     scrollear a él. Guardado por ref para no re-disparar al editar/cambiar de página.
  const esObjetivo = resaltar != null && resaltar.seccion === seccion;
  const objetivoSlot = esObjetivo && puenteTarjetas ? resaltar!.slot : null;
  const deepLinkHecho = useRef(false);
  useEffect(() => {
    if (!esObjetivo || cargando || deepLinkHecho.current) return;
    if (!editando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link: abrir edición desde el enlace del aviso (sin mutar); el bloque se monta en el próximo render y el re-run scrollea. `objetivoSlot` puede ser null (sección sin tarjetas) → sin resaltar, sólo abre.
      setEditando(true); setExpandidos(new Set()); setMostradosLista(new Map()); setTarjetaActiva(objetivoSlot);
      onAbrir?.(seccion); // el deep-link también desplaza el iframe compartido, como un "Editar" manual
      return;
    }
    // Edición abierta: sin slot (sección sin tarjetas) con abrir alcanza; con slot, scrollear al bloque.
    if (objetivoSlot == null) { deepLinkHecho.current = true; return; }
    const nodo = bloquesRef.current.get(objetivoSlot);
    if (!nodo) return; // el bloque aún no montó; el próximo render (deps: form/editando) lo tendrá
    deepLinkHecho.current = true;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    nodo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onAbrir`/`seccion` son estables por render (seccion es prop fija, onAbrir se memoiza en el padre); agregarlos no cambia el disparo, sólo evita un lint ruidoso.
  }, [esObjetivo, objetivoSlot, cargando, editando, form]);

  // EL LAZY-MOUNT de la tarjeta de lectura (IntersectionObserver sobre `VistaTiendaEnVivo` a 1280px)
  // SE RETIRÓ CON SU CAUSA (§ EDITOR-TIENDA-IFRAME-VISTA-1): la tarjeta de lectura ya no monta un
  // componente pesado del storefront por sección — sólo título + estado + "Editar". El iframe
  // compartido de `TiendaPaginas` es la única vista en vivo, montada una vez por página.

  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    // Publicar/descartar NO tienen un control-imagen propio: su error se queda SOLO al pie
    // (`errorCampo=null`) — nunca pegado a un campo de una subida anterior que ya no aplica.
    setErrorServidor(null); setErrorCampo(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorServidor(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
        setErrorCampo(null);
        return;
      }
      if (accion === 'publicar') {
        setHayBorrador(false);
        toast.success('Publicado — ya está en vivo.');
      } else {
        // Descartar re-lee lo PUBLICADO. Con el GET lifted, se pide el refetch COMPARTIDO al padre (que
        // devuelve el doc fresco) y se re-siembra el form de ESTA sección desde él → la vista en vivo
        // vuelve a lo publicado. Se re-siembra directo del retorno (no se espera el prop) y sólo esta
        // sección: el borrador de las otras no se toca (su `form !== null` bloquea la re-siembra por prop).
        const fresco = await carga.recargar();
        setForm((fresco.contenido?.[seccion] ?? {}) as Datos);
        setHayBorrador(false);
        toast.success('Cambios descartados — volviste a lo publicado.');
      }
      // Las DOS mutan lo que el visitante ve (publicar lo escribe; descartar lo revierte a lo
      // publicado) — el iframe compartido recarga en los dos casos (§ EDITOR-TIENDA-IFRAME-VISTA-1).
      onCambioPublicado?.();
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="duna-card duna-card__pad" role="status">
        <span className="duna-sr-only">Cargando el contenido de la tienda…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '640px', aspectRatio: '16 / 9', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar.'}</p>
      </div>
    );
  }

  const subiendo = subida.subiendo;
  // El mapa de atenuación (§ PANEL-EDITOR-HERO-TOGGLES-1, item 1 — el PATRÓN GENERAL, reusable por
  // todo editor): qué campo de texto está gateado por qué interruptor de esta sección. Puro y barato
  // (arrays chicos), se recalcula por render — no vale un useMemo para esto.
  const gates = gatePorCampo(config);
  const puedePublicar = auto.estado === 'guardado' && !procesando;
  const enError = auto.estado === 'error';
  // `oculta` = el TOGGLE apagado (para el badge "Oculta"). `repeaterVacio` = una lista sin ítems, que
  // también hace que la sección no se renderice (hide-on-empty). `noSeMuestra` cubre las dos para el
  // placeholder de la vista/tarjeta: sin él, un repeater vacío deja la vista en BLANCO, que se lee como
  // roto. El mensaje distingue el porqué (toggle vs lista vacía).
  const oculta = config.ocultable && form.visible === false;
  const items = config.repeater ? form[config.repeater.itemsKey] : undefined;
  const repeaterVacio = !!config.repeater && !(Array.isArray(items) && items.length > 0);
  const noSeMuestra = oculta || repeaterVacio;
  const avisoNoSeMuestra = oculta
    ? 'Actívala con el interruptor para verla aquí.'
    : 'La lista está vacía — agrega el primero para verla aquí.';
  // En EDICIÓN se muestra siempre (incluido "Guardado", que confirma que no hay nada pendiente); en
  // la TARJETA sólo cuando hay algo que decir (`estado !== 'guardado'` o una subida en curso).
  const mostrarEstado = editando || auto.estado !== 'guardado';
  const estadoTexto = auto.estado === 'guardando' ? 'Guardando…'
    : auto.estado === 'error' ? 'No se pudo guardar'
    : 'Guardado';

  // UNA sola definición del indicador, renderizada en las DOS ramas. Vivía sólo en el editor, y eso
  // dejaba INVISIBLE un guardado que fallara DESPUÉS de cerrar: el reintento seguía corriendo y el
  // beforeunload seguía guardando, pero el operador no veía nada (§ un guardado que falla sin
  // decirlo). Dos copias divergirían, así que se comparte, no se duplica.
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

  // ── BLOQUES (§ tienda-secciones · BloqueConfig): la sección se dibuja por BLOQUE. Un `seccion`
  //    (encabezado, o el derivado por defecto) apila imágenes + campos; una `tarjeta` es una PIEZA con
  //    su miniatura y sus campos, direccionada por SLOT (el destino del puente). Los encabezados de
  //    grupo se retiraron: la agrupación por tarjeta la da el bloque, no un `grupo` declarado dos veces.

  // UN CAMPO de texto/destino. El combobox de destino vive DONDE su campo esté declarado (dentro de la
  // tarjeta, con bloques). Sin encabezado de grupo.
  const renderCampo = (campo: CampoTexto) => {
    const id = `${seccion}-${campo.name}`;
    const value = String(form[campo.name] ?? '');
    // Aviso: el destino elegido ya no está en el catálogo (sólo si el catálogo YA cargó).
    const destinoInexistente = !!campo.categoria && categoriasListas && value.trim() !== '' && !categorias.includes(value);
    // Gemelo de `destinoInexistente`, para un PIN de producto (§ `campo.producto`, arriba): el slug
    // guardado ya no matchea ningún producto del catálogo real.
    const productoInexistente = !!campo.producto && productosListos && value.trim() !== '' && !catalogoReal.some((p) => p.slug === value);
    // Rótulo POR TÍTULO: «En grano» lleva a: usando el título en vivo de la misma tarjeta.
    const tituloTarjeta = campo.tituloDe ? String(form[campo.tituloDe] ?? '').trim() : '';
    const etiqueta = campo.tituloDe && tituloTarjeta ? `«${tituloTarjeta}» lleva a:` : campo.label;
    // Opciones del select: estáticas (`opciones`) o DERIVADAS del form (`opcionesDinamicas`, hoy los
    // planes que existen para el destaque, § opcionesDestaque). El form ES el contenido de la sección.
    const opciones = campo.opcionesDinamicas === 'destaquePlanes'
      ? opcionesDestaque(form as unknown as SuscripcionPlanesContent)
      : campo.opciones;
    // ATENUACIÓN (§ el patrón general, item 1): un campo gateado por un interruptor de sección
    // APAGADO no se esconde ni queda editable-sin-nota — se atenúa, con la nota de abajo. El dato
    // SIGUE editable (el input no se deshabilita): apagar el interruptor no debe impedir prepararlo
    // para cuando el dueño lo vuelva a encender, o para otro tema que sí lo muestre.
    const nombreGate = gates.get(campo.name);
    const atenuado = nombreGate !== undefined && form[nombreGate] === false;
    return (
      <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`} style={atenuado ? { opacity: 0.6 } : undefined}>
        <label className="duna-field__label" htmlFor={id}>{etiqueta}</label>
        {campo.categoria ? (
          <CategoriaCombobox id={id} value={value} categorias={categorias}
                             onChange={v => cambiar({ [campo.name]: v })} ariaDescribedby={`${id}-hint`} />
        ) : campo.producto ? (
          <ProductoCombobox id={id} value={value} productos={catalogoReal} productosListos={productosListos}
                             onChange={v => cambiar({ [campo.name]: v })} ariaDescribedby={`${id}-hint`} />
        ) : opciones ? (
          // SELECT NATIVO (§ Controles de formulario) — `destacadoSlot`, con opciones derivadas.
          <select id={id} className="duna-input duna-select" value={value} onChange={set(campo.name)} aria-describedby={`${id}-hint`}>
            {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : campo.textarea ? (
          <textarea id={id} className="duna-input" rows={2} value={value} onChange={set(campo.name)} placeholder={campo.placeholder} aria-describedby={`${id}-hint`} />
        ) : (
          <input id={id} className="duna-input" value={value} onChange={set(campo.name)} placeholder={campo.placeholder} aria-describedby={`${id}-hint`} />
        )}
        {atenuado && (
          <p className="duna-field__hint" role="status" style={{ marginBottom: 0 }}>Este tema no lo muestra.</p>
        )}
        {destinoInexistente && (
          <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)', marginBottom: 0 }}>
            Ningún producto tiene la categoría «{value}» todavía — la tarjeta no traerá resultados.
          </p>
        )}
        {productoInexistente && (
          <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)', marginBottom: 0 }}>
            Este producto ya no existe en el catálogo — elegí uno de la lista.
          </p>
        )}
        <p className="duna-field__hint" id={`${id}-hint`}>{campo.hint}</p>
      </div>
    );
  };

  // UN INTERRUPTOR de sección (§ CampoBooleano) — switch, mismo patrón visual que el toggle de
  // visibilidad de abajo (`config.ocultable`), pero gatea UNA capacidad en vez de la sección entera.
  // El valor inicial ya lo trae el form (sembrado del preset, o del default si el preset no lo tocó —
  // `resolverSiteContent` resuelve todo booleano declarado a un valor real): el preset pone el punto
  // de partida, el dueño lo overridea con el switch.
  const renderBooleano = (campo: CampoBooleano) => {
    const on = form[campo.name] !== false;
    return (
      <div key={campo.name}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={campo.label}
            onClick={() => cambiar({ [campo.name]: !on })}
            className={`duna-switch${on ? ' is-on' : ''}`}
          >
            <span className="duna-switch__thumb" />
          </button>
          <span className="duna-field__label" style={{ margin: 0 }}>{campo.label}</span>
        </div>
        {campo.hint && <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>{campo.hint}</p>}
      </div>
    );
  };

  // El error de subida JUNTO AL CONTROL que lo disparó (§ PANEL-ERROR-SUBIDA-VISIBLE-1): sólo se
  // pinta si `errorCampo` es ESTE campo —nunca un error de publicar/descartar ni uno del repeater
  // (§ accionBorrador/RepeaterEditor.onError, que dejan `errorCampo=null`)—. El rechazo por sesión
  // suma el enlace para volver a entrar, igual que el toast que ya disparó `anunciarError`.
  const errorInline = (campo: string) => {
    if (errorCampo !== campo || !errorServidor) return null;
    return (
      <p className="duna-field__error" role="alert" style={{ margin: 0 }}>
        {errorServidor}
        {esSesionVencida(errorServidor) && <> <a href="/login" className="duna-link">Iniciar sesión</a></>}
      </p>
    );
  };

  // LA MEDIA DE FONDO DEL HERO — imagen (por defecto) o VIDEO (§ HERO-VIDEO-COMO-DATO-1). Vive
  // APARTE de `renderMiniatura` (no como una rama más ahí adentro) porque el hero es la ÚNICA
  // sección con esta dualidad —el resto de `imagenes` del REGISTRY son SIEMPRE imagen— y porque no
  // se inventa lenguaje nuevo: reusa el vocabulario del video del repeater (miniatura=póster con
  // badge de película, "Cambiar vídeo"/"Cambiar póster", `PosterScrubber`, `BarraProgreso`).
  const renderMediaHero = (img: CampoImagen) => {
    const esVideo = form.imagenTipo === 'video';
    const url = String(form[img.name] ?? '');
    const poster = String(form.imagenPoster ?? '');
    const miniatura = esVideo ? poster : url;
    const esDefault = url === String(defaults[img.name] ?? '');
    // Dos vías comparten el mismo campo lógico ("imagen"): el alta/cambio de video COMPLETO
    // (subiendoCampo==='imagen', con `heroSubiendoPaso` nombrando la etapa) y el reemplazo SUELTO
    // del póster por `ponerImagen('imagenPoster')` (una subida atómica de imagen más, como
    // cualquier otro campo-imagen de la cáscara — sin etapas propias).
    const enVideoFlow = heroOcupado && subiendoCampo === 'imagen';
    const enPosterSuelto = subida.subiendo && subiendoCampo === 'imagenPoster';
    const subiendoEste = enVideoFlow || enPosterSuelto;
    return (
      <div key={img.name} className="duna-field" style={{ marginBottom: 'var(--duna-space-4)' }}>
        <span className="duna-field__label">{img.label}</span>
        {heroVideoPendiente && !heroOcupado ? (
          <PosterScrubber
            video={heroVideoPendiente}
            onPoster={(p) => subirVideoYPosterHero(heroVideoPendiente, p)}
            onSubirImagen={elegirPosterParaHero}
            onCancelar={() => setHeroVideoPendiente(null)}
          />
        ) : (
          <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
            <span className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)', position: 'relative' }}>
              {miniatura
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={miniatura} alt="" />
                : <ImageIcon aria-hidden width={20} height={20} />}
              {esVideo && (
                <Film className="h-3 w-3" style={{ position: 'absolute', right: 4, bottom: 4, color: '#fff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,.8))' }} aria-label="vídeo" />
              )}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                {esVideo ? (
                  <>
                    <button type="button" onClick={agregarVideoHero} disabled={heroOcupado || !!heroVideoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Film className="h-3.5 w-3.5" /> Cambiar video
                    </button>
                    <button type="button" onClick={() => ponerImagen('imagenPoster')} disabled={heroOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                      <Upload className="h-3.5 w-3.5" /> Cambiar póster
                    </button>
                    <button type="button" onClick={volverAImagenHero} disabled={heroOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                      Usar una imagen
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => ponerImagen(img.name)} disabled={heroOcupado} className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Upload className="h-3.5 w-3.5" /> Cambiar
                    </button>
                    {!esDefault && (
                      <button type="button" onClick={() => usarPorDefecto(img.name)} disabled={heroOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                        Por defecto
                      </button>
                    )}
                    <button type="button" onClick={agregarVideoHero} disabled={heroOcupado || !!heroVideoPendiente} className="duna-btn duna-btn--ghost duna-btn--sm">
                      <Film className="h-3.5 w-3.5" /> Usar un video
                    </button>
                  </>
                )}
              </div>
              {/* El slot cubre DOS campos —`imagen` (video/imagen completos) e `imagenPoster` (el
                  reemplazo suelto del póster, § arriba)—: cualquiera de los dos puede haber fallado. */}
              {errorInline('imagen') ?? errorInline('imagenPoster') ?? (
                <span className="duna-field__hint" style={{ margin: 0 }}>
                  {subiendoEste
                    ? (enVideoFlow ? heroTextoPaso() : `Subiendo póster… ${subida.progreso ?? 0}%`)
                    : esVideo ? 'MP4, WebM o MOV.' : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
                </span>
              )}
              {subiendoEste && heroSubiendoPaso !== 'convirtiendo' && <BarraProgreso pct={subida.progreso ?? 0} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  // MINIATURA (rule 1: la representación GRANDE es la vista previa; el form sólo identifica la foto y
  // ofrece "Cambiar"). Marco `.duna-tile` (DS): con foto la muestra recortada; VACÍO pinta un ícono
  // muted, NUNCA un `<img src="">` roto (§ Backlog #66).
  const renderMiniatura = (img: CampoImagen) => {
    // El hero es la ÚNICA sección con dualidad imagen/video (§ HERO-VIDEO-COMO-DATO-1): su campo
    // `imagen` se desvía a su propio render ANTES de la rama genérica de abajo, que sigue sirviendo
    // tal cual a brandStory/presentaciones (sólo imagen, siempre).
    if (seccion === 'hero' && img.name === 'imagen') return renderMediaHero(img);
    const val = String(form[img.name] ?? '');
    const esDefault = val === String(defaults[img.name] ?? '');
    const subiendoEste = subiendo && subiendoCampo === img.name;
    // "Quitar" (§ CampoImagen.opcional, HISTORIA-COMO-MUESTRARIO-1): sólo para una foto OPCIONAL que
    // TIENE valor — vaciar una ya vacía no hace nada, y una REQUERIDA no puede quedar sin foto.
    const puedeQuitar = !!img.opcional && val !== '';
    return (
      <div key={img.name} className="duna-field" style={{ marginBottom: 'var(--duna-space-4)' }}>
        <span className="duna-field__label">{img.label}</span>
        <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
          <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
            {val
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={val} alt="" />
              : <ImageIcon aria-hidden width={20} height={20} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
              <button type="button" onClick={() => ponerImagen(img.name)} className="duna-btn duna-btn--secondary duna-btn--sm" disabled={subiendo}>
                <Upload /> Cambiar
              </button>
              {!esDefault && (
                <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                  Por defecto
                </button>
              )}
              {puedeQuitar && (
                <button type="button" onClick={() => vaciarImagen(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                  Quitar
                </button>
              )}
            </div>
            {errorInline(img.name) ?? (
              <span className="duna-field__hint" style={{ margin: 0 }}>
                {subiendoEste ? `Subiendo… ${subida.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
              </span>
            )}
            {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
          </div>
        </div>
      </div>
    );
  };

  // UNA CELDA del collage: una miniatura CLICABLE (clic = Cambiar) que ocupa su cuadro del 2×2; la
  // POSICIÓN la da el grid (rule 1: la posición se VE como en la tienda). Vacía → placeholder muted
  // (§ #66). "Por defecto"/flechas/"Quitar" abajo, según corresponda.
  //
  // "Quitar" y las flechas operan sobre el ARRAY completo del bloque, no sobre `img.name` solo
  // (§ HISTORIA-FOTOS-PANEL-Y-GIRO-1, gate del owner: "no deja eliminar la primera foto, sólo las
  // otras 3, o re posicionar las mismas"). El gate de "Quitar" YA NO es `CampoImagen.opcional` —ese
  // campo sigue describiendo si el slot cae al DEFAULT o se OMITE al resolver (sin cambio, §
  // REGISTRY.brandStory.campos en site-content-defaults.ts)—: acá es el CONTEO de fotos con valor en
  // el bloque, recibido por prop desde `renderBloqueCollage`.
  const renderCeldaCollage = (
    img: CampoImagen, i: number, total: number, puedeQuitar: boolean,
    quitarFoto: (i: number) => void, moverFoto: (i: number, dir: -1 | 1) => void,
  ) => {
    const val = String(form[img.name] ?? '');
    const esDefault = val === String(defaults[img.name] ?? '');
    const subiendoEste = subiendo && subiendoCampo === img.name;
    return (
      <div key={img.name} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-1)', minWidth: 0 }}>
        <button type="button" onClick={() => ponerImagen(img.name)} className="duna-tile" style={{ width: '100%' }} disabled={subiendo} aria-label={`Cambiar ${img.label}`}>
          {val
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={val} alt="" />
            : <ImageIcon aria-hidden width={20} height={20} />}
        </button>
        {errorInline(img.name)}
        {!subiendoEste && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-1)' }}>
            {!esDefault && (
              <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo} style={{ alignSelf: 'flex-start' }}>
                Por defecto
              </button>
            )}
            <button type="button" onClick={() => moverFoto(i, -1)} disabled={subiendo || i === 0} aria-label="Subir" className="duna-btn duna-btn--ghost duna-btn--sm">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => moverFoto(i, 1)} disabled={subiendo || i === total - 1} aria-label="Bajar" className="duna-btn duna-btn--ghost duna-btn--sm">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            {puedeQuitar && (
              <button type="button" onClick={() => quitarFoto(i)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo} style={{ alignSelf: 'flex-start' }}>
                Quitar
              </button>
            )}
          </div>
        )}
        {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
      </div>
    );
  };

  // Bloque COLLAGE (rule 1): las fotos en un 2×2 para que la posición se VEA como en la tienda.
  // "Quitar" COMPACTA (las de abajo suben, § lib/tienda/lista-plana.ts) y sólo se ofrece si queda ≥1
  // foto con contenido tras quitar ésta — la ÚLTIMA que queda no se puede quitar (la sección necesita
  // al menos una). Reordenar hace SWAP con el vecino (mismo patrón que `RepeaterEditor.mover`). Las
  // dos operan sobre el ARRAY de valores del bloque y reescriben los CUATRO campos a la vez, así que
  // cualquier foto —incluida la primera— puede terminar en cualquier slot.
  const renderBloqueCollage = (bloque: Extract<BloqueResuelto, { tipo: 'collage' }>) => {
    const nombres = bloque.imagenes.map(im => im.name);
    const valores = nombres.map(n => String(form[n] ?? ''));
    const conContenido = valores.filter(v => v.trim() !== '').length;
    const escribir = (nuevos: string[]) => cambiar(Object.fromEntries(nombres.map((n, idx) => [n, nuevos[idx]])));
    const quitarFoto = (i: number) => escribir(quitarDeLista(valores, i));
    const moverFoto = (i: number, dir: -1 | 1) => escribir(moverEnLista(valores, i, dir));
    return (
      <div>
        {bloque.titulo && <span className="duna-field__label">{bloque.titulo}</span>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-2)', maxWidth: '280px' }}>
          {bloque.imagenes.map((img, i) => renderCeldaCollage(
            img, i, bloque.imagenes.length, valores[i].trim() !== '' && conContenido > 1, quitarFoto, moverFoto,
          ))}
        </div>
      </div>
    );
  };

  // LAS ETIQUETAS (notas de cata) de `spotlight` — SÓLO LECTURA (§ DESTACADO-PANEL-COMPLETO-Y-
  // BOTONES-PDP-1, el gate del owner: "faltan las etiquetas"). NO es un campo editable nuevo: el
  // dato YA se muestra en la tienda como chips (`Spotlight.tsx`, `activo.notasCata`) leído del
  // producto pineado — duplicarlo acá como texto propio del destacado sería la MISMA trampa que
  // `CLAUDE.md` ya nombra para `total_compras` (un dato que vive en dos lados puede divergir). Lo
  // que faltaba era que el PANEL dijera algo cuando no hay nada que mostrar: antes el bloque de
  // notas simplemente desaparecía de la vista previa sin explicación. CONVIENE escribirlas desde acá
  // tiene su propio costo —abriría una SEGUNDA puerta de escritura al mismo campo que "Productos" ya
  // edita, con las dos pantallas pudiendo divergir sobre cuál ganó— así que NO se construye sin medir
  // que el dueño lo pida; por ahora sólo LEE y, si faltan, enlaza a editarlas en su lugar de siempre.
  const renderEtiquetasSpotlight = () => {
    if (!productosListos) return null;
    const slugPin = String(form.productoSlug ?? '').trim();
    if (!slugPin) return null;
    const pin = catalogoReal.find((p) => p.slug === slugPin);
    if (!pin) return null; // sin match: ya lo dice el aviso del campo de arriba, no se duplica acá.
    const notas = pin.notasCata ?? [];
    return (
      <div className="duna-field duna-form__full">
        <span className="duna-field__label">Etiquetas (notas de cata)</span>
        {notas.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-1)' }}>
            {notas.map((n) => (
              <span key={n} className="duna-badge duna-badge--neutral">{n}</span>
            ))}
          </div>
        ) : (
          <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-1)' }}>
            «{pin.nombre}» no tiene notas de cata todavía. <a href="/admin/productos" className="duna-link">Editarlas en Productos.</a>
          </p>
        )}
      </div>
    );
  };

  // Bloque SECCIÓN: imágenes (miniatura, § rule 1) + campos. Sin encabezados de grupo (se retiraron).
  const renderBloqueSeccion = (bloque: Extract<BloqueResuelto, { tipo: 'seccion' }>) => (
    <>
      {bloque.imagenes.map(renderMiniatura)}
      {bloque.campos.length > 0 && (
        <div className="duna-form">
          {bloque.campos.map(renderCampo)}
          {seccion === 'spotlight' && renderEtiquetasSpotlight()}
        </div>
      )}
    </>
  );

  // Bloque TARJETA: una pieza (miniatura + campos), direccionada por slot. El encabezado (una CAJA
  // contenida — el "esto está puesto" del DS aplica limpio, § doctrina) es el destino del scroll del
  // puente + el resalte. Una pieza OPCIONAL vacía NO se monta (colapsado) → se ofrece con "+ Agregar
  // tarjeta" (abajo); "Quitar" la vacía y la devuelve a esa oferta.
  const renderBloqueTarjeta = (bloque: Extract<BloqueResuelto, { tipo: 'tarjeta' }>) => {
    if (colapsado(bloque.slot)) return null;
    return (
      <div
        ref={el => { const m = bloquesRef.current; if (el) m.set(bloque.slot, el); else m.delete(bloque.slot); }}
        className={`bloque-tarjeta${tarjetaActiva === bloque.slot ? ' is-activo' : ''}`}
      >
        <div className="bloque-tarjeta__head">
          <span className="duna-field__label">{bloque.titulo}</span>
          {bloque.opcional && (
            <button type="button" onClick={() => quitarTarjeta(bloque.slot)} className="duna-btn duna-btn--ghost duna-btn--sm">Quitar</button>
          )}
        </div>
        {bloque.imagen && renderMiniatura(bloque.imagen)}
        {bloque.campos.length > 0 && (
          <div className="duna-form">{bloque.campos.map(renderCampo)}</div>
        )}
      </div>
    );
  };

  // Bloque LISTA (rule 2): los beneficios como lista plana COMPACTA. Filas para los llenos + "+
  // Agregar" + "×". Se COMPACTA al quitar (§ lista-plana); editar en el sitio escribe el slot.
  const renderBloqueLista = (bloque: Extract<BloqueResuelto, { tipo: 'lista' }>) => {
    const { slots, itemLabel, hint } = bloque;
    const clave = slots[0];                                // identidad de ESTA lista (su primer slot)
    const valores = slots.map(s => String(form[s] ?? ''));
    const base = ultimoLleno(valores) + 1;                 // filas para llegar al último lleno
    const mostrados = Math.min(slots.length, Math.max(mostradosLista.get(clave) ?? base, base));
    const quitarFila = (i: number) => {
      const nv = quitarDeLista(valores, i);
      cambiar(Object.fromEntries(slots.map((s, idx) => [s, nv[idx]])));
      setMostradosLista(m => new Map(m).set(clave, Math.max(0, mostrados - 1)));
    };
    const singular = itemLabel;
    const label = singular.charAt(0).toUpperCase() + singular.slice(1);
    return (
      <div>
        <span className="duna-field__label">{label}s</span>
        {hint && <p className="duna-field__hint" style={{ marginTop: 0 }}>{hint}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)' }}>
          {Array.from({ length: mostrados }, (_, i) => (
            <div key={slots[i]} style={{ display: 'flex', gap: 'var(--duna-space-2)', alignItems: 'center' }}>
              <input
                className="duna-input"
                value={valores[i]}
                onChange={e => cambiar({ [slots[i]]: e.target.value })}
                aria-label={`${label} ${i + 1}`}
              />
              <button type="button" onClick={() => quitarFila(i)} className="duna-btn duna-btn--ghost duna-btn--icon" aria-label={`Quitar ${singular} ${i + 1}`}>
                <X />
              </button>
            </div>
          ))}
        </div>
        {mostrados < slots.length && (
          <div style={{ marginTop: 'var(--duna-space-2)' }}>
            <button type="button" onClick={() => setMostradosLista(m => new Map(m).set(clave, mostrados + 1))} className="duna-btn duna-btn--secondary duna-btn--sm">
              <Plus /> Agregar {singular}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Los bloques resueltos, y las tarjetas OPCIONALES aún colapsadas → la oferta "+ Agregar tarjeta".
  const bloques = bloquesResueltos(config);
  const tarjetasColapsadas = bloques.filter((b): b is Extract<BloqueResuelto, { tipo: 'tarjeta' }> => b.tipo === 'tarjeta' && colapsado(b.slot));
  const agregarTarjeta = () => { const primera = tarjetasColapsadas[0]; if (primera) expandir(primera.slot); };

  // ── LECTURA: la sección es una FILA compacta (título + estado + Editar), SIN miniatura propia
  //    (§ EDITOR-TIENDA-IFRAME-VISTA-1): la vista en vivo es el iframe compartido de `TiendaPaginas`,
  //    no una reconstrucción por sección. Publicar/Descartar viven en la vista expandida.
  if (!editando) {
    return (
      <div className="tienda-tarjeta">
        <div className="tienda-tarjeta__meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">{config.titulo}</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
            {oculta && <span className="duna-badge duna-badge--neutral">Oculta</span>}
          </div>
          {noSeMuestra && (
            <p className="duna-caption" style={{ margin: 0 }}>No se muestra en la tienda — {avisoNoSeMuestra}</p>
          )}
          {/* El estado va ENTRE el título y la acción: se lee qué es → cómo está → qué hacer. En el
              caso normal ('guardado') no renderiza nada y la tarjeta queda idéntica a antes. */}
          {indicadorEstado}
          <div>
            <button type="button" onClick={abrirEdicion} className="duna-btn duna-btn--secondary">
              <Pencil /> Editar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EDICIÓN: sólo el form — la vista en vivo es el iframe compartido de `TiendaPaginas`, no una
  //    columna local. El hero conserva su comportamiento exacto.
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">{config.titulo}</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
            {oculta && <span className="duna-badge duna-badge--neutral">Oculta</span>}
          </div>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            Edita y los cambios se guardan solos; publica cuando estén listos. Mira el resultado en
            la vista de la tienda.{' '}
            <a href="/" target="_blank" rel="noreferrer" className="duna-link">Ver la tienda</a>
          </p>
          {/* El indicador de GUARDADO (Guardando… / Guardado / error) va en la cabecera, SIN sticky: el
              guardado es rápido y el error es persistente (el operador sube a verlo). El PROGRESO de la
              subida NO vive acá —vive pegado al botón que la disparó (§ la barra por-botón)—. Un sticky
              acá cortaría la tarjeta: sobre una superficie necesitaría `--duna-surface` y aun así
              partiría la sección; el sticky del head de `.duna-lista` funciona porque sus filas van
              sobre el fondo de PÁGINA, no sobre una tarjeta — esa es la distinción. */}
          {indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        {/* ASIMETRÍA DELIBERADA: Publicar y Descartar esperan al autoguardado (`!puedePublicar`)
            porque MUTAN —publicar con algo pendiente publicaría un borrador viejo—. "Cerrar" NO muta:
            sólo vuelve a la tarjeta, el cambio queda en el borrador. Por eso NUNCA se deshabilita —en
            estado de error (que reintenta solo cada 5 s) apagarlo dejaría al operador sin salida— y no
            hace falta esperar el flush: cerrar no DESMONTA nada (es otra rama del mismo componente, el
            coordinador vive en su ref), y el PUT es fire-and-forget de todos modos. */}
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
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

      <div className="tienda-vivo__form" style={{ marginTop: 'var(--duna-space-4)' }}>
            {/* Oculta: la sección se auto-oculta en el storefront (self-gate) y el iframe compartido
                no muestra nada de ella — este aviso es lo único que lo dice acá. */}
            {noSeMuestra && (
              <div className="duna-card duna-card__pad" style={{ marginBottom: 'var(--duna-space-4)' }}>
                <p className="duna-title" style={{ margin: 0 }}>No se muestra en la tienda</p>
                <p className="duna-sub" style={{ marginTop: '4px' }}>{avisoNoSeMuestra}</p>
              </div>
            )}
            {/* El PANEL RECESADO (--duna-bg) que CONTIENE las piezas; cada bloque es una PIEZA elevada
                (--duna-surface) → los bloques se leen separados, no como un formulario plano (§ Fix 2). */}
            <div className="admin-bloques">
              <input ref={subida.inputRef} type="file" accept={ACCEPT_IMAGENES} onChange={subida.alElegir} hidden disabled={subiendo} />
              {/* Segundo input para el flujo "elegir sin subir" (alta de vídeo); su `accept` lo fija
                  `subida.elegir` por llamada (vídeo o imagen del póster). */}
              <input ref={subida.inputHoldRef} type="file" onChange={subida.alElegirHold} hidden />

              {config.ocultable && (
                <div className="admin-bloque">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.visible !== false}
                      aria-label="Mostrar esta sección en la tienda"
                      onClick={() => cambiar({ visible: form.visible === false })}
                      className={`duna-switch${form.visible !== false ? ' is-on' : ''}`}
                    >
                      <span className="duna-switch__thumb" />
                    </button>
                    <span className="duna-field__label" style={{ margin: 0 }}>Mostrar en la tienda</span>
                  </div>
                  {/* Sin hint: el operador apaga y ve el resultado en la vista en vivo. El label + el
                      switch bastan (mismo criterio que el toggle de página). */}
                </div>
              )}

              {/* Los INTERRUPTORES de sección (§ CampoBooleano, PANEL-EDITOR-HERO-TOGGLES-1) — una
                  pieza con todos los de esta sección, aparte del toggle de visibilidad de arriba. */}
              {config.booleanos && config.booleanos.length > 0 && (
                <div className="admin-bloque">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
                    {config.booleanos.map(renderBooleano)}
                  </div>
                </div>
              )}

              {/* Cada bloque es una PIEZA. La `tarjeta` YA es su propia caja (`.bloque-tarjeta`), así
                  que no se re-envuelve —doble caja—; los demás van en la pieza genérica. */}
              {bloques.map((b, i) => (
                <Fragment key={i}>
                  {b.tipo === 'tarjeta'
                    ? renderBloqueTarjeta(b)
                    : (
                      <div className="admin-bloque">
                        {b.tipo === 'lista' ? renderBloqueLista(b)
                          : b.tipo === 'collage' ? renderBloqueCollage(b)
                          : renderBloqueSeccion(b)}
                      </div>
                    )}
                </Fragment>
              ))}
              {/* La oferta de la pieza opcional (rule 3): agrega la PRIMERA tarjeta colapsada. Se
                  esconde cuando no queda ninguna (las 4 visibles). Sólo Presentaciones tiene tarjetas. */}
              {tarjetasColapsadas.length > 0 && (
                <div>
                  <button type="button" onClick={agregarTarjeta} className="duna-btn duna-btn--secondary">
                    <Plus /> Agregar tarjeta
                  </button>
                </div>
              )}

              {/* Sección de LISTA (repeater): cada cambio del RepeaterEditor —editar, agregar, quitar,
                  mover— pasa por `cambiar`, el mismo marcar-sucio + autoguardado que un campo plano. */}
              {/* El repeater NO se envuelve en una pieza: sus ítems ya son `.duna-card` (blancos), y
                  una pieza blanca alrededor los dejaría blanco-sobre-blanco. Va sobre el panel, sus
                  ítems son las piezas. */}
              {config.repeater && (
                <div>
                  <RepeaterEditor
                    items={Array.isArray(form[config.repeater.itemsKey]) ? (form[config.repeater.itemsKey] as Record<string, unknown>[]) : []}
                    descriptores={config.repeater.campos}
                    itemLabel={config.repeater.itemLabel}
                    genero={config.repeater.genero}
                    max={config.repeater.max}
                    maxVideo={config.repeater.maxVideo}
                    pedirImagen={subida.pedir}
                    elegir={subida.elegir}
                    subir={subida.subir}
                    // `campo=null` EXPLÍCITO: un ítem del repeater no tiene una ubicación propia en
                    // este editor (§ arriba) — nunca hereda el campo de una acción previa de la
                    // cáscara (hero/miniatura/collage). Degrada a "junto al pie" + el toast, no a
                    // un control equivocado.
                    onError={(msg) => anunciarError(msg, null)}
                    subiendo={subiendo}
                    progreso={subida.progreso}
                    onChange={nuevos => cambiar({ [config.repeater!.itemsKey]: nuevos })}
                  />
                </div>
              )}

              {/* Sólo los errores SIN control propio (publicar/descartar, § accionBorrador; un ítem
                  del repeater, § RepeaterEditor.onError arriba): los de un campo-imagen de la
                  cáscara ya se pintan JUNTO a su control (`errorInline`), y repetirlos acá sería
                  el mismo aviso dos veces. */}
              {errorServidor && !errorCampo && (
                <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>
                  {errorServidor}
                  {esSesionVencida(errorServidor) && <> <a href="/login" className="duna-link">Iniciar sesión</a></>}
                </p>
              )}
            </div>
      </div>

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a lo que está publicado. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />
    </>
  );
}
