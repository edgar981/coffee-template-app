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

// § EDITOR-ESTADO-PAGINAS-1 (G8) — el recorte buscaba el PRIMER ". " a secas, así que un hint que
// empieza con una abreviatura ("Ej. …", "p. ej. …") cortaba justo AHÍ: la corta quedaba en "Ej." o
// "…, p.", sola, sin ninguna oración completa detrás. Estas tres son las que el REGISTRO usa hoy
// (tienda-secciones.ts); no es un parser de abreviaturas general, es el set CERRADO que aparece en
// este dominio — si el día de mañana aparece otra ("Sr.", "Ud."), se agrega acá, nunca a ciegas.
const ABREVIATURAS = new Set(['ej', 'p']);

/** `true` si el "." en `indicePunto` es el de una abreviatura conocida (la palabra INMEDIATAMENTE
 *  antes, sin importar qué la precede — paréntesis, comillas — es "ej" o "p"), no el fin real de
 *  una oración. */
function esPuntoDeAbreviatura(texto: string, indicePunto: number): boolean {
  const m = texto.slice(0, indicePunto).match(/([A-Za-zÁÉÍÓÚÑáéíóúñ]+)$/);
  return !!m && ABREVIATURAS.has(m[1].toLowerCase());
}

/** El índice (del ".") del ÚLTIMO fin de oración REAL (no abreviatura) que todavía entra en
 *  `limite` caracteres — recorre TODOS los ". " del texto, no sólo el primero: un hint de varias
 *  oraciones cortas muestra tantas como entren, nunca se detiene en la primera si una segunda
 *  (p. ej. la advertencia de composición, "No aplica si…") también cabe. `-1` si ni la primera
 *  oración real entra. */
function ultimoFinDeOracionDentroDe(texto: string, limite: number): number {
  let desde = 0;
  let ultimo = -1;
  for (;;) {
    const i = texto.indexOf('. ', desde);
    if (i < 0) break;
    if (esPuntoDeAbreviatura(texto, i)) { desde = i + 2; continue; }
    if (i + 1 > limite) break; // esta oración (y cualquiera después) ya no entra
    ultimo = i;
    desde = i + 2;
  }
  return ultimo;
}

/** Deriva `{ corta, completa }` de un hint completo. `completa` es `null` cuando el hint YA cabe en
 *  una línea corta — ahí no hay nada que ocultar detrás de un «?». Puro, sin JSX: se prueba sin
 *  montar React (`AyudaCampo.test.ts`). */
export function partirAyuda(hint: string): { corta: string; completa: string | null } {
  const texto = hint.trim();
  if (texto.length <= LARGO_AYUDA_CORTA) return { corta: texto, completa: null };
  // Preferí cortar al final de la ÚLTIMA oración real que entra — es el corte que menos miente
  // ("Vacío: se usa el texto por defecto." es una oración completa, no un fragmento colgando), y
  // nunca dentro de una (una advertencia como "No aplica si…" se muestra ENTERA o no se muestra,
  // jamás cortada a la mitad). Si ni la primera oración real entra, no hay oración corta que
  // mostrar: se corta por palabra con elipsis — eso SÍ puede caer a mitad de una oración larga, pero
  // nunca a mitad de una abreviatura (`esPuntoDeAbreviatura` ya las saltó antes de llegar acá).
  const finOracion = ultimoFinDeOracionDentroDe(texto, LARGO_AYUDA_CORTA);
  if (finOracion >= 0) {
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
 *  <p>…`, y este componente puede recibir el string ya condicionado).
 *
 *  § EDITOR-ESTADO-PAGINAS-1 (G6) — `soloIcono` es un SEGUNDO modo, para una fila sin espacio para
 *  ninguna línea corta al lado (el toggle de página, § TogglePagina.tsx): sin él, el `<p>` siempre
 *  imprime la versión corta — correcto en una columna de formulario, pero en una fila apretada esa
 *  corta terminaba truncada a casi nada ("Ej.", § G8). Con `soloIcono`, el «?» es lo ÚNICO visible y
 *  abre el texto COMPLETO (nunca `partirAyuda`, que existe sólo para decidir qué mostrar AL LADO del
 *  «?» — acá no hay nada al lado). */
export function AyudaCampo({ texto, id, soloIcono }: { texto: string | undefined; id?: string; soloIcono?: boolean }) {
  if (!texto) return null;
  if (soloIcono) {
    return (
      <DunaTooltip content={texto}>
        <button type="button" className="editor-ayuda-mas" aria-label="Ver la ayuda de este campo" id={id}>
          <HelpCircle aria-hidden width={16} height={16} />
        </button>
      </DunaTooltip>
    );
  }
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
