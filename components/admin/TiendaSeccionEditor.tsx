'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import { Pencil, Upload, Plus, ImageIcon, X, Film } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import VistaTiendaEnVivo from '@/components/admin/VistaTiendaEnVivo';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import PosterScrubber from '@/components/admin/PosterScrubber';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { CategoriaCombobox } from '@/components/admin/CategoriaCombobox';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import type { SeccionConfig, CampoTexto, CampoImagen, CampoBooleano } from '@/components/admin/tienda-secciones';
import { gatePorCampo } from '@/components/admin/tienda-secciones';
import { bloquesResueltos, type BloqueResuelto } from '@/lib/tienda/bloques';
import { slotOpcional, slotVacio } from '@/lib/tienda/puente-tarjetas';
import { quitar as quitarDeLista, ultimoLleno } from '@/lib/tienda/lista-plana';
import { opcionesDestaque } from '@/lib/storefront/planes-suscripcion';
import { remuxMovAMp4 } from '@/lib/video-remux';
import { DEFAULTS, type SuscripcionPlanesContent } from '@/lib/config/site-content-defaults';
import {
  MAX_SUBIDA_DIRECTA_MB, ACCEPT_IMAGENES, TIPOS_PERMITIDOS, TIPOS_VIDEO, ACCEPT_VIDEO,
  MSG_VIDEO_NO_ADMITIDO, CONTENEDORES_REMUXEABLES, MAX_VIDEO_HERO_BYTES, MSG_VIDEO_HERO_LARGO,
} from '@/constants/upload';

// LA CÁSCARA del editor de una sección de la tienda, GENÉRICA. Todo lo que NO es específico de la
// sección vive acá —VISTA PREVIA EN VIVO + read↔edit + autoguardado + publicar/descartar + el
// indicador + beforeunload-en-error—; lo específico (campos, imágenes, toggle, identidad) llega por
// `config` (§ tienda-secciones). Segundo consumidor de este patrón: no se duplica la lógica de
// autoguardado ni la de publicación —un bug arreglado en un sitio y no en el otro sería el peor
// modo de falla—.
//
// La vista en vivo (componentes reales del storefront alimentados por el form) es la LECTURA;
// "Editar" abre el formulario junto a ella; "Listo" cierra. El form AUTOGUARDA mientras se edita
// (§ lib/autoguardado); la vista cambia en el mismo render. Sin gesto de guardar; Publicar y
// Descartar son las acciones del borrador.

type Datos = Record<string, unknown>; // strings/booleans planos + el array de items de un repeater

