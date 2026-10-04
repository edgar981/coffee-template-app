'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RotateCw, Navigation } from 'lucide-react';
import type { PaginaKey, SeccionVista } from '@/components/admin/tienda-secciones';
import {
  urlDePagina,
  urlDePaginaEnEditor,
  selectorDeSeccion,
  seccionDesdeMarcador,
  scrollSeguro,
  ANCHOS_DISPOSITIVO,
  DISPOSITIVO_DEFECTO,
  calcularEscalaDispositivo,
  ATRIBUTO_EDITOR_SECCION,
  cajaDeHover,
  type DispositivoKey,
} from '@/lib/admin/editor-iframe';
// EL AUTÓMATA DE ESTABILIZACIÓN DE ALTURA (§ EDITOR-TIENDA-POSTMESSAGE-1, §1 del spec) — REUSADO,
// no reimplementado, de `lib/storefront/scroll-inercia.ts`. Son funciones PURAS sobre números
// (altura, reloj, scrollY) sin acoplamiento a la tienda ni a `corteAplicado`: la restauración de
// `ScrollInercia` las usa para el mismo problema en la tienda real, y acá se usan para el mismo
// problema en la copia que vive dentro del iframe del editor — ver el docstring de `onLoad` abajo
// para la medición que lo justifica.
import {
  estadoInicialEstabilizacion,
  siguienteEstadoEstabilizacion,
  listoParaRestaurar,
  objetivoDeRestauracion,
} from '@/lib/storefront/scroll-inercia';
// LOS MENSAJES del puente (§ EDITOR-TIENDA-POSTMESSAGE-1 / EDITOR-TIENDA-SELECCION-1) — la MISMA
// forma que valida/emite `EditorPuenteVivo.tsx` del lado del iframe (`lib/storefront/editor-
// puente.ts`, pura): una sola definición del nombre de cada mensaje, no dos que puedan divergir.
import {
  TIPO_MENSAJE_CONTENIDO_SECCION, TIPO_MENSAJE_MODO_NAVEGAR, esMensajeSeccionClick, esMensajeCampoCambio,
  esMensajeAgregarSeccion,
} from '@/lib/storefront/editor-puente';

// LA PÁGINA REAL de la tienda, completa, dentro del panel (§ EDITOR-TIENDA-IFRAME-VISTA-1).
// Reemplaza las vistas previas sueltas por sección (`VistaTiendaEnVivo`) que montaba cada
// `TiendaSeccionEditor`: en vez de reconstruir cada banda con una segunda implementación del
// cálculo de colores/tipografía/forma, el iframe navega a la RUTA REAL del storefront en modo
// borrador (§ EDITOR-TIENDA-IFRAME-GATE-1, reescrito en `MODO-EDITOR-SOLO-EN-EL-IFRAME-1`: el
// borrador se activa por el `?editor=1` de la URL del iframe, no por una cookie de sesión) — mismo
// origen.
//
// LOS CAMBIOS DE TEXTO/IMAGEN YA NO RECARGAN (§ EDITOR-TIENDA-POSTMESSAGE-1): `enviarCambio` manda
// el borrador por `postMessage` al documento del iframe, que lo aplica EN VIVO sobre su propio
// `SiteContentProvider` (`EditorPuenteVivo.tsx`, del lado del storefront) sin navegar. `recargar`
// —y el `<iframe>` entero volviendo a pedir la URL— sólo corre tras Publicar/Descartar y por el
// botón "Actualizar": casos donde SÍ conviene una resincronización completa desde el servidor, no
// un paso obligado de cada edición.
//
// "Ir a la sección" y el resalte se resuelven por MANIPULACIÓN DIRECTA del DOM del iframe —mismo
// origen, así que `contentDocument`/`contentWindow` son accesibles sin restricción— en vez de con
// una clase CSS que el storefront tendría que declarar: el storefront no necesita saber que un
// resalte existe, y el estilo nunca puede quedar "pegado" en una recarga.
//
// NAVEGAR DENTRO DEL IFRAME — decisión y por qué (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1). La tienda
// real adentro es completamente interactiva: un clic en el nav, una tarjeta de producto o el
// carrito puede llevar a OTRA ruta (`/tienda`, `/tienda/[slug]`, `/checkout`…) que no lleva
// `?editor=1`. Dos salidas posibles —"conservar el parámetro" en cada navegación, o "el iframe
// vuelve a la página del editor"— y se elige la SEGUNDA:
//   - "Conservar el parámetro" exigiría reescribir el destino de CADA enlace del storefront antes
//     de que navegue. La mayoría de esa navegación es client-side de Next (`<Link>`, `router.push`),
//     que NO dispara el evento `load` del iframe ni reusa el `href` del DOM en el momento del clic
//     (el handler de `Link` ya capturó el destino original) — habría que interceptar el CLIC en fase
//     de captura y forzar una navegación completa por cada uno, tocando el comportamiento de TODO el
//     storefront (fuera de `touches:` de este slice) a cambio de evitar un reload.
//   - "Vuelve a la página del editor" se resuelve ENTERO acá, sin tocar una sola página del
//     storefront: un POLL (no un `onLoad`, que tampoco vería una navegación client-side — mismo
//     motivo de arriba) compara el pathname real del iframe contra el de la pestaña activa, y si
//     divergió —por CUALQUIER causa: clic, redirect de un submit, `router.push`— lo manda de vuelta
//     con `location.replace`, CON el parámetro. Cuesta un reload extra si el admin se desvía, pero
//     es robusto a cualquier mecanismo de navegación y no depende de qué construya cada página.
// `EDITOR-TIENDA-POSTMESSAGE-1` (§ DISENO.md § 13) NO resolvió esto: el canal que construyó es
// panel→iframe, para sincronizar CONTENIDO (texto/imagen) — no el storefront avisando su propia
// ruta de vuelta. Esa experiencia más fina (que evitaría el reload extra de abajo) sigue sin
// construirse; acá el editor es de UNA página a la vez, y volver a ella es la expectativa correcta
// mientras tanto.
//
// DOS "NAVEGAR" DISTINTOS EN ESTE ARCHIVO, A PROPÓSITO (§ EDITOR-TIENDA-SELECCION-1): el de arriba
// es ESTE vigía —corrige una desviación de ruta, siempre quería quedarse en la página que se edita—.
// El interruptor "Navegar" de la barra (abajo, `navegando`/`alternarNavegar`) es OTRA cosa: decide
// si un clic DENTRO del iframe selecciona una sección (el default) o navega de verdad. El vigía
// respeta ese interruptor (`navegandoRef.current`, ver su propio `useEffect`): con "Navegar"
// encendido, SE APAGA — si no, el vigía deshacía en 400ms exactamente lo que el interruptor
// prometía permitir.
const INTERVALO_VIGIA_RUTA_MS = 400;

// EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3) — el rótulo de dispositivo de la franja de estado
// («● Borrador · /ruta   Escritorio») necesita el NOMBRE legible, que `lib/admin/editor-iframe.ts`
// (fuera de `touches:`) no declara (sólo el ancho en px, § `ANCHOS_DISPOSITIVO`). Mapa LOCAL, tres
// strings — no vale la pena una segunda exportación de ese archivo para esto.
const LABEL_DISPOSITIVO: Record<DispositivoKey, string> = {
  escritorio: 'Escritorio',
  tablet: 'Tablet',
  telefono: 'Teléfono',
};

export interface VistaTiendaIframeHandle {
  /** Desplaza el iframe hasta la sección y la resalta brevemente. No hace nada si el documento
   *  todavía no cargó, o si esta sección no tiene marcador resoluble (§ `selectorDeSeccion`).
   *  `string`, no `SeccionVista` (§ EDITOR-AGREGAR-SECCION-1): las claves META ('orden'/'tema'/
   *  'encabezado'/'menu'/'footer', ya en uso con un cast por el llamador) y ahora los ids de
   *  instancia (`inst:…`) comparten este mismo canal — `selectorDeSeccion`/`marcadorDeSeccion`
   *  (editor-iframe.ts, fuera de `touches:`) son identidad para cualquier cadena que no sea
   *  'spotlight', así que ensanchar el parámetro acá no cambia su comportamiento para ningún
   *  llamador de ayer, y le quita a los de hoy el cast que tenían que hacer. */
  irASeccion: (seccion: string) => void;
  /** Recarga la página real preservando el scroll — se llama tras Publicar/Descartar
   *  (§ `TiendaSeccionEditor`, `onCambioPublicado`; el guardado asentado YA NO recarga, § `onCambio`
   *  abajo lo reemplaza para el contenido en vivo). */
  recargar: () => void;
  /** Manda el borrador EN VIVO de una sección al iframe por `postMessage` (§ EDITOR-TIENDA-
   *  POSTMESSAGE-1) — SIN recargar ni navegar. No hace nada si el documento todavía no tiene
   *  `contentWindow` (p. ej. a mitad de un reload); el próximo cambio de `form` lo reintenta.
   *  `string`, no `SeccionVista` — ver el docstring de `irASeccion`, arriba. */
  enviarCambio: (seccion: string, datos: Record<string, unknown>) => void;
}

// El color del resalte es un LITERAL, no una custom property: el documento del iframe es el
// STOREFRONT (tokens `--sf-*`), no el panel (`--duna-*`) — las dos paletas no se pueden leer entre
// documentos sin plomería extra, y esto es chrome EFÍMERO del editor superpuesto por JS, no una
// decisión de estilo del storefront. Es el valor de `--duna-sol` (ámbar = atención).
const COLOR_RESALTE = '#f59e0b';
const DURACION_RESALTE_MS = 1500;
// § EDITOR-TIENDA-CAMPO-ANCLADO-1 — ventana de frescura de `clicDesdeIframeRef` (§ su docstring,
// junto a `irASeccion`).
const UMBRAL_CLIC_DESDE_IFRAME_MS = 500;

