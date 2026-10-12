"use client";

// LA COMPOSICIÓN «COMPRA» de `featured` («Selección del mes») — § NAYOLI-HOME-COMPRA-1. Un solo
// café en sus variantes: presentación y tamaño se eligen en el MISMO bloque, la foto sigue la
// selección, y un botón agrega la variante elegida por el MISMO camino que la tarjeta de producto
// de hoy (`useCartStore().addItem`, nunca un carrito nuevo).
//
// EL PRODUCTO SALE DEL CATÁLOGO CON LA MISMA MATRIZ QUE «TAQUILLA» (`derivarMatrizTaquilla`,
// `lib/tienda/taquilla.ts`, SIN MODIFICARLA) — filas = presentación (categoria), columnas = tamaño
// (peso_gramos). Sin matriz válida, esta composición cae SOLA a la canónica (`cuadricula`), mismo
// patrón que «Taquilla»/«Láminas» caen a «Actual» en `TiendaCatalogo.tsx` — la decisión vive en
// `debeCaerAComposicionPorDefecto` (lib/storefront/compra-home.ts), para no repetir el criterio.
//
// LAS ETIQUETAS DE LAS OPCIONES SIGUEN LA MISMA REGLA QUE LA TAQUILLA DE /tienda: el primer eje
// (presentación) muestra el LITERAL de `categoria` (como la fila de `TiendaTaquilla.tsx`); el
// segundo (tamaño) muestra `"{peso} g"` (como su columna) — § `etiquetaEje1`/`etiquetaEje2`.
//
// AGOTADO = TACHADO Y NO ELEGIBLE (mismo criterio que la Taquilla de SUSCRIPCIÓN,
// `SuscripcionTaquilla.tsx`, no la de /tienda que sólo rotula): cada opción se cruza contra el eje
// YA elegido (§ `opcionesEje1`/`opcionesEje2`) — nunca una matriz 2D de celdas clickeables, los dos
// grupos son selectores INDEPENDIENTES, como la maqueta.
//
// LOS CAMPOS EDITORIALES viven en `spotlight` (la MISMA sección que ya ocupa este slot — § el
// docstring de `SpotlightContent`, site-content-defaults.ts), tagueados `composiciones: ['compra']`
// en el editor. `visible` es el MISMO interruptor que ya gatea «Destacado»: esta composición nace
// apagada igual (byte-idéntica) hasta que el dueño la elija Y la encienda.
//
// LA BARRA FIJA DEL CELULAR es la MISMA de la Taquilla (`lib/storefront/barra-fija.ts`,
// `visibilidadBarraFija`) — ningún mecanismo nuevo.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { useCartStore } from "@/lib/cartStore";
import { decidirMolienda } from "@duna/core/moliendas-opciones";
import { formatCOP } from "@duna/core/utils";
import { whatsappUrl } from "@/lib/config/site";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import { derivarMatrizTaquilla, celdaDe, type MatrizTaquilla } from "@/lib/tienda/taquilla";
import {
  precioPor100Gramos,
  etiquetaEje1,
  etiquetaEje2,
  captionSeleccion,
  iconoDeOpcion,
  ayudaParaFila,
  filasDeDatosVisibles,
  debeCaerAComposicionPorDefecto,
  opcionesEje1,
  opcionesEje2,
} from "@/lib/storefront/compra-home";
import {
  visibilidadBarraFija,
  altoPublicadoBarraFija,
  DURACION_BARRA_FIJA_S,
  VAR_ALTO_BARRA_FIJA,
} from "@/lib/storefront/barra-fija";
import FeaturedProductsCuadricula from "@/components/storefront/home/FeaturedProductsCuadricula";

type Seleccion = { categoria: string; peso: number };

