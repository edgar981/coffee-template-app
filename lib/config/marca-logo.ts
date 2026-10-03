// EL LOGO SUBIDO del storefront (§ MARCA-LOGO-IMAGEN-1) — reglas PURAS de qué versión mostrar y
// cuál texto alternativo usar, compartidas por `Logo.tsx` (el componente) y cualquier consumidor
// futuro que necesite la misma decisión sin re-renderizar el lockup completo.
//
// Vive APARTE de `site-content-defaults.ts` (que sólo declara el CONTRATO de dato — `LogoContent`,
// el REGISTRY, los defaults) porque esto es lógica de PRESENTACIÓN: qué versión corresponde a qué
// fondo, no qué se guarda. Mismo criterio de separación que `lib/config/email-colors.ts` o
// `lib/productos/categorias.ts` — un módulo puro, chico, testeado aparte de la mecánica de guardado.

import type { LogoContent, ColorTagline } from './site-content-defaults';

/** ¿Hay AL MENOS una imagen de logo subida (oscura o clara)? Si no, el storefront muestra el
 *  wordmark de texto (o la flor de Nayoli, § STOREFRONT_TIENE_MARK) — exactamente lo de hoy. */
export function hayLogoImagen(logo: LogoContent): boolean {
  return logo.oscuro.trim() !== '' || logo.claro.trim() !== '';
}

/**
 * La URL del logo para una VARIANTE del lockup (§ Logo.tsx: `'light'` = superficie clara —texto
 * oscuro, páginas internas y encabezado sólido—; `'dark'` = superficie oscura/tinta —la portada
 * flotando sobre el hero, el pie de página—).
 *
 * Si falta la versión preferida para esa variante, usa la OTRA: nunca deja de mostrar el logo
 * subido sólo porque falta una de las dos versiones (§ el spec de este slice, "si falta una
 * versión, usa la otra"). `''` si NINGUNA está subida — el consumidor cae al wordmark de texto.
 */
export function logoParaVariante(logo: LogoContent, variant: 'light' | 'dark'): string {
  const preferida = variant === 'light' ? logo.oscuro : logo.claro;
  if (preferida.trim() !== '') return preferida;
  const alterna = variant === 'light' ? logo.claro : logo.oscuro;
  return alterna;
}

/**
 * CÓMO SE MUESTRA LA MARCA (§ NAV-LOGO-Y-NOMBRE-1) — tres modos, uno elegido EXPLÍCITAMENTE por el
 * dueño (`logo.modo`), los otros dos el default según haya o no imagen subida (§ el spec de este
 * slice: "Default: el comportamiento de hoy según haya o no logo"):
 *
 *  · `'soloNombre'` — ignora cualquier imagen subida, siempre mark+wordmark de texto. Es el default
 *    SIN logo (el caso de HOY, Nayoli) y también una elección válida CON logo (el dueño puede
 *    querer volver al texto sin borrar las imágenes que ya subió).
 *  · `'soloLogo'` — la imagen REEMPLAZA mark+wordmark enteros, en TODOS los anchos. Es el default
 *    CON logo (el caso de HOY para cualquier tenant que ya subió uno, § MARCA-LOGO-IMAGEN-1).
 *  · `'logoYNombre'` — NUEVO: sólo el logo en el ancho de teléfono, logo + nombre en escritorio
 *    (Café Las Chamisas, con su sello redondo).
 *
 * `logo.modo` es un campo 'opcional' más (§ REGISTRY.logo.campos, site-content-defaults.ts): SOFT,
 * nunca lanza, y el resolver lo pasa TAL CUAL —sin clampar— porque `resolverVariante`/`escalares`
 * exige una canónica FIJA y el default de este campo es CONDICIONAL (depende de `hayLogoImagen`,
 * que `resolverVariante` no puede mirar). El clamp —y la interpretación de `''`, ausente o basura—
 * vive ACÁ, en la única función que lo resuelve: `Logo.tsx` (el storefront, § el prop `logo`) y
 * `EncabezadoSeccion.tsx` (el admin, para mostrar la opción vigente en el `<select>`) la comparten,
 * así que las dos superficies no pueden discrepar sobre qué significa un valor guardado.
 */
