'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TiendaSeccionEditor, { type TiendaSeccionEditorHandle, type AsaOrdenProps } from '@/components/admin/TiendaSeccionEditor';
import VistaTiendaIframe, { type VistaTiendaIframeHandle } from '@/components/admin/VistaTiendaIframe';
import PaletaSeccion from '@/components/admin/PaletaSeccion';
import TogglePagina from '@/components/admin/TogglePagina';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey, type SeccionVista } from '@/components/admin/tienda-secciones';
import { getProducts } from '@/lib/api/products';
import { categoriasDelCatalogo } from '@/lib/productos/categorias';
import { useSheetDesdeAbajo } from '@/hooks/useSheetDesdeAbajo';
import { DISPOSITIVO_DEFECTO, seccionDesdeMarcador, type DispositivoKey } from '@/lib/admin/editor-iframe';
import { esMensajeCampoImagenClick } from '@/lib/storefront/editor-puente';
import { resolverOrden, type BandaId } from '@/lib/config/site-content-defaults';
import { moverBandaAIndice, moverBandaConDestino, moverBandaEnDireccion, ordenarPorBanda } from '@/lib/admin/orden-secciones';
import { useAutoguardado } from '@/hooks/useAutoguardado';

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
}

// El editor del storefront agrupado por PÁGINA (Home / Nosotros), montado DENTRO del editor de
// pantalla completa (§ EDITOR-TIENDA-DISPOSITIVOS-1 — antes vivía directo en `/admin/tienda`). El
// selector de página y el de dispositivo ya no son responsabilidad de este componente: los dos
// llegan por prop desde `EditorTiendaPantallaCompleta`, que los pone en su barra superior.
export default function TiendaPaginas({ pagina, resaltar, dispositivo = DISPOSITIVO_DEFECTO, modo = 'paginas' }: TiendaPaginasProps) {
  const paginaMeta = PAGINAS.find(p => p.key === pagina)!;
  const secciones = SECCIONES_TIENDA.filter(c => c.pagina === pagina);

  // EL IFRAME COMPARTIDO (§ EDITOR-TIENDA-IFRAME-VISTA-1): UNA sola vista en vivo por página, no una
  // por sección — reemplaza las `VistaTiendaEnVivo` sueltas que cada `TiendaSeccionEditor` montaba.
  // Los editores no la ven: le hablan por el `ref` a través de dos callbacks (abrir una sección,
  // recargar tras un cambio publicado), así que agregar/quitar secciones no toca este componente.
  const iframeRef = useRef<VistaTiendaIframeHandle>(null);
  const irASeccion = useCallback((seccion: SeccionVista) => iframeRef.current?.irASeccion(seccion), []);
  const recargarIframe = useCallback(() => iframeRef.current?.recargar(), []);
  // § EDITOR-TIENDA-POSTMESSAGE-1 — el cambio EN VIVO de cada editor llega acá y se reenvía al
  // iframe compartido por `postMessage`, sin recargar (reemplaza el reload-tras-autoguardado de
  // `onCambioPublicado`, que ahora sólo corre tras Publicar/Descartar).
  const enviarCambioIframe = useCallback(
    (seccion: SeccionVista, datos: Record<string, unknown>) => iframeRef.current?.enviarCambio(seccion, datos),
    [],
  );

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
  const manejarCampoCambioDesdeIframe = useCallback((marcador: string, campo: string, valor: string) => {
    const candidato = seccionDesdeMarcador(marcador) as SeccionVista;
    if (!secciones.some(c => c.seccion === candidato)) return;
    seccionRefs.current.get(candidato)?.escribirCampo(campo, valor);
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

  const aplicarNuevoOrden = useCallback((siguiente: BandaId[], anterior: BandaId[]) => {
    if (siguiente === anterior) return; // sin cambio real (§ moverBanda*: misma referencia)
    setOrdenLocal(siguiente);
    setHayBorradorOrden(true);
    autoOrden.marcarSucio(siguiente);
    enviarOrdenIframe(siguiente);
  }, [autoOrden, enviarOrdenIframe]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* El toggle de encender/apagar y la nota de la página apagable (Nosotros · Suscripciones) — el
          selector de PÁGINA en sí ya no vive acá, subió a la barra superior del editor de pantalla
          completa (§ EDITOR-TIENDA-DISPOSITIVOS-1, `EditorTiendaPantallaCompleta`). SÓLO en modo
          'paginas' (§ EDITOR-TIENDA-TEMA-1): son cosas de LA PÁGINA, no del tema store-wide. */}
      {modo === 'paginas' && (paginaMeta.apagable || paginaMeta.nota) && (
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
          TIENDA-TEMA-1): el orden es de LA PÁGINA home, no del tema. */}
      {modo === 'paginas' && hayBorradorOrden && (
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
            <PaletaSeccion enEditor onCambioEnVivo={enviarTemaIframe} />
          ) : (
            seccionesOrdenadas.map(config => (
              <TiendaSeccionEditor
                key={config.seccion}
                ref={registrarRefSeccion(config.seccion)}
                config={config}
                categorias={categorias}
                categoriasListas={categoriasListas}
                resaltar={resaltar}
                onAbrir={irASeccion}
                onCambioPublicado={recargarIframe}
                onCambio={enviarCambioIframe}
                orden={asaDeSeccion(config.bandaId, config.titulo)}
                carga={{
                  valor: doc ? (doc.contenido[config.seccion] as Record<string, unknown> | undefined) : undefined,
                  sinPublicar: doc ? !!doc.sinPublicar[config.seccion] : false,
                  listo: !!doc,
                  error: errorDoc,
                  recargar: recargarDoc,
                }}
              />
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
          />
        </div>
      </div>
    </div>
  );
}
