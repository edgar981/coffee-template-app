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
| 8 | `EDITOR-TIENDA-PUBLICAR-RESUMEN-1` — el popover de publicar en palabras | barra superior | 2 |

Los slices 1 a 3 cierran los cinco errores sin esperar el rediseño. Del 4 al 8 son el rediseño
en sí, en el orden en que cada uno se ve por su cuenta.

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