export type ModoLogo = 'soloNombre' | 'soloLogo' | 'logoYNombre';
const MODOS_LOGO = new Set<ModoLogo>(['soloNombre', 'soloLogo', 'logoYNombre']);

export function modoLogoResuelto(logo: LogoContent): ModoLogo {
  if (MODOS_LOGO.has(logo.modo as ModoLogo)) return logo.modo as ModoLogo;
  return hayLogoImagen(logo) ? 'soloLogo' : 'soloNombre';
}

/**
 * El texto alternativo de la imagen del logo: lo que el dueño escribió, o —vacío— el nombre del
 * negocio. Mismo patrón que la galería de /nosotros (§ NosotrosGaleria, "ALT opcional con
 * FALLBACK CONTEXTUAL, no requerido"): un campo requerido que el operador no llena se rellenaría
 * con basura, peor para un lector de pantalla que un fallback que describe el contexto real.
 */
export function altDeLogo(logo: LogoContent, nombreNegocio: string): string {
  return logo.alt.trim() !== '' ? logo.alt : nombreNegocio;
}

// EL AIRE que separa el logo del borde de la barra, arriba y abajo (§ NAV-LOGO-MOVIL-CON-AIRE-1,
// corrige NAV-LOGO-Y-NOMBRE-AJUSTE-1): ese slice hizo que el `<img>` llenara la barra BORDE A
// BORDE — midió 64px/76px de alto de `<img>` == el alto EXACTO de la barra en los dos escenarios
// (§ su asiento, "llena la barra borde a borde") — y un sello con ilustración + texto curvo pintado
// hasta el borde de su propio cuadro se SALE visualmente de la barra: el texto de arriba toca el
// borde superior y el de abajo se monta sobre el filete inferior (medido por el orquestador contra
// la demo, WebKit iPhone 15, § el spec de este slice).
//
// 12px POR LADO (24px total), EXPLÍCITO y NOMBRADO — SUBIDO de 8px a 12px por § NAV-LOGO-TAMANOS-
// FINOS-1: el gate del owner sobre la demo real (Café Las Chamisas, capturas de su iPhone) pidió el
// logo de la barra "un poco más chico" — un AJUSTE FINO sobre un aire que ya existía y ya resolvía
// el defecto de arriba (el sello que se salía de la barra), no un defecto nuevo. 12px sigue siendo
// del MISMO vocabulario de espaciado del nav que ya justificaba los 8px (`gap-2`=8px entre los
// íconos de "Actions"): `gap-3`=12px, el siguiente paso de la escala de Tailwind, no un número
// inventado para este ajuste. NO el aire del ÍCONO: el ícono del nav (`navIconoClase`,
// StoreNav.tsx) mide 22px dentro de una barra de 76px (CORTE), o sea ~27px de aire por lado —
// replicar esa proporción dejaría el logo en ~22px de alto, literalmente el defecto ILEGIBLE que
// NAV-LOGO-Y-NOMBRE-AJUSTE-1 corrigió (§ el docstring de abajo).
//
// SÓLO PARA DOCUMENTAR LA ARITMÉTICA — `altoLogoNavMovilClase` NO la usa en un template literal
// interpolado: Tailwind v4 genera CSS escaneando texto LITERAL de las clases en el código fuente
// (§ CLAUDE.md, "Literal y no interpolado, para que el JIT de Tailwind vea las clases" —
// `gridColsPresentaciones`, el mismo defecto que ese comentario ya nombra). Un `` `h-[${64 -
// a}px]` `` no aparece como texto `h-[48px]` en ningún archivo, así que el JIT no generaría la
// clase y el alto NO se aplicaría en producción. Los tres valores de `altoLogoNavMovilClase` son
// por eso LITERALES, escritos a mano como `64/76/88 − 24`.
export const AIRE_VERTICAL_LOGO_MOVIL_PX = 12;

