'use client';

import { useMemo, useState, type ComponentType, type CSSProperties } from 'react';
import { Search } from 'lucide-react';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type TemaContent } from '@/lib/config/site-content-defaults';
import { varsDeTienda } from '@/lib/config/esquema-style';
import { EscalaDesktop } from '@/components/admin/EscalaDesktop';
import SeccionTexto from '@/components/storefront/secciones/Texto';
import SeccionImagenTexto from '@/components/storefront/secciones/ImagenTexto';
import SeccionBanner from '@/components/storefront/secciones/Banner';
import SeccionPreguntas from '@/components/storefront/secciones/Preguntas';
import SeccionColumnas from '@/components/storefront/secciones/Columnas';
import SeccionFilas from '@/components/storefront/secciones/Filas';
import SeccionCollage from '@/components/storefront/secciones/Collage';
import SeccionVideo from '@/components/storefront/secciones/Video';
import {
  CATALOGO_INSTANCIAS, DEFAULTS_INSTANCIA, type InstanciaContent, type SeccionInstanciaTipo,
} from '@/lib/config/secciones-instancias';

// LA BIBLIOTECA de «Agregar sección» (§ EDITOR-AGREGAR-SECCION-1, docs/editor-tienda/
// AGREGAR-SECCIONES.md, punto 1 del plan). Vive DENTRO de `VistaNueva` (§ EditorTiendaPantallaCompleta
// la estrenó para «Medios»; ésta es su segundo consumidor real).
//
// LA VISTA PREVIA ES EL COMPONENTE REAL, ESCALADO — no un esquema aproximado. Es el MISMO patrón que
// `PaletaSeccion.tsx` ya usa para su `FragmentoTienda` (componentes reales del storefront, montados
// con un `SiteContentProvider` LOCAL + las vars de `varsDeTienda` + `EscalaDesktop`): acá los tres
// componentes del catálogo (`SeccionTexto`/`SeccionImagenTexto`/`SeccionBanner`) se montan con sus
// DEFAULTS neutros (`DEFAULTS_INSTANCIA`, § secciones-instancias.ts — el contenido de ejemplo que YA
// existía, sin inventar uno nuevo) bajo la paleta/letras/forma REALES del tenant (`tema`, pasado por
// `TiendaPaginas` desde `doc.contenido.tema` — el borrador en curso, no un default de código). Con
// `tema: null` (doc sin cargar todavía) cae a `DEFAULTS.tema`, que es la fábrica — Nayoli hoy.
//
// SIEMPRE VISIBLE, NO SÓLO AL HOVER — desviación medida del spec ("al pasar el mouse o con foco"):
// la hoja es angosta (`min(480px, calc(100% - 2.75rem))`, § `VistaNueva`/`DunaSheet --lado`), así que
// una vista previa que sólo aparece en hover competiría por el mismo espacio que la lista — y en
// táctil no hay hover. Mostrarla siempre en cada tarjeta cumple el mismo propósito ("ver antes de
// elegir") sin depender de un gesto que un teléfono no tiene.
//
// LA TARJETA ES UN `<button>`, Y SU PREVIEW ES `pointer-events:none` — mismo patrón que la tarjeta
// compacta de lectura (`EscalaDesktop`, § su docstring: "el clic de la TARJETA que abre Editar pasa
// intacto, su contenido es pointer-events:none"). Los componentes reales traen `<Link>` (CTAs); sin
// esto, un clic en el botón de ejemplo abriría una navegación en vez de elegir el tipo.

