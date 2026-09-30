"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { useCartStore } from "@/lib/cartStore";
import { moliendasDisponibles, moliendaAceptada, imagenDeMolienda } from "@duna/core/moliendas-opciones";
import { formatCOP } from "@duna/core/utils";
import { imagenPortada } from "@/lib/producto-imagen";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible, productoSpotlight, productoOtraTalla } from "@/lib/config/site-content-defaults";
import { fontSizeDisplay } from "@/lib/config/escala-display";
import { contenedorAnchoClase } from "@/lib/config/themes";

// LA BANDA SPOTLIGHT (§ SPOTLIGHT-BANDA-1) — un solo producto PINEADO, con su selector de
// molienda, notas de cata y "Agregar al carrito" REUSADOS VERBATIM (medido:
// SPOTLIGHT-CAPACIDAD-CENSO-1: el selector es `moliendasDisponibles`/`moliendaAceptada`, el MISMO
// módulo que ya comparten ProductCard/el detalle/el servidor; el carrito es el `addItem` de
// `useCartStore`, sin una segunda implementación). El PIN (`spotlight.productoSlug`) se resuelve
// contra el catálogo vivo con `productoSpotlight` (§ site-content-defaults.ts): el producto pineado
// se LEE en cada render — nombre, descripción, notas de cata, precio e imagen NUNCA se copian a
// SiteContent, sólo su `slug` viaja como puntero.
//
// § NUESTRO-CAFE-COMO-MUESTRARIO-1 — la ESTRUCTURA, TIPOGRAFÍA y COLOR se re-midieron contra
// `.spotlight` del prototipo (`docs/prototipos/cafeone/index.html:159-224`, `css/app.css:434-505`).
// La banda SÓLO renderiza bajo la variante `featured·spotlight`, que hoy SÓLO pide CORTE — Nayoli
// (`featured·cuadricula`) jamás monta este árbol, así que no hay byte-identidad que preservar
// ACÁ (a diferencia de casi todo el resto del storefront): cada número/color/fuente de abajo se citó
// contra el prototipo, no contra "lo de antes". Las clases siguen usando los tokens `--sf-*` (nunca
// un hex horneado) para que un preset FUTURO que también elija `featured·spotlight`, con otra
// paleta/forma, herede la fidelidad sin tocar este archivo.
export default function Spotlight({ style }: { style?: React.CSSProperties } = {}) {
  const { spotlight, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1, SPOTLIGHT-CIERRE-1) — mismo mecanismo que
  // FeaturedProductsGrilla.tsx: `undefined` sin escala declarada → NO se toca el `style`, el h2
  // sigue rindiendo `text-3xl sm:text-4xl` (byte-idéntico); sólo CORTE ('amplia') lo agranda.
  const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');

  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const { addItem } = useCartStore();
  const producto = productoSpotlight(catalog, spotlight.productoSlug);

  // Molienda elegida — por defecto la primera opción DISPONIBLE del producto pineado. Mismo
  // mecanismo que el detalle de producto (§ app/(storefront)/tienda/[slug]/page.tsx): se fija una
  // sola vez, cuando el producto llega.
  const [molienda, setMolienda] = useState<string | null>(null);
  useEffect(() => {
    if (producto && molienda === null) {
      setMolienda(moliendasDisponibles(producto.moliendasOpciones)[0]?.nombre ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto]);

  // EL ESCENARIO (`.bag-card`/`.stage-nav` del prototipo, index.html:169-178) — el índice de la
  // "vista" que las flechas recorren. Declarado ANTES de los early-return de abajo: los hooks se
  // llaman siempre, incondicionalmente (regla de React), aunque `vistas` (que sí depende de
  // `producto`) se construya después.
  const [vistaIndex, setVistaIndex] = useState(0);

  if (!seccionEsVisible(REGISTRY.spotlight, spotlight)) return null;
  if (!producto) return null; // catálogo vacío (§ productoSpotlight — hide-on-empty)

  const otroTamano = productoOtraTalla(catalog, spotlight.otroTamanoSlug);

  // LAS VISTAS DEL ESCENARIO — primero cada molienda DISPONIBLE del producto pineado (imagen propia
  // si la declaró, § imagenDeMolienda; producto SIN moliendas → una sola vista con su portada), y al
  // final —si existe— la OTRA TALLA como una vista MÁS de sólo-vistazo (§ Backlog #62: el tamaño
  // sigue siendo un ENLACE a otro producto, nunca una variante agrupada con su propio precio en este
  // panel — recorrerla actualiza el escenario, JAMÁS `molienda` ni el precio/CTA de abajo, que
  // siguen comprometidos con el producto pineado; el control "Tamaño" de más abajo es el único
  // camino real a esa otra talla). Con una sola vista, las flechas no se muestran.
  const opcionesMolienda = moliendasDisponibles(producto.moliendasOpciones);
  const vistasMolienda = opcionesMolienda.length > 0
    ? opcionesMolienda.map((o) => ({
        key: o.nombre,
        imagen: imagenPortada(imagenDeMolienda(producto.moliendasOpciones, o.nombre, producto.imagen ?? '')),
        etiqueta: producto.peso_gramos != null ? `${o.nombre} · ${producto.peso_gramos} g` : o.nombre,
        esOtraTalla: false,
      }))
    : [{
        key: '__base__',
        imagen: imagenPortada(producto.imagen ?? ''),
        etiqueta: producto.peso_gramos != null ? `${producto.peso_gramos} g` : '',
        esOtraTalla: false,
      }];
  const vistas = otroTamano
    ? [...vistasMolienda, {
        key: '__otra_talla__',
        imagen: imagenPortada(otroTamano.imagen ?? ''),
        etiqueta: otroTamano.peso_gramos != null ? `${otroTamano.peso_gramos} g` : otroTamano.nombre,
        esOtraTalla: true,
      }]
    : vistasMolienda;

  const indiceActual = Math.min(vistaIndex, vistas.length - 1);
  const vistaActual = vistas[indiceActual];

  const irAVista = (direccion: 1 | -1) => {
    const siguiente = (indiceActual + direccion + vistas.length) % vistas.length;
    setVistaIndex(siguiente);
    const frame = vistas[siguiente];
    if (!frame.esOtraTalla) setMolienda(frame.key);
  };

  const elegirMolienda = (nombre: string) => {
    setMolienda(nombre);
    const idx = vistas.findIndex((v) => v.key === nombre);
    if (idx >= 0) setVistaIndex(idx);
  };

  const handleAdd = () => {
    // Se comprueba con `moliendaAceptada`, LA MISMA función que decide en el servidor — igual que
    // el detalle de producto: la UI y el checkout no pueden discrepar sobre qué molienda es válida.
    if (!moliendaAceptada(producto.moliendasOpciones, molienda)) {
      toast.error("Selecciona una molienda disponible");
      return;
    }
    addItem(producto, 1, { ...(molienda ? { molienda } : {}) });
    toast.success(`${producto.nombre} agregado al carrito`);
  };

  // SIN ENCABEZADO, LA GRILLA NO PUEDE SEGUIR SIENDO DE TRES COLUMNAS (§ PARIDAD-CAFE-Y-ORIGEN-1,
  // medido contra el muestrario desplegado: `spotlight.eyebrow`/`spotlight.titulo` vacíos —caso real
  // de hoy, Onix sin esos campos cargados— dejaban el escenario y la compra auto-colocados en las
  // columnas 1 y 2 de `[1fr_1.05fr_1fr]`, con la 3ª (1fr) VACÍA: la banda quedaba corrida a la
  // izquierda con un tercio del ancho en blanco). El encabezado es el ÚNICO consumidor de esa 3ª
  // columna — sin él, la grilla se queda en el MISMO `min-[820px]:grid-cols-2` que ya reparte el
  // ancho completo entre escenario y compra en los anchos intermedios (820-1199px): no hace falta
  // inventar una proporción nueva, sólo NO activar el split de tres a 1200px.
  const tieneEncabezado = Boolean(spotlight.eyebrow || spotlight.titulo);
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá (esta banda ya
  // lee `navTratamiento` para `badgeColor`, arriba). `false` = el literal de HOY, byte a byte —
  // aunque en la práctica esta banda sólo renderiza bajo CORTE (§ el docstring de cabecera).
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <section id="producto" className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        {/* LA GRILLA (`.spotlight-grid`, css/app.css:437-440,973-974,989) — TRES columnas lado a lado
            desde 1200px (`1fr 1.05fr 1fr`, gap 64px, `--space-16`); el encabezado sube a su PROPIA
            columna recién ahí. Entre 820-1200 son DOS columnas (gap 48px, `--space-12`) con el
            encabezado ocupando la fila completa arriba (`grid-column:1/-1`) y el escenario/compra
            debajo, uno junto al otro. Bajo 820 es UNA columna (gap 40px, `--space-10`), apilados en
            el mismo orden del DOM: encabezado → escenario → compra — igual que el prototipo, que no
            reordena en ningún breakpoint. */}
        <div
          className={`grid grid-cols-1 gap-10 min-[820px]:grid-cols-2 min-[820px]:gap-12 min-[1200px]:gap-16 items-center ${
            tieneEncabezado ? 'min-[1200px]:grid-cols-[1fr_1.05fr_1fr]' : ''
          }`}
        >
          {tieneEncabezado && (
            <motion.div
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              className="min-[820px]:col-span-2 min-[1200px]:col-span-1"
            >
              {/* `.eyebrow` (css/app.css:83-87, tokens.css:113,128): 12px, semibold, uppercase,
                  tracking .085em, color `text-muted` — NO el acento (el prototipo no colorea el
                  eyebrow de "Nuestro café"; era la divergencia de esta banda). */}
              {spotlight.eyebrow && (
                <p className="text-[12px] font-semibold tracking-[0.085em] uppercase text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">{spotlight.eyebrow}</p>
              )}
              {/* `.spotlight-head .display-l` (css/app.css:441, tokens.css:99-100,115,131): margin-top
                  20px (`--space-5`), line-height .98, tracking -.015em. El tamaño fluido en sí
                  (`clamp(48px,5vw,76px)`) ya lo aporta `displayL` (§ escala-display.ts) — sin tocar. */}
              {/* La línea entera (tag, className CON whitespace-pre-line, interpolación y cierre)
                  va en UN solo renglón a propósito: `titulares-saltos.test.ts` (fuera de
                  `touches:` — no se toca) lee la FUENTE y exige que la MISMA línea traiga las
                  tres cosas juntas. */}
              {spotlight.titulo && (
                <h2 className="mt-5 text-3xl sm:text-4xl font-playfair leading-[0.98] tracking-[-0.015em] text-[var(--sf-sobre-banda,var(--sf-tinta))] whitespace-pre-line text-balance" style={displayL ? { fontSize: displayL } : undefined}>{spotlight.titulo}</h2>
              )}
            </motion.div>
          )}

          {/* EL ESCENARIO — `.spotlight-stage`/`.bag-card`/`.stage-nav` (css/app.css:442-468,
              tokens.css:60,169). `aspect-[3/4]` (`.bag-card{aspect-ratio:3/4}`), `sf-radio-tile`
              (§ NUESTRO-CAFE-RADIO-TILE-1, cerrado por PARIDAD-RIEL-TARJETAS-1 — el rol var-backed
              PROPIO de `--radius-tile`, separado de `sf-radio-lg`: CORTE 'recta' → 20px, el valor
              exacto medido del prototipo; antes compartía campo con `sf-radio-lg`, que daba 2px,
              el escalón de un control chico, no de un tile grande), fondo `--sf-superficie` (el
              rol más próximo a `--surface-tile`, sólo visible mientras la imagen carga).

              LA FOTO LLENA EL TILE (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1, REVIERTE `p-8` +
              `object-contain`) — gate del owner con captura: "en destacado... hay que acomodarlas
              para que no se vea el borde". `object-contain` dentro de un `p-8` dejaba ver el fondo
              `--sf-superficie` alrededor de la foto como un RECTÁNGULO con borde propio dentro del
              tile — el defecto exacto de la captura (`onix-destacado-borde.webp`). Las fotos de
              CORTE ya son 3:4 (el owner subió fotos 3:4 de ≥1500px), la MISMA proporción del tile
              (`aspect-[3/4]`), así que `object-cover` sin relleno no recorta nada perceptible: llena
              el tile borde a borde, con el radio de `sf-radio-tile` (`overflow-hidden` en el
              ancestro). Sin el `div` intermedio de padding: un hijo `fill` llena directo al
              ancestro con `overflow-hidden`. */}
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
          >
            <div className="relative aspect-[3/4] sf-radio-tile overflow-hidden bg-[var(--sf-superficie)]">
              {/* El `.bag-card .badge` del prototipo (§ RIEL-SCROLL-Y-BADGE-DORADO-1, el censo de
                  consumidores, DECISIONS.md) — mismo `style` inline condicional que StoreNav/
                  ProductCard, byte-idéntico si `navTratamiento.badgeColor` es `null`.

                  TEXTO (§ BADGES-ACCIONES-Y-LOGO-CORTE-1, cierra CORTE-BADGE-BESTSELLER-TEXTO-VERDE-1):
                  mismo cambio que `ProductCard.tsx` — el texto pasa de `--sf-tinta` (verde) al par
                  pleno que ya usa "Cosecha 2026" en `StoreNav.tsx`, gateado por `navTratamiento.cta`
                  (true sólo en CORTE). `false` → `text-[var(--sf-tinta)]`, byte-idéntico a hoy. */}
              {spotlight.badge && (
                <span
                  className={`absolute top-4 left-4 z-10 text-xs font-semibold bg-[var(--sf-tostado)] ${navTratamiento.cta ? "text-[var(--sf-acento-txt)]" : "text-[var(--sf-tinta)]"} px-3 py-1 sf-pildora sf-badge`}
                  style={navTratamiento.badgeColor ? { backgroundColor: navTratamiento.badgeColor } : undefined}
                >{spotlight.badge}</span>
              )}
              {/* EL MUESTRARIO (§ MUESTRARIO-VARIANTE-IMAGEN-1, extendido acá a la OTRA TALLA):
                  `vistaActual` es la molienda elegida, o —al llegar al final del ciclo, si existe—
                  la otra talla en modo sólo-vistazo (§ el comentario de `vistas`, arriba). */}
              <Image
                src={vistaActual.imagen}
                alt={vistaActual.esOtraTalla ? (otroTamano?.nombre ?? producto.nombre) : producto.nombre}
                fill
                sizes="(max-width: 1200px) 100vw, 33vw"
                className="object-cover"
              />
              {/* `.bag-label` (css/app.css:453-458, tokens.css:112,128): 13px, uppercase, tracking
                  .085em, color `text-muted`, 20px del borde (`--space-5`). */}
              {vistaActual.etiqueta && (
                <span className="absolute left-5 bottom-5 text-[13px] uppercase tracking-[0.085em] text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">{vistaActual.etiqueta}</span>
              )}
            </div>
            {/* `.stage-nav` (css/app.css:462-468): 44×44px, cuadrados (`--radius-button`=0, vía
                `sf-pildora` bajo 'recta'), borde `border-strong`, hover `surface-muted`. Recorren
                `vistas` — se ocultan con una sola (§ el comentario de `vistas`, arriba). */}
            {vistas.length > 1 && (
              <div className="flex gap-2 justify-center mt-6">
                <button
                  type="button"
                  onClick={() => irAVista(-1)}
                  aria-label="Presentación anterior"
                  className="w-11 h-11 sf-pildora sf-borde border-[var(--sf-linea)] flex items-center justify-center text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-[18px] h-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => irAVista(1)}
                  aria-label="Presentación siguiente"
                  className="w-11 h-11 sf-pildora sf-borde border-[var(--sf-linea)] flex items-center justify-center text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)] transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-[18px] h-[18px]" />
                </button>
              </div>
            )}
          </motion.div>

          {/* `.spotlight-buy` (css/app.css:180-224 del markup, roles en 95-116,470-503) */}
          <div className="space-y-6">
            {/* `.h3` (tokens.css:104,116,121): 26px, line-height 1.14, weight regular(400) — no bold. */}
            <h3 className="text-[26px] leading-[1.14] font-playfair font-normal text-[var(--sf-sobre-banda,var(--sf-tinta))]">{producto.nombre}</h3>
            {/* `.muted` sobre el párrafo (index.html:182): color `text-muted`, tamaño heredado del
                body (`--text-body-m`=16px, `--leading-body`=1.5). */}
            <p className="text-base leading-[1.5] text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">{producto.descripcion}</p>

            {/* `.notes`/`.note-chip` (css/app.css:470-474, tokens.css:112,128,164): SIN encabezado
                propio (el prototipo no lleva un label "Notas de cata" sobre `.notes`, index.html:
                184-188) — chips sin relleno, sólo borde, 13px, color muted. */}
            {(producto.notasCata?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {producto.notasCata!.map((n) => (
                  <span key={n} className="text-[13px] text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))] px-3 py-1.5 sf-pildora sf-borde border-[var(--sf-linea)]">{n}</span>
                ))}
              </div>
            )}

            {/* `.variant`/`.opts`/`.opt` — "Presentación" (index.html:189-194, css/app.css:476-490):
                el `.opt` PULSADO se pinta LLENO de acento (`aria-pressed=true` → `background:
                action-primary`), no un 5% de tinte — la divergencia #1 de este slice. */}
            {(producto.moliendasOpciones?.length ?? 0) > 0 && (
              <div>
                <span className="block mb-3 text-[12px] font-semibold tracking-[0.085em] uppercase text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">Presentación</span>
                <div className="flex flex-wrap gap-2">
                  {producto.moliendasOpciones!.map((o) => {
                    const selected = molienda === o.nombre;
                    return (
                      <button
                        key={o.nombre}
                        type="button"
                        disabled={!o.disponible}
                        onClick={() => o.disponible && elegirMolienda(o.nombre)}
                        aria-pressed={selected}
                        title={o.disponible ? undefined : 'Próximamente'}
                        className={`px-[22px] py-[13px] sf-pildora sf-borde text-left transition-colors ${
                          selected
                            ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]'
                            : o.disponible
                              ? 'border-[var(--sf-linea)] hover:border-[var(--sf-acento)] cursor-pointer'
                              : 'border-[var(--sf-linea)] opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <span className={`block text-sm font-medium ${selected ? 'text-[var(--sf-acento-txt)]' : 'text-[var(--sf-sobre-banda,var(--sf-tinta))]'}`}>{o.nombre}</span>
                        <span className={`block text-[11px] ${selected ? 'text-[var(--sf-acento-txt)]/80' : 'text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]'}`}>{o.metodo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tamaño como ENLACE a la otra talla (otro producto, otro slug) — NO una variante
                agrupada (§ Backlog #62, que este slice no dispara). Sin `otroTamanoSlug` el
                control simplemente no aparece (preferir callar a un link roto). Mismo tratamiento
                de `.opt` que "Presentación" — la talla activa PINEADA se pinta llena de acento. */}
            {otroTamano && (
              <div>
                <span className="block mb-3 text-[12px] font-semibold tracking-[0.085em] uppercase text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">Tamaño</span>
                <div className="flex flex-wrap gap-2">
                  <span className="px-[22px] py-[13px] sf-pildora sf-borde border-[var(--sf-acento)] bg-[var(--sf-acento)] text-sm font-medium text-[var(--sf-acento-txt)]">
                    {producto.peso_gramos != null ? `${producto.peso_gramos} g` : producto.nombre}
                  </span>
                  <Link
                    href={`/tienda/${otroTamano.slug}`}
                    className="px-[22px] py-[13px] sf-pildora sf-borde border-[var(--sf-linea)] hover:border-[var(--sf-acento)] text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-colors"
                  >
                    {otroTamano.peso_gramos != null ? `${otroTamano.peso_gramos} g` : otroTamano.nombre}
                  </Link>
                </div>
              </div>
            )}

            {/* `.price-row` (css/app.css:491-503, tokens.css:103,111): precio en 32px (`--text-h2`),
                serif, peso regular (no bold); la nota "COP · impuestos incluidos" es COPY —
                `spotlight.notaPrecio`, opcional; vacío = no se muestra (§ el campo nuevo de este
                slice, `SpotlightContent.notaPrecio`). */}
            <div className="flex items-baseline gap-3">
              <span className="text-[32px] font-playfair font-normal text-[var(--sf-sobre-banda,var(--sf-tinta))]">{formatCOP(producto.precio)}</span>
              {spotlight.notaPrecio && (
                <span className="text-sm text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">{spotlight.notaPrecio}</span>
              )}
            </div>

            {/* `.btn.btn--primary.btn--block` (css/app.css:123-136,147, tokens.css:77-79,111,128,
                155-156,171) — MISMO patrón ya medido/vetado para el CTA de StoreNav (§
                CROMO-NAV-CTA-Y-BADGE-1): `sf-pildora` para el radio de botón (0 bajo 'recta'),
                mayúscula + tracking .085em + semibold, hover/active vía `--sf-accion-hover`/
                `--sf-accion-active` (§ CTA-HOVER-RESTO-FAMILIA-1, `palette-derive.ts`) — el ROJO
                OSCURECIDO del prototipo (`oscurecer()`, preserva el HUE), NO `mezclar(acento,
                tinta, w)` (`--sf-acento-3`/`-2`, el mecanismo viejo: desviaba el hue hacia la
                tinta verde de CORTE y daba un marrón/oliva), `active:translate-y-px`. `py-[18px]` +
                `px-[28px]` = `--button-pad-y`/`-x`; `text-sm`(14px) = `--text-body-s`. */}
            <button
              type="button"
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-2 sf-pildora bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] active:translate-y-px text-[var(--sf-acento-txt)] font-semibold uppercase tracking-[0.085em] py-[18px] px-[28px] transition-all duration-[120ms] text-sm cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" /> Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
