// El SET CERRADO de PERSONALIDADES DE FORMA del storefront (§ eje 4, mitad 1: mecanismo + radios
// var-backed). GEMELO de `lib/config/fuentes`: un cliente elige UNA forma —radios, píldora, grosores
// de borde/divisor, trazo de ícono—; no hay editor libre. La forma vive en `content.tema.forma`
// (tercera clave del tema, junto a las 3 raíces de paleta y `fuentePar`), y de ella salen las vars que
// el `<style>` del layout del storefront inyecta (§ forma-style, gemelo de fuentes-style).
//
// NULL = SUAVE (el default), como null en `fuentePar` = Editorial y null en las raíces = fábrica: sin
// override, las utilidades de radio caen a su valor de HOY. Por eso `suave` NUNCA se guarda: el picker
// manda `null` para Suave (§ resolverForma), y sin `<style>` `--radius-3xl/2xl/xl` quedan en los
// defaults de Tailwind v4 (1.5rem/1rem/0.75rem) → Nayoli byte-idéntico.
//
// LOS NOMBRES esquivan a propósito los del set de fuentes (Editorial/Cálido/Moderno/…): dos ejes con la
// misma etiqueta y distinto default serían una trampa en el picker.
//
// SUAVE VA EN REM con los valores EXACTOS de hoy (radios 1.5/1/0.75rem), no en px: a root 16px son
// idénticos, pero en rem la identidad byte-a-byte es literal y no depende de que nadie cambie el root.
// Recta y Mínima van en las unidades que su diseño pide.
//
// LO QUE ESTA MITAD CONECTA vs LO QUE QUEDA INERTE: sólo `--radius-3xl/2xl/xl` los LEE algo hoy —en
// Tailwind v4 `rounded-2xl` compila a `var(--radius-2xl)`, así que overridearlos mueve el radio de las
// tarjetas del storefront con CERO cambio de JSX—. Los demás tokens (`--sf-radio-lg`, `--sf-pildora`,
// `--sf-borde`, `--sf-divisor`, `--sf-trazo`) se emiten pero quedan INERTES: nadie los lee todavía; los
// cablea la segunda mitad (el swap de píldoras, el escalón `rounded-lg`, bordes/divisores, el trazo de
// ícono y el badge). Se emiten igual para que esa mitad sea puro cableado de superficie.
//
// `radioTile` (§ NUESTRO-CAFE-RADIO-TILE-1, cerrado por PARIDAD-RIEL-TARJETAS-1) es la EXCEPCIÓN al
// párrafo de arriba: nace YA CONECTADO, en el MISMO slice que lo agrega — `.sf-radio-tile`
// (globals.css) lo cablea de una vez, sin pasar por un período INERTE. Ver el docstring del campo en
// la interfaz `Forma`, abajo, para el porqué de separarlo de `radioLg`.
//
// `pildoraReal` (§ BACKTOTOP-REDONDO-Y-ORDEN-1) es la SEGUNDA EXCEPCIÓN, con el mismo motivo que
// `radioTile`: nace YA CONECTADA — `.sf-pildora-real` (globals.css) la cablea en el MISMO slice, para
// `components/storefront/BackToTop.tsx`. Es un ROL DISTINTO de `pildora`, no un cuarto valor del mismo
// campo: `pildora` sigue al radio de BOTÓN/CHROME (`--radius-button` del prototipo, 0 bajo 'recta' —
// "Buttons and interface chrome are SQUARE", `docs/prototipos/cafeone/css/app.css:8`), mientras que
// `pildoraReal` es la píldora GENUINA que el propio prototipo mantiene CONSTANTE, independiente del
// chrome recto (`--radius-pill:999px`, `tokens.css:170`) — la usan su `.to-top` (`css/app.css:344`), la
// barra de scroll, badges y progress bars, todos circulares aunque los botones sean rectos. Por eso
// `pildoraReal` vale `9999px` en LAS TRES formas, y no "continúa la filosofía de cada forma" como
// `radioTile`: una píldora real no es un matiz de personalidad — el propio diseño fuente la declara
// ajena al radio de botón.
//
// `badgeCaja`/`badgeTracking` (§ eje 4, REMATE 1) son los dos últimos: la FORMA del badge (píldora) la
// cableó B2 vía `.sf-pildora`; la TIPOGRAFÍA (versalitas + tracking) no tenía mecanismo hasta acá.
// Suave = `none`/`normal` (byte-idéntico); van SÓLO en `.sf-badge` (globals.css), sólo sobre etiquetas
// de estado (product.badge, "Más Popular") — nunca en un chip/control.
//
// SOMBRAS FUERA en v1, SALVO EL ROL IMAGEN (§ HISTORIA-COLLAGE-COMO-PROTOTIPO-1, el momento en que
// "entra cuando una la necesite" se cumplió): el collage de `brandStory·centrada`
// (`BrandStoryCentrada.tsx`) usaba `rounded-2xl shadow-[0_18px_44px_rgba(16,36,7,0.14)]` — un radio
// HARDCODEADO que resulta ser el MISMO `--radius-2xl` que 'recta' ya pisa a 0 para botones/tarjetas
// (§ el comentario de CORTE en `themes.ts`, «Buttons and interface chrome are SQUARE»), así que bajo
// CORTE el collage rendía con ESQUINAS RECTAS (medido: `border-radius:0px` contra el muestrario
// desplegado, `.capturas/historia-collage-antes-figura/`) — exactamente el defecto reportado por el
// owner («los bordes al no ser rectos sino suavizados»). El prototipo NUNCA comparte ese token: sus
// fotos usan `--radius-image:16px` (`tokens.css:168`), un rol PROPIO, distinto de `--radius-card:0px`
// —la misma separación que ya motivó `radioTile` (§ el docstring de ese campo, arriba). `radioImagen`/
// `sombraImagen` son ese rol: SEPARADOS de `radioTile` (20px en 'recta', el tile de Spotlight/riel) y
// de `radioLg`, porque el prototipo mide DOS valores DISTINTOS para "imagen" (16px) y "tile" (20px) en
// la MISMA hoja de estilos — colapsarlos habría sido inventar una coincidencia que el prototipo no
// declara. `sombraImagen` es el PRIMER token de sombra del eje: la única sombra que hoy existe en el
// storefront (la del collage) queda var-backed en vez de un literal fijo, con el MISMO valor exacto
// del prototipo (`--shadow-image:0 18px 44px rgba(16,36,7,.14)`, `tokens.css:182`) para 'recta', y el
// literal de HOY como fallback de Suave — el resto del eje (botones, tarjetas) sigue sin sombra propia.
//
// PURO / client-safe: sin red, sin `server-only`. Lo consumen `forma-style` (el `<style>` del server),
// el layout del storefront (via forma-style) y el picker del panel (`PaletaSeccion`).
//
// § RADIOS-UN-SOLO-RITMO-1 (2026-10-01) — 'recta' deja de perseguir el valor EXACTO que cada rol medía
// contra el prototipo (0 para botón/chrome, 20px para tile, 16px para imagen) y los UNIFICA a UN SOLO
// radio chico: `RADIO_UNIFICADO_RECTA` (abajo), el mismo 2px que ya aprobó el owner para el ojo/carrito
// del riel (`sf-radio-lg`, § SUSCRIPCION-FOTO-LEGIBLE-Y-ACCIONES-REDONDEADAS-1). Gate del owner: "el
// estilo de la página no sigue un ritmo — hay cards con puntas un poco redondeadas pero hay otras
// totalmente rectas" — las "totalmente rectas" eran `radius3xl/2xl/xl`/`pildora` en 0, las "un poco
// redondeadas" eran `radioLg`/`radioTile`/`radioImagen` en 2/20/16px; las SIETE convergen. `minima` NO
// se tocó —el owner la probó entera y la rechazó por REDONDEAR DE MÁS ("las redondea mucho"), no por
// estar internamente inconsistente; el criterio ganador es el de 'recta'—. `pildoraReal` queda FUERA
// de la unificación a propósito ("el volver-arriba sigue siendo un círculo", decisión anterior,
// § BACKTOTOP-REDONDO-Y-ORDEN-1): una píldora REAL no es un matiz de radio, es una forma ajena al
// chrome recto, y el prototipo mismo la declara constante en las tres formas. `sombraImagen` tampoco
// se toca: la sombra de las fotos de sección se conserva, sólo cambia su esquina. 'recta' es
// COMPARTIDA con PLIEGO (`PLIEGO.forma==='recta'`, abajo en `themes.ts`) — PLIEGO sigue INCOMPLETO hoy
// (`validarPreset` lo rechaza: pide variantes que el REGISTRY no declara, § `PRESETS`), así que esta
// unificación no mueve ningún tenant vivo más allá de CORTE, pero el día que PLIEGO se complete
// heredará el mismo radio — es la MISMA forma, no una copia con otro número.