export default function TiendaSeccionEditor({ config, categorias = [], categoriasListas = false, resaltar = null, carga }: {
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
}) {
  const { seccion } = config;
  const defaults = DEFAULTS[seccion] as unknown as Record<string, string | boolean>;

  const [form, setForm]               = useState<Datos | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [editando, setEditando]       = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const formRef = useRef<Datos | null>(null); formRef.current = form;

  // ── EL PUENTE vista→formulario (§ Backlog #46) — SÓLO Presentaciones ──────────────────────────
  // Clic en una tarjeta de la VISTA salta a su BLOQUE-tarjeta del FORM. `tarjetaActiva` es el SLOT de
  // la última clicada; la vista la resalta (anillo) y el bloque del form la resalta ("puesto") + hace
  // scroll a él. El mapeo es POR SLOT (el marcador `data-sf-tarjeta` lo lleva); acá va lo del DOM.
  const puenteTarjetas = seccion === 'presentaciones';
  const [tarjetaActiva, setTarjetaActiva] = useState<number | null>(null);
  // Los BLOQUES-tarjeta del form, por SLOT — el destino del scroll. Callback ref que limpia al
  // desmontar (un nodo viejo tras remontaje es el defecto del observer, § EscalaDesktop).
  const bloquesRef = useRef<Map<number, HTMLElement>>(new Map());

  // CAPTURE en un ancestro de EscalaDesktop → corre ANTES que su neutralización de enlaces (que es un
  // DESCENDIENTE) y NO llama stopPropagation, así que ambos coexisten: yo leo el slot, EscalaDesktop
  // mata la navegación. Sólo actúo si el clic cae sobre una tarjeta (`data-sf-tarjeta`, que sólo existe
  // en preview); un clic al fondo/eyebrow no hace nada. El scroll va al bloque registrado por SLOT.
  const onClicTarjeta = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-sf-tarjeta]') as HTMLElement | null;
    if (!el) return;
    const slot = Number(el.dataset.sfTarjeta);
    if (!Number.isInteger(slot)) return;
    setTarjetaActiva(slot);
    const nodo = bloquesRef.current.get(slot);
    if (nodo) {
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      nodo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
  }, []);

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

  // El uploader compartido (§ useSubidaImagen): la cáscara lo instancia y lo comparte con el
  // RepeaterEditor por `subida.pedir`. Un solo <input>, un solo `subiendo`.
  const subida = useSubidaImagen({ onError: setErrorServidor });

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
    subida.elegir(f => {
      const esMov = (CONTENEDORES_REMUXEABLES as readonly string[]).includes(f.type);
      const limite = esMov ? MAX_VIDEO_HERO_BYTES * 1.5 : MAX_VIDEO_HERO_BYTES;
      if (f.size > limite) { setErrorServidor(MSG_VIDEO_HERO_LARGO); return; }
      setErrorServidor(null);
      setHeroVideoPendiente(f);
    }, { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };

  const subirVideoYPosterHero = async (video: File, poster: File) => {
    setSubiendoCampo('imagen');
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
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : 'No se pudo subir el video. Reintenta.');
    } finally {
      setHeroVideoPendiente(null);
      setHeroSubiendoPaso(null);
    }
  };

  const elegirPosterParaHero = () => {
    const v = heroVideoPendiente;
    if (!v) return;
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
    setSubiendoCampo(campo); // para pegarle la barra a este botón
    subida.pedir(url => {
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

  // Abrir/cerrar edición RESETEA el estado efímero del editor —tarjeta activa del puente y grupos
  // expandidos a mano—. El componente NO se desmonta al cerrar (es otra rama del mismo render, § la
  // pantalla), así que `useState(new Set())` no vuelve a correr; sin este reset, un grupo opcional
  // que abrí a mano seguiría abierto al reabrir. El colapso DERIVA de los datos (vacío → colapsado);
  // la expansión manual vive sólo mientras el editor está abierto (§ Fix 2).
  // `heroVideoPendiente`/`heroSubiendoPaso` se resetean igual que `expandidos`/`tarjetaActiva`: es
  // estado efímero de UI (el `File` elegido nunca se persistió), así que reabrir empieza limpio. Un
  // upload YA en vuelo (heroOcupado) sigue corriendo en segundo plano —fire-and-forget, como el
  // resto de las mutaciones de esta cáscara— y su `finally` limpia estos mismos estados al terminar.
  const abrirEdicion = () => { setEditando(true); setExpandidos(new Set()); setTarjetaActiva(null); setMostradosLista(new Map()); setHeroVideoPendiente(null); setHeroSubiendoPaso(null); };
  const cerrarEdicion = () => { auto.flush(); setEditando(false); setExpandidos(new Set()); setTarjetaActiva(null); setMostradosLista(new Map()); setHeroVideoPendiente(null); setHeroSubiendoPaso(null); };

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
      return;
    }
    // Edición abierta: sin slot (sección sin tarjetas) con abrir alcanza; con slot, scrollear al bloque.
    if (objetivoSlot == null) { deepLinkHecho.current = true; return; }
    const nodo = bloquesRef.current.get(objetivoSlot);
    if (!nodo) return; // el bloque aún no montó; el próximo render (deps: form/editando) lo tendrá
    deepLinkHecho.current = true;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    nodo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }, [esObjetivo, objetivoSlot, cargando, editando, form]);

  // ── LAZY-MOUNT de la vista previa de la tarjeta de LECTURA ──────────────────────────────────────
  // La preview compacta monta un componente REAL del storefront a 1280px + dos ResizeObserver
  // (§ VistaTiendaEnVivo / EscalaDesktop): es PESADA. Montar las N secciones de lectura a la vez pinta
  // la pantalla en cascada —el defecto que el deep-link EXPONE (el censo: cada sección es un mount
  // pesado, gateado sólo por su propio fetch)—. Se monta cuando la tarjeta ENTRA EN VISTA
  // (IntersectionObserver con margen para adelantarse al scroll): en carga montan 1-2 en vez de 5, y en
  // el deep-link la sección enlazada abre en EDICIÓN (monta igual) mientras las otras quedan como
  // placeholder barato → el objetivo es lo único pesado montándose y aterriza rápido. NO toca cómo
  // TiendaPaginas ordena las secciones: el aterrizaje temprano sale como efecto lateral.
  //
  // EL ALTO DEL PLACEHOLDER NO SALTA porque el thumb es una CAJA FIJA: `.tienda-tarjeta__thumb` fija su
  // alto con `aspect-ratio: 16/9` sobre un ancho `clamp(...)` —INDEPENDIENTE del hijo (así funciona el
  // scale-to-fit compacto)—, así que el placeholder reserva EXACTAMENTE la caja que la preview ocupará.
  // El alto NO varía por sección: es la misma caja para todas.
  //
  // Callback ref (no efecto `[]`): el observer se engancha/desengancha con el nodo y se DESCONECTA al
  // primer cruce (montada la preview, no hay que seguir observando) — el mismo patrón robusto que
  // EscalaDesktop. Sin `IntersectionObserver` (entorno sin DOM) monta directo, para no esconder nunca.
  const [previaVisible, setPreviaVisible] = useState(false);
  const ioPrevia = useRef<IntersectionObserver | null>(null);
  const thumbRef = useCallback((nodo: HTMLDivElement | null) => {
    ioPrevia.current?.disconnect(); ioPrevia.current = null;
    if (!nodo) return;
    if (typeof IntersectionObserver === 'undefined') { setPreviaVisible(true); return; }
    const io = new IntersectionObserver(entradas => {
      if (entradas.some(e => e.isIntersecting)) { setPreviaVisible(true); io.disconnect(); ioPrevia.current = null; }
    }, { rootMargin: '300px 0px' });
    io.observe(nodo); ioPrevia.current = io;
  }, []);

  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorServidor(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
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
              <span className="duna-field__hint" style={{ margin: 0 }}>
                {subiendoEste
                  ? (enVideoFlow ? heroTextoPaso() : `Subiendo póster… ${subida.progreso ?? 0}%`)
                  : esVideo ? 'MP4, WebM o MOV.' : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
              </span>
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
            </div>
            <span className="duna-field__hint" style={{ margin: 0 }}>
              {subiendoEste ? `Subiendo… ${subida.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
            </span>
            {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
          </div>
        </div>
      </div>
    );
  };

  // UNA CELDA del collage: una miniatura CLICABLE (clic = Cambiar) que ocupa su cuadro del 2×2; la
  // POSICIÓN la da el grid (rule 1: la posición se VE como en la tienda). Vacía → placeholder muted
  // (§ #66). "Por defecto" abajo si cambió.
  const renderCeldaCollage = (img: CampoImagen) => {
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
        {!esDefault && !subiendoEste && (
          <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo} style={{ alignSelf: 'flex-start' }}>
            Por defecto
          </button>
        )}
        {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
      </div>
    );
  };

  // Bloque COLLAGE (rule 1): las fotos en un 2×2 para que la posición se VEA como en la tienda.
  const renderBloqueCollage = (bloque: Extract<BloqueResuelto, { tipo: 'collage' }>) => (
    <div>
      {bloque.titulo && <span className="duna-field__label">{bloque.titulo}</span>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-2)', maxWidth: '280px' }}>
        {bloque.imagenes.map(renderCeldaCollage)}
      </div>
    </div>
  );

  // Bloque SECCIÓN: imágenes (miniatura, § rule 1) + campos. Sin encabezados de grupo (se retiraron).
  const renderBloqueSeccion = (bloque: Extract<BloqueResuelto, { tipo: 'seccion' }>) => (
    <>
      {bloque.imagenes.map(renderMiniatura)}
      {bloque.campos.length > 0 && (
        <div className="duna-form">{bloque.campos.map(renderCampo)}</div>
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

  // ── LECTURA: la sección es una TARJETA compacta (miniatura + título + estado + Editar). La vista
  //    grande (con sticky) sólo existe en edición; en lectura no hay scroller interno que atrape la
  //    página. Publicar/Descartar viven en la vista expandida.
  if (!editando) {
    return (
      <div className="tienda-tarjeta">
        <div ref={thumbRef} className="tienda-tarjeta__thumb" onClick={abrirEdicion}>
          {noSeMuestra ? (
            <div className="tienda-tarjeta__oculta">
              <span className="duna-caption" style={{ margin: 0 }}>No se muestra en la tienda</span>
            </div>
          ) : previaVisible ? (
            <VistaTiendaEnVivo seccion={seccion} valor={form} compacto />
          ) : (
            // La tarjeta esperando: el esqueleto del panel rellena la caja (alto reservado por el
            // `aspect-ratio` del thumb) hasta que entra en vista y la preview monta. Sin salto.
            <div className="duna-skel" aria-hidden style={{ width: '100%', height: '100%', borderRadius: 0 }} />
          )}
        </div>
        <div className="tienda-tarjeta__meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">{config.titulo}</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
            {oculta && <span className="duna-badge duna-badge--neutral">Oculta</span>}
          </div>
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

  // ── EDICIÓN: la vista grande (sticky) + el form. El hero conserva su comportamiento exacto.
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
            Así se ve en la tienda. Edita y los cambios se guardan solos; publica cuando estén listos.{' '}
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

      <div className="tienda-vivo tienda-vivo--editando" style={{ marginTop: 'var(--duna-space-4)' }}>
        {/* La VISTA — componentes reales alimentados por el form. Oculta: la sección se auto-oculta
            en el storefront (self-gate), así que la vista quedaría vacía; se muestra un aviso.
            `tienda-vivo__vista` es sticky: sólo existe en edición, así que al dar "Listo" se
            desmonta y no queda ningún elemento pinneado. */}
        <div className="tienda-vivo__vista">
          {noSeMuestra ? (
            <div className="duna-card duna-card__pad" style={{ display: 'grid', placeItems: 'center', minHeight: '160px', textAlign: 'center' }}>
              <div>
                <p className="duna-title" style={{ margin: 0 }}>No se muestra en la tienda</p>
                <p className="duna-sub" style={{ marginTop: '4px' }}>{avisoNoSeMuestra}</p>
              </div>
            </div>
          ) : puenteTarjetas ? (
            // El puente vive SÓLO en Presentaciones. La leyenda da la INSTRUCCIÓN ("clic para editar")
            // en tamaño legible —dentro de la vista escalada (0.3-0.6×) el texto sería ilegible—; el
            // hover sobre la tarjeta sólo confirma "esta responde" (§ duna.css .puente-tarjetas). El
            // wrapper es `display:contents` (cero efecto en layout/escala) y captura el clic.
            <>
              <p className="duna-caption" style={{ margin: '0 0 var(--duna-space-2)' }}>
                Haz clic en una tarjeta para editar sus campos.
              </p>
              <div className="puente-tarjetas" data-tarjeta-activa={tarjetaActiva ?? undefined} onClickCapture={onClicTarjeta}>
                <VistaTiendaEnVivo seccion={seccion} valor={form} />
              </div>
            </>
          ) : (
            <VistaTiendaEnVivo seccion={seccion} valor={form} />
          )}
        </div>

        {/* El FORM — junto a la vista (esta rama es siempre edición). El contenedor es un PANEL
            RECESADO (--duna-bg) que CONTIENE las piezas; cada bloque es una PIEZA elevada
            (--duna-surface) → los bloques se leen separados, no como un formulario plano (§ Fix 2). */}
        <div className="tienda-vivo__form">
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
                    onError={setErrorServidor}
                    subiendo={subiendo}
                    progreso={subida.progreso}
                    onChange={nuevos => cambiar({ [config.repeater!.itemsKey]: nuevos })}
                  />
                </div>
              )}

              {errorServidor && (
                <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorServidor}</p>
              )}
            </div>
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
