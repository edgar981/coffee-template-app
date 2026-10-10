// DEFAULTS + REGISTRY + resolver del CONTENIDO del storefront. Módulo PURO —sin prisma,
// sin server-only— para que capa 1 lo pruebe y para que el carril/route handlers lo usen.
//
// LOADER SOFT (lo opuesto a SiteSetting): el vacío es un estado LEGÍTIMO del editor, no un
// error. Nada falla ruidoso; un campo vacío cae al default (requerido) o se omite (opcional).
// Sin fila en la base, gobiernan estos defaults — por eso SiteContent no siembra fila en su
// migración.

import { resolverFuentePar, type ClaveFuentePar } from './fuentes';
import { resolverForma, type ClaveForma } from './formas';
import type { EsquemaId, OrigenTexto, OrigenAccion } from './palette-derive';
import { resolverEscalaDisplay, type ClaveEscalaDisplay } from './escala-display';
import { resolverEstilosSeccion, elementosEstiloDeSeccion, ESTILO_ELEMENTO_VACIO, type EstiloElementoResuelto } from './estilo-elemento';
import { resolverSeccionesHome, resolverOrdenCompleto, type InstanciaContent, type SeccionInstanciaTipo, instanciaOscuraCanonica, instanciaEsUniforme } from './secciones-instancias';

// Alias con el vocabulario de esta capa (§ eje 5b, mitad B — el EFECTO en el home). Es EL MISMO
// tipo que `EsquemaId` de `palette-derive.ts` (el MOTOR ya lo declaró): 'crema' | 'superficie' |
// 'oscuro' | 'acento' | 'neutro' (§ CORTE-HISTORIA-COLOR-FOTOS-1). No se redeclara — un segundo
// set cerrado es cómo diverge del que el motor realmente deriva.
export type ClaveEsquema = EsquemaId;

export interface HeroContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  tituloEnfasis: string;
  subtitulo: string;
  ctaPrimarioLabel: string;
  ctaSecundarioLabel: string;
  imagen: string;
  // El TIPO del medio de fondo (§ HERO-VIDEO-COMO-DATO-1): 'imagen' (default, byte-idéntico) o
  // 'video'. Escalar de SECCIÓN CLAMPADO —como `variante`, dos líneas abajo—, resuelto con
  // `resolverVariante` vía `REGISTRY.hero.escalares` (nunca un `campos`, nunca un string libre): el
  // hero es `ocultable:false` —la ÚNICA portada del sitio—, así que un valor corrupto acá gobernaría
  // lo primero que ve el visitante, y el resolver SOFT tiene que devolver SIEMPRE algo renderizable.
  imagenTipo: 'imagen' | 'video';
  // El PÓSTER del video: la imagen que se ve mientras el video buferea / antes de reproducir.
  // OBLIGATORIO cuando `imagenTipo === 'video'` — lo exige el `.refine()` de `heroEditableSchema`
  // (§ site-content-schema.ts), NO el resolver: el loader es SOFT (nunca lanza) y un hero de video
  // sin póster degrada con gracia (`<video>` sin `poster` simplemente no lo muestra, § HeroCurtina/
  // HeroFicha) — pero el WRITE no debe poder CREAR ese estado desde el editor. '' cuando
  // `imagenTipo` es 'imagen' (default, byte-idéntico).
  imagenPoster: string;
  // LA SEGUNDA VERSIÓN, VERTICAL, para teléfono (§ HERO-VIDEO-MOVIL-1). OPCIONAL —a diferencia de
  // `imagen` (requerido): sin ella, el teléfono sigue viendo el mismo video horizontal de siempre,
  // recortado por `object-cover` como hoy — esto es una MEJORA aditiva, no un segundo requisito.
  // Mismo tope de peso, tipos y verificación de códec que `imagen` (§ TiendaSeccionEditor.tsx,
  // `agregarVideoMovilHero` reusa `MAX_VIDEO_HERO_BYTES`/`leerCodecVideo` vía el mismo
  // `useSubidaImagen.elegir`). SÓLO tiene efecto con `imagenTipo === 'video'` — un hero de IMAGEN no
  // tiene "versión de teléfono" que mostrar; `renderMediaHeroMovil` (TiendaSeccionEditor.tsx) oculta
  // el control fuera de ese caso, y `fuentesVideoHero` (lib/config/hero-video.ts) sólo la consulta
  // cuando `esVideo` es `true`. '' = sin video de teléfono, byte-idéntico (Nayoli incluida: nunca
  // declara este campo).
  imagenMovil: string;
  // El PÓSTER del video de teléfono — MISMA regla que `imagenPoster` arriba, pero para
  // `imagenMovil`: OBLIGATORIO cuando `imagenMovil` no está vacío (lo exige el `.refine()` de
  // `heroEditableSchema`, no el resolver SOFT). '' cuando no hay video de teléfono.
  imagenMovilPoster: string;
  // La VARIANTE de composición (§ eje 5, EJE-5-VARIANTES-HERO). 'curtina' (canónica, la de Nayoli) |
  // 'ficha'. Escalar de SECCIÓN —como `visible`—, no un `campos`: no lo toca el loop
  // requerido/opcional del resolver. Gemela de `presentaciones.variante` (§ eje 5e).
  variante: string;
  // TRES AGREGADOS del hero-media del prototipo que HeroMedia no tenía (§ TEMAS-HERO-MEDIA-
  // AGREGADOS-1, `docs/prototipos/cafeone/index.html:122-138` — `.hero-caption`/`.scroll-cue`).
  // Los TRES son OPT-IN con default = el hero-media de HOY (byte-idéntico): un tenant sin preset
  // (Nayoli incluida, que además usa `curtina` no `media`) no ve ni un byte nuevo.
  //
  // `ctasVisibles` (booleano, default `true` = los dos CTA de HOY). El prototipo no lleva botones
  // en el hero; acá se generaliza como un APAGADOR de los dos juntos —el prototipo trata "sin
  // botones" como un bloque, no un botón sí y el otro no— para que un preset que quiera esa lectura
  // minimalista no tenga que apagar cada CTA por separado. `HeroMedia` lo lee desde siempre;
  // `HeroMediaMarquesina` ('sticky') TAMBIÉN desde § EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1 (ver el
  // docstring de `titularVisible`, abajo, para el alcance completo de la nueva zona).
  ctasVisibles: boolean;
  // `fraseAlPie` (string, OPCIONAL — como `eyebrow`/`tituloEnfasis`: default `''` → SE OMITE, no
  // cae a ningún texto de relleno). Es el `.hero-caption` del prototipo («Hay algo profundamente
  // meditativo en preparar un café cultivado a 1.600 msnm.», index.html:134-136) vuelto DATO del
  // tenant — nunca un literal horneado en el componente.
  fraseAlPie: string;
  // `cueDesliza` (booleano, default `false` = SIN cue, el hero-media de HOY). El `.scroll-cue` del
  // prototipo (index.html:137: línea vertical con un segmento que la recorre + la etiqueta
  // "Desliza"). Gemelo de `ctasVisibles` en mecánica (booleano de sección, § `SeccionDef.
  // booleanos` abajo); su animación vive en `HeroMedia.tsx` sobre un `motion.span` con un valor de
  // TRANSFORM (`y`) para que `ReducedMotionProvider` (`lib/animation.ts`, `MotionConfig
  // reducedMotion="user"`, montado en `app/(storefront)/layout.tsx`) la congele bajo
  // `prefers-reduced-motion` SIN que este archivo ni el componente inventen un guard propio.
  cueDesliza: boolean;
  // DOS TOGGLES MÁS, ESPEJO EXACTO de `ctasVisibles` en mecánica (§ CORTE-HERO-TITULAR-OCULTABLE-1):
  // el `.hero-inner` del prototipo (index.html:130-138) no lleva NI eyebrow/titular NI subtítulo —
  // sólo `.hero-caption` (`fraseAlPie`, arriba) y `.scroll-cue` (`cueDesliza`, arriba). `ctasVisibles`
  // apaga los dos CTA como UN bloque; éstos apagan el TITULAR (`titulo`+`tituloEnfasis`, un solo
  // bloque — el énfasis es parte del titular, no un elemento aparte) y el SUBTÍTULO cada uno con su
  // PROPIO apagador: a diferencia de los CTA (que el prototipo trata como un bloque único), titular y
  // subtítulo son dos elementos separados del `.hero-inner` y no hay evidencia de que deban apagarse
  // juntos.
  //
  // `titularVisible` (booleano, default `true` = el titular de HOY, `titulo`+`tituloEnfasis` juntos).
  // `HeroMedia` lo lee desde siempre — curtina y ficha no (mismo alcance que `ctasVisibles`, ver
  // arriba). **`HeroMediaMarquesina` ('sticky') TAMBIÉN lo lee desde § EDITOR-TIENDA-ZONAS-STICKY-
  // TITULAR-1**: la composición "sticky" gana su propia zona de titular/subtítulo/botón, abajo a la
  // izquierda sobre el indicador "Desliza" — los MISMOS tres campos/booleanos de `media`, sin
  // duplicar contenido (la marquesina NO es el titular; eso vive en `MarquesinaContent.texto`,
  // aparte). CORTE —el único preset con `hero:'sticky'`— ya declaraba `heroTitularVisible:false`
  // desde su era 'media' (§ CORTE-HERO-TITULAR-OCULTABLE-1), así que la zona nace APAGADA para todo
  // tenant real sin que este slice toque `themes.ts`.
  titularVisible: boolean;
  // `subtituloVisible` (booleano, default `true` = el `subtitulo` de HOY). `HeroMedia` y, desde
  // § EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1, `HeroMediaMarquesina` ('sticky') lo leen — mismo alcance
  // que `titularVisible`, arriba.
  subtituloVisible: boolean;
  // `alturaLlena` (§ CORTE-HERO-VIEWPORT-LLENO-1, booleano, default `false` = `min-h-[92vh]` de HOY,
  // byte-idéntico). El owner, gateando `?tema=CORTE` contra el prototipo (2026-09-23): «el hero no
  // llena la pantalla: termina antes del borde inferior y asoma debajo la foto velada de la
  // marquesina». `92vh` deja SIEMPRE un resto visible de la banda siguiente, sea cual sea el alto de
  // viewport — no es un caso borde, es la forma del valor. `true` cambia la unidad a `100svh`
  // (small viewport height, ESTÁTICA): llena el viewport completo con la barra de navegación del
  // móvil VISIBLE, sin saltar cuando la barra aparece/desaparece (a diferencia de `100vh`, que en
  // móvil es la altura CON la barra oculta y por tanto recorta el fondo cuando la barra está
  // visible — la causa exacta del "cortado" que el owner reportó) ni cortar (a diferencia de `100dvh`,
  // que SÍ es exacta pero REDIMENSIONA — y por tanto salta — al togglear la barra). SÓLO `HeroMedia`
  // lo lee — curtina y ficha no (mismo alcance que `titularVisible`/`ctasVisibles`, arriba).
  //
  // LOS CINCO CAMPOS DE ARRIBA (`ctasVisibles`, `cueDesliza`, `titularVisible`, `subtituloVisible`,
  // `alturaLlena`) YA TIENEN CONTROL EN EL PANEL (§ PANEL-EDITOR-HERO-TOGGLES-1): el modelo/resolver/
  // defaults de este archivo NO cambiaron —el preset sigue siendo el que los siembra—, sólo ganaron un
  // switch en `HERO.booleanos` (`components/admin/tienda-secciones.ts`) con el mismo valor como punto
  // de partida. Antes, sólo `mergePresetEnContent` los escribía.
  alturaLlena: boolean;
  // `alto` (§ EDITOR-TIENDA-ZONAS-1, docs/editor-tienda/REDISENO.md § 4/§ 8) — el VALOR INTERMEDIO
  // que `alturaLlena` no podía expresar por ser booleano. ESCALAR de sección CLAMPADO (MISMO
  // mecanismo que `veloIntensidad`/`puntoFocal`, `REGISTRY.hero.escalares.alto`), canónica `'justo'`.
  //
  // SIN MIGRACIÓN: `alturaLlena` NO se retira ni se deja de leer — `claseAlturaHero` (abajo) sigue
  // cayendo en ÉL cuando `alto` está en su canónica (ausente, o elegida explícitamente como
  // "Justo" ANTES de que el dueño toque el control nuevo). El panel nuevo escribe SIEMPRE los DOS
  // campos en conjunto (`alto` + `alturaLlena:(alto==='pantalla')`, § tienda-secciones.ts) desde el
  // primer uso del selector de tres vías, así que la ambigüedad "¿'justo' es el default o una
  // elección?" sólo puede sobrevivir en contenido que el panel nuevo TODAVÍA no tocó — exactamente
  // el caso que el fallback existe para cubrir. Ausente/inválido → `'justo'`, byte-idéntico.
  alto: AlturaHero;
  // `veloVisible` (§ CORTE-HERO-VELO-OFF-Y-TICKER-1) — UN SEXTO booleano, mismo mecanismo que los
  // cinco de arriba. SÓLO lo lee `HeroMediaMarquesina.tsx` (la variante `'sticky'`, ver el docstring
  // de `HeroContent.variante`): controla si el overlay `bg-[var(--sf-velo)]` se monta sobre la media
  // de fondo. El owner, sobre el prototipo de CORTE aplicado (2026-09-27): «ese velo verde debemos
  // quitarlo, hace que el video se vea sin calidad» — CORTE lo apagó en ESA ronda. `default: true` =
  // el hero-media de HOY, byte a byte (el velo siempre montado). **RONDA 4 (§ CORTE-HERO-REVELADO-
  // MASCARA-1): CORTE volvió a encenderlo** —el owner, sobre el gate visual de esa ronda, pidió un
  // velo de vuelta, más suave que el de siempre—, así que ya NO es el único preset que lo declara en
  // `false`; ver `veloIntensidad`, abajo, para el eje que sí sigue siendo propio de CORTE.
  veloVisible: boolean;
  // `veloIntensidad` (§ CORTE-HERO-REVELADO-MASCARA-1, TERCER paso agregado por § HERO-VELO-
  // INTERMEDIO-1) — ESCALAR de sección, MISMO mecanismo que `imagenTipo`/`puntoFocal`
  // (`REGISTRY.hero.escalares`, resuelto con `resolverVariante`): 'media' (canónica) es el rango
  // piso/techo de SIEMPRE (`VELO_OPACIDAD_PISO`/1, § `veloOpacidad`, `lib/animation.ts` —
  // byte-idéntico para todo tema que no la declare); 'suave' es la MÁS TENUE en las DOS puntas del
  // recorrido (piso y techo); 'intermedia' cae ENTRE las dos, más cerca de 'suave' — la que CORTE
  // eligió DESDE § HERO-VELO-INTERMEDIO-1 (el owner, sobre 'suave' ya aplicada: «el velo del hero
  // puede ser un poquito más oscuro») y de la que CORTE VOLVIÓ a 'suave' en
  // § CORTE-CUERPO-LETRA-E-ICONOS-1 (el owner, sobre el gate de 'intermedia': «el velo en suave es
  // el que voy a dejar»). El paso 'intermedia' SIGUE en el catálogo y en el `<select>` del panel —
  // sólo CORTE ya no lo declara. SÓLO tiene efecto con `veloVisible:true` — atenuada en el
  // panel cuando el velo está apagado (`gatedFields`, § tienda-secciones.ts, `HERO.booleanos`). El
  // contraste medido de las tres intensidades (bajo AA contra el proxy de fotos claras, aceptado
  // porque el video real de CORTE es oscuro) vive en el docstring de `veloOpacidad`.
  veloIntensidad: VeloIntensidad;
  // `veloNivel` (§ EDITOR-PANEL-DESLIZADORES-1) — el nivel CONTINUO 0-100 del velo, que reemplaza en
  // el panel y en la barra flotante al combo de cuatro pasos sobre `veloVisible`/`veloIntensidad`
  // (arriba): un deslizador, no cuatro botones (pedido del owner, 2026-10-05: «debería haber... un
  // slider»). OPCIONAL de verdad, no un escalar clampado — `resolverVariante` exige un SET CERRADO de
  // strings (`claves: string[]`), y éste es un NÚMERO continuo, así que vive en `campos` como los
  // demás opcionales, no en `escalares`. `null` = el deslizador NUNCA se movió para este tenant: la
  // tienda sigue leyendo `veloVisible`+`veloIntensidad`, BYTE-IDÉNTICA (§ `nivelEfectivoDeVelo`/
  // `rangoVeloDeNivel`, lib/animation.ts — la rama vieja ni se evalúa cuando este campo está ausente,
  // no es una equivalencia numérica que haya que reverificar). Con un número: 0 = sin velo (no se
  // monta); el resto deriva alto=veloNivel/100, bajo=max(0,alto−0.25) — en 55/65/100 esos dos caen
  // en los mismos rangos que 'suave'/'intermedia'/'media' (`VELO_RANGOS`, lib/animation.ts), así que
  // las cuatro posiciones de hoy (Nada·Suave·Medio·Fuerte) siguen representadas sin aproximación.
  veloNivel: number | null;
  // `tickerVelocidad` (§ CORTE-HERO-REVELADO-MASCARA-1) — ESCALAR de sección, MISMO mecanismo: 'media'
  // (canónica) es `VELOCIDAD_TICKER_PX_S` — la velocidad MEDIDA contra el tema real (`lib/animation.
  // ts`), byte-idéntica; 'lenta' es una preferencia EXPLÍCITA del owner sobre esa misma medición («la
  // velocidad… debería ser más baja»), no una segunda medición. Sólo tiene efecto con
  // `hero.variante:'sticky'` (el ticker de `HeroMediaMarquesina.tsx`; ninguna otra variante lo lee).
  tickerVelocidad: TickerVelocidad;
  // EL PUNTO FOCAL (§ HERO-PUNTO-FOCAL-1, recorte mínimo del Backlog #58 — "el ENCUADRE de las
  // imágenes subidas: punto focal, no recorte con caja"): qué parte de la MEDIA de fondo (imagen O
  // video, § `imagenTipo` arriba — el owner reportó el problema sobre un video, y sería incoherente
  // que la foto no lo tuviera) queda a la vista cuando `object-cover` recorta. Sin esto, el navegador
  // usa el centro GEOMÉTRICO (el default de `object-position` ausente), que en un viewport angosto
  // —el caso que el owner reportó, gateando desde un celular— puede no ser el centro de INTERÉS.
  //
  // ESCALAR CLAMPADO —como `imagenTipo`, arriba—, no `campos` ni un string libre: `resolverVariante`
  // vía `REGISTRY.hero.escalares.puntoFocal` (§ site-content-defaults.ts, más abajo) resuelve
  // ausente/vacío/null/basura a la CANÓNICA `'centro'`. El SET CERRADO es la grilla de NUEVE
  // posiciones que `object-position` ya entiende de forma nativa (arriba/abajo/izquierda/derecha +
  // las cuatro esquinas + centro) — un SELECT NATIVO de opciones fijas (§ Controles de formulario,
  // CLAUDE.md: "el select es NATIVO"), no dos campos de porcentaje libre: el dueño elige una posición
  // con nombre, sin pelear con números. Se descartó un selector visual (arrastrar un punto sobre la
  // foto) a propósito — ESO es el Backlog #58 completo (el encuadre de TODAS las imágenes subidas,
  // con una UI de arrastre); acá el alcance es sólo el hero, con el widget que el panel ya tiene.
  //
  // `'centro'` (la canónica) NO EMITE `object-position` en absoluto (§ `objectPositionDePuntoFocal`,
  // abajo): `object-cover` sin `object-position` YA centra por default del navegador (50% 50%), así
  // que agregar `center center` explícito sería un byte que hoy no existe, sin cambiar un solo
  // píxel — Nayoli (que no declara este campo) queda BYTE-IDÉNTICA.
  puntoFocal: PuntoFocal;
  // `estilos` (§ EDITOR-TIENDA-BARRA-FLOTANTE-1, docs/editor-tienda/REDISENO.md § 5/§ 8): el mapa
  // elemento→estilo (letra/tamaño/color/alineación) de los CINCO elementos de texto del hero que la
  // barra flotante puede estilizar — `titulo`, `subtitulo`, `fraseAlPie`, `ctaPrimarioLabel`,
  // `ctaSecundarioLabel` (la lista viene de `elementosEstiloDeSeccion('hero')`,
  // `estilo-elemento.ts` — fuente ÚNICA, no una segunda lista acá). Cada valor es un
  // `EstiloElementoResuelto`: los CUATRO subcampos nacen en `null` ("por defecto") y un `null` NUNCA
  // emite una clave de `style` (§ `estiloInlineDeElemento`) — byte-idéntico sin fila. Resuelto por
  // `resolverEstilosSeccion` vía `REGISTRY.hero.estilos` (gemelo de `escalares`/`booleanos`, §
  // `SeccionDef.estilos` abajo), NO por el loop `campos` requerido/opcional —no es un string—. El
  // COLOR se guarda como ROL (una clave de `ROLES_COLOR_ELEMENTO`, palette-derive.ts) o como hex
  // personalizado (`custom:#rrggbb`): guardar el ROL es lo que hace que el color SIGA A LA PALETA al
  // cambiar de combinación (§ REDISENO.md § 5, "se guarda el rol… cambiar de Corte a Pliego recolorea
  // el titular sin tocarlo").
  estilos: Record<string, EstiloElementoResuelto>;
}

// EL SET CERRADO de posiciones del punto focal del hero (§ el docstring de `HeroContent.puntoFocal`,
// arriba) — la grilla 3×3 que `object-position` entiende nativamente. `'centro'` es la CANÓNICA:
// resuelve ausente/vacío/null/basura (§ `REGISTRY.hero.escalares.puntoFocal`, más abajo).
export const PUNTOS_FOCALES = [
  'centro',
  'arriba', 'abajo', 'izquierda', 'derecha',
  'arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha',
] as const;
export type PuntoFocal = (typeof PUNTOS_FOCALES)[number];

/** El valor CSS de `object-position` para cada punto focal que NO es la canónica. `'centro'` no
 *  entra acá a propósito: no tiene valor CSS propio — no emite nada (§ `objectPositionDePuntoFocal`,
 *  abajo). */
const OBJECT_POSITION_POR_PUNTO_FOCAL: Record<Exclude<PuntoFocal, 'centro'>, string> = {
  arriba: 'center top',
  abajo: 'center bottom',
  izquierda: 'left center',
  derecha: 'right center',
  'arriba-izquierda': 'left top',
  'arriba-derecha': 'right top',
  'abajo-izquierda': 'left bottom',
  'abajo-derecha': 'right bottom',
};

/**
 * El valor CSS `object-position` para un punto focal declarado, o `undefined` si es la CANÓNICA
 * (`'centro'`) o si `puntoFocal` no pertenece al set cerrado (basura — un valor fuera de rango NO
 * valida: se ignora, igual que si no se hubiera declarado nada). `HeroMedia.tsx` aplica `style`
 * SÓLO cuando esto no es `undefined` — así el caso sin declarar (o inválido) no emite ni un byte de
 * `object-position`, sobre el `<video>` Y sobre la `<Image>` por igual (§ el docstring de
 * `HeroContent.puntoFocal`, arriba).
 */
export function objectPositionDePuntoFocal(puntoFocal: string): string | undefined {
  return (OBJECT_POSITION_POR_PUNTO_FOCAL as Record<string, string | undefined>)[puntoFocal];
}

// LOS DOS SETS CERRADOS de RONDA 4 (§ CORTE-HERO-REVELADO-MASCARA-1, ver el docstring de
// `HeroContent.veloIntensidad`/`.tickerVelocidad`, arriba) — MISMA forma que `PUNTOS_FOCALES`: una
// tupla `as const` + el tipo derivado, nunca un tipo re-declarado a mano que pudiera divergir de las
// claves que el resolver realmente acepta. Los NÚMEROS que cada clave representa (el rango de
// opacidad del velo, la velocidad del ticker en px/s) viven en `lib/animation.ts`, no acá — este
// archivo sólo declara el VOCABULARIO de contenido; `lib/animation.ts` lo traduce a magnitud.
//
// `VELO_INTENSIDADES` GANÓ UN TERCER PASO — § HERO-VELO-INTERMEDIO-1 (2026-09-28): el owner, sobre
// el gate visual de 'suave' ya aplicada (tras § HERO-FRASE-COLOR-PLENO-1): «el velo del hero puede
// ser un poquito más oscuro, si eso logra que las letras, no sólo del pie, sino del nav se aprecien
// mejor». 'intermedia' entra ENTRE las dos, MÁS CERCA de 'suave' que de 'media' (el rango exacto, §
// `lib/animation.ts`). EL ORDEN DEL ARRAY VA DE MÁS CLARO A MÁS OSCURO ('suave' → 'intermedia' →
// 'media') — así el `<select>` del panel (`OPCIONES_VELO_INTENSIDAD`, `tienda-secciones.ts`, que
// mapea este array `.map()`) se lee como una escala, no como una lista sin orden aparente. 'media'
// SIGUE SIENDO LA CANÓNICA pese a quedar última en el array — el orden de PRESENTACIÓN (claridad→
// oscuridad) y la CANÓNICA (byte-idéntico sin fila) son dos ejes independientes; ningún consumidor
// de este array asume que la canónica es el primer elemento (`resolverVariante` la recibe aparte,
// § `escalares.veloIntensidad.canonica` más abajo).
export const VELO_INTENSIDADES = ['suave', 'intermedia', 'media'] as const;
export type VeloIntensidad = (typeof VELO_INTENSIDADES)[number];

export const TICKER_VELOCIDADES = ['media', 'lenta'] as const;
export type TickerVelocidad = (typeof TICKER_VELOCIDADES)[number];

// EL ALTO DEL HERO — TRES PASOS (§ EDITOR-TIENDA-ZONAS-1, ver el docstring de `HeroContent.alto`
// arriba). `alturaLlena` sólo podía decir SÍ/NO; "Alto" es el escalón que falta ENTRE los dos
// extremos de hoy. MISMA forma que `VELO_INTENSIDADES`: tupla `as const` + tipo derivado.
export const ALTURAS_HERO = ['justo', 'alto', 'pantalla'] as const;
export type AlturaHero = (typeof ALTURAS_HERO)[number];

/**
 * La clase Tailwind de `min-h-*` para cada paso de `alto`. Las DOS puntas son LITERALES las clases
 * de hoy (`min-h-[92vh]`/`min-h-[100svh]`, § `HeroContent.alturaLlena`); el intermedio usa `96svh`
 * —`svh` (small viewport height, ESTÁTICA), NUNCA `vh`/`dvh`, por la MISMA razón que ya fijó
 * `alturaLlena`: no corta el fondo cuando la barra del navegador móvil está visible (`vh`) ni salta
 * al togglear la barra (`dvh`). El NÚMERO (96, a medio camino entre el 92 de "Justo" y el 100 de
 * "Pantalla completa") es la MAGNITUD con la que "Alto" deja asomar un resto VISIBLE pero chico
 * (4% del viewport) de la banda siguiente — ni el 8% de "Justo" ni el 0% de "Pantalla completa". Es
 * la MISMA unidad en escritorio y en teléfono a propósito: en escritorio no hay barra de navegador
 * que aparezca/desaparezca, así que `svh`/`vh`/`dvh` coinciden ahí — usar `svh` en los dos no cuesta
 * nada en escritorio y evita el defecto conocido de `vh` en móvil, sin necesitar una rama por
 * dispositivo.
 */
export const CLASES_ALTURA_HERO: Record<AlturaHero, string> = {
  justo: 'min-h-[92vh]',
  alto: 'min-h-[96svh]',
  pantalla: 'min-h-[100svh]',
};

/**
 * La clase de alto para una composición del hero, dados `alto` (el escalar de tres pasos) y
 * `alturaLlena` (el booleano legado, § `HeroContent.alturaLlena`). `alto` EXPLÍCITO en un paso
 * no-canónico (`'alto'`/`'pantalla'`) manda siempre. En la canónica (`'justo'` — ausente, basura, o
 * elegida a propósito junto con `alturaLlena:false` desde el panel nuevo) cae al booleano legado,
 * que es exactamente lo que preserva "sin migración": contenido de ANTES de este slice, con
 * `alturaLlena:true` y sin `alto` en absoluto, sigue rindiendo `min-h-[100svh]` sin que nadie lo
 * vuelva a tocar.
 */
export function claseAlturaHero(alto: string, alturaLlena: boolean): string {
  if (alto === 'alto' || alto === 'pantalla') return CLASES_ALTURA_HERO[alto];
  return alturaLlena ? CLASES_ALTURA_HERO.pantalla : CLASES_ALTURA_HERO.justo;
}

// EL COMBO DE CUATRO PASOS SE RETIRÓ — § EDITOR-PANEL-DESLIZADORES-1 (2026-10-08). «Oscurecer para
// leer mejor» era una VISTA combinada de `veloVisible`+`veloIntensidad` (Nada · Suave · Medio ·
// Fuerte, § EDITOR-TIENDA-ZONAS-1) con su propia traducción en las dos direcciones
// (`veloComboDeCampos`/`camposDeVeloCombo`, retiradas de acá; `OPCIONES_VELO_COMBO`/`VeloCombo`,
// también retirados). El owner, revisando el editor: «debería haber... un slider, el panel debería
// sentirse más interactivo» — el combo de cuatro botones se REEMPLAZA por un deslizador continuo
// (`hero.veloNivel`, arriba) en el panel y en la barra flotante; las cuatro posiciones de hoy quedan
// como MARCAS sobre el deslizador, no como botones separados. Ningún llamador real queda: era
// `TiendaSeccionEditor.tsx`/`tienda-secciones.ts` (el `<select>` del panel) y
// `HeroMediaMarquesina.tsx` (el segmentado de la barra flotante), los tres migrados al deslizador en
// el mismo slice.
//
// LAS MARCAS CON PALABRA — las CUATRO posiciones de hoy, en los anclajes 0/55/65/100 (§ el docstring
// de `HeroContent.veloNivel` arriba: en esos tres números no-cero, `rangoVeloDeNivel`, lib/animation.
// ts, coincide con `VELO_RANGOS.suave`/`.intermedia`/`.media`). Vive ACÁ —puro, sin framer-motion— y
// no en `lib/animation.ts` (que SÍ aloja la aritmética de opacidad, consumida sólo en el render del
// storefront) porque el PANEL (`TiendaSeccionEditor.tsx`) también necesita estas palabras para
// etiquetar el deslizador, y ese archivo es 'use client' con media docena de hooks de framer-motion
// — importarlo desde el panel sólo por dos constantes arrastraría ese peso al bundle del dueño
// editando (§ CLAUDE.md, "el peso es un costo real"). Tampoco vive en `components/admin/
// tienda-secciones.ts` (donde vivían las etiquetas del combo retirado): la barra flotante de
// `HeroMediaMarquesina.tsx` —el STOREFRONT PÚBLICO— también la necesita, y ese árbol nunca importa
// de `components/admin/` (verificado: cero imports de ese árbol hoy).
export const MARCAS_VELO: { valor: number; etiqueta: string }[] = [
  { valor: 0, etiqueta: 'Nada' },
  { valor: 55, etiqueta: 'Suave' },
  { valor: 65, etiqueta: 'Medio' },
  { valor: 100, etiqueta: 'Fuerte' },
];

/**
 * El NIVEL 0-100 EFECTIVO del velo del hero·sticky: `veloNivel` si es un número válido (el
 * deslizador YA se movió alguna vez), o DERIVADO de los dos campos de siempre
 * (`veloVisible`+`veloIntensidad`) si no — para que el deslizador nazca en la posición que YA
 * representa el tema, nunca en 0 por default. Mismos anclajes que `MARCAS_VELO`: sin velo → 0;
 * 'suave' → 55; 'intermedia' → 65; 'media' (la canónica) → 100.
 */
export function nivelEfectivoDeVelo(veloVisible: boolean, veloIntensidad: string, veloNivel: unknown): number {
  if (typeof veloNivel === 'number' && Number.isFinite(veloNivel)) {
    return Math.max(0, Math.min(100, veloNivel));
  }
  if (!veloVisible) return 0;
  if (veloIntensidad === 'suave') return 55;
  if (veloIntensidad === 'intermedia') return 65;
  return 100;
}

// EL SET CERRADO de transiciones de salida de la banda MARQUESINA (§ EDITOR-TIENDA-MARQUESINA-
// TRANSICIONES-1), ver el docstring de `MarquesinaContent.transicion` más abajo para el porqué de
// cada nombre. MISMA FORMA que `PUNTOS_FOCALES`/`VELO_INTENSIDADES`/`TICKER_VELOCIDADES` arriba: una
// tupla `as const` + el tipo derivado — este archivo sólo declara el VOCABULARIO de contenido;
// `lib/animation.ts` lo traduce a magnitud (distancias, escala, desenfoque, grados).
//
// EL ORDEN ES EL DEL PEDIDO DEL OWNER (1 a 5, § el spec), que además es el orden de presentación en
// el `<select>` del panel (`OPCIONES_TRANSICION_MARQUESINA`, tienda-secciones.ts, que mapea este
// array `.map()`) — 'subir' primero porque es la canónica Y la entrada de hoy, no una posición
// arbitraria. `resolverVariante` (§ `escalares.transicion` más abajo) no asume que la canónica sea
// el primer elemento, pero acá sí lo es.
export const TRANSICIONES_MARQUESINA = ['subir', 'deslizar', 'acercar', 'enfocar', 'girar'] as const;
export type TransicionMarquesina = (typeof TRANSICIONES_MARQUESINA)[number];

// LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, medido: MARQUESINA-BANDA-CENSO-1) — tres capas: foto
// de fondo velada con overlay oscuro, un LOOP de texto a gran escala que se desplaza con el scroll
// de la sección, y una tarjeta de producto flotante que escala/rota con el mismo progreso. Es la
// SEGUNDA sección del home en el prototipo (`docs/prototipos/cafeone/index.html:141-157`, entre
// `.hero` y `.spotlight`), y aparece UNA sola vez.
//
// ES BANDA PROPIA, NO UNA VARIANTE — a diferencia de `spotlight` (variante de `featured`), la
// marquesina COEXISTE con el hero y con `featured`/`spotlight`: son tres secciones distintas del
// prototipo, así que necesita su propio slot en `BANDA_IDS`, como `origen` (§ ORIGEN-BANDA-1).
//
// NACE OFF (`visible:false`, ver `DEFAULTS.marquesina` abajo), MISMA razón mecánica que `origen`:
// `resolverOrden` completa el orden de TODO tenant con TODA banda de `BANDA_IDS`, sin condición —
// estar en la lista no alcanza para mostrarse. Sin el `false`, Nayoli (o cualquier tenant sin fila
// propia) vería la banda aparecer sola, sin que nadie la haya pedido.
//
// `texto` es la FRASE del loop — el `.marquee-track` del prototipo repite el mismo texto dos veces
// para el efecto de cinta continua («Café fresco de San Adolfo — Huila — Colombia —»); acá es UN
// campo de dato del tenant (REQUERIDO, con default GENÉRICO — nunca la frase del prototipo, misma
// razón que `origen.titulo`/`.lede`: `mergePresetEnContent` jamás escribe texto de sección, así que
// el ÚNICO texto que CORTE podría mostrar es este default, y una frase de origen geográfico
// («San Adolfo, Huila») sería una afirmación FALSA sobre el negocio de quien encienda la banda —la
// misma familia que el rating fabricado que se borró, § El RATING fabricado se BORRÓ, CLAUDE.md).
//
// `imagen` es la foto de fondo (REQUERIDA, reusa un asset estático existente — la banda nace OFF,
// sin urgencia de una foto propia, mismo criterio que `origen.imagen1/2`).
//
// `productoSlug` es el PIN de la tarjeta flotante — el MISMO mecanismo que `SpotlightContent.
// productoSlug` (§ su docstring, arriba en este archivo, para el porqué completo: puntero, nunca
// copia de nombre/precio/imagen). OPCIONAL: sin pin, la tarjeta simplemente no se muestra (hide-on-
// empty de UN elemento, no de la sección — el texto del loop no depende del producto).
//
// LOS SEIS CAMPOS DE ABAJO SON NUEVOS, § EDITOR-TIENDA-MARQUESINA-SECCION-1 — la sección pasa de
// "dibuja lo que el hero·sticky ya muestra, apagada" a SECCIÓN REUTILIZABLE con su PROPIA frase y su
// PROPIA lista de productos, con el mismo motor de revelado que el hero (`MarquesinaMotor.tsx`,
// generalizado a varios productos en vez de uno).
//
// `texto`/`productoSlug`/`imagen` NO SE TOCAN — siguen siendo EXCLUSIVAMENTE lo que el hero·sticky
// lee (§ `HeroMediaMarquesina.tsx`, `productoMarquesina` abajo). `imagen` en particular YA ERA, desde
// antes de este slice, el fondo de la banda SUELTA (nunca del hero: el hero lee `hero.imagen`, no
// `marquesina.imagen` — medido por grep antes de decidir esto) — así que NO es un campo que "se
// mueve": sigue siendo el fondo de la banda suelta, exactamente el rol que ya tenía. Se evaluó
// agregar un campo de fondo PROPIO nuevo y se descartó: habría dejado `imagen` sin un solo
// consumidor real (un campo REQUERIDO huérfano es la misma mina que el ex-`Product.agotado`, § CLAUDE.md)
// por satisfacer la letra de "fondo propio" en vez de su espíritu (que la banda tenga de dónde sacar
// su fondo, cosa que YA tenía).
//
// `fraseBanda` es la frase PROPIA de la sección suelta — REQUERIDA con default genérico, MISMA razón
// que `texto` (nunca una frase fabricada sobre el negocio del tenant). Independiente de `texto`: el
// hero y la banda pueden decir cosas distintas si el dueño así lo quiere.
//
// `imagenTipo` ('imagen'|'video') es un ESCALAR clampado (mismo mecanismo que `hero.escalares.
// imagenTipo`, § su docstring arriba) — permite que el fondo de la banda sea un video, no sólo una
// foto, sin tocar el campo `imagen` (la URL sirve para los dos casos; el componente decide el tag
// según este escalar).
//
// `producto1`..`producto6` son la lista de productos de la banda — SEIS CAMPOS PLANOS, no un
// repeater: mismo criterio que "Presentaciones 2-4" (§ CLAUDE.md, "La BIFURCACIÓN de cardinalidad")
// — un repeater con tipo de ítem `'producto'` no existe (`RepeaterEditor.tsx`/`CampoItem.tipo` no lo
// declaran, y ese componente no está en `touches:` de este slice), mientras que el picker de
// producto por campo plano (`CampoTexto.producto:true`) YA EXISTE y ya lo usa `productoSlug`. Todos
// OPCIONALES, en orden: el primero vacío no "corta" la lista — cada slot se resuelve de forma
// independiente (como `presentaciones.categoria1..4`), y el componente filtra los vacíos al armar el
// orden final. Lista vacía (los seis sin pin) → el componente cae al catálogo, en su orden, hasta el
// mismo tope (§ `productosBandaMarquesina`, abajo).
//
// `transicion` (§ EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1) — EL SÉPTIMO campo nuevo, ESCALAR
// clampado (mismo mecanismo que `imagenTipo`, dos líneas arriba): CINCO efectos de salida para los
// productos de la banda (`TRANSICIONES_MARQUESINA`, arriba), elegibles desde el panel con nombres en
// palabras. Pedido del owner, literal: «se pueden agregar 4-5 transiciones diferentes en la sección
// y así si el cliente quiere puede elegir otro». `'subir'` es la CANÓNICA — la entrada de HOY
// (`transformEntradaSalidaItem`, `lib/animation.ts`), byte-idéntica sin fila: Nayoli no cambia. Las
// otras cuatro (`'deslizar'`, `'acercar'`, `'enfocar'`, `'girar'`) son NUEVAS; sus magnitudes
// (distancias, escala, desenfoque, grados) viven como constantes nombradas en `lib/animation.ts`,
// nunca sueltas en el componente — mismo criterio que `VELOCIDAD_TICKER_PX_S`/`OPACIDAD_REVELADO_
// TECHO` ya siguen para los otros efectos de esta misma banda.
export interface MarquesinaContent {
  visible: boolean;
  texto: string;
  imagen: string;
  productoSlug: string;
  fraseBanda: string;
  imagenTipo: 'imagen' | 'video';
  producto1: string;
  producto2: string;
  producto3: string;
  producto4: string;
  producto5: string;
  producto6: string;
  transicion: TransicionMarquesina;
  // `estilos` (§ EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1) — gemelo de `HeroContent.estilos`
  // (§ su docstring arriba), con UN elemento: `texto`, la frase del loop del hero·sticky
  // (`elementosEstiloDeSeccion('marquesina')`, estilo-elemento.ts — fuente ÚNICA, no una segunda
  // lista acá). Nace `ESTILO_ELEMENTO_VACIO` = sin override = byte-idéntico (§ `MarquesinaFraseMotor`,
  // MarquesinaMotor.tsx).
  estilos: Record<string, EstiloElementoResuelto>;
}

// LA BANDA DE INSIGNIAS DE CONFIANZA (§ CORTE-TRUSTBADGES-OCULTABLE-1) — ya era MIEMBRO de
// `BANDA_IDS` desde antes de este slice (ocupa su posición 3ª, tras `marquesina`), pero como banda
// ESTRUCTURAL sin sección propia (§ el comentario histórico de `BANDA_IDS`, hoy corregido): el
// componente (`TrustBadges.tsx`) renderizaba SIEMPRE, sin gate, y sus cuatro insignias vivían como
// un array `BADGES` fijo en el componente. Este slice le da UN campo, `visible` — GANA sección
// propia en `SiteContentData`/REGISTRY recién ahora—, con el MISMO mecanismo que `origen`/
// `marquesina`: el componente lee `content.trustBadges.visible` con `useSiteContent()` y
// `seccionEsVisible(REGISTRY.trustBadges, trustBadges)` decide si devuelve `null`.
//
// SE APAGA, NO SE BORRA: apagar la banda no toca el array `BADGES` del componente — sigue siendo
// ESTRUCTURA de código, no dato editable; esta sección es sólo el interruptor. Ampliar las cuatro
// insignias a DATO (texto/ícono editables) es una decisión aparte, no la de este slice.
//
// DEFAULT `true` = HOY, byte a byte: la banda se monta siempre hoy (`app/(storefront)/page.tsx`,
// sin condición), así que `visible:true` sin fila es lo que deja a Nayoli (y cualquier tenant sin
// fila propia) exactamente como está.
//
// OJO, LANDMINE MEDIDO Y NO CERRADO POR ESTE SLICE (fuera de `touches:`): `components/admin/
// PaletaSeccion.tsx` (`FragmentoTienda`) monta `<TrustBadges />` DIRECTO, documentado como
// "TrustBadges estático", SIN `SiteContentProvider` — a diferencia de `ProductCard`, a quien esa
// misma pieza SÍ le monta un `CartProvider` local porque `useCartStore()` también haría throw sin
// su provider (§ CLAUDE.md, "Montar un componente en OTRO árbol de providers no lo atrapa ni tsc ni
// el build"). Con `useSiteContent()` agregado acá, esa vista previa de paleta hará throw en vez de
// mostrar la franja. El fix simétrico (montar un `SiteContentProvider` LOCAL ahí, como ya se hace
// con `CartProvider`) toca un archivo fuera de `touches:` de este slice y queda como follow-up
// (§ DECISIONS.md, CORTE-TRUSTBADGES-OCULTABLE-1).
export interface TrustBadgesContent {
  visible: boolean;
}

// BrandStory ("Nuestra Historia"): eyebrow + h2 + dos párrafos + un collage 2×2 de cuatro
// imágenes FIJAS (mismo tamaño, el offset lo da la POSICIÓN, no el contenido). El h2 es UN
// campo —el salto de línea es estético, no énfasis— así que NO lleva el `tituloEnfasis` del
// hero. `eyebrow` y `parrafo2` son opcionales (se omiten vacíos); las cuatro imágenes son
// requeridas (el collage 2×2 es rígido: menos de cuatro deja hueco, § doctrina).
export interface BrandStoryContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  parrafo1: string;
  parrafo2: string;
  imagen1: string;
  imagen2: string;
  imagen3: string;
  imagen4: string;
  // El CTA de cierre (§ MUESTRARIO-SECCION-CTA-1, MEDIDO contra `.historia-copy` del prototipo,
  // `docs/prototipos/cafeone/index.html:270`, "Nuestra historia" → `#origen`). AMBOS opcionales, mismo
  // patrón/set cerrado que `presentaciones.ctaLabel`/`.ctaDestino` (§ ahí): vacío = sin botón, byte-
  // idéntico.
  ctaLabel: string;
  ctaDestino: string;
  // La VARIANTE de composición (§ eje 5e, TEMAS-P2-BRANDSTORY-1). 'columnas' es la canónica; 'centrada'
  // (§ CORTE-BRANDSTORY-COLLAGE-1) es la segunda clave — eyebrow+título centrados, el mismo collage a
  // lo ancho, el párrafo debajo (§ REGISTRY.brandStory.variantes). Escalar de SECCIÓN —como
  // `visible`—, no un `campos`: no lo toca el loop requerido/opcional del resolver. Gemela de
  // `hero.variante`/`presentaciones.variante`.
  variante: string;
}

// LA BANDA ORIGEN (§ ORIGEN-BANDA-1, medido: ORIGEN-BANDA-CENSO-1) — grid de 2 fotos + copy
// (antetítulo/título/lede) + una LISTA de 4 pares dato EDITORIALES A NIVEL FINCA (Altitud/Variedad/
// Proceso/Cosecha en el prototipo — NUNCA leídos de `Product`; es texto del dueño sobre el origen del
// negocio, no una ficha de producto) + 3 CONTADORES ANIMADOS (numero+etiqueta, § el CONTADOR en
// `lib/animation.ts`).
//
// A DIFERENCIA DE `spotlight` (que se quedó FUERA de `BANDA_IDS` porque es una VARIANTE de
// `featured`, no una banda propia, § el docstring de `SpotlightContent`), `origen` ES miembro de
// `BANDA_IDS`: coexiste con `brandStory` (la Historia) en vez de reemplazarla —son dos secciones
// distintas del prototipo, `#origen` y `#nuestra-historia`—, así que necesita su PROPIA posición en
// la secuencia del home, no un slot de variante prestado.
//
// NACE OFF (`visible:false`, ver DEFAULTS.origen abajo) por la MISMA razón MECÁNICA que hizo nacer a
// spotlight apagado mientras estuvo fuera de `BANDA_IDS`: `resolverOrden` completa el orden de TODO
// tenant con TODA banda de `BANDA_IDS`, sin condición — estar en la lista no alcanza para mostrarse,
// sólo decide DÓNDE renderiza SI se muestra. `visible:false` es lo único que impide que la sola
// presencia en `orden` encienda la banda para Nayoli (o cualquier tenant) sin que nadie la haya
// pedido. CORTE es hoy el ÚNICO preset que la enciende, vía `PresetTema.bandaOrigenVisible` (§
// `mergePresetEnContent`, themes.ts) — NUNCA vía membresía en `orden`: ese campo no puede ser la
// señal, porque `ORDEN_DEFAULT = [...BANDA_IDS]` alimenta también a ARRANQUE/VITRINA/PATIO (los tres
// usan el spread), así que "estar en el orden resuelto" es universal, no exclusivo de CORTE.
//
// LOS 4 PARES DATO Y LOS 3 STATS SON CARDINALIDAD FIJA (mismo patrón que `suscripcionPasos`: slot +
// subcampos, campos planos — no un repeater, por la misma razón que Presentaciones: un repeater no
// puede dar defaults byte-idénticos, § La BIFURCACIÓN de cardinalidad, CLAUDE.md). PERO el LABEL y
// el VALOR de cada par NO comparten obligatoriedad, y es DELIBERADO:
//
//   · `dato1..4Label` son REQUERIDOS — son nombres de CATEGORÍA genéricos ("Origen", "Selección"…),
//     no una afirmación verificable, así que un default siempre puede tener uno razonable.
//   · `dato1..4Valor` y los `statNumeroN`/`statEtiquetaN` son OPCIONALES, vacíos por defecto — cada
//     uno es una AFIRMACIÓN FACTUAL sobre ESTE negocio (una altitud, un conteo, un número de años),
//     y `mergePresetEnContent` (themes.ts) JAMÁS escribe texto de sección — sólo enciende `visible`
//     (igual que con `spotlight.visible`) —, así que el ÚNICO valor que CORTE podría mostrar es el
//     DEFAULT. Inventar un número («1.600 msnm», «52 años») en un DEFAULT COMPARTIDO por TODO
//     tenant sin fila propia sería fabricar un dato — la misma familia que el rating fabricado que
//     se borró (§ El RATING fabricado se BORRÓ, CLAUDE.md) y que el precio vacío de
//     `SuscripcionPlanesContent` ya evita («el precio es TEXTO OPCIONAL... un precio inventado sería
//     dato falso en la ruta del dinero» — acá el dato no es dinero, pero es la MISMA clase de
//     afirmación no verificable). Vacío se OMITE (§ `Origen.tsx`: una fila de dato sin valor, o un
//     contador sin número, no se renderiza) — nunca un placeholder inventado.
//
// Consecuencia medida y aceptada: bajo `?tema=CORTE`, sin panel todavía para cargar datos reales
// (§3 del spec de este slice — el panel queda de follow-up), la lista de datos y los contadores
// rinden VACÍOS (sólo el copy de cabecera se ve) — el MISMO comportamiento que ya tiene
// `featured·spotlight` bajo CORTE hoy (sin catálogo real, Spotlight rinde vacío, § spotlight-
// cableado.test.ts): una banda ENCENDIDA por el preset pero sin dato real que mostrar aún.
export interface OrigenContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  lede: string;
  imagen1: string;
  imagen2: string;
  dato1Label: string; dato1Valor: string;
  dato2Label: string; dato2Valor: string;
  dato3Label: string; dato3Valor: string;
  dato4Label: string; dato4Valor: string;
  // `statNumeroN` es TEXTO, no number — guarda el valor final tal como se muestra («1600»), y el
  // componente (`OrigenContador`, dentro de `Origen.tsx`) lo parsea para animar el count-up. Mismo
  // criterio que `precio` de `SuscripcionPlanesContent`: el formato es del cliente, no del sistema.
  // Vacío → el contador se OMITE (junto a su etiqueta), como cualquier otro par opcional de arriba.
  statNumero1: string; statEtiqueta1: string;
  statNumero2: string; statEtiqueta2: string;
  statNumero3: string; statEtiqueta3: string;
}

// Presentaciones ("¿Cómo tomas tu café?"): de 2 a 4 tarjetas de presentación. Cardinalidad VARIABLE
// pero con campos PLANOS, NO un repeater —un repeater no puede dar defaults byte-idénticos
// (`resolverItems` → `[]` sin fila, invariante #44)—. La variable se expresa como **2 slots REQUERIDOS
// (siempre, con los defaults de Nayoli) + 2 OPCIONALES (defaults vacíos)**: mínimo 2, máximo 4. Cada
// tarjeta: label + copy + imagen + `categoria` (el DESTINO, § el destino de Presentaciones es DATO).
// El href lo construye `hrefCategoria(categoria)`. Qué tarjeta SE MUESTRA lo decide el componente
// (`tarjetasDePresentaciones`, título O imagen), NO el resolver — así 2→4 no toca ni el resolver ni #44.
//
// EL CTA DE CABECERA (§ MUESTRARIO-SECCION-CTA-1, MEDIDO contra `.pres-head` del prototipo,
// `docs/prototipos/cafeone/index.html:233`, "Comprar"): `ctaLabel`/`ctaDestino`, AMBOS opcionales,
// mismo patrón que `menu.ctaLabel`/`.ctaDestino` — `ctaDestino` es del SET CERRADO `MENU_CTA_DESTINOS`
// (§ `resolverCtaSeccion`, abajo, la generalización de `menuCtaHref`); vacío = sin botón, byte-
// idéntico. Distinto de `categoriaN` (el destino de CADA TARJETA): éste es el CTA de la SECCIÓN
// entera, junto al título, no de una tarjeta puntual.
export interface PresentacionesContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  ctaLabel: string;
  ctaDestino: string;
  // Tarjetas 1-2 REQUERIDAS (siempre renderizan → mínimo 2, con los defaults de Nayoli).
  label1: string;
  copy1: string;
  imagen1: string;
  categoria1: string;
  label2: string;
  copy2: string;
  imagen2: string;
  categoria2: string;
  // Tarjetas 3-4 OPCIONALES (defaults VACÍOS): la tarjeta se muestra si tiene título O imagen
  // (§ tarjetasDePresentaciones). Es lo que sube la cardinalidad de FIJA-2 a VARIABLE 2-4 sin tocar
  // el resolver ni #44 — son campos opcionales más, y el filtrado por-tarjeta vive en el componente.
  label3: string;
  copy3: string;
  imagen3: string;
  categoria3: string;
  label4: string;
  copy4: string;
  imagen4: string;
  categoria4: string;
  // La VARIANTE de composición (§ eje 5e). 'mosaico' (canónica, la de Nayoli) | 'indice'. Escalar de
  // SECCIÓN —como `visible`—, no un `campos`: no lo toca el loop requerido/opcional del resolver.
  variante: string;
}

// LA BANDA SPOTLIGHT (§ SPOTLIGHT-BANDA-1) — un solo producto PINEADO, del muestrario del
// prototipo («Un solo origen, cuidado de principio a fin.»). Reemplaza a la lista plana de
// productos («Selección del mes», `FeaturedProducts`/`featured`) en los presets que la elijan.
//
// `productoSlug` es EL PIN — un PUNTERO al `Product` vivo (§ SPOTLIGHT-CAPACIDAD-CENSO-1, medido:
// "la decisión es PUNTERO no copia"), NUNCA una copia de su nombre/descripción/notas/precio/
// imagen: copiarlos mentiría en silencio el día que el producto cambie, algo que la doctrina de
// este repo ya prohibió dos veces (el rating fabricado, la cuenta bancaria horneada). Todo lo
// demás que la banda muestra se LEE del producto pineado en cada render —`productoSpotlight`,
// abajo, es quien resuelve el puntero contra el catálogo—. `otroTamanoSlug` es un SEGUNDO puntero,
// opcional: el eje "tamaño" del prototipo (que ahí cambia precio/imagen EN EL LUGAR) NO se modela
// como variante agrupada —eso es Backlog #62, un proyecto transversal que una banda del
// muestrario no dispara—, así que se resuelve como un ENLACE a la OTRA talla (otro producto, otro
// slug), igual que el destino de Presentaciones (`categoria1/2`, § el destino es DATO).
//
// SECCIÓN OCULTABLE que NACE OFF (`visible:false`), a diferencia de TODAS las demás secciones
// ocultables del REGISTRY (que nacen `true`) — es la ÚNICA excepción, y tiene un motivo mecánico,
// no estético: `resolverOrden` (abajo) SIEMPRE completa el `orden` resuelto de CUALQUIER tenant
// con TODA banda que exista en `BANDA_IDS`, sin condición y sin que un tenant pueda pedir que
// falte una — es la garantía que hace que "ninguna banda se caiga del home por un orden
// corrupto" (§ su docstring). El día que `spotlight` se sume a `BANDA_IDS` (§ el bloqueo medido en
// DECISIONS.md, SPOTLIGHT-BANDA-1 — hoy TODAVÍA NO es miembro, precisamente por esto), esa misma
// garantía haría que la banda apareciera en el orden resuelto de TODO tenant, Nayoli incluida, sin
// que nadie la haya pedido — nacer OFF es lo que hace que su sola presencia en el orden no alcance
// para mostrarla. Es el mismo mecanismo que ya usan los repeaters vacíos (Testimonios, la
// Galería) para no encender solos en ningún tenant, expresado como un booleano en vez de un array
// vacío porque acá el dato no es una lista.
// `notaPrecio` (§ NUESTRO-CAFE-COMO-MUESTRARIO-1) — la nota junto al precio del `.price-row`
// (`docs/prototipos/cafeone/index.html:212`, "COP · impuestos incluidos"; `css/app.css:503`). Es
// COPY, no un cálculo: el sistema no valida moneda ni impuestos, igual que `precio` de
// `SuscripcionPlanesContent` — el dueño escribe la frase que aplique a su negocio. OPCIONAL, vacío
// = no se muestra (§ la frontera fina de defaults-como-fallback, CLAUDE.md): un campo opcional
// vacío se OMITE, nunca cae a un default de copy.
//
// `presentacionSlug` (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) — un TERCER puntero, GEMELO de
// `otroTamanoSlug` en forma y en regla ("sin match, sin fallback" — § `productoOtraTalla`, el
// mismo resolver que ya usa `otroTamanoSlug`, reusado acá tal cual): la OTRA presentación del
// mismo café (p. ej. "Molido" cuando el producto pineado es "En grano"), para el tenant que modela
// cada combinación presentación×tamaño como un PRODUCTO DISTINTO (medido contra el catálogo real:
// `prisma/seed-products.ts` tiene CUATRO productos — grano/molido × 250g/500g —, no un producto
// con `moliendasOpciones` cubriendo las dos presentaciones). Vacío = la Presentación de la banda se
// arma SÓLO con `producto.moliendasOpciones` (el mecanismo de SIEMPRE, sin romper el caso de un
// producto con varias moliendas propias — § Spotlight.tsx). `otroTamanoSlug` NO se renombra ni se
// migra de verdad: sigue siendo el MISMO campo, mismo nombre, mismo significado de puntero — sólo
// cambia su UI (picker, no texto libre) y su efecto en la tienda (switch COMPLETO del producto
// activo, no una vista de sólo-vistazo), ninguno de los dos exige tocar el dato ya guardado.
//
// § DESTACADO-PRESENTACION-POR-TAMANO-1 — LOS CUATRO PUNTEROS SON UN GRUPO, NO TRES EJES DISTINTOS.
// El gate del owner (2026-10-01, contra `.scratch/refs/onix-destacado-pickers-mal.webp`) midió que
// el modelo de arriba —`presentacionSlug` atado a "mismo tamaño", `otroTamanoSlug` atado a "misma
// presentación"— no alcanza para DOS selectores INDEPENDIENTES: elegir Presentación y luego Tamaño
// (o al revés) tiene que converger al MISMO producto que si se eligieran en el otro orden, y con
// sólo dos punteros de eje fijo eso no es posible (el muestrario, `.scratch/refs/muestrario-
// destacado-pickers.webp`, tiene CUATRO productos — grano/molido × 250g/500g — los cuatro
// alcanzables desde cualquiera de los dos selectores).
//
// La salida: `productoSlug`/`presentacionSlug`/`otroTamanoSlug`/`cuartoSlug` (el CUARTO, nuevo en
// este slice) son simplemente "hasta cuatro productos del grupo" — ya NO "el principal + la otra
// presentación + el otro tamaño". Cada uno DERIVA su propia (presentación, tamaño) de sus datos
// (`ejesSpotlight`, `lib/config/spotlight.ts`), y el storefront arma la matriz con lo que el grupo
// aporte (`grupoSpotlight`/`productoDeCombinacion`, mismo archivo). **LOS NOMBRES DE LOS TRES
// PUNTEROS VIEJOS NO CAMBIARON** —es la migración sin pérdida que pide el spec de este slice—: una
// fila guardada bajo la semántica vieja (p. ej. `presentacionSlug` = "la otra presentación, mismo
// tamaño") sigue siendo una matriz VÁLIDA bajo la nueva, porque sus ejes se derivan igual sin
// importar POR QUÉ campo llegó el slug. Un grupo con sólo 2-3 productos (el caso migrado, sin el
// cuarto puntero configurado) simplemente deja una celda de la matriz sin producto — la "opción
// deshabilitada" del spec, no un error.
//
// `cuartoSlug` es OPCIONAL, como los otros tres — vacío = la matriz se arma con lo que el grupo
// tenga (1 a 3 productos), igual que hoy.
//
// `nombreCafe` (§ DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1) — el título FIJO del café, que NO cambia al
// elegir otra celda de la matriz. Gate del owner tras este mismo slice anterior: el h3 mostraba el
// nombre del producto ACTIVO con su variante pegada ("Café Onix — Molido 250 g"), que además
// CAMBIABA con la selección. OPCIONAL: vacío → se DERIVA del nombre del producto PRINCIPAL cortando
// en el separador " — " (`nombreCafeSpotlight`, `lib/config/spotlight.ts`) — nunca de `activo`, el
// producto de la celda elegida.
export interface SpotlightContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  badge: string;
  nombreCafe: string;
  productoSlug: string;
  presentacionSlug: string;
  otroTamanoSlug: string;
  /** El cuarto producto del grupo (§ el docstring de arriba) — la celda de la matriz que los tres
   *  punteros viejos no podían alcanzar por sí solos. */
  cuartoSlug: string;
  notaPrecio: string;
}

// SubscriptionCTA ("Plan Suscripción"): eyebrow + h2 + un párrafo + HASTA CUATRO bullets + el label
// del CTA (su href es ESTRUCTURA, `/suscripciones`, no editable). Sección de SOLO TEXTO —sin
// imágenes—. Los bullets son `bullet1..4` OPCIONALES: el componente los junta con un `.filter` que
// SALTA los vacíos, así que "vaciar el 2 y dejar el 3" cierra la lista sin hueco — son "hasta cuatro
// bullets", no "cuatro slots" (el editor lo dice en las etiquetas). 5+ bullets = el repeater
// compartido (la plataforma ya lo tiene). Las tarjetas de plan del teaser NO viven acá: son la sección
// `suscripcionPlanes` (DATO editable, § Backlog #49), la MISMA que lee /suscripciones — este teaser las
// recorta con `planesDelTeaser` (§ lib/storefront/planes-suscripcion).
export interface SubscriptionCTAContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  subtitulo: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  bullet4: string;
  ctaLabel: string;
  // El SEGUNDO CTA (§ MUESTRARIO-SECCION-CTA-1, MEDIDO contra `.cta-strip` del prototipo,
  // `docs/prototipos/cafeone/index.html:313-320`, "Únete al club" + "Explorar" — DOS botones, no uno).
  // `ctaLabel` de arriba sigue siendo el PRIMERO, con su href fijo a `/suscripciones` (por diseño, no
  // editable); éste es el ADICIONAL, opcional, con su propio destino del set cerrado
  // `MENU_CTA_DESTINOS` (§ `resolverCtaSeccion`) — mismo patrón que `presentaciones.ctaLabel`/
  // `.ctaDestino`. Vacío = sin segundo botón, byte-idéntico.
  ctaSecundarioLabel: string;
  ctaSecundarioDestino: string;
  // La VARIANTE de composición (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e). 'bloque' (canónica, la de
  // Nayoli — texto + tarjetas de plan en dos columnas) | 'linea' (franja horizontal condensada: el
  // gancho, el título y el botón en una línea; el subtítulo y los bullets NO se renderizan en esa
  // composición, § SubscriptionCTALinea.tsx). Escalar de SECCIÓN —como `visible`—, no un `campos`: no
  // lo toca el loop requerido/opcional del resolver. Gemela de `hero.variante`/`brandStory.variante`/
  // `presentaciones.variante`.
  variante: string;
  // La IMAGEN DE FONDO OPCIONAL de la franja (§ MUESTRARIO-CTA-BANNER-FOTO-1, MEDIDO contra
  // `.cta-strip` del prototipo, `docs/prototipos/cafeone/index.html:312-320` — foto a sangre completa
  // + velo degradado + parallax `[data-parallax]`, `js/home.js:303-307`). Vacío (default, Nayoli
  // incluida) = el fondo SÓLIDO de hoy, byte-idéntico. La lee SÓLO la variante 'linea'
  // (§ SubscriptionCTALinea.tsx) — `SubscriptionCTABloque` (la canónica) NO la lee, no se toca. El
  // velo reusa `--sf-velo` (el MISMO token que Marquesina/HeroMedia, `app/globals.css`, NO un rgba
  // nuevo) y el parallax reusa `useProgresoScroll` (`lib/animation.ts`, el motor de scroll-scrub que
  // ya usa Marquesina) — ninguna pieza nueva del motor de scroll.
  imagenFondo: string;
}

// Testimonios ("Lo que dicen nuestros clientes"): la PRIMERA sección REPEATER — un encabezado de
// sección (eyebrow + titulo) sobre una LISTA de testimonios. Cada ítem: name/text requeridos,
// city/product opcionales, y `stars` (número, no string → el resolver lo pasa tal cual). Es
// OCULTABLE **y** hide-on-empty: con `items` vacío no se renderiza, y esa precedencia gana sobre el
// toggle. NACE CON items VACÍOS a propósito (§ SiteContent — el repeater): los defaults valen para copy,
// NO para un CLAIM falso — los tres testimonios fabricados no van a defaults; el owner carga los
// reales como DATO por el editor.
export interface TestimonialItem {
  name: string;
  city: string;
  text: string;
  product: string;
  stars: number;
}

export interface TestimonialsContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  items: TestimonialItem[];
}

// LA PÁGINA /nosotros — el relato largo (la home lleva el ANZUELO: el collage de 4 fotos fijas de
// brandStory; la historia completa vive acá). Es una sección MÁS del mismo `content` JSON —la
// "página" es una agrupación de CONFIG (§ tienda-secciones `pagina`), no un anidado en el dato—.
// `ocultable:false` porque el ocultar es a nivel de PÁGINA (`paginas.nosotros.visible`), no de esta
// sección.
//
// `imagen` (§ NOSOTROS-COMPOSICION-1): OPCIONAL, el mismo mecanismo de imagen de sección ya usado en
// todo el REGISTRY (path estático o URL de Blob, string) — no un tipo nuevo. **Vacío = el render de
// hoy, byte a byte** (`NosotrosHistoria.tsx` bifurca ANTES de tocar el layout): la página se sentía
// "cortada" porque terminaba en puro texto seguido del footer; con la foto puesta, la sección
// compone a DOS COLUMNAS (texto | imagen) en escritorio, apiladas en móvil — la MISMA composición
// imagen-con-texto con la que abre el about del tema real (medido, § CENSO-NOSOTROS-TEMA-REAL-1,
// `image_with_text`). Sin ella, Nayoli (y cualquier tenant que no la llene) no cambia un solo byte.
export interface NosotrosHistoriaContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  parrafo1: string;
  parrafo2: string;
  parrafo3: string;
  imagen: string;
}

// EL CTA DE CIERRE de /nosotros (§ NOSOTROS-COMPOSICION-1): la banda que cierra la página, justo
// antes del pie — mismo lugar donde el tema real cierra con su CTA final (titular + párrafo + botón,
// § CENSO-NOSOTROS-TEMA-REAL-1). Reusa la GRAMÁTICA visual de `SubscriptionCTALinea` (imagen a sangre
// + velo + parallax + gate de movimiento reducido, § NosotrosCierre.tsx) con SU PROPIO contenido: el
// cierre de /nosotros no puede repetir el texto de la suscripción de la home.
//
// NACE VACÍA, TODO OPCIONAL — ninguna sección nueva nace con copy de una vertical (café u otra); el
// owner la llena desde el panel. `titulo` es el ÚNICO gate de hide-on-empty: sin él la banda NO se
// monta (`NosotrosCierre.tsx`), así que ningún tenant que no la llene cambia un byte, Nayoli incluida.
// `ctaLabel`/`ctaDestino` son el par de un botón opcional (mismo patrón que
// `subscriptionCTA.ctaSecundarioLabel`/`.ctaSecundarioDestino` — `resolverCtaSeccion` decide el
// href, `null` = sin botón). `imagenFondo` es el ÚNICO blob de la sección — vacío = fondo sólido
// (`--sf-tinta-2`, la misma OSCURA canónica que la suscripción cierra la home).
export interface NosotrosCierreContent {
  visible: boolean;
  titulo: string;
  parrafo: string;
  ctaLabel: string;
  ctaDestino: string;
  imagenFondo: string;
}

// La GALERÍA de /nosotros: la SEGUNDA sección REPEATER (Testimonios fue la primera), y la que
// estrena el tipo `imagen` por ítem. Un encabezado OPCIONAL (eyebrow + titulo) sobre una LISTA de
// fotos. Cada ítem: `url` requerida (la foto), `alt` opcional (la descripción para lectores de
// pantalla). Es OCULTABLE **y** hide-on-empty: sin fotos no se renderiza. NACE VACÍA (§ el repeater):
// las fotos de la finca las sube el owner como DATO, no hay defaults de imagen que fabricar.
// A DIFERENCIA de Testimonios, el `titulo` es OPCIONAL: una galería puede ir sin encabezado (las
// fotos son el contenido), así que vaciarlo lo omite en vez de caer al default.
// `w`/`h` son la proporción NATURAL de la foto/vídeo, capturada en la subida (§ useSubidaImagen; de
// `createImageBitmap` para imagen, de `loadedmetadata` para vídeo), para que la galería reserve el
// alto de cada celda sin salto de layout (masonry). Opcionales: un ítem viejo o uno que el navegador
// no pudo medir cae a una proporción por defecto.
//
// `tipo` es un HECHO DECLARADO (no se deduce de la extensión — un vídeo trae DOS urls de distinto
// tipo, el vídeo y el póster; y la doctrina prefiere un dato a un string parseado, § agotado).
// AUSENTE = 'imagen' (los ítems previos no lo tienen; retrocompatible). `poster` es la imagen que se
// ve mientras el vídeo carga / antes de reproducir — REQUERIDA para un vídeo, y el alta lo garantiza
// por construcción (el ítem-vídeo nace con vídeo Y póster; § el editor). Los cuatro pasan TAL CUAL por
// el resolver (no son campos string declarados del repeater), como el `stars` de un testimonio.
export interface GaleriaItem {
  url: string;
  alt: string;
  w?: number;
  h?: number;
  tipo?: 'imagen' | 'video';
  poster?: string;
}

export interface NosotrosGaleriaContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  items: GaleriaItem[];
}

// LA PÁGINA /suscripciones — los PLANES como DATO (§ Backlog #49, opción 1). Antes las tarjetas de
// plan venían de `SUBSCRIPTION_PLANS` (`lib/mock/subscriptions`, ESTRUCTURA compartida con la home);
// ahora son contenido editable, y las DOS superficies (esta página Y el teaser de la home) leen esta
// MISMA sección → no divergen (era el temor de #49; hacerlas dato lo RESUELVE, no lo causa).
//
// CARDINALIDAD 1-4 con CAMPOS PLANOS (no repeater — un repeater no da defaults byte-idénticos, § la
// bifurcación de cardinalidad). Plan 1 REQUERIDO (empty → default de Nayoli → mínimo 1); planes 2-4
// OPCIONALES (empty → el plan no se muestra). Qué plan SE MUESTRA lo decide el componente
// (`planesDeSuscripcion`, nombre presente), NO el resolver — como Presentaciones.
//
// El PRECIO es OPCIONAL y de TEXTO (owner): un plan puede llevarlo o no; la moneda, el formato y frases
// como "desde $X" son del cliente, y un número inventado sería dato FALSO en la ruta del dinero. Vacío
// → NO se muestra (nunca placeholder ni "desde"). Nayoli no lleva precio → sus `precioN` nacen vacíos.
//
// La FRECUENCIA vive DENTRO de `descripcion` ("El doble del plan básico, cada mes"), como frase
// (owner, § b): el sistema no la usa como dato —no hay pedidos recurrentes— así que un campo aparte
// sería una mina inerte. Los BENEFICIOS por plan son `benN_1..4` OPCIONALES (el componente los junta
// con `.filter`, hasta 4 sin hueco — como los bullets de subscriptionCTA). El DESTAQUE es UN índice de
// sección (`destacadoSlot`, § c): unifica el `plan.popular` de esta página y el `i===1` hardcodeado del
// teaser —estructuralmente imposible destacar dos—. '' = ninguno; default '2' (el Plan Estándar de hoy).
//
// LOS NOMBRES NO LLEVAN UNIDAD (§ CONTENIDO-NEUTRALIZAR-3): 'Plan 250 g'/'Plan 500 g' presuponían
// gramos, o sea la mercadería — un cliente de cualquier otro rubro los vería tal cual. Lo que un plan
// distingue en CUALQUIER rubro es CUÁNTO (relativo al plan anterior) y CADA CUÁNTO, sin nombrar el
// producto ni asumir peso/volumen: 'Plan Básico' → 'Plan Estándar' (el doble) → 'Plan Familiar' (el
// doble del anterior). 'Plan Familiar' ya era genérico y no cambió.
export interface SuscripcionPlanesContent {
  visible: boolean;
  eyebrow: string;
  titulo: string;
  tituloEnfasis: string;
  subtitulo: string;
  planesTitulo: string;
  planesSubtitulo: string;
  ctaLabel: string;
  /** El SLOT del plan destacado ('1'..'4'), o '' (ninguno). Un índice, no un booleano por plan:
   *  imposible destacar dos. Lo consumen las DOS superficies (esta página + el teaser). */
  destacadoSlot: string;
  // Plan 1 REQUERIDO (defaults de Nayoli). `precio` y los beneficios OPCIONALES.
  nombre1: string; descripcion1: string; precio1: string;
  ben1_1: string; ben1_2: string; ben1_3: string; ben1_4: string;
  // Planes 2-4 OPCIONALES: nombre vacío → el plan no se muestra (§ planesDeSuscripcion).
  nombre2: string; descripcion2: string; precio2: string;
  ben2_1: string; ben2_2: string; ben2_3: string; ben2_4: string;
  nombre3: string; descripcion3: string; precio3: string;
  ben3_1: string; ben3_2: string; ben3_3: string; ben3_4: string;
  nombre4: string; descripcion4: string; precio4: string;
  ben4_1: string; ben4_2: string; ben4_3: string; ben4_4: string;
}

// Los PASOS "¿Cómo funciona?" de /suscripciones (§ Backlog #49 · e). Café-shape en el TEXTO ("café de
// nuestra finca", "grano o molido", "tandas semanales") → entran como DATO editable. Cardinalidad FIJA
// 4 (una historia de 4 pasos; variar el número es otra decisión) → campos PLANOS requeridos, byte-
// idénticos a los `SUBSCRIPTION_STEPS` de hoy. Los ÍCONOS y el número "01".."04" quedan ESTRUCTURALES
// (secuencia, no contenido): el componente los pone por índice; un selector de íconos es capacidad
// mayor, no un campo. Sección OCULTABLE (un cliente puede no querer un "cómo funciona").
export interface SuscripcionPasosContent {
  visible: boolean;
  titulo: string;
  paso1Label: string; paso1Desc: string;
  paso2Label: string; paso2Desc: string;
  paso3Label: string; paso3Desc: string;
  paso4Label: string; paso4Desc: string;
}

// La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1, sobre § Backlog #49 y § SiteContent — el
// repeater). Antes vivía en `constants/subscription-faq.ts` (RETIRADO): cuatro preguntas con
// respuestas FALSAS —"pausar… desde tu cuenta" (la ruta `/cuenta` está borrada), "el cobro se
// realiza el mismo día de cada mes" y "el cambio aplica desde el siguiente ciclo" (no hay cobro
// recurrente: `esSuscripcion`/`SUBSCRIPTIONS_ENABLED` dan CERO en el repo, § #68), y "envío gratis a
// nivel nacional" (`computeShippingCost` cobra envío bajo `freeShippingThreshold` y no conoce el
// concepto de suscripción)—. Es el mismo caso que TESTIMONIOS (§ #44): los defaults valen para copy,
// NO para un CLAIM falso sobre el negocio, así que NACE VACÍA — REPEATER, hide-on-empty, sin copiar
// ninguna de las cuatro respuestas viejas.
export interface SuscripcionFaqItem {
  question: string;
  answer: string;
}

export interface SuscripcionFaqContent {
  visible: boolean;
  titulo: string;
  items: SuscripcionFaqItem[];
}

// LA PÁGINA /tienda ENTRA AL EDITOR (§ TIENDA-PAGINA-REGISTRO-1, sobre TIENDA-COMPOSICIONES-CENSO-1).
// El catálogo público era una sola función de cliente (`ShopLegacy`/`ShopCorte`,
// app/(storefront)/tienda/page.tsx) sin registro en SiteContent — ni `PaginaKey` ni `SeccionVista`.
// Se parte en DOS secciones mínimas, cada una con UNA composición «Actual» (§ REGISTRY.
// tiendaEncabezado/.tiendaCatalogo.variantes) que reproduce BYTE A BYTE lo de hoy: las dos ramas
// `ShopLegacy`/`ShopCorte` se conservan tal cual dentro de esa única composición — este registro no
// unifica ni re-estiliza nada, sólo mueve dónde vive el texto.
//
// `ocultable: false` en las DOS, como el hero y el menú: el catálogo ES la tienda, no una banda que
// se pueda apagar — no hay `visible` que resolver.
// LA COMPOSICIÓN «CARTA» (§ TIENDA-CHAMISAS-ALBUM-1, sobre TIENDA-COMPOSICIONES-CENSO-1): la línea
// «cálida, hecha por mujeres» del álbum de láminas. Tres campos NUEVOS, los tres OPCIONALES — vacío
// se OMITE, nunca cae a un texto inventado (§ la frontera fina de defaults-como-fallback: "el
// fallback aplica a lo que la página NECESITA", y un sticker/una intro/el título del selector de
// antojo son DECORACIÓN, no algo que la página necesite para existir).
//  · `sticker` — el texto girado junto al H1 (p. ej. "cosecha 2026"). Vacío: no se muestra.
//  · `intro` — la frase en primera persona bajo el H1. Vacío: no se muestra.
//  · `antojoTitulo` — el encabezado del selector «¿Qué te provoca?» — SÍ tiene default (no es un
//    dato del dueño como los dos de arriba, es COPY del selector), así que es REQUERIDO.
// LA COMPOSICIÓN «APERTURA» (§ TIENDA-ONIX-CARTELERA-1, la forma C que el owner eligió sobre la
// maqueta interactiva). Tres campos nuevos:
//  · `imagen` — la foto a pantalla completa. OPCIONAL: sin ella, Apertura pinta una superficie de
//    color tinta con el mismo título (§ el spec, "Sin foto, la apertura es una superficie de color
//    tinta") — nunca un `<img>` roto ni una foto de stock inventada.
//  · `rotuloIzquierda`/`rotuloDerecha` — los DOS micro-rótulos en mayúscula sobre la foto (p. ej.
//    "Cosecha 2026" y el origen). AMBOS opcionales: son decoración, no algo que la página necesite
//    para existir (§ la frontera fina de defaults-como-fallback) — vacíos, no se muestran.
//  · `titulo` PASA A OPCIONAL (era requerido) para que Apertura pueda caer a "el nombre del negocio"
//    cuando está vacío (§ el spec: "vacío → el nombre del negocio") — un fallback que el RESOLVER no
//    puede dar (no conoce el nombre del negocio; `DEFAULTS` es código estático) y que por tanto
//    tiene que resolver el COMPONENTE, igual que `logo.alt`/`NosotrosGaleria` ("opcional con
//    fallback contextual"). «Actual»/«Carta» NO cambian de comportamiento: `TiendaEncabezado.tsx`
//    aplica su MISMO fallback de siempre (`|| 'Nuestra Tienda'`) a nivel de componente, así que un
//    `titulo` vacío sigue resolviendo exactamente igual que antes en esas dos composiciones —
//    byte-idéntico en los dos sentidos: con fila (antes: requerido→default; ahora: opcional→'' en
//    el resolver→'Nuestra Tienda' en el componente) y sin fila (DEFAULTS.titulo='Nuestra Tienda'
//    de siempre, inalcanzado por la clasificación requerido/opcional).
export interface TiendaEncabezadoContent {
  titulo: string;
  // Acompaña al conteo de productos, que sigue siendo DATO vivo (`getCatalog`), nunca contenido:
  // "{N} productos · {leyenda}" (hoy, siempre "Origen colombiano"). Requerido — vacío cae al
  // default, el conteo nunca queda sin su frase.
  leyenda: string;
  sticker: string;
  intro: string;
  antojoTitulo: string;
  variante: string;
  imagen: string;
  rotuloIzquierda: string;
  rotuloDerecha: string;
}

// EL BUSCADOR QUEDA FUERA A PROPÓSITO — DESVIACIÓN MEDIDA, no un campo olvidado. El placeholder de
// hoy es literal "Buscar café..." (`ShopLegacy`/`ShopCorte`, antes de este slice): un DEFAULT de
// REGISTRY con esa palabra viola el catcher de vocabulario café-shape que ya corre sobre TODO
// `DEFAULTS` (`site-content-defaults.test.ts`, `TERMINOS_PROHIBIDOS` — café/molid/tueste/finca…,
// sin excepción declarada para ningún campo de texto), y cambiarlo a un texto neutro rompería el
// byte-idéntico que este mismo slice exige (no hay fila de `SiteContent` sembrada para esta sección
// nueva: `verificar:nayoli` resolvería contra el DEFAULT, no contra un dato de Nayoli). El café-shape
// del microcopy del storefront es un censo APARTE, ya nombrado en CLAUDE.md (§ #63, "COPY café-shape
// del storefront"), con su propio disparador ("el primer cliente no-café FIRMADO") — no se adelanta
// acá. El placeholder sigue siendo el literal de hoy, sin cambio, en `TiendaCatalogo.tsx`.
export interface TiendaCatalogoContent {
  vacioTitulo: string;
  vacioTexto: string;
  // EL COLOR POR CAFÉ (§ TIENDA-CHAMISAS-ALBUM-1, composición «Láminas»): mapa id-de-producto → hex
  // de 6 dígitos, KEY-AGNÓSTICO (gemelo de `esquemas`/`variantesBandas`, pero DENTRO de la sección en
  // vez de meta — § `SeccionDef.mapas`, `resolverMapaColor`). Un producto SIN entrada (o con un
  // id/hex inválido) toma color por ORDEN de catálogo (`lib/tienda/laminas.ts`, `colorDeLamina`), no
  // un hex fijo de ningún cliente — la paleta de reserva se DERIVA de `content.tema`. Un producto
  // BORRADO deja de leerse (el mapa no se poda solo; es basura inerte, no un bug); uno NUEVO toma
  // color por orden sin que nadie edite nada.
  coloresPorProducto: Record<string, string>;
  variante: string;
  // «TAQUILLA» (§ TIENDA-ONIX-CARTELERA-1): la barra de compra fija del celular, SÓLO con efecto bajo
  // esa composición (§ el spec, item 6) — pero se edita siempre, mismo criterio que `coloresPorProducto`
  // bajo «Láminas». Default `true`: un tenant que recién elige «Taquilla» la quiere encendida de
  // arranque (es la forma recomendada, § la maqueta aprobada "Barra de compra en el celular: Encendida");
  // Nayoli/«Actual»/«Láminas» nunca la leen, así que el default no les cambia nada.
  barraFijaMovil: boolean;
}

// EL INTERLUDIO «RETRATO Y CITA» (§ TIENDA-CHAMISAS-ALBUM-1) — sección NUEVA, OPCIONAL de verdad: se
// auto-oculta SIN imagen (el componente lo comprueba, § TiendaInterludio.tsx), y nace APAGADA
// (`visible:false`, `ocultable:true`) para que un tenant que no la toque quede byte-idéntico — NO
// hay imagen por defecto que mostrar, y una imagen de stock sería una mentira de marca. `cita`/
// `firma` OPCIONALES: "Nada de citas ni nombres en los defaults" (§ el invariante #44, la misma
// familia que ya prohíbe reseñas fabricadas — una cita atribuida a alguien es un CLAIM, no copy).
// LA COMPOSICIÓN «PLANO» (§ TIENDA-ONIX-CARTELERA-1): una foto documental a sangre con un pie en
// micro-mayúsculas, SIN retrato ni cita atribuida — distinta de «Retrato y cita» (la canónica,
// renombrada 'retrato' acá). `pie` es el ÚNICO campo nuevo —OPCIONAL, vacío no se muestra, mismo
// criterio que `cita`/`firma`—; reusa el campo `imagen` que ya existía (misma foto, otro tratamiento
// visual). `variante` entra como en `tiendaEncabezado`/`tiendaCatalogo`: canónica 'retrato', byte-
// idéntica sin fila.
export interface TiendaInterludioContent {
  visible: boolean;
  imagen: string;
  cita: string;
  firma: string;
  variante: string;
  pie: string;
}

// EL CIERRE «COSTURA» (§ TIENDA-CHAMISAS-ALBUM-1) — sección NUEVA, OPCIONAL, nace APAGADA
// (`visible:false`) por la misma razón que el interludio. `franjaTejido` es la franja de tejido de
// LA PÁGINA /tienda (§ el spec, item 5): vive acá porque Costura es su consumidor obligatorio ("la
// franja arriba"); sin imagen, la tarjeta se queda sin esa franja (no se imita con CSS, § la
// referencia). `frase`/`boton` son REQUERIDOS —a diferencia de la cita del interludio, no son un
// CLAIM atribuido a nadie, son copy de la propia tienda— así que vacío cae al default neutro.
// LA COMPOSICIÓN «FRASE Y BOTÓN» (§ TIENDA-ONIX-CARTELERA-1): reusa `frase`/`boton` TAL CUAL —CERO
// campos nuevos—, sólo que sin la franja de tejido ni el marco de «Costura» (la canónica, renombrada
// 'costura' acá). `variante`, mismo patrón que el resto: canónica 'costura', byte-idéntica sin fila.
export interface TiendaCierreContent {
  visible: boolean;
  franjaTejido: string;
  frase: string;
  boton: string;
  variante: string;
}

// LA FICHA DE ORIGEN · «CRÉDITOS» (§ TIENDA-ONIX-CARTELERA-1, sección NUEVA, opcional). REPEATER
// etiqueta/valor, nace VACÍA —"DEFAULTS VACÍOS: ningún dato de finca vive en el código" (§ el spec)—,
// mismo criterio que testimonios/#44: ningún dato de finca se hornea. `ocultable:true`, y SE OCULTA
// ADEMÁS con menos de 3 filas (§ `lib/tienda/creditos.ts`, `creditosVisibles`) — un umbral MÁS
// ESTRICTO que el hide-on-empty genérico de un repeater (array vacío), que el COMPONENTE aplica
// además del toggle, no el resolver (mismo patrón que `mostrarSelectorAntojo`/`mostrarCreditos`: una
// decisión de PRESENTACIÓN, no de modelo).
export interface TiendaCreditoItem {
  etiqueta: string;
  valor: string;
}
export interface TiendaCreditosContent {
  visible: boolean;
  items: TiendaCreditoItem[];
}

// Los TRES ítems CONOCIDOS del menú del nav (§ CROMO-MENU-COMO-DATO-1) — set CERRADO: no se
// agregan ni se quitan ítems, sólo se RENOMBRAN y se REORDENAN. El orden CANÓNICO (el de
// `StoreNav.tsx` antes de este slice) es tienda → suscripciones → nosotros.
export const MENU_ITEM_IDS = ['tienda', 'suscripciones', 'nosotros'] as const;
export type MenuItemId = typeof MENU_ITEM_IDS[number];

// El SET CERRADO de destinos del CTA del menú — mismo patrón que `HERO_HREFS` (abajo): el dueño
// ELIGE entre rutas que YA EXISTEN, nunca escribe una libre. Declarado UNA vez: tanto el render
// (`menuCtaHref`, abajo) como el validador del schema (`site-content-schema.ts`) leen esta lista,
// para que no diverjan.
export const MENU_CTA_DESTINOS = ['/tienda', '/suscripciones', '/nosotros'] as const;
export type MenuCtaDestino = typeof MENU_CTA_DESTINOS[number];

// El MENÚ del nav (§ CROMO-MENU-COMO-DATO-1). Los TRES ítems son CONOCIDOS —`MENU_ITEM_IDS`—, no un
// repeater: sus RUTAS son ESTRUCTURA (como `HERO_HREFS`), sólo la ETIQUETA de cada uno es dato
// (patrón `ctaPrimarioLabel`: requerido, vacío → el literal de hoy). `ocultable:false` — el menú
// entero no se apaga; cada ítem individual sigue gateado por `paginas.*.visible`, SIN CAMBIO
// (§ VISIBILIDAD se queda como hoy — renombrar no es encender).
//
// LAS POSICIONES SON `content.orden` (§ orden de bandas) SPLIT EN TRES CAMPOS ESCALARES en vez de
// un array: la cáscara del editor sólo pinta campos de texto/select nativos —no hay UI de
// arrastrar-para-reordenar—, así que la MISMA idea de `orden` (una secuencia de ids, SOFT, siempre
// completa, la basura cae a la canónica) se expresa como tres selects nativos de opciones fijas
// (`MENU_ITEM_IDS`), uno por posición. `resolverOrdenMenu` (abajo) dedupe y completa exactamente
// como `resolverOrden` — gemela, no una copia literal: el dominio es distinto (`MenuItemId`, no
// `BandaId`), así que es su propia función, del mismo tamaño y forma.
export interface MenuContent {
  visible: boolean;
  labelTienda: string;
  labelSuscripciones: string;
  labelNosotros: string;
  posicion1: string;
  posicion2: string;
  posicion3: string;
  // El CTA (§ CROMO-MENU-COMO-DATO-1): AMBOS opcionales, default vacío → el CTA no se muestra — hoy
  // no hay CTA en el nav, así que el default es Nayoli byte-idéntica. `ctaDestino` es del SET
  // CERRADO `MENU_CTA_DESTINOS`; un valor fuera del set (basura, o el schema ya lo rechaza al
  // guardar) hace que `menuCtaHref` no lo renderice — preferir callar a un link roto.
  ctaLabel: string;
  ctaDestino: string;
  // El BADGE de cosecha (§ CORTE-BADGE-COSECHA-EN-MENU-1) — MUDADO de `cromo.navBadge` (que
  // envolvía el LOGO, dormido desde este slice) a ser un ATRIBUTO de UN ítem del menú, como el
  // `.nav-item .badge` del prototipo (`index.html:27-32`, junto al PRIMER `.nav-item`, no al
  // `.wordmark`). `badgeItem` es del SET CERRADO `MENU_ITEM_IDS` (o `''` = ningún ítem elegido);
  // `badgeTexto` es el texto libre del badge. AMBOS 'opcional' en `REGISTRY.menu.campos`, default
  // vacío → sin badge, mismo patrón que `ctaLabel`/`ctaDestino` — byte-idéntico sin fila.
  // `itemsDeMenu` (abajo) lo resuelve en el ítem cuyo id coincide con `badgeItem`; un `badgeItem`
  // que apunte a un ítem OCULTO (gateado por `paginas.*.visible`) o a un id fuera del set
  // simplemente no encuentra dónde mostrarse — preferir callar, mismo criterio que `menuCtaHref`.
  //
  // EN EL TIPO SON `?` (a diferencia de `ctaLabel`/`ctaDestino`, requeridos): son ADITIVOS sobre
  // una interfaz que ya tenía un literal armado a mano fuera de `touches:` de este slice
  // (`MENU_HOY: Omit<MenuContent, 'visible'>`, `lib/config/menu-como-dato.test.ts`) — hacerlos
  // requeridos habría roto ese archivo sin poder tocarlo. La opcionalidad es sólo del TIPO: en
  // RUNTIME `content.menu` siempre los trae resueltos a `''` vía `REGISTRY.menu.campos` +
  // `resolverSiteContent` (el mismo mecanismo que ya resuelve `ctaLabel`/`ctaDestino`), nunca
  // `undefined`.
  badgeItem?: string;
  badgeTexto?: string;

  // EL PANEL DESPLEGABLE (mega-menu, § MUESTRARIO-MEGA-MENU-1) — medido contra el prototipo
  // (`docs/prototipos/cafeone/index.html:57-89`, `#mega-cafe`): intro (copy + CTA), DOS columnas de
  // sub-enlaces, una tarjeta promocional (imagen + título + CTA). UN panel a la vez, atado a UN
  // ítem — MISMO patrón que `badgeItem`: `panelItem` es del SET CERRADO `MENU_ITEM_IDS` (o `''` =
  // ningún ítem lleva panel, el default byte-idéntico). Campos PLANOS, no un objeto anidado — mismo
  // criterio que `suscripcionPlanes` (nombreN/benN_M): el resolver genérico (`REGISTRY.menu.campos`)
  // sólo sabe default-vs-omitir por CAMPO STRING de primer nivel, no recorrer un árbol; anidar habría
  // exigido un mecanismo nuevo que el resto del modelo no tiene.
  //
  // LOS DESTINOS (`panelIntroCtaDestino`, cada `*Destino` de columna, `panelTarjetaCtaDestino`) son
  // del MISMO set cerrado `MENU_CTA_DESTINOS` que `ctaDestino` arriba — el prototipo apunta sus
  // columnas a variantes de producto (`producto.html?p=Molido&t=250`) y a anclas de la propia página
  // (`#historia`), NINGUNA expresable en el set cerrado de hoy: un destino de texto libre se rompe
  // solo (§ por qué se retiró `PRESENTACIONES_HREFS`), así que ese detalle del prototipo NO se
  // reproduce — el panel apunta a rutas reales (`/tienda`, `/suscripciones`, `/nosotros`), no a
  // productos puntuales ni anclas. Declarado en el asiento de este slice.
  //
  // Cada ENLACE de columna lleva además `nota` (el texto secundario que el prototipo muestra al lado
  // del label — ahí un precio; acá TEXTO del dueño, nunca un dato derivado del catálogo — ver
  // `resolverEnlacePanel`, más abajo).
  //
  // TODOS opcionales (`?`), como `badgeItem`/`badgeTexto`: son ADITIVOS sobre una interfaz que ya
  // tenía un literal armado a mano fuera de `touches:` de este slice (`MENU_HOY`, § arriba). En
  // RUNTIME siempre resuelven a `''` vía `REGISTRY.menu.campos` + `resolverSiteContent`, nunca
  // `undefined`.
  panelItem?: string;
  panelIntro?: string;
  panelIntroCtaLabel?: string;
  panelIntroCtaDestino?: string;
  panelCol1Titulo?: string;
  panelCol1Link1Etiqueta?: string;
  panelCol1Link1Nota?: string;
  panelCol1Link1Destino?: string;
  panelCol1Link2Etiqueta?: string;
  panelCol1Link2Nota?: string;
  panelCol1Link2Destino?: string;
  panelCol1Link3Etiqueta?: string;
  panelCol1Link3Nota?: string;
  panelCol1Link3Destino?: string;
  panelCol2Titulo?: string;
  panelCol2Link1Etiqueta?: string;
  panelCol2Link1Nota?: string;
  panelCol2Link1Destino?: string;
  panelCol2Link2Etiqueta?: string;
  panelCol2Link2Nota?: string;
  panelCol2Link2Destino?: string;
  panelCol2Link3Etiqueta?: string;
  panelCol2Link3Nota?: string;
  panelCol2Link3Destino?: string;
  // La imagen de la TARJETA promocional — el ÚNICO blob del menú (§ REGISTRY.menu.imagenes, abajo:
  // sin nombrarlo ahí, un reemplazo dejaría el blob viejo huérfano para siempre).
  panelTarjetaImagen?: string;
  panelTarjetaTitulo?: string;
  panelTarjetaCtaLabel?: string;
  panelTarjetaCtaDestino?: string;
}

// Un enlace legal del pie (§ MUESTRARIO-FOOTER-TEMA-1, `items` de `FooterContent` abajo). A
// diferencia de los enlaces de columna (`linkTienda`/`linkSuscripciones`/…, hrefs FIJOS por
// identidad — § el docstring de `FooterContent`), una página legal ("Política de privacidad",
// "Términos") no tiene una ruta estructural que el código ya conozca: el dueño la redacta y la
// publica donde quiera, así que acá SÍ hace falta el par completo {label, href} como dato.
export interface FooterLegalItem {
  label: string;
  href: string;
}

// EL PIE DE PÁGINA como SECCIÓN del REGISTRY (§ MUESTRARIO-FOOTER-TEMA-1), MISMO precedente que
// `menu` (arriba): sección SIN ser BANDA — no entra a `BANDA_IDS`/`ORDEN_DEFAULT` (el pie se
// renderiza en el LAYOUT, en toda página, no en el orden del home) pero SÍ es `SeccionKey` (tiene
// `campos`, publica por el route genérico de `/api/site-content`, tiene control de panel).
//
// LO QUE PASA A SER DATO (medido contra `StoreFooter.tsx` de HOY y contra el pie del prototipo,
// `docs/prototipos/cafeone/index.html:322+`): los ENCABEZADOS de columna y las ETIQUETAS de sus
// enlaces, que hoy salían de `siteConfig.footerNav` (código fijo) — la marca/tagline YA es dato
// (viene de `SiteSetting.nombre`/`.tagline`/`.descripcionFooter` vía `useSiteSettings()`, sin
// tocar); lo que cambia para la marca es sólo su COMPOSICIÓN dentro de cada variante, no su fuente.
//
// LOS HREFS DE LAS 5 COLUMNAS SON ESTRUCTURA, NO DATO — mismo criterio que `HERO_HREFS`/
// `ctaDestino` de menú: son rutas REALES del storefront (`/tienda`, `/suscripciones`, …) y el
// FILTRADO por página visible (`StoreFooter.tsx`, hoy líneas 66-73) compara contra esos hrefs
// literales; si el href fuera dato libre, ese filtro se rompería en cuanto alguien lo editara. Sólo
// la ETIQUETA (el texto visible) es campo editable — el enlace SIGUE yendo al mismo sitio.
export interface FooterContent {
  visible: boolean;
  // La VARIANTE de composición (§ eje 5e): 'franjas' es la canónica —el pie de HOY, verbatim, cuatro
  // columnas lado a lado— (NO 'columnas': ese nombre ya lo usa `brandStory.variante` como su propia
  // canónica, y el catcher de duplicados de DEFAULTS trata cualquier string repetido como colisión,
  // así que se evita pedir una excepción por un token que no es contenido visible); 'apilado' es la
  // del muestrario —marca arriba, tagline, columnas debajo, MEDIDA contra
  // `docs/prototipos/cafeone/index.html:322+` SIN el formulario de newsletter ni la tarjeta de mapa
  // (§ MUESTRARIO-FOOTER-TEMA-1, fuera de alcance de este slice — quedan para su propia tanda).
  variante: string;
  columnaTienda: string;
  columnaAyuda: string;
  columnaEmpresa: string;
  // "Todos los productos" → /tienda (siempre visible).
  linkTienda: string;
  // "Suscripciones" → /suscripciones (oculto si `paginas.suscripciones.visible` es false).
  linkSuscripciones: string;
  // "Rastrear Pedido" → /rastrear-pedido (siempre visible).
  linkRastrearPedido: string;
  // "Preguntas Frecuentes" → /preguntas-frecuentes (oculto si `faqSuscripcionesVisible` es false).
  linkPreguntasFrecuentes: string;
  // "Nuestra Historia" → /nosotros (oculto si `paginas.nosotros.visible` es false).
  linkNuestraHistoria: string;
  // LA TARJETA DE IMAGEN OPCIONAL (§ MUESTRARIO-FOOTER-TARJETA-IMAGEN-1, la última pieza construible
  // de MUESTRARIO-FOOTER-TEMA-1): en el muestrario es el MAPA con marcador (`docs/prototipos/cafeone/
  // index.html:348-361`, `.map-card`/`.map-cap`), pero el campo es GENÉRICO — una imagen que el dueño
  // SUBE, no una integración de proveedor de mapas (Google Maps/Mapbox/un iframe serían un SERVICIO
  // EXTERNO, con su clave y su costo — decisión de producto que este slice no toma). `tarjetaImagen`
  // ENTRA en `REGISTRY.footer.imagenes` (§ abajo) — es un BLOB: sin nombrarlo ahí, el borrado de blobs
  // reemplazados (`imagenesDe`, site-content-blobs.ts) nunca la vería y una imagen reemplazada
  // quedaría HUÉRFANA en el storage para siempre (mismo mecanismo que `hero.imagenPoster`/
  // `menu.panelTarjetaImagen`, arriba). AMBOS campos son `opcional` — vacía = SIN tarjeta, byte-
  // idéntico al pie de hoy; un `tarjetaTexto` sin `tarjetaImagen` tampoco se muestra (sería un pie de
  // foto flotando sobre nada) — la gate vive en el consumidor (`StoreFooter.tsx`, `FooterApilado`).
  // SÓLO LA LEE la variante 'apilado' (la del muestrario): la canónica ('franjas', `FooterColumnas`)
  // NO importa estos dos campos en absoluto — no hay un flag que consultar para "no mostrarla", el
  // componente de la canónica simplemente no los referencia (mismo patrón que `subscriptionCTA.
  // imagenFondo`, que sólo lee `SubscriptionCTALinea`, nunca `SubscriptionCTABloque`).
  tarjetaImagen: string;
  tarjetaTexto: string;
  // La fila legal del pie (§ Backlog, páginas legales pendientes de redacción) — REPEATER, cardinalidad
  // VARIABLE que empieza en CERO (mismo criterio que testimonios/FAQ, § #44: sin defaults fabricados).
  // Vacío → la fila legal no se muestra, byte-idéntico a `siteConfig.legalNav` de hoy (`[]`). El campo
  // se llama `items` (no `legales`) por CONVENCIÓN — el mismo nombre que usan TODOS los repeaters de
  // este archivo (`testimonials.items`, `nosotrosGaleria.items`, `suscripcionFaq.items`):
  // `camposDeItemsRepeater` (panel-controles.ts) hardcodea el segmento `.items.` en la ruta derivada
  // en vez de leer `itemsKey`, así que un `itemsKey` distinto de `'items'` desalinea la ruta que ese
  // chequeo reporta de la ruta real del dato — seguir la convención lo evita.
  items: FooterLegalItem[];
  // EL CRÉDITO "Hecho por Duna" (§ PIE-HECHO-POR-DUNA-1, pedido del owner: "None of the pages have a
  // 'made by duna'... should we use it?"). BOOLEANO de sección (mismo mecanismo que `hero.ctasVisibles`
  // — `def.booleanos`, resuelto en `resolverSiteContent` por NOMBRE, no un `campos` string), nombrado
  // con el sufijo `Visible` de la convención ya establecida (`titularVisible`/`subtituloVisible`/
  // `veloVisible`), no `mostrar*` — es el ÚNICO nombre que este archivo usa para un switch true/false.
  // DEFAULT `true` (§ DEFAULTS.footer, abajo): el crédito es de la PLATAFORMA, no un dato que el
  // dueño redacta — a diferencia de `tarjetaImagen`/`tarjetaTexto` (datos del cliente, default vacío),
  // acá el texto y el destino (`https://duna.solutions`) son FIJOS en el componente, nunca editables;
  // esta bandera sólo decide si la línea se renderiza. Las TRES tiendas (Nayoli incluida) nacen con el
  // crédito visible — es la única sección cuyo default beneficia a la plataforma antes que al cliente,
  // y por eso el apagado existe: un cliente que no lo quiera lo apaga desde el panel, sin tocar código.
  creditoDunaVisible: boolean;
}

// META de páginas: qué páginas del storefront están ENCENDIDAS. NO es una sección (no lleva `campos`
// ni la resuelve el loop de secciones); es una capacidad —una página existe y se puede apagar—. Hoy
// /nosotros y /suscripciones son CAPACIDADES apagables (la home no se apaga). `suscripciones`
// gatea la página + el link del nav + la entrada del footer + el CTA de la home (§ Backlog #49):
// una suscripción hoy es sólo un mensaje de WhatsApp, así que apagarla es config, no un modelo.
export interface PaginasContent {
  nosotros: { visible: boolean };
  suscripciones: { visible: boolean };
}

// META de TEMA: las 3 RAÍCES de paleta del storefront (fondo·tinta·acento). NO es una sección (no
// lleva `campos` ni la resuelve el loop de secciones); es la PIEL de TODO el storefront, ortogonal a
// las páginas —por eso vive como clave no-sección, gemela de `paginas`, y su editor va SOBRE el
// selector de página, no dentro—. `null` en una raíz = el storefront cae a los defaults de código
// (§ cssPaleta / palette-derive), que SON la paleta de Nayoli. El motor deriva las demás tintas de
// estas tres; acá sólo se guardan las raíces. (Se mudó de SiteSetting —modelo HARD, guardar=publicar
// al instante— a acá para ganar el flujo borrador/publicar; § doctrina, la frontera es de PANTALLA.)
export interface TemaContent {
  fondo: string | null;
  tinta: string | null;
  acento: string | null;
  // El PAR TIPOGRÁFICO del storefront (§ Tanda C2 · #3, `lib/config/fuentes`). `null` = Editorial (el
  // default: Inter/Playfair, las de hoy) — como las raíces en null = fábrica. Un valor CUSTOM
  // ('calido'|'moderno'|'clasico'|'nitido') hace que el layout inyecte cssFuentes + el `<link>` del par.
  fuentePar: ClaveFuentePar | null;
  // La PERSONALIDAD DE FORMA del storefront (§ eje 4, `lib/config/formas`). `null` = Suave (el default:
  // los radios de hoy, 1.5/1/0.75rem) — como `fuentePar` en null = Editorial. Un valor CUSTOM
  // ('recta'|'minima') hace que el layout inyecte cssForma (§ forma-style).
  forma: ClaveForma | null;
  // LOS DOS EJES ADITIVOS (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1, `EjesPaleta` en
  // `palette-derive.ts`). `null` = el comportamiento de HOY (texto/acento-texto nacen del acento;
  // la acción primaria pinta con `tostado`) — NINGÚN escritor real los pone hoy: no hay campo en
  // `paletaEditableSchema` ni en el editor del panel, así que para todo tenant existente y para
  // Nayoli quedan SIEMPRE `null`. Sólo `mergePresetEnContent` (`themes.ts`) los escribe, con el
  // valor del `PresetTema` aplicado — y de los 6 presets del catálogo, sólo CORTE los declara.
  origenTexto: OrigenTexto | null;
  origenAccion: OrigenAccion | null;
  // LA ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1, `lib/config/escala-display.ts`). `null` = el
  // comportamiento de HOY, byte a byte (cada titular de display sigue rindiendo su clase Tailwind
  // fija de siempre — 12 componentes distintos, ni una base compartida entre ellos, § el docstring
  // de `escala-display.ts` sobre por qué esto NO es una variable CSS `:root` con un solo default).
  // MISMA familia aditiva que `origenTexto`/`origenAccion`: sólo `mergePresetEnContent` (`themes.ts`)
  // lo escribe, con el valor del `PresetTema` aplicado — de los 6 presets del catálogo, sólo CORTE
  // declara `'amplia'`.
  escalaDisplay: ClaveEscalaDisplay | null;
}

// META de CROMO (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): los ejes de CHROME del nav/footer que hoy
// DERIVAN de `tratamientoNav`/el token de siempre, pero que un preset puede declarar distinto —
// misma familia ADITIVA que `origenTexto`/`origenAccion` (arriba): AUSENTE/`false`/`''` = el
// comportamiento de HOY, byte a byte. Va en su PROPIA meta, NO dentro de `tema`, a propósito:
// `guardarTemaBorrador`/`paletaEditableSchema` (`site-content-write.ts`/`palette-schema.ts` — los
// DOS fuera de `touches` de este slice) escriben `borrador.tema` con SÓLO 5 claves
// (fondo/tinta/acento/fuentePar/forma) y al PUBLICAR reemplazan `content.tema` ENTERO — si estos
// tres ejes vivieran ahí, el día que un operador guarde un color/fuente desde el panel de un
// tenant con preset CORTE, publicar el tema los resetearía en silencio a `false`/`''`. Como meta
// APARTE (nunca tocada por ese flujo), quedan seguros — dominio CERRADO (3 claves fijas), como
// `paginas`, no abierto como `esquemas`.
export interface CromoContent {
  // ¿El estado SÓLIDO del nav (al scrollear, o cuando la banda sobre la que flota no admite
  // transparencia) es `--sf-tinta` en vez de la tarjeta clara de siempre? (§ CORTE-NAV-TRANSPARENTE-
  // HERO-1, resemantizado — antes decía "banda SÓLIDA SIEMPRE, nunca transparente-flotante": esa
  // lectura medía mal el prototipo, cuyo `.site-header` SÍ flota transparente sobre el hero y sólo
  // cae a `--surface-inverse` al scrollear, § `.is-solid`, `css/app.css:172-191`). El floating en sí
  // lo sigue decidiendo `tratamientoNav` (§ esquema-style.ts) para CUALQUIER valor de este campo —
  // `navTinta` sólo cambia el COLOR del estado sólido. `false` = el `tratamientoNav` de HOY,
  // byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.navTinta`; de
  // los 6 presets del catálogo, sólo CORTE lo declara `true`.
  navTinta: boolean;
  // ¿El nav exhibe `SiteSetting.tagline` bajo el nombre (el sub-encabezado del wordmark, como el
  // `<small>` del prototipo)? `false` = HOY: el nav no muestra sub-encabezado (byte-idéntico) — el
  // FOOTER ya exhibe el tagline SIEMPRE, sin gate (`StoreFooter.tsx`, stacked), y este eje no lo
  // toca. Sólo `mergePresetEnContent` lo escribe.
  navSubtitulo: boolean;
  // El texto del badge junto al wordmark del nav («Cosecha 2026» en el prototipo, junto a su
  // primer `nav-item`). Vacío = no se renderiza (byte-idéntico). ES DATO DEL TENANT, no un año
  // horneado en el componente que lo pinta: CORTE lo declara como su valor de MUESTRARIO (medido
  // contra el prototipo); un tenant real cambiaría el texto por el suyo el día que este eje sea
  // editable desde el panel — hoy, como el resto de esta meta, sólo lo escribe el preset.
  navBadge: string;
}

// META de VOLVER ARRIBA (§ CROMO-VOLVER-ARRIBA-1) — GEMELA de `CromoContent` en INTENCIÓN (chrome
// del storefront que un preset puede encender, AUSENTE/`false` = el comportamiento de HOY, byte a
// byte) pero NO fusionada en `CromoContent`, a propósito: `cromo` ya es un dominio CERRADO de 3
// claves con un contrato EXHAUSTIVO afirmado por `cromo-tematizable.test.ts` (fuera de `touches` de
// este slice — no se le agrega una 4ª clave a mitad de tanda). Y hay una razón de FONDO, no sólo de
// alcance: `navTinta`/`navSubtitulo`/`navBadge` AJUSTAN un chrome que YA está SIEMPRE montado (el
// nav); esto decide si un COMPONENTE ENTERO se monta (`BackToTop.tsx`) — la misma distinción que ya
// separa `bandaOrigenVisible`/`bandaMarquesinaVisible` (encienden una banda ENTERA) de `navTinta`
// (ajusta una que ya existe). No puede vivir DENTRO de una sección existente como esos dos bandaX,
// porque "volver arriba" no es una banda del home (sin entrada en REGISTRY, sin competir por
// posición en `orden`) — así que, como `bandaOrigenVisible`, necesita su propio lugar; a diferencia
// de esos dos, ese lugar es una meta nueva, no un campo `visible` de una sección ya declarada.
export interface VolverArribaContent {
  // ¿Se monta el botón flotante "volver arriba" (gemelo del `.to-top` del prototipo,
  // `docs/prototipos/cafeone/css/app.css:340-353`)? `false` = HOY: el storefront no tiene este
  // chrome — `BackToTop.tsx` (`components/storefront/`) rinde `null`, byte-idéntico. Lo escribe
  // `mergePresetEnContent` (`themes.ts`, con `preset.volverArribaVisible` — de los 6 presets del
  // catálogo, sólo CORTE lo declara `true`) Y el dueño, desde el panel (§ PANEL-DETALLES-SITIO-1,
  // `DetallesSitioSeccion.tsx`, sección "Detalles del sitio").
  visible: boolean;
}

// META de RIEL SOCIAL (§ CROMO-RIEL-SOCIAL-1) — MISMA forma y MISMO porqué que `VolverArribaContent`
// (arriba): chrome que un preset puede encender, AUSENTE/`false` = el comportamiento de HOY, byte a
// byte (el storefront no tiene riel social — sólo links en el footer), y NO fusionada en `cromo`
// (dominio CERRADO de 3 claves con contrato EXHAUSTIVO afirmado por `cromo-tematizable.test.ts`,
// fuera de `touches:` de este slice) ni en `VolverArribaContent` (dominio cerrado de 1 clave con SU
// PROPIO contrato, gemelo de `cromo` en forma — sumarle una 2ª clave lo convertiría en la meta
// compartida que `VolverArribaContent` explícitamente se negó a ser). Decide si un COMPONENTE ENTERO
// se monta (`RielSocial.tsx`), la misma naturaleza que `volverArriba`, no un ajuste de un chrome ya
// montado — así que necesita su propio lugar, meta nueva, no un campo de otra meta ya declarada.
export interface RielSocialContent {
  // ¿Se monta el riel social fijo a la izquierda (gemelo del `.rail` del prototipo,
  // `docs/prototipos/cafeone/css/app.css:326-338`)? `false` = HOY: el storefront no tiene este
  // chrome — `RielSocial.tsx` (`components/storefront/`) rinde `null`, byte-idéntico. Lo escribe
  // `mergePresetEnContent` (`themes.ts`, con `preset.rielSocialVisible` — de los 6 presets del
  // catálogo, sólo CORTE lo declara `true`) Y el dueño, desde el panel (§ PANEL-DETALLES-SITIO-1,
  // `DetallesSitioSeccion.tsx`, sección "Detalles del sitio"). Los DOS links del riel (instagram/whatsapp)
  // NO son parte de esta meta — salen de `SiteSetting` (la MISMA fuente única que ya usa
  // `StoreFooter`), cada uno oculto cuando su campo está vacío; esta meta sólo decide si el RIEL
  // como composición existe, no qué contiene.
  visible: boolean;
}

// META de BARRA DE ENVÍO GRATIS DEL CARRITO (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1) — MISMA forma y
// MISMO porqué que `VolverArribaContent`/`RielSocialContent` (arriba): chrome que un preset puede
// encender, AUSENTE/`false` = el comportamiento de HOY, byte a byte (el carrito muestra sólo la
// frase condicional "Envío gratis en pedidos mayores a $X", `CartDrawer.tsx`), y NO fusionada en
// `cromo` (dominio CERRADO de 3 claves con contrato EXHAUSTIVO afirmado por
// `cromo-tematizable.test.ts`, fuera de `touches:` de este slice) ni en `VolverArribaContent`/
// `RielSocialContent` (cada uno dominio CERRADO propio de 1 clave, MISMA razón que esos dos entre
// sí: sumarle una 2ª clave los convertiría en la meta compartida que ambos se negaron a ser).
// A DIFERENCIA de `volverArriba`/`rielSocial` (que deciden si un COMPONENTE ENTERO se monta), ésta
// decide entre DOS PRESENTACIONES de un elemento que YA está SIEMPRE montado (el pie del carrito) —
// la misma distinción de naturaleza que separa `navTinta` (ajusta un chrome ya montado) de
// `bandaOrigenVisible` (enciende una banda entera) — pero, igual que esos dos ejes de encendido, no
// tiene sección del REGISTRY donde vivir (el carrito no es contenido de `SiteContentData`), así que
// necesita su propio lugar: una meta nueva, no un campo de otra ya declarada.
export interface CarritoEnvioContent {
  // ¿El pie del carrito rinde la BARRA DE PROGRESO visual hacia el envío gratis (gemela de
  // `.ship-prog`/`.ship-bar` del muestrario, `docs/prototipos/cafeone/index.html:409-411`,
  // `css/app.css:731-736`, `js/app.js:398-405`: mensaje dinámico + una barra que se llena según
  // `subtotal/freeShippingThreshold`, "Tienes envío gratis" al llegar al 100%)? `false` = HOY: el
  // carrito muestra sólo la frase condicional de siempre cuando falta para el umbral, y nada cuando
  // ya se alcanzó — byte-idéntico (`CartDrawer.tsx`, la rama `FraseEnvioGratis`). Lo escribe
  // `mergePresetEnContent` (`themes.ts`, con `preset.carritoEnvioVisible` — de los 6 presets del
  // catálogo, sólo CORTE lo declara `true`) Y el dueño, desde el panel (§ PANEL-DETALLES-SITIO-1,
  // `DetallesSitioSeccion.tsx`, sección "Detalles del sitio").
  visible: boolean;
}

// META de TRATAMIENTO TIPOGRÁFICO DEL NAV (§ CROMO-NAV-TRATAMIENTO-1) — MISMA forma y MISMO porqué
// que `VolverArribaContent`/`RielSocialContent` (arriba): AUSENTE/`false` = el comportamiento de
// HOY, byte a byte. NO fusionada en `CromoContent` a pesar de ser, en NATURALEZA, la misma familia
// que `navTinta`/`navSubtitulo`/`navBadge` —AJUSTA un chrome que YA está SIEMPRE montado (el nav),
// no decide si un componente entero se monta (a diferencia de `volverArriba`/`rielSocial`)—: se
// midió la consecuencia de sumarle una 4ª clave a `cromo` contra el árbol completo, no sólo contra
// este archivo, y `lib/config/cromo-tematizable.test.ts` (FUERA de `touches:` de este slice) afirma
// la forma EXHAUSTIVA de `cromo` con `assert.deepEqual` contra literales de 3 claves —en
// COMPILACIÓN (falta la propiedad del tipo en `CROMO_HOY: CromoContent = {...}`) antes incluso de
// llegar a un `assert` en runtime—. Ampliar ese archivo para que acepte una 4ª clave habría sido la
// ampliación de alcance no autorizada que el protocolo de este slice prohíbe hacer por cuenta
// propia (mismo razonamiento, palabra por palabra, que ya cerró `CROMO-VOLVER-ARRIBA-1` y
// `CROMO-RIEL-SOCIAL-1` sobre esta MISMA restricción — ver sus asientos en `DECISIONS.md`). Por eso
// esta meta es NUEVA y PROPIA, no un 4º campo de `cromo`, aunque conceptualmente "quisiera" vivir
// ahí: es una decisión de ALCANCE, no de dominio.
//
// NO CONFUNDIR con la función `tratamientoNav` (`lib/config/esquema-style.ts`): esa decide si el
// nav FLOTA transparente sobre la banda y de qué color va su texto (un eje de POSICIÓN/CONTRASTE,
// calculado en cada render). Esto es un eje TIPOGRÁFICO declarado por el PRESET —mayúscula +
// tracking del prototipo + un peso, sobre la MISMA sans del par (§ `PresetTema.navTratamientoActivo`,
// `themes.ts`)— que no interactúa con aquélla.
export interface NavTratamientoContent {
  // ¿Los links del nav llevan el tratamiento tipográfico del `.nav-link` del prototipo (mayúscula +
  // `letter-spacing:var(--tracking-nav)` = `.06em` + peso regular, MEDIDO contra
  // `docs/prototipos/cafeone/css/app.css:212-217`/`tokens.css:129` — el prototipo no declara
  // `font-weight` en `.nav-link`, así que hereda el 400/regular del `body`, § el asiento de este
  // slice)? `false` = HOY: los links del nav van `text-sm font-medium`, sin mayúscula ni tracking,
  // byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con
  // `preset.navTratamientoActivo`; de los 6 presets del catálogo, sólo CORTE lo declara `true`.
  activo: boolean;
  // ¿El encabezado gana COMPORTAMIENTO POR DIRECCIÓN de scroll (§ CROMO-NAV-DIRECCION-SCROLL-1)?
  // Bajando se oculta (translateY fuera de vista); subiendo reaparece; y "arriba del todo" (bajo
  // `UMBRAL_OCULTAR_NAV`, § `lib/animation.ts`) sigue el tratamiento de HOY sin importar la
  // dirección — el eje MEDIDO contra el tema real (`xo-sticky`, no el prototipo local, que no
  // implementa esto; ver el docstring de cabecera de `lib/animation.ts`). Se agregó como CAMPO de
  // ESTA meta —no una meta nueva— a propósito: es el mismo dominio "ajustes de encabezado ya
  // montado" que `activo` (arriba), y las dos comparten ruta de publicar/descartar
  // (`/api/site-content/encabezado`) y su control en `EncabezadoSeccion.tsx` — sumar un campo acá es
  // MENOS superficie que abrir una 11ª clave no-sección (`METAS_CON_CAMPOS`, `SeccionKey`, un nuevo
  // resolver, una nueva ruta) para un eje que vive en el MISMO lugar del panel. NO es el mismo
  // ELEMENTO que `activo` (aquél trata los LINKS del `.nav-link`; éste el `<header>` entero) — pero
  // sí el mismo NIVEL de decisión ("un ajuste más del encabezado"), a diferencia de `NavWordmarkContent`
  // (otro elemento, el wordmark, con SU PROPIO contrato exhaustivo en `corte-logo-apilado.test.ts`,
  // fuera de `touches:` de este slice — extenderlo ahí habría roto ese test sin poder arreglarlo).
  // `false` = HOY: el nav no reacciona a la dirección del scroll, byte-idéntico. Sólo
  // `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.navTratamientoDireccion`; de los 6
  // presets del catálogo, sólo CORTE lo declara `true`.
  direccion: boolean;
  // ¿El encabezado gana un FILETE INFERIOR — una línea fina que lo separa del contenido — como el
  // del tema real (§ CROMO-NAV-FILETE-1)? MEDIDO contra el tema real
  // (`x-cafeone.myshopify.com`, `.xo-header__content`, `bdb:s1 bdbc:foreground.2`): el borde vive en
  // el CONTENEDOR DE CONTENIDO del header (`<xo-container><div class="xo-header__content"
  // bdb:s1…">`), NO en la barra de ancho completo (`.xo-header`/`.xo-header__inner`, que declaran
  // `bdrs:s0 bd:s0` — CERO borde explícito) — por eso el filete real no llega a los bordes de la
  // pantalla: hereda el mismo margen lateral de página que ya alinea el contenido del encabezado, no
  // un inset propio. `bdb:s1` es la unidad NO-CERO más chica de su escala de bordes (equivalente al
  // `border-b` de 1px de Tailwind — el mismo hairline que ya usa `border-[var(--sf-sobre)]/20` en
  // este archivo, § abajo); `bdbc:foreground.2` es el PROPIO primer plano del encabezado —el mismo
  // token que ya decide `navClaro` para texto/íconos, no un color de borde aparte— a **opacidad
  // reducida (20%)**. Las DOS clases de borde NO llevan el sufijo condicional `/xo-is-sticky` que sí
  // llevan `pl`/`pr` en la misma cadena de clases del tema real, así que el filete se ve en LOS DOS
  // tratamientos del nav (flotando transparente sobre el hero Y sólido al hacer scroll) — no cambia
  // con `scrolled`, y por eso el resolver no necesita un segundo campo para eso. `false` = HOY: sin
  // filete, byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con
  // `preset.navTratamientoFilete`; de los 6 presets del catálogo, sólo CORTE lo declara `true`.
  filete: boolean;
  // ¿El CTA COMPRAR del menú (`.btn.btn--primary.btn--sm` del prototipo,
  // `docs/prototipos/cafeone/css/app.css:123-136`) y el badge de un ítem de menú (`.badge`,
  // `app.css:151-157`) toman la forma/color medidos, y el CTA se muda al FINAL del encabezado
  // (`docs/prototipos/cafeone/index.html:39-53`, `.header-actions`: locale·búsqueda·cuenta·carrito·
  // COMPRAR·hamburguesa — después del carrito, no antes de buscar/carrito como HOY)? CUARTO CAMPO de
  // la MISMA meta (§ CROMO-NAV-CTA-Y-BADGE-1) — mismo dominio "un ajuste más del encabezado" que
  // `activo`/`direccion`/`filete`, y misma ruta/control (`/api/site-content/encabezado`,
  // `EncabezadoSeccion.tsx`). Gobierna DOS elementos —el CTA `ctaHref` y el badge del ítem de menú
  // (`badgeSpan`, `StoreNav.tsx`)— porque los dos se MIDIERON JUNTOS contra el mismo prototipo, en el
  // mismo commit; no es el mismo criterio de `NavWordmarkContent` (un elemento propio con su propio
  // contrato) porque acá no hay un segundo contrato exhaustivo que romper.
  //
  // `false` = HOY: el CTA es una pastilla translúcida (`rounded-full`, `bg-[var(--sf-acento)]/10` o
  // `bg-[var(--sf-sobre)]/10` según `navClaro`) ubicada ANTES de buscar/carrito, dentro del `<nav>`
  // desktop (oculta bajo `lg`); el badge es oscuro translúcido (`bg-[var(--sf-tinta)]/5`) o claro
  // translúcido (`bg-[var(--sf-sobre)]/10`) según `navClaro` — byte-idéntico.
  //
  // `true` (sólo CORTE): el CTA pasa a botón SÓLIDO — fondo `--sf-acento` (= EXACTO `--action-primary`
  // para CORTE, `themes.ts`), texto `--sf-acento-txt` (= `--text-on-accent`), radio de BOTÓN vía
  // `.sf-pildora` (que para la forma `'recta'` de CORTE ya vale `0` = `--radius-button`, § formas.ts —
  // no un radio nuevo), mayúscula + tracking `.085em` (= `--tracking-button`) + peso 600 (=
  // `--weight-semibold`) por CSS (el texto sigue siendo el DATO de `menu.ctaLabel`, sin reescribirlo).
  // Hover/active DERIVADOS del mismo acento, sin hex nuevo: `--sf-acento-3` (hover, =
  // `mezclar(acento, tinta, 0.41)`) y `--sf-acento-2` (active, `mezclar(acento, tinta, 0.64)` — más
  // mezclado = más oscuro, el mismo sentido que `--action-primary-hover`/`-active` del prototipo) +
  // `translateY(1px)` al presionar. El badge pasa a FIJO (ya no depende de `navClaro`): fondo
  // `--sf-tostado`, texto `--sf-tinta` — el MISMO par que ya usan `Spotlight.badge`/`product.badge`
  // en este repo (no un rol nuevo), porque `--accent-sale` del prototipo no tiene raíz propia en
  // nuestro modelo de 3 raíces y `tostado` es la mezcla cálida-y-clara del acento que ya cumple ese
  // papel en todo el storefront — ver el asiento de `CROMO-NAV-CTA-Y-BADGE-1` (`DECISIONS.md`) para
  // los contrastes medidos. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con
  // `preset.navTratamientoCta`; de los 6 presets del catálogo, sólo CORTE lo declara `true`.
  cta: boolean;
  // ¿El contenedor de contenido del encabezado (`.max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` de HOY,
  // `StoreNav.tsx`) toma la GEOMETRÍA del PROTOTIPO LOCAL (§ CROMO-NAV-EXACTO-PROTOTIPO-1, que
  // REEMPLAZA la medición contra el tema real de § CROMO-NAV-POSICION-TEMA-REAL-1 — ver la
  // corrección abajo) — más ancho, con el mismo margen lateral por breakpoint que ya alinea el
  // wordmark/CTA, y con ALTURA FIJA (no relleno) que crece por breakpoint? QUINTO CAMPO de la MISMA
  // meta (mismo dominio "un ajuste más del encabezado" que `activo`/`direccion`/`filete`/`cta`,
  // misma ruta/control).
  //
  // LA CORRECCIÓN (§ CROMO-NAV-EXACTO-PROTOTIPO-1, 2026-09-28): `CROMO-NAV-POSICION-TEMA-REAL-1`
  // midió esto contra el TEMA REAL (`x-cafeone.myshopify.com`) razonando que el prototipo local
  // "diverge en los números exactos" y por eso no servía de referencia. El gate visual del owner
  // sobre ese resultado («la ubicación de los elementos del nav aún no es como la del muestrario…
  // ya llevamos varias pasadas en eso») estableció el hecho que haría falta para esta reescritura:
  // **la referencia que el owner compara, pasada tras pasada, es el PROTOTIPO LOCAL versionado
  // (`docs/prototipos/cafeone/`), no el tema real** — un sitio vivo de terceros que puede cambiar
  // sin aviso y que nadie tiene abierto al lado para comparar. Medir contra el tema real producía
  // una geometría que se PARECE a la del prototipo pero no COINCIDE con ella (1800px vs 1440px de
  // ancho máximo; relleno vertical variable vs una altura FIJA con `align-items:center`), y esa
  // diferencia es justo lo que el gate reportó como "siguen estando más arriba" — con relleno en vez
  // de altura fija, la fila calculaba más corta que los 118/88/76px reales del prototipo, así que el
  // contenido quedaba más cerca del techo del encabezado de lo que el muestrario muestra.
  //
  // MEDIDO contra `docs/prototipos/cafeone/css/tokens.css:150,151,157` (`--header-height:118px`,
  // `--page-gutter:32px`, `--content-max:1440px`) y `app.css:193-198` (`.header-bar{height:var(
  // --header-height);display:flex;align-items:center;…max-width:var(--content-max);margin-inline:
  // auto;padding-inline:var(--page-gutter)}`) — UNA ALTURA FIJA, centrada por flex, no relleno. Los
  // DOS breakpoints que reescriben esos tokens (`app.css:971-972`, `997-998`): bajo 1200px,
  // `--header-height:88px;--page-gutter:24px`; bajo 640px, `--header-height:76px;--page-gutter:
  // 18px`. 640px coincide con el breakpoint `sm` de Tailwind (min-width:640px); 1200px no coincide
  // con ninguno de los nuestros (`lg`=1024, `xl`=1280) y gana su PROPIO breakpoint con nombre,
  // `--breakpoint-cortenav:1200px` (`app/globals.css`, MISMO patrón que `--breakpoint-duna:960px`
  // del admin — nombra al EJE que es dueño del número, no a la app).
  //
  // `false` = HOY: `max-w-6xl` (1152px) + `px-4 sm:px-6 lg:px-8` (16/24/32px responsivo) + altura FIJA
  // `h-16 lg:h-18` (64/72px, con `items-center`) — byte-idéntico. `true` (sólo CORTE): `max-w-[1440px]`
  // (`--content-max` EXACTO del prototipo) + `px-[18px] sm:px-6 cortenav:px-8` (18/24/32px, los TRES
  // valores de `--page-gutter` medidos, mobile-first) en el contenedor de contenido; y en la fila
  // flex, `h-[76px] sm:h-[88px] cortenav:h-[118px]` (los TRES valores de `--header-height` medidos)
  // EN VEZ de relleno — la altura es FIJA y crece por breakpoint, como en el prototipo, en vez de
  // derivarse del contenido. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con
  // `preset.navTratamientoPosicion`; de los 6 presets del catálogo, sólo CORTE lo declara `true`.
  posicion: boolean;
  // ¿Los links del nav ganan el SUBRAYADO al pasar el mouse (`.nav-link::after` del prototipo,
  // `docs/prototipos/cafeone/css/app.css:219-224`) — una línea de 1px en el color del propio texto
  // que se DIBUJA desde la izquierda con una transición, y que queda visible también en el ítem cuyo
  // panel desplegable está abierto? SEXTO CAMPO de la MISMA meta (§ CROMO-NAV-EXACTO-PROTOTIPO-1,
  // mismo dominio "un ajuste más del encabezado" que `activo`/`direccion`/`filete`/`cta`/`posicion`,
  // misma ruta/control). Es un elemento NUEVO del `.nav-link` que ningún campo anterior cubría:
  // `activo` sólo trata su TIPOGRAFÍA (mayúscula/tracking/peso, § arriba); esto trata su conducta al
  // HOVER — el gate visual del owner lo pidió aparte: «El nav del muestrario también tiene un efecto
  // al hacer hover sobre los elementos del mismo, que nuestro nav no tiene.»
  //
  // MEDIDO contra `docs/prototipos/cafeone/css/app.css:219-224`: `.nav-link::after{content:"";
  // position:absolute;left:0;right:0;bottom:0;height:1px;background:currentColor;transform:scaleX(0);
  // transform-origin:left;transition:transform var(--duration-base) var(--ease-out)}
  // .nav-link:hover::after,.nav-item.is-open .nav-link::after{transform:scaleX(1)}` —
  // `--duration-base` = 220ms (`tokens.css:192`), `--ease-out` = `cubic-bezier(.22,.61,.36,1)`
  // (`tokens.css:189`, la MISMA curva que ya usa `ENTRADA_ESCALONADA_DRAWER` en `StoreNav.tsx`, sin
  // inventar una segunda). `prefers-reduced-motion`: el subrayado aparece SIN animar — cubierto por
  // el guard GLOBAL de `app/globals.css` (`*,*::before,*::after{transition-duration:0.01ms
  // !important}` bajo esa media query), sin un guard propio.
  //
  // `false` = HOY: sin subrayado, byte-idéntico. `true` (sólo CORTE): `after:absolute after:inset-x-0
  // after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current
  // after:transition-transform after:duration-[220ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]
  // hover:after:scale-x-100` en cada link, más `after:scale-x-100` fijo en el trigger del panel
  // mientras `abierto` (el equivalente de `.nav-item.is-open`). Sólo `mergePresetEnContent`
  // (`themes.ts`) lo escribe, con `preset.navTratamientoSubrayado`; de los 6 presets del catálogo,
  // sólo CORTE lo declara `true`.
  subrayado: boolean;
  // ¿El fondo del badge FIJO (§ `cta`, arriba) usa un hex PROPIO en vez de `--sf-tostado`
  // (§ RIEL-SCROLL-Y-BADGE-DORADO-1)? `cta` ya decidió que el badge se pinta con `tostado` —"la
  // mezcla cálida-y-clara del acento que ya cumple ese papel"— por no tener `--accent-sale` del
  // prototipo una raíz propia en nuestro modelo de 3 raíces. El owner vio el resultado y reportó
  // que no lucía "tan dorado": MEDIDO, `tostado` para CORTE da `#d8a378` y el `--accent-sale` real
  // del prototipo es `#f5b36a` (`docs/prototipos/cafeone/css/tokens.css:83`) — ninguna combinación
  // de las 3 raíces con los pesos ya catalogados en `RECETA` (`palette-derive.ts`) da ese hex, así
  // que esta vez sí hace falta un hex propio. `null` (el default) = sigue pintando con `tostado`,
  // byte a byte — `StoreNav`/`ProductCard`/`Spotlight` (§ el censo de consumidores, DECISIONS.md)
  // sólo aplican un `style` inline de `backgroundColor` cuando este campo NO es `null`; con `null`
  // no aplican ningún `style` y la clase Tailwind `bg-[var(--sf-tostado)]` de siempre gobierna sin
  // cambio. Hex de 6 dígitos validado por `resolverNavTratamiento` (§ abajo), o `null`. Sólo
  // `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.navTratamientoBadgeColor`; de los
  // 6 presets del catálogo, sólo CORTE lo declara (`#f5b36a`).
  badgeColor: string | null;
  // ¿El ícono de buscar aparece en la barra del encabezado cuando el nav está en ancho de TELÉFONO
  // (§ NAV-MOVIL-SIN-BUSCAR-1)? `true` = HOY: se muestra, byte-idéntico — a diferencia de los SIETE
  // campos de arriba (todos `false`=HOY, un eje que sólo CORTE enciende vía preset), ÉSTE nace
  // `true` para TODO tenant: no es un eje de preset, es una preferencia por-tienda que el dueño
  // apaga desde el panel para dar aire al nombre cuando el encabezado se siente apretado (gate del
  // owner, 2026-10-01, viendo la demo de Café Las Chamisas en el teléfono).
  //
  // `false` SÓLO TIENE EFECTO bajo `navDrawerMovil.variante==='pantallaCompleta'` — comprobado por
  // EJECUCIÓN, no asumido: ese drawer trae su PROPIA cabecera con buscar/carrito/cerrar (§
  // MENU-MOVIL-COMO-CAFEONE-1, `StoreNav.tsx`, el botón `aria-label="Buscar"` de la rama
  // `pantallaCompleta`), así que apagar el de la barra deja al visitante con una vía de búsqueda
  // intacta dentro del menú. El `'dropdown'` de HOY (los otros 5 presets del catálogo) NO trae
  // buscar en su panel — medido leyendo esa rama del componente, cero búsqueda ahí—, así que
  // `StoreNav.tsx` IGNORA este campo fuera de `pantallaCompleta`: el ícono de la barra sigue
  // mostrándose siempre para esos tenants, aunque el dueño lo apague (el switch del panel se oculta
  // en ese caso, § `EncabezadoSeccion.tsx`, para no ofrecer un control que no tiene adónde apuntar).
  // En ESCRITORIO nunca se oculta, en ningún caso: el eje es `<lg` únicamente (el breakpoint del
  // propio `<nav>`/hamburguesa de este archivo).
  //
  // CONTROL: vive ANIDADO bajo el switch "Drawer móvil de pantalla completa"
  // (`EncabezadoSeccion.tsx`), nunca suelto en la lista de interruptores — mismo patrón que
  // `badgeColor` anidado bajo `cta`, arriba: su efecto depende por completo del switch que lo
  // gobierna.
  //
  // HUECO CONOCIDO, MEDIDO (no sólo teórico), fuera de `touches:` de este slice:
  // `mergePresetEnContent` (`themes.ts`) reconstruye `navTratamiento` entero por campo y NO incluye
  // éste, así que su salida CRUDA queda sin la clave (`undefined`, no `false`/`true`). Dos caminos
  // consumen esa salida, con consecuencia DISTINTA:
  //   - `aplicarPreset` (onboarding, `prisma/aplicar-preset.ts`, manual y con confirmación explícita
  //     del nombre del tenant) PERSISTE esa salida cruda, pero todo READ posterior pasa de nuevo por
  //     `resolverSiteContent`/`resolverNavTratamiento`, cuyo `bool()` cae al DEFAULT (`true`) ante la
  //     ausencia — confirmado contra Postgres real, § `panel-encabezado.test.ts`, "default del
  //     preset". Sólo se pierde la elección del dueño si `aplicarPreset` se vuelve a correr SOBRE un
  //     tenant que ya la había personalizado a mano (caso raro, operación manual).
  //   - el MIRADOR de preview `?tema=CLAVE` (`theme-mirador.ts`, `contenidoConPresetDeVista`,
  //     gateado a `esDespliegueDemo()`) NO vuelve a resolver: pasa la salida cruda directo al
  //     storefront. Ahí `buscarMovil` SÍ llega `undefined` a `StoreNav.tsx`, y `!undefined` evalúa
  //     `true` — bajo `navDrawerMovil.variante==='pantallaCompleta'` (que el mirador de CORTE SÍ
  //     fuerza), el buscar de la barra se vería OCULTO en la vista previa aunque el tenant real lo
  //     tenga en `true` (mostrado). Confirmado por ejecución, § `nav-internas.test.ts`, "HUECO
  //     MEDIDO". Acotado al preview de demo; no afecta lo que un visitante real ve.
  buscarMovil: boolean;
}

// META de TRATAMIENTO DEL WORDMARK APILADO (§ CORTE-LOGO-APILADO-1) — MISMA forma y MISMO porqué que
// `NavTratamientoContent` (arriba): AUSENTE/`false` = el comportamiento de HOY, byte a byte. NO se
// fusiona con `NavTratamientoContent` a pesar de sonar a la misma familia ("tratamiento del nav"):
// `NavTratamientoContent.activo` es un eje NARROW, ya CERRADO y afirmado por
// `cromo-nav-tratamiento.test.ts` (FUERA de `touches:` de este slice) como "¿los LINKS del nav llevan
// mayúscula+tracking+peso?" — un elemento del DOM distinto (`.nav-link`), con sus PROPIOS valores
// medidos (`.06em`, sans del par). El wordmark apilado (`.wordmark`/`.wordmark small` del prototipo,
// `docs/prototipos/cafeone/css/app.css:199-207`) es OTRO elemento con SUS PROPIOS valores medidos
// (`.01em` en el nombre, `.11em` en el sub, el sub en SANS sin itálica) — reusar `activo` de
// `NavTratamientoContent` para las dos cosas habría hecho que un preset futuro que quisiera SÓLO uno
// de los dos ejes no pudiera, y habría obligado a re-redactar el docstring/test ya cerrados de ESE
// eje para que dijeran algo que no midieron. Meta NUEVA y PROPIA, no un 2º campo de `navTratamiento`.
// El set CERRADO de `NavWordmarkContent.taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1) — ver su
// docstring, abajo, para el porqué completo de los dos valores y de la medición que los respalda.
export type ColorTagline = 'atenuado' | 'acento';

export interface NavWordmarkContent {
  // ¿El wordmark apilado del nav (nombre + sub-encabezado, rama `subtitle` de `Logo.tsx` — el apilado
  // YA EXISTE, gateado por `cromo.navSubtitulo`; esto es sólo el ESTILO) calza el `.wordmark`/
  // `.wordmark small` del prototipo? MEDIDO contra `docs/prototipos/cafeone/css/app.css:199-207`: el
  // NOMBRE gana mayúscula + `letter-spacing:.01em` + tamaño mayor (30px, el prototipo), en la MISMA
  // fuente de título (serif) que ya usa; el SUB pasa de `font-display` itálico `--sf-tostado-5` a la
  // SANS del cuerpo (`.font-inter`, = `--font-ui` del prototipo), muted, `letter-spacing:.11em`
  // (`--tracking-eyebrow`), `margin-top:4px`, peso regular, SIN itálica. `false` = HOY: el nombre va
  // `font-display text-[22px]` sin mayúscula ni tracking, y el sub `font-display text-[11px] italic
  // text-[var(--sf-tostado-5)]` — byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo
  // escribe, con `preset.navWordmarkActivo`; de los 6 presets del catálogo, sólo CORTE lo declara
  // `true`.
  activo: boolean;
  // EL COLOR DEL TAGLINE APILADO (§ NAV-LOGO-MOVIL-CON-AIRE-1) — campo PROPIO, no un ajuste de
  // `activo`: un tenant puede querer el tratamiento apilado (`activo:true`) con el tagline en SU
  // color de siempre, y otro puede querer el dorado sin tocar el resto del tratamiento — son ejes
  // independientes, aunque el segundo sólo tenga efecto visible junto al primero (sin tagline no
  // hay nada que colorear, § `BloqueNombreTagline`: la rama `subtitle` ausente no renderiza el sub).
  //
  // `'atenuado'` (default) = el comportamiento de SIEMPRE: tratado → `${wordmark}/60` (atenuado al
  // color del nombre); sin tratar → `--sf-tostado-5` (el literal de hoy, sin cambio). `'acento'` =
  // el tono DORADO que la primera versión de `logoYNombre` mostraba antes de § NAV-LOGO-Y-NOMBRE-
  // AJUSTE-1 (`--sf-tostado-5`, SIN la itálica que esa versión también traía — el pedido del owner
  // es el color, no volver al tratamiento viejo) — PERO sólo donde ese literal PASA el piso de
  // 4.5:1 a 11px: MEDIDO contra la paleta REAL de CORTE (`derivarPaleta({fondo:'#fdfbf7',
  // tinta:'#102407', acento:'#a70004'}, {origenTexto:'tinta', origenAccion:'acento'})` — LOS DOS
  // ejes que CORTE declara, `themes.ts:1048,1050`; `.scratch/medir-tagline-acento-2.ts`, no parte
  // del producto — la PRIMERA medición, sin pasar `ejes`, dio un número que ESTE preset nunca usa,
  // § la corrección abajo): `tostado-5` da **6.26:1** contra `tinta` (el nav FLOTANDO sobre el hero
  // oscuro, `variant:'dark'`) — pasa, se usa tal cual — pero **2.54:1** contra `fondo`/`tarjeta` (el
  // nav SÓLIDO claro, `variant:'light'`) — falla, y ahí `colorTaglineAcento` (marca-logo.ts) cae al
  // par "texto sobre" que el motor de paleta YA ofrece para ese fondo: `--sf-acento-texto` — que
  // para CORTE, con `origenTexto:'tinta'`, resuelve LITERAL a `tinta` (`#102407`, § la rama de
  // `derivarPaleta` que ese eje activa) — **15.90:1** medido contra `fondo` (16.44:1 contra
  // `tarjeta`). El MISMO par que `colorActivo` (`StoreNav.tsx`, § NAV-LINK-ACTIVO-INVISIBLE-1) ya
  // usa para este MISMO problema (un literal decorativo del nav que no pasa contraste en una de las
  // dos superficies donde el header puede aparecer), no un segundo literal inventado.
  //
  // LA CORRECCIÓN QUE QUEDA ESCRITA: la PRIMERA medición (`.scratch/medir-tagline-acento.ts`) llamó
  // `derivarPaleta(raices)` SIN el segundo argumento — por default `{}`, "ningún eje declarado" —, y
  // esa versión da `acento-texto` = `#a70004` (7.68:1 contra fondo), un número que CORTE JAMÁS
  // produce en el storefront real (`cssPaleta`, invocado desde `app/(storefront)/layout.tsx`, SÍ
  // pasa los ejes de `content.tema`). El error se detectó por EJECUCIÓN —el harness de Cierre de
  // este slice (`.scratch/nav-logo-movil-con-aire-cierre.ts`) midió el color COMPUTADO real en el
  // navegador y no coincidía con la cifra documentada—, no por lectura. El NÚMERO que sobrevive es
  // el de arriba (15.90:1); la CONCLUSIÓN (pasa el piso, igual que antes) no cambió.
  //
  // LA GARANTÍA NO DEPENDE DE CORTE NI DE SUS EJES: `acento-texto` es SIEMPRE
  // `pisoContraste(…, fondo, 4.5)` (§ `derivarPaleta`, palette-derive.ts) — por CONSTRUCCIÓN pasa
  // ≥4.5:1 contra `fondo` para CUALQUIER raíz/eje que un tenant declare, aunque el hex exacto
  // cambie (CORTE da tinta por `origenTexto:'tinta'`; un preset sin ese eje daría el acento
  // floreado, ~7.68:1 en los mismos tres hex). El 15.90:1 de arriba es la medición de ESTE preset,
  // no el único valor posible — el fallback es seguro en general, no por coincidencia de CORTE.
  //
  // EXENCIÓN TEMPORAL (§ panel-controles.ts, PENDIENTE_PANEL): sin control en el panel todavía —
  // "cómo se ofrecen colores en el editor" es un diseño pendiente, no el de este slice. Y por lo
  // mismo, **`EncabezadoSeccion.tsx` (fuera de `touches:` de este slice) NO reenvía este campo en su
  // `wireDe`** — a diferencia de `cromo.navBadge` (que SÍ sobrevive a un guardado no relacionado
  // porque el componente lo lee a un ref y lo reenvía sin editarlo, mismo riesgo que documenta su
  // propio docstring) — así que HOY, publicar el Encabezado desde el panel por CUALQUIER otro motivo
  // (un switch cualquiera) sobreescribe `navWordmark` ENTERO con `{activo}` y VUELVE este campo a
  // `'atenuado'` en silencio. Es el MISMO modo de falla que `guardarTemaBorrador`/`fusionarTema` ya
  // cerró para los ejes aditivos de `tema` (§ ese docstring) — la misma clase de arreglo (reenvío
  // explícito, o un merge por-campo en vez de reemplazo por-clave) lo cierra acá, en el slice que
  // construya su editor (`cierra`, abajo). Hasta entonces, el campo es DATO que el owner pone una
  // vez por fuera del panel (operación directa, § el asiento de este slice) y que una visita
  // cualquiera al Encabezado puede revertir sin avisar.
  //
  // MISMO HUECO, por la MISMA razón, en `mergePresetEnContent` (`themes.ts`, también fuera de
  // `touches:`): `out.navWordmark = {activo: ...}` reconstruye el objeto SIN leer este campo, así
  // que un `aplicarPreset` sobre un tenant que ya lo tenía en `'acento'` también lo revertiría —
  // EXACTAMENTE el hueco ya documentado y aceptado para `navTratamiento.buscarMovil` (§ su propio
  // docstring: "ningún preset lo declara... nace `true` para TODO tenant"), no uno nuevo que este
  // campo introduzca.
  taglineColor: ColorTagline;
}

// El set CERRADO de composiciones del drawer móvil (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1).
export type ClaveDrawerMovil = 'dropdown' | 'pantallaCompleta';

// META de VARIANTE DEL DRAWER MÓVIL (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1) — MISMA forma que
// `NavTratamientoContent`/`NavWordmarkContent` (arriba): AUSENTE/`'dropdown'` = el comportamiento de
// HOY, byte a byte. Meta PROPIA, NO un booleano: a diferencia de esos dos ejes (encendido/apagado de
// un ajuste sobre un elemento que YA existe en su forma de hoy), acá las DOS composiciones son
// FORMAS ENTERAS distintas del mismo elemento —un `motion.div` angosto bajo el header vs. una
// pantalla completa con cabecera propia— así que el eje es de VARIANTE (como `hero.variante`,
// `brandStory.variante`), no de encendido: un booleano ON/OFF no dice CUÁL de dos formas se pinta,
// sólo que una cambió. `cromo.navTinta`/`navTratamiento.activo` (§ sus propios docstrings, y el
// comentario del bloque "Mobile Menu" en `StoreNav.tsx`) declaran EXPLÍCITAMENTE que NO gobiernan el
// drawer móvil —acotan al header DESKTOP fijo/al `.nav-link` siempre visible— y ese texto SIGUE
// siendo cierto: esta meta es la que sí lo gobierna, y es DISTINTA de las cuatro anteriores.
export interface NavDrawerMovilContent {
  // ¿El drawer móvil (el panel que abre el botón hamburguesa en `<lg`) rinde la composición de
  // PANTALLA COMPLETA del prototipo (`.mobile-nav`, `docs/prototipos/cafeone/css/app.css:300-321`,
  // `index.html:93-106`) — cabecera propia (wordmark + botón cerrar, `margin-bottom:var(--space-10)`)
  // + los links con entrada ESCALONADA (`--i`, `animation-delay:calc(var(--i,0) * 60ms + 80ms)`,
  // `420ms var(--ease-out)`, opacity 0→1 + translateY(14px)→0)? `'dropdown'` = HOY: el panel angosto
  // bajo el header (`motion.div` con `AnimatePresence`, `fixed top-16 left-0 right-0`, sin cabecera
  // propia ni escalonado), byte-idéntico. Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con
  // `preset.navDrawerMovilVariante`; de los 6 presets del catálogo, sólo CORTE declara
  // `'pantallaCompleta'`.
  variante: ClaveDrawerMovil;
}

// El set CERRADO de composiciones del CAJÓN DEL CARRITO (§ MUESTRARIO-CARRITO-COMPOSICION-1).
export type ClaveCarrito = 'anclado' | 'flotante';

// META de VARIANTE DE COMPOSICIÓN DEL CARRITO (§ MUESTRARIO-CARRITO-COMPOSICION-1) — MISMA forma
// que `NavDrawerMovilContent` (arriba): AUSENTE/`'anclado'` = el comportamiento de HOY, byte a
// byte. Meta PROPIA, NO un campo de `CarritoEnvioContent` — ésa es la barra de progreso hacia el
// envío gratis, OTRO eje del mismo carrito (§ su propio docstring); acá, igual que `navDrawerMovil`
// frente a `navTratamiento`/`navWordmark`, las DOS composiciones son FORMAS ENTERAS distintas del
// mismo panel —pegado al borde derecho vs. flotante separado de los tres bordes libres, con su
// propio radio y su propia sombra— así que el eje es de VARIANTE, no de encendido.
export interface CarritoContent {
  // ¿El cajón del carrito (`CartDrawer.tsx`) rinde la composición FLOTANTE del muestrario (`.drawer`,
  // `docs/prototipos/cafeone/css/app.css:708-717`): separado del viewport por un margen en los TRES
  // bordes libres (arriba/abajo/derecha — `top/bottom/right:var(--frame-gap)`, MEDIDO en 12px, el
  // MISMO valor que ya traduce `navDrawerMovil.variante==='pantallaCompleta'` en `StoreNav.tsx`,
  // `inset-3`), esquinas redondeadas del lado que mira al borde de pantalla
  // (`border-radius:0 var(--frame-radius) var(--frame-radius) 0`, MEDIDO en 14px — MISMO valor que
  // `navDrawerMovil`, `rounded-[14px]` en ese componente), fondo en la superficie de PÁGINA
  // (`background:var(--surface-page)` → `--sf-fondo`, NO `--sf-tarjeta`) y cabecera en tamaño de
  // titular y peso regular (`font-size:var(--text-h1)` + `font-weight:var(--weight-regular)` →
  // `text-3xl font-normal`, reemplazando el `font-semibold` sin tamaño declarado de hoy)?
  // `'anclado'` = HOY: pegado al borde derecho (`fixed top-0 right-0 h-full`), esquinas cuadradas,
  // fondo `--sf-tarjeta`, cabecera `font-semibold` sin tamaño — byte-idéntico.
  //
  // EL ANCHO NO SE TOCA EN NINGUNA DE LAS DOS: `--drawer-width` (880px en el muestrario,
  // `width:min(var(--drawer-width),calc(100vw - var(--frame-gap)*2))`) no tiene equivalente en este
  // sistema —no hay token de ancho de drawer, y el owner no señaló el ancho como parte de lo que "se
  // sentía diferente" (colores, tipografías, ubicación)— así que reproducirlo sería hornear un
  // número del prototipo sin mapearlo a nada nuestro. Las dos variantes conservan el `max-w-sm` de
  // siempre.
  //
  // Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con `preset.carritoVariante` — de los 6
  // presets del catálogo, sólo CORTE lo declara `'flotante'`.
  variante: ClaveCarrito;
}

export interface SiteContentData {
  hero: HeroContent;
  marquesina: MarquesinaContent;
  trustBadges: TrustBadgesContent;
  brandStory: BrandStoryContent;
  origen: OrigenContent;
  presentaciones: PresentacionesContent;
  spotlight: SpotlightContent;
  subscriptionCTA: SubscriptionCTAContent;
  testimonials: TestimonialsContent;
  nosotrosHistoria: NosotrosHistoriaContent;
  nosotrosGaleria: NosotrosGaleriaContent;
  nosotrosCierre: NosotrosCierreContent;
  suscripcionPlanes: SuscripcionPlanesContent;
  suscripcionPasos: SuscripcionPasosContent;
  suscripcionFaq: SuscripcionFaqContent;
  tiendaEncabezado: TiendaEncabezadoContent;
  tiendaCatalogo: TiendaCatalogoContent;
  tiendaCreditos: TiendaCreditosContent;
  tiendaInterludio: TiendaInterludioContent;
  tiendaCierre: TiendaCierreContent;
  menu: MenuContent;
  footer: FooterContent;
  logo: LogoContent;
  paginas: PaginasContent;
  tema: TemaContent;
  cromo: CromoContent;
  volverArriba: VolverArribaContent;
  rielSocial: RielSocialContent;
  carritoEnvio: CarritoEnvioContent;
  navTratamiento: NavTratamientoContent;
  navWordmark: NavWordmarkContent;
  navDrawerMovil: NavDrawerMovilContent;
  carrito: CarritoContent;
  esquemas: EsquemasContent;
  orden: OrdenContent;
  variantesBandas: VariantesBandasContent;
  presetSnapshot: PresetSnapshotContent;
  // SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1): el mapa id→instancia de un catálogo
  // CURADO de tipos genéricos (Texto, Imagen con texto, Banner). Meta, no sección —resuelto aparte
  // del loop, KEY-AGNÓSTICO como `esquemas`/`variantesBandas`—, declarado y resuelto ENTERO en
  // `lib/config/secciones-instancias.ts` (módulo hoja: ver su docstring de cabecera para el porqué
  // de que ESTE archivo lo importe y no al revés).
  seccionesHome: Record<string, InstanciaContent>;
}

// META de esquemas (§ eje 5b, mitad B): el mapa bandaId→esquema que decide sobre QUÉ superficie
// vive cada banda del home (§ palette-derive, `derivarEsquema`). NO es una sección (no lleva
// `campos` ni la resuelve el loop) — es la PIEL POR-BANDA, gemela de `tema` (que es la piel de
// TODO el storefront) pero con un dominio de claves ABIERTO: cualquier bandaId puede tener una
// entrada, así que no hay un `defaults` fijo que enumerar (§ `resolverEsquemas`, key-agnóstico).
// Una banda AUSENTE del mapa (o con basura) = SIN OVERRIDE = su token CANÓNICO de hoy — el
// mecanismo que mantiene a Nayoli byte-idéntica sin sembrar fila (§ `--sf-banda` en `esquema-style`).
export type EsquemasContent = Record<string, ClaveEsquema>;

// META de VARIANTES DE BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1): el mapa bandaId→variante
// para bandas que NO son `SeccionKey` (`featured`, hoy la única) — GEMELA EXACTA de `EsquemasContent`
// en forma y en motivo: dominio de claves ABIERTO, sin `defaults` fijo que enumerar (§
// `resolverVariantesBandas`, key-agnóstico, abajo). Una banda AUSENTE del mapa (o con basura) = SIN
// OVERRIDE = su canónica (§ `VARIANTES_ESTRUCTURALES`) — el mismo mecanismo de byte-identidad que
// `esquemas`. La `variante` DENTRO de una SECCIÓN real (`hero.variante`, `brandStory.variante`) sigue
// viviendo donde vivía: esta meta es sólo para las bandas que no tienen una sección donde guardarla.
export type VariantesBandasContent = Record<string, string>;

// META de SNAPSHOT DE PRESET (§ REAPPLY-PRESERVA-OVERRIDES-1): el mapa RUTA→último-valor-declarado
// que `mergePresetEnContent` (`themes.ts`) usa para la fusión de TRES VÍAS al re-aplicar un preset —
// campo no tocado por el dueño desde el último apply, se actualiza con lo que el preset declara
// ahora; campo que el dueño cambió, se preserva. NO es contenido que la tienda MUESTRE ni que el
// dueño EDITE: es CONTABILIDAD del motor de presets, gemela de `EsquemasContent`/
// `VariantesBandasContent` en FORMA (dominio de claves ABIERTO, sin `defaults` fijo que enumerar,
// resuelta aparte del loop de secciones) pero DISTINTA en el VALOR: las rutas que guarda son de
// naturaleza heterogénea (`tema.fondo` es string, `cromo.navTinta` es boolean, `orden` es un
// array), así que no hay un set cerrado contra el que clampar como hace `resolverEsquemas` — de ahí
// `unknown`, no un tipo de valor único. Una entrada AUSENTE del mapa (primer apply, o una fila de
// antes de esta capacidad) hace que la fusión se comporte EXACTAMENTE como antes de este slice:
// escribe lo que el preset declara, sin comparar nada.
export type PresetSnapshotContent = Record<string, unknown>;

// META de ORDEN (§ eje 5, parte c — el orden de las bandas del home como DATO). A diferencia de
// `esquemas` (dominio ABIERTO, cualquier bandaId), acá el dominio es CERRADO: los 9 ids de banda
// que hoy monta `app/(storefront)/page.tsx` (7 hasta § ORIGEN-BANDA-1, que sumó `origen`; 9 hasta
// § MARQUESINA-BANDA-1, que sumó `marquesina` — ver su docstring en `MarquesinaContent`, arriba,
// para el porqué de su posición 2ª, justo tras `hero`). `BANDA_IDS` es la ÚNICA lista de esos ids —
// `site-content-schema.ts` la importa para su `z.enum` en vez de declarar una segunda—, y ya está
// en el ORDEN DEFAULT de hoy, así que `[...BANDA_IDS]` sirve directo como default. Newsletter
// (`newsletter`) queda FUERA: sigue oculta/comentada en v1 (§ page.tsx) y no se renderiza, así que
// no es un id reordenable — agregarla es el día que se reactive esa sección.
export const BANDA_IDS = [
  'hero', 'marquesina', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials',
] as const;
export type BandaId = typeof BANDA_IDS[number];
// `string[]`, no `BandaId[]` (§ SECCIONES-INSTANCIAS-1): desde que `seccionesHome` existe, `orden`
// puede llevar ids de banda Y de instancia mezclados (§ `resolverOrdenCompleto`,
// secciones-instancias.ts). Ensanchar este alias es SEGURO para los tres consumidores fuera de
// `touches:` (`TiendaPaginas.tsx`, `StoreNav.tsx`, `lib/admin/orden-secciones.ts`): los tres
// re-filtran con la `resolverOrden` VIEJA (sin tocar, abajo) antes de usar el valor, así que un id
// de instancia que les llegue por `content.orden` se vuelve a descartar ahí, sin romper nada — es
// el límite conocido documentado en DECISIONS.md: esos tres archivos siguen sin saber de instancias.
export type OrdenContent = string[];
export const ORDEN_DEFAULT: BandaId[] = [...BANDA_IDS];

// META de ORDEN de /nosotros (§ NOSOTROS-SISTEMA-DE-BANDAS-1, ampliada por § NOSOTROS-COMPOSICION-1)
// — GEMELA de `BANDA_IDS`/`OrdenContent` de arriba, para la OTRA página que compone bandas:
// `app/(storefront)/nosotros/page.tsx`. Son TRES bandas —la historia larga, la galería, y el CTA de
// cierre, en ese orden (el cierre AL FINAL, justo antes del pie, § NosotrosCierre.tsx)—. A
// DIFERENCIA de `orden` (home), acá NO hay campo en `SiteContentData` que persista una secuencia
// elegida por el owner — no hay fila que reordenar todavía, ni control en el panel para hacerlo
// (agregar ese campo y su control es su PROPIO slice, ya anotado en su momento). Por eso el ARRAY EN
// SÍ no vive dentro de `SiteContentData` (es sólo el conjunto cerrado de ids que la página conoce),
// aunque cada id que nombra SÍ es una sección real de `SiteContentData`/`SeccionKey`.
export const BANDA_NOSOTROS_IDS = ['nosotrosHistoria', 'nosotrosGaleria', 'nosotrosCierre'] as const;
export type BandaNosotrosId = typeof BANDA_NOSOTROS_IDS[number];

// LA CANÓNICA DE DARKNESS POR BANDA (§ eje 5, cierra la mina del nav abierta por el orden-como-dato).
// `bandaEsOscura` (`lib/config/esquema-style.ts`, consumida por `tratamientoNav` → StoreNav) necesita
// saber si la banda sobre la que flota el nav es oscura CUANDO esa banda NO tiene esquema asignado. Antes de
// este set no existía tal cosa: la función (entonces `heroEsOscuro`) asumía SIEMPRE la canónica del
// HERO —correcto sólo mientras `orden[0]` era necesariamente 'hero'—; el eje 5 (el orden como dato)
// rompió esa garantía, así que una banda CLARA sin esquema puesta primera habría dejado el nav con
// texto claro sobre fondo claro.
//
// El DEFAULT es CLARO: oscuro es la EXCEPCIÓN declarada acá, no la regla. Atado a los fondos
// canónicos que cada componente del home trae como fallback de `bg-[var(--sf-banda,<token>)]`
// (grep vivo contra el código, no supuesto — verificar de nuevo si un componente cambia su fallback):
//   hero            → var(--sf-tinta)      (HeroCurtina.tsx, variante 'curtina') → OSCURA
//                     var(--sf-fondo)      (HeroFicha.tsx, variante 'ficha')     → clara
//                     var(--sf-tinta)      (HeroMedia.tsx, variante 'media')     → OSCURA
//   marquesina      → var(--sf-tinta)      (Marquesina.tsx)         → OSCURA (§ MARQUESINA-BANDA-1;
//                     foto de fondo velada con overlay — el mismo rol que el velo de HeroMedia.tsx)
//   brandStory      → var(--sf-tinta)      (BrandStory.tsx)         → OSCURA
//   subscriptionCTA → var(--sf-tinta-2)    (SubscriptionCTA.tsx)    → OSCURA
//   trustBadges     → var(--sf-fondo)      (TrustBadges.tsx)        → clara
//   featured        → var(--sf-fondo)      (FeaturedProducts.tsx)   → clara
//   origen          → var(--sf-fondo)      (Origen.tsx)             → clara (§ ORIGEN-BANDA-1)
//   presentaciones  → var(--sf-fondo)      (GrindChooser.tsx)       → clara
//   testimonials    → var(--sf-fondo)      (TestimonialSection.tsx) → clara
//   (newsletter     → var(--sf-superficie) (Newsletter.tsx), oculta v1 — no en BANDA_IDS, no aplica)
//
// Esta lista DUPLICA a propósito el token que cada componente ya declara en su JSX — no se
// refactorizaron los fondos canónicos a un dato compartido en esta pasada (alcance mayor al de este
// slice, a decidir aparte). Si un componente cambia su fallback de `--sf-banda`, este set hay que
// actualizarlo A MANO contra el grep de arriba, o divergen en silencio.
//
// EL HERO ES LA ÚNICA BANDA CUYA CANÓNICA DEPENDE DE SU VARIANTE (§ EJE-5-VARIANTES-HERO): este
// `Set` sólo puede decir "oscura o clara", no "depende de X" — por eso el hero SIGUE apareciendo acá
// (oscura, la de la variante 'curtina', la canónica de Nayoli) pero `bandaOscuraCanonica` (abajo) es
// el punto de entrada real para cualquier consumidor, porque es la única función que sabe bifurcar
// por variante. Las demás bandas de este set no varían con su variante hoy (ninguna otra sección
// declara `variantes` que cambie su fondo canónico) y siguen resolviendo por `BANDAS_OSCURAS` a secas.
export const BANDAS_OSCURAS: ReadonlySet<BandaId> = new Set<BandaId>(['hero', 'marquesina', 'brandStory', 'subscriptionCTA']);

/** La darkness CANÓNICA (sin esquema) de una banda, dependiente de su VARIANTE cuando la
 *  tiene. Hoy sólo el HERO: 'curtina' y 'media' (§ TEMAS-HERO-MEDIA-1) son OSCURAS (fondo
 *  `--sf-tinta`), 'ficha' es CLARA (fondo `--sf-fondo`) — atado al fallback
 *  `bg-[var(--sf-banda,<token>)]` de cada componente, como `BANDAS_OSCURAS`. El resto de las
 *  bandas no varían con la variante → `BANDAS_OSCURAS`.
 *
 *  `bandaId` SE ENSANCHÓ de `BandaId` a `string` (§ SECCIONES-INSTANCIAS-1) — ensanchar un
 *  PARÁMETRO de un literal union a `string` es seguro para todo caller existente (un `BandaId` ya
 *  es un `string`), así que `StoreNav.tsx`/`EncabezadoSeccion.tsx` (fuera de `touches:`) siguen
 *  compilando sin tocar una línea. `tipoInstancia` es OPCIONAL y NUEVO: cuando el llamador sabe que
 *  `bandaId` es en realidad el id de una INSTANCIA (no una banda), pasa su tipo y esta función
 *  delega a `instanciaOscuraCanonica` en vez de mirar `BANDAS_OSCURAS` (que nunca va a contener un
 *  id de instancia). Sin este parámetro (el caso de HOY, los tres callers de arriba) el
 *  comportamiento es IDÉNTICO al de antes — es la mitad del mecanismo que deja listo "el nav sabe
 *  si una instancia primera es clara u oscura": falta sólo que `StoreNav.tsx` (fuera de
 *  `touches:`) lo invoque pasando el tipo de la instancia cuando `orden[0]` resulte ser una —
 *  anotado como open follow-up en DECISIONS.md, no construido acá. */
export function bandaOscuraCanonica(bandaId: string, variante?: string, tipoInstancia?: SeccionInstanciaTipo): boolean {
  if (tipoInstancia) return instanciaOscuraCanonica(tipoInstancia);
  if (bandaId === 'hero') return variante !== 'ficha'; // curtina/media/sticky/ausente = oscura; ficha = clara
  return BANDAS_OSCURAS.has(bandaId as BandaId);
}

/** ¿La banda `bandaId` en su `variante` es UNIFORME (un solo tono, § EJE-5-NAV-UNIFORME)? El nav
 *  transparente-flotante sólo puede posarse sobre una banda uniforme —una banda partida (bi-tonal)
 *  no tiene un color de texto único que se lea sobre las dos mitades—. La fuente es la VARIANTE
 *  (`VariantesDef.noUniformes`), no un esquema: un esquema no parte ni une una banda, así que la
 *  uniformidad es puro LAYOUT sin otra fuente con la que discrepar (a diferencia de la darkness,
 *  que SÍ tiene fuente dinámica —el esquema— y por eso se computa en `bandaEsOscura`, nunca se
 *  declara). Lookup SEGURO: `bandaId` puede no ser una `SeccionKey` (`featured` es banda
 *  ESTRUCTURAL, sin sección en `SiteContentData`; `trustBadges` SÍ es sección desde
 *  § CORTE-TRUSTBADGES-OCULTABLE-1, pero sin `variantes` propias) — sin `variantes` declaradas,
 *  uniforme por default en cualquiera de los dos casos.
 *
 *  `bandaId: string` + `tipoInstancia?` opcional (§ SECCIONES-INSTANCIAS-1) — MISMO ensanche y
 *  misma razón que `bandaOscuraCanonica`, arriba: seguro para los callers existentes, delega a
 *  `instanciaEsUniforme` cuando el llamador declara que `bandaId` es en realidad una instancia. */
export function bandaUniforme(bandaId: string, variante?: string, tipoInstancia?: SeccionInstanciaTipo): boolean {
  if (tipoInstancia) return instanciaEsUniforme(tipoInstancia);
  const def = (REGISTRY as Record<string, SeccionDef | undefined>)[bandaId];
  const nu = def?.variantes?.noUniformes;
  return !(nu && variante !== undefined && nu.includes(variante));
}

/** La variante resuelta de una banda, o undefined si la banda no es una sección con variante —ni
 *  `featured` (banda ESTRUCTURAL, sin sección en SiteContentData) ni `trustBadges` (sección desde
 *  § CORTE-TRUSTBADGES-OCULTABLE-1, pero sin campo `variante`) tienen una. */
export function varianteDeBanda(content: SiteContentData, bandaId: BandaId): string | undefined {
  const sec = (content as unknown as Record<string, unknown>)[bandaId];
  return sec && typeof sec === 'object' && 'variante' in sec
    ? (sec as { variante?: string }).variante : undefined;
}

// Los DEFAULTS son los literales que hoy viven en el JSX del hero. Se mueven acá; el
// componente los recibe resueltos.
export const DEFAULTS: SiteContentData = {
  hero: {
    visible: true,
    eyebrow: 'Calidad en cada pedido',
    titulo: 'Productos que cuentan',
    tituloEnfasis: 'historias',
    subtitulo:
      'Cuidamos cada pedido de principio a fin: eliges lo que necesitas, te confirmamos enseguida, y lo recibes tal como lo esperabas.',
    ctaPrimarioLabel: 'Ver Catálogo',
    ctaSecundarioLabel: 'Suscripción Mensual',
    imagen: '/images/hero-cerezas-v1.jpg',
    // La canónica (§ HERO-VIDEO-COMO-DATO-1): Nayoli queda byte-idéntica — fondo por IMAGEN, sin
    // póster (un póster sin video no significa nada).
    imagenTipo: 'imagen',
    imagenPoster: '',
    // La canónica (§ HERO-VIDEO-MOVIL-1): sin video de teléfono, Nayoli queda byte-idéntica.
    imagenMovil: '',
    imagenMovilPoster: '',
    // La canónica (§ eje 5, EJE-5-VARIANTES-HERO): Nayoli queda byte-idéntica a la curtina de hoy.
    variante: 'curtina',
    // Los TRES agregados (§ TEMAS-HERO-MEDIA-AGREGADOS-1): default = el hero-media de HOY, byte a
    // byte — `ctasVisibles: true` (los dos CTA de siempre), `fraseAlPie: ''` (se omite, § `campos`
    // arriba), `cueDesliza: false` (sin cue).
    ctasVisibles: true,
    fraseAlPie: '',
    cueDesliza: false,
    // Los DOS toggles nuevos (§ CORTE-HERO-TITULAR-OCULTABLE-1): default `true` = el hero de HOY
    // byte a byte, titular y subtítulo visibles.
    titularVisible: true,
    subtituloVisible: true,
    // `alturaLlena` (§ CORTE-HERO-VIEWPORT-LLENO-1): default `false` = `min-h-[92vh]` de HOY,
    // byte-idéntico.
    alturaLlena: false,
    // `alto` (§ EDITOR-TIENDA-ZONAS-1): la canónica `'justo'` — byte-idéntica, cae a `alturaLlena`
    // vía `claseAlturaHero`.
    alto: 'justo',
    // `veloVisible` (§ CORTE-HERO-VELO-OFF-Y-TICKER-1): default `true` = el velo de HeroMediaMarquesina
    // SIEMPRE montado, byte-idéntico al comportamiento de hoy.
    veloVisible: true,
    // `puntoFocal` (§ HERO-PUNTO-FOCAL-1): default `'centro'` = SIN `object-position`, byte-idéntico
    // al recorte de hoy.
    puntoFocal: 'centro',
    // `veloIntensidad`/`tickerVelocidad` (§ CORTE-HERO-REVELADO-MASCARA-1): la canónica 'media' en
    // los dos — el rango de velo y la velocidad del ticker de SIEMPRE, byte-idénticos. Sólo CORTE
    // declara 'suave'/'lenta' (§ themes.ts).
    veloIntensidad: 'media',
    // `veloNivel` (§ EDITOR-PANEL-DESLIZADORES-1): `null` = el deslizador nunca se movió — la tienda
    // sigue leyendo `veloVisible`/`veloIntensidad` arriba, byte-idéntica.
    veloNivel: null,
    tickerVelocidad: 'media',
    // `estilos` (§ EDITOR-TIENDA-BARRA-FLOTANTE-1): el default es "sin ningún override" para los
    // CINCO elementos — byte-idéntico, ningún subcampo se traduce a `style` en `null`
    // (§ `estiloInlineDeElemento`, estilo-elemento.ts).
    estilos: {
      titulo: ESTILO_ELEMENTO_VACIO,
      subtitulo: ESTILO_ELEMENTO_VACIO,
      fraseAlPie: ESTILO_ELEMENTO_VACIO,
      ctaPrimarioLabel: ESTILO_ELEMENTO_VACIO,
      ctaSecundarioLabel: ESTILO_ELEMENTO_VACIO,
    },
  },
  // LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, ver el docstring de `MarquesinaContent` arriba).
  // NACE OFF (`visible:false`) por la MISMA razón mecánica que `origen`: `resolverOrden` completa
  // el orden de TODO tenant con TODA banda de `BANDA_IDS`, sin condición — estar en la lista no
  // alcanza para mostrarse.
  //
  // EL TEXTO ES GENÉRICO A PROPÓSITO, no el «Café fresco de San Adolfo — Huila — Colombia» del
  // prototipo (§ MARQUESINA-BANDA-CENSO-1): `mergePresetEnContent` JAMÁS escribe texto de sección,
  // así que el ÚNICO texto que CORTE podría mostrar bajo `?tema=CORTE` es ESTE default — una frase
  // de origen geográfico concreto en un default COMPARTIDO por TODO tenant sería un dato FABRICADO
  // sobre ese negocio, la misma familia que el rating fabricado que se borró (§ El RATING fabricado
  // se BORRÓ, CLAUDE.md). El test `DEFAULTS: ningún campo de TEXTO menciona café…` (§ CONTENIDO-
  // NEUTRALIZAR-1) camina TODO `DEFAULTS` sin excepción por sección, así que un texto café-shape acá
  // lo haría fallar igual que en cualquier otra.
  //
  // `imagen` reusa un asset estático existente (`brandStory.imagen4`) — la banda nace OFF, así que
  // no hay urgencia de una foto propia (mismo criterio que `origen.imagen1/2` reusando imágenes de
  // brandStory). `productoSlug` vacío: sin pin, la tarjeta flotante simplemente no se muestra
  // (§ `productoSpotlight`, el MISMO mecanismo que ya resuelve el pin de `spotlight`).
  //
  // LOS SEIS NUEVOS (§ EDITOR-TIENDA-MARQUESINA-SECCION-1, ver el docstring de `MarquesinaContent`):
  // `fraseBanda` es GENÉRICA, misma razón que `texto` arriba — DISTINTA de `texto` a propósito (para
  // que el test de byte-identidad detecte si algún día alguien copia una en la otra por error).
  // `imagenTipo` canónico 'imagen' — byte-idéntico (sin `escalares` guardado, el resolver clampa a
  // la canónica). `producto1..6` vacíos — sin lista propia, el componente cae al catálogo.
  //
  // `transicion` canónica 'subir' (§ EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1) — byte-idéntica sin
  // fila: es la ENTRADA DE HOY (§ `MarquesinaContent.transicion`, arriba).
  marquesina: {
    visible: false,
    texto: 'Calidad que se nota en cada entrega',
    imagen: '/images/historia-4-v1.jpg',
    productoSlug: '',
    fraseBanda: 'Hecho con cuidado, pensado para ti',
    imagenTipo: 'imagen',
    producto1: '',
    producto2: '',
    producto3: '',
    producto4: '',
    producto5: '',
    producto6: '',
    transicion: 'subir',
    // `estilos` (§ EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1): el default es "sin ningún override"
    // para el único elemento — byte-idéntico, mismo criterio que `hero.estilos` arriba.
    estilos: {
      texto: ESTILO_ELEMENTO_VACIO,
    },
  },
  // LA BANDA DE INSIGNIAS DE CONFIANZA (§ CORTE-TRUSTBADGES-OCULTABLE-1, ver el docstring de
  // `TrustBadgesContent` arriba). `visible: true` = HOY, byte a byte: la banda se monta siempre hoy
  // (`app/(storefront)/page.tsx`, sin condición) — a diferencia de `marquesina`/`origen`, que nacen
  // OFF porque su capacidad es NUEVA, ésta ya estaba encendida para todo tenant antes de este slice.
  trustBadges: {
    visible: true,
  },
  brandStory: {
    visible: true,
    eyebrow: 'Nuestra Historia',
    titulo: 'Detrás de cada pedido',
    parrafo1:
      'Empezamos con una idea simple: que comprar algo bueno no debería ser complicado. Por eso cuidamos cada pedido como si fuera el único, desde que lo eliges hasta que lo recibes.',
    parrafo2:
      'Seguimos aquí gracias a quienes vuelven a pedir, y eso es lo que más nos importa cuidar: que la próxima vez sea tan buena como la primera.',
    imagen1: '/images/historia-1-v1.jpg',
    imagen2: '/images/historia-2-v1.jpg',
    imagen3: '/images/historia-3-v1.jpg',
    imagen4: '/images/historia-4-v1.jpg',
    // El CTA de cierre nace VACÍO → sin botón, byte-idéntico (§ MUESTRARIO-SECCION-CTA-1).
    ctaLabel: '',
    ctaDestino: '',
    // La canónica (§ eje 5e, TEMAS-P2-BRANDSTORY-1): Nayoli queda byte-idéntica al collage de hoy.
    variante: 'columnas',
  },
  // LA BANDA ORIGEN (§ ORIGEN-BANDA-1, ver el docstring de `OrigenContent` arriba). NACE OFF
  // (`visible:false`) — igual que spotlight nació OFF mientras estuvo fuera de `BANDA_IDS`, por la
  // MISMA razón mecánica: `resolverOrden` completa el orden de TODO tenant con TODA banda de
  // `BANDA_IDS`, así que estar en la lista no alcanza para mostrarse. Sin este `false`, Nayoli (y
  // cualquier tenant sin fila propia) vería la banda aparecer sola.
  //
  // EL COPY ES GENÉRICO A PROPÓSITO —igual que `hero`/`brandStory`/`presentaciones` tras
  // CONTENIDO-NEUTRALIZAR-N—, aunque el prototipo que motivó esta banda (`docs/prototipos/cafeone/`,
  // § ORIGEN-BANDA-CENSO-1) sea 100% café (Altitud/Variedad/Proceso/Cosecha, msnm, hectáreas). El
  // test `DEFAULTS: ningún campo de TEXTO menciona café…` (abajo en este archivo, § CONTENIDO-
  // NEUTRALIZAR-1) camina TODO `DEFAULTS` sin excepciones por sección, así que un texto café-shape
  // acá lo haría fallar igual que en cualquier otra — no hay exención para "banda nueva".
  //
  // LOS VALORES de los 4 pares dato y los 3 stats nacen VACÍOS, no genéricos-con-número-inventado, y
  // es la MISMA razón que ya vacía `precio` en `SuscripcionPlanesContent`: `mergePresetEnContent`
  // JAMÁS escribe texto de sección (sólo `visible`), así que el ÚNICO valor que CORTE podría mostrar
  // bajo `?tema=CORTE` es ESTE default — y una cifra («52 años», «1.600 msnm») en un default
  // COMPARTIDO por TODO tenant sería un dato fabricado sobre ESE negocio, la misma familia que el
  // rating fabricado que se borró (§ El RATING fabricado se BORRÓ, CLAUDE.md). Los LABELS sí llevan
  // default —son categorías, no una afirmación verificable— y las VALORES vacíos se OMITEN en el
  // render (`Origen.tsx`), como cualquier campo opcional vacío del sistema.
  origen: {
    visible: false,
    eyebrow: 'El origen',
    titulo: 'Detrás de cada producto hay un origen real',
    lede:
      'Cada producto que ofrecemos nace en un lugar concreto, con personas que lo hacen posible. Contamos esa historia para que sepas exactamente de dónde viene lo que te llega.',
    // Reusa assets estáticos existentes (§ brandStory.imagen2/imagen3) en vez de introducir un asset
    // nuevo: la banda nace OFF, así que no hay urgencia de una foto propia.
    imagen1: '/images/historia-2-v1.jpg',
    imagen2: '/images/historia-3-v1.jpg',
    dato1Label: 'Ubicación', dato1Valor: '',
    dato2Label: 'Selección', dato2Valor: '',
    dato3Label: 'Cuidado', dato3Valor: '',
    dato4Label: 'Disponibilidad', dato4Valor: '',
    statNumero1: '', statEtiqueta1: '',
    statNumero2: '', statEtiqueta2: '',
    statNumero3: '', statEtiqueta3: '',
  },
  // Los literales que hoy viven en GrindChooser (OPCIONES + el encabezado). Byte a byte: sin fila de
  // SiteContent, la home queda IDÉNTICA (§ el test de byte-idéntico). Las imágenes son paths /public
  // (como el hero) — override por Blob, next/image sirve ambos, `storage.delete` es no-op sobre estáticos.
  presentaciones: {
    visible: true,
    eyebrow: 'Elige tu presentación',
    titulo: '¿Cómo lo prefieres?',
    label1: 'Presentación Clásica',
    copy1: 'La opción original, lista para usar.',
    imagen1: '',
    categoria1: 'Clásico',
    label2: 'Presentación Especial',
    copy2: 'Pensada para quien busca algo distinto.',
    imagen2: '',
    categoria2: 'Especial',
    // Tarjetas 3-4 opcionales, VACÍAS por defecto → Nayoli renderiza 2 (byte-idéntico). Un cliente
    // con 3-4 presentaciones las llena en el editor.
    label3: '', copy3: '', imagen3: '', categoria3: '',
    label4: '', copy4: '', imagen4: '', categoria4: '',
    // El CTA de cabecera nace VACÍO → sin botón, byte-idéntico (§ MUESTRARIO-SECCION-CTA-1).
    ctaLabel: '',
    ctaDestino: '',
    // La canónica (§ eje 5e): Nayoli queda byte-idéntica al mosaico de hoy.
    variante: 'mosaico',
  },
  // La banda SPOTLIGHT (§ SPOTLIGHT-BANDA-1, ver el docstring de `SpotlightContent`). NACE OFF
  // (`visible:false`) — la ÚNICA sección ocultable con este default — porque `spotlight` TODAVÍA
  // no es miembro de `BANDA_IDS` (§ el bloqueo medido en DECISIONS.md); el día que lo sea, nacer
  // OFF es lo único que evita que su sola presencia en el `orden` resuelto encienda la banda para
  // CUALQUIER tenant que no la pidió, Nayoli incluida (`resolverOrden` completa siempre con TODA
  // banda conocida, sin excepción). Sin pin (`productoSlug`/`otroTamanoSlug` vacíos): sin efecto
  // mientras la sección esté OFF, y el día que se encienda cae al PRIMER producto del catálogo
  // (§ `productoSpotlight`).
  //
  // ESTE DEFAULT NO SE TOCÓ EN SPOTLIGHT-CABLEADO-HOME-1 (§ VARIANTES_ESTRUCTURALES, arriba), aunque
  // esa tanda conecta `spotlight` como variante de `featured` — sigue sin sumarse a `BANDA_IDS`, así
  // que el motivo mecánico de arriba sigue vigente sin cambios, y Nayoli (variante 'cuadricula') no
  // monta `<Spotlight>` nunca, con este `visible` en cualquier valor. Lo que hace que la VARIANTE se
  // vea de verdad es `mergePresetEnContent` (`themes.ts`): fuerza `visible:true` SÓLO cuando el
  // preset pide `featured·spotlight` — un tenant que use la variante no puede quedar con la banda
  // encendida-por-elección-de-composición pero apagada-por-el-campo-de-abajo.
  spotlight: {
    visible: false,
    eyebrow: '',
    titulo: '',
    badge: '',
    nombreCafe: '',
    productoSlug: '',
    presentacionSlug: '',
    otroTamanoSlug: '',
    cuartoSlug: '',
    notaPrecio: '',
  },
  subscriptionCTA: {
    visible: true,
    eyebrow: 'Plan Suscripción',
    titulo: 'Tu pedido, cada mes',
    subtitulo: 'Recibe lo de siempre sin tener que acordarte de pedirlo cada vez.',
    bullet1: 'Siempre lo mismo, sin que tengas que volver a elegirlo',
    bullet2: 'Elige la presentación que prefieras',
    bullet3: 'Se renueva automáticamente, sin líos',
    bullet4: 'Pausa o cancela cuando quieras',
    ctaLabel: 'Ver los planes',
    // El segundo CTA nace VACÍO → sin segundo botón, byte-idéntico (§ MUESTRARIO-SECCION-CTA-1).
    ctaSecundarioLabel: '',
    ctaSecundarioDestino: '',
    // La canónica (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): Nayoli queda byte-idéntica al bloque de hoy.
    variante: 'bloque',
    // Vacío → fondo SÓLIDO, byte-idéntico (§ MUESTRARIO-CTA-BANNER-FOTO-1).
    imagenFondo: '',
  },
  testimonials: {
    visible: true,
    eyebrow: 'Testimonios',
    titulo: 'Lo que dicen nuestros clientes',
    items: [], // VACÍO a propósito (§ SiteContent — el repeater): sin claims falsos en defaults; hide-on-empty oculta
  },
  // El relato largo de la página /nosotros. El default REUSA el texto real de brandStory (no se
  // fabrica copy); `parrafo3` nace vacío para que el owner expanda. La galería variable NO va acá:
  // entra como su propia sección en la tanda 2 (§ /nosotros — la galería).
  nosotrosHistoria: {
    visible: true,
    eyebrow: 'Quiénes Somos',
    titulo: 'Cómo llegamos hasta acá',
    parrafo1:
      'Este negocio empezó con ganas de hacerlo distinto: responder rápido, cumplir lo que prometemos, y tratar a cada cliente como si fuera el primero. Con el tiempo eso se volvió la forma en que trabajamos todos los días.',
    parrafo2:
      'Hoy seguimos con la misma idea: que elegir, pedir y recibir sea simple, y que cada persona que confía en nosotros sienta que valió la pena.',
    parrafo3: '',
    // Vacío → composición de una sola columna, byte-idéntica a antes de § NOSOTROS-COMPOSICION-1.
    imagen: '',
  },
  // La galería de /nosotros. Encabezado con defaults de COPY (se muestran sólo cuando hay fotos, por
  // hide-on-empty); `items` VACÍO —las fotos de la finca son DATO del owner, no hay imagen que
  // fabricar en defaults—. Con items vacíos la sección no se renderiza.
  nosotrosGaleria: {
    visible: true,
    eyebrow: 'Galería',
    titulo: 'Nuestro trabajo en imágenes',
    items: [],
  },
  // El CTA de cierre de /nosotros (§ NOSOTROS-COMPOSICION-1). NACE VACÍO — sin `titulo` la banda no
  // se monta (hide-on-empty, § NosotrosCierre.tsx), así que ningún tenant que no la llene cambia un
  // byte, Nayoli incluida.
  nosotrosCierre: {
    visible: true,
    titulo: '',
    parrafo: '',
    ctaLabel: '',
    ctaDestino: '',
    imagenFondo: '',
  },
  // Los PLANES de /suscripciones (antes `SUBSCRIPTION_PLANS` + los literales del encabezado). Byte a
  // byte: sin fila, /suscripciones y el teaser de la home quedan IDÉNTICOS. Precios VACÍOS (Nayoli no
  // lleva). Destacado = slot '2' (el Plan Estándar, que hoy es el `popular`). Cada plan trae 3
  // beneficios (ben*_1..3); el 4º queda vacío (el componente lo omite → 3 bullets, como hoy). Los
  // NOMBRES son genéricos por CANTIDAD RELATIVA, no por unidad (§ CONTENIDO-NEUTRALIZAR-3, arriba).
  suscripcionPlanes: {
    visible: true,
    eyebrow: 'Suscripción Mensual',
    titulo: 'Tu pedido,',
    tituloEnfasis: 'cada mes',
    subtitulo: 'Elige cuánto quieres recibir y con qué frecuencia. Cambia, pausa o cancela cuando quieras.',
    planesTitulo: 'Elige tu plan',
    planesSubtitulo: 'Escríbenos y coordinamos tu suscripción por WhatsApp. Sin compromisos, pausa o cancela cuando quieras.',
    ctaLabel: 'Me interesa',
    destacadoSlot: '2',
    nombre1: 'Plan Básico', descripcion1: 'La opción de entrada, cada mes.', precio1: '',
    ben1_1: 'La cantidad justa para empezar', ben1_2: 'Sin compromiso: cancela cuando quieras', ben1_3: 'Te llega el mismo día, cada mes', ben1_4: '',
    nombre2: 'Plan Estándar', descripcion2: 'El doble del plan básico, cada mes.', precio2: '',
    ben2_1: 'El doble de cantidad del plan básico', ben2_2: 'Pensado para quien ya sabe que quiere seguir', ben2_3: 'Nunca te quedas sin, mes tras mes', ben2_4: '',
    nombre3: 'Plan Familiar', descripcion3: 'El doble del plan estándar, para compartir.', precio3: '',
    ben3_1: 'El doble de cantidad del plan estándar', ben3_2: 'Ideal para el hogar o la oficina', ben3_3: 'Ajusta la fecha cuando lo necesites', ben3_4: '',
    nombre4: '', descripcion4: '', precio4: '',
    ben4_1: '', ben4_2: '', ben4_3: '', ben4_4: '',
  },
  // Los pasos "¿Cómo funciona?" (antes `SUBSCRIPTION_STEPS`). Los íconos van por índice en el componente.
  suscripcionPasos: {
    visible: true,
    titulo: '¿Cómo funciona?',
    paso1Label: 'Selecciona tu plan', paso1Desc: 'Selecciona la frecuencia y cantidad que mejor se adapte a ti.',
    paso2Label: 'Personaliza tu pedido', paso2Desc: 'Escoge la opción que mejor se ajuste a lo que buscas.',
    paso3Label: 'Confirmamos tu pedido', paso3Desc: 'Te avisamos antes de que se procese, para que nunca haya sorpresas.',
    paso4Label: 'Recíbelo en casa', paso4Desc: 'Enviamos tu pedido a todo el país.',
  },
  // La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1). NACE VACÍA a propósito: las cuatro
  // respuestas del `constants/subscription-faq.ts` retirado eran FALSAS —prometían pausar "desde tu
  // cuenta" (ruta borrada), cobro mensual recurrente y cambio "desde el siguiente ciclo" (no hay
  // cobro recurrente en el sistema) y "envío gratis a nivel nacional" (no existe esa regla)— y no se
  // copian. `titulo` conserva el único literal que el componente viejo pintaba (el `<h2>` fijo), sin
  // ningún claim. El owner carga preguntas REALES por el editor; hasta entonces, hide-on-empty oculta
  // la sección y /preguntas-frecuentes redirige (§ faqSuscripcionesVisible).
  suscripcionFaq: {
    visible: true,
    titulo: 'Preguntas frecuentes',
    items: [],
  },
  // /tienda (§ TIENDA-PAGINA-REGISTRO-1): el texto EXACTO de hoy (`ShopLegacy`/`ShopCorte`, antes de
  // este slice) — byte-idéntico sin fila de SiteContent sembrada. El placeholder del buscador
  // ("Buscar café...") queda FUERA de este modelo a propósito (§ el docstring de
  // `TiendaCatalogoContent`): sigue siendo literal en el componente.
  tiendaEncabezado: {
    titulo: 'Nuestra Tienda',
    leyenda: 'Origen colombiano',
    // Los TRES campos de la composición «Carta» (§ TIENDA-CHAMISAS-ALBUM-1): `sticker`/`intro`
    // vacíos (opcionales, sin default inventado); `antojoTitulo` con su copy —es requerido, así que
    // necesita un default, pero NO se muestra bajo «Actual», sólo bajo «Carta»—.
    sticker: '',
    intro: '',
    antojoTitulo: '¿Qué te provoca?',
    variante: 'actual',
    // Los TRES campos de «Apertura» (§ TIENDA-ONIX-CARTELERA-1): los tres VACÍOS — `imagen` sin foto
    // cae a la superficie de color tinta (§ TiendaEncabezadoContent); `rotuloIzquierda`/`rotuloDerecha`
    // son decoración opcional, sin default inventado (misma regla que `sticker`/`intro`).
    imagen: '',
    rotuloIzquierda: '',
    rotuloDerecha: '',
  },
  tiendaCatalogo: {
    vacioTitulo: 'Sin resultados',
    vacioTexto: 'Prueba con otros filtros o términos de búsqueda.',
    // Sin color elegido para NINGÚN producto por defecto — Nayoli (y todo tenant que no toque este
    // mapa) asigna colores por orden de catálogo, derivados de SU tema (§ TiendaCatalogoContent).
    coloresPorProducto: {},
    variante: 'actual',
    // «Taquilla» (§ TIENDA-ONIX-CARTELERA-1): encendida de arranque (§ TiendaCatalogoContent) —
    // Nayoli/«Actual»/«Láminas» nunca la leen, así que no cambia nada para ellas.
    barraFijaMovil: true,
  },
  // LA FICHA DE ORIGEN · «CRÉDITOS» (§ TIENDA-ONIX-CARTELERA-1) — nace SIN filas, byte-idéntico sin
  // fila de SiteContent (ningún tenant ve nada nuevo). `visible:true` es el default de arranque
  // (como `testimonials`/`suscripcionFaq`): el PISO de 3 filas completas, no este flag, es lo que
  // decide si algo se muestra con un array casi vacío.
  tiendaCreditos: {
    visible: true,
    items: [],
  },
  // § TIENDA-CHAMISAS-ALBUM-1 — nacen las DOS APAGADAS (`visible:false`): sin fila de SiteContent,
  // ningún tenant ve nada nuevo — byte-idéntico. `cita`/`firma` del interludio VACÍAS a propósito
  // (§ TiendaInterludioContent, "nada de citas ni nombres en los defaults"); `frase`/`boton` del
  // cierre SÍ llevan copy neutro (no son un claim atribuido a nadie).
  tiendaInterludio: {
    visible: false,
    imagen: '',
    cita: '',
    firma: '',
    // «Plano» (§ TIENDA-ONIX-CARTELERA-1): canónica 'retrato' (renombrada, antes la única); `pie`
    // vacío, mismo criterio que `cita`/`firma` — sin default inventado.
    variante: 'retrato',
    pie: '',
  },
  tiendaCierre: {
    visible: false,
    franjaTejido: '',
    frase: '¿Quieres recibir tu pedido todos los meses? Lo coordinamos por WhatsApp.',
    boton: 'Escríbenos',
    // «Frase y botón» (§ TIENDA-ONIX-CARTELERA-1): canónica 'costura' (renombrada, antes la única) —
    // sin campos propios, reusa `frase`/`boton` de arriba.
    variante: 'costura',
  },
  // El MENÚ por defecto: los TRES labels y el orden de HOY (`StoreNav.tsx`, antes de este slice) —
  // tienda → suscripciones → nosotros—, el CTA APAGADO (los dos campos vacíos), el BADGE APAGADO
  // (§ CORTE-BADGE-COSECHA-EN-MENU-1, los dos campos vacíos — ningún ítem lleva badge), y el PANEL
  // APAGADO (§ MUESTRARIO-MEGA-MENU-1, `panelItem: ''` — ningún ítem lleva panel; los 27 campos
  // restantes del panel vacíos). Byte-idéntico sin fila (§ CROMO-MENU-COMO-DATO-1, la invariante del
  // slice).
  menu: {
    visible: true,
    labelTienda: 'Tienda',
    labelSuscripciones: 'Suscripciones',
    labelNosotros: 'Nosotros',
    posicion1: 'tienda',
    posicion2: 'suscripciones',
    posicion3: 'nosotros',
    ctaLabel: '',
    ctaDestino: '',
    badgeItem: '',
    badgeTexto: '',
    panelItem: '',
    panelIntro: '',
    panelIntroCtaLabel: '',
    panelIntroCtaDestino: '',
    panelCol1Titulo: '',
    panelCol1Link1Etiqueta: '', panelCol1Link1Nota: '', panelCol1Link1Destino: '',
    panelCol1Link2Etiqueta: '', panelCol1Link2Nota: '', panelCol1Link2Destino: '',
    panelCol1Link3Etiqueta: '', panelCol1Link3Nota: '', panelCol1Link3Destino: '',
    panelCol2Titulo: '',
    panelCol2Link1Etiqueta: '', panelCol2Link1Nota: '', panelCol2Link1Destino: '',
    panelCol2Link2Etiqueta: '', panelCol2Link2Nota: '', panelCol2Link2Destino: '',
    panelCol2Link3Etiqueta: '', panelCol2Link3Nota: '', panelCol2Link3Destino: '',
    panelTarjetaImagen: '',
    panelTarjetaTitulo: '',
    panelTarjetaCtaLabel: '',
    panelTarjetaCtaDestino: '',
  },
  // El PIE por defecto: los encabezados y las etiquetas de HOY (`siteConfig.footerNav`, antes de este
  // slice), variante canónica 'franjas' (NO 'columnas' — ese nombre ya lo usa `brandStory.variante`
  // como canónica de OTRA sección; el catcher de duplicados de DEFAULTS, `site-content-defaults.
  // test.ts`, trata cualquier string repetido como colisión, así que la clave interna se renombró
  // para no pedir una excepción por un token que ni siquiera es contenido visible), sin legales
  // (`siteConfig.legalNav` era `[]`). Byte-idéntico sin fila (§ MUESTRARIO-FOOTER-TEMA-1, la
  // invariante del slice) — el nombre de la clave no se renderiza nunca, sólo decide el dispatcher.
  footer: {
    visible: true,
    variante: 'franjas',
    columnaTienda: 'Tienda',
    columnaAyuda: 'Ayuda',
    columnaEmpresa: 'Empresa',
    linkTienda: 'Todos los productos',
    linkSuscripciones: 'Suscripciones',
    linkRastrearPedido: 'Rastrear Pedido',
    linkPreguntasFrecuentes: 'Preguntas Frecuentes',
    linkNuestraHistoria: 'Nuestra Historia',
    tarjetaImagen: '',
    tarjetaTexto: '',
    items: [],
    // § PIE-HECHO-POR-DUNA-1: default TRUE — las tres tiendas nacen con el crédito visible.
    creditoDunaVisible: true,
  },
  // LOGO por defecto (§ MARCA-LOGO-IMAGEN-1, + `icono` de § METADATA-ICONOS-Y-LANG-POR-TIENDA-1, +
  // `modo` de § NAV-LOGO-Y-NOMBRE-1): las cuatro claves de imagen vacías → sin logo subido (el
  // storefront cae al wordmark de texto, o la flor de Nayoli, § STOREFRONT_TIENE_MARK) y sin ícono
  // propio (cae a los estáticos de Nayoli); `modo: ''` → el default CONDICIONAL según haya o no
  // imagen subida (§ `modoLogoResuelto`, marca-logo.ts) — para Nayoli (sin imagen) eso es
  // 'soloNombre', el wordmark de texto de siempre → byte-idéntico sin depender de una fila.
  logo: {
    visible: true,
    oscuro: '',
    claro: '',
    alt: '',
    icono: '',
    modo: '',
  },
  // DEFAULT ENCENDIDA (Nayoli tiene historia real): al deployar, /nosotros queda viva y el enlace
  // "Nosotros" apunta a la página. Un cliente que no la use la apaga (§ decisión del owner). NO es
  // un claim falso —es copy editable, no una reseña inventada—, así que default-encendida no repite
  // el caso de los testimonios.
  // suscripciones DEFAULT ENCENDIDA (Nayoli propone suscripciones): al deployar, /suscripciones queda
  // viva con sus planes y el CTA "Me interesa" por WhatsApp. Un cliente que no venda suscripciones la
  // apaga → la página redirige, y el nav/footer/home CTA la esconden juntos (§ Backlog #49, opción 2).
  paginas: {
    nosotros: { visible: true },
    suscripciones: { visible: true },
  },
  // TEMA por defecto: las 3 raíces en null → el storefront usa los defaults de código (§ globals.css
  // `--sf-*`), que SON la paleta de Nayoli → byte-idéntico sin depender de una fila. Un cliente setea
  // sus raíces y el motor deriva el resto. La migración NO siembra `tema` (loader SOFT, como todo
  // SiteContent): sin la clave, `resolverTema` la resuelve a estos nulls.
  tema: {
    fondo: null,
    tinta: null,
    acento: null,
    fuentePar: null,   // Editorial (Inter/Playfair) — el default byte-idéntico
    forma: null,       // Suave (radios de hoy) — el default byte-idéntico
    origenTexto: null, // texto/texto-suave/acento-texto nacen del acento — el default byte-idéntico
    origenAccion: null, // la acción primaria pinta con `tostado` — el default byte-idéntico
    escalaDisplay: null, // cada titular de display sigue su clase Tailwind de hoy — byte-idéntico
  },
  // CROMO por defecto (§ CROMO-NAV-FOOTER-TEMATIZABLE-1): los 3 ejes en su valor de HOY —el nav
  // deriva de `tratamientoNav`, sin sub-encabezado, sin badge— → byte-idéntico sin depender de una
  // fila. Sólo un preset (`mergePresetEnContent`) los escribe distinto.
  cromo: {
    navTinta: false,
    navSubtitulo: false,
    navBadge: '',
  },
  // VOLVER ARRIBA por defecto (§ CROMO-VOLVER-ARRIBA-1): sin botón flotante → byte-idéntico sin
  // depender de una fila (`BackToTop.tsx` rinde `null`). Sólo CORTE lo enciende, vía
  // `mergePresetEnContent`.
  volverArriba: {
    visible: false,
  },
  // RIEL SOCIAL por defecto (§ CROMO-RIEL-SOCIAL-1): sin riel → byte-idéntico sin depender de una
  // fila (`RielSocial.tsx` rinde `null`). Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  rielSocial: {
    visible: false,
  },
  // BARRA DE ENVÍO GRATIS DEL CARRITO por defecto (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1): sin barra →
  // el carrito muestra sólo la frase condicional de siempre, byte-idéntico (`CartDrawer.tsx`, la
  // rama `FraseEnvioGratis`). Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  carritoEnvio: {
    visible: false,
  },
  // TRATAMIENTO DEL NAV por defecto (§ CROMO-NAV-TRATAMIENTO-1): sin mayúscula/tracking → el
  // `text-sm font-medium` de HOY, byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  // COMPORTAMIENTO POR DIRECCIÓN por defecto (§ CROMO-NAV-DIRECCION-SCROLL-1): sin ocultar/reaparecer
  // por dirección → el nav de HOY, byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  // FILETE INFERIOR por defecto (§ CROMO-NAV-FILETE-1): sin línea → el encabezado de HOY,
  // byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  // CTA/BADGE por defecto (§ CROMO-NAV-CTA-Y-BADGE-1): sin tratamiento → el CTA sigue siendo la
  // pastilla translúcida de HOY (antes de buscar/carrito) y el badge sigue dependiendo de `navClaro`,
  // byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  // GEOMETRÍA por defecto (§ CROMO-NAV-EXACTO-PROTOTIPO-1, reescribe § CROMO-NAV-POSICION-TEMA-REAL-1):
  // sin la geometría del prototipo local → el contenedor de HOY (`max-w-6xl` + altura fija),
  // byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  // SUBRAYADO AL HOVER por defecto (§ CROMO-NAV-EXACTO-PROTOTIPO-1): sin subrayado → los links del
  // nav de HOY, byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
  navTratamiento: {
    activo: false,
    direccion: false,
    filete: false,
    cta: false,
    posicion: false,
    subrayado: false,
    // BADGE COLOR por defecto (§ RIEL-SCROLL-Y-BADGE-DORADO-1): `null` = el badge sigue pintando
    // con `--sf-tostado`, byte-idéntico. Sólo CORTE lo enciende, vía `mergePresetEnContent`.
    badgeColor: null,
    // BUSCAR EN LA BARRA MÓVIL por defecto (§ NAV-MOVIL-SIN-BUSCAR-1): `true` = HOY, se muestra —
    // a diferencia de los siete campos de arriba, éste NO es un eje de preset (ningún preset lo
    // declara, § el docstring de `NavTratamientoContent.buscarMovil`); nace `true` para TODO
    // tenant, y el dueño lo apaga por su cuenta desde el panel.
    buscarMovil: true,
  },
  // TRATAMIENTO DEL WORDMARK APILADO por defecto (§ CORTE-LOGO-APILADO-1): sin mayúscula/tracking en
  // el nombre y sub itálico `--sf-tostado-5` de HOY, byte-idéntico. Sólo CORTE lo enciende, vía
  // `mergePresetEnContent`.
  //
  // COLOR DEL TAGLINE por defecto (§ NAV-LOGO-MOVIL-CON-AIRE-1): 'atenuado' = la rama de SIEMPRE
  // (§ `NavWordmarkContent.taglineColor`), byte-idéntico. Ningún preset lo declara — es DATO que el
  // owner pone directo (§ el docstring del campo), no un eje de `mergePresetEnContent`.
  navWordmark: {
    activo: false,
    taglineColor: 'atenuado',
  },
  // VARIANTE DEL DRAWER MÓVIL por defecto (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1): 'dropdown' → el panel
  // angosto bajo el header de HOY, byte-idéntico. Sólo CORTE lo cambia a 'pantallaCompleta', vía
  // `mergePresetEnContent`.
  navDrawerMovil: {
    variante: 'dropdown',
  },
  // VARIANTE DE COMPOSICIÓN DEL CARRITO por defecto (§ MUESTRARIO-CARRITO-COMPOSICION-1): 'anclado'
  // → el cajón pegado al borde derecho de HOY, byte-idéntico. Sólo CORTE lo cambia a 'flotante', vía
  // `mergePresetEnContent`.
  carrito: {
    variante: 'anclado',
  },
  // ESQUEMAS por defecto: el mapa nace VACÍO a propósito (§ eje 5b, mitad B). Ninguna banda tiene
  // entrada → todas caen a su token CANÓNICO de hoy (tinta/tinta-2/fondo/superficie, cada una la
  // suya) → Nayoli byte-idéntica. NO pre-llenar con 'crema'/'oscuro': eso rompería `tinta-2`
  // (SubscriptionCTA, un oscuro cálido DISTINTO de `oscuro`=tinta) y el blanco puro de hoy contra
  // el texto cálido 8.49:1 que sólo aparece cuando un tenant ASIGNA el esquema.
  esquemas: {},
  // ORDEN por defecto: la secuencia de HOY del home (§ eje 5, parte c) — el mismo `[...BANDA_IDS]`
  // que `ORDEN_DEFAULT`. Sin fila, `.map` en `page.tsx` produce el MISMO árbol que el JSX fijo de
  // ayer → byte-idéntico.
  orden: ORDEN_DEFAULT,
  // VARIANTES DE BANDAS ESTRUCTURALES por defecto: el mapa nace VACÍO, gemelo de `esquemas` arriba.
  // Ninguna banda estructural tiene entrada → `featured` cae a su canónica ('cuadricula',
  // § VARIANTES_ESTRUCTURALES) → byte-idéntico. `FeaturedProducts.tsx` SÍ lee esta meta desde
  // TEMAS-FEATURED-GRILLA-1 (es el dispatcher entre `cuadricula`/`grilla`/`spotlight`, la última
  // sumada en SPOTLIGHT-CABLEADO-HOME-1); antes de ese primer slice el único consumidor era
  // `themes.ts` (`mergePresetEnContent`), que sigue siendo el sitio donde un preset escribe sin
  // crear una clave `content.featured` huérfana.
  variantesBandas: {},
  // SNAPSHOT DE PRESET por defecto (§ REAPPLY-PRESERVA-OVERRIDES-1): nace VACÍO — sin un preset
  // aplicado todavía, no hay nada que recordar. El PRIMER `aplicarPreset` sobre un tenant sin fila
  // (o sobre una fila de antes de esta capacidad) encuentra este `{}` y por tanto escribe TODO lo
  // que el preset declara, byte a byte el comportamiento de siempre (§ `mergePresetEnContent`).
  presetSnapshot: {},
  // SECCIONES AGREGADAS por defecto (§ SECCIONES-INSTANCIAS-1): el mapa nace VACÍO, gemelo de
  // `esquemas`/`variantesBandas`/`presetSnapshot` arriba — ningún tenant tiene una instancia hasta
  // que alguien la agrega, así que sin fila `resolverOrdenCompleto` recibe `instanciaIds: []` y se
  // comporta EXACTAMENTE como la vieja `resolverOrden` → byte-idéntico, Nayoli incluida.
  seccionesHome: {},
};

// Destinos de los CTA — ESTRUCTURA, no editable. Los labels se editan; los hrefs NO: un
// href arbitrario en el botón principal de la portada lo dejaría apuntando a una ruta que
// no existe. La salida (si algún día se pide editarlos) es un selector entre rutas CONOCIDAS,
// no un campo libre (§ Config del contenido — SiteContent, en doctrina).
export const HERO_HREFS = { primario: '/tienda', secundario: '/suscripciones' } as const;

// El destino de las tarjetas de Presentaciones DEJÓ de ser ESTRUCTURA: es DATO (`categoria1/2` de la
// sección, editables con el combobox de categorías reales). `PRESENTACIONES_HREFS` se retiró — un path
// FIJO hacia un texto que el cliente escribe libremente se rompe solo: el owner escribió "Café grano"
// en un producto y el link "Café en Grano" dejó de traer nada. La C1 había asumido un SET CERRADO de
// categorías (path = estructura); C3 mató esa premisa (taxonomía derivada, texto libre), así que el
// destino tiene que seguir al dato. El href lo construye `hrefCategoria(categoria)` (§ lib/productos/
// categorias) desde el valor editable; el default resuelve a las categorías de hoy (byte-idéntico).

// ── El REGISTRY: la naturaleza de cada sección y campo ───────────────────────
// Es lo que deja el MODELO listo para BrandStory/Testimonials/SubscriptionCTA (que entran
// como datos, sin tocar esta mecánica):
//  · `ocultable`: si el editor ofrece el toggle de visibilidad. El HERO es `false` —una home
//    sin encabezado no es un caso de v1—; su `visible` queda fijo.
//  · `repeater`: la sección se auto-oculta con el array vacío (hide-on-empty). Testimonios
//    será el primero.
//  · campos `requerido` (vacío → default; el storefront no puede quedar sin ese dato) vs
//    `opcional` (vacío → el render lo OMITE).
export type CampoTipo = 'requerido' | 'opcional';

// VARIANTES DE COMPOSICIÓN (§ eje 5e): una sección puede declarar el mismo contenido con OTRO
// esqueleto. No es color (`content.tema`/`esquemas`) ni contenido (los `campos`): es una propiedad
// de la SECCIÓN, hermana exacta de `repeater`. `claves` es el set CERRADO de composiciones válidas;
// `canonica` es la de Nayoli — resuelve `''`, null, ausente y basura (§ `resolverVariante`).
//
// NACE SIN `sobreOscuro` A PROPÓSITO: sería un SEGUNDO origen de verdad sobre si la banda es oscura,
// y esa verdad ya es ÚNICA y EXPLÍCITA (`bandaEsOscura`, `esquema-style.ts` — por esquema asignado, o
// la canónica `BANDAS_OSCURAS` sin esquema). Repetirla acá reintroduciría la familia de suposición
// heredada que ese mecanismo existe para cerrar.
export interface VariantesDef {
  /** El set CERRADO de claves de composición de esta sección. */
  claves: readonly string[];
  /** La canónica —la de Nayoli—. Es lo que resuelve `''`, null, ausente y basura. */
  canonica: string;
  /** Las claves cuya banda NO es UNIFORME (bi-tonal / partida): el nav transparente-flotante no
   *  puede leerse sobre ellas (ningún color de texto único sirve para las dos zonas) → el nav cae
   *  a SÓLIDO. Ausente = todas las variantes son uniformes. NO es darkness (§ el rechazo de
   *  `sobreOscuro` arriba): la darkness tiene fuente DINÁMICA (un esquema asignado puede
   *  oscurecer/aclarar CUALQUIER banda) y por eso se COMPUTA (`bandaEsOscura`) en vez de
   *  declararse — declararla acá sería un 2º origen que puede discrepar del esquema, la mina que
   *  `sobreOscuro` existía para cerrar. La UNIFORMIDAD no tiene fuente dinámica: un esquema no
   *  parte ni une una banda — la ficha es partida tenga los colores que tenga —, así que es puro
   *  LAYOUT sin otra fuente con la que discrepar, y la variante es su fuente ÚNICA correcta. Único
   *  consumidor: `tratamientoNav` (esquema-style.ts). */
  noUniformes?: readonly string[];
}

export interface SeccionDef {
  /** Nombre de la sección en el selector del editor (§ /admin/tienda). */
  label: string;
  ocultable: boolean;
  /** Sección de LISTA: `itemsKey` es la clave del array; `campos` es la config de campos de CADA
   *  ÍTEM (requerido/opcional, para el resolver). Los campos NO-string del ítem (p. ej. un rating
   *  numérico) no van acá: el resolver los pasa tal cual. Coexiste con `campos` de sección. */
  repeater?: { itemsKey: string; campos: Record<string, CampoTipo> };
  /** Sección con VARIANTES de composición (§ eje 5e). Hermano de `repeater`: declara el set cerrado
   *  y la canónica; el resolver escribe `sec.variante` con `resolverVariante`. */
  variantes?: VariantesDef;
  /** ESCALARES de sección ADICIONALES, clampados con el MISMO `resolverVariante` que `variantes`
   *  (§ HERO-VIDEO-COMO-DATO-1) — pero por NOMBRE DE CAMPO en vez de la única ranura fija
   *  `sec.variante`. Es lo que permite una SEGUNDA (o tercera) propiedad clampada por sección sin
   *  un `if (key === 'hero')` hardcodeado en el loop del resolver: `hero.escalares.imagenTipo`
   *  clampa igual que `hero.variantes` clampa `variante`, sólo que escribe `sec.imagenTipo`. NO
   *  reemplaza a `variantes` —esa ranura sigue siendo la composición de la sección—; esto es para
   *  escalares nuevos que no son la composición. */
  escalares?: Record<string, VariantesDef>;
  /** Campos BOOLEANOS de sección ADICIONALES a `visible` (§ TEMAS-HERO-MEDIA-AGREGADOS-1). MISMO
   *  mecanismo que `visible` (abajo, en `storedSec.visible`): sólo se sobreescriben con un
   *  booleano EXPLÍCITO guardado — ausente, `null` o basura → el default de la sección. Gemelo de
   *  `escalares`, pero para un flag true/false en vez de un set cerrado de strings: sin esto, cada
   *  nuevo campo booleano de sección exigiría un `if (key === 'hero')` hardcodeado en el loop, el
   *  mismo hardcoding que `escalares` existe para evitar del lado de los strings clampados. */
  booleanos?: string[];
  /** Nombres de ELEMENTOS DE TEXTO de la sección con estilo propio (letra/tamaño/color/alineación),
   *  § EDITOR-TIENDA-BARRA-FLOTANTE-1. Resuelto por NOMBRE vía `resolverEstilosSeccion`
   *  (estilo-elemento.ts) — gemelo de `booleanos`/`escalares`: declarar la lista es lo único que
   *  hace falta para que un elemento EXISTA como superficie de estilo; el componente decide si lo
   *  aplica. DERIVADA de `elementosEstiloDeSeccion(key)` en el REGISTRY (nunca una segunda lista a
   *  mano — § el docstring de `ELEMENTOS_ESTILO`, estilo-elemento.ts). Ausente = sin ningún elemento
   *  estilizable en esta sección (byte-idéntico: `estilos` no se escribe en absoluto). */
  estilos?: readonly string[];
  campos: Record<string, CampoTipo>;
  /** Nombres de los campos que son IMÁGENES (blobs). Los lee el borrado de blobs reemplazados
   *  (`imagenesDe`), NO el resolver. Para un repeater la imagen vive en cada item. */
  imagenes?: string[];
  /** Campos MAPA (Record<string,string>) de sección ADICIONALES (§ TIENDA-CHAMISAS-ALBUM-1) — gemelo
   *  de `escalares`/`booleanos`, pero para un Record KEY-AGNÓSTICO en vez de un escalar único
   *  clampado a un set cerrado. Hoy sólo `tiendaCatalogo.coloresPorProducto` (id de producto → hex).
   *  Resuelto con `resolverMapaColor`: entradas sin hex de 6 dígitos válido se OMITEN (SOFT, nunca
   *  lanza) — mismo criterio que `resolverEsquemas`/`resolverVariantesBandas`, dominio ABIERTO, sólo
   *  que ACÁ vive DENTRO de la sección (viaja en su mismo borrador/publish) en vez de ser una clave
   *  meta aparte. */
  mapas?: readonly string[];
}

// Las claves de SECCIÓN (todo `SiteContentData` menos las META `paginas`, `tema`, `cromo`,
// `volverArriba`, `rielSocial`, `carritoEnvio`, `carrito` (§ MUESTRARIO-CARRITO-COMPOSICION-1),
// `navTratamiento`, `navWordmark`, `navDrawerMovil`, `esquemas`, `orden`, `variantesBandas` y
// `presetSnapshot`, que no son secciones). El REGISTRY las cubre a todas; las catorce metas quedan
// fuera a propósito —cada una se resuelve aparte del loop de secciones.
export type SeccionKey = Exclude<keyof SiteContentData, 'paginas' | 'tema' | 'cromo' | 'volverArriba' | 'rielSocial' | 'carritoEnvio' | 'carrito' | 'navTratamiento' | 'navWordmark' | 'navDrawerMovil' | 'esquemas' | 'orden' | 'variantesBandas' | 'presetSnapshot' | 'seccionesHome'>;

export const REGISTRY: Record<SeccionKey, SeccionDef> = {
  hero: {
    label: 'Portada',
    ocultable: false,
    // `imagenPoster` ENTRA acá (§ HERO-VIDEO-COMO-DATO-1) — es el SEGUNDO blob del hero, y si no se
    // nombrara acá el borrado de blobs (`imagenesDe`, site-content-blobs.ts) nunca lo vería: el
    // póster de un video reemplazado quedaría HUÉRFANO en el storage para siempre. `imagenMovil`/
    // `imagenMovilPoster` (§ HERO-VIDEO-MOVIL-1) entran por la MISMA razón — el video/póster de
    // teléfono reemplazado también debe dejar de ser huérfano.
    imagenes: ['imagen', 'imagenPoster', 'imagenMovil', 'imagenMovilPoster'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5, EJE-5-VARIANTES-HERO): 'curtina' es la canónica —el hero de
    // HOY, verbatim—; 'ficha' es la bi-tonal (tipografía en tinta sobre crema, foto a sangre a la
    // derecha, sin degradado); 'media' (§ TEMAS-HERO-MEDIA-1) es la TERCERA — la media (imagen o
    // video) llena la sección a opacidad plena, SIN el velo oscuro que atenúa a la curtina, y el
    // texto vive en una TARJETA (`--sf-tarjeta`/`--sf-sobre-tarjeta`) que flota sobre ella, en vez de
    // apoyarse en los tokens `--sf-sobre-banda` (pensados para un fondo de banda aproximadamente
    // plano — el que la curtina logra atenuando la foto al 40%, no el que esta variante quiere). Un
    // degradado angosto arriba (mismo tono `--sf-tinta`/60 que ya usa la curtina en ese mismo punto,
    // § HeroMedia.tsx) mantiene el nav legible sin necesitar `noUniformes`: la sección sigue siendo
    // UN solo plano de media, no partida en dos zonas de color como la ficha.
    // Segunda sección con `variantes`, tras `presentaciones` (§ eje 5e).
    // `noUniformes: ['ficha']` (§ EJE-5-NAV-UNIFORME): la ficha es BI-TONAL —crema a la izquierda,
    // foto oscura a la derecha— y ningún color de texto único del nav se lee sobre las dos mitades;
    // el nav transparente-flotante cae a SÓLIDO sobre ella (§ `tratamientoNav`, esquema-style.ts).
    // 'media' NO entra acá: es uniforme (un solo plano de media), así que el nav sigue flotando
    // transparente — su legibilidad la garantiza el degradado superior, no el fallback a sólido.
    //
    // 'sticky' (§ MUESTRARIO-HERO-MARQUESINA-STICKY-1) es la CUARTA — MEDIDO contra el tema real
    // (`https://x-cafeone.myshopify.com/`, sección `hero_banner_marquee`: `position:sticky;top:0;
    // height:100vh` con el video de fondo, un velo oscuro PLANO, una capa de texto
    // `position:absolute;top:50%;z-index:10;white-space:nowrap` y la tarjeta de producto encima) —
    // `docs/prototipos/cafeone/` DERIVA de ese tema y ya NO es la autoridad para esta composición
    // (su `.marquee` es una banda APARTE con foto propia al 55%, que es la forma vieja: dos bandas
    // apiladas en vez de una sola composición pineada). Tampoco entra a `noUniformes`: es un solo
    // plano de media (como 'media'), así que el nav sigue flotando transparente.
    //
    // NO SE LLAMA 'marquesina' A PROPÓSITO — DESVÍO MEDIDO: ese nombre YA está reservado en
    // `PLIEGO.variantes.hero` (themes.ts) como placeholder de una composición AJENA (el diseño
    // "Pliego", un tema distinto — ver el comentario de cabecera de `PLIEGO`: "el diseño vive fuera
    // de este repo"). `themes.test.ts` (fuera de `touches:` de este slice) afirma que ese pedido de
    // PLIEGO debe seguir fallando la validación POR NOMBRE
    // (`seccionesQueFallanVariante(PLIEGO)` incluye 'hero'); usar 'marquesina' acá lo habría vuelto
    // válido por accidente, corrompiendo esa afirmación sin tocar ese archivo. Medido ANTES de
    // cerrar el nombre (`npm test` corrido contra 'marquesina' reventó ese archivo); se cambió el
    // nombre de la clave, no el archivo.
    // § MOVIMIENTO-NIVEL-FIRMA-1 — 'grano'/'cereza'/'paisaje' son la QUINTA, SEXTA y SÉPTIMA:
    // los tres héroes de FIRMA del catálogo de movimiento (H01/H02/H03, `lib/movimiento/catalogo.ts`),
    // cada uno pin+scrub con su propia ilustración (`HeroGrano.tsx`/`HeroCereza.tsx`/`HeroPaisaje.tsx`,
    // `components/storefront/home/`). Las tres son UN SOLO PLANO de media (como 'media'/'sticky'):
    // no entran a `noUniformes` (el nav sigue flotando transparente) y `bandaOscuraCanonica` las
    // trata como OSCURAS por el mismo default que ya rige curtina/media/sticky (`variante !==
    // 'ficha'`, abajo) — las tres pintan `--sf-tinta` de fondo, con el texto en `--sf-sobre-banda`.
    variantes: { claves: ['curtina', 'ficha', 'media', 'sticky', 'grano', 'cereza', 'paisaje'], canonica: 'curtina', noUniformes: ['ficha'] },
    // ESCALARES (§ HERO-VIDEO-COMO-DATO-1): `imagenTipo` es el SEGUNDO escalar clampado de esta
    // sección (el primero es `variante`, arriba) — MISMO mecanismo (`resolverVariante`), otra
    // ranura. 'imagen' es la canónica: Nayoli queda byte-idéntica sin fila. `puntoFocal`
    // (§ HERO-PUNTO-FOCAL-1) es el TERCERO — la grilla de 9 posiciones (`PUNTOS_FOCALES`, arriba),
    // canónica `'centro'` (§ el docstring de `HeroContent.puntoFocal`). `veloIntensidad`/
    // `tickerVelocidad` (§ CORTE-HERO-REVELADO-MASCARA-1) son el CUARTO y QUINTO — mismo mecanismo,
    // canónica `'media'` en los dos (§ el docstring de `HeroContent.veloIntensidad`/
    // `.tickerVelocidad`).
    escalares: {
      imagenTipo: { claves: ['imagen', 'video'], canonica: 'imagen' },
      puntoFocal: { claves: PUNTOS_FOCALES, canonica: 'centro' },
      veloIntensidad: { claves: VELO_INTENSIDADES, canonica: 'media' },
      tickerVelocidad: { claves: TICKER_VELOCIDADES, canonica: 'media' },
      // `alto` (§ EDITOR-TIENDA-ZONAS-1, ver el docstring de `HeroContent.alto`): el SEXTO escalar,
      // mismo mecanismo. La canónica `'justo'` es la que deja que `claseAlturaHero` caiga en
      // `alturaLlena` — el fallback vive en el COMPONENTE, no acá (una sección no puede leer OTRO
      // campo de sí misma dentro de este loop genérico sin un `if` hardcodeado por sección, § el
      // docstring de `escalares` arriba).
      alto: { claves: ALTURAS_HERO, canonica: 'justo' },
    },
    // BOOLEANOS (§ TEMAS-HERO-MEDIA-AGREGADOS-1, ampliado en § CORTE-HERO-TITULAR-OCULTABLE-1,
    // § CORTE-HERO-VIEWPORT-LLENO-1 y § CORTE-HERO-VELO-OFF-Y-TICKER-1): los SEIS agregados de
    // mecánica true/false del hero-media del prototipo — `ctasVisibles` (apaga los dos CTA a la vez),
    // `cueDesliza` (el indicador de scroll animado), `titularVisible` (el bloque
    // `titulo`+`tituloEnfasis`) y `subtituloVisible` (el `subtitulo`), estos dos últimos cada uno su
    // propio apagador, `alturaLlena` (§ el docstring de `HeroContent.alturaLlena`: `100svh` en vez de
    // `min-h-[92vh]`), y `veloVisible` (§ el docstring de `HeroContent.veloVisible`: el overlay sobre
    // la media de `HeroMediaMarquesina`, la variante `'sticky'`). El séptimo agregado (`fraseAlPie`)
    // es un `campos` normal, abajo.
    booleanos: ['ctasVisibles', 'cueDesliza', 'titularVisible', 'subtituloVisible', 'alturaLlena', 'veloVisible'],
    // `estilos` (§ EDITOR-TIENDA-BARRA-FLOTANTE-1): DERIVADO de `elementosEstiloDeSeccion('hero')`,
    // nunca una lista escrita a mano acá — ver el docstring de `SeccionDef.estilos` arriba.
    estilos: elementosEstiloDeSeccion('hero'),
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      tituloEnfasis: 'opcional',
      subtitulo: 'requerido',
      ctaPrimarioLabel: 'requerido',
      ctaSecundarioLabel: 'opcional',
      imagen: 'requerido',
      // OPCIONAL, no requerido: el default es '' (sin video no hay póster que mostrar), y un hero
      // de IMAGEN no necesita nunca este campo. La OBLIGATORIEDAD condicional (si hay video, hay
      // póster) es del `.refine()` de `heroEditableSchema`, no de este mapa requerido/opcional —el
      // mapa no puede expresar "requerido SI OTRO CAMPO vale X".
      imagenPoster: 'opcional',
      // LA SEGUNDA VERSIÓN, VERTICAL, para teléfono (§ HERO-VIDEO-MOVIL-1, ver el docstring de
      // `HeroContent.imagenMovil` arriba). AMBAS opcionales, vacío → SE OMITE (sin video de
      // teléfono, byte-idéntico).
      imagenMovil: 'opcional',
      imagenMovilPoster: 'opcional',
      // OPCIONAL (§ TEMAS-HERO-MEDIA-AGREGADOS-1): vacío → SE OMITE, no cae a ningún texto de
      // relleno — el `.hero-caption` del prototipo es dato del tenant, nunca un default inventado
      // (misma regla que `eyebrow`/`tituloEnfasis`, § "la frontera fina de defaults-como-fallback").
      fraseAlPie: 'opcional',
      // `veloNivel` (§ EDITOR-PANEL-DESLIZADORES-1, ver el docstring de `HeroContent.veloNivel`
      // arriba): OPCIONAL, nunca `escalar` — ese mecanismo clampa a un SET CERRADO de strings
      // (`resolverVariante`), y éste es un NÚMERO 0-100. `null` (el default) → `campo in storedSec`
      // es `false` mientras nadie lo escriba, así que `sec.veloNivel` queda en `null` sin que el
      // loop `requerido`/`opcional` lo toque — la rama `opcional` sólo entra en juego la primera vez
      // que el deslizador escribe un número real.
      veloNivel: 'opcional',
    },
  },
  // LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, ampliada por § EDITOR-TIENDA-MARQUESINA-SECCION-1 —
  // ver el docstring de `MarquesinaContent` arriba para el porqué de cada campo nuevo). `ocultable:
  // true`, sin `variantes` (una sola composición). `productoSlug` es OPCIONAL —sin pin la tarjeta
  // flotante no se muestra, el texto del loop no depende de ella—.
  //
  // `imagenTipo` es un ESCALAR (como `hero.escalares.imagenTipo`): 'imagen'/'video', canónica
  // 'imagen' — byte-idéntica sin fila. `transicion` (§ EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1) es el
  // SEGUNDO escalar de esta sección: el set cerrado de `TRANSICIONES_MARQUESINA`, canónica 'subir' —
  // byte-idéntica sin fila (ver el docstring de `MarquesinaContent.transicion`, arriba).
  marquesina: {
    label: 'Marquesina',
    ocultable: true,
    imagenes: ['imagen'],
    escalares: {
      imagenTipo: { claves: ['imagen', 'video'], canonica: 'imagen' },
      transicion: { claves: TRANSICIONES_MARQUESINA, canonica: 'subir' },
    },
    // `estilos` (§ EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1): DERIVADO de
    // `elementosEstiloDeSeccion('marquesina')`, nunca una lista escrita a mano acá — mismo criterio
    // que `hero.estilos` arriba.
    estilos: elementosEstiloDeSeccion('marquesina'),
    campos: {
      texto: 'requerido',
      imagen: 'requerido',
      productoSlug: 'opcional',
      fraseBanda: 'requerido',
      producto1: 'opcional',
      producto2: 'opcional',
      producto3: 'opcional',
      producto4: 'opcional',
      producto5: 'opcional',
      producto6: 'opcional',
    },
  },
  // LA BANDA DE INSIGNIAS DE CONFIANZA (§ CORTE-TRUSTBADGES-OCULTABLE-1, ver el docstring de
  // `TrustBadgesContent` arriba). `ocultable: true`: es el ÚNICO campo editable de esta sección —
  // las cuatro insignias (ícono + texto) SIGUEN siendo el array `BADGES` del componente, no
  // `campos` de esta sección; `campos: {}` porque no hay ningún otro dato que el resolver deba
  // completar/omitir.
  trustBadges: {
    label: 'Confianza',
    ocultable: true,
    campos: {},
  },
  brandStory: {
    label: 'Historia',
    ocultable: true,
    imagenes: ['imagen1', 'imagen2', 'imagen3', 'imagen4'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5e, TEMAS-P2-BRANDSTORY-1) — 'columnas' es la canónica —el
    // layout de HOY, verbatim (texto a un lado, collage 2×2 al otro, `grid-cols-1 lg:grid-cols-2`)—.
    // 'centrada' (§ CORTE-BRANDSTORY-COLLAGE-1) es la SEGUNDA clave — la que abrió el slot con UNA
    // sola clave: eyebrow+título centrados, el collage de las mismas 4 imágenes A LO ANCHO debajo, y
    // el párrafo cerrando abajo, medida contra `docs/prototipos/cafeone/` (§ su comentario de
    // cabecera en `BrandStoryCentrada.tsx` — qué piezas del prototipo esta variante NO expresa).
    // `BrandStory.tsx` ganó su dispatcher en el mismo slice.
    // `noUniformes`: NO en NINGUNA de las dos — la banda es de un solo tono sólido
    // (`bg-[var(--sf-banda,var(--sf-tinta))]`) en las dos composiciones, nunca bi-tonal.
    variantes: { claves: ['columnas', 'centrada'], canonica: 'columnas' },
    // CARDINALIDAD VARIABLE 1-4 (§ CORTE-HISTORIA-COLOR-FOTOS-1): `imagen1` REQUERIDO (mínimo una
    // foto — vacía cae al default); `imagen2/3/4` OPCIONALES (vacías se OMITEN, el collage se
    // reacomoda con las que haya — ambos componentes de variante filtran por valor no-vacío). Con
    // las cuatro llenas (Nayoli, y todo tenant que no las vacíe) el resultado es el collage de
    // SIEMPRE, byte-idéntico — el mismo criterio OR/opcional que ya usa `presentaciones` (§ ahí).
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      parrafo1: 'requerido',
      parrafo2: 'opcional',
      imagen1: 'requerido',
      imagen2: 'opcional',
      imagen3: 'opcional',
      imagen4: 'opcional',
      // El CTA de cierre (§ MUESTRARIO-SECCION-CTA-1): AMBOS opcionales, vacío = sin botón.
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
    },
  },
  // LA BANDA ORIGEN (§ ORIGEN-BANDA-1, ver el docstring de `OrigenContent` arriba). `ocultable:
  // true`, sin `variantes` (una sola composición: grid de 2 fotos + copy + la lista de datos + los
  // 3 contadores). Los 4 pares dato y los 3 stats son cardinalidad FIJA —mismo patrón que
  // `suscripcionPasos` (slots fijos, campos planos)—, pero el LABEL y el VALOR de cada par NO
  // comparten obligatoriedad: los LABELS son requeridos (categorías, no una afirmación verificable,
  // § el docstring de `OrigenContent` para el porqué completo); los VALORES —y los dos campos de
  // cada stat— son OPCIONALES, vacío se OMITE en el render (criterio análogo al de las tarjetas 3-4
  // de Presentaciones, sólo que acá el gate es "tiene valor", no "título O imagen").
  origen: {
    label: 'Origen',
    ocultable: true,
    imagenes: ['imagen1', 'imagen2'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      lede: 'requerido',
      imagen1: 'requerido',
      imagen2: 'requerido',
      dato1Label: 'requerido', dato1Valor: 'opcional',
      dato2Label: 'requerido', dato2Valor: 'opcional',
      dato3Label: 'requerido', dato3Valor: 'opcional',
      dato4Label: 'requerido', dato4Valor: 'opcional',
      statNumero1: 'opcional', statEtiqueta1: 'opcional',
      statNumero2: 'opcional', statEtiqueta2: 'opcional',
      statNumero3: 'opcional', statEtiqueta3: 'opcional',
    },
  },
  presentaciones: {
    label: 'Presentaciones',
    ocultable: true,
    // Cardinalidad VARIABLE 2-4: campos PLANOS con imágenes, como brandStory —NO un repeater—.
    // Los cuatro campos-imagen se borran de Blob por diff (`imagenesDe` lee esto). Tarjetas 1-2
    // REQUERIDAS (vacío cae al default de Nayoli → mínimo 2); 3-4 OPCIONALES (vacío se respeta → la
    // tarjeta no se muestra si no se llena). `categoriaN` = el DESTINO (§ el destino es DATO).
    imagenes: ['imagen1', 'imagen2', 'imagen3', 'imagen4'],
    // VARIANTES DE COMPOSICIÓN (§ eje 5e): 'mosaico' es la canónica —el GrindChooser de HOY,
    // verbatim—; 'indice' es la de filas numeradas; 'riel' (§ CORTE-PRESENTACIONES-RIEL-1) es la
    // TERCERA — tarjetas en un riel horizontal con desplazamiento nativo y controles, medida contra
    // el prototipo (`GrindChooserRiel.tsx`).
    variantes: { claves: ['mosaico', 'indice', 'riel'], canonica: 'mosaico' },
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      label1: 'requerido',
      copy1: 'requerido',
      imagen1: 'requerido',
      categoria1: 'requerido',
      label2: 'requerido',
      copy2: 'requerido',
      imagen2: 'requerido',
      categoria2: 'requerido',
      label3: 'opcional',
      copy3: 'opcional',
      imagen3: 'opcional',
      categoria3: 'opcional',
      label4: 'opcional',
      copy4: 'opcional',
      imagen4: 'opcional',
      categoria4: 'opcional',
      // El CTA de cabecera (§ MUESTRARIO-SECCION-CTA-1): AMBOS opcionales, vacío = sin botón. Es de
      // la SECCIÓN entera, junto al título — distinto de `categoriaN`, el destino de cada tarjeta.
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
    },
  },
  // La banda SPOTLIGHT (§ SPOTLIGHT-BANDA-1, ver el docstring de `SpotlightContent`). `ocultable:
  // true`, sin `variantes` (una sola composición — ficha del producto pineado + selector de
  // molienda + notas de cata + carrito, § Spotlight.tsx) y sin `imagenes`: el contenido visual
  // (la portada) se LEE del `Product` pineado en cada render, nunca se sube acá — el pin es
  // puntero, no copia. Los cuatro campos son EDITORIALES puros; `productoSlug`/`otroTamanoSlug`
  // son los DOS punteros (§ el destino es DATO, igual que `categoria1/2` de Presentaciones).
  spotlight: {
    label: 'Destacado',
    ocultable: true,
    campos: {
      eyebrow: 'opcional',
      titulo: 'opcional',
      badge: 'opcional',
      // El título FIJO del café (§ SpotlightContent.nombreCafe, arriba): opcional, vacío → se
      // deriva del nombre del producto principal (`nombreCafeSpotlight`), nunca una cadena vacía.
      nombreCafe: 'opcional',
      productoSlug: 'opcional',
      // Los otros tres miembros del GRUPO (§ DESTACADO-PRESENTACION-POR-TAMANO-1, el docstring de
      // `SpotlightContent`): hasta cuatro productos del mismo café que arman la matriz
      // presentación×tamaño. Opcionales, vacío = la matriz se arma con los que el grupo tenga.
      presentacionSlug: 'opcional',
      otroTamanoSlug: 'opcional',
      cuartoSlug: 'opcional',
      // La nota del precio (§ SpotlightContent.notaPrecio, arriba): opcional, vacía = no se muestra.
      notaPrecio: 'opcional',
    },
  },
  subscriptionCTA: {
    label: 'Suscripción',
    ocultable: true,
    // VARIANTES DE COMPOSICIÓN (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): 'bloque' es la canónica —el
    // layout de HOY, verbatim (§ SubscriptionCTABloque)—; 'linea' es la nueva (franja horizontal
    // condensada, § SubscriptionCTALinea). Cuarta sección con `variantes`, tras hero/brandStory/
    // presentaciones. `noUniformes`: NO — las dos composiciones se apoyan en el fondo SÓLIDO de la
    // banda (`bg-[var(--sf-banda,var(--sf-tinta-2))]`), ninguna es bi-tonal.
    variantes: { claves: ['bloque', 'linea'], canonica: 'bloque' },
    // `imagenFondo` (§ MUESTRARIO-CTA-BANNER-FOTO-1): el ÚNICO blob de esta sección — antes era
    // "solo texto" (`imagenes: []`); ahora nombra el campo para que el borrado de blobs
    // (`imagenesDe`, site-content-blobs.ts) lo vea y no deje huérfano un fondo reemplazado. Los
    // bullets son OPCIONALES → vaciarlos los omite (el componente los junta con `.filter`), así que
    // dan "hasta 4" sin hueco, no "4 slots fijos".
    imagenes: ['imagenFondo'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      subtitulo: 'requerido',
      bullet1: 'opcional',
      bullet2: 'opcional',
      bullet3: 'opcional',
      bullet4: 'opcional',
      ctaLabel: 'requerido',
      // El SEGUNDO CTA (§ MUESTRARIO-SECCION-CTA-1): AMBOS opcionales, vacío = sin segundo botón.
      ctaSecundarioLabel: 'opcional',
      ctaSecundarioDestino: 'opcional',
      // OPCIONAL — vacío = fondo sólido de hoy (§ el docstring de `SubscriptionCTAContent.imagenFondo`).
      imagenFondo: 'opcional',
    },
  },
  testimonials: {
    label: 'Testimonios',
    ocultable: true,
    // Campos de SECCIÓN (el encabezado). La LISTA va en `repeater.campos` (campos del ítem):
    // name/text requeridos, city/product opcionales. `stars` NO va acá —es número, el resolver lo
    // pasa tal cual—.
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        name: 'requerido',
        city: 'opcional',
        text: 'requerido',
        product: 'opcional',
      },
    },
  },
  nosotrosHistoria: {
    label: 'Historia',
    ocultable: false, // el ocultar es a nivel de PÁGINA (paginas.nosotros.visible), no de esta sección
    // `imagen` (§ NOSOTROS-COMPOSICION-1): OPCIONAL — vacío = la composición de una sola columna de
    // siempre; con foto, la sección pasa a imagen-con-texto (§ NosotrosHistoria.tsx).
    imagenes: ['imagen'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      parrafo1: 'requerido',
      parrafo2: 'opcional',
      parrafo3: 'opcional',
      imagen: 'opcional',
    },
  },
  nosotrosGaleria: {
    label: 'Galería',
    ocultable: true,
    // `imagenes` nombra los campos-BLOB DENTRO de cada ítem: `imagenesDe` itera los items del repeater
    // y junta cada `item[campo]` para el borrado de blobs reemplazados/quitados. `url` (la foto o el
    // vídeo) Y `poster` (la imagen del vídeo): un ítem-vídeo quitado borra los DOS blobs; un ítem-imagen
    // no tiene `poster`, así que `empujarUrl` lo saltea. El encabezado (eyebrow/titulo) es OPCIONAL. La
    // LISTA va en `repeater.campos`: url requerida (sin archivo no hay ítem), alt opcional.
    imagenes: ['url', 'poster'],
    campos: {
      eyebrow: 'opcional',
      titulo: 'opcional',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        url: 'requerido',
        alt: 'opcional',
      },
    },
  },
  // EL CTA DE CIERRE de /nosotros (§ NOSOTROS-COMPOSICION-1). `ocultable: true` + hide-on-empty por
  // `titulo` (el gate vive en `NosotrosCierre.tsx`, no en `seccionEsVisible` — no es un repeater, así
  // que esa función no lo hace sola; el componente chequea `titulo.trim()` además del toggle). TODO
  // opcional, nace vacío: ninguna sección nueva nace con copy de una vertical. `imagenFondo` es el
  // ÚNICO blob — vacío = fondo sólido, sólo esta sección lo lee.
  nosotrosCierre: {
    label: 'CTA de cierre',
    ocultable: true,
    imagenes: ['imagenFondo'],
    campos: {
      titulo: 'opcional',
      parrafo: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      imagenFondo: 'opcional',
    },
  },
  // Los PLANES de /suscripciones. Encabezado + "Elige tu plan" + 4 slots de plan (1 requerido, 2-4
  // opcionales). Plan 1: nombre/descripcion REQUERIDOS (default de Nayoli → mínimo 1 plan); precio y
  // beneficios OPCIONALES. Planes 2-4: TODO opcional (nombre vacío → el componente omite el plan).
  // `destacadoSlot` opcional (vacío = ninguno). Como Presentaciones: el resolver NO decide la
  // cardinalidad, sólo default-vs-omit por campo; el componente filtra los planes visibles.
  suscripcionPlanes: {
    label: 'Planes',
    ocultable: false, // el ocultar es a nivel de PÁGINA (paginas.suscripciones.visible), no de esta sección
    campos: {
      eyebrow: 'opcional',
      titulo: 'requerido',
      tituloEnfasis: 'opcional',
      subtitulo: 'requerido',
      planesTitulo: 'requerido',
      planesSubtitulo: 'opcional',
      ctaLabel: 'requerido',
      destacadoSlot: 'opcional',
      nombre1: 'requerido', descripcion1: 'requerido', precio1: 'opcional',
      ben1_1: 'opcional', ben1_2: 'opcional', ben1_3: 'opcional', ben1_4: 'opcional',
      nombre2: 'opcional', descripcion2: 'opcional', precio2: 'opcional',
      ben2_1: 'opcional', ben2_2: 'opcional', ben2_3: 'opcional', ben2_4: 'opcional',
      nombre3: 'opcional', descripcion3: 'opcional', precio3: 'opcional',
      ben3_1: 'opcional', ben3_2: 'opcional', ben3_3: 'opcional', ben3_4: 'opcional',
      nombre4: 'opcional', descripcion4: 'opcional', precio4: 'opcional',
      ben4_1: 'opcional', ben4_2: 'opcional', ben4_3: 'opcional', ben4_4: 'opcional',
    },
  },
  // Los pasos "¿Cómo funciona?" — cardinalidad FIJA 4, todos REQUERIDOS (empty → default; no se
  // agregan/quitan pasos en v1). Íconos y número por índice en el componente (estructura).
  suscripcionPasos: {
    label: 'Cómo funciona',
    ocultable: true,
    campos: {
      titulo: 'requerido',
      paso1Label: 'requerido', paso1Desc: 'requerido',
      paso2Label: 'requerido', paso2Desc: 'requerido',
      paso3Label: 'requerido', paso3Desc: 'requerido',
      paso4Label: 'requerido', paso4Desc: 'requerido',
    },
  },
  // La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1). REPEATER, gemela de `testimonials`: un
  // encabezado (`titulo`) + una LISTA de preguntas. `question`/`answer` LOS DOS requeridos —una
  // pregunta sin respuesta es un hueco, no media FAQ—. `ocultable:true`: un cliente puede querer los
  // planes y los pasos sin una FAQ, además del gate de PÁGINA (`paginas.suscripciones.visible`).
  suscripcionFaq: {
    label: 'Preguntas frecuentes',
    ocultable: true,
    campos: {
      titulo: 'requerido',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        question: 'requerido',
        answer: 'requerido',
      },
    },
  },
  // /tienda (§ TIENDA-PAGINA-REGISTRO-1, ver el docstring de `TiendaEncabezadoContent`/
  // `TiendaCatalogoContent` arriba). `ocultable: false` en las DOS — como el hero, el catálogo no se
  // apaga entero. UNA sola composición por sección (`variantes.claves: ['actual']`), el mismo
  // mecanismo que `hero.variante`: deja el slot listo para que un slice futuro agregue una segunda
  // clave (Cartel/Taquilla…) sin tocar el resolver.
  tiendaEncabezado: {
    label: 'Encabezado de la tienda',
    ocultable: false,
    // 'carta' (§ TIENDA-CHAMISAS-ALBUM-1): la línea «cálida, hecha por mujeres» — H1 en primera
    // persona, sticker girado, intro, y el selector «¿Qué te provoca?». 'apertura' (§
    // TIENDA-ONIX-CARTELERA-1): la forma C del owner — foto a pantalla completa con el H1 gigante
    // encima. Nunca reemplazan a 'actual' (§ el spec: "«Actual» sigue siendo el default").
    variantes: { claves: ['actual', 'carta', 'apertura'], canonica: 'actual' },
    imagenes: ['imagen'],
    campos: {
      // `titulo` PASÓ A OPCIONAL (§ TIENDA-ONIX-CARTELERA-1, ver el docstring de
      // `TiendaEncabezadoContent`) — "Actual"/"Carta" quedan byte-idénticas vía el fallback que
      // ahora aplica el COMPONENTE, no el resolver.
      titulo: 'opcional',
      leyenda: 'requerido',
      sticker: 'opcional',
      intro: 'opcional',
      antojoTitulo: 'requerido',
      imagen: 'opcional',
      rotuloIzquierda: 'opcional',
      rotuloDerecha: 'opcional',
    },
  },
  tiendaCatalogo: {
    label: 'Catálogo',
    ocultable: false,
    // 'laminas' (§ TIENDA-CHAMISAS-ALBUM-1): un color por café, elegible o por orden de la paleta
    // derivada del tema (§ `mapas`, abajo). Con más de 6 productos cae sola a la grilla de 'actual'
    // (§ `lib/tienda/antojo.ts`, `mostrarSelectorAntojo`) — no es un tercer valor de `variante`, es
    // una decisión del COMPONENTE sobre los MISMOS dos valores. 'taquilla' (§
    // TIENDA-ONIX-CARTELERA-1): matriz categoria×peso_gramos derivada SOLA del catálogo
    // (`lib/tienda/taquilla.ts`); sin matriz válida cae sola a 'actual', mismo criterio que 'laminas'.
    variantes: { claves: ['actual', 'laminas', 'taquilla'], canonica: 'actual' },
    // `barraFijaMovil` (§ TIENDA-ONIX-CARTELERA-1, el spec item 6): SÓLO tiene efecto bajo
    // 'taquilla', pero se edita siempre — mismo criterio que `coloresPorProducto` bajo 'laminas'.
    booleanos: ['barraFijaMovil'],
    campos: {
      vacioTitulo: 'requerido',
      vacioTexto: 'requerido',
    },
    // EL MAPA id-de-producto → color (§ SeccionDef.mapas, arriba). Vive en esta sección —no en una
    // clave meta aparte— porque viaja en el MISMO borrador/publish que el resto del Catálogo.
    mapas: ['coloresPorProducto'],
  },
  // LA FICHA DE ORIGEN · «CRÉDITOS» (§ TIENDA-ONIX-CARTELERA-1, ver el docstring de
  // `TiendaCreditosContent` arriba). `ocultable:true`, nace con `items:[]` (DEFAULTS vacíos — ningún
  // dato de finca en el código, § #44). Repeater `etiqueta`/`valor`, los DOS 'requerido': una fila con
  // uno de los dos vacío no es media fila mostrable — es el COMPONENTE (`creditosVisibles`,
  // lib/tienda/creditos.ts) el que exige además el PISO de 3 filas completas para mostrarse, no este
  // mapa requerido/opcional (que sólo gobierna default-vs-omit por CAMPO, no una regla de CONTEO).
  tiendaCreditos: {
    label: 'Créditos: ficha de origen',
    ocultable: true,
    imagenes: [],
    campos: {},
    repeater: {
      itemsKey: 'items',
      campos: {
        etiqueta: 'requerido',
        valor: 'requerido',
      },
    },
  },
  // § TIENDA-CHAMISAS-ALBUM-1 — Interludio «Retrato y cita»: `ocultable:true`, nace APAGADA
  // (DEFAULTS.tiendaInterludio.visible=false). `imagenes` nombra `imagen` para que el borrado de
  // blobs reemplazados (`imagenesDe`) la vea — sin esto, una foto reemplazada quedaría huérfana en
  // el storage para siempre (§ CLAUDE.md, "El borrado de blobs por ítem…"). 'plano' (§
  // TIENDA-ONIX-CARTELERA-1): foto documental a sangre + pie, SIN retrato ni cita — reusa `imagen`,
  // suma `pie` (el único campo nuevo). Canónica renombrada 'retrato' (antes la única, sin nombre).
  tiendaInterludio: {
    label: 'Interludio: retrato y cita',
    ocultable: true,
    variantes: { claves: ['retrato', 'plano'], canonica: 'retrato' },
    imagenes: ['imagen'],
    campos: {
      imagen: 'opcional',
      cita: 'opcional',
      firma: 'opcional',
      pie: 'opcional',
    },
  },
  // § TIENDA-CHAMISAS-ALBUM-1 — Cierre «Costura»: `ocultable:true`, nace APAGADA. `franjaTejido` es
  // la franja de tejido de LA PÁGINA (§ el spec, item 5) — vive acá porque Costura es quien la
  // necesita siempre ("la franja arriba"); `frase`/`boton` REQUERIDOS (copy propio de la tienda, no
  // un claim atribuido a nadie, así que caen al default neutro si quedan vacíos). 'fraseYBoton' (§
  // TIENDA-ONIX-CARTELERA-1): CERO campos nuevos — reusa `frase`/`boton` tal cual, sin la franja ni
  // el marco con filete de «Costura». Canónica renombrada 'costura' (antes la única, sin nombre).
  tiendaCierre: {
    label: 'Cierre: costura',
    ocultable: true,
    variantes: { claves: ['costura', 'fraseYBoton'], canonica: 'costura' },
    imagenes: ['franjaTejido'],
    campos: {
      franjaTejido: 'opcional',
      frase: 'requerido',
      boton: 'requerido',
    },
  },
  // El MENÚ del nav (§ CROMO-MENU-COMO-DATO-1). `ocultable:false` — como el hero, el menú no se
  // apaga entero; renombrar/reordenar no es lo mismo que encender/apagar. Las posiciones, el CTA y
  // el BADGE (§ CORTE-BADGE-COSECHA-EN-MENU-1) son 'requerido'/'opcional' STRINGS PLANOS a propósito
  // —el resolver genérico no valida pertenencia a un set cerrado, sólo default-vs-omit—; el set
  // cerrado lo impone el SCHEMA (§ site-content-schema.ts, `menuEditableSchema`) al escribir, y el
  // RENDER (`resolverOrdenMenu`/`menuCtaHref`/`itemsDeMenu`, abajo) lo vuelve a filtrar SOFT al
  // leer, para que un dato corrupto por otra vía (un `UPDATE` a mano, una fila vieja) no produzca un
  // link roto ni un badge huérfano.
  //
  // EL PANEL (§ MUESTRARIO-MEGA-MENU-1): 28 campos más (`panelItem` + sus 27), TODOS 'opcional' — un panel vacío/a-medias
  // se OMITE entero (`panelDeMenuItem`, abajo prefiere callar a un desplegable vacío), nunca cae a
  // un default inventado. `imagenes: ['panelTarjetaImagen']` —el ÚNICO blob del menú— para que el
  // borrado de blobs reemplazados (`imagenesDe`, site-content-blobs.ts) lo vea: sin nombrarlo acá,
  // reemplazar la imagen de la tarjeta dejaría el blob viejo huérfano para siempre (mismo mecanismo
  // que `hero.imagenPoster`).
  menu: {
    label: 'Menú',
    ocultable: false,
    imagenes: ['panelTarjetaImagen'],
    campos: {
      labelTienda: 'requerido',
      labelSuscripciones: 'requerido',
      labelNosotros: 'requerido',
      posicion1: 'requerido',
      posicion2: 'requerido',
      posicion3: 'requerido',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      badgeItem: 'opcional',
      badgeTexto: 'opcional',
      panelItem: 'opcional',
      panelIntro: 'opcional',
      panelIntroCtaLabel: 'opcional',
      panelIntroCtaDestino: 'opcional',
      panelCol1Titulo: 'opcional',
      panelCol1Link1Etiqueta: 'opcional', panelCol1Link1Nota: 'opcional', panelCol1Link1Destino: 'opcional',
      panelCol1Link2Etiqueta: 'opcional', panelCol1Link2Nota: 'opcional', panelCol1Link2Destino: 'opcional',
      panelCol1Link3Etiqueta: 'opcional', panelCol1Link3Nota: 'opcional', panelCol1Link3Destino: 'opcional',
      panelCol2Titulo: 'opcional',
      panelCol2Link1Etiqueta: 'opcional', panelCol2Link1Nota: 'opcional', panelCol2Link1Destino: 'opcional',
      panelCol2Link2Etiqueta: 'opcional', panelCol2Link2Nota: 'opcional', panelCol2Link2Destino: 'opcional',
      panelCol2Link3Etiqueta: 'opcional', panelCol2Link3Nota: 'opcional', panelCol2Link3Destino: 'opcional',
      panelTarjetaImagen: 'opcional',
      panelTarjetaTitulo: 'opcional',
      panelTarjetaCtaLabel: 'opcional',
      panelTarjetaCtaDestino: 'opcional',
    },
  },
  // EL PIE DE PÁGINA (§ MUESTRARIO-FOOTER-TEMA-1, § el docstring de `FooterContent` arriba). MISMO
  // precedente que `menu`: `ocultable:false` — el pie no se apaga entero, es chrome del layout, como
  // el menú. Los 8 campos planos son 'requerido' STRINGS a propósito —el resolver genérico no valida
  // pertenencia a un set cerrado, sólo default-vs-omit—; el HREF de cada uno es ESTRUCTURA fija en
  // `StoreFooter.tsx`, no dato (§ el docstring de `FooterContent`). `items` es el REPEATER de la
  // fila legal, cardinalidad variable desde CERO (como testimonios/FAQ).
  //
  // `imagenes: ['tarjetaImagen']` (§ MUESTRARIO-FOOTER-TARJETA-IMAGEN-1) — el ÚNICO blob del pie
  // (la marca sigue sin blob propio, la resuelve `SiteSetting`): sin nombrarlo acá, el borrado de
  // blobs reemplazados (`imagenesDe`, site-content-blobs.ts) nunca lo vería y reemplazar la foto
  // dejaría el blob viejo HUÉRFANO para siempre. `tarjetaImagen`/`tarjetaTexto` son `opcional` —
  // vacía = sin tarjeta, byte-idéntica al pie de hoy (§ el docstring de `FooterContent`).
  footer: {
    label: 'Pie de página',
    ocultable: false,
    imagenes: ['tarjetaImagen'],
    variantes: { claves: ['franjas', 'apilado'], canonica: 'franjas' },
    // BOOLEANOS (§ PIE-HECHO-POR-DUNA-1): `creditoDunaVisible` apaga/enciende la línea "Hecho por
    // Duna" de la franja baja, en LAS DOS variantes (franjas/apilado). Mismo mecanismo que
    // `hero.ctasVisibles` — se resuelve en `resolverSiteContent` por NOMBRE, no por `campos` string.
    booleanos: ['creditoDunaVisible'],
    campos: {
      columnaTienda: 'requerido',
      columnaAyuda: 'requerido',
      columnaEmpresa: 'requerido',
      linkTienda: 'requerido',
      linkSuscripciones: 'requerido',
      linkRastrearPedido: 'requerido',
      linkPreguntasFrecuentes: 'requerido',
      linkNuestraHistoria: 'requerido',
      tarjetaImagen: 'opcional',
      tarjetaTexto: 'opcional',
    },
    repeater: {
      itemsKey: 'items',
      campos: {
        label: 'requerido',
        href: 'requerido',
      },
    },
  },
  // EL LOGO SUBIDO (§ MARCA-LOGO-IMAGEN-1) — MISMO precedente que `menu`/`footer`: `ocultable:false`
  // (el logo no se "apaga" como una banda de contenido; su presencia la decide tener o no una imagen
  // subida, § `hayLogoImagen`, lib/config/marca-logo.ts), editor BESPOKE
  // (`EncabezadoSeccion.tsx`, vía `/api/site-content/encabezado` — el logo viaja en el MISMO
  // borrador/publish que los diez switches del Encabezado, no una sección aparte del selector de
  // páginas). `imagenes: ['oscuro', 'claro', 'icono']` para que el borrado de blobs reemplazados
  // (`imagenesDe`, site-content-blobs.ts) los vea — sin nombrarlos acá, reemplazar un logo dejaría
  // el blob viejo HUÉRFANO para siempre (mismo mecanismo que `hero.imagenPoster`/
  // `menu.panelTarjetaImagen`). Los cuatro campos de imagen son 'opcional': vacíos = sin logo/ícono
  // subido, el storefront cae al wordmark de texto (o la flor de Nayoli, § STOREFRONT_TIENE_MARK) y
  // a los íconos estáticos de hoy — exactamente lo de hoy.
  logo: {
    label: 'Logo',
    ocultable: false,
    imagenes: ['oscuro', 'claro', 'icono'],
    campos: {
      // Versión OSCURA (tinta): para fondos CLAROS — páginas internas, encabezado sólido.
      oscuro: 'opcional',
      // Versión CLARA: para fondos OSCUROS — la portada flotando sobre el hero, el pie de página.
      claro: 'opcional',
      // ALT opcional con FALLBACK CONTEXTUAL (§ NosotrosGaleria, "opcional con fallback
      // contextual, no requerido"): vacío → el nombre del negocio, resuelto por el CONSUMIDOR
      // (`altDeLogo`, lib/config/marca-logo.ts) — nunca un default de código inventado.
      alt: 'opcional',
      // EL ÍCONO DE LA PESTAÑA (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1): un cuadrado PNG/SVG propio
      // para el favicon/apple-touch-icon/ícono de PWA, DISTINTO del logo de arriba (ESE es el
      // wordmark/mark del nav — típicamente RECTANGULAR, pésimo recortado a 16×16). Vacío → los
      // íconos ESTÁTICOS de hoy (Nayoli, § `lib/config/metadata-tienda.ts`), nunca una URL rota.
      icono: 'opcional',
      // CÓMO SE MUESTRA LA MARCA EN EL NAV (§ NAV-LOGO-Y-NOMBRE-1): 'opcional', NO `escalares` —
      // ese mecanismo clampa a una canónica FIJA (`resolverVariante`), y el default de este campo
      // es CONDICIONAL (depende de `hayLogoImagen`, que `resolverVariante` no puede mirar). SOFT,
      // raw: el resolver lo pasa TAL CUAL —sin clampar— y el clamp/interpretación de '', ausente o
      // basura vive en `modoLogoResuelto` (lib/config/marca-logo.ts), que `Logo.tsx` (el storefront)
      // y `EncabezadoSeccion.tsx` (el admin) comparten. Vacío → el comportamiento de HOY según haya
      // o no imagen subida — ningún tenant cambia sin elegirlo.
      modo: 'opcional',
    },
  },
};

/** El contrato de dato del LOGO subido (§ MARCA-LOGO-IMAGEN-1, + `icono` de § METADATA-ICONOS-Y-
 *  LANG-POR-TIENDA-1, + `modo` de § NAV-LOGO-Y-NOMBRE-1): dos versiones de imagen + su alt, más el
 *  ícono de pestaña/PWA y el modo de presentación. `''` en `oscuro`/`claro` = esa versión no está
 *  subida; `''` en ambas = sin logo (el storefront cae al wordmark de texto). `''` en `icono` = sin
 *  ícono propio (cae a los estáticos de Nayoli, § `lib/config/metadata-tienda.ts`). `modo` es
 *  `'' | 'soloNombre' | 'soloLogo' | 'logoYNombre'` en espíritu, pero el TIPO se queda `string` —
 *  como el resto de los campos SOFT de esta interfaz— porque `resolverSiteContent` no lo clampa
 *  (§ REGISTRY.logo.campos.modo, arriba); `modoLogoResuelto` (lib/config/marca-logo.ts) es quien
 *  estrecha el tipo al leerlo. Ver `REGISTRY.logo` arriba para el porqué de cada campo. `visible`
 *  es el campo BASELINE que toda sección lleva (§ `HeroContent`/`MenuContent`/`FooterContent`) —
 *  inerte acá porque `REGISTRY.logo.ocultable` es `false`, igual que en `menu`/`footer`. */
export interface LogoContent {
  visible: boolean;
  oscuro: string;
  claro: string;
  alt: string;
  icono: string;
  modo: string;
}

// VARIANTES DE BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1): el gemelo de `SeccionDef.
// variantes` para bandas que NO son `SeccionKey` —hoy sólo `featured`, sin entrada en
// `SiteContentData` ni en el REGISTRY (§ `bandaUniforme`, arriba); `trustBadges` SÍ ganó sección
// desde § CORTE-TRUSTBADGES-OCULTABLE-1, pero eso no la suma acá — ver el porqué abajo—. Sin esta
// tabla, un preset que pide `featured·X` no tiene DÓNDE declarar la variante: `validarPreset`
// (themes.ts) rechazaba TODO pedido de featured con "no declara variantes en el REGISTRY", sin
// distinguir "la composición pedida no existe" de "la banda no tiene slot" — el mismo defecto que
// `TEMAS-P2-BRANDSTORY-1` ya cerró del lado de las secciones. Medido contra `themes.ts` antes de
// este slice (`TEMAS-P1-BANDAS-ESTRUCTURALES-FORMA-1`): las CINCO entregas del diseño piden una
// variante de `featured` y ninguna tiene dónde resolverse.
//
// SÓLO `featured` HOY. `trustBadges` se deja AFUERA A PROPÓSITO (decisión del owner) — y con sección
// propia (§ CORTE-TRUSTBADGES-OCULTABLE-1) la razón sigue siendo la MISMA, no una de "sin dónde
// declarar": ningún preset del catálogo (§ themes.ts, PRESETS) pide una variante de `trustBadges` —
// vive sólo en los mapas de `esquemas`/`orden`, nunca en `variantes`, y su sección no declara
// `REGISTRY.trustBadges.variantes`—, así que declarar un slot que nadie consume sería CAPACIDAD
// MUERTA: la simetría con `featured` no es razón para abrirlo. Cuando un theme lo pida, entra con su
// variante real en el mismo commit que la construye.
//
// `featured` canónica = 'cuadricula': la composición de HOY de `FeaturedProductsCuadricula.tsx`
// (medida en su fuente, antes de TEMAS-FEATURED-GRILLA-1 vivía en `FeaturedProducts.tsx` sin
// dispatcher) — grid de 4 productos del catálogo, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
// NINGÚN preset del catálogo pide 'cuadricula': piden 'tabla' (PLIEGO), 'grilla' (PATIO/VITRINA),
// 'mosaico' (VETA) o 'spotlight' (CORTE) — composiciones DISTINTAS entre sí y de la canónica.
//
// `'grilla'` SE SUMÓ EN TEMAS-FEATURED-GRILLA-1 (`FeaturedProductsGrilla.tsx`): una MALLA de 6
// productos, `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (el ritmo de columnas que ya usa `/tienda`
// para esta misma tarjeta) — deliberadamente DISTINTA de la canónica (más ítems, otra retícula), no
// la canónica con otro nombre. `FeaturedProducts.tsx` YA ES el dispatcher que elige entre las tres
// (§ `content.variantesBandas.featured`, gemelo de `HeroSection`/`GrindChooser` pero leyendo esta
// meta en vez de `sección.variante`). `'tabla'` (PLIEGO) y `'mosaico'` (VETA) SIGUEN sin construir —
// una variante por slice—, así que esos dos themes SIGUEN sin poder aplicarse completos tras este
// cambio (PATIO/VITRINA dejan de fallar en `featured` desde TEMAS-FEATURED-GRILLA-1, pero siguen
// fallando en otras secciones; § `temasCompletos`).
//
// `'spotlight'` SE SUMÓ EN SPOTLIGHT-CABLEADO-HOME-1 (`components/storefront/home/Spotlight.tsx`,
// § SPOTLIGHT-BANDA-1 para el modelo): un solo producto PINEADO con su selector de molienda, notas
// de cata y carrito — reemplaza a la lista plana en el preset que la elija, sin sumar `spotlight`
// a `BANDA_IDS` (la RULING de SPOTLIGHT-BANDA-1 descartó la banda independiente porque exigía que
// `resolverOrden` ganara la capacidad de REMOVER una banda; la variante reusa el dispatcher que ya
// existe). CORTE es hoy el único preset que la pide — su `.spotlight` es LITERALMENTE la sección
// "Producto insignia" del prototipo (`docs/prototipos/cafeone/index.html:159-217`, un solo producto
// con selector y carrito), no la malla de 6 que 'grilla' pintaba ahí antes de este slice.
export const VARIANTES_ESTRUCTURALES: Record<string, VariantesDef> = {
  featured: { claves: ['cuadricula', 'grilla', 'spotlight'], canonica: 'cuadricula' },
};

const esVacio = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';
const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Normaliza la `variante` guardada a una clave del set CERRADO de la sección, o la CANÓNICA
 * (§ eje 5e). Gemela de `resolverForma`/`resolverFuentePar`: `''`, null, ausente, basura u objeto
 * → la canónica; NUNCA lanza. A diferencia de esas dos (donde el default es `null` = "sin
 * override"), acá el default ES un valor del set — la canónica es una variante de verdad, no la
 * ausencia de una.
 */
export function resolverVariante(def: VariantesDef, v: unknown): string {
  return typeof v === 'string' && def.claves.includes(v) ? v : def.canonica;
}

/**
 * Merge SOFT del contenido guardado sobre los DEFAULTS. Por campo:
 *  · `requerido` vacío/ausente → el DEFAULT (el storefront nunca queda sin ese dato);
 *  · `opcional` PRESENTE (aun vacío) → se respeta (vacío = el render lo omite);
 *    `opcional` AUSENTE → el DEFAULT (así el editor lo pre-llena la primera vez).
 * NUNCA lanza. `visible` sólo se sobreescribe con un booleano explícito.
 */
// Parametrizado en `registro`/`defaultsBase` (como `seccionEsVisible` e `imagenesDe`) para probar
// la rama repeater con una sección SINTÉTICA, sin depender de que exista una repeater real.
export function resolverSiteContent(
  stored: unknown,
  registro: Record<string, SeccionDef> = REGISTRY,
  defaultsBase: Record<string, unknown> = DEFAULTS as unknown as Record<string, unknown>,
): SiteContentData {
  const raw = esObj(stored) ? stored : {};
  const out = {} as Record<string, unknown>;

  // Se itera por `registro` (las SECCIONES), no por `defaultsBase`: así las claves que NO son sección
  // —`paginas`, `tema`— no entran al loop de secciones y se resuelven aparte, abajo.
  for (const key of Object.keys(registro)) {
    const def = registro[key];
    const defaults = defaultsBase[key] as Record<string, unknown>;
    const storedSec = esObj(raw[key]) ? (raw[key] as Record<string, unknown>) : {};
    const sec: Record<string, unknown> = { ...defaults };

    if (typeof storedSec.visible === 'boolean') sec.visible = storedSec.visible;

    for (const [campo, tipo] of Object.entries(def.campos)) {
      const val = storedSec[campo];
      if (tipo === 'requerido') {
        sec[campo] = esVacio(val) ? defaults[campo] : val;
      } else {
        sec[campo] = campo in storedSec ? (val ?? '') : defaults[campo];
      }
    }

    // REPEATER: resolver el ARRAY de items guardado. Sin esto, `sec[itemsKey]` se queda con el
    // array DEFAULT (`{...defaults}`) y toda edición del repeater se pierde EN SILENCIO.
    if (def.repeater) {
      sec[def.repeater.itemsKey] = resolverItems(def.repeater.campos, storedSec[def.repeater.itemsKey]);
    }

    // VARIANTES (§ eje 5e): resolver la composición guardada al set cerrado de la sección, o la
    // canónica. `''`, null, ausente y basura → la canónica.
    if (def.variantes) sec.variante = resolverVariante(def.variantes, storedSec.variante);

    // ESCALARES (§ HERO-VIDEO-COMO-DATO-1): más escalares clampados, por NOMBRE — gemelo de
    // VARIANTES arriba, mismo `resolverVariante`, sin la ranura fija `sec.variante`. Hoy sólo
    // `hero.imagenTipo`; genérico para el próximo escalar clampado que aparezca.
    if (def.escalares) {
      for (const [campo, escalarDef] of Object.entries(def.escalares)) {
        sec[campo] = resolverVariante(escalarDef, storedSec[campo]);
      }
    }

    // BOOLEANOS (§ TEMAS-HERO-MEDIA-AGREGADOS-1): campos true/false ADICIONALES a `visible`, por
    // NOMBRE — mismo mecanismo que `storedSec.visible` arriba (sólo un booleano EXPLÍCITO
    // sobreescribe; ausente/basura deja el default, que `sec` ya trae por el `{ ...defaults }`
    // inicial). Hoy sólo `hero.ctasVisibles`/`hero.cueDesliza`; genérico para el próximo booleano
    // de sección que aparezca.
    if (def.booleanos) {
      for (const campo of def.booleanos) {
        if (typeof storedSec[campo] === 'boolean') sec[campo] = storedSec[campo];
      }
    }

    // ESTILOS POR ELEMENTO (§ EDITOR-TIENDA-BARRA-FLOTANTE-1): el mapa elemento→estilo, por NOMBRE —
    // gemelo de ESCALARES/BOOLEANOS arriba. `resolverEstilosSeccion` (estilo-elemento.ts) ya es SOFT
    // (nunca lanza) y ya produce una entrada por CADA clave declarada, así que esta rama es sólo el
    // cableado: sin `def.estilos`, `sec.estilos` queda como estuviera en `defaults` (ausente para
    // toda sección que no declare el eje).
    if (def.estilos) {
      sec.estilos = resolverEstilosSeccion(storedSec.estilos, def.estilos);
    }

    // MAPAS (§ TIENDA-CHAMISAS-ALBUM-1): campos Record<string,string> ADICIONALES, por NOMBRE —
    // gemelo de ESCALARES/BOOLEANOS/ESTILOS arriba. Hoy sólo `tiendaCatalogo.coloresPorProducto`.
    if (def.mapas) {
      for (const campo of def.mapas) {
        sec[campo] = resolverMapaColor(storedSec[campo]);
      }
    }

    out[key] = sec;
  }

  // PÁGINAS (meta, no sección): sólo `visible` booleano por página; el default manda si el guardado
  // no trae un booleano explícito. Es lo que gatea el redirect de /nosotros y el enlace del nav.
  out.paginas = resolverPaginas(raw.paginas, defaultsBase.paginas);
  // TEMA (meta, no sección): las 3 raíces de paleta, resueltas aparte del loop igual que `paginas`.
  out.tema = resolverTema(raw.tema, defaultsBase.tema);
  // CROMO (meta, no sección, § CROMO-NAV-FOOTER-TEMATIZABLE-1): los 3 ejes de chrome de nav/footer,
  // resueltos aparte del loop y aparte de `tema` —dominio CERRADO (3 claves fijas) igual que
  // `paginas`, nunca tocado por el guardar/publicar de la PALETA (§ el docstring de `CromoContent`).
  out.cromo = resolverCromo(raw.cromo, defaultsBase.cromo);
  // VOLVER ARRIBA (meta, no sección, § CROMO-VOLVER-ARRIBA-1): ¿se monta el botón flotante?,
  // resuelto aparte de `cromo` (dominio CERRADO propio, 1 clave) por el motivo del docstring de
  // `VolverArribaContent` — no comparte contrato con `cromo`.
  out.volverArriba = resolverVolverArriba(raw.volverArriba, defaultsBase.volverArriba);
  // RIEL SOCIAL (meta, no sección, § CROMO-RIEL-SOCIAL-1): ¿se monta el riel fijo a la izquierda?,
  // resuelto aparte de `cromo`/`volverArriba` (dominio CERRADO propio, 1 clave) por el motivo del
  // docstring de `RielSocialContent` — no comparte contrato con ninguna de las dos.
  out.rielSocial = resolverRielSocial(raw.rielSocial, defaultsBase.rielSocial);
  // BARRA DE ENVÍO GRATIS DEL CARRITO (meta, no sección, § MUESTRARIO-CARRITO-BARRA-ENVIO-1): ¿el
  // pie del carrito rinde la barra visual en vez de la frase de siempre?, resuelto aparte de
  // `cromo`/`volverArriba`/`rielSocial` (dominio CERRADO propio, 1 clave) por el motivo del
  // docstring de `CarritoEnvioContent` — no comparte contrato con ninguna de las tres.
  out.carritoEnvio = resolverCarritoEnvio(raw.carritoEnvio, defaultsBase.carritoEnvio);
  // TRATAMIENTO DEL NAV (meta, no sección, § CROMO-NAV-TRATAMIENTO-1): ¿los links del nav llevan
  // mayúscula+tracking+peso?, resuelto aparte de `cromo`/`volverArriba`/`rielSocial` (dominio
  // CERRADO propio, 1 clave) por el motivo del docstring de `NavTratamientoContent` — no comparte
  // contrato con ninguna de las tres.
  out.navTratamiento = resolverNavTratamiento(raw.navTratamiento, defaultsBase.navTratamiento);
  // TRATAMIENTO DEL WORDMARK APILADO (meta, no sección, § CORTE-LOGO-APILADO-1): ¿el nombre+sub del
  // wordmark apilado del nav calzan el `.wordmark`/`.wordmark small` del prototipo?, resuelto aparte
  // de `cromo`/`volverArriba`/`rielSocial`/`navTratamiento` (dominio CERRADO propio, 1 clave) por el
  // motivo del docstring de `NavWordmarkContent` — no comparte contrato con ninguna de las cuatro.
  out.navWordmark = resolverNavWordmark(raw.navWordmark, defaultsBase.navWordmark);
  // VARIANTE DEL DRAWER MÓVIL (meta, no sección, § MUESTRARIO-DRAWER-MOVIL-TEMA-1): ¿el drawer móvil
  // rinde la composición de pantalla completa del prototipo?, resuelto aparte de `cromo`/
  // `volverArriba`/`rielSocial`/`navTratamiento`/`navWordmark` (dominio CERRADO propio, 1 clave) por
  // el motivo del docstring de `NavDrawerMovilContent` — no comparte contrato con ninguna de las cinco.
  out.navDrawerMovil = resolverNavDrawerMovil(raw.navDrawerMovil, defaultsBase.navDrawerMovil);
  // VARIANTE DE COMPOSICIÓN DEL CARRITO (meta, no sección, § MUESTRARIO-CARRITO-COMPOSICION-1): ¿el
  // cajón del carrito rinde el panel flotante del muestrario?, resuelto aparte de `cromo`/
  // `volverArriba`/`rielSocial`/`carritoEnvio`/`navTratamiento`/`navWordmark`/`navDrawerMovil`
  // (dominio CERRADO propio, 1 clave) por el motivo del docstring de `CarritoContent` — no comparte
  // contrato con ninguna de esas metas.
  out.carrito = resolverCarrito(raw.carrito, defaultsBase.carrito);
  // ESQUEMAS (meta, no sección): el mapa banda→esquema, resuelto aparte del loop igual que `paginas`
  // y `tema` — pero KEY-AGNÓSTICO (§ `resolverEsquemas`, abajo): a diferencia de esas dos, no hay un
  // `defaults` con un set fijo de claves que enumerar.
  out.esquemas = resolverEsquemas(raw.esquemas);
  // SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1, meta, no sección): el mapa id→instancia,
  // KEY-AGNÓSTICO (como `esquemas`/`variantesBandas`) — resuelto ANTES de `orden` (abajo), que
  // necesita saber qué ids de instancia EXISTEN de verdad para decidir cuáles son válidos en la
  // secuencia. Delegado ENTERO a `secciones-instancias.ts` (módulo hoja, § su docstring de cabecera).
  out.seccionesHome = resolverSeccionesHome(raw.seccionesHome);
  // ORDEN (meta, no sección): la secuencia de bandas MÁS instancias, resuelta aparte del loop.
  // `resolverOrdenCompleto` (secciones-instancias.ts) generaliza a `BANDA_IDS` ∪ las instancias que
  // `seccionesHome` ya resolvió arriba — con `seccionesHome` vacío (todo tenant hoy, Nayoli
  // incluida) es EXACTAMENTE `resolverOrden` sobre `BANDA_IDS`, byte-idéntico. La vieja `resolverOrden`
  // (abajo) SIGUE EXPORTADA, sin tocar su comportamiento: sus otros tres llamadores
  // (`TiendaPaginas.tsx`, `StoreNav.tsx`, `lib/admin/orden-secciones.ts`, los tres fuera de
  // `touches:` de este slice) re-filtran con ella cualquier `orden` que reciban, así que un id de
  // instancia que les llegue se descarta ahí sin romper nada — ver el docstring de `OrdenContent`.
  out.orden = resolverOrdenCompleto(raw.orden, BANDA_IDS, Object.keys(out.seccionesHome as Record<string, unknown>));
  // VARIANTES DE BANDAS ESTRUCTURALES (meta, no sección): el mapa bandaId→variante para bandas sin
  // sección (`featured`), resuelto aparte del loop igual que `esquemas` — GEMELO exacto, mismo
  // dominio ABIERTO (§ `resolverVariantesBandas`, abajo).
  out.variantesBandas = resolverVariantesBandas(raw.variantesBandas);
  // SNAPSHOT DE PRESET (meta, no sección, § REAPPLY-PRESERVA-OVERRIDES-1): el mapa ruta→último-valor-
  // declarado que `mergePresetEnContent` usa para su fusión de tres vías, resuelto aparte del loop
  // igual que `esquemas`/`variantesBandas` — mismo dominio ABIERTO (§ `resolverPresetSnapshot`, abajo).
  out.presetSnapshot = resolverPresetSnapshot(raw.presetSnapshot);
  return out as unknown as SiteContentData;
}

// Resuelve la meta de páginas: por cada página del default, `visible` sale del guardado sólo si es
// booleano explícito; si no, del default. SOFT, nunca lanza.
export function resolverPaginas(stored: unknown, defaults: unknown): Record<string, { visible: boolean }> {
  const def = esObj(defaults) ? defaults : {};
  const st = esObj(stored) ? stored : {};
  const out: Record<string, { visible: boolean }> = {};
  for (const pagina of Object.keys(def)) {
    const dv = esObj(def[pagina]) && typeof (def[pagina] as Record<string, unknown>).visible === 'boolean'
      ? (def[pagina] as { visible: boolean }).visible : true;
    const sv = esObj(st[pagina]) ? (st[pagina] as Record<string, unknown>).visible : undefined;
    out[pagina] = { visible: typeof sv === 'boolean' ? sv : dv };
  }
  return out;
}

// Resuelve el TEMA (las 3 raíces de paleta), gemela de `resolverPaginas`: una clave no-sección
// resuelta aparte del loop de secciones. Cada raíz sale del guardado sólo si es un hex de 6 dígitos
// VÁLIDO; si no —null, vacío, o basura—, cae al default (que es null → el storefront usa los
// defaults de código, § cssPaleta). SOFT, nunca lanza. La validación que MANDA es el write
// (`paletaEditableSchema`); ésta es la defensa del loader SOFT, que jamás debe romper por un valor
// corrupto en la fila (una raíz `'rojo'` editada a mano no llega al motor de derivación).
const HEX6_TEMA = /^#[0-9a-fA-F]{6}$/;
export function resolverTema(stored: unknown, defaults: unknown): TemaContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const raiz = (k: string): string | null => {
    const sv = st[k];
    if (typeof sv === 'string' && HEX6_TEMA.test(sv)) return sv;
    const dv = def[k];
    return typeof dv === 'string' && HEX6_TEMA.test(dv) ? dv : null;
  };
  // El par tipográfico y la forma: clave CUSTOM válida, o null (Editorial/Suave). `resolverFuentePar`/
  // `resolverForma` normalizan null, la clave del default y basura → null (§ fuentes, § formas). No usan
  // `defaults` porque el default ES null.
  //
  // origenTexto/origenAccion (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1): SOFT, igual que las raíces —
  // sólo un valor del set cerrado sobrevive, cualquier otra cosa (ausente, basura, un string que no
  // es el único miembro no-default) cae a `null`. Sin `defaults`, por la misma razón que fuentePar/
  // forma: el default DE ESTOS DOS ES `null` (§ el docstring de `TemaContent`).
  return {
    fondo: raiz('fondo'), tinta: raiz('tinta'), acento: raiz('acento'),
    fuentePar: resolverFuentePar(st['fuentePar']),
    forma: resolverForma(st['forma']),
    origenTexto: st['origenTexto'] === 'tinta' ? 'tinta' : null,
    origenAccion: st['origenAccion'] === 'acento' ? 'acento' : null,
    // escalaDisplay (§ TEMAS-ESCALA-DISPLAY-1): SOFT, misma familia — `resolverEscalaDisplay`
    // hace el mismo trabajo que el chequeo inline de arriba (sólo el único miembro del set cerrado
    // sobrevive), extraído a función porque `fontSizeDisplay` necesita el mismo tipo y las dos
    // viven en `escala-display.ts` para que un test puro las afirme sin tocar este archivo.
    escalaDisplay: resolverEscalaDisplay(st['escalaDisplay']),
  };
}

// Resuelve el CROMO (§ CROMO-NAV-FOOTER-TEMATIZABLE-1), gemelo de `resolverPaginas`: dominio
// CERRADO de 3 claves FIJAS (a diferencia de `resolverEsquemas`/`resolverVariantesBandas`, que son
// key-agnósticas). Cada clave sale del guardado sólo si es del TIPO correcto (boolean/string); si
// no —ausente, basura—, cae al default (que siempre es el byte-idéntico de HOY:
// `false`/`false`/`''`). SOFT, nunca lanza.
export function resolverCromo(stored: unknown, defaults: unknown): CromoContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const bool = (k: string): boolean => {
    const sv = st[k];
    if (typeof sv === 'boolean') return sv;
    const dv = def[k];
    return typeof dv === 'boolean' ? dv : false;
  };
  const str = (k: string): string => {
    const sv = st[k];
    if (typeof sv === 'string') return sv;
    const dv = def[k];
    return typeof dv === 'string' ? dv : '';
  };
  return {
    navTinta: bool('navTinta'),
    navSubtitulo: bool('navSubtitulo'),
    navBadge: str('navBadge'),
  };
}

// Resuelve VOLVER ARRIBA (§ CROMO-VOLVER-ARRIBA-1), gemelo de `resolverCromo` en FORMA (dominio
// CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el docstring de `VolverArribaContent` para el
// porqué de que no comparta objeto con `cromo`.
export function resolverVolverArriba(stored: unknown, defaults: unknown): VolverArribaContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['visible'];
  if (typeof sv === 'boolean') return { visible: sv };
  const dv = def['visible'];
  return { visible: typeof dv === 'boolean' ? dv : false };
}

// Resuelve RIEL SOCIAL (§ CROMO-RIEL-SOCIAL-1), gemelo de `resolverVolverArriba` en FORMA (dominio
// CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el docstring de `RielSocialContent` para el
// porqué de que no comparta objeto con `cromo` ni con `volverArriba`.
export function resolverRielSocial(stored: unknown, defaults: unknown): RielSocialContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['visible'];
  if (typeof sv === 'boolean') return { visible: sv };
  const dv = def['visible'];
  return { visible: typeof dv === 'boolean' ? dv : false };
}

// Resuelve la BARRA DE ENVÍO GRATIS DEL CARRITO (§ MUESTRARIO-CARRITO-BARRA-ENVIO-1), gemelo de
// `resolverRielSocial` en FORMA (dominio CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el
// docstring de `CarritoEnvioContent` para el porqué de que no comparta objeto con `cromo`,
// `volverArriba` ni `rielSocial`.
export function resolverCarritoEnvio(stored: unknown, defaults: unknown): CarritoEnvioContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['visible'];
  if (typeof sv === 'boolean') return { visible: sv };
  const dv = def['visible'];
  return { visible: typeof dv === 'boolean' ? dv : false };
}

// Resuelve el TRATAMIENTO DEL NAV (§ CROMO-NAV-TRATAMIENTO-1, ampliado por §
// CROMO-NAV-DIRECCION-SCROLL-1), gemelo de `resolverRielSocial` en FORMA (dominio CERRADO, SOFT,
// nunca lanza) pero meta PROPIA — ver el docstring de `NavTratamientoContent` para el porqué de que
// no comparta objeto con `cromo`, `volverArriba` ni `rielSocial`. `activo` y `direccion` se resuelven
// CADA UNO por su cuenta (mismo `bool()` que `resolverCromo`) — dos campos del mismo dominio, no dos
// mitades atadas: un guardado que sólo trae uno de los dos no debe borrar el otro en silencio.
export function resolverNavTratamiento(stored: unknown, defaults: unknown): NavTratamientoContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const bool = (k: string): boolean => {
    const sv = st[k];
    if (typeof sv === 'boolean') return sv;
    const dv = def[k];
    return typeof dv === 'boolean' ? dv : false;
  };
  // badgeColor (§ RIEL-SCROLL-Y-BADGE-DORADO-1): SOFT, mismo patrón que `raiz()` en `resolverTema`
  // — un hex de 6 dígitos válido, o cae a `defaults`, o `null`. Reusa `HEX6_TEMA` (declarado arriba,
  // junto a `resolverTema`): es el MISMO formato de valor (un hex de paleta), así que es el mismo
  // chequeo, no uno nuevo.
  const hex = (k: string): string | null => {
    const sv = st[k];
    if (typeof sv === 'string' && HEX6_TEMA.test(sv)) return sv;
    const dv = def[k];
    return typeof dv === 'string' && HEX6_TEMA.test(dv) ? dv : null;
  };
  return {
    activo: bool('activo'), direccion: bool('direccion'), filete: bool('filete'), cta: bool('cta'),
    posicion: bool('posicion'), subrayado: bool('subrayado'),
    badgeColor: hex('badgeColor'),
    // § NAV-MOVIL-SIN-BUSCAR-1: MISMO `bool()` que el resto — su default (`true`, § DEFAULTS.
    // navTratamiento arriba) es lo que hace que una fila SIN este campo (de antes de este slice)
    // resuelva a "se muestra", byte-idéntico a hoy.
    buscarMovil: bool('buscarMovil'),
  };
}

// El set CERRADO de `taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1) — mismo patrón de validación que
// `CLAVES_DRAWER_MOVIL`/`CLAVES_CARRITO` (abajo): sólo un miembro del set sobrevive, cualquier otra
// cosa (ausente, basura, un string fuera del set) cae al default.
const CLAVES_COLOR_TAGLINE = new Set<ColorTagline>(['atenuado', 'acento']);

// Resuelve el TRATAMIENTO DEL WORDMARK APILADO (§ CORTE-LOGO-APILADO-1), gemelo de
// `resolverNavTratamiento` en FORMA (dominio CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el
// docstring de `NavWordmarkContent` para el porqué de que no comparta objeto con `cromo`,
// `volverArriba`, `rielSocial` ni `navTratamiento`.
export function resolverNavWordmark(stored: unknown, defaults: unknown): NavWordmarkContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const sv = st['activo'];
  const activo = typeof sv === 'boolean' ? sv : (typeof def['activo'] === 'boolean' ? def['activo'] : false);
  // `taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1): mismo patrón de los dos `bool()`/closed-set de
  // arriba — stored válido gana; si no, el default válido; si tampoco, 'atenuado' (byte-idéntico a
  // hoy, ninguna fila lo declara todavía).
  const validoColor = (v: unknown): v is ColorTagline => CLAVES_COLOR_TAGLINE.has(v as ColorTagline);
  const svColor = st['taglineColor'];
  const dvColor = def['taglineColor'];
  const taglineColor = validoColor(svColor) ? svColor : (validoColor(dvColor) ? dvColor : 'atenuado');
  return { activo, taglineColor };
}

const CLAVES_DRAWER_MOVIL = new Set<ClaveDrawerMovil>(['dropdown', 'pantallaCompleta']);

// Resuelve la VARIANTE DEL DRAWER MÓVIL (§ MUESTRARIO-DRAWER-MOVIL-TEMA-1), gemela de
// `resolverNavWordmark` en FORMA (dominio CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el
// docstring de `NavDrawerMovilContent` para el porqué de que no comparta objeto con `cromo`,
// `volverArriba`, `rielSocial`, `navTratamiento` ni `navWordmark`. A diferencia de esos cuatro
// (un booleano), acá el valor es un STRING de un set CERRADO de 2 — mismo patrón de validación que
// `origenTexto`/`origenAccion` (§ `resolverTema`): sólo un miembro del set sobrevive, cualquier otra
// cosa (ausente, basura, un string fuera del set) cae al default.
export function resolverNavDrawerMovil(stored: unknown, defaults: unknown): NavDrawerMovilContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const valido = (v: unknown): v is ClaveDrawerMovil => CLAVES_DRAWER_MOVIL.has(v as ClaveDrawerMovil);
  const sv = st['variante'];
  if (valido(sv)) return { variante: sv };
  const dv = def['variante'];
  return { variante: valido(dv) ? dv : 'dropdown' };
}

const CLAVES_CARRITO = new Set<ClaveCarrito>(['anclado', 'flotante']);

// Resuelve la VARIANTE DE COMPOSICIÓN DEL CARRITO (§ MUESTRARIO-CARRITO-COMPOSICION-1), gemela de
// `resolverNavDrawerMovil` en FORMA (dominio CERRADO, SOFT, nunca lanza) pero meta PROPIA — ver el
// docstring de `CarritoContent` para el porqué de que no comparta objeto con `carritoEnvio` ni con
// ninguna de las metas de chrome del nav. A diferencia de los cinco booleanos (`volverArriba`,
// `rielSocial`, `carritoEnvio`, `navTratamiento`, `navWordmark`), acá el valor es un STRING de un
// set CERRADO de 2 — mismo patrón de validación que `navDrawerMovil`: sólo un miembro del set
// sobrevive, cualquier otra cosa (ausente, basura, un string fuera del set) cae al default.
export function resolverCarrito(stored: unknown, defaults: unknown): CarritoContent {
  const st = esObj(stored) ? stored : {};
  const def = esObj(defaults) ? defaults : {};
  const valido = (v: unknown): v is ClaveCarrito => CLAVES_CARRITO.has(v as ClaveCarrito);
  const sv = st['variante'];
  if (valido(sv)) return { variante: sv };
  const dv = def['variante'];
  return { variante: valido(dv) ? dv : 'anclado' };
}

const ESQUEMA_IDS = new Set<ClaveEsquema>(['crema', 'superficie', 'oscuro', 'acento', 'neutro']);

/**
 * Resuelve el mapa banda→esquema (§ eje 5b), gemelo de `resolverPaginas`/`resolverTema` pero
 * KEY-AGNÓSTICO: aquellas enumeran un set FIJO de páginas/raíces conocido de antemano por su
 * `defaults`; acá el set de bandaIds es ABIERTO —cualquier sección del home puede tener una
 * entrada—, así que se itera el GUARDADO, no un `def` fijo. Cada valor se valida contra el set
 * CERRADO de 5 esquemas (§ CORTE-HISTORIA-COLOR-FOTOS-1, `neutro`); basura (o una clave ausente)
 * NI SIQUIERA aparece en el resultado — es lo que hace que el consumidor la lea como "sin
 * override" (cae a su token canónico de hoy, § el mecanismo de byte-identidad). SOFT, nunca lanza.
 */
// Resuelve un campo MAPA de SECCIÓN (§ TIENDA-CHAMISAS-ALBUM-1, `SeccionDef.mapas`) — gemelo de
// `resolverEsquemas` (abajo), mismo criterio SOFT/key-agnóstico, pero el DOMINIO DE VALORES es un hex
// de 6 dígitos en vez de un set cerrado de ids. Una entrada sin hex válido NI SIQUIERA aparece en el
// resultado — la misma "sin override" que `resolverEsquemas`, nunca un clamp a una canónica (no hay
// canónica para un mapa id→color: el fallback "sin color elegido" lo decide el LLAMADOR, por orden
// de catálogo, § `lib/tienda/laminas.ts`).
const HEX6_MAPA = /^#[0-9a-fA-F]{6}$/;
export function resolverMapaColor(stored: unknown): Record<string, string> {
  const st = esObj(stored) ? stored : {};
  const out: Record<string, string> = {};
  for (const [id, val] of Object.entries(st)) {
    if (typeof val === 'string' && HEX6_MAPA.test(val)) out[id] = val;
  }
  return out;
}

export function resolverEsquemas(stored: unknown): EsquemasContent {
  const st = esObj(stored) ? stored : {};
  const out: EsquemasContent = {};
  for (const [banda, val] of Object.entries(st)) {
    if (typeof val === 'string' && ESQUEMA_IDS.has(val as ClaveEsquema)) out[banda] = val as ClaveEsquema;
  }
  return out;
}

/**
 * Resuelve el mapa bandaId→variante de BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1), gemelo
 * EXACTO de `resolverEsquemas`: KEY-AGNÓSTICO (cualquier bandaId puede tener entrada, se itera el
 * GUARDADO). A diferencia de `resolverEsquemas` (un set CERRADO único de 5 esquemas para toda banda),
 * acá el set de claves válidas es POR-BANDA (`VARIANTES_ESTRUCTURALES[banda].claves`) — como el set
 * de una sección normal es por-sección (`SeccionDef.variantes.claves`). Basura, una banda sin entrada
 * en `VARIANTES_ESTRUCTURALES`, o una clave fuera de su set: NI SIQUIERA aparece en el resultado — la
 * misma "sin override" que `resolverEsquemas`, no un clamp a la canónica (a diferencia de
 * `resolverVariante`, que SÍ clampa porque resuelve DENTRO de una sección que siempre necesita un
 * valor). SOFT, nunca lanza.
 */
export function resolverVariantesBandas(stored: unknown): VariantesBandasContent {
  const st = esObj(stored) ? stored : {};
  const out: VariantesBandasContent = {};
  for (const [banda, val] of Object.entries(st)) {
    const def = VARIANTES_ESTRUCTURALES[banda];
    if (def && typeof val === 'string' && def.claves.includes(val)) out[banda] = val;
  }
  return out;
}

/**
 * Resuelve el SNAPSHOT DE PRESET (§ REAPPLY-PRESERVA-OVERRIDES-1), gemelo de `resolverEsquemas`/
 * `resolverVariantesBandas` en FORMA (meta, no sección, key-agnóstica, resuelta aparte del loop) pero
 * DISTINTO en propósito y en validación: no es contenido que la tienda muestre ni que el dueño edite
 * — es CONTABILIDAD del motor de presets (`mergePresetEnContent`, `themes.ts`), y su único lector es
 * ese motor. Por eso NO clampa valores contra un set cerrado (a diferencia de `resolverEsquemas`): las
 * rutas que guarda son heterogéneas por naturaleza (`tema.fondo` es string, `cromo.navTinta` es
 * boolean, `orden` es un array), así que se pasa tal cual, sólo validando que el objeto GUARDADO sea
 * un objeto — no que cada valor lo sea. SOFT, nunca lanza: sin fila u objeto corrupto, cae a `{}`, el
 * mismo `{}` que hace que el PRIMER apply sobre un tenant se comporte como "sin snapshot" (§ el
 * docstring de `mergePresetEnContent`).
 */
export function resolverPresetSnapshot(stored: unknown): PresetSnapshotContent {
  return esObj(stored) ? { ...stored } : {};
}

const ORDEN_IDS = new Set<BandaId>(BANDA_IDS);

/**
 * Resuelve el ORDEN de las bandas del home (§ eje 5, parte c), gemelo de `resolverEsquemas` pero
 * con dominio CERRADO (`BANDA_IDS`) en vez de key-agnóstico. Filtra `stored` a ids CONOCIDOS,
 * DEDUPLICA (la primera aparición gana), y AGREGA al final —en el orden default— cualquier id
 * conocido que falte. Así un orden parcial, con repetidos, o pura basura SIEMPRE resuelve a la
 * lista COMPLETA de 7: ninguna banda puede caerse del home por un `orden` corrupto. `orden` NO
 * controla visibilidad (eso es `paginas`/`visible` por sección); es sólo SECUENCIA. SOFT, nunca
 * lanza — misma familia que el resto de los loaders de SiteContent.
 */
export function resolverOrden(stored: unknown): BandaId[] {
  const out: BandaId[] = [];
  const vistos = new Set<BandaId>();
  if (Array.isArray(stored)) {
    for (const v of stored) {
      if (typeof v === 'string' && ORDEN_IDS.has(v as BandaId) && !vistos.has(v as BandaId)) {
        out.push(v as BandaId);
        vistos.add(v as BandaId);
      }
    }
  }
  for (const id of BANDA_IDS) {
    if (!vistos.has(id)) out.push(id);
  }
  return out;
}

/**
 * Resuelve el orden de las bandas de /nosotros (§ NOSOTROS-SISTEMA-DE-BANDAS-1) — el HABILITADOR
 * que reemplaza los dos `import`s fijos de `app/(storefront)/nosotros/page.tsx` por un `.map` sobre
 * este resultado, igual que `resolverOrden` ya hace para la home. HOY no hay nada persistido que
 * leer (§ `BANDA_NOSOTROS_IDS`, arriba: sin campo en `SiteContentData`), así que no toma argumento y
 * SIEMPRE devuelve el orden canónico completo — el mismo orden que la página monta desde antes de
 * este slice. Es DELIBERADAMENTE parametrizada distinto de `resolverOrden` (que sí limpia un
 * `stored: unknown`): aceptar un parámetro que nadie va a pasar todavía sería una rama muerta. El día
 * que exista un campo que reordenar, ESTE es el único sitio que cambia — a leer y filtrar ese campo,
 * como `resolverOrden` — sin tocar su llamador en `page.tsx`.
 */
export function resolverOrdenNosotros(): readonly BandaNosotrosId[] {
  return BANDA_NOSOTROS_IDS;
}

const MENU_ITEM_ID_SET: ReadonlySet<string> = new Set(MENU_ITEM_IDS);

/** Resuelve las 3 posiciones guardadas del menú (§ CROMO-MENU-COMO-DATO-1, posibles vacías/basura/
 *  duplicadas) al orden final de ids: las válidas y sin repetir, en el orden en que aparecen; lo
 *  faltante se completa con las canónicas restantes, en su orden canónico. GEMELA de `resolverOrden`
 *  (mismo algoritmo — válido-y-primero-visto, luego rellenar con lo que falte en orden canónico—,
 *  otro dominio: `MenuItemId` en vez de `BandaId`), no una copia literal: `resolverOrden` está
 *  atada al tipo `BandaId[]`, así que generalizarla habría tocado el eje de bandas que este slice
 *  no toca. Un tenant que no edita nada da EXACTAMENTE `MENU_ITEM_IDS` — el orden de hoy. */
export function resolverOrdenMenu(posiciones: readonly unknown[]): MenuItemId[] {
  const out: MenuItemId[] = [];
  const vistos = new Set<MenuItemId>();
  for (const v of posiciones) {
    if (typeof v === 'string' && MENU_ITEM_ID_SET.has(v) && !vistos.has(v as MenuItemId)) {
      out.push(v as MenuItemId);
      vistos.add(v as MenuItemId);
    }
  }
  for (const id of MENU_ITEM_IDS) {
    if (!vistos.has(id)) out.push(id);
  }
  return out;
}

/** El LABEL editable de un ítem del menú (§ CROMO-MENU-COMO-DATO-1) — patrón `ctaPrimarioLabel`. */
export function labelDeItemMenu(menu: MenuContent, id: MenuItemId): string {
  if (id === 'tienda') return menu.labelTienda;
  if (id === 'suscripciones') return menu.labelSuscripciones;
  return menu.labelNosotros;
}

const MENU_PATHS: Record<MenuItemId, string> = {
  tienda: '/tienda',
  suscripciones: '/suscripciones',
  nosotros: '/nosotros',
};

// A qué página gatea cada ítem (§ VISIBILIDAD se queda como hoy): `tienda` no tiene página que
// apagar (SIEMPRE visible, como hoy); `suscripciones`/`nosotros` siguen leyendo
// `paginas.*.visible`, SIN CAMBIO — renombrar no es encender.
const MENU_PAGE_GATE: Partial<Record<MenuItemId, 'nosotros' | 'suscripciones'>> = {
  suscripciones: 'suscripciones',
  nosotros: 'nosotros',
};

/** Los ítems del menú a MOSTRAR, en el orden resuelto, con su label editable, su ruta y su BADGE
 *  (§ CORTE-BADGE-COSECHA-EN-MENU-1) —lo que `StoreNav.tsx` necesita para pintar el nav de
 *  escritorio y el drawer móvil (§ CROMO-MENU-COMO-DATO-1). El vocabulario ES la decisión de
 *  producto (qué se ve y en qué orden), así que vive acá y no en un `if` dentro del componente
 *  —mismo criterio que `estadoEntrega`/`lib/metrics/titulares.ts` (§ doctrina).
 *
 *  `badge` es OMITIDO del objeto (no `badge: ''`) cuando el ítem no lo lleva — nunca una clave con
 *  valor vacío/`undefined` — para que `itemsDeMenu` siga siendo BYTE-IDÉNTICO por `deepEqual` a los
 *  literales sin badge que `lib/config/menu-como-dato.test.ts` ya afirma (fuera de `touches:` de
 *  este slice, y `assert.deepEqual` trata una clave `undefined` como una DIVERGENCIA, no como
 *  ausente). Sale del ítem cuyo id coincide con `content.menu.badgeItem` Y trae `badgeTexto`
 *  no-vacío; un `badgeItem` que no matchea ningún id VISIBLE (fuera del set, o gateado por
 *  `paginas.*.visible`) no encuentra dónde mostrarse — preferir callar, mismo criterio que
 *  `menuCtaHref`.
 *
 *  `panel` (§ MUESTRARIO-MEGA-MENU-1) sigue el MISMO criterio de omisión que `badge`: ausente
 *  (nunca `panel: undefined`) para todo ítem sin panel — `panelDeMenuItem` ya devuelve `null` para
 *  TODOS los ids cuando `content.menu.panelItem` está vacío (el default), así que ningún tenant sin
 *  editar gana la clave — BYTE-IDÉNTICO por `deepEqual`, misma garantía que `badge`. Se resuelve
 *  DESPUÉS del filtro por página: un `panelItem` que apunte a un id ya excluido por
 *  `paginas.*.visible` nunca llega a `panelDeMenuItem`, así que tampoco puede sacar el panel de un
 *  ítem que no se muestra. */
export function itemsDeMenu(content: SiteContentData): { id: MenuItemId; label: string; path: string; badge?: string; panel?: MenuPanel }[] {
  const orden = resolverOrdenMenu([content.menu.posicion1, content.menu.posicion2, content.menu.posicion3]);
  const badgeItem = content.menu.badgeItem ?? '';
  const badgeTexto = content.menu.badgeTexto ?? '';
  return orden
    .filter((id) => {
      const gate = MENU_PAGE_GATE[id];
      return !gate || content.paginas[gate].visible;
    })
    .map((id) => {
      const panel = panelDeMenuItem(content, id);
      return {
        id,
        label: labelDeItemMenu(content.menu, id),
        path: MENU_PATHS[id],
        ...(id === badgeItem && badgeTexto ? { badge: badgeTexto } : {}),
        ...(panel ? { panel } : {}),
      };
    });
}

const MENU_CTA_DESTINO_SET: ReadonlySet<string> = new Set(MENU_CTA_DESTINOS);

/** El href de UN CTA de sección (§ MUESTRARIO-SECCION-CTA-1 — la capacidad GENERAL: cualquier
 *  sección puede declarar su PROPIO botón opcional, no sólo el menú), o `null` si no debe mostrarse:
 *  sin label, sin destino válido (fuera del set cerrado `MENU_CTA_DESTINOS`), o apuntando a una
 *  página apagada (§ paginas.*.visible) — preferir callar a un link roto, mismo criterio que
 *  `opcionTransferencia`/el CTA de suscripciones sin whatsapp. Recibe sólo lo que necesita (el
 *  label, el destino, y el estado de `paginas`) en vez de todo `SiteContentData`, para que cualquier
 *  sección la invoque sin acoplarse al modelo del menú — `menuCtaHref` (abajo) es hoy su primer
 *  caso particular, no su dueña. */
export function resolverCtaSeccion(label: string, destino: string, paginas: PaginasContent): string | null {
  if (label.trim() === '') return null;
  if (!MENU_CTA_DESTINO_SET.has(destino)) return null;
  if (destino === '/suscripciones' && !paginas.suscripciones.visible) return null;
  if (destino === '/nosotros' && !paginas.nosotros.visible) return null;
  return destino;
}

/** El href del CTA del menú — caso particular de `resolverCtaSeccion` sobre `content.menu`. */
export function menuCtaHref(content: SiteContentData): string | null {
  return resolverCtaSeccion(content.menu.ctaLabel, content.menu.ctaDestino, content.paginas);
}

// ─── El PANEL desplegable del menú (mega-menu, § MUESTRARIO-MEGA-MENU-1) ────────────────────────

/** Un enlace de columna del panel, o `null` si no debe mostrarse. MISMO criterio que
 *  `resolverCtaSeccion` (sin etiqueta, destino fuera del set cerrado, o página apagada → `null`,
 *  preferir callar a un link roto), con un campo más: `nota`, el texto secundario que el prototipo
 *  muestra al lado del label (ahí un precio de producto; acá TEXTO del dueño — nunca un dato
 *  derivado del catálogo, no se deriva ningún precio acá). */
export interface MenuPanelEnlace { etiqueta: string; nota: string; destino: string; }

function resolverEnlacePanel(etiqueta: string, nota: string, destino: string, paginas: PaginasContent): MenuPanelEnlace | null {
  const href = resolverCtaSeccion(etiqueta, destino, paginas);
  if (href === null) return null;
  return { etiqueta, nota, destino: href };
}

/** Una columna del panel, o `null` si no debe mostrarse: sin título Y sin ningún enlace vivo —
 *  MISMO criterio OR que Presentaciones 2-4 (título O contenido, § CLAUDE.md "El criterio es OR, no
 *  AND"), aplicado acá a "título O algún enlace" en vez de "título O imagen". Los enlaces muertos
 *  (sin etiqueta, o con destino inválido) se OMITEN de la lista, nunca dejan un hueco. */
export interface MenuPanelColumna { titulo: string; enlaces: MenuPanelEnlace[]; }

function resolverColumnaPanel(titulo: string, enlaces: (MenuPanelEnlace | null)[]): MenuPanelColumna | null {
  const vivos = enlaces.filter((e): e is MenuPanelEnlace => e !== null);
  if (titulo.trim() === '' && vivos.length === 0) return null;
  return { titulo, enlaces: vivos };
}

/** El panel completo de UN ítem: intro (copy + CTA), columnas de sub-enlaces, tarjeta promocional
 *  (imagen + título + CTA) — medido contra el prototipo (`docs/prototipos/cafeone/index.html:57-89`,
 *  `#mega-cafe`). */
export interface MenuPanel {
  intro: string;
  introCtaHref: string | null;
  introCtaLabel: string;
  columnas: MenuPanelColumna[];
  tarjetaImagen: string;
  tarjetaTitulo: string;
  tarjetaCtaHref: string | null;
  tarjetaCtaLabel: string;
}

/** El panel de un ítem, o `null` si no lleva uno — UN panel a la vez, atado a `content.menu.panelItem`
 *  (SET CERRADO `MENU_ITEM_IDS`, MISMO patrón que `badgeItem`/`itemsDeMenu`). Devuelve `null` también
 *  cuando el panel está a MEDIAS/VACÍO (ningún campo con contenido real): preferir callar a un
 *  desplegable sin nada adentro, mismo criterio que el resto de esta sección — vacío = el ítem sigue
 *  siendo un link plano. */
export function panelDeMenuItem(content: SiteContentData, id: MenuItemId): MenuPanel | null {
  const m = content.menu;
  if ((m.panelItem ?? '') !== id) return null;

  const columnas = [
    resolverColumnaPanel(m.panelCol1Titulo ?? '', [
      resolverEnlacePanel(m.panelCol1Link1Etiqueta ?? '', m.panelCol1Link1Nota ?? '', m.panelCol1Link1Destino ?? '', content.paginas),
      resolverEnlacePanel(m.panelCol1Link2Etiqueta ?? '', m.panelCol1Link2Nota ?? '', m.panelCol1Link2Destino ?? '', content.paginas),
      resolverEnlacePanel(m.panelCol1Link3Etiqueta ?? '', m.panelCol1Link3Nota ?? '', m.panelCol1Link3Destino ?? '', content.paginas),
    ]),
    resolverColumnaPanel(m.panelCol2Titulo ?? '', [
      resolverEnlacePanel(m.panelCol2Link1Etiqueta ?? '', m.panelCol2Link1Nota ?? '', m.panelCol2Link1Destino ?? '', content.paginas),
      resolverEnlacePanel(m.panelCol2Link2Etiqueta ?? '', m.panelCol2Link2Nota ?? '', m.panelCol2Link2Destino ?? '', content.paginas),
      resolverEnlacePanel(m.panelCol2Link3Etiqueta ?? '', m.panelCol2Link3Nota ?? '', m.panelCol2Link3Destino ?? '', content.paginas),
    ]),
  ].filter((c): c is MenuPanelColumna => c !== null);

  const intro = m.panelIntro ?? '';
  const tarjetaImagen = m.panelTarjetaImagen ?? '';
  const tarjetaTitulo = m.panelTarjetaTitulo ?? '';
  const hayContenido = intro.trim() !== '' || columnas.length > 0 || tarjetaImagen.trim() !== '' || tarjetaTitulo.trim() !== '';
  if (!hayContenido) return null;

  return {
    intro,
    introCtaHref: resolverCtaSeccion(m.panelIntroCtaLabel ?? '', m.panelIntroCtaDestino ?? '', content.paginas),
    introCtaLabel: m.panelIntroCtaLabel ?? '',
    columnas,
    tarjetaImagen,
    tarjetaTitulo,
    tarjetaCtaHref: resolverCtaSeccion(m.panelTarjetaCtaLabel ?? '', m.panelTarjetaCtaDestino ?? '', content.paginas),
    tarjetaCtaLabel: m.panelTarjetaCtaLabel ?? '',
  };
}

// Resuelve el array de items de una sección repeater. Cada ítem: los campos `requerido`/`opcional`
// (strings) se normalizan a string —el editor valida los requeridos, así que acá sólo se garantiza
// la forma—; los demás campos del ítem (p. ej. un rating numérico) pasan TAL CUAL. Un valor que no
// es objeto se descarta. NUNCA lanza (loader SOFT).
export function resolverItems(
  itemCampos: Record<string, CampoTipo>,
  storedItems: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(storedItems)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of storedItems) {
    if (!esObj(item)) continue;
    const resuelto: Record<string, unknown> = { ...item }; // passthrough (rating numérico, etc.)
    for (const [campo, tipo] of Object.entries(itemCampos)) {
      const val = item[campo];
      if (tipo === 'requerido') {
        resuelto[campo] = typeof val === 'string' ? val : '';
      } else {
        resuelto[campo] = campo in item ? (val ?? '') : '';
      }
    }
    out.push(resuelto);
  }
  return out;
}

/**
 * Overlay POR SECCIÓN del borrador sobre lo publicado, EN CRUDO (antes de resolver). Cada
 * sección presente en `borrador` PISA por completo la de `content` —el editor guarda secciones
 * completas, no campos sueltos—; las no borroneadas quedan como en `content`. El resultado es el
 * objeto crudo que el loader de borrador pasa a `resolverSiteContent`. Publicar una sección no
 * arrastra otra porque el borrador es un mapa PARCIAL (sólo trae las secciones borroneadas).
 */
export function mezclarBorrador(content: unknown, borrador: unknown): Record<string, unknown> {
  const c = esObj(content) ? content : {};
  const b = esObj(borrador) ? borrador : {};
  return { ...c, ...b };
}

/**
 * ¿Se muestra la sección? `visible` + hide-on-empty para repeaters. Recibe el def y la
 * sección ya resuelta (parametrizado para probarlo sin depender del REGISTRY global).
 *  · `ocultable: false` → siempre visible, salvo que sea repeater y su array esté vacío.
 *  · repeater → se oculta con el array vacío, aunque `visible` sea true.
 */
// `sec: object` para aceptar tanto los literales de test como los tipos de sección CONCRETOS
// (`BrandStoryContent`, …), que no tienen index signature y por eso no encajan en un
// `Record<string, unknown>` a secas. Se lee por el cast (`visible` e `itemsKey` del repeater).
export function seccionEsVisible(def: SeccionDef, sec: object): boolean {
  const rec = sec as Record<string, unknown>;
  const items = def.repeater ? rec[def.repeater.itemsKey] : undefined;
  const tieneItems = Array.isArray(items) && items.length > 0;

  if (def.repeater && !tieneItems) return false; // hide-on-empty gana sobre todo
  if (!def.ocultable) return true;                // no se puede ocultar (hero)
  return rec.visible !== false;
}

/**
 * ¿Debe mostrarse /preguntas-frecuentes —y su enlace, en el footer— (§ SUSCRIPCIONES-FAQ-DATO-1)?
 * Compone DOS condiciones: la CAPACIDAD de suscripciones está encendida
 * (`paginas.suscripciones.visible` — la FAQ es hoy contenido de esa capacidad, la misma que gatea el
 * 2º CTA del hero, el nav, el footer y el bloque de la home, § Backlog #49) Y la sección
 * `suscripcionFaq` se muestra (`seccionEsVisible`, que ya cubre su propio toggle Y hide-on-empty).
 * Sin las dos, la página quedaría en BLANCO —su único contenido es esta FAQ— y su enlace apuntaría a
 * nada. UNA función para los DOS consumidores (la ruta y `StoreFooter`): escribir la condición dos
 * veces es la falla de las dos declaraciones que este repo ya pagó varias veces (§ CLAUDE.md,
 * `razonDelServidor`/`cruzoMinimo`).
 */
export function faqSuscripcionesVisible(content: SiteContentData): boolean {
  return content.paginas.suscripciones.visible && seccionEsVisible(REGISTRY.suscripcionFaq, content.suscripcionFaq);
}

// LOS HREFS DE LAS 5 COLUMNAS DEL PIE SON ESTRUCTURA (§ el docstring de `FooterContent`, arriba):
// rutas reales del storefront, nunca dato libre.
const HREF_FOOTER_TIENDA = '/tienda';
const HREF_FOOTER_SUSCRIPCIONES = '/suscripciones';
const HREF_FOOTER_RASTREAR_PEDIDO = '/rastrear-pedido';
const HREF_FOOTER_PREGUNTAS_FRECUENTES = '/preguntas-frecuentes';
const HREF_FOOTER_NUESTRA_HISTORIA = '/nosotros';

export interface FooterLinkColumnas {
  tienda: { label: string; href: string }[];
  ayuda: { label: string; href: string }[];
  empresa: { label: string; href: string }[];
}

/**
 * Arma las TRES columnas de enlaces del pie desde `content.footer` (§ MUESTRARIO-FOOTER-TEMA-1),
 * PURA — capa 1, sin componente/jsdom, por la MISMA razón que `itemsDeMenu`/`menuCtaHref`: es
 * exactamente lo que `StoreFooter.tsx` pinta, sin necesitar su render. Aplica el MISMO filtrado por
 * página visible que existía antes del slice (lógica, no dato): "Suscripciones" se oculta si esa
 * página está apagada, "Preguntas Frecuentes" si la FAQ está vacía, "Nuestra Historia" si /nosotros
 * está apagada. Ninguna columna queda vacía — cada una tiene al menos un enlace que NUNCA se oculta
 * (Todos los productos · Rastrear Pedido); "Empresa" es la única que PUEDE quedar vacía (su único
 * enlace es condicional), y el consumidor decide qué hacer con eso (§ `StoreFooter.tsx`).
 */
export function columnasDeFooter(content: SiteContentData): FooterLinkColumnas {
  const { footer, paginas } = content;
  const faqVisible = faqSuscripcionesVisible(content);
  return {
    tienda: [
      { label: footer.linkTienda, href: HREF_FOOTER_TIENDA },
      ...(paginas.suscripciones.visible ? [{ label: footer.linkSuscripciones, href: HREF_FOOTER_SUSCRIPCIONES }] : []),
    ],
    ayuda: [
      { label: footer.linkRastrearPedido, href: HREF_FOOTER_RASTREAR_PEDIDO },
      ...(faqVisible ? [{ label: footer.linkPreguntasFrecuentes, href: HREF_FOOTER_PREGUNTAS_FRECUENTES }] : []),
    ],
    empresa: [
      ...(paginas.nosotros.visible ? [{ label: footer.linkNuestraHistoria, href: HREF_FOOTER_NUESTRA_HISTORIA }] : []),
    ],
  };
}

/**
 * El PIN de SPOTLIGHT resuelto contra un catálogo (§ SPOTLIGHT-BANDA-1, ver el docstring de
 * `SpotlightContent`): el producto que la banda muestra. GENÉRICO —pide sólo un `slug`, no
 * importa `Product`— para que este módulo de CONFIG no dependa del tipo de dominio del catálogo;
 * el llamador real (`components/storefront/home/Spotlight.tsx`) lo instancia con `Product[]`.
 *
 * Dos casos SIN romper (§ SPOTLIGHT-CAPACIDAD-CENSO-1, "la decisión es PUNTERO, no copia"):
 *  · el `slug` no está vacío pero no matchea NINGÚN producto (se borró, o nunca existió) — la
 *    banda cae al PRIMER producto del catálogo VIVO, nunca a un componente roto. Mismo patrón
 *    que el destino inexistente de Presentaciones (`categoriasDelCatalogo`/`hrefCategoria`): se
 *    declara un fallback, no se esconde el bloque a medias.
 *  · el catálogo está VACÍO — no hay NADA que mostrar, ni el fallback tiene sentido: `null`
 *    (hide-on-empty, gemelo de un repeater con `items: []`).
 */
export function productoSpotlight<T extends { slug: string }>(catalog: readonly T[], slug: string): T | null {
  if (catalog.length === 0) return null;
  return catalog.find((p) => p.slug === slug) ?? catalog[0];
}

/**
 * El producto de "la OTRA talla" (§ SPOTLIGHT-BANDA-1, el eje tamaño como ENLACE, no como
 * variante agrupada — Backlog #62 no se dispara, § SPOTLIGHT-CAPACIDAD-CENSO-1). A diferencia de
 * `productoSpotlight`, NO cae a ningún fallback: un `slug` vacío o que no matchea ningún producto
 * significa "no hay otra talla que ofrecer", y el componente simplemente OMITE el control — mismo
 * criterio que `menuCtaHref` (preferir callar a un link roto, no inventar un destino).
 */
export function productoOtraTalla<T extends { slug: string }>(catalog: readonly T[], slug: string): T | null {
  if (!slug) return null;
  return catalog.find((p) => p.slug === slug) ?? null;
}

/**
 * El pin de la tarjeta FLOTANTE de `marquesina` (§ HERO-SIN-TARJETA-Y-PDP-IMAGEN-1), resuelto SIN
 * el fallback de `productoSpotlight`: un `slug` vacío o que no matchea ningún producto devuelve
 * `null` — hide-on-empty de la tarjeta, nunca un producto arbitrario del catálogo. MISMO criterio
 * que `productoOtraTalla` (arriba), copiado en vez de reusado a propósito: `productoOtraTalla` es
 * el pin de "la OTRA talla", y llamarlo desde el pin de la marquesina confundiría a quien lea el
 * código — dos conceptos distintos que comparten la MISMA regla ("sin match, sin fallback"), no
 * el mismo concepto con dos nombres.
 *
 * `productoSpotlight` (arriba) SÍ conserva su fallback al primer producto: esa es la banda
 * `spotlight`, donde la banda ENTERA está dedicada a un producto y "sin match, mostrar el
 * primero" es la decisión correcta. La tarjeta de `marquesina` es un elemento OPCIONAL sobre una
 * banda de texto que no depende de ella — sin un pin real, no hay nada honesto que mostrar.
 * Consumida por `Marquesina.tsx` (la banda suelta) y `HeroMediaMarquesina.tsx` (el hero·sticky de
 * CORTE) — las dos leen el MISMO campo `marquesina.productoSlug`.
 */
export function productoMarquesina<T extends { slug: string }>(catalog: readonly T[], slug: string): T | null {
  if (!slug) return null;
  return catalog.find((p) => p.slug === slug) ?? null;
}

/** El tope de la LISTA de productos de la sección suelta Marquesina (§ EDITOR-TIENDA-MARQUESINA-
 *  SECCION-1) — `producto1..producto6` son SEIS slots, y el fallback al catálogo (abajo) respeta el
 *  mismo tope. Re-exportado por `lib/animation.ts` (`MAX_ITEMS_BANDA_MARQUESINA`) para que el tope
 *  de la coreografía y el tope del dato no puedan divergir — ver su docstring. */
export const MAX_PRODUCTOS_BANDA_MARQUESINA = 6;

/**
 * La lista de productos de la sección SUELTA Marquesina (§ EDITOR-TIENDA-MARQUESINA-SECCION-1),
 * resuelta a partir de los SEIS slots (`producto1..producto6`) — en el ORDEN de los slots, filtrando
 * los vacíos y los que ya no matchean ningún producto del catálogo VIVO (mismo criterio que
 * `productoMarquesina`: un slot roto se filtra, nunca cae a un producto arbitrario).
 *
 * LISTA VACÍA (los seis slots vacíos, o los seis rotos) → cae al CATÁLOGO, en SU orden, hasta el
 * mismo tope — es una VITRINA, no un PIN: con la sección encendida y nada elegido todavía, mostrar
 * "nada" sería peor que mostrar los cafés que SÍ existen. Catálogo vacío → `[]` (hide-on-empty de
 * toda la sección, decisión del componente, no de esta función).
 */
export function productosBandaMarquesina<T extends { slug: string }>(
  catalog: readonly T[],
  slugs: readonly string[],
): T[] {
  const elegidos = slugs
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => catalog.find((p) => p.slug === s))
    .filter((p): p is T => !!p);
  if (elegidos.length > 0) return elegidos.slice(0, MAX_PRODUCTOS_BANDA_MARQUESINA);
  return catalog.slice(0, MAX_PRODUCTOS_BANDA_MARQUESINA);
}
