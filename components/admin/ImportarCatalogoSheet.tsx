'use client';
import { useRef, useState } from 'react';
import { Upload, Trash2, CheckCircle2, AlertCircle, MinusCircle, FileUp } from 'lucide-react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { CategoriaCombobox } from '@/components/admin/CategoriaCombobox';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import type { ResultadoImport } from '@duna/core/product-import';
import { parsear, sepDeArchivo, motivoInvalida, SEP_LABEL, type Sep, type FilaGrid } from '@/lib/productos/import-parse';

// Import de catálogo. El caso real: montar la tienda de un prospecto con SU catálogo
// (Instagram, un menú, una lista de WhatsApp, un CSV que mandó). DOS ENTRADAS al MISMO
// sitio —pegar o subir un archivo—, no dos caminos: las dos producen `FilaGrid[]`,
// caen en la MISMA grilla editable y pasan la MISMA validación (`motivoInvalida` acá,
// re-validada por fila en el endpoint). El parseo vive en `lib/productos/import-parse`.
//
// EL SEPARADOR CORTA COLUMNAS, NO PRODUCTOS. Un producto es una LÍNEA; el separador
// corta cada línea en Nombre·Precio·Categoría. La interfaz nombra los dos ejes y el
// default es Tab (coma opt-in), para que pegar tres nombres no se lea como tres columnas.

type Fila = FilaGrid;
const COLS: { campo: keyof Fila; label: string; ancho: string }[] = [
  { campo: 'nombre',    label: 'Nombre',    ancho: 'minmax(10rem,2fr)' },
  { campo: 'precio',    label: 'Precio',    ancho: 'minmax(6rem,1fr)' },
  { campo: 'categoria', label: 'Categoría', ancho: 'minmax(8rem,1.4fr)' },
  { campo: 'sku',       label: 'SKU',       ancho: 'minmax(6rem,1fr)' },
  { campo: 'stock',     label: 'Stock',     ancho: 'minmax(4rem,0.7fr)' },
];

