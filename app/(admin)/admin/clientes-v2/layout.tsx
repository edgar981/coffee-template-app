import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tituloAdmin } from '@/lib/admin-titulo';

// El título de la pestaña. La página es 'use client' y un componente de cliente
// no puede exportar `metadata`, así que vive acá. El texto sale de `ADMIN_NAV`:
// la pestaña dice exactamente lo que dice el menú.
export const metadata: Metadata = { title: tituloAdmin('/admin/clientes-v2') };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
