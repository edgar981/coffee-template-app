'use client';

import { Play } from 'lucide-react';

// EL BOTÓN «VER ANIMACIÓN» de un héroe de FIRMA (§ MOVIMIENTO-NIVEL-FIRMA-1, el spec: "en el
// editor, quietos… con «▶ Ver animación»"). H01/H02/H03 son `scrub` (pin + progreso de scroll) sin
// un campo «Animación» que las ofrezca —cada una NACE siendo una composición de `hero.variante`,
// nunca un ajuste sobre una zona—, así que no hay lugar para la vista previa genérica
// (`VistaMovimiento.tsx`, sólo para instancias con `animacionElemento`). El botón vive DENTRO del
// hero real, visible SÓLO en modo editor (`useModoEditorActivo`) — MISMO patrón que la zona «alto»
// de `HeroCurtina.tsx`: un control flotante que ningún visitante real llega a ver.
//
// Llama `reproducir()` del `MovimientoHandle` del hero — el MISMO mecanismo que T01-T06, porque las
// tres ganaron `'revelado'` a sus `clases` (§ `lib/movimiento/catalogo.ts`): `forzar=true` omite el
// `ScrollTrigger`/pin y corre el timeline entero una vez, dejándolo en su estado final.
export default function VerAnimacionHero({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
      style={{ background: 'rgba(20,19,17,.82)', color: '#f4f3ef', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <Play aria-hidden className="h-3.5 w-3.5" /> Ver animación
    </button>
  );
}
