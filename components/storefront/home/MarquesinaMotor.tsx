"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useTransform, type MotionValue } from "framer-motion";

import CampoEditable, { CampoEditableGemelo } from "@/components/storefront/CampoEditable";
import {
  transformRevelaTextoDisplay, opacidadRevelaTextoDisplay,
  transformEntradaSalidaItem, opacidadEntradaSalidaItem,
  UMBRAL_REVELADO_TEXTO,
  duracionTickerS, duracionTickerFallbackS, velocidadTickerPxS,
  MARQUEE_TITULO_FONT_SIZE, MARQUEE_TITULO_LINE_HEIGHT, MARQUEE_TITULO_LETTER_SPACING,
  MARQUEE_MASCARA_RELLENO_EM,
} from "@/lib/animation";
import { imagenPortada } from "@/lib/producto-imagen";
import { modoTarjetaMarquesina, tamanoSiCompleta, SIZES_TARJETA_MARQUESINA } from "@/lib/storefront/marquesina-tarjeta";
import type { Product } from "@/types/product";

// EL MOTOR COMPARTIDO (§ EDITOR-TIENDA-MARQUESINA-SECCION-1) — la coreografía que
// `HeroMediaMarquesina.tsx` construyó para la marquesina del hero (frase que corre por tiempo +
// revelado por scroll + entrada de producto DESPUÉS de la frase), extraída para que la sección
// suelta («Marquesina», `Marquesina.tsx`) la reuse con varios productos en vez de uno. Dos piezas,
// cada una el JSX EXACTO que vivía inline en el hero — `MarquesinaFraseMotor` (el loop de texto) y
// `MarquesinaTarjetaMotor` (una tarjeta de producto) — parametrizadas por lo que cada consumidor
// aporta (el `campo` editable, la ventana de progreso, si hay ventana de salida).
//
// EL HERO QUEDA IDÉNTICO: cuando el llamador no pasa `ventanaSalida`, `transformEntradaSalidaItem`/
// `opacidadEntradaSalidaItem` DELEGAN byte a byte en `transformRevelaTextoDisplay`/
// `opacidadRevelaTextoDisplay` (§ su docstring, `lib/animation.ts`) — la misma función que el hero ya
// llamaba antes de esta extracción. El JSX de las dos piezas de abajo es el mismo que vivía en
// `HeroMediaMarquesina.tsx`, con los valores fijos (el campo `marquesina.texto`, la ventana
// `UMBRAL_ENTRADA_TARJETA_MARQUESINA`, el techo `1`) vueltos PROPS.

/**
 * El loop de texto a gran escala: MÁSCARA (centra + recorta, estática) → MOTOR (traslada/aclara por
 * SCROLL, `progreso`) → TICKER (desplaza por TIEMPO, independiente del scroll). Tres elementos, dos
 * motores — ver "EL LOOP DE TEXTO"/"EL TICKER HORIZONTAL" en `lib/animation.ts` para la derivación
 * completa de cada pieza.
 */
