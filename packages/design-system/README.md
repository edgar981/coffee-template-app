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

duna-modales.html        Maqueta de los diálogos de Pedidos (H6). NO es espec ni
duna-modales.NOTES.md    fuente de valores — trae su propia copia de los tokens,
                         que ya derivó, y dibuja features que el dominio no tiene.
                         LEER LA NOTA ANTES QUE EL HTML.

duna-os.html             Maqueta completa de Duna OS (siete vistas). De ella salió
duna-os.NOTES.md         la forma de móvil. Cubre la navegación y NO cubre el panel
                         del split — de hecho REPRODUCE ese defecto.
                         LEER LA NOTA ANTES QUE EL HTML.
```

La diferencia entre `reference.html` y las maquetas importa: aquélla enlaza los
tokens reales del paquete y **se rompe si el sistema se rompe**; las maquetas están
desconectadas, y por eso cada una necesita su lectura crítica al lado.

### La regla: una maqueta entra CON su lectura, y ANTES de la tanda

**Toda maqueta que informe una tanda entra al repo con su nota crítica antes de que
la tanda arranque.** No al final, como registro: al principio, como insumo.

Son tres las tandas que empezaron pidiendo una maqueta que vivía fuera del repo
(§ Backlog técnico #4, H6, y la de móvil). El costo no es el archivo perdido — es
que la primitiva no tiene contra qué verificarse, y que la maqueta se lee como
espec por el simple hecho de existir.

La nota separa **tres capas**, y separarlas es todo el trabajo:

- **INTENCIÓN DE FORMA** — se adopta.
- **NO fuente de VALORES** — los valores salen del paquete. Una maqueta trae su
  copia de los tokens, y esa copia ya derivó o va a derivar. Un valor escrito como
  literal donde el paquete tiene token es el estado exacto desde el cual deriva,
  aunque hoy coincida.
- **NO fuente de ALCANCE** — features dibujadas ≠ features decididas. Cada una es
  una decisión de producto que se toma cuando toque, no porque esté dibujada.

Y la maqueta entra **sin editar**: es evidencia de lo que se diseñó. Las
correcciones van en la nota.

## Consumo (Tailwind v4)

```css
@import "@duna/design-system/tokens.css";
@import "@duna/design-system/primitives.css";
```

**`theme.css` NO va en esa lista.** Es el puente a `@theme` de Tailwind y sus
nombres son el contrato de Tailwind (`--color-muted`, `--font-display`…), así que
no pueden llevar el prefijo `--duna-` y vuelven a colisionar con el theme del
consumidor — sin scope posible, porque `@theme` es global por construcción. Se
importa solo en una app cuyo theme de Tailwind SEA el de Duna (Fase B). Detalle
completo en el encabezado del archivo.

Dos cosas que este bloque tuvo mal desde el principio y que sólo aparecen al
consumir el paquete de verdad:

- **Las rutas son las del `exports`, no las internas.** Decía
  `@duna/design-system/tokens/tokens.css`, y ninguna de las tres líneas resolvía:
  el mapa declara `./tokens.css`. Las claves son planas a propósito — la
  estructura interna del paquete puede moverse sin romperle nada a nadie, que es
  para lo que existe un mapa de exports.
- **Las entradas CSS necesitan la condición `style`.** Es la que consulta el
  resolvedor de `@import` de Tailwind v4; sin ella el import falla con *"is not
  exported under the condition style"* aunque la ruta sea correcta. Llevan además
  `default`, para el consumidor que importe el CSS desde un módulo JS/TSX
  (`import "@duna/design-system/tokens.css"`), que es el otro camino válido en
  Next y no pasa por `style`.

Las dos son la misma clase de falla: `reference.html` enlaza los CSS por ruta
**relativa**, así que la prueba viva del paquete nunca ejerció el mapa de exports.
**Un paquete verificado en aislamiento no está verificado para ser consumido** —
lo que la prueba viva demuestra es que el sistema es coherente, no que se pueda
instalar.

El tema oscuro se activa con `data-theme="dark"` en `<html>` (solo el admin lo
usa; el storefront es light-only). El DS no aprende la convención de nadie: un
consumidor que ya use otra (p. ej. la clase `.dark` de next-themes) escribe las
dos — `attribute={["class","data-theme"]}`.

### Los tokens llevan prefijo `--duna-`, los 80, sin excepción

Las custom properties son un espacio de nombres global: un `--border` declarado
por el sistema le pisa el suyo a la app. El invariante se verifica de un grep:

```bash
grep -nE '^[[:space:]]*--' packages/design-system/tokens/tokens.css | grep -v -- '--duna-'
```

Vacío = correcto. El porqué —y por qué no bastaba un scope por elemento, y la
trampa que tiene reemplazarlos en masa— está en el encabezado de
`tokens/tokens.css`.

### Las FAMILIAS tipográficas las provee el consumidor

El sistema declara el ROL — `--duna-font-ui` / `--duna-font-display` /
`--duna-font-mono` — y el nombre de familia es solo el default. Un consumidor que
auto-hospede sus fuentes sobreescribe esos tres tokens: `next/font` registra un
nombre GENERADO, así que el literal `'Space Grotesk'` no resuelve aunque la fuente
esté cargada. Misma frontera que `brand` en `@duna/core`.

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
