'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ATRIBUTO_RECORRIDO, PASOS_RECORRIDO, calcularFranjas, objetivoDisponible, posicionGlobo,
} from '@/lib/admin/recorrido-editor';

// EL RECORRIDO GUIADO (§ EDITOR-AYUDA-RECORRIDO-1) — la capa IMPURA sobre los datos puros de
// `lib/admin/recorrido-editor.ts`: busca en el DOM REAL el elemento que marca cada paso
// (`[data-tour="…"]`, escrito por `TiendaPaginas.tsx`/`Riel.tsx`/`ResumenPublicar.tsx`/
// `EditorTiendaPantallaCompleta.tsx`), mide su `getBoundingClientRect()`, y dibuja el resaltado +
// el globo con ese rect. Vive SOBRE todo el editor (no portaleado: el shell de
// `EditorTiendaPantallaCompleta` ya es `position:fixed; inset:0` sin transform/filter propio, así
// que un hijo `position:fixed` más adentro sigue siendo relativo al VIEWPORT, igual que si
// estuviera en `<body>` — no hace falta el puente de `dunaPortal.tsx`).
//
// LA TÉCNICA DEL "HUECO" ES POR SUSTRACCIÓN, NO POR RECORTE: cuatro franjas opacas (arriba, abajo,
// izquierda, derecha del objetivo, § `calcularFranjas`) rodean el rectángulo resaltado. Lo que
// queda SIN franja encima es, por construcción, la parte real de la pantalla — nunca se toca el
// z-index del elemento real ni el árbol que lo contiene (un `clip-path` sobre un solo div exigiría
// manipular las coordenadas de un polígono a mano y es más frágil entre navegadores para este caso).
//
// UN PASO SE SALTA SOLO cuando su objetivo no está disponible (§ `objetivoDisponible` —
// `display:none` colapsa el rect a 0×0, que cuenta igual que "no está en el DOM"): `primerDisponible`
// recorre los pasos en una dirección hasta encontrar uno medible, o hasta agotarlos. Es el ÚNICO
// mecanismo de salto — nadie fuerza `modo`/`pagina`/`nivelActivo` desde acá; el recorrido refleja el
// editor tal como está, nunca lo reconfigura por su cuenta (eso es decisión de
// `EditorTiendaPantallaCompleta.tsx` al INICIAR el recorrido, no de este componente mientras corre).
export interface RecorridoEditorProps {
  activo: boolean;
  onCerrar: () => void;
}

const MARGEN_HUECO = 10;
const GLOBO_ANCHO = 300;
// Alto ESTIMADO para decidir dónde cae el globo (§ `posicionGlobo`, puro: no mide el DOM él mismo).
// El contenido real (título corto + una frase + el pie de botones) rara vez lo supera; si lo hace,
// el globo simplemente crece un poco más allá de esta estimación — no se recorta, sólo se posiciona
// con un margen de sobra.
const GLOBO_ALTO_ESTIMADO = 190;

function medirObjetivo(id: string): DOMRect | null {
  const el = document.querySelector(`[${ATRIBUTO_RECORRIDO}="${id}"]`);
  return el ? el.getBoundingClientRect() : null;
}

/** El primer índice, desde `desde` en la dirección dada, cuyo objetivo mide algo — o `null` si
 *  ninguno de los que quedan en esa dirección está disponible ahora. */
function primerDisponible(desde: number, direccion: 1 | -1): number | null {
  for (let i = desde; i >= 0 && i < PASOS_RECORRIDO.length; i += direccion) {
    const rect = medirObjetivo(PASOS_RECORRIDO[i].id);
    if (objetivoDisponible(rect)) return i;
  }
  return null;
}

