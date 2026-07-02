import type { ReactNode } from "react";

import StoreNav from "@/components/storefront/layout/StoreNav";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import { CartProvider } from "@/lib/cartStore";

interface StorefrontLayoutProps {
  children: ReactNode;
}

export default function StorefrontLayout({
  children,
}: StorefrontLayoutProps) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#faf7f4] font-inter">
        <StoreNav />
        <main>{children}</main>
        <StoreFooter />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}