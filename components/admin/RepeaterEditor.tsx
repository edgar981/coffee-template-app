'use client';

import { useState } from 'react';
import { Star, ArrowUp, ArrowDown, Trash2, Plus, Pencil, Upload } from 'lucide-react';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import type { CampoItem } from '@/components/admin/tienda-secciones';

// EDITOR DE LISTA (repeater) GENÉRICO — agregar / quitar / editar / reordenar (flechas) ítems, con
// cada ítem COLAPSADO a un renglón-resumen y expandible para editar. La maquinaria NO sabe nada de
// testimonios ni de fotos: opera sobre `descriptores` (nombre + tipo + rol de resumen). El mismo
// componente sirve a la galería de /nosotros (tanda 2): sólo cambian los descriptores (un campo
// `tipo:'imagen'` en vez de texto+rating).
//
// CONTROLADO: el array `items` lo posee el padre (`TiendaSeccionEditor`), para que TODO cambio pase
// por `onChange` → el mismo marcar-sucio + autoguardado que un campo plano. Agregar, quitar y mover
// también llaman a `onChange` (no son onChange de input — son los que más fácil se olvidan). Lo
// único LOCAL es qué ítem está expandido (estado de UI, no contenido).
//
// IMÁGENES: el repeater NO tiene su propio uploader —lo pide por `pedirImagen` (el `pedir` del hook
// compartido que la cáscara instancia)—, así hay UN solo <input file> y un solo `subiendo` que
// bloquea todo. Un repeater con un campo `tipo:'imagen'` AGREGA subiendo primero: un ítem-imagen
// vacío se renderizaría como una foto rota, así que "Agregar" abre el picker y crea el ítem con la
// url ya puesta.

type Item = Record<string, unknown>;

function estrellasLabel(n: number) { return `${n} estrella${n > 1 ? 's' : ''}`; }

// Rating: estrellas CLICABLES. Llenas hasta `valor` (tinta), vacías el resto (borde). Convención de
// 5 (no es un nombre de campo; es la escala del tipo 'rating').
function RatingInput({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          aria-label={estrellasLabel(n)}
          aria-pressed={n === valor}
          onClick={() => onChange(n)}
          className="duna-btn duna-btn--ghost"
          style={{ padding: '4px', minWidth: 'auto', height: 'auto' }}
        >
          <Star
            className="h-5 w-5"
            style={{ fill: n <= valor ? 'var(--duna-ink)' : 'transparent', color: n <= valor ? 'var(--duna-ink)' : 'var(--duna-border)' }}
          />
        </button>
      ))}
    </div>
  );
}

function resumenDe(item: Item, descriptores: CampoItem[], itemLabel: string, i: number) {
  const principal = descriptores.find(d => d.resumen === 'principal');
  const detalle = descriptores.find(d => d.resumen === 'detalle');
  const titulo = (principal && String(item[principal.name] ?? '').trim()) || `${itemLabel} ${i + 1}`;
  const detTexto = detalle ? String(item[detalle.name] ?? '').trim() : '';
  const fragmento = detTexto.length > 60 ? detTexto.slice(0, 60) + '…' : detTexto;
  return { titulo, fragmento };
}