/**
 * EL ALTO DEL LOGO EN `'logoYNombre'` (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1, corrige NAV-LOGO-Y-NOMBRE-1;
 * NAV-LOGO-MOVIL-CON-AIRE-1 resta el aire vertical, § arriba): el logo dejó de ser un ícono FIJO de
 * 28px (`h-7`, ilegible para un sello con ilustración — medido ~22px de alto REAL de tinta en la
 * demo de Café Las Chamisas) y pasa a un alto DERIVADO en los dos anchos, nunca un número suelto.
 *
 * EN EL TELÉFONO (`<lg`, el único hijo visible — el bloque nombre+tagline está `hidden`): el alto
 * DISPONIBLE de la barra MENOS `2×AIRE_VERTICAL_LOGO_MOVIL_PX` — el mismo alto de barra que ya fija
 * `navFilaAltoClase` (StoreNav.tsx) para ese tramo — 64px para el resto del catálogo, 76/88px para
 * CORTE (§ NAV-ALTURA-CON-FILETE-1, ya afirmado en `nav-internas.test.ts` vía `navOffsetClase`). Se
 * REPLICA, no se importa: este módulo es puro (sin JSX) y `navFilaAltoClase` vive en el componente
 * — mismo criterio que ya separa `navOffsetClase` (themes.ts) de la barra que describe.
 *
 * EL ALTO DE LA BARRA Y EL FILETE NO CAMBIAN — sólo la CAJA del `<img>` se achica dentro de ella;
 * el `items-center` que YA envuelve al logo (`StoreNav.tsx`, la fila `flex items-center…`, y el
 * `<div className="flex min-w-0 items-center gap-2.5">` de la rama `logoYNombre`, `Logo.tsx`) lo
 * CENTRA verticalmente dentro de la fila sin que esta función toque un solo píxel de margen: el
 * aire aparece SOLO porque la caja del logo ya no es tan alta como la barra, no porque se le haya
 * agregado un `margin`/`padding` propio.
 */
export function altoLogoNavMovilClase(posicion: boolean): string {
  // LITERALES a propósito (§ el comentario de `AIRE_VERTICAL_LOGO_MOVIL_PX`, arriba): 64/76/88,
  // el alto de barra de `navFilaAltoClase`, menos 24 (2×12px de aire, § NAV-LOGO-TAMANOS-FINOS-1)
  // — 40/52/64.
  return posicion ? 'h-[52px] min-[640px]:h-[64px]' : 'h-[40px]';
}

/**
 * EL ALTO DEL LOGO EN LA CABECERA DEL MENÚ LATERAL (§ NAV-LOGO-TAMANOS-FINOS-1) — el SEGUNDO
 * `<Logo>` de `StoreNav.tsx`, el drawer móvil de pantalla completa (`mobileOpen`, su fila `px-6
 * py-5` — otra geometría, sin un alto de barra que heredar como el `<header>`). Antes de este slice
 * no recibía `altoBarraClase` y caía al `h-7` (28px) fijo de siempre (§ el docstring de esa prop en
 * `Logo.tsx`) — el mismo tamaño ilegible para un sello con ilustración que ya motivó el ajuste del
 * logo del header (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1).
 *
 * A diferencia de `altoLogoNavMovilClase` (arriba), ACÁ el alto NO se deriva restando aire de una
 * barra existente: la fila del drawer no declara un alto fijo que medir (es `items-center` sobre
 * contenido de altura intrínseca, junto a los tres botones de ícono de la cabecera) — es un literal
 * MEDIDO contra el segundo pedido del gate del owner sobre la MISMA demo ("un poco más grande"), a
 * propósito más grande que el logo del header: en la cabecera del menú el sello no compite por
 * espacio con el resto del contenido de la barra, así que puede crecer sin pisar nada.
 * `items-center` en esa fila (StoreNav.tsx) centra el `<img>` sin que esta función agregue un
 * margen propio — mismo mecanismo que `altoLogoNavMovilClase`.
 *
 * SÓLO ese mount, y SÓLO en `logoYNombre` (`Logo.tsx` ya acota `altoBarraClase` a ese modo, § el
 * docstring de la prop): el logo del header (`altoLogoNavMovilClase`, arriba) no cambia, y los
 * otros dos modos (`soloLogo`/`soloNombre`) nunca leen este prop.
 */
