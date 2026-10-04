"use client";
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, Search, ChevronDown } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { motion, AnimatePresence, useIsPresent } from 'framer-motion';
import NavSearch from './NavSearch';
import { Logo } from '@/components/storefront/Logo';
import { altoLogoNavMovilClase, altoLogoMenuLateralClase } from '@/lib/config/marca-logo';
import { STOREFRONT_TIENE_MARK } from '@/lib/config/storefront-marca';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { useModoEditorActivo } from '@/components/storefront/ModoEditor';
import { tratamientoNav } from '@/lib/config/esquema-style';
import { varianteDeBanda, itemsDeMenu, menuCtaHref, type MenuItemId, type BandaId } from '@/lib/config/site-content-defaults';
import { esInstanciaId } from '@/lib/config/secciones-instancias';
import {
  direccionScroll, navOculto, debeActualizarTratamientoNav, type DireccionScroll,
  DRAWER_MOVIL_DISTANCIA_PX, DRAWER_MOVIL_DURACION_S, DRAWER_MOVIL_EASE,
  retardoEntradaDrawerMovil, retardoSalidaDrawerMovil,
} from '@/lib/animation';
import { esClickAfuera } from '@/lib/cierre-afuera';
import { contenedorAnchoClase } from '@/lib/config/themes';

// ENTRADA ESCALONADA del drawer `pantallaCompleta` (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1) — MEDIDA
// contra `.mobile-nav.is-open a.m-link` del prototipo (`docs/prototipos/cafeone/css/app.css:311-321`):
// `animation:m-in 420ms var(--ease-out) forwards; animation-delay:calc(var(--i,0) * 60ms + 80ms)`,
// con `@keyframes m-in{to{opacity:1;transform:none}}` desde `opacity:0;transform:translateY(14px)`.
// `--ease-out` es `cubic-bezier(.22,.61,.36,1)` (`docs/prototipos/cafeone/ds/motion.css:2`). Es
// DECLARATIVA (`variants` + `animate`, no un valor de scroll ligado) — el MISMO mecanismo que ya usa
// el dropdown de hoy (`motion.div initial/animate/exit`) — así que `MotionConfig
// reducedMotion="user"` (`ReducedMotionProvider`, `lib/animation.ts`, montado en
// `app/(storefront)/layout.tsx`) la congela sola bajo `prefers-reduced-motion`, sin un guard propio
// (a diferencia de `useProgresoAcomodo`/`useScroll`+`useTransform` de `BrandStoryCentrada`, que SÍ
// necesitan `useReducedMotion()` explícito porque ese provider sólo intercepta animaciones
// DISPARADAS por `.start()` — ver el comentario de esa sección).
// § MENU-MOVIL-CIERRE-DESLIZANDO-1 — `exit` RECORRE la entrada EN REVERSA: misma propiedad
// (opacity+y), misma distancia y misma duración/curva que `visible` (las cinco constantes/funciones
// puras viven en `lib/animation.ts`, § el bloque "EL CIERRE del drawer móvil RECORRE la entrada EN
// REVERSA" — el asiento completo del porqué está ahí, no acá), pero el STAGGER se invierte por
// índice — el ítem que apareció ÚLTIMO es el PRIMERO en retirarse, deshaciendo la cascada en el
// orden exacto opuesto al que la construyó. Antes `exit` no existía: los ítems no tenían variante de
// salida propia, así que al desmontar el panel se quedaban en `visible` (opacity:1) y sólo se
// apagaban por el fade DEL PANEL (8px/220ms) — nunca por su propio desplazamiento de 14px/420ms.
// `custom` pasa a `{i, total}` (antes sólo `i`) porque el reverso necesita saber cuántos ítems hay en
// total para invertir el índice.
const ENTRADA_ESCALONADA_DRAWER = {
  hidden: { opacity: 0, y: DRAWER_MOVIL_DISTANCIA_PX },
  visible: ({ i }: { i: number; total: number }) => ({
    opacity: 1, y: 0,
    transition: { duration: DRAWER_MOVIL_DURACION_S, ease: DRAWER_MOVIL_EASE, delay: retardoEntradaDrawerMovil(i) },
  }),
  exit: ({ i, total }: { i: number; total: number }) => ({
    opacity: 0, y: DRAWER_MOVIL_DISTANCIA_PX,
    transition: { duration: DRAWER_MOVIL_DURACION_S, ease: DRAWER_MOVIL_EASE, delay: retardoSalidaDrawerMovil(i, total) },
  }),
};

// § MENU-MOVIL-CIERRE-DESLIZANDO-1 — el stagger EN REVERSA estira el cierre de ~220ms (el panel
// solo) a ~600ms (el último ítem en terminar de salir, índice 0, con el retardo más largo). Mientras
// tanto el panel es un `fixed inset-0 z-50` — SIGUE en el DOM (AnimatePresence espera a que el ÍTEM
// más lento termine antes de desmontar el árbol entero), y sin esto bloquearía clics sobre la página
// de abajo durante esa cola, AUNQUE ya sea invisible (opacity llega a 0 a los ~220ms, el mismo
// momento de siempre — sólo el DOM tarda más en irse). Un `style` condicional a `mobileOpen` en el
// propio JSX NO alcanza: en el instante en que `mobileOpen` pasa a `false`, la expresión
// `mobileOpen && (<motion.div .../>)` deja de crear un elemento nuevo —AnimatePresence sigue
// animando el ÚLTIMO elemento que SÍ se creó, con las props que tenía AL CREARSE (`pointerEvents:
// 'auto'` congelado)—, así que nunca llega una actualización. `useIsPresent()` sí sirve porque lee
// CONTEXTO (que AnimatePresence actualiza en vivo al empezar el exit), no props heredadas — por eso
// vive en un componente PROPIO: el hook sólo resuelve bien dentro del árbol que AnimatePresence
// gestiona, no en `StoreNav` (que está POR ENCIMA, es quien la renderiza).
function BloqueaClicksAlSalir({ children }: { children: ReactNode }) {
  const presente = useIsPresent();
  return <div style={presente ? undefined : { pointerEvents: 'none' }}>{children}</div>;
}

