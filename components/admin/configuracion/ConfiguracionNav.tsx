'use client';

import { PARTES_CONFIGURACION, type ParteConfiguracion } from '@/lib/admin/configuracion-partes';

// El nav de subsecciones de Configuración (§ `.admin-config-nav`, `app/(admin)/duna.css`):
// columna fija a la izquierda en escritorio, fila de pestañas desplazables en angosto —la misma
// clase hace las dos cosas por media query, no dos componentes—. La activa es "esto está puesto"
// (superficie + barra de tinta, § CLAUDE.md "Amber Minimal"): la MISMA afirmación que el activo
// del rail principal (`Sidebar.tsx`), en su propia escala.

export function ConfiguracionNav({ parteActiva, onSeleccionar }: {
  parteActiva:   ParteConfiguracion;
  onSeleccionar: (parte: ParteConfiguracion) => void;
}) {
  return (
    <nav className="admin-config-nav" aria-label="Subsecciones de Configuración">
      {PARTES_CONFIGURACION.map(p => (
        <button
          key={p.id}
          type="button"
          className={`admin-config-nav__item${p.id === parteActiva ? ' is-activo' : ''}`}
          aria-current={p.id === parteActiva ? 'page' : undefined}
          onClick={() => onSeleccionar(p.id)}
        >
          <span className="admin-config-nav__label">{p.label}</span>
          <span className="duna-sub">{p.bajada}</span>
        </button>
      ))}
    </nav>
  );
}
