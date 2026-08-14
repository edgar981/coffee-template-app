# Cómo se lee `duna-os.html`

Maqueta completa de Duna OS — siete vistas más el drawer de producto. **No es una
especificación.** Esta nota fija qué se adopta y qué no.

Entra al repo **sin editar**, a propósito: es evidencia de lo que se diseñó. Las
correcciones van acá, no en el archivo. Mismo trato que `duna-modales.html`.

No confundir con `reference.html`, que es la **prueba viva** del sistema: aquélla
enlaza los tokens reales del paquete y se rompe si el sistema se rompe. Ésta trae
su propia copia de los valores y no está conectada a nada.

Contexto: § Backlog técnico #9 (Duna OS en móvil) de `CLAUDE.md`. Se leyó para la
tanda de móvil, y de ella salieron `.duna-sheet`, el token de safe-area y la forma
de la barra inferior.

---

## 0 · LO PRIMERO: cubre 9.2 y NO cubre 9.1

La tanda de móvil son dos huecos. **La maqueta trae uno.**

- **9.2 · navegación móvil** — `.mobnav` (barra inferior) y `.sheet` / `.sheet-scrim`
  ("Todas las secciones") están dibujados enteros, con su `@media (max-width:820px)`.
- **9.1 · el panel del split en móvil** — **no está. Y la maqueta REPRODUCE el
  defecto**: a ≤820px sus dos layouts partidos pasan a `grid-template-columns:1fr`
  y el detalle se apila; su `renderDetail()` no hace `scrollIntoView` ni abre nada.
  Tocar una tarjeta a 375px en la maqueta produce la misma no-respuesta que en
  producción.

Esto es lo más importante de esta nota, porque el error fácil es el contrario: la
maqueta **existe**, entonces se asume que responde. No responde. El sheet del
detalle **se definió por escrito** (owner, 2026-08-14) tomando la forma que la
maqueta sí dibuja —su propio sheet de secciones— con otro contenido: grip, scrim
con blur, `80vh` con scroll interno, safe-area.

## 1 · SÍ es intención de FORMA. Esto se adopta

- **Barra inferior fija de cinco slots**, el quinto es "Más". Ícono sobre label,
  marca de activo arriba del slot, y el **punto sol** sobre la sección que pide
  atención (`.ndot`) — que en el sistema ya es `.duna-nav-dot`.
- **Sheet inferior** con grip, título, rejilla 2×2 de secciones y el toggle de tema
  al pie. Se cierra por scrim y por Escape.
- **`max-height:80vh` con scroll interno**: el sheet nunca tapa la pantalla entera,
  así que el fondo siempre se ve y el gesto de "esto está encima de algo" se
  conserva.
- **`env(safe-area-inset-bottom)`** en la barra y en el sheet. El sistema NO lo
  tenía; entró con esta tanda como `--duna-safe-b`.
- **El rail se retira, no se esconde detrás de un botón.** Debajo del breakpoint la
  navegación ES la barra; no hay hamburguesa.

## 2 · NO es fuente de VALORES

Menos derivada que `duna-modales.html`, pero derivada. Y con un agravante propio:
**escribe como literal tres valores que el paquete ya tiene tokenizados**, que es
el estado exacto desde el cual un valor deriva.

| | maqueta | paquete |
|---|---|---|
| scrim claro | `rgba(20,19,17,.34)` **literal** | `--duna-scrim` — mismo valor |
| scrim oscuro | `rgba(0,0,0,.55)` **literal** | `--duna-scrim` — mismo valor |
| radio del sheet | `20px` **literal** | `--duna-r-xl` — mismo valor |
| blur del scrim | `2px` | `.duna-scrim` usa **`3px`** |
| label de la barra | `.62rem` | mínimo del sistema `--duna-text-caption` `.6875rem` |
| título del sheet | `1.05rem` | `--duna-text-title` `1.1875rem` |
| prefijo | `var(--surface)`, `var(--r-m)`, `var(--ink)` | `--duna-*` |

Los tres primeros **coinciden hoy**. Que coincidan no es el punto: el punto es que
están escritos como número, así que la próxima vez que el token se mueva la maqueta
se queda donde estaba y nadie se entera. Es el mismo mecanismo que produjo
`--bad-ink` `#96422F` contra `#A0472F` en la maqueta de modales.

**Los valores salen del paquete. Son los que están en producción.**

### Y un valor que NO se adopta, con nombre propio: el breakpoint

La maqueta corta en **820px**. `duna-split` corta en **960**, y ése es el único de
los tres números en juego que tiene un motivo **derivado y escrito** (§
`primitives.css`: `400 lista + 24 gap + ~420 panel + 32×2 padding = 908`, redondeado
al primer valor cómodo por encima). El tercero era `lg`=1024 de la nav en Tailwind.

**Decisión del owner: UNO, y es 960.** Debajo: panel = sheet **y** navegación =
barra inferior. Encima: rail y split. La franja 960–1024 con barra inferior y panel
al lado **se elimina, no se documenta** — un rango de 64px con dos sistemas de
navegación a la vez es una excepción que alguien tendría que recordar.

## 3 · NO es fuente de ALCANCE

El sheet dibuja **ocho** secciones y **cuatro no existen**: Tienda, WhatsApp,
Sistema y Ajustes. Y **omite Entregas**, que sí existe. Llama "Hoy" al Dashboard, y
no contempla `Clientes (actual)`, que es la convivencia real de hoy (§ CLAUDE.md —
el retiro de `/admin/ordenes` dejó a Clientes en el mismo patrón).

**La barra y el sheet se derivan de `ADMIN_NAV`, no de esta lista.** Es la fuente
única de la navegación del panel y ya la consumen el rail y el ⌘K; una segunda
lista haría que agregar una sección la dejara fuera de la barra sin que nada avise.

Dos cosas más que dibuja y no trae:

- **El grip es decorativo.** No hay gesto de arrastre en su JS: `openSheet` y
  `closeSheet` son dos `classList`. Arrastrar-para-cerrar es alcance a decidir, no
  a heredar — **queda fuera de esta tanda**.
- **El bloque de usuario dentro del sheet.** Ya existe en la topbar por debajo de
  `lg` (`UserMenu variant="topbar"`), así que ponerlo también en el sheet sería el
  segundo sitio para la misma identidad. **No se adopta**; el sheet lleva sólo
  secciones y el tema.

## 4 · Lo que la maqueta NO tiene y la primitiva SÍ necesita

Es una maqueta: hace lo que se ve, no lo que se debe. Su sheet **no atrapa el
foco, no lo devuelve al cerrar, no bloquea el scroll del fondo y no declara
`aria-modal`**; su `Escape` es un listener global sin condición.

Nada de eso se copia. El comportamiento lo monta el consumidor sobre
`components/ui/sheet.tsx` (Radix, `side="bottom"`), que ya lo trae y ya está en
producción — el paquete pone la FORMA. El porqué de ese reparto está en
`primitives.css`, sobre `.duna-sheet`.

## 5 · Fósiles

Los mismos que ya están anotados en otra parte, ahora en una tercera maqueta —
tercera evidencia del § Backlog técnico #4, que dice que nada garantiza que las
etiquetas de dominio dibujadas fuera del dominio no caduquen:

- el fondo simulado dibuja **cinco** `steps`; la secuencia canónica son **cuatro**
  (Recibido · Preparando · En camino · Entregado);
- la vista Pedidos usa el vocabulario de la pantalla vieja.

No se corrigen en el archivo: se anotan acá.