export const ALTO_LOGO_MENU_LATERAL_PX = 40;

export function altoLogoMenuLateralClase(): string {
  return 'h-[40px]';
}

/**
 * EN ESCRITORIO (`lg:` ≡ `min-[1024px]:`, logo + nombre lado a lado): el alto del BLOQUE
 * nombre+tagline que el logo acompaña (`BloqueNombreTagline`, `Logo.tsx`) — MEDIDO contra el
 * componente real, no una fórmula de línea-de-texto adivinada (Chromium 1440×900, harness ad-hoc
 * `.scratch/medir-logo-nav.ts`, gitignorado, no parte del producto):
 *
 *   | wordmarkTratado | tagline | alto MEDIDO del bloque | logo (iguala + un poco) |
 *   |---|---|---|---|
 *   | — (cualquiera) | ausente  | 22px | `h-6`  (24px) |
 *   | false          | presente | 35px | `h-9`  (36px) |
 *   | true           | presente | 45px | `h-12` (48px) |
 *
 * SIN tagline el nombre SIEMPRE renderiza a 22px sin importar `wordmarkTratado` —es la rama SIN
 * `subtitle` de `BloqueNombreTagline`, que ignora esa prop por diseño: "Sólo afecta la rama
 * `subtitle`" (§ el docstring de `wordmarkTratado`, `Logo.tsx`), porque el tratamiento apilado sólo
 * tiene sentido junto a una segunda línea—, por eso las dos primeras filas comparten destino.
 *
 * El `line-height` del tagline (`text-[11px]`, sin `leading-none` propio) HEREDA el `leading-none`
 * del `<span>` que lo envuelve (`line-height` es una propiedad CSS heredada), así que renderiza a
 * 11px exactos — no a los ~16.5px que la línea-de-texto AMBIENTE (1.5, Tailwind preflight) habría
 * hecho suponer sin medir. Es la razón de medir contra el componente real y no de calcular a mano.
 */
export function altoLogoNavEscritorioClase(wordmarkTratado: boolean, hayTagline: boolean): string {
  if (!hayTagline) return 'min-[1024px]:h-6';
  return wordmarkTratado ? 'min-[1024px]:h-12' : 'min-[1024px]:h-9';
}

