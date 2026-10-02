"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { imagenPortada } from "@/lib/producto-imagen";
import { entradaHeroInicial, heroDeGaleria } from "@/lib/storefront/pdp-galeria";
import { siguienteIndiceGaleria } from "@/lib/storefront/galeria";

// components/storefront/pdp/GaleriaProducto.tsx — § FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1 (sólo
// CORTE). Gate del owner con captura (`cafeone-pdp-galeria-flechas.png`): "no hay arrows sobre las
// imágenes en el detalle del producto para pasar las imágenes."
//
// ESTA GALERÍA ES LA VERSIÓN CON FLECHAS, MONTADA SÓLO PARA CORTE — `app/(storefront)/tienda/
// [slug]/page.tsx` sigue montando su markup ANTERIOR, inline, sin flechas, para los otros 5 presets
// (gateado por `navTratamiento.posicion`, el MISMO booleano que ya usa esa página para el ancho del
// contenedor y el alto del header — "adoptar la geometría MEDIDA del prototipo", § StoreNav.tsx,
// hoy sólo CORTE lo declara). Byte-idéntico para Nayoli: su rama no importa ni renderiza este
// archivo.
//
// LA LÓGICA PURA DEL ÍNDICE vive en `lib/storefront/galeria.ts` (`siguienteIndiceGaleria`, EN
// BUCLE — ver su docstring para el porqué). `heroDeGaleria`/`entradaHeroInicial` se REUSAN de
// `lib/storefront/pdp-galeria.ts` (la misma protección contra la imagen-invisible-esperando-JS que
// ya tenía el markup viejo) — no se duplican.
//
// TRES CAMINOS AL MISMO `avanzar`: las flechas (clic), el teclado (←/→, con el foco en cualquier
// elemento DENTRO de la imagen — las propias flechas son las primeras candidatas, `onKeyDown` en el
// contenedor captura el bubbling sin necesitar un handler por control) y el dedo (swipe horizontal,
// umbral de 40px para no confundir un tap con un arrastre corto). Las miniaturas siguen navegando
// directo a un índice, como el markup viejo.
//
// EL WRAPPER ESTABLE NO ES DECORATIVO — MEDIDO por ejecución (Playwright: click en "Foto siguiente",
// después `ArrowLeft`), no supuesto. Las flechas y los handlers de teclado/dedo viven en un `<div>`
// EXTERIOR que NUNCA remonta; sólo el `motion.div key={imgIdx}` de ADENTRO (la foto) se destruye y
// recrea en cada cambio — eso es lo que le da el fade a framer-motion. Con las flechas DENTRO de ese
// `motion.div` (como en el primer intento), un clic en "Foto siguiente" cambiaba `imgIdx`, lo que
// remontaba el `motion.div` y con él SU PROPIO botón — el foco se perdía en el acto (un nodo del DOM
// destruido no puede seguir enfocado), así que la tecla ArrowLeft inmediatamente después no llegaba a
// ningún `onKeyDown` (nada dentro del árbol tenía foco). Confirmado: con las flechas afuera, el
// segundo camino (teclado tras un clic) vuelve a funcionar — se afirmó por ejecución, ver el asiento.
//
// SIN FLECHAS CON UNA SOLA FOTO (`puedeNavegar`) — una flecha que "avanza" a la misma foto no es
// navegación, es ruido; mismo criterio que la fila de miniaturas, que ya se ocultaba con una sola
// imagen.
//
// LA TRANSICIÓN ENTRE FOTOS USA LOS TOKENS DE CORTE (`duration:0.22, ease:[0.22,0.61,0.36,1]`) — LOS
// MISMOS 220ms/cubic-bezier que `StoreNav.tsx` ya usa para el subrayado del nav y el mega-menú
// (`navHoverClase`, los paneles desplegables): token reusado, no uno nuevo. El markup viejo (Nayoli)
// no declaraba una duración explícita —quedaba en el default de framer-motion— y ESO no se toca: es
// otro archivo, con su propio `motion.div`, que este componente no importa ni comparte.
//
// LOS BOTONES DE FLECHA REUSAN EL LENGUAJE VISUAL YA ESTABLECIDO PARA "ícono flotando sobre una
// imagen de producto" en este mismo preset: `sf-pildora` + `bg-[var(--sf-fondo)]` + hover a
// `--sf-accion`/`--sf-accion-txt`, el MISMO par que las acciones rápidas (ojo/carrito) de
// `GrindChooserRiel.tsx` — no una superficie nueva.

interface GaleriaProductoProps {
  galeria: string[];
  nombre: string;
}

