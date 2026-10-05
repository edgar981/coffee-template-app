'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Plus, HelpCircle } from 'lucide-react';
import TiendaSeccionEditor, { type TiendaSeccionEditorHandle, type AsaOrdenProps } from '@/components/admin/TiendaSeccionEditor';
import VistaTiendaIframe, { type VistaTiendaIframeHandle } from '@/components/admin/VistaTiendaIframe';
import PaletaSeccion from '@/components/admin/PaletaSeccion';
import TogglePagina from '@/components/admin/TogglePagina';
import EncabezadoSeccion from '@/components/admin/EncabezadoSeccion';
import MenuSeccion from '@/components/admin/MenuSeccion';
import FooterSeccion from '@/components/admin/FooterSeccion';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey, type SeccionVista, type SeccionConfig } from '@/components/admin/tienda-secciones';
import { getProducts } from '@/lib/api/products';
import { categoriasDelCatalogo } from '@/lib/productos/categorias';
import { useSheetDesdeAbajo } from '@/hooks/useSheetDesdeAbajo';
import { DISPOSITIVO_DEFECTO, seccionDesdeMarcador, marcadorDeSeccion, type DispositivoKey } from '@/lib/admin/editor-iframe';
import {
  ANCHO_PANEL_DEFECTO, ANCHO_PANEL_MIN, ANCHO_PANEL_MAX, CLAVE_ANCHO_PANEL,
  anchoPanelMaximo, clampAnchoPanel, anchoPanelDesdeStorage, siguienteAnchoPorTeclado,
} from '@/lib/admin/ancho-panel';
import { Migas } from '@/components/admin/editor/Migas';
import { AyudaCentro } from '@/components/admin/editor/AyudaCentro';
import { temaDeNivel, type TemaAyudaId } from '@/lib/admin/ayuda-editor';
import { VistaNueva } from '@/components/admin/editor/VistaNueva';
import { BibliotecaSecciones } from '@/components/admin/editor/BibliotecaSecciones';
import { InstanciaTarjeta } from '@/components/admin/editor/InstanciaTarjeta';
import { InstanciaEditorForm } from '@/components/admin/editor/InstanciaEditorForm';
import { SeparadorAgregar } from '@/components/admin/editor/SeparadorAgregar';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { esMensajeCampoImagenClick } from '@/lib/storefront/editor-puente';
// `TIPO_MENSAJE_DESHACER`/`esMensajeDeshacer` NO vienen de `lib/storefront/editor-puente.ts`: viven
// en el COMPONENTE que las define (`EditorPuenteVivo.tsx`, § su docstring grande — desviación
// medida, ese módulo compartido no está en `touches:` de este slice).
import { esMensajeDeshacer } from '@/components/storefront/EditorPuenteVivo';
import { BANDA_IDS, type TemaContent } from '@/lib/config/site-content-defaults';
import { moverBandaConDestino, moverBandaEnDireccion, ordenarSeccionesConInstancias, type ItemOrdenMixto } from '@/lib/admin/orden-secciones';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { crearHistorialEditor, sonIguales, type HistorialEditor, type PasoHistorial } from '@/lib/admin/historial-editor';
import { resumenCambios, type CambioResumen } from '@/lib/admin/resumen-cambios';
import type { EstadoAutoguardado } from '@/lib/autoguardado';
// § EDITOR-AGREGAR-SECCION-1 — EL CATÁLOGO CURADO Y SU MECANISMO (§ lib/config/secciones-instancias.ts,
// construido por SECCIONES-INSTANCIAS-1; esta tanda le agrega la UI). `resolverOrdenCompleto`
// generaliza `resolverOrden` a bandas ∪ instancias — el `orden` que YA llega en `doc.contenido` está
// resuelto así server-side (§ `resolverSiteContent`), así que acá se corre de nuevo sólo como RED
// defensiva (el WRITE puede ser más estricto que el loader, mismo criterio de siempre), nunca como
// primera fuente de verdad.
import {
  resolverOrdenCompleto, nuevoIdInstancia, crearInstancia, esInstanciaId, nombreInstancia, TOPE_INSTANCIAS_HOME,
  type InstanciaContent, type SeccionInstanciaTipo,
} from '@/lib/config/secciones-instancias';
// `moverBandaAIndice` quedó SIN consumidor en este archivo (§ EDITOR-AGREGAR-SECCION-1): el asa de
// UNA fila mixta (banda o instancia) ahora mueve por `moverOrden`/`moverOrdenA`, que siguen usando
// `moverBandaEnDireccion`/`moverBandaConDestino` — `moverBandaAIndice` sigue viva (la usan las otras
// dos, y el test de `orden-secciones.ts` la ejercita directo), simplemente ningún llamador de ESTE
// archivo la invoca por su nombre.

// § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — las secciones que son DESTINO de algún `seccionCruzada`
// (§ `CampoTexto.seccionCruzada`, tienda-secciones.ts) — hoy sólo `marquesina` (sus campos `texto`/
// `productoSlug` se muestran en la tarjeta del hero). Derivado de `SECCIONES_TIENDA`, no una lista a
// mano: una sección cruzada nueva entra sola, sin tocar este archivo salvo por el cómputo de abajo.
const SECCIONES_CON_CAMPOS_CRUZADOS = new Set<SeccionVista>(
  SECCIONES_TIENDA.flatMap((c) => c.campos.filter((f) => f.seccionCruzada).map((f) => f.seccionCruzada!)),
);

// § EDITOR-TIENDA-CROMO-1 — el ENCABEZADO, el MENÚ y el PIE entran a «Secciones» como tres filas
// MÁS, store-wide (se ven igual en cualquier página del selector) — nunca como `SeccionVista`:
// ese tipo vive en `tienda-secciones.ts` (fuera de `touches:` de este slice) y es un union CERRADO
// sin un valor "global"/"toda página". Un tipo LOCAL, paralelo, con sus editores BESPOKE
// (`EncabezadoSeccion`/`MenuSeccion`/`FooterSeccion`, patrón `PaletaSeccion`) evita tocar ese
// archivo — exactamente la misma razón por la que esos tres editores YA eran bespoke en
// `/admin/tienda` (§ sus propios docstrings: "el pipeline genérico... exigiría tocar
// `VistaTiendaEnVivo.tsx`, fuera de `touches:`").
export type CromoKey = 'encabezado' | 'menu' | 'footer';
const CROMO_TITULOS: Record<CromoKey, string> = { encabezado: 'Encabezado', menu: 'Menú', footer: 'Pie' };
function esCromoKey(v: string): v is CromoKey {
  return v === 'encabezado' || v === 'menu' || v === 'footer';
}
// El handle COMÚN que los tres exponen — `escribirCampo` es OPCIONAL porque sólo `FooterSeccion`
// gana marcadores `CampoEditable` en esta tanda (§ su propio docstring).
interface CromoHandle {
  abrir: () => void;
  cerrar: () => void;
  marcarPublicado: () => void;
  restaurarDesdePublicado: (valor: Record<string, unknown>) => void;
  escribirCampo?: (campo: string, valor: string) => void;
}

export interface TiendaPaginasProps {
  /** La página activa — CONTROLADA desde `EditorTiendaPantallaCompleta` (§ EDITOR-TIENDA-
   *  DISPOSITIVOS-1): el selector de página subió a la barra superior del editor de pantalla
   *  completa, así que este componente ya no lo dibuja ni es dueño de su propio estado. */
  pagina: PaginaKey;
  /** El deep-link del aviso de config del Dashboard (§ Backlog #65), ya resuelto por el padre —
   *  antes este componente leía `useSearchParams` por su cuenta; ahora sólo recibe el resultado. */
  resaltar: { seccion: string; slot: number | null } | null;
  /** El ancho literal al que se arma el iframe (§ 4.3 de DISENO.md). Default Escritorio si se omite
   *  —`VistaTiendaIframe` también lo asume por su cuenta—, para que este componente siga siendo
   *  usable sin que el consumidor tenga que decidir un dispositivo. */
  dispositivo?: DispositivoKey;
  /** § EDITOR-TIENDA-TEMA-1 — qué monta la columna de la izquierda: la lista de secciones de
   *  `pagina` (`'paginas'`, el default), el editor de tema (`'tema'`, `PaletaSeccion` en modo
   *  `enEditor`), o el centro de ayuda (`'ayuda'`, § EDITOR-AYUDA-1, `AyudaCentro`). El `<iframe>`
   *  de la derecha NO cambia con esto — sigue mostrando `pagina`, igual que en modo `'tema'` (§ el
   *  comentario grande de `EditorTiendaPantallaCompleta.tsx`): la ayuda no tapa el contexto de lo
   *  que se está editando. */
  modo?: 'paginas' | 'tema' | 'ayuda';
  /** § EDITOR-AYUDA-1 — se llama cuando un «?» DENTRO de este componente (el de la miga de una
   *  sección, o el del nivel «Inicio»/«Estilo») pide abrir el centro de ayuda. Este componente ya
   *  decidió QUÉ guía mostrar (su propio estado, `ayudaAbierta`) — lo único que el padre necesita
   *  hacer es poner `modo: 'ayuda'`, porque `modo` es suyo, no de este componente (§ el docstring
   *  de `ModoEditor` en `EditorTiendaPantallaCompleta.tsx`). Ausente = sin padre al que avisar (no
   *  debería ocurrir fuera de un test). */
  onAbrirAyuda?: () => void;
  /** § EDITOR-AYUDA-RECORRIDO-1 — se llama cuando «Ver el recorrido» (dentro del centro de ayuda,
   *  `AyudaCentro.tsx`) pide iniciar el recorrido guiado. Igual que `onAbrirAyuda`: el recorrido es
   *  del PADRE (`EditorTiendaPantallaCompleta`, dueño del overlay y de normalizar `modo`/`pagina`
   *  al arrancar), no de este componente — este sólo reenvía el pedido. */
  onIniciarRecorrido?: () => void;
  /** § EDITOR-TIENDA-DESHACER-1 — el AGREGADO de toda la página abierta (+ el tema, store-wide):
   *  cuántos cambios sin publicar, en qué estado está el autoguardado, y si hay algo que deshacer/
   *  rehacer en este momento. El padre (`EditorTiendaPantallaCompleta`) lo usa para dibujar la
   *  barra de estado; llega por CALLBACK (no por ref) porque tiene que disparar un re-render del
   *  padre cada vez que cambia, cosa que un método de `ref` no puede hacer por sí solo. */
  onEstadoGlobal?: (estado: EstadoGlobalEditor) => void;
}

/** § EDITOR-TIENDA-DESHACER-1 — ver el docstring de `onEstadoGlobal`, arriba. */
export interface EstadoGlobalEditor {
  estado: EstadoAutoguardado;
  /** Secciones de la página activa con borrador + `'orden'` (home) + `'tema'` (store-wide) +
   *  `'encabezado'`/`'menu'`/`'footer'` (store-wide, § EDITOR-TIENDA-CROMO-1), todas juntas — el
   *  número que la píldora de la barra muestra. */
  pendientes: number;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
}

/** § EDITOR-TIENDA-DESHACER-1 — lo que `EditorTiendaPantallaCompleta` necesita PEDIRLE a este
 *  componente: los atajos de teclado y los botones de la barra no pueden mutar el historial ni
 *  publicar/descartar por sí mismos —viven acá, junto a `seccionRefs`/`ordenLocal`/`autoOrden`—,
 *  así que el padre los dispara por este handle imperativo. */
export interface TiendaPaginasHandle {
  deshacer: () => void;
  rehacer: () => void;
  /** Publica TODAS las secciones con borrador de la página activa + 'orden'/'tema' si corresponde,
   *  en un solo gesto atómico (`publicarVariasSecciones`, `app/api/site-content/route.ts`). Lanza
   *  si el POST falla — el llamador decide cómo avisarlo (toast). No-op si no hay nada pendiente. */
  publicarPendientes: () => Promise<void>;
  /** Gemelo de `publicarPendientes` para descartar — misma lista, mismo criterio de no-op. */
  descartarPendientes: () => Promise<void>;
  /** § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 — la lista EN PALABRAS de qué va a publicarse AHORA mismo:
   *  compara el borrador fresco (un refetch, para no mostrar un resumen rancio si el dueño editó
   *  desde que `doc` se cargó) contra lo publicado (`GET /api/site-content/publicado`), sección por
   *  sección, con `resumenCambios` (lib/admin/resumen-cambios.ts). Misma lista de claves que
   *  `publicarPendientes` va a publicar — el resumen describe EXACTAMENTE lo que el botón hace, ni
   *  más ni menos. `[]` si no hay nada pendiente (no-op, nunca un fetch de sobra). */
  resumenPendientes: () => Promise<CambioResumen[]>;
  /** § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 — navega el panel/lienzo al elemento de un ítem del
   *  resumen, al tocarlo en el popover. `'orden'` vuelve a Inicio (la barra de orden vive ahí, no
   *  dentro de una tarjeta); una `SeccionVista` abre su nivel y desplaza el lienzo, igual que un
   *  clic en la fila de la lista (`abrirNivelSeccion`). `'tema'` NO se resuelve acá — ese `modo` lo
   *  posee `EditorTiendaPantallaCompleta`, no este componente; el padre cambia de `modo` antes de
   *  llamar, y para 'tema' ni siquiera llama. § EDITOR-TIENDA-CROMO-1 — `'encabezado'`/`'menu'`/
   *  `'footer'` abren su nivel de cromo (`abrirNivelCromo`), gemelo de `abrirNivelSeccion`. */
  irAItem: (clave: string) => void;
}