export default function RepeaterEditor({
  items,
  descriptores,
  itemLabel,
  genero = 'm',
  max,
  pedirImagen,
  subiendo,
  onChange,
}: {
  items: Item[];
  descriptores: CampoItem[];
  itemLabel: string;
  /** Género del `itemLabel`, sólo para el artículo del copy de confirmación ("esta foto" vs "este
   *  testimonio"). Default masculino. */
  genero?: 'f' | 'm';
  max?: number;
  /** Pide una subida al uploader compartido de la cáscara; entrega la url por el callback. Ausente
   *  en repeaters sin imágenes (testimonios). */
  pedirImagen?: (onUrl: (url: string) => void) => void;
  /** Una subida en curso (del uploader compartido): bloquea agregar/cambiar para no encimar dos. */
  subiendo?: boolean;
  onChange: (nuevos: Item[]) => void;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);
  // Índice del ítem pendiente de ELIMINAR (con confirmación). Borrar destruye trabajo —una foto o
  // un testimonio— y no hay deshacer campo por campo, así que la papelera CONFIRMA antes de quitar.
  // Va en la PLATAFORMA (no en el tipo imagen) porque el testimonio borrado destruye igual.
  const [porEliminar, setPorEliminar] = useState<number | null>(null);

  // El PRIMER campo imagen es la foto principal del ítem: gobierna el agregar-subiendo y la miniatura
  // del renglón. Un repeater sin campo imagen (testimonios) no lo tiene y agrega vacío como siempre.
  const campoImagen = descriptores.find(d => d.tipo === 'imagen');
  const alMax = max != null && items.length >= max;

  const editar = (i: number, campo: string, valor: unknown) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  const nuevoItem = (): Item => Object.fromEntries(descriptores.map(d => [d.name, d.defaultValor ?? '']));

  const agregar = () => {
    if (alMax) return;
    if (campoImagen && pedirImagen) {
      // Agregar = subir primero, luego crear el ítem con la url. Sin foto no hay ítem.
      pedirImagen(url => {
        const nuevo = nuevoItem();
        nuevo[campoImagen.name] = url;
        onChange([...items, nuevo]);
        setExpandido(items.length); // expandir el nuevo para el resto de campos (p. ej. el alt)
      });
      return;
    }
    onChange([...items, nuevoItem()]);
    setExpandido(items.length);
  };

  const quitar = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    setExpandido(null);
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const nuevos = items.slice();
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    onChange(nuevos);
    setExpandido(j); // el ítem movido sigue expandido si lo estaba
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-3)' }}>
      {items.length === 0 && (
        <p className="duna-field__hint" style={{ margin: 0 }}>
          No hay {itemLabel.toLowerCase()}s todavía. Agrega el primero — mientras la lista esté vacía, la sección no se muestra en la tienda.
        </p>
      )}

      {items.map((item, i) => {
        const abierto = expandido === i;
        const { titulo, fragmento } = resumenDe(item, descriptores, itemLabel, i);
        const miniatura = campoImagen ? String(item[campoImagen.name] ?? '') : '';
        return (
          <div key={i} className="duna-card" style={{ padding: 'var(--duna-space-3)' }}>
            {/* Renglón-resumen: (miniatura) + título + fragmento a la izquierda; controles a la derecha. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
              {miniatura && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={miniatura} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--duna-r-s)', border: '1px solid var(--duna-border)', flexShrink: 0 }} />
              )}
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
                <button type="button" onClick={() => setPorEliminar(i)} aria-label={`Eliminar ${itemLabel.toLowerCase()}`} className="duna-btn duna-btn--ghost duna-btn--sm"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {/* Expandido: los campos del ítem, por tipo. */}
            {abierto && (
              <div className="duna-form" style={{ marginTop: 'var(--duna-space-3)' }}>
                {descriptores.map(d => {
                  const id = `item-${i}-${d.name}`;
                  const valor = item[d.name];
                  const full = d.tipo === 'textarea' || d.tipo === 'imagen';
                  return (
                    <div key={d.name} className={`duna-field${full ? ' duna-form__full' : ''}`}>
                      <label className="duna-field__label" htmlFor={d.tipo === 'rating' || d.tipo === 'imagen' ? undefined : id}>{d.label}</label>
                      {d.tipo === 'rating' ? (
                        <RatingInput valor={Number(valor) || 0} onChange={v => editar(i, d.name, v)} />
                      ) : d.tipo === 'imagen' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)' }}>
                          {String(valor ?? '') && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={String(valor)} alt="" style={{ width: '100%', maxWidth: '240px', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 'var(--duna-r-m)', border: '1px solid var(--duna-border)' }} />
                          )}
                          <div>
                            <button type="button" onClick={() => pedirImagen?.(url => editar(i, d.name, url))} disabled={subiendo} className="duna-btn duna-btn--secondary duna-btn--sm">
                              <Upload className="h-3.5 w-3.5" /> {subiendo ? 'Subiendo…' : 'Cambiar imagen'}
                            </button>
                          </div>
                        </div>
                      ) : d.tipo === 'textarea' ? (
                        <textarea id={id} className="duna-input" rows={2} value={String(valor ?? '')} onChange={e => editar(i, d.name, e.target.value)} aria-describedby={d.hint ? `${id}-hint` : undefined} />
                      ) : (
                        <input id={id} className="duna-input" value={String(valor ?? '')} onChange={e => editar(i, d.name, e.target.value)} aria-describedby={d.hint ? `${id}-hint` : undefined} />
                      )}
                      {d.hint && <p className="duna-field__hint" id={`${id}-hint`}>{d.hint}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div>
        <button type="button" onClick={agregar} disabled={alMax || subiendo} className="duna-btn duna-btn--secondary duna-btn--sm">
          <Plus className="h-3.5 w-3.5" /> {campoImagen ? (subiendo ? 'Subiendo…' : `Agregar ${itemLabel.toLowerCase()}`) : `Agregar ${itemLabel.toLowerCase()}`}
        </button>
        {alMax && (
          <p className="duna-field__hint" style={{ margin: '6px 0 0' }}>
            Llegaste al máximo de {max} {itemLabel.toLowerCase()}s. Quita alguno para agregar otro.
          </p>
        )}
      </div>

      {/* Confirmación de borrado — reusa ConfirmDescartarDialog (superficie centrada que NO descarta
          al tocar fuera, foco en la acción segura). El artículo del título sale de `genero`. */}
      <ConfirmDescartarDialog
        abierto={porEliminar !== null}
        onDescartar={() => { const i = porEliminar; setPorEliminar(null); if (i !== null) quitar(i); }}
        onSeguir={() => setPorEliminar(null)}
        titulo={`¿Eliminar est${genero === 'f' ? 'a' : 'e'} ${itemLabel.toLowerCase()}?`}
        descripcion="Se quita de la lista. Recuerda publicar para aplicar el cambio en la tienda."
        confirmLabel="Eliminar"
        seguirLabel="Conservar"
      />
    </div>
  );
}
