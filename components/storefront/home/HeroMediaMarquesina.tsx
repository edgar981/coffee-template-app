"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Image from "next/image";

import { motion, useReducedMotion, useTransform } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import CampoEditable, { useRutaEnEdicion } from "@/components/storefront/CampoEditable";
import { objectPositionDePuntoFocal, productoMarquesina } from "@/lib/config/site-content-defaults";
import { HERO_VIDEO_MOVIL_MEDIA, HERO_VIDEO_ESCRITORIO_MEDIA, tieneVideoMovil, fuentesVideoHero, posterVideoMovil } from "@/lib/config/hero-video";
import {
  useProgresoScrollDesdeTope, veloOpacidad, rangoVeloDeIntensidad,
  claseAlturaAncestroMarquesina, UMBRAL_ENTRADA_TARJETA_MARQUESINA,
} from "@/lib/animation";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { MarquesinaFraseMotor, MarquesinaTarjetaMotor } from "@/components/storefront/home/MarquesinaMotor";
import { estiloInlineDeElemento } from "@/lib/config/estilo-elemento";

// EL COMPONENTE DE LA VARIANTE "STICKY" DEL HERO (§ MUESTRARIO-HERO-MARQUESINA-STICKY-1) — la
// CUARTA composición (tras curtina/ficha/media, § HeroSection.tsx: `VARIANTES.sticky`), y la que
// reemplaza el diagnóstico del owner («las letras del marquee salen lit sobre el hero, no en una
// sección abajo») con lo que el tema REAL construye: NO dos bandas apiladas (hero +
// `Marquesina.tsx` debajo, la forma de hoy bajo CORTE) sino UNA sola composición pineada, con el
// texto y la tarjeta pasando POR ENCIMA de la media del hero mientras ésta queda fija.
//
// LA CLAVE DE VARIANTE ES `'sticky'`, NO `'marquesina'` — pese a que el ARCHIVO/COMPONENTE se llama
// `HeroMediaMarquesina` (por lo que HACE: media de hero + contenido de marquesina) y a que TODO su
// contenido sale de la sección `marquesina`. `'marquesina'` como CLAVE de variante ya está
// reservada en `PLIEGO.variantes.hero` (themes.ts) para una composición ajena; ver el docstring de
// `HeroSection.tsx`/`REGISTRY.hero.variantes` (site-content-defaults.ts) para el desvío medido.
//
// MEDIDO CONTRA EL TEMA REAL — VERIFICADO POR EJECUCIÓN (`node --eval "fetch(...)"` contra
// `https://x-cafeone.myshopify.com/`, no sólo citado del spec), buscando `hero_banner_marquee`: es
// `<xo-parallax class="h:300vh">` envolviendo `<div class="pos:sticky t:s0 h:100vh …">` — el panel
// pineado mide `100vh` DENTRO de un ancestro de `300vh` (100vh propios + 200vh de presupuesto de
// scroll). Adentro del panel: el VIDEO de fondo (`<xo-video-cover>`), un velo negro cuya opacidad
// en el sitio real ANIMA con el scroll (`xo-parallax-scroll` con keyframes 0→0.6 entre 20%-40% del
// progreso — NO un plano estático), una capa de TEXTO `pos:absolute;t:50%;
// trf:translateY(-50%);z:10` que envuelve un ticker `<xo-marquee xo-speed="1">` (auto-scroll
// CONTINUO por velocidad/tiempo, independiente del scroll de página) con su propio reveal de
// entrada (slide-up + fade, otro `xo-parallax-scroll`), y la TARJETA de producto con su propio
// reveal de entrada (slide-up + fade, SIN escala ni rotación), en `z:100`. El efecto visible: el
// hero queda PEGADO mientras el texto y la tarjeta aparecen y se mueven por encima.
//
// ESTA VARIANTE REPLICA LA ESTRUCTURA (sticky + velo opt-in + texto-encima + tarjeta-encima) Y, DESDE
// § CORTE-HERO-VELO-OFF-Y-TICKER-1, TAMBIÉN EL EJE HORIZONTAL DEL TEXTO — RONDA 3, QUE REVIERTE LA
// DECISIÓN ORIGINAL. La primera versión (arriba, histórica) ataba el desplazamiento horizontal al
// SCROLL (`transformMarquesinaTexto`, la función que `Marquesina.tsx` ya usaba) por una decisión
// EXPLÍCITA del spec de `MUESTRARIO-HERO-MARQUESINA-STICKY-1` ("reusá el motor de scroll… no agregues
// librería"). El owner, sobre el tema real: «las letras… están continuamente desplazándose
// horizontalmente, como un aviso, no estático» — es LITERALMENTE lo que ese spec original prohibió
// reproducir (§ RONDA 3, el bloque del ticker más abajo, y § el docstring de `VELOCIDAD_TICKER_PX_S`
// en `lib/animation.ts`, donde vive la medición contra el JS del tema real). El eje VERTICAL (el
// revelado por scroll, § RONDA 3 más abajo) no cambió: sigue siendo scroll-scrubbed, sin tocar. La
// TARJETA sigue usando `transformMarquesinaTarjeta` (scroll-driven, sin cambios) — el pedido del
// owner es sobre el TEXTO, no sobre la tarjeta, y no hay evidencia de que la tarjeta deba cambiar de
// motor. **ESTO YA NO ES CIERTO desde § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02)** — un gate
// POSTERIOR sí pidió que la tarjeta cambiara de motor (de escala/rotación al mismo revelado
// enmascarado que la frase); ver "LA ENTRADA DE LA TARJETA" en el cuerpo del componente, más abajo.
//
// `docs/prototipos/cafeone/` DERIVA DEL TEMA Y YA NO ES LA AUTORIDAD PARA ESTA BANDA. Su `.marquee`
// (que `Marquesina.tsx` reproduce fielmente) es una SEGUNDA sección, aparte del `.hero`, con su
// propia foto de fondo velada al 55% — la forma de DOS bandas apiladas que el owner reportó como
// mala tres veces. El tema real las fusionó en una; esta variante hace lo mismo en nuestro modelo.
//
// REUSA CONTENIDO, NO LO DUPLICA (instrucción explícita del spec: "si te parece que deben ser
// campos propios del hero, PARÁ y reportá — duplicar el dato es peor"). El texto del loop y el pin
// de la tarjeta flotante YA VIVEN en `marquesina` (`texto`/`productoSlug`, § `MarquesinaContent`) —
// el MISMO mecanismo que `Marquesina.tsx` ya usa (`productoMarquesina`, § HERO-SIN-TARJETA-Y-PDP-
// IMAGEN-1, puntero al `Product` vivo, nunca copia, SIN fallback al primer producto del catálogo). Esta variante los LEE directo, sin depender de `marquesina.visible`: la banda
// SUELTA (`Marquesina.tsx`) sigue siendo su propio interruptor, independiente de qué variante de
// hero esté activa — es responsabilidad del PRESET que active esta variante apagar también la banda
// suelta con `bandasVisibles.marquesina:false` (§ MUESTRARIO-BANDA-APAGABLE-1), para no mostrar el
// mismo contenido dos veces (una acá, encima del hero; otra en su propia banda, debajo). Esta
// variante NO lo apaga por sí misma — no le corresponde decidir la visibilidad de OTRA sección.
//
// EL FONDO/VELO SON DEL PROPIO HERO, COMO LAS DEMÁS VARIANTES: `hero.imagen`/`imagenTipo`/
// `imagenPoster`/`puntoFocal` (video o imagen, con el mismo punto focal de HERO-PUNTO-FOCAL-1) —
// `marquesina.imagen` (la foto de la banda suelta) NO se usa acá, porque el fondo de ESTA
// composición es el del HERO, no el de la marquesina. `marquesina` sólo aporta el TEXTO y el PIN.
//
// EL VELO — RONDA 2 (§ CORTE-HERO-STICKY-RONDA-2-1): DEJÓ DE SER UN OVERLAY SIEMPRE-ENCENDIDO. La
// primera versión de esta variante lo fijaba al 80% horneado en `--sf-velo` en TODO momento —el
// owner, sobre el prototipo aplicado, reportó "el velo... lo oscurece mucho... se ve opaca la
// página"—. Ahora la OPACIDAD DEL ELEMENTO (el `opacity` CSS del `<div>`, una segunda capa de alfa
// que multiplica al 80% ya horneado en el token) sigue el MISMO `progreso` de scroll que ya mueve
// texto/tarjeta, vía `veloOpacidad` (`lib/animation.ts`): casi transparente en reposo (el PISO
// `VELO_OPACIDAD_PISO`, medido por contraste — ver el docstring de esa función para los tres números
// contra las fotos de referencia de `HeroMedia.tsx`), denso al final del recorrido — la MISMA
// dirección que el `xo-parallax-scroll` 0→0.6 real (§ el comentario de cabecera), sin replicar sus
// keyframes exactos. **EL COLOR SIGUE SALIENDO DEL TOKEN**: el fondo del `<div>` sigue siendo
// `bg-[var(--sf-velo)]`, sin tocar; sólo se le agrega un `style.opacity` animado por encima — nunca
// un rgba horneado ni un segundo color. Bajo `estatico` (reduced-motion/preview) el velo NO puede
// quedar en el piso semitransparente —no hay scroll que lo densifique—, así que rinde la MISMA
// densidad de HOY (1 → efectiva 0.80).
//
// EL VELO ES OPT-IN — RONDA 3 (§ CORTE-HERO-VELO-OFF-Y-TICKER-1): `hero.veloVisible` (default
// `true`, § `HeroContent.veloVisible` en site-content-defaults.ts) decide si el `<motion.div>` del
// velo se MONTA en absoluto — no un `opacity:0` disfrazado, el nodo directamente no existe cuando es
// `false`. El owner, sobre CORTE aplicado: «ese velo verde debemos quitarlo, hace que el video se vea
// sin calidad» — CORTE apagó el toggle en ESA ronda (`heroVeloVisible:false`, § themes.ts).
//
// EL VELO VUELVE, PERO SUAVE — RONDA 4 (§ CORTE-HERO-REVELADO-MASCARA-1): sobre el gate visual de
// ESTA ronda, el owner pidió reencenderlo, con una intensidad más suave que la de siempre — CORTE
// pasa a `heroVeloVisible` en su default `true` (ya no lo declara apagado) y agrega
// `heroVeloIntensidad:'suave'`. El mecanismo de `veloOpacidad` (piso/techo, la densidad) NO cambió de
// FORMA — ganó un TERCER parámetro (`rango`, derivado de `hero.veloIntensidad` vía
// `rangoVeloDeIntensidad`) con default = el rango de SIEMPRE, así que todo tema que no declare la
// intensidad queda BYTE-IDÉNTICO. El contraste medido para 'suave' (y por qué queda bajo AA sin
// bloquear la decisión) vive en el docstring de `veloOpacidad`, `lib/animation.ts`.
//
// ALTURALLENA sigue SIN leerse acá (decisión ORIGINAL, sin cambios en esta ronda): es un agregado de
// `HeroMedia.tsx` para su propio caso (una sección NO pineada que puede o no llenar el viewport); lo
// medido contra el tema real es un panel SIEMPRE de `height:100vh` fijo (nunca `92vh`), así que esta
// variante usa `h-[100svh]` incondicional sin necesitar el toggle.
//
// CUEDESLIZA — RONDA 2 (§ CORTE-HERO-STICKY-RONDA-2-1): SÍ SE LEE, a diferencia de la decisión
// original ("esta variante no declara ningún cue propio... el gesto de pasar por encima del
// marquee ya ES la indicación"). El owner lo pidió VISIBLE, y CORTE (el único preset que hoy pide
// `hero:'sticky'`) YA declara `heroCueDesliza:true` (`lib/config/themes.ts`) — un dato que existía y
// que, antes de esta ronda, ningún render leía (§ `hero-toggles-preset.test.ts`, el caso que este
// slice invierte). Se lee el MISMO campo `hero.cueDesliza` que `HeroMedia.tsx` ya declara —sin
// inventar uno nuevo, instrucción explícita del spec— y se rinde el MISMO marcado
// (`data-hero-cue="desliza"`, la línea con el segmento que la recorre + la etiqueta "Desliza"),
// verbatim, para no duplicar ni divergir la única implementación del cue. Mismo gate que allá:
// `!preview` (scrollear no significa nada en un marco de vista previa) y sin guard propio de
// reduced-motion (`ReducedMotionProvider`, montado en el layout, ya congela el `y` animado del
// segmento — § el docstring de `ReducedMotionProvider`, `lib/animation.ts`).
//
// LA FRASE AL PIE — § HERO-FRASE-AL-PIE-Y-PREVIEW-1 (esta variante NO la leía hasta este slice,
// pese a que `HeroMedia.tsx` — la variante `'media'` — ya la rinde desde `TEMAS-HERO-MEDIA-
// AGREGADOS-1). El owner, sobre el panel: quiso cargar el `.hero-caption` del prototipo («Hay algo
// profundamente meditativo en preparar un café cultivado a 1.600 msnm.», `docs/prototipos/cafeone/
// index.html:133-136`) y no encontró dónde — el campo (`hero.fraseAlPie`) YA EXISTÍA en el modelo
// (declarado en `REGISTRY.hero.campos` desde `TEMAS-HERO-MEDIA-AGREGADOS-1`), pero esta variante
// nunca lo leía Y el panel nunca lo controlaba (§ `PENDIENTE_PANEL`, `lib/config/panel-controles.ts`
// — cerrado por este mismo slice). MISMO campo y MISMO `max-w-[34ch] text-right text-balance` que
// `HeroMedia.tsx` — el TOKEN DE COLOR DIVERGE desde § HERO-FRASE-COLOR-PLENO-1 (ver abajo, "EL
// COLOR — LA CAUSA REAL"): esta variante pasa a `--sf-sobre-banda` (pleno); `HeroMedia.tsx`, fuera de
// `touches:` de esa ronda, se queda en `--sf-sobre-banda-suave` — divergencia MEDIDA y deliberada, no
// un descuido: nace de que esta variante compone con el marquee/cue (ya pleno) y `HeroMedia.tsx` no.
// Misma posición del prototipo: al pie, alineada a la derecha, ENFRENTADA al cue "Desliza" (bottom-
// izquierda) — la MISMA fila del `.hero-inner` del prototipo (`.hero-caption` viene ANTES de
// `.scroll-cue` en su propio HTML, `margin-left:auto` la empuja a la derecha mientras `.scroll-cue`
// es `left:var(--page-gutter)`). Acá va como bloque `absolute` PROPIO —espejo horizontal de
// `data-hero-cue`, mismos offsets `bottom-8/sm:bottom-10/lg:bottom-12`— porque esta variante no
// tiene un `.hero-inner` flex-column común a los dos (a diferencia de `HeroMedia.tsx`). Vacío → SE
// OMITE (byte-idéntico, como en `HeroMedia.tsx` y como el resto de los `campos` opcionales del hero,
// § "la frontera fina de defaults-como-fallback" en CLAUDE.md). Sin animación de entrada, igual que
// el cue: vive FUERA del loop de texto/tarjeta, así que no comparte su stagger ni su revelado.
//
// **NO se gatea en `!preview`, A DIFERENCIA DEL CUE.** El cue anima un scroll que en preview no
// significa nada; la frase es TEXTO ESTÁTICO (no depende de `progreso`/`estatico`), y el spec de este
// slice pide explícito que el "cuadro compuesto" de la vista previa la muestre SI HAY TEXTO — omitirla
// en preview dejaría al dueño sin ver el campo que acaba de escribir, en la única superficie donde lo
// está mirando en vivo.
//
// EL PESO — § CROMO-NAV-EXACTO-PROTOTIPO-1 (`font-medium`, DEVIACIÓN medida en su momento) —
// REVERTIDO por § HERO-FRASE-COLOR-PLENO-1 (ver debajo, "EL COLOR — LA CAUSA REAL"). El owner, frente
// al muestrario en esa ronda: «Las letras en el pie del Hero, se ven sin cuerpo muy delgadas, en el
// muestrario se ven con más.» Esa ronda diagnosticó FAMILIA tipográfica (Figtree del cuerpo de CORTE
// vs Hanken Grotesk del muestrario, reservada a Duna) y subió el peso a `font-medium` (500) como
// salida sin cruzar esa frontera. El gate visual SIGUIENTE, ya con el peso subido, seguía reportando
// el mismo reclamo — la subida de peso no lo resolvía, lo que delata que el diagnóstico de causa
// estaba incompleto: la variable real no era tipografía.
//
// EL COLOR — LA CAUSA REAL (§ HERO-FRASE-COLOR-PLENO-1): el orquestador midió que esta frase pintaba
// con el ROL SUAVE (`--sf-sobre-banda-suave`, blanco translúcido ~70%, § `esquema-style.ts`) mientras
// `.hero-caption` del muestrario pinta con `--text-on-inverse` — PLENO, opaco (`tokens.css:69`,
// `#fdfbf7`) —, el MISMO rol que ya usa el texto del marquee de esta variante
// (`text-[var(--sf-sobre-banda,white)]`, arriba) y el segmento del cue (`bg-[var(--sf-sobre-banda,
// white)]`, abajo). Un texto translúcido sobre una foto se lee lavado y delgado con CUALQUIER
// fuente — es lo que el owner leía como "sin cuerpo", no la tipografía. La frase pasa al rol PLENO
// (`--sf-sobre-banda`, fallback `white` — el MISMO fallback que el marquee y el cue, nunca un hex
// horneado) y el peso VUELVE a regular (`font-normal`): `.hero-caption` del prototipo
// (`docs/prototipos/cafeone/css/app.css:380-384`) no declara `font-weight` propio, hereda el 400 del
// `body` (que tampoco lo declara, `app.css:21-28`) — el "cuerpo" que faltaba lo daba el color, no el
// peso, así que la subida de la ronda anterior ya no tiene motivo. `Hanken Grotesk` SIGUE reservada a
// Duna (§ CLAUDE.md, "Space Grotesk NO se ofrece a clientes"; `fuentes.test.ts` sin cambios) — esta
// ronda no toca esa frontera, sólo revierte una compensación que apuntaba a la causa equivocada.
//
// EL PESO, TERCERA VUELTA — § CORTE-CUERPO-FIGTREE-PESO-1 (la ruling que `CORTE-CUERPO-LETRA-E-
// ICONOS-1` dejó abierta): un gate POSTERIOR, ya con el color pleno de arriba, seguía viendo la frase
// (y el nav) "sin cuerpo" — el orquestador midió que la causa real era la FAMILIA (Figtree del cuerpo
// de 'prensa' es más liviana que Hanken Grotesk del muestrario a IGUAL peso 400), y presentó la
// pregunta al owner: ¿agregar Hanken Grotesk al catálogo (cruzando la frontera producto/cliente que
// `fuentes.test.ts` protege) o calibrar el PESO de Figtree? El owner eligió calibrar el peso — la
// frontera se mantiene, `fuentes.test.ts` sigue sin Hanken. `font-normal` (literal 400) pasa a
// `sf-peso-normal` (`app/globals.css`, lee `--sf-peso-cuerpo`): con 'prensa' aplicado (CORTE) rinde el
// peso calibrado (440, § fuentes.ts); para cualquier otro par cae al mismo 400 de siempre.
//
// EL TAMAÑO — medido por breakpoint contra los DOS tokens del muestrario: `--text-body-s` (14px,
// `tokens.css:111`) es el tamaño por defecto de `.hero-caption` y coincide EXACTO con nuestro
// `text-sm` (14px, sin override de Tailwind en este repo) — sin cambio ahí, ya coincidía desde la
// ronda anterior. Pero bajo `@media (max-width:640px)` el muestrario baja a `--text-body-xs` (13px,
// `tokens.css:112` + `app.css:1003`), y este párrafo no tenía ese escalón — se agrega `text-[13px]`
// de base con `sm:text-sm` (14px) desde 640px, el MISMO corte que usa el breakpoint `sm` de Tailwind
// (640px, sin override en `app/globals.css`).
//
// EL CONTRASTE, MEDIDO antes/después (mismo método WCAG y las MISMAS tres fotos claras de referencia
// que `VELO_OPACIDAD_PISO` usa, `lib/animation.ts`: arena rgb(232,222,200), casi-blanco
// rgb(245,245,240), crema rgb(238,230,214)) — el detalle completo, incluida la medición CON el velo
// 'suave' real de CORTE, vive en el asiento de este slice (`DECISIONS.md`). Contra las fotos SOLAS
// (sin velo, el proxy conservador que `lib/animation.ts` ya usa para "EL CONTRASTE SIN VELO"): suave
// ~70% daba 1.23:1/1.07:1/1.16:1, pleno da 1.34:1/1.09:1/1.24:1 — los dos muy por debajo de AA sobre
// este proxy, que es justo por qué CORTE lleva el velo encendido. CON el velo 'suave' real de CORTE
// (tinta `#102407`, § `themes.ts`) compuesto sobre esas mismas tres fotos, el pleno sube el contraste
// sobre el suave en cada punto del recorrido (reposo 2.16:1/1.80:1/2.02:1 vs 1.75:1/1.53:1/1.67:1;
// final 3.46:1/2.95:1/3.26:1 vs 2.52:1/2.23:1/2.41:1) — bajo AA en el proxy de foto clara, MEDIDO Y
// REPORTADO, no bloqueante: la misma aceptación que ya rige el rango 'suave' del velo (§ el docstring
// de `veloOpacidad`, `lib/animation.ts` — el proxy es conservador para un video claro, no el video
// oscuro real de CORTE, donde blanco sin velo ya contrasta).
//
// EL REVELADO DEL TEXTO — § CORTE-HERO-MARQUEE-REVELA-1, REESCRITO por RONDA 4 (§ CORTE-HERO-
// REVELADO-MASCARA-1, `lib/animation.ts`, el bloque "EL REVELADO DEL TEXTO" para la derivación
// completa): el owner reportó, sobre el muestrario de RONDA 2, que el marquee «no debe salir
// inicialmente… las letras van saliendo hacia arriba»; sobre RONDA 3 (fade+24px), que «el efecto
// actual está simplemente mostrándolas cada vez más claras» — no se veían SUBIR. RONDA 4 reemplaza
// el mecanismo entero: el texto vive dentro de una MÁSCARA (`overflow-hidden`, el `<div>` estático de
// afuera en el JSX de abajo) y el div del MEDIO lo traslada un PORCENTAJE de su propia caja
// (`transformRevelaTextoDisplay`) — 100% (fuera de la máscara) en reposo, 0% (en su lugar) al 20% del
// progreso (`UMBRAL_REVELADO_TEXTO.hasta`, sin cambios). RONDA 4 fue SIN fade, a propósito (el spec
// de esa ronda pedía probarlo así primero). Bajo `estatico` el texto queda SIEMPRE visible y en su
// lugar (`transformRevelaTextoDisplay` rinde `translateY(0%)`) — un gate de movimiento nunca puede
// esconder contenido.
//
// EL FADE VUELVE, COMPUESTO — § CORTE-MARQUEE-REVELADO-CON-FADE-1 (2026-09-27, `lib/animation.ts`,
// el bloque "EL PESO — LA RAMPA DE OPACIDAD VUELVE" para la derivación completa): el owner, sobre
// RONDA 4 ya aplicada, pidió las DOS cosas juntas — sube desde detrás del recorte Y gana peso
// mientras sube. `opacidadRevelaTextoDisplay` es una SEGUNDA capa sobre el MISMO `motion.div` del
// MEDIO (nunca sobre la máscara, que sigue siendo el único mecanismo de aparición): comparte
// `UMBRAL_REVELADO_TEXTO` con `transformRevelaTextoDisplay` por reusar el mismo tramo interno, así
// que termina de aclarar EXACTAMENTE cuando termina de subir. Bajo `estatico` rinde peso completo
// (1) — el mismo criterio: un gate de movimiento no deja contenido a medio aclarar para siempre.
//
// EL PRESUPUESTO DE SCROLL DEJA DE SER FIJO — § CORTE-HERO-MARQUEE-REVELA-1 (`lib/animation.ts`, el
// bloque "EL PRESUPUESTO DE SCROLL"): medido contra el muestrario desplegado, su catálogo está VACÍO
// y la sección pineada nunca renderiza la tarjeta, así que el ancestro arrastraba 200vh de recorrido
// —135vh de ellos dedicados a la ventana [0.12,0.57] de `transformMarquesinaTarjeta`— sin nada que
// esa ventana pudiera animar: el "tramo muerto" que el owner reportó como bug. `producto` (hide-on-
// empty, ya calculado más abajo para decidir si la tarjeta se muestra) decide TAMBIÉN cuánto
// presupuesto reservar (`claseAlturaAncestroMarquesina`): 200vh con tarjeta (sin cambios), 65vh sin
// ella —lo que queda tras restar exactamente la ventana de la tarjeta—.
//
// LA MECÁNICA DE STICKY, EN DOS ELEMENTOS: el elemento que el visitante VE pineado
// (`<section className="sticky top-0 h-[100svh] …">`) necesita un ANCESTRO más alto que el
// viewport para tener contra qué "engancharse" — un `position:sticky` del mismo alto que su
// contenedor no tiene distancia de scroll que recorrer y nunca se pinea. Ese ancestro es el `<div>`
// raíz de este componente (`min-h-[calc(100svh+200vh)]`): el `100svh` es el propio panel pineado, y
// el `200vh` extra es el PRESUPUESTO DE SCROLL, MEDIDO —no inventado— contra el `<xo-parallax
// class="h:300vh">` real (§ el comentario de cabecera: 300vh = 100vh del panel + 200vh de
// recorrido). No se reusó el `min-h-[70vh]` de la banda SUELTA de `Marquesina.tsx` —esa cifra es el
// alto de OTRA composición (una banda en flujo normal, no un ancestro de sticky) y coincide sólo
// por casualidad de vocabulario, no de medición—.
//
// EL PROGRESO DE SCROLL SE MIDE CONTRA ESE ANCESTRO, NUNCA CONTRA EL PANEL PINEADO: mientras está
// pineado, un elemento `sticky` reporta `top:0` FIJO ante `getBoundingClientRect` — medirlo daría
// un progreso estancado. El ancestro, en cambio, sigue en flujo normal y se mueve con el scroll
// real.
//
// `useProgresoScrollDesdeTope` — RONDA 2 (§ CORTE-HERO-STICKY-RONDA-2-1), NO `useProgresoScroll`.
// La primera versión reusaba `useProgresoScroll` a secas ("el MISMO motor de `Marquesina.tsx`, sin
// una sola línea nueva") y eso era el BUG que el owner reportó: "las letras salen de una, deberían
// salir apenas alguien empieza a hacer scroll". `useProgresoScroll` usa el offset `["start end",
// "end start"]`, calibrado para un elemento que el visitante encuentra MÁS ABAJO de la página (entra
// por el borde inferior del viewport) — pero este ancestro es el PRIMER hijo de `<main>` (el
// `<header>` de `StoreNav` es `fixed`, no ocupa flujo), así que al cargar (scrollY=0) ya estaba
// "adentro" según ese offset: MEDIDO por derivación cerrada (no adivinado, § el docstring de
// `useProgresoScrollDesdeTope`/`progresoDesdeTope` en `lib/animation.ts`), el progreso al cargar
// era **0.25** — un cuarto del recorrido ya consumido, exactamente la forma del defecto (el texto
// nace trasladado `-0.25*travelPx`). La hermana usa `["start start", "end start"]` — el MISMO ancla
// final (sin tocar), sólo cambia el ancla de progreso-0 al instante en que el tope del ancestro toca
// el tope del viewport (`scrollY=0` para este ancestro) — progreso EXACTO 0 al cargar. NO se tocó
// `useProgresoScroll`: la usan también `Marquesina.tsx` y `SubscriptionCTALinea.tsx`, bandas de media
// página donde su offset SÍ es el correcto; la hermana vive aparte, en el mismo archivo.
//
// `transformMarquesinaTarjeta` (la MISMA función pura que `Marquesina.tsx` ya usa, sin cambios en
// esta ronda) produce exactamente la misma escala/rotación de siempre, leída contra el progreso YA
// corregido. `transformMarquesinaTexto` YA NO SE LLAMA ACÁ — desde § CORTE-HERO-VELO-OFF-Y-TICKER-1
// (RONDA 3) el eje horizontal del texto es un TICKER por tiempo, no por scroll; ver esa sección más
// abajo para el porqué y la mecánica completa. `Marquesina.tsx` sigue usando la función sin cambios.
//
// VERIFICADO ANTES DE ESCRIBIR (§ el spec: "verificá que ningún ancestro tenga overflow que rompa
// el sticky"): `StorefrontLayout` (`app/(storefront)/layout.tsx`) no impone `overflow` en NINGÚN
// nivel entre `<body>` y esta sección (`<div className="min-h-screen …">` sin overflow, `<main>`
// sin overflow, y `page.tsx` monta cada banda en un `<Fragment>` sin envoltorio propio) — `grep -n
// overflow` sobre esos dos archivos da CERO resultados. El sticky funciona por construcción.
//
// EL TICKER — RONDA 3 (§ CORTE-HERO-VELO-OFF-Y-TICKER-1, ver el docstring de `VELOCIDAD_TICKER_PX_S`
// en `lib/animation.ts` para la medición contra el tema real), AMPLIADO por RONDA 4 (§ CORTE-HERO-
// REVELADO-MASCARA-1, "LA VELOCIDAD ES UNA PREFERENCIA DEL OWNER"): el texto se desplaza
// horizontalmente SOLO, por TIEMPO — `framer-motion`'s `animate` con `x: ['0%', '-50%']`,
// `repeat: Infinity`, `ease: 'linear'` — DESACOPLADO de `progreso` (el scroll). Vive en un
// `<motion.div>` ANIDADO dentro del que hace de mask/revelado: tres elementos, dos motores (§ el
// docstring de la sección "EL REVELADO ENMASCARADO"), en vez del `transform` armado a mano de antes.
// `trackRef` mide el ancho de UNA COPIA del texto (el primer `<span>`) para calcular la duración de
// un ciclo a la velocidad ELEGIDA por el tema (`velocidadTickerPxS(hero.tickerVelocidad)` — 'media'
// es la MEDIDA contra el tema real, byte-idéntica; 'lenta' es la preferencia del owner sobre esa
// misma medida, RONDA 4) — se re-mide al montar y en cada resize, porque el ancho depende del texto
// y del tamaño de fuente responsive (`clamp(3rem,10vw,10rem)`).
//
// `estatico` (reduced-motion/preview) DETIENE el ticker — `animate:{x:'0%'}` sin keyframes ni
// `repeat` — texto VISIBLE, QUIETO y legible, nunca "a medio camino" de un desplazamiento que no va a
// avanzar. Mismo criterio que ya rige `transformMarquesinaTarjeta`/`veloOpacidad` bajo `estatico`.
//
// SIN PAUSA AL PASAR EL CURSOR — medido contra el tema real (§ el docstring de
// `VELOCIDAD_TICKER_PX_S`): `xoPauseOnHover` es `false` por default y el HTML servido no trae el
// atributo que lo activaría. No se implementa acá tampoco.
//
// MOVIMIENTO REDUCIDO Y VISTA PREVIA: MISMO gate que `Marquesina.tsx` (`estatico = preview ||
// !!useReducedMotion()`) — con él, el texto queda CENTRADO, QUIETO (ticker detenido) y la tarjeta sin
// transformar, nunca "a medio camino" de un recorrido que no va a avanzar.
//
// LA CORRECCIÓN DE `medir()` NUNCA LE LLEGABA A LA ANIMACIÓN — RONDA 5 (§ CORTE-MARQUEE-VELOCIDAD-
// REAL-1, 2026-09-27): el owner reportó, y `ARNES-CENSO-MOVIMIENTO-CALIBRACION-1` (DECISIONS.md)
// MIDIÓ EN VIVO, que el ticker corre ≈2.0–2.1× más rápido que el del tema real y hasta 5.56× más
// rápido que su propia constante (`VELOCIDAD_TICKER_LENTA_PX_S`). La causa NO era la fórmula
// (`duracionTickerS`/`duracionTickerFallbackS` son correctas, § sus tests en `lib/animation.test.ts`)
// ni el elemento medido (`trackRef.current.children[0]` es la copia correcta, y el track SÍ es
// exactamente 2× su ancho — verificado en vivo, `ancho0===ancho1` y `anchoTrack===2×ancho0`).
//
// **LA CAUSA ES QUE FRAMER-MOTION IGNORA UN CAMBIO DE `transition.duration` CUANDO EL TARGET DE
// `animate` NO CAMBIA DE VALOR** — verificado leyendo el propio paquete instalado
// (`node_modules/motion-dom/dist/es/render/utils/animation-state.mjs`, `buildResolvedTypeValues`):
// desestructura `transition` FUERA de los valores que compara (`const { transition, transitionEnd,
// ...target } = resolved`), así que el diffing que decide si (re)iniciar una animación NUNCA mira la
// duración — sólo compara el TARGET (`x`). Y como nuestro target es SIEMPRE el mismo literal
// (`['0%','-50%']`), `shallowCompare` (mismo archivo, comparación elemento-a-elemento) lo declara
// "sin cambios" en CADA re-render, aunque `duracionTicker` (el estado que `medir()` corrige tras la
// primera medición real del DOM) sí haya cambiado. El resultado: el ticker queda para SIEMPRE
// corriendo a la duración de `useState(() => duracionTickerFallbackS(velocidadTicker))` —el fallback
// que ASUME un texto de ~800px (§ el comentario de `duracionTickerFallbackS`, `lib/animation.ts`)—,
// nunca a la duración real (`duracionTickerS(anchoMedido, velocidadTicker)`), porque `anchoMedido` es
// SIEMPRE mayor que 800px para un titular a este tamaño de fuente (medido en vivo: ~2570px, ~3.2× el
// supuesto del fallback) y por eso el ticker corre más rápido de lo declarado EN TODO CASO, sin
// importar qué `hero.tickerVelocidad` esté configurado.
//
// REPRODUCIDO Y VERIFICADO AISLADO (fuera de `touches:`, sin dejar rastro en el repo): un repro
// mínimo con la MISMA versión instalada de framer-motion (12.40.0) confirmó las dos mitades — SIN el
// fix, el período del loop se queda CONGELADO en la duración inicial para siempre (medido: 2.0s de
// principio a fin, aunque el estado ya diga 6s a partir de los 700ms); CON el fix (`key` abajo), el
// período pasa a 6.04s en cuanto la corrección llega (medido con precisión de reset-a-reset, no una
// media aproximada).
//
// **EL FIX ES `key={duracionTicker}`** en el `<motion.div ref={trackRef}>`: al cambiar `duracionTicker`
// (la corrección real de `medir()`), React DESMONTA la instancia vieja y MONTA una nueva — un
// `VisualElement` nuevo empieza su animación con `isInitialRender=true`, usando el `transition`
// ACTUAL (ya no hay "target sin cambios" que comparar, porque no hay historial previo). El costo es
// un reinicio visual del ciclo (vuelve a `x:0%` un instante) — ACEPTABLE: ocurre sólo al montar (tras
// la primera medición real, normalmente <100ms después del primer paint) y en cada `resize` genuino,
// nunca en medio de una sesión normal de scroll. NO se usó `useAnimate()`/la API imperativa de
// framer-motion —hubiera evitado el reinicio visual, pero exige reestructurar el componente entero
// alrededor de un scope imperativo por una ganancia marginal (un reinicio invisible en la práctica,
// § arriba)—; `key` es el fix MÍNIMO que hace que la corrección de `medir()` deje de ser un valor de
// estado que nadie lee.
//
// CUATRO AJUSTES DEL OWNER SOBRE EL GATE YA APLICADO — § CORTE-HERO-MARQUEE-RONDA-5-1 (2026-09-27),
// sobre la MISMA capa (el texto del loop), cada uno con su propia medición en `lib/animation.ts`:
//   (1) el tamaño de fuente pasa a `MARQUEE_TITULO_FONT_SIZE` — MEDIDO contra `fz:d1` del tema real
//       (antes horneado sin medir, `text-[clamp(3rem,10vw,10rem)]`), junto con el interlineado
//       (`MARQUEE_TITULO_LINE_HEIGHT`) y el interletrado (`MARQUEE_TITULO_LETTER_SPACING`) que el
//       tema declara EN LÍNEA para ese mismo texto;
//   (2) la máscara gana el relleno inferior + margen negativo de la pieza de marca de Duna
//       (`MARQUEE_MASCARA_RELLENO_EM`), MEDIDO —no copiado a ciegas— contra el interlineado nuevo,
//       para que la g/q no pierdan su cola;
//   (3) `VELOCIDAD_TICKER_LENTA_PX_S` sube de 0.6× a 0.7× la medida — «subele sólo un poco»;
//   (4) `OPACIDAD_REVELADO_TECHO` (0.9) reemplaza al peso pleno como destino de la rampa de
//       `opacidadRevelaTextoDisplay` — «que no sea un blanco tan claro al que llegan».
// Los CUATRO son ajustes de MAGNITUD sobre mecanismos que YA existían (RONDA 3/4) — ninguno cambia
// la estructura de tres elementos del loop, el eje del ticker, ni el modelo de revelado enmascarado.
//
// LA FRANJA VERDE EN MÓVIL AL EMPEZAR A HACER SCROLL — § HERO-MOVIL-SIN-FRANJA-VERDE-1 (2026-09-29):
// el owner, desde su teléfono, con captura: «En móvil se ve como una pantalla verde detrás del
// video cuando empiezo a hacer scroll y empiezan a salir las letras» — la franja aparece debajo, y a
// veces arriba, del video durante el tramo pineado.
//
// LA CAUSA: `100svh` ("small viewport height") resuelve al viewport MÁS CHICO posible (el chrome del
// navegador —barra de direcciones/gestos— EXPANDIDO); `100lvh` ("large viewport height") al MÁS
// GRANDE (el chrome COLAPSADO). Los dos son valores FIJOS — ninguno de los dos sigue al chrome real
// en tiempo real; sólo `100dvh` lo hace. Este panel medía `h-[100svh]` para TODO (el marco Y la
// media), así que al iniciar el scroll —el momento en que el navegador móvil colapsa su chrome y el
// viewport VISIBLE crece hacia `lvh`— el panel se quedaba anclado al tamaño CHICO, ya resuelto en
// píxeles, que no crece con el chrome; el área que el chrome deja de ocupar quedaba por FUERA del
// panel, mostrando el `bg-[var(--sf-banda,var(--sf-tinta))]` del ANCESTRO (§ arriba, "LA MECÁNICA DE
// STICKY") — la franja verde oscura reportada. El "a veces arriba" es la MISMA causa en el otro
// sentido: el chrome de un navegador móvil puede colapsar/expandir por los DOS bordes (barra de
// direcciones arriba, barra de gestos abajo), así que el viewport visible puede crecer por
// cualquiera de los dos, no sólo el inferior.
//
// EL FIX — SÓLO LA MEDIA MIDE `lvh`; EL MARCO SIGUE EN `svh`. La `<section>` que ancla el texto, la
// tarjeta, la frase al pie y el cue "Desliza" NO cambia: sigue `h-[100svh]`, el viewport MÁS CHICO,
// así que esos elementos —posicionados con `bottom-*`/`top-*` relativos a ESE marco— siguen SIEMPRE
// dentro del área visible, con el chrome mostrado o escondido (agrandar el marco a `lvh` los habría
// sacado del área visible cuando el chrome SÍ está mostrado, ocultándolos detrás de la barra del
// navegador — justo lo que el spec pidió no crear). El `<div>` que envuelve video+imagen+velo (antes
// `absolute inset-0`, 100% del marco) pasa a `absolute inset-x-0` con `height:'100lvh'` y
// `top:'calc((100svh - 100lvh) / 2)'` — CENTRADO respecto al marco, así que el excedente (`lvh -
// svh`, el alto del chrome) se reparte MITAD arriba, MITAD abajo, cubriendo los dos casos reportados
// con el MISMO mecanismo, no dos parches distintos.
//
// EN ESCRITORIO (y en cualquier navegador SIN chrome dinámico) `svh === lvh === dvh === vh`, por
// definición del spec de CSS — no hay chrome que colapsar. Con eso, `calc((100svh - 100lvh) / 2)`
// resuelve a `0` y `100lvh` resuelve al MISMO valor que `100svh` ya resolvía: el `top`/`height`
// nuevos quedan IDÉNTICOS al `inset-0` de antes, byte a byte — el fix es byte-idéntico en escritorio
// por la PROPIEDAD de la fórmula, no por una media query aparte.
//
// `overflow-hidden` SE RETIRA de la `<section>` — necesario para que la media (ahora más alta que el
// marco) pueda pintar más allá de su caja sin recortarse — y se AGREGA al `<div ref={wrapperRef}>`
// (el ANCESTRO del sticky) como red de seguridad: acota cualquier excedente al espacio del ancestro
// (que sobra, § el presupuesto de scroll de 200vh/65vh) para que la media desbordada nunca alcance a
// pintar sobre la sección SIGUIENTE de la página, ni siquiera en el instante en que el panel se
// despinea al final del recorrido. **ESTE VALOR ROMPIÓ EL PROPIO STICKY QUE LO CONTIENE — ver
// § HERO-STICKY-OVERFLOW-FIX-1 más abajo, donde pasa a `overflow-clip`.** Lo único que dependía del
// `overflow-hidden` retirado de la
// sección era el recorte HORIZONTAL de la máscara del ticker (§ "EL LOOP DE TEXTO" — sin ancho
// propio, su caja crecía tan ancha como el texto sin envolver); gana `inset-x-0` (ancho acotado al
// marco) para quedar auto-contenida vía su PROPIO `overflow-hidden`, sin depender de la sección. La
// tarjeta (`transformMarquesinaTarjeta`, escala 0.85→1 y rotación -4°→0°) nunca se apoyaba en el
// recorte de la sección de forma perceptible —su desborde por rotación es de unos pocos píxeles en
// las esquinas, a lo sumo— así que retirarlo no le cambia nada visible.
//
// VERIFICADO POR MEDICIÓN, NO ASUMIDO: Chromium headless (Playwright, sin chrome dinámico real) NO
// puede reproducir el defecto ni distinguir `svh` de `lvh` — en ese entorno los dos SIEMPRE resuelven
// al mismo valor que el viewport que se le pida, con o sin este fix, así que una captura headless a
// 390×844 y a 390×932 da CERO franja en AMBOS casos, antes y después del cambio. Eso NO es evidencia
// de que el fix funcione: es el LÍMITE del arnés, medido y documentado en el asiento de este slice
// (`DECISIONS.md`). La prueba real es el Safari del owner, en su teléfono, con la barra de
// direcciones colapsando de verdad durante el scroll.
//
// EL STICKY DEJÓ DE PEGARSE, EN ESCRITORIO Y EN MÓVIL — § HERO-STICKY-OVERFLOW-FIX-1 (2026-09-29):
// el `overflow-hidden` que el slice de arriba AGREGÓ al `<div ref={wrapperRef}>` (el ancestro del
// sticky, "como red de seguridad" para que la media a `100lvh` no desbordara sobre la sección
// siguiente) fue la causa del regreso reportado por el owner — captura de escritorio: «El bug está
// peor ahora, no sólo se ve en la vista móvil, sino también en la de escritorio y más grande aún en
// ambas» — el video se iba con la página al hacer scroll, en vez de quedarse fijo, y por eso el
// bloque `--sf-tinta` del ancestro quedaba a la vista en TODO el recorrido, no sólo en el resquicio
// del chrome dinámico.
//
// LA CAUSA, por especificación: un elemento con `overflow: hidden` (o `auto`/`scroll`) se vuelve un
// SCROLL CONTAINER — la caja contra la que el spec de posicionamiento resuelve el `position:sticky`
// de sus descendientes. El `<div ref={wrapperRef}>` es el elemento PENSADO para dar el presupuesto
// de scroll (min-h `100svh+200vh`/`100svh+65vh`, § "LA MECÁNICA DE STICKY" arriba) — no scrollea por
// sí mismo, así que agregarle `overflow-hidden` lo convierte en un scroll container SIN mecanismo de
// scroll propio, y el `<section sticky top-0 …>` que hasta ahora se pineaba contra el VIEWPORT pasa a
// intentar pinearse contra ESE ancestro — que crece con la página en vez de quedarse quieto, así que
// el "pineado" deja de fijarse a nada. Es un efecto colateral DOCUMENTADO de `overflow-hidden`, no
// exclusivo de este componente: cualquier ancestro entre un `position:sticky` y el viewport que lleve
// `overflow: hidden/auto/scroll` rompe el sticky de la misma forma.
//
// EL FIX: `overflow-clip` EN VEZ DE `overflow-hidden` EN EL ANCESTRO. `overflow: clip` recorta el
// contenido que se pasa de la caja — la MISMA función visual que motivó agregarlo (conservar el
// "red de seguridad" para el excedente de la media a `lvh`) — pero, A DIFERENCIA de `hidden`, NO
// establece un scroll container (spec de CSS Overflow: `clip` documenta explícitamente que NO forma
// parte del modelo de "scrollable overflow", así que un descendiente `position:sticky` sigue
// resolviendo su ancla contra el próximo ancestro que SÍ sea un scroll container real — acá, el
// viewport). El sticky vuelve a fijarse al viewport, y el recorte del excedente de la media sigue
// vigente por el mismo mecanismo, sin el efecto colateral. `overflow-clip` es tan soportado como
// `overflow-hidden` en los navegadores donde corre este storefront (Safari 16+, Chrome/Firefox desde
// 2022) — no hay fallback que declarar.
//
// LO QUE NO CAMBIA: la máscara del ticker sigue con su PROPIO `overflow-hidden` (§ "EL LOOP DE
// TEXTO" — nunca dependió del ancestro, ya está auto-contenida vía `inset-x-0`); la `<section>`
// pineada sigue SIN `overflow` propio (se retiró en la ronda anterior, sin cambios acá); la media
// sigue midiendo `100lvh` centrada. Es un cambio de UN valor, en UN selector — de la propiedad que
// causaba el scroll container al valor que recorta sin causarlo.
//
// TRES DEFECTOS DE LA TARJETA, CERRADOS JUNTOS — § MARQUESINA-TARJETA-SECUENCIA-1 (2026-10-02), el
// gate del owner sobre Café Las Chamisas (el mismo gate pedía además rounding de tarjetas de imagen,
// hover de segunda foto en `/tienda` y el logo del nav en móvil — fuera de `touches:` de este slice,
// no tocado acá):
//   (1) LA SECUENCIA: la tarjeta entraba A LA VEZ que la frase (compartían `UMBRAL_REVELADO_TEXTO`,
//       § MARQUESINA-TARJETA-PRODUCTO-1) — el owner la pidió DESPUÉS. Ahora usa su propia ventana,
//       `UMBRAL_ENTRADA_TARJETA_MARQUESINA` (`lib/animation.ts`, derivada: arranca donde la de la
//       frase termina, dura lo mismo) — ver "LA ENTRADA DE LA TARJETA" más abajo, en el cuerpo.
//   (2) EL TRAMO MUERTO: con el presupuesto de scroll viejo (100svh+200vh), la tarjeta terminaba de
//       aparecer bien antes de que el `position:sticky` se liberara — un tramo de scroll sin nada
//       nuevo ("hice scroll 3 veces antes de poder iniciar a bajar"). El presupuesto CON tarjeta baja
//       a 100svh+100vh, derivado de las mismas ventanas (§ el docstring de `claseAlturaAncestroMarquesina`,
//       "RONDA SECUENCIA", `lib/animation.ts`) para que el panel se libere poco después de que la
//       tarjeta queda quieta. El "sin tarjeta" (65vh) no se tocó.
//   (3) EL PARPADEO ENTRE RECARGAS: el modo de la tarjeta ('tile'/'completa') dependía de que React
//       viera el `onLoad` de la imagen, y ese evento podía no llegar nunca para una carga dada
//       ("si refresco sale con los bordes, si vuelvo y refresco sale la otra"). `imgTarjetaRef` +
//       `tamanoSiCompleta` (`lib/storefront/marquesina-tarjeta.ts`, su docstring para el porqué
//       completo) miden la imagen YA cargada al montar, sin depender de ese evento — ver "EL MODO DE
//       LA TARJETA" más abajo.
//
// DOS DEFECTOS MÁS DE LA MISMA TARJETA — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02), el gate
// del owner sobre la versión de arriba YA aplicada: «la imagen del producto sale después de las
// letras, pero el efecto que tiene no es el mismo de las letras, debería ser el de las letras,
// desde abajo y el desvanecido quitarse progresivamente. Otra cosa, debe haber una mini pausa entre
// que salen las letras y sale la imagen, ahora mismo parece que en el mismo scroll que las letras
// salen completas con su tono correcto ahí mismo sale la imagen, la imagen debería empezar a salir
// un scroll después.»
//   (4) EL EFECTO: escala+rotación (`transformMarquesinaTarjeta`) reemplazado por el MISMO revelado
//       enmascarado que ya usa la frase (`transformRevelaTextoDisplay`/`opacidadRevelaTextoDisplay`,
//       § "LA ENTRADA DE LA TARJETA" más abajo, en el cuerpo) — sube desde abajo (recortada por una
//       máscara, no sólo trasladada) y se desvanece PROGRESIVAMENTE, en vez de escalar/rotar.
//       `opacidadEntradaTarjetaMarquesina` (su aparición de techo pleno) se RETIRÓ de
//       `lib/animation.ts`: sin este llamador quedaba sin ningún consumidor real.
//   (5) LA PAUSA: `UMBRAL_ENTRADA_TARJETA_MARQUESINA` (lib/animation.ts) ganó una fracción de
//       separación antes de arrancar —derivada de un gesto de scroll completo, no un número suelto,
//       § su docstring— para que la tarjeta no empiece a aparecer en el MISMO scroll en que la frase
//       termina. El presupuesto CON tarjeta crece de 100vh a 140vh para que, con la pausa adentro,
//       siga sin quedar scroll muerto tras completarse la tarjeta (el MISMO invariante del punto (2)
//       arriba, no uno nuevo — `claseAlturaAncestroMarquesina` ya derivaba el extra de las ventanas,
//       no de un literal aparte).
//
// LA TARJETA SE VEÍA CORTADA AL EMPEZAR A SALIR — § MARQUESINA-TARJETA-SIN-MASCARA-1 (2026-10-02).
// El owner, con captura sobre la demo de Café Las Chamisas (la tarjeta a medio salir, recortada
// horizontalmente bajo la frase): «Cuando empieza a salir la tarjeta se ve cortada». El punto (4) de
// arriba —§ MARQUESINA-TARJETA-COMO-LETRAS-1— le dio a la tarjeta el MISMO patrón de dos elementos
// (máscara estática + motor interno) que ya usa el loop de texto, y para una LÍNEA de texto ese
// recorte ES el efecto ("las letras suben detrás de un borde"); para una FOTO entera, a mitad de
// camino el resultado es exactamente lo que el owner reportó: un borde recto a la mitad de la imagen,
// con sólo la mitad SUPERIOR visible (la matemática: `translateY(X%)` del hijo deja visible, dentro
// de la máscara, el tramo `[0, 1-X]` de la caja — un recorte parcial, no una tarjeta entera a medio
// aparecer).
//
// EL FIX: la tarjeta vuelve a ser UN SOLO elemento (§ el comentario "UN SOLO ELEMENTO, SIN MÁSCARA"
// en el cuerpo del componente, más abajo, junto al JSX) — el `transform`/`opacity` se aplican
// DIRECTAMENTE al elemento que ya tiene el tamaño final (`aspect-[3/4]`/ancho/`overflow-hidden`/
// radio), no a un hijo que se traslada dentro de un padre estático. El `overflow-hidden` se
// CONSERVA en ese único elemento —sigue redondeando las esquinas cuadradas de la `<Image fill>` al
// `sf-radio-tile`, como en `Spotlight.tsx`— pero deja de funcionar como máscara de ENTRADA: nada se
// mueve RELATIVO a esta caja (la imagen nunca se traslada dentro de su padre), así que aplicar el
// `transform` al MISMO elemento que tiene el recorte hace que recorte y movimiento viajen juntos —la
// caja entera se traslada como una unidad rígida, nunca a medio recortar. "Sube desde abajo, con el
// desvanecido quitándose progresivamente" (el pedido original de MARQUESINA-TARJETA-COMO-LETRAS-1)
// sigue cumplido: la tarjeta sigue llegando desde una posición desplazada y aclarándose, sólo que
// ahora ENTERA en todo punto del recorrido, nunca recortada por un borde ajeno.
//
// LAS FUNCIONES/VENTANA NO CAMBIAN: `transformRevelaTextoDisplay`/`opacidadRevelaTextoDisplay` con
// `UMBRAL_ENTRADA_TARJETA_MARQUESINA`/`techo=1` siguen siendo las mismas (§ `transformTarjeta`/
// `opacidadTarjeta` en el cuerpo) — el `translateY(N%)` sigue relativo a la PROPIA CAJA del elemento,
// así que retirar el envoltorio de dos capas no cambia el recorrido en píxeles ni el timing (la
// pausa, el arranque, el final). El loop de TEXTO (§ "EL LOOP DE TEXTO" más abajo) no se tocó: ahí
// el revelado enmascarado sigue siendo tres elementos, sin cambio — el defecto era específico de
// envolver una FOTO con el mismo mecanismo pensado para una LÍNEA de texto.

