import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tituloAdmin } from '@/lib/admin-titulo';

// El título de la pestaña sale de `ADMIN_NAV` vía `tituloAdmin` (una página del admin es
// 'use client' y no puede exportar `metadata`): la pestaña dice lo que dice el menú.
export const metadata: Metadata = { title: tituloAdmin('/admin/tienda') };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
