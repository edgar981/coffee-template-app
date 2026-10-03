# Rediseño completo del editor de tienda — propuesta

**Fecha:** 2026-10-03
**Rama:** `slice/corte-reescritura-prototipo-1` (medido sobre `c4c6c41`)
**Estado:** PROPUESTA. Este documento no cambia código. Nada de lo de abajo está construido; cada
slice del § 9 necesita su propio visto bueno, y los que tocan `components/storefront/` o
`lib/config/site-content-schema.ts` corren primero en sesión de sólo lectura (Tier 1, `CLAUDE.md`).
**Prototipo navegable:** https://claude.ai/artifact/KAq3bv4EtULzcu9UD1BL36 (privado hasta que el
owner lo comparta). Se recorre solo en diez capítulos (~80 s) y también se puede usar a mano. La
lámina «El sistema» resume las cinco ideas y los cinco arreglos.

---

## Resumen de una pantalla

El editor de hoy ya tiene el cimiento correcto: la tienda real en un iframe, deshacer de verdad,
selección en contexto. Lo que falla es la capa de arriba, y por tres razones de fondo:

1. **Las opciones son interruptores, no lugares.** El hero expone seis booleanos («Mostrar
   titular», «Ocupar toda la pantalla», «Mostrar el velo»…) que alguien que no diseña tiene que
   traducir a «qué va a pasar en la pantalla».
2. **El estilo vive en otra pestaña.** Cambiar la letra o el color de un titular obliga a irse a
   «Tema» y volver. Además esa pestaña hoy se cae (error 2).
3. **La edición en la página no está anclada a la página.** El campo flotante se mide una vez y
   se fija a la pantalla. De ahí salen los errores 1, 3 y 4.

La propuesta, en una línea: **un solo panel que baja de nivel (Inicio › Hero › Titular), el hero
dividido en zonas con nombre, una barra flotante de letra, tamaño y color sobre lo que se edita, el
color elegido por rol, y una «vista nueva» encima del lienzo para lo que no cabe en el panel.**
Es Shopify con dos diferencias. Primero, la estructura se ve: las zonas aparecen sobre la página.
Segundo, no hay interruptores: si algo se quiere, se agrega en su zona; si no, se quita.

---

## 1 · Los cinco errores: causa y arreglo

Medidos leyendo el código (sesión de sólo lectura). Los errores 2 y 5 quedan confirmados por el
código solo. Los errores 1, 3 y 4 tienen la causa ubicada, pero falta reproducirlos en ejecución.