// El tuple runtime del set cerrado — para el `z.enum` del schema del PUT (una sola fuente con el tipo).
export const CLAVES_FORMAS = ['suave', 'recta', 'minima'] as const;
export type ClaveForma = (typeof CLAVES_FORMAS)[number];

export interface Forma {
  clave: ClaveForma;
  label: string;
  descripcion: string;
  // Los TRES escalones var-backed de Tailwind v4 (`rounded-3xl/2xl/xl` → `var(--radius-*)`). LEÍDOS hoy.
  radius3xl: string;
  radius2xl: string;
  radiusXl: string;
  // Tokens PROPIOS del storefront, INERTES en esta mitad (los cablea la segunda):
  radioLg: string;   // --sf-radio-lg  (el escalón `lg`, p. ej. las fotos)
  // El rol "TILE GRANDE" (§ NUESTRO-CAFE-RADIO-TILE-1, cerrado por PARIDAD-RIEL-TARJETAS-1) —
  // SEPARADO de `radioLg`, no un cuarto valor del mismo campo. `radioLg` viste chips/controles
  // pequeños; este viste imágenes/media GRANDES (el escenario de Spotlight, el tile del riel de
  // Presentaciones) — el prototipo mide `--radius-tile:20px` (tokens.css:169) como un rol PROPIO,
  // distinto de `--radius-button`/`--radius-card` (0px, "recta"), así que compartir campo con
  // `radioLg` (2px en 'recta') dejaba el tile CASI RECTO donde el prototipo lo pide redondeado —
  // el defecto medido en `riel-antes-1440`/`riel-antes-390` (§ DECISIONS.md, PARIDAD-RIEL-
  // TARJETAS-1): la tile del riel salía CUADRADA porque heredaba `--radius-3xl` de 'recta' (0),
  // no un rol de tile independiente. `suave`/`minima` no tienen prototipo que medir —hoy sólo lo
  // consumen componentes exclusivos de CORTE (`forma:'recta'`)—, así que sus valores continúan la
  // FILOSOFÍA de cada forma: suave = el mismo valor que `radius3xl` de hoy (1.5rem, byte-idéntico
  // a lo que el riel ya rendía con `rounded-3xl` bajo Suave); mínima = el mismo valor que su
  // `radius3xl` (10px, "corto y parejo" — sin un salto de escala nuevo).
  radioTile: string; // --sf-radio-tile (el rol tile grande — imágenes/media, separado de radioLg)
  // EL ROL "IMAGEN" (§ HISTORIA-COLLAGE-COMO-PROTOTIPO-1) — ver el docstring de cabecera, arriba, para
  // el porqué de separarlo de `radioTile`/`radioLg`. Único consumidor hoy: el collage de fotos de
  // `brandStory·centrada` (`BrandStoryCentrada.tsx`). `sombraImagen` es el gemelo de sombra —el PRIMER
  // token de sombra del eje (§ SOMBRAS FUERA en v1, arriba): mismo consumidor, mismo motivo.
  radioImagen: string;  // --sf-radio-imagen  (el rol imagen — fotos de collage, distinto de tile/lg)
  sombraImagen: string; // --sf-sombra-imagen (la sombra de esas mismas fotos)
  pildora: string;   // --sf-pildora   (el radio de las píldoras — botón/chip; sigue a --radius-button)
  // El rol PÍLDORA REAL (§ BACKTOTOP-REDONDO-Y-ORDEN-1) — ver el docstring de cabecera, arriba, para el
  // porqué de separarlo de `pildora`. Vale `9999px` en las tres formas: no hay personalidad que haga a
  // una píldora real dejar de ser un círculo.
  pildoraReal: string; // --sf-pildora-real (píldora GENUINA, siempre circular — distinta de `pildora`)
  borde: string;     // --sf-borde     (grosor del borde)
  divisor: string;   // --sf-divisor   (grosor del divisor de banda)
  trazo: string;     // --sf-trazo     (stroke-width del ícono; unitless)
  // NO SE TOCÓ para 'recta' en § CORTE-CUERPO-LETRA-E-ICONOS-1 (2026-09-28): CORTE necesitaba un
  // trazo/tamaño más grueso/grande que 'recta' (1.25) para los DOS íconos del encabezado, medido
  // contra el prototipo — pero 'recta' es COMPARTIDA con PLIEGO, y bumpear este campo habría
  // cambiado el trazo de TODOS los íconos de PLIEGO en silencio. La salida vive FUERA de esta
  // tabla: una clase propia (`.sf-icono-nav-exacto`, `app/globals.css`) de mayor especificidad que
  // `.lucide` sola, aplicada sólo a esos dos íconos y gateada por `navTratamiento.posicion`
  // (`StoreNav.tsx`/`NavSearch.tsx`) — no por `forma`. `trazo`/`FORMAS` quedan intactos, para las
  // TRES formas.
  // Tipografía del BADGE (§ eje 4, remate 1). SÓLO etiquetas —product.badge, "Más Popular"—,
  // nunca un chip/control (§ .sf-badge en globals.css). Suave = caja natural sin tracking
  // (byte-idéntica a hoy); Recta/Mínima = versalitas con distinto tracking.
  badgeCaja: string;      // --sf-badge-caja      (text-transform del badge)
  badgeTracking: string;  // --sf-badge-tracking  (letter-spacing del badge)
}

