"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useTransform, type MotionValue } from "framer-motion";

import CampoEditable, { CampoEditableGemelo } from "@/components/storefront/CampoEditable";
import {
  transformRevelaTextoDisplay, opacidadRevelaTextoDisplay,
  opacidadEntradaSalidaItem,
  transformTransicionMarquesinaItem, filterTransicionMarquesinaItem,
  UMBRAL_REVELADO_TEXTO,
  duracionTickerS, duracionTickerFallbackS, velocidadTickerPxS,
  MARQUEE_TITULO_FONT_SIZE, MARQUEE_TITULO_LINE_HEIGHT, MARQUEE_TITULO_LETTER_SPACING,
  MARQUEE_MASCARA_RELLENO_EM,
} from "@/lib/animation";
import { imagenPortada } from "@/lib/producto-imagen";
import { modoTarjetaMarquesina, tamanoSiCompleta, SIZES_TARJETA_MARQUESINA } from "@/lib/storefront/marquesina-tarjeta";
import type { TransicionMarquesina } from "@/lib/config/site-content-defaults";
import type { Product } from "@/types/product";
import { estiloInlineDeElemento, ESTILO_ELEMENTO_VACIO, type EstiloElementoResuelto } from "@/lib/config/estilo-elemento";
import type { ClaveFuentePar } from "@/lib/config/fuentes";

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
//
// SIGUE SIENDO CIERTO tras § EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1: `MarquesinaTarjetaMotor` ganó
// `transicion` (default `'subir'`), que el HERO nunca pasa — `transformTransicionMarquesinaItem
// ('subir', …)` (`lib/animation.ts`) delega en la MISMA `transformEntradaSalidaItem` de siempre, así
// que el párrafo de arriba sigue describiendo exactamente lo que el hero recibe.

/**
 * El loop de texto a gran escala: MÁSCARA (centra + recorta, estática) → MOTOR (traslada/aclara por
 * SCROLL, `progreso`) → TICKER (desplaza por TIEMPO, independiente del scroll). Tres elementos, dos
 * motores — ver "EL LOOP DE TEXTO"/"EL TICKER HORIZONTAL" en `lib/animation.ts` para la derivación
 * completa de cada pieza.
 */
export function MarquesinaFraseMotor({
  campo, texto, progreso, estatico, tickerVelocidad, editando,
  ventana = UMBRAL_REVELADO_TEXTO,
  estilo = ESTILO_ELEMENTO_VACIO,
  fuenteParActivo = null,
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
  /** El estilo por elemento de ESTA frase (§ EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1) — sólo
   *  `marquesina.texto` lo declara en `ELEMENTOS_ESTILO` (estilo-elemento.ts); `marquesina.
   *  fraseBanda` (la banda suelta) NO, así que su llamador nunca pasa esta prop. Default
   *  `ESTILO_ELEMENTO_VACIO` ("sin override") deja a quien no la pasa BYTE-IDÉNTICO. */
  estilo?: EstiloElementoResuelto;
  fuenteParActivo?: ClaveFuentePar | null;
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
    // `estilo.fuente`/`estilo.tamano` en las deps (§ EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1): los
    // dos cambian el ancho real del texto (una fuente distinta tiene otras métricas; un tamaño
    // distinto escala el glifo), así que un cambio de estilo debe re-medir el track — sin esto, la
    // duración del ciclo quedaría calculada contra el ancho ANTERIOR al cambio hasta el próximo
    // resize. `estilo.color`/`.alinear` no afectan el ancho: no hace falta repetir el objeto entero.
  }, [texto, velocidadTicker, editando, estilo.fuente, estilo.tamano]);

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
        // § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — sólo las claves PRESENTES en el estilo
        // declarado sobreescriben lo de arriba (`estiloInlineDeElemento` devuelve `{}` sin ningún
        // override, § estilo-elemento.ts): con ESTILO_ELEMENTO_VACIO (el default de todo llamador
        // que no pasa `estilo`, y de `marquesina.texto` sin fila) el objeto queda BYTE-IDÉNTICO.
        ...estiloInlineDeElemento(estilo, 'ticker', fuenteParActivo),
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
 *
 * `transicion` (§ EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1, default `'subir'`) decide CUÁL de las
 * cinco funciones de `lib/animation.ts` produce el `transform`/`filter` — el HERO (que nunca pasa
 * esta prop) queda BYTE-IDÉNTICO: `transformTransicionMarquesinaItem('subir', …)` delega en la MISMA
 * `transformEntradaSalidaItem` que ya llamaba antes de este slice, y `filterTransicionMarquesinaItem`
 * devuelve `'none'` para cualquier transición que no sea `'enfocar'`. `indice` (default 0) sólo lo
 * usa `'deslizar'`, para alternar el lado por el que entra cada producto (§ `direccionDeslizarItem`).
 */
export function MarquesinaTarjetaMotor({
  producto, progreso, estatico, ventanaEntrada, ventanaSalida, techo = 1,
  posicion = 'relativa', transicion = 'subir', indice = 0,
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
  transicion?: TransicionMarquesina;
  indice?: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [tamanoImagen, setTamanoImagen] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setTamanoImagen(tamanoSiCompleta(imgRef.current));
  }, [producto.slug]);
  const modo = modoTarjetaMarquesina(tamanoImagen?.w, tamanoImagen?.h);

  const transform = useTransform(progreso, (p) => transformTransicionMarquesinaItem(transicion, p, estatico, ventanaEntrada, ventanaSalida, indice));
  const opacidad = useTransform(progreso, (p) => opacidadEntradaSalidaItem(p, estatico, ventanaEntrada, ventanaSalida, techo));
  const filtro = useTransform(progreso, (p) => filterTransicionMarquesinaItem(transicion, p, estatico, ventanaEntrada, ventanaSalida));

  const posicionClase = posicion === 'absoluta' ? 'absolute inset-0 m-auto' : 'relative';

  return (
    <motion.div
      className={`${posicionClase} z-20 grid aspect-[3/4] w-[min(340px,62vw)] place-items-center overflow-hidden sf-radio-tile ${modo === 'tile' ? 'bg-[var(--sf-tarjeta,white)] p-8' : ''}`}
      style={{ transform, opacity: opacidad, filter: filtro }}
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
