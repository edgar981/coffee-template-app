'use client';

import { Plus, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { opcionesVivas, type MoliendaOpcion, type ProblemaOpciones } from '@duna/core/moliendas-opciones';

// ─── Opciones de molienda para el cliente ────────────────────────────────────
// La UI que faltaba: el tipo prometía "el admin activa nuevas moliendas con
// `disponible` — sin cambios de código" y hasta hoy la única vía era un UPDATE a
// mano sobre el Json.
//
// OJO — este editor gestiona `Product.moliendasOpciones` (lo que el CLIENTE elige
// en la página de producto) y NO `Product.molienda` (ficha técnica: "esta bolsa es
// molienda Media"). Son campos distintos; de ahí el label largo.
//
// Editar esto es OPERAR LA TIENDA, no llenar un campo de la ficha: con el fix
// híbrido-por-cardinalidad, cuántas opciones queden disponibles decide si la card
// del catálogo agrega directo o manda al detalle a elegir. Por eso la ayuda no es
// decorativa — es la única parte de la pantalla que dice qué se está cambiando.

interface Props {
  opciones: MoliendaOpcion[];
  onChange: (opciones: MoliendaOpcion[]) => void;
  /**
   * Índices marcados para quitar AL GUARDAR. Quitar es deshacible hasta entonces
   * (decisión del owner): la fila se queda a la vista, tachada y con "Deshacer".
   */
  quitadas: Set<number>;
  onToggleQuitada: (i: number) => void;
  /** Problemas ya calculados por `validarOpciones`. Se pintan al intentar guardar. */
  problemas: ProblemaOpciones[];
  /** Bloquea la edición mientras la mutación viaja (la mitad de estado de la guarda). */
  disabled?: boolean;
}

export function MoliendasOpcionesEditor({
  opciones, onChange, quitadas, onToggleQuitada, problemas, disabled,
}: Props) {
  // Los conteos hablan del RESULTADO de guardar, no de lo que hay en pantalla:
  // una fila marcada ya no cuenta como opción ni como disponible. Si contara, la
  // línea diría "1 disponible" mientras el guardado deja cero.
  const vivas       = opcionesVivas(opciones, quitadas);
  const disponibles = vivas.filter(o => o.disponible).length;
  // Filas señaladas por algún problema, para el borde rojo. Un Set porque una fila
  // puede aparecer en dos problemas (sin nombre Y repetida).
  const filasConProblema = new Set(problemas.flatMap(p => p.indices));

  const actualizar = (i: number, patch: Partial<MoliendaOpcion>) =>
    onChange(opciones.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  // Agregar APENDIZA — nunca reordena ni reindexa, que es lo que mantiene válidos
  // los índices de `quitadas` mientras el modal está abierto.
  const agregar = () => onChange([...opciones, { nombre: '', metodo: '', disponible: true }]);

  return (
    <div className="col-span-2">
      <Label>Opciones de molienda para el cliente</Label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {vivas.length === 0
          ? 'Sin opciones — este producto no pide molienda.'
          : `${vivas.length} ${vivas.length === 1 ? 'opción' : 'opciones'} · ${disponibles} disponible${disponibles === 1 ? '' : 's'}`}
        {quitadas.size > 0 && ` · ${quitadas.size} se ${quitadas.size === 1 ? 'quitará' : 'quitarán'} al guardar`}
      </p>

      {opciones.length > 0 && (
        <div className="mt-2 space-y-2">
          {/* key por índice, y acá es SEGURO y no una concesión: con el quitar
              diferido nada se reindexa mientras el modal está abierto —agregar
              apendiza, quitar solo marca— así que el índice de una fila no cambia
              nunca. Es la misma propiedad que hace estable al Set de `quitadas`.
              Si alguna vez se agrega reordenamiento, esto necesita un id propio. */}
          {opciones.map((opcion, i) => {
            const quitada = quitadas.has(i);
            const etiqueta = opcion.nombre || 'esta molienda';
            return (
              <div
                key={i}
                className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 ${
                  quitada
                    ? 'border-dashed border-border/60 bg-muted/40'
                    : filasConProblema.has(i)
                      ? 'border-destructive/60 bg-muted/20'
                      : 'border-border/60 bg-muted/20'
                }`}
              >
                <div className="min-w-[140px] flex-1">
                  <span className="text-xs text-muted-foreground">Nombre</span>
                  <Input
                    value={opcion.nombre}
                    onChange={e => actualizar(i, { nombre: e.target.value })}
                    disabled={disabled || quitada}
                    className={`mt-0.5 h-9 ${quitada ? 'line-through opacity-60' : ''}`}
                    placeholder="Media"
                  />
                </div>
                <div className="min-w-[160px] flex-[1.4]">
                  <span className="text-xs text-muted-foreground">Método (texto del chip)</span>
                  <Input
                    value={opcion.metodo}
                    onChange={e => actualizar(i, { metodo: e.target.value })}
                    disabled={disabled || quitada}
                    className={`mt-0.5 h-9 ${quitada ? 'line-through opacity-60' : ''}`}
                    placeholder="Filtro / Greca tradicional"
                  />
                </div>
                {/* El toggle es la decisión real de esta pantalla: `disponible` es lo
                    que el storefront cuenta para decidir card vs. detalle. */}
                <label className="flex shrink-0 cursor-pointer items-center gap-2 self-end pb-2 pl-1">
                  <Switch
                    checked={opcion.disponible}
                    onCheckedChange={v => actualizar(i, { disponible: v })}
                    disabled={disabled || quitada}
                    aria-label={`Disponible: ${opcion.nombre || 'molienda sin nombre'}`}
                  />
                  <span className={`text-xs text-muted-foreground ${quitada ? 'opacity-60' : ''}`}>
                    Disponible
                  </span>
                </label>
                {/* La X marca, no borra. Se vuelve "Deshacer" en el MISMO lugar para
                    que la corrección esté donde el dedo ya está. */}
                {quitada ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5 self-end px-2 text-xs"
                    onClick={() => onToggleQuitada(i)}
                    disabled={disabled}
                    aria-label={`Deshacer: conservar ${etiqueta}`}
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Deshacer
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructiveGhost"
                    size="sm"
                    className="h-9 w-9 shrink-0 self-end p-0"
                    onClick={() => onToggleQuitada(i)}
                    disabled={disabled}
                    aria-label={`Quitar ${etiqueta}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 gap-1.5"
        onClick={agregar}
        disabled={disabled}
      >
        <Plus className="h-3.5 w-3.5" /> Agregar molienda
      </Button>

      {/* La línea que explica QUÉ controla esto. Sin ella, el operador cambia un
          toggle y el comportamiento de la tienda cambia sin que nada lo anuncie. */}
      <p className="mt-2 text-xs text-muted-foreground">
        Con una sola molienda disponible, la tarjeta de la tienda agrega directo; con
        varias, lleva al detalle para elegir.
      </p>

      {problemas.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {problemas.map(p => (
            <li key={p.codigo} className="text-xs text-destructive">{p.mensaje}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