// LAS ZONAS (§ EDITOR-TIENDA-ZONAS-1, docs/editor-tienda/REDISENO.md § 4) — misma pieza LOCAL que
// `HeroMedia.tsx` (duplicada a propósito, no un módulo compartido: § el docstring de esa copia, el
// mismo criterio ya aceptado en este repo para piezas chicas entre las 4 variantes del hero).
function ZonaChip({ onClic, children }: { onClic: { campo: string; valor: string; campo2?: string; valor2?: string }; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-editor-zona-campo={onClic.campo}
      data-editor-zona-valor={onClic.valor}
      {...(onClic.campo2 ? { 'data-editor-zona-campo2': onClic.campo2 } : {})}
      {...(onClic.valor2 !== undefined ? { 'data-editor-zona-valor2': onClic.valor2 } : {})}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, marginRight: 8,
        padding: '3px 10px', fontSize: 11, fontWeight: 600, lineHeight: 1.4, borderRadius: 999,
        border: '1px dashed #2563eb', background: 'rgba(255,255,255,.94)', color: '#1d4ed8',
        cursor: 'pointer', position: 'relative', zIndex: 20,
      }}
    >
      {children}
    </button>
  );
}

export default function HeroMediaMarquesina({ style }: { style?: React.CSSProperties } = {}) {
  const { hero, marquesina, tema } = useSiteContent();
  const preview = useIsPreview();
  // LAS ZONAS — `useModoEditorActivo()`, NO `useIsPreview()` (§ el docstring equivalente en
  // `HeroMedia.tsx`, el mismo desvío medido del texto literal del spec).
  const activoEditor = useModoEditorActivo();
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;
  // EL CAMPO `marquesina.texto` SE ESTÁ EDITANDO AHORA MISMO (§ EDITOR-TIENDA-CAMPO-ANCLADO-1,
  // cierra el error 1 de REDISENO.md § 1). Congela el ticker en `x:0%` y DETIENE la recalculación
  // de `duracionTicker` (abajo) — ésta última es la que importa de verdad: `duracionTicker` cambia
  // en CADA tecla (el ancho medido del texto cambia con casi cada carácter), y el track remonta por
  // `key={duracionTicker}`. Sin la guarda, el nodo marcado se reemplazaría varias veces por
  // segundo mientras se tipea, y el overlay (anclado a ESE nodo) perdería su referencia.
  const rutaAbierta = useRutaEnEdicion();
  const editandoTicker = rutaAbierta === 'marquesina.texto';

  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  const producto = productoMarquesina(catalog, marquesina.productoSlug);

  // EL MODO DE LA TARJETA Y EL TICKER — § EDITOR-TIENDA-MARQUESINA-SECCION-1 EXTRAE las dos piezas a
  // `MarquesinaMotor.tsx` (`MarquesinaFraseMotor`/`MarquesinaTarjetaMotor`): la medición de proporción
  // de la foto (`modoTarjetaMarquesina`/`tamanoSiCompleta`, § su propio módulo) y la medición del
  // ancho del ticker (`duracionTickerS`, § su docstring en `lib/animation.ts`) ahora viven DENTRO de
  // esos componentes — este `HeroMediaMarquesina` ya no necesita sus propios `imgTarjetaRef`/
  // `tamanoImagenTarjeta`/`trackRef`/`duracionTicker`. El comportamiento no cambia (mismas funciones
  // puras, mismas dos vías de medición, mismo congelamiento con `editandoTicker`): sólo se movió de
  // dónde vive el `useRef`/`useState`.

  // El ANCESTRO del sticky (§ el docstring de cabecera) — el target de `useProgresoScrollDesdeTope`,
  // nunca la `<section>` pineada.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progreso = useProgresoScrollDesdeTope(wrapperRef);
  // EL VELO (§ RONDA 4, "EL VELO VUELVE, PERO SUAVE"): `rangoVeloDeIntensidad` traduce
  // `hero.veloIntensidad` ('media', el rango de siempre, o 'suave', la preferencia de CORTE) al
  // par piso/techo que `veloOpacidad` ya sabía usar con su DEFAULT — acá se lo pasamos explícito.
  const rangoVelo = rangoVeloDeIntensidad(hero.veloIntensidad);
  const opacidadVelo = useTransform(progreso, (p) => veloOpacidad(p, estatico, rangoVelo));

  // PUNTO FOCAL (§ HERO-PUNTO-FOCAL-1): mismo mecanismo que HeroMedia.tsx, aplicado a los DOS
  // medios. `undefined` para la canónica ('centro') o basura — no se emite ningún `style`.
  const objectPosition = objectPositionDePuntoFocal(hero.puntoFocal);
  const estiloPuntoFocal = objectPosition ? { objectPosition } : undefined;

  const esVideo = hero.imagenTipo === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);
  const reproducir = esVideo && !preview && !reduce;

  // EL VIDEO DE TELÉFONO (§ HERO-VIDEO-MOVIL-1, lib/config/hero-video.ts) — MISMO mecanismo que
  // HeroMedia.tsx: sin él, `src=`/`poster=` directos (byte-idéntico); con él, `<source>` dentro del
  // `<video>` (el navegador elige por `media`, sólo al cargar) + un `<picture>` nativo para el
  // póster (que SÍ re-evalúa `media` en cada cambio de viewport — el primer pintado es correcto sin
  // JS). Ver el docstring completo en HeroMedia.tsx — no se repite acá una segunda vez.
  const fuentesVideo = esVideo ? fuentesVideoHero(hero) : [];
  const hayVideoMovil = esVideo && tieneVideoMovil(hero);
  const posterMovil = hayVideoMovil ? posterVideoMovil(hero) : undefined;

  // EL PRELOAD TAMBIÉN SE PARTE POR `media` — mismo defecto medido que HeroMedia.tsx: un `<link
  // rel=preload>` es un mecanismo DISTINTO del `<picture>` de abajo y no hereda su elección. Sin
  // video de teléfono, queda idéntico a siempre.
  if (esVideo && hayVideoMovil) {
    if (hero.imagenPoster) preload(hero.imagenPoster, { as: "image", fetchPriority: "high", media: HERO_VIDEO_ESCRITORIO_MEDIA });
    if (posterMovil) preload(posterMovil, { as: "image", fetchPriority: "high", media: HERO_VIDEO_MOVIL_MEDIA });
  } else if (esVideo && hero.imagenPoster) {
    preload(hero.imagenPoster, { as: "image", fetchPriority: "high" });
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reproducir) v.play().catch(() => {});
    else v.pause();
  }, [reproducir]);

  // AL ROTAR EL TELÉFONO: mismo efecto que HeroMedia.tsx — un `<video><source media>` no se
  // re-evalúa solo al cambiar el viewport; `.load()` lo fuerza. Única pieza de JS del mecanismo, y
  // sólo reacciona DESPUÉS del primer pintado.
  useEffect(() => {
    if (!hayVideoMovil) return;
    const mq = window.matchMedia(HERO_VIDEO_MOVIL_MEDIA);
    const alCambiar = () => {
      const v = videoRef.current;
      if (!v) return;
      v.load();
      v.muted = true;
      if (reproducir) v.play().catch(() => {});
    };
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, [hayVideoMovil, reproducir]);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${claseAlturaAncestroMarquesina(!!producto, preview)} overflow-clip bg-[var(--sf-banda,var(--sf-tinta))]`}
      style={style}
    >
      <section
        aria-label={marquesina.texto}
        className="sticky top-0 flex h-[100svh] items-center justify-center bg-[var(--sf-banda,var(--sf-tinta))]"
      >
        {/* LA MEDIA CUBRE `lvh`, CENTRADA — § HERO-MOVIL-SIN-FRANJA-VERDE-1 (el docstring de
            cabecera, "LA FRANJA VERDE EN MÓVIL"). Antes `absolute inset-0` (100% del marco, `svh`);
            ahora explícita a `100lvh` con un offset negativo que la centra respecto al marco —
            `top:0, height:100%` cuando `svh===lvh` (escritorio), sin necesitar una media query. */}
        <div
          className="absolute inset-x-0"
          style={{ top: 'calc((100svh - 100lvh) / 2)', height: '100lvh' }}
        >
          {esVideo ? (
            hayVideoMovil ? (
              // UN SOLO marcador (`hero.imagen`) para el PAR picture+video — mismo defecto medido y
              // mismo fix que HeroMedia.tsx (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1): los dos son
              // `absolute inset-0` en la MISMA caja y el `<video>` SIEMPRE gana el hit-test (pinta
              // encima); marcar el póster como nodo aparte lo dejaba clickeable en el DOM pero
              // INALCANZABLE por el puntero. La ambigüedad desktop/móvil del `<video>` mismo queda
              // documentada en EDICION-INLINE.md § 2.2.
              <CampoEditable campo="hero.imagen" tipo="imagen">
                <>
                  {/* EL PÓSTER — `<picture>` nativo (§ el docstring de arriba). Mismo mecanismo que
                      HeroMedia.tsx: va DEBAJO del `<video>`, transparente hasta que el video tiene
                      un frame que pintar. */}
                  <picture aria-hidden="true" className="absolute inset-0 block">
                    <source media={HERO_VIDEO_MOVIL_MEDIA} srcSet={posterMovil} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hero.imagenPoster || undefined} alt="" className="h-full w-full object-cover" style={estiloPuntoFocal} />
                  </picture>
                  <video
                    ref={videoRef}
                    muted
                    loop
                    playsInline
                    preload={reproducir ? 'auto' : 'none'}
                    controls={!!reduce && !preview}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={estiloPuntoFocal}
                  >
                    {fuentesVideo.map((f) => <source key={f.src} src={f.src} media={f.media} />)}
                  </video>
                </>
              </CampoEditable>
            ) : (
              <CampoEditable campo="hero.imagen" tipo="imagen">
                <video
                  ref={videoRef}
                  src={hero.imagen}
                  poster={hero.imagenPoster || undefined}
                  muted
                  loop
                  playsInline
                  preload={reproducir ? 'auto' : 'none'}
                  controls={!!reduce && !preview}
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={estiloPuntoFocal}
                />
              </CampoEditable>
            )
          ) : (
            <CampoEditable campo="hero.imagen" tipo="imagen">
              <Image
                src={hero.imagen}
                alt=""
                fill
                priority
                sizes="100vw"
                quality={85}
                className="object-cover"
                style={estiloPuntoFocal}
              />
            </CampoEditable>
          )}

          {/* EL VELO — OPT-IN DESDE RONDA 3 (§ el docstring de cabecera, "EL VELO ES OPT-IN"):
              `hero.veloVisible` decide si este nodo se MONTA. Cuando se monta, mismo `bg-[var(
              --sf-velo)]` de siempre (el color sigue del TOKEN, sin tocar) con su `opacity` siguiendo
              el scroll — casi transparente en reposo, densa al final del recorrido.
              `pointer-events-none` (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1, MEDIDO por ejecución):
              sin esto el navegador le entrega el clic a ESTE velo, no al `<CampoEditable>` que
              envuelve el medio de abajo — mismo defecto que HeroCurtina/HeroMedia. */}
          {hero.veloVisible && (
            <motion.div className="absolute inset-0 bg-[var(--sf-velo)] pointer-events-none" style={{ opacity: opacidadVelo }} />
          )}
        </div>

        {/* LA ZONA «FONDO» — EL VELO COMBINADO (§ EDITOR-TIENDA-ZONAS-1): «Oscurecer para leer
            mejor» — Nada · Suave · Medio · Fuerte. Escribe `veloVisible`+`veloIntensidad` juntos
            (§ `camposDeVeloCombo`, site-content-defaults.ts) — el MISMO par que decide
            `PaletaSeccion`/el select del panel, nunca una tercera fuente. SÓLO esta composición lee
            estos dos campos (§ el docstring de cabecera, "EL VELO ES OPT-IN"), así que el control
            vive SÓLO acá, no en `HeroMedia.tsx`. */}
        {/* `top-24`, no `top-3` — el `<header>` fijo (z-50, StoreNav.tsx) cubre el borde superior
            del hero; medido por ejecución, con `top-3` el clic no llegaba al chip. */}
        {activoEditor && (
          <div className="absolute top-24 left-3 z-20 flex flex-wrap">
            <span style={{ display: 'block', width: '100%', marginBottom: 2, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#1d4ed8' }}>Fondo · Oscurecer para leer mejor</span>
            <ZonaChip onClic={{ campo: 'veloVisible', valor: 'false' }}>Nada</ZonaChip>
            <ZonaChip onClic={{ campo: 'veloVisible', valor: 'true', campo2: 'veloIntensidad', valor2: 'suave' }}>Suave</ZonaChip>
            <ZonaChip onClic={{ campo: 'veloVisible', valor: 'true', campo2: 'veloIntensidad', valor2: 'intermedia' }}>Medio</ZonaChip>
            <ZonaChip onClic={{ campo: 'veloVisible', valor: 'true', campo2: 'veloIntensidad', valor2: 'media' }}>Fuerte</ZonaChip>
          </div>
        )}

        {/* EL LOOP DE TEXTO — EXTRAÍDO a `MarquesinaMotor.tsx` (`MarquesinaFraseMotor`), §
            EDITOR-TIENDA-MARQUESINA-SECCION-1. Mismo JSX de siempre (máscara + motor + ticker, tres
            elementos — ver su docstring en `MarquesinaMotor.tsx` y "EL REVELADO ENMASCARADO"/"EL
            TICKER HORIZONTAL" en `lib/animation.ts` para la derivación completa), parametrizado por
            el campo (`marquesina.texto`, el de SIEMPRE del hero) y sin `ventanaSalida` — el hero
            nunca hace que su frase "se vaya". */}
        <MarquesinaFraseMotor
          campo="marquesina.texto"
          texto={marquesina.texto}
          progreso={progreso}
          estatico={estatico}
          tickerVelocidad={hero.tickerVelocidad}
          editando={editandoTicker}
        />

        {/* LA TARJETA — MEDIDO: "encima" del texto y del velo. `z-20` (por encima del `z-10` del
            loop). Hide-on-empty de UN elemento (el pin), como en `Marquesina.tsx`: sin `productoSlug`,
            con el catálogo vacío, O con un slug que no matchea ningún producto — `productoMarquesina`
            (§ HERO-SIN-TARJETA-Y-PDP-IMAGEN-1) NO cae a ningún fallback — simplemente no se muestra;
            el texto del loop no depende de ella.

            EL MODO — § MARQUESINA-TARJETA-PRODUCTO-1 (`lib/storefront/marquesina-tarjeta.ts`, el
            docstring de cabecera): `'tile'` es el prototipo de Cafeone verbatim (`.marquee-card`,
            padding + fondo propio + `object-contain`, el tile de SIEMPRE — nunca recorta). `'completa'`
            es borde a borde (`object-cover`, SIN padding ni fondo propio) — el modo que una foto 3:4
            habilita, porque ahí `cover` no recorta nada: es exactamente lo que cierra el "marco" que
            se ve cuando la foto trae su propio fondo de estudio y el padding del tile deja ver el
            fondo de la TARJETA alrededor (el mismo defecto, con la misma causa, que
            § FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1 ya midió y cerró para el destacado y el riel).

            RADIO (§ RADIO-TARJETAS-IMAGEN-1): `sf-radio-tile`, no `rounded-2xl` crudo — gate del
            owner, "un poco de redondeo pero sólo a las card de imágenes", y ésta ES "la tarjeta del
            hero" que el gate nombró. `sf-radio-tile` es además el rol EXACTO del prototipo: su
            `.marquee-card` (`docs/prototipos/cafeone/css/app.css:423-429`) ya usa `--radius-tile`,
            el MISMO token que este rol lee.

            UN SOLO ELEMENTO, SIN MÁSCARA — § MARQUESINA-TARJETA-SIN-MASCARA-1 (2026-10-02), REVIERTE
            el "DOS ELEMENTOS" de § MARQUESINA-TARJETA-COMO-LETRAS-1 (ver el docstring de cabecera,
            bloque con este mismo id, para el reporte completo del defecto). Aquella ronda envolvió la
            tarjeta en una MÁSCARA estática (`<div>` de AFUERA, tamaño FINAL fijo + `overflow-hidden`)
            con un `motion.div` de ADENTRO (`h-full w-full`) llevando el `transform`/`opacity` — el
            MISMO patrón máscara+motor del loop de texto. Para una LÍNEA de texto eso es el efecto
            correcto (letras que suben recortadas por un borde); para una FOTO entera, a mitad de
            camino el resultado es un rectángulo con un borde recto y sólo la MITAD SUPERIOR de la
            imagen visible — exactamente lo que el gate del owner reportó como "se ve CORTADA".

            El `transform`/`opacity` ahora van en el MISMO elemento que YA es del tamaño final
            (`aspect-[3/4]`/ancho/radio/`overflow-hidden`) — no en un hijo trasladándose DENTRO de un
            padre estático. `overflow-hidden` SOBREVIVE en este elemento, pero ya no hace de máscara
            de ENTRADA: nada se mueve RELATIVO a esta caja (la `<Image fill>` de adentro nunca se
            traslada; siempre ocupa el 100% de su padre) — su único trabajo es seguir redondeando las
            esquinas cuadradas de la imagen al `sf-radio-tile` de la caja, igual que en
            `Spotlight.tsx`/`GrindChooserRiel.tsx`. Cuando el CSS `transform` se aplica al elemento
            que YA tiene el `overflow-hidden` (en vez de a un hijo suyo), el recorte y el movimiento
            viajan JUNTOS: la caja entera —con su contenido adentro, sin que nada se desborde de sí
            misma— se traslada en pantalla como una unidad rígida, nunca a medio recortar. Por eso
            "sube desde abajo" ahora significa POSICIÓN (la caja completa, bajo su lugar final,
            volviéndose opaca a la vez), no un recorte progresivo de su contenido.

            MISMA VENTANA/CURVA, SIN CAMBIO — sólo se retira el envoltorio de dos elementos; las
            funciones (`transformRevelaTextoDisplay`/`opacidadRevelaTextoDisplay` con
            `UMBRAL_ENTRADA_TARJETA_MARQUESINA`/`techo=1`) y el momento en que la tarjeta
            arranca/completa NO cambian — el `translateY(N%)` sigue relativo a la PROPIA CAJA del
            elemento (ahora la única caja que existe), así que el recorrido en píxeles es idéntico al
            de antes de esta ronda. El loop de texto (arriba, § "EL LOOP DE TEXTO") SIGUE con su
            máscara+motor de tres elementos — ahí el efecto enmascarado es el deseado y no se toca.

            EXTRAÍDO a `MarquesinaMotor.tsx` (`MarquesinaTarjetaMotor`), § EDITOR-TIENDA-MARQUESINA-
            SECCION-1 — mismo JSX de siempre, SIN `ventanaSalida` (la tarjeta del hero nunca se va:
            una vez revelada, se queda) y `posicion="relativa"` (el default de ese componente — ESTE
            `<section>` centra con flex, no apila tarjetas una sobre otra como la sección suelta). */}
        {producto && (
          <MarquesinaTarjetaMotor
            producto={producto}
            progreso={progreso}
            estatico={estatico}
            ventanaEntrada={UMBRAL_ENTRADA_TARJETA_MARQUESINA}
            techo={1}
          />
        )}

        {/* FRASE AL PIE (§ HERO-FRASE-AL-PIE-Y-PREVIEW-1, § el docstring de cabecera "LA FRASE AL
            PIE"): ENFRENTADA al cue de abajo (derecha vs. su izquierda). Rol de color PLENO desde
            § HERO-FRASE-COLOR-PLENO-1 (el docstring de cabecera, "EL COLOR — LA CAUSA REAL") — ya NO
            el mismo token que `HeroMedia.tsx`, que se queda en el rol suave. Vacío → SE OMITE; SIN
            gate de preview (a diferencia del cue), es texto estático que el "cuadro compuesto" de la
            vista previa debe mostrar si hay dato.
            `sf-peso-normal`, no `font-normal` (§ CORTE-CUERPO-FIGTREE-PESO-1, § el docstring de
            cabecera "EL PESO"): sigue al `--sf-peso-cuerpo` del par ('prensa'/440 en CORTE), en vez de
            un 400 fijo — fallback 400 para cualquier otro tenant. */}
        {hero.fraseAlPie && (
          <p
            className="absolute bottom-8 right-4 z-10 max-w-[34ch] text-right text-[13px] sf-peso-normal leading-relaxed text-balance text-[var(--sf-sobre-banda,white)] sm:bottom-10 sm:right-6 sm:text-sm lg:bottom-12 lg:right-8"
            style={estiloInlineDeElemento(hero.estilos.fraseAlPie, 'leyenda', tema.fuentePar)}
          >
            <CampoEditable campo="hero.fraseAlPie" multilinea>{hero.fraseAlPie}</CampoEditable>
          </p>
        )}

        {/* CUE ANIMADO "DESLIZA" — RONDA 2 (§ el docstring de cabecera): MISMO marcado que
            `HeroMedia.tsx` (data-hero-cue, la línea + el segmento que la recorre + la etiqueta),
            leyendo el MISMO campo `hero.cueDesliza`. Se OMITE en preview (scrollear no significa
            nada en un marco de vista previa); reduced-motion lo congela vía `ReducedMotionProvider`
            (global), sin guard propio. */}
        {hero.cueDesliza && !preview && (
          <div
            data-hero-cue="desliza"
            className="absolute bottom-8 left-4 z-10 flex flex-col items-start gap-3 sm:bottom-10 sm:left-6 lg:bottom-12 lg:left-8 text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]"
          >
            <div className="relative h-14 w-px overflow-hidden bg-[var(--sf-linea-sobre,white)]/30">
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1/2 w-full bg-[var(--sf-sobre-banda,white)]"
                animate={{ y: ['-100%', '220%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <span className="text-xs font-normal uppercase tracking-[0.11em]">Desliza</span>
          </div>
        )}
        {/* LA ZONA «INDICADOR» (§ EDITOR-TIENDA-ZONAS-1) — mismo criterio que `HeroMedia.tsx`:
            esquina opuesta a "Desliza" para no superponerse. */}
        {activoEditor && (
          <div className="absolute right-4 bottom-8 z-20 sm:right-6 lg:right-8">
            {hero.cueDesliza ? (
              <ZonaChip onClic={{ campo: 'cueDesliza', valor: 'false' }}>Quitar Indicador</ZonaChip>
            ) : (
              <ZonaChip onClic={{ campo: 'cueDesliza', valor: 'true' }}>+ Indicador</ZonaChip>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
