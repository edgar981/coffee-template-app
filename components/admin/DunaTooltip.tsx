'use client';

import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Side = 'top' | 'right' | 'bottom' | 'left';

// TOOLTIP DUNA — ADMIN-LEVEL, no en el paquete (§ CLAUDE.md #29). El paquete
// `@duna/design-system` es presentacional puro: no tiene Radix ni un solo
// 'use client'. Meter ahí un tooltip que envuelve Radix introduciría conducta de
// cliente y rompería la opción C; por eso vive acá, como DunaSheet. El día de Fase B
// (el paquete adopta conducta) se muda.
//
// Envuelve el Radix de components/ui/tooltip con la ergonomía de un `content: string`
// —así el llamador no repite el triple Tooltip/Trigger/Content— y el `TooltipTrigger
// asChild` NO agrega ningún nodo al DOM: clona el hijo, así que es seguro para el
// layout de una celda o una barra. El `TooltipProvider` (delay) vive UNA vez en
// AdminChrome, no acá.
//
// El contenido es SIEMPRE un string: ningún tooltip del panel es un nodo (censo
// 2026-08-18). Si algún día uno necesita estructura, se revisa la firma entonces.
export function DunaTooltip({
  content,
  side,
  sideOffset,
  children,
}: {
  content: string;
  side?: Side;
  sideOffset?: number;
  children: ReactNode;
}) {
  // Sin texto no hay tooltip —y el trigger sigue funcionando igual—. Evita montar un
  // Content vacío cuando el dato es condicional (p. ej. una razón que puede no existir).
  if (!content) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
