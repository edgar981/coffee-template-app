import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { EscalaDesktop } from '@/components/admin/EscalaDesktop';
import { PRESETS } from '@/lib/config/themes';
import { PARES_FUENTES } from '@/lib/config/fuentes';
import type { PaginasContent, TemaContent } from '@/lib/config/site-content-defaults';

// ─── La PORTADA de Tienda (§ PANEL-ESTRUCTURA-TIENDA-1, REDISENO.md § 3: "Perfil y Tienda") ──────
//
// Reemplaza a los cuatro formularios que vivían en `/admin/tienda` (§ el page.tsx de esta ruta):
// una portada con la tienda en miniatura, el acceso al editor, y tres datos de estado. Lo que sólo
// vivía acá (Detalles del sitio) se mudó al editor como una fila más (§ DetallesSitioSeccion.tsx);
// Menú/Encabezado/Pie YA vivían ahí.
//
// SERVER COMPONENT a propósito: `page.tsx` ya resuelve `nombre`/`paginas`/`tema`/`sinPublicarCount`
// con un `readSiteContentParaEditor()` (server, sin API route de por medio) y los pasa por props —
// no hace falta un segundo fetch client-side para una pantalla de sólo lectura. El único hijo
// `'use client'` es `EscalaDesktop` (mide con ResizeObserver), que un Server Component puede montar
// sin problema.
export default function TiendaPortada({
  nombre, paginas, tema, sinPublicarCount,
}: {
  nombre: string;
  paginas: PaginasContent;
  tema: TemaContent;
  sinPublicarCount: number;
}) {
  const estilo = estiloActivo(tema);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-6)' }}>
        <div style={{ minWidth: 0 }}>
          <p className="duna-eyebrow" style={{ margin: 0 }}>Tu tienda</p>
          <h1 className="duna-display-m" style={{ marginTop: 'var(--duna-space-hairline)' }}>{nombre}, en línea</h1>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '38rem' }}>
            Todo lo que ve tu cliente se edita en un solo lugar, sobre la tienda real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0, flexWrap: 'wrap' }}>
          <a href="/" target="_blank" rel="noreferrer" className="duna-btn duna-btn--ghost">
            Ver tienda <ExternalLink aria-hidden />
          </a>
          <Link href="/editor/tienda" className="duna-btn duna-btn--primary">
            Abrir el editor <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>

      {/* LA MINIATURA — la home REAL, en un iframe del mismo origen, escalada con `EscalaDesktop`
          (§ su docstring: mide ancho de pane + alto de contenido, reusable por cualquier children).
          `pointer-events: none` en el iframe es lo que la hace NO NAVEGABLE — más simple y más
          seguro que neutralizar enlaces uno por uno: un iframe no comparte árbol de React con el
          admin, así que la técnica de `EscalaDesktop` para `<a>`/`<Link>` (interceptar el click)
          no aplica; esto corta la interacción en la CAPA DE EVENTOS, antes de que el documento del
          iframe pueda reaccionar. El `style` que este componente pasa GANA sobre el alto que
          `EscalaDesktop` calcularía solo (grande: `contenidoH * scale`) — es lo que recorta la
          vista a una franja fija (el "crop" que muestra el prototipo, no un thumbnail completo
          encogido) en vez de dejar toda la home escalada y con letterbox. */}
      <EscalaDesktop className="duna-card" style={{ height: 220, overflow: 'hidden' }}>
        <iframe
          src="/"
          title={`Vista previa de ${nombre}`}
          aria-hidden
          tabIndex={-1}
          style={{ width: 1280, height: 800, border: 0, display: 'block', pointerEvents: 'none' }}
        />
      </EscalaDesktop>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--duna-space-4)', marginTop: 'var(--duna-space-4)' }}>
        <div className="duna-card duna-card__pad">
          <p className="duna-eyebrow" style={{ margin: 0 }}>Páginas</p>
          <p className="duna-body" style={{ fontWeight: 'var(--duna-w-semi)', marginTop: 'var(--duna-space-1)' }}>
            {paginasEncendidas(paginas)}
          </p>
          <p className="duna-caption" style={{ marginTop: 'var(--duna-space-1)' }}>Se editan tocándolas</p>
        </div>

        <div className="duna-card duna-card__pad">
          <p className="duna-eyebrow" style={{ margin: 0 }}>Estilo</p>
          <p className="duna-body" style={{ fontWeight: 'var(--duna-w-semi)', marginTop: 'var(--duna-space-1)' }}>
            {estilo.nombre}
          </p>
          <p className="duna-caption" style={{ marginTop: 'var(--duna-space-1)' }}>{estilo.parLetras}</p>
        </div>

        <div className="duna-card duna-card__pad">
          <p className="duna-eyebrow" style={{ margin: 0 }}>Sin publicar</p>
          {/* EL ÁMBAR ES SÓLO PARA EL HECHO ("hay algo sin publicar"), no decoración —mismo punto
              `.duna-nav-dot` que la campana y el rail usan para lo mismo. SIN hora del borrador
              («Desde…»): no hay ese dato — `SiteContent` no guarda CUÁNDO cambió cada sección,
              sólo QUÉ secciones difieren del publicado (§ el spec de este slice: "si no hay hora
              del borrador como dato, sin «Desde…»"). */}
          <p className="duna-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', fontWeight: 'var(--duna-w-semi)', marginTop: 'var(--duna-space-1)' }}>
            {sinPublicarCount > 0 && <span className="duna-nav-dot" aria-hidden />}
            {sinPublicarCount > 0 ? `${sinPublicarCount} ${sinPublicarCount === 1 ? 'cambio' : 'cambios'}` : 'Todo publicado'}
          </p>
        </div>
      </div>

      <p className="duna-sub" style={{ marginTop: 'var(--duna-space-4)' }}>
        Menú, encabezado y pie también viven en el editor, con su vista previa.
      </p>
    </div>
  );
}

