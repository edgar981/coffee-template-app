"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { productosDelRiel } from "@/lib/storefront/presentaciones";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { formatCOP } from "@duna/core/utils";
import { fotoHover } from "@/lib/storefront/foto-hover";
import { decidirMolienda } from "@duna/core/moliendas-opciones";
import { imagenPortada } from "@/lib/producto-imagen";
import { useCartStore } from "@/lib/cartStore";
import { toast } from "sonner";
import { contenedorAnchoClase } from "@/lib/config/themes";
import VistaRapidaProducto from "@/components/storefront/VistaRapidaProducto";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";

// LA VARIANTE "RIEL" (§ CORTE-PRESENTACIONES-RIEL-1, MEDIDA contra
// `docs/prototipos/cafeone/index.html:225-247` + `css/app.css:508-559` + `js/home.js:90-190`). Mosaico
// apila en un grid y índice enumera en una lista vertical; el riel pone las tarjetas en una fila que
// SE DESPLAZA horizontalmente, con controles de avance — la composición que el prototipo llama
// "carousel" (`.pres-rail`).
//
// EL DESPLAZAMIENTO ES NATIVO, NO UN ESTADO PARALELO (§ el estándar del owner): el track es un
// `overflow-x-auto` normal con `scroll-snap`; los botones de avance/retroceso llaman `scrollBy` sobre
// ESE MISMO elemento — no mueven un índice que después se traduce a un `transform`. Así el riel queda
// usable con el dedo, la rueda del mouse (shift+scroll) o el teclado (`tabIndex` + las flechas nativas
// del navegador sobre un contenedor con overflow) SIN que un solo botón se toque — los botones son un
// atajo sobre el mismo scroll, no el único camino. Respeta `prefers-reduced-motion`
// (`window.matchMedia`, el mismo patrón que ya usa `app/(storefront)/checkout/page.tsx` para su propio
// `window.scrollTo`): con la preferencia activa, el salto es instantáneo en vez de `smooth`. El
// `<MotionConfig reducedMotion="user">` del layout (§ `lib/animation.ts`) cubre las animaciones de
// entrada de `framer-motion`, pero NO un `Element.scrollBy` nativo — por eso este componente lee la
// media query por su cuenta, igual que el checkout.
//
// EL ESTADO `puedeAtras`/`puedeAdelante` SÓLO DESHABILITA LOS BOTONES; NUNCA OCULTA TARJETAS NI
// BLOQUEA EL SCROLL NATIVO. Con pocos productos es común que todos quepan sin nada que desplazar:
// ahí los dos botones nacen deshabilitados, y el riel se ve como una fila corta y quieta — no como un
// carrusel roto. Se mide con el propio `scrollWidth`/`clientWidth` del track, recalculado en cada
// scroll y en cada resize; en SSR (sin `useEffect`) los dos botones parten deshabilitados, que es el
// estado seguro (nunca prometen un desplazamiento que todavía no se pudo medir).
//
// LA CABECERA PARTE EN DOS, COMO EL PROTOTIPO (`.pres-head`): antetítulo+título de un lado, el CTA
// "Comprar" de `.pres-head` (`index.html:233`) del otro — un ATAJO SOBRE EL PROPIO SCROLL, no
// fabricado. `presentaciones.ctaLabel`/`.ctaDestino` (§ MUESTRARIO-SECCION-CTA-1, la capacidad
// GENERAL: cualquier sección puede declarar su propio botón opcional) resuelven el href con
// `resolverCtaSeccion` — vacío = sin botón, byte-idéntico. La canónica `GrindChooserMosaico` sigue
// sin CTA propio (esa banda no lo lleva, § site-content-defaults.ts, "LA PÁGINA /nosotros" y su nota
// sobre el anzuelo de la home) — no es un hueco, es que nadie lo pidió ahí.
//
// LA ENTRADA DE LA CABECERA (§ SECCIONES-ENTRAN-VIVAS-1): antetítulo/título/CTA entran con
// `RevelarBloque` — las TARJETAS (`TarjetaRiel`) NO cambian, a propósito: su `fadeUp` de 24px es la
// mitad de la razón por la que el track declara `overflow-y-hidden`
// (§ RIEL-SIN-SCROLL-VERTICAL-1, arriba); subir esa distancia a 50px habría agrandado ese mismo
// desborde de pintado, no achicado el problema que ese fix cierra.
//
// LOS CONTROLES DE AVANCE VIVEN DEBAJO DEL TRACK, NO EN LA CABECERA (§ PARIDAD-RIEL-TARJETAS-1,
// MEDIDO contra `riel-antes-1440`/`riel-antes-390`, DECISIONS.md, y `.car-nav` del prototipo,
// `index.html:241-246` + `css/app.css:553-559`). Siguen ocultos bajo `sm` (`.car-nav{display:none}`
// bajo 640px, `css/app.css:1008` — el touch-scroll ya cubre ese caso ahí) y siguen llamando al MISMO
// `desplazar` sobre el MISMO `trackRef`.
//
// LO QUE EL PROTOTIPO TIENE Y ESTA VARIANTE SIMPLIFICA A PROPÓSITO (medido, no un descuido):
//   1. El arrastre con el mouse (`pointerdown`/`pointermove`, `js/home.js:150-175`): el `overflow-x-
//      auto` nativo ya da drag por touch/trackpad y una barra de scroll utilizable; emular arrastre de
//      mouse es una capa de JS que el desplazamiento nativo no necesita para ser usable.
//
// LA TARJETA NO LLEVA "Ver café {label}" — a DIFERENCIA del mosaico, A PROPÓSITO. El mosaico repite
// ese texto (§ CLAUDE.md, "COPY café-shape del storefront", Backlog #63) porque su tarjeta es una
// tile grande con una sola línea de acción; acá el nombre del PRODUCTO ya cumple ese rol.
//
// El gate de visibilidad (`seccionEsVisible`) vive en el DISPATCHER (`GrindChooser.tsx`), no acá.
//
// EL `negocio` DEL ALT LLEGA POR PROP, no por `useSiteSettings()` — mismo motivo que el mosaico y el
// índice (§ GrindChooserMosaico): se monta también en la vista previa del panel, sin el
// `SiteSettingsProvider` del storefront.
//
// ── RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 (2026-09-30) — LAS TARJETAS SON PRODUCTOS DEL CATÁLOGO ─────────
//
// EL GATE DEL OWNER, LITERAL, sobre `PARIDAD-RIEL-TARJETAS-1` ya aplicada: «Las imágenes de productos
// en "presentaciones" se ven en muy pésima calidad» y «el efecto que tienen las cards no es el
// esperado... la segunda tarjeta está todo el tiempo "activa"... el efecto debería ser, cada vez que
// haga hover sobre la tarjeta me muestre la otra foto que esa tarjeta tenga asignada... Si el ícono de
// "ojo" se toca debería abrirse un modal como el adjunto de cafeone (Guji Coba Pack)».
//
// LA FUENTE PASA A SER EL CATÁLOGO (`productosDelRiel`, § lib/storefront/presentaciones.ts) — ya NO
// las tarjetas configuradas (`label1..4`/`copy1..4`/`imagen1..4`/`categoria1..4`, § site-content-
// defaults.ts). `tarjetasDePresentaciones`/`precioMinimoCategoria` SE RETIRARON de este componente
// (siguen sirviendo a mosaico/índice la primera; la segunda quedó sin consumidores y se borró, § el
// docstring de `presentaciones.ts`) — cada tarjeta ES un producto, con su PROPIO precio real, no un
// "desde" agregado por categoría. El panel de `/admin/tienda` sigue mostrando los campos de tarjeta
// (nombre/descripción/imagen/destino) para esta sección: NO APLICAN bajo esta composición (§ el hint
// de cada campo en `components/admin/tienda-secciones.ts`) — la vista previa del panel sigue
// funcionando (monta el MISMO `GrindChooserRiel`, bajo el MISMO `CartProvider` inerte que ya cubre a
// cualquier `SeccionVista`, § `VistaTiendaEnVivo.tsx`).
//
// SIN TARJETA "ACTIVA" AGRANDADA: `useIndiceCentrado`/el resaltado por-scroll (`.pres-card.is-active`)
// se RETIRARON (§ el docstring que queda en su lugar en `lib/animation.ts`). En su reemplazo, CADA
// tarjeta cambia a su PROPIA "foto de atrás" —la primera adicional de su galería— al pasar el
// mouse (o con foco de TECLADO, § VISTA-RAPIDA-CENTRADA-1 abajo) — un crossfade de opacidad, sin
// escalar ni atenuar las vecinas. Sin foto de atrás, la portada se queda quieta.
//
// EL PAR frente/atrás SE EXTRAJO a `lib/storefront/foto-hover.ts` (§ TIENDA-HOVER-SEGUNDA-FOTO-1):
// `fotoHover` envuelve `galeriaCompleta` para que `ProductCard.tsx` (/tienda y "Nuestro Catálogo"
// de la home) reuse la MISMA regla en vez de recalcularla — el mismo criterio de siempre: dos
// tarjetas que decidan "cuál es la foto de atrás" por su cuenta son dos sitios donde eso puede
// divergir.
//
// FOCO DE TECLADO, NO `:focus-within` A SECAS — § VISTA-RAPIDA-CENTRADA-1 (2026-09-30). El gate del
// owner: "si doy click en el 'ojo' para la vista previa, y me salgo, luego la imagen del producto
// que persiste es la que sale solamente cuando se hace hover. Así haga hover de nuevo sobre la
// tarjeta no se quita." `group-focus-within:` reacciona a CUALQUIER foco dentro de `.group`, no sólo
// al de teclado — y `VistaRapidaProducto.tsx` (§ `cerrarYDevolverFoco`) le devuelve el foco al botón
// "ojo" (DENTRO de `.group`) al cerrar el modal. Ese `.focus()` programático deja la tarjeta en
// `:focus-within` HASTA que el foco salga de ella por otro camino, así que la foto de atrás —y los
// botones de acción— quedaban pegados aunque el mouse ya no estuviera encima. Reemplazado por
// `group-has-[:focus-visible]:` (CSS `:has()`, soportado en Chrome/Firefox/Safari desde 2023): sólo
// reacciona cuando un DESCENDIENTE muestra el anillo de foco VISIBLE —el caso real de Tab, nunca el
// de un clic de mouse ni el de un `.focus()` programático tras cerrar el modal, que los navegadores
// no marcan `:focus-visible`—. Con mouse sigue siendo sólo `group-hover:`.
//
// EL NOMBRE LLEVA EL SUBRAYADO DEL NAV — MISMOS TOKENS, GRAMÁTICA DISTINTA (§ RIEL-SUBRAYADO-
// CURSOR-NITIDEZ-1, gate del owner del 2026-09-30 con captura del riel desplegado: "como hacemos
// para que el delineado se vea en todo el nombre y no solo como en la parte de abajo"). El
// `navHoverClase` de `StoreNav.tsx` (`.nav-link::after` del prototipo) es un pseudo-elemento
// ABSOLUTO sobre un elemento de BLOQUE: un solo rectángulo pegado al borde inferior del bloque
// ENTERO — sirve para un link corto de una línea, pero un nombre de producto que PARTE en varias
// líneas (a diferencia de los ítems fijos del nav) lo dibuja sólo bajo la ÚLTIMA línea, con el ancho
// del bloque completo — exactamente el defecto de la captura.
//
// ACÁ el subrayado es un `background-image` sobre un `<span>` INLINE con `box-decoration-clone`:
// cada línea que el texto envuelto arma es, para el navegador, una CAJA DE PINTADO propia — con
// `box-decoration-clone` cada una pinta SU PROPIA copia del `background`, así que el subrayado SIGUE
// al texto línea por línea. `background-position:left bottom` + `background-size` de `0%` a `100%`
// (en vez de `scale-x`) da el mismo crecimiento-desde-la-izquierda que `after:origin-left
// after:scale-x-0`; el `<span>` no puede ser el h3 mismo (un bloque no re-pinta su fondo por línea,
// sólo un inline con `box-decoration-clone` lo hace), así que el nombre vive en un span propio
// (abajo, en `TarjetaRiel`).
//
// LOS MISMOS TOKENS, REUSADOS — no una paleta nueva: `220ms`/`cubic-bezier(0.22,0.61,0.36,1)` (la
// curva y duración exactas de `StoreNav.tsx`), `1px` (el grosor, ahí `h-px`, acá el alto del
// `background-size`) y `currentColor` (ahí `bg-current`, acá `linear-gradient(currentColor,
// currentColor)` — el mismo color de texto heredado, sea cual sea `origenTexto`).
// `motion-reduce:transition-none` = "aparece sin animar" bajo `prefers-reduced-motion: reduce` (el
// `<MotionConfig reducedMotion="user">` del layout cubre las entradas de `framer-motion`, no un
// `transition` de CSS puro — mismo motivo por el que `desplazar()`, arriba, lee la media query por
// su cuenta).
//
// `navTratamiento.subrayado` sigue siendo `false` para todo tenant salvo CORTE (§ site-content-
// defaults.ts) — sin ese eje, el nombre vuelve a su subrayado de HOY (`hover:underline`, nativo,
// que YA sigue el texto línea por línea sin ningún truco — el defecto es EXCLUSIVO de la gramática
// `after:`), byte-idéntico.
//
// DOS ACCIONES RÁPIDAS, COMO `.quick-acts` DEL PROTOTIPO (`js/home.js:99-102`): el OJO abre la vista
// rápida SIEMPRE (`VistaRapidaProducto.tsx`, § su propio docstring — la referencia es el tema real,
// no el modal simple del prototipo); el CARRITO reusa la MISMA regla que ya decide en `ProductCard`
// (`decidirMolienda`): una sola molienda disponible (o ninguna declarada) agrega 1 directo, con el
// MISMO camino de siempre (`addItem` + `toast.success` — `addItem` ya abre el carrito por su cuenta,
// § `lib/cartStore.tsx`); con varias, abre la MISMA vista rápida para elegir. Los dos botones son
// SIBLINGS del `<Link>` de la imagen (nunca hijos: un `<button>` dentro de un `<a>` es HTML inválido y
// además su click navegaría) — posicionados absolutos sobre la tarjeta, visibles en `group-hover`/
// `group-has-[:focus-visible]:` (§ VISTA-RAPIDA-CENTRADA-1, arriba — el mismo cambio que la foto de
// atrás, por la misma razón: el foco devuelto al cerrar la vista rápida no debe dejarlos pegados).
//
// ── ACCIONES-RAPIDAS-CUADRADAS-1 (2026-09-30) — FORMA CUADRADA + ENTRADA DEL PROTOTIPO ─────────────
//
// GATE DEL OWNER, LITERAL: «Lo que encierra al carrito y ojo, en las tarjetas donde se use, debe ser
// cuadrado, no circular… Y el efecto que tienen de aparecer/desaparecer al hacer hover debe ser como
// el del prototipo, no el actual.»
//
// FORMA: `rounded-full` → `sf-pildora` (§ formas.ts/globals.css). El prototipo mide el MISMO token de
// radio para `.quick-acts button` y `.btn` (`css/app.css:126,540`, los dos `border-radius:var(--radius-
// button)`) — es el rol de radio de BOTÓN/CHROME que `sf-pildora` YA sigue (0 bajo 'recta', la CTA de
// este mismo componente ya lo usa, línea de abajo). Ningún token nuevo: Suave (Nayoli, sin preset)
// sigue cayendo al fallback `calc(infinity*1px)` = el `rounded-full` de HOY — byte-idéntico.
//
// RE-MEDIDO (§ SUSCRIPCION-FOTO-LEGIBLE-Y-ACCIONES-REDONDEADAS-1, 2026-10-01) — gate del owner con
// captura: "Los cuadros del carrito y 'ojo' están muy rectos, redondea las esquinas sólo un poco". El
// `0` de `sf-pildora` bajo 'recta' es RECTO A PROPÓSITO (el radio de botón/chrome del prototipo); lo
// que el owner pide es un radio CHICO, no el de botón — y ESE rol YA EXISTE: `sf-radio-lg`
// (`--sf-radio-lg`, 2px en 'recta' / 6px en 'minima'), el mismo "radio de chips/controles pequeños"
// que `lib/storefront/pdp-botones.ts` ya usa para botones cuadrados de 36px idénticos a estos (§ su
// propio comentario: "el rol de 'chips/controles pequeños' que formas.ts YA conecta"). Sólo los DOS
// botones de acción rápida (ojo/carrito) migran de `sf-pildora` a `sf-radio-lg` — NO el CTA "Comprar"
// de abajo (ESE sigue siendo radio de BOTÓN, `sf-pildora`, lo que el prototipo mide para un botón de
// verdad) ni el badge/las píldoras de notas de `ProductCard.tsx` (`sf-pildora`, intactas: tocar el rol
// `pildora` en vez de migrar SÓLO estos dos botones habría redondeado también esas píldoras, que NO
// son el defecto reportado).
//
// NAYOLI NO CAMBIA, PERO NO POR EQUIVALENCIA DE FALLBACK — por INALCANZABILIDAD, la MISMA razón ya
// escrita en `ACCIONES-RAPIDAS-CUADRADAS-1` (arriba): `presentaciones.variante==='riel'` SÓLO lo
// declara CORTE, así que Nayoli JAMÁS renderiza este componente, sea cual sea el token que use. Ojo:
// `sf-radio-lg` y `sf-pildora` NO son fallbacks equivalentes en una caja de 40×40px —`--sf-radio-lg`
// cae a `0.75rem` (12px, un cuadrado de esquinas redondeadas) contra `calc(infinity*1px)` de
// `--sf-pildora` (círculo completo, excede el radio clampeable)—, así que si este componente SÍ
// renderizara sin forma custom, el swap SÍ se vería. No ocurre porque no renderiza, no porque los
// fallbacks coincidan.
//
// ENTRADA/SALIDA: el contenedor DEJA de animar opacidad (antes `opacity-0 transition-opacity
// duration-300 group-hover:opacity-100`, sólo posiciona) — cada BOTÓN anima su propia
// opacidad+posición, como `.quick-acts button` del prototipo (`css/app.css:538-548`): reposo
// `opacity-0 translate-x-[14px]` (desliza desde la derecha, el eje por el que el botón "entra"),
// hover/foco de la TARJETA → `opacity-100 translate-x-0`. `duration-[220ms] ease-[cubic-bezier
// (0.22,0.61,0.36,1)]` = `--duration-base`/`--ease-out` EXACTOS del prototipo (`tokens.css:192,189`),
// el MISMO par que ya usa `navHoverClase` en este archivo — token reusado, no inventado.
// `transition-all` (no `transition-colors` suelto) porque el HOVER de fondo/texto (`hover:bg-[var(
// --sf-acento)]`) comparte la MISMA propiedad `transition-property` que el nuevo slide — dos clases
// `transition-*` en el mismo elemento se pisan (la última en el orden de Tailwind gana), así que se
// unifican en una sola declaración. DEVIACIÓN DECLARADA: el prototipo parte la duración del color en
// `--duration-fast` (120ms, `var(--transition-color)`) separada de la de opacidad/transform (220ms,
// `--duration-base`) — acá las CUATRO viajan a 220ms. Tailwind v4 no compone dos duraciones distintas
// en una sola utilidad sin CSS arbitrario propio (`[transition:…]`, sin precedente en este repo); el
// costo de escribirlo a mano no se justifica por 100ms de diferencia en un hover de fondo que no era
// el foco del gate del owner (forma + entrada, no la velocidad del tinte).
//
// STAGGER: el CARRITO (2º botón, siempre el último en el flex-col) lleva `delay-[60ms]` — el MISMO
// `.quick-acts button:nth-child(2){transition-delay:60ms}` del prototipo. Con el producto sin stock
// el carrito no se renderiza y el ojo queda SOLO, sin retraso — igual que `:nth-child(2)` no
// matchearía con un solo hijo.
//
// `prefers-reduced-motion` NO necesita guard propio acá: la regla GLOBAL de `app/globals.css`
// (`*,*::before,*::after{transition-duration:0.01ms!important}`) ya neutraliza cualquier transición
// nueva, el MISMO mecanismo que el bloque §19 del prototipo (`css/app.css:1035-1039`).
//
// FOTOS SIN BORDE (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1) — REVIERTE el punto 1 de abajo,
// `object-contain`, de `PARIDAD-RIEL-TARJETAS-1`. Gate del owner con captura (`onix-riel-borde.webp`):
// "en... presentaciones las imágenes hay que acomodarlas para que no se vea el borde" — `contain`
// dentro del `p-6` dejaba ver `bg-[var(--sf-linea)]` alrededor de la foto como un RECTÁNGULO con
// borde propio dentro del tile, el defecto exacto de la captura. La premisa que justificaba `contain`
// —"una foto cuya proporción real no sea exactamente 3:4"— YA NO APLICA: el owner subió fotos 3:4 de
// ≥1500px, la MISMA proporción del tile (`aspect-[3/4]`), así que `object-cover` sin relleno no
// recorta nada perceptible. Vuelve a `object-cover`, sin `p-6`: la foto llena el tile borde a borde,
// con el radio de `sf-radio-tile` (`overflow-hidden` en el ancestro).
//
// FOTOS NÍTIDAS — MEDIDO, LOS OTROS DOS EJES DE `PARIDAD-RIEL-TARJETAS-1` QUE EL OBJECT-FIT NO TOCA:
//   1. `sizes`: el valor de antes (`"(max-width: 640px) 78vw, 360px"`) declaraba un ancho FIJO de
//      360px para TODO viewport ≥640px, pero el ancho real es `clamp(260px,26vw,360px)` — con piso de
//      260px hasta que `26vw` lo supere (viewport ≥1000px aprox.). Entre 640 y 1000px, `26vw` da MENOS
//      de 260px (p. ej. 216px a 830px de viewport): el navegador subestimaba el ancho real y pedía una
//      imagen más chica de la que iba a mostrar, un caso genuino de sub-muestreo. Corregido a
//      `"(max-width: 640px) 78vw, (max-width: 1000px) 260px, 360px"` — sigue el piso/techo real del
//      `clamp` en vez de un valor plano. SIGUE VIGENTE con `cover`: el ancho renderizado del tile no
//      cambió, sólo cómo la foto lo llena.
//   2. `quality`: subido a 90 (por encima del 85 que ya usan los heroes, `HeroMedia.tsx` y hermanos) —
//      la calidad por defecto de `next/image` es 75, calibrada para fotografía genérica; el empaque de
//      un producto es la pieza que el riel existe para vender, y merece el mismo tratamiento.
//
// LÍMITE DECLARADO: estas correcciones se derivaron por ARITMÉTICA sobre las clases (el mismo método
// que ya usa `MARQUEE_TITULO_FONT_SIZE`, § lib/animation.ts, para medir sin navegador), no por una
// captura en vivo del `naturalWidth` servido contra una foto real de un cliente — no hay acceso a las
// imágenes subidas de un tenant real desde este carril. El antes/después está en `DECISIONS.md`.
//
// `TarjetaRiel` SE EXPORTA aparte (§ el mismo criterio que `precioMinimoCategoria`/etc.: "se extrae
// lo que tiene el defecto para poder afirmarlo en un test") por una razón CONCRETA de este slice: la
// fuente de tarjetas es ahora `getCatalog()`, un `fetch` en un `useEffect` que `renderToStaticMarkup`
// (SSR, sin navegador, § `presentaciones-riel.test.ts`) NUNCA ejecuta — con el componente completo,
// el catálogo queda SIEMPRE `[]` y ninguna tarjeta llega a renderizarse, así que sus clases (`sf-
// radio-tile`, `object-contain`, `sizes`, el subrayado del nombre) quedarían INAFIRMABLES sin esta
// extracción. `TarjetaRiel` no depende del catálogo ni de `useCartStore` — recibe el producto y los
// dos manejadores por prop —, así que un test puede rendirla con un producto de mentira sin fetch ni
// `CartProvider`.
interface TarjetaRielProps {
  producto: Product;
  negocio?: string;
  navHoverClase: string;
  preview: boolean;
  index: number;
  onEye: (producto: Product, disparador: HTMLElement) => void;
  onCart: (producto: Product, disparador: HTMLElement) => void;
}

