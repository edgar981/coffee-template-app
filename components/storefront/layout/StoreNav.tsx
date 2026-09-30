"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, Search, ChevronDown } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { motion, AnimatePresence } from 'framer-motion';
import NavSearch from './NavSearch';
import { Logo } from '@/components/storefront/Logo';
import { STOREFRONT_TIENE_MARK } from '@/lib/config/storefront-marca';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { tratamientoNav } from '@/lib/config/esquema-style';
import { resolverOrden, varianteDeBanda, itemsDeMenu, menuCtaHref, type MenuItemId } from '@/lib/config/site-content-defaults';
import { direccionScroll, navOculto, debeActualizarTratamientoNav, type DireccionScroll } from '@/lib/animation';
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
const ENTRADA_ESCALONADA_DRAWER = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [0.22, 0.61, 0.36, 1] as const, delay: i * 0.06 + 0.08 },
  }),
};

export default function StoreNav() {
  const { nombre, tagline } = useSiteSettings();
  // El MENÚ es DATO (§ CROMO-MENU-COMO-DATO-1): `itemsDeMenu` resuelve las etiquetas + el orden
  // editables sobre el set CERRADO de tres ítems, y sigue gateando "Nosotros"/"Suscripciones" por
  // `paginas.*.visible`, SIN CAMBIO (renombrar no es encender). Con `content.menu` en su default —
  // ningún tenant lo edita— `links` es EXACTAMENTE el array de hoy: label/path de las tres rutas, en
  // el mismo orden. El CTA (`menuCtaHref`) nace apagado (`null`) hasta que el dueño lo configure.
  // Cada ítem puede llevar además un `panel` (§ MUESTRARIO-MEGA-MENU-1) — AUSENTE para todo tenant
  // que no lo declare (Nayoli), así que el `.map` de abajo sigue byte-idéntico sin tocar nada.
  const content = useSiteContent();
  const { esquemas, tema, orden, cromo, navTratamiento, navWordmark, navDrawerMovil } = content;
  const links = itemsDeMenu(content);
  const ctaHref = menuCtaHref(content);
  // `navDireccionActiva` (§ CROMO-NAV-DIRECCION-SCROLL-1) se lee ACÁ ARRIBA, no sólo junto a `oculto`
  // más abajo (que sigue siendo su otro consumidor): el listener de scroll también lo necesita, para
  // decidir si CONGELA el tratamiento al bajar (§ CROMO-NAV-SIN-DESTELLO-1, el bloque de abajo).
  const navDireccionActiva = navTratamiento.direccion;

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
  const { count, openCart } = useCartStore();
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => { setPanelAbierto(null); }, [pathname]);

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
  const primera = resolverOrden(orden)[0];
  const t = tratamientoNav(primera, varianteDeBanda(content, primera), esquemas, tema.fondo, tema.tinta, tema.acento);
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

  const navBg = navFlotando
    ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
    : navBandaTinta
      ? 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]'
      : 'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]';

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
  // tinta)]`, el MISMO par que ya usan `Spotlight.badge`/`product.badge` en este repo (§ el docstring
  // de `NavTratamientoContent.cta`, `site-content-defaults.ts`, para el porqué de `tostado` en vez
  // de un rol nuevo). Las dos superficies son OPACAS, así que el mismo par se lee igual flotando
  // sobre el hero o con el nav sólido — no hace falta un segundo par por tratamiento.
  //
  // `navTratamiento.badgeColor` (§ RIEL-SCROLL-Y-BADGE-DORADO-1) — el `style` inline SÓLO se aplica
  // cuando el campo NO es `null` (sólo CORTE): pisa el `background-color` de la clase Tailwind con
  // el hex medido contra `--accent-sale` (`#f5b36a`). `undefined` con el campo en `null` hace que
  // React OMITA la propiedad — la clase `bg-[var(--sf-tostado)]` de siempre queda intacta,
  // byte-idéntica. `ProductCard.tsx`/`Spotlight.tsx` aplican el MISMO override sobre su propio badge
  // (§ el censo de consumidores, DECISIONS.md).
  const badgeSpan = (texto: string) => (
    <span
      className={`inline-flex items-center px-[9px] py-[5px] text-[11px] font-bold uppercase tracking-[0.085em] leading-none rounded-[2px] ${navTratamiento.cta ? 'bg-[var(--sf-tostado)] text-[var(--sf-tinta)]' : navClaro ? 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]' : 'bg-[var(--sf-tinta)]/5 text-[var(--sf-tinta)]'}`}
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
  const logoLink = (
    <Link href="/" aria-label={`${nombre} — inicio`} className="transition-colors">
      {/* Cream lockup over the transparent hero, espresso once scrolled */}
      <Logo
        nombre={nombre}
        variant={navClaro ? 'dark' : 'light'}
        conMark={STOREFRONT_TIENE_MARK}
        subtitle={cromo.navSubtitulo ? tagline : undefined}
        wordmarkTratado={navWordmark.activo}
      />
    </Link>
  );

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navOcultoClase} ${navBg}`}
        onFocus={() => setFocoDentro(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocoDentro(false);
        }}
      >
        <div className={`mx-auto ${navContenedorClase}`}>
          <div className={`flex items-center justify-between ${navFilaAltoClase} ${navFileteClase}`}>
            {/* Logo — SIN el badge de `cromo.navBadge` (§ CORTE-BADGE-COSECHA-EN-MENU-1). Antes esta
                celda condicionaba entre `logoLink` solo y un flex que lo envolvía junto al badge; el
                badge se MUDÓ a ser un atributo de un ítem del menú (abajo, `l.badge`), así que el
                logo vuelve a ser SIEMPRE `logoLink` a secas, sin `<div>` extra alrededor —
                byte-idéntico a hoy para TODO tenant, incluido CORTE (que ya no lo declara acá).
                `cromo.navBadge` queda DORMIDO: sigue en el modelo/schema (§ CromoContent,
                site-content-defaults.ts), pero ningún componente lo lee. */}
            {logoLink}

            {/* Desktop Nav */}
            <nav className="relative hidden lg:flex items-center gap-8">
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
              <button ref={searchTriggerRef} className={`p-2 cursor-pointer rounded-full transition-colors ${iconColor}`} onClick={() => setSearchOpen(true)}>
                <Search className={navIconoClase} />
              </button>
              <button onClick={openCart} className={`relative p-2 rounded-full transition-colors ${iconColor} cursor-pointer`}>
                <ShoppingBag className={navIconoClase} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] text-[10px] rounded-full flex items-center justify-center font-bold" style={{ width: 18, height: 18, fontSize: 10 }}>
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
              <button className={`lg:hidden p-2 ${iconColor}`} onClick={() => setMobileOpen(!mobileOpen)}>
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
        // PANTALLA COMPLETA (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1) — MEDIDA contra `.mobile-nav` del
        // prototipo (`docs/prototipos/cafeone/css/app.css:300-321`, `index.html:93-106`): panel FIJO
        // a `inset:12px` (`--frame-gap`), `border-radius:14px` (`--frame-radius`), fondo `--sf-tinta`
        // (la MISMA raíz que `--surface-inverse`), padding `py-8 px-6` (`--space-8`/`--space-6`),
        // cabecera propia (wordmark + botón cerrar, `mb-10` = `--space-10`, 40px) y los links con
        // entrada escalonada (`ENTRADA_ESCALONADA_DRAWER`, arriba). El wordmark se pinta DIRECTO, no
        // vía `<Logo>`: `wordmarkTratado` de ese componente sólo aplica DENTRO de la rama `subtitle`
        // (`Logo.tsx`), y `.mobile-nav-head .wordmark` del prototipo NO lleva sub — es la composición
        // FIJA de esta variante, no un eje independiente de `navWordmark.activo`. Todos los ítems de
        // HOY se conservan (links + CTA + Rastrear Pedido) — sólo cambia la COMPOSICIÓN que los pinta.
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="fixed inset-3 z-50 overflow-y-auto rounded-[14px] bg-[var(--sf-tinta)] px-6 py-8"
            >
              <div className="mb-10 flex items-center justify-between">
                <span className="font-display text-[30px] uppercase leading-none tracking-[0.01em] text-[var(--sf-sobre)]">
                  {nombre}
                </span>
                <button type="button" onClick={() => setMobileOpen(false)} className="p-2 text-[var(--sf-sobre)]" aria-label="Cerrar el menú">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex flex-col">
                {links.map((l, i) => (
                  <motion.div key={l.path} custom={i} variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible">
                    <Link
                      href={l.path}
                      onClick={() => setMobileOpen(false)}
                      className="block border-b border-[var(--sf-sobre)]/20 py-4 font-display text-[32px] leading-none text-[var(--sf-sobre)] last:border-0"
                    >
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
                {/* El CTA del menú (§ CROMO-MENU-COMO-DATO-1), la misma pieza que el dropdown de hoy
                    — pintada como acción, no como link plano—, con el color sobre-tinta de esta
                    composición. Continúa la secuencia escalonada tras los links. */}
                {ctaHref && (
                  <motion.div custom={links.length} variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible">
                    <Link
                      href={ctaHref}
                      onClick={() => setMobileOpen(false)}
                      className="mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]"
                    >
                      {content.menu.ctaLabel}
                    </Link>
                  </motion.div>
                )}
                <motion.div custom={links.length + (ctaHref ? 1 : 0)} variants={ENTRADA_ESCALONADA_DRAWER} initial="hidden" animate="visible">
                  <Link
                    href="/rastrear-pedido"
                    onClick={() => setMobileOpen(false)}
                    className="block border-b border-[var(--sf-sobre)]/20 py-4 font-display text-[32px] leading-none text-[var(--sf-sobre)] last:border-0"
                  >
                    Rastrear Pedido
                  </Link>
                </motion.div>
              </nav>
            </motion.div>
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