export function ImportarCatalogoSheet({ abierto, categorias, onCerrar, onImportado }: {
  abierto: boolean;
  /** Categorías EXISTENTES del catálogo (derivadas), en el combobox de la celda categoría — la
   *  categoría es texto libre, no un set cerrado. Un catálogo vacío no sugiere nada; se escribe la suya. */
  categorias: string[];
  onCerrar: () => void; onImportado: () => void;
}) {
  const [crudo, setCrudo]         = useState('');
  const [sep, setSep]             = useState<Sep>('tab');
  const [filas, setFilas]         = useState<Fila[]>([]);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [errorGlobal, setError]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const guarda = useAccionGuardada();

  const reset  = () => { setCrudo(''); setFilas([]); setResultado(null); setError(null); if (fileRef.current) fileRef.current.value = ''; };
  const cerrar = () => { reset(); onCerrar(); };

  // El default SIEMPRE es Tab (no se auto-detecta la coma: convertía tres nombres en
  // tres columnas sin que nadie lo eligiera). El operador cambia a Coma/`;` si hace falta.
  const cargar = (texto: string, s: Sep) => { setCrudo(texto); setSep(s); setFilas(parsear(texto, s)); setResultado(null); setError(null); };

  const alPegar = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const texto = e.clipboardData.getData('text');
    if (!texto.trim()) return;
    e.preventDefault();
    cargar(texto, 'tab');
  };

  // Un archivo entra por la MISMA puerta: se lee en el CLIENTE (sin subirlo), se parsea
  // igual y cae en la grilla. El separador sale de la EXTENSIÓN (.csv → coma), que es
  // leer el formato, no adivinar el contenido.
  const alArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const texto = await f.text();
    cargar(texto, sepDeArchivo(f.name));
  };

  // Cambiar el separador RE-PARSEA el texto crudo (descarta la grilla actual a propósito:
  // si el separador estaba mal, las columnas estaban mal).
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
  const ejemplo = filas[0]; // la 1ª fila leída, para el ejemplo vivo del separador

  return (
    <DunaSheet abierto={abierto} onCerrar={cerrar} titulo="Importar catálogo"
               descripcion="Pega tu lista o sube un archivo y revísalo antes de crearlo.">
      <div className="duna-sheet__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>

        {filas.length === 0 ? (
          // PASO 1 · entrar los datos. Los DOS ejes se dicen ANTES de pegar, no después de fallar.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
            <p className="duna-sub" style={{ margin: 0 }}>
              <strong>Un producto por línea.</strong> En cada línea, las columnas van en este
              orden: <strong>Nombre · Precio · Categoría</strong> (SKU y Stock opcionales),
              separadas por tabulación —lo que sale de copiar una hoja de cálculo—.
              ¿Copiaste de un chat? Pega los <strong>nombres uno por línea</strong> y completa
              el precio y la categoría en la grilla.
            </p>
            <textarea
              className="duna-input" rows={8} autoFocus
              placeholder={"Café Huila 500 g\t28000\tcafe_grano\nCombo Desayuno\t35000\tcaja_regalo\n…"}
              onPaste={alPegar}
              onChange={e => cargar(e.target.value, 'tab')}
              style={{ fontFamily: 'var(--duna-font-mono)', fontSize: '0.8rem', whiteSpace: 'pre' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
              <span className="duna-caption">o</span>
              <button type="button" className="duna-btn duna-btn--ghost" onClick={() => fileRef.current?.click()}>
                <FileUp className="w-4 h-4" /> Subir un archivo (.csv)
              </button>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                     onChange={alArchivo} style={{ display: 'none' }} />
            </div>
          </div>
        ) : (
          <>
            {/* Separador: nombra QUÉ separa (columnas), y el ejemplo vivo muestra cómo quedó. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', flexWrap: 'wrap' }}>
                <span className="duna-caption">Columnas separadas por:</span>
                {(['tab', 'coma', 'puntoycoma'] as Sep[]).map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="radio" name="sep-import" checked={sep === s} onChange={() => cambiarSep(s)} />
                    <span className="duna-body-sm">{SEP_LABEL[s]}</span>
                  </label>
                ))}
                <span className="duna-caption" style={{ marginLeft: 'auto' }}>
                  {listos} {listos === 1 ? 'listo' : 'listos'}
                  {problemas > 0 && <span style={{ color: 'var(--duna-bad-ink, var(--duna-bad))' }}> · {problemas} con problemas</span>}
                </span>
              </div>
              {/* EJEMPLO VIVO: la 1ª fila leída con el separador actual. Si son nombres en
                  columnas equivocadas, el error se ve acá, en el momento de elegir. */}
              {ejemplo && !resultado && (
                <p className="duna-caption" style={{ margin: 0 }}>
                  Tu primera fila se leyó así — Nombre «<strong>{ejemplo.nombre || '—'}</strong>»
                  {' · '}Precio «{ejemplo.precio || '—'}»
                  {' · '}Categoría «{ejemplo.categoria || '—'}». ¿No cuadra? Cambia el separador
                  o pon un producto por línea.
                </p>
              )}
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
                        c.campo === 'categoria' ? (
                          // MISMO combobox que el form de producto (§ el combobox de categoría): la
                          // lista de categorías derivadas es visible en la celda, y se puede escribir
                          // una nueva —común en un import de otro catálogo—.
                          <CategoriaCombobox key={c.campo} compacto value={f.categoria} categorias={categorias}
                                             onChange={v => editar(i, 'categoria', v)}
                                             ariaInvalid={!f.categoria.trim()} />
                        ) : (
                          <input key={c.campo} className="duna-input" value={f[c.campo]}
                                 onChange={e => editar(i, c.campo, e.target.value)}
                                 aria-invalid={c.campo === 'nombre' && !f.nombre.trim() ? true : undefined}
                                 style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
                        )
                      ))}
                      <button type="button" onClick={() => quitar(i)} aria-label="Quitar fila"
                              className="duna-btn duna-btn--ghost" style={{ padding: 4 }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
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
