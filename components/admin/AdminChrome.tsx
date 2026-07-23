"use client";

import { useCallback, useEffect, useState } from "react";

import Sidebar from "@/components/admin/Sidebar";
import TopBar from "@/components/admin/TopBar";

interface AdminChromeProps {
  children: React.ReactNode;
}

// Interactive admin shell. Two independent pieces of state, because the sidebar
// behaves as two different things across the `lg` breakpoint:
//   • Desktop (≥ lg): an in-flow rail that pushes the content. `collapsed`
//     switches it between the 240px expanded and 72px collapsed widths.
//   • Mobile (< lg): an off-canvas overlay drawer. `mobileOpen` slides it in
//     over the content — the content keeps its full width (zero reflow).
// Conflating the two (a single `collapsed` flag) was the reflow bug: opening the
// menu on mobile reserved 240px of margin and squeezed the page to a sliver.
export default function AdminChrome({ children }: AdminChromeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = collapsed ? 72 : 240;

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Crossing up to desktop width must force the drawer shut — otherwise a drawer
  // left "open" would keep the body scroll lock engaged with no visible drawer.
  // lg = 1024px (Tailwind default, the admin's breakpoint everywhere).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) setMobileOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onClose={closeMobile}
      />

      <TopBar onMenuToggle={openMobile} sidebarWidth={sidebarWidth} />

      {/* The rail offset is applied only from `lg` up. On mobile the content
          always spans the full viewport; the drawer floats above it. */}
      <main
        className="min-h-screen pt-16 transition-[margin] duration-300 lg:ml-[var(--sb-w)]"
        style={{ "--sb-w": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <div className="animate-fade-in p-6">{children}</div>
      </main>
    </div>
  );
}