// NOTA DE LECTURA (§ RADIOS-UN-SOLO-RITMO-1): los docstrings de `radioTile`/`radioImagen`/`pildora`
// arriba explican por qué son CAMPOS separados de `radioLg` (roles distintos, que podían divergir en
// valor) — esa separación sigue siendo cierta y no se tocó. Lo que cambió es el VALOR que 'recta' les
// asigna: los cuatro (más `radius3xl/2xl/xl`) convergen al mismo `RADIO_UNIFICADO_RECTA`, abajo. Los
// campos siguen siendo cuatro porque 'minima' y una 'recta' futura podrían volver a diferenciarlos;
// hoy no lo hacen.

// El radio ÚNICO de 'recta' (§ RADIOS-UN-SOLO-RITMO-1, el docstring de cabecera): el valor aprobado
// del rol `sf-radio-lg` (el ojo/carrito), reusado por los SIETE campos de radio que antes divergían
// (0/2/20/16px). Una constante, no siete literales repetidos, para que "son el MISMO radio" sea
// verificable leyendo el código, no sólo el resultado.
const RADIO_UNIFICADO_RECTA = '2px';

// El registro. `suave` va PRIMERO (es el default) y su muestra en el picker representa "la de hoy".
export const FORMAS: readonly Forma[] = [
  {
    clave: 'suave', label: 'Suave',
    descripcion: 'La de Nayoli. Píldoras, esquinas generosas, hairline crema, trazo lleno.',
    // Los valores EXACTOS de hoy, en REM (byte-idéntico: = los defaults de Tailwind v4). Suave es null y
    // NUNCA se guarda, así que estos valores NO se emiten en un <style>; existen para el picker y el test.
    radius3xl: '1.5rem', radius2xl: '1rem', radiusXl: '0.75rem',
    radioLg: '0.75rem', radioTile: '1.5rem',
    // radioImagen: 1rem = --radius-2xl de HOY (Tailwind v4), el valor que `rounded-2xl` ya resolvía
    // ANTES de este rol propio — byte-idéntico. sombraImagen: el literal exacto que
    // `shadow-[0_18px_44px_rgba(16,36,7,0.14)]` ya escribía — mismo valor, ahora var-backed.
    radioImagen: '1rem', sombraImagen: '0 18px 44px rgba(16,36,7,0.14)',
    pildora: '9999px', pildoraReal: '9999px',
    borde: '1px', divisor: '1px', trazo: '2',
    badgeCaja: 'none', badgeTracking: 'normal',
  },
  {
    clave: 'recta', label: 'Recta',
    descripcion: 'Esquina viva y regla tipográfica.',
    // § RADIOS-UN-SOLO-RITMO-1 — las SIETE claves de abajo (radius3xl/2xl/xl, radioLg, radioTile,
    // radioImagen, pildora) comparten `RADIO_UNIFICADO_RECTA`. Antes: 0/0/0 (botón/chrome, "Buttons
    // and interface chrome are SQUARE", el valor medido del prototipo) + 2px (radioLg, el ojo/carrito)
    // + 20px (radioTile, el tile de Spotlight/riel) + 16px (radioImagen, el collage de fotos) — CUATRO
    // valores medidos por separado, cada uno "correcto" contra su propio rol del prototipo y a la vez
    // la causa del ritmo quebrado que el owner reportó. El gate de esta vez pesa más que la exactitud
    // por rol: un solo radio, en TODO lo que es tarjeta/botón/campo/chip/caja/panel — fotos de sección
    // incluidas (§ el docstring de `radioImagen`, abajo). `pildoraReal` queda AFUERA, a propósito
    // (sigue en `9999px`, ver el docstring de ese campo y el de cabecera): un círculo real no es un
    // matiz de radio.
    radius3xl: RADIO_UNIFICADO_RECTA, radius2xl: RADIO_UNIFICADO_RECTA, radiusXl: RADIO_UNIFICADO_RECTA,
    radioLg: RADIO_UNIFICADO_RECTA, radioTile: RADIO_UNIFICADO_RECTA,
    // radioImagen UNIFICADO (§ RADIOS-UN-SOLO-RITMO-1): antes 16px, medido contra `--radius-image` del
    // prototipo (`tokens.css:168`) — el owner pidió el MISMO radio chico también para las fotos de
    // sección (Historia, Origen, Nosotros), "sin excepciones". `sombraImagen` NO se toca: la sombra se
    // conserva, sólo la esquina cambia.
    radioImagen: RADIO_UNIFICADO_RECTA, sombraImagen: '0 18px 44px rgba(16,36,7,0.14)',
    pildora: RADIO_UNIFICADO_RECTA, pildoraReal: '9999px',
    borde: '1.5px', divisor: '1px', trazo: '1.25',
    badgeCaja: 'uppercase', badgeTracking: '0.12em',
  },
  {
    clave: 'minima', label: 'Mínima',
    descripcion: 'Radio corto y parejo, sin divisores de banda.',
    radius3xl: '10px', radius2xl: '8px', radiusXl: '6px',
    // radioImagen: 10px, MISMA razón que radioTile (arriba de esta misma fila) — "corto y parejo, sin
    // salto de escala nueva": sin prototipo propio, sigue el valor que ya usa el otro rol de media
    // grande de esta personalidad. sombraImagen: sin evidencia de que Mínima deba verse SIN sombra
    // (el divisor apagado es de BANDA, no de profundidad de foto), se mantiene el mismo valor.
    radioLg: '6px', radioTile: '10px',
    radioImagen: '10px', sombraImagen: '0 18px 44px rgba(16,36,7,0.14)',
    pildora: '8px', pildoraReal: '9999px',
    borde: '1px', divisor: '0', trazo: '1.5',
    badgeCaja: 'uppercase', badgeTracking: '0.05em',
  },
] as const;

