"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useTransform } from "framer-motion";

import {
  useProgresoScrollDesdeTope, veloOpacidad, claseAlturaAncestroBandaMarquesina,
  ventanasBandaMarquesina, UMBRAL_REVELADO_TEXTO,
} from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import CampoEditable from "@/components/storefront/CampoEditable";
import { REGISTRY, seccionEsVisible, productosBandaMarquesina } from "@/lib/config/site-content-defaults";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { MarquesinaFraseMotor, MarquesinaTarjetaMotor } from "@/components/storefront/home/MarquesinaMotor";

// LA BANDA MARQUESINA, REHECHA — § EDITOR-TIENDA-MARQUESINA-SECCION-1. El pedido del owner, literal:
// «lo de la marquesina, no la eliminemos, pero sí arreglémosla, porque la [marquesina] del hero es
// la que se ve perfecta, entonces crear una sección marquesina que se pueda usar en el hero, o en
// otra parte de la página para mostrar los productos… a medida que se va haciendo scroll van
// saliendo los productos con un efecto/transición».
//
// ANTES de este slice, esta banda era la forma "Cafeone" (foto velada + texto que se desplaza por
// SCROLL + UNA tarjeta que escala/rota) — la forma que el owner reportó mala TRES veces para el
// hero antes de que naciera `HeroMediaMarquesina.tsx` (§ su docstring de cabecera). Esta banda
// quedaba apagada por default y nunca se tocó mientras el hero resolvía su propio problema — hasta
// ahora: usa el MISMO motor (`MarquesinaMotor.tsx`, extraído del hero), generalizado de UN producto a
// HASTA SEIS que se van REEMPLAZANDO uno al otro a medida que se hace scroll por la sección (§ "LA
// SECCIÓN SUELTA" en `lib/animation.ts`, la derivación de las ventanas de progreso).
//
// SIGUE NACIENDO APAGADA (`DEFAULTS.marquesina.visible: false`) — es capacidad OPCIONAL, no un
// reemplazo de ninguna otra sección; el hero·sticky de CORTE no cambia (sigue leyendo `marquesina.
// texto`/`.productoSlug`, § HeroMediaMarquesina.tsx, sin tocar en este slice).
//
// LOS DATOS SON PROPIOS, NO LOS DEL HERO (§ MarquesinaContent, site-content-defaults.ts): `texto`/
// `productoSlug`/`imagen` siguen siendo del hero (`imagen` ya era, desde antes de este slice, el
// fondo de ESTA banda — nunca del hero; no se mueve, sigue siendo el mismo rol). `fraseBanda`/
// `producto1..6`/`imagenTipo` son NUEVOS, propios de esta banda.
//
// EL FONDO ES FOTO O VIDEO (`imagenTipo`), CON EL VELO DEL HERO — el MISMO token (`--sf-velo`) y la
// MISMA función (`veloOpacidad`, sin rango propio: usa el default 'media', como el velo de esta
// banda ya usaba antes de este slice) para que la densidad del velo responda al scroll igual que en
// el hero·sticky, en vez del overlay FIJO que tenía antes.
//
// LISTA VACÍA → EL CATÁLOGO, NO UN HUECO (`productosBandaMarquesina`, site-content-defaults.ts): es
// una VITRINA, no un pin — con la banda encendida y ningún producto elegido todavía, mostrar los
// cafés que YA existen es más honesto que una banda sin nada que mostrar. Sin NINGÚN producto
// (catálogo también vacío) la sección entera se oculta — no hay "efecto de scroll" que mostrar sobre
// cero productos.
//
// MOVIMIENTO REDUCIDO (preview del editor, o `prefers-reduced-motion`): NO hay sticky ni scroll que
// revelar — la sección cae a un layout NORMAL (sin pin, sin presupuesto de scroll extra): la frase
// queda quieta y los productos se muestran TODOS a la vez, sin animación, en una fila que envuelve —
// "como hoy hace la banda" (el pedido explícito del spec). `MarquesinaFraseMotor`/
// `MarquesinaTarjetaMotor` ya saben rendir su estado final bajo `estatico`; lo que cambia es el
// ANDAMIAJE alrededor (sin wrapper de altura extra, sin `position:sticky`, cards en flujo normal en
// vez de apiladas una sobre otra).

