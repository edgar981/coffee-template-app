'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { MostrarOcultar } from '@/components/admin/editor/MostrarOcultar';
import { AyudaCampo } from '@/components/admin/editor/AyudaCampo';
import { estadoVisibilidadPagina } from '@/lib/admin/editor-paginas-onix';

// El toggle de ENCENDER/APAGAR una página del storefront (`content.paginas[pagina].visible`). Va
// DIRECTO a lo publicado —no por el flujo borrador/publicar de secciones—: encender o apagar una
// página es un toggle de config, no contenido en revisión. Apagada, la ruta redirige a la home
// (§ /nosotros). Escritura optimista con reversión al fallar.
//
// § EDITOR-PAGINAS-ONIX-ARREGLOS-1 — DOS arreglos del owner:
//
// 1. MIENTRAS CARGA NO SE PUEDE AFIRMAR "Oculto".** `visible` arranca en `null` (cargando) y
//    `const on = visible === true` colapsaba `null` a `false` — así que el control mostraba
//    "Oculto" (con el ojo tachado) durante el fetch, para una página que en realidad está
//    ENCENDIDA. Es un estado FALSO, no "todavía no sé": lo correcto es no afirmar nada hasta
//    tener el dato (§ CLAUDE.md, "preferir callar a afirmar sin base"). Ahora, mientras
//    `visible === null`, se muestra un placeholder NEUTRO ("Cargando…"), nunca el ícono/palabra
//    de oculto.
// 2. YA NO ES UNA BANDA PROPIA.** Vivía en su propio `.duna-card` arriba de la lista de
//    secciones — "una barra innecesaria" para el owner. El componente ya no monta esa tarjeta:
//    el llamador (`TiendaPaginas.tsx`) lo ubica en un lugar discreto (la cabecera "Contenido" de
//    la lista de secciones de esa página), con el MISMO comportamiento (optimista, reversión al
//    fallar, mismo toast).
//
// `nota` (antes un párrafo aparte debajo de la tarjeta, sólo en Suscripciones: explica las SEIS
// superficies que el interruptor gobierna) se muestra ahora con `AyudaCampo` — el mismo patrón
// "corta + «?» con el texto completo" que ya usa cada campo del editor, no una banda de texto
// propia que compita por espacio en la cabecera.
export default function TogglePagina({ pagina, label, nota }: { pagina: string; label: string; nota?: string }) {
  const [visible, setVisible] = useState<boolean | null>(null); // null = cargando
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/api/site-content')
      .then(r => r.json())
      .then(d => { if (vivo) setVisible(d?.contenido?.paginas?.[pagina]?.visible ?? true); })
      .catch(() => { if (vivo) setVisible(true); });
    return () => { vivo = false; };
  }, [pagina]);

  const alternar = async () => {
    if (visible === null || guardando) return;
    const nuevo = !visible;
    setGuardando(true);
    setVisible(nuevo); // optimista
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'setPaginaVisible', pagina, visible: nuevo }),
      });
      if (!res.ok) throw new Error();
      toast.success(nuevo ? `${label} encendida.` : `${label} apagada.`);
    } catch {
      setVisible(!nuevo); // revertir
      toast.error('No se pudo cambiar la visibilidad de la página.');
    } finally {
      setGuardando(false);
    }
  };

  const estado = estadoVisibilidadPagina(visible);
  if (estado === 'cargando') {
    // Mismo alto/afordancia que el control real (el ícono eye ocupa 16px + el gap de `.editor-mostrar`),
    // para que el header no salte de tamaño cuando el fetch resuelve.
    return <span className="duna-caption" style={{ display: 'inline-flex', alignItems: 'center', height: '20px' }}>Cargando…</span>;
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
      {/* Sin hint propio: el operador apaga y ve el resultado (nav + storefront). El toast confirma
          la acción. Mismo criterio que el toggle de sección. */}
      <MostrarOcultar
        etiqueta={`${label} en la tienda`}
        visible={estado === 'visible'}
        disabled={guardando}
        onCambiar={alternar}
      />
      <AyudaCampo texto={nota} />
    </div>
  );
}
