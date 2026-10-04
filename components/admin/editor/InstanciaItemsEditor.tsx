'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Pencil, Upload, ImageIcon } from 'lucide-react';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { OPCIONES_CTA_DESTINO } from '@/components/admin/tienda-secciones';
import { MAX_SUBIDA_DIRECTA_MB } from '@/constants/upload';
import type { InstanciaItemDescriptor } from '@/lib/config/secciones-instancias';

// EL EDITOR DE ÍTEMS de un tipo REPEATER del catálogo de instancias (§ SECCIONES-TIPOS-2: Preguntas,
// Columnas, Filas) — agregar / quitar-CON-CONFIRMACIÓN / reordenar (flechas), cada ítem colapsado a
// un renglón-resumen y expandible para editar. MISMO patrón visual que `RepeaterEditor.tsx`
// (admin-level, § su docstring), pero NO es ese componente ni lo reusa: `RepeaterEditor.tsx` no está
// en `touches:` de este slice, y le falta justo lo que acá hace falta — un PISO (`min`) que impida
// bajar de dos columnas, no sólo un tope (`max`). Duplicar el patrón visual (~lo mismo que ya pagó
// `InstanciaEditorForm.tsx` al no reusar `TiendaSeccionEditor.renderCampo`) es más barato que abrir
// una segunda superficie fuera de alcance.
//
// CONTROLADO: `InstanciaEditorForm` (y, por arriba, `TiendaPaginas.tsx`) poseen el array completo —
// cada cambio, incluido agregar/quitar/mover, pasa por `onCambiar` con el array ENTERO, el mismo
// autoguardado de la instancia completa, nunca uno propio de este editor.
//
// MIN/MAX SON DE ESTE EDITOR, NO DEL RESOLVER (§ `InstanciaItemsDef`, secciones-instancias.ts): "de
// dos a seis columnas" es cierto porque la papelera se deshabilita en el piso y "Agregar" en el
// tope — el modelo no los impone (SOFT, resuelve lo que haya).

type Item = Record<string, string>;

const LABEL_CAMPO_ITEM: Record<string, string> = {
  pregunta: 'Pregunta',
  respuesta: 'Respuesta',
  titulo: 'Título',
  texto: 'Texto',
  imagen: 'Imagen',
  enlace: 'Destino',
  ctaLabel: 'Botón · texto',
  ctaDestino: 'Botón · destino',
};
// Los campos de DESTINO (set cerrado, igual que `ctaDestino` en los campos planos de la instancia)
// y los de TEXTO LARGO (textarea) se reconocen por NOMBRE — no hay más de estos ocho nombres en los
// tres tipos del catálogo (§ secciones-instancias.ts, DESCRIPTOR_INSTANCIA.{preguntas,columnas,
// filas}.items.descriptor.campos), así que una lista fija alcanza sin volverse una config aparte.
const CAMPOS_DESTINO = new Set(['enlace', 'ctaDestino']);
const CAMPOS_MULTILINEA = new Set(['respuesta', 'texto']);

// El resumen del renglón colapsado: el campo "principal" (pregunta/título) y un fragmento del campo
// "detalle" (respuesta/texto) — MISMOS roles que `resumen: 'principal'|'detalle'` de `CampoItem`
// (`components/admin/tienda-secciones.ts`), reconocidos por nombre en vez de declarados por ítem
// (los tres tipos de este catálogo sólo tienen UN candidato a cada rol).
function resumenDe(item: Item, i: number, itemLabel: string): { titulo: string; fragmento: string } {
  const principal = (item.pregunta ?? item.titulo ?? '').trim();
  const titulo = principal !== '' ? principal : `${itemLabel} ${i + 1}`;
  const detalle = (item.respuesta ?? item.texto ?? '').trim();
  const fragmento = detalle.length > 60 ? detalle.slice(0, 60) + '…' : detalle;
  return { titulo, fragmento };
}

