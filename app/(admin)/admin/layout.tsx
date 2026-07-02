"use client";

import { useState } from "react";

import Sidebar from "@/components/admin/Sidebar";
import TopBar from "@/components/admin/TopBar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] =
    useState(false);

  const sidebarWidth = collapsed
    ? 72
    : 240;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed} onToggle={() =>
          setCollapsed((prev) => !prev)
        }
      />

      <TopBar onMenuToggle={() =>
          setCollapsed((prev) => !prev)
        }
        sidebarWidth={sidebarWidth}
      />

      <main
        className="min-h-screen pt-16 transition-all duration-300"
        style={{
          marginLeft: sidebarWidth,
        }}
      >
        <div className="animate-fade-in p-6">
          {children}
        </div>
      </main>
    </div>
  );
}