const UMBRAL_SWIPE_PX = 40;

export default function GaleriaProducto({ galeria, nombre }: GaleriaProductoProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const [galeriaTocada, setGaleriaTocada] = useState(false);
  const touchXRef = useRef<number | null>(null);

  const heroSrc = imagenPortada(heroDeGaleria(galeria, imgIdx));
  const puedeNavegar = galeria.length > 1;

  function irA(i: number) {
    setGaleriaTocada(true);
    setImgIdx(i);
  }

  function avanzar(direccion: 1 | -1) {
    irA(siguienteIndiceGaleria(imgIdx, galeria.length, direccion));
  }

  function onKeyDownHero(e: React.KeyboardEvent) {
    if (!puedeNavegar) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      avanzar(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      avanzar(1);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchXRef.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchXRef.current === null || !puedeNavegar) return;
    const inicioX = touchXRef.current;
    touchXRef.current = null;
    const dx = (e.changedTouches[0]?.clientX ?? inicioX) - inicioX;
    if (Math.abs(dx) < UMBRAL_SWIPE_PX) return;
    avanzar(dx < 0 ? 1 : -1);
  }

  return (
    <div className="space-y-3">
      {/* RADIO (§ GALERIA-PRODUCTO-RADIO-1): `sf-radio-imagen`, no `rounded-3xl` crudo — cierra
          `GALERIA-PRODUCTO-RADIO-FUERA-DE-TOUCHES-1`, el follow-up de `RADIO-TARJETAS-IMAGEN-1` que
          dejó esta galería afuera por un `touches:` incompleto. El fallback de `.sf-radio-imagen`
          (1rem) NO coincide con el 1.5rem que `rounded-3xl` ya resolvía bajo Suave — a diferencia de
          `NosotrosHistoria.tsx`/`ProductCard.tsx` (que venían de `rounded-2xl`, 1rem exacto), esto
          SÍ sería un cambio de Nayoli SI este componente llegara a renderizarse bajo Suave. No pasa:
          este archivo es la versión CON FLECHAS, montada SÓLO para CORTE en sus DOS usos — la ficha
          (gateada por `navTratamiento.posicion`, § el docstring de cabecera) y la vista rápida (sólo
          la monta `GrindChooserRiel`, que sólo monta bajo `presentaciones.variante==='riel'`, que
          SÓLO CORTE declara). Nayoli nunca importa ni renderiza este árbol. */}
      <div
        onKeyDown={onKeyDownHero}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative aspect-square overflow-hidden sf-radio-imagen bg-[var(--sf-superficie)]"
      >
        <motion.div
          key={imgIdx}
          initial={entradaHeroInicial(galeriaTocada)}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="absolute inset-0"
        >
          {heroSrc && (
            <Image
              src={heroSrc}
              alt={nombre}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              // Imagen hero del detalle = LCP: preload + sin lazy-loading.
              priority
            />
          )}
        </motion.div>
        {puedeNavegar && (
          <>
            <button
              type="button"
              onClick={() => avanzar(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center sf-pildora bg-[var(--sf-fondo)] text-[var(--sf-tinta)] transition-colors duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--sf-accion,var(--sf-tostado))] hover:text-[var(--sf-accion-txt,var(--sf-tinta))]"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => avanzar(1)}
              aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center sf-pildora bg-[var(--sf-fondo)] text-[var(--sf-tinta)] transition-colors duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--sf-accion,var(--sf-tostado))] hover:text-[var(--sf-accion-txt,var(--sf-tinta))]"
            >
              <ArrowRight className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </div>

      {/* Una sola imagen no lleva fila de miniaturas: un thumbnail suelto bajo su propia hero no es
          navegación, es ruido. */}
      {puedeNavegar && (
        <div className="flex gap-3">
          {galeria.map((img, i) => (
            <button
              key={i}
              onClick={() => irA(i)}
              // RADIO (§ GALERIA-PRODUCTO-RADIO-1): `sf-radio-imagen`, no `rounded-xl` crudo — misma
              // razón que el hero, arriba. `rounded-xl` resolvía 0.75rem bajo Suave; el fallback de
              // `.sf-radio-imagen` es 1rem. No hay cambio para Nayoli: este componente no renderiza
              // bajo Suave (ver el comentario del hero).
              className={`h-16 w-16 overflow-hidden sf-radio-imagen border-2 transition-all ${
                imgIdx === i
                  ? "border-[var(--sf-acento)]"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <div className="relative h-full w-full">
                <Image src={img} alt="" fill sizes="64px" className="object-cover" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