export default function Marquesina({ style }: { style?: React.CSSProperties } = {}) {
  const { marquesina } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;

  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  const productos = productosBandaMarquesina(catalog, [
    marquesina.producto1, marquesina.producto2, marquesina.producto3,
    marquesina.producto4, marquesina.producto5, marquesina.producto6,
  ]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const progreso = useProgresoScrollDesdeTope(wrapperRef);
  const opacidadVelo = useTransform(progreso, (p) => veloOpacidad(p, estatico));
  const ventanas = ventanasBandaMarquesina(productos.length);

  const esVideo = marquesina.imagenTipo === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);
  const reproducir = esVideo && !preview && !reduce;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reproducir) v.play().catch(() => {});
    else v.pause();
  }, [reproducir]);

  // HIDE-ON-EMPTY ES DE LA LISTA, NO DE LA SECCIÓN ENTERA — igual que el pin de la tarjeta del hero
  // (§ HeroMediaMarquesina.tsx: el texto del loop nunca depende del producto). `productos` puede
  // quedar vacío en SSR (el catálogo se fetchea client-side, § `catalog` arriba) aunque el dueño SÍ
  // haya elegido productos o el catálogo SÍ tenga — ocultar la banda ENTERA en ese instante sería
  // un parpadeo (texto+fondo apareciendo recién tras hidratar), no una decisión de contenido. Con
  // cero productos, el escenario de abajo simplemente no tiene tarjetas que pintar.
  if (!seccionEsVisible(REGISTRY.marquesina, marquesina)) return null;

  const fondo = esVideo ? (
    <CampoEditable campo="marquesina.imagen" tipo="imagen">
      <video
        ref={videoRef}
        src={marquesina.imagen}
        muted
        loop
        playsInline
        preload={reproducir ? 'auto' : 'none'}
        controls={!!reduce && !preview}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </CampoEditable>
  ) : (
    <CampoEditable campo="marquesina.imagen" tipo="imagen">
      <Image src={marquesina.imagen} alt="" fill sizes="100vw" className="object-cover" />
    </CampoEditable>
  );

  // ─── MOVIMIENTO REDUCIDO — layout NORMAL, sin sticky, todos los productos visibles a la vez ──────
  if (estatico) {
    return (
      <section
        aria-label={marquesina.fraseBanda}
        className="relative flex min-h-[70vh] flex-col items-center justify-center gap-10 overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] px-6 py-24"
        style={style}
      >
        <div className="absolute inset-0">
          {fondo}
          <motion.div className="absolute inset-0 bg-[var(--sf-velo)]" style={{ opacity: opacidadVelo }} />
        </div>

        <div className="relative z-10 flex h-[1.1em] w-full items-center justify-center overflow-hidden">
          <MarquesinaFraseMotor
            campo="marquesina.fraseBanda"
            texto={marquesina.fraseBanda}
            progreso={progreso}
            estatico={estatico}
            tickerVelocidad="media"
            editando={false}
            ventana={UMBRAL_REVELADO_TEXTO}
          />
        </div>

        <div className="relative z-20 flex flex-wrap items-center justify-center gap-6">
          {productos.map((producto) => (
            <MarquesinaTarjetaMotor
              key={producto.slug}
              producto={producto}
              progreso={progreso}
              estatico={estatico}
              ventanaEntrada={{ desde: 0, hasta: 1 }}
            />
          ))}
        </div>
      </section>
    );
  }

  // ─── EL MOTOR DEL HERO, GENERALIZADO A N PRODUCTOS — sticky + presupuesto de scroll derivado ──────
  return (
    <div
      ref={wrapperRef}
      data-marquesina-banda=""
      className={`relative ${claseAlturaAncestroBandaMarquesina(productos.length)} overflow-clip bg-[var(--sf-banda,var(--sf-tinta))]`}
      style={style}
    >
      <section
        aria-label={marquesina.fraseBanda}
        className="sticky top-0 flex h-[100svh] items-center justify-center bg-[var(--sf-banda,var(--sf-tinta))]"
      >
        <div className="absolute inset-0">
          {fondo}
          <motion.div className="absolute inset-0 bg-[var(--sf-velo)] pointer-events-none" style={{ opacity: opacidadVelo }} />
        </div>

        <MarquesinaFraseMotor
          campo="marquesina.fraseBanda"
          texto={marquesina.fraseBanda}
          progreso={progreso}
          estatico={estatico}
          tickerVelocidad="media"
          editando={false}
          ventana={ventanas.texto}
        />

        {/* EL ESCENARIO — todas las tarjetas ocupan el MISMO lugar (`posicion="absoluta"`, § su
            docstring en MarquesinaMotor.tsx: `inset-0` + márgenes automáticos centra cada tarjeta,
            del mismo tamaño que el hero, dentro de este contenedor). Sólo UNA está visible en cada
            punto del scroll — la ventana de cada producto decide cuál. */}
        <div className="relative z-20 aspect-[3/4] w-[min(340px,62vw)]">
          {productos.map((producto, i) => (
            <MarquesinaTarjetaMotor
              key={producto.slug}
              producto={producto}
              progreso={progreso}
              estatico={estatico}
              ventanaEntrada={ventanas.items[i].entrada}
              ventanaSalida={ventanas.items[i].salida}
              posicion="absoluta"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