export function TarjetaRiel({ producto, negocio, navHoverClase, preview, index, onEye, onCart }: TarjetaRielProps) {
  const { frente, atras: fotoAtras } = fotoHover(producto);
  const fotoFrente = imagenPortada(frente);
  const href = `/tienda/${producto.slug}`;
  return (
    <motion.div
      initial={preview ? false : "hidden"}
      animate={preview ? "visible" : undefined}
      whileInView={preview ? undefined : "visible"}
      viewport={preview ? undefined : { once: true }}
      variants={fadeUp}
      transition={{ delay: index * 0.08 }}
      className="group relative w-[78vw] shrink-0 snap-center sm:w-[clamp(260px,26vw,360px)]"
    >
      {/* El tile: `sf-radio-tile` (§ PARIDAD-RIEL-TARJETAS-1) — el rol PROPIO de forma para media
          grande, con `object-cover` sin relleno (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1, el
          docstring de cabecera, "fotos sin borde") — la foto llena el tile, nunca deja ver el
          fondo `--sf-linea` como un borde propio alrededor. */}
      <Link href={href} className="block">
        <div className="relative aspect-[3/4] overflow-hidden sf-radio-tile bg-[var(--sf-linea)]">
          {/* `fotoFrente` sale de `imagenPortada` (§ lib/producto-imagen.ts): SIEMPRE un src
              válido — el placeholder de marca si el producto no tiene foto — así que se renderiza
              sin condición, nunca un `<img src="">` roto. */}
          <Image
            src={fotoFrente}
            alt={negocio ? `${negocio} ${producto.nombre}` : producto.nombre}
            fill
            sizes="(max-width: 640px) 78vw, (max-width: 1000px) 260px, 360px"
            quality={90}
            className={`object-cover transition-opacity duration-500 ${fotoAtras ? 'group-hover:opacity-0 group-has-[:focus-visible]:opacity-0' : ''}`}
          />
          {/* La foto de atrás (§ el docstring de cabecera): crossfade al hover de la TARJETA
              entera, no sólo de la imagen — pedido explícito del owner. */}
          {fotoAtras && (
            <Image
              src={fotoAtras}
              alt=""
              fill
              sizes="(max-width: 640px) 78vw, (max-width: 1000px) 260px, 360px"
              quality={90}
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
            />
          )}
        </div>
      </Link>

      {/* Las dos acciones rápidas (§ el docstring de cabecera, "quick-acts" del prototipo): SIBLINGS
          del `<Link>`, nunca hijos — un botón dentro de un enlace es inválido y además navegaría al
          clickearlo. El CONTENEDOR sólo posiciona — cada botón anima su PROPIA opacidad+posición
          (§ ACCIONES-RAPIDAS-CUADRADAS-1, arriba), como `.quick-acts button` del prototipo.

          FONDO/SOMBRA/HOVER (§ BADGES-ACCIONES-Y-LOGO-CORTE-1, re-medido contra el muestrario
          desplegado): `.quick-acts button` (`docs/prototipos/cafeone/css/app.css:538-548`) pinta
          `background:var(--surface-page)` —fondo de PÁGINA, no de tarjeta— SIN sombra, y su
          `:hover` usa `--action-primary`/`--text-on-accent` —la acción PRIMARIA (el rojo), no el
          dorado—. `--surface-page` es `#fdfbf7` (`tokens.css:57`), el MISMO hex que la raíz
          `fondo` de CORTE → `--sf-fondo` (base token, siempre definido, sin fallback). `--action-
          primary`/`--text-on-accent` → `--sf-accion`/`--sf-accion-txt` (§ StoreNav.tsx, el mismo
          par que ya viste el contador del carrito y el CTA "Explorar" de esta banda, línea de
          abajo), CON fallback a `--sf-tostado`/`--sf-tinta`: este componente sólo renderiza bajo
          CORTE (inalcanzable para Nayoli, § el docstring de `ProductCard.tsx`), pero el fallback
          sigue la convención del resto del archivo (línea del CTA "Explorar"), no un dato nuevo. */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={(e) => onEye(producto, e.currentTarget)}
          aria-label={`Vista rápida de ${producto.nombre}`}
          className="pointer-events-auto flex h-10 w-10 translate-x-[14px] cursor-pointer items-center justify-center sf-radio-lg bg-[var(--sf-fondo)] text-[var(--sf-tinta)] opacity-0 transition-all duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100 hover:bg-[var(--sf-accion,var(--sf-tostado))] hover:text-[var(--sf-accion-txt,var(--sf-tinta))]"
        >
          <Eye className="h-[18px] w-[18px]" />
        </button>
        {producto.disponible && (
          <button
            type="button"
            onClick={(e) => onCart(producto, e.currentTarget)}
            aria-label={`Agregar ${producto.nombre} al carrito`}
            className="pointer-events-auto flex h-10 w-10 translate-x-[14px] cursor-pointer items-center justify-center sf-radio-lg bg-[var(--sf-fondo)] text-[var(--sf-tinta)] opacity-0 transition-all delay-[60ms] duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100 hover:bg-[var(--sf-accion,var(--sf-tostado))] hover:text-[var(--sf-accion-txt,var(--sf-tinta))]"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* NOMBRE Y PRECIO EN UNA LÍNEA (`.pres-meta{display:flex;justify-content:space-between}`, §
          el docstring de cabecera) — precio EXACTO del producto, nunca un "desde" agregado. */}
      <div className="pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <Link href={href} className="inline-block">
            {/* El subrayado vive en el SPAN, no en el h3 (§ el docstring de cabecera): sólo un
                inline con `box-decoration-clone` re-pinta su fondo por línea; un bloque no. */}
            <h3 className="text-xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))]">
              <span className={navHoverClase}>{producto.nombre}</span>
            </h3>
          </Link>
          <span className="shrink-0 text-base text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">
            {formatCOP(producto.precio)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function GrindChooserRiel({ negocio, style }: { negocio?: string; style?: React.CSSProperties }) {
  const { presentaciones, tema, paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const trackRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState({ puedeAtras: false, puedeAdelante: false });
  const { addItem } = useCartStore();

  // La vista rápida es COMPARTIDA por todas las tarjetas: un solo modal, montado una vez, con el
  // producto y el botón "ojo" que lo abrió (para devolverle el foco al cerrar).
  const [vistaRapida, setVistaRapida] = useState<{ producto: Product; disparador: HTMLElement } | null>(null);
  function abrirVistaRapida(producto: Product, disparador: HTMLElement) {
    setVistaRapida({ producto, disparador });
  }
  function cerrarVistaRapida() {
    setVistaRapida(null);
  }

  const ctaHref = resolverCtaSeccion(presentaciones.ctaLabel, presentaciones.ctaDestino, paginas);

  // EL CATÁLOGO (§ el docstring de cabecera) — `getCatalog()` es el MISMO fetch memoizado que ya usan
  // Spotlight/Marquesina; en SSR el `useEffect` nunca corre, así que `catalog` queda `[]` y ninguna
  // tarjeta se muestra hasta que el navegador lo resuelve — el mismo límite ya documentado para
  // Spotlight en `admin-tienda-preset.test.ts`, y por lo mismo es SEGURO montar este componente en la
  // vista previa del panel: no hay hook que dependa de un provider que no esté ya cubierto
  // (`SiteContentProvider`/`CartProvider`, § `VistaTiendaEnVivo.tsx`).
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  const tarjetas = productosDelRiel(catalog);

  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1) — MEDIDO EXACTAMENTE ACÁ: CORTE (`presentaciones:
  // 'riel'`) es el ÚNICO preset que usa esta variante y el ÚNICO que declara `escalaDisplay:
  // 'amplia'`. `undefined` sin escala declarada → NO se toca el `style`, que sigue rindiendo
  // `text-3xl sm:text-4xl` (1.875rem/2.25rem, medido) — byte-idéntico.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte. El ANCHO de cada tile
  // (`w-[78vw] sm:w-[clamp(260px,26vw,360px)]`, más abajo) es relativo al VIEWPORT, no a este
  // contenedor, así que no cambia — sólo cambia cuánto track queda visible antes de scrollear.
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  // EL SUBRAYADO DEL NOMBRE (§ el docstring de cabecera) — MISMOS tokens que `StoreNav.tsx`
  // (220ms, la curva, 1px, currentColor), gramática de `background-size` sobre un `<span>` inline
  // con `box-decoration-clone` para que siga al texto PARTIDO en varias líneas.
  const navHoverClase = navTratamiento.subrayado
    ? '[background-image:linear-gradient(currentColor,currentColor)] bg-no-repeat bg-left-bottom bg-size-[0%_1px] box-decoration-clone transition-[background-size] duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-size-[100%_1px] motion-reduce:transition-none'
    : 'hover:underline';

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function medir() {
      if (!track) return;
      setEstado({
        puedeAtras: track.scrollLeft > 4,
        puedeAdelante: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
      });
    }
    medir();
    track.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      track.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
    // Recalcula si cambia el número de tarjetas (el catálogo termina de cargar) — el ancho del
    // track puede cambiar sin que el usuario haya scrolleado todavía.
  }, [tarjetas.length]);

  function desplazar(direccion: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direccion * track.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }

  // El carrito rápido (§ el docstring de cabecera): agrega directo cuando no hay nada que preguntar
  // (`decidirMolienda`, la MISMA regla que `ProductCard.tsx`); si la elección es real (o el producto
  // está agotado de moliendas), abre la vista rápida en su lugar.
  function agregarRapido(producto: Product, disparador: HTMLElement) {
    if (!producto.disponible) return;
    const decision = decidirMolienda(producto.moliendasOpciones);
    if (decision.modo === 'ninguna' || decision.modo === 'automatica') {
      addItem(producto, 1, decision.modo === 'automatica' ? { molienda: decision.nombre } : {});
      toast.success(`${producto.nombre} agregado al carrito`);
      return;
    }
    abrirVistaRapida(producto, disparador);
  }

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))] overflow-hidden" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        {/* La cabecera partida (§ arriba): título de un lado, el CTA del otro — SIN los controles de
            avance, que ahora viven DEBAJO del track (§ el docstring de cabecera). En columna en
            móvil, como el prototipo (`.pres-head{flex-direction:column}` bajo 640px). */}
        <div className="flex flex-col items-start gap-5 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            {presentaciones.eyebrow && (
              <RevelarBloque as="p" indice={0} preview={preview} className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2"><CampoEditable campo="presentaciones.eyebrow">{presentaciones.eyebrow}</CampoEditable></RevelarBloque>
            )}
            <RevelarBloque as="h2" indice={1} preview={preview} className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] whitespace-pre-line" style={displayL ? { fontSize: displayL } : undefined}><CampoEditable campo="presentaciones.titulo" multilinea>{presentaciones.titulo}</CampoEditable></RevelarBloque>
          </div>
          {/* El CTA (§ MUESTRARIO-SECCION-CTA-1), SOLO — `.pres-head` del prototipo no lleva nada
              más a la derecha (`index.html:228-234`: título de un lado, `.btn--primary` del otro). */}
          {ctaHref && (
            <RevelarBloque as="div" indice={2} preview={preview} className="shrink-0">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))]"
              >
                <CampoEditable campo="presentaciones.ctaLabel">{presentaciones.ctaLabel}</CampoEditable>
              </Link>
            </RevelarBloque>
          )}
        </div>

        {/* El track: `overflow-x-auto` nativo con snap, sin scrollbar de WebKit a la vista (el
            `<style>` de abajo, scoped a la clase, es el único CSS que este componente necesita fuera
            de Tailwind — no toca `app/globals.css`, fuera de `touches`). `tabIndex` para que un
            usuario de teclado pueda enfocar el riel y desplazarlo con las flechas nativas del
            navegador sobre un contenedor con overflow, sin pasar por los botones. `sm:py-6` reserva
            espacio vertical (§ RIEL-SCROLL-Y-BADGE-DORADO-1) — su causa original (la tarjeta
            RESALTADA desbordando por `transform`) se retiró con `useIndiceCentrado` (§ el docstring
            de cabecera), y esta reserva queda como respiro visual del track, sin costo.

            `overflow-y-hidden` (§ RIEL-SIN-SCROLL-VERTICAL-1, 2026-10-01) — EXPLÍCITO, no el default
            del navegador. `overflow-x-auto` por sí solo fuerza, por regla de la especificación CSS,
            que `overflow-y` se COMPUTE `auto` (no `visible`) aunque nadie lo haya pedido — el MISMO
            mecanismo que § RIEL-SCROLL-Y-BADGE-DORADO-1 ya documentó para el resaltado retirado, pero
            la causa de ESTA vez es otra: una tarjeta que TODAVÍA no entró a la vista (`whileInView`,
            § `fadeUp` en `lib/animation.ts`, `y: 24→0`) sigue trasladada 24px hacia abajo por
            `transform` — y ese desplazamiento de PINTADO cuenta para el `scrollHeight` de un
            contenedor con overflow no-visible, igual que el desborde de `scale` de aquella vez.
            MEDIDO (Playwright WebKit, dispositivo "iPhone 15", contra el árbol construido con
            catálogo sembrado — § DECISIONS.md): en reposo sobre la tarjeta 0, `scrollHeight(505) −
            clientHeight(489) = 16px` de scroll vertical propio del track — exactamente lo que el
            dedo mueve por deriva vertical al deslizar horizontalmente, y lo que Safari interpreta
            como "hay más contenido arriba/abajo" y rebota. Al llegar a la ÚLTIMA tarjeta (ya
            entrada) la diferencia es cero — por eso el owner lo veía sólo en las dos primeras, nunca
            en la tercera. `hidden` no cambia el PINTADO (`auto` ya recorta igual que `hidden`; lo
            único que se retira es la capacidad de scrollear en vertical) — la entrada de las
            tarjetas (`fadeUp`) se conserva intacta. */}
        <style>{".grind-riel-track::-webkit-scrollbar{display:none}"}</style>
        <div
          ref={trackRef}
          role="group"
          aria-label="Presentaciones disponibles"
          tabIndex={0}
          className="grind-riel-track flex gap-6 overflow-x-auto overflow-y-hidden snap-x snap-mandatory pb-2 sm:py-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tarjetas.map((producto, i) => (
            <TarjetaRiel
              key={producto.id}
              producto={producto}
              negocio={negocio}
              navHoverClase={navHoverClase}
              preview={preview}
              index={i}
              onEye={abrirVistaRapida}
              onCart={agregarRapido}
            />
          ))}
        </div>

        {/* Los controles de avance, DEBAJO del track (§ el docstring de cabecera — `.car-nav` del
            prototipo). Ocultos bajo `sm` (el touch-scroll ya cubre ese caso en móvil). */}
        <div className="hidden justify-end gap-2 sm:flex">
          <button
            type="button"
            onClick={() => desplazar(-1)}
            disabled={!estado.puedeAtras}
            aria-label="Presentación anterior"
            className="grid h-12 w-12 place-items-center border border-[var(--sf-linea)] text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-linea)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => desplazar(1)}
            disabled={!estado.puedeAdelante}
            aria-label="Presentación siguiente"
            className="grid h-12 w-12 place-items-center border border-[var(--sf-linea)] text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors hover:bg-[var(--sf-linea)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <VistaRapidaProducto
        producto={vistaRapida?.producto ?? null}
        disparador={vistaRapida?.disparador ?? null}
        onClose={cerrarVistaRapida}
      />
    </section>
  );
}
