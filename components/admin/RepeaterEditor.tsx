'use client';

import { useState } from 'react';
import { Star, ArrowUp, ArrowDown, Trash2, Plus, Pencil } from 'lucide-react';
import type { CampoItem } from '@/components/admin/tienda-secciones';

// EDITOR DE LISTA (repeater) GENÉRICO — agregar / quitar / editar / reordenar (flechas) ítems, con
// cada ítem COLAPSADO a un renglón-resumen y expandible para editar. La maquinaria NO sabe nada de
// testimonios ni de fotos: opera sobre `descriptores` (nombre + tipo + rol de resumen). El mismo
// componente sirve a la galería variable de /nosotros (tanda 2) cambiando sólo los descriptores.
//
// CONTROLADO: el array `items` lo posee el padre (`TiendaSeccionEditor`), para que TODO cambio pase
// por `onChange` → el mismo marcar-sucio + autoguardado que un campo plano. Agregar, quitar y mover
// también llaman a `onChange` (no son onChange de input — son los que más fácil se olvidan). Lo
// único LOCAL es qué ítem está expandido (estado de UI, no contenido).

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
  onChange,
}: {
  items: Item[];
  descriptores: CampoItem[];
  itemLabel: string;
  onChange: (nuevos: Item[]) => void;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);

  const editar = (i: number, campo: string, valor: unknown) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  const agregar = () => {
    const nuevo: Item = Object.fromEntries(descriptores.map(d => [d.name, d.defaultValor ?? '']));
    onChange([...items, nuevo]);
    setExpandido(items.length); // expandir el nuevo para llenarlo
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
        return (
          <div key={i} className="duna-card" style={{ padding: 'var(--duna-space-3)' }}>
            {/* Renglón-resumen: título + fragmento a la izquierda; controles a la derecha. */}
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
                <button type="button" onClick={() => quitar(i)} aria-label={`Quitar ${itemLabel.toLowerCase()}`} className="duna-btn duna-btn--ghost duna-btn--sm"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {/* Expandido: los campos del ítem, por tipo. */}
            {abierto && (
              <div className="duna-form" style={{ marginTop: 'var(--duna-space-3)' }}>
                {descriptores.map(d => {
                  const id = `item-${i}-${d.name}`;
                  const valor = item[d.name];
                  const full = d.tipo === 'textarea';
                  return (
                    <div key={d.name} className={`duna-field${full ? ' duna-form__full' : ''}`}>
                      <label className="duna-field__label" htmlFor={d.tipo === 'rating' ? undefined : id}>{d.label}</label>
                      {d.tipo === 'rating' ? (
                        <RatingInput valor={Number(valor) || 0} onChange={v => editar(i, d.name, v)} />
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
        <button type="button" onClick={agregar} className="duna-btn duna-btn--secondary duna-btn--sm">
          <Plus className="h-3.5 w-3.5" /> Agregar {itemLabel.toLowerCase()}
        </button>
      </div>
    </div>
  );
}
