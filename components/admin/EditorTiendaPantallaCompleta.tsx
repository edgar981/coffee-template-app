'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react';
import TiendaPaginas from '@/components/admin/TiendaPaginas';
import { PAGINAS, SECCIONES_TIENDA, type PaginaKey } from '@/components/admin/tienda-secciones';
import {
  ANCHOS_DISPOSITIVO,
  CLAVE_DISPOSITIVO_EDITOR,
  DISPOSITIVO_DEFECTO,
  dispositivoDesdeStorage,
  type DispositivoKey,
} from '@/lib/admin/editor-iframe';

// ─── EL EDITOR DE PANTALLA COMPLETA (§ EDITOR-TIENDA-DISPOSITIVOS-1) ───────────────────────────────
//
// Reemplaza el apilado "lista↔iframe dentro de /admin/tienda" por una vista PROPIA, a pantalla
// completa, sin el chrome del panel — el pedido textual del owner tras ver el editor viejo: *"Se ve
// bien sin embargo se ve como en la vista movil, aun no se siente como un editor inline"* y *"el
// editor abre en una nueva vista, no sale nada del panel de navegacion"* (referencia: el editor de
// temas de Shopify). La barra superior fina (volver al panel · página/tema · dispositivo) reemplaza
// al `role="tablist"` que antes vivía dentro de `TiendaPaginas` — ahora ese selector vive ACÁ, y
// `TiendaPaginas` lo recibe por prop (controlado), junto con el dispositivo elegido.
//
// LA PESTAÑA «TEMA» (§ EDITOR-TIENDA-TEMA-1) — ganada JUNTO a las de página, como el pedido del
// spec ("como «Configuración del tema» de Shopify"): es un MODO del editor, no una página — el
// `<iframe>` de `VistaTiendaIframe` sigue mostrando la MISMA `pagina` que ya estaba activa (el tema
// es store-wide, se ve en cualquier página), lo único que cambia es qué columna de la izquierda
// monta `TiendaPaginas` (la lista de secciones, o `PaletaSeccion` en modo `enEditor`). Por eso es un
// estado APARTE (`modo`), no un valor más de `PaginaKey`: `pagina` sigue siendo SIEMPRE una de las
// tres páginas reales —nunca 'tema'— para que el resto del árbol (el `<iframe key={pagina}>`, el
// deep-link, el dispositivo) no tenga que aprender un cuarto valor que no es una página de verdad.
//
// EL DEEP-LINK DEL AVISO DE CONFIGURACIÓN (§ El AVISO DE CONFIGURACIÓN del Dashboard, CLAUDE.md) —
// `?seccion=&tarjeta=` — se movió ACÁ desde `TiendaPaginas` (que antes lo leía con su propio
// `useSearchParams`): esta pantalla decide la página INICIAL (la de la sección del deep-link) y qué
// resaltar; `TiendaPaginas` sólo recibe el resultado ya resuelto. `lib/config/avisos-configuracion.ts`
// (fuera de `touches:` de este slice) sigue generando el link hacia `/admin/tienda?seccion=…`, que
// esa ruta —todavía viva como portada— reenvía para acá sin tocar ese archivo (§ `/admin/tienda/
// page.tsx`). Un deep-link siempre apunta a una SECCIÓN de página, nunca al tema, así que arranca
// siempre en `modo: 'paginas'`.
const DISPOSITIVOS: { key: DispositivoKey; label: string; Icon: typeof Monitor }[] = [
  { key: 'escritorio', label: 'Escritorio', Icon: Monitor },
  { key: 'tablet', label: 'Tablet', Icon: Tablet },
  { key: 'telefono', label: 'Teléfono', Icon: Smartphone },
];

type ModoEditor = 'paginas' | 'tema';

export default function EditorTiendaPantallaCompleta() {
  const params = useSearchParams();
  const seccionParam = params.get('seccion');
  const tarjetaNum = params.get('tarjeta') != null ? Number(params.get('tarjeta')) : NaN;
  const resaltar = seccionParam
    ? { seccion: seccionParam, slot: Number.isInteger(tarjetaNum) ? tarjetaNum : null }
    : null;
  const paginaObjetivo = seccionParam ? SECCIONES_TIENDA.find(c => c.seccion === seccionParam)?.pagina : undefined;
  const [pagina, setPagina] = useState<PaginaKey>(paginaObjetivo ?? 'home');
  const [modo, setModo] = useState<ModoEditor>('paginas');

  // EL DISPOSITIVO ELEGIDO, recordado por navegador (§ 4.3 de DISENO.md: "recordado por el
  // navegador del admin"). Arranca en el default (Escritorio) y se re-lee de `localStorage` tras
  // montar — nunca durante el render del servidor, que no tiene storage; leerlo en un efecto evita
  // el mismatch de hidratación que leerlo síncrono en el render inicial produciría.
  const [dispositivo, setDispositivoState] = useState<DispositivoKey>(DISPOSITIVO_DEFECTO);
  useEffect(() => {
    try {
      setDispositivoState(dispositivoDesdeStorage(localStorage.getItem(CLAVE_DISPOSITIVO_EDITOR)));
    } catch {
      // Modo privado / storage inaccesible: se queda en el default — nunca revienta por esto.
    }
  }, []);
  const elegirDispositivo = useCallback((d: DispositivoKey) => {
    setDispositivoState(d);
    try { localStorage.setItem(CLAVE_DISPOSITIVO_EDITOR, d); } catch { /* no-op, ver arriba */ }
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--duna-bg)', zIndex: 0 }}>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--duna-space-4)',
          flexWrap: 'wrap',
          padding: 'var(--duna-space-3) var(--duna-space-6)',
          borderBottom: '1px solid var(--duna-border)',
          background: 'var(--duna-surface)',
        }}
      >
        <Link href="/admin/tienda" className="duna-btn duna-btn--ghost duna-btn--sm" style={{ flexShrink: 0 }}>
          <ArrowLeft /> Volver al panel
        </Link>

        <div role="tablist" aria-label="Página y tema del storefront" style={{ display: 'flex', gap: 'var(--duna-space-2)' }}>
          {PAGINAS.map(p => (
            <button
              key={p.key}
              role="tab"
              aria-selected={modo === 'paginas' && p.key === pagina}
              onClick={() => { setPagina(p.key); setModo('paginas'); }}
              className={`duna-pill${modo === 'paginas' && p.key === pagina ? ' is-on' : ''}`}
            >
              {p.label}
            </button>
          ))}
          {/* § EDITOR-TIENDA-TEMA-1 — «Tema» junto a las páginas, no la propia página: elegirla no
              cambia qué `pagina` muestra el iframe (store-wide, se ve en cualquiera), sólo qué
              columna monta la lista de la izquierda (§ el comentario grande, arriba). */}
          <button
            role="tab"
            aria-selected={modo === 'tema'}
            onClick={() => setModo('tema')}
            className={`duna-pill${modo === 'tema' ? ' is-on' : ''}`}
          >
            Tema
          </button>
        </div>

        <div role="group" aria-label="Dispositivo" style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
          {DISPOSITIVOS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={dispositivo === key}
              title={`${label} · ${ANCHOS_DISPOSITIVO[key]}px`}
              onClick={() => elegirDispositivo(key)}
              className={`duna-pill${dispositivo === key ? ' is-on' : ''}`}
            >
              <Icon aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, padding: 'var(--duna-space-6)' }}>
        <TiendaPaginas pagina={pagina} resaltar={resaltar} dispositivo={dispositivo} modo={modo} />
      </div>
    </div>
  );
}
