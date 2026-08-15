import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tituloAdmin } from '@/lib/admin-titulo';

// El título de la pestaña. Una página del admin es 'use client' y un componente
// de cliente NO puede exportar `metadata`, así que el título vive en este layout.
//
// Se pide por la ruta CANÓNICA de la sección (`/admin/productos`) y no por la de
// esta convivencia: `tituloAdmin` deriva de `ADMIN_NAV`, donde el sufijo `-v2` no
// existe —ni debe—, así que preguntar por la propia ruta devolvería `null` y la
// pestaña diría sólo "Panel Duna". La sección ES Productos independientemente de
// qué implementación la sirva, y al heredar la ruta esto no cambia una línea.
export const metadata: Metadata = { title: tituloAdmin('/admin/productos') };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
