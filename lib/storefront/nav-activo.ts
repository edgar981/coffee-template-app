// lib/storefront/nav-activo.ts — § NAV-PAGINA-ACTUAL-VISIBLE-1
//
// Pedido del owner (2026-10-08), navegando la tienda del demo: «al navegar en la página, el
// indicador de cuál página es la actual en el nav no se nota». Medido ANTES de tocar nada
// (`.scratch/medir-contraste-nav-activo.ts`, contra `derivarPaleta`): el color del activo YA pasa
// AA de sobra contra su fondo en las cuatro combinaciones (Nayoli home-flotando 8.49:1, Nayoli
// interna 7.10:1, CORTE home-flotando 7.38:1, CORTE interna 16.44:1) — el defecto no es de
// CONTRASTE contra el fondo, es que el color ACTIVO y el color INACTIVO son dos tonos de la MISMA
// familia cálida (p.ej. Nayoli interna: `texto`=#613211 vs `acento-texto`=#8b4513, los dos marrones
// oscuros) y la diferencia entre ellos no se lee de un vistazo. La respuesta es FORMA, no un color
// más contrastado — una línea bajo el enlace, igual que ya hace el tema que tiene subrayado al
// pasar el mouse (CORTE, `navTratamiento.subrayado`): el activo deja ESE mismo subrayado FIJO en
// vez de inventar una segunda mecánica para ese tema.
//
// `StoreNav.tsx` NO se renderiza en un test (usa `usePathname()`, revienta fuera de un árbol real
// de Next.js — la misma frontera que ya documentan `nav-internas.test.ts`/
// `corte-nav-transparente.test.ts` para este mismo componente). Por eso la REGLA de cuál enlace
// está activo, y la FORMA de su indicador, viven acá como funciones puras — StoreNav.tsx sólo las
// consume; su cableado se verifica por captura (gate visual), no por render en el carril.

/**
 * ¿Es `path` la página actual? Incluye subrutas (`/tienda/algo` activa el ítem `/tienda`) con un
 * límite de SEGMENTO, no un prefijo literal: `pathname.startsWith(path)` a secas (el código de
 * antes de este slice) activaría `/tienda` también para un futuro `/tienda-outlet`, porque
 * '/tienda-outlet'.startsWith('/tienda') es true sin que el visitante esté en "Tienda". Acá se
 * exige que el siguiente carácter sea '/' (una subruta real) o que no haya más caracteres (match
 * exacto).
 *
 * La HOME ('/') nunca activa nada: ningún ítem del menú declara ese path (`MENU_PATHS`,
 * `site-content-defaults.ts`), pero la guarda es explícita para no depender de que siga siendo
 * así — con `path === '/'` sólo matchea `pathname === '/'`, nunca activa de más por ser el prefijo
 * de TODO pathname.
 */
export function esRutaActiva(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Para el tema que YA pinta un subrayado al pasar el mouse (`navTratamiento.subrayado`, hoy sólo
 * CORTE, § `esquema-style.ts`/`site-content-defaults.ts`): el enlace ACTIVO reusa ESE mismo
 * mecanismo `after:` (ya declarado en `navHoverClase`, StoreNav.tsx) dejándolo FIJO, en vez de que
 * el activo invente una segunda línea — mismo patrón que `subrayadoAbierto` ya usa para el panel
 * desplegable abierto (StoreNav.tsx, § MUESTRARIO-MEGA-MENU-1).
 */
export function claseSubrayadoActivoDelTema(activo: boolean, subrayadoDelTema: boolean): string {
  return activo && subrayadoDelTema ? 'after:scale-x-100' : '';
}

/**
 * Para el resto del catálogo (sin subrayado al hover, incluida Nayoli): el enlace ACTIVO gana su
 * PROPIA línea fina y fija bajo el texto. `bg-current` —nunca un token nuevo— hereda el color que
 * el link YA resuelve para su estado activo (acento/tinta según el fondo, § `colorActivo` en
 * StoreNav.tsx), así que el contraste sigue siendo el mismo que ya se midió suficiente: esto sólo
 * agrega la forma, no cambia el color.
 *
 * Envuelve sólo el LABEL (el llamador lo aplica al `<span>` del texto, no al `<Link>`/`<button>`
 * entero): así la línea mide el ancho del texto, no el de toda la fila — importa en el drawer
 * móvil, donde la fila es `w-full` y una línea a ese ancho se leería como un segundo divisor, no
 * como el subrayado de un enlace.
 */
export function claseSubrayadoActivoPropio(activo: boolean, subrayadoDelTema: boolean): string {
  if (!activo || subrayadoDelTema) return '';
  return 'relative inline-block after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-current';
}
