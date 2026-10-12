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
// § EDITOR-PAGINAS-ONIX-ARREGLOS-1 — DOS arreglos del owner, que se CONSERVAN:
//
// 1. MIENTRAS CARGA NO SE PUEDE AFIRMAR "Oculto".** `visible` arranca en `null` (cargando) y
//    `const on = visible === true` colapsaba `null` a `false` — así que el control mostraba
//    "Oculto" (con el ojo tachado) durante el fetch, para una página que en realidad está
//    ENCENDIDA. Es un estado FALSO, no "todavía no sé": lo correcto es no afirmar nada hasta
//    tener el dato (§ CLAUDE.md, "preferir callar a afirmar sin base"). Mientras
//    `visible === null`, se muestra un placeholder NEUTRO ("Cargando…"), nunca el ícono/palabra
//    de oculto.
// 2. NO ES UNA BANDA PROPIA.** No monta su propia tarjeta — el llamador (`TiendaPaginas.tsx`) lo
//    ubica en un lugar discreto.
//
// § EDITOR-ESTADO-PAGINAS-1 (G6) — el lugar discreto DEJA DE SER la cabecera "Contenido": estaba
// comprimido ahí ("CONTENIDO · [ojo] Suscripciones en la tienda · Se muestra · … [?]"), apretado
// contra el rótulo de la lista y con la `nota` IMPRESA al lado en texto corto (`AyudaCampo` sin
// `soloIcono`, truncada a "Ej." cuando el hint era largo, § G8). Ahora vive en su PROPIA fila,
// arriba de la lista: la etiqueta es GENÉRICA («Página visible en la tienda» — la página ya está
// clara por contexto, es la que el selector de arriba tiene elegida), con una frase fija que dice
// que este interruptor es DISTINTO de los ojos de sección (publica al instante, no deja borrador),
// y la ayuda completa detrás del «?», nunca cortada al lado.
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
      // § EDITOR-ESTADO-PAGINAS-1 (G6) — "La página {label} está…", no "{label} encendida."
      // directo: concatenar el adjetivo con el label desacordaba en género/número según la página
      // ("Suscripciones encendida", "Nosotros apagada"). "La página" fija el sujeto en femenino
      // singular, así que el adjetivo concuerda SIEMPRE, sea cual sea `label`.
      toast.success(`La página ${label} está ${nuevo ? 'encendida' : 'apagada'}.`);
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
      {/* § EDITOR-ESTADO-PAGINAS-1 (G6) — etiqueta GENÉRICA: la página ya está clara por contexto
          (es la que el selector de arriba tiene elegida), así que no hace falta repetir "{label} en
          la tienda" acá — eso dejaba la fila más larga sin agregar información. `label` sigue
          viajando para el toast ("La página Nosotros está apagada."), que SÍ necesita decir cuál
          página cambió. */}
      <MostrarOcultar
        etiqueta="Página visible en la tienda"
        visible={estado === 'visible'}
        disabled={guardando}
        onCambiar={alternar}
      />
      {/* Distinto de los ojos de SECCIÓN (que dejan borrador, a publicar aparte): este interruptor
          escribe a lo publicado al toque, sin paso intermedio — el dueño necesita saberlo antes de
          tocarlo, no sólo leerlo detrás de un «?». */}
      <span className="duna-caption">Se aplica al instante.</span>
      {/* `soloIcono`: sin texto corto al lado (§ G8, la ayuda truncada a "Ej." que esto evita de
          raíz) — en esta fila compacta, la ayuda completa vive SÓLO detrás del «?». */}
      <AyudaCampo texto={nota} soloIcono />
    </div>
  );
}
