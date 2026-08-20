"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { ADMIN_NAV, type AdminNavItem } from '@/constants/admin-nav';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useAtencion } from '@/hooks/useAtencion';
import { atencionDeRuta, type MapaAtencion } from '@/lib/atencion/registro';
import { authClient } from '@/lib/auth-client';

// ═══ LA NAVEGACIÓN CUANDO NO HAY RAIL ═══════════════════════════════════════
//
// Debajo del breakpoint del sistema el rail desaparece y ESTO lo reemplaza. No
// convive con él: un menú detrás de una hamburguesa y una barra siempre visible
// son dos respuestas a la misma pregunta, y tener las dos obliga al operador a
// aprender cuál usa cada pantalla. Por eso la hamburguesa y su drawer se borran
// en la misma tanda.
//
// ── LA LISTA SALE DE `ADMIN_NAV`, NO DE LA MAQUETA ──────────────────────────
//
// La maqueta dibuja ocho secciones en su sheet y CUATRO no existen (Tienda,
// WhatsApp, Sistema, Ajustes), mientras omite Entregas, que sí. Derivarlo de
// `ADMIN_NAV` —la misma fuente que ya consumen el rail y el ⌘K— es lo que hace
// que agregar una sección aparezca acá sin que nadie se acuerde. Una segunda
// lista es cómo una sección nueva queda invisible en el teléfono.
//
// El corte es POSICIONAL y no una marca en el registry: los primeros cuatro van
// a la barra y el resto al sheet. Una bandera `enLaBarra` sería un segundo lugar
// donde decidir el orden, y el orden ya lo dice el array — que es el mismo que
// el operador ve en el rail, así que las dos navegaciones no pueden contradecirse
// sobre qué es principal.
const EN_LA_BARRA = 4;

// El registro de secciones con atención vive en `lib/atencion/registro.ts`, que es
// el "un solo sitio" que el comentario de la constante vieja pedía: esta barra y
// el rail leen de ahí, así que no pueden discrepar sobre qué sección pide algo.

/** Activo = la ruta o una subruta suya. La barra final es lo que convierte la
 *  comparación en una de jerarquía y no de caracteres: sin ella, cualquier
 *  `/admin/<algo>-v2` encendería también `/admin/<algo>` (§ Sidebar, donde el
 *  caso que lo destapó está contado). */
const esActiva = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

function Slot({ item, activa, atencion }: { item: AdminNavItem; activa: boolean; atencion: boolean }) {
  const Icono = item.icon;
  return (
    <Link
      href={item.path}
      aria-current={activa ? 'page' : undefined}
      className={`duna-mobnav__item${activa ? ' is-on' : ''}`}
    >
      <Icono className="h-[21px] w-[21px]" strokeWidth={1.7} aria-hidden="true" />
      <span className="duna-mobnav__label">{item.label}</span>
      {/* La primitiva del sol, no un punto propio de la barra: el ámbar significa
          una sola cosa en todo el producto y dos definiciones es cómo dejan de
          coincidir. Y no tiene estado apagado — si no hay nada que atender, no se
          renderiza. */}
      {atencion && (
        <span className="duna-nav-dot" role="status" aria-label={`${item.label} necesita atención`} />
      )}
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [masAbierto, setMasAbierto] = useState(false);

  // UNA sola consulta para toda la navegación de esta superficie. El rail hace lo
  // mismo por el mismo motivo (§ Sidebar: con el rail colapsado hay dos
  // `SidebarNav` montados y serían dos pollers). Acá la barra y el sheet comparten
  // este valor en vez de preguntar cada uno.
  const atencion = useAtencion();

  const visibles = ADMIN_NAV.filter(i => !i.ownerOnly || session?.user?.role === 'OWNER');
  const enBarra  = visibles.slice(0, EN_LA_BARRA);
  const enSheet  = visibles.slice(EN_LA_BARRA);

  // "Más" se marca activo cuando la sección actual vive DENTRO del sheet. Sin
  // esto la barra no señalaría nada en la mitad de las pantallas del panel, y una
  // barra que a veces no marca nada se lee como rota.
  const masActivo = enSheet.some(i => esActiva(pathname, i.path));

  return (
    <>
      <nav className="duna-mobnav" aria-label="Navegación principal">
        {enBarra.map(item => (
          <Slot
            key={item.path}
            item={item}
            activa={esActiva(pathname, item.path)}
            atencion={atencionDeRuta(atencion, item.path)}
          />
        ))}
        <button
          type="button"
          onClick={() => setMasAbierto(true)}
          aria-expanded={masAbierto}
          className={`duna-mobnav__item${masActivo ? ' is-on' : ''}`}
        >
          <MoreHorizontal className="h-[21px] w-[21px]" strokeWidth={1.7} aria-hidden="true" />
          <span className="duna-mobnav__label">Más</span>
          {/* El sol SUBE al "Más" si la sección que lo pide quedó adentro. Un aviso
              que sólo se ve abriendo el sheet no avisa. Hoy Pedidos está en la
              barra, así que esta rama no se enciende — existe para que agregar una
              regla de atención a una sección del sheet no la deje muda. */}
          {enSheet.some(i => atencionDeRuta(atencion, i.path)) && (
            <span className="duna-nav-dot" role="status" aria-label="Hay secciones que necesitan atención" />
          )}
        </button>
      </nav>

      <DunaSheet
        abierto={masAbierto}
        onCerrar={() => setMasAbierto(false)}
        titulo="Todas las secciones"
        descripcion="El resto de las secciones del panel."
      >
        <div className="duna-title" style={{ marginBottom: 'var(--duna-space-3)' }}>Todas las secciones</div>

        <div className="duna-sheet__grid">
          {enSheet.map(item => {
            const Icono = item.icon;
            const activa = esActiva(pathname, item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMasAbierto(false)}
                aria-current={activa ? 'page' : undefined}
                className={`duna-sheet__item${activa ? ' is-on' : ''}`}
              >
                <Icono aria-hidden="true" />
                {item.label}
                {atencionDeRuta(atencion, item.path) && (
                  <span className="duna-nav-dot" role="status" aria-label={`${item.label} necesita atención`} />
                )}
              </Link>
            );
          })}
        </div>

        {/* NO va selector de tema acá: el dropdown de la topbar (`TopBar`) ya lo
            ofrece en móvil con los tres estados (Claro/Oscuro/Sistema), así que
            estos tres botones eran una SEGUNDA forma del mismo control —redundancia
            que además colapsaba en el ancho de un teléfono—. El de la topbar se
            queda: es el único camino de vuelta a `system` para quien pineó un
            override en ese navegador. Tampoco va bloque de usuario: la identidad
            ya vive en la topbar por debajo del breakpoint (`UserMenu`). */}
      </DunaSheet>
    </>
  );
}