// `as ComponentType<...>`: cada componente real exige su propio sub-tipo de `InstanciaContent`
// (`InstanciaTextoContent`/`InstanciaImagenTextoContent`/`InstanciaBannerContent`), no la unión —
// el Record necesita un tipo COMÚN para las ocho entradas, y en runtime cada una SIEMPRE recibe
// `DEFAULTS_INSTANCIA[tipo]` (la forma correcta para ESE tipo, nunca mezclada) desde el `.map` de
// abajo, que indexa por la MISMA clave `entrada.tipo` que eligió el componente.
type ComponenteInstancia = ComponentType<{ id: string; instancia: InstanciaContent; style?: CSSProperties }>;
const COMPONENTE_INSTANCIA: Record<SeccionInstanciaTipo, ComponenteInstancia> = {
  texto: SeccionTexto as ComponenteInstancia,
  imagenTexto: SeccionImagenTexto as ComponenteInstancia,
  banner: SeccionBanner as ComponenteInstancia,
  preguntas: SeccionPreguntas as ComponenteInstancia,
  columnas: SeccionColumnas as ComponenteInstancia,
  filas: SeccionFilas as ComponenteInstancia,
  collage: SeccionCollage as ComponenteInstancia,
  video: SeccionVideo as ComponenteInstancia,
};

const ALTO_PREVIEW = 104;

export function BibliotecaSecciones({ tema, onElegir, elegido }: {
  /** El tema EN CURSO del tenant (borrador), o `null` mientras el doc no cargó — cae a fábrica. */
  tema: TemaContent | null;
  onElegir: (tipo: SeccionInstanciaTipo) => void;
  /** El tipo que se está insertando ahora mismo — deshabilita las tarjetas mientras viaja, mismo
   *  criterio que cualquier botón de alta (§ Doble-submit). */
  elegido: SeccionInstanciaTipo | null;
}) {
  const [busqueda, setBusqueda] = useState('');
  const vars = useMemo(() => varsDeTienda(tema ?? DEFAULTS.tema) as CSSProperties, [tema]);
  const filtrados = CATALOGO_INSTANCIAS.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    return q === '' || c.nombre.toLowerCase().includes(q) || c.frase.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
      <div className="duna-field" style={{ position: 'relative' }}>
        <Search aria-hidden style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--duna-muted)' }} />
        <input
          type="search"
          className="duna-input"
          style={{ paddingLeft: 32 }}
          placeholder="Buscar un tipo de sección…"
          aria-label="Buscar un tipo de sección"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          disabled={!!elegido}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
        {filtrados.map((entrada) => {
          const Componente = COMPONENTE_INSTANCIA[entrada.tipo];
          const disabled = elegido !== null;
          return (
            <button
              key={entrada.tipo}
              type="button"
              disabled={disabled}
              onClick={() => onElegir(entrada.tipo)}
              className="duna-card"
              style={{
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)',
                padding: 'var(--duna-space-3)', cursor: disabled ? 'default' : 'pointer',
                opacity: disabled && elegido !== entrada.tipo ? 0.5 : 1,
              }}
            >
              <div>
                <div className="duna-title" style={{ fontSize: 14 }}>{entrada.nombre}</div>
                <p className="duna-sub" style={{ margin: 0 }}>
                  {elegido === entrada.tipo ? 'Agregando…' : entrada.frase}
                </p>
              </div>
              <div
                className="font-inter"
                style={{ ...vars, background: 'var(--sf-fondo)', pointerEvents: 'none', borderRadius: 'var(--duna-r-m)', overflow: 'hidden', border: '1px solid var(--duna-border)' }}
              >
                <PreviewProvider>
                  <SiteContentProvider value={DEFAULTS}>
                    <EscalaDesktop compacto style={{ height: ALTO_PREVIEW }}>
                      <Componente id={`biblioteca-${entrada.tipo}`} instancia={DEFAULTS_INSTANCIA[entrada.tipo]} />
                    </EscalaDesktop>
                  </SiteContentProvider>
                </PreviewProvider>
              </div>
            </button>
          );
        })}
        {filtrados.length === 0 && (
          <p className="duna-sub">Ningún tipo de sección coincide con «{busqueda}».</p>
        )}
      </div>
    </div>
  );
}

export default BibliotecaSecciones;
