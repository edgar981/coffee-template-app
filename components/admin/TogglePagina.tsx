'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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
      toast.success(nuevo
        ? `${label} encendida — visible en la tienda.`
        : `${label} apagada — oculta; quien tenga el enlace va a la home.`);
    } catch {
      setVisible(!nuevo); // revertir
      toast.error('No se pudo cambiar la visibilidad de la página.');
    } finally {
      setGuardando(false);
    }
  };

  const on = visible === true;
  return (
    <div className="duna-card duna-card__pad" style={{ marginBottom: 'var(--duna-space-5)', display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', flexWrap: 'wrap' }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Mostrar la página ${label} en la tienda`}
        disabled={visible === null || guardando}
        onClick={alternar}
        className={`duna-switch${on ? ' is-on' : ''}`}
      >
        <span className="duna-switch__thumb" />
      </button>
      <div style={{ minWidth: 0 }}>
        <span className="duna-field__label" style={{ margin: 0 }}>Mostrar la página en la tienda</span>
        <p className="duna-field__hint" style={{ marginTop: '2px' }}>
          {visible === null ? 'Cargando…'
            : on ? 'Encendida: visible y enlazada en el nav.'
            : 'Apagada: oculta del nav, y quien tenga el enlace va a la home.'}
        </p>
      </div>
    </div>
  );
}
