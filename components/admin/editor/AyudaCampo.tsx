'use client';

import { HelpCircle } from 'lucide-react';
import { DunaTooltip } from '@/components/admin/DunaTooltip';

// LA AYUDA CORTA (§ EDITOR-VISUAL-NIVELES-1, REDISENO.md § 3 / el prototipo, `.hint`): el spec pide
// "cada campo lleva como mucho UNA línea gris corta; lo largo... pasa a un «?» con detalle al pasar
// el mouse o tocar". Los ~150 `hint` de `tienda-secciones.ts` (+ los de los editores bespoke) NO se
// reescriben uno por uno — eso sería cambiar CONTENIDO para resolver un problema de FORMA, y además
// 150 reescrituras manuales no se pueden auditar contra "sigue diciendo lo mismo". En su lugar, este
// módulo DERIVA la versión corta de la que ya existe: un hint que ya cabe en una línea se muestra
// completo (sin «?», nada que ocultar); uno más largo se corta en la primera oración (o, si no hay
// una cerca, en la última palabra que entra) y el texto COMPLETO queda detrás del «?».
//
// El umbral es un conteo de CARACTERES, no de ANCHO real: medir el ancho real exigiría un layout
// pass (ResizeObserver/canvas) por cada campo del panel, y el panel mide ~280px de columna útil a
// Hanken Grotesk 12.5px — alrededor de 60-70 caracteres por línea. 70 es conservador (se corta antes
// de que el texto real llegue a envolver), y un texto que corre un poco más angosto en un campo
// angosto sigue siendo UNA línea, nunca dos.
const LARGO_AYUDA_CORTA = 70;

/** Deriva `{ corta, completa }` de un hint completo. `completa` es `null` cuando el hint YA cabe en
 *  una línea corta — ahí no hay nada que ocultar detrás de un «?». Puro, sin JSX: se prueba sin
 *  montar React (`AyudaCampo.test.ts`). */
export function partirAyuda(hint: string): { corta: string; completa: string | null } {
  const texto = hint.trim();
  if (texto.length <= LARGO_AYUDA_CORTA) return { corta: texto, completa: null };
  // Preferí cortar al FINAL DE LA PRIMERA ORACIÓN si cae dentro del presupuesto — es el corte que
  // menos miente ("Vacío: se usa el texto por defecto." es una oración completa, no un fragmento
  // colgando). Si la primera oración ya se pasa del presupuesto, no hay oración corta que mostrar:
  // se corta por palabra con elipsis.
  const finOracion = texto.indexOf('. ');
  if (finOracion > 0 && finOracion + 1 <= LARGO_AYUDA_CORTA) {
    return { corta: texto.slice(0, finOracion + 1), completa: texto };
  }
  const corte = texto.lastIndexOf(' ', LARGO_AYUDA_CORTA);
  const corta = `${corte > 0 ? texto.slice(0, corte) : texto.slice(0, LARGO_AYUDA_CORTA)}…`;
  return { corta, completa: texto };
}

/** El reemplazo DIRECTO de `<p className="duna-field__hint">{hint}</p>`: misma clase, mismo `id`
 *  (para el `aria-describedby` del campo), pero la línea larga se trunca y gana un «?» que abre el
 *  texto completo en un `DunaTooltip` (hover/foco — el repo no tiene un mecanismo de "tocar para
 *  abrir" fuera de eso; es la misma aproximación que ya usan los demás tooltips del panel). `null`/
 *  `''` no renderiza nada, igual que el `<p>` que reemplaza (varios call sites hacen `campo.hint &&
 *  <p>…`, y este componente puede recibir el string ya condicionado). */
export function AyudaCampo({ texto, id }: { texto: string | undefined; id?: string }) {
  if (!texto) return null;
  const { corta, completa } = partirAyuda(texto);
  return (
    <p className="duna-field__hint" id={id} style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: 0 }}>
      <span>{corta}</span>
      {completa && (
        <DunaTooltip content={completa}>
          <button type="button" className="editor-ayuda-mas" aria-label="Ver la ayuda completa de este campo">
            <HelpCircle aria-hidden width={16} height={16} />
          </button>
        </DunaTooltip>
      )}
    </p>
  );
}
