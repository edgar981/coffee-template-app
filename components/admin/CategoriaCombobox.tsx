"use client";
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';
import { cn } from '@duna/core/utils';

// ═══ EL COMBOBOX DE CATEGORÍA · elegir de la lista, o escribir una nueva ═════
//
// La taxonomía se DERIVA del catálogo (§ CLAUDE.md · La taxonomía se DERIVA del
// catálogo): no hay un set cerrado, así que el campo categoría es texto libre
// CON una lista de las categorías que YA existen. Un `<input list>` con datalist
// hacía las dos cosas pero la lista NO SE VE —se comporta como un campo de texto
// y hay que adivinar que existe—. Este combobox pone la lista DESPLEGABLE
// visible como el camino PRIMARIO y deja escribir una nueva como el ESCAPE.
//
// ── NO ES UNA PRIMITIVA NUEVA ───────────────────────────────────────────────
//
// Es el ENSAMBLAJE canónico de shadcn: `Popover` (la superficie) + `Command`
// (cmdk, la lista filtrable). Las dos ya existen y ya se usan en el panel
// (`DateField`/`DateRangePicker` montan Popover; `CommandPalette` monta Command).
// No se agrega conducta al design-system —eso sería el cambio de naturaleza que
// la opción C evitó—: se compone lo que ya está.
//
// ── EL POPOVER PORTALEA AL PUENTE, como DateField ───────────────────────────
//
// `container={contenedor}` monta el desplegable DENTRO de `.admin-shell`, no en
// `<body>`, para que herede el puente de familias tipográficas y aparezca sobre
// el sheet (este combobox vive dentro de `ProductFormModal`, que es un DunaSheet).
// Es el mismo camino que ya prueba `DateField` (popover-en-sheet).
//
// ── FILTRADO MANUAL (`shouldFilter={false}`) ────────────────────────────────
//
// cmdk filtra por defecto, pero acá el afford de "usar una categoría NUEVA que
// no está en la lista" tiene que aparecer JUSTO cuando lo tecleado no matchea —y
// eso es más limpio controlando el filtro a mano que peleando con el de cmdk—.

export function CategoriaCombobox({ value, onChange, categorias, id, placeholder = 'Elige una categoría', disabled, ariaInvalid, ariaDescribedby, compacto }: {
  value: string;
  onChange: (v: string) => void;
  /** Las categorías EXISTENTES del catálogo (derivadas). Puede venir vacía (catálogo sin
   *  categorías todavía) — ahí sólo se puede escribir una nueva. */
  categorias: string[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedby?: string;
  /** Compacto para caber en una celda de grilla (el import). */
  compacto?: boolean;
}) {
  const contenedor = useContenedorDunaPortal();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim();
  const filtradas = q ? categorias.filter(c => c.toLowerCase().includes(q.toLowerCase())) : categorias;
  // Match EXACTO (case-insensitive): el filtro del storefront compara `p.categoria === cat`,
  // así que "usar «Café»" cuando ya existe "Café" sólo confundiría — no se ofrece crear un
  // duplicado que el ojo lee igual.
  const hayExacta = categorias.some(c => c.toLowerCase() === q.toLowerCase());

  const elegir = (v: string) => { onChange(v); setQuery(''); setAbierto(false); };

  return (
    <Popover open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        {/* `duna-input` para medir y verse EXACTAMENTE como los campos de al lado (como DateField):
            es un campo, no un botón que abre algo. `text-align:left` porque un botón centra. */}
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedby}
          disabled={disabled}
          className="duna-input"
          style={{
            textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
            ...(compacto ? { padding: '4px 8px', fontSize: '0.82rem' } : null),
          }}
        >
          <span style={value ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : { color: 'var(--duna-muted)' }}>
            {value || placeholder}
          </span>
          <ChevronsUpDown style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" container={contenedor} style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '12rem' }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar o escribir…" value={query} onValueChange={setQuery} />
          <CommandList>
            {filtradas.length === 0 && !q && <CommandEmpty>Aún no hay categorías. Escribe la primera.</CommandEmpty>}
            {filtradas.length > 0 && (
              <CommandGroup heading="Categorías">
                {filtradas.map(c => (
                  <CommandItem key={c} value={c} onSelect={() => elegir(c)}>
                    <Check className={cn('mr-2 h-4 w-4', value === c ? 'opacity-100' : 'opacity-0')} />
                    {c}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {q && !hayExacta && (
              <CommandGroup heading="Nueva">
                <CommandItem value={`__crear__${q}`} onSelect={() => elegir(q)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Usar «{q}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