| # | Síntoma | Causa | Arreglo |
|---|---|---|---|
| 1 | Al tocar la marquesina se detiene, pero detrás sigue «Una historia…» y se enciman | La marquesina pinta el texto **dos veces** para el loop (`HeroMediaMarquesina.tsx:857-858`); solo la primera copia lleva `CampoEditable`. `EditorPuenteVivo.tsx:232-239` oculta **ese único nodo** y pone encima un `<input>` fijo de fondo transparente (`campo-editable.ts:157`). La segunda copia sigue animándose detrás. Al teclear empeora: `key={duracionTicker}` (`:832`) remonta el ticker y la primera copia nueva ya no está oculta. | Mientras el campo de la marquesina esté abierto: ticker congelado en `x:0`, **todas** las copias ocultas (marcadas por atributo, no por un nodo guardado), una sola línea visible. Es lo que muestra el capítulo 6 del prototipo. |
| 2 | «Tema» → *This page couldn't load* | `PaletaSeccion.tsx:276` llama `useSiteSettings()`, que **lanza** si no hay `SiteSettingsProvider` encima (`components/admin/SiteSettingsProvider.tsx:23-26`). Solo `app/(admin)/admin/layout.tsx` monta ese proveedor. `app/(admin)/editor/layout.tsx` solo verifica la sesión y devuelve `children`. | `editor/layout.tsx` carga `getSiteSettings()` junto a la sesión y envuelve en `<SiteSettingsProvider>`. Es un arreglo de minutos y no depende del rediseño. |
| 3 | El tercer párrafo de Nosotros cambia de estructura al tocarlo | *Hipótesis fuerte:* el marcador editable es un `<span>` en línea dentro del `<p>` (`NosotrosHistoria.tsx:64-66`). El `<textarea>` se dimensiona a la caja de **ese span** y conserva los saltos de línea (`pre-wrap`), que el `<p>` colapsa. El texto del owner probablemente trae `\n`. *Para confirmar:* buscar `\n` en el borrador de `parrafo3` y comparar `scrollHeight` contra `clientHeight` del overlay abierto. | El campo copia `white-space` del nodo y mide el **bloque** (`<p>`), no el span; además crece solo y sin barra de desplazamiento. |
| 4 | Con el campo abierto, al bajar hasta Galería el texto se mueve con el scroll | El overlay es `position:fixed` con coordenadas leídas **una vez** al abrir (`campo-editable.ts:147-152`, sin escucha de scroll ni de resize). A eso se suma que el mismo clic dispara `scrollIntoView` (`VistaTiendaIframe.tsx:195`), así que la página se mueve justo después de medir. | El campo se ancla en **coordenadas del documento**: `absolute` dentro del iframe, o re-medido en `scroll`/`resize`/`ResizeObserver` por cuadro. Un clic que nace en el iframe no vuelve a desplazar el iframe. |
| 5 | Aparece una sección «Marquesina» aparte que «no se muestra en la tienda» | `SECCIONES_TIENDA` declara `MARQUESINA` como sección propia del home (`tienda-secciones.ts:343-354`), y CORTE la apaga (`bandasVisibles.marquesina:false`) porque el hero `sticky` ya la dibuja. La tarjeta lo dice literal (`TiendaSeccionEditor.tsx:1015-1022`). | La marquesina pasa a ser **una zona del hero**: la lista de secciones sale de lo que la página dibuja. **Ojo:** el texto y el producto de la marquesina viven en `content.marquesina`, y las ediciones en la página solo llegan a secciones con tarjeta montada (`TiendaPaginas.tsx:132-136`). Hay que re-enrutar `marquesina.*` al editor del hero antes de quitar la tarjeta, no después. |

---

## 2 · Lo que pidió el owner, y dónde queda en el diseño

| Pedido | Cómo lo resuelve |
|---|---|
| «Como Shopify pero mejor» | Misma gramática: lista de secciones, ajustes que bajan de nivel con migas, lienzo con la página real. Lo «mejor»: la estructura se ve sobre la página (zonas), el estilo se edita sobre lo que se toca, y publicar muestra **en palabras** qué cambia. |
| Escritorio por defecto | El lienzo abre en Escritorio. Tableta y Teléfono quedan a un clic, a su **ancho real** (§ 4.3 de `DISENO.md`). |
| Si algo no cabe en el panel, vista nueva | La **vista nueva** es una hoja que se abre sobre el lienzo, con espacio para comparar: composición del hero, agregar sección, medios. El panel nunca se ensancha. |
| Nada de listas de interruptores | El hero tiene **zonas**. Una zona vacía ofrece «+ Titular», «+ Botón»… en su lugar exacto; una llena se edita tocándola y se quita desde su barra. Tabla completa en § 4. |
| Fuente, tamaño, etc. ahí mismo | **Barra flotante** sobre el elemento: letra, tamaño con palabras, alineación, color y quitar. El panel muestra lo mismo con más espacio. Ya no hay «ir a Tema y volver». |
| Amigable para quien no diseña | El tamaño se dice con palabras (Pequeño → Enorme), el color con el nombre del rol, la altura con «Justo / Alto / Pantalla completa» y el velo como «Oscurecer para leer mejor». |
| Colores (decidido) | «Por defecto» primero. Después las sugerencias de la paleta **por rol** y en palabras. «Personalizado» va dentro de «Avanzado». **Sin aviso visible de contraste.** Se guarda el **rol**, así que el color sigue a la paleta cuando esta cambia. |

---

## 3 · Anatomía del editor