interface VistaTiendaIframeProps {
  pagina: PaginaKey;
  dispositivo?: DispositivoKey;
  /** § EDITOR-TIENDA-SELECCION-1 — llamado cuando llega un `postMessage` de "clic DENTRO del
   *  iframe" válido (`esMensajeSeccionClick`), con el MARCADOR tal cual (no resuelto todavía a una
   *  `SeccionVista`: eso lo hace el padre, `TiendaPaginas.tsx`, que es quien conoce el registro de
   *  secciones de la página activa). Ausente = sin padre que notificar (no debería ocurrir fuera de
   *  un test). */
  onSeccionSeleccionada?: (seccion: string) => void;
  /** § EDITOR-TIENDA-CAMPO-EDITABLE-1 — llamado cuando llega un `postMessage` de "el campo
   *  flotante cambió" válido (`esMensajeCampoCambio`), con el MARCADOR de sección (igual que
   *  `onSeccionSeleccionada`, sin resolver todavía) y el campo/valor tal cual. El padre resuelve la
   *  sección y llama a `TiendaSeccionEditorHandle.escribirCampo(campo, valor)`. */
  onCampoCambio?: (seccion: string, campo: string, valor: string) => void;
  /** § EDITOR-AGREGAR-SECCION-LIENZO-1 — llamado cuando llega un `postMessage` de "el dueño
   *  clickeó el «+» entre dos secciones" válido (`esMensajeAgregarSeccion`), con el marcador
   *  `despuesDe` tal cual (YA es el id que `TiendaPaginas.tsx` necesita para `abrirBiblioteca`,
   *  § el docstring del mensaje en `editor-puente.ts` — nunca se resuelve con
   *  `seccionDesdeMarcador` acá, eso daría el valor equivocado). Ausente = sin padre que
   *  notificar (no debería ocurrir fuera de un test). */
  onAgregarSeccion?: (despuesDe: string) => void;
  /** § EDITOR-TIENDA-SHELL-1 — marcador→título legible (`config.titulo`), para el RÓTULO del resalte
   *  de hover (abajo). Lo arma el padre (`TiendaPaginas.tsx`, que tiene `SECCIONES_TIENDA`) — este
   *  componente no importa ese registro, mismo criterio que `seccionDesdeMarcador` en
   *  `lib/admin/editor-iframe.ts` ("liviano, el registro lo resuelve quien lo tiene"). Un marcador
   *  ausente del mapa (home/nosotros siempre completan todas sus secciones; un residuo futuro) no
   *  rotula — el outline punteado del storefront sigue mostrándose igual, sólo sin nombre.
   */
  tituloPorMarcador?: Record<string, string>;
}

