"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import Image from "next/image";

import {
  Search,
  X,
  ArrowRight,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import { DEMO_PRODUCTS } from "@/lib/mock/products";

import { formatCOP } from "@/lib/utils";

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

  const inputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
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

    return DEMO_PRODUCTS.filter(
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
  }, [query]);

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
            className="absolute left-0 top-full z-50 w-full border-t border-[#e8ddd0] bg-white shadow-2xl"
          >
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
              {/* Search Input */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a07050]" />

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
                  className="w-full rounded-2xl border border-[#e8ddd0] bg-[#faf7f4] py-4 pl-12 pr-14 text-sm text-[#1a0f08] outline-none transition-all focus:border-[#8B4513] focus:ring-4 focus:ring-[#8B4513]/10"
                />

                <button
                  onClick={onClose}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B6650] transition-colors hover:text-[#1a0f08]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Empty State */}
              {!query.trim() && (
                <div className="py-10 text-center">
                  <p className="mb-2 text-sm text-[#8B6650]">
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
                        className="rounded-full bg-[#f0e8de] px-4 py-2 text-xs font-medium text-[#5a3a28] transition-colors hover:bg-[#e4d3c0]"
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
                            className="group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-[#faf7f4]"
                          >
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f0e8de]">
                              <Image
                                src={
                                  product.imagen ?? "/placeholder.png"
                                }
                                alt={
                                  product.nombre
                                }
                                fill
                                sizes="80px"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="mb-1 text-xs capitalize tracking-wide text-[#8B4513]">
                                {product.categoria.replace(
                                  "_",
                                  " "
                                )}
                              </p>

                              <h3 className="truncate font-medium text-[#1a0f08]">
                                {
                                  product.nombre
                                }
                              </h3>

                              <p className="mt-1 text-sm font-semibold text-[#5a3a28]">
                                {formatCOP(
                                  product.precio
                                )}
                              </p>
                            </div>

                            <ArrowRight className="h-4 w-4 text-[#8B6650] transition-transform group-hover:translate-x-1" />
                          </Link>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-sm text-[#8B6650]">
                        No encontramos
                        resultados para{" "}
                        <span className="font-medium text-[#1a0f08]">
                          "{query}"
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