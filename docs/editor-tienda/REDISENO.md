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
código solo. Los errores 1, 3 y 4 tenían la causa ubicada pero sin reproducir en ejecución —
`EDITOR-TIENDA-CAMPO-ANCLADO-1` los reprodujo en un arnés de Playwright ANTES de arreglarlos (contra
el código sin tocar): las tres causas de abajo coincidieron EXACTAMENTE con lo medido —
`marquesina.texto` mostraba las DOS copias con texto a la vez; el overlay de `nosotrosHistoria.
parrafo3` medía 476.5×79.5px contra los 512×87.75px reales del `<p>` (necesitaba scrollbar: 88px de
contenido en una caja de 80); y tras scrollear 700px el overlay (`position:fixed`) se quedó en su
sitio mientras el nodo real se fue a −698px, una distancia de exactamente el scroll aplicado. Los
tres cerraron con el mismo arnés, re-ejecutado sobre el código arreglado: 19/19 verificaciones.

| # | Síntoma | Causa | Arreglo |
|---|---|---|---|
| 1 | Al tocar la marquesina se detiene, pero detrás sigue «Una historia…» y se enciman | La marquesina pinta el texto **dos veces** para el loop (`HeroMediaMarquesina.tsx:857-858`); solo la primera copia lleva `CampoEditable`. `EditorPuenteVivo.tsx:232-239` oculta **ese único nodo** y pone encima un `<input>` fijo de fondo transparente (`campo-editable.ts:157`). La segunda copia sigue animándose detrás. Al teclear empeora: `key={duracionTicker}` (`:832`) remonta el ticker y la primera copia nueva ya no está oculta. | Mientras el campo de la marquesina esté abierto: ticker congelado en `x:0`, **todas** las copias ocultas (marcadas por atributo, no por un nodo guardado), una sola línea visible. Es lo que muestra el capítulo 6 del prototipo. |
| 2 | «Tema» → *This page couldn't load* | `PaletaSeccion.tsx:276` llama `useSiteSettings()`, que **lanza** si no hay `SiteSettingsProvider` encima (`components/admin/SiteSettingsProvider.tsx:23-26`). Solo `app/(admin)/admin/layout.tsx` monta ese proveedor. `app/(admin)/editor/layout.tsx` solo verifica la sesión y devuelve `children`. | `editor/layout.tsx` carga `getSiteSettings()` junto a la sesión y envuelve en `<SiteSettingsProvider>`. Es un arreglo de minutos y no depende del rediseño. |
| 3 | El tercer párrafo de Nosotros cambia de estructura al tocarlo | *Hipótesis fuerte:* el marcador editable es un `<span>` en línea dentro del `<p>` (`NosotrosHistoria.tsx:64-66`). El `<textarea>` se dimensiona a la caja de **ese span** y conserva los saltos de línea (`pre-wrap`), que el `<p>` colapsa. El texto del owner probablemente trae `\n`. *Para confirmar:* buscar `\n` en el borrador de `parrafo3` y comparar `scrollHeight` contra `clientHeight` del overlay abierto. | El campo copia `white-space` del nodo y mide el **bloque** (`<p>`), no el span; además crece solo y sin barra de desplazamiento. |
| 4 | Con el campo abierto, al bajar hasta Galería el texto se mueve con el scroll | El overlay es `position:fixed` con coordenadas leídas **una vez** al abrir (`campo-editable.ts:147-152`, sin escucha de scroll ni de resize). A eso se suma que el mismo clic dispara `scrollIntoView` (`VistaTiendaIframe.tsx:195`), así que la página se mueve justo después de medir. | El campo se ancla en **coordenadas del documento**: `absolute` dentro del iframe, o re-medido en `scroll`/`resize`/`ResizeObserver` por cuadro. Un clic que nace en el iframe no vuelve a desplazar el iframe. |
| 5 | Aparece una sección «Marquesina» aparte que «no se muestra en la tienda» | `SECCIONES_TIENDA` declara `MARQUESINA` como sección propia del home (`tienda-secciones.ts:343-354`), y CORTE la apaga (`bandasVisibles.marquesina:false`) porque el hero `sticky` ya la dibuja. La tarjeta lo dice literal (`TiendaSeccionEditor.tsx:1015-1022`). | La marquesina pasa a ser **una zona del hero**: la lista de secciones sale de lo que la página dibuja. **Ojo:** el texto y el producto de la marquesina viven en `content.marquesina`, y las ediciones en la página solo llegan a secciones con tarjeta montada (`TiendaPaginas.tsx:132-136`). Hay que re-enrutar `marquesina.*` al editor del hero antes de quitar la tarjeta, no después. |

**ERROR 5 ENTREGADO por `EDITOR-TIENDA-MARQUESINA-EN-HERO-1` (2026-10-03), por un camino MÁS ACOTADO
que «zona del hero»** (esa palabra es de § 4, la vista por zonas de `data-editor-zona` — slice 5, no
construida todavía): `texto`/`productoSlug` pasaron de `MARQUESINA.campos` a `HERO.campos`, marcados
con un nuevo `CampoTexto.seccionCruzada: 'marquesina'` — la tarjeta del hero los MUESTRA y los
ESCRIBE, pero el handle/autoguardado que los posee sigue siendo el de `marquesina` (vía
`TiendaSeccionEditorHandle.escribirCampoSinAbrir`, que el padre resuelve), así que sigue habiendo un
único escritor de esa sección sea cual sea la tarjeta desde la que se edite — sin tocar el schema ni
el resolver, "sin migración" tal como pedía el spec. El RE-ENRUTAMIENTO que el "Ojo" de arriba
advertía resultó innecesario en la dirección que importaba: un clic dentro de la composición `sticky`
del hero YA resuelve a la tarjeta del hero por el `[data-editor-seccion="hero"]` ancestro del DOM
(medido contra `EditorPuenteVivo.tsx`, fuera de `touches:` — no hace falta tocarlo), así que sólo
hubo que re-enrutar la escritura REMOTA (el mensaje de campo-cambio del tecleo dentro del iframe) para
que no abriera TAMBIÉN la tarjeta suelta. Esa tarjeta se queda —con su `bandaId` y su sección, como
pedía el owner— mostrando sólo el interruptor de la banda SUELTA + un `notaVisibilidad` explicando el
porqué (nuevo campo opcional de `SeccionConfig`, sin romper ninguna otra sección que no lo declare).

**LA TARJETA «MARQUESINA» DEJA DE SER "SÓLO EL INTERRUPTOR" — `EDITOR-TIENDA-MARQUESINA-SECCION-1`
(2026-10-03).** El párrafo de arriba describía el estado DESPUÉS de `EDITOR-TIENDA-MARQUESINA-EN-
HERO-1`: la tarjeta suelta sólo tenía el switch de visibilidad + una nota explicando por qué no había
nada más que configurar — era, literalmente, «la zona que se elimina» del hero (no tenía contenido
propio, sólo apagaba una duplicación). Este slice le da contenido PROPIO: su propia frase
(`fraseBanda`), su propio fondo (foto o video, `imagenTipo`) y hasta seis productos propios
(`producto1..6`) que van REEMPLAZÁNDOSE uno al otro a medida que se hace scroll — el MISMO motor de
revelado que el hero·sticky ya usaba para su frase y su tarjeta única, extraído a
`components/storefront/home/MarquesinaMotor.tsx` y generalizado de UN producto a HASTA SEIS. `texto`/
`productoSlug` (editados desde «Hero de la home», sin cambios de esta ronda) siguen siendo
EXCLUSIVAMENTE del hero·sticky; la banda suelta es hoy una SECCIÓN REUTILIZABLE —con lugar propio en
el orden de secciones, como cualquier otra—, no la cáscara de un interruptor. Sigue naciendo apagada
(`visible:false`); el owner la enciende cuando quiera mostrar un catálogo de productos con este
efecto, en cualquier punto de la home.

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
| 1 | `EDITOR-TIENDA-TEMA-PROVEEDOR-1` — «Tema» deja de caerse — **ENTREGADO** (2026-10-03) | `app/(admin)/editor/layout.tsx` | 2 |
| 2 | `EDITOR-TIENDA-CAMPO-ANCLADO-1` — campo anclado al documento, mide el bloque, gemelos ocultos (errores 1, 3, 4) — **ENTREGADO** (2026-10-03) | `EditorPuenteVivo.tsx`, `campo-editable.ts`, marcadores de gemelo en el hero y la marquesina | **1** |
| 3 | `EDITOR-TIENDA-MARQUESINA-EN-HERO-1` — la marquesina como zona del hero; fuera la tarjeta suelta (error 5) — **ENTREGADO** (2026-10-03) | `tienda-secciones.ts`, `TiendaSeccionEditor.tsx`, `TiendaPaginas.tsx`, `panel-controles.ts` | 2 |
| 4 | `EDITOR-TIENDA-SHELL-1` — riel + panel con niveles + Estilo como herramienta — **ENTREGADO** (2026-10-03) | `EditorTiendaPantallaCompleta.tsx`, `TiendaPaginas.tsx`, `PaletaSeccion.tsx`, `TiendaSeccionEditor.tsx`, `VistaTiendaIframe.tsx`, `components/admin/editor/` (nuevo), `lib/admin/editor-iframe.ts` | 2 |
| 5 | `EDITOR-TIENDA-ZONAS-1` — zonas del hero sobre la página, «+» en su lugar, booleanos escritos desde las zonas — **ENTREGADO** (2026-10-03) | las 4 variantes del hero (`data-editor-zona-campo`/`-valor`), `EditorPuenteVivo.tsx`, `editor-puente.ts`, `TiendaSeccionEditor.tsx`, `tienda-secciones.ts`, `site-content-defaults.ts`, `site-content-schema.ts` | **1** |
| 6 | `EDITOR-TIENDA-COMPOSICION-1` — vista nueva «¿Cómo se arma tu hero?» (`hero.variante`) — **ENTREGADO** (2026-10-03) | panel + hoja: `tienda-secciones.ts`, `TiendaSeccionEditor.tsx`, `components/admin/editor/ComposicionHero.tsx` (nuevo), `panel-controles.ts` | 2 |
| 7 | `EDITOR-TIENDA-BARRA-FLOTANTE-1` — letra, tamaño, color por rol y alineación por elemento — **ENTREGADO** (2026-10-04) | esquema + storefront (los 4 heros, el puente) + panel: `estilo-elemento.ts` (nuevo), `palette-derive.ts`, `fuentes.ts`, `site-content-{defaults,schema}.ts`, `campo-editable.ts`, `editor-puente.ts`, `EditorPuenteVivo.tsx`, HeroSection/Media/Curtina/Ficha/MediaMarquesina, `TiendaSeccionEditor.tsx`, `EstiloElementoControles.tsx` (nuevo) | **1** |
| 8 | `EDITOR-TIENDA-PUBLICAR-RESUMEN-1` — el popover de publicar en palabras — **ENTREGADO** (2026-10-04) | barra superior | 2 |
| 9 | `EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1` — follow-up de la Desviación 1 del slice 5: la composición "sticky" gana su propia zona de titular/subtítulo/botón — **AWAITING_APPROVAL** (2026-10-04) | `HeroMediaMarquesina.tsx`, `tienda-secciones.ts`, `site-content-defaults.ts` (comentarios), `components/admin/editor/ComposicionHero.tsx` (miniatura) + 4 archivos de test | **1** |

