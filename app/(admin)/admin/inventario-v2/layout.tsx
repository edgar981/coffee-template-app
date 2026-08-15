import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tituloAdmin } from '@/lib/admin-titulo';

// El título de la pestaña. Una página del admin es 'use client' y no puede exportar
// `metadata`, así que vive en este layout de servidor. El texto sale de la SECCIÓN
// —`/admin/inventario`—, no de la ruta de esta implementación (`-v2`): mientras el
// rediseño convive con la pantalla vieja, la pestaña dice "Inventario", que es lo
// que el operador ve en el menú. Mismo criterio que el registro de atención.
export const metadata: Metadata = { title: tituloAdmin('/admin/inventario') };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
