"use client";

import Image from "next/image";
import Link from "next/link";

import { motion, AnimatePresence } from "framer-motion";

import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { useCartStore } from "@/lib/cartStore";
import { formatCOP } from "@/lib/utils";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    subtotal,
  } = useCartStore();

  const shipping = subtotal > 150000 ? 0 : 8000;

  const total = subtotal + shipping;

  const totalItems = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e8ddd0] px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#8B4513]" />

                <h2 className="font-semibold text-[#1a0f08]">
                  Tu Carrito
                </h2>

                {items.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8B4513] text-xs text-white">
                    {totalItems}
                  </span>
                )}
              </div>

              <button
                onClick={closeCart}
                className="rounded-lg p-1.5 transition-colors hover:bg-[#f0e8de]"
              >
                <X className="h-5 w-5 text-[#5a3a28]" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0e8de]">
                    <ShoppingBag className="h-7 w-7 text-[#d4a97a]" />
                  </div>

                  <p className="mb-1 font-medium text-[#1a0f08]">
                    Tu carrito está vacío
                  </p>

                  <p className="mb-6 text-sm text-[#8B6650]">
                    Explora nuestros productos y agrega tu café favorito.
                  </p>

                  <button
                    onClick={closeCart}
                    className="text-sm font-medium text-[#8B4513] underline underline-offset-2 crusor-pointer"
                  >
                    Seguir comprando
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex gap-3"
                    >
                      {/* Image */}
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f0e8de]">
                        <Image
                          src={item.imagen ?? "/placeholder.png"}
                          alt={item.nombre}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-tight text-[#1a0f08]">
                          {item.nombre}
                        </p>

                        <p className="mt-0.5 text-xs text-[#8B6650]">
                          {formatCOP(item.precio)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex items-center gap-1 rounded-lg bg-[#f0e8de]">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.quantity - 1
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[#e8ddd0] cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <span className="w-6 text-center text-sm font-medium">
                              {item.quantity}
                            </span>

                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.quantity + 1
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[#e8ddd0] cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeItem(item.key)}
                            className="text-[#c0a080] transition-colors hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <p className="shrink-0 text-sm font-bold text-[#1a0f08]">
                        {formatCOP(
                          item.precio * item.quantity
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="space-y-3 border-t border-[#e8ddd0] px-5 py-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-[#5a3a28]">
                    <span>Subtotal</span>

                    <span>{formatCOP(subtotal)}</span>
                  </div>

                  <div className="flex justify-between text-[#5a3a28]">
                    <span>Envío</span>

                    <span
                      className={
                        shipping === 0
                          ? "font-medium text-emerald-600"
                          : ""
                      }
                    >
                      {shipping === 0
                        ? "Gratis"
                        : formatCOP(shipping)}
                    </span>
                  </div>

                  {shipping > 0 && (
                    <p className="text-xs text-[#8B6650]">
                      Envío gratis en pedidos mayores a
                      $150.000
                    </p>
                  )}

                  <div className="flex justify-between border-t border-[#e8ddd0] pt-1 text-base font-bold text-[#1a0f08]">
                    <span>Total</span>

                    <span>{formatCOP(total)}</span>
                  </div>
                </div>

                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a0f08] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2d1a0e]"
                >
                  Ir al Checkout

                  <ArrowRight className="h-4 w-4" />
                </Link>

                <button
                  onClick={closeCart}
                  className="w-full text-center text-sm text-[#8B6650] transition-colors hover:text-[#5a3a28] cursor-pointer"
                >
                  Seguir comprando
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}