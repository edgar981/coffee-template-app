# @duna/design-system

El sistema de diseño de **Duna OS**: tokens y primitivas de los que las pantallas
se **derivan**, no una copia del HTML de referencia.

Prueba de éxito: construir una pantalla que NO está en el HTML original usando
solo este sistema, sin inventar un valor nuevo.

## Frontera — AGNÓSTICO de tenant y de negocio

Este paquete no sabe qué es "Café Nayoli" ni "Pedidos". Solo conoce **roles**
(atención, confirmado, problema, tinta, papel…) y **primitivas** genéricas
(`steps`, `badge`, `card`, `insight`…). El contenido de cada vertical —qué
etiquetas tiene una secuencia de estados, qué widgets muestra el dashboard— vive
en la app que lo consume, nunca aquí. Es paquete AISLADO: no importa nada del
admin ni del storefront.

## Estructura

```
tokens/
  tokens.css      Única fuente de verdad. Variables CSS: color (light+dark),
                  tipografía (9 niveles), espaciado (base 4px), radios, sombras,
                  lavados de tinta, focus-ring, motion y --topbar-h.
  theme.css       Puente a Tailwind v4 (@theme inline): expone los tokens como
                  utilidades. Referencia, no duplica.
primitives/
  primitives.css  El catálogo como clases `duna-*`, derivado de los tokens.
  status.ts       Modelo de estado + la IMPOSIBILIDAD ESTRUCTURAL del "en curso".
reference.html    Página de referencia viva: renderiza tokens y primitivas.
                  Ábrela directo en el navegador — es la prueba.
```

## Consumo (Tailwind v4)

```css
@import "@duna/design-system/tokens/tokens.css";
@import "@duna/design-system/tokens/theme.css";
@import "@duna/design-system/primitives/primitives.css";
```

El tema oscuro se activa con `data-theme="dark"` en `<html>` (solo el admin lo
usa; el storefront es light-only).

## Decisiones que están cableadas en los tokens

- **Primario = tinta**, no ámbar. El ámbar (sol) queda reservado a "atención".
- **Sin azul.** "En curso" no es un color: es una posición. Ver más abajo.
- **Verde/rojo cálidos** (salvia / terracota) con `--ok-ink`/`--bad-ink` que
  pasan AA como texto; el fill/punto/borde usa `--ok`/`--bad`.
- **Tipografía: 9 niveles.** El 9º (`title`, 19px) separa el sujeto de una
  pantalla de sus subtítulos (se validó contra el detalle de orden).
- **Espaciado: base 4px**, con dos excepciones nombradas: `hairline` (2px) e
  `inline` (6px, solo adyacencia ícono/label). El 10px de listas plegó a 8
  (densidad sobre aire — Duna es panel de trabajo).
- **Acoples tokenizados**, nunca números mágicos: `--topbar-h` alimenta el offset
  del panel sticky (`top: calc(var(--topbar-h) + var(--space-6))`).

## "En curso" — imposibilidad estructural

La regla no depende de recordarla: es imposible de expresar. `BadgeTone` no tiene
un valor "en curso"/azul, así que no se puede pintar un badge de "En ruta". La
única API para "va en camino" es `progress(labels, current)`, que exige la
secuencia completa — la posición nunca viaja sin su camino. Detalle y ejemplos en
`primitives/status.ts`.
