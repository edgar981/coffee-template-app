"use client";

import Image from "next/image";
import Link from "next/link";

import { ShoppingBag, SlidersHorizontal } from "lucide-react";

import { motion } from "framer-motion";

import { toast } from "sonner";

import { Product } from "@/types/product";

import { useCartStore } from "@/lib/cartStore";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";

import { decidirMolienda } from "@duna/core/moliendas-opciones";

import { formatCOP } from "@duna/core/utils";

interface ProductCardProps {
  product: Product;
  /**
   * Responsive rendered width of the card image, matching the parent grid's
   * columns per breakpoint. Defaults to the standard product-grid shape
   * (2 / 3 / 4 columns). Override when the grid differs.
   */
  sizes?: string;
}

export default function ProductCard({
  product,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: ProductCardProps) {
  const { addItem } = useCartStore();
  // `navTratamiento.badgeColor` (§ RIEL-SCROLL-Y-BADGE-DORADO-1): pese al nombre de la meta, este
  // campo es el fondo del badge de "cosecha"/edición — un ROL DE COLOR compartido por StoreNav,
  // esta card y Spotlight (§ el censo de consumidores, DECISIONS.md), no algo propio del nav; vive
  // ahí por costo de escritura, no por dominio (ver el docstring de `navTratamientoBadgeColor` en
  // `themes.ts`). `null` (todo tenant salvo CORTE) = no se aplica ningún `style`.
  const { navTratamiento, tema } = useSiteContent();

  // ENTRADA DESLIZANTE (§ ACCIONES-RAPIDAS-CUADRADAS-1) — GATEADA por `tema.forma`, NO unconditional
  // como en `GrindChooserRiel.tsx`. Esa diferencia es DELIBERADA y está MEDIDA, no es inconsistencia:
  // `GrindChooserRiel` sólo monta bajo `presentaciones.variante==='riel'`, que SÓLO CORTE declara —
  // Nayoli JAMÁS la renderiza (afirmado en `presentaciones-riel.test.ts`, "LA INVARIANTE") — así que
  // ese componente puede llevar el tratamiento SIN condición: la restricción "Nayoli byte-idéntica"
  // se cumple por INALCANZABILIDAD, no por gate. `ProductCard`, en cambio, es COMPARTIDO — Nayoli lo
  // renderiza en /tienda y en la home —, y acá SÍ hace falta el gate.
  //
  // Y hace falta por un HALLAZGO MEDIDO, no por precaución genérica: agregar `transform:translateX`
  // al botón — con `duration:0` forzado por `verificar-nayoli-visual.ts` y settleado tras 400ms —
  // seguía produciendo un diff de píxeles REAL y DETERMINISTA en la captura de HOVER (3094/98298 px,
  // reproducido IDÉNTICO en dos builds separados; 0 diff en las 6 rutas de página completa, que
  // capturan el botón en REPOSO — invisible por `opacity-0`). El mecanismo exacto no se aisló del
  // todo (compositing layer del `transform` vs. cómo `verificar-nayoli-visual.ts` hace `boton.hover()`
  // directo sobre el botón, no sobre la tarjeta), pero la CAUSA sí: agregar `transform` al botón
  // moviéndolo. La única forma con evidencia de 0 diff es la rama SIN transform — el código de HOY,
  // byte a byte —, así que Suave/Nayoli sigue exactamente esa rama; sólo una forma CUSTOM (`tema.forma
  // !== null`, el mismo eje que ya decide `sf-pildora`) gana el slide.
  const formaCustom = tema.forma !== null;

  // La card SOLO agrega cuando no hay nada que preguntar. Si la elección de
  // molienda es real, el botón deja pasar el click al <Link> que ya envuelve la
  // card y el cliente elige en el detalle. La regla no vive acá: sale de
  // `decidirMolienda`, la misma que usan el detalle y el servidor — la línea que
  // esta card construía por su cuenta (sin molienda) era incompraable en el
  // checkout para todo el catálogo.
  const decision = decidirMolienda(product.moliendasOpciones);
  const agregaDirecto = decision.modo === 'ninguna' || decision.modo === 'automatica';

  const handleAdd = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!product.disponible) {
      e.preventDefault();
      return;
    }

    // Sin preventDefault: el click sigue al <Link> y navega al detalle.
    if (!agregaDirecto) return;

    e.preventDefault();

    addItem(
      product,
      1,
      decision.modo === 'automatica' ? { molienda: decision.nombre } : {}
    );

    toast.success(
      `${product.nombre} agregado al carrito`
    );
  };

  return (
    <Link
      href={`/tienda/${product.slug}`}
      className="group block"
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden rounded-2xl sf-borde border-[var(--sf-linea)] bg-[var(--sf-tarjeta)] transition-all duration-300 hover:shadow-lg"
      >
        {/* Image — el contenedor crema de marca queda como fallback si el
            producto no tiene imagen (evita pasar undefined a next/image). */}
        <div className="relative aspect-square overflow-hidden bg-[var(--sf-superficie)]">
          {product.imagen && (
            <Image
              src={product.imagen}
              alt={product.nombre}
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}

          {/* Badge — el rol NO-bestseller es el `.badge` de "cosecha"/edición del prototipo (§
              RIEL-SCROLL-Y-BADGE-DORADO-1); el `style` inline sólo se activa con
              `navTratamiento.badgeColor` puesto (sólo CORTE), byte-idéntico si no. El rol
              bestseller (`--sf-acento`, "Oferta") NO es del prototipo — no se toca.

              TEXTO (§ BADGES-ACCIONES-Y-LOGO-CORTE-1, cierra CORTE-BADGE-BESTSELLER-TEXTO-VERDE-1):
              el mismo par `bg-[var(--sf-tostado)]` que ya lleva este badge pintaba texto
              `--sf-tinta` (verde de marca) en vez del texto PLENO que ya usa el badge "Cosecha 2026"
              del menú (`StoreNav.tsx`, `badgeSpan`, rama `navTratamiento.cta`) — gate del owner:
              «La fuente en 'Cosecha 2026' debería ser blanca, no verde». Gateado por
              `navTratamiento.cta` (el MISMO booleano que decide esa rama en `badgeSpan`, true SÓLO
              en CORTE), no por `badgeColor`: ambos son `true`/no-`null` únicamente bajo CORTE hoy,
              pero `cta` es el eje conceptual correcto (¿este preset adopta el tratamiento de
              badge/CTA del prototipo?), mientras `badgeColor` es sólo el hex opcional de FONDO. `false`
              (todo tenant salvo CORTE) → `text-[var(--sf-tinta)]`, byte-idéntico a hoy. */}
          {product.badge && (
            <div className="absolute top-3 left-3">
              <span
                className={`sf-pildora sf-badge px-2.5 py-1 text-xs font-semibold ${
                  product.bestseller
                    ? "bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]"
                    : navTratamiento.cta
                      ? "bg-[var(--sf-tostado)] text-[var(--sf-acento-txt)]"
                      : "bg-[var(--sf-tostado)] text-[var(--sf-tinta)]"
                }`}
                style={!product.bestseller && navTratamiento.badgeColor ? { backgroundColor: navTratamiento.badgeColor } : undefined}
              >
                {product.badge}
              </span>
            </div>
          )}

          {/* Add to cart — o "elegir molienda", según lo que haya que preguntar.
              El ícono cambia con la acción: un carrito que en realidad navega a
              otra página es una promesa que el botón no cumple.

              FORMA + ENTRADA (§ ACCIONES-RAPIDAS-CUADRADAS-1, gate del owner: "Lo que encierra al
              carrito y ojo… debe ser cuadrado, no circular… el efecto de aparecer/desaparecer debe
              ser como el del prototipo") — GATEADO por `formaCustom` (arriba, con la medición
              completa de POR QUÉ). Bajo una forma CUSTOM: `rounded-full` → `sf-pildora` (el rol de
              radio de BOTÓN/CHROME, 0 bajo 'recta'); reposo `opacity-0 translate-x-[14px]` → hover
              `opacity-100 translate-x-0`, `duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]` =
              `--duration-base`/`--ease-out` del prototipo (`docs/prototipos/cafeone/css/
              app.css:538-548`), MISMO tratamiento que `GrindChooserRiel.tsx`. Sin stagger: es el
              ÚNICO botón de esta tarjeta. Bajo Suave: la rama de ANTES de este slice, literal —
              `rounded-full`, `transition-opacity`, sin transform — la única con 0px medido.

              FONDO/SOMBRA/HOVER (§ BADGES-ACCIONES-Y-LOGO-CORTE-1) — la rama `formaCustom` re-medida
              contra el mismo prototipo: `bg-white`+`shadow-md`+hover `--sf-acento` (dorado) pasan a
              `bg-[var(--sf-fondo)]` sin sombra y hover `--sf-accion`/`--sf-accion-txt` (el rojo de
              acción), igual que `GrindChooserRiel.tsx` (mismo docstring, con la medición completa
              del mapeo `--surface-page`→`--sf-fondo`/`--action-primary`→`--sf-accion`). La rama SIN
              `formaCustom` (Suave/Nayoli) NO se toca — sigue `bg-white`+`shadow-md`+`--sf-acento`,
              byte a byte.

              FOCO DE TECLADO, SÓLO BAJO `formaCustom` (§ VISTA-RAPIDA-CENTRADA-1, 2026-09-30,
              "aplicalo igual… en ProductCard"): antes el botón sólo se revelaba con `group-hover:` —
              un Tab lo enfocaba SIN mostrarlo (`opacity-0` no tiene variante de foco).
              `group-has-[:focus-visible]:` (el MISMO mecanismo que `GrindChooserRiel.tsx` adopta
              para su "foto de atrás", § ese archivo) lo revela cuando el foco de TECLADO cae en él —
              este botón no tiene el problema de "foco pegado" del riel (nada le devuelve el foco
              tras cerrar un modal: esta card no abre ninguno), así que acá es sólo la paridad de
              accesibilidad que faltaba, no un fix de un defecto de sticking. Va SÓLO en la rama
              `formaCustom`: la rama Suave/Nayoli es BYTE-IDÉNTICA a la de antes de este slice (línea
              arriba, "la única con 0px medido") y agregar una clase ahí —aunque sea inerte en
              reposo/hover— cambiaría el string de `className` que `verificar-nayoli.ts` compara. */}
          {product.disponible && (
              <button
                onClick={handleAdd}
                aria-label={
                  agregaDirecto
                    ? `Agregar ${product.nombre} al carrito`
                    : `Elegir molienda de ${product.nombre}`
                }
                title={agregaDirecto ? 'Agregar al carrito' : 'Elegir molienda'}
                className={
                  formaCustom
                    ? "absolute right-3 bottom-3 flex h-9 w-9 translate-x-[14px] cursor-pointer items-center justify-center sf-pildora bg-[var(--sf-fondo)] opacity-0 transition-all duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--sf-accion,var(--sf-tostado))] hover:text-[var(--sf-accion-txt,var(--sf-tinta))] group-hover:translate-x-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100"
                    : "absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md opacity-0 transition-opacity hover:bg-[var(--sf-acento)] hover:text-[var(--sf-acento-txt)] group-hover:opacity-100 cursor-pointer"
                }
              >
                {agregaDirecto
                  ? <ShoppingBag className="h-4 w-4" />
                  : <SlidersHorizontal className="h-4 w-4" />}
              </button>
            )}
        </div>

        {/* Info — texto DENTRO de bg-[var(--sf-tarjeta)]: los dos roles floreados contra ELLA
            (§ TEMAS-P6-FAMILIAS-1, familia `tarjeta`), no contra tokens de otras familias.
            `var(--sf-sobre-tarjeta*,<token de hoy>)`: sin esquema asignado (el caso de Nayoli en
            /tienda) cae exactamente al texto de hoy — cero cambio visual. */}
        <div className="p-4">
          <p className="mb-1 text-xs capitalize text-[var(--sf-sobre-tarjeta-suave,var(--sf-acento-texto))]">
            {product.origen ||
              product.categoria?.replace("_", " ")}
          </p>

          <h3 className="mb-2 line-clamp-2 text-sm leading-tight font-medium text-[var(--sf-sobre-tarjeta,var(--sf-tinta))]">
            {product.nombre}
          </h3>

          {/* Tags — notas de cata (contenido descriptivo, p. ej. "Chocolate"), NO una etiqueta de
              estado/categoría: `.sf-badge` (§ eje 4, remate 1) NO va acá, sólo en `product.badge`.
              La píldora vive sobre `bg-[var(--sf-superficie)]`, familia DISTINTA de la tarjeta que
              la contiene (§ TEMAS-P6-FAMILIAS-1, familia `superficie`) — floreada contra ELLA. */}
          {product.notas && (
            <div className="mb-3 flex flex-wrap gap-1">
              {product.notas
                .slice(0, 3)
                .map((note) => (
                  <span
                    key={note}
                    className="sf-pildora bg-[var(--sf-superficie)] px-2 py-0.5 text-[10px] text-[var(--sf-sobre-superficie,var(--sf-texto))]"
                  >
                    {note}
                  </span>
                ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-[var(--sf-sobre-tarjeta,var(--sf-tinta))]">
                {formatCOP(product.precio)}
              </span>
            </div>

            {!product.disponible && (
              <span className="text-xs text-[var(--sf-neutro)]">
                Agotado
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}