const VistaTiendaIframe = forwardRef<VistaTiendaIframeHandle, VistaTiendaIframeProps>(
  function VistaTiendaIframe({
    pagina, dispositivo = DISPOSITIVO_DEFECTO, onSeccionSeleccionada, onCampoCambio, onAgregarSeccion, tituloPorMarcador,
  }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const scrollPendiente = useRef<number | null>(null);
    // TOKEN de la restauración EN VUELO (§ el docstring de `onLoad`, abajo): el poll de
    // estabilización vive varios frames, así que necesita saber si SIGUE SIENDO el pedido vigente —
    // un segundo `recargar()` disparado antes de que el primero termine (doble click en "Actualizar",
    // dos guardados seguidos) invalida al anterior; se compara por identidad (`=== miToken`), no por
    // un booleano, porque un booleano no distingue "cancelado" de "ya lo reemplazó uno nuevo".
    const restauracionTokenRef = useRef(0);
    // EL DISPOSITIVO (§ EDITOR-TIENDA-DISPOSITIVOS-1, § 4.3 de DISENO.md): el canvas que mide su
    // propio tamaño disponible (ResizeObserver, ancho Y alto — a diferencia de `EscalaDesktop`, que
    // sólo mide ancho porque su contenido tiene alto NATURAL; acá el iframe no lo tiene — su alto es
    // el que el canvas le dé, como un viewport real). No se remonta cuando cambia `pagina` (sólo el
    // `<iframe key={pagina}>` de abajo lo hace), así que un `useEffect(() => {...}, [])` normal —sin
    // el patrón de callback-ref de `EscalaDesktop`— es correcto acá: este nodo nunca es el que se
    // desmonta y remonta.
    const canvasRef = useRef<HTMLDivElement>(null);
    const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
    useEffect(() => {
      const nodo = canvasRef.current;
      if (!nodo || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) return;
        setMedida({ ancho: Math.round(entry.contentRect.width), alto: Math.round(entry.contentRect.height) });
      });
      ro.observe(nodo);
      return () => ro.disconnect();
    }, []);
    const anchoDispositivo = ANCHOS_DISPOSITIVO[dispositivo];
    const medido = medida.ancho > 0 && medida.alto > 0;
    const escala = medido ? calcularEscalaDispositivo(medida.ancho, anchoDispositivo) : 1;
    // El ancho VISIBLE del stage (<= ancho disponible, por construcción de `escala`); el alto
    // INTERNO (sin escalar) se dimensiona para que, al multiplicarlo por `escala`, ocupe EXACTAMENTE
    // el alto disponible — ni hueco ni recorte, nunca scroll del canvas. `medido` gatea los dos: sin
    // medición todavía, el stage toma el 100% del canvas sin transformar (el primer paint, antes de
    // que el ResizeObserver reporte — un sub-frame, no un estado visible de verdad).
    const anchoVisible = medido ? Math.round(anchoDispositivo * escala) : anchoDispositivo;
    const altoInterno = medido ? medida.alto / escala : undefined;
    // Espejo síncrono de `escala`, para el listener de hover de abajo: se adjunta UNA vez por carga
    // (`onLoad`, § su comentario grande) y lee este ref en CADA evento — nunca la `escala` cerrada
    // por closure en el momento en que `onLoad` se definió, que quedaría vieja tras cualquier resize.
    const escalaRef = useRef(escala);
    escalaRef.current = escala;
    // EL resalte ACTIVO (nodo + su timer de limpieza), no sólo el timer: con sólo el timer, resaltar
    // una SEGUNDA sección mientras la primera seguía iluminada cancelaría el timer de la primera sin
    // limpiar su outline (queda pegado para siempre), y resaltar la MISMA sección dos veces seguidas
    // haría que el segundo timeout "restaurara" el outline AMBAR que el primero dejó puesto como si
    // fuera el valor original. Guardar el nodo deja limpiar la mitad VIEJA explícitamente antes de
    // pintar la nueva, en vez de fiarse de un valor "previo" capturado a mitad de una animación.
    const resaltadoRef = useRef<{ nodo: HTMLElement; timeout: number } | null>(null);
    const [cargando, setCargando] = useState(true);
    // Espejo SÍNCRONO de `cargando` para el vigía de ruta (abajo): el `setInterval` se crea UNA vez
    // por `pagina` y su callback, si leyera `cargando` por closure, vería siempre el valor del
    // momento en que se creó el efecto — no el actual. El ref se actualiza en cada render.
    const cargandoRef = useRef(cargando);
    cargandoRef.current = cargando;

    const rutaEditor = urlDePaginaEnEditor(pagina);
    const rutaPagina = urlDePagina(pagina);

    const limpiarResalte = () => {
      const activo = resaltadoRef.current;
      if (!activo) return;
      window.clearTimeout(activo.timeout);
      activo.nodo.style.outline = '';
      activo.nodo.style.outlineOffset = '';
      resaltadoRef.current = null;
    };

    // ── EL RÓTULO DE HOVER (§ EDITOR-TIENDA-SHELL-1) ──────────────────────────────────────────────
    // "Pasar el mouse sobre el lienzo resalta la sección con su nombre" (REDISENO.md § 2). El outline
    // punteado al :hover YA lo pinta el storefront (CSS de `EditorPuenteVivo.tsx`, Tier 1, fuera de
    // `touches:`); lo único que falta es el NOMBRE, y eso se dibuja ACÁ, por FUERA del documento del
    // iframe — mismo acceso directo (mismo origen, § `irASeccion` arriba) que ya usa esta vista para
    // desplazar/resaltar. `tituloPorMarcador` llega como prop porque este componente no tiene el
    // registro de secciones (§ su docstring, arriba).
    const [hover, setHover] = useState<{ marcador: string; caja: ReturnType<typeof cajaDeHover> } | null>(null);
    const hoverNodoRef = useRef<HTMLElement | null>(null);
    const tituloPorMarcadorRef = useRef(tituloPorMarcador);
    tituloPorMarcadorRef.current = tituloPorMarcador;

    // Adjuntado UNA vez por carga del documento (§ `onLoad`, abajo) — el documento VIEJO se descarta
    // entero en cada `load`/`recargar()`/cambio de página, así que sus listeners se van con él sin
    // limpieza manual (mismo criterio ya aceptado por el resto de este archivo: `onLoad` no desengancha
    // nada de la carga anterior). Lee `escalaRef`/`tituloPorMarcadorRef` en el momento del EVENTO, no
    // en el momento en que el listener se adjuntó, para no quedar con un factor de escala o un mapa de
    // títulos viejo tras un resize o un cambio de página que no recarga el iframe.
    const engancharHoverRotulo = useCallback((doc: Document) => {
      const onOver = (e: Event) => {
        const destino = e.target instanceof HTMLElement ? e.target : null;
        const nodo = destino?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_SECCION}]`) ?? null;
        if (nodo === hoverNodoRef.current) return; // mismo nodo que ya se está mostrando — sin cambio
        hoverNodoRef.current = nodo;
        if (!nodo) { setHover(null); return; }
        const marcador = nodo.getAttribute(ATRIBUTO_EDITOR_SECCION)!;
        const rect = nodo.getBoundingClientRect();
        setHover({ marcador, caja: cajaDeHover(rect, escalaRef.current) });
      };
      // `mouseout` con chequeo de `relatedTarget`: moverse DENTRO de la misma sección marcada no debe
      // apagar el rótulo — `closest()` en `onOver` ya filtra eso, pero `mouseout` dispara también al
      // salir de un hijo hacia OTRO hijo del mismo marcador, y sin el chequeo parpadearía.
      const onOut = (e: MouseEvent) => {
        const hacia = e.relatedTarget instanceof Node ? e.relatedTarget : null;
        if (hacia && hoverNodoRef.current?.contains(hacia)) return;
        hoverNodoRef.current = null;
        setHover(null);
      };
      doc.addEventListener('mouseover', onOver);
      doc.addEventListener('mouseout', onOut);
    }, []);

    // § EDITOR-TIENDA-CAMPO-ANCLADO-1 — la MITAD de VistaTiendaIframe.tsx del error 4
    // (REDISENO.md § 1): "un clic que nace en el iframe no vuelve a desplazar el iframe". El
    // listener de `seccion-click` (abajo) marca `clicDesdeIframeRef` con la sección y el instante
    // apenas recibe ese mensaje; `irASeccion` lo CONSUME (lo lee y lo borra) si todavía está
    // FRESCO y es de la MISMA sección — en ese caso, el clic que lo disparó ya nació DENTRO del
    // documento que el dueño está mirando, y desplazarlo/resaltarlo sería la página moviéndose
    // justo cuando el campo flotante (`EditorPuenteVivo.tsx`) acaba de medir su posición para
    // anclarse. Un "Editar" real desde la lista, o un deep-link, nunca pasan por ese mensaje —
    // así que siguen desplazando/resaltando como siempre.
    //
    // La ventana (`UMBRAL_CLIC_DESDE_IFRAME_MS`) existe porque la cadena mensaje→`irASeccion` no es
    // síncrona: el mensaje llega, `TiendaPaginas.tsx` (fuera de `touches:`) resuelve la sección y
    // llama a `seleccionar()`, y el efecto que de ahí sale a `onAbrir`/`irASeccion` corre recién en
    // el commit SIGUIENTE de React (después de pintar) — nunca en la misma pila de llamadas del
    // `onMessage`. 500ms es generoso para ese salto de un frame y, a la vez, corto para no
    // suprimir un "Editar" genuino sobre la MISMA sección que el dueño clickeó segundos antes
    // dentro del iframe.
    const clicDesdeIframeRef = useRef<{ seccion: string; marca: number } | null>(null);

    const irASeccion = useCallback((seccion: string) => {
      const reciente = clicDesdeIframeRef.current;
      if (reciente && reciente.seccion === seccion && Date.now() - reciente.marca < UMBRAL_CLIC_DESDE_IFRAME_MS) {
        clicDesdeIframeRef.current = null; // consumido — un "Editar" posterior sobre ESTA sección vuelve a desplazar
        return;
      }
      const doc = iframeRef.current?.contentDocument;
      // `as SeccionVista`: `selectorDeSeccion` (editor-iframe.ts, fuera de `touches:`) sigue tipado a
      // `SeccionVista`, pero su cuerpo es identidad para cualquier cadena que no sea 'spotlight' — un
      // cast local, no una ampliación de ESE archivo (§ el docstring de `VistaTiendaIframeHandle.
      // irASeccion`, arriba).
      const nodo = doc?.querySelector<HTMLElement>(selectorDeSeccion(seccion as SeccionVista));
      if (!nodo) return;
      limpiarResalte();
      const reduce = iframeRef.current?.contentWindow?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      nodo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      nodo.style.outline = `2px solid ${COLOR_RESALTE}`;
      nodo.style.outlineOffset = '-2px';
      const timeout = window.setTimeout(() => {
        nodo.style.outline = '';
        nodo.style.outlineOffset = '';
        resaltadoRef.current = null;
      }, DURACION_RESALTE_MS);
      resaltadoRef.current = { nodo, timeout };
    }, []);

    const recargar = useCallback(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      limpiarResalte();
      hoverNodoRef.current = null;
      setHover(null); // el documento se va a descartar — su rótulo, si había uno, ya no aplica
      // Invalida cualquier restauración todavía en vuelo de un `recargar()` anterior (§ el token,
      // arriba): ese poll, si siguiera corriendo, aplicaría un `scrollTo` viejo DESPUÉS del de esta
      // recarga nueva.
      restauracionTokenRef.current += 1;
      scrollPendiente.current = scrollSeguro(win.scrollY);
      setCargando(true);
      win.location.reload();
    }, []);

    // § EDITOR-TIENDA-POSTMESSAGE-1 — el envío EN VIVO, sin recargar. Mismo origen siempre (el
    // iframe es el MISMO despliegue, § `rutaEditor`), así que el segundo argumento de `postMessage`
    // puede ser el origen exacto del propio `window` del panel — nunca `'*'`, que mandaría el
    // borrador a cualquier origen si el `src` del iframe alguna vez apuntara a otro lado por error.
    // Si el iframe todavía no tiene `contentWindow` (a mitad de un reload, antes del primer load) el
    // mensaje se descarta — no hay a quién mandárselo, y el próximo cambio de `form` lo reintenta.
    const enviarCambio = useCallback((seccion: string, datos: Record<string, unknown>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion, datos }, window.location.origin);
    }, []);

    // ── EL INTERRUPTOR "NAVEGAR" (§ EDITOR-TIENDA-SELECCION-1, § 4.1 de DISENO.md) ────────────────
    // Decisión de esta tanda: el modo por defecto dentro del iframe es SELECCIÓN —un clic abre la
    // sección en la lista, nunca navega—, y "Navegar" (este botón, en la barra de abajo) es la
    // salida explícita para volver a usar la tienda como un visitante real. El estado vive ACÁ (no
    // en `EditorTiendaPantallaCompleta.tsx`, fuera de `touches:` de este slice) porque esta barra ya
    // existe y ya es el lugar donde vive el otro control de esta vista ("Actualizar").
    //
    // Persiste entre CAMBIOS DE PÁGINA (el `<iframe key={pagina}>` remonta, pero ESTE componente —y
    // su estado— no), y se RE-ENVÍA tras cada carga del iframe (`onLoad`, abajo): el documento nuevo
    // arranca en su propio default (selección activa, `EditorPuenteVivo.tsx`), así que si el
    // operador ya había activado Navegar hay que avisarle otra vez al documento nuevo.
    const [navegando, setNavegando] = useState(false);
    const navegandoRef = useRef(navegando);
    navegandoRef.current = navegando;

    const enviarModoNavegar = useCallback((valor: boolean) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ tipo: TIPO_MENSAJE_MODO_NAVEGAR, navegar: valor }, window.location.origin);
    }, []);

    const alternarNavegar = useCallback(() => {
      setNavegando(prev => {
        const next = !prev;
        enviarModoNavegar(next);
        return next;
      });
    }, [enviarModoNavegar]);

    // ── LA SELECCIÓN EN CONTEXTO, dirección iframe→panel (§ EDITOR-TIENDA-SELECCION-1) ────────────
    // `EditorPuenteVivo.tsx` manda este mensaje cuando el dueño clickea DENTRO de una sección
    // marcada. Se verifica `e.source` (no sólo `e.origin`) contra el `contentWindow` de ESTE mismo
    // iframe: con un solo iframe montado por vez alcanzaría con el origen, pero comprobar la fuente
    // es la verificación completa y no cuesta nada más.
    useEffect(() => {
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.source !== iframeRef.current?.contentWindow) return;
        if (esMensajeSeccionClick(e.data)) {
          // § EDITOR-TIENDA-CAMPO-ANCLADO-1 — marca ANTES de notificar al padre: la resolución a
          // `SeccionVista` es la MISMA que usa `TiendaPaginas.tsx` (`seccionDesdeMarcador`), para
          // que `irASeccion` compare contra el string que de verdad va a recibir.
          clicDesdeIframeRef.current = { seccion: seccionDesdeMarcador(e.data.seccion), marca: Date.now() };
          onSeccionSeleccionada?.(e.data.seccion);
          return;
        }
        // § EDITOR-TIENDA-CAMPO-EDITABLE-1 — el tercer mensaje, el campo flotante en vivo. Mismo
        // chequeo de origen/fuente que el de arriba; `seccion` llega como MARCADOR, sin resolver
        // todavía (lo hace `TiendaPaginas.tsx`, igual que con la selección).
        if (esMensajeCampoCambio(e.data)) { onCampoCambio?.(e.data.seccion, e.data.campo, e.data.valor); return; }
        // § EDITOR-AGREGAR-SECCION-LIENZO-1 — el «+» entre dos secciones. Mismo chequeo de
        // origen/fuente; `despuesDe` viaja YA RESUELTO al id que `abrirBiblioteca` necesita
        // (§ el docstring del mensaje en `editor-puente.ts`) — este componente no lo toca.
        if (esMensajeAgregarSeccion(e.data)) { onAgregarSeccion?.(e.data.despuesDe); return; }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }, [onSeccionSeleccionada, onCampoCambio, onAgregarSeccion]);

    useImperativeHandle(ref, () => ({ irASeccion, recargar, enviarCambio }), [irASeccion, recargar, enviarCambio]);

    // Cambiar de pestaña de página es una NAVEGACIÓN real (otra URL) — el `key={pagina}` del
    // iframe ya fuerza el remonte; este efecto sólo repone el estado "cargando" para esa carga.
    useEffect(() => { setCargando(true); }, [pagina]);

    // EL VIGÍA DE RUTA (§ el comentario grande de arriba, "NAVEGAR DENTRO DEL IFRAME"). Un POLL, no
    // un `onLoad`: la navegación client-side de Next (`<Link>`, `router.push`) cambia
    // `contentWindow.location` vía `history.pushState` SIN disparar el evento `load` del iframe, así
    // que un chequeo "al cargar" nunca vería ese caso — sólo comparar la ruta a intervalos lo
    // atrapa, sea cual sea el mecanismo que la cambió.
    //
    // GATEADO a `!navegandoRef.current` (§ EDITOR-TIENDA-SELECCION-1): este vigía es OTRO "navegar"
    // —el que trae al iframe DE VUELTA a la página que se edita cuando el admin se desvía— y hasta
    // este slice corría SIEMPRE. Con el interruptor "Navegar" encendido el dueño quiere exactamente
    // lo que este vigía deshace: moverse de verdad por la tienda. Sin este gate, prender "Navegar" y
    // clickear una tarjeta de producto habría navegado un instante y el vigía lo habría devuelto a
    // los 400ms — el interruptor habría parecido roto.
    useEffect(() => {
      const id = window.setInterval(() => {
        if (navegandoRef.current) return;
        // Mientras el documento está a mitad de cargar (incluida la primera carga, antes del
        // primer `onLoad`), `contentWindow.location` puede ser `about:blank` o el documento VIEJO
        // todavía — comparar en ese instante daría un falso positivo y dispararía un `replace`
        // sobre una navegación que ya estaba en curso.
        if (cargandoRef.current) return;
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        let actual: string;
        try {
          actual = win.location.pathname;
        } catch {
          // Cross-origin momentáneo a mitad de una transición de navegación — se reintenta en el
          // próximo tick, nunca se trata como "se fue a otra página".
          return;
        }
        if (actual === rutaPagina) return;
        // El admin navegó FUERA de la página que está editando (un clic en el nav/una tarjeta,
        // un redirect de un submit...): vuelve a ESTA página, con el modo editor puesto.
        limpiarResalte();
        cargandoRef.current = true;
        setCargando(true);
        win.location.replace(rutaEditor);
      }, INTERVALO_VIGIA_RUTA_MS);
      return () => window.clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `rutaEditor`/`rutaPagina` se derivan
      // de `pagina`, ya en las deps; `limpiarResalte` no es estable entre renders pero no necesita
      // serlo acá (lee `resaltadoRef`, no estado de render).
    }, [pagina, rutaPagina, rutaEditor]);

    // § EDITOR-TIENDA-POSTMESSAGE-1, §1 — EL SALTO AL RECARGAR, MEDIDO ANTES DE ARREGLARLO. Hasta
    // este slice, acá vivía `win.scrollTo(0, scrollPendiente.current)` llamado DIRECTO en 'load'. Se
    // midió por ejecución (Playwright, DB efímera + preset CORTE real, timing fiel vía
    // `addInitScript` para que el 'load' nativo dispare el restore en el MISMO tick que en
    // producción — un `page.evaluate()` posterior es más lento y esconde la carrera): a 'load' el
    // documento YA tiene layout (`scrollHeight` ~4486px en la medición) pero TODAVÍA NO es su altura
    // final (crece a ~5930px por el fetch de catálogo / imágenes que siguen entrando) — y
    // `html{scroll-behavior:smooth}` (`app/globals.css`) convierte ese `scrollTo(0, y)` de DOS
    // argumentos en una animación, no un salto. El resultado medido: el scroll queda VISIBLEMENTE
    // pegado en la posición máxima que la altura TODAVÍA PERMITÍA (3586px en la medición — a mitad
    // de una página de 5930px) durante más de un SEGUNDO, antes de corregirse solo — y sólo se
    // corrige solo quien tiene el preset CORTE puesto, porque esa corrección la hace la restauración
    // de `ScrollInercia` (gateada a `corteAplicado`), no este componente; sin CORTE el salto queda
    // así para siempre. Es la misma familia de bug que el docstring de `scroll-inercia.ts` ya
    // documentó para la restauración nativa de Chromium — acá el causante es este `scrollTo`
    // prematuro, no el navegador.
    //
    // EL FIX: esperar a que `scrollHeight` dentro del iframe deje de cambiar (el MISMO autómata que
    // ya usa `ScrollInercia`, reusado — ver el import de arriba) antes de restaurar, y restaurar con
    // `behavior:'instant'` (nunca el `scrollTo` de dos argumentos, que anima). Medido tras el fix,
    // mismo timing fiel: el scroll se queda en 0 (sin saltos visibles a una posición incorrecta)
    // hasta que la altura se confirma estable (~1.9s en la medición) y ahí salta UNA vez, exacto —
    // sin el período de "pegado a mitad de página" de arriba. Funciona para CUALQUIER tenant: no
    // depende de `corteAplicado`, porque el autómata que reusa tampoco depende de eso.
    const onLoad = useCallback(() => {
      // RE-SINCRONIZA el modo Navegar (§ el bloque de arriba) en CADA carga — primera carga, cambio
      // de página, `recargar()` —: el documento nuevo arranca en su propio default (selección
      // activa). Reintentos cortos por la MISMA clase de carrera que `enviarCambio` ya acepta sin
      // reintentar (ahí la cubre el hecho de que el dueño tipea varias veces; acá no hay tecla que
      // lo repita solo): el listener del lado del iframe se adjunta en un `useEffect`, DESPUÉS de
      // hidratar, y `load` puede disparar antes de que ese efecto corra — un envío único puede
      // perderse en el aire (`postMessage` no encola para un listener que llega después). Reenviar
      // el MISMO booleano es idempotente, así que no hay costo real en insistir.
      const reenviarNavegar = () => enviarModoNavegar(navegandoRef.current);
      reenviarNavegar();
      window.setTimeout(reenviarNavegar, 150);
      window.setTimeout(reenviarNavegar, 600);
      window.setTimeout(reenviarNavegar, 1500);

      const win = iframeRef.current?.contentWindow;
      if (win) { hoverNodoRef.current = null; setHover(null); engancharHoverRotulo(win.document); }
      const guardado = scrollPendiente.current;
      scrollPendiente.current = null;
      if (!win || guardado == null) {
        // Primera carga de la página (sin `recargar()` de por medio) o sin acceso al documento: no
        // hay scroll que restaurar, el skeleton se retira de inmediato como siempre.
        setCargando(false);
        return;
      }
      const miToken = ++restauracionTokenRef.current;
      const inicio = performance.now();
      // TODO EL CUERPO en un solo try: si `win` se vuelve cross-origin/detached A MITAD del poll (el
      // admin navegó fuera, o el nodo del iframe se removió por un cambio de página concurrente), la
      // primera propiedad que falle lanza — y CUALQUIER lectura de `win.*` puede ser la primera, no
      // sólo `scrollHeight`. Sin este try, esa excepción escapa de un callback de
      // `requestAnimationFrame`, donde React no la atrapa — un error sin manejar ahí.
      let estado: ReturnType<typeof estadoInicialEstabilizacion>;
      try {
        estado = estadoInicialEstabilizacion(win.document.documentElement.scrollHeight, inicio);
      } catch {
        setCargando(false);
        return;
      }
      const intentar = () => {
        if (restauracionTokenRef.current !== miToken) return; // un `recargar()` más nuevo lo reemplazó
        try {
          const alturaActual = win.document.documentElement.scrollHeight;
          const ahora = performance.now();
          estado = siguienteEstadoEstabilizacion(estado, alturaActual, ahora);
          if (listoParaRestaurar(estado, ahora, inicio)) {
            const objetivo = objetivoDeRestauracion(guardado, alturaActual, win.innerHeight);
            win.scrollTo({ top: objetivo, behavior: 'instant' });
            setCargando(false);
            return;
          }
        } catch {
          // Cross-origin momentáneo (el vigía de ruta ya cubre el caso real de navegación externa) —
          // no insiste: retira el skeleton y deja el scroll donde el navegador lo haya dejado.
          setCargando(false);
          return;
        }
        window.requestAnimationFrame(intentar);
      };
      window.requestAnimationFrame(intentar);
      // `enviarModoNavegar`/`engancharHoverRotulo` son estables (deps `[]`, § sus propias
      // definiciones) y `navegandoRef` es un ref: ninguno de los tres cambia de identidad entre
      // renders, así que agregarlos no cambia cuándo corre este callback.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Invalida cualquier restauración en vuelo si el componente se desmonta (cambio de página, que
    // ya remonta por `key={pagina}` — esto cierra el caso de un desmontaje por cualquier otra vía).
    useEffect(() => () => { restauracionTokenRef.current += 1; }, []);

    // EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3: "el lienzo con fondo punteado, la página enmarcada y
    // la pastilla de estado arriba"). El árbol pasa de "fila de controles + canvas con borde" a
    // `.editor-stage` (fondo punteado, raíz del componente) → `.editor-st-meta` (la franja de
    // estado: pastilla "Borrador · /ruta", el dispositivo en mono, y «Navegar»/«Actualizar» ahora
    // como íconos chicos — EL SPEC: "pasan a ser íconos chicos en esa franja, no se pierden") →
    // `.editor-canvas` (el MISMO `canvasRef` de siempre — el ResizeObserver que decide la escala no
    // se tocó, sólo su envoltorio visual) → `.editor-st-frame` (la página enmarcada: radio + sombra,
    // antes un simple `overflow:hidden` transparente).
    return (
      <div className="editor-stage">
        <div className="editor-st-meta">
          <span className="editor-st-pill">
            <i aria-hidden />
            Borrador · {rutaPagina}
          </span>
          <span className="duna-mono">{LABEL_DISPOSITIVO[dispositivo]}</span>
          {/* "Navegar" (§ EDITOR-TIENDA-SELECCION-1): apagado por defecto —un clic adentro SELECCIONA
              la sección, nunca navega—; encendido, la tienda se usa como un visitante real. Sigue
              siendo `.duna-pill` (ya soporta `.is-on`) — sólo perdió el texto, § arriba. */}
          <button
            type="button"
            aria-pressed={navegando}
            onClick={alternarNavegar}
            className={`duna-pill${navegando ? ' is-on' : ''}`}
            aria-label="Navegar"
            title={navegando
              ? 'Los clics navegan de verdad, como un visitante — desactiva para volver a seleccionar secciones'
              : 'Los clics seleccionan la sección que tocás — activa para usar la tienda como un visitante'}
          >
            <Navigation aria-hidden />
          </button>
          <button
            type="button"
            onClick={recargar}
            className="duna-btn duna-btn--ghost duna-btn--icon"
            aria-label="Actualizar"
            title="Volver a cargar la vista con los últimos cambios"
          >
            <RotateCw aria-hidden />
          </button>
        </div>
        <div ref={canvasRef} className="editor-canvas">
          {/* EL STAGE DEL DISPOSITIVO: ancho LITERAL del dispositivo elegido (así se activan los
              breakpoints reales de la tienda — § 4.3 de DISENO.md), reducido ENTERO con
              `transform: scale` sólo si no cabe en el canvas — nunca recortado, nunca con scroll
              horizontal. El `<iframe>` ve su propio tamaño REAL (anchoDispositivo × altoInterno)
              ANTES de la transformación: el scale es puramente visual, no cambia qué CSS responsivo
              corre adentro. Esta es LA PÁGINA ENMARCADA del spec: radio+sombra+fondo blanco vía
              `.editor-st-frame` — el radio del teléfono es mayor (bisel), como en el prototipo. */}
          <div
            className="editor-st-frame"
            style={{
              width: anchoVisible,
              height: '100%',
              borderRadius: dispositivo === 'telefono' ? 'var(--duna-r-xl)' : 'var(--duna-r-l)',
            }}
          >
            <div
              style={{
                width: anchoDispositivo,
                height: altoInterno ?? '100%',
                transform: medido ? `scale(${escala})` : undefined,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                ref={iframeRef}
                key={pagina}
                src={rutaEditor}
                title="Vista previa de la tienda"
                onLoad={onLoad}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              />
            </div>
            {/* EL RÓTULO DE HOVER (§ arriba): vive DENTRO del envoltorio ya escalado (`anchoVisible`,
                `position:relative`, ahora `.editor-st-frame`), nunca dentro del stage que lleva el
                `transform` — `cajaDeHover` ya aplicó la escala a la caja medida, así que una SEGUNDA
                transformación la deformaría. `pointer-events:none`: el rótulo no debe robarle el
                clic al iframe de abajo. */}
            {hover && (() => {
              const titulo = tituloPorMarcadorRef.current?.[hover.marcador];
              if (!titulo) return null;
              return (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: hover.caja.left,
                    top: Math.max(0, hover.caja.top - 24),
                    pointerEvents: 'none',
                    background: 'var(--duna-ink)',
                    color: 'var(--duna-bg)',
                    font: '600 11px var(--duna-font-ui, inherit)',
                    padding: '2px 8px',
                    borderRadius: 'var(--duna-r-full, 999px)',
                    whiteSpace: 'nowrap',
                    zIndex: 1,
                  }}
                >
                  {titulo}
                </div>
              );
            })()}
          </div>
          {cargando && (
            <div className="duna-skel" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 0 }} />
          )}
        </div>
      </div>
    );
  },
);

export default VistaTiendaIframe;