Los slices 1 a 3 cierran los cinco errores sin esperar el rediseño. Del 4 al 8 son el rediseño
en sí, en el orden en que cada uno se ve por su cuenta. El 9 es un follow-up pedido por el owner
sobre una decisión que el slice 5 dejó pendiente (ver su "DESVIACIÓN 1", abajo).

**SLICE 4 ENTREGADO, con UNA desviación medida y declarada (§ DECISIONS.md).** El riel (Secciones ·
Estilo · Medios), el panel con niveles (Inicio → sección, con migas «‹ Inicio»), la «vista nueva»
(`components/admin/editor/VistaNueva.tsx`, usada para Medios — no existe «Agregar sección» que
ofrecer, medido) y el rótulo de hover sobre el lienzo están construidos tal como pide este
documento. **«Combinaciones» (§ 6) aplica SÓLO raíces + par + forma, nunca el `PresetTema` completo**
(esquemas/orden/variantes/toggles quedan afuera): aplicar la composición completa desde el panel del
cliente contradice una decisión YA tomada y escrita (DECISIONS.md, "EL CLIENTE EDITA SU CONTENIDO, NO
SU COMPOSICIÓN" — el retiro de `EJE-5-ORDEN-EDITOR-1`/`EJE-5-VARIANTES-EDITOR`), así que cada tarjeta
de Combinaciones es un ATAJO sobre los tres ejes que esta pantalla YA deja editar, no una puerta nueva
a la composición. El nivel «elemento» (zonas del hero) queda para el slice 5, como estaba planeado.

**SLICE 5 ENTREGADO (2026-10-03), con el TERCER valor de alto aprobado y TRES desviaciones medidas.**
Cada variante marca sus zonas con `data-editor-zona-campo`/`-valor` (y un segundo par opcional,
`-campo2`/`-valor2`, para el velo combinado) — EditorPuenteVivo.tsx detecta el clic ANTES que
campo-imagen/campo y postea el/los `TIPO_MENSAJE_CAMPO_CAMBIO` directo (reusa el canal existente,
sin mensaje nuevo). "+ Titular"/"Quitar Subtítulo"/etc. están construidos y FUNCIONAN de punta a
punta (13/13 en un arnés con sesión real — login, las tres composiciones, capturas) — ver
DECISIONS.md para la tabla completa. El alto ganó su tercer paso (`hero.alto: 'justo'|'alto'|
'pantalla'`, `claseAlturaHero`) con fallback a `alturaLlena` SIN migración; el velo se volvió una
sola pregunta («Nada · Suave · Medio · Fuerte», `veloComboDeCampos`/`camposDeVeloCombo`) que escribe
`veloVisible`+`veloIntensidad` juntos.

**DESVIACIÓN 1 — el alcance real de "zona" varía por variante, medido contra el código antes de
construir.** `titularVisible`/`subtituloVisible`/`ctasVisibles` SÓLO tienen efecto en `HeroMedia`
('media'); `HeroMediaMarquesina` ('sticky', la composición que CORTE usa hoy) NO rinde
titulo/subtitulo/cta EN NINGÚN CASO (medido: grep de los tres da cero en ese archivo) — el "+/Quitar"
completo vive en HeroMedia; Curtina/Ficha/Sticky sólo ganan el zone marker + el chip de Alto (Curtina/
Ficha) o el de Velo (Sticky). El spec de REDISENO.md § 4 listaba Titular/Subtítulo/Botón como zonas de
"Marquesina" (sticky) — eso no coincide con lo que el código de hoy renderiza, y agregar esos tres
campos a `HeroMediaMarquesina` sería una decisión de producto (dónde viven, cómo conviven con el
ticker/tarjeta) fuera de este slice.

**RESUELTA por `EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1` (slice 9, 2026-10-04):** el owner, sobre este
mismo párrafo: «Agrégalo, la frase no debería tratarse como el titular». `HeroMediaMarquesina` gana
la zona abajo a la izquierda, sobre el indicador "Desliza" — leyendo los MISMOS tres booleanos y los
MISMOS campos que `media`, sin duplicar contenido. Medido antes de construir (§ el docstring de
cabecera de `HeroMediaMarquesina.tsx`): CORTE ya declaraba los tres en `false` desde su era 'media',
así que la zona nace apagada para Onix/Las Chamisas sin tocar `themes.ts`.

**DESVIACIÓN 2 — `useModoEditorActivo()`, no `useIsPreview()`.** El spec pedía "igual que los
marcadores de hoy"; los marcadores de hoy (`data-editor-seccion`/`data-editor-campo`) usan
`useModoEditorActivo()` — `useIsPreview()` es el mecanismo retirado de la vista previa vieja. Se
siguió el mecanismo REAL, no el nombre literal del spec.

**DESVIACIÓN 3 — el ALTO llega a Curtina y Ficha también, no sólo a Media.** `alturaLlena` nunca tuvo
efecto ahí; `hero.alto` SÍ se extendió a las dos (aditivo, byte-idéntico en su canónica) porque el
pedido del spec ("definí qué mide Alto… en escritorio y teléfono") es genérico a la composición, no
sólo a `media`.

**UN DEFECTO MEDIDO Y CERRADO EN ESTE MISMO SLICE:** dos `postMessage` consecutivos desde el MISMO
clic (el velo combinado, el alto con su `alturaLlena` de respaldo) se procesaban como dos eventos
`message` separados sin que React alcanzara a re-sincronizar `formRef.current` entre uno y otro — el
segundo mergeaba sobre el snapshot VIEJO y pisaba el resultado del primero (medido contra la base
real: `alto` quedaba en `'justo'` pese a clickear "Pantalla completa"). Se escalonan con un
`setTimeout` breve en vez de tocar el merge genérico (`cambiar()`) que usan todos los campos de texto.

**FUERA DE ESTA NUMERACIÓN (pedido aparte del owner, no del plan de rediseño de arriba):**
`EDITOR-TIENDA-MARQUESINA-SECCION-1` — la banda suelta «Marquesina» pasa de interruptor-sin-contenido
a sección reutilizable (frase + fondo + hasta seis productos con el motor del hero·sticky,
generalizado) — **ENTREGADO** (2026-10-03). Toca `MarquesinaMotor.tsx` (nuevo),
`HeroMediaMarquesina.tsx`, `Marquesina.tsx`, `lib/animation.ts`, `tienda-secciones.ts`,
`site-content-defaults.ts`, `site-content-schema.ts`. Tier 1 (toca `components/storefront/` y
`site-content-schema.ts`). Actualiza la fila "Marquesina dentro del hero" de § 8: sigue siendo cierto
que `content.marquesina.texto`/`.productoSlug` no se movieron, pero la sección ganó SEIS campos
nuevos propios (`fraseBanda`, `imagenTipo`, `producto1..6`) — ninguno toca el modelo de un cliente
existente (todos opcionales o con default que preserva el comportamiento de hoy).

**TAMBIÉN FUERA DE ESTA NUMERACIÓN:** `EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1` — las cinco
transiciones de salida de los productos de la banda suelta — **ENTREGADO** (2026-10-03). Pedido del
owner sobre la sección Marquesina, literal: «se pueden agregar 4-5 transiciones diferentes en la
sección y así si el cliente quiere puede elegir otro». El SÉPTIMO campo de `MarquesinaContent`,
`transicion` (escalar clampado, canónica `'subir'` — la entrada de HOY, byte-idéntica), con CINCO
valores: Subir (la de hoy) · Deslizar (desde un costado, alternando por producto) · Acercar (zoom
suave) · Enfocar (de desenfocado a nítido) · Girar (el gesto de la tarjeta Cafeone — escala+rotación,
misma magnitud que la `transformMarquesinaTarjeta` retirada del hero). Las cuatro nuevas viven como
funciones puras en `lib/animation.ts` (`transformDeslizarItem`, `transformAcercarItem`,
`filterEnfocarItem`, `transformGirarItem`), despachadas por `transformTransicionMarquesinaItem`/
`filterTransicionMarquesinaItem` — `MarquesinaTarjetaMotor` las consume vía dos `useTransform`
(`transform`/`filter`, propiedades CSS independientes sobre el mismo nodo). El HERO queda
BYTE-IDÉNTICO: nunca pasa la prop `transicion`, así que cae al default `'subir'`, que el dispatch
delega byte a byte en `transformEntradaSalidaItem` (la función de siempre).

Toca `lib/animation.ts`, `components/storefront/home/MarquesinaMotor.tsx`,
`components/storefront/home/Marquesina.tsx`, `lib/config/site-content-defaults.ts`,
`lib/config/site-content-schema.ts`, `components/admin/tienda-secciones.ts`. Tier 1 (toca
`components/storefront/` y `site-content-schema.ts`). **Desviación medida y declarada** del spec: el
panel NO ofrece una vista mínima al pasar el mouse sobre cada opción — el control es un `<select>`
NATIVO (§ CLAUDE.md, "el select es NATIVO"; "la lista desplegada la pinta el sistema operativo y no
se puede tipografiar"), y no hay otra forma de la misma tarea YA visible en el panel que justifique
reemplazarlo por un control compuesto (el criterio que sí justificó `CategoriaCombobox`). El `hint`
del campo describe las cinco en una frase cada una; la vista real es la vista previa en vivo o la
tienda publicada.

**TERCER PEDIDO FUERA DE ESTA NUMERACIÓN:** `EDITOR-TIENDA-TRANSICIONES-TARJETAS-1` — el `<select>`
nativo de arriba pasa a una FILA DE TARJETAS, una por transición, cada una con mini animación en
bucle — **ENTREGADO** (2026-10-04). El owner encoló explícitamente este reemplazo el 2026-10-03
("Encolala"), justo después de aceptar la desviación "sin vista previa" de `EDITOR-TIENDA-
MARQUESINA-TRANSICIONES-1`. Componente nuevo `components/admin/SelectorTransicion.tsx`
(`role="radiogroup"`/`role="radio"`, roving tabindex, flechas mueven foco+elección, `<button>` nativo
da Enter/Espacio gratis). La mini animación NO copia valores: `estiloTarjetaTransicion` (nuevo,
`lib/animation.ts`) es un envoltorio delgado sobre `transformTransicionMarquesinaItem`/
`filterTransicionMarquesinaItem`/`opacidadEntradaSalidaItem` (las MISMAS tres funciones de la banda
real) con una ventana de demo fija; `progresoLoopTarjetaTransicion` hace avanzar el progreso solo,
vía `requestAnimationFrame` en el componente. "En reposo, cada tarjeta muestra el cuadro final" y
"con movimiento reducido, nunca se anima" son el MISMO interruptor: `estatico = prefiereReducido ||
!activa` — con `estatico=true` las tres funciones devuelven su identidad sin mirar el progreso.
`CampoTexto` gana el discriminador `transicionMarquesina?: boolean` (tan específico como
`producto`/`categoria` a propósito — generalizarlo antes de un segundo caso sería diseñar para un
requisito que nadie pidió) y `opciones` gana un `hint?` por opción (antes un solo párrafo
concatenado en el `hint` del campo). Toca `lib/animation.ts`, `lib/animation.test.ts`,
`components/admin/tienda-secciones.ts`, `components/admin/TiendaSeccionEditor.tsx`,
`components/admin/SelectorTransicion.tsx` (nuevo). Tier 2 (no toca `components/storefront/` ni
`site-content-schema.ts`: el campo `transicion` ya existía, sólo cambia el WIDGET que lo edita).
Verificado de punta a punta con sesión real (`.scratch/arnes-transiciones-tarjetas.ts`, no
comiteado): 5 tarjetas con `role="radio"`, hover anima sola (dos muestras del estilo difieren),
reposo fijo en el cuadro final, clic escribe el borrador (confirmado contra `GET /api/site-content`
por polling), ArrowLeft mueve foco+elección juntos, y la elección sobrevive a un reload de la
página (persistida en el borrador del servidor, no sólo en memoria). Capturas en
`.scratch/capturas-transiciones-tarjetas/` (no comiteadas).

**SLICE 6 ENTREGADO (2026-10-03).** El botón «Composición: <nombre>» (`TiendaSeccionEditor.tsx`,
sólo `seccion==='hero'`) abre la vista nueva «¿Cómo se arma tu hero?» (`components/admin/editor/
ComposicionHero.tsx`, nuevo — monta `VistaNueva`, la hoja ya construida por el slice 4): las CUATRO
composiciones reales —Cortina/Ficha/Portada/Marquesina, en el orden de `REGISTRY.hero.variantes.
claves`— cada una con su miniatura, su nombre, qué zonas trae («Trae: …») y qué se guarda si
cambiás («Se guarda: …», sólo zonas de TEXTO con contenido real que la composición elegida no
renderiza). Elegir una escribe `hero.variante` por el MISMO `cambiar()` de cualquier campo; el
lienzo (el `<iframe>`) cambia al instante porque `onCambio`→`enviarCambio` YA mandaba el form
completo en cada cambio — no hizo falta tocar el puente ni ningún archivo de
`components/storefront/`.

**CIERRA, PARA EL HERO, EL HUECO `PANEL-EDITOR-VARIANTES-COMPOSICION-1`** (`panel-controles.ts`,
`PENDIENTE_PANEL`): `hero.variante` pasó a CONTROLADO (`config.composiciones` → `panel-controles.ts`
deriva `variante` como campo controlado con sólo esa config presente) y su entrada se retiró; el
trinquete de `PENDIENTE_PANEL` bajó de 11 a 10. Las otras TRES secciones con `variante`
(`brandStory`/`presentaciones`/`subscriptionCTA`) **siguen sin este control** — este slice sólo
tocó el hero, por `touches:` — y su `cierra` se re-etiquetó a `PANEL-EDITOR-VARIANTES-
COMPOSICION-2` (el id viejo ya quedó asociado al trabajo de ESTE slice).

**MINIATURA ESQUEMÁTICA, no el componente real — desviación medida y declarada, dentro de lo que
el propio spec autoriza** ("si renderizar el hero en miniatura es caro, una captura esquemática
fiel y decilo"): la vista previa en vivo por React (`VistaTiendaEnVivo.tsx`/`VistaTiendaContenido`)
quedó RETIRADA del camino del editor desde `EDITOR-TIENDA-IFRAME-VISTA-1` —medido: cero imports en
`TiendaSeccionEditor.tsx`/`TiendaPaginas.tsx`, sólo sobrevive en `admin-tienda-preset.test.ts`—; el
lienzo de hoy es un `<iframe>` a la página real. Montar las CUATRO variantes del hero a la vez
dentro de la hoja para compararlas de verdad habría exigido reconstruir esa vía retirada sólo para
esta hoja. Cada miniatura es, en cambio, `style` inline con tokens `--duna-*` ya declarados —sin una
sola clase CSS nueva, `app/(admin)/duna.css` no está en `touches:`— fiel a la POSICIÓN de cada zona
(texto centrado vs. a un lado, tarjeta flotante, cinta de marquesina), no un pixel-perfect.

**VERIFICADO POR EJECUCIÓN — sesión real, 4/4.** `.scratch/arnes-composicion.ts` (no comiteado):
Postgres efímero, `migrate deploy` + seed canónico, `next build`/`next start`, Playwright con
sesión real (`admin@sierranativa.co`). Abrió la vista (4 composiciones + badge "Actual" visibles) →
Cortina → Portada (el canvas gana el chip de Indicador, exclusivo de media/sticky — Cortina nunca
lo monta) → Marquesina (la tarjeta avisa «Se guarda: Línea superior, Titular, Subtítulo, Botones»
ANTES de elegirla; elegida, el canvas deja de tener NINGÚN nodo `[data-editor-campo="hero.titulo"]`
— confirma por ejecución la Desviación 1 de `EDITOR-TIENDA-ZONAS-1`: 'sticky' nunca rinde el
titular) → de vuelta a Cortina (el titular reaparece en el canvas; el campo del panel —"Productos
que cuentan"— nunca cambió de valor en todo el recorrido). 5 capturas en
`.scratch/capturas-composicion/` (no comiteadas).

**SLICE 7 ENTREGADO (2026-10-04).** Letra/tamaño/color/alineación por elemento, con la barra
flotante ANCLADA AL DOCUMENTO (§ 5/§ 7, el mismo mecanismo que `EDITOR-TIENDA-CAMPO-ANCLADO-1`) y
el control gemelo en el panel («el panel muestra lo mismo con más espacio»).

**EL MODELO** (`lib/config/estilo-elemento.ts`, nuevo, puro): `ELEMENTOS_ESTILO` es la fuente
ÚNICA de qué elemento de qué sección es estilizable — hoy `hero.{titulo,subtitulo,fraseAlPie,
ctaPrimarioLabel,ctaSecundarioLabel}`, los CINCO del spec («titular, subtítulo, leyenda, botón» —
los DOS CTA cuentan como «botón»). `REGISTRY.hero.estilos` (site-content-defaults.ts) se DERIVA de
esa misma lista (`elementosEstiloDeSeccion('hero')`), nunca una segunda lista a mano. Cada
elemento guarda `{fuente, tamano, color, alinear}`, los CUATRO en `null` por defecto — un `null`
NUNCA emite una clave de `style`, byte-idéntico sin fila (afirmado en capa 1 y por SSR real de los
4 heros).

**LETRA**: `null` ("Por defecto", el rol correcto del par activo) → `'otra-del-par'` (el rol
contrario del MISMO par — nunca descarga nada nuevo, las dos fuentes del par activo ya viajan
juntas) → una `ClaveFuentePar` de la colección curada completa (`fuentes.ts`, los DIEZ pares —
§ 10 quedaba abierto si eran los diez o un subconjunto: SON LOS DIEZ). Elegir un par DISTINTO del
activo inyecta su `<link>` de Google Fonts — `HeroSection.tsx` (el dispatcher, montado siempre)
renderiza un `<link rel="stylesheet">` por cada par REFERENCIADO en `hero.estilos`
(`paresFuenteReferenciados`), el MISMO patrón declarativo que `app/(storefront)/layout.tsx` ya usa
para el par activo del tema — sin esto, un par ajeno al tema no tendría archivo que descargar.

**TAMAÑO**: cinco pasos con nombre (`TAMANOS_ELEMENTO`/`LABEL_TAMANO_ELEMENTO`), mapeados a una
escala de `clamp()` PROPIA por tipo de elemento (titular/subtítulo/leyenda/botón) — el ajuste al
ancho del dispositivo lo hace el propio `clamp()`, sin JS de breakpoints. El techo de
`titular.enorme` es literalmente el `CLAMP_XL` de `escala-display.ts` ('amplia'): el titular más
grande que el repo ya calibró, reusado por una razón de diseño, no por coincidencia. Un `tamano`
de elemento GANA sobre `tema.escalaDisplay` cuando los dos aplican (orden del spread en el
`style`) — afirmado en `escala-display.test.ts`.

**COLOR** (decisión del owner, 2026-10-02, citada en el ledger_id): «Por defecto» primero (sin
`color` → sin `style`, la zona pinta lo de siempre); después SEIS roles de la paleta en palabras
—Acento·Tinta·Suave·Fondo·Superficie·Tostado (`ROLES_COLOR_ELEMENTO`, palette-derive.ts — § 10
quedaba abierto cuántos roles: SON SEIS, los que el spec nombró textual)—, cada uno con su frase
corta, filtrados a los que SE LEEN BIEN sobre el fondo real de la zona (`rolesColorLegibles`,
contraste ≥3 contra `derivarPaleta(tema)` — un umbral relajado a propósito, documentado, no AA:
roles decorativos como Tostado/Superficie no tienen por qué pasar 4.5); «Avanzado › Personalizado»
abre un `<input type="color">` nativo + guarda `custom:#rrggbb`. **SIN aviso visible de contraste**
en ningún punto — el filtro recorta la LISTA en silencio, nunca avisa sobre la opción elegida.
**Se guarda el ROL** (`'tostado'`), nunca el hex — cambiar de combinación de paleta recolorea el
elemento sin tocar su dato (afirmado: el mismo `color:'tostado'` resuelve a un `var(--sf-tostado)`
distinto bajo cada paleta). Al pasar el mouse sobre un swatch de rol, la barra previsualiza el
color EN LA PÁGINA (un estado local en `EditorPuenteVivo.tsx`, nunca posteado) — se apaga solo al
salir o al cambiar de campo.

**EL MECANISMO**: la barra flotante reusa `TIPO_MENSAJE_CAMPO_CAMBIO` (nunca un canal nuevo) con
una ruta de TRES partes, `estilos.<elemento>.<subcampo>` — la tercera forma que `fusionCampoEditable`
(`lib/storefront/campo-editable.ts`) sabe aplicar, junto a la plana y la de ítem de repeater.
«Quitar» manda los CUATRO subcampos con `''` (= `null`), ESCALONADOS (`postarEscalonado`, el mismo
fix de `EDITOR-TIENDA-ZONAS-1` para el defecto de dos `postMessage` en la misma pila pisándose en
`formRef`). El control del panel (`EstiloElementoControles.tsx`, nuevo) NO pasa por este canal —
`TiendaSeccionEditor.tsx` ya tiene el `form` en memoria, así que escribe el objeto directo con el
mismo `cambiar()` partial-merge que cualquier otro campo.

**DESVIACIÓN DE `touches:` MEDIDA Y DECLARADA — `lib/storefront/campo-editable.ts`.** El spec
listaba `campo-editable.test.ts` pero NO `campo-editable.ts` (el archivo fuente), la ÚNICA
asimetría de todo el `touches:` de este slice — cada otro módulo aparece con su `.ts` Y su
`.test.ts` juntos. Extender `fusionCampoEditable` para la ruta de tres partes `estilos.*.*` era
necesario para que la barra flotante (que SÍ debía construirse, por `touches:` y por el propio
texto del spec) funcionara de punta a punta — sin esto, cada mensaje de la barra se habría
perdido en silencio contra `escribirCampo`. Medido el patrón de pares en el resto de la lista
antes de decidir: se procedió, y se declara acá en vez de silenciarlo.

**FUERA DE ALCANCE, medido y declarado — `marquesina.texto` ("frase de la marquesina del hero
sticky"):** su render vive en `components/storefront/home/MarquesinaMotor.tsx`
(`MarquesinaFraseMotor`, el `<CampoEditable campo={campo}>` del loop), un archivo FUERA de
`touches:`. `ELEMENTOS_ESTILO` no lo declara — construir el modelo/schema para un elemento cuyo
estilo nunca se aplicaría visualmente habría sido una barra flotante que miente. Coined
`EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1` para el día que `MarquesinaMotor.tsx` entre a
`touches:` de algún slice.

**VERIFICADO**: `npm run gate` (typecheck + 3506/3506 + 328/328 integración) GREEN; `next build`
compiló sin error; `npx eslint` sobre los 24 archivos de `touches:` tocados — CERO problemas
nuevos (confirmado línea por línea contra `git show HEAD:<archivo>`, mismo conteo antes/después en
cada archivo con hallazgos pre-existentes); `npm run verificar:nayoli:visual` y `npm run
guarda:color` — la MISMA cifra exacta, dígito a dígito, del piso heredado
(`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta:home` 165052/4608000 px (AA) · 174711 crudo, caja
[105,862]–[1183,3581]; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICO. Ver DECISIONS.md
para la verificación de ejecución completa.

**SLICE 8 ENTREGADO (2026-10-04) — EL ÚLTIMO DEL PLAN NUMERADO.** El botón «Publicar» de la barra
superior dejó de ser dos botones sueltos (`Descartar`/`Publicar`) junto a una píldora "N sin
publicar": ahora es UN botón con un badge ámbar de conteo que abre un POPOVER
(`components/admin/editor/ResumenPublicar.tsx`, nuevo) listando EN PALABRAS qué va a publicarse —
los ejemplos del spec, en la MISMA forma: «Hero de la home · Titular · cambiado»/«nuevo» (según si
el campo estaba vacío antes) y «Hero de la home · Composición «Portada»», los dos VERIFICADOS por
ejecución (§ el arnés, abajo). El tercer ejemplo del spec —un párrafo de Nosotros, "Nosotros ·
Párrafo 3"— sale del MISMO mecanismo genérico sin caso especial (`nosotrosHistoria.parrafo3` tiene
`.label: 'Tercer párrafo'` en `tienda-secciones.ts`, así que produciría «Nosotros · Tercer párrafo ·
nuevo»); no se re-verificó por ejecución PARA ESA SECCIÓN puntual —el arnés edita Hero, no
Nosotros—, pero SÍ está cubierto por el test unitario genérico de "texto" en
`resumen-cambios.test.ts` (que no usa `nosotrosHistoria` como fixture, pero ejercita la misma rama
de código que cualquier `CampoTexto` sin `opciones` recorre). "Publicar"/"Descartar todo" viven DENTRO del popover.

**EL MODELO ES PURO Y REUSABLE: `lib/admin/resumen-cambios.ts`** (`resumenCambios(pendientes,
borrador, publicado)`) compara dos `SiteContentData` YA RESUELTOS —la forma que
`readSiteContentParaEditor`/`readSiteContent` devuelven— sección por sección, usando los nombres que
`SECCIONES_TIENDA` ya declara (nunca una segunda lista de labels). Cubre texto (nuevo/cambiado/
quitado), composición y selects de opciones fijas (el valor elegido entre comillas, nunca
"cambiado" a secas — un select siempre tiene un valor), booleanos, estilo por elemento
(`hero.estilos.*`, agregado completo, no por subcampo), repeaters (posicional), y las dos claves
META `'orden'`/`'tema'` ("Estilo"). Los campos `seccionCruzada` (`marquesina.texto`/`.productoSlug`,
mostrados en la tarjeta del hero pero guardados en `content.marquesina`) se resuelven contra su
sección DUEÑA, no contra la que los muestra — sin esto habrían sido invisibles para el resumen.

**EL RESUMEN SE CALCULA AL ABRIR EL POPOVER**, con un refetch fresco del borrador (no el `doc` ya en
memoria, que puede llevar un rato sin refrescarse) + `/api/site-content/publicado` en paralelo —
nunca en cada render. `TiendaPaginasHandle` ganó `resumenPendientes()`/`irAItem(clave)`; el segundo
navega el panel/lienzo al tocar una fila (abre el nivel de la sección, o vuelve a Inicio para
'orden'; 'tema' lo resuelve `EditorTiendaPantallaCompleta` cambiando de `modo`, porque ese estado no
lo posee `TiendaPaginas`).

**AJUSTE medido contra el arnés, no anticipado en el diseño:** el encabezado del popover cuenta las
FILAS que la lista muestra (`cambios.length`), no las CLAVES pendientes (`pendientes`, el badge del
botón) — la primera versión decía "Un cambio sin publicar" sobre una lista de TRES filas (las tres
ediciones vivían en la MISMA sección, "hero"), y el desacuerdo entre el encabezado y lo que está
debajo se vio de inmediato en la primera captura del arnés.

**VERIFICADO POR EJECUCIÓN — sesión real, 7/7.** `.scratch/arnes-publicar-resumen.ts` (no
comiteado): Postgres efímero, `migrate deploy` + seed canónico, `next build`/`next start`,
Playwright con sesión real (`admin@sierranativa.co`). Tres ediciones sobre Hero (Titular, Subtítulo,
Composición → Portada), el popover lista las tres EN PALABRAS con el encabezado correcto, "Publicar"
desde el popover publica de verdad (confirmado contra la ruta PÚBLICA, sin sesión: el titular nuevo
aparece en `/`), y el botón de la barra desaparece al no quedar pendientes. 4 capturas en
`.scratch/capturas-publicar-resumen/` (no comiteadas). Ver DECISIONS.md para la verificación
completa, incluida la deviación medida del selector de toast de sonner (no afecta el resultado: se
verificó por el EFECTO, no por el toast).

**VERIFICADO**: `npm run gate` (typecheck + 3528/3528 + 328/328 integración) GREEN; `next build`
compiló sin error; `npx eslint` sobre los 5 archivos de `touches:` — CERO problemas nuevos (los 3
warnings que aparecen son PRE-EXISTENTES, confirmado por posición fuera de los hunks de este diff).
`verificar:nayoli:visual`/`guarda:color` NO corridos — fuera de alcance: este diff no toca un solo
archivo de `components/storefront/` ni `app/(storefront)/`, así que no hay drift visual público que
medir.

**CIERRA EL PLAN POR SLICES DE § 9.** Los ocho numerados están ENTREGADOS, más los TRES pedidos
aparte del owner sobre la sección Marquesina (`EDITOR-TIENDA-MARQUESINA-SECCION-1`,
`EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1`, y `EDITOR-TIENDA-TRANSICIONES-TARJETAS-1` — el reemplazo
del `<select>` por tarjetas que el owner encoló el mismo día que aceptó la desviación "sin vista
previa" del segundo). Lo que queda de este documento es § 10, ya resuelto
en su mayoría (ver abajo), y las mejoras futuras que cada slice fue anotando en su propio
`open_followups` (`EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1`, `PANEL-EDITOR-VARIANTES-
COMPOSICION-2`, entre otras) — ninguna bloquea el cierre de este plan.

**CUARTO PEDIDO FUERA DE ESTA NUMERACIÓN: `EDITOR-TIENDA-CROMO-1` — el Encabezado, el Menú y el Pie
entran al editor (2026-10-04).** Pedido textual del owner tras ver el editor de pantalla completa
construido por los ocho slices numerados: *"De acuerdo, agrega el encabezado, el menú y el pie al
editor."* Hasta este slice, `EncabezadoSeccion`/`MenuSeccion`/`FooterSeccion` eran editores BESPOKE
que vivían SÓLO en `/admin/tienda` (patrón `PaletaSeccion`, decisión original de § EDICION-
INLINE.md § 5: "Nav y pie quedan FUERA de este diseño por alcance... viven fuera de
`SECCIONES_TIENDA`/el iframe por completo"). Ese alcance se amplía ahora, sobre el MISMO
razonamiento que ya desbloqueó Colores (§ EDITOR-TIENDA-TEMA-1): el lienzo nuevo es el `<iframe>` a
la tienda REAL, con su árbol de providers completo — la razón original para mantenerlos bespoke
("montar `StoreNav`/`StoreFooter` en el árbol del admin lanza fuera de su árbol de providers") ya
no aplica al LIENZO (sí sigue aplicando a `/admin/tienda`, que no cambió).

**LO QUE CAMBIÓ: los TRES editores entran a «Secciones» del panel con niveles, store-wide (Encabezado
y Menú arriba de las secciones de la página, Pie al final) — se ven igual en cualquier pestaña del
selector, nunca filtrados por `pagina`. `StoreNav.tsx`/`StoreFooter.tsx` ganan marcadores
`data-editor-seccion="encabezado"/"menu"/"footer"` (gateados a `useModoEditorActivo()`, cero bytes
fuera de modo editor — el MISMO contrato que `data-editor-seccion` ya cumple en `page.tsx`) para que
un clic en el nav o el pie DENTRO del iframe abra su nivel, igual que cualquier sección. Un cuarto
mensaje reutilizado del puente (`seccion:'encabezado'`, § `datosDeEncabezado`,
`lib/storefront/editor-puente.ts`) empuja las CUATRO metas combinadas del Encabezado al contexto de
React — a diferencia de 'orden'/'tema' (DOM directo / CSS), el Encabezado SÍ necesita re-renderizar
`StoreNav`, que las lee por `useSiteContent()`. `logo` (la quinta pieza que edita esa misma tarjeta)
viaja aparte, por el canal genérico — SÍ es sección del REGISTRY.**

**LOS TRES EDITORES SE ADAPTARON CON UN `enEditor` BOOLEANO (default `false`, patrón
`PaletaSeccion`), no se copiaron**: reportan `onPaso`/`onEstado` al historial y al agregado
compartidos (mismo contrato que `TiendaSeccionEditor`), dejan de dibujar sus propios botones
Publicar/Descartar (la barra GLOBAL los publica en lote), y exponen un handle imperativo
(`abrir`/`cerrar`/`marcarPublicado`/`restaurarDesdePublicado`) para que `TiendaPaginas` los integre
exactamente como integra cada `TiendaSeccionEditor`. `/admin/tienda` los sigue montando SIN esa
prop — comportamiento byte a byte igual al de antes de este slice.

**DEVIACIÓN MEDIDA — 'encabezado' se publica por SU PROPIA ruta, no en el lote genérico.** El
endpoint `POST /api/site-content` (`accion:'publicarVarias'/'descartarVarias'`) valida
`secciones.every(s => s==='orden' || s==='tema' || s in REGISTRY)` — 'encabezado' no es ninguna de
las tres (sus cuatro metas están deliberadamente EXCLUIDAS del REGISTRY, § EncabezadoSeccion.tsx) y
el lote ENTERO se rechazaría si viajara ahí. `TiendaPaginas.publicarPendientes`/`descartarPendientes`
publican 'encabezado' por su ruta dedicada (`/api/site-content/encabezado`, la misma que
`EncabezadoSeccion.accionBorrador` ya usaba), **SECUENCIAL con el lote genérico** que sigue llevando
'orden'/'tema'/'menu'/'footer'/las secciones de página ('menu'/'footer' SÍ son claves del REGISTRY).

**EL HALLAZGO QUE EL ARNÉS DE ESTE SLICE ATRAPÓ: las dos NO pueden ir en `Promise.all`.** El primer
intento disparaba el lote genérico y la ruta del Encabezado EN PARALELO — dos transacciones
INDEPENDIENTES sobre la MISMA fila de `SiteContent` (cada una con su propio `findUnique` → computa
`nuevoContent`/`nuevoBorrador` → `update`), sin lock cross-operación (§ CLAUDE.md, "SIN lock
cross-operación" — ya documentado para el race HUMANO guardar↔publicar; esto es el mismo riesgo,
creado por ESTE código al disparar dos escrituras a la vez). Medido contra la base real
(`.scratch/verificar-cromo-sesion.ts`): "Publicar 3" devolvía `200 {"ok":true}` en las dos llamadas,
pero `content.menu` seguía SIN el valor nuevo — la transacción de 'encabezado', que leyó la fila
ANTES de que el lote genérico commiteara, pisó el content completo al escribir la suya. Se corrigió
SECUENCIANDO los dos `fetch` (`await` uno, después el otro) — el costo es una ida y vuelta de red
más, nunca una carrera. **No volver a `Promise.all` estas dos llamadas.**

**EL PIE GANA MARCADORES `CampoEditable` SOBRE SUS TEXTOS SIMPLES** (encabezados de columna,
`tarjetaTexto`, las etiquetas de los enlaces legales) — un clic en esos textos DENTRO del iframe abre
el campo flotante de siempre, enrutado a `FooterSeccion.escribirCampo` (mismo `fusionCampoEditable`
que ya usa `TiendaSeccionEditor`, nunca una segunda fusión a mano). **El Encabezado y el Menú NO
ganan `CampoEditable` en esta tanda — deviación medida y declarada:** la "tagline" que el pedido del
owner podría sugerir es `SiteSetting.tagline` (identidad del negocio, Configuración, otro modelo —
§ CLAUDE.md "negocio≠tienda"), no `SiteContent`; el mecanismo de campo flotante está arquitecturado
para secciones de `SiteContent`, así que tejerlo a `SiteSetting` sería una pieza nueva, no una
reutilización. Las etiquetas del Menú se renombran desde su PANEL (que ya lo permitía, sin cambios),
y el Encabezado ofrece color/visibilidad del sub-encabezado desde el suyo — ambos alcanzables desde
«Secciones», que es lo que este slice pedía construir.

**SEGUNDO HALLAZGO DEL ARNÉS: abrir desde el lienzo necesita el `abrir()` del HANDLE, no mover
`cromoActivo` a mano.** El primer intento de `manejarSeleccionDesdeIframe`/`irAItem` llamaba
`abrirNivelCromo(marcador)` directo al reconocer un marcador de cromo — eso sólo mueve el estado
`cromoActivo` de `TiendaPaginas` (deja de estar `display:none`), pero NO le dice al editor BESPOKE
que está adentro que salga de su vista de lectura (`editando` sigue en `false`): el nivel se
"abría" mostrando el resumen colapsado, nunca el formulario. Se corrigió llamando
`cromoRefs.get(marcador)?.abrir()` — el MISMO camino que `seccionRefs.get(candidato)?.seleccionar()`
ya usa para una `SeccionVista`: el handle decide abrirse (pone `editando=true` adentro), y ESO es lo
que dispara `onAbrir` hacia el padre.

**VERIFICADO POR EJECUCIÓN — sesión real, de punta a punta.** `.scratch/verificar-cromo-sesion.ts`
(no comiteado): Postgres efímero, `migrate deploy` + seed canónico, `next build`/`next start`,
Playwright con sesión real (`admin@sierranativa.co`). Abrió Encabezado desde la fila de «Secciones»
y, por separado, desde un clic en el logo del nav DENTRO del iframe (las dos vías llegan al mismo
nivel); encendió «Tratamiento del menú» y vio el `text-transform` del link cambiar de `none` a
`uppercase` EN VIVO, sin recargar el iframe (marca de `window` que un reload habría borrado, intacta);
abrió Menú y renombró el primer ítem — el `<nav>` real del iframe mostró el nuevo texto al instante;
hizo clic en el pie DENTRO del iframe (abrió su nivel), apagó «Mostrar "Hecho por Duna"» y vio el
crédito desaparecer en vivo; hizo clic en el campo editable `footer.columnaTienda` y escribió un
texto nuevo que apareció en el `<h4>` real del pie; publicó — la tienda PÚBLICA (pestaña nueva, sin
sesión de editor) mostró el ítem de menú renombrado, el crédito apagado y el texto del pie editado;
capturas en escritorio (1440×900) y teléfono (390×844), incluido el cajón móvil del menú. Los DOS
hallazgos de arriba (la carrera de publicar, el `abrir()` del handle) se encontraron y cerraron
DENTRO de esta misma corrida del arnés, antes de reportar nada como verde.

**OPEN FOLLOW-UP — `RESUMEN-CAMBIOS-CROMO-PENDIENTE-1`:** `lib/admin/resumen-cambios.ts` (fuera de
`touches:` de este slice) no tiene una rama para 'encabezado'/'menu'/'footer' — un cambio pendiente
en cualquiera de los tres se cuenta en el badge ámbar de "Publicar" (`TiendaPaginas.listaPendientes`,
en vivo, nunca el HUECO CONOCIDO de 'tema') y SE PUBLICA de verdad al tocar el botón, pero el popover
de `ResumenPublicar` no imprime una fila EN PALABRAS para ellos (cae al "Sin detalle para mostrar."
que ese componente ya maneja con 0 filas). El día que `resumen-cambios.ts` entre a `touches:` de un
slice, las tres ramas se agregan ahí.

**QUINTO PEDIDO FUERA DE ESTA NUMERACIÓN: `EDITOR-VISUAL-MARCO-1` — el marco se ve como el
prototipo (2026-10-04).** Pedido textual del owner tras comparar el editor construido por los ocho
slices numerados + `EDITOR-TIENDA-CROMO-1`/`EDITOR-BARRA-ESTILO-CLIC-1` contra las capturas del
prototipo (`docs/editor-tienda/prototipo/`, traídas a `docs/` en este mismo slice —antes vivían en
`.scratch/`, gitignored—): *"veo que sí se han agregado cosas nuevas, pero también noto que aún
luce como antes del rediseño en mayor parte"*. Los ocho slices + los cuatro pedidos aparte
construyeron la FUNCIÓN sobre la capa visual VIEJA (la de antes del prototipo); éste es el primer
slice que ataca la capa visual en sí, acotado a lo que el propio spec nombra: la barra superior, el
riel, y el lienzo — NUNCA el panel (sus filas/tarjetas, migas, niveles: eso ya se construyó en
`EDITOR-TIENDA-SHELL-1` y no es parte de este programa).

**LA BARRA** pasa de una fila de `duna-pill`/`duna-btn` sueltos a la anatomía del prototipo (§ 3):
tres secciones `flex:1`/auto/`flex:1` (izquierda/centro/derecha) para que el grupo central quede
SIEMPRE centrado — `‹ volver` (ahora sólo ícono) · un separador vertical · el avatar de iniciales de
la tienda + su nombre, al centro el selector de PÁGINA (de `role="tablist"` con tres pestañas a UN
desplegable "Página: Inicio ▾", Popover + `useContenedorDunaPortal` — el MISMO mecanismo que
`ResumenPublicar` ya usaba, no uno nuevo) y el segmentado de DISPOSITIVO (de tres `duna-pill` con
ícono+texto a `.duna-seg`/`.duna-seg__item`, ya en el paquete — la primitiva correcta por doctrina:
"el pill FILTRA un conjunto; el segmentado cambia el MODO de ver lo mismo", § CLAUDE.md), y a la
derecha deshacer/rehacer (ahora sólo ícono) · el punto de estado · "Vista previa" · "Publicar"
(`ResumenPublicar`, sin tocar — ya hecho en el slice 8).

**EL RIEL** gana "Ayuda" al fondo (empujado por un espaciador `flex:1`), DESHABILITADO con el motivo
en el `title`: no existe hoy un artículo de ayuda para quien opera el panel (`docs/editor-tienda/`
es documentación de INGENIERÍA, no del producto) — se deja la afordancia sin fingir un destino, como
pide el propio spec ("si no, sin destino y decilo").

**EL LIENZO** pasa de un `<div>` con borde simple a `.editor-stage` (fondo punteado vía
`radial-gradient(color-mix(in oklab, var(--duna-ink) 16%, transparent) …)` — sigue al tema sin una
segunda regla `[data-theme="dark"]`) → `.editor-st-meta` (la franja: la pastilla "● Borrador ·
/ruta" en mono + el nombre del dispositivo + "Navegar"/"Actualizar", AHORA ÍCONOS CHICOS en vez de
pill-con-texto y botón-con-texto — el spec: "pasan a ser íconos chicos… no se pierden") →
`.editor-canvas` (el MISMO `canvasRef`/ResizeObserver de siempre: la escala del dispositivo no se
tocó) → `.editor-st-frame` (la página enmarcada: radio + `--duna-shadow-3` + fondo blanco; el
teléfono gana un radio mayor, `--duna-r-xl`, como bisel). El panel pasa de `1fr` elástico a
`308px` fijo (§ 3, "Panel (308 px)") — SÓLO el ancho; ninguna fila/tarjeta se tocó.

**LO QUE EL PROTOTIPO DIBUJA COMO «RECORRIDO» (la barra negra de capítulos abajo) NO SE
CONSTRUYÓ** — es del prototipo, como el propio spec aclara.

**NUEVO ARCHIVO: `app/(admin)/editor/editor.css`**, importado desde `app/(admin)/editor/layout.tsx`
con el MISMO patrón que `app/(admin)/duna.css` desde `app/(admin)/layout.tsx` — admin-level
(prefijo `editor-`, no `duna-`) por la regla del segundo consumidor: hoy un solo consumidor,
`/editor/tienda`. Cero tokens `--duna-*` nuevos — todo color/espaciado/radio/sombra sale de
`packages/design-system/tokens/tokens.css`, ya cargado por el grupo `(admin)`.

**VERIFICADO POR EJECUCIÓN — sesión real, 20/20.** `.scratch/arnes-marco.ts` (no comiteado):
Postgres efímero, `migrate deploy` + seed canónico, `next build`/`next start`, Playwright con sesión
real (`admin@sierranativa.co`), viewport 1440×900. El marco nuevo está (avatar, selector de página,
segmentado, "Ayuda", lienzo punteado, pastilla, marco de página); el selector de página SIGUE
cambiando de página (Inicio↔Nosotros, el lienzo sigue a `/nosotros`); el segmentado SIGUE angostando
el lienzo a Teléfono (ancho medido < 500px); "Navegar" SIGUE togglando (`aria-pressed`) y
"Actualizar" SIGUE recargando sin romper el lienzo; deshacer/Publicar SIGUEN funcionando (editar el
titular del hero habilita "Deshacer" y hace aparecer "Publicar 2", después se deshizo el cambio de
prueba); "Vista previa" sigue presente. Capturas 1440×900 y Teléfono en `.capturas/` (gitignored),
compuestas lado a lado con `captura-prototipo-inicio.webp`.

**`npm run verificar:nayoli:visual` reproduce el MISMO piso heredado, dígito a dígito**
(`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`, ya citado por `EDITOR-BARRA-ESTILO-CLIC-1`): `ruta:home`
165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 c/u;
los 2 hovers IDÉNTICOS — cero píxeles nuevos, porque este slice no toca un solo archivo de
`components/storefront/` ni `app/(storefront)/`.

---

**SÉPTIMO PEDIDO FUERA DE ESTA NUMERACIÓN: `EDITOR-VISUAL-LIENZO-1` — lo que el editor DIBUJA
sobre la página se ve como el prototipo (2026-10-04).** `EDITOR-VISUAL-MARCO-1` hizo la barra/riel/
lienzo (el CHROME del panel); `EDITOR-VISUAL-PANEL-1` hizo el panel (filas, no tarjetas). Ninguno de
los dos tocó lo que el editor SUPERPONE sobre la página real dentro del `<iframe>` — el hover, las
zonas del hero, los controles de Alto/Oscurecer, la barra flotante de estilo, el «+» entre secciones
— que seguía con la capa visual de antes del rediseño (chips azules punteados, `<select>`s nativos
sin estilo, un outline ámbar sin nombre). Éste es ese tercer tercio.

**`components/storefront/EditorPuenteVivo.tsx`** — el componente que SE MONTA DENTRO del storefront
real (nunca en el panel) y dibuja todo el chrome efímero del editor:

- **Hover + rótulo** (`.sec::before`/`.sec::after` del prototipo): el `outline: 2px dashed #f59e0b`
  sin nombre pasó a `box-shadow: inset` en tinta (blanco sobre el hero, que es la banda oscura por
  defecto) + un rótulo oscuro mono-chico en la esquina superior izquierda con el nombre HUMANO de la
  sección («Portada», «Historia», «Menú»…). Ese nombre no existía en ningún `data-*` del DOM — lo
  resuelve `etiquetaDeSeccion` (nuevo, `lib/storefront/editor-puente.ts`, puro): `REGISTRY[clave]
  .label` para toda clave del REGISTRY (incluidas `menu`/`footer`, que SÍ son claves reales),
  `nombreInstancia(tipo)` para una instancia agregada (resuelto contra `seccionesHome` EN VIVO), y un
  mapa fijo de dos entradas (`encabezado`/`suscripciones`) para las claves META que no están en
  ninguna de las dos fuentes. `EditorPuenteVivo` escribe el resultado como atributo
  (`ATRIBUTO_EDITOR_ETIQUETA`, nuevo) sobre cada `[data-editor-seccion]` del documento —el mismo
  patrón imperativo que ya usa `sincronizarSeparadoresAgregar` para el «+»—, y el CSS lo lee con
  `content: attr(...)`.
- **El «+» entre secciones** — de pastilla azul con borde discontinuo a la línea + pastilla blanca
  del lenguaje del prototipo (tinta/blanco, Hanken Grotesk, sombra suave).
- **La barra flotante de estilo** (`BarraEstiloElemento`) — reescrita sobre el popover del prototipo
  (`.ftb`/`.tbb`/`.pop`/`.cdef`/`.crole`/`.cadv`/`.ccust`): Letra pasó de `<select>` a un trigger
  "Aa + nombre" que abre una lista con muestra tipográfica real + hint por par; Tamaño pasó de
  `<select>` numérico al stepper −/palabra/+ del prototipo (`.tbsz`); Alineación se quedó de ícono,
  restilizada; Color gana el disclosure completo — «Por defecto» primero, los seis roles en chips con
  su muestra y su frase (`ROLES_COLOR_ELEMENTO[].descripcion`, ya existía y no se usaba), y «Avanzado
  ›» con el picker de hex personalizado (`custom:#rrggbb` — el modelo YA lo soportaba desde
  `EDITOR-TIENDA-BARRA-FLOTANTE-1`, pero no tenía UI hasta acá). **Sin aviso de contraste**, como pide
  el spec — no se agregó ninguno.
- **Las zonas del hero** (`ZonaChip`, duplicado local en los 4 archivos `Hero*.tsx`) — de chip azul
  punteado a la pastilla «ghost» translúcida del prototipo (fondo blanco al 16%, borde blanco al 45%,
  `backdrop-filter: blur`), para «+ Titular»/«+ Subtítulo»/«+ Botón»/«Quitar …» por igual.
- **Alto y Oscurecer** — de un grupo de label + tres/cuatro chips sueltos apilados en la esquina
  superior izquierda a UN control compacto segmentado (`SegmentoZona`/`TRACK_SEGMENTADO`, duplicado
  local en los 4 `Hero*.tsx`), anclado al PIE del hero —dentro del área visible, a diferencia del
  `.alto-h` del prototipo, que asoma a caballo del borde porque su `.hero` no recorta; la sección real
  SÍ lleva `overflow-hidden`—, con el paso activo resaltado en blanco sobre el track oscuro. `Alto`
  deriva su paso activo con la MISMA precedencia que `claseAlturaHero` (`alto` explícito manda, si no
  decide `alturaLlena`); `Oscurecer` (sólo en la composición Marquesina) reusa `veloComboDeCampos`
  (ya existente en `site-content-defaults.ts`) para que el paso resaltado nunca pueda discrepar del
  que ya calcula el panel para el mismo par de campos.

**DEVIACIONES MEDIDAS Y DECLARADAS:**

- **El popover de la barra flotante abre SIEMPRE hacia abajo del trigger** — el prototipo invierte
  según dónde cae `.ftb` en el viewport (`.ftb.at-cap .pop` abre hacia arriba), pero decidir esa
  inversión bien exige la altura del VIEWPORT, que `anclaje` no trae (sólo coordenadas de DOCUMENTO,
  § `GeometriaCampo`, `lib/storefront/campo-editable.ts`, sin tocar). Simplificado a "siempre abajo"
  en vez de construir una inversión sin el dato que la decidiría.
- **Letra y Tamaño no son el `<select>`/popover exactos del prototipo en los DOS sentidos**: Letra SÍ
  se construyó como popover con lista (fiel); Tamaño se construyó como stepper −/palabra/+ (también
  del prototipo, pero reemplaza al `<select>` numérico con una pieza DISTINTA, no un popover).
- **Las zonas Titular/Subtítulo/Botones/Indicador siguen en flujo normal del documento, no en
  rectángulos absolutos con posición fija** como el prototipo (que puede fijarlas en % porque es una
  maqueta de una composición ESTÁTICA): los componentes reales flexionan con el contenido. Cuando
  varias zonas están vacías a la vez, sus pastillas «+X» quedan en columna vertical dentro del flujo
  —ya no apiladas en una esquina fija, pero tampoco repartidas por el lienzo como el prototipo—.
  Reconstruir el modelo de "zona con geometría propia" es alcance mayor, fuera de una pasada visual.
- **El rótulo de hover de `[data-editor-seccion="encabezado"]` no se ve**: ese marcador vive en un
  `<div style="display:contents">` (§ `StoreNav.tsx`, fuera de `touches:`), y `display:contents` no
  genera caja — ni `position:relative` ni un `::after` absoluto tienen dónde anclarse ahí. El resto
  de los marcadores (incluido `menu`, un `<nav>` real) no tiene este problema.
- **`position:relative` es NUEVO sobre todo `[data-editor-seccion]`** (antes ninguno lo llevaba) —
  necesario para anclar el rótulo de hover. Verificado contra el único `position:fixed` del árbol (el
  `<header>` de `StoreNav.tsx`, que nunca lleva este atributo) y contra los nodos con hijos
  `position:absolute` que sí existen (el `<footer>`, la media de fondo del hero): ninguno depende de
  quedar SIN contexto de posicionamiento propio.

**VERIFICADO POR EJECUCIÓN — sesión real.** `.scratch/arnes-lienzo-visual.ts` (no comiteado, adaptado
de `.scratch/capturar-editor-visual.ts` de `EDITOR-VISUAL-PANEL-1`): Postgres efímero, `migrate
deploy` + seed canónico, `next build`/`next start`, Playwright con sesión real
(`admin@sierranativa.co`), viewport 1440×900, apuntando al `<iframe title="Vista previa de la
tienda">` (`frameLocator`), no al panel. Capturado y confirmado: el hover sobre `brandStory` muestra
el rótulo «Historia» (`ETIQUETA_HERO=Portada` leído por ejecución contra el atributo real, para
`hero`); el «+» entre secciones muestra la línea + pastilla blanca al pasar el mouse; el control
segmentado «Justo · Alto · Pantalla completa» aparece siempre al pie del hero, con «Justo» resaltado;
un clic en el titular abre el overlay de texto Y la barra flotante restilizada encima; el popover de
Letra abre con las diez muestras tipográficas reales + hints; un clic en «Alineación: Izquierda»
cambia el alinear del titular en vivo (confirmado por el badge «Sin publicar» apareciendo en el
panel) — la escritura real sigue intacta. Capturas en `.scratch/capturas-lienzo-visual/` (gitignored,
no comiteadas), comparadas a ojo contra `captura-prototipo-inicio.webp`: anatomía y lenguaje visual
coinciden (chrome tinta/blanco, Hanken Grotesk, pastillas y popovers con sombra); las diferencias de
CONTENIDO (Nayoli real vs. la maqueta «Finca San Adolfo») son esperadas, no defectos.

`npm run verificar:nayoli:visual` reproduce el MISMO piso heredado de la rama, dígito a dígito
(`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta:home` 165052/4608000 px (AA) · 174711 crudo, caja
`[105,862]–[1183,3581]`; las otras 5 rutas 163/361 c/u; los 2 hovers IDÉNTICOS — ningún píxel nuevo en
la tienda PÚBLICA, porque todo lo que este slice dibuja está gateado tras `useModoEditorActivo()`
(los 4 `Hero*.tsx`) o tras `activo` (`EditorPuenteVivo.tsx`), cero bytes para cualquier visitante
real.

---

**OCTAVO PEDIDO FUERA DE ESTA NUMERACIÓN: `EDITOR-VISUAL-NIVELES-1` — los niveles de sección y de
elemento del panel se ven como el prototipo (2026-10-04).** (El SEXTO pedido cronológico,
`EDITOR-VISUAL-PANEL-1` — el panel pasa de tarjetas a filas —, no sumó su propia entrada acá; su
asiento completo vive sólo en DECISIONS.md. Se numera éste OCTAVO para no perder la cuenta de los
pedidos fuera de la numeración original, no para implicar que el sexto está documentado en esta
sección.) `EDITOR-VISUAL-MARCO-1` hizo la barra/riel/lienzo; `EDITOR-VISUAL-PANEL-1` hizo la lista de
Inicio; `EDITOR-VISUAL-LIENZO-1` hizo lo que el editor dibuja SOBRE la página real. Ninguno de los
tres tocó el FORMULARIO de una sección abierta — seguía siendo "el formulario viejo" (owner, pedido
textual): *"ayudas de varias líneas, dos columnas a ~290 px que cortan los campos, «Mostrar los
botones / Quitar»"*. Éste es ese cuarto tercio, y además construye el nivel «elemento» (Inicio › Hero
› Titular) que `EDITOR-VISUAL-PANEL-1` había dejado explícitamente para después.

**UNA SOLA COLUMNA** — `.duna-form` (el paquete) se queda en dos columnas para sus ~15 consumidores
con ancho de sobra; `.editor-panel .duna-form` (nuevo, `editor.css`, scope-only) la angosta a una,
SÓLO en este panel de 308px.

**LA AYUDA CORTA** — `components/admin/editor/AyudaCampo.tsx` (nuevo) DERIVA la versión corta de cada
hint existente (corte en fin de oración o por palabra, con elipsis, dentro de 70 caracteres) en vez de
reescribir los ~150 hints a mano; un «?» (`DunaTooltip`) abre el texto completo cuando hace falta.
Reemplaza el `<p className="duna-field__hint">` de los cinco editores del panel (genérico +
Encabezado/Menú/Pie/Repeater), nunca los avisos dinámicos (progreso de subida, destino inexistente).

**LAS ZONAS DEL HERO** pasan de un switch con el hint largo del booleano ("Mostrar los botones" +
su párrafo + "Quitar") a las filas `.zr` del prototipo: ícono + nombre + valor en gris, «+ Agregar»
sólo si está vacía. "Fondo" sale de las zonas —ni el prototipo lo trata como zona navegable (medido:
`K.ZONES` nunca incluye `'fondo'`)— y gana su propio bloque junto a "Alto", los dos como
`.duna-seg`/`.duna-seg__item` (la MISMA primitiva del picker de dispositivo de la barra) en vez de un
`<select>` nativo — "Alto" (3 pasos) y "Oscurecer" (4 pasos) caben en un segmentado; "Punto focal" (9)
se queda `<select>`.

**EL NIVEL DE ELEMENTO** (Inicio › Hero › Titular/Subtítulo/Botones/Indicador) — el tercer nivel que
no existía — vive LOCAL a `TiendaSeccionEditor.tsx` (`elementoActivo`, nuevo estado), sin tocar el
mecanismo de migas globales de `TiendaPaginas`: «‹ Hero» REUSA `Migas.tsx` (su propio docstring, de
`EDITOR-VISUAL-PANEL-1`, ya preveía este uso exacto), el campo a lo ancho REUSA `renderCampo` tal
cual (con su `EstiloElementoControles` cuando el campo es estilizable — "los MISMOS controles de la
barra flotante", el spec), y «Quitar» al pie apaga el booleano de la zona. "Botones" agrupa DOS
campos reales (`ctaPrimarioLabel`/`ctaSecundarioLabel`) contra el botón único del prototipo —
desviación medida y declarada, DECISIONS.md. Tocar una zona EN LA PÁGINA (el lienzo) también abre su
nivel de elemento, sin tocar `EditorPuenteVivo.tsx`/`editor-puente.ts`: el mensaje que el puente YA
manda (`escribirCampo`, cada tecla o cada "+Titular"/"Quitar") ya trae el nombre del campo, que un
mapa nuevo (`ZONA_HERO_DE_CAMPO`) resuelve a su zona.

**`EDITOR-VISUAL-ESTILO-FILA-1` (el follow-up de `EDITOR-VISUAL-PANEL-1`) CIERRA EN ESTE SLICE**:
`PaletaSeccion.tsx`, en el embed (`enEditor`), entra DIRECTO a sus controles — nace "editando" y
pierde el botón "Cerrar" (sin lectura a la que volver), con el título "Estilo de la tienda" del
prototipo. El STANDALONE (sin consumidor real hoy) no se tocó.

**DEVIACIONES**, con su detalle completo en DECISIONS.md: "Botones" agrupa dos campos; "Fondo" es un
bloque inline del nivel Hero, no un nivel de elemento propio; `RepeaterEditor.tsx` ganó la ayuda corta
pero NO el "asa" de arrastre (sus flechas ↑/↓ siguen siendo el mecanismo — funcional y accesible por
teclado; cambiarlas a drag-and-drop es una pieza de interacción nueva, no una pasada visual).

**VERIFICADO POR EJECUCIÓN.** `.scratch/arnes-niveles.ts` (no comiteado): Postgres efímero, `migrate
deploy` + seed canónico, `next build`/`next start`, Playwright con sesión real, viewport 1440×900.
Nueve capturas comparadas contra el prototipo; medido por consola que el panel mide 308px, que los
tres `.duna-form` del nivel de elemento resuelven a una columna, que Quitar/Agregar/deshacer siguen
funcionando, y que ningún elemento del panel tiene `scrollWidth > clientWidth` (cero cortes) salvo el
comportamiento NATIVO de un `<input>` de una línea con texto largo (scroll interno, no corte visual).

`npm run verificar:nayoli:visual` reproduce el MISMO piso heredado de la rama, dígito a dígito — cero
píxeles nuevos en la tienda pública, porque este slice no toca un solo archivo de
`components/storefront/` ni `app/(storefront)/`.

---

## 10 · Lo que este documento NO decide

- ~~Si «Alto» gana un tercer valor (campo nuevo) o se queda en dos.~~ DECIDIDO (slice 5, 2026-10-03):
  gana el tercer valor, con la aprobación del owner citada en el ledger_id de ese slice.
- ~~Qué roles se ofrecen en el selector de color.~~ DECIDIDO (slice 7, 2026-10-04): los SEIS que el
  spec nombró textual — Acento·Tinta·Suave·Fondo·Superficie·Tostado (`ROLES_COLOR_ELEMENTO`).
- ~~Si la colección de letras por elemento es la de los diez pares o un subconjunto.~~ DECIDIDO
  (slice 7, 2026-10-04): los DIEZ pares completos de `fuentes.ts`.
- Los nombres finales de las composiciones («Marquesina», «Portada», «Ficha», «Cortina»).
- Las páginas sin secciones editables (catálogo, ficha de producto); sigue valiendo
  `DISENO.md` § 4.4.