// El editor del storefront agrupado por PÁGINA (Home / Nosotros), montado DENTRO del editor de
// pantalla completa (§ EDITOR-TIENDA-DISPOSITIVOS-1 — antes vivía directo en `/admin/tienda`). El
// selector de página y el de dispositivo ya no son responsabilidad de este componente: los dos
// llegan por prop desde `EditorTiendaPantallaCompleta`, que los pone en su barra superior.
const TiendaPaginas = forwardRef<TiendaPaginasHandle, TiendaPaginasProps>(function TiendaPaginas({ pagina, resaltar, dispositivo = DISPOSITIVO_DEFECTO, modo = 'paginas', onAbrirAyuda, onIniciarRecorrido, onEstadoGlobal }, ref) {
  const paginaMeta = PAGINAS.find(p => p.key === pagina)!;
  const secciones = SECCIONES_TIENDA.filter(c => c.pagina === pagina);

  // EL IFRAME COMPARTIDO (§ EDITOR-TIENDA-IFRAME-VISTA-1): UNA sola vista en vivo por página, no una
  // por sección — reemplaza las `VistaTiendaEnVivo` sueltas que cada `TiendaSeccionEditor` montaba.
  // Los editores no la ven: le hablan por el `ref` a través de dos callbacks (abrir una sección,
  // recargar tras un cambio publicado), así que agregar/quitar secciones no toca este componente.
  const iframeRef = useRef<VistaTiendaIframeHandle>(null);
  // `string`, no `SeccionVista` (§ EDITOR-AGREGAR-SECCION-1): sirve por igual a una banda y a un id
  // de instancia — `VistaTiendaIframeHandle.irASeccion` ya acepta `string` (ese archivo SÍ está en
  // `touches:` de este slice, a diferencia de cuando este wrapper se escribió).
  const irASeccion = useCallback((seccion: string) => iframeRef.current?.irASeccion(seccion), []);
  const recargarIframe = useCallback(() => iframeRef.current?.recargar(), []);

  // ── § EDITOR-TIENDA-SHELL-1 — EL PANEL CON NIVELES (Inicio → sección → elemento, REDISENO.md § 3).
  // «Elemento» es el nivel de las zonas del hero (`EDITOR-TIENDA-ZONAS-1`, slice 5, no construido
  // todavía): este slice entrega los DOS niveles de arriba, con la estructura lista para que el
  // tercero se agregue sin rehacer la navegación.
  //
  // `seccionActiva` es la sección a cuyo nivel bajó el panel, o `null` en Inicio. NO dispara un
  // (des)montaje de `TiendaSeccionEditor`: TODAS las secciones de la página siguen montadas siempre
  // (abajo, cada una se oculta con `display:none` cuando no es la activa) — desmontar perdería los
  // PASOS de historial que cada instancia ya empujó (sus closures cierran sobre el `setForm` de ESA
  // instancia; una remontada sería una instancia nueva, y "deshacer" sobre un paso viejo sería un
  // no-op silencioso). Es la misma razón por la que `seccionesEstado` (abajo) deja sueltas, a
  // propósito, las entradas de secciones de otra página.
  //
  // CADA TiendaSeccionEditor YA AVISA `onAbrir`/`onCerrar` en cualquier camino que abra/cierre su
  // edición (el botón "Editar"/"Cerrar" de la tarjeta, la selección desde el iframe, el campo
  // flotante) — este componente sólo escucha esos dos eventos para decidir el nivel; no hace falta
  // un tercer camino de navegación.
  const [seccionActiva, setSeccionActiva] = useState<SeccionVista | null>(null);
  // § EDITOR-TIENDA-CROMO-1 — el GEMELO de `seccionActiva` para el ENCABEZADO/MENÚ/PIE: un nivel
  // MÁS en el mismo panel, nunca los dos a la vez (abrir uno cierra al otro, § `abrirNivelCromo`/
  // `abrirNivelSeccion`). `nivelActivo` unifica los dos para las decisiones que no les importa
  // CUÁL de los dos tipos está activo —las migas, ocultar las demás filas de Inicio—.
  const [cromoActivo, setCromoActivo] = useState<CromoKey | null>(null);
  // § EDITOR-AGREGAR-SECCION-1 — el GEMELO de `seccionActiva`/`cromoActivo` para una SECCIÓN
  // AGREGADA: un TERCER tipo de nivel, nunca junto a los otros dos. A diferencia del cromo, una
  // instancia NO tiene un `TiendaSeccionEditor`/handle propio (§ `InstanciaEditorForm.tsx`, el
  // docstring de cabecera: "CONTROLADO, sin estado propio") — este componente YA es dueño de
  // `seccionesHomeLocal`, así que abrir/cerrar es sólo mover este estado, sin un ref que avisar.
  const [instanciaActiva, setInstanciaActiva] = useState<string | null>(null);
  const nivelActivo: string | null = seccionActiva ?? cromoActivo ?? instanciaActiva;

  // § EDITOR-VISUAL-NIVELES-AJUSTE-1 — el TERCER nivel (elemento del hero, § `elementoActivo` en
  // `TiendaSeccionEditor.tsx`) es LOCAL a esa instancia; este componente no lo conocía, así que la
  // miga «‹ Inicio» de abajo se dibujaba SIEMPRE que `nivelActivo` estuviera puesto, sin importar
  // que el hero ya estuviera mostrando SU PROPIA miga «‹ Hero» (dos migas a la vez — medido,
  // `.scratch/capturas-niveles-ajuste/1440x900-02-nivel-elemento-titular.png`: `migas` daba
  // `["Inicio","Hero"]`). `onElementoActivoChange` es el MISMO patrón que `onAbrir`/`onCerrar`
  // (arriba): la instancia avisa, este componente sólo escucha. Se pasa a TODAS las secciones (la
  // única que lo usa hoy es el hero, único con un nivel de elemento) para no bifurcar el mount por
  // `config.seccion === 'hero'`.
  const [hayElementoActivo, setHayElementoActivo] = useState(false);

  // § EDITOR-AYUDA-1 — QUÉ GUÍA muestra el centro de ayuda, dueño de ESTE componente (no de
  // `EditorTiendaPantallaCompleta`, que sólo es dueño de `modo`): así un «?» puede fijar la guía
  // sin depender de que `AyudaCentro` ya esté montado — si `modo` todavía es `'paginas'`/`'tema'`
  // en este mismo render, el estado de abajo ya queda listo para cuando `modo` pase a `'ayuda'`.
  const [ayudaAbierta, setAyudaAbierta] = useState<TemaAyudaId | null>(null);
  const abrirAyuda = useCallback((tema: TemaAyudaId) => {
    setAyudaAbierta(tema);
    onAbrirAyuda?.();
  }, [onAbrirAyuda]);
  // Al salir de la ayuda (el riel vuelve a «Secciones»/«Estilo»), la próxima vez que se entre
  // arranca en la lista de temas — no en la última guía que alguien miró hace rato.
  useEffect(() => { if (modo !== 'ayuda') setAyudaAbierta(null); }, [modo]);

  const cromoRefs = useRef<Map<CromoKey, CromoHandle>>(new Map());
  const abrirNivelSeccion = useCallback((seccion: SeccionVista) => {
    irASeccion(seccion);
    setCromoActivo(null);
    setInstanciaActiva(null);
    setSeccionActiva(seccion);
  }, [irASeccion]);
  const cerrarNivelSeccion = useCallback((seccion: SeccionVista) => {
    setSeccionActiva((actual) => (actual === seccion ? null : actual));
  }, []);
  // Gemelos de `abrirNivelSeccion`/`cerrarNivelSeccion`, para el cromo — sin `irASeccion`: el
  // Encabezado/Menú/Pie no tienen una `SeccionVista` que desplazar dentro del iframe (ya son
  // visibles en CUALQUIER página que esté mostrando el lienzo).
  const abrirNivelCromo = useCallback((key: CromoKey) => {
    setSeccionActiva(null);
    setInstanciaActiva(null);
    setCromoActivo(key);
  }, []);
  const cerrarNivelCromo = useCallback((key: CromoKey) => {
    setCromoActivo((actual) => (actual === key ? null : actual));
  }, []);
  // Gemelos otra vez, para una sección agregada — `irASeccion` SÍ aplica (una instancia tiene su
  // propio marcador `data-editor-seccion` en el iframe, § `app/(storefront)/page.tsx`, fuera de
  // `touches:`, no tocado por este slice).
  const abrirNivelInstancia = useCallback((id: string) => {
    irASeccion(id);
    setSeccionActiva(null);
    setCromoActivo(null);
    setInstanciaActiva(id);
  }, [irASeccion]);
  const cerrarNivelInstancia = useCallback((id: string) => {
    setInstanciaActiva((actual) => (actual === id ? null : actual));
  }, []);
  // El «‹ Inicio» de las migas: colapsa la edición de lo que esté activo (sección, cromo o
  // instancia) Y vuelve al nivel de arriba — las DOS salidas (el botón interno, éstas migas) deben
  // terminar en el mismo sitio, nunca una tarjeta a medio abrir detrás de la lista.
  const volverAInicio = useCallback(() => {
    if (seccionActiva) seccionRefs.current.get(seccionActiva)?.cerrar();
    if (cromoActivo) cromoRefs.current.get(cromoActivo)?.cerrar();
    setSeccionActiva(null);
    setCromoActivo(null);
    setInstanciaActiva(null);
  }, [seccionActiva, cromoActivo]);
  // § EDITOR-TIENDA-POSTMESSAGE-1 — el cambio EN VIVO de cada editor llega acá y se reenvía al
  // iframe compartido por `postMessage`, sin recargar (reemplaza el reload-tras-autoguardado de
  // `onCambioPublicado`, que ahora sólo corre tras Publicar/Descartar).
  const enviarCambioIframe = useCallback(
    (seccion: SeccionVista, datos: Record<string, unknown>) => iframeRef.current?.enviarCambio(seccion, datos),
    [],
  );
  // § EDITOR-TIENDA-CROMO-1 — EL ENVÍO EN VIVO del cromo al iframe compartido, MISMO cruce que
  // 'orden'/'tema' (§ `enviarOrdenIframe`/`enviarTemaIframe`, abajo): `VistaTiendaIframe.tsx` sigue
  // fuera de `touches:`, su `enviarCambio` ya es genérico en runtime, y ninguna de las claves del
  // cromo (`encabezado`, `logo`, `menu`, `footer`) es una `SeccionVista` real. `logo`/`menu`/
  // `footer` SÍ son secciones del REGISTRY, así que el lado del iframe (`fusionarContenidoSeccion`)
  // las fusiona sin código nuevo; `encabezado` es la clave META combinada que `EditorPuenteVivo.tsx`
  // reconoce ANTES de esa fusión (§ `datosDeEncabezado`, `lib/storefront/editor-puente.ts`).
  const enviarCromoIframe = useCallback((seccion: string, datos: Record<string, unknown>) => {
    const enviar = iframeRef.current?.enviarCambio as
      | ((seccion: string, datos: Record<string, unknown>) => void)
      | undefined;
    enviar?.(seccion, datos);
  }, []);

  // § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — EL VALOR EN VIVO de las secciones que son destino de un
  // campo cruzado (hoy, `marquesina`): capturado del MISMO `onCambio` que cada `TiendaSeccionEditor`
  // ya reporta en cada cambio real de su `form` (§ el docstring de esa prop, TiendaSeccionEditor.tsx)
  // — no un fetch nuevo, no un segundo canal. Antes del primer cambio (o si la sección cruzada aún no
  // montó/sembró), el valor cae al `doc.contenido` ya cargado — el mismo piso que usa cada sección
  // para sembrar su propio `form`. `manejarCambioSeccion` reemplaza a `enviarCambioIframe` como
  // `onCambio` de CADA `TiendaSeccionEditor` (sigue reenviando al iframe, además de capturar acá).
  const [valoresCruzadosEnVivo, setValoresCruzadosEnVivo] = useState<Partial<Record<SeccionVista, Record<string, unknown>>>>({});
  const manejarCambioSeccion = useCallback((seccion: SeccionVista, datos: Record<string, unknown>) => {
    enviarCambioIframe(seccion, datos);
    if (!SECCIONES_CON_CAMPOS_CRUZADOS.has(seccion)) return;
    setValoresCruzadosEnVivo((prev) => (prev[seccion] === datos ? prev : { ...prev, [seccion]: datos }));
  }, [enviarCambioIframe]);
  // Escribe UN campo de OTRA sección (§ `TiendaSeccionEditorHandle.escribirCampoSinAbrir`): el ÚNICO
  // camino de datos para un grupo cruzado del panel (el hero escribiendo `marquesina.texto`) — nunca
  // toca el `form` de quien lo muestra, siempre el de la sección REAL, así que sigue habiendo un solo
  // escritor/autoguardado por sección sin importar desde qué tarjeta se edite.
  const escribirCruzado = useCallback((seccionDestino: SeccionVista, campo: string, valor: string) => {
    seccionRefs.current.get(seccionDestino)?.escribirCampoSinAbrir(campo, valor);
  }, []);

  // LA SELECCIÓN EN CONTEXTO, dirección iframe→lista (§ EDITOR-TIENDA-SELECCION-1): un `Map` de
  // handles, UNO por sección montada —callback ref que se registra/retira con cada
  // `TiendaSeccionEditor`, nunca una lista de `RefObject` creada por adelantado (las secciones de
  // la página activa cambian con `pagina`, § `secciones` abajo)—. Cuando llega el `postMessage` de
  // un clic DENTRO del iframe, `VistaTiendaIframe` entrega el MARCADOR crudo; acá se resuelve a una
  // `SeccionVista` (`seccionDesdeMarcador`, la inversa PARCIAL de `marcadorDeSeccion`) y se valida
  // contra `secciones` —la lista de la PÁGINA ACTIVA— antes de llamar: un marcador que no resuelve a
  // nada conocido (chrome global sin sección, o una sección de otra página) simplemente se ignora,
  // nunca lanza.
  const seccionRefs = useRef<Map<SeccionVista, TiendaSeccionEditorHandle>>(new Map());
  // Un callback ref ESTABLE por sección (cacheado en `callbacksRefSeccion`, NUNCA `(seccion) => (h)
  // => {...}` invocado inline en el `.map` de abajo): React compara por IDENTIDAD de función, así
  // que una fábrica llamada en cada render devolvería una función NUEVA cada vez y React volvería a
  // disparar `null`→`handle` en TODOS los renders de `TiendaPaginas`, no sólo al montar/desmontar.
  const callbacksRefSeccion = useRef<Map<SeccionVista, (handle: TiendaSeccionEditorHandle | null) => void>>(new Map());
  const registrarRefSeccion = useCallback((seccion: SeccionVista) => {
    const existente = callbacksRefSeccion.current.get(seccion);
    if (existente) return existente;
    const nuevo = (handle: TiendaSeccionEditorHandle | null) => {
      if (handle) seccionRefs.current.set(seccion, handle);
      else seccionRefs.current.delete(seccion);
    };
    callbacksRefSeccion.current.set(seccion, nuevo);
    return nuevo;
  }, []);
  // Gemelo de `registrarRefSeccion`, para el cromo — mismo motivo (un callback ref ESTABLE por
  // clave, para que React no lo reinvoque `null`→`handle` en cada render de este componente).
  const callbacksRefCromo = useRef<Map<CromoKey, (handle: CromoHandle | null) => void>>(new Map());
  const registrarRefCromo = useCallback((key: CromoKey) => {
    const existente = callbacksRefCromo.current.get(key);
    if (existente) return existente;
    const nuevo = (handle: CromoHandle | null) => {
      if (handle) cromoRefs.current.set(key, handle);
      else cromoRefs.current.delete(key);
    };
    callbacksRefCromo.current.set(key, nuevo);
    return nuevo;
  }, []);
  // § EDITOR-AGREGAR-SECCION-1 — REF DE INDIRECCIÓN para `cambiarCampoInstancia`: esa función se
  // declara MÁS ABAJO, junto al resto del estado de `seccionesHome` (que depende de `doc`); este
  // handler —el campo flotante del iframe— se declara ACÁ ARRIBA. Un arreglo de dependencias de
  // `useCallback` SE EVALÚA DE INMEDIATO, así que nombrar ahí algo que el propio `const` todavía no
  // inicializó en este render (zona muerta de `const`) revienta en runtime — la ref lo evita: se lee
  // sólo DENTRO del cuerpo (en tiempo de LLAMADA, siempre después de que el render entero terminó),
  // y se actualiza con una asignación plana justo debajo de la función real, más abajo en el archivo.
  const cambiarCampoInstanciaRef = useRef<(id: string, campo: string, valor: string) => void>(() => {});
  // Gemelo PLURAL (§ EDITOR-BARRA-ESTILO-ESCALONADO-1), MISMA indirección y MISMO motivo: su función
  // real (`cambiarCamposInstancia`) se declara más abajo, junto al resto de `seccionesHome`. Hoy
  // NINGÚN productor del mensaje compuesto (`mensajesDeZonaHero`/`mensajesQuitarEstiloElemento`,
  // § editor-puente.ts) apunta a una instancia —las zonas del hero son siempre `seccion:'hero'`, y
  // `ELEMENTOS_ESTILO` (estilo-elemento.ts) sólo declara elementos de `hero`—, así que esta rama
  // existe por SIMETRÍA con la singular, lista para el día en que una instancia agregada declare
  // elementos estilizables o zonas propias.
  const cambiarCamposInstanciaRef = useRef<(id: string, campos: Array<{ campo: string; valor: string }>) => void>(() => {});
  const manejarSeleccionDesdeIframe = useCallback((marcador: string) => {
    // § EDITOR-TIENDA-CROMO-1 — el ENCABEZADO/MENÚ/PIE se revisan ANTES de resolver contra
    // `SECCIONES_TIENDA`: sus marcadores (`'encabezado'`/`'menu'`/`'footer'`) no son `SeccionVista`,
    // y `seccionDesdeMarcador` los devuelve tal cual (identidad) — resolverían a un candidato que
    // NUNCA está en `secciones` y se ignorarían en silencio si no se interceptan acá.
    //
    // `cromoRefs.get(marcador)?.abrir()`, NUNCA `abrirNivelCromo(marcador)` directo — mismo
    // criterio que `seccionRefs.get(candidato)?.seleccionar()` abajo: el handle es quien decide
    // abrirse (pone `editando=true` adentro), y ESO es lo que dispara `onAbrir` hacia este
    // componente (§ el efecto `prevEditandoRef` de cada cromo). Llamar `abrirNivelCromo` a mano
    // acá sólo movería `cromoActivo` (deja de estar `display:none`) sin que el editor INTERNO de
    // la tarjeta saliera de su vista de lectura — el bug que el arnés de este slice atrapó.
    if (esCromoKey(marcador)) { cromoRefs.current.get(marcador)?.abrir(); return; }
    // § EDITOR-AGREGAR-SECCION-1 — una SECCIÓN AGREGADA se revisa ANTES de `SECCIONES_TIENDA` por la
    // misma razón que el cromo: su id (`inst:…`) nunca va a estar en ese registro, así que
    // resolvería a "nada conocido" y se ignoraría en silencio si no se intercepta acá. A diferencia
    // del cromo, no hay un handle que "decida abrirse" — este componente YA es dueño del estado, así
    // que abre directo.
    const candidato = seccionDesdeMarcador(marcador);
    if (esInstanciaId(candidato)) {
      if (seccionesHomeLocalRef.current && candidato in seccionesHomeLocalRef.current) abrirNivelInstancia(candidato);
      return;
    }
    const candidatoSeccion = candidato as SeccionVista;
    if (!secciones.some(c => c.seccion === candidatoSeccion)) return;
    seccionRefs.current.get(candidatoSeccion)?.seleccionar();
  }, [secciones, abrirNivelInstancia]);
  // § EDITOR-TIENDA-CAMPO-EDITABLE-1 — el campo flotante, MISMA resolución de marcador que la
  // selección de arriba (un campo vive DENTRO de una sección marcada, así que su mensaje trae el
  // MISMO marcador de sección). Un marcador que no resuelve a una sección de la página activa se
  // ignora, nunca lanza — mismo criterio que `manejarSeleccionDesdeIframe`.
  // § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — si `campo` es un campo CRUZADO (p. ej. `marquesina.texto`,
  // declarado con `seccionCruzada:'marquesina'` en HERO.campos), la escritura va SIN abrir la tarjeta
  // de `candidato` (`escribirCampoSinAbrir`): el `TIPO_MENSAJE_SECCION_CLICK` del MISMO clic ya abrió
  // la tarjeta REAL (la del ancestro `[data-editor-seccion]` del DOM, § editor-iframe.ts — para la
  // marquesina dibujada por el hero sticky, ES la tarjeta del hero) vía `manejarSeleccionDesdeIframe`;
  // abrir TAMBIÉN la de `candidato` sería una segunda tarjeta expandiéndose sin que nadie la pidiera.
  const manejarCampoCambioDesdeIframe = useCallback((marcador: string, campo: string, valor: string) => {
    // § EDITOR-TIENDA-CROMO-1 — SÓLO `footer` gana marcadores `CampoEditable` en esta tanda
    // (§ `FooterSeccion.escribirCampo`); el clic ya abrió el nivel por el `TIPO_MENSAJE_SECCION_
    // CLICK` del MISMO clic, vía `manejarSeleccionDesdeIframe` — acá sólo queda escribir el campo.
    if (marcador === 'footer') { cromoRefs.current.get('footer')?.escribirCampo?.(campo, valor); return; }
    // § EDITOR-AGREGAR-SECCION-1 — una SECCIÓN AGREGADA: el clic ya abrió su nivel por el
    // `TIPO_MENSAJE_SECCION_CLICK` del MISMO clic (vía `manejarSeleccionDesdeIframe`, arriba) — acá
    // sólo queda escribir el campo, mergeado sobre el valor ACTUAL (`cambiarCampoInstancia`).
    const candidato = seccionDesdeMarcador(marcador);
    if (esInstanciaId(candidato)) { cambiarCampoInstanciaRef.current(candidato, campo, valor); return; }
    const candidatoSeccion = candidato as SeccionVista;
    if (!secciones.some(c => c.seccion === candidatoSeccion)) return;
    const handle = seccionRefs.current.get(candidatoSeccion);
    const esCruzado = secciones.some(c => c.campos.some(f => f.seccionCruzada === candidatoSeccion && f.name === campo));
    if (esCruzado) handle?.escribirCampoSinAbrir(campo, valor);
    else handle?.escribirCampo(campo, valor);
  }, [secciones]);

  // § EDITOR-BARRA-ESTILO-ESCALONADO-1 — gemelo PLURAL de `manejarCampoCambioDesdeIframe`: el mismo
  // árbol de resolución (footer / instancia / cruzado / sección regular), pero para el mensaje
  // COMPUESTO (zonas del hero, "Quitar" de la barra de estilo) — UN SOLO lote, nunca un campo por
  // vez. Las ramas footer/instancia/cruzado existen por SIMETRÍA con la singular y hoy NO las
  // ejerce ningún productor real (§ el docstring de `cambiarCamposInstanciaRef`, arriba: las zonas
  // del hero y los elementos estilizables de `ELEMENTOS_ESTILO` son siempre `seccion:'hero'`, nunca
  // footer/instancia/cruzado) — por eso aplican el lote con un LOOP sobre el método SINGULAR de
  // cada rama (comportamiento idéntico al de antes de este slice para esos casos, nunca ejercido en
  // la práctica), mientras que la rama real (sección regular) usa `escribirCampos` — UNA sola
  // escritura para todo el lote, que es lo que este slice existe para garantizar.
  const manejarCamposCambioDesdeIframe = useCallback((marcador: string, campos: Array<{ campo: string; valor: string }>) => {
    if (campos.length === 0) return;
    if (marcador === 'footer') {
      for (const { campo, valor } of campos) cromoRefs.current.get('footer')?.escribirCampo?.(campo, valor);
      return;
    }
    const candidato = seccionDesdeMarcador(marcador);
    if (esInstanciaId(candidato)) { cambiarCamposInstanciaRef.current(candidato, campos); return; }
    const candidatoSeccion = candidato as SeccionVista;
    if (!secciones.some(c => c.seccion === candidatoSeccion)) return;
    const handle = seccionRefs.current.get(candidatoSeccion);
    const esCruzado = secciones.some(c => c.campos.some(f => f.seccionCruzada === candidatoSeccion && campos.some(cc => cc.campo === f.name)));
    if (esCruzado) { for (const { campo, valor } of campos) handle?.escribirCampoSinAbrir(campo, valor); return; }
    handle?.escribirCampos(campos);
  }, [secciones]);

  // § EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1 — el clic en una imagen/video DENTRO del iframe. Mensaje
  // CUARTO del puente (`TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`), que a diferencia de los otros TRES no pasa
  // por `VistaTiendaIframe.tsx` (fuera de `touches:` de este slice, § DECISIONS.md): el iframe lo
  // manda a `window.parent` —el MISMO `window` donde vive este componente—, así que un listener
  // PROPIO acá lo recibe exactamente igual que el que ya tiene `VistaTiendaIframe` para los otros
  // dos, sin tocar ese archivo. Mismo chequeo de ORIGEN que el resto del puente (mismo-origen
  // SIEMPRE, § EditorPuenteVivo.tsx); sin comparar `e.source` contra el iframe real porque este
  // componente no tiene esa referencia (sólo el HANDLE imperativo de `VistaTiendaIframe`, que no
  // expone el nodo DOM) — el chequeo de origen ya es la verificación que la doctrina del puente
  // exige (mismo-origen implica que sólo este mismo despliegue pudo mandarlo).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!esMensajeCampoImagenClick(e.data)) return;
      const candidato = seccionDesdeMarcador(e.data.seccion);
      // § EDITOR-AGREGAR-SECCION-1 — una SECCIÓN AGREGADA: abre su editor (no hay un selector de
      // imagen que disparar PROGRAMÁTICAMENTE desde acá — `InstanciaEditorForm` no expone ese
      // handle, § su docstring de cabecera — así que el dueño llega al campo con un clic más,
      // "Cambiar", una vez el editor está abierto; simplificación DECLARADA, no un olvido).
      if (esInstanciaId(candidato)) {
        if (seccionesHomeLocalRef.current && candidato in seccionesHomeLocalRef.current) abrirNivelInstancia(candidato);
        return;
      }
      const candidatoSeccion = candidato as SeccionVista;
      if (!secciones.some(c => c.seccion === candidatoSeccion)) return;
      seccionRefs.current.get(candidatoSeccion)?.abrirSelectorImagen(e.data.campo);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [secciones, abrirNivelInstancia]);

  // ANGOSTO reusa la pregunta de `useSheetDesdeAbajo` ("¿es una pantalla táctil de una mano?",
  // umbral 960 — § DUNA_MQ_SHEET_ABAJO) para una decisión DISTINTA de la suya (de qué borde sale un
  // sheet): acá decide si la lista de secciones y el iframe se apilan en vez de ir lado a lado. Es
  // la MISMA pregunta —hay rail, no hay espacio para dos columnas anchas— así que comparte el
  // umbral en vez de abrir un segundo listener de `matchMedia` para lo mismo.
  const angosto = useSheetDesdeAbajo();

  // ── § EDITOR-PANEL-ANCHO-1 — EL ANCHO DEL PANEL, ajustable arrastrando su borde (pedido del owner,
  //    2026-10-05: "como hace vercel con el suyo"). SÓLO aplica cuando NO es `angosto`: bajo ese
  //    umbral el editor apila (panel arriba, lienzo abajo) y no hay borde vertical que arrastrar.
  //
  //    `anchoGuardado` es la PREFERENCIA cruda del dueño (lo que `localStorage` recuerda); `anchoPanel`
  //    es el valor APLICADO, recortado en vivo contra el ancho de ventana ACTUAL (`clampAnchoPanel`).
  //    Separar los dos es lo que hace que "al achicar la ventana el ancho se recorta, pero vuelve si
  //    la ventana crece" (§ el spec) sea gratis: nunca se SOBREESCRIBE la preferencia guardada por
  //    culpa de una ventana angosta momentánea, sólo se recalcula el recorte en cada render.
  const [anchoGuardado, setAnchoGuardado] = useState<number>(ANCHO_PANEL_DEFECTO);
  const [anchoVentana, setAnchoVentana] = useState(0); // 0 = todavía no medido (SSR-safe)
  useEffect(() => {
    try { setAnchoGuardado(anchoPanelDesdeStorage(localStorage.getItem(CLAVE_ANCHO_PANEL))); } catch { /* arranca en el default */ }
  }, []);
  useEffect(() => {
    const medir = () => setAnchoVentana(window.innerWidth);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  const anchoPanelMax = anchoVentana > 0 ? anchoPanelMaximo(anchoVentana) : ANCHO_PANEL_MAX;
  const anchoPanel = anchoVentana > 0 ? clampAnchoPanel(anchoGuardado, anchoVentana) : ANCHO_PANEL_DEFECTO;
  const guardarAnchoPanel = useCallback((valor: number) => {
    setAnchoGuardado(valor);
    try { localStorage.setItem(CLAVE_ANCHO_PANEL, String(valor)); } catch { /* no-op, § dispositivoDesdeStorage */ }
  }, []);

  // EL ARRASTRE: `arrastrandoPanel` dispara el efecto de abajo, que escucha `pointermove`/`pointerup`
  // en la VENTANA (no en la manija) — así el arrastre sigue funcionando aunque el puntero se mueva
  // más rápido que el ancho de la franja de 8px (§ editor.css, `.editor-panel-manija`). `arrastreRef`
  // guarda el punto de partida en una ref (no en estado) porque se lee en cada `pointermove` sin
  // necesitar un re-render por sí solo — sólo `guardarAnchoPanel` lo dispara.
  const [arrastrandoPanel, setArrastrandoPanel] = useState(false);
  const arrastreRef = useRef<{ x: number; anchoInicial: number } | null>(null);
  const iniciarArrastrePanel = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // sólo el botón principal
    e.preventDefault();
    arrastreRef.current = { x: e.clientX, anchoInicial: anchoPanel };
    setArrastrandoPanel(true);
  }, [anchoPanel]);
  useEffect(() => {
    if (!arrastrandoPanel) return;
    const alMover = (e: PointerEvent) => {
      const inicio = arrastreRef.current;
      if (!inicio) return;
      guardarAnchoPanel(clampAnchoPanel(inicio.anchoInicial + (e.clientX - inicio.x), window.innerWidth));
    };
    const alSoltar = () => { arrastreRef.current = null; setArrastrandoPanel(false); };
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    return () => {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
    };
  }, [arrastrandoPanel, guardarAnchoPanel]);
  // SIN selección de texto mientras se arrastra — un drag horizontal sobre texto del panel/lienzo
  // seleccionaría la página entera si no se corta acá.
  useEffect(() => {
    if (!arrastrandoPanel) return;
    const previo = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => { document.body.style.userSelect = previo; };
  }, [arrastrandoPanel]);

  // TECLADO (§ el spec: "enfocable, y las flechas izquierda/derecha lo mueven de a 16px. Doble clic
  // (o Enter con el foco) vuelve al ancho por defecto") y el doble clic — comparten el mismo destino,
  // `guardarAnchoPanel`.
  const resetearAnchoPanel = useCallback(() => guardarAnchoPanel(ANCHO_PANEL_DEFECTO), [guardarAnchoPanel]);
  const onKeyDownManijaPanel = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      guardarAnchoPanel(siguienteAnchoPorTeclado(anchoPanel, e.key, window.innerWidth));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      resetearAnchoPanel();
    }
  }, [anchoPanel, guardarAnchoPanel, resetearAnchoPanel]);

  // Las categorías DERIVADAS del catálogo, para el campo-destino de Presentaciones (el combobox + el
  // aviso de destino inexistente). Se cargan UNA vez —misma fuente que /admin/productos
  // (`getProducts` + `categoriasDelCatalogo`), sin endpoint nuevo—. Si el fetch falla, `categoriasListas`
  // queda en false: el combobox sólo deja escribir y el aviso NO se muestra (no afirmar sobre un
  // catálogo que no tenemos).
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriasListas, setCategoriasListas] = useState(false);
  useEffect(() => {
    let vivo = true;
    getProducts()
      .then(ps => { if (vivo) { setCategorias(categoriasDelCatalogo(ps)); setCategoriasListas(true); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // EL CONTENIDO se pide UNA vez acá y se baja a cada editor su rebanada (§ fetch 6→1): antes cada sección
  // fetcheaba `/api/site-content` COMPLETO y usaba sólo su slice —5 requests idénticos en la home—. El GET
  // devuelve el doc draft-merged entero (`contenido`) + el mapa `sinPublicar`; el editor siembra su form de
  // su slice. `recargar` re-lee y DEVUELVE lo fresco, para el re-seed del editor tras "Descartar" (el único
  // que re-leía). Las ESCRITURAS (PUT autoguardado, POST publicar/descartar) siguen POR SECCIÓN, sin tocar.
  const [doc, setDoc] = useState<{ contenido: Record<string, unknown>; sinPublicar: Record<string, boolean> } | null>(null);
  const [errorDoc, setErrorDoc] = useState(false);
  const recargarDoc = useCallback(async () => {
    const r = await fetch('/api/site-content');
    if (!r.ok) throw new Error();
    const d = await r.json();
    setDoc({ contenido: d.contenido ?? {}, sinPublicar: d.sinPublicar ?? {} });
    return d as { contenido?: Record<string, unknown>; sinPublicar?: Record<string, boolean> };
  }, []);
  useEffect(() => { recargarDoc().catch(() => setErrorDoc(true)); }, [recargarDoc]);

  // ── § EDITOR-TIENDA-DESHACER-1 — EL HISTORIAL COMPARTIDO, dueño de TiendaPaginas ────────────────
  //
  // UNA sola pila para toda la página abierta (secciones + 'orden'): cada `TiendaSeccionEditor`
  // construye su propio paso (closures sobre su `form`/`auto`, § ese archivo) y lo EMPUJA acá por
  // `onPaso`; `aplicarNuevoOrden` (abajo) hace lo mismo directo, porque el orden ya vive en este
  // componente. El historial NUNCA sabe qué hay detrás de un paso — sólo los apila.
  //
  // Init perezoso por ref (mismo patrón que `useAutoguardado.ts`: `crearHistorialEditor()` crea un
  // objeto NUEVO, así que no puede ir en `useState(crearHistorialEditor())` sin memoizar — y
  // tampoco hace falta: no es estado de render, nadie lo lee directo en el JSX).
  const historialRef = useRef<HistorialEditor | null>(null);
  if (historialRef.current === null) historialRef.current = crearHistorialEditor();
  // Las mutaciones del historial (registrar/deshacer/rehacer) NO son estado de React — este
  // contador es lo que fuerza al efecto de agregado (más abajo) a releer `puedeDeshacer()`/
  // `puedeRehacer()` después de cada una.
  const [historialVersion, setHistorialVersion] = useState(0);
  const tocarHistorial = useCallback(() => setHistorialVersion((v) => v + 1), []);

  // LIMPIAR AL CAMBIAR DE PÁGINA/MODO: un paso viejo puede cerrar sobre el `setForm` de una sección
  // que está a punto de desmontarse (`secciones` cambia con `pagina`) — más seguro cortar la rama
  // entera que arriesgar un deshacer que ya no tiene a quién aplicarse (§ el docstring de
  // `HistorialEditor.limpiar`). Corre también al MONTAR (pagina/modo iniciales): limpiar un
  // historial recién creado es un no-op.
  useEffect(() => {
    historialRef.current?.limpiar();
    tocarHistorial();
  }, [pagina, modo, tocarHistorial]);

  // § EDITOR-TIENDA-SHELL-1 — `seccionActiva` vuelve a Inicio al cambiar de PÁGINA (una sección de
  // Home no existe en Nosotros; dejarla puesta ocultaría TODAS las filas de `seccionesOrdenadas`,
  // porque ninguna coincidiría con un `seccionActiva` de otra página). NO depende de `modo`, a
  // propósito: "Abrir Estilo no pierde la selección" (REDISENO.md § 3) — ir y volver entre Secciones
  // y Estilo debe conservar el nivel donde se estaba.
  // § EDITOR-AGREGAR-SECCION-1 — `instanciaActiva` por la MISMA razón: una instancia sólo existe en
  // 'home' (nosotros/suscripciones no tienen `seccionesHome`), así que cambiar de página la deja
  // apuntando a un id que nunca va a aparecer en `seccionesOrdenadas` de esa otra página.
  useEffect(() => { setSeccionActiva(null); setInstanciaActiva(null); }, [pagina]);

  const deshacerGlobal = useCallback(() => { historialRef.current?.deshacer(); tocarHistorial(); }, [tocarHistorial]);
  const rehacerGlobal = useCallback(() => { historialRef.current?.rehacer(); tocarHistorial(); }, [tocarHistorial]);
  // Lo que cada `TiendaSeccionEditor` empuja cuando UN LOTE de sus propias ediciones se asienta
  // (§ `TiendaSeccionEditor.tsx`, `aplicarCambioForm`). Una sola identidad de función para las N
  // secciones montadas —el componente no necesita saber CUÁL sección empujó qué, el paso ya trae
  // sus propios closures—.
  const onPasoSeccion = useCallback((paso: PasoHistorial) => {
    historialRef.current?.registrar(paso);
    tocarHistorial();
  }, [tocarHistorial]);

  // § EDITOR-TIENDA-DESHACER-1 — EL AGREGADO "N cambios sin publicar"/"Guardando…" por SECCIÓN. El
  // padre no puede leer el estado interno de cada `TiendaSeccionEditor` montado; cada uno lo
  // REPORTA acá (`onEstado`) en cada cambio real de su `hayBorrador`/`auto.estado`. Entradas de
  // secciones que ya no están en `secciones` (otra página) quedan SUELTAS en el Map a propósito —
  // el cálculo de `pendientes` (más abajo) sólo mira las de la página ACTIVA, así que un residuo
  // de otra página no cuenta de más; nunca hace falta purgarlas a mano.
  const [seccionesEstado, setSeccionesEstado] = useState<Map<SeccionVista, { hayBorrador: boolean; estado: EstadoAutoguardado }>>(new Map());
  const manejarEstadoSeccion = useCallback((seccion: SeccionVista, info: { hayBorrador: boolean; estado: EstadoAutoguardado }) => {
    setSeccionesEstado((prev) => {
      const actual = prev.get(seccion);
      if (actual && actual.hayBorrador === info.hayBorrador && actual.estado === info.estado) return prev; // sin cambio real
      const siguiente = new Map(prev);
      siguiente.set(seccion, info);
      return siguiente;
    });
  }, []);

  // § EDITOR-TIENDA-CROMO-1 — gemelo de `seccionesEstado`, para el ENCABEZADO/MENÚ/PIE: a
  // diferencia de 'tema' (que sólo tiene el HUECO CONOCIDO de `doc.sinPublicar.tema`, § abajo,
  // porque `PaletaSeccion` no está en `touches:`), los tres SÍ pueden reportar en vivo —son
  // editores nuevos de este slice—, así que el agregado de pendientes puede ser EXACTO en vez de
  // depender del último refetch de `doc`.
  const [cromoEstado, setCromoEstado] = useState<Map<CromoKey, { hayBorrador: boolean; estado: EstadoAutoguardado }>>(new Map());
  const manejarEstadoCromo = useCallback((key: CromoKey, info: { hayBorrador: boolean; estado: EstadoAutoguardado }) => {
    setCromoEstado((prev) => {
      const actual = prev.get(key);
      if (actual && actual.hayBorrador === info.hayBorrador && actual.estado === info.estado) return prev;
      const siguiente = new Map(prev);
      siguiente.set(key, info);
      return siguiente;
    });
  }, []);

  // ── § EDITOR-TIENDA-ORDEN-1 — EL ORDEN de las bandas del home, reordenable/ocultable desde la
  //    lista lateral (§ DISENO.md § 4.2, fila 6 del plan). SÓLO 'home' tiene `content.orden`
  //    (BANDA_IDS, site-content-defaults.ts) — nosotros/suscripciones no declaran este campo, así
  //    que `ordenLocal` se queda `null` para esas páginas y ningún `SeccionConfig` recibe la prop
  //    `orden` (sin asa, sin reordenar).
  //
  //    SIEMBRA ÚNICA (mismo patrón que el `form` de cada `TiendaSeccionEditor`): una vez que `doc`
  //    carga, este componente pasa a ser DUEÑO del array — switch de página y vuelta NO re-siembra
  //    (`TiendaPaginas` no se remonta al cambiar `pagina`, sólo cambia qué `secciones` renderiza).
  //
  //    `string[]`, NO `BandaId[]` (§ EDITOR-AGREGAR-SECCION-1): el `orden` real puede mezclar bandas
  //    con ids de instancia (`inst:…`, § secciones-instancias.ts) desde que `seccionesHome` existe.
  const [ordenLocal, setOrdenLocal] = useState<string[] | null>(null);
  // § EDITOR-TIENDA-DESHACER-1 — espejo síncrono de `ordenLocal`, para leer el valor "despues" de
  // un lote desde el efecto de abajo sin que ese efecto dependa de `ordenLocal` (lo que lo correría
  // en cada reorden, no sólo al asentar).
  const ordenLocalRef = useRef<string[] | null>(null); ordenLocalRef.current = ordenLocal;
  const [hayBorradorOrden, setHayBorradorOrden] = useState(false);
  const [procesandoOrden, setProcesandoOrden] = useState(false);
  const [errorOrden, setErrorOrden] = useState<string | null>(null);
  const sembradoOrdenRef = useRef(false);
  useEffect(() => {
    if (sembradoOrdenRef.current || !doc) return;
    sembradoOrdenRef.current = true;
    // `doc.contenido.orden` YA LLEGA RESUELTO COMPLETO (bandas ∪ instancias, § `resolverSiteContent`
    // en `site-content-defaults.ts`), así que correr `resolverOrdenCompleto` acá es una red
    // DEFENSIVA, no la primera fuente de verdad (mismo criterio que el resto de este archivo: el
    // WRITE puede ser más estricto que el loader, nunca al revés). Usar la vieja `resolverOrden`
    // (sólo `BANDA_IDS`) descartaría en silencio cualquier instancia ya agregada.
    const idsInstancia = Object.keys((doc.contenido.seccionesHome as Record<string, unknown> | undefined) ?? {});
    const draftMerged = resolverOrdenCompleto(doc.contenido.orden, BANDA_IDS, idsInstancia);
    setOrdenLocal(draftMerged);
    // `sinPublicar.orden` NO lo calcula el GET genérico (orden es META, fuera del REGISTRY, § el
    // mismo motivo por el que `tema`/`encabezado` lo calculan A MANO en `site-content-read.ts` —
    // acá se resuelve comparando contra lo PUBLICADO, un único fetch extra al montar, nunca
    // recurrente): sin esto, reabrir el editor tras reordenar en una sesión anterior sin publicar
    // mostraría la píldora "Sin publicar" apagada, mintiendo sobre un borrador que sigue pendiente.
    fetch('/api/site-content/publicado')
      .then((r) => (r.ok ? r.json() : null))
      .then((pub: { orden?: unknown; seccionesHome?: unknown } | null) => {
        if (!pub) return;
        const idsInstanciaPublicados = Object.keys((pub.seccionesHome as Record<string, unknown> | undefined) ?? {});
        const publicado = resolverOrdenCompleto(pub.orden, BANDA_IDS, idsInstanciaPublicados);
        setHayBorradorOrden(!sonIguales(publicado, draftMerged));
      })
      .catch(() => {}); // sin esto, "Sin publicar" se queda apagado — preferible a afirmar sin base
  }, [doc]);

  // El AUTOGUARDADO del orden — MISMO coordinador que cada sección (`useAutoguardado`), guardando
  // la clave META `orden` en vez de una sección del REGISTRY (el PUT genérico ya la acepta:
  // `ordenEditableSchema` está declarado en `siteContentEditableSchema`, § site-content-schema.ts).
  const guardarOrden = useCallback(async (data: string[]) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const autoOrden = useAutoguardado(guardarOrden);

  // EL ENVÍO EN VIVO al iframe compartido (§ EDITOR-TIENDA-POSTMESSAGE-1), reusado para 'orden'.
  // `VistaTiendaIframe.tsx` SÍ está en `touches:` de este slice (§ EDITOR-AGREGAR-SECCION-1) y su
  // `enviarCambio` ya acepta `string` directo —el cast que este archivo necesitaba cuando ese
  // archivo estaba fuera de alcance ya no hace falta—. 'orden' sigue sin ser una `SeccionVista`
  // real; `EditorPuenteVivo.tsx` (§ editor-puente.ts) la reconoce ANTES de tratarla como sección.
  const enviarOrdenIframe = useCallback((valor: string[]) => {
    iframeRef.current?.enviarCambio('orden', { valor });
  }, []);

  // EL ENVÍO EN VIVO del TEMA al iframe compartido (§ EDITOR-TIENDA-TEMA-1) — MISMO cruce que
  // 'orden', arriba. `PaletaSeccion` (`enEditor`/`onCambioEnVivo`) ya manda las vars SIEMPRE
  // COMPLETAS (`varsDeTemaEnVivo`), así que acá no hay nada que resolver — sólo reenviar.
  const enviarTemaIframe = useCallback((vars: Record<string, string>) => {
    iframeRef.current?.enviarCambio('tema', { vars });
  }, []);

  // ── § EDITOR-AGREGAR-SECCION-1 — LAS SECCIONES AGREGADAS, mismo patrón que 'orden' arriba ───────
  //
  // `seccionesHomeLocal` es el mapa id→instancia LOCAL que este componente posee, hermano de
  // `ordenLocal`: UN autoguardado para el mapa completo (como 'orden' es UN autoguardado para el
  // array completo), nunca uno por instancia — mismo criterio que escribe `content.tema` entero en
  // cada guardado en vez de un campo a la vez. A diferencia de 'orden', el GET genérico YA calcula
  // `sinPublicar.seccionesHome` (§ `site-content-read.ts`, construido por SECCIONES-INSTANCIAS-1),
  // así que no hace falta el fetch extra a `/publicado` que 'orden' necesita para su píldora.
  const [seccionesHomeLocal, setSeccionesHomeLocal] = useState<Record<string, InstanciaContent> | null>(null);
  const seccionesHomeLocalRef = useRef<Record<string, InstanciaContent> | null>(null);
  seccionesHomeLocalRef.current = seccionesHomeLocal;
  const [hayBorradorSeccionesHome, setHayBorradorSeccionesHome] = useState(false);
  const sembradoSeccionesHomeRef = useRef(false);
  useEffect(() => {
    if (sembradoSeccionesHomeRef.current || !doc) return;
    sembradoSeccionesHomeRef.current = true;
    const draftMerged = (doc.contenido.seccionesHome as Record<string, InstanciaContent> | undefined) ?? {};
    setSeccionesHomeLocal(draftMerged);
    setHayBorradorSeccionesHome(!!doc.sinPublicar.seccionesHome);
  }, [doc]);

  const guardarSeccionesHome = useCallback(async (data: Record<string, InstanciaContent>) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seccionesHome: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const autoSeccionesHome = useAutoguardado(guardarSeccionesHome);

  /** Manda el borrador EN VIVO de UNA instancia al iframe — gemelo de `manejarCambioSeccion` para
   *  una banda. `datos` es el objeto COMPLETO (§ el docstring de `InstanciaEditorForm.tsx`: el
   *  puente resuelve el mensaje entero contra el descriptor, un parche parcial perdería los campos
   *  ausentes a su default). */
  const enviarInstanciaIframe = useCallback((id: string, datos: Record<string, unknown>) => {
    iframeRef.current?.enviarCambio(id, datos);
  }, []);

  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);

  // § EDITOR-TIENDA-DESHACER-1 — el "lote" del orden, MISMO criterio que `aplicarCambioForm` de
  // `TiendaSeccionEditor.tsx`: el PRIMER reorder desde el último asentamiento fija `loteOrdenAntesRef`;
  // los siguientes (mientras el debounce del autoguardado sigue abierto) no lo tocan — así una
  // ráfaga de flechas o un arrastre con varios `dragenter` cuenta como UN solo paso de historial.
  const loteOrdenAntesRef = useRef<string[] | null>(null);
  // Suprime el push de abajo cuando el PROPIO deshacer/rehacer del orden disparó el asentamiento
  // (mismo rol que `aplicandoHistorialRef` en `TiendaSeccionEditor.tsx` — sin esto, cada deshacer
  // empujaría un paso nuevo a su propia pila). § EDITOR-AGREGAR-SECCION-1 — también la usan
  // agregar/duplicar/eliminar: esas tres mutan `orden` y `seccionesHome` A LA VEZ y empujan UN solo
  // paso combinado manualmente (§ `agregarSeccion`/`duplicarInstancia`/`eliminarInstancia`, abajo),
  // así que necesitan suprimir el push automático de ESTE efecto — llaman a `restaurarOrden`, que ya
  // pone la bandera.
  const aplicandoHistorialOrdenRef = useRef(false);

  const aplicarNuevoOrden = useCallback((siguiente: string[], anterior: string[]) => {
    if (siguiente === anterior) return; // sin cambio real (§ moverBanda*: misma referencia)
    if (loteOrdenAntesRef.current === null) loteOrdenAntesRef.current = anterior;
    setOrdenLocal(siguiente);
    setHayBorradorOrden(true);
    autoOrden.marcarSucio(siguiente);
    enviarOrdenIframe(siguiente);
  }, [autoOrden, enviarOrdenIframe]);

  // Deshacer/rehacer del orden: aplica un array COMPLETO por el MISMO camino que cualquier reorder
  // (nunca un segundo camino de datos) y lo persiste YA (`flush`), igual que `restaurarForm` de
  // `TiendaSeccionEditor.tsx`.
  const restaurarOrden = useCallback((valor: string[]) => {
    aplicandoHistorialOrdenRef.current = true;
    setOrdenLocal(valor);
    setHayBorradorOrden(true);
    autoOrden.marcarSucio(valor);
    autoOrden.flush();
    enviarOrdenIframe(valor);
  }, [autoOrden, enviarOrdenIframe]);

  // El PASO de historial del orden — mismo mecanismo que el efecto gemelo de `TiendaSeccionEditor.tsx`
  // sobre `auto.estado`, acá sobre `autoOrden.estado`.
  const prevEstadoOrdenRef = useRef(autoOrden.estado);
  useEffect(() => {
    const prevEstado = prevEstadoOrdenRef.current;
    prevEstadoOrdenRef.current = autoOrden.estado;
    if (prevEstado === autoOrden.estado || autoOrden.estado !== 'guardado') return;
    const antes = loteOrdenAntesRef.current;
    loteOrdenAntesRef.current = null;
    const fueHistorial = aplicandoHistorialOrdenRef.current;
    aplicandoHistorialOrdenRef.current = false;
    if (fueHistorial || antes === null) return;
    const despues = ordenLocalRef.current;
    if (!despues || sonIguales(antes, despues)) return;
    historialRef.current?.registrar({ deshacer: () => restaurarOrden(antes), rehacer: () => restaurarOrden(despues) });
    tocarHistorial();
  }, [autoOrden.estado, restaurarOrden, tocarHistorial]);

  const moverOrden = useCallback((id: string, dir: -1 | 1) => {
    setOrdenLocal((prev) => {
      if (!prev) return prev;
      const siguiente = moverBandaEnDireccion(prev, id, dir);
      aplicarNuevoOrden(siguiente, prev);
      return siguiente;
    });
  }, [aplicarNuevoOrden]);

  const moverOrdenA = useCallback((idArrastrado: string, idDestino: string) => {
    setOrdenLocal((prev) => {
      if (!prev) return prev;
      const siguiente = moverBandaConDestino(prev, idArrastrado, idDestino);
      aplicarNuevoOrden(siguiente, prev);
      return siguiente;
    });
  }, [aplicarNuevoOrden]);

  // El asa por sección — `undefined` para toda página sin `content.orden` o mientras `ordenLocal`
  // no sembró todavía (ninguna lista reordenable antes de saber el orden real evita un "salto"
  // visual al llegar el primer render con datos). `id: string` (§ EDITOR-AGREGAR-SECCION-1): sirve
  // por igual a un `bandaId` y a un id de instancia — es la MISMA asa, el mismo array mixto.
  const asaDeSeccion = useCallback((id: string | undefined, titulo: string): AsaOrdenProps | undefined => {
    if (!id || !ordenLocal) return undefined;
    const i = ordenLocal.indexOf(id);
    if (i < 0) return undefined;
    return {
      posicion: i + 1,
      total: ordenLocal.length,
      arrastrando: arrastrandoId === id,
      onDragStart: () => setArrastrandoId(id),
      onDragEnter: () => { if (arrastrandoId && arrastrandoId !== id) moverOrdenA(arrastrandoId, id); },
      onDragEnd: () => setArrastrandoId(null),
      onMoverArriba: () => moverOrden(id, -1),
      onMoverAbajo: () => moverOrden(id, 1),
    };
    // `titulo` no se usa en el cálculo — queda en la firma para que el aria-label del asa (en
    // `TiendaSeccionEditor`) tenga un nombre sin que este callback dependa de él.
  }, [ordenLocal, arrastrandoId, moverOrdenA, moverOrden]);

  const publicarOrDescartarOrden = async (accion: 'publicar' | 'descartar') => {
    setErrorOrden(null); setProcesandoOrden(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion: 'orden' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorOrden(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
        return;
      }
      if (accion === 'descartar') {
        // Re-lee lo PUBLICADO (mismo mecanismo que cada sección: `recargar()` re-lee el doc draft-
        // merged — tras descartar, "draft-merged" vuelve a ser exactamente lo publicado).
        const fresco = await recargarDoc();
        const idsInstancia = Object.keys((fresco.contenido?.seccionesHome as Record<string, unknown> | undefined) ?? {});
        setOrdenLocal(resolverOrdenCompleto(fresco.contenido?.orden, BANDA_IDS, idsInstancia));
      }
      setHayBorradorOrden(false);
      recargarIframe(); // la MISMA resincronización completa que usa cada sección tras publicar/descartar
    } catch {
      setErrorOrden(accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.');
    } finally {
      setProcesandoOrden(false);
    }
  };

  // ── § EDITOR-AGREGAR-SECCION-1 — EL LOTE de `seccionesHome`, mismo mecanismo que el de 'orden' ──
  //
  // Gemelo exacto de `loteOrdenAntesRef`/`aplicandoHistorialOrdenRef`/`restaurarOrden`/el efecto de
  // `autoOrden.estado`, de arriba — ver esos docstrings para el porqué de cada pieza, no repetido
  // acá. La única diferencia es la CLAVE (`seccionesHome`, un mapa, no un array) y el autoguardado
  // que observa (`autoSeccionesHome`, no `autoOrden`).
  const loteSeccionesHomeAntesRef = useRef<Record<string, InstanciaContent> | null>(null);
  const aplicandoHistorialSeccionesHomeRef = useRef(false);

  const restaurarSeccionesHome = useCallback((valor: Record<string, InstanciaContent>) => {
    aplicandoHistorialSeccionesHomeRef.current = true;
    setSeccionesHomeLocal(valor);
    setHayBorradorSeccionesHome(true);
    autoSeccionesHome.marcarSucio(valor);
    autoSeccionesHome.flush();
  }, [autoSeccionesHome]);

  const prevEstadoSeccionesHomeRef = useRef(autoSeccionesHome.estado);
  useEffect(() => {
    const prevEstado = prevEstadoSeccionesHomeRef.current;
    prevEstadoSeccionesHomeRef.current = autoSeccionesHome.estado;
    if (prevEstado === autoSeccionesHome.estado || autoSeccionesHome.estado !== 'guardado') return;
    const antes = loteSeccionesHomeAntesRef.current;
    loteSeccionesHomeAntesRef.current = null;
    const fueHistorial = aplicandoHistorialSeccionesHomeRef.current;
    aplicandoHistorialSeccionesHomeRef.current = false;
    if (fueHistorial || antes === null) return;
    const despues = seccionesHomeLocalRef.current;
    if (!despues || sonIguales(antes, despues)) return;
    historialRef.current?.registrar({ deshacer: () => restaurarSeccionesHome(antes), rehacer: () => restaurarSeccionesHome(despues) });
    tocarHistorial();
  }, [autoSeccionesHome.estado, restaurarSeccionesHome, tocarHistorial]);

  /** Edita UNA instancia: escribe su OBJETO COMPLETO (nunca un parche, § `InstanciaEditorForm`) en
   *  `seccionesHomeLocal`, con el MISMO lote-por-debounce que un campo de banda (una ráfaga de
   *  teclas entre dos asentamientos del autoguardado es UN solo paso de historial) — `loteSeccio-
   *  nesHomeAntesRef` lo fija en el PRIMER cambio desde el último asentamiento. Reenvía EN VIVO. */
  const cambiarInstancia = useCallback((id: string, siguiente: InstanciaContent) => {
    setSeccionesHomeLocal((prev) => {
      const actual = prev ?? {};
      if (loteSeccionesHomeAntesRef.current === null) loteSeccionesHomeAntesRef.current = actual;
      const nuevoMapa = { ...actual, [id]: siguiente };
      setHayBorradorSeccionesHome(true);
      autoSeccionesHome.marcarSucio(nuevoMapa);
      return nuevoMapa;
    });
    enviarInstanciaIframe(id, siguiente as unknown as Record<string, unknown>);
  }, [autoSeccionesHome, enviarInstanciaIframe]);

  /** Escribe UN campo de una instancia, mergeado sobre su valor ACTUAL — lo que llega del campo
   *  flotante del iframe (un solo nombre+valor), a diferencia de `InstanciaEditorForm` (que ya
   *  manda el objeto completo). Sin instancia actual que mergear, se ignora — mismo criterio de
   *  siempre: un marcador que no resuelve a nada conocido no inventa nada. */
  const cambiarCampoInstancia = useCallback((id: string, campo: string, valor: string) => {
    const actual = seccionesHomeLocalRef.current?.[id];
    if (!actual) return;
    cambiarInstancia(id, { ...actual, [campo]: valor } as InstanciaContent);
  }, [cambiarInstancia]);
  // Mantiene viva la REF que `manejarCampoCambioDesdeIframe` (declarado arriba, antes de que esta
  // función existiera en este render) necesita llamar — § el docstring de `cambiarCampoInstanciaRef`.
  cambiarCampoInstanciaRef.current = cambiarCampoInstancia;
  // Gemelo PLURAL (§ EDITOR-BARRA-ESTILO-ESCALONADO-1): funde TODOS los campos del lote sobre el
  // valor ACTUAL en UN SOLO `cambiarInstancia` — nunca uno por campo (eso reabriría, a nivel de
  // instancia, la misma race que `TiendaSeccionEditor.escribirCampos` cierra para las secciones
  // regulares: `cambiarCampoInstancia` lee `seccionesHomeLocalRef.current`, que sólo se re-sincroniza
  // en el render siguiente a un `setSeccionesHomeLocal`).
  const cambiarCamposInstancia = useCallback((id: string, campos: Array<{ campo: string; valor: string }>) => {
    const actual = seccionesHomeLocalRef.current?.[id];
    if (!actual) return;
    const siguiente = campos.reduce((acc, { campo, valor }) => ({ ...acc, [campo]: valor }), { ...actual });
    cambiarInstancia(id, siguiente as InstanciaContent);
  }, [cambiarInstancia]);
  cambiarCamposInstanciaRef.current = cambiarCamposInstancia;

  // ── § EDITOR-AGREGAR-SECCION-1 — AGREGAR / DUPLICAR / ELIMINAR una sección ─────────────────────
  //
  // Las TRES mutan `orden` Y `seccionesHome` A LA VEZ (una instancia nueva necesita las dos: un id
  // en el mapa Y un lugar en la secuencia), así que las TRES siguen el MISMO patrón: calculan el
  // array/mapa siguiente, los aplican por `restaurarOrden`/`restaurarSeccionesHome` —que YA ponen
  // la bandera de supresión (§ sus docstrings), así que el efecto de lote de cada uno NO empuja un
  // paso duplicado—, y registran UN SOLO paso de historial combinado a mano. `recargarIframe()`
  // SIEMPRE corre al final: `Home` es un Server Component (§ `app/(storefront)/page.tsx`, fuera de
  // `touches:`) y el puente en vivo sólo REORDENA nodos `data-editor-seccion` que YA EXISTEN
  // (§ `EditorPuenteVivo.tsx`, el branch `seccion === 'orden'`) — nunca los crea ni los destruye, así
  // que una sección que nace, se clona o se borra necesita el reload para que el DOM del iframe la
  // refleje. El deshacer/rehacer de estas tres TAMBIÉN recarga, por la misma razón en cualquier
  // dirección.
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  // El id DESPUÉS del cual insertar — `null` significa "al final" (el botón de pie de lista).
  const [posicionInsercion, setPosicionInsercion] = useState<string | null>(null);
  const [tipoInsertando, setTipoInsertando] = useState<SeccionInstanciaTipo | null>(null);
  // El id a punto de borrarse — dueño del `ConfirmDeleteDialog` (§ render, abajo); `null` = cerrado.
  const [instanciaAEliminar, setInstanciaAEliminar] = useState<string | null>(null);
  // § CLAUDE.md "Doble-submit — la mitad SÍNCRONA": `tipoInsertando` (estado) por sí solo NO cierra
  // la re-entrada del MISMO tick — dos clicks seguidos sobre la misma tarjeta, o un "Duplicar"/
  // "Eliminar" disparado dos veces antes de que React re-renderice, leerían ambos el ref en `false`
  // si sólo hubiera estado. Un ref compartido por las TRES mutaciones compuestas (agregar/duplicar/
  // eliminar) es correcto porque son mutuamente exclusivas: las tres escriben la MISMA fila
  // (`aplicarMutacionCompuesta`), así que sólo puede haber UNA en vuelo a la vez, sea cual sea.
  const mutacionCompuestaEnVueloRef = useRef(false);

  const abrirBiblioteca = useCallback((despuesDe: string | null) => {
    setPosicionInsercion(despuesDe);
    setBibliotecaAbierta(true);
  }, []);

  const totalInstancias = seccionesHomeLocal ? Object.keys(seccionesHomeLocal).length : 0;
  const alTopeDeInstancias = totalInstancias >= TOPE_INSTANCIAS_HOME;

  // UN SOLO PUT con las DOS claves — NUNCA dos autoguardados independientes disparando su propio
  // `.flush()` al mismo tiempo. MEDIDO con el arnés de este slice (`.scratch/verificar-agregar-
  // seccion.ts`, no comiteado): `restaurarOrden(nuevoOrden)` seguido de
  // `restaurarSeccionesHome(nuevoMapa)` dispara DOS PUT en paralelo sobre la MISMA fila de
  // `SiteContent` —cada uno hace su propio `findUnique` → fusiona → `update` (§ `guardarBorrador`,
  // `site-content-write.ts`, fuera de `touches:`)— y el que COMMITEA SEGUNDO lee el estado de
  // ANTES del primero y lo PISA: la instancia nueva (o la posición nueva) se perdía en silencio.
  // Es la MISMA familia que CLAUDE.md ya documenta para otro par de escrituras ("SIN lock
  // cross-operación… la que commitea segundo pisa completo") — acá el código de ESTE slice era
  // quien creaba la carrera, no un race humano. La solución es la misma que ya usa
  // `publicarVariasSecciones`: una escritura, no dos.
  const guardarOrdenYSeccionesHome = useCallback(async (orden: string[], mapa: Record<string, InstanciaContent>) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden, seccionesHome: mapa }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);

  /** Aplica (optimista) y persiste (UN solo PUT, arriba) un cambio que toca `orden` Y
   *  `seccionesHome` A LA VEZ — agregar/duplicar/eliminar una sección. Revierte el estado LOCAL
   *  si el PUT falla, con un toast (mismo vehículo que `EditorTiendaPantallaCompleta.tsx` ya usa
   *  para Publicar/Descartar, el otro par de acciones de alto nivel de esta pantalla). No pasa por
   *  los dos `useAutoguardado` de 'orden'/'seccionesHome' (§ el docstring de arriba) — por eso NO
   *  hace falta la bandera de supresión `aplicandoHistorial*Ref` acá: esos efectos sólo reaccionan
   *  a SUS PROPIOS hooks, que esta función nunca toca. */
  const aplicarMutacionCompuesta = useCallback(async (
    nuevoOrden: string[], ordenAntes: string[],
    nuevoMapa: Record<string, InstanciaContent>, mapaAntes: Record<string, InstanciaContent>,
  ): Promise<boolean> => {
    setOrdenLocal(nuevoOrden);
    setHayBorradorOrden(true);
    setSeccionesHomeLocal(nuevoMapa);
    setHayBorradorSeccionesHome(true);
    enviarOrdenIframe(nuevoOrden);
    try {
      await guardarOrdenYSeccionesHome(nuevoOrden, nuevoMapa);
      return true;
    } catch {
      // Revierte el dato — "hayBorrador" se deja en `true`: no sabemos sin un refetch si el
      // valor de ANTES todavía difiere de lo publicado, y sobre-reportar "sin publicar" es el
      // lado seguro (un Publicar/Descartar de más sobre contenido que ya coincide es un no-op,
      // § `publicarSeccion`/`descartarSeccion`: "sin borrador para esa sección no hace nada").
      setOrdenLocal(ordenAntes);
      setSeccionesHomeLocal(mapaAntes);
      toast.error('No se pudo guardar. Intenta de nuevo.');
      return false;
    }
  }, [enviarOrdenIframe, guardarOrdenYSeccionesHome]);

  const agregarSeccion = useCallback(async (tipo: SeccionInstanciaTipo) => {
    if (mutacionCompuestaEnVueloRef.current || !ordenLocal || !seccionesHomeLocal || tipoInsertando || alTopeDeInstancias) return;
    mutacionCompuestaEnVueloRef.current = true;
    setTipoInsertando(tipo);
    try {
      const id = nuevoIdInstancia(Object.keys(seccionesHomeLocal));
      const instancia = crearInstancia(tipo);
      const mapaAntes = seccionesHomeLocal;
      const nuevoMapa = { ...mapaAntes, [id]: instancia };
      const ordenAntes = ordenLocal;
      // `posicionInsercion` es el id DESPUÉS del cual insertar; `null` → al final de la lista.
      const idxDespues = posicionInsercion ? ordenAntes.indexOf(posicionInsercion) : ordenAntes.length - 1;
      const nuevoOrden = ordenAntes.slice();
      nuevoOrden.splice(idxDespues + 1, 0, id);

      const ok = await aplicarMutacionCompuesta(nuevoOrden, ordenAntes, nuevoMapa, mapaAntes);
      if (!ok) return;

      historialRef.current?.registrar({
        deshacer: () => { aplicarMutacionCompuesta(ordenAntes, nuevoOrden, mapaAntes, nuevoMapa).then(() => recargarIframe()); },
        rehacer: () => { aplicarMutacionCompuesta(nuevoOrden, ordenAntes, nuevoMapa, mapaAntes).then(() => recargarIframe()); },
      });
      tocarHistorial();

      setBibliotecaAbierta(false);
      recargarIframe();
      abrirNivelInstancia(id);
    } finally {
      mutacionCompuestaEnVueloRef.current = false;
      setTipoInsertando(null);
    }
  }, [
    ordenLocal, seccionesHomeLocal, tipoInsertando, alTopeDeInstancias, posicionInsercion,
    aplicarMutacionCompuesta, recargarIframe, abrirNivelInstancia, tocarHistorial,
  ]);

  const duplicarInstancia = useCallback(async (id: string) => {
    if (mutacionCompuestaEnVueloRef.current || !ordenLocal || !seccionesHomeLocal) return;
    const origen = seccionesHomeLocal[id];
    if (!origen) return;
    mutacionCompuestaEnVueloRef.current = true;
    try {
      const nuevoId = nuevoIdInstancia(Object.keys(seccionesHomeLocal));
      const mapaAntes = seccionesHomeLocal;
      const nuevoMapa = { ...mapaAntes, [nuevoId]: { ...origen } };
      const ordenAntes = ordenLocal;
      const idx = ordenAntes.indexOf(id);
      const nuevoOrden = ordenAntes.slice();
      // "justo debajo" (§ el spec) — en la posición inmediatamente siguiente a la original, sin
      // importar si `idx` es -1 (id ya no en orden: `splice(0, …)` la pondría primera, caso que no
      // debería ocurrir porque toda instancia del mapa tiene su id en `orden`).
      nuevoOrden.splice(idx + 1, 0, nuevoId);

      const ok = await aplicarMutacionCompuesta(nuevoOrden, ordenAntes, nuevoMapa, mapaAntes);
      if (!ok) return;

      historialRef.current?.registrar({
        deshacer: () => { aplicarMutacionCompuesta(ordenAntes, nuevoOrden, mapaAntes, nuevoMapa).then(() => recargarIframe()); },
        rehacer: () => { aplicarMutacionCompuesta(nuevoOrden, ordenAntes, nuevoMapa, mapaAntes).then(() => recargarIframe()); },
      });
      tocarHistorial();
      recargarIframe();
    } finally {
      mutacionCompuestaEnVueloRef.current = false;
    }
  }, [ordenLocal, seccionesHomeLocal, aplicarMutacionCompuesta, recargarIframe, tocarHistorial]);

  const eliminarInstancia = useCallback(async (id: string) => {
    if (mutacionCompuestaEnVueloRef.current || !ordenLocal || !seccionesHomeLocal) return;
    mutacionCompuestaEnVueloRef.current = true;
    try {
      const mapaAntes = seccionesHomeLocal;
      const nuevoMapa = { ...mapaAntes };
      delete nuevoMapa[id];
      const ordenAntes = ordenLocal;
      const nuevoOrden = ordenAntes.filter((x) => x !== id);

      const ok = await aplicarMutacionCompuesta(nuevoOrden, ordenAntes, nuevoMapa, mapaAntes);
      if (!ok) return;

      historialRef.current?.registrar({
        deshacer: () => { aplicarMutacionCompuesta(ordenAntes, nuevoOrden, mapaAntes, nuevoMapa).then(() => recargarIframe()); },
        rehacer: () => { aplicarMutacionCompuesta(nuevoOrden, ordenAntes, nuevoMapa, mapaAntes).then(() => recargarIframe()); },
      });
      tocarHistorial();
      setInstanciaActiva((actual) => (actual === id ? null : actual));
      recargarIframe();
    } finally {
      mutacionCompuestaEnVueloRef.current = false;
    }
  }, [ordenLocal, seccionesHomeLocal, aplicarMutacionCompuesta, recargarIframe, tocarHistorial]);

  // Las `SeccionConfig` de la página activa, en el orden elegido, MEZCLADAS con las instancias de
  // `seccionesHomeLocal` (§ `ordenarSeccionesConInstancias`, que GENERALIZA a `ordenarPorBanda` —
  // ésta se queda intacta para quien no mezcla instancias, § su propio docstring) — SÓLO home tiene
  // `ordenLocal`; las demás páginas quedan en el orden fijo del registro, envuelto en la MISMA forma
  // `ItemOrdenMixto` para que el `.map` de abajo no tenga dos casos que distinguir.
  const seccionesOrdenadas: ItemOrdenMixto<SeccionConfig>[] = ordenLocal
    ? ordenarSeccionesConInstancias(secciones, Object.keys(seccionesHomeLocal ?? {}), ordenLocal)
    : secciones.map((config) => ({ tipo: 'banda' as const, config }));
  const puedePublicarOrden = autoOrden.estado === 'guardado' && !procesandoOrden;

  // § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — el valor que cada `TiendaSeccionEditor` recibe para pintar
  // SUS campos cruzados (§ `valoresCruzadosEnVivo`, arriba): lo EN VIVO si ya llegó, si no el `doc`
  // crudo (el mismo piso que usaría la sección REAL para sembrar su propio `form`). Se pasa a TODAS
  // las secciones por igual —barato, y sólo las que declaran `seccionCruzada` lo leen.
  const valoresCruzados: Partial<Record<SeccionVista, Record<string, unknown>>> = {};
  for (const s of SECCIONES_CON_CAMPOS_CRUZADOS) {
    valoresCruzados[s] = valoresCruzadosEnVivo[s] ?? (doc ? (doc.contenido[s] as Record<string, unknown> | undefined) : undefined);
  }

  // § EDITOR-TIENDA-SHELL-1 — marcador→título, para el RÓTULO de hover del lienzo
  // (`VistaTiendaIframe.tsx`): ese componente no tiene `SECCIONES_TIENDA` (§ su docstring), así que
  // este componente —que sí lo tiene— le baja el mapa. De `secciones` (la página ACTIVA), no de todo
  // el registro: un marcador de otra página no debería rotular nada en ESTE iframe.
  const tituloPorMarcador: Record<string, string> = {};
  for (const c of secciones) tituloPorMarcador[marcadorDeSeccion(c.seccion)] = c.titulo;

  // § EDITOR-TIENDA-DESHACER-1 — "Publicar"/"Descartar" DE LA BARRA actúan sobre TODAS las secciones
  // con borrador de la página activa + 'orden' (home) + 'tema' (store-wide) de una vez. `tema` SE
  // RE-SINCRONIZA REMONTANDO `PaletaSeccion` (§ `temaReloadKey`, abajo) en vez de leer/escribir su
  // estado interno — ese componente no está en `touches:` de este slice, así que no hay forma de
  // decirle "tu borrador se publicó" salvo forzar el mismo `useEffect` de carga que ya corre al
  // montar (cambiar su `key` lo remonta, y remontado vuelve a pedir `/api/site-content` por su
  // cuenta — mismo patrón que el `key={pagina}` de `VistaTiendaIframe`).
  const [temaReloadKey, setTemaReloadKey] = useState(0);

  // Al ENTRAR a la pestaña Tema, un refetch de `doc` pone `sinPublicar.tema` razonablemente al día
  // (HUECO CONOCIDO, declarado: mientras se EDITA dentro de esa pestaña, `doc.sinPublicar.tema` no
  // sigue en vivo los guardados propios de `PaletaSeccion` —ese componente no reporta su estado
  // acá, fuera de `touches:`—, así que la píldora puede quedar un paso atrás hasta la próxima vez
  // que `doc` se refresque. No bloquea nada: el Publicar/Descartar en lote sigue funcionando sobre
  // el último valor conocido).
  useEffect(() => { if (modo === 'tema') recargarDoc().catch(() => {}); }, [modo, recargarDoc]);

  // La lista de claves con borrador AHORA MISMO: las secciones de la página activa (del Map que
  // cada editor reporta en vivo, § `manejarEstadoSeccion`) + 'orden' + 'tema'. NO memoizada — se
  // recalcula en cada llamada con el estado más fresco, igual que el resto de los helpers de este
  // archivo que leen refs/estado sin pasar por `useCallback`.
  const listaPendientes = (): string[] => {
    const secs: string[] = [];
    for (const c of secciones) if (seccionesEstado.get(c.seccion)?.hayBorrador) secs.push(c.seccion);
    if (ordenLocal && hayBorradorOrden) secs.push('orden');
    // § EDITOR-AGREGAR-SECCION-1 — 'seccionesHome' EN VIVO (`hayBorradorSeccionesHome`, como 'orden'
    // arriba), no desde `doc.sinPublicar` — este componente es dueño del mapa local y lo sabe sin
    // esperar un refetch.
    if (hayBorradorSeccionesHome) secs.push('seccionesHome');
    if (doc?.sinPublicar.tema) secs.push('tema');
    // § EDITOR-TIENDA-CROMO-1 — a diferencia de 'tema' (que depende del refetch de `doc`, § el
    // HUECO CONOCIDO de arriba), el ENCABEZADO/MENÚ/PIE SÍ reportan en vivo (`cromoEstado`, §
    // `manejarEstadoCromo`) — son editores nuevos de este slice, así que el agregado puede ser
    // exacto en vez de depender del último refetch.
    if (cromoEstado.get('encabezado')?.hayBorrador) secs.push('encabezado');
    if (cromoEstado.get('menu')?.hayBorrador) secs.push('menu');
    if (cromoEstado.get('footer')?.hayBorrador) secs.push('footer');
    return secs;
  };

  // § EDITOR-TIENDA-CROMO-1 — 'encabezado' NO es 'orden'/'tema'/una clave del REGISTRY: el
  // endpoint GENÉRICO de lote (`app/api/site-content/route.ts`, fuera de `touches:`) valida
  // `secciones.every(s => s === 'orden' || s === 'tema' || s in REGISTRY)` y RECHAZARÍA el lote
  // entero si 'encabezado' viajara ahí (medido leyendo ese archivo antes de escribir esto — nunca
  // asumido). Por eso el Encabezado se publica/descarta por SU PROPIA ruta
  // (`/api/site-content/encabezado`, la MISMA que ya usa `EncabezadoSeccion.accionBorrador`),
  // en paralelo con el lote genérico que sigue llevando 'orden'/'tema'/'menu'/'footer'/páginas
  // ('menu'/'footer' SÍ son claves del REGISTRY, así que el lote las acepta sin cambio).
  const publicarEncabezado = () => fetch('/api/site-content/encabezado', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'publicar' }),
  });
  const descartarEncabezado = () => fetch('/api/site-content/encabezado', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'descartar' }),
  });

  const publicarPendientes = async () => {
    const secs = listaPendientes();
    if (secs.length === 0) return;
    // § EDITOR-TIENDA-CROMO-1 — SECUENCIAL, nunca `Promise.all`: el lote genérico y la ruta
    // propia del Encabezado son DOS TRANSACCIONES INDEPENDIENTES sobre la MISMA fila de
    // `SiteContent` (cada una hace su propio `findUnique` → computa `nuevoContent`/
    // `nuevoBorrador` → `update`), sin lock cross-operación (§ CLAUDE.md, "SIN lock
    // cross-operación" — ya documentado para el race humano guardar↔publicar, pero ACÁ el
    // riesgo lo crea este mismo código al disparar dos escrituras a la vez). En paralelo, la que
    // COMMITEA SEGUNDO lee el estado de ANTES de la primera y la PISA completa — medido: el
    // arnés de este slice vio `menu`/`footer` publicados-y-luego-revertidos por la escritura de
    // `encabezado` corriendo en paralelo. Secuencial cuesta una ida y vuelta más de red (rara vez
    // más de una docena de ms en este despliegue), nunca una carrera.
    const generico = secs.filter((s) => s !== 'encabezado');
    if (generico.length > 0) {
      const r = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'publicarVarias', secciones: generico }),
      });
      if (!r.ok) throw new Error('No se pudo publicar.');
    }
    if (secs.includes('encabezado')) {
      const r = await publicarEncabezado();
      if (!r.ok) throw new Error('No se pudo publicar.');
    }
    for (const s of secs) {
      if (s === 'orden') { setHayBorradorOrden(false); continue; }
      if (s === 'seccionesHome') { setHayBorradorSeccionesHome(false); continue; }
      if (s === 'tema') { setTemaReloadKey((k) => k + 1); continue; }
      if (esCromoKey(s)) { cromoRefs.current.get(s)?.marcarPublicado(); continue; }
      seccionRefs.current.get(s as SeccionVista)?.marcarPublicado();
    }
    recargarIframe();
  };

  const descartarPendientes = async () => {
    const secs = listaPendientes();
    if (secs.length === 0) return;
    // SECUENCIAL, nunca `Promise.all` — mismo motivo que `publicarPendientes`, arriba: dos
    // transacciones independientes sobre la MISMA fila de `SiteContent` en paralelo pueden
    // pisarse (medido, § el comentario grande de `publicarPendientes`).
    const generico = secs.filter((s) => s !== 'encabezado');
    if (generico.length > 0) {
      const r = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'descartarVarias', secciones: generico }),
      });
      if (!r.ok) throw new Error('No se pudo descartar.');
    }
    if (secs.includes('encabezado')) {
      const r = await descartarEncabezado();
      if (!r.ok) throw new Error('No se pudo descartar.');
    }
    // UN SOLO refetch para TODAS las secciones descartadas (nunca N) — mismo mecanismo que
    // `publicarOrDescartarOrden('descartar')` ya usa para 'orden'.
    const fresco = await recargarDoc();
    for (const s of secs) {
      if (s === 'orden') {
        const idsInstancia = Object.keys((fresco.contenido?.seccionesHome as Record<string, unknown> | undefined) ?? {});
        setOrdenLocal(resolverOrdenCompleto(fresco.contenido?.orden, BANDA_IDS, idsInstancia));
        setHayBorradorOrden(false);
        continue;
      }
      if (s === 'seccionesHome') {
        setSeccionesHomeLocal((fresco.contenido?.seccionesHome ?? {}) as Record<string, InstanciaContent>);
        setHayBorradorSeccionesHome(false);
        continue;
      }
      if (s === 'tema') { setTemaReloadKey((k) => k + 1); continue; }
      if (s === 'encabezado') {
        cromoRefs.current.get('encabezado')?.restaurarDesdePublicado({
          cromo: fresco.contenido?.cromo, navWordmark: fresco.contenido?.navWordmark,
          navTratamiento: fresco.contenido?.navTratamiento, navDrawerMovil: fresco.contenido?.navDrawerMovil,
          logo: fresco.contenido?.logo,
        } as Record<string, unknown>);
        continue;
      }
      if (esCromoKey(s)) { cromoRefs.current.get(s)?.restaurarDesdePublicado((fresco.contenido?.[s] ?? {}) as Record<string, unknown>); continue; }
      seccionRefs.current.get(s as SeccionVista)?.restaurarDesdePublicado((fresco.contenido?.[s] ?? {}) as Record<string, unknown>);
    }
    recargarIframe();
  };

  // § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 — ver el docstring de `TiendaPaginasHandle.resumenPendientes`.
  // Dos fetches EN PARALELO: el borrador FRESCO (un refetch de `/api/site-content`, para no comparar
  // contra el `doc` que puede llevar un rato sin refrescarse — § el HUECO CONOCIDO de `doc.sinPublicar.
  // tema`, arriba) y lo PUBLICADO (`/api/site-content/publicado`, el MISMO lector que ya usa
  // `publicarOrDescartarOrden` para la píldora de 'orden'). `ordenLocal` —el array EN VIVO de esta
  // página, que puede ir un paso adelante del `doc` recién releído si el dueño soltó un drag hace un
  // instante— pisa al `orden` del refetch para esa clave puntual.
  const resumenPendientes = async (): Promise<CambioResumen[]> => {
    const secs = listaPendientes();
    if (secs.length === 0) return [];
    const [fresco, rPublicado] = await Promise.all([recargarDoc(), fetch('/api/site-content/publicado')]);
    if (!rPublicado.ok) throw new Error('No se pudo cargar lo publicado.');
    const publicado = (await rPublicado.json()) as Record<string, unknown>;
    const borrador: Record<string, unknown> = { ...(fresco.contenido ?? {}) };
    if (ordenLocal) borrador.orden = ordenLocal;
    // § EDITOR-AGREGAR-SECCION-1 — MISMO criterio que `orden`: `seccionesHomeLocal` puede ir un paso
    // adelante del refetch si el dueño acaba de agregar/editar/duplicar/eliminar una sección.
    if (seccionesHomeLocal) borrador.seccionesHome = seccionesHomeLocal;
    return resumenCambios(secs, borrador, publicado);
  };

  // § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 — ver el docstring de `TiendaPaginasHandle.irAItem`.
  // § EDITOR-TIENDA-CROMO-1 — 'encabezado'/'menu'/'footer' abren su nivel de cromo, como
  // cualquier otro ítem del resumen (aunque `resumenCambios`, fuera de `touches:`, no produzca
  // filas EN PALABRAS para ellos todavía — § el open follow-up en DECISIONS.md — este camino
  // sigue sirviendo al deep-link del aviso de configuración y a un resumen futuro que sí los liste).
  const irAItem = useCallback((clave: string) => {
    if (clave === 'orden') { setSeccionActiva(null); return; }
    if (clave === 'tema') return; // el padre cambia de `modo`; este componente no tiene nada que hacer
    // `cromoRefs.get(clave)?.abrir()`, no `abrirNivelCromo(clave)` directo — mismo motivo que
    // `manejarSeleccionDesdeIframe`, arriba: el handle es quien pone `editando=true` adentro, lo
    // que dispara `onAbrir` y recién ahí mueve `cromoActivo`.
    if (esCromoKey(clave)) { cromoRefs.current.get(clave)?.abrir(); return; }
    // § EDITOR-AGREGAR-SECCION-1 — una FILA del resumen de una sección agregada manda el ID DE LA
    // INSTANCIA (nunca 'seccionesHome', § el docstring de `CambioResumen.clave`,
    // lib/admin/resumen-cambios.ts) — abre directo, sin ref/handle que llamar.
    if (esInstanciaId(clave)) {
      if (seccionesHomeLocalRef.current && clave in seccionesHomeLocalRef.current) abrirNivelInstancia(clave);
      return;
    }
    const candidato = clave as SeccionVista;
    if (!secciones.some((c) => c.seccion === candidato)) return;
    abrirNivelSeccion(candidato);
  }, [secciones, abrirNivelSeccion, abrirNivelInstancia]);

  // DESHACER/REHACER reenviado DESDE EL IFRAME (§ EditorPuenteVivo.tsx, el comentario grande de la
  // deviación sobre `touches:`): el iframe YA decidió que el foco no estaba en un campo editable —
  // acá no hay nada más que verificar, sólo aplicar.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!esMensajeDeshacer(e.data)) return;
      if (e.data.rehacer) rehacerGlobal(); else deshacerGlobal();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [deshacerGlobal, rehacerGlobal]);

  // EL AGREGADO, hacia el padre (§ el docstring de `onEstadoGlobal`). Corre en CADA render (porque
  // `secciones` no está memoizado, § el resto del archivo), pero sólo llama a `onEstadoGlobal` si
  // el valor CALCULADO cambió de verdad (`ultimoEstadoGlobalRef`) — sin ese filtro, un padre que
  // guarda esto en estado re-renderizaría, este componente volvería a renderizar, y el efecto
  // correría otra vez con el MISMO resultado: un bucle que nunca converge porque nunca compara.
  const ultimoEstadoGlobalRef = useRef<EstadoGlobalEditor | null>(null);
  useEffect(() => {
    const pendientesSecciones = secciones.filter((c) => seccionesEstado.get(c.seccion)?.hayBorrador).length;
    // § EDITOR-TIENDA-CROMO-1 — las TRES claves de cromo, contadas con el MISMO criterio que
    // `listaPendientes()` (en vivo, vía `cromoEstado` — nunca `doc.sinPublicar`, que acá sería el
    // HUECO CONOCIDO que 'tema' sí tiene por estar fuera de `touches:`).
    const pendientesCromo = (['encabezado', 'menu', 'footer'] as const)
      .filter((k) => cromoEstado.get(k)?.hayBorrador).length;
    const pendientes = pendientesSecciones + pendientesCromo + (ordenLocal && hayBorradorOrden ? 1 : 0)
      + (hayBorradorSeccionesHome ? 1 : 0) + (doc?.sinPublicar.tema ? 1 : 0);
    const estadosSecciones = secciones.map((c) => seccionesEstado.get(c.seccion)?.estado ?? 'guardado');
    const estadosCromo = (['encabezado', 'menu', 'footer'] as const).map((k) => cromoEstado.get(k)?.estado ?? 'guardado');
    const todosLosEstados: EstadoAutoguardado[] = [...estadosSecciones, ...estadosCromo, autoOrden.estado, autoSeccionesHome.estado];
    const estado: EstadoAutoguardado = todosLosEstados.includes('guardando') ? 'guardando'
      : todosLosEstados.includes('error') ? 'error' : 'guardado';
    const nuevo: EstadoGlobalEditor = {
      estado, pendientes,
      puedeDeshacer: historialRef.current?.puedeDeshacer() ?? false,
      puedeRehacer: historialRef.current?.puedeRehacer() ?? false,
    };
    const anterior = ultimoEstadoGlobalRef.current;
    if (anterior && anterior.estado === nuevo.estado && anterior.pendientes === nuevo.pendientes
        && anterior.puedeDeshacer === nuevo.puedeDeshacer && anterior.puedeRehacer === nuevo.puedeRehacer) return;
    ultimoEstadoGlobalRef.current = nuevo;
    onEstadoGlobal?.(nuevo);
  }, [secciones, seccionesEstado, cromoEstado, ordenLocal, hayBorradorOrden, hayBorradorSeccionesHome, doc, autoOrden.estado, autoSeccionesHome.estado, historialVersion, onEstadoGlobal]);

  // § EDITOR-TIENDA-DESHACER-1 — el handle que `EditorTiendaPantallaCompleta` usa para los atajos de
  // teclado y los botones de la barra. NO memoizado (como `escribirCampo`/`abrirSelectorImagen` de
  // `TiendaSeccionEditor.tsx`): se recompone en cada render y siempre expone la versión fresca.
  useImperativeHandle(ref, () => ({
    deshacer: deshacerGlobal,
    rehacer: rehacerGlobal,
    publicarPendientes,
    descartarPendientes,
    resumenPendientes,
    irAItem,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* § EDITOR-TIENDA-SHELL-1 — LAS MIGAS: sólo existen cuando hay un nivel de arriba al que
          volver, así que sólo se montan con algo activo (nunca en Inicio). Las dos secciones de
          abajo (el toggle/nota de página, la barra de orden) son del nivel «Inicio» — decisiones de
          LISTA, no de una sección puntual— y se ocultan al bajar de nivel por la misma razón que
          `orden`/`ojo` sólo viven en la tarjeta colapsada (§ TiendaSeccionEditor.tsx).
          § EDITOR-TIENDA-CROMO-1 — `nivelActivo` unifica `seccionActiva`/`cromoActivo`: migas e
          «Inicio» no les importa CUÁL de los dos tipos de nivel está abierto, sólo que ALGO lo
          esté.
          § EDITOR-AYUDA-1 — el «?» de esta miga cubre TODA sección de contenido (hero incluido) y
          los tres de cromo, de UNA sola vez: `temaDeNivel` resuelve el nivel ACTIVO a su guía
          (hero→'hero', encabezado/menu/footer→'cromo', cualquier otra sección→'secciones'
          genérica). Una sección AGREGADA (`instanciaActiva`, un id dinámico) cae en la genérica por
          el mismo mecanismo — `temaDeNivel` nunca lanza sobre un nivel que no reconoce.
          § EDITOR-VISUAL-NIVELES-AJUSTE-1 — `&& !hayElementoActivo`: con el nivel de ELEMENTO del
          hero abierto, `TiendaSeccionEditor` ya dibuja su PROPIA miga local «‹ Hero» (§ su
          docstring); esta miga global se CALLA en vez de sumarse — "una sola miga que nombra el
          nivel de arriba", nunca las dos a la vez. */}
      {/* § EDITOR-PANEL-PIEL-1 — estas tres piezas (migas, toggle de página, barra de orden) siguen
          viviendo ARRIBA de la grilla panel|lienzo, full-width del cuerpo — ESO no cambió. Lo que
          cambió es que ya no heredan el padding de un envoltorio externo (§ `EditorTiendaPantallaCompleta.
          tsx`, retirado): `.editor-cuerpo-chrome` les da el mismo respiro horizontal de siempre, sin
          que la grilla de abajo (panel|lienzo, que SÍ debe quedar pegada al riel) lo herede también. */}
      <div className="editor-cuerpo-chrome">
      {modo === 'paginas' && nivelActivo && !hayElementoActivo && (
        <Migas
          nivelAnterior="Inicio"
          actual={seccionActiva ? (secciones.find(c => c.seccion === seccionActiva)?.titulo ?? seccionActiva) : CROMO_TITULOS[cromoActivo as CromoKey]}
          onVolver={volverAInicio}
          onAyuda={() => abrirAyuda(temaDeNivel(nivelActivo))}
        />
      )}

      {/* El toggle de encender/apagar y la nota de la página apagable (Nosotros · Suscripciones) — el
          selector de PÁGINA en sí ya no vive acá, subió a la barra superior del editor de pantalla
          completa (§ EDITOR-TIENDA-DISPOSITIVOS-1, `EditorTiendaPantallaCompleta`). SÓLO en modo
          'paginas' (§ EDITOR-TIENDA-TEMA-1) Y en el nivel «Inicio» (§ EDITOR-TIENDA-SHELL-1): son
          cosas de LA PÁGINA, no del tema store-wide ni de una sección puntual. */}
      {modo === 'paginas' && !nivelActivo && (paginaMeta.apagable || paginaMeta.nota) && (
        <div style={{ flexShrink: 0, marginBottom: 'var(--duna-space-5)' }}>
          {paginaMeta.apagable && <TogglePagina pagina={pagina} label={paginaMeta.label} />}
          {paginaMeta.nota && (
            <p className="duna-sub" style={{ marginTop: 'var(--duna-space-3)', maxWidth: '42rem' }}>{paginaMeta.nota}</p>
          )}
        </div>
      )}

      {/* § EDITOR-TIENDA-ORDEN-1 — el orden de las bandas se publica/descarta COMO SECCIÓN, pero no
          es una tarjeta de la lista: no hay un bloque único donde mostrar este estado, así que vive
          en su propia barra, arriba de la lista. Mismo vocabulario que cada tarjeta (duna-badge/
          duna-btn) para que no se lea como un control distinto. SÓLO en modo 'paginas' (§ EDITOR-
          TIENDA-TEMA-1) y en el nivel «Inicio» (§ EDITOR-TIENDA-SHELL-1): el orden es de LA PÁGINA
          home, no del tema ni de una sección puntual. */}
      {modo === 'paginas' && !nivelActivo && hayBorradorOrden && (
        <div style={{
          flexShrink: 0, marginBottom: 'var(--duna-space-4)', display: 'flex', alignItems: 'center',
          flexWrap: 'wrap', gap: 'var(--duna-space-3)', padding: 'var(--duna-space-3) var(--duna-space-4)',
          border: '1px solid var(--duna-border)', borderRadius: 'var(--duna-r-l)', background: 'var(--duna-surface)',
        }}>
          <span className="duna-badge duna-badge--attention">Sin publicar</span>
          <span className="duna-sub" style={{ flex: 1, minWidth: '12rem' }}>El orden de las secciones cambió.</span>
          {errorOrden && <span className="duna-field__error" role="alert">{errorOrden}</span>}
          <div style={{ display: 'flex', gap: 'var(--duna-space-2)' }}>
            <button type="button" onClick={() => publicarOrDescartarOrden('descartar')} className="duna-btn duna-btn--ghost" disabled={!puedePublicarOrden}>
              Descartar
            </button>
            <button type="button" onClick={() => publicarOrDescartarOrden('publicar')} className="duna-btn duna-btn--primary" disabled={!puedePublicarOrden}>
              {procesandoOrden ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
      </div>

      {/* LA COMPOSICIÓN (§ EDITOR-TIENDA-IFRAME-VISTA-1): la lista de secciones a un costado, la
          página REAL al centro — nunca secciones aisladas (decisión del owner). Columnas lado a lado
          ≥960; apiladas (iframe arriba, lista abajo) por debajo, donde no hay ancho para las dos.
          SIN sticky/document-scroll (§ EDITOR-TIENDA-DISPOSITIVOS-1): el editor de pantalla completa
          ya no es una página de scroll de documento — es su PROPIA región de alto fijo (la barra
          superior + este cuerpo llenan el viewport), así que la lista scrollea DENTRO de su columna
          y el iframe toma el alto DISPONIBLE completo, sin calcular contra `--duna-topbar-h` (que acá
          no existe: no hay topbar del panel). */}
      <div style={{
        display: angosto ? 'flex' : 'grid',
        flexDirection: angosto ? 'column' : undefined,
        // EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3, la anatomía: "Panel (308 px)") — el panel pasa de
        // 1fr elástico a un ancho FIJO; el lienzo toma todo lo que sobra. § EDITOR-PANEL-ANCHO-1 — el
        // fijo ya NO es el literal `308px`: es `anchoPanel`, la preferencia del dueño recortada en
        // vivo contra la ventana actual (arriba). Sin manija (angosto), el panel sigue sin columna
        // fija — apila, como siempre.
        gridTemplateColumns: angosto ? undefined : `${anchoPanel}px minmax(0, 1fr)`,
        // § EDITOR-PANEL-PIEL-1 — SIN gap: el panel y el lienzo quedan PEGADOS, como el riel y el
        // panel (arriba). El panel ya trae su propio `border-right` (editor.css) para separarse del
        // lienzo — un gap acá dejaría crema entre los dos otra vez, la misma costura que se cerró
        // entre riel y panel. § EDITOR-PANEL-ANCHO-1 — `position: relative`: ancla la manija
        // (`.editor-panel-manija`, `position: absolute`) al borde panel|lienzo sin reservarle una
        // columna propia, que reintroduciría el gap que esta misma nota acaba de descartar.
        gap: 0,
        flex: '1 1 auto',
        minHeight: 0,
        position: 'relative',
      }}>
        {/* § EDITOR-VISUAL-NIVELES-1 — `.editor-panel` scopea el angostamiento de `.duna-form` a UNA
            columna (editor.css): la primitiva compartida se queda en dos columnas para sus otros
            consumidores (drawers con ancho de sobra); acá, a 308px (su ancho de NACIMIENTO — hoy
            ajustable, § EDITOR-PANEL-ANCHO-1), dos columnas cortan el texto.
            § EDITOR-VISUAL-NIVELES-AJUSTE-1 — `gridTemplateColumns: 'minmax(0, 1fr)'` es la causa
            RAÍZ del desborde del nivel Hero (medido: `panel.scrollWidth` 803 contra `clientWidth`
            308 — las cajas se cortaban por la derecha, § CLAUDE.md "la causa"). Sin columna
            explícita, el grid de una sola pista implícita usa `grid-auto-columns: auto`, que NO
            trae el mínimo-cero de CSS Grid — un descendiente con contenido ancho (acá, el
            segmentado de Alto/Oscurecer, § editor.css) empuja la pista más allá de los 308px fijos
            del padre en vez de encogerse. `minWidth: 0` en ESTE div protege al PADRE (ya estaba);
            esto protege a los HIJOS, que es lo que faltaba. */}
        {/* § EDITOR-AYUDA-RECORRIDO-1 — `data-tour="panel"`: el objetivo del paso «El panel» del
            recorrido guiado. Siempre presente, sea cual sea `modo` (Secciones/Estilo/Ayuda) — este
            div es uno de los DOS hijos fijos de la grilla de arriba, nunca condicional. */}
        <div className="editor-panel" data-tour="panel" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'var(--duna-space-4)',
          minWidth: 0,
          order: angosto ? 2 : 1,
          overflowY: 'auto',
          alignContent: 'start',
          ...(angosto ? { flex: '1 1 auto', minHeight: 0 } : { height: '100%' }),
        }}>
          {/* § EDITOR-VISUAL-PANEL-1 — EL TÍTULO «Inicio» (el spec: "título «Inicio» y una línea
              «Toca cualquier cosa en la vista para editarla, o elígela aquí»"). SÓLO en modo
              'paginas' (§ EDITOR-TIENDA-TEMA-1) Y en el nivel «Inicio» (§ EDITOR-TIENDA-SHELL-1) —
              con una sección/el cromo abiertos, el título de ESA sección ya lo pinta su propio
              editor (`duna-title`, § TiendaSeccionEditor.tsx/EncabezadoSeccion.tsx…), y repetirlo acá
              sería la misma redundancia que la `Migas` restyleada ya evita (§ su docstring). */}
          {modo === 'paginas' && !nivelActivo && (
            <div style={{ marginBottom: 'var(--duna-space-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-2)' }}>
              <div>
                <h2 className="editor-pv-title">Inicio</h2>
                <p className="editor-pv-sub">Toca cualquier cosa en la vista para editarla, o elígela aquí.</p>
              </div>
              {/* § EDITOR-AYUDA-1 — el «?» de «Inicio» abre la guía de «Secciones»: es el nivel del
                  spec que no tiene miga propia (no hay «‹ volver» que mostrar en la raíz). */}
              <button type="button" onClick={() => abrirAyuda('secciones')} className="duna-btn duna-btn--ghost duna-btn--icon" aria-label="Ayuda: Secciones" title="Ayuda: Secciones">
                <HelpCircle aria-hidden />
              </button>
            </div>
          )}

          {/* § EDITOR-TIENDA-TEMA-1 — en modo 'tema' la columna monta `PaletaSeccion` (en vez de la
              lista de secciones de `pagina`): es la pestaña «Tema», store-wide, ortogonal a qué
              página se está viendo. `enEditor` le quita la vista previa sintética propia —la PÁGINA
              REAL de la derecha ya hace ese trabajo (§ el spec)— y `onCambioEnVivo` reenvía al MISMO
              iframe compartido por el puente (`enviarTemaIframe`, arriba). */}
          {modo === 'tema' ? (
            // § EDITOR-AYUDA-1 — el «?» de «Estilo» vive en un envoltorio APARTE, no dentro de
            // `PaletaSeccion.tsx` (fuera de `touches:` de este slice, el mismo criterio que ya
            // justificaba que fuera bespoke): un wrapper `position:relative` con el botón ANCLADO
            // arriba a la derecha, igual que la miga de cualquier otro nivel. `key={temaReloadKey}`
            // (§ EDITOR-TIENDA-DESHACER-1): remonta el editor de tema tras un Publicar/Descartar EN
            // LOTE que lo incluyó, para que vuelva a leer `/api/site-content` por su cuenta (§ el
            // comentario grande de `temaReloadKey`, arriba) — nunca cambia por nada más (ni al
            // teclear, ni al cambiar de página).
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => abrirAyuda('estilo')}
                className="duna-btn duna-btn--ghost duna-btn--icon"
                aria-label="Ayuda: Estilo"
                title="Ayuda: Estilo"
                style={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}
              >
                <HelpCircle aria-hidden />
              </button>
              <PaletaSeccion key={temaReloadKey} enEditor onCambioEnVivo={enviarTemaIframe} />
            </div>
          ) : modo === 'ayuda' ? (
            // § EDITOR-AYUDA-1 — «Ayuda» del riel. `ayudaAbierta` ya está resuelto ANTES de que
            // `modo` llegue a valer 'ayuda' (§ `abrirAyuda`, arriba), así que este componente nunca
            // monta con una guía a medio decidir.
            <AyudaCentro abierta={ayudaAbierta} onAbrir={abrirAyuda} onVolver={() => setAyudaAbierta(null)} onIniciarRecorrido={onIniciarRecorrido} />
          ) : (
            <>
              {/* § EDITOR-VISUAL-PANEL-1 — EL GRUPO «ARRIBA» (el spec), envuelto ENTERO (rótulo +
                  filas) en UN `<div>`: es UN solo ítem del grid externo (gap uniforme entre
                  grupos, § editor.css) — nunca dos ítems que dupliquen el espacio entre el rótulo y
                  su primera fila. Sólo el RÓTULO es condicional a Inicio (`!nivelActivo`) — las dos
                  filas de abajo se quedan SIEMPRE montadas, cada una oculta por su propio
                  `display:none` cuando no es la activa (§ el comentario de cabecera de
                  `seccionActiva`: nunca desmontar). Con un nivel abierto, el rótulo desaparece y
                  sólo queda a la vista la fila (o el editor) de la sección activa. */}
              <div>
                {!nivelActivo && <div className="editor-grp">Arriba</div>}
                <div className="editor-rows">
                  {/* § EDITOR-TIENDA-CROMO-1 — ENCABEZADO y MENÚ, ARRIBA de las secciones de la
                      página (§ el spec): son de TODA la tienda, no de la página activa, así que se ven
                      igual en cualquier pestaña del selector — nunca se filtran por `pagina` como
                      `seccionesOrdenadas`. MISMA regla de ocultar-nunca-desmontar que las secciones de
                      página (§ el docstring grande de `seccionActiva`, arriba): perderían sus propios
                      pasos de historial si se desmontaran al bajar a OTRO nivel. */}
                  <div style={nivelActivo && nivelActivo !== 'encabezado' ? { display: 'none' } : undefined}>
                    <EncabezadoSeccion
                      ref={registrarRefCromo('encabezado')}
                      enEditor
                      onAbrir={() => abrirNivelCromo('encabezado')}
                      onCerrar={() => cerrarNivelCromo('encabezado')}
                      onCambio={enviarCromoIframe}
                      onPaso={onPasoSeccion}
                      onEstado={(info) => manejarEstadoCromo('encabezado', info)}
                      // § EDITOR-PANEL-PIEL-1 — las raíces de la paleta REAL de la tienda, para que
                      // `MuestraColor` sugiera el color del badge sobre el tema del cliente, no uno
                      // fijo. Mismo dato que ya baja a `BibliotecaSecciones` más abajo
                      // (`doc.contenido.tema`), un consumidor más — sin fetch nuevo.
                      tema={doc ? (doc.contenido.tema as TemaContent) : null}
                    />
                  </div>
                  <div style={nivelActivo && nivelActivo !== 'menu' ? { display: 'none' } : undefined}>
                    <MenuSeccion
                      ref={registrarRefCromo('menu')}
                      enEditor
                      onAbrir={() => abrirNivelCromo('menu')}
                      onCerrar={() => cerrarNivelCromo('menu')}
                      onCambio={(datos) => enviarCromoIframe('menu', datos)}
                      onPaso={onPasoSeccion}
                      onEstado={(info) => manejarEstadoCromo('menu', info)}
                    />
                  </div>
                </div>
              </div>

              {/* § EDITOR-VISUAL-PANEL-1 — EL GRUPO «CONTENIDO» (el spec): envuelve las secciones de
                  la página, las agregadas, y el botón «+ Agregar sección» — mismo criterio de rótulo
                  condicional y de envoltorio único que «Arriba». */}
              <div>
              {!nivelActivo && <div className="editor-grp">Contenido</div>}
              <div className="editor-rows">
              {/* § EDITOR-AGREGAR-SECCION-1 — los separadores "+ Agregar sección" van DESPUÉS de cada
                  fila (el spec: "entre tarjetas al pasar el mouse") — nunca antes de la primera: ese
                  caso lo cubre el botón de PIE DE LISTA (abajo), que es el punto de entrada principal
                  y el único garantizado cuando la lista está vacía de instancias. SOLO en Inicio (un
                  nivel abierto ya filtró la lista a una fila) y SOLO si esta página tiene
                  `seccionesHome` (home; nosotros/suscripciones no agregan secciones). */}
              {seccionesOrdenadas.map((item) => {
                if (item.tipo === 'instancia') {
                  const id = item.id;
                  const instancia = seccionesHomeLocal?.[id];
                  if (!instancia) return null; // no debería pasar (§ ordenarSeccionesConInstancias ya filtra)
                  const activa = instanciaActiva === id;
                  return (
                    <div key={id}>
                      <div style={nivelActivo && nivelActivo !== id ? { display: 'none' } : undefined}>
                        {activa ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 0 }}>
                                <h2 className="duna-title">{instancia.titulo.trim() || nombreInstancia(instancia.tipo)}</h2>
                                <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
                                  Edita y los cambios se guardan solos; publica cuando estén listos. Mira el resultado en
                                  la vista de la tienda.{' '}
                                  <a href="/" target="_blank" rel="noreferrer" className="duna-link">Ver la tienda</a>
                                </p>
                              </div>
                              <button type="button" onClick={() => cerrarNivelInstancia(id)} className="duna-btn duna-btn--secondary">Cerrar</button>
                            </div>
                            <div className="tienda-vivo__form" style={{ marginTop: 'var(--duna-space-4)' }}>
                              <InstanciaEditorForm tipo={instancia.tipo} instancia={instancia} onCambiar={(siguiente) => cambiarInstancia(id, siguiente)} />
                            </div>
                          </>
                        ) : (
                          <InstanciaTarjeta
                            tipo={instancia.tipo}
                            titulo={instancia.titulo}
                            visible={instancia.visible !== false}
                            hayBorrador={hayBorradorSeccionesHome}
                            orden={asaDeSeccion(id, instancia.titulo)}
                            onAbrir={() => abrirNivelInstancia(id)}
                            onDuplicar={() => duplicarInstancia(id)}
                            onEliminar={() => setInstanciaAEliminar(id)}
                            onCambiarVisible={() => cambiarInstancia(id, { ...instancia, visible: instancia.visible === false })}
                          />
                        )}
                      </div>
                      {/* El separador DESPUÉS de esta fila — nunca dentro del `display:none` de
                          arriba: con un nivel abierto, la lista entera queda reducida a una fila y un
                          separador ahí no tendría sentido (insertar "después de la única visible" no
                          es lo que el dueño está mirando). */}
                      {!nivelActivo && <SeparadorAgregar onClick={() => abrirBiblioteca(id)} />}
                    </div>
                  );
                }
                const config = item.config;
                return (
                  // § EDITOR-TIENDA-SHELL-1 — el PANEL CON NIVELES oculta por CSS las secciones que no
                  // son la activa (nunca las desmonta, § el docstring grande de `seccionActiva` arriba).
                  // En Inicio (`nivelActivo === null`) las muestra TODAS, como siempre.
                  <div key={config.seccion}>
                    {/* § EDITOR-AYUDA-RECORRIDO-1 — `data-tour="hero"` SÓLO en la banda del hero: el
                        objetivo del paso «El hero y sus zonas». Visible cuando `nivelActivo` es
                        `null` (Inicio, fila colapsada) o `'hero'` (ya abierto, con sus zonas a la
                        vista) — en cualquier OTRA sección/página sin hero, este `data-tour` nunca
                        se renderiza y el paso se salta solo (§ RecorridoEditor.tsx). */}
                    <div
                      style={nivelActivo && nivelActivo !== config.seccion ? { display: 'none' } : undefined}
                      data-tour={config.seccion === 'hero' ? 'hero' : undefined}
                    >
                      <TiendaSeccionEditor
                        ref={registrarRefSeccion(config.seccion)}
                        config={config}
                        categorias={categorias}
                        categoriasListas={categoriasListas}
                        resaltar={resaltar}
                        onAbrir={abrirNivelSeccion}
                        onCerrar={cerrarNivelSeccion}
                        onCambioPublicado={recargarIframe}
                        onCambio={manejarCambioSeccion}
                        onPaso={onPasoSeccion}
                        onEstado={manejarEstadoSeccion}
                        orden={asaDeSeccion(config.bandaId, config.titulo)}
                        valoresCruzados={valoresCruzados}
                        onEscribirCruzado={escribirCruzado}
                        onAyuda={abrirAyuda}
                        onElementoActivoChange={setHayElementoActivo}
                        carga={{
                          valor: doc ? (doc.contenido[config.seccion] as Record<string, unknown> | undefined) : undefined,
                          sinPublicar: doc ? !!doc.sinPublicar[config.seccion] : false,
                          listo: !!doc,
                          error: errorDoc,
                          recargar: recargarDoc,
                        }}
                      />
                    </div>
                    {/* `config.bandaId` — SÓLO una banda con asa (§ `ordenLocal`, home) ofrece
                        "Agregar sección" tras ella; una página sin `orden` (nosotros/suscripciones)
                        no tiene dónde insertar, y `ordenLocal`/`seccionesHomeLocal` ya lo garantizan
                        arriba por el guard del separador INICIAL. */}
                    {!nivelActivo && ordenLocal && seccionesHomeLocal && config.bandaId && (
                      <SeparadorAgregar onClick={() => abrirBiblioteca(config.bandaId as string)} />
                    )}
                  </div>
                );
              })}
              {/* El botón de PIE DE LISTA (§ el spec: "«+ Agregar sección» con borde punteado") —
                  idéntico mecanismo que los separadores (inserta "después de null" = al final), pero
                  SIEMPRE visible (no sólo al pasar el mouse): es el punto de entrada PRINCIPAL, el
                  que un dueño que nunca agregó una sección va a encontrar primero. `.editor-add-sec`
                  (§ EDITOR-VISUAL-PANEL-1) reemplaza al botón sólido `duna-btn--secondary`. */}
              {!nivelActivo && ordenLocal && seccionesHomeLocal && (
                <button
                  type="button"
                  onClick={() => abrirBiblioteca(null)}
                  disabled={alTopeDeInstancias}
                  className="editor-add-sec"
                  // § EDITOR-AYUDA-RECORRIDO-1 — `data-tour="agregar-seccion"`: el objetivo del
                  // paso «Agregar sección». Sólo existe en Inicio de la página home (misma guarda
                  // que el botón); fuera de ahí, ese paso se salta solo.
                  data-tour="agregar-seccion"
                >
                  <Plus /> {alTopeDeInstancias ? `Llegaste al máximo de ${TOPE_INSTANCIAS_HOME} secciones agregadas` : 'Agregar sección'}
                </button>
              )}
              </div>
              </div>

              {/* § EDITOR-VISUAL-PANEL-1 — EL GRUPO «ABAJO» (el spec), mismo criterio de rótulo
                  condicional y de envoltorio único que «Arriba»/«Contenido». */}
              <div>
                {!nivelActivo && <div className="editor-grp">Abajo</div>}
                <div className="editor-rows">
                  {/* § EDITOR-TIENDA-CROMO-1 — PIE, AL FINAL (§ el spec: "al final de las secciones de
                      la página"). Mismo criterio store-wide que Encabezado/Menú, arriba. */}
                  <div style={nivelActivo && nivelActivo !== 'footer' ? { display: 'none' } : undefined}>
                    <FooterSeccion
                      ref={registrarRefCromo('footer')}
                      enEditor
                      onAbrir={() => abrirNivelCromo('footer')}
                      onCerrar={() => cerrarNivelCromo('footer')}
                      onCambio={(datos) => enviarCromoIframe('footer', datos)}
                      onPaso={onPasoSeccion}
                      onEstado={(info) => manejarEstadoCromo('footer', info)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {/* § EDITOR-PANEL-ANCHO-1 — LA MANIJA: arrastrar ensancha/angosta el panel, como el pedido del
            owner ("como vercel con el suyo"). `position: absolute` sobre el div `position: relative`
            de arriba, centrada en el borde panel|lienzo (`left: anchoPanel`, `translateX(-50%)` en
            CSS) — así NO necesita su propia columna de grid, que habría reintroducido el gap que
            EDITOR-PANEL-PIEL-1 quitó entre panel y lienzo. SÓLO cuando no es `angosto`: bajo ese
            umbral el panel y el lienzo se apilan y no hay borde VERTICAL que arrastrar. `role=
            "separator"` + `aria-orientation="vertical"` + los tres `aria-value*` (el spec: "role=
            separator... enfocable"); el doble clic y Enter comparten destino con las flechas
            (`resetearAnchoPanel`/`onKeyDownManijaPanel`, arriba). */}
        {!angosto && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ajustar el ancho del panel"
            aria-valuenow={Math.round(anchoPanel)}
            aria-valuemin={ANCHO_PANEL_MIN}
            aria-valuemax={anchoPanelMax}
            tabIndex={0}
            className="editor-panel-manija"
            style={{ left: anchoPanel }}
            onPointerDown={iniciarArrastrePanel}
            onKeyDown={onKeyDownManijaPanel}
            onDoubleClick={resetearAnchoPanel}
          />
        )}
        {/* La capa transparente que, SÓLO mientras dura el arrastre, evita que el mouse quede
            "atrapado" por el `<iframe>` del lienzo (§ el spec: "el iframe no se come el mouse") — otro
            documento, que no reenvía sus propios eventos de puntero a esta ventana. */}
        {arrastrandoPanel && <div className="editor-panel-manija-overlay" />}
        {/* § EDITOR-AYUDA-RECORRIDO-1 — `data-tour="lienzo"`: el objetivo del paso «El lienzo».
            Siempre presente, sea cual sea `modo` — es el hermano FIJO del panel de arriba, nunca
            condicional a `modo`/`pagina`. */}
        <div data-tour="lienzo" style={{
          minWidth: 0,
          minHeight: 0,
          order: angosto ? 1 : 2,
          ...(angosto ? { height: '50vh', flexShrink: 0 } : { height: '100%' }),
        }}>
          <VistaTiendaIframe
            ref={iframeRef}
            pagina={pagina}
            dispositivo={dispositivo}
            onSeccionSeleccionada={manejarSeleccionDesdeIframe}
            onCampoCambio={manejarCampoCambioDesdeIframe}
            onCamposCambio={manejarCamposCambioDesdeIframe}
            // § EDITOR-AGREGAR-SECCION-LIENZO-1 — el «+» del lienzo abre la MISMA biblioteca que el
            // separador de la lista (§ `abrirBiblioteca`, arriba), en la MISMA posición: `despuesDe`
            // ya llega resuelto al id que esa función espera (una banda o una instancia), sin
            // traducción acá.
            onAgregarSeccion={abrirBiblioteca}
            tituloPorMarcador={tituloPorMarcador}
          />
        </div>
      </div>

      {/* § EDITOR-AGREGAR-SECCION-1 — LA BIBLIOTECA: la «vista nueva» abierta por "+ Agregar
          sección", con una tarjeta por tipo del catálogo curado (§ BibliotecaSecciones.tsx). Elegir
          una llama a `agregarSeccion`, que la cierra sola al terminar. */}
      <VistaNueva
        abierto={bibliotecaAbierta}
        onCerrar={() => { if (!tipoInsertando) setBibliotecaAbierta(false); }}
        titulo="Agregar sección"
        descripcion="Elige un tipo de sección para agregar al home."
      >
        <BibliotecaSecciones
          tema={doc ? (doc.contenido.tema as TemaContent) : null}
          onElegir={agregarSeccion}
          elegido={tipoInsertando}
        />
      </VistaNueva>

      {/* La CONFIRMACIÓN de "Eliminar" del menú "⋯" de una sección agregada (§ el spec: "con
          confirmación") — el MISMO `ConfirmDeleteDialog` que cualquier borrado sensible del panel
          (§ CLAUDE.md, "Borrar CONFIRMA, en la PLATAFORMA"), no una segunda implementación. */}
      <ConfirmDeleteDialog
        open={instanciaAEliminar !== null}
        onOpenChange={(open) => { if (!open) setInstanciaAEliminar(null); }}
        title="Eliminar sección"
        entityLabel={
          instanciaAEliminar && seccionesHomeLocal?.[instanciaAEliminar]
            ? (seccionesHomeLocal[instanciaAEliminar].titulo.trim() || nombreInstancia(seccionesHomeLocal[instanciaAEliminar].tipo))
            : 'esta sección'
        }
        consequence="Se quita del home. Si ya la habías publicado, sigue visible en la tienda hasta que publiques este cambio — y puedes deshacerlo con Ctrl/Cmd+Z mientras no publiques."
        confirmLabel="Eliminar sección"
        onConfirm={async () => {
          if (instanciaAEliminar) await eliminarInstancia(instanciaAEliminar);
        }}
        successMessage="Sección eliminada."
      />
    </div>
  );
});

export default TiendaPaginas;
