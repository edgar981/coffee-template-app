'use client';

import { useState, type ReactNode } from 'react';
import { Search, Sparkles, Type, Image as ImageIcon, LayoutList, Palette, Smartphone, UploadCloud } from 'lucide-react';
import { Migas } from '@/components/admin/editor/Migas';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IlustracionAyuda } from '@/components/admin/editor/IlustracionAyuda';
import {
  GUIAS_AYUDA, PREGUNTAS_FRECUENTES, ATAJOS_TECLADO, buscarAyuda, type TemaAyudaId, type GuiaAyuda,
} from '@/lib/admin/ayuda-editor';

// EL CENTRO DE AYUDA (§ EDITOR-AYUDA-1, REDISENO.md § 9/EDITOR-VISUAL-MARCO-1): «Ayuda» del riel
// abre esto EN EL PANEL (el mismo lugar donde «Secciones»/«Estilo» ya viven), nunca en una hoja
// sobre el lienzo (`VistaNueva`) — el spec lo pide así, y además es el mismo mecanismo que `modo`
// ya tiene para «Estilo» (§ TiendaPaginas.tsx): un modo más del panel, no un overlay nuevo.
//
// CONTROLADO por el padre (`TiendaPaginas.tsx`), igual que cualquier otro nivel de este editor:
// `abierta` es la guía que se está mostrando (o `null` = la lista), y los dos callbacks navegan.
// Así, un «?» en el nivel Hero puede abrir la guía del hero sin que este componente necesite
// existir todavía en el DOM (el estado vive en el padre, no en un ref a este componente).
export interface AyudaCentroProps {
  abierta: TemaAyudaId | null;
  onAbrir: (tema: TemaAyudaId) => void;
  onVolver: () => void;
}

// Un ícono por tema — los mismos glifos que ya identifican «Secciones»/«Estilo» en el riel
// (`Riel.tsx`) y las filas de cromo (`IconoFila.tsx`), para que el mismo concepto se vea con el
// mismo símbolo en todo el editor, no uno nuevo por pantalla.
const ICONO_TEMA: Record<TemaAyudaId, ReactNode> = {
  'primeros-pasos': <Sparkles aria-hidden />,
  'editar-textos': <Type aria-hidden />,
  'fotos-videos': <ImageIcon aria-hidden />,
  secciones: <LayoutList aria-hidden />,
  hero: <IconoFila tipo="hero" />,
  estilo: <Palette aria-hidden />,
  cromo: <IconoFila tipo="nav" />,
  dispositivos: <Smartphone aria-hidden />,
  publicar: <UploadCloud aria-hidden />,
};

function GuiaVista({ guia, onVolver }: { guia: GuiaAyuda; onVolver: () => void }) {
  return (
    <div>
      <Migas nivelAnterior="Ayuda" actual={guia.titulo} onVolver={onVolver} />
      <h2 className="editor-pv-title">{guia.titulo}</h2>
      <p className="editor-pv-sub">{guia.resumen}</p>
      <ol className="editor-ayuda-pasos">
        {guia.pasos.map((paso, i) => (
          <li key={i} className="editor-ayuda-paso">
            <span className="editor-ayuda-paso__n" aria-hidden>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <p className="duna-sub" style={{ margin: 0 }}>{paso.texto}</p>
              {paso.secuencia && <IlustracionAyuda pasos={paso.secuencia} />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AyudaCentro({ abierta, onAbrir, onVolver }: AyudaCentroProps) {
  const [busqueda, setBusqueda] = useState('');
  const guia = abierta ? GUIAS_AYUDA.find((g) => g.id === abierta) ?? null : null;

  if (guia) return <GuiaVista guia={guia} onVolver={onVolver} />;

  const resultado = busqueda.trim() ? buscarAyuda(busqueda) : null;

  return (
    <div style={{ display: 'grid', gap: 'var(--duna-space-5)' }}>
      <div>
        <h2 className="editor-pv-title">Ayuda</h2>
        <p className="editor-pv-sub">
          Guías cortas para usar el editor — pensadas para cuando ya te explicaron cómo funciona y se te olvidó un paso.
        </p>
      </div>

      <div className="duna-field" style={{ position: 'relative', margin: 0 }}>
        <Search aria-hidden style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--duna-muted)' }} />
        <input
          type="search"
          className="duna-input"
          style={{ paddingLeft: 32 }}
          placeholder="Busca un tema o una pregunta…"
          aria-label="Buscar en la ayuda"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {resultado ? (
        <>
          {resultado.guias.length === 0 && resultado.preguntas.length === 0 ? (
            <p className="duna-sub">No encontramos nada para «{busqueda}».</p>
          ) : (
            <>
              {resultado.guias.length > 0 && (
                <div>
                  <div className="editor-grp">Guías</div>
                  <div className="editor-rows">
                    {resultado.guias.map((g) => (
                      <FilaSeccion key={g.id} icono={ICONO_TEMA[g.id]} titulo={g.titulo} onAbrir={() => onAbrir(g.id)} />
                    ))}
                  </div>
                </div>
              )}
              {resultado.preguntas.length > 0 && (
                <div>
                  <div className="editor-grp">Preguntas frecuentes</div>
                  <div style={{ display: 'grid', gap: 'var(--duna-space-2)' }}>
                    {resultado.preguntas.map((p) => (
                      <details key={p.id} className="editor-ayuda-faq" open>
                        <summary>{p.pregunta}</summary>
                        <p className="duna-sub" style={{ margin: 'var(--duna-space-2) 0 0' }}>{p.respuesta}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div>
            <div className="editor-grp">Guías</div>
            <div className="editor-rows">
              {GUIAS_AYUDA.map((g) => (
                <FilaSeccion key={g.id} icono={ICONO_TEMA[g.id]} titulo={g.titulo} onAbrir={() => onAbrir(g.id)} />
              ))}
            </div>
          </div>

          <div>
            <div className="editor-grp">Preguntas frecuentes</div>
            <div style={{ display: 'grid', gap: 'var(--duna-space-2)' }}>
              {PREGUNTAS_FRECUENTES.map((p) => (
                <details key={p.id} className="editor-ayuda-faq">
                  <summary>{p.pregunta}</summary>
                  <p className="duna-sub" style={{ margin: 'var(--duna-space-2) 0 0' }}>{p.respuesta}</p>
                </details>
              ))}
            </div>
          </div>

          <div>
            <div className="editor-grp">Atajos de teclado</div>
            <div style={{ display: 'grid', gap: 'var(--duna-space-1)' }}>
              {ATAJOS_TECLADO.map((a) => (
                <div key={a.id} className="editor-ayuda-atajo">
                  <span className="duna-sub" style={{ margin: 0 }}>{a.accion}</span>
                  <kbd className="editor-ayuda-kbd">{a.combinacion}</kbd>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AyudaCentro;
