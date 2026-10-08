'use client';

import { useRef, useState } from 'react';
import { clampDeslizador, pasoTeclado, atraerAMarca, type MarcaEtiquetada } from '@/lib/admin/deslizador';
import { AyudaCampo } from '@/components/admin/editor/AyudaCampo';

// EL DESLIZADOR CONTINUO (§ EDITOR-PANEL-DESLIZADORES-1) — el pedido del owner, revisando el editor
// (2026-10-05): «"Fondo: oscurecer para leer mejor" en vez de seleccionar 4 opciones debería
// haber... creo que es slider... el panel debería sentirse más interactivo». REEMPLAZA al `<select>`
// de opciones fijas (el combo "Nada·Suave·Medio·Fuerte") y al segmentado "Alto" por UN control:
// `TiendaSeccionEditor.tsx` lo monta para el velo (continuo, 0-100, con las cuatro posiciones de
// hoy marcadas) y `EstiloElementoControles.tsx` lo monta para el tamaño de un elemento (por pasos,
// sobre el set cerrado de `TAMANOS_ELEMENTO`) — mismo componente, dos usos, nunca dos
// implementaciones del mismo control (§ CLAUDE.md, "Una sola convención").
//
// LA ARITMÉTICA (clamp/paso/atracción/etiqueta) ES PURA — `lib/admin/deslizador.ts`, compartida con
// el render bespoke de la barra flotante en el storefront (`HeroMediaMarquesina.tsx`, que NO puede
// montar este componente: "ese documento es el storefront público, no puede traer Tailwind/el
// design-system del panel", § EstiloElementoControles.tsx). Este archivo es sólo el ENVOLTORIO
// visual sobre un `<input type="range">` nativo.
//
// INPUT vs. CHANGE — el eje central del contrato "autoguardado al soltar, no en cada píxel" (el
// spec): un `<input type="range">` dispara `onInput` CONTINUAMENTE mientras se arrastra (cada
// píxel) y `onChange` UNA sola vez, al soltar el mouse o al terminar un paso de teclado. `onCambiar`
// (live) va en `onInput` — la vista previa sigue a la perilla sin esperar nada—; `onCommit` (si no
// se pasa, cae a `onCambiar`) va en `onChange` — el único punto donde el LLAMADOR decide guardar.
//
// EL VALOR "DE HOY" PARA EL DOBLE CLIC lo captura el PROPIO componente, no el llamador: la PRIMERA
// vez que ve `valor` (al montar) — `useState(() => valor)`, nunca reasignado después. Doble clic
// vuelve ahí. Es la misma idea que "Ctrl+Z" de UN paso: deshace el arrastre EN CURSO, no abre un
// historial — y no exige que cada llamador calcule su propio "valor de fábrica" (el velo no tiene
// uno universal: para Nayoli es 100, para un tenant que ya traía 'suave' es 55).
export interface DeslizadorProps {
  id?: string;
  etiqueta: string;
  hint?: string;
  valor: number;
  min: number;
  max: number;
  /** Las posiciones con nombre que el deslizador marca y hacia las que "atrae" la perilla
   *  (`atraerAMarca`) cuando se suelta cerca. Ausente/vacío = sin marcas, sin atracción — el caso
   *  del deslizador por pasos (ahí CADA posición es una marca, y el paso de teclado ya la alcanza
   *  exacto, § `EstiloElementoControles.tsx`). */
  marcas?: readonly MarcaEtiquetada[];
  /** A cuántas unidades de una marca "atrae" la perilla. Sin efecto si `marcas` está vacío. */
  umbralAtraccion?: number;
  /** La magnitud de una flecha de teclado — 5 para el velo del hero, 1 para un deslizador por
   *  pasos (donde cada entero YA es un paso real). */
  pasoTeclado?: number;
  /** El texto que acompaña al control — "Medio · 65 %" para el velo, "Mediano" para el tamaño. */
  formatoValor: (valor: number) => string;
  onCambiar: (valor: number) => void;
  onCommit?: (valor: number) => void;
}

export default function Deslizador({
  id, etiqueta, hint, valor, min, max, marcas = [], umbralAtraccion = 3, pasoTeclado: paso = 1,
  formatoValor, onCambiar, onCommit,
}: DeslizadorProps) {
  const commit = onCommit ?? onCambiar;
  // MISMO patrón que `renderCampo` (`${id}-hint`): el `<AyudaCampo>` propio lleva el id al que el
  // input apunta con `aria-describedby`, en vez de pedirle al llamador que lo calcule afuera.
  const hintId = id ? `${id}-hint` : undefined;
  // § el docstring de cabecera, "EL VALOR DE HOY": inmutable tras el montaje.
  const [valorInicial] = useState(valor);
  // Evita doble-disparo cuando el gesto de teclado YA llamó a `commit` — el `onChange` nativo que
  // sigue a una tecla volvería a llamarlo con el MISMO valor; inocuo pero redundante. No es
  // estrictamente necesario (commit es idempotente), pero deja la intención clara: el teclado
  // decide por sí mismo cuándo confirma.
  const confirmadoPorTecladoRef = useRef(false);

  const normalizar = (crudo: number) => {
    const conAtraccion = marcas.length > 0 ? atraerAMarca(crudo, marcas.map((m) => m.valor), umbralAtraccion) : crudo;
    return clampDeslizador(conAtraccion, min, max);
  };

  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    onCambiar(normalizar(Number(e.currentTarget.value)));
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (confirmadoPorTecladoRef.current) { confirmadoPorTecladoRef.current = false; return; }
    commit(normalizar(Number(e.target.value)));
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const direccion = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
      : null;
    if (direccion === null) return;
    e.preventDefault();
    const siguiente = pasoTeclado(valor, direccion, paso, min, max);
    confirmadoPorTecladoRef.current = true;
    onCambiar(siguiente);
    commit(siguiente);
  };
  const onDoubleClick = () => {
    if (valorInicial === valor) return;
    onCambiar(valorInicial);
    commit(valorInicial);
  };

  return (
    <div className="duna-field">
      <div className="editor-deslizador__cabecera">
        <span className="duna-field__label">{etiqueta}</span>
        <span className="editor-deslizador__valor">{formatoValor(valor)}</span>
      </div>
      <div className="editor-deslizador__pista">
        <input
          id={id}
          type="range"
          role="slider"
          min={min}
          max={max}
          step={1}
          value={valor}
          aria-valuetext={formatoValor(valor)}
          aria-describedby={hintId}
          onInput={onInput}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onDoubleClick={onDoubleClick}
          className="editor-deslizador__input"
        />
        {marcas.map((m) => (
          <span
            key={m.valor}
            aria-hidden
            className="editor-deslizador__marca"
            style={{ left: `${((m.valor - min) / (max - min)) * 100}%` }}
          >
            {m.etiqueta}
          </span>
        ))}
      </div>
      <AyudaCampo texto={hint} id={hintId} />
    </div>
  );
}