/**
 * EL COLOR DEL TAGLINE EN MODO `'acento'` (§ NAV-LOGO-MOVIL-CON-AIRE-1, ver el docstring de
 * `NavWordmarkContent.taglineColor` en site-content-defaults.ts para el porqué completo — ese
 * docstring sigue describiendo el fallback `--sf-acento-texto` original, DESACTUALIZADO desde
 * `TAGLINE-DORADO-PROFUNDO-1` y otra vez acá). `'atenuado'` (default) no pasa por acá — `Logo.tsx`
 * sigue con su color de SIEMPRE, byte a byte; esta función sólo resuelve el color cuando el dueño
 * elige `'acento'`.
 *
 * `variant==='dark'` (el nav FLOTANDO sobre el hero oscuro, o el pie de página) → `--sf-tostado-5`
 * literal, el dorado medido (6.26:1 contra `tinta` en CORTE — pasa el piso de 11px). SIN CAMBIO
 * desde `NAV-LOGO-MOVIL-CON-AIRE-1`: el gate del owner de `TAGLINE-DORADO-PROFUNDO-1` sólo nombró
 * el nav claro, y este slice (`TAGLINE-DORADO-DERIVADO-1`) corrige SÓLO esa rama.
 *
 * `variant==='light'` (el nav SÓLIDO claro, `bg-[var(--sf-tarjeta)]/95`, § StoreNav.tsx) → ese
 * mismo `tostado-5` da 2.54:1 contra `fondo`/`tarjeta` en CORTE (FALLA el piso de 4.5:1 a 11px).
 *
 * **HISTORIA DE ESTA RAMA, para que no se repita el error:** `NAV-LOGO-MOVIL-CON-AIRE-1` cayó a
 * `--sf-acento-texto` (genérico, pero resolvía a la TINTA verde para CORTE — un matiz ajeno al
 * dorado). `TAGLINE-DORADO-PROFUNDO-1` lo corrigió a `'#a16336'`, un LITERAL escrito a mano —
 * `pisoContraste(tostado-5, fondo, 4.5)` sobre la paleta de CATÁLOGO de CORTE
 * (`{fondo:'#fdfbf7', tinta:'#102407', acento:'#a70004'}`), NO la paleta real de ningún tenant —
 * así que CUALQUIER tenant que pusiera `taglineColor:'acento'` con raíces DISTINTAS de las de
 * CORTE (p.ej. Café Las Chamisas, con su propio `content.tema`) vería el dorado DE CORTE, no el
 * suyo. Ese slice lo dejó nombrado en su propio Open follow-up
 * (`TAGLINE-DORADO-PROFUNDO-DEMO-DESCONOCIDA-1`, DECISIONS.md) — exactamente lo que este slice
 * (`TAGLINE-DORADO-DERIVADO-1`) construye.
 *
 * **EL FIX: `--sf-tagline-acento-claro` (palette-derive.ts), un TOKEN derivado por el motor para
 * CUALQUIER raíz** — ya no un literal de CORTE. El piso PRIMARIO (siempre garantizado) es
 * `pisoContraste(tostado-5, fondo, 4.5)`; DESPUÉS se intenta, oportunista, re-florear contra
 * `tarjeta` también — pero sólo si eso no rompe el piso de `fondo` (§ su docstring en
 * `palette-derive.ts`: para un `fondo` lo bastante oscuro, pasar ambos a la vez es matemáticamente
 * imposible, y la función prefiere `fondo`, el que el spec nombra textual). `cssPaleta`/
 * `varsDeTienda` lo emiten junto al resto de las tintas del `:root` (iteran `Object.entries` del
 * objeto derivado, sin lista propia) — para CORTE converge en el MISMO `#a16336` que el literal
 * retirado (afirmado en `palette-derive.test.ts`); para Café Las Chamisas (u otro tenant), su
 * PROPIA paleta.
 *
 * **EL RESPALDO ES `--sf-tostado-5`, no un segundo literal.** `--sf-tagline-acento-claro` no tiene
 * default en `globals.css` (mismo patrón que `--sf-sobre-tinta`/`--sf-sobre-tarjeta`): un tenant
 * SIN paleta custom (Nayoli/Suave, raíces null → `cssPaleta` devuelve `null`, sin `<style>`
 * inyectado) deja la var sin definir, y el `var(…, var(--sf-tostado-5))` cae al dorado crudo de
 * siempre — nada cambia (ese caso nunca ejercita `taglineColor:'acento'` de todos modos, §
 * `usaColorAcento`: ningún preset lo declara, es DATO por-tenant).
 */
export function colorTaglineAcento(variant: 'light' | 'dark'): string {
  return variant === 'light'
    ? 'text-[var(--sf-tagline-acento-claro,var(--sf-tostado-5))]'
    : 'text-[var(--sf-tostado-5)]';
}

/**
 * ¿Esta instancia del tagline debe pintarse con `colorTaglineAcento`? Sólo si el dueño eligió
 * `'acento'` (§ `NavWordmarkContent.taglineColor`) Y hay tagline que pintar — un `taglineColor`
 * sin `subtitle` no tiene nada sobre qué aplicarse (mismo guard que ya hace `BloqueNombreTagline`
 * para el resto de sus clases, § Logo.tsx).
 */
export function usaColorAcento(taglineColor: ColorTagline, hayTagline: boolean): boolean {
  return taglineColor === 'acento' && hayTagline;
}