```
┌ Barra ───────────────────────────────────────────────────────────────────────┐
│ ‹  Finca San Adolfo · Editor   │  Página: Inicio ▾  [▭ ▯ ▯]  │ ↶ ↷ • Borrador guardado  Vista previa  [Publicar ③] │
├──────┬──────────────────────┬──────────────────────────────────────────────────┤
│ Riel │ Panel (308 px)       │ Lienzo: la página real, a su ancho real          │
│ Secc.│ Inicio › Hero › …    │   zonas, barra flotante, hoja de «vista nueva»   │
│ Estilo│                     │                                                  │
│ Medios│                     │            [ barra del recorrido — solo prototipo ] │
└──────┴──────────────────────┴──────────────────────────────────────────────────┘
```

- **Riel:** Secciones · Estilo · Medios. «Estilo» reemplaza la pestaña «Tema»: deja de ser un
  *modo* y pasa a ser una herramienta más. «Página» queda arriba porque cambia lo que se ve.
- **Panel con niveles:** *Inicio* (lista de secciones con asa y ojo; el hero se despliega en sus
  zonas) → *Hero* (composición, zonas, alto) → *Titular* (texto, tamaño, letra, alineación,
  color, quitar). Siempre hay un «‹ volver» con el nombre del nivel de arriba.
- **Lienzo:** pasar el mouse resalta la sección con su nombre; tocarla la selecciona. Al tocar
  el hero aparecen sus zonas (líneas punteadas con nombre), el botón de «Fondo · foto» y el de alto.
- **Barra flotante:** aparece sobre el elemento seleccionado y se mueve con él.
- **Publicar:** el botón cuenta los cambios. El popover los lista en palabras («Hero · Titular ·
  nuevo», «Hero · Composición «Portada»», «Nosotros · Párrafo 3»).
- **Sistema visual:** el del panel de Duna (`packages/design-system/tokens/tokens.css`): tinta
  como acción, Hanken Grotesk, Space Grotesk y Spline Sans Mono. El **ámbar** se usa solo para lo
  que espera publicarse, como pide la doctrina del sol.

---

## 4 · El hero por zonas

Una **composición** reparte el hero en zonas con nombre. Los nombres del prototipo corresponden a
las variantes que ya existen (`HeroSection.tsx:16-28`):

| En el editor | Variante real | Zonas |
|---|---|---|
| Marquesina | `sticky` (`HeroMediaMarquesina`) | Titular · Subtítulo · Marquesina · Producto · Leyenda · Botón · Indicador · Fondo |
| Portada | `media` (`HeroMedia`) | Titular · Subtítulo · Botón · Cinta · Indicador · Fondo |
| Ficha | `ficha` (`HeroFicha`) | Titular · Subtítulo · Botón · Leyenda · Fondo (a la derecha) |
| Cortina | `curtina` (`HeroCurtina`) | *(no está en el prototipo; mismo tratamiento)* |

Hoy el eje `variante` **no tiene control de panel** (hueco ya nombrado en `tienda-secciones.ts`,
`PANEL-EDITOR-VARIANTES-COMPOSICION-1`). La vista nueva «¿Cómo se arma tu hero?» es ese control.
Al cambiar de composición, cada texto se muda a su zona equivalente. Lo que no tiene lugar **se
guarda** (se dice en la tarjeta: «Se guarda: Leyenda»), y volver lo recupera.

**De interruptores a zonas, sin migración.** Los booleanos actuales de `HERO.booleanos`
(`tienda-secciones.ts:262-269`) ya son el dato correcto. Solo cambia el control que los escribe:

| Hoy | Propuesta | Escribe |
|---|---|---|
| Mostrar titular | «+ Titular» en su zona / «Quitar» en su barra | `titularVisible` |
| Mostrar subtítulo | «+ Subtítulo» / «Quitar» | `subtituloVisible` |
| Mostrar los botones | «+ Botón» / «Quitar» | `ctasVisibles` |
| Mostrar el indicador «Desliza» | «+ Indicador» / «Quitar» | `cueDesliza` |
| Ocupar toda la pantalla | Alto: Justo · Alto · **Pantalla completa** | `alturaLlena` (+ un valor intermedio, ver § 8) |
| Mostrar el velo sobre el video | Fondo › «Oscurecer para leer mejor»: Nada · Suave · Medio · Fuerte | `veloVisible` + `veloIntensidad` |

