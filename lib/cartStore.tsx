"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

import { Product } from "@/types/product";

interface CartItem extends Product {
  quantity: number;
  options?: Record<string, string | boolean>;
  key: string;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;

  addItem: (
    product: Product,
    quantity?: number,
    options?: Record<string, string | boolean>
  ) => void;

  removeItem: (key: string) => void;

  updateQuantity: (key: string, quantity: number) => void;

  clearCart: () => void;

  openCart: () => void;

  closeCart: () => void;

  subtotal: number;

  count: number;
}

interface CartProviderProps {
  children: ReactNode;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback(
    (
      product: Product,
      quantity: number = 1,
      options: Record<string, string | boolean> = {}
    ) => {
      const key = `${product.id}-${JSON.stringify(options)}`;

      setItems((prev) => {
        const existing = prev.find((item) => item.key === key);

        if (existing) {
          return prev.map((item) =>
            item.key === key
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                }
              : item
          );
        }

        return [
          ...prev,
          {
            ...product,
            quantity,
            options,
            key,
          },
        ];
      });

      setIsOpen(true);
    },
    []
  );

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const updateQuantity = useCallback(
    (key: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(key);
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                quantity,
              }
            : item
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + item.precio * item.quantity,
    0
  );

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        subtotal,
        count,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartStore() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCartStore must be used within CartProvider");
  }

  return context;
}