export function RecorridoEditor({ activo, onCerrar }: RecorridoEditorProps) {
  const [pasoIndex, setPasoIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const globoRef = useRef<HTMLDivElement>(null);

  // AL ACTIVARSE, arranca en el primer paso disponible — nunca asume que el 0 lo está.
  useEffect(() => {
    if (!activo) { setPasoIndex(null); setRect(null); return; }
    const inicio = primerDisponible(0, 1);
    if (inicio === null) { onCerrar(); return; }
    setPasoIndex(inicio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  const avanzar = useCallback((nuevo: number | null) => {
    if (nuevo === null) { onCerrar(); return; }
    setPasoIndex(nuevo);
  }, [onCerrar]);

  // MIDE el paso actual, y lo mantiene medido al redimensionar o scrollear (§ `.editor-panel`
  // scrollea su propia columna: un `scroll` normal no burbujea, pero SÍ se puede CAPTURAR desde
  // `window` con `{ capture: true }` — el mismo truco de siempre para "cualquier scroll de la
  // página, sin importar en qué contenedor ocurrió"). Si el objetivo deja de medir algo a mitad de
  // camino (la ventana se angostó y el panel pasó a apilado, p. ej.), AVANZA solo — nunca se queda
  // mostrando un hueco sobre nada.
  useEffect(() => {
    if (!activo || pasoIndex === null) return;
    const recalcular = () => {
      const r = medirObjetivo(PASOS_RECORRIDO[pasoIndex].id);
      if (!objetivoDisponible(r)) { avanzar(primerDisponible(pasoIndex + 1, 1)); return; }
      setRect(r);
    };
    recalcular();
    window.addEventListener('resize', recalcular);
    window.addEventListener('scroll', recalcular, true);
    return () => {
      window.removeEventListener('resize', recalcular);
      window.removeEventListener('scroll', recalcular, true);
    };
  }, [activo, pasoIndex, avanzar]);

  // FOCO en el globo al entrar a un paso nuevo — para que un lector de pantalla anuncie el título/
  // frase sin que el operador tenga que buscarlo, y para que Esc/flechas tengan un ancla clara.
  useEffect(() => {
    if (activo && pasoIndex !== null && rect) globoRef.current?.focus();
  }, [activo, pasoIndex, rect]);

  const siguiente = useCallback(() => {
    if (pasoIndex === null) return;
    avanzar(primerDisponible(pasoIndex + 1, 1));
  }, [pasoIndex, avanzar]);

  const anterior = useCallback(() => {
    if (pasoIndex === null) return;
    const prev = primerDisponible(pasoIndex - 1, -1);
    if (prev !== null) setPasoIndex(prev);
  }, [pasoIndex]);

  // TECLADO (§ el spec: "flechas y Esc"): activo sólo mientras el recorrido está en pantalla.
  useEffect(() => {
    if (!activo) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); siguiente(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activo, siguiente, anterior, onCerrar]);

  if (!activo || pasoIndex === null || !rect) return null;

  const paso = PASOS_RECORRIDO[pasoIndex];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cajaObjetivo = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  const franjas = calcularFranjas(cajaObjetivo, MARGEN_HUECO, vw, vh);
  const globoPos = posicionGlobo(cajaObjetivo, GLOBO_ANCHO, GLOBO_ALTO_ESTIMADO, vw, vh);
  const hayAnterior = primerDisponible(pasoIndex - 1, -1) !== null;
  const esUltimo = primerDisponible(pasoIndex + 1, 1) === null;

  return (
    <>
      <div className="editor-tour-franja" style={{ top: franjas.arriba.top, left: franjas.arriba.left, width: franjas.arriba.width, height: franjas.arriba.height }} />
      <div className="editor-tour-franja" style={{ top: franjas.abajo.top, left: franjas.abajo.left, width: franjas.abajo.width, height: franjas.abajo.height }} />
      <div className="editor-tour-franja" style={{ top: franjas.izquierda.top, left: franjas.izquierda.left, width: franjas.izquierda.width, height: franjas.izquierda.height }} />
      <div className="editor-tour-franja" style={{ top: franjas.derecha.top, left: franjas.derecha.left, width: franjas.derecha.width, height: franjas.derecha.height }} />
      <div
        aria-hidden
        className="editor-tour-anillo"
        style={{
          top: rect.top - MARGEN_HUECO, left: rect.left - MARGEN_HUECO,
          width: rect.width + MARGEN_HUECO * 2, height: rect.height + MARGEN_HUECO * 2,
        }}
      />
      <div
        ref={globoRef}
        className="editor-tour-globo"
        style={{ top: globoPos.top, left: globoPos.left, width: GLOBO_ANCHO }}
        role="dialog"
        aria-label={`Recorrido guiado: ${paso.titulo}`}
        tabIndex={-1}
      >
        <div className="editor-tour-globo__contador">{pasoIndex + 1} de {PASOS_RECORRIDO.length}</div>
        <h3>{paso.titulo}</h3>
        <p>{paso.frase}</p>
        <div className="editor-tour-globo__pie">
          <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={onCerrar}>
            Saltar
          </button>
          <div className="editor-tour-globo__nav">
            <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={anterior} disabled={!hayAnterior}>
              Anterior
            </button>
            <button type="button" className="duna-btn duna-btn--primary duna-btn--sm" onClick={siguiente}>
              {esUltimo ? 'Terminar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default RecorridoEditor;
