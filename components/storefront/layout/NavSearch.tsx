"use client";

import {
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

import { formatCOP } from "@duna/core/utils";

interface NavSearchProps {
  isOpen: boolean;

  onClose: () => void;
}

export default function NavSearch({
  isOpen,
  onClose,
}: NavSearchProps) {
  const [query, setQuery] =
    useState("");

  // Fuente única: catálogo público desde la DB. Se carga al abrir el buscador
  // por primera vez (la petición está memoizada en lib/api).
  const [catalog, setCatalog] = useState<Product[]>([]);

  const inputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getCatalog().then(setCatalog).catch(() => setCatalog([]));
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (
      e: KeyboardEvent
    ) => {
      if (e.key === "Escape") {
        onClose();
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
  }, [onClose]);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return [];

    return catalog.filter(
      (product) =>
        product.nombre
          .toLowerCase()
          .includes(
            query.toLowerCase()
          ) ||
        product.categoria
          .toLowerCase()
          .includes(
            query.toLowerCase()
          ) ||
        product.origen
          ?.toLowerCase()
          .includes(
            query.toLowerCase()
          )
    ).slice(0, 6);
  }, [catalog, query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          />

          {/* Search Panel */}
          <motion.div
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
            className="absolute left-0 top-full z-50 w-full border-t border-[var(--sf-linea)] bg-white shadow-2xl"
          >
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
              {/* Search Input */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--sf-tostado-3)]" />

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
                  className="w-full rounded-2xl border border-[var(--sf-linea)] bg-[var(--sf-fondo)] py-4 pl-12 pr-14 text-sm text-[var(--sf-tinta)] outline-none transition-all focus:border-[var(--sf-acento)] focus:ring-4 focus:ring-[var(--sf-acento)]/10"
                />

                <button
                  onClick={onClose}
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

                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "Cold Brew",
                      "Café Molido",
                      "Geisha",
                      "Suscripciones",
                    ].map((term) => (
                      <button
                        key={term}
                        onClick={() =>
                          setQuery(term)
                        }
                        className="rounded-full bg-[var(--sf-superficie)] px-4 py-2 text-xs font-medium text-[var(--sf-texto)] transition-colors hover:bg-[var(--sf-superficie-2)]"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
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