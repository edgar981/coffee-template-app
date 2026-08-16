import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tituloAdmin } from '@/lib/admin-titulo';

// El título de la pestaña. Una página del admin es 'use client' y no puede exportar
// `metadata`, así que vive en este layout de servidor. El texto se DERIVA de
// `ADMIN_NAV` vía `tituloAdmin`: la pestaña dice exactamente lo que dice el menú,
// y renombrar la sección en un solo sitio las mueve las dos.
export const metadata: Metadata = { title: tituloAdmin('/admin/inventario') };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
