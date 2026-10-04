'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import TiendaSeccionEditor, { type TiendaSeccionEditorHandle, type AsaOrdenProps } from '@/components/admin/TiendaSeccionEditor';
import VistaTiendaIframe, { type VistaTiendaIframeHandle } from '@/components/admin/VistaTiendaIframe';
import PaletaSeccion from '@/components/admin/PaletaSeccion';
import TogglePagina from '@/components/admin/TogglePagina';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey, type SeccionVista } from '@/components/admin/tienda-secciones';
import { getProducts } from '@/lib/api/products';
import { categoriasDelCatalogo } from '@/lib/productos/categorias';
import { useSheetDesdeAbajo } from '@/hooks/useSheetDesdeAbajo';
import { DISPOSITIVO_DEFECTO, seccionDesdeMarcador, marcadorDeSeccion, type DispositivoKey } from '@/lib/admin/editor-iframe';
import { Migas } from '@/components/admin/editor/Migas';
import { esMensajeCampoImagenClick } from '@/lib/storefront/editor-puente';
// `TIPO_MENSAJE_DESHACER`/`esMensajeDeshacer` NO vienen de `lib/storefront/editor-puente.ts`: viven
// en el COMPONENTE que las define (`EditorPuenteVivo.tsx`, § su docstring grande — desviación
// medida, ese módulo compartido no está en `touches:` de este slice).
import { esMensajeDeshacer } from '@/components/storefront/EditorPuenteVivo';
import { resolverOrden, type BandaId } from '@/lib/config/site-content-defaults';
import { moverBandaAIndice, moverBandaConDestino, moverBandaEnDireccion, ordenarPorBanda } from '@/lib/admin/orden-secciones';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { crearHistorialEditor, sonIguales, type HistorialEditor, type PasoHistorial } from '@/lib/admin/historial-editor';
import type { EstadoAutoguardado } from '@/lib/autoguardado';

// § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — las secciones que son DESTINO de algún `seccionCruzada`
// (§ `CampoTexto.seccionCruzada`, tienda-secciones.ts) — hoy sólo `marquesina` (sus campos `texto`/
// `productoSlug` se muestran en la tarjeta del hero). Derivado de `SECCIONES_TIENDA`, no una lista a
// mano: una sección cruzada nueva entra sola, sin tocar este archivo salvo por el cómputo de abajo.
const SECCIONES_CON_CAMPOS_CRUZADOS = new Set<SeccionVista>(
  SECCIONES_TIENDA.flatMap((c) => c.campos.filter((f) => f.seccionCruzada).map((f) => f.seccionCruzada!)),
);

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
   *  `pagina` (`'paginas'`, el default) o el editor de tema (`'tema'`, `PaletaSeccion` en modo
   *  `enEditor`). El `<iframe>` de la derecha NO cambia con esto — sigue mostrando `pagina`, el
   *  tema es store-wide y se ve en cualquier página (§ el comentario grande de
   *  `EditorTiendaPantallaCompleta.tsx`). */
  modo?: 'paginas' | 'tema';
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
  /** Secciones de la página activa con borrador + `'orden'` (home) + `'tema'` (store-wide), todas
   *  juntas — el número que la píldora de la barra muestra. */
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
}