const POR_CLAVE = new Map(FORMAS.map((f) => [f.clave, f]));

/** El default (Suave): lo que representa `forma === null`. */
export const FORMA_DEFECTO = POR_CLAVE.get('suave')!;

/** Las formas CUSTOM (todo menos el default). Una `forma` guardada sólo puede ser una de éstas. */
const CLAVES_CUSTOM = new Set<string>(['recta', 'minima']);

/**
 * Normaliza la `forma` guardada a una clave CUSTOM válida, o `null` (= Suave, el default).
 * `null`, `'suave'`, o cualquier basura → `null`: Suave nunca se guarda (el default es "sin override"),
 * igual que `fuentePar` en null = Editorial. Defensa del loader SOFT (§ resolverTema).
 */
export function resolverForma(v: unknown): ClaveForma | null {
  return typeof v === 'string' && CLAVES_CUSTOM.has(v) ? (v as ClaveForma) : null;
}

/** La forma resuelta (la CUSTOM guardada, o el default Suave). Nunca null. */
export function formaDeForma(forma: ClaveForma | null): Forma {
  return (forma && POR_CLAVE.get(forma)) || FORMA_DEFECTO;
}

/**
 * Las vars de forma para un `style` INLINE (la vista previa del panel, que no pasa por el `<style>`
 * server de cssForma). Suave/null → `{}`: sin override, las utilidades de radio caen a su valor de hoy
 * (Tailwind v4). Una forma CUSTOM → las 14 vars (las 3 leídas + las 9 de superficie + las 2 de badge,
 * para que preview y `<style>` no puedan divergir; § el test de consistencia). Gemelo de `varsDeFuentePar`.
 */
export function varsDeForma(forma: ClaveForma | null): Record<string, string> {
  const clave = resolverForma(forma);
  if (!clave) return {};
  const f = formaDeForma(clave);
  return {
    '--radius-3xl': f.radius3xl,
    '--radius-2xl': f.radius2xl,
    '--radius-xl': f.radiusXl,
    '--sf-radio-lg': f.radioLg,
    '--sf-radio-tile': f.radioTile,
    '--sf-radio-imagen': f.radioImagen,
    '--sf-sombra-imagen': f.sombraImagen,
    '--sf-pildora': f.pildora,
    '--sf-pildora-real': f.pildoraReal,
    '--sf-borde': f.borde,
    '--sf-divisor': f.divisor,
    '--sf-trazo': f.trazo,
    '--sf-badge-caja': f.badgeCaja,
    '--sf-badge-tracking': f.badgeTracking,
  };
}
