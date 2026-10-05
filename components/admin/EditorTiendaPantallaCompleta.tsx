'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Eye, FileText, Monitor, Redo2, Smartphone, Tablet, Undo2 } from 'lucide-react';
import TiendaPaginas, { type EstadoGlobalEditor, type TiendaPaginasHandle } from '@/components/admin/TiendaPaginas';
import { PAGINAS, SECCIONES_TIENDA, type PaginaKey } from '@/components/admin/tienda-secciones';
import {
  ANCHOS_DISPOSITIVO,
  CLAVE_DISPOSITIVO_EDITOR,
  DISPOSITIVO_DEFECTO,
  dispositivoDesdeStorage,
  urlDePagina,
  type DispositivoKey,
} from '@/lib/admin/editor-iframe';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { Riel, type HerramientaRiel } from '@/components/admin/editor/Riel';
import { VistaNueva } from '@/components/admin/editor/VistaNueva';
import { ResumenPublicar } from '@/components/admin/editor/ResumenPublicar';
import { RecorridoEditor } from '@/components/admin/editor/RecorridoEditor';
import { OfertaRecorrido } from '@/components/admin/editor/OfertaRecorrido';
import { CLAVE_RECORRIDO_VISTO, recorridoEstaVisto } from '@/lib/admin/recorrido-editor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';

// ─── EL EDITOR DE PANTALLA COMPLETA (§ EDITOR-TIENDA-DISPOSITIVOS-1) ───────────────────────────────
//
// Reemplaza el apilado "lista↔iframe dentro de /admin/tienda" por una vista PROPIA, a pantalla
// completa, sin el chrome del panel — el pedido textual del owner tras ver el editor viejo: *"Se ve
// bien sin embargo se ve como en la vista movil, aun no se siente como un editor inline"* y *"el
// editor abre en una nueva vista, no sale nada del panel de navegacion"* (referencia: el editor de
// temas de Shopify). La barra superior fina (volver al panel · página/tema · dispositivo) reemplaza
// al `role="tablist"` que antes vivía dentro de `TiendaPaginas` — ahora ese selector vive ACÁ, y
// `TiendaPaginas` lo recibe por prop (controlado), junto con el dispositivo elegido.
//
// LA PESTAÑA «TEMA» (§ EDITOR-TIENDA-TEMA-1) sigue siendo un MODO del editor, no una página — el
// `<iframe>` de `VistaTiendaIframe` sigue mostrando la MISMA `pagina` que ya estaba activa (el tema
// es store-wide, se ve en cualquier página), lo único que cambia es qué columna de la izquierda
// monta `TiendaPaginas` (la lista de secciones, o `PaletaSeccion` en modo `enEditor`). Por eso es un
// estado APARTE (`modo`), no un valor más de `PaginaKey`: `pagina` sigue siendo SIEMPRE una de las
// tres páginas reales —nunca 'tema'— para que el resto del árbol (el `<iframe key={pagina}>`, el
// deep-link, el dispositivo) no tenga que aprender un cuarto valor que no es una página de verdad.
//
// § EDITOR-TIENDA-SHELL-1 (REDISENO.md § 3) — EL RIEL REEMPLAZA AL PILL «TEMA» del tablist de arriba.
// «Estilo» deja de ser una PESTAÑA junto a las páginas y pasa a ser una HERRAMIENTA con su propio
// carril (`components/admin/editor/Riel.tsx`): elegirla sigue siendo, por debajo, el MISMO `modo`
// de siempre (`'tema'`) — el riel es sólo la fachada nueva sobre el mecanismo que ya existía, no un
// tercer estado. «Medios» NO es un `modo` persistente: abre la «vista nueva»
// (`components/admin/editor/VistaNueva.tsx`, una hoja sobre el lienzo) y vuelve sola al cerrarse —
// hoy sin «Agregar sección» que ofrecer (medido: no existe, § Combinaciones.tsx/VistaNueva.tsx), así
// que la ejercita con el segundo caso que el spec ofrece.
//
// EL DEEP-LINK DEL AVISO DE CONFIGURACIÓN (§ El AVISO DE CONFIGURACIÓN del Dashboard, CLAUDE.md) —
// `?seccion=&tarjeta=` — se movió ACÁ desde `TiendaPaginas` (que antes lo leía con su propio
// `useSearchParams`): esta pantalla decide la página INICIAL (la de la sección del deep-link) y qué
// resaltar; `TiendaPaginas` sólo recibe el resultado ya resuelto. `lib/config/avisos-configuracion.ts`
// (fuera de `touches:` de este slice) sigue generando el link hacia `/admin/tienda?seccion=…`, que
// esa ruta —todavía viva como portada— reenvía para acá sin tocar ese archivo (§ `/admin/tienda/
// page.tsx`). Un deep-link siempre apunta a una SECCIÓN de página, nunca al tema, así que arranca
// siempre en `modo: 'paginas'`.
const DISPOSITIVOS: { key: DispositivoKey; label: string; Icon: typeof Monitor }[] = [
  { key: 'escritorio', label: 'Escritorio', Icon: Monitor },
  { key: 'tablet', label: 'Tablet', Icon: Tablet },
  { key: 'telefono', label: 'Teléfono', Icon: Smartphone },
];

// EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3: "Página: Inicio ▾" — el prototipo nombra "home" como
// "Inicio"). `PAGINAS` (tienda-secciones.ts, fuera de `touches:`) sigue con `label: 'Home'` — lo
// consume también `TogglePagina` para nosotros/suscripciones, así que no se toca esa fuente; esto
// es sólo el texto de DISPLAY del selector de esta barra, local a este componente.
const LABEL_PAGINA_SELECTOR: Record<PaginaKey, string> = {
  home: 'Inicio',
  nosotros: 'Nosotros',
  suscripciones: 'Suscripciones',
};

// § EDITOR-AYUDA-1 — 'ayuda' se agrega al MISMO patrón que 'tema': una herramienta del riel que es,
// por debajo, el `modo` de siempre. Igual que 'tema', es store-wide/sin página propia — no borra
// el deep-link de arriba (que siempre arranca en `'paginas'`, nunca en ayuda).
type ModoEditor = 'paginas' | 'tema' | 'ayuda';

export default function EditorTiendaPantallaCompleta() {
  const params = useSearchParams();
  const seccionParam = params.get('seccion');
  const tarjetaNum = params.get('tarjeta') != null ? Number(params.get('tarjeta')) : NaN;
  const resaltar = seccionParam
    ? { seccion: seccionParam, slot: Number.isInteger(tarjetaNum) ? tarjetaNum : null }
    : null;
  const paginaObjetivo = seccionParam ? SECCIONES_TIENDA.find(c => c.seccion === seccionParam)?.pagina : undefined;
  const [pagina, setPagina] = useState<PaginaKey>(paginaObjetivo ?? 'home');
  const [modo, setModo] = useState<ModoEditor>('paginas');

  // § EDITOR-TIENDA-DESHACER-1 — el historial, el autoguardado agregado y el "Publicar todo" viven
  // en `TiendaPaginas` (dueña de `seccionRefs`/`ordenLocal`/`autoOrden`); esta pantalla sólo PIDE
  // acciones por el handle y DIBUJA el estado que `onEstadoGlobal` le reporta.
  const tiendaPaginasRef = useRef<TiendaPaginasHandle>(null);
  const [estadoGlobal, setEstadoGlobal] = useState<EstadoGlobalEditor>({
    estado: 'guardado', pendientes: 0, puedeDeshacer: false, puedeRehacer: false,
  });
  const [procesandoPublicacion, setProcesandoPublicacion] = useState(false);

  const deshacer = useCallback(() => tiendaPaginasRef.current?.deshacer(), []);
  const rehacer = useCallback(() => tiendaPaginasRef.current?.rehacer(), []);

  // ATAJOS DE TECLADO (§ el spec: "Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z… salvo dentro de un input con foco,
  // donde manda el deshacer nativo del campo"). El foco dentro del IFRAME se cubre por otro lado —
  // `EditorPuenteVivo.tsx` hace el MISMO chequeo sobre SU documento y reenvía por `postMessage`
  // (§ su docstring grande) — así que este listener sólo necesita mirar el foco de ESTA ventana
  // (la lista lateral, los botones de esta barra).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const modificador = e.metaKey || e.ctrlKey;
      if (!modificador || e.key.toLowerCase() !== 'z') return;
      const foco = document.activeElement;
      const esEditable = foco instanceof HTMLElement
        && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' || foco.isContentEditable);
      if (esEditable) return;
      e.preventDefault();
      if (e.shiftKey) rehacer(); else deshacer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deshacer, rehacer]);

  const publicarTodo = useCallback(async () => {
    setProcesandoPublicacion(true);
    try {
      await tiendaPaginasRef.current?.publicarPendientes();
      toast.success('Publicado — ya está en vivo.');
    } catch {
      toast.error('No se pudo publicar.');
    } finally {
      setProcesandoPublicacion(false);
    }
  }, []);

  const descartarTodo = useCallback(async () => {
    setProcesandoPublicacion(true);
    try {
      await tiendaPaginasRef.current?.descartarPendientes();
      toast.success('Cambios descartados — volviste a lo publicado.');
    } catch {
      toast.error('No se pudo descartar.');
    } finally {
      setProcesandoPublicacion(false);
    }
  }, []);

  // § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 — el popover de «Publicar» pide su resumen por el handle
  // (`TiendaPaginasHandle.resumenPendientes`) y, al tocar un ítem, navega por el MISMO handle —
  // salvo 'tema', cuyo `modo` es dueño de ESTA pantalla, no de `TiendaPaginas` (§ el docstring
  // grande de `ModoEditor`, arriba).
  const cargarResumenPublicar = useCallback(
    () => tiendaPaginasRef.current?.resumenPendientes() ?? Promise.resolve([]),
    [],
  );
  const irAItemResumen = useCallback((clave: string) => {
    if (clave === 'tema') { setModo('tema'); return; }
    setModo('paginas');
    tiendaPaginasRef.current?.irAItem(clave);
  }, []);

  // EL DISPOSITIVO ELEGIDO, recordado por navegador (§ 4.3 de DISENO.md: "recordado por el
  // navegador del admin"). Arranca en el default (Escritorio) y se re-lee de `localStorage` tras
  // montar — nunca durante el render del servidor, que no tiene storage; leerlo en un efecto evita
  // el mismatch de hidratación que leerlo síncrono en el render inicial produciría.
  const [dispositivo, setDispositivoState] = useState<DispositivoKey>(DISPOSITIVO_DEFECTO);
  useEffect(() => {
    try {
      setDispositivoState(dispositivoDesdeStorage(localStorage.getItem(CLAVE_DISPOSITIVO_EDITOR)));
    } catch {
      // Modo privado / storage inaccesible: se queda en el default — nunca revienta por esto.
    }
  }, []);
  const elegirDispositivo = useCallback((d: DispositivoKey) => {
    setDispositivoState(d);
    try { localStorage.setItem(CLAVE_DISPOSITIVO_EDITOR, d); } catch { /* no-op, ver arriba */ }
  }, []);

  // § EDITOR-AYUDA-RECORRIDO-1 — EL RECORRIDO GUIADO. `ofertaVisible` es el banner "¿Ves un
  // recorrido de un minuto?" (sólo la PRIMERA VEZ que esta cuenta abre el editor, § el spec);
  // `recorridoActivo` es el overlay de pasos en sí (`RecorridoEditor.tsx`). Los dos viven acá, no
  // en `TiendaPaginas`, por la misma razón que `modo`: son del EDITOR entero, no de una página.
  //
  // LA MARCA DE "VISTO" SE ESCRIBE AL OFRECER, no al elegir un botón — una vez que el banner
  // apareció, no vuelve a aparecer en esta cuenta, elija "Ver" o "Ahora no" (§ el spec: "se ofrece
  // la PRIMERA VEZ"). `try/catch` alrededor de las dos operaciones de `localStorage` —leer y
  // escribir—, mismo patrón que `elegirDispositivo`/`dispositivoDesdeStorage` arriba: sin storage
  // (modo privado), se ofrece de nuevo la próxima vez y nada se rompe.
  const [ofertaVisible, setOfertaVisible] = useState(false);
  const [recorridoActivo, setRecorridoActivo] = useState(false);
  useEffect(() => {
    try {
      if (recorridoEstaVisto(localStorage.getItem(CLAVE_RECORRIDO_VISTO))) return;
      setOfertaVisible(true);
      localStorage.setItem(CLAVE_RECORRIDO_VISTO, '1');
    } catch {
      // Modo privado / storage inaccesible: no se marca nada, así que se ofrece de nuevo la
      // próxima vez — nunca revienta por esto.
    }
  }, []);

  // AL INICIAR (desde la oferta o desde "Ver el recorrido" de Ayuda, § `AyudaCentro.tsx`), el
  // recorrido normaliza el punto de partida a lo que SUS PRIMEROS DOS pasos necesitan —`modo:
  // 'paginas'` y `pagina: 'home'`, para que el lienzo y el panel muestren la lista de secciones de
  // Inicio en vez de Estilo/Ayuda—, pero NO toca `nivelActivo` (interno de `TiendaPaginas`, sin
  // forma de resetearlo desde acá): si una sección ya estaba abierta, los pasos "hero"/"agregar
  // sección" se saltan solos (§ RecorridoEditor.tsx, el mismo mecanismo que cualquier otra vez que
  // un objetivo no está disponible) — el recorrido REFLEJA el editor, nunca lo reconfigura a fondo.
  const iniciarRecorrido = useCallback(() => {
    setModo('paginas');
    setPagina('home');
    setOfertaVisible(false);
    setRecorridoActivo(true);
  }, []);
  const cerrarOferta = useCallback(() => setOfertaVisible(false), []);
  const cerrarRecorrido = useCallback(() => setRecorridoActivo(false), []);

  // EL NOMBRE DE LA TIENDA en la barra (§ EDITOR-TIENDA-SHELL-1, REDISENO.md § 3: "nombre de la
  // tienda" junto al volver). `useSiteSettings()` ya tiene provider acá — lo monta
  // `app/(admin)/editor/layout.tsx` desde `EDITOR-TIENDA-TEMA-PROVEEDOR-1` — así que no hace falta
  // un fetch propio.
  const settings = useSiteSettings();

  // § EDITOR-TIENDA-SHELL-1 — EL RIEL (Secciones · Estilo · Medios · Ayuda, § EDITOR-AYUDA-1).
  // «Secciones»/«Estilo»/«Ayuda» son el `modo` de siempre, vestido con la fachada nueva; «Medios»
  // es un overlay momentáneo (`medioAbierto`), no un cuarto `modo` — cerrarlo vuelve a lo que ya
  // estaba, sin tener que recordar a qué `modo` regresar.
  const [medioAbierto, setMedioAbierto] = useState(false);
  const herramientaActiva: HerramientaRiel = medioAbierto ? 'medios' : modo === 'tema' ? 'estilo' : modo === 'ayuda' ? 'ayuda' : 'secciones';
  const elegirHerramienta = useCallback((h: HerramientaRiel) => {
    if (h === 'medios') { setMedioAbierto(true); return; }
    setModo(h === 'estilo' ? 'tema' : h === 'ayuda' ? 'ayuda' : 'paginas');
  }, []);
  // § EDITOR-AYUDA-1 — un «?» DENTRO de `TiendaPaginas` (la miga de una sección, «Inicio», «Estilo»)
  // ya decidió QUÉ guía mostrar en su propio estado; lo único que falta es que ESTE componente
  // ponga `modo: 'ayuda'`, porque `modo` es suyo. Nunca toca `medioAbierto` — abrir ayuda desde una
  // sección no debería cerrar una hoja de Medios que, de hecho, no puede estar abierta a la vez
  // (son overlays/modos mutuamente excluyentes en la práctica, pero esta función no lo asume).
  const abrirAyudaDesdeHijo = useCallback(() => setModo('ayuda'), []);

  // EDITOR-VISUAL-MARCO-1 — el selector de página pasó de `role="tablist"` a un desplegable
  // (§ REDISENO.md § 3), MISMO mecanismo que `ResumenPublicar` (Popover + `useContenedorDunaPortal`,
  // para que el menú porteleado herede la tipografía de `.admin-shell`).
  const contenedorPopover = useContenedorDunaPortal();
  const [menuPaginaAbierto, setMenuPaginaAbierto] = useState(false);
  const paginaActualLabel = LABEL_PAGINA_SELECTOR[pagina] ?? PAGINAS.find(p => p.key === pagina)?.label ?? pagina;

  return (
    // § EDITOR-VISUAL-NIVELES-1 — UN SOLO `TooltipProvider` para toda esta pantalla (el «?» de
    // `AyudaCampo.tsx`, montado dentro de `TiendaPaginas` más abajo): este grupo de rutas NO monta
    // `AdminChrome` (§ el docstring de `editor/layout.tsx`, "sin sidebar, sin topbar"), que es donde
    // vive el ÚNICO `TooltipProvider` de `/admin/*` — sin éste, un `Tooltip` acá se queda sin su
    // contexto. Mismo `delayDuration` que `AdminChrome.tsx`, para que el hover se sienta igual en las
    // dos superficies del panel.
    <TooltipProvider delayDuration={300}>
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--duna-bg)', zIndex: 0 }}>
      {/* EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3) — la barra calcada del prototipo: ‹ volver · tienda
          | Página ▾ · dispositivo | deshacer/rehacer · estado · Vista previa · Publicar. Tres
          secciones `flex:1` (izq/der) con el centro de ancho natural — así el grupo central queda
          SIEMPRE centrado, sea cual sea el ancho de los otros dos (el mismo truco del prototipo:
          `.tb-l,.tb-r{flex:1}`, `.tb-c` sin flex). */}
      <div className="editor-tb">
        <div className="editor-tb-l">
          <Link href="/admin/tienda" className="duna-btn duna-btn--ghost duna-btn--icon" style={{ flexShrink: 0 }} aria-label="Volver al panel" title="Volver al panel">
            <ArrowLeft aria-hidden />
          </Link>
          <div className="editor-vr" aria-hidden />
          {/* § EDITOR-TIENDA-SHELL-1 — el nombre de la tienda (REDISENO.md § 3), ahora con el avatar
              de iniciales del prototipo («store-av»). */}
          <div className="editor-store">
            <span className="editor-store-av" aria-hidden>{(settings.nombre.trim().charAt(0) || '·').toUpperCase()}</span>
            <span className="editor-store-t">
              <b>{settings.nombre}</b>
              <small>Editor de tienda</small>
            </span>
          </div>
        </div>

        <div className="editor-tb-c">
          {/* § EDITOR-TIENDA-SHELL-1 — SÓLO las páginas: «Tema» ya no es una pestaña de esta fila, es
              la herramienta «Estilo» del riel (§ el comentario grande de arriba). EDITOR-VISUAL-
              MARCO-1 cambia la FORMA: de `role="tablist"` a un desplegable único — "Página: Inicio ▾"
              (REDISENO.md § 3) — que ABRE la MISMA acción de siempre (`setPagina` + `setModo
              ('paginas')`), sólo que detrás de un Popover en vez de tres pestañas sueltas. */}
          <Popover open={menuPaginaAbierto} onOpenChange={setMenuPaginaAbierto}>
            <PopoverTrigger asChild>
              <button type="button" className="editor-pgsw" aria-haspopup="menu" aria-expanded={menuPaginaAbierto}>
                <FileText aria-hidden />
                <span className="k">Página</span>
                <span>{paginaActualLabel}</span>
                <ChevronDown aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" container={contenedorPopover} className="editor-pgmenu">
              {PAGINAS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  aria-current={modo === 'paginas' && p.key === pagina}
                  onClick={() => { setPagina(p.key); setModo('paginas'); setMenuPaginaAbierto(false); }}
                  className={`editor-pgm${modo === 'paginas' && p.key === pagina ? ' is-on' : ''}`}
                >
                  <span>{LABEL_PAGINA_SELECTOR[p.key] ?? p.label}</span>
                  <small>{urlDePagina(p.key)}</small>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* EDITOR-VISUAL-MARCO-1 — el segmentado de dispositivo: de tres `.duna-pill` con ícono+texto
              a `.duna-seg`/`.duna-seg__item` (ya en el paquete, § CLAUDE.md "el pill FILTRA un
              conjunto; el segmentado cambia el MODO de ver lo mismo — exactamente uno"), SÓLO ícono
              como el prototipo. El `title` conserva el nombre + ancho que el label visible daba. */}
          <div className="duna-seg" role="group" aria-label="Dispositivo">
            {DISPOSITIVOS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={dispositivo === key}
                title={`${label} · ${ANCHOS_DISPOSITIVO[key]}px`}
                onClick={() => elegirDispositivo(key)}
                className={`duna-seg__item${dispositivo === key ? ' is-on' : ''}`}
                // § EDITOR-AYUDA-RECORRIDO-1 — `data-tour="telefono"`: el objetivo del paso «Ver en
                // el teléfono» del recorrido guiado. Sólo el botón de esta key lo lleva; en los
                // demás el atributo queda `undefined` y React lo omite del DOM.
                data-tour={key === 'telefono' ? 'telefono' : undefined}
              >
                <Icon aria-hidden />
              </button>
            ))}
          </div>
        </div>

        {/* § EDITOR-TIENDA-DESHACER-1 — el cluster de estado: deshacer/rehacer, el indicador de
            autoguardado AGREGADO, y el botón de `ResumenPublicar` (§ EDITOR-TIENDA-PUBLICAR-
            RESUMEN-1, abajo) — que se oculta solo cuando no hay nada pendiente: un botón "Publicar"
            sin nada que publicar no le dice nada al dueño que no sepa ya. */}
        <div className="editor-tb-r">
          <div role="group" aria-label="Deshacer y rehacer" style={{ display: 'flex', gap: 'var(--duna-space-1)' }}>
            <button
              type="button"
              className="duna-btn duna-btn--ghost duna-btn--icon"
              onClick={deshacer}
              disabled={!estadoGlobal.puedeDeshacer}
              aria-label="Deshacer"
              title="Deshacer (Ctrl/Cmd+Z)"
            >
              <Undo2 aria-hidden />
            </button>
            <button
              type="button"
              className="duna-btn duna-btn--ghost duna-btn--icon"
              onClick={rehacer}
              disabled={!estadoGlobal.puedeRehacer}
              aria-label="Rehacer"
              title="Rehacer (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 aria-hidden />
            </button>
          </div>

          <span className="duna-caption" role="status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--duna-space-1)' }}>
            <span
              aria-hidden
              style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: estadoGlobal.estado === 'error' ? 'var(--duna-bad)' : 'var(--duna-ok)',
              }}
            />
            {estadoGlobal.estado === 'guardando' ? 'Guardando…'
              : estadoGlobal.estado === 'error' ? 'No se pudo guardar'
              : 'Guardado'}
          </span>

          {/* § EDITOR-TIENDA-SHELL-1 — «Vista previa» (REDISENO.md § 3): la ruta REAL publicada de la
              página activa, en pestaña nueva — gemela de "Ver la tienda" que ya vive dentro de cada
              tarjeta en edición (`TiendaSeccionEditor.tsx`), generalizada a cualquier página del
              editor. SÓLO en modo 'paginas': el tema es store-wide y no tiene una página propia a la
              que apuntar — con él puesto, la página activa de abajo sigue siendo la referencia. */}
          <a href={urlDePagina(pagina)} target="_blank" rel="noreferrer" className="duna-btn duna-btn--ghost duna-btn--sm">
            <Eye aria-hidden /> Vista previa
          </a>

          {/* § EDITOR-TIENDA-PUBLICAR-RESUMEN-1 — "Descartar" y "Publicar" dejaron de ser dos
              botones sueltos en la barra: viven DENTRO del popover de `ResumenPublicar`, junto a la
              lista en palabras de qué va a publicarse. El botón de la barra ahora es uno solo
              ("Publicar", con el recuento ámbar) y abre ese popover. */}
          <ResumenPublicar
            pendientes={estadoGlobal.pendientes}
            deshabilitado={estadoGlobal.estado !== 'guardado'}
            procesando={procesandoPublicacion}
            cargarResumen={cargarResumenPublicar}
            onPublicar={publicarTodo}
            onDescartar={descartarTodo}
            onIrAItem={irAItemResumen}
          />
        </div>
      </div>

      {/* § EDITOR-TIENDA-SHELL-1 (REDISENO.md § 3) — EL RIEL a la izquierda de todo el cuerpo:
          Secciones · Estilo · Medios. Es una fila MÁS ancha que la barra superior (Riel | Panel |
          Lienzo), por eso vive en este `flex` separado y no dentro de la barra. */}
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <Riel activo={herramientaActiva} onElegir={elegirHerramienta} />
        {/* § EDITOR-PANEL-PIEL-1 — SIN padding propio: el riel y el panel quedan PEGADOS, como en el
            prototipo (`.rail`/`.panel`, sin espacio entre ellos). Antes este div tenía
            `padding: var(--duna-space-6)` sin fondo propio, así que el crema de la raíz del editor
            (`--duna-bg`, arriba) se colaba entre el riel y el panel; el padding que el panel SÍ
            necesita ahora vive DENTRO de `.editor-panel` (editor.css). */}
        <div className="editor-cuerpo">
          <TiendaPaginas
            ref={tiendaPaginasRef}
            pagina={pagina}
            resaltar={resaltar}
            dispositivo={dispositivo}
            modo={modo}
            onAbrirAyuda={abrirAyudaDesdeHijo}
            onEstadoGlobal={setEstadoGlobal}
            onIniciarRecorrido={iniciarRecorrido}
          />
        </div>
      </div>

      {/* § EDITOR-TIENDA-SHELL-1 — «Medios» abre la VISTA NUEVA: hoy no hay de dónde leer un
          listado real de imágenes/videos de la tienda (medido — censo por grep, cero resultados de
          `.list()` sobre el storage), así que el lugar queda listo y lo dice, en vez de fingir un
          catálogo que no existe. */}
      <VistaNueva
        abierto={medioAbierto}
        onCerrar={() => setMedioAbierto(false)}
        titulo="Medios"
        descripcion="Las imágenes y videos de la tienda — todavía sin un listado que mostrar."
      >
        <p className="duna-sub">
          Todavía no hay un catálogo de medios que mostrar acá: cada imagen o video se sube desde el
          campo de la sección que la usa. Cuando la tienda tenga de dónde leer todo lo subido, este
          lugar lista ese catálogo.
        </p>
      </VistaNueva>

      {/* § EDITOR-AYUDA-RECORRIDO-1 — la oferta y el recorrido en sí, nunca los dos a la vez: la
          oferta se cierra (`cerrarOferta` vía `onCerrar`, o `iniciarRecorrido` vía `onVer`) antes de
          que el recorrido pueda estar activo. */}
      {ofertaVisible && !recorridoActivo && (
        <OfertaRecorrido onVer={iniciarRecorrido} onCerrar={cerrarOferta} />
      )}
      <RecorridoEditor activo={recorridoActivo} onCerrar={cerrarRecorrido} />
    </div>
    </TooltipProvider>
  );
}