**Costo honesto:** cada variante es un componente distinto con su propio JSX
(`EDICION-INLINE.md` § 2.2, «variantes multiplican el costo»). Las zonas se declaran en cada una
con un atributo (`data-editor-zona="titular"`) emitido solo bajo `useIsPreview()`, igual que los
marcadores de hoy. El recuadro punteado se dibuja **dentro** del iframe (`DISENO.md` § 4.1.1).

---

## 5 · Letra, tamaño y color sobre lo que se edita

- **Letra:** «Por defecto» = la del par del estilo para ese rol (títulos o textos). Después,
  la otra del mismo par. Después, las tipografías **de la colección curada** (`fuentes.ts`). Nunca
  un campo de fuente libre, por la misma razón por la que hoy no existe. Las tipografías de título
  tienen un solo peso (400), así que no hay botón de negrita.
- **Tamaño:** cinco pasos con nombre (Pequeño, Mediano, Grande, Muy grande, Enorme), mapeados a
  una escala por tipo de elemento y ajustados al ancho del dispositivo.
- **Color:** «Por defecto» siempre primero, y significa *lo que pide esta zona* (claro sobre la
  foto, tinta sobre el papel). Después, **De tu paleta**: Acento, Tinta, Suave, Fondo,
  Superficie, Tostado, cada uno con su frase («el color de tu marca», «textos secundarios»…). Al
  pasar el mouse se previsualiza en la página. «Avanzado › Personalizado» abre un selector libre.
  **No se muestra ningún aviso de contraste.**
- **Lo que se guarda es el rol** (`"tostado"`), no el hex. Cambiar de Corte a Pliego recolorea el
  titular sin tocarlo (capítulo 7 del prototipo). Un «Personalizado» sí guarda el hex y por eso no
  sigue a la paleta. Esa es la razón de que viva en Avanzado.

---

## 6 · Estilo (lo que hoy es «Tema»)

- **Combinaciones:** tarjetas con la paleta y el par de letras reales de cada preset (Corte,
  Pliego, Patio, Vitrina…). Un clic recolorea la tienda entera con transición.
- **Ajustar › Colores:** los tres colores raíz con palabras (Fondo: «el papel de tus páginas»,
  Tinta: «títulos y textos», Acento: «botones y detalles de marca») y debajo «Se calculan solos»,
  la capa derivada que ya existe, en solo lectura. Sin aviso de contraste.
- **Ajustar › Letras** (los pares de `fuentes.ts`) y **› Forma** (recta, mínima, suave).
- Estilo **no sale del editor**: no es un modo aparte y deja las selecciones como estaban.

---

## 7 · La edición sobre la página — mecanismo recomendado

El prototipo escribe directo sobre el texto para mostrar la **experiencia** que se busca: el texto
no cambia de forma y no se despega al hacer scroll. Para construirlo **se mantiene la decisión de
`EDICION-INLINE.md` § 2.2** (campo flotante, no `contentEditable`). Sus cuatro razones siguen en
pie: nodos duplicados, nodos animados, HTML pegado y deshacer inconsistente. Lo que cambia es
cómo se ancla el campo:

1. **Coordenadas del documento, no de la pantalla.** Va `absolute` en el `<body>` del iframe
   (`top = rect.top + scrollY`), o se re-mide por cuadro en `scroll`, `resize` y `ResizeObserver`.
   Cierra el error 4.
2. **Mide el bloque y copia sus reglas.** Mide el elemento de bloque que contiene el marcador,
   copia `white-space`, `line-height` y el ancho, crece solo y no muestra barra. Cierra el error 3.
3. **Copias gemelas.** Todo nodo que repite un campo (las copias del loop) se marca con
   `data-editor-gemelo`. Se ocultan todas mientras el campo está abierto, y el ticker se congela
   en `x:0`. Cierra el error 1.