export default function FeaturedProductsCompra({ style }: { style?: React.CSSProperties } = {}) {
  const { spotlight, navTratamiento } = useSiteContent();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  if (!seccionEsVisible(REGISTRY.spotlight, spotlight)) return null;
  // MIENTRAS CARGA (`catalog === null`) cae a la canónica igual que cuando no hay matriz — mismo
  // criterio que `TiendaCatalogo.tsx` (`catalog !== null && derivarMatrizTaquilla(catalog)`): un
  // catálogo todavía no resuelto no puede afirmar que la matriz es válida.
  if (catalog === null || debeCaerAComposicionPorDefecto(catalog)) {
    return <FeaturedProductsCuadricula style={style} />;
  }
  const matriz = derivarMatrizTaquilla(catalog)!;

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-superficie))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        <CompraContenido matriz={matriz} spotlight={spotlight} />
      </div>
    </section>
  );
}

// EXPORTADO (nombrado) para la verificación por render en memoria (§ `renderToStaticMarkup`,
// `lib/config/site-content-defaults.test.ts`): el default export fetchea el catálogo en un
// `useEffect`, que NINGÚN render estático ejecuta — mismo límite que ya documenta
// `spotlight-cableado.test.ts` para `Spotlight.tsx`. Pasar la MATRIZ a mano (derivada de un
// catálogo fijo con `derivarMatrizTaquilla`, SIN mock de red) es lo que permite afirmar el
// renderizado real de «Compra» contra el catálogo de Nayoli.
export function CompraContenido({
  matriz,
  spotlight: s,
}: {
  matriz: MatrizTaquilla;
  spotlight: ReturnType<typeof useSiteContent>["spotlight"];
}) {
  const { whatsapp } = useSiteSettings();
  const { addItem } = useCartStore();
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const botonRef = useRef<HTMLDivElement | null>(null);
  const [barraFijaVisible, setBarraFijaVisible] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda de montaje estándar, § TiendaTaquilla.tsx
    setMontado(true);
  }, []);

  useEffect(() => {
    const el = botonRef.current;
    if (!el || typeof window === "undefined") return;
    const evaluar = () => {
      const rect = el.getBoundingClientRect();
      setBarraFijaVisible((antes) => visibilidadBarraFija(rect, window.innerHeight, antes));
    };
    evaluar();
    window.addEventListener("scroll", evaluar, { passive: true });
    window.addEventListener("resize", evaluar);
    return () => {
      window.removeEventListener("scroll", evaluar);
      window.removeEventListener("resize", evaluar);
    };
  }, [matriz]);

  const activa = seleccion ?? { categoria: matriz.filas[0], peso: matriz.columnas[0] };
  const producto = matriz.celdas.get(celdaDe(activa.categoria, activa.peso))!;
  const caption = captionSeleccion(activa.peso, activa.categoria);

  const iconos = [s.icono1, s.icono2, s.icono3];
  const ayudas = [s.ayuda1, s.ayuda2, s.ayuda3];
  const eje1 = opcionesEje1(matriz, activa.peso);
  const eje2 = opcionesEje2(matriz, activa.categoria);
  // La ayuda del eje1 es POSICIONAL (§ `ayudaParaFila`): el índice de la fila ELEGIDA en
  // `matriz.filas`, nunca el de `eje1` (mismo orden — `opcionesEje1` conserva el de la matriz—,
  // pero se deriva de la fuente, no por coincidencia).
  const indiceElegido = matriz.filas.indexOf(activa.categoria);
  const ayudaActiva = ayudaParaFila(ayudas, indiceElegido);
  const filasDatos = filasDeDatosVisibles([
    { rotulo: s.dato1Rotulo, valor: s.dato1Valor },
    { rotulo: s.dato2Rotulo, valor: s.dato2Valor },
    { rotulo: s.dato3Rotulo, valor: s.dato3Valor },
  ]);

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-[6fr_5fr] md:items-start md:gap-16">
      <figure>
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-[var(--sf-superficie)]">
          {producto.imagen ? (
            <Image
              key={producto.id}
              src={producto.imagen}
              alt={producto.nombre}
              fill
              sizes="(max-width: 768px) calc(100vw - 32px), 448px"
              quality={90}
              className="object-cover transition-opacity duration-200"
            />
          ) : null}
        </div>
        <figcaption className="mt-3.5 hidden border-t border-[var(--sf-linea)]/20 pt-3 font-playfair text-lg text-[var(--sf-tinta)] md:block">
          {caption}
        </figcaption>
      </figure>

      <div>
        {s.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sf-acento-texto)]">{s.eyebrow}</p>
        )}
        {s.titulo && (
          <h2 className="mt-3.5 font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">{s.titulo}</h2>
        )}
        {s.notas && <p className="mt-2.5 text-base text-[var(--sf-texto-suave)]">{s.notas}</p>}

        <EjeOpciones
          rotulo={s.rotuloEje1}
          opciones={eje1.map((o, i) => ({
            valor: o.categoria,
            label: etiquetaEje1(o.categoria),
            agotada: o.agotada,
            icono: iconoDeOpcion(iconos[i]),
          }))}
          elegido={activa.categoria}
          ayudaActiva={ayudaActiva}
          onElegir={(categoria) => setSeleccion({ categoria, peso: activa.peso })}
        />

        <div className="mt-7">
          {s.rotuloEje2 && (
            <span className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sf-acento-texto)]">
              {s.rotuloEje2}
            </span>
          )}
          <div className="border-t border-[var(--sf-linea)]/20">
            {eje2.map((o) => {
              const elegido = activa.peso === o.peso;
              return (
                <button
                  key={o.peso}
                  type="button"
                  disabled={o.agotada}
                  onClick={() => !o.agotada && setSeleccion({ categoria: activa.categoria, peso: o.peso })}
                  aria-pressed={elegido}
                  className={`grid min-h-[58px] w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 border-b border-[var(--sf-linea)]/20 px-1 text-left text-[var(--sf-tinta)] ${
                    o.agotada ? "cursor-not-allowed opacity-50 line-through" : "cursor-pointer"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full border-[1.5px] ${elegido ? "border-[var(--sf-tinta)] bg-[var(--sf-tinta)]" : "border-[var(--sf-tinta)]/45"}`}
                  />
                  <b className="font-playfair text-xl font-normal">{etiquetaEje2(o.peso)}</b>
                  <span className="text-right tabular-nums">
                    <strong className="block text-base font-semibold">{formatCOP(o.precio)}</strong>
                    {s.mostrarPrecioPor100g && (
                      <small className="block text-[12.5px] text-[var(--sf-texto-suave)]">
                        {formatCOP(precioPor100Gramos(o.precio, o.peso))} por 100 g
                      </small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={botonRef} className="mt-6">
          <BotonCompra producto={producto} whatsapp={whatsapp} onAgregar={() => addItem(producto, 1, aOpcionesMolienda(producto))} />
        </div>

        {filasDatos.length > 0 && (
          <dl className="mt-5.5">
            {filasDatos.map((f) => (
              <div key={f.rotulo} className="grid grid-cols-[8em_1fr] gap-3.5 border-b border-[var(--sf-linea)]/15 py-3 text-base">
                <dt className="self-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-acento-texto)]">{f.rotulo}</dt>
                <dd className="m-0 font-playfair text-lg text-[var(--sf-tinta)]">{f.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {s.barraFijaMovil && (
        <BarraFijaCompra
          caption={caption}
          producto={producto}
          whatsapp={whatsapp}
          visible={barraFijaVisible}
          montado={montado}
          onAgregar={() => addItem(producto, 1, aOpcionesMolienda(producto))}
        />
      )}
    </div>
  );
}

function aOpcionesMolienda(producto: Product): Record<string, string> {
  const decision = decidirMolienda(producto.moliendasOpciones);
  return decision.modo === "automatica" ? { molienda: decision.nombre } : {};
}

interface OpcionEje1Render {
  valor: string;
  label: string;
  agotada: boolean;
  icono: "grano" | "molido" | null;
}

function EjeOpciones({
  rotulo, opciones, elegido, ayudaActiva, onElegir,
}: {
  rotulo: string;
  opciones: OpcionEje1Render[];
  elegido: string;
  ayudaActiva: string | undefined;
  onElegir: (valor: string) => void;
}) {
  return (
    <div className="mt-7">
      {rotulo && (
        <span className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sf-acento-texto)]">{rotulo}</span>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {opciones.map((o) => {
          const seleccionada = o.valor === elegido;
          return (
            <button
              key={o.valor}
              type="button"
              disabled={o.agotada}
              onClick={() => !o.agotada && onElegir(o.valor)}
              aria-pressed={seleccionada}
              className={`flex min-h-[56px] items-center gap-3 rounded-[3px] border px-4 text-sm font-medium text-[var(--sf-tinta)] ${
                o.agotada
                  ? "cursor-not-allowed border-[var(--sf-linea)]/40 opacity-50 line-through"
                  : seleccionada
                    ? "cursor-pointer border-[var(--sf-tinta)] bg-[var(--sf-superficie)] shadow-[inset_0_0_0_1px_var(--sf-tinta)]"
                    : "cursor-pointer border-[var(--sf-linea)]/40"
              }`}
            >
              {o.icono === "grano" && <IconoGrano />}
              {o.icono === "molido" && <IconoMolido />}
              {o.label}
            </button>
          );
        })}
      </div>
      {ayudaActiva && <p className="mt-2 text-[13px] text-[var(--sf-texto-suave)]">{ayudaActiva}</p>}
    </div>
  );
}

function IconoGrano() {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-[26px] w-[26px] shrink-0 text-[var(--sf-acento)]">
      <ellipse cx="16" cy="16" rx="9" ry="12" transform="rotate(-25 16 16)" />
      <path d="M12 6 C 19 12, 13 20, 20 26" />
    </svg>
  );
}

function IconoMolido() {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-[26px] w-[26px] shrink-0 text-[var(--sf-acento)]">
      <path d="M5 23 C 9 15, 23 15, 27 23 Z" />
      <path d="M4 23 H 28" />
      <circle cx="12" cy="20" r=".8" fill="currentColor" />
      <circle cx="16" cy="18.5" r=".8" fill="currentColor" />
      <circle cx="20" cy="20" r=".8" fill="currentColor" />
    </svg>
  );
}

function BotonCompra({
  producto, whatsapp, onAgregar,
}: { producto: Product; whatsapp?: string; onAgregar: () => void }) {
  const [agregado, setAgregado] = useState(false);
  const decision = decidirMolienda(producto.moliendasOpciones);
  const agregaDirecto = decision.modo === "ninguna" || decision.modo === "automatica";
  const agotado = !producto.disponible;

  // MISMO criterio que `TiendaTaquilla.tsx` (`BotonTaquilla`): agotado → avisar por WhatsApp si
  // hay número; sin molienda resuelta sola → ir al detalle a elegir. Primero la plata, nunca un
  // `addItem` a secas sobre un producto con opciones.
  if (agotado) {
    if (!whatsapp) return null;
    return (
      <a
        href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${producto.nombre}?`)}
        target="_blank"
        rel="noreferrer"
        className="block w-full cursor-pointer rounded-[3px] border border-[var(--sf-tinta)] px-[26px] py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-tinta)] transition-colors hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]"
      >
        Avísame por WhatsApp
      </a>
    );
  }

  if (!agregaDirecto) {
    return (
      <a
        href={`/tienda/${producto.slug}`}
        className="block w-full cursor-pointer rounded-[3px] bg-[var(--sf-tinta)] px-[26px] py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)] transition-opacity hover:opacity-90"
      >
        Elegir molienda · {formatCOP(producto.precio)}
      </a>
    );
  }

  const handleAdd = () => {
    onAgregar();
    setAgregado(true);
    window.setTimeout(() => setAgregado(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="block w-full cursor-pointer rounded-[3px] bg-[var(--sf-tinta)] px-[26px] py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-fondo)] transition-opacity hover:opacity-90"
    >
      {agregado ? "Agregado ✓" : `Agregar al carrito · ${formatCOP(producto.precio)}`}
    </button>
  );
}

// LA BARRA FIJA DEL CELULAR (§ el spec, item 6) — MISMA de la Taquilla
// (`lib/storefront/barra-fija.ts`): flota a 12 px de los bordes, sube con `DURACION_BARRA_FIJA_S`
// —la MISMA constante que ya comparten Tienda/Suscripción/BackToTop (250 ms; "la misma de la
// Taquilla" manda sobre el literal "200 ms" del spec, § la nota de cierre— y `BackToTop` le cede
// el paso vía `VAR_ALTO_BARRA_FIJA`. Portal a `document.body` cuando NO es preview — esta
// composición nunca se monta en la vista previa en vivo del editor (§ el docstring de cabecera),
// así que `preview` no aplica acá y el portal es incondicional, salvo `montado` (el resguardo de
// SSR que ya usa `TiendaTaquilla.tsx`).
function BarraFijaCompra({
  caption, producto, whatsapp, visible, montado, onAgregar,
}: {
  caption: string;
  producto: Product;
  whatsapp?: string;
  visible: boolean;
  montado: boolean;
  onAgregar: () => void;
}) {
  if (!montado || typeof document === "undefined") return null;
  return createPortal(
    <BarraFijaCompraContenido caption={caption} producto={producto} whatsapp={whatsapp} visible={visible} onAgregar={onAgregar} />,
    document.body,
  );
}

function BarraFijaCompraContenido({
  caption, producto, whatsapp, visible, onAgregar,
}: {
  caption: string;
  producto: Product;
  whatsapp?: string;
  visible: boolean;
  onAgregar: () => void;
}) {
  const decision = decidirMolienda(producto.moliendasOpciones);
  const agregaDirecto = decision.modo === "ninguna" || decision.modo === "automatica";
  const agotado = !producto.disponible;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof document === "undefined") return;
    const publicar = () => {
      const alto = visible ? el.offsetHeight + (Number.parseFloat(getComputedStyle(el).bottom) || 0) : 0;
      document.documentElement.style.setProperty(VAR_ALTO_BARRA_FIJA, altoPublicadoBarraFija(visible, alto));
    };
    publicar();
    window.addEventListener("resize", publicar);
    return () => {
      window.removeEventListener("resize", publicar);
      document.documentElement.style.setProperty(VAR_ALTO_BARRA_FIJA, "0px");
    };
  }, [visible]);

  const tabProps = visible ? {} : { tabIndex: -1 };

  return (
    <motion.div
      ref={ref}
      aria-hidden={!visible}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 16 }}
      transition={{ duration: DURACION_BARRA_FIJA_S }}
      className={`fixed inset-x-3 z-30 flex items-center justify-between gap-3 rounded-[4px] border border-[var(--sf-linea)]/20 bg-[var(--sf-tinta)] px-4 py-3 shadow-xl md:hidden ${
        visible ? "" : "pointer-events-none"
      }`}
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <span className="truncate text-xs uppercase tracking-[0.04em] text-[var(--sf-fondo)]">
        {caption} — {formatCOP(producto.precio)}
      </span>
      {agotado ? (
        whatsapp && (
          <a
            href={whatsappUrl(whatsapp, `Hola, ¿cuándo vuelve a haber ${producto.nombre}?`)}
            target="_blank"
            rel="noreferrer"
            {...tabProps}
            className="shrink-0 cursor-pointer rounded-[3px] border border-[var(--sf-fondo)] px-[18px] py-2 text-xs font-semibold uppercase text-[var(--sf-fondo)] transition-colors hover:bg-[var(--sf-fondo)] hover:text-[var(--sf-tinta)]"
          >
            Avísame
          </a>
        )
      ) : agregaDirecto ? (
        <button
          type="button"
          onClick={onAgregar}
          {...tabProps}
          className="shrink-0 cursor-pointer rounded-[3px] bg-[var(--sf-fondo)] px-[18px] py-2 text-xs font-semibold uppercase text-[var(--sf-tinta)] transition-opacity hover:opacity-90"
        >
          Agregar
        </button>
      ) : (
        <a
          href={`/tienda/${producto.slug}`}
          {...tabProps}
          className="shrink-0 cursor-pointer rounded-[3px] bg-[var(--sf-fondo)] px-[18px] py-2 text-xs font-semibold uppercase text-[var(--sf-tinta)] transition-opacity hover:opacity-90"
        >
          Elegir
        </a>
      )}
    </motion.div>
  );
}