// El editor del storefront agrupado por PÁGINA (Home / Nosotros), montado DENTRO del editor de
// pantalla completa (§ EDITOR-TIENDA-DISPOSITIVOS-1 — antes vivía directo en `/admin/tienda`). El
// selector de página y el de dispositivo ya no son responsabilidad de este componente: los dos
// llegan por prop desde `EditorTiendaPantallaCompleta`, que los pone en su barra superior.
const TiendaPaginas = forwardRef<TiendaPaginasHandle, TiendaPaginasProps>(function TiendaPaginas({ pagina, resaltar, dispositivo = DISPOSITIVO_DEFECTO, modo = 'paginas', onEstadoGlobal }, ref) {
  const paginaMeta = PAGINAS.find(p => p.key === pagina)!;
  const secciones = SECCIONES_TIENDA.filter(c => c.pagina === pagina);

  // EL IFRAME COMPARTIDO (§ EDITOR-TIENDA-IFRAME-VISTA-1): UNA sola vista en vivo por página, no una
  // por sección — reemplaza las `VistaTiendaEnVivo` sueltas que cada `TiendaSeccionEditor` montaba.
  // Los editores no la ven: le hablan por el `ref` a través de dos callbacks (abrir una sección,
  // recargar tras un cambio publicado), así que agregar/quitar secciones no toca este componente.
  const iframeRef = useRef<VistaTiendaIframeHandle>(null);
  const irASeccion = useCallback((seccion: SeccionVista) => iframeRef.current?.irASeccion(seccion), []);
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
  const abrirNivelSeccion = useCallback((seccion: SeccionVista) => {
    irASeccion(seccion);
    setSeccionActiva(seccion);
  }, [irASeccion]);
  const cerrarNivelSeccion = useCallback((seccion: SeccionVista) => {
    setSeccionActiva((actual) => (actual === seccion ? null : actual));
  }, []);
  // El «‹ Inicio» de las migas: colapsa la edición de la sección activa (como su "Cerrar") Y vuelve
  // al nivel de arriba — las DOS salidas (el botón interno, éstas migas) deben terminar en el mismo
  // sitio, nunca una tarjeta a medio abrir detrás de la lista.
  const volverAInicio = useCallback(() => {
    if (seccionActiva) seccionRefs.current.get(seccionActiva)?.cerrar();
    setSeccionActiva(null);
  }, [seccionActiva]);
  // § EDITOR-TIENDA-POSTMESSAGE-1 — el cambio EN VIVO de cada editor llega acá y se reenvía al
  // iframe compartido por `postMessage`, sin recargar (reemplaza el reload-tras-autoguardado de
  // `onCambioPublicado`, que ahora sólo corre tras Publicar/Descartar).
  const enviarCambioIframe = useCallback(
    (seccion: SeccionVista, datos: Record<string, unknown>) => iframeRef.current?.enviarCambio(seccion, datos),
    [],
  );

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
  const manejarSeleccionDesdeIframe = useCallback((marcador: string) => {
    const candidato = seccionDesdeMarcador(marcador) as SeccionVista;
    if (!secciones.some(c => c.seccion === candidato)) return;
    seccionRefs.current.get(candidato)?.seleccionar();
  }, [secciones]);
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
    const candidato = seccionDesdeMarcador(marcador) as SeccionVista;
    if (!secciones.some(c => c.seccion === candidato)) return;
    const handle = seccionRefs.current.get(candidato);
    const esCruzado = secciones.some(c => c.campos.some(f => f.seccionCruzada === candidato && f.name === campo));
    if (esCruzado) handle?.escribirCampoSinAbrir(campo, valor);
    else handle?.escribirCampo(campo, valor);
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
      const candidato = seccionDesdeMarcador(e.data.seccion) as SeccionVista;
      if (!secciones.some(c => c.seccion === candidato)) return;
      seccionRefs.current.get(candidato)?.abrirSelectorImagen(e.data.campo);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [secciones]);

  // ANGOSTO reusa la pregunta de `useSheetDesdeAbajo` ("¿es una pantalla táctil de una mano?",
  // umbral 960 — § DUNA_MQ_SHEET_ABAJO) para una decisión DISTINTA de la suya (de qué borde sale un
  // sheet): acá decide si la lista de secciones y el iframe se apilan en vez de ir lado a lado. Es
  // la MISMA pregunta —hay rail, no hay espacio para dos columnas anchas— así que comparte el
  // umbral en vez de abrir un segundo listener de `matchMedia` para lo mismo.
  const angosto = useSheetDesdeAbajo();

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
  useEffect(() => { setSeccionActiva(null); }, [pagina]);

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

  // ── § EDITOR-TIENDA-ORDEN-1 — EL ORDEN de las bandas del home, reordenable/ocultable desde la
  //    lista lateral (§ DISENO.md § 4.2, fila 6 del plan). SÓLO 'home' tiene `content.orden`
  //    (BANDA_IDS, site-content-defaults.ts) — nosotros/suscripciones no declaran este campo, así
  //    que `ordenLocal` se queda `null` para esas páginas y ningún `SeccionConfig` recibe la prop
  //    `orden` (sin asa, sin reordenar).
  //
  //    SIEMBRA ÚNICA (mismo patrón que el `form` de cada `TiendaSeccionEditor`): una vez que `doc`
  //    carga, este componente pasa a ser DUEÑO del array — switch de página y vuelta NO re-siembra
  //    (`TiendaPaginas` no se remonta al cambiar `pagina`, sólo cambia qué `secciones` renderiza).
  const [ordenLocal, setOrdenLocal] = useState<BandaId[] | null>(null);
  // § EDITOR-TIENDA-DESHACER-1 — espejo síncrono de `ordenLocal`, para leer el valor "despues" de
  // un lote desde el efecto de abajo sin que ese efecto dependa de `ordenLocal` (lo que lo correría
  // en cada reorden, no sólo al asentar).
  const ordenLocalRef = useRef<BandaId[] | null>(null); ordenLocalRef.current = ordenLocal;
  const [hayBorradorOrden, setHayBorradorOrden] = useState(false);
  const [procesandoOrden, setProcesandoOrden] = useState(false);
  const [errorOrden, setErrorOrden] = useState<string | null>(null);
  const sembradoOrdenRef = useRef(false);
  useEffect(() => {
    if (sembradoOrdenRef.current || !doc) return;
    sembradoOrdenRef.current = true;
    const draftMerged = resolverOrden(doc.contenido.orden);
    setOrdenLocal(draftMerged);
    // `sinPublicar.orden` NO lo calcula el GET genérico (orden es META, fuera del REGISTRY, § el
    // mismo motivo por el que `tema`/`encabezado` lo calculan A MANO en `site-content-read.ts` —
    // acá se resuelve comparando contra lo PUBLICADO, un único fetch extra al montar, nunca
    // recurrente): sin esto, reabrir el editor tras reordenar en una sesión anterior sin publicar
    // mostraría la píldora "Sin publicar" apagada, mintiendo sobre un borrador que sigue pendiente.
    fetch('/api/site-content/publicado')
      .then((r) => (r.ok ? r.json() : null))
      .then((pub: { orden?: unknown } | null) => {
        if (!pub) return;
        const publicado = resolverOrden(pub.orden);
        setHayBorradorOrden(publicado.some((id, i) => id !== draftMerged[i]));
      })
      .catch(() => {}); // sin esto, "Sin publicar" se queda apagado — preferible a afirmar sin base
  }, [doc]);

  // El AUTOGUARDADO del orden — MISMO coordinador que cada sección (`useAutoguardado`), guardando
  // la clave META `orden` en vez de una sección del REGISTRY (el PUT genérico ya la acepta:
  // `ordenEditableSchema` está declarado en `siteContentEditableSchema`, § site-content-schema.ts).
  const guardarOrden = useCallback(async (data: BandaId[]) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden: data }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const autoOrden = useAutoguardado(guardarOrden);

  // EL ENVÍO EN VIVO al iframe compartido (§ EDITOR-TIENDA-POSTMESSAGE-1), reusado para 'orden'.
  // `VistaTiendaIframe.tsx` queda FUERA de `touches:` de este slice, así que no gana un método
  // `enviarOrden` propio — su `enviarCambio` YA es genérico en RUNTIME (sólo manda {tipo, seccion,
  // datos} tal cual por `postMessage`; no mira el REGISTRY del lado del panel). El cast documenta
  // el cruce: 'orden' no es una `SeccionVista` real, y `EditorPuenteVivo.tsx` (§ editor-puente.ts)
  // la reconoce ANTES de tratarla como una sección del REGISTRY.
  const enviarOrdenIframe = useCallback((valor: BandaId[]) => {
    const enviar = iframeRef.current?.enviarCambio as
      | ((seccion: string, datos: Record<string, unknown>) => void)
      | undefined;
    enviar?.('orden', { valor });
  }, []);

  // EL ENVÍO EN VIVO del TEMA al iframe compartido (§ EDITOR-TIENDA-TEMA-1) — MISMO cruce que
  // 'orden', arriba: `VistaTiendaIframe.tsx` sigue fuera de `touches:`, su `enviarCambio` ya es
  // genérico en runtime, y 'tema' tampoco es una `SeccionVista` real. `PaletaSeccion`
  // (`enEditor`/`onCambioEnVivo`) ya manda las vars SIEMPRE COMPLETAS (`varsDeTemaEnVivo`), así que
  // acá no hay nada que resolver — sólo reenviar.
  const enviarTemaIframe = useCallback((vars: Record<string, string>) => {
    const enviar = iframeRef.current?.enviarCambio as
      | ((seccion: string, datos: Record<string, unknown>) => void)
      | undefined;
    enviar?.('tema', { vars });
  }, []);

  const [arrastrandoId, setArrastrandoId] = useState<BandaId | null>(null);

  // § EDITOR-TIENDA-DESHACER-1 — el "lote" del orden, MISMO criterio que `aplicarCambioForm` de
  // `TiendaSeccionEditor.tsx`: el PRIMER reorder desde el último asentamiento fija `loteOrdenAntesRef`;
  // los siguientes (mientras el debounce del autoguardado sigue abierto) no lo tocan — así una
  // ráfaga de flechas o un arrastre con varios `dragenter` cuenta como UN solo paso de historial.
  const loteOrdenAntesRef = useRef<BandaId[] | null>(null);
  // Suprime el push de abajo cuando el PROPIO deshacer/rehacer del orden disparó el asentamiento
  // (mismo rol que `aplicandoHistorialRef` en `TiendaSeccionEditor.tsx` — sin esto, cada deshacer
  // empujaría un paso nuevo a su propia pila).
  const aplicandoHistorialOrdenRef = useRef(false);

  const aplicarNuevoOrden = useCallback((siguiente: BandaId[], anterior: BandaId[]) => {
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
  const restaurarOrden = useCallback((valor: BandaId[]) => {
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

  const moverOrden = useCallback((id: BandaId, dir: -1 | 1) => {
    setOrdenLocal((prev) => {
      if (!prev) return prev;
      const siguiente = moverBandaEnDireccion(prev, id, dir);
      aplicarNuevoOrden(siguiente, prev);
      return siguiente;
    });
  }, [aplicarNuevoOrden]);

  const moverOrdenA = useCallback((idArrastrado: BandaId, idDestino: BandaId) => {
    setOrdenLocal((prev) => {
      if (!prev) return prev;
      const siguiente = moverBandaConDestino(prev, idArrastrado, idDestino);
      aplicarNuevoOrden(siguiente, prev);
      return siguiente;
    });
  }, [aplicarNuevoOrden]);

  // El asa por sección — `undefined` para toda página sin `content.orden` o mientras `ordenLocal`
  // no sembró todavía (ninguna lista reordenable antes de saber el orden real evita un "salto"
  // visual al llegar el primer render con datos).
  const asaDeSeccion = useCallback((bandaId: BandaId | undefined, titulo: string): AsaOrdenProps | undefined => {
    if (!bandaId || !ordenLocal) return undefined;
    const i = ordenLocal.indexOf(bandaId);
    if (i < 0) return undefined;
    return {
      posicion: i + 1,
      total: ordenLocal.length,
      arrastrando: arrastrandoId === bandaId,
      onDragStart: () => setArrastrandoId(bandaId),
      onDragEnter: () => { if (arrastrandoId && arrastrandoId !== bandaId) moverOrdenA(arrastrandoId, bandaId); },
      onDragEnd: () => setArrastrandoId(null),
      onMoverArriba: () => moverOrden(bandaId, -1),
      onMoverAbajo: () => moverOrden(bandaId, 1),
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
        setOrdenLocal(resolverOrden(fresco.contenido?.orden));
      }
      setHayBorradorOrden(false);
      recargarIframe(); // la MISMA resincronización completa que usa cada sección tras publicar/descartar
    } catch {
      setErrorOrden(accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.');
    } finally {
      setProcesandoOrden(false);
    }
  };

  // Las `SeccionConfig` de la página activa, en el orden elegido — SÓLO home tiene `ordenLocal`; las
  // demás páginas quedan en el orden fijo del registro (`ordenarPorBanda` con `orden: []` sería
  // destructivo — items sin bandaId irían al final — así que se evita llamarla sin dato real).
  const seccionesOrdenadas = ordenLocal ? ordenarPorBanda(secciones, ordenLocal) : secciones;
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
    if (doc?.sinPublicar.tema) secs.push('tema');
    return secs;
  };

  const publicarPendientes = async () => {
    const secs = listaPendientes();
    if (secs.length === 0) return;
    const res = await fetch('/api/site-content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'publicarVarias', secciones: secs }),
    });
    if (!res.ok) throw new Error('No se pudo publicar.');
    for (const s of secs) {
      if (s === 'orden') { setHayBorradorOrden(false); continue; }
      if (s === 'tema') { setTemaReloadKey((k) => k + 1); continue; }
      seccionRefs.current.get(s as SeccionVista)?.marcarPublicado();
    }
    recargarIframe();
  };

  const descartarPendientes = async () => {
    const secs = listaPendientes();
    if (secs.length === 0) return;
    const res = await fetch('/api/site-content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'descartarVarias', secciones: secs }),
    });
    if (!res.ok) throw new Error('No se pudo descartar.');
    // UN SOLO refetch para TODAS las secciones descartadas (nunca N) — mismo mecanismo que
    // `publicarOrDescartarOrden('descartar')` ya usa para 'orden'.
    const fresco = await recargarDoc();
    for (const s of secs) {
      if (s === 'orden') { setOrdenLocal(resolverOrden(fresco.contenido?.orden)); setHayBorradorOrden(false); continue; }
      if (s === 'tema') { setTemaReloadKey((k) => k + 1); continue; }
      seccionRefs.current.get(s as SeccionVista)?.restaurarDesdePublicado((fresco.contenido?.[s] ?? {}) as Record<string, unknown>);
    }
    recargarIframe();
  };

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
    const pendientes = pendientesSecciones + (ordenLocal && hayBorradorOrden ? 1 : 0) + (doc?.sinPublicar.tema ? 1 : 0);
    const estadosSecciones = secciones.map((c) => seccionesEstado.get(c.seccion)?.estado ?? 'guardado');
    const todosLosEstados: EstadoAutoguardado[] = [...estadosSecciones, autoOrden.estado];
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
  }, [secciones, seccionesEstado, ordenLocal, hayBorradorOrden, doc, autoOrden.estado, historialVersion, onEstadoGlobal]);

  // § EDITOR-TIENDA-DESHACER-1 — el handle que `EditorTiendaPantallaCompleta` usa para los atajos de
  // teclado y los botones de la barra. NO memoizado (como `escribirCampo`/`abrirSelectorImagen` de
  // `TiendaSeccionEditor.tsx`): se recompone en cada render y siempre expone la versión fresca.
  useImperativeHandle(ref, () => ({
    deshacer: deshacerGlobal,
    rehacer: rehacerGlobal,
    publicarPendientes,
    descartarPendientes,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* § EDITOR-TIENDA-SHELL-1 — LAS MIGAS: sólo existen cuando hay un nivel de arriba al que
          volver, así que sólo se montan con `seccionActiva` puesta (nunca en Inicio). Las dos
          secciones de abajo (el toggle/nota de página, la barra de orden) son del nivel «Inicio» —
          decisiones de LISTA, no de una sección puntual— y se ocultan al bajar de nivel por la misma
          razón que `orden`/`ojo` sólo viven en la tarjeta colapsada (§ TiendaSeccionEditor.tsx). */}
      {modo === 'paginas' && seccionActiva && (
        <Migas
          nivelAnterior="Inicio"
          actual={secciones.find(c => c.seccion === seccionActiva)?.titulo ?? seccionActiva}
          onVolver={volverAInicio}
        />
      )}

      {/* El toggle de encender/apagar y la nota de la página apagable (Nosotros · Suscripciones) — el
          selector de PÁGINA en sí ya no vive acá, subió a la barra superior del editor de pantalla
          completa (§ EDITOR-TIENDA-DISPOSITIVOS-1, `EditorTiendaPantallaCompleta`). SÓLO en modo
          'paginas' (§ EDITOR-TIENDA-TEMA-1) Y en el nivel «Inicio» (§ EDITOR-TIENDA-SHELL-1): son
          cosas de LA PÁGINA, no del tema store-wide ni de una sección puntual. */}
      {modo === 'paginas' && !seccionActiva && (paginaMeta.apagable || paginaMeta.nota) && (
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
      {modo === 'paginas' && !seccionActiva && hayBorradorOrden && (
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
        gridTemplateColumns: angosto ? undefined : 'minmax(0, 1fr) minmax(360px, 1fr)',
        gap: 'var(--duna-space-6)',
        flex: '1 1 auto',
        minHeight: 0,
      }}>
        <div style={{
          display: 'grid',
          gap: 'var(--duna-space-4)',
          minWidth: 0,
          order: angosto ? 2 : 1,
          overflowY: 'auto',
          alignContent: 'start',
          ...(angosto ? { flex: '1 1 auto', minHeight: 0 } : { height: '100%' }),
        }}>
          {/* § EDITOR-TIENDA-TEMA-1 — en modo 'tema' la columna monta `PaletaSeccion` (en vez de la
              lista de secciones de `pagina`): es la pestaña «Tema», store-wide, ortogonal a qué
              página se está viendo. `enEditor` le quita la vista previa sintética propia —la PÁGINA
              REAL de la derecha ya hace ese trabajo (§ el spec)— y `onCambioEnVivo` reenvía al MISMO
              iframe compartido por el puente (`enviarTemaIframe`, arriba). */}
          {modo === 'tema' ? (
            // `key={temaReloadKey}` (§ EDITOR-TIENDA-DESHACER-1): remonta el editor de tema tras un
            // Publicar/Descartar EN LOTE que lo incluyó, para que vuelva a leer `/api/site-content`
            // por su cuenta (§ el comentario grande de `temaReloadKey`, arriba) — nunca cambia por
            // nada más (ni al teclear, ni al cambiar de página).
            <PaletaSeccion key={temaReloadKey} enEditor onCambioEnVivo={enviarTemaIframe} />
          ) : (
            seccionesOrdenadas.map(config => (
              // § EDITOR-TIENDA-SHELL-1 — el PANEL CON NIVELES oculta por CSS las secciones que no
              // son la activa (nunca las desmonta, § el docstring grande de `seccionActiva` arriba).
              // En Inicio (`seccionActiva === null`) las muestra TODAS, como siempre.
              <div
                key={config.seccion}
                style={seccionActiva && seccionActiva !== config.seccion ? { display: 'none' } : undefined}
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
                  carga={{
                    valor: doc ? (doc.contenido[config.seccion] as Record<string, unknown> | undefined) : undefined,
                    sinPublicar: doc ? !!doc.sinPublicar[config.seccion] : false,
                    listo: !!doc,
                    error: errorDoc,
                    recargar: recargarDoc,
                  }}
                />
              </div>
            ))
          )}
        </div>
        <div style={{
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
            tituloPorMarcador={tituloPorMarcador}
          />
        </div>
      </div>
    </div>
  );
});

export default TiendaPaginas;