export default function StoreNav() {
  // § EDITOR-TIENDA-CROMO-1 — el ENCABEZADO y el MENÚ entran al editor como el resto de las
  // secciones: marcados con `data-editor-seccion` SÓLO en modo editor (el mismo contrato que ya
  // cumple `data-editor-seccion` vía `bandaNodo()` en `app/(storefront)/page.tsx`) — fuera de él
  // (el 99.99% del tráfico), cero bytes de más.
  const enModoEditor = useModoEditorActivo();
  const { nombre, tagline } = useSiteSettings();
  // El MENÚ es DATO (§ CROMO-MENU-COMO-DATO-1): `itemsDeMenu` resuelve las etiquetas + el orden
  // editables sobre el set CERRADO de tres ítems, y sigue gateando "Nosotros"/"Suscripciones" por
  // `paginas.*.visible`, SIN CAMBIO (renombrar no es encender). Con `content.menu` en su default —
  // ningún tenant lo edita— `links` es EXACTAMENTE el array de hoy: label/path de las tres rutas, en
  // el mismo orden. El CTA (`menuCtaHref`) nace apagado (`null`) hasta que el dueño lo configure.
  // Cada ítem puede llevar además un `panel` (§ MUESTRARIO-MEGA-MENU-1) — AUSENTE para todo tenant
  // que no lo declare (Nayoli), así que el `.map` de abajo sigue byte-idéntico sin tocar nada.
  const content = useSiteContent();
  const { esquemas, tema, orden, cromo, navTratamiento, navWordmark, navDrawerMovil, logo, seccionesHome } = content;
  const links = itemsDeMenu(content);
  const ctaHref = menuCtaHref(content);
  // § MENU-MOVIL-CIERRE-DESLIZANDO-1 — el total de filas de la cascada del drawer móvil
  // `pantallaCompleta` (los `links`, más "Rastrear Pedido", más el CTA si está encendido), que
  // `ENTRADA_ESCALONADA_DRAWER.exit` necesita para invertir el índice del stagger al cerrar.
  const totalEntradasDrawerMovil = links.length + 1 + (ctaHref ? 1 : 0);
  // `navDireccionActiva` (§ CROMO-NAV-DIRECCION-SCROLL-1) se lee ACÁ ARRIBA, no sólo junto a `oculto`
  // más abajo (que sigue siendo su otro consumidor): el listener de scroll también lo necesita, para
  // decidir si CONGELA el tratamiento al bajar (§ CROMO-NAV-SIN-DESTELLO-1, el bloque de abajo).
  const navDireccionActiva = navTratamiento.direccion;
  // § RADIOS-UN-SOLO-RITMO-1 — gate del owner: "botones (incluido… los del nav)" toman el mismo radio
  // chico que el ojo/carrito de las tarjetas (`sf-radio-lg`, § SUSCRIPCION-FOTO-LEGIBLE-Y-ACCIONES-
  // REDONDEADAS-1). Los botones de ícono del nav (buscar/carrito, acá y en el drawer móvil) eran
  // `rounded-full` SIEMPRE, sin branch por tema — el mismo patrón que `ProductCard.tsx`/
  // `GrindChooserRiel.tsx` ya resolvieron para el ojo/carrito. `formaCustom` es el MISMO gate que esos
  // dos archivos (`tema.forma !== null`): Suave/Nayoli conserva `rounded-full` byte a byte.
  const formaCustom = tema.forma !== null;

  const [scrolled, setScrolled] = useState(false);
  // COMPORTAMIENTO POR DIRECCIÓN (§ CROMO-NAV-DIRECCION-SCROLL-1, `navTratamiento.direccion`):
  // `scrollY`/`direccion` alimentan `navOculto` (`lib/animation.ts`) para decidir si el encabezado
  // se traduce fuera de vista. Van en el MISMO listener de scroll que ya calcula `scrolled` — un
  // segundo listener sería un segundo lugar leyendo `window.scrollY` sin necesidad.
  const [scrollY, setScrollY] = useState(0);
  const [direccion, setDireccion] = useState<DireccionScroll>('arriba');
  const scrollYAnteriorRef = useRef(0);
  // ACCESIBILIDAD: si el foco del teclado está DENTRO del encabezado, nunca se oculta (§ el spec de
  // este slice) — `onFocus`/`onBlur` en React BURBUJEAN (a diferencia de los nativos `focus`/`blur`),
  // así que un botón/enlace CUALQUIERA del `<header>` los dispara sin que haga falta un listener por
  // control. `e.currentTarget.contains(relatedTarget)` distingue "el foco se movió a OTRO control del
  // MISMO header" (sigue dentro) de "el foco se fue del header" (sale).
  const [focoDentro, setFocoDentro] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // § MENU-MOVIL-COMO-CAFEONE-1 — EL SUBMENÚ DEL DRAWER MÓVIL: un acordeón propio del panel
  // `pantallaCompleta`, SEPARADO de `panelAbierto` (arriba, el mega-menú DESKTOP) a propósito — el
  // `<nav>` que dispara `panelAbierto` vive dentro de `hidden lg:flex`, así que en el drawer móvil
  // (`<lg`) ese botón nunca está montado: compartir el mismo estado no ahorraría nada, sólo
  // acoplaría dos superficies que nunca conviven en el DOM. Guarda el id del ítem CON `panel`
  // (`MenuItemId`, no un boolean) por la MISMA razón que `panelAbierto`: sólo uno a la vez.
  const [mobileSubAbierto, setMobileSubAbierto] = useState<MenuItemId | null>(null);
  // EL PANEL DESPLEGABLE (§ MUESTRARIO-MEGA-MENU-1): UN ítem a la vez (`panelAbierto` guarda su id,
  // no un boolean), como su fuente (`content.menu.panelItem`). Se cierra con Escape y con el
  // backdrop — MISMO patrón que `NavSearch` (§ ese componente, "el patrón del repo para menús") — y
  // al cambiar de ruta (un enlace de adentro navegó).
  const [panelAbierto, setPanelAbierto] = useState<MenuItemId | null>(null);
  // EL CLICK-AFUERA (§ NAV-CIERRE-CLICK-AFUERA-1): los nodos "adentro" para el mega-menú — el
  // panel desplegable Y el `<button>` que lo abre/cierra (sólo UNO puede tener `l.panel` a la vez,
  // § `panelDeMenuItem`, así que un ref simple alcanza; no hace falta un `Map` por id).
  const megaPanelRef = useRef<HTMLDivElement>(null);
  const megaTriggerRef = useRef<HTMLButtonElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  // EL DISPARADOR DEL DRAWER MÓVIL (§ MENU-MOVIL-MARGEN-Y-CENSO-TRANSICIONES-1) — el botón
  // hamburguesa/X de la fila de acciones del header (abajo), para devolverle el foco al cerrar por
  // X/Esc, MISMO patrón que `megaTriggerRef`/`searchTriggerRef` arriba (§ NAV-CIERRE-CLICK-AFUERA-1).
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const { count, openCart } = useCartStore();
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => { setPanelAbierto(null); }, [pathname]);
  // § MENU-MOVIL-COMO-CAFEONE-1 — el acordeón del drawer móvil se cierra al navegar (mismo
  // criterio que `panelAbierto` arriba) Y al CERRAR el drawer sin navegar (botón cerrar / tap en el
  // scrim): sin esto, reabrir el menú más tarde mostraría el submenú ya expandido de la vez
  // anterior, que el visitante nunca pidió en ESTA apertura.
  useEffect(() => { setMobileSubAbierto(null); }, [pathname]);
  useEffect(() => { if (!mobileOpen) setMobileSubAbierto(null); }, [mobileOpen]);

  // CIERRA Y DEVUELVE EL FOCO al disparador (§ NAV-CIERRE-CLICK-AFUERA-1) — Escape y el
  // click-afuera comparten esta salida; un panel que se abrió desde un botón no debe dejar el
  // foco flotando en un nodo que puede haber salido del árbol. El `.focus()` va DIFERIDO a un
  // macrotask (`setTimeout(0)`) — MEDIDO en `NavSearch.tsx` (mismo mecanismo, ver su docstring):
  // tras un `pointerdown` de click-afuera el navegador aplica su propio foco por defecto DESPUÉS
  // de correr los listeners, y pisa un `.focus()` síncrono.
  const cerrarPanelYDevolverFoco = useCallback(() => {
    setPanelAbierto(null);
    setTimeout(() => megaTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!panelAbierto) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarPanelYDevolverFoco(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [panelAbierto, cerrarPanelYDevolverFoco]);

  // EL CLICK-AFUERA propiamente — MISMA causa y misma salida que `NavSearch.tsx` (§ el docstring
  // de `lib/cierre-afuera.ts`): el fondo `fixed inset-0` de abajo dejaba de cubrir el viewport en
  // el estado "sólido" del encabezado (`backdrop-filter` lo confinaba a los ~72px de la barra), así
  // que su `onClick` (retirado en esta tanda) sólo cerraba mientras el header flotaba sin scroll.
  // `pointerdown` en CAPTURA sobre `document`, decidido por contención de árbol, no depende de eso.
  useEffect(() => {
    if (!panelAbierto) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (esClickAfuera(e.target, [megaPanelRef.current, megaTriggerRef.current])) {
        cerrarPanelYDevolverFoco();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [panelAbierto, cerrarPanelYDevolverFoco]);

  // § MENU-MOVIL-MARGEN-Y-CENSO-TRANSICIONES-1 — EL CIERRE DEL DRAWER MÓVIL GANA Escape + devuelve
  // el foco, MISMO patrón que `cerrarPanelYDevolverFoco`/`cerrarYDevolverFoco` (`NavSearch.tsx`) de
  // arriba: el X y Esc dejan el foco en el botón hamburguesa que abrió el panel; un tap en un
  // enlace NO lo devuelve — mismo criterio que `NavSearch` usa `onClose` a secas para sus
  // resultados (§ ese componente), porque el visitante ya está navegando a otra pantalla.
  //
  // ANTES DE ESTE SLICE, Escape NO CERRABA EL DRAWER — medido por ejecución (Playwright contra el
  // preset CORTE), no supuesto: con el drawer abierto, `Escape` no tenía listener alguno y el panel
  // seguía montado. El cierre por X/tap SÍ animaba la salida (opacity 1→0 + y 0→-8px en ~220ms,
  // medido cuadro a cuadro) — la "de golpe" del spec no era la transición del panel, sino la
  // ausencia total de una salida por teclado.
  //
  // GATEADO a `navDrawerMovil.variante === 'pantallaCompleta'`: Nayoli usa el dropdown viejo
  // (`variante === 'dropdown'`, sin cambio), que nunca cerró con Escape — agregarlo sin el gate
  // sería CONDUCTA nueva para Nayoli, y el spec pide "Nayoli no se mueve ni en píxeles ni en
  // conducta". `false` (todo tenant salvo CORTE) → el efecto de abajo nunca engancha el listener.
  const cerrarMobileYDevolverFoco = useCallback(() => {
    setMobileOpen(false);
    setTimeout(() => mobileTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (navDrawerMovil.variante !== 'pantallaCompleta' || !mobileOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarMobileYDevolverFoco(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [navDrawerMovil.variante, mobileOpen, cerrarMobileYDevolverFoco]);

  const itemPanel = links.find((l) => l.id === panelAbierto)?.panel ?? null;

  useEffect(() => {
    const fn = () => {
      const actual = window.scrollY;
      // `direccionScroll` compara SÓLO contra el frame anterior — sin mínimo de movimiento, medido
      // contra el tema real (§ el docstring de cabecera de `lib/animation.ts`).
      const direccionActual = direccionScroll(actual, scrollYAnteriorRef.current);
      // EL DESTELLO AL BAJAR — § CROMO-NAV-SIN-DESTELLO-1: `setScrolled(actual > 20)` corría en TODO
      // frame, sin mirar la dirección, así que al bajar el tratamiento caía a SÓLIDO en scrollY=21 —
      // muy antes de que `navOculto` (80px) empezara a ocultar el header — dejando una ventana visible
      // de nav ya sólido y todavía sin ocultar (medido: 21 a 79px). `debeActualizarTratamientoNav`
      // (`lib/animation.ts`) congela `scrolled` mientras se BAJA (el tratamiento que ya tenía se
      // conserva hasta que se oculta) y lo re-evalúa siempre al SUBIR — igual que hoy para todo preset
      // que no declare `navTratamiento.direccion` (`debeActualizarTratamientoNav` da `true` siempre en
      // ese caso, así que `setScrolled` corre en cada frame, byte-idéntico).
      setScrolled((anterior) =>
        debeActualizarTratamientoNav(navDireccionActiva, direccionActual) ? actual > 20 : anterior,
      );
      setDireccion(direccionActual);
      scrollYAnteriorRef.current = actual;
      setScrollY(actual);
    };
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, [navDireccionActiva]);

  // El nav trata a la PRIMERA banda del orden (§ eje 5 parte c) con UNA sola regla,
  // `tratamientoNav` (esquema-style.ts): flota TRANSPARENTE sólo en home+sin-scroll Y sobre una
  // banda UNIFORME; si flota, su TEXTO va claro sólo si esa banda queda OSCURA. CON esquema
  // asignado la darkness es el cálculo de contraste de siempre; SIN esquema es la CANÓNICA
  // declarada de la banda (`bandaOscuraCanonica` en site-content-defaults.ts: hero/brandStory/
  // subscriptionCTA oscuras, el resto claras) — YA NO asume que la primera banda es siempre el
  // hero. El orden default arranca en 'hero' con variante 'curtina' (uniforme, oscura, sin
  // esquema) → byte-idéntico al `isHome && !scrolled` de hoy.
  //
  // MINA CERRADA (era HUECO CONOCIDO): `heroEsOscuro` era específica del hero y su fallback SIN
  // esquema asumía SIEMPRE la canónica del hero (oscura) para CUALQUIER banda primera — correcto
  // sólo mientras `orden[0]` era necesariamente 'hero'. El eje 5 (el orden como dato) rompió esa
  // garantía; `bandaEsOscura` toma la canónica DE LA BANDA que resulte primera, no la del hero.
  //
  // MINA CERRADA #2 (§ EJE-5-VARIANTES-HERO): la canónica de la banda primera dejó de ser fija cuando
  // el hero ganó variantes de composición — 'ficha' es CLARA, al revés de 'curtina'. `bandaEsOscura`
  // ahora recibe también la VARIANTE de esa banda (`varianteDeBanda`); sin esto, un hero·ficha
  // primero-y-sin-esquema habría dejado el nav con texto claro sobre banda clara.
  //
  // MINA CERRADA #3 (§ EJE-5-NAV-UNIFORME): flotar transparente ASUMÍA que la primera banda siempre
  // admite un único color de texto — cierto mientras esa banda era la curtina (foto oscura a sangre)
  // o un esquema asignado (un solo color derivado). La ficha del hero es BI-TONAL —crema a la
  // izquierda, foto oscura a la derecha— y ningún color único se lee sobre las dos mitades; el gate
  // visual del owner lo encontró (texto oscuro del nav ilegible sobre la foto). `tratamientoNav`
  // pregunta PRIMERO si la banda es uniforme (`bandaUniforme`, § site-content-defaults.ts): si no lo
  // es, el nav cae a SÓLIDO desde el primer render, sin importar scroll ni esquema.
  //
  // MINA CERRADA #4 (§ SECCIONES-INSTANCIAS-VIVO-1): `orden` YA LLEGA RESUELTO COMPLETO desde el
  // contexto —`resolverOrdenCompleto` corre DENTRO de `resolverSiteContent` (§ site-content-
  // defaults.ts), bandas ∪ instancias de `seccionesHome`—, así que NO hay que volver a filtrarlo con
  // `resolverOrden` (la vieja, sólo-bandas): hacerlo DESCARTARÍA cualquier instancia que resultara
  // primera, y `primera` caería al primer BANDA real en su lugar — el nav trataría una sección
  // agregada puesta primera como si no existiera. `orden[0]` puede ser una `BandaId` o el id de una
  // instancia (`inst:…`); `varianteDeBanda` sólo sabe de bandas (su índice es `SiteContentData` por
  // clave fija), así que se salta para una instancia —ninguna instancia declara `variantes`, § su
  // descriptor— y se pasa su `tipo` en su lugar: `bandaOscuraCanonica`/`bandaUniforme` (vía
  // `tratamientoNav`) ya saben delegar a `instanciaOscuraCanonica`/`instanciaEsUniforme` cuando
  // reciben ese séptimo argumento (§ esquema-style.ts, el mecanismo ya construido y testeado por
  // SECCIONES-INSTANCIAS-1 — esto era su único open follow-up).
  const primera = orden[0];
  const primeraEsInstancia = esInstanciaId(primera);
  const tipoInstanciaPrimera = primeraEsInstancia ? seccionesHome[primera]?.tipo : undefined;
  const t = tratamientoNav(
    primera,
    primeraEsInstancia ? undefined : varianteDeBanda(content, primera as BandaId),
    esquemas, tema.fondo, tema.tinta, tema.acento,
    tipoInstanciaPrimera,
  );
  // `cromo.navTinta` (§ CORTE-NAV-TRANSPARENTE-HERO-1, resemantizado — antes CROMO-NAV-FOOTER-
  // TEMATIZABLE-1 lo declaraba "banda SÓLIDA SIEMPRE, nunca transparente"). El prototipo
  // (`docs/prototipos/cafeone/css/app.css:172-191`, `.site-header`) hace lo CONTRARIO de esa lectura
  // vieja: flota TRANSPARENTE sobre el hero y sólo cae a `--surface-inverse` (nuestra `--sf-tinta`)
  // AL SCROLLEAR (`.is-solid`) — nunca "sólida siempre". El eje que SÍ es fijo en el prototipo es el
  // color del ESTADO SÓLIDO: `--sf-tinta`, no la tarjeta clara que el resto de los temas usa al
  // scrollear. Por eso `navBandaTinta` deja de forzar `navFlotando=false` y pasa a describir SÓLO
  // el color de la superficie SÓLIDA (tinta en vez de tarjeta); el floating lo decide `tratamientoNav`
  // igual que para cualquier otro tema — CORTE lo hereda porque su hero (`variantes.hero:'media'`,
  // § themes.ts) es OSCURO y UNIFORME (`bandaOscuraCanonica`/`bandaUniforme`, sin esquema asignado a
  // 'hero' en `CORTE.esquemas`), la misma banda que ya flota transparente con texto claro para
  // cualquier tema sin `navTinta`.
  // `false` (todo tenant salvo CORTE) → BYTE-IDÉNTICO: `navBandaTinta` nunca es true, así que
  // `navFlotando`/`navClaro`/`navBg` resuelven EXACTAMENTE la misma rama de siempre (verificado por
  // sustitución algebraica: con `navBandaTinta` fijo en `false`, las tres expresiones de abajo
  // colapsan a las de antes de este slice).
  //
  // `isHome &&` (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — EL DEFECTO que este eje seguía sin cerrar: sin
  // esta condición, `cromo.navTinta:true` pintaba la banda tinta TAMBIÉN fuera de la home, porque
  // `navFlotando` YA exige `isHome` (arriba) pero `navBandaTinta` no lo exigía — así que en
  // `/tienda`, la ficha, `/nosotros`… CORTE caía SIEMPRE a `navClaro=true` (encabezado oscuro, texto
  // claro), el mismo comportamiento que el `navBg` sólido da al SCROLLEAR sobre la home. El gate del
  // owner sobre el muestrario desplegado (2026-09-29): «el nav debería ser blanco en las otras
  // páginas» — comparando contra las páginas internas del TEMA REAL (no `producto.html`, que sí
  // queda oscuro con `.is-opaque`; decisión del owner, apartándose del prototipo a propósito, § el
  // asiento de este slice en DECISIONS.md). `cromo.navTinta` describe el color del estado SÓLIDO
  // **de la home al scrollear** — nunca describió, ni antes ni ahora, el estado por defecto de una
  // página que NO es la home; la ausencia del `isHome &&` era el bug, no una lectura alternativa
  // válida. Con la condición, fuera de home `navBandaTinta` es SIEMPRE `false` → `navClaro=false` →
  // CORTE cae a la MISMA rama `bg-[var(--sf-tarjeta)]/95 backdrop-blur … text-[var(--sf-tinta)]` que
  // los otros 5 presets del catálogo YA usan fuera de home (nunca flotan, § `navFlotando` arriba) —
  // no un tercer estado inventado. El filete (`navFileteClase`, más abajo) hereda el mismo
  // `navClaro=false` → `border-[var(--sf-tinta)]/20`, el hairline gris fino que pide el gate; el CTA
  // y el badge de cosecha no dependen de `navClaro` cuando `navTratamiento.cta` está encendido (§
  // sus propios comentarios, más abajo), así que siguen igual. `isHome && false === false` para
  // todo tenant salvo CORTE → BYTE-IDÉNTICO, la condición nueva no cambia nada fuera de CORTE.
  const navBandaTinta = isHome && cromo.navTinta;
  const navFlotando = isHome && !scrolled && t.flotante;
  const navClaro = navFlotando ? t.textoClaro : navBandaTinta;

  // LA DOBLE LÍNEA (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1) — `shadow-sm` pintaba una SEGUNDA
  // demarcación de borde-a-borde bajo el header SÓLIDO, redundante con el filete nuevo
  // (`navFileteClase`, § CROMO-NAV-FILETE-1, más abajo) que ya dibuja esa línea — inset, con el
  // margen del contenedor. MEDIDO contra la captura del gate del owner (`onix-pdp-doble-linea.webp`,
  // pixel-scan por `sharp`): dos bandas horizontales distintas en la misma fila — una que se atenúa
  // cerca de los bordes (el filete, inset por `navContenedorClase`) y otra pareja en TODO el ancho,
  // sin margen (`shadow-sm`). Se retira `shadow-sm` SÓLO cuando `navTratamiento.filete` está activo
  // —hoy, únicamente CORTE— para no tocar los otros 5 presets del catálogo (byte-idénticos, siguen
  // con su única línea de siempre, sin filete). CORTE la pierde en LOS DOS estados sólidos (la banda
  // tinta al scrollear sobre la home, y la tarjeta clara en cualquier página interna): el filete no
  // depende de `isHome` (§ arriba), así que tampoco debe depender la supresión de la sombra vieja —
  // "la home no cambia" se cumple porque ninguna de las variables que gobiernan su comportamiento
  // (`navFlotando`/`navBandaTinta`/`navClaro`) se tocó, sólo se retiró una sombra redundante que
  // competía con la línea nueva.
  const navSombraClase = navTratamiento.filete ? '' : ' shadow-sm';
  const navBg = navFlotando
    ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
    : navBandaTinta
      ? `bg-[var(--sf-tinta)]${navSombraClase} text-[var(--sf-sobre)]`
      : `bg-[var(--sf-tarjeta)]/95 backdrop-blur${navSombraClase} text-[var(--sf-tinta)]`;

  // COMPORTAMIENTO POR DIRECCIÓN (§ CROMO-NAV-DIRECCION-SCROLL-1, `navTratamiento.direccion`):
  // `navOculto` (`lib/animation.ts`, MEDIDA contra el tema real) decide si el encabezado se traduce
  // fuera de vista, PERO no es la única voz — tres gates lo pisan, cada uno por su propia razón:
  //   - `focoDentro`/`mobileOpen`/`searchOpen`/`panelAbierto`: ACCESIBILIDAD, el spec de este slice
  //     ("si el foco está en el nav, no se oculta") ampliado a los tres estados donde el visitante
  //     está usando activamente el encabezado — ocultarlo a mitad de una interacción es el mismo
  //     defecto con otro disparador.
  //   - `navDireccionActiva` (`navTratamiento.direccion`, declarado arriba junto al listener de
  //     scroll — § CROMO-NAV-SIN-DESTELLO-1, también gobierna si el tratamiento se congela al bajar):
  //     `false` para TODO preset salvo CORTE → `oculto` es SIEMPRE `false` → BYTE-IDÉNTICO (la clase
  //     de abajo queda `''`, el header no gana ningún `translate-y-*` que no tuviera hoy).
  // `false` = HOY para todo tenant salvo CORTE.
  const bloqueaOcultar = focoDentro || mobileOpen || searchOpen || !!panelAbierto;
  const oculto = navDireccionActiva && !bloqueaOcultar && navOculto(scrollY, direccion);
  // MOVIMIENTO REDUCIDO: no se agrega un gate propio — el guard GLOBAL de `app/globals.css`
  // (`@media (prefers-reduced-motion: reduce) { *,*::before,*::after { transition-duration:0.01ms
  // !important } }`) ya neutraliza el `transition-all duration-300` del `<header>` (abajo) a un
  // cambio CASI INSTANTÁNEO — decisión tomada: "aparece/desaparece SIN animar" en vez de "no se
  // oculta", porque un salto sin desplazamiento perceptible no es el movimiento que esa preferencia
  // pide evitar, y reusa infraestructura que YA existe en vez de un segundo guard.
  const navOcultoClase = navDireccionActiva ? (oculto ? '-translate-y-full' : 'translate-y-0') : '';

  // LA GEOMETRÍA (§ CROMO-NAV-EXACTO-PROTOTIPO-1, REESCRIBE § CROMO-NAV-POSICION-TEMA-REAL-1): el
  // CONTENEDOR DE CONTENIDO y la FILA flex, medidos contra el PROTOTIPO LOCAL
  // (`docs/prototipos/cafeone/`), no el tema real — el gate visual del owner («la ubicación de los
  // elementos del nav aún no es como la del muestrario… ya llevamos varias pasadas en eso»)
  // estableció que la referencia que se compara, pasada tras pasada, es el prototipo VERSIONADO, no
  // un sitio de terceros que puede cambiar sin aviso. MEDIDO contra `docs/prototipos/cafeone/css/
  // tokens.css:150,151,157` (`--header-height:118px`, `--page-gutter:32px`, `--content-max:1440px`)
  // y `css/app.css:193-198` (`.header-bar{height:var(--header-height);display:flex;align-items:
  // center;…max-width:var(--content-max);margin-inline:auto;padding-inline:var(--page-gutter)}` —
  // ALTURA FIJA centrada por flex, no relleno) + sus dos breakpoints (`app.css:971-972`: bajo
  // 1200px, `88px`/`24px`; `997-998`: bajo 640px, `76px`/`18px`). `max-w-[1440px]` (`--content-max`
  // EXACTO) + `px-[18px] min-[640px]:px-6 cortenav:px-8` (18/24/32px, `--page-gutter` en sus tres
  // breakpoints, mobile-first — 640px coincide con `sm` de Tailwind (min-width:640px) EN VALOR,
  // pero el paso se escribe como variante ARBITRARIA `min-[640px]:`, NO `sm:` — § PARIDAD-CORTENAV-
  // CASCADA-1, abajo; 1200px no coincide con ningún breakpoint nuestro y gana el suyo propio,
  // `--breakpoint-cortenav`, `app/globals.css`) reemplazan a `max-w-6xl` + `px-4 sm:px-6 lg:px-8`; y
  // `h-[76px] min-[640px]:h-[88px] cortenav:h-[118px]` (`--header-height` en sus tres breakpoints)
  // reemplaza a la altura FIJA `h-16 lg:h-18` — sigue siendo ALTURA FIJA, no relleno, sólo que ahora
  // crece a los valores REALES del muestrario (§ el docstring de `NavTratamientoContent.posicion`,
  // `site-content-defaults.ts`, para la corrección completa). `false` (todo tenant salvo CORTE) →
  // `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` + `h-16 lg:h-18`, byte-idéntico a hoy.
  //
  // El ANCHO/RELLENO (no la altura) ahora se calcula en `contenedorAnchoClase`
  // (`lib/config/themes.ts`, § PARIDAD-ANCHO-CONTENIDO-1) — MISMO literal, MISMA fuente, para que
  // el encabezado y las bandas del storefront no puedan divergir sobre la geometría del prototipo.
  //
  // § PARIDAD-CORTENAV-CASCADA-1 (CIERRA `PARIDAD-ANCHO-CORTENAV-CASCADA-1`) — POR QUÉ `min-[640px]:`
  // Y NO `sm:` EN ESTOS DOS LITERALES: medido compilando `app/globals.css` con `@tailwindcss/postcss`
  // en aislamiento (capa 1, sin `next build`), Tailwind v4 agrupa las variantes de ancho por la
  // UNIDAD del valor declarado (`px` vs `rem`), no por su magnitud resuelta — TODO breakpoint en
  // `px` (`--breakpoint-duna`, `--breakpoint-cortenav`, cualquier `min-[Npx]:` arbitrario) emite en
  // UN bloque ascendente; TODO el scale por default de Tailwind (`sm`/`md`/`lg`/`xl`/`2xl`, en
  // `rem`) emite en OTRO bloque, COMPLETO, DESPUÉS. A ≥1200px, con `sm:px-6` (rem) y `cortenav:px-8`
  // (px) en el MISMO elemento, `sm:` ganaba la cascada por aparecer más tarde en la hoja — el header
  // rendía 24px/88px en vez de los 32px/118px del prototipo. Reordenar la declaración de
  // `--breakpoint-cortenav`/`--breakpoint-duna` en `@theme` NO lo arregla (probado, sin efecto): el
  // criterio es la unidad, no el orden textual. El fix es expresar el paso de 640px como variante
  // ARBITRARIA en `px` (`min-[640px]:`, exacto a `sm`=40rem a la raíz de 16px por defecto), que cae
  // en el MISMO bloque que `cortenav:` y ordena correctamente por valor — el MISMO patrón que
  // `Spotlight.tsx` ya usa (`min-[820px]:`/`min-[1200px]:`, sin `sm:`/`lg:`). `--breakpoint-sm` NUNCA
  // se toca, así que el resto del storefront (todo `sm:` fuera de estos dos literales) es
  // byte-idéntico. `--breakpoint-duna` (el panel admin, 960px) se censó: no combina con ningún
  // breakpoint estándar sobre la MISMA propiedad en ningún consumidor (`Sidebar.tsx`, `TopBar.tsx`,
  // `AdminChrome.tsx` — siempre `duna:` contra una clase SIN variante, sin condición competidora), así
  // que no sufre este defecto y no necesita la misma pieza.
  const navContenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  // § NAV-ALTURA-CON-FILETE-1 (2026-09-29) — LA ALTURA A ≥1200px SE APARTA DEL PROTOTIPO, A
  // PROPÓSITO: el prototipo mide 118px en `cortenav` (§ el bloque de arriba), PERO su filete
  // (`.site-header::after`, `docs/prototipos/cafeone/css/app.css`, cerca de `:185-189`) lleva
  // `opacity:0` sobre el hero y sólo aparece con el encabezado SÓLIDO. El nuestro
  // (`navFileteClase`, abajo, § CROMO-NAV-FILETE-1) se ve TAMBIÉN sobre el hero —decisión del
  // owner—, y a 118px esa línea queda lejos de las letras. Gate visual del owner sobre
  // `PARIDAD-CORTENAV-CASCADA-1` (DECISIONS.md, 2026-09-29): «el problema que le veo al cambio es
  // que ahora el nav da la impresión de que ocupa mucha altura, por la línea que tiene, queda muy
  // separada de las letras… pero me gusta cómo se ve la línea» — filete VISIBLE + la altura de
  // 88px que ya regía bajo `min-[640px]:` (la de HOY, previa a `CROMO-NAV-EXACTO-PROTOTIPO-1`), no
  // los 118px del prototipo. `cortenav:h-[88px]` abajo es por tanto REDUNDANTE en valor contra
  // `min-[640px]:h-[88px]` — se deja EXPLÍCITO a propósito, para que quede escrito que el
  // breakpoint de 1200px SIGUE existiendo (sigue gobernando el `padding-inline` de 32px vía
  // `contenedorAnchoClase`, sin cambio) aunque ya no suba la altura. El ANCHO/RELLENO y el filete
  // no se tocan — sólo esta altura.
  const navFilaAltoClase = navTratamiento.posicion ? 'h-[76px] min-[640px]:h-[88px] cortenav:h-[88px]' : 'h-16 lg:h-18';

  // EL FILETE INFERIOR (§ CROMO-NAV-FILETE-1, la UBICACIÓN corregida por § CROMO-NAV-EXACTO-
  // PROTOTIPO-1): línea fina que separa el encabezado del contenido, SIN cruzar toda la pantalla —
  // va en la FILA INTERIOR (que ya lleva `navFilaAltoClase`), NO en el contenedor con padding ni en
  // el `<header>` de ancho completo.
  //
  // EL DEFECTO QUE ESTO CORRIGE: un `border-b` se dibuja en el borde EXTERIOR de la caja del
  // elemento, sin importar su `padding` — el padding empuja el CONTENIDO hacia adentro, no el borde.
  // Puesto en el contenedor `max-w-[1440px] px-[18px]…`, el borde quedaba en el borde exterior de
  // ESE contenedor, que en cualquier viewport ≤1440px ES el viewport completo — así que el filete
  // tocaba los bordes de pantalla pese al `px-*`, el defecto que reportó el owner («la línea del nav
  // ahora toca los bordes, la idea es que quede un espacio como en Cafeone»). La fila interior YA
  // renderiza angosta —es un hijo block-level del contenedor con padding, así que ocupa el ANCHO DEL
  // CONTENIDO (contenedor menos el padding), no el del contenedor— así que un borde puesto ahí queda
  // inset por el MISMO margen que ya alinea el wordmark y el CTA, sin un número propio.
  //
  // Ancho: la unidad no-cero más chica de la escala de bordes, `border-b` (1px) — el MISMO hairline
  // que ya usa `border-[var(--sf-sobre)]/20` más abajo (el drawer `pantallaCompleta`, medido contra
  // el mismo prototipo). Color: el PROPIO primer plano del encabezado —el mismo par `navClaro` que
  // ya decide texto/íconos, no un color de borde aparte— a opacidad reducida (20%). `false` (todo
  // tenant salvo CORTE) → sin filete, byte-idéntico a hoy. Vive DENTRO del `<header>`, así que se
  // oculta CON él al bajar (§ CROMO-NAV-DIRECCION-SCROLL-1) — nunca queda flotando solo.
  const navFileteClase = navTratamiento.filete
    ? (navClaro ? 'border-b border-[var(--sf-sobre)]/20' : 'border-b border-[var(--sf-tinta)]/20')
    : '';

  // LA FILA INTERIOR NO TRANSICIONABA SU PROPIO CAMBIO — § TRANSICION-ENTRE-PAGINAS-1. El `<header>`
  // ya lleva `transition-all duration-300` (más abajo), pero una transición CSS sólo anima la
  // propiedad EN EL ELEMENTO donde cambia: el color del filete (`navFileteClase`, arriba) se pinta en
  // ESTA fila interior, no en el `<header>`, así que el `transition-all` del padre no lo cubre — al
  // cambiar de home a una página interna (o al entrar/salir del floating sobre el hero) el color del
  // filete saltaba de golpe mientras el fondo del header sí se desvanecía. `transition-colors
  // duration-300` en la MISMA fila, MISMA duración que el header, cierra ese salto puntual sin tocar
  // el valor de `navFileteClase` (que sigue decidiendo QUÉ color, no CÓMO llega).
  //
  // `false` (todo tenant salvo CORTE, § `navTratamiento.posicion`) → cadena vacía: para esos temas
  // `navFileteClase` tampoco pinta ningún borde (nunca hay nada que transicionar acá), así que la
  // fila queda BYTE-IDÉNTICA a hoy — ni la clase nueva se agrega a su `className`.
  const navFilaTransicionClase = navTratamiento.posicion ? ' transition-colors duration-300' : '';

  // `navTratamiento.activo` (§ CROMO-NAV-TRATAMIENTO-1): declaración OPCIONAL del preset — los links
  // del nav llevan mayúscula + tracking del prototipo + un peso, sobre la MISMA sans del par (SIN
  // tercera familia: no se toca `font-family`, sólo `text-transform`/`letter-spacing`/`font-weight`).
  // `false` (todo tenant salvo el que lo declare, § CORTE en themes.ts) → `font-medium` de HOY,
  // exacto, sin mayúscula ni tracking. El tamaño (`text-sm`) es el mismo en las dos ramas — ya es el
  // body-s del prototipo, no cambia con el tratamiento.
  //
  // `sf-peso-normal`, NO `font-normal` (§ CORTE-CUERPO-FIGTREE-PESO-1): el peso "regular" de este
  // rama YA NO es un 400 fijo — sigue al `--sf-peso-cuerpo` del par elegido (`app/globals.css`), así
  // que CORTE (el único preset con `navTratamiento.activo`) lo pinta al peso calibrado de 'prensa'
  // (440) en vez de al Figtree 400 liviano. Fallback 400 = `font-normal` de HOY para cualquier otro
  // tenant que algún día active este tratamiento sin declarar peso propio.
  const navLinkTratamiento = navTratamiento.activo ? 'uppercase tracking-[0.06em] sf-peso-normal' : 'font-medium';

  // EL SUBRAYADO AL HOVER (§ CROMO-NAV-EXACTO-PROTOTIPO-1): `.nav-link::after` del prototipo
  // (`docs/prototipos/cafeone/css/app.css:219-224`) — una línea de 1px en `currentColor` que se
  // dibuja desde la izquierda (`scaleX(0)→scaleX(1)`, `transform-origin:left`) con la MISMA curva
  // que `ENTRADA_ESCALONADA_DRAWER` de arriba (`--duration-base:220ms`, `--ease-out:cubic-
  // bezier(.22,.61,.36,1)`, `tokens.css:189,192`). `bg-current` toma el color del propio `linkColor`
  // del link — sin un token nuevo, igual que `background:currentColor` en el prototipo.
  // `prefers-reduced-motion` lo congela el guard GLOBAL de `app/globals.css`
  // (`*,*::before,*::after{transition-duration:0.01ms!important}`), sin un guard propio: el
  // subrayado APARECE, sólo que sin animar. `false` (todo tenant salvo CORTE) → sin subrayado,
  // byte-idéntico a hoy.
  const navHoverClase = navTratamiento.subrayado
    ? 'relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-[220ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:after:scale-x-100'
    : '';

  const linkColor = navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';
  const iconColor = navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';

  // EL TAMAÑO/TRAZO del ícono del encabezado (buscar, carrito) — § CORTE-CUERPO-LETRA-E-ICONOS-1.
  // MEDIDO contra el prototipo (`docs/prototipos/cafeone/js/app.js`, la función `icon`, cerca de
  // `:44`): stroke-width **1.6** sobre un ícono de **22px** (viewBox 24, igual que lucide-react) —
  // rendered = 1.6 × 22/24 ≈ 1.47px, contra 1.25 × 20/24 ≈ 1.04px de HOY (`--sf-trazo` de la forma
  // 'recta', § formas.ts, sobre `w-5 h-5`=20px) — más grueso Y más grande, igual que reportó el
  // owner.
  //
  // 'recta' es COMPARTIDA con PLIEGO (`themes.ts`), así que este ajuste NO toca `--sf-trazo` —
  // cambiarlo movería el trazo de TODOS los íconos de PLIEGO, en silencio—. En vez de una meta de
  // contenido nueva (que exigiría schema + control de panel para un detalle que no es una elección
  // de producto, sólo la exactitud de un ícono contra una referencia externa), REUSA el eje que ya
  // existe: `navTratamiento.posicion` (§ CROMO-NAV-EXACTO-PROTOTIPO-1) ya significa "adoptar la
  // geometría MEDIDA del prototipo, no la de hoy" — CORTE es hoy el ÚNICO preset que lo declara —,
  // así que gatear el ícono con la MISMA señal es extender ese eje, no inventar uno. El tamaño 22px
  // se declara en LA CLASE (Tailwind arbitrario, sin CSS nuevo); el trazo 1.6 vive en
  // `.sf-icono-nav-exacto` (`app/globals.css`), una clase de mayor especificidad que `.lucide` sola
  // — necesaria porque el prop `strokeWidth` de lucide-react emite un ATRIBUTO SVG, y la regla
  // global `.lucide{stroke-width:var(--sf-trazo,2)}` ya gana sobre cualquier atributo (esa es su
  // razón de existir, § el comentario de esa regla). `false` (todo tenant salvo CORTE) →
  // `w-5 h-5`, byte-idéntico a hoy.
  const navIconoClase = navTratamiento.posicion ? 'w-[22px] h-[22px] sf-icono-nav-exacto' : 'w-5 h-5';

  // § NAV-MOVIL-SIN-BUSCAR-1 — el ícono de buscar de la BARRA (más abajo, "Actions") se puede ocultar
  // en ancho de TELÉFONO (`<lg`), por tenant. SÓLO bajo `navDrawerMovil.variante==='pantallaCompleta'`
  // (§ MENU-MOVIL-COMO-CAFEONE-1): ES EL ÚNICO drawer móvil que trae su PROPIO botón de buscar en la
  // cabecera (más abajo, el bloque "Mobile Menu — PANTALLA COMPLETA", `aria-label="Buscar"`) — el
  // `'dropdown'` de HOY (el resto del catálogo) no lo tiene, así que para ese drawer el ícono de la
  // barra NUNCA se oculta, aunque `navTratamiento.buscarMovil` esté en `false` (un estado que el panel
  // ya evita ofrecer, § `EncabezadoSeccion.tsx`, pero esta guarda es la que lo hace IMPOSIBLE, no sólo
  // no-ofrecido). `navTratamiento.buscarMovil` default `true` → `false` acá siempre → byte-idéntico a
  // hoy para todo tenant que no apague el switch. En ESCRITORIO nunca se oculta, en ningún caso: el
  // `lg:visible` de `claseBuscarBarraMovil` (abajo) cubre ESE breakpoint, no éste.
  const ocultarBuscarEnBarraMovil = navDrawerMovil.variante === 'pantallaCompleta' && !navTratamiento.buscarMovil;

  // § NAV-MOVIL-NOMBRE-CON-AIRE-1 — gate del owner sobre la demo de Café Las Chamisas en el
  // teléfono (2026-10-01): con el buscar apagado (arriba), el NOMBRE creció para ocupar el lugar
  // del ícono — "no era para que el nombre quedara más grande sino el tamaño que tenía cuando
  // estaba con el ícono, pero que tuviera espacio, para que 'respire'".
  //
  // LA CAUSA: `NombreEncogible` (`Logo.tsx`) mide el ancho DISPONIBLE del wordmark leyendo
  // `clientWidth` del propio `<span>`, que es lo que el `flex` del encabezado (`justify-between`,
  // sin `gap`) le asigna DESPUÉS de repartir el espacio entre el Logo y "Actions" (buscar+carrito+
  // hamburguesa) — el ÚNICO flex item con `min-w-0` capaz de encoger es el Logo, así que CUALQUIER
  // ancho que "Actions" deje de necesitar se lo queda el Logo entero. `ocultarBuscarEnBarraMovil`
  // ocultaba el botón con `hidden` (`display:none`) — RETIRA su caja del cálculo de flex, así que
  // el presupuesto total de la fila BAJA y el Logo recibe ese ancho de más: el wordmark se re-mide
  // contra una `disponible` MAYOR que con el ícono presente, y su fuente CRECE (medido: de
  // 13.47px a 16.18px con "Café Las Chamisas de la Montaña" en WebKit-iPhone15, § el asiento).
  //
  // EL FIX: `invisible` (`visibility:hidden`) en vez de `hidden`. `visibility:hidden` CONSERVA la
  // caja del botón en el flujo —ocupa el mismo lugar, sólo deja de PINTARSE— así que el
  // presupuesto total de la fila NO cambia: el Logo recibe EXACTAMENTE la misma `disponible` que
  // con el ícono VISIBLE, y el wordmark queda del MISMO tamaño (medido: 13.47px en los dos casos,
  // § el asiento). El hueco que el ícono dejó de pintar se ve como AIRE, inmediatamente antes del
  // carrito — ni un número de reserva que mantener a mano: es, literalmente, la misma caja.
  // `visibility:hidden` ya saca el botón del árbol de accesibilidad y de la cola de tabulación
  // (como `display:none`), así que sigue sin ser alcanzable por teclado ni lector de pantalla.
  //
  // EN ESCRITORIO nada cambia: `lg:visible` restaura la visibilidad desde `lg` — ni un breakpoint
  // nuevo, el mismo gate que ya tenía `lg:inline-flex`. Sin `ocultarBuscarEnBarraMovil` (todo
  // tenant salvo CORTE con el switch apagado) la cadena sigue vacía, byte-idéntico a hoy.
  const claseBuscarBarraMovil = ocultarBuscarEnBarraMovil ? ' invisible lg:visible' : '';

  // EL LINK ACTIVO era INVISIBLE sobre nav oscuro (§ NAV-LINK-ACTIVO-INVISIBLE-1): el `!important`
  // pisaba `linkColor` con `--sf-acento-texto` SIEMPRE, sin mirar `navClaro`. Para CORTE ese token
  // no es "el acento como texto" — `origenTexto:'tinta'` (themes.ts) lo re-deriva a
  // `pisoContraste(tinta, fondo, 4.5)`, floreado contra el FONDO CLARO de página, que para CORTE da
  // literalmente `tinta` (`#102407`) sin florear más porque ya pasa el piso ahí — y sobre la banda
  // TINTA del nav (`bg-[var(--sf-tinta)]` o el hero oscuro detrás del floating) eso es el MISMO
  // color que el fondo: contraste 1.00 (medido, `.scratch/medir-tostado.ts`). De ahí la caja vacía
  // que reportó el owner en /nosotros — no faltaba el texto, el texto era invisible.
  //
  // `--sf-tostado` es el token que el resto del storefront YA usa como el fallback de "acento como
  // texto sobre banda oscura, SIN esquema asignado" (`var(--sf-sobre-banda,var(--sf-tostado))`, la
  // misma familia que HeroCurtina/HeroMedia/BrandStoryColumnas/GrindChooserRiel/SubscriptionCTA*
  // — § el comentario de `RECETA` en `palette-derive.ts`, "sirven igual como texto sobre una banda
  // oscura"). Para CORTE da `#d8a378` — 7.38:1 contra `tinta` (medido), y visualmente distinto del
  // blanco/80% de `linkColor`, así que el activo sigue distinguiéndose del resto. `--sf-sobre-banda`
  // en sí NO es alcanzable acá: sólo lo inyecta `esquemaStyle` en la `<section>` de una banda con
  // esquema asignado, y el `<header>` vive FUERA de esa sección (fixed, por encima) — por eso se usa
  // `--sf-tostado` directo, el mismo fallback literal que esos componentes usan cuando no hay
  // esquema, en vez del atajo `--sf-sobre-banda` que acá no resolvería nada.
  //
  // `navClaro:false` (todo tema salvo CORTE) sigue en `--sf-acento-texto` — BYTE-IDÉNTICO a hoy: ese
  // token SÍ se florea contra `fondo` (la superficie real del nav claro), así que el defecto nunca
  // existió en esa rama.
  const colorActivo = navClaro ? 'text-[var(--sf-tostado)]!' : 'text-[var(--sf-acento-texto)]!';

  // § MENU-MOVIL-COMO-CAFEONE-1 — el texto/íconos del DRAWER móvil `pantallaCompleta` (más abajo),
  // FIJO, NO depende de `navClaro`: el panel del drawer pinta su PROPIO fondo (`--sf-fondo`, la
  // superficie de página), siempre CLARO sin importar si el encabezado —detrás, tapado por este
  // panel a pantalla completa— está flotando transparente o sólido en ese instante. Reusa el par
  // que `linkColor`/`iconColor` (arriba) ya resuelven para su rama `navClaro=false` — texto/íconos
  // sobre superficie clara — en vez de un tercer literal que pudiera divergir de ese par.
  const drawerTextoClase = 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';

  // El BADGE de cosecha (§ CORTE-BADGE-COSECHA-EN-MENU-1), extraído a una función: el ítem CON PANEL
  // (§ MUESTRARIO-MEGA-MENU-1) también puede llevar badge, así que la misma pieza tiene que colgar
  // tanto de un `<Link>` como del `<button>` que abre el panel — sin extraerla, el markup se
  // duplicaría una tercera vez.
  //
  // EL COLOR (§ CROMO-NAV-CTA-Y-BADGE-1, `navTratamiento.cta`): la FORMA (padding, tamaño, peso,
  // mayúscula, tracking, radio) ya estaba MEDIDA contra `.badge` del prototipo
  // (`docs/prototipos/cafeone/css/app.css:151-157`, `tokens.css:123,128,164`) y no cambia acá — sólo
  // el COLOR. `false` (todo tenant salvo CORTE) → sigue dependiendo de `navClaro`, byte-idéntico.
  // `true` (CORTE): FIJO, ya no depende de `navClaro` — `bg-[var(--sf-tostado)] text-[var(--sf-
  // acento-txt)]`, sobre el MISMO fondo que ya usan `Spotlight.badge`/`product.badge` en este repo
  // (§ el docstring de `NavTratamientoContent.cta`, `site-content-defaults.ts`, para el porqué de
  // `tostado` en vez de un rol nuevo). Las dos superficies son OPACAS, así que el mismo par se lee
  // igual flotando sobre el hero o con el nav sólido — no hace falta un segundo par por tratamiento.
  //
  // EL TEXTO (§ CARRITO-CABECERA-Y-COLORES-NAV-1, 2026-09-30) — CORRIGE `CROMO-NAV-CTA-Y-BADGE-1`:
  // este texto vivía en `--sf-tinta` (verde oscuro), el MISMO par que el `.badge{color:var(--text-
  // heading)}` del PROTOTIPO LOCAL (`docs/prototipos/cafeone/css/app.css:156`). El owner, gateando
  // contra Cafeone REAL: "la fuente en 'Cosecha 2026' debería ser blanca, no verde" — el sitio real
  // pinta su badge con texto PLENO, no con la tinta de encabezado del prototipo estático. `--sf-
  // acento-txt` es el token "texto sobre la superficie de acento" ya usado en todo el storefront
  // (ProductCard, Spotlight, los CTA) — para CORTE resuelve a BLANCO (auto-flip contra `acento` =
  // rojo `#a70004`, § `palette-derive.ts`), nunca un hex horneado. Sólo el TEXTO cambia; el FONDO
  // (`--sf-tostado` + el `style` de `badgeColor` de abajo) sigue igual.
  //
  // `navTratamiento.badgeColor` (§ RIEL-SCROLL-Y-BADGE-DORADO-1) — el `style` inline SÓLO se aplica
  // cuando el campo NO es `null` (sólo CORTE): pisa el `background-color` de la clase Tailwind con
  // el hex medido contra `--accent-sale` (`#f5b36a`). `undefined` con el campo en `null` hace que
  // React OMITA la propiedad — la clase `bg-[var(--sf-tostado)]` de siempre queda intacta,
  // byte-idéntica. `ProductCard.tsx`/`Spotlight.tsx` aplican el MISMO override sobre su propio badge
  // (§ el censo de consumidores, DECISIONS.md) — SUS badges no están en `touches:` de este slice y
  // siguen en `text-[var(--sf-tinta)]`, sin tocar (§ open_followups del asiento de este slice).
  const badgeSpan = (texto: string) => (
    <span
      className={`inline-flex items-center px-[9px] py-[5px] text-[11px] font-bold uppercase tracking-[0.085em] leading-none rounded-[2px] ${navTratamiento.cta ? 'bg-[var(--sf-tostado)] text-[var(--sf-acento-txt)]' : navClaro ? 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]' : 'bg-[var(--sf-tinta)]/5 text-[var(--sf-tinta)]'}`}
      style={navTratamiento.cta && navTratamiento.badgeColor ? { backgroundColor: navTratamiento.badgeColor } : undefined}
    >
      {texto}
    </span>
  );
  // El logo del nav (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): `cromo.navSubtitulo` exhibe el `tagline`
  // bajo el nombre (REUSA `Logo.subtitle`, que ya existe para el footer, § Logo.tsx) — `false` (el
  // default) → `subtitle` queda `undefined` y `Logo` renderiza EXACTAMENTE su rama de siempre.
  //
  // `navWordmark.activo` (§ CORTE-LOGO-APILADO-1): el ESTILO del wordmark apilado —mayúscula+
  // tracking+tamaño en el nombre, sans muted sin itálica en el sub, § el docstring de
  // `NavWordmarkContent`—, DISTINTO de `navTratamiento.activo` (arriba, que trata los LINKS del
  // nav). `false` (todo tenant salvo CORTE) → `Logo` ignora la prop (default `false`) y su rama
  // `subtitle` renderiza EXACTAMENTE como siempre.
  //
  // `transicionColor` (§ BADGES-ACCIONES-Y-LOGO-CORTE-1, cierra LOGO-WORDMARK-SIN-TRANSICION-1):
  // gateado por `navTratamiento.posicion` — el MISMO booleano que ya gatea `navFilaTransicionClase`
  // (arriba), para que el filete y el wordmark transicionen JUNTOS al alternar `navClaro` (flotando↔
  // sólido, home↔interna). `false` (todo tenant salvo CORTE) → `Logo` ignora la prop (default
  // `false`) y el wordmark sigue saltando de golpe, byte a byte.
  //
  // `logo` (§ MARCA-LOGO-IMAGEN-1): el logo SUBIDO del dueño, `content.logo`. Sin ninguna versión
  // subida (todo tenant que no lo configure, incluido Nayoli) `Logo` ignora la prop y renderiza
  // mark+wordmark como siempre — byte a byte. Con logo, `Logo` ya resuelve sola QUÉ versión mostrar
  // según `variant` (claro flotando sobre el hero, oscuro en páginas internas/nav sólido, § la prop
  // `variant` arriba) Y, desde § NAV-LOGO-Y-NOMBRE-1, si el logo CONVIVE con el nombre en
  // escritorio (`logo.modo === 'logoYNombre'`, vía `modoLogoResuelto`) — este componente tampoco
  // decide eso: sólo reenvía el MISMO `logo` a las DOS monturas de abajo (el header y el drawer
  // móvil de pantalla completa), así que las dos responden igual al modo elegido.
  const logoLink = (
    <Link href="/" aria-label={`${nombre} — inicio`} className="min-w-0 transition-colors">
      {/* Cream lockup over the transparent hero, espresso once scrolled */}
      <Logo
        nombre={nombre}
        variant={navClaro ? 'dark' : 'light'}
        conMark={STOREFRONT_TIENE_MARK}
        subtitle={cromo.navSubtitulo ? tagline : undefined}
        wordmarkTratado={navWordmark.activo}
        taglineColor={navWordmark.taglineColor}
        transicionColor={navTratamiento.posicion}
        logo={logo}
        // § NAV-LOGO-Y-NOMBRE-AJUSTE-1 — este mount (el `<header>`) pasa el alto DERIVADO de SU
        // propia barra (`altoLogoNavMovilClase`, § NAV-LOGO-TAMANOS-FINOS-1 lo achicó un poco más).
        // El mount del drawer móvil (más abajo) pasa su PROPIO literal
        // (`altoLogoMenuLateralClase`, § NAV-LOGO-TAMANOS-FINOS-1) — más grande, no derivado del
        // alto de ESTA barra, porque su fila (`px-6 py-5`) es otra geometría sin alto fijo propio.
        altoBarraClase={altoLogoNavMovilClase(navTratamiento.posicion)}
      />
    </Link>
  );

  // § EDITOR-TIENDA-CROMO-1 — la MISMA marca, para la cabecera del drawer móvil de pantalla
  // completa: mismo `logo`/`cromo.navSubtitulo`, pero su PROPIO alto de logo
  // (`altoLogoMenuLateralClase`, § NAV-LOGO-TAMANOS-FINOS-1 — esta fila no tiene un alto de barra
  // que heredar) y `onClick` propio (cierra el drawer al navegar). Separada de `logoLink` por eso
  // —no es la misma instancia reusada, es la MISMA decisión de marca en una monta distinta— y
  // extraída a variable (en vez de inline en el JSX de abajo) para que el wrapper de modo editor
  // no tenga que duplicar este bloque una segunda vez.
  const logoLinkMovil = (
    <Link href="/" onClick={() => setMobileOpen(false)} aria-label={`${nombre} — inicio`} className="min-w-0">
      <Logo
        nombre={nombre}
        variant="light"
        conMark={STOREFRONT_TIENE_MARK}
        subtitle={cromo.navSubtitulo ? tagline : undefined}
        wordmarkTratado={navWordmark.activo}
        taglineColor={navWordmark.taglineColor}
        logo={logo}
        altoBarraClase={altoLogoMenuLateralClase()}
      />
    </Link>
  );

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navOcultoClase} ${navBg}`}
        // Sólo el foco de TECLADO (`:focus-visible`) sostiene el nav visible — § NAV-FOCO-SOLO-TECLADO-1:
        // un clic con mouse (logo, un link del menú, el carrito, COMPRAR) también deja el foco adentro,
        // y el nav quedaba sin ocultarse al bajar hasta hacer clic en otra parte.
        onFocus={(e) => setFocoDentro(e.target.matches(':focus-visible'))}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocoDentro(false);
        }}
      >
        <div className={`mx-auto ${navContenedorClase}`}>
          <div className={`flex items-center justify-between ${navFilaAltoClase} ${navFileteClase}${navFilaTransicionClase}`}>
            {/* Logo — SIN el badge de `cromo.navBadge` (§ CORTE-BADGE-COSECHA-EN-MENU-1). Antes esta
                celda condicionaba entre `logoLink` solo y un flex que lo envolvía junto al badge; el
                badge se MUDÓ a ser un atributo de un ítem del menú (abajo, `l.badge`), así que el
                logo vuelve a ser SIEMPRE `logoLink` a secas, sin `<div>` extra alrededor —
                byte-idéntico a hoy para TODO tenant, incluido CORTE (que ya no lo declara acá).
                `cromo.navBadge` queda DORMIDO: sigue en el modelo/schema (§ CromoContent,
                site-content-defaults.ts), pero ningún componente lo lee. */}
            {/* § EDITOR-TIENDA-CROMO-1 — el ENCABEZADO: el `display:contents` deja que `logoLink`
                siga siendo el flex item real (mismo truco que `CampoEditable tipo="imagen"`, § su
                docstring) — el wrapper nunca aparece fuera de modo editor. */}
            {enModoEditor ? (
              <div data-editor-seccion="encabezado" style={{ display: 'contents' }}>{logoLink}</div>
            ) : (
              logoLink
            )}

            {/* Desktop Nav — § EDITOR-TIENDA-CROMO-1: el MENÚ, marcado directo sobre el `<nav>` que
                ya existe (sin wrapper nuevo). */}
            <nav className="relative hidden lg:flex items-center gap-8" data-editor-seccion={enModoEditor ? 'menu' : undefined}>
              {links.map(l => {
                const linkClassName = `text-sm ${navLinkTratamiento} transition-colors ${linkColor} ${navHoverClase} ${pathname.startsWith(l.path) ? colorActivo : ''}`;
                // EL PANEL DESPLEGABLE (mega-menu, § MUESTRARIO-MEGA-MENU-1): un ítem CON panel es un
                // BOTÓN que abre/cierra el desplegable — nunca navega directo. Medido contra el
                // prototipo (`docs/prototipos/cafeone/index.html:28-31`): `.nav-link` de "Nuestro café"
                // es un `<button data-menu aria-expanded aria-controls>`, no un `<a>` — el ítem no tiene
                // destino propio, sus CTAs internos sí. `l.panel` está AUSENTE para todo tenant que no
                // declare `panelItem` (Nayoli), así que esta rama nunca se ejercita ahí — byte-idéntico.
                if (l.panel) {
                  const abierto = panelAbierto === l.id;
                  // EL SUBRAYADO QUEDA VISIBLE MIENTRAS EL PANEL ESTÁ ABIERTO (§ CROMO-NAV-EXACTO-
                  // PROTOTIPO-1) — `.nav-item.is-open .nav-link::after{transform:scaleX(1)}` del
                  // prototipo (`app.css:224`): el trigger del mega-menú es el `.nav-item` que puede
                  // estar `is-open`, así que fuerza el subrayado en vez de esperar el hover.
                  const subrayadoAbierto = navTratamiento.subrayado && abierto ? 'after:scale-x-100' : '';
                  const trigger = (
                    <button
                      ref={megaTriggerRef}
                      type="button"
                      aria-expanded={abierto}
                      aria-controls={`mega-${l.id}`}
                      onClick={() => setPanelAbierto(abierto ? null : l.id)}
                      className={`${linkClassName} inline-flex items-center gap-1 cursor-pointer ${subrayadoAbierto}`}
                    >
                      {l.label}
                      <ChevronDown aria-hidden className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </button>
                  );
                  if (!l.badge) return <span key={l.path}>{trigger}</span>;
                  return (
                    <span key={l.path} className="inline-flex items-center gap-2">
                      {trigger}
                      {badgeSpan(l.badge)}
                    </span>
                  );
                }
                if (!l.badge) {
                  return <Link key={l.path} href={l.path} className={linkClassName}>{l.label}</Link>;
                }
                // El BADGE de cosecha (§ CORTE-BADGE-COSECHA-EN-MENU-1) va JUNTO al link de SU ítem,
                // como el `.nav-item .badge` del prototipo (`index.html:27-32`) — sibling del link,
                // no anidado adentro. El `<span>` envolvente sólo aparece para el ítem CON badge
                // (`l.badge` es `undefined` para todo tenant salvo CORTE, § itemsDeMenu): los demás
                // ítems, y TODO tenant sin badge, siguen renderizando el `<Link>` desnudo de la rama
                // de arriba, byte-idéntico a hoy. Estilo MEDIDO contra `.badge`
                // (`docs/prototipos/cafeone/css/app.css:151-157`, `tokens.css:128,164`: 11px, bold,
                // mayúscula, tracking .085em, padding 5px/9px, radio 2px) con TOKENS del tema (no los
                // literales del prototipo) — mismo par `navClaro` que ya usaba el badge del logo y
                // que usa el CTA del menú (abajo). `rounded-[2px]`, NO `rounded-sm`: en este repo
                // `--radius-sm` (globals.css:119) es `var(--radius) - 4px` = 8px (12px de `--radius`
                // menos 4), NO el 2px de Tailwind — y el eje `forma` del storefront (`forma-style.ts`)
                // sólo pisa `--radius-3xl/2xl/xl`, nunca `--radius-lg/md/sm` (comentario propio de ese
                // archivo: "ésos son del panel"), así que `rounded-sm` daría 8px incluso con CORTE. El
                // valor arbitrario es el único camino a los 2px medidos.
                return (
                  <span key={l.path} className="inline-flex items-center gap-2">
                    <Link href={l.path} className={linkClassName}>{l.label}</Link>
                    {badgeSpan(l.badge)}
                  </span>
                );
              })}
              {/* El CTA del menú (§ CROMO-MENU-COMO-DATO-1): apagado por defecto (`ctaHref` null), así
                  que Nayoli no gana nada acá. Se pinta como ACCIÓN —un botón, no un link plano—,
                  tomando la FORMA del bloque `/cuenta` muerto de más abajo (pill con fondo de tinte),
                  no su destino ni su contenido. `navTratamiento.activo` (§ CROMO-NAV-TRATAMIENTO-1)
                  NO lo toca: el `.nav` del prototipo (`docs/prototipos/cafeone/index.html:26-37`)
                  sólo contiene `.nav-link` de navegación, sin CTA propio — esta pieza es dato
                  nuestro sin análogo medido, así que queda fuera del alcance de este slice.

                  `!navTratamiento.cta` (§ CROMO-NAV-CTA-Y-BADGE-1): con el tratamiento encendido
                  (CORTE) el CTA se muda al FINAL del encabezado (dentro de "Actions", abajo) — acá
                  no se renderiza una segunda vez. `false` (todo tenant salvo CORTE) → sigue acá,
                  byte-idéntico. */}
              {ctaHref && !navTratamiento.cta && (
                <Link
                  href={ctaHref}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${navClaro ? 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)] hover:bg-[var(--sf-sobre)]/20' : 'bg-[var(--sf-acento)]/10 text-[var(--sf-acento-4)] hover:bg-[var(--sf-acento)]/20'}`}
                >
                  {content.menu.ctaLabel}
                </Link>
              )}
            </nav>

            <NavSearch
  isOpen={searchOpen}
  onClose={() =>
    setSearchOpen(false)
  }
  triggerRef={searchTriggerRef}
  iconoClase={navIconoClase}
/>

            {/* EL PANEL DESPLEGABLE (mega-menu, § MUESTRARIO-MEGA-MENU-1) — medido contra el
                prototipo (`docs/prototipos/cafeone/index.html:57-89`, `#mega-cafe`): intro (copy +
                CTA), dos columnas de sub-enlaces, una tarjeta promocional. Posicionado FULL-WIDTH
                relativo al `<header>` (`fixed`), como `NavSearch` — es hijo de este contenedor
                (`position: static`, no crea containing block), así que `absolute left-0 w-full`
                resuelve contra el header, no contra este contenedor angosto. `itemPanel` es `null`
                para todo tenant sin panel declarado → esta rama nunca se monta ahí. El cierre
                (Escape + click-afuera) vive arriba (§ NAV-CIERRE-CLICK-AFUERA-1); el fondo de abajo
                es SÓLO visual, igual que en `NavSearch`.

                § PARIDAD-CORTENAV-CASCADA-1 (CIERRA `PARIDAD-ANCHO-MEGAMENU-1`): el ancho/relleno
                del panel ahora sale de `navContenedorClase` (= `contenedorAnchoClase(navTratamiento.
                posicion)`, ya calculado arriba, MISMA fuente que el encabezado y las bandas) en vez
                de un literal `max-w-6xl px-4 sm:px-6 lg:px-8` propio — el prototipo mide `.mega-inner`
                contra el MISMO `--content-max`/`--page-gutter` que el resto del contenido (§
                DECISIONS.md, PARIDAD-ANCHO-CONTENIDO-1 §3), así que un contenedor aparte para el
                mega-menu podía divergir del resto. `false` (todo tenant salvo CORTE) →
                `navContenedorClase` resuelve a `max-w-6xl px-4 sm:px-6 lg:px-8`, byte-idéntico al
                literal que reemplaza. `grid gap-10 py-10 lg:grid-cols-[minmax(0,260px)_1fr]` —el
                LAYOUT de columnas del panel, no el ancho/relleno— se queda aparte. */}
            <AnimatePresence>
              {itemPanel && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                  />
                  <motion.div
                    ref={megaPanelRef}
                    id={`mega-${panelAbierto}`}
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 top-full z-50 w-full sf-divisor-t border-[var(--sf-linea)] bg-[var(--sf-tarjeta)] shadow-2xl"
                  >
                    <div className={`mx-auto grid gap-10 py-10 lg:grid-cols-[minmax(0,260px)_1fr] ${navContenedorClase}`}>
                      <div>
                        {itemPanel.intro && <p className="text-sm text-[var(--sf-texto)]">{itemPanel.intro}</p>}
                        {itemPanel.introCtaHref && (
                          <Link
                            href={itemPanel.introCtaHref}
                            onClick={() => setPanelAbierto(null)}
                            className="mt-4 inline-flex items-center rounded-full bg-[var(--sf-acento)]/10 px-4 py-2 text-sm font-medium text-[var(--sf-acento-4)] transition-colors hover:bg-[var(--sf-acento)]/20"
                          >
                            {itemPanel.introCtaLabel}
                          </Link>
                        )}
                      </div>
                      <div className="grid gap-8 sm:grid-cols-3">
                        {itemPanel.columnas.map((col, i) => (
                          <div key={i}>
                            {col.titulo && <p className="text-xs uppercase tracking-wide text-[var(--sf-texto-suave)]">{col.titulo}</p>}
                            <div className="mt-3 flex flex-col gap-2">
                              {col.enlaces.map((en, j) => (
                                <Link
                                  key={j}
                                  href={en.destino}
                                  onClick={() => setPanelAbierto(null)}
                                  className="flex items-center justify-between gap-3 text-sm text-[var(--sf-texto)] transition-colors hover:text-[var(--sf-tinta)]"
                                >
                                  <span>{en.etiqueta}</span>
                                  {en.nota && <span className="text-[var(--sf-texto-suave)]">{en.nota}</span>}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                        {(itemPanel.tarjetaImagen || itemPanel.tarjetaTitulo) && (
                          itemPanel.tarjetaCtaHref ? (
                            <Link
                              href={itemPanel.tarjetaCtaHref}
                              onClick={() => setPanelAbierto(null)}
                              className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-[var(--sf-superficie)]"
                            >
                              {itemPanel.tarjetaImagen && (
                                <Image
                                  src={itemPanel.tarjetaImagen}
                                  alt=""
                                  fill
                                  sizes="280px"
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                                {itemPanel.tarjetaTitulo && <h3 className="text-sm font-medium text-white">{itemPanel.tarjetaTitulo}</h3>}
                                {itemPanel.tarjetaCtaLabel && (
                                  <span className="mt-2 inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                                    {itemPanel.tarjetaCtaLabel}
                                  </span>
                                )}
                              </div>
                            </Link>
                          ) : (
                            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[var(--sf-superficie)]">
                              {itemPanel.tarjetaImagen && (
                                <Image src={itemPanel.tarjetaImagen} alt="" fill sizes="280px" className="object-cover" />
                              )}
                              {itemPanel.tarjetaTitulo && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                                  <h3 className="text-sm font-medium text-white">{itemPanel.tarjetaTitulo}</h3>
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* § RADIOS-UN-SOLO-RITMO-1 — "botones… del nav": buscar/carrito pasan del círculo pleno
                  (`rounded-full`, sin branch) al radio chico de la forma (`sf-radio-lg`) bajo
                  `formaCustom`, MISMO swap que el ojo/carrito de las tarjetas. Suave/Nayoli conserva
                  `rounded-full` literal, byte a byte. */}
              <button ref={searchTriggerRef} className={`p-2 cursor-pointer transition-colors ${formaCustom ? 'sf-radio-lg' : 'rounded-full'} ${iconColor}${claseBuscarBarraMovil}`} onClick={() => setSearchOpen(true)}>
                <Search className={navIconoClase} />
              </button>
              <button onClick={openCart} className={`relative p-2 transition-colors ${formaCustom ? 'sf-radio-lg' : 'rounded-full'} ${iconColor} cursor-pointer`}>
                <ShoppingBag className={navIconoClase} />
                {/* § CARRITO-CABECERA-Y-COLORES-NAV-1 (2026-09-30) -- CORRIGE `CARRITO-Y-MENU-MOVIL-
                    CAFEONE-1`: ese slice movió el contador del "crema" (`--sf-acento`/`--sf-acento-
                    txt`) al DORADO de `navTratamiento.badgeColor` (`--sf-tostado`/`--sf-tinta` +
                    el hex `#f5b36a`), razonando que era "el dorado que ya usa el badge del nav". El
                    owner, gateando contra Cafeone real: "el badge... también cambialo al rojo que
                    usamos, no el que tiene actualmente" -- el contador de CARRITO es una acción del
                    visitante (cuántos ítems lleva), no una etiqueta de catálogo como "Cosecha"/
                    "Oferta"; su color es el de ACCIÓN. Mismo GATE que ya usaba (`badgeColor` no-nulo
                    = sólo CORTE, "en toda página y estado" -- invariante a `navClaro`/scroll), pero
                    la CLASE pasa de dorado a `--sf-accion`/`--sf-accion-txt` (rojo `#a70004` +
                    blanco, § `palette-derive.ts`, `origenAccion:'acento'` de CORTE) -- el MISMO par
                    que ya pinta `CartCTA`/`BackToTop`. Sin `style` de `backgroundColor`: ya no hay
                    un hex que pisar, el color sale del token. `null` (todo tenant salvo CORTE) sigue
                    en `bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]`, byte-idéntico. */}
                {count > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-4.5 h-4.5 text-[10px] rounded-full flex items-center justify-center font-bold ${
                      navTratamiento.badgeColor
                        ? 'bg-[var(--sf-accion,var(--sf-tostado))] text-[var(--sf-accion-txt,var(--sf-tinta))]'
                        : 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]'
                    }`}
                    style={{ width: 18, height: 18, fontSize: 10 }}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
              {/* EL CTA COMPRAR, en su posición del prototipo (§ CROMO-NAV-CTA-Y-BADGE-1) — MEDIDO
                  contra `docs/prototipos/cafeone/index.html:39-53` (`.header-actions`): el ÚLTIMO
                  elemento, después del carrito — `<a class="btn btn--primary btn--sm hide-sm"
                  href="producto.html">Comprar</a>` entre el `.cart-btn` y el `.hamburger`. Sólo se
                  renderiza con `navTratamiento.cta` encendido (CORTE); el resto de los tenants sigue
                  con la pastilla translúcida de arriba, dentro del `<nav>` desktop.

                  FORMA/COLOR medidos contra `.btn.btn--primary.btn--sm` (`css/app.css:123-136`,
                  `tokens.css:66,71,77-79,123,128,171`): fondo `--sf-acento` (= `--action-primary`
                  EXACTO para CORTE), texto `--sf-acento-txt` (= `--text-on-accent`), radio de BOTÓN
                  vía `.sf-pildora` (= `--radius-button`, 0, bajo la forma `'recta'` de CORTE — no un
                  radio nuevo), mayúscula + `tracking-[0.085em]` (= `--tracking-button`, el MISMO
                  valor que ya usa `badgeSpan`) + `font-semibold` (= `--weight-semibold`, 600) por
                  CSS — el texto sigue siendo el DATO de `menu.ctaLabel`. Hover/active vía
                  `--sf-accion-hover`/`--sf-accion-active` (§ CTA-HOVER-RESTO-FAMILIA-1,
                  `palette-derive.ts`) — el ROJO OSCURECIDO del prototipo (`oscurecer()`, preserva
                  el HUE), NO `mezclar(acento, tinta, w)` (`--sf-acento-3`/`-2`, el mecanismo viejo:
                  MEDIDO, desviaba el hue hacia la tinta verde de CORTE y daba un marrón/oliva —
                  `acento-3`→`#672d00`, `acento-2`→`#403000` — en vez de "el mismo rojo oscurecido"
                  que pedía el gate del owner) + `translate-y-px` al presionar.

                  `hidden sm:inline-flex` (§ el `hide-sm` del prototipo, `app.css:999`, que oculta el
                  CTA bajo 640px junto al buscador y la cuenta): el badge del ítem de menú ya se
                  oculta ANTES —el `<nav>` entero cae bajo `lg` (1024px), más estricto que el
                  `1280px` del prototipo (`app.css:968`) — así que no hace falta una media query
                  nueva para él. El drawer móvil (`navDrawerMovil`) NO se toca: mismo límite que
                  `navTratamiento.activo`/`.filete` (§ sus propios comentarios) — es OTRA
                  composición, y el `.mobile-nav` del prototipo (`index.html:93-106`) no lleva CTA. */}
              {ctaHref && navTratamiento.cta && (
                <Link
                  href={ctaHref}
                  className="hidden sm:inline-flex items-center justify-center whitespace-nowrap leading-none sf-pildora bg-[var(--sf-acento)] px-[18px] py-[11px] text-[11px] font-semibold uppercase tracking-[0.085em] text-[var(--sf-acento-txt)] transition-all duration-[120ms] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] active:translate-y-px"
                >
                  {content.menu.ctaLabel}
                </Link>
              )}
              {/* v1: /cuenta link hidden — restore when account feature ships */}
              {/* <Link href="/cuenta" className={`hidden sm:flex items-center ml-1 text-sm font-medium rounded-full transition-colors ${linkColor}`}>
                <button className={`p-2 pt-1.5 cursor-pointer rounded-full transition-colors ${iconColor} bg-[var(--sf-acento)]/10`}>
                  <span className="text-xs font-bold text-[var(--sf-acento-4)]">Mi</span>
                </button>
              </Link> */}
              <button ref={mobileTriggerRef} className={`lg:hidden p-2 ${iconColor}`} onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu — `cromo.navTinta` NO lo toca: el spec de CROMO-NAV-FOOTER-TEMATIZABLE-1 acota
          la superficie al header fijo (banda/logo/sub-encabezado/badge), no al drawer móvil.
          `navTratamiento.activo` (§ CROMO-NAV-TRATAMIENTO-1) TAMPOCO lo toca, misma acotación: el
          `.nav-link` medido contra el prototipo es el link del header DESKTOP, siempre visible sin
          scroll ni interacción (§ el arnés de captura); el drawer móvil es otra composición
          (colores/spacing propios) que ese spec no nombra — `navDrawerMovil.variante` (§ MUESTRARIO-
          DRAWER-MOVIL-TEMA-1) es la meta PROPIA que SÍ lo gobierna, distinta de las tres de arriba. */}
      {navDrawerMovil.variante === 'pantallaCompleta' ? (
        // PANTALLA COMPLETA (§ MENU-MOVIL-COMO-CAFEONE-1, CORRIGE MUESTRARIO-DRAWER-MOVIL-TEMA-1 /
        // CARRITO-Y-MENU-MOVIL-CAFEONE-1) — el gate visual del owner sobre CAFEONE REAL
        // (`.scratch/refs/cafeone-menu-movil.png`, capturado en el gate de `CARRITO-Y-MENU-MOVIL-
        // CAFEONE-1`) midió que el drawer del sitio real NO es el `.mobile-nav` del prototipo LOCAL
        // (`docs/prototipos/cafeone/css/app.css:300-321`) que las dos tandas anteriores habían
        // medido: el real es un panel CLARO a pantalla completa, pegado a los CUATRO bordes (sin el
        // `inset:12px`/`border-radius:14px` del prototipo, sin su fondo `--surface-inverse` ni su
        // tipografía `--text-h2` gigante) — el prototipo LOCAL, acá, diverge del sitio que dice
        // imitar; el owner lo confirmó sobre el screenshot, no sobre el HTML estático. Es la TERCERA
        // fuente de "lo escrito no prueba lo que corre" (§ CLAUDE.md, El TRIPWIRE PROTEGE CONTRA LA
        // INSTRUCCIÓN): acá el "escrito" es el prototipo LOCAL versionado, no un spec ni un
        // artefacto — y el site real lo contradice, medido por captura.
        //
        // La FORMA: fondo de PÁGINA (`--sf-fondo`, nunca `--sf-tinta`), fila superior con el logo
        // —el MISMO `<Logo>` del header, fijo en `variant="light"` porque el panel SIEMPRE es
        // claro, sin importar cómo esté pintado el header (detrás, tapado por este panel)— y los
        // tres disparadores (buscar/carrito/cerrar, § el docstring viejo de `CARRITO-Y-MENU-MOVIL-
        // CAFEONE-1` sobre por qué "Cuenta" no entra, que sigue vigente), un filete bajo esa fila
        // (edge-to-edge: el `border-b` vive en la PROPIA fila con su `px-6`, no en un contenedor
        // padre — el filete alcanza los bordes de pantalla A PROPÓSITO, a diferencia del filete del
        // header sólido, § CROMO-NAV-EXACTO-PROTOTIPO-1, que lo evita). Los ÍTEMS pasan de
        // `font-display text-[32px]` a la MISMA tipografía de interfaz + tracking que ya usa el
        // `<nav>` desktop (`navLinkTratamiento`/`navHoverClase`, arriba — reutilizados tal cual, no
        // reinventados), con un filete fino entre cada uno — INCLUYENDO tras el último: medido
        // contra la referencia, la línea sigue tras el ítem final antes del espacio vacío.
        //
        // EL FILETE DE LOS ÍTEMS LLEVA MARGEN, A DIFERENCIA DEL DE LA CABECERA — § MENU-MOVIL-
        // MARGEN-Y-CENSO-TRANSICIONES-1 (2026-09-30), CORRIGE la lectura de arriba ("edge-to-edge,
        // mismo mecanismo"): esa lectura describía el código de MENU-MOVIL-COMO-CAFEONE-1, y era
        // literalmente lo que el código hacía — pero MEDIDO por PÍXEL contra la MISMA referencia
        // (`.scratch/refs/cafeone-menu-movil.png`, `sharp` sobre el raw decodificado, sin asumir):
        // la fila de la cabecera pinta oscuro en TODO el ancho de la imagen (`first:0, last:358` de
        // 359px — edge-to-edge, exacto); las CUATRO líneas entre ítems pintan oscuro sólo de
        // `first:21` a `last:338` — un margen de ~20px por lado, alineado con el arranque del texto
        // (`first:24` en las filas de letras). Dos filetes con la MISMA forma de código
        // (`border-b` en un elemento `w-full`) medían DISTINTO en la referencia: el de la cabecera
        // es de verdad edge-to-edge; el de los ítems tenía margen, y el código (border-b sobre el
        // `<Link>`/`<button>` `w-full`) lo pintaba edge-to-edge por el mismo motivo que ya cerró
        // § CROMO-NAV-EXACTO-PROTOTIPO-1 para el filete del header SÓLIDO: un `border-b` se dibuja
        // en el borde EXTERIOR de la caja del elemento, sin importar su `padding` — puesto en una
        // fila `w-full px-6`, el borde queda en el borde exterior de ESA fila (el ancho completo),
        // no inset por su propio `padding-inline`.
        //
        // EL FIX: el `border-b` SALE de `filaClase` (que ya NO declara borde) y pasa a un `<div
        // aria-hidden>` HERMANO, con `mx-6` en vez de `px-6` — MARGEN, no relleno, así que el borde
        // vive en el borde exterior de ESE div, que ya nació angosto por el margen. `mx-6` es el
        // MISMO valor de espaciado que `px-6` (1.5rem = 24px, la escala de Tailwind), así que el
        // filete queda alineado al arranque/fin del texto de la fila de arriba — el número que la
        // referencia mide (~20px a 359px de ancho) es la MISMA proporción, a otra densidad de
        // píxel. La fila (`<Link>`/`<button>`) SIGUE `w-full` con su `px-6 py-4`: el ÁREA TÁCTIL no
        // se achica —el margen es sólo del filete decorativo, nunca del target de toque—, así que
        // esta corrección no reduce el hit-target de ningún ítem. El divisor se renderiza SIEMPRE
        // tras el contenido completo de la fila (para un ítem CON panel, tras el `<button>` Y su
        // lista expandida si está abierta) — reemplaza al `border-b-0` condicional de antes, que
        // ya no hace falta: un solo filete al final de cada `motion.div`, nunca dos.
        //
        // EL SUBMENÚ (`l.panel`) AHORA FUNCIONA: antes el chevron era puramente decorativo (el link
        // navegaba directo a `l.path`, ignorando el panel). Un ítem CON panel deja de ser un
        // `<Link>` y pasa a ser un `<button>` que alterna `mobileSubAbierto` (arriba) — el MISMO
        // patrón que el `<button data-menu>` del sitio real para "Nuestro café"/"Historia" (no
        // navegan directo, abren su desplegable) — y expande la lista PLANA de
        // `l.panel.columnas[].enlaces` (sin la intro/columna-título/tarjeta promocional del mega-
        // menú desktop: ese layout de 3 columnas no cabe en un panel de ~350px, y ningún tenant del
        // catálogo declara hoy un `panel` — § unknowns del asiento de este slice, sin referencia
        // visual del estado EXPANDIDO para medir contra algo más rico). El chevron rota 90° al
        // abrir (mismo `ease`/duración que el resto de transiciones de esta composición; el guard
        // GLOBAL de `prefers-reduced-motion` en `app/globals.css` la congela sola, sin un gate
        // propio — ya cubre cualquier `transition-transform`).
        //
        // LA LISTA EXPANDIDA, EN CAMBIO, APARECÍA/DESAPARECÍA DE GOLPE — § MENU-MOVIL-MARGEN-Y-CENSO-
        // TRANSICIONES-1 (censo de transiciones, 2026-09-30): sólo el CHEVRON tenía transición; el
        // `{abierto && (<div>…)}` de la lista era un `<div>` PLANO, montado/desmontado en el mismo
        // tick — medido por lectura del código (sin `motion`/`AnimatePresence` en esa rama). Pasó a
        // `AnimatePresence` + `motion.div` animando `height`/`opacity` (`initial={false}` para que el
        // primer render de un ítem recién montado no dispare una entrada fantasma), MISMA
        // duración/curva que `ENTRADA_ESCALONADA_DRAWER` de arriba (220ms, `--ease-out` del
        // prototipo) — no los 420ms de la entrada ESCALONADA del drawer entero (esto es un acordeón
        // LOCAL a un ítem, no la apertura del panel completo).
        //
        // «COMPRAR» AL PIE, RECTO: el CTA del menú (§ CROMO-MENU-COMO-DATO-1) deja la píldora
        // translúcida sobre-tinta y pasa a la MISMA familia CTA-primario que ya pinta el "Comprar"
        // del encabezado desktop (`navTratamiento.cta`, más abajo en este archivo) — MISMA clase,
        // duplicada literal con su propio comentario en vez de extraída a una constante compartida:
        // es el patrón que este archivo YA sigue para dos renders del mismo elemento en superficies
        // distintas (el contador del carrito, arriba, está duplicado exactamente así). `sf-pildora`
        // ya resuelve RADIO 0 para CORTE (forma 'recta', `--sf-pildora`→0, § formas.ts) — "recto"
        // sale gratis del mismo token que ya usa el CTA del encabezado, sin un segundo valor.
        <AnimatePresence>
          {mobileOpen && (
            <BloqueaClicksAlSalir>
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[var(--sf-fondo)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--sf-linea)] px-6 py-5">
                {/* § EDITOR-TIENDA-CROMO-1 — mismo ENCABEZADO que la cabecera de escritorio, marcado
                    sólo en modo editor (el `display:contents` deja intacto el layout de siempre:
                    la misma técnica que ya envuelve a `logoLink` arriba, en vez de duplicar el JSX
                    del logo una segunda vez para esta rama). */}
                {enModoEditor ? (
                  <div data-editor-seccion="encabezado" style={{ display: 'contents' }}>{logoLinkMovil}</div>
                ) : (
                  logoLinkMovil
                )}
                {/* "buscar si existe, carrito, cerrar" — § CARRITO-Y-MENU-MOVIL-CAFEONE-1, sin
                    cambio de alcance: "Cuenta" sigue sin entrar (`/cuenta` oculta, v1). */}
                {/* § RADIOS-UN-SOLO-RITMO-1 — mismo swap que las dos de arriba (desktop): el círculo
                    pleno de los tres botones de este header móvil pasa al radio chico de la forma bajo
                    `formaCustom`; Suave/Nayoli conserva `rounded-full` literal. */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); setSearchOpen(true); }}
                    className={`p-2 transition-colors ${formaCustom ? 'sf-radio-lg' : 'rounded-full'} ${drawerTextoClase}`}
                    aria-label="Buscar"
                  >
                    <Search className={navIconoClase} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); openCart(); }}
                    className={`relative p-2 transition-colors ${formaCustom ? 'sf-radio-lg' : 'rounded-full'} ${drawerTextoClase}`}
                    aria-label="Ver carrito"
                  >
                    <ShoppingBag className={navIconoClase} />
                    {/* § CARRITO-CABECERA-Y-COLORES-NAV-1 -- MISMO fix que el contador del
                        encabezado desktop (arriba en este archivo): dorado -> `--sf-accion`/
                        `--sf-accion-txt`, "en toda página y estado" (el gate no depende de
                        `navClaro` en ninguna de las dos copias, ni de que el panel sea claro). */}
                    {count > 0 && (
                      <span
                        className={`absolute -top-0.5 -right-0.5 text-[10px] rounded-full flex items-center justify-center font-bold ${
                          navTratamiento.badgeColor
                            ? 'bg-[var(--sf-accion,var(--sf-tostado))] text-[var(--sf-accion-txt,var(--sf-tinta))]'
                            : 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]'
                        }`}
                        style={{ width: 18, height: 18, fontSize: 10 }}
                      >
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={cerrarMobileYDevolverFoco}
                    className={`p-2 transition-colors ${formaCustom ? 'sf-radio-lg' : 'rounded-full'} ${drawerTextoClase}`}
                    aria-label="Cerrar el menú"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* § EDITOR-TIENDA-CROMO-1 — el MENÚ del cajón móvil, mismo marcador que la versión
                  de escritorio. */}
              <nav className="flex flex-col" data-editor-seccion={enModoEditor ? 'menu' : undefined}>
                {links.map((l, i) => {
                  const filaClase = `flex w-full items-center justify-between gap-2 px-6 py-4 text-sm ${navLinkTratamiento} transition-colors ${drawerTextoClase}`;
                  if (l.panel) {
                    const abierto = mobileSubAbierto === l.id;
                    const enlaces = l.panel.columnas.flatMap((col) => col.enlaces);
                    return (
                      <motion.div key={l.path} custom={{ i, total: totalEntradasDrawerMovil }} variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible" exit="exit">
                        <button
                          type="button"
                          aria-expanded={abierto}
                          aria-controls={`mobile-sub-${l.id}`}
                          onClick={() => setMobileSubAbierto(abierto ? null : l.id)}
                          className={`${filaClase} cursor-pointer text-left`}
                        >
                          <span className="inline-flex items-center gap-2">
                            {l.label}
                            {l.badge && badgeSpan(l.badge)}
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${abierto ? 'rotate-0' : '-rotate-90'}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {abierto && (
                            <motion.div
                              key={`mobile-sub-${l.id}`}
                              id={`mobile-sub-${l.id}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="flex flex-col px-6 pb-3 pt-1">
                                {enlaces.map((en, j) => (
                                  <Link
                                    key={j}
                                    href={en.destino}
                                    onClick={() => setMobileOpen(false)}
                                    className="py-1.5 pl-4 text-sm text-[var(--sf-texto-suave)] transition-colors hover:text-[var(--sf-tinta)]"
                                  >
                                    {en.etiqueta}
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div aria-hidden="true" className="mx-6 border-b border-[var(--sf-linea)]" />
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div key={l.path} custom={{ i, total: totalEntradasDrawerMovil }} variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible" exit="exit">
                      <Link href={l.path} onClick={() => setMobileOpen(false)} className={filaClase}>
                        <span className="inline-flex items-center gap-2">
                          {l.label}
                          {l.badge && badgeSpan(l.badge)}
                        </span>
                      </Link>
                      <div aria-hidden="true" className="mx-6 border-b border-[var(--sf-linea)]" />
                    </motion.div>
                  );
                })}
                <motion.div custom={{ i: links.length, total: totalEntradasDrawerMovil }} variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible" exit="exit">
                  <Link
                    href="/rastrear-pedido"
                    onClick={() => setMobileOpen(false)}
                    className={`flex w-full items-center px-6 py-4 text-sm ${navLinkTratamiento} transition-colors ${drawerTextoClase}`}
                  >
                    Rastrear Pedido
                  </Link>
                  <div aria-hidden="true" className="mx-6 border-b border-[var(--sf-linea)]" />
                </motion.div>
              </nav>
              {/* El CTA del menú, al PIE de la lista — § MENU-MOVIL-COMO-CAFEONE-1, arriba, para el
                  porqué de la clase duplicada (misma familia que el "Comprar" del encabezado
                  desktop, `navTratamiento.cta` más abajo en este archivo). */}
              {ctaHref && (
                <motion.div
                  custom={{ i: links.length + 1, total: totalEntradasDrawerMovil }}
                  variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible" exit="exit"
                  className="px-6 pb-8 pt-5"
                >
                  <Link
                    href={ctaHref}
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center whitespace-nowrap leading-none sf-pildora bg-[var(--sf-acento)] px-[18px] py-[11px] text-[11px] font-semibold uppercase tracking-[0.085em] text-[var(--sf-acento-txt)] transition-all duration-[120ms] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] active:translate-y-px"
                  >
                    {content.menu.ctaLabel}
                  </Link>
                </motion.div>
              )}
            </motion.div>
            </BloqueaClicksAlSalir>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed top-16 left-0 right-0 z-40 bg-[var(--sf-tarjeta)] shadow-lg sf-divisor-b border-[var(--sf-linea)]">
              <nav className="relative flex flex-col px-4 py-4 gap-4">
                {links.map(l => (
                  <Link key={l.path} href={l.path} onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2 sf-divisor-b border-[var(--sf-superficie)] last:border-0">{l.label}</Link>
                ))}
                {/* El CTA del menú (§ CROMO-MENU-COMO-DATO-1), la misma pieza que el desktop nav —
                    pintada como acción, no como link plano—. */}
                {ctaHref && (
                  <Link
                    href={ctaHref}
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-[var(--sf-acento)]/10 text-[var(--sf-acento-4)]"
                  >
                    {content.menu.ctaLabel}
                  </Link>
                )}
                {/* v1: /cuenta link hidden — restore when account feature ships */}
                {/* <Link href="/cuenta" onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2">Mi Cuenta</Link> */}
                <Link href="/rastrear-pedido" onClick={() => setMobileOpen(false)} className="text-[var(--sf-acento-2)] font-medium py-2">Rastrear Pedido</Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}