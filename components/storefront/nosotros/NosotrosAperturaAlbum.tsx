"use client";

// LA APERTURA «ÁLBUM» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 1: "Portada ...
// Celular: foto en arco (como en /tienda), 4:5, de 55vh como máximo, con el sticker «cosecha 2026»
// en la esquina y una franja de tejido de 12 px al pie. Escritorio: 6/6, título abajo a la izquierda
// y arco a la derecha"). Segunda composición de `nosotrosApertura`, hermana de la canónica (la pieza
// `Apertura` a pantalla completa) bajo el mismo dispatcher (`NosotrosApertura.tsx`).
//
// EL ARCO 4:5 REUSA EL MISMO PATRÓN QUE «LÁMINAS» DE /TIENDA (`rounded-t-full rounded-b-[20px]`,
// § TiendaLaminas.tsx) — el `overflow-hidden` recorta la foto al semicírculo, nunca un SVG de
// máscara.
//
// `rotuloIzquierda` SE REUSA como el eyebrow (§ el docstring de `NosotrosAperturaContent`);
// `rotuloDerecha` queda sin leer bajo esta composición.
//
// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — TRES AJUSTES medidos contra la maqueta
// (`.scratch/chamisas-paginas/nosotros-suscripciones.html`, `.cov`/`.cov-g`/`.arch-w`/`.stk`):
//
// 1. SIN `min-h` en el grid — ESE era el defecto de la banda vacía arriba del rótulo. La maqueta NO
//    fija una altura mínima de sección (`.cov{padding:28px 0 0}` — sólo padding superior, la altura
//    la da el CONTENIDO); el `lg:min-h-[640px]` que tenía esta pieza forzaba el grid a 640px aunque
//    el arco (su contenido más alto, tope `lg:max-h-[600px]`) nunca llegara ahí, y `lg:items-end`
//    empujaba las DOS columnas hacia abajo dejando el sobrante como banda vacía ARRIBA. Quitado el
//    `min-h`, `items-end` sigue siendo correcto (coincide con `.cov-g{align-items:end}` de la
//    maqueta: la columna de texto, más corta que el arco, se asienta contra su base) — ya no hay
//    altura de más que repartir.
// 2. EL STICKER sale del contenedor `overflow-hidden` del arco — ERA la causa del recorte
//    (`CHAMISAS-STICKER-APERTURA-RECORTE-1`): estaba DENTRO de la misma caja que recorta la foto al
//    semicírculo (`rounded-t-full` + `overflow-hidden`), así que cualquier posición cerca del borde
//    curvo se cortaba contra esa máscara. La maqueta (`.arch-w`) lo monta como HERMANO del arco, no
//    hijo — acá, un wrapper `relative` (SIN `overflow-hidden`) envuelve al arco (que sí lo mantiene,
//    para recortar la FOTO) y al sticker, así el sticker nunca entra a la zona que se recorta.
//    Posición de la maqueta: `top:12%` (relativo a la ALTURA del arco, no un px fijo — por eso sigue
//    centrado en la curva a cualquier tamaño) y `right:-8px`/`-14px` (cuelga del borde, nunca
//    "adentro" donde el arco podría taparlo).
// 3. EN CELULAR EL TEXTO VA PRIMERO — medido contra la maqueta (`v-m-nosotros.jpg`): rótulo+título+
//    bajada arriba, el arco debajo. El docstring de cada columna YA decía esto ("arriba del arco en
//    celular"/"arriba en celular") pero las clases `order-1`/`order-2` estaban INVERTIDAS respecto
//    del comentario — el arco quedaba primero. Se corrige el `order` para que coincida con lo que el
//    comentario siempre dijo.
//
// § CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1 — EL ARCO SE VEÍA RECTANGULAR, SIN CURVA: medido con
// `getComputedStyle` sobre `.rounded-t-full` en un build real (`position: 'static'`, `overflow:
// 'hidden'`, `border-top-left-radius: '3.35544e+07px'` — el radio SÍ estaba, lo que faltaba era el
// contexto de posicionamiento). El ajuste 2 (arriba) movió `relative` al wrapper EXTERIOR para sacar
// al sticker de la caja que recorta — correcto para el sticker, pero dejó la caja `overflow-hidden
// rounded-t-full` SIN su propio `relative`. El `<Image fill>` de adentro (`position:absolute;
// inset:0`) resuelve su caja de contención contra el ancestro posicionado más cercano — que pasó a
// ser el wrapper exterior, no esta caja —, y una caja sin su propio `position:relative` no recorta
// de forma confiable a un descendiente posicionado contra OTRO ancestro: el radio quedaba declarado
// pero sin efecto visual, la foto se veía como un rectángulo a filo con el encabezado. El patrón
// gemelo que SÍ funciona (`InterludioRetrato`/`piezas-compartidas.test.ts`) pone `relative` en la
// MISMA caja que `overflow-hidden rounded-t-full` — se replica acá: esta caja gana su propio
// `relative`, sin tocar el wrapper exterior (que lo sigue necesitando para el sticker). Confirmado
// por captura real (`.scratch/revision-owner/pares-nosotros-arco-ficha/README.md`): el arco pasó de
// un borde recto a la curva completa, con el mismo `border-radius` computado de antes.
//
// § CHAMISAS-NOSOTROS-FIDELIDAD-1 — TRES AJUSTES medidos contra la maqueta aprobada
// (`.scratch/chamisas-paginas/nosotros-suscripciones.html`, `.wrap`/`.arch`/`.arch .foot`) y contra
// capturas reales (`.scratch/chamisas-fidelidad/nosotros/`):
//
// 1. EL ANCHO DE LA COLUMNA ERA `max-w-6xl` (1152px) — la maqueta mide `.wrap{max-width:1376px}`,
//    el MISMO contenedor que envuelve TODA la página (cobertura, sinopsis, láminas, ficha). Medido:
//    con 1152px el H1 envolvía a CUATRO líneas ("Nuestro" / "territorio, sus" / "manos, nuestro" /
//    "orgullo.") contra las TRES de la maqueta — y, como el arco es `aspect-[4/5]` con el ANCHO
//    derivado del porcentaje de su columna (no de `max-h` directamente: con la columna angosta el
//    ancho disponible topaba el alto ANTES de llegar al cap de `lg:max-h-[600px]`), ensanchar el
//    contenedor también corrige el alto efectivo del arco, sin tocar `lg:w-[72%]`.
// 2. EN CELULAR EL ARCO SE QUEDABA EN `w-[78%]`, un porcentaje fijo que no respeta "ancho completo"
//    (la maqueta deriva el ancho del alto — `.arch{height:min(...)}` con `aspect-ratio:4/5` — así que
//    en celular normalmente gana el ancho completo del contenedor, acotado sólo si la altura lo
//    exige). `w-full` logra el mismo resultado sin inventar el cálculo por altura: a los anchos de
//    teléfono típicos, `max-h-[55vh]` no llega a ser la restricción activa.
// 3. LA FRANJA DE TEJIDO ERA `lg:hidden` (sólo celular) Y vivía FUERA de la caja que recorta la foto
//    — la maqueta la pinta SIEMPRE (`.arch .foot`, sin media query que la oculte) como una capa
//    ABSOLUTA dentro de `.arch` (`position:absolute;bottom:0`, recortada por el mismo
//    `overflow:hidden` que ya recorta la foto al semicírculo). Se mueve DENTRO de la caja
//    `overflow-hidden rounded-t-full rounded-b-[20px]` como overlay absoluto, y se quita el
//    `lg:hidden` — ahora se ve en las DOS anchuras, como la maqueta.
//
// LA "Imagen ilustrativa" DE LA MAQUETA (el rótulo sobre el arco, `.ilus`) NO ENTRA EN ESTA TANDA:
// no hay campo en `NosotrosAperturaContent` que la declare (a diferencia de `nosotrosEscenas.items[].
// pie`, que YA tiene ese campo y sí se corrige en `NosotrosEscenasAlbum.tsx`). Agregar uno es un
// cambio de `lib/config/site-content-defaults.ts`/`site-content-schema.ts` — Tier 1, fuera de
// `touches:` de este slice. Queda como open follow-up.
//
// § CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1 — CON LA CURVA YA VISIBLE, LA CÚPULA SEGUÍA DEBAJO DEL
// ENCABEZADO FIJO: medido por color de píxel sobre capturas reales (`next build`+`next start`),
// nunca supuesto. `/nosotros` NO reserva alto de encabezado para esta composición —
// `app/(storefront)/nosotros/page.tsx` sólo envuelve con `navOffsetClase` cuando
// `content.navTratamiento.posicion` es `true` (el tratamiento tipo CORTE); Las Chamisas no lo
// activa, así que esta sección responde SOLA por su propio espacio bajo el `<header>` `fixed`
// (`StoreNav.tsx`, `h-16 lg:h-18` = 64px/72px). Contra `pt-7 lg:pt-10` (28px/40px, ambos MENORES
// que el alto real del header) el color de la foto empezaba exactamente en el borde inferior del
// header, sin un solo píxel de por medio (1440px, columna x=1055: blanco 255,254,254 hasta y=71,
// verde oscuro de la foto desde y=72 — CERO aire) — y en 390px el título arrancaba inmediatamente
// tras el header (y=65) SIN que el rótulo "Nosotros · San Adolfo, Huila" llegara a verse: con
// `pt-7` (28px) < 64px de header, el rótulo nacía DENTRO de la banda que el header tapa y quedaba
// invisible, no sólo recortado. `pt-24 lg:pt-28` (96px/112px) deja el aire medido contra la
// maqueta aprobada (`.scratch/chamisas-paginas/capturas/v-d-nosotros.jpg`, columna x=1050: borde
// del encabezado en y≈87, cúpula en y≈128 → ~41px de aire) — `lg:pt-28` (112px) sobre un header de
// 72px da exactamente 40px, el mismo aire; `pt-24` (96px) sobre el header de 64px de celular da
// 32px, el mismo criterio aplicado al breakpoint chico. NO es un `min-h`: sigue siendo SÓLO
// padding-top sobre el contenido (§ el ajuste 1, arriba, que esta tanda no reabre) — más alto que
// antes, nunca una altura mínima forzada que vuelva a dejar una banda vacía.
//
// "Las Chamisas no lo activa" (el párrafo de arriba) VENCIÓ: medido ahora contra
// `coffee-template-app-las-chamisas.vercel.app/nosotros` (`fetch` plano), `content.navTratamiento.
// posicion` es `true` — el dato vive en la base, no en el código, y cambió desde que ese párrafo se
// escribió. No se corrige acá (el padding-top de esta sección es otro eje, fuera de este slice); se
// anota porque el AJUSTE DE ABAJO depende del valor real, no del que este párrafo seguía afirmando.
//
// § CHAMISAS-PAGINAS-ARREGLOS-1 — cierra CHAMISAS-ALBUM-ANCHO-INCONSISTENTE-1: el grid de esta
// portada vivía en su PROPIO `max-w-[1376px] px-6 sm:px-10 lg:px-16`, un ancho de columna distinto
// del resto de /nosotros (que ya usa `contenedorAnchoClase(navTratamiento.posicion)` — sinopsis,
// láminas, ficha, cierre). Antes del swap se midió si reabre el defecto que `a16753c7` ya cerró (el
// H1 envolviendo a 4 líneas en vez de 3, § arriba): con `posicion` en `true` —el valor medido arriba—
// `contenedorAnchoClase(true)` da un ancho INTERIOR MAYOR o igual al de hoy en TODO breakpoint
// (1376px vs 1248px en escritorio ≥1440px; 354px vs 342px en celular a 390px — la aritmética
// completa en `lib/storefront/nosotros-apertura-album.test.ts`, "el ancho del contenedor nunca
// encoge"), así que más espacio nunca puede producir MÁS líneas de las que ya entraban. El swap usa
// `posicion` tal como llega del contexto —no se fija a `true`— para que un tenant con
// `posicion:false` que algún día active esta composición quede en el mismo contenedor que el resto
// de su página, no en uno propio que puede divergir.
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CampoEditable, { HuecoImagenOpcional } from '@/components/storefront/CampoEditable';

export interface NosotrosAperturaAlbumProps {
  eyebrow: string;
  titulo: string;
  bajada: string;
  imagen: string;
  sticker: string;
  franjaTejido: string;
}

export default function NosotrosAperturaAlbum({ eyebrow, titulo, bajada, imagen, sticker, franjaTejido }: NosotrosAperturaAlbumProps) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const tieneImagen = imagen.trim() !== '';
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section className="bg-[var(--sf-fondo)] pt-24 lg:pt-28">
      {/* SIN `min-h`/`py` extra acá (§ el ajuste 1, arriba) — sólo el padding SUPERIOR de la sección.
          El VALOR (`pt-24 lg:pt-28`) ya NO es el `.cov{padding:28px 0 0}` literal de la maqueta —
          § CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1, arriba, lo sube para despejar el `<header>` fijo,
          que la maqueta (estática, sin header `fixed` propio) no tenía que descontar. El ANCHO/
          RELLENO horizontal es `contenedorAnchoClase(navTratamiento.posicion)` (§ CHAMISAS-PAGINAS-
          ARREGLOS-1, arriba) — el MISMO contenedor que el resto de /nosotros, en vez de un
          `max-w-[1376px]` propio; vive en ESTA fila, no repetido por columna, para que `gap` sea la
          única fuente de separación vertical/horizontal. */}
      <div className={`${contenedorClase} mx-auto grid grid-cols-1 gap-[22px] lg:grid-cols-2 lg:items-end lg:gap-12`}>
        {/* TEXTO — primero en celular Y en escritorio-izquierda (§ el ajuste 3, arriba). */}
        <div className="order-1 flex flex-col gap-4 lg:pb-7">
          {eyebrow.trim() !== '' && (
            // SIN opacidad (§ CHAMISAS-NOSOTROS-MAQUETA-1 — medido: `.eyb{color:var(--ink)}`, la
            // MISMA clase que usan el eyebrow de «Láminas» y de la Ficha, los dos en tinta plena, sin
            // el `/70` que sólo tenía éste).
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosApertura.rotuloIzquierda">{eyebrow}</CampoEditable>
            </p>
          )}
          <h1 className="font-playfair text-[40px] leading-[1.05] text-[var(--sf-tinta)] lg:text-[54px]">
            <CampoEditable campo="nosotrosApertura.titulo">{titulo}</CampoEditable>
          </h1>
          {bajada.trim() !== '' && (
            <p className="max-w-md text-[17px] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosApertura.bajada" multilinea>{bajada}</CampoEditable>
            </p>
          )}
        </div>

        {/* EL ARCO — segundo en celular (§ el ajuste 3); a la derecha en escritorio. */}
        <div className="order-2 flex flex-col items-center lg:items-end">
          {/* `relative`, SIN `overflow-hidden` (§ el ajuste 2, arriba) — el sticker es HERMANO de la
              caja que recorta la foto, nunca su hijo, para no caer dentro de esa máscara. */}
          <div className="relative w-full lg:w-[72%]">
            <div
              className="relative aspect-[4/5] max-h-[55vh] overflow-hidden rounded-t-full rounded-b-[20px] bg-[var(--sf-tinta)] lg:max-h-[600px]"
            >
              {tieneImagen ? (
                <CampoEditable campo="nosotrosApertura.imagen" tipo="imagen">
                  <Image src={imagen} alt="" fill sizes="(max-width: 1024px) 100vw, 36vw" className="object-cover" />
                </CampoEditable>
              ) : (
                <HuecoImagenOpcional campo="nosotrosApertura.imagen" className="absolute inset-0" />
              )}
              {/* LA FRANJA DE TEJIDO — AHORA overlay ABSOLUTO dentro de la caja que recorta la foto
                  (como `.arch .foot` de la maqueta), visible en las DOS anchuras (§ el ajuste 3,
                  arriba). El `overflow-hidden` del ancestro ya la recorta contra la curva/esquinas. */}
              {franjaTejido.trim() !== '' && (
                <CampoEditable campo="nosotrosApertura.franjaTejido" tipo="imagen">
                  <div
                    className="absolute inset-x-0 bottom-0 h-3"
                    style={{ backgroundImage: `url(${franjaTejido})`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
                    aria-hidden="true"
                  />
                </CampoEditable>
              )}
            </div>
            {sticker.trim() !== '' && (
              <motion.span
                initial={preview ? false : { opacity: 0, scale: 1.06, rotate: -8 }}
                whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2 }}
                // `top-[12%]` (relativo a la ALTURA del arco, como `.arch-w .stk{top:12%}` de la
                // maqueta) + `-right-2`/`lg:-right-3.5` (cuelga -8px/-14px del borde derecho, como
                // `right:-8px`/`-14px`) — ya NO dentro de la caja que recorta la foto (§ el ajuste 2),
                // así que un texto largo no se corta contra el borde semicircular.
                className="sf-pildora absolute top-[12%] -right-2 z-10 whitespace-nowrap bg-[var(--sf-tostado)] px-3 py-1.5 text-xs font-semibold text-[var(--sf-tinta)] lg:-right-3.5"
              >
                <CampoEditable campo="nosotrosApertura.sticker">{sticker}</CampoEditable>
              </motion.span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
