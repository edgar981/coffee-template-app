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

  return (
    <section id="producto" className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* LA GRILLA (`.spotlight-grid`, css/app.css:437-440,973-974,989) — TRES columnas lado a lado
            desde 1200px (`1fr 1.05fr 1fr`, gap 64px, `--space-16`); el encabezado sube a su PROPIA
            columna recién ahí. Entre 820-1200 son DOS columnas (gap 48px, `--space-12`) con el
            encabezado ocupando la fila completa arriba (`grid-column:1/-1`) y el escenario/compra
            debajo, uno junto al otro. Bajo 820 es UNA columna (gap 40px, `--space-10`), apilados en
            el mismo orden del DOM: encabezado → escenario → compra — igual que el prototipo, que no
            reordena en ningún breakpoint. */}
        <div className="grid grid-cols-1 gap-10 min-[820px]:grid-cols-2 min-[820px]:gap-12 min-[1200px]:grid-cols-[1fr_1.05fr_1fr] min-[1200px]:gap-16 items-center">
          {(spotlight.eyebrow || spotlight.titulo) && (
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
              tokens.css:60,169). `aspect-[3/4]` (`.bag-card{aspect-ratio:3/4}`), `sf-radio-lg`
              (el rol var-backed que cubre `--radius-tile`, § themes.ts — CORTE 'recta' → 2px, no
              los 20px medidos del prototipo: ese token queda INERTE hoy, sin valor propio del set
              cerrado que represente 20px; reportado, no disimulado), fondo `--sf-superficie` (el
              rol más próximo a `--surface-tile`). El padding de 32px (`--space-8`) vive en el div
              INTERNO, no en el que lleva `fill` — un hijo `position:absolute;inset:0` ignora el
              padding del ancestro que lo posiciona (§ CSS containing block), así que la portada
              debe envolverse en un segundo nivel para que el margen se vea. */}
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
          >
            <div className="relative aspect-[3/4] sf-radio-lg overflow-hidden bg-[var(--sf-superficie)]">
              {/* El `.bag-card .badge` del prototipo (§ RIEL-SCROLL-Y-BADGE-DORADO-1, el censo de
                  consumidores, DECISIONS.md) — mismo `style` inline condicional que StoreNav/
                  ProductCard, byte-idéntico si `navTratamiento.badgeColor` es `null`. */}
              {spotlight.badge && (
                <span
                  className="absolute top-4 left-4 z-10 text-xs font-semibold bg-[var(--sf-tostado)] text-[var(--sf-tinta)] px-3 py-1 sf-pildora sf-badge"
                  style={navTratamiento.badgeColor ? { backgroundColor: navTratamiento.badgeColor } : undefined}
                >{spotlight.badge}</span>
              )}
              <div className="absolute inset-0 p-8">
                <div className="relative w-full h-full">
                  {/* EL MUESTRARIO (§ MUESTRARIO-VARIANTE-IMAGEN-1, extendido acá a la OTRA TALLA):
                      `vistaActual` es la molienda elegida, o —al llegar al final del ciclo, si
                      existe— la otra talla en modo sólo-vistazo (§ el comentario de `vistas`,
                      arriba). `object-contain`, no `-cover` (`.bag-card img{object-fit:contain}`):
                      el prototipo deja ver la bolsa entera dentro del tile, nunca recortada. */}
                  <Image
                    src={vistaActual.imagen}
                    alt={vistaActual.esOtraTalla ? (otroTamano?.nombre ?? producto.nombre) : producto.nombre}
                    fill
                    sizes="(max-width: 1200px) 100vw, 33vw"
                    className="object-contain"
                  />
                </div>
              </div>
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
                mayúscula + tracking .085em + semibold, hover/active DERIVADOS del acento
                (`--sf-acento-3`/`-2`) sin hex nuevo, `active:translate-y-px`. `py-[18px]` +
                `px-[28px]` = `--button-pad-y`/`-x`; `text-sm`(14px) = `--text-body-s`. */}
            <button
              type="button"
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-2 sf-pildora bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] active:bg-[var(--sf-acento-2)] active:translate-y-px text-[var(--sf-acento-txt)] font-semibold uppercase tracking-[0.085em] py-[18px] px-[28px] transition-all duration-[120ms] text-sm cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" /> Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
