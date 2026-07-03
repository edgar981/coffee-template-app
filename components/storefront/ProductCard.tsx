"use client";

import Image from "next/image";
import Link from "next/link";

import { ShoppingBag, Star } from "lucide-react";

import { motion } from "framer-motion";

import { toast } from "sonner";

import { Product } from "@/types/product";

import { useCartStore } from "@/lib/cartStore";

import { formatCOP } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  /**
   * Responsive rendered width of the card image, matching the parent grid's
   * columns per breakpoint. Defaults to the standard product-grid shape
   * (2 / 3 / 4 columns). Override when the grid differs.
   */
  sizes?: string;
}

export default function ProductCard({
  product,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: ProductCardProps) {
  const { addItem } = useCartStore();

  const handleAdd = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();

    if (product.agotado || product.stock === 0) return;

    addItem(product, 1);

    toast.success(
      `${product.nombre} agregado al carrito`
    );
  };

  return (
    <Link
      href={`/tienda/${product.slug}`}
      className="group block"
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden rounded-2xl border border-[#e8ddd0] bg-white transition-all duration-300 hover:shadow-lg"
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-[#f0e8de]">
          <Image
            src={product.imagen}
            alt={product.nombre}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Badge */}
          {product.badge && (
            <div className="absolute top-3 left-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  product.agotado
                    ? "bg-gray-800/80 text-white"
                    : product.bestseller
                    ? "bg-[#8B4513] text-white"
                    : "bg-[#d4a97a] text-[#1a0f08]"
                }`}
              >
                {product.badge}
              </span>
            </div>
          )}

          {/* Add to cart */}
          {!product.agotado &&
            product.stock > 0 && (
              <button
                onClick={handleAdd}
                className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md opacity-0 transition-opacity hover:bg-[#8B4513] hover:text-white group-hover:opacity-100 cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
              </button>
            )}
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="mb-1 text-xs capitalize text-[#8B4513]">
            {product.origen ||
              product.categoria?.replace("_", " ")}
          </p>

          <h3 className="mb-2 line-clamp-2 text-sm leading-tight font-medium text-[#1a0f08]">
            {product.nombre}
          </h3>

          {/* Notes */}
          {product.notas && (
            <div className="mb-3 flex flex-wrap gap-1">
              {product.notas
                .slice(0, 2)
                .map((note) => (
                  <span
                    key={note}
                    className="rounded-full bg-[#f0e8de] px-2 py-0.5 text-[10px] text-[#5a3a28]"
                  >
                    {note}
                  </span>
                ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-[#1a0f08]">
                {formatCOP(product.precio)}
              </span>

              {product.esSuscripcion && (
                <span className="ml-1 text-xs text-[#8B4513]">
                  /mes
                </span>
              )}
            </div>

            {product.agotado ? (
              <span className="text-xs text-gray-400">
                Agotado
              </span>
            ) : (
              <div className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-[#d4a97a] text-[#d4a97a]" />

                <span className="text-xs text-[#5a3a28]">
                  4.9
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}