import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tituloAdmin } from '@/lib/admin-titulo';

// El título de la pestaña. Una página del admin es 'use client' y un componente
// de cliente NO puede exportar `metadata`, así que el título vive en este layout
// —cuatro líneas y nada más—, que sí corre en el servidor.
//
// El texto sale de `ADMIN_NAV` vía `tituloAdmin`: la pestaña dice exactamente lo
// que dice el menú, y renombrar la sección en un solo sitio las mueve las dos.
export const metadata: Metadata = { title: tituloAdmin('/admin/automatizaciones') };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