4. **Un clic que nace en el iframe no vuelve a desplazar el iframe** (`VistaTiendaIframe.tsx:195`).

---

## 8 · Qué toca el modelo de datos (gate del owner)

| Cambio | Dónde | Naturaleza |
|---|---|---|
| Zonas como agregar/quitar | Booleanos existentes del hero | **Ninguno**: mismo dato, otro control |
| Composición del hero | `hero.variante` (existe) | Ninguno: solo un control nuevo |
| Alto con un valor intermedio («Alto») | `hero.alturaLlena` es booleano | **Opcional:** campo nuevo `hero.alto: 'justo'\|'alto'\|'pantalla'`; si no se aprueba, se ofrecen solo dos alturas |
| Letra, tamaño, color y alineación por elemento | Nuevo objeto opcional por campo de texto (`hero.estilos.titulo = { fuente, tamano, color, alinear }`) | **Esquema nuevo** en `site-content-schema.ts` (Tier 1). Opcional y con default = comportamiento de hoy (byte-idéntico para Nayoli) |
| Marquesina dentro del hero | `content.marquesina` se queda donde está; solo cambia quién la edita | Ninguno en datos; re-enrutar mensajes del puente |
| Color por rol | El valor guardado es una clave de rol o un hex | Parte del objeto de estilo de arriba |

Nada de esto se escribe en las bases de los clientes sin el owner.

---

## 9 · Plan por slices (cada uno con su propio visto bueno)

| # | Slice | Toca | Tier |
|---|---|---|---|
| 1 | `EDITOR-TIENDA-TEMA-PROVEEDOR-1` — «Tema» deja de caerse | `app/(admin)/editor/layout.tsx` | 2 |
| 2 | `EDITOR-TIENDA-CAMPO-ANCLADO-1` — campo anclado al documento, mide el bloque, gemelos ocultos (errores 1, 3, 4) | `EditorPuenteVivo.tsx`, `campo-editable.ts`, marcadores de gemelo en el hero y la marquesina | **1** |
| 3 | `EDITOR-TIENDA-MARQUESINA-EN-HERO-1` — la marquesina como zona del hero; fuera la tarjeta suelta (error 5) | `tienda-secciones.ts`, enrutamiento del puente | 2 (+1 si toca storefront) |
| 4 | `EDITOR-TIENDA-SHELL-1` — riel + panel con niveles + Estilo como herramienta | `EditorTiendaPantallaCompleta.tsx`, `TiendaPaginas.tsx`, `PaletaSeccion.tsx` | 2 |
| 5 | `EDITOR-TIENDA-ZONAS-1` — zonas del hero sobre la página, «+» en su lugar, booleanos escritos desde las zonas | variantes del hero (`data-editor-zona`), panel del hero | **1** |
| 6 | `EDITOR-TIENDA-COMPOSICION-1` — vista nueva «¿Cómo se arma tu hero?» (`hero.variante`) | panel + hoja | 2 |
| 7 | `EDITOR-TIENDA-BARRA-FLOTANTE-1` — letra, tamaño, color por rol y alineación por elemento | esquema (gate) + storefront + puente | **1** |
| 8 | `EDITOR-TIENDA-PUBLICAR-RESUMEN-1` — el popover de publicar en palabras | barra superior | 2 |

Los slices 1 a 3 cierran los cinco errores sin esperar el rediseño. Del 4 al 8 son el rediseño
en sí, en el orden en que cada uno se ve por su cuenta.

---

## 10 · Lo que este documento NO decide

- Si «Alto» gana un tercer valor (campo nuevo) o se queda en dos.
- Qué roles se ofrecen en el selector de color. El prototipo usa seis; la capa derivada tiene más.
- Si la colección de letras por elemento es la de los diez pares o un subconjunto.
- Los nombres finales de las composiciones («Marquesina», «Portada», «Ficha», «Cortina»).
- Las páginas sin secciones editables (catálogo, ficha de producto); sigue valiendo
  `DISENO.md` § 4.4.