/** «Inicio» SIEMPRE (no apagable, § PAGINAS en tienda-secciones.ts); Nosotros/Suscripciones sólo
 *  si están encendidas. Lista separada por comas, como la maqueta. */
function paginasEncendidas(paginas: PaginasContent): string {
  const nombres = ['Inicio'];
  if (paginas.nosotros.visible) nombres.push('Nosotros');
  if (paginas.suscripciones.visible) nombres.push('Suscripciones');
  return nombres.join(', ');
}

/** El nombre de fuente REAL de un valor CSS `font-family` del catálogo (`"'Playfair Display',
 *  serif"` → `"Playfair Display"`), para mostrar el par sin las comillas ni el genérico de
 *  fallback — nunca el string CSS crudo. */
function nombreDeFuenteCSS(css: string): string {
  const m = css.match(/^'([^']+)'/);
  return m ? m[1] : css;
}

/**
 * EL ESTILO ACTIVO — matchea `content.tema` (raíces + par tipográfico + forma, ya resueltos por
 * `resolverTema`) contra el catálogo `PRESETS` (`lib/config/themes.ts`). Es DERIVACIÓN, no un dato
 * guardado: ningún campo de `SiteContent` registra "qué preset se aplicó por última vez" —sólo los
 * VALORES que ese preset escribió (§ `mergePresetEnContent`, que fusiona por campo, no por
 * identidad de preset)—, así que la única forma honesta de nombrar el estilo es comparar los
 * valores de hoy contra el catálogo.
 *
 * SIN MATCH EXACTO (p. ej. Nayoli, cuyas raíces/par/forma son `null` = fábrica, y ningún preset del
 * catálogo declara `null`) → "Personalizado": no se inventa un nombre de preset que no aplica. El
 * par de letras SIGUE siendo el real (`fuentePar ?? 'editorial'`), porque ESO sí es un hecho —el
 * tenant tiene un par tipográfico activo, coincida o no con un preset con nombre.
 */
function estiloActivo(tema: TemaContent): { nombre: string; parLetras: string } {
  const fuentePar = tema.fuentePar ?? 'editorial';
  const forma = tema.forma ?? 'suave';
  const preset = PRESETS.find((p) =>
    p.raices.fondo === tema.fondo && p.raices.tinta === tema.tinta && p.raices.acento === tema.acento
    && (p.fuentePar ?? 'editorial') === fuentePar
    && (p.forma ?? 'suave') === forma,
  );
  const par = PARES_FUENTES.find((f) => f.clave === fuentePar) ?? PARES_FUENTES[0];
  return {
    nombre: preset?.label ?? 'Personalizado',
    parLetras: `${nombreDeFuenteCSS(par.titulo)} + ${nombreDeFuenteCSS(par.cuerpo)}`,
  };
}