export function MarquesinaFraseMotor({
  campo, texto, progreso, estatico, tickerVelocidad, editando,
  ventana = UMBRAL_REVELADO_TEXTO,
}: {
  /** La ruta editable ("marquesina.texto" en el hero, "marquesina.fraseBanda" en la banda suelta). */
  campo: string;
  texto: string;
  progreso: MotionValue<number>;
  estatico: boolean;
  tickerVelocidad: string;
  /** Congela el ticker mientras ESTE campo se edita en vivo (§ EDITOR-TIENDA-CAMPO-ANCLADO-1). */
  editando: boolean;
  ventana?: { desde: number; hasta: number };
}) {
  const velocidadTicker = velocidadTickerPxS(tickerVelocidad);
  const trackRef = useRef<HTMLDivElement>(null);
  const [duracionTicker, setDuracionTicker] = useState(() => duracionTickerFallbackS(velocidadTicker));
  useEffect(() => {
    if (editando) return;
    function medir() {
      const primero = trackRef.current?.children[0] as HTMLElement | undefined;
      if (!primero) return;
      const ancho = primero.getBoundingClientRect().width;
      if (ancho > 0) setDuracionTicker(duracionTickerS(ancho, velocidadTicker));
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [texto, velocidadTicker, editando]);

  const transformRevelaTexto = useTransform(progreso, (p) => transformRevelaTextoDisplay(p, estatico, ventana));
  const opacidadRevelaTexto = useTransform(progreso, (p) => opacidadRevelaTextoDisplay(p, estatico, ventana));

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 overflow-hidden whitespace-nowrap font-playfair text-[var(--sf-sobre-banda,white)]"
      style={{
        fontSize: MARQUEE_TITULO_FONT_SIZE,
        lineHeight: MARQUEE_TITULO_LINE_HEIGHT,
        letterSpacing: MARQUEE_TITULO_LETTER_SPACING,
        paddingBottom: `${MARQUEE_MASCARA_RELLENO_EM}em`,
        marginBottom: `${-MARQUEE_MASCARA_RELLENO_EM}em`,
      }}
    >
      <motion.div style={{ transform: transformRevelaTexto, opacity: opacidadRevelaTexto }}>
        <motion.div
          key={duracionTicker}
          ref={trackRef}
          className="flex w-max whitespace-nowrap"
          initial={{ x: '0%' }}
          animate={estatico || editando ? { x: '0%' } : { x: ['0%', '-50%'] }}
          transition={estatico || editando ? { duration: 0 } : { duration: duracionTicker, repeat: Infinity, ease: 'linear' }}
        >
          <span className="pr-[0.5em]"><CampoEditable campo={campo}>{texto}</CampoEditable></span>
          <span className="pr-[0.5em]"><CampoEditableGemelo campo={campo}>{texto}</CampoEditableGemelo></span>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Una tarjeta de producto que entra por scroll (y, con `ventanaSalida`, sale también) — UN SOLO
 * ELEMENTO, sin máscara (§ MARQUESINA-TARJETA-SIN-MASCARA-1: el `transform`/`opacity` van en el
 * mismo elemento que ya tiene su tamaño final y su `overflow-hidden`, para que recorte y movimiento
 * viajen juntos y la tarjeta nunca se vea cortada a medio camino).
 */
export function MarquesinaTarjetaMotor({
  producto, progreso, estatico, ventanaEntrada, ventanaSalida, techo = 1,
  posicion = 'relativa',
}: {
  producto: Product;
  progreso: MotionValue<number>;
  estatico: boolean;
  ventanaEntrada: { desde: number; hasta: number };
  ventanaSalida?: { desde: number; hasta: number };
  techo?: number;
  /** 'relativa' (el hero, un producto único centrado en su `<section>` flex) o 'absoluta' (la banda
   *  suelta: varias tarjetas apiladas en el MISMO lugar, para que una reemplace a la otra). */
  posicion?: 'relativa' | 'absoluta';
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [tamanoImagen, setTamanoImagen] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setTamanoImagen(tamanoSiCompleta(imgRef.current));
  }, [producto.slug]);
  const modo = modoTarjetaMarquesina(tamanoImagen?.w, tamanoImagen?.h);

  const transform = useTransform(progreso, (p) => transformEntradaSalidaItem(p, estatico, ventanaEntrada, ventanaSalida));
  const opacidad = useTransform(progreso, (p) => opacidadEntradaSalidaItem(p, estatico, ventanaEntrada, ventanaSalida, techo));

  const posicionClase = posicion === 'absoluta' ? 'absolute inset-0 m-auto' : 'relative';

  return (
    <motion.div
      className={`${posicionClase} z-20 grid aspect-[3/4] w-[min(340px,62vw)] place-items-center overflow-hidden sf-radio-tile ${modo === 'tile' ? 'bg-[var(--sf-tarjeta,white)] p-8' : ''}`}
      style={{ transform, opacity: opacidad }}
    >
      <div className="relative h-full w-full">
        <Image
          key={producto.slug}
          ref={imgRef}
          src={imagenPortada(producto.imagen)}
          alt={producto.nombre}
          fill
          sizes={SIZES_TARJETA_MARQUESINA}
          className={modo === 'completa' ? 'object-cover' : 'object-contain'}
          onLoad={(e) => {
            const img = e.currentTarget;
            setTamanoImagen(tamanoSiCompleta(img));
          }}
        />
      </div>
    </motion.div>
  );
}