export function InstanciaItemsEditor({
  items, descriptor, min, max, itemLabel, genero = 'f',
  pedirImagen, subiendo, progreso, onCambiar,
}: {
  items: Item[];
  descriptor: InstanciaItemDescriptor;
  min: number;
  max?: number;
  /** Nombre SINGULAR en minúscula ("pregunta", "columna", "fila") — para los botones y el renglón.
   *  Plural = `${itemLabel}s` (las tres son regulares en español, sin excepción que tratar). */
  itemLabel: string;
  /** Género del `itemLabel`, para el artículo del copy de confirmación. Default femenino — las tres
   *  del catálogo ("pregunta"/"columna"/"fila") lo son. */
  genero?: 'f' | 'm';
  /** Pide una subida al uploader COMPARTIDO de la cáscara (la misma instancia que
   *  `InstanciaEditorForm` ya usa para sus campos de imagen planos — un solo `<input>`, un solo
   *  `subiendo`). */
  pedirImagen: (onUrl: (url: string) => void) => void;
  subiendo: boolean;
  progreso: number | null;
  onCambiar: (nuevos: Item[]) => void;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);
  const [subiendoDesde, setSubiendoDesde] = useState<'agregar' | number | null>(null);
  const [porEliminar, setPorEliminar] = useState<number | null>(null);
  const camposImagen = new Set(descriptor.imagenes ?? []);
  const alMax = max != null && items.length >= max;
  const alMin = items.length <= min;

  const nuevoItem = (): Item => Object.fromEntries(Object.keys(descriptor.campos).map((c) => [c, '']));

  const editar = (i: number, campo: string, valor: string) =>
    onCambiar(items.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  // Agregar con campo-imagen = sube PRIMERO (un ítem-imagen vacío sería una foto rota) — mismo
  // criterio que `RepeaterEditor.agregar`. Ninguno de los tres tipos del catálogo tiene MÁS de un
  // campo de imagen por ítem, así que basta con el primero declarado.
  const agregar = () => {
    if (alMax) return;
    const campoImg = descriptor.imagenes?.[0];
    if (campoImg) {
      setSubiendoDesde('agregar');
      pedirImagen((url) => {
        onCambiar([...items, { ...nuevoItem(), [campoImg]: url }]);
        setExpandido(items.length);
      });
      return;
    }
    onCambiar([...items, nuevoItem()]);
    setExpandido(items.length);
  };

  const quitar = (i: number) => {
    if (alMin) return;
    onCambiar(items.filter((_, idx) => idx !== i));
    setExpandido(null);
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const nuevos = items.slice();
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    onCambiar(nuevos);
    setExpandido(j); // el ítem movido sigue expandido si lo estaba
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      {items.map((item, i) => {
        const abierto = expandido === i;
        const { titulo, fragmento } = resumenDe(item, i, itemLabel);
        const subiendoEste = subiendo && subiendoDesde === i;
        return (
          <div key={i} className="duna-card" style={{ padding: 'var(--duna-space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
              <button
                type="button"
                onClick={() => setExpandido(abierto ? null : i)}
                className="duna-btn duna-btn--ghost duna-btn--sm"
                aria-expanded={abierto}
                style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0, textAlign: 'left' }}
              >
                <Pencil className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>{titulo}</strong>{fragmento && <span className="duna-sub"> · {fragmento}</span>}
                </span>
              </button>
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="duna-btn duna-btn--ghost duna-btn--sm"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} aria-label="Bajar" className="duna-btn duna-btn--ghost duna-btn--sm"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setPorEliminar(i)} disabled={alMin} aria-label={`Eliminar ${itemLabel}`} className="duna-btn duna-btn--ghost duna-btn--sm"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {abierto && (
              <div className="duna-form" style={{ marginTop: 'var(--duna-space-3)' }}>
                {Object.keys(descriptor.campos).map((campo) => {
                  const id = `item-${i}-${campo}`;
                  const label = LABEL_CAMPO_ITEM[campo] ?? campo;
                  const kind = descriptor.campos[campo];
                  const valor = item[campo] ?? '';

                  if (camposImagen.has(campo)) {
                    return (
                      <div key={campo} className="duna-field duna-form__full">
                        <span className="duna-field__label">{label}</span>
                        <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
                          <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
                            {valor
                              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={valor} alt="" />
                              : <ImageIcon aria-hidden width={20} height={20} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                              <button
                                type="button"
                                onClick={() => { setSubiendoDesde(i); pedirImagen((url) => editar(i, campo, url)); }}
                                className="duna-btn duna-btn--secondary duna-btn--sm"
                                disabled={subiendo}
                              >
                                <Upload /> {valor ? 'Cambiar' : 'Agregar foto'}
                              </button>
                              {valor && (
                                <button type="button" onClick={() => editar(i, campo, '')} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                                  Quitar
                                </button>
                              )}
                            </div>
                            <span className="duna-field__hint" style={{ margin: 0 }}>
                              {subiendoEste ? `Subiendo… ${progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB. Vacío: no se muestra.`}
                            </span>
                            {subiendoEste && <BarraProgreso pct={progreso ?? 0} />}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (CAMPOS_DESTINO.has(campo)) {
                    return (
                      <div key={campo} className="duna-field">
                        <label className="duna-field__label" htmlFor={id}>{label}</label>
                        <select id={id} className="duna-input duna-select" value={valor} onChange={(e) => editar(i, campo, e.target.value)}>
                          {OPCIONES_CTA_DESTINO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    );
                  }

                  const multilinea = CAMPOS_MULTILINEA.has(campo);
                  return (
                    <div key={campo} className={`duna-field${multilinea ? ' duna-form__full' : ''}`}>
                      <label className="duna-field__label" htmlFor={id}>
                        {label}{kind === 'requerido' && ' *'}
                      </label>
                      {multilinea ? (
                        <textarea id={id} className="duna-input" rows={2} value={valor} onChange={(e) => editar(i, campo, e.target.value)} />
                      ) : (
                        <input id={id} className="duna-input" value={valor} onChange={(e) => editar(i, campo, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
        <button type="button" onClick={agregar} disabled={alMax || subiendo} className="duna-btn duna-btn--secondary duna-btn--sm" style={{ alignSelf: 'flex-start' }}>
          <Plus className="h-3.5 w-3.5" /> {subiendo && subiendoDesde === 'agregar' ? `Subiendo… ${progreso ?? 0}%` : `Agregar ${itemLabel}`}
        </button>
        {subiendo && subiendoDesde === 'agregar' && (
          <div style={{ maxWidth: 240 }}><BarraProgreso pct={progreso ?? 0} /></div>
        )}
        {alMax && (
          <p className="duna-field__hint" style={{ margin: 0 }}>Llegaste al máximo de {max} {itemLabel}s. Quita alguna para agregar otra.</p>
        )}
        {alMin && min > 0 && (
          <p className="duna-field__hint" style={{ margin: 0 }}>Mínimo {min} {itemLabel}s — no se pueden quitar más.</p>
        )}
      </div>

      <ConfirmDescartarDialog
        abierto={porEliminar !== null}
        onDescartar={() => { const i = porEliminar; setPorEliminar(null); if (i !== null) quitar(i); }}
        onSeguir={() => setPorEliminar(null)}
        titulo={`¿Eliminar est${genero === 'f' ? 'a' : 'e'} ${itemLabel}?`}
        descripcion="Se quita de la lista. Recuerda publicar para aplicar el cambio en la tienda."
        confirmLabel="Eliminar"
        seguirLabel="Conservar"
      />
    </div>
  );
}

export default InstanciaItemsEditor;
