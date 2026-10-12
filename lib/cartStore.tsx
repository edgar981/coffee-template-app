"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

import { Product } from "@/types/product";
import {
  guardarCarrito,
  restaurarCarrito,
  limpiarCarritoPersistido,
  type ItemCarritoPersistible,
} from "@/lib/checkout/carrito-persistente";

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

  // CHECKOUT-LISTO-PARA-VENDER-1 — el departamento de envío, elegido desde el SELECTOR del
  // cajón del carrito (§ `CartDrawer.tsx`, «Envío a [departamento]»): vive acá, y no sólo en el
  // formulario del checkout, para que el checkout pueda ARRANCAR con el que el comprador ya
  // eligió en el cajón, en vez de volver a preguntarlo. Persiste junto con `items` — ver el
  // `useEffect` de persistencia, abajo.
  departamento: string | null;

  setDepartamento: (departamento: string | null) => void;
}

interface CartProviderProps {
  children: ReactNode;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  const [isOpen, setIsOpen] = useState(false);

  const [departamento, setDepartamento] = useState<string | null>(null);

  // CHECKOUT-LISTO-PARA-VENDER-1 — EL CARRITO SOBREVIVE A UNA RECARGA (§ el spec del slice,
  // § `paginas-pendientes.md` §2.1: "El carrito no sobrevive una recarga" — un comprador que
  // sale a su banco o a Nequi y vuelve, o que recarga por mala señal, perdía el pedido). La
  // restauración corre DESPUÉS del montaje (nunca en el `useState` inicial): así el primer
  // render —el que el server también produce— sigue siendo `[]`/`null`, y no hay mismatch de
  // hidratación entre servidor y cliente; el comprador ve el carrito "aparecer" en el mismo
  // tick, antes de que pueda interactuar con nada.
  //
  // `restaurado` es ESTADO (no un ref): el efecto de PERSISTENCIA de abajo tiene que esperar a
  // que el RE-RENDER disparado por esta restauración ya haya ocurrido antes de poder escribir
  // — si usara un ref, el efecto de persistencia de este MISMO ciclo de efectos vería `items`
  // todavía en `[]` (los `setState` de abajo no se reflejan hasta el próximo render) y
  // sobreescribiría el storage con un carrito vacío un instante antes de corregirlo.
  const [restaurado, setRestaurado] = useState(false);

  useEffect(() => {
    const r = restaurarCarrito();
    if (r.items.length > 0) setItems(r.items as unknown as CartItem[]);
    if (r.departamento) setDepartamento(r.departamento);
    setRestaurado(true);
  }, []);

  // La mitad que GUARDA — recién habilitada tras la restauración (ver arriba). Persiste en
  // cada cambio de `items`/`departamento`; nunca lanza (`guardarCarrito` es tolerante a que no
  // haya storage).
  useEffect(() => {
    if (!restaurado) return;
    guardarCarrito(items as unknown as ItemCarritoPersistible[], departamento);
  }, [items, departamento, restaurado]);

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

  // Se vacía al confirmar el pedido (§ el spec del slice): el pedido ya se creó, así que un
  // comprador que vuelve a `/tienda` no debe recibir de regreso un carrito que ya compró.
  // `limpiarCarritoPersistido()` es inmediata (no espera al próximo ciclo del efecto de
  // persistencia); el `setItems([])` de abajo deja además que ese mismo efecto lo confirme.
  const clearCart = useCallback(() => {
    setItems([]);
    limpiarCarritoPersistido();
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
        departamento,
        setDepartamento,
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