'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { MostrarOcultar } from '@/components/admin/editor/MostrarOcultar';

// El toggle de ENCENDER/APAGAR una página del storefront (`content.paginas[pagina].visible`). Va
// DIRECTO a lo publicado —no por el flujo borrador/publicar de secciones—: encender o apagar una
// página es un toggle de config, no contenido en revisión. Apagada, la ruta redirige a la home
// (§ /nosotros). Escritura optimista con reversión al fallar.
export default function TogglePagina({ pagina, label }: { pagina: string; label: string }) {
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

  const on = visible === true;
  return (
    <div className="duna-card duna-card__pad" style={{ marginBottom: 'var(--duna-space-5)' }}>
      {/* Sin hint: el operador apaga y ve el resultado (nav + storefront). El toast confirma la
          acción. Mismo criterio que el toggle de sección. */}
      <MostrarOcultar
        etiqueta={`${label} en la tienda`}
        visible={on}
        disabled={visible === null || guardando}
        onCambiar={alternar}
      />
    </div>
  );
}
