'use client';
import { useState } from 'react';
import { Upload, Trash2, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { CATEGORIAS } from '@/constants/product';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import type { ResultadoImport } from '@duna/core/product-import';
import { parsear, detectarSep, motivoInvalida, SEP_LABEL, type Sep, type FilaGrid } from '@/lib/productos/import-parse';

// Import de catálogo pegable. El caso real: montar la tienda de un prospecto con SU
// catálogo copiado a mano. La forma es PEGAR → GRILLA editable → revisar → importar.
//
// EL PARSEO ES TSV-FIRST, PERO NUNCA EN SILENCIO. El dato limpio sale de una hoja de
// cálculo (copiar de una hoja da TSV), así que el default corta por TAB. Pero la grilla
// MUESTRA el resultado del parseo y es EDITABLE, así que nada se importa mal-parseado sin
// que el operador lo vea: si el separador no fue el correcto, lo cambia acá y RE-VE el
// parseo. Una línea SIN separador es una fila de sólo-Nombre (pegar una lista de nombres
// de un chat → cada línea un nombre, el precio y la categoría se completan en la grilla).

type Fila = FilaGrid;
const COLS: { campo: keyof Fila; label: string; ancho: string }[] = [
  { campo: 'nombre',    label: 'Nombre',    ancho: 'minmax(10rem,2fr)' },
  { campo: 'precio',    label: 'Precio',    ancho: 'minmax(6rem,1fr)' },
  { campo: 'categoria', label: 'Categoría', ancho: 'minmax(8rem,1.4fr)' },
  { campo: 'sku',       label: 'SKU',       ancho: 'minmax(6rem,1fr)' },
  { campo: 'stock',     label: 'Stock',     ancho: 'minmax(4rem,0.7fr)' },
];

export function ImportarCatalogoSheet({ abierto, onCerrar, onImportado }: {
  abierto: boolean; onCerrar: () => void; onImportado: () => void;
}) {
  const [crudo, setCrudo]       = useState('');
  const [sep, setSep]           = useState<Sep>('tab');
  const [filas, setFilas]       = useState<Fila[]>([]);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [errorGlobal, setError] = useState<string | null>(null);
  const guarda = useAccionGuardada();

  const reset = () => { setCrudo(''); setFilas([]); setResultado(null); setError(null); };
  const cerrar = () => { reset(); onCerrar(); };

  const alPegar = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const texto = e.clipboardData.getData('text');
    if (!texto.trim()) return;
    e.preventDefault();
    const s = detectarSep(texto);
    setCrudo(texto); setSep(s); setFilas(parsear(texto, s)); setResultado(null); setError(null);
  };
  // Cambiar el separador RE-PARSEA el texto crudo (descarta la grilla actual a propósito:
  // si el separador estaba mal, las columnas estaban mal). Se cambia justo tras pegar.
  const cambiarSep = (s: Sep) => { setSep(s); setFilas(parsear(crudo, s)); setResultado(null); };

  const editar = (i: number, campo: keyof Fila, valor: string) =>
    setFilas(fs => fs.map((f, j) => j === i ? { ...f, [campo]: valor } : f));
  const quitar = (i: number) => setFilas(fs => fs.filter((_, j) => j !== i));

  const problemas = filas.filter(f => motivoInvalida(f)).length;
  const listos = filas.length - problemas;

  const importar = () => guarda.ejecutar(async () => {
    setError(null);
    const res = await fetch('/api/products/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'No se pudo importar'); return; }
    setResultado(data as ResultadoImport);
    if (data.resumen.creadas > 0) onImportado();
  });

  const resPorFila = new Map((resultado?.resultados ?? []).map(r => [r.fila, r]));
  const gridCols = COLS.map(c => c.ancho).join(' ') + ' auto';

  return (
    <DunaSheet abierto={abierto} onCerrar={cerrar} titulo="Importar catálogo"
               descripcion="Pega tu lista de productos y revísala antes de crearla.">
      <div className="duna-sheet__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>

        {filas.length === 0 ? (
          // PASO 1 · pegar. El formato se dice ANTES de pegar, no después de fallar.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
            <p className="duna-sub" style={{ margin: 0 }}>
              Pega desde una <strong>hoja de cálculo</strong> — columnas en este orden:
              <strong> Nombre · Precio · Categoría</strong> (SKU y Stock opcionales).
              ¿Copiaste de un chat? Pega los <strong>nombres uno por línea</strong> y completa
              el precio y la categoría acá.
            </p>
            <textarea
              className="duna-input" rows={8} autoFocus
              placeholder={"Café Huila 500 g\t28000\tcafe_grano\nCombo Desayuno\t35000\tcaja_regalo\n…"}
              onPaste={alPegar}
              onChange={e => { const t = e.target.value; const s = detectarSep(t); setCrudo(t); setSep(s); setFilas(parsear(t, s)); }}
              style={{ fontFamily: 'var(--duna-font-mono)', fontSize: '0.8rem', whiteSpace: 'pre' }}
            />
          </div>
        ) : (
          <>
            {/* Separador visible: si el pegado no era TSV, el operador cambia y RE-VE. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', flexWrap: 'wrap' }}>
              <span className="duna-caption">Separado por:</span>
              {(['tab', 'coma', 'puntoycoma'] as Sep[]).map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="radio" name="sep-import" checked={sep === s}
                         onChange={() => cambiarSep(s)} />
                  <span className="duna-body-sm">{SEP_LABEL[s]}</span>
                </label>
              ))}
              <span className="duna-caption" style={{ marginLeft: 'auto' }}>
                {listos} {listos === 1 ? 'listo' : 'listos'}
                {problemas > 0 && <span style={{ color: 'var(--duna-bad-ink, var(--duna-bad))' }}> · {problemas} con problemas</span>}
              </span>
            </div>

            {/* La grilla editable. Cada fila muestra su estado tras importar. */}
            <div style={{ overflow: 'auto', maxHeight: '46vh' }}>
              <div className="duna-lista" style={{ minWidth: '38rem' }}>
                <div className="duna-lista__fila duna-lista__head" style={{ gridTemplateColumns: gridCols }}>
                  {COLS.map(c => <span key={c.campo}>{c.label}</span>)}
                  <span aria-hidden />
                </div>
                {filas.map((f, i) => {
                  const r = resPorFila.get(i);
                  const invalida = motivoInvalida(f);
                  const tono = r?.estado === 'error' || (!r && invalida) ? 'var(--duna-bad)'
                             : r?.estado === 'omitida' ? 'var(--duna-sol)'
                             : r?.estado === 'creada'  ? 'var(--duna-ok)' : 'transparent';
                  return (
                    <div key={i} className="duna-lista__fila" style={{ gridTemplateColumns: gridCols, alignItems: 'center', borderLeft: `2px solid ${tono}` }}>
                      {COLS.map(c => (
                        <input key={c.campo} className="duna-input" value={f[c.campo]}
                               onChange={e => editar(i, c.campo, e.target.value)}
                               aria-invalid={c.campo === 'categoria' && !f.categoria.trim() ? true : c.campo === 'nombre' && !f.nombre.trim() ? true : undefined}
                               list={c.campo === 'categoria' ? 'cats-import' : undefined}
                               style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
                      ))}
                      <button type="button" onClick={() => quitar(i)} aria-label="Quitar fila"
                              className="duna-btn duna-btn--ghost" style={{ padding: 4 }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <datalist id="cats-import">
                {Object.entries(CATEGORIAS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </datalist>
            </div>

            {/* Resultado por fila tras importar. */}
            {resultado && (
              <div className="duna-card duna-card__pad" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--duna-ok)' }} /> {resultado.resumen.creadas} creados</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MinusCircle className="w-4 h-4" style={{ color: 'var(--duna-sol)' }} /> {resultado.resumen.omitidas} ya existían</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle className="w-4 h-4" style={{ color: 'var(--duna-bad)' }} /> {resultado.resumen.errores} con error</span>
                </div>
                {resultado.resumen.errores > 0 && (
                  <p className="duna-sub" style={{ margin: 0 }}>
                    Las filas con error quedan arriba con su motivo — corrígelas e importa de nuevo (las creadas se omiten).
                  </p>
                )}
              </div>
            )}

            {errorGlobal && (
              <div className="duna-card duna-card__pad" role="alert" style={{ borderColor: 'var(--duna-bad)', color: 'var(--duna-bad-ink, var(--duna-bad))' }}>
                {errorGlobal}
              </div>
            )}
          </>
        )}

        {/* Pie: acciones. */}
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button type="button" className="duna-btn duna-btn--ghost" onClick={cerrar} disabled={guarda.enVuelo}>
            {resultado ? 'Cerrar' : 'Cancelar'}
          </button>
          {filas.length > 0 && (
            <button type="button" className="duna-btn duna-btn--primary" onClick={importar}
                    disabled={guarda.enVuelo || listos === 0}>
              <Upload className="w-4 h-4" />
              {guarda.enVuelo ? 'Importando…' : `Importar ${listos} ${listos === 1 ? 'producto' : 'productos'}`}
            </button>
          )}
        </div>
      </div>
    </DunaSheet>
  );
}
