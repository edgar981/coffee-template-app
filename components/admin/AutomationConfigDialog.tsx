'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AutomationDef, ConfigCampo } from '@/constants/automations';

// Diálogo de configuración de UNA automatización, generado a partir de `campos`
// del registry. Añadir un ajuste nuevo = añadir un campo al `configSchema` y una
// entrada a `campos`; este componente no cambia.
//
// El servidor revalida TODO contra el `configSchema`: los `min`/`max` de aquí son
// ayuda de UI, no la barrera. Un valor fuera de rango lo corrige el zod al guardar.

interface Props {
  def:      AutomationDef;
  config:   Record<string, unknown>;
  open:     boolean;
  onOpenChange: (open: boolean) => void;
  onSave:   (config: Record<string, unknown>) => void;
}

/** `8` → `08:00`, para el input type="time". */
const horaAInput = (v: unknown) => `${String(Number(v ?? 0)).padStart(2, '0')}:00`;
/** `08:30` → `8` (los barridos corren por hora; los minutos no aplican). */
const inputAHora = (v: string) => Number(v.split(':')[0] ?? 0);

export default function AutomationConfigDialog({ def, config, open, onOpenChange, onSave }: Props) {
  const [valores, setValores] = useState<Record<string, unknown>>(config);

  // Reabrir con la config vigente: el diálogo se monta por card, y `key` en el
  // padre lo remonta cuando cambian los valores guardados.
  const set = (name: string, valor: unknown) =>
    setValores(prev => ({ ...prev, [name]: valor }));

  const campo = (c: ConfigCampo) => {
    const id = `${def.key}-${c.name}`;
    return (
      <div key={c.name} className="space-y-1.5">
        <Label htmlFor={id} className="text-sm">{c.label}</Label>

        {c.tipo === 'numero' && (
          <div className="flex items-center gap-2">
            <Input
              id={id} type="number" inputMode="numeric"
              min={c.min} max={c.max}
              value={String(valores[c.name] ?? '')}
              onChange={e => set(c.name, e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32"
            />
            {c.sufijo && <span className="text-sm text-muted-foreground">{c.sufijo}</span>}
          </div>
        )}

        {c.tipo === 'hora' && (
          <Input
            id={id} type="time" step={3600}
            value={horaAInput(valores[c.name])}
            onChange={e => set(c.name, inputAHora(e.target.value))}
            className="w-32"
          />
        )}

        {c.tipo === 'texto' && (
          <Textarea
            id={id} rows={2} maxLength={c.maxLength}
            value={String(valores[c.name] ?? '')}
            onChange={e => set(c.name, e.target.value)}
          />
        )}

        {c.tipo === 'emails' && (
          <Input
            id={id} type="text" placeholder="correo@ejemplo.com, otro@ejemplo.com"
            value={String(valores[c.name] ?? '')}
            onChange={e => set(c.name, e.target.value)}
          />
        )}

        {c.ayuda && <p className="text-xs text-muted-foreground leading-relaxed">{c.ayuda}</p>}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{def.nombre}</DialogTitle>
          <DialogDescription>{def.disparador}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">{def.campos.map(campo)}</div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(valores); onOpenChange(false); }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
