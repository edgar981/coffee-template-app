"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import Image from "next/image";
import { imagenPortada } from "@/lib/producto-imagen";

import {
  Search,
  X,
  ArrowRight,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { categoriasDelCatalogo } from "@/lib/productos/categorias";
import { buscarProductos } from "@/lib/productos/buscar";
import { esClickAfuera } from "@/lib/cierre-afuera";

import { formatCOP } from "@duna/core/utils";

interface NavSearchProps {
  isOpen: boolean;

  onClose: () => void;

  // El botón que abre el panel (§ NAV-CIERRE-CLICK-AFUERA-1): vive en `StoreNav.tsx`, fuera de
  // este componente, así que llega por ref — sin ella, el click-afuera lo trataría como "afuera"
  // y tocar el disparador cerraría el panel Y lo reabriría en el mismo gesto (su propio `onClick`
  // sigue llamando `setSearchOpen(true)`).
  triggerRef?: React.RefObject<HTMLButtonElement | null>;

  // La clase del ícono de lupa DEL INPUT — § CORTE-CUERPO-LETRA-E-ICONOS-1. `StoreNav.tsx` ya
  // calcula `navIconoClase` (gateado por `navTratamiento.posicion`, § su propio docstring) para el
  // ícono del disparador; este panel es "su versión en el buscador" que el spec pide llevar al
  // mismo tamaño/trazo — así que la recibe por PROP en vez de leer `useSiteContent()` de nuevo (este
  // componente no lo importa hoy, y una segunda lectura del mismo dato es cómo dos copias
  // divergen). AUSENTE = `w-5 h-5` (el default de la prop, byte-idéntico a hoy).
  iconoClase?: string;
}

export default function NavSearch({
  isOpen,
  onClose,
  triggerRef,
  iconoClase = 'w-5 h-5',
}: NavSearchProps) {
  const [query, setQuery] =
    useState("");

  // Fuente única: catálogo público desde la DB. Se carga al abrir el buscador
  // por primera vez (la petición está memoizada en lib/api).
  const [catalog, setCatalog] = useState<Product[]>([]);

  const inputRef =
    useRef<HTMLInputElement>(null);
  // EL PANEL (§ NAV-CIERRE-CLICK-AFUERA-1): el nodo "adentro" para el click-afuera — envuelve el
  // input, los resultados y el botón "X" propios.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      getCatalog().then(setCatalog).catch(() => setCatalog([]));
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // CIERRA Y DEVUELVE EL FOCO al disparador — la mitad de accesibilidad que Escape y el
  // click-afuera comparten (§ NAV-CIERRE-CLICK-AFUERA-1, el spec de este slice): un panel que se
  // abrió desde un botón debe devolver el foco a ESE botón al cerrarse, no dejarlo flotando en un
  // nodo que puede haber salido del árbol.
  //
  // EL `.focus()` VA DIFERIDO A UN MACROTASK, MEDIDO: cuando el cierre lo dispara un
  // `pointerdown` de click-afuera, el propio navegador aplica DESPUÉS de correr los listeners su
  // paso por defecto de "enfocar el elemento clicado o, si no es enfocable, devolver el foco a
  // `<body>`" — y ese paso corre TRAS nuestro handler, así que un `.focus()` síncrono acá queda
  // pisado (confirmado con Playwright: `document.activeElement` terminaba en `<body>`). Un
  // `setTimeout(0)` corre en un macrotask posterior, después de que el navegador ya resolvió su
  // propio foco por defecto, y gana la carrera sin recurrir a `preventDefault()` — que en touch
  // suprimiría el `click` sintetizado del elemento de abajo (el mismo que el click-afuera de
  // abajo deja pasar a propósito).
  const cerrarYDevolverFoco = useCallback(() => {
    onClose();
    setTimeout(() => triggerRef?.current?.focus(), 0);
  }, [onClose, triggerRef]);

  useEffect(() => {
    const handleEsc = (
      e: KeyboardEvent
    ) => {
      if (e.key === "Escape") {
        cerrarYDevolverFoco();
      }
    };

    window.addEventListener(
      "keydown",
      handleEsc
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEsc
      );
    };
  }, [cerrarYDevolverFoco]);

  // EL CLICK-AFUERA (§ NAV-CIERRE-CLICK-AFUERA-1) — MEDIDO: el fondo `fixed inset-0` de abajo
  // (con su propio `onClick`, retirado en esta tanda) dejaba de cubrir el viewport en cuanto el
  // encabezado entraba a su estado "sólido" (`backdrop-blur`), porque un ancestro con
  // `backdrop-filter` se vuelve el containing block de sus descendientes `fixed` — el fondo se
  // confinaba a los ~72px del encabezado, no a los 900px del viewport. Un `pointerdown` en
  // CAPTURA sobre `document` no depende de dónde pintó nada: decide por CONTENCIÓN DE ÁRBOL
  // (`esClickAfuera`, `lib/cierre-afuera.ts`), inmune a `backdrop-filter`/`transform`/escala. NO
  // se llama `stopPropagation`: un click afuera cierra el panel y el elemento debajo sigue
  // recibiendo su propio click con normalidad (el mismo trato que ya dan los overlays de Radix
  // que este repo usa en el admin).
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (esClickAfuera(e.target, [panelRef.current, triggerRef?.current ?? null])) {
        cerrarYDevolverFoco();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, cerrarYDevolverFoco, triggerRef]);

  // El predicado de coincidencia vive en lib/productos/buscar.ts (afirmable en un test);
  // el tope de 6 es de PRESENTACIÓN (cuántas tarjetas caben en el panel), no de coincidencia,
  // y se queda acá.
  const filteredProducts = useMemo(
    () => buscarProductos(catalog, query).slice(0, 6),
    [catalog, query]
  );

  // Sugerencias del estado vacío: DERIVADAS del catálogo, no literales horneados —
  // el mismo helper que alimenta las pestañas de /tienda (§ La taxonomía se DERIVA
  // del catálogo). Un chip derivado ES una categoría que existe, así que no puede
  // ofrecer una búsqueda sin resultados.
  const categoriasSugeridas = useMemo(
    () => categoriasDelCatalogo(catalog),
    [catalog]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — SÓLO visual (§ NAV-CIERRE-CLICK-AFUERA-1): el `onClick` que tenía se
              retiró porque demostró ser el mecanismo que falla (se confina al alto del
              encabezado bajo `backdrop-filter`, § el docstring de `lib/cierre-afuera.ts`). El
              cierre real vive en el listener de `document` de arriba; este div sigue dimeando/
              blureando, cero cambio de píxeles. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          />

          {/* Search Panel */}
          <motion.div
            ref={panelRef}
            initial={{
              opacity: 0,
              y: -24,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -24,
            }}
            transition={{
              duration: 0.2,
            }}
            className="absolute left-0 top-full z-50 w-full sf-divisor-t border-[var(--sf-linea)] bg-[var(--sf-tarjeta)] shadow-2xl"
          >
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
              {/* Search Input */}
              <div className="relative mb-6">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sf-tostado-3)] ${iconoClase}`} />

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) =>
                    setQuery(
                      e.target.value
                    )
                  }
                  placeholder="Buscar café, origen, categoría..."
                  className="w-full rounded-2xl sf-borde border-[var(--sf-linea)] bg-[var(--sf-fondo)] py-4 pl-12 pr-14 text-sm text-[var(--sf-tinta)] outline-none transition-all focus:border-[var(--sf-acento)] focus:ring-4 focus:ring-[var(--sf-acento)]/10"
                />

                <button
                  onClick={cerrarYDevolverFoco}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--sf-texto-suave)] transition-colors hover:text-[var(--sf-tinta)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Empty State */}
              {!query.trim() && (
                <div className="py-10 text-center">
                  <p className="mb-2 text-sm text-[var(--sf-texto-suave)]">
                    Busca productos,
                    categorías o cafés
                    de origen.
                  </p>

                  {categoriasSugeridas.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {categoriasSugeridas.map((term) => (
                        <button
                          key={term}
                          onClick={() =>
                            setQuery(term)
                          }
                          // PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1
                          className="sf-pildora bg-[var(--sf-superficie)] px-4 py-2 text-xs font-medium text-[var(--sf-sobre-superficie,var(--sf-texto))] transition-colors hover:bg-[var(--sf-superficie-2)]"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {query.trim() && (
                <>
                  {filteredProducts.length >
                  0 ? (
                    <div className="space-y-2">
                      {filteredProducts.map(
                        (product) => (
                          <Link
                            key={product.id}
                            href={`/tienda/${product.slug}`}
                            onClick={
                              onClose
                            }
                            className="group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-[var(--sf-fondo)]"
                          >
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--sf-superficie)]">
                              <Image
                                src={imagenPortada(product.imagen)}
                                alt={
                                  product.nombre
                                }
                                fill
                                sizes="80px"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="mb-1 text-xs capitalize tracking-wide text-[var(--sf-acento-texto)]">
                                {product.categoria.replace(
                                  "_",
                                  " "
                                )}
                              </p>

                              <h3 className="truncate font-medium text-[var(--sf-tinta)]">
                                {
                                  product.nombre
                                }
                              </h3>

                              <p className="mt-1 text-sm font-semibold text-[var(--sf-texto)]">
                                {formatCOP(
                                  product.precio
                                )}
                              </p>
                            </div>

                            <ArrowRight className="h-4 w-4 text-[var(--sf-texto-suave)] transition-transform group-hover:translate-x-1" />
                          </Link>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-sm text-[var(--sf-texto-suave)]">
                        No encontramos
                        resultados para{" "}
                        <span className="font-medium text-[var(--sf-tinta)]">
                          &quot;{query}&quot;
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}