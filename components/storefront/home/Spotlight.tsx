"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
import { etiquetaVarianteSpotlight, productoActivoSpotlight } from "@/lib/config/spotlight";
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
  // LOS DOS ALTERNOS (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) — INDEPENDIENTES entre sí, cada
  // uno un SEGUNDO producto que REEMPLAZA entero al principal al elegirlo (no una vista de
  // sólo-vistazo, a diferencia de `otroTamano` ANTES de este slice): `presentacionAlt` es la OTRA
  // presentación (molido/grano como productos distintos, § SpotlightContent.presentacionSlug);
  // `tamanoAlt` es el OTRO tamaño, el MISMO campo/resolver de siempre (`productoOtraTalla`), sólo con
  // efecto nuevo en la tienda. Ninguno cae a ningún fallback — vacío o sin match es "no hay otro que
  // ofrecer" (mismo criterio que ya documenta `productoOtraTalla`).
  const presentacionAlt = productoOtraTalla(catalog, spotlight.presentacionSlug);
  const tamanoAlt = productoOtraTalla(catalog, spotlight.otroTamanoSlug);

  // EL PRODUCTO ACTIVO DEL ESCENARIO — el principal, salvo que el visitante haya elegido un alterno
  // (§ productoActivoSpotlight, lib/config/spotlight.ts). Declarado con `producto` que puede ser
  // `null` todavía (el catálogo no cargó): `productoActivoSpotlight` exige un `T`, así que se calcula
  // con un principal "vacío" seguro y se descarta tras el early-return — los HOOKS de abajo leen
  // `productoActivo?.slug`, nunca `productoActivo` a secas antes del return.
  const [activoSlug, setActivoSlug] = useState<string | null>(null);
  const productoActivo = producto
    ? productoActivoSpotlight(producto, [presentacionAlt, tamanoAlt], activoSlug)
    : null;

  // Molienda elegida — por defecto la primera opción DISPONIBLE del producto ACTIVO. Se refija cada
  // vez que el producto activo cambia (el principal al montar, o un alterno al elegirlo): la
  // molienda del producto VIEJO no tiene por qué existir en el nuevo.
  const [molienda, setMolienda] = useState<string | null>(null);
  useEffect(() => {
    if (productoActivo) {
      setMolienda(moliendasDisponibles(productoActivo.moliendasOpciones)[0]?.nombre ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoActivo?.slug]);

  // EL ESCENARIO (`.bag-card`/`.stage-nav` del prototipo, index.html:169-178) — el índice de la
  // "vista" que las flechas recorren, SÓLO entre las moliendas del producto ACTIVO (ya no incluye la
  // "otra talla": esa ahora es el grupo Tamaño, con switch COMPLETO de producto, no una vista de
  // sólo-vistazo dentro del escenario, § arriba). Declarados ANTES de los early-return de abajo: los
  // hooks se llaman siempre, incondicionalmente (regla de React).
  const [vistaIndex, setVistaIndex] = useState(0);
  useEffect(() => { setVistaIndex(0); }, [productoActivo?.slug]);

  if (!seccionEsVisible(REGISTRY.spotlight, spotlight)) return null;
  if (!producto || !productoActivo) return null; // catálogo vacío (§ productoSpotlight — hide-on-empty)

  const activo = productoActivo;

  // LAS VISTAS DEL ESCENARIO — cada molienda DISPONIBLE del producto ACTIVO (imagen propia si la
  // declaró, § imagenDeMolienda; producto SIN moliendas → una sola vista con su portada). Con una
  // sola vista, las flechas no se muestran.
  const opcionesMolienda = moliendasDisponibles(activo.moliendasOpciones);
  const vistas = opcionesMolienda.length > 0
    ? opcionesMolienda.map((o) => ({
        key: o.nombre,
        imagen: imagenPortada(imagenDeMolienda(activo.moliendasOpciones, o.nombre, activo.imagen ?? '')),
        etiqueta: activo.peso_gramos != null ? `${o.nombre} · ${activo.peso_gramos} g` : o.nombre,
      }))
    : [{
        key: '__base__',
        imagen: imagenPortada(activo.imagen ?? ''),
        etiqueta: activo.peso_gramos != null ? `${activo.peso_gramos} g` : '',
      }];

  const indiceActual = Math.min(vistaIndex, vistas.length - 1);
  const vistaActual = vistas[indiceActual];

  const irAVista = (direccion: 1 | -1) => {
    const siguiente = (indiceActual + direccion + vistas.length) % vistas.length;
    setVistaIndex(siguiente);
    setMolienda(vistas[siguiente].key);
  };

  const elegirMolienda = (nombre: string) => {
    setMolienda(nombre);
    const idx = vistas.findIndex((v) => v.key === nombre);
    if (idx >= 0) setVistaIndex(idx);
  };

  // ELEGIR UN ALTERNO (Presentación/Tamaño) — switch COMPLETO: foto, precio, "Agregar al carrito" y
  // molienda pasan a ser los del producto elegido. `null` vuelve al principal.
  const elegirVariante = (slug: string | null) => {
    setActivoSlug(slug === producto.slug ? null : slug);
  };

  const handleAdd = () => {
    // Se comprueba con `moliendaAceptada`, LA MISMA función que decide en el servidor — igual que
    // el detalle de producto: la UI y el checkout no pueden discrepar sobre qué molienda es válida.
    if (!moliendaAceptada(activo.moliendasOpciones, molienda)) {
      toast.error("Selecciona una molienda disponible");
      return;
    }
    addItem(activo, 1, { ...(molienda ? { molienda } : {}) });
    toast.success(`${activo.nombre} agregado al carrito`);
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
              {/* EL MUESTRARIO (§ MUESTRARIO-VARIANTE-IMAGEN-1): `vistaActual` es la molienda
                  elegida del producto ACTIVO — Presentación/Tamaño ya no viven acá (switch
                  COMPLETO de producto, § el comentario de `vistas`, arriba). */}
              <Image
                src={vistaActual.imagen}
                alt={activo.nombre}
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
                  aria-label="Foto anterior"
                  className="w-11 h-11 sf-pildora sf-borde border-[var(--sf-linea)] flex items-center justify-center text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-[18px] h-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => irAVista(1)}
                  aria-label="Foto siguiente"
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
            <h3 className="text-[26px] leading-[1.14] font-playfair font-normal text-[var(--sf-sobre-banda,var(--sf-tinta))]">{activo.nombre}</h3>
            {/* `.muted` sobre el párrafo (index.html:182): color `text-muted`, tamaño heredado del
                body (`--text-body-m`=16px, `--leading-body`=1.5). */}
            <p className="text-base leading-[1.5] text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">{activo.descripcion}</p>

            {/* `.notes`/`.note-chip` (css/app.css:470-474, tokens.css:112,128,164): SIN encabezado
                propio (el prototipo no lleva un label "Notas de cata" sobre `.notes`, index.html:
                184-188) — chips sin relleno, sólo borde, 13px, color muted. Las "etiquetas" del
                panel (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) son ESTE mismo dato —
                `activo.notasCata`, del producto, nunca un texto separado que pudiera divergir. */}
            {(activo.notasCata?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {activo.notasCata!.map((n) => (
                  <span key={n} className="text-[13px] text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))] px-3 py-1.5 sf-pildora sf-borde border-[var(--sf-linea)]">{n}</span>
                ))}
              </div>
            )}

            {/* "Presentación" (index.html:189-194, css/app.css:476-490) — DOS mecanismos, nunca los
                dos a la vez: con `presentacionAlt` configurado, el grupo switchea el PRODUCTO
                ACTIVO entero (foto/precio/CTA/molienda, § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1,
                el tenant que modela molido/grano como productos distintos); SIN alterno, cae al
                mecanismo de SIEMPRE —las moliendas propias del producto activo— sin romper el caso
                de un producto con varias moliendas (Nayoli). El `.opt` PULSADO se pinta LLENO de
                acento (`aria-pressed=true`), no un 5% de tinte — la divergencia #1 de este slice. */}
            {presentacionAlt ? (
              <div>
                <span className="block mb-3 text-[12px] font-semibold tracking-[0.085em] uppercase text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">Presentación</span>
                <div className="flex flex-wrap gap-2">
                  {[producto, presentacionAlt].map((p) => {
                    const selected = activo.slug === p.slug;
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => elegirVariante(p.slug)}
                        aria-pressed={selected}
                        className={`px-[22px] py-[13px] sf-pildora sf-borde text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]'
                            : 'border-[var(--sf-linea)] hover:border-[var(--sf-acento)]'
                        }`}
                      >
                        <span className={`block text-sm font-medium ${selected ? 'text-[var(--sf-acento-txt)]' : 'text-[var(--sf-sobre-banda,var(--sf-tinta))]'}`}>
                          {etiquetaVarianteSpotlight(p)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (activo.moliendasOpciones?.length ?? 0) > 0 && (
              <div>
                <span className="block mb-3 text-[12px] font-semibold tracking-[0.085em] uppercase text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">Presentación</span>
                <div className="flex flex-wrap gap-2">
                  {activo.moliendasOpciones!.map((o) => {
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

            {/* "Tamaño" (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) — switch COMPLETO de producto,
                YA NO un enlace a la página de la otra talla (§ Backlog #62, que este slice sigue
                sin disparar: sólo DOS productos por eje, nunca una matriz completa). Sin
                `otroTamanoSlug` el control simplemente no aparece (preferir callar a un link roto).
                Mismo tratamiento de `.opt` que "Presentación". */}
            {tamanoAlt && (
              <div>
                <span className="block mb-3 text-[12px] font-semibold tracking-[0.085em] uppercase text-[var(--sf-sobre-banda-suave,var(--sf-texto-suave))]">Tamaño</span>
                <div className="flex flex-wrap gap-2">
                  {[producto, tamanoAlt].map((p) => {
                    const selected = activo.slug === p.slug;
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => elegirVariante(p.slug)}
                        aria-pressed={selected}
                        className={`px-[22px] py-[13px] sf-pildora sf-borde text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]'
                            : 'border-[var(--sf-linea)] hover:border-[var(--sf-acento)]'
                        }`}
                      >
                        <span className={`block text-sm font-medium ${selected ? 'text-[var(--sf-acento-txt)]' : 'text-[var(--sf-sobre-banda,var(--sf-tinta))]'}`}>
                          {etiquetaVarianteSpotlight(p)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* `.price-row` (css/app.css:491-503, tokens.css:103,111): precio en 32px (`--text-h2`),
                serif, peso regular (no bold); la nota "COP · impuestos incluidos" es COPY —
                `spotlight.notaPrecio`, opcional; vacío = no se muestra. */}
            <div className="flex items-baseline gap-3">
              <span className="text-[32px] font-playfair font-normal text-[var(--sf-sobre-banda,var(--sf-tinta))]">{formatCOP(activo.precio)}</span>
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
