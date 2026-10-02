# Edición de texto DIRECTO sobre la página — diseño (sin código)

**Fecha:** 2026-10-02
**Rama:** `slice/corte-reescritura-prototipo-1`
**Ledger:** `EDITOR-TIENDA-EDICION-INLINE-DISENO-1`
**Autoriza:** gate del owner del 2026-10-01 (§ 12 de `DISENO.md`, el mismo que pidió la vista propia de
pantalla completa): *"aun no se siente como un editor inline"*. Confirmado explícitamente como pieza de
diseño APARTE por § 9.1 de `DISENO.md`: *"Editar DENTRO del iframe … es una pieza de diseño que este
documento no cubre … Queda pendiente de su propio documento de diseño."*
**Este documento no cambia código.** Es el documento que § 9.1 pidió. Ninguna de las piezas de abajo
está construida; el owner lo revisa antes de que exista un solo slice de implementación.

---

## 0 · Qué ya existe, y qué es nuevo

El editor (`EDITOR-TIENDA-IFRAME-VISTA-1` → `EDITOR-TIENDA-SELECCION-1`, §§ 10–14 de `DISENO.md`) ya
resuelve DOS de los tres pedidos del owner: la tienda real dentro de un `<iframe>` (sin reconstrucción
paralela) y la selección en contexto (clic en una sección DENTRO del iframe → esa sección se abre en la
lista lateral, con resalte). **Lo que falta es el tercero: escribir el texto directamente sobre la
página, sin pasar por el formulario de la lista.** Hoy un clic en el hero resalta "Portada" y la abre en
la lista — el dueño todavía tiene que mover los ojos al costado para teclear. Este documento diseña
cómo ese mismo clic, en cambio, deja escribir ahí mismo.

**Se construye SOBRE el puente ya existente, no al lado de él.** `lib/storefront/editor-puente.ts` +
`components/storefront/EditorPuenteVivo.tsx` ya resuelven panel→iframe (cambios de texto/imagen se ven
sin recargar, § 13 de `DISENO.md`) e iframe→panel (clic en una sección → se abre en la lista, § 14). La
pieza que falta es menor de lo que parece: un TERCER mensaje del mismo puente (iframe→panel: "el campo
X cambió a Y"), y una forma de que el iframe sepa, nodo por nodo, qué campo es cada texto — que hoy NO
sabe (§ 1.4).

---

## 1 · Censo medido — qué texto visible sale de un campo, y cuál no

**Método:** `REGISTRY` (`lib/config/site-content-defaults.ts`) declara, por sección, qué `campos` son
`'requerido'`/`'opcional'` — la fuente única que ya usan el resolver, el schema de guardado y el editor
de la lista (`components/admin/tienda-secciones.ts`, `SeccionConfig.campos`/`.imagenes`). Contado
programáticamente contra ese REGISTRY (no a mano): las 15 secciones de home/nosotros/suscripciones
declaran **152 campos** en total. De ellos:

| clase | cuántos | por qué quedan fuera de "texto libre" |
| --- | --- | --- |
| **Imagen** (`imagen`, `imagenPoster`, `imagen1..4`, `imagenFondo`…) | 18 | Son URLs de blob — el clic abre el selector de archivo (§ 4), no un campo de texto. |
| **Selector/pointer** (`categoria1..4`, `ctaDestino`, `ctaSecundarioDestino`, `destacadoSlot`, `productoSlug`+grupo) | 13 | Se eligen de una lista cerrada (combobox de categorías reales, combobox de productos, select de planes) — tipear ahí no tiene sentido; siguen siendo del formulario de la lista. |
| **Texto libre** (título, subtítulo, párrafo, label, badge, nombre, descripción…) | **121** | Candidatos reales a edición directa. |

Más **7 plantillas de campo de ítem de repeater** (`testimonials`: name/city/text/product = 4;
`nosotrosGaleria`: `alt` = 1, `url` es imagen; `suscripcionFaq`: question/answer = 2), de cardinalidad
VARIABLE (hasta 12 fotos, sin tope de testimonios/preguntas) — no se pueden contar como un número fijo
de nodos: dependen de cuántos ítems tenga el borrador en cada momento.

### 1.1 · Home (`app/(storefront)/page.tsx`)

| Sección (`SeccionVista`) | Campos de TEXTO libre | Imagen | Selector/pointer | Texto NO editable en esta sección |
| --- | --- | --- | --- | --- |
| `hero` | eyebrow, titulo, tituloEnfasis, subtitulo, ctaPrimarioLabel, ctaSecundarioLabel, fraseAlPie (7) | imagen, imagenPoster, imagenMovil, imagenMovilPoster (4) | — | El indicador **"Desliza"** (`HeroMediaMarquesina.tsx`) es un literal fijo del código — no hay campo. |
| `marquesina` | texto (1) | imagen (1) | — | — |
| `trustBadges` | **0** | — | — | Las 4 insignias (ícono + texto: "Origen 100% colombiano"…) son el array `BADGES` fijo de `TrustBadges.tsx` — sólo el switch "Mostrar" es dato. |
| `brandStory` | eyebrow, titulo, parrafo1, parrafo2, ctaLabel (5) | imagen1..4 (4) | ctaDestino (1) | — |
| `origen` | eyebrow, titulo, lede, 4×datoLabel, 4×datoValor, 3×statEtiqueta (14) | imagen1, imagen2 (2) | — | — |
| `presentaciones` | eyebrow, titulo, label1..4, copy1..4, ctaLabel (10) | imagen1..4 (4) | categoria1..4, ctaDestino (5) | Con `variante:'riel'` (§ 3.1), las tarjetas visibles son productos del CATÁLOGO — `label*`/`copy*` no tienen efecto aunque existan en el REGISTRY. |
| `subscriptionCTA` | eyebrow, titulo, subtitulo, bullet1..4, ctaLabel, ctaSecundarioLabel (9) | imagenFondo (1) | ctaSecundarioDestino (1) | — |
| `testimonials` | eyebrow, titulo (2) + por ítem: name, city, text, product (4) | — | — | `stars` es numérico (clic de estrellas), no texto. |
| `spotlight` | eyebrow, titulo, badge, nombreCafe, notaPrecio (5) | — | productoSlug+grupo (4) | Nombre del producto, descripción, notas de cata y **precio** se LEEN del `Product` pineado — vienen del catálogo, nunca de `SiteContent` (§ 3.1, mismo motivo por el que el precio queda fuera de todo este diseño). |
| `featured` (= la banda que ocupa `spotlight`) | — | — | — | Sin `SeccionConfig` propia aparte de `spotlight` (§ el docstring de `SeccionConfig.bandaId`). |

Además, visibles en TODA página de home (y de nosotros/suscripciones, porque viven en el layout, no en
`page.tsx`): el **nav** (`StoreNav`) y el **pie** (`StoreFooter`). Sus textos SÍ son `SiteContent`
(`content.menu`/`content.footer`) y `SiteSetting` (`nombre`/`tagline`), pero se editan HOY por un
formulario APARTE (`MenuSeccion.tsx`/`FooterSeccion.tsx`/`DatosNegocioSeccion.tsx`, "cromo transversal",
§ 1.1 de `DISENO.md`) — **ninguno vive en `SECCIONES_TIENDA`**, así que hoy no son alcanzables desde el
iframe (ni por selección en contexto, ni por edición directa). Censado aparte en § 1.4.

### 1.2 · `/nosotros`

| Sección | Campos de TEXTO libre | Imagen | Selector/pointer |
| --- | --- | --- | --- |
| `nosotrosHistoria` | eyebrow, titulo, parrafo1, parrafo2, parrafo3 (5) | imagen (1) | — |
| `nosotrosGaleria` | eyebrow, titulo (2) + por ítem: alt (1) | por ítem: url (1) | — |
| `nosotrosCierre` | titulo, parrafo, ctaLabel (3) | imagenFondo (1) | ctaDestino (1) |

Nav y pie, igual que en home (§ 1.1).

### 1.3 · `/suscripciones`

| Sección | Campos de TEXTO libre | Imagen | Selector/pointer |
| --- | --- | --- | --- |
| `suscripcionPlanes` | eyebrow, titulo, tituloEnfasis, subtitulo, planesTitulo, planesSubtitulo, ctaLabel (7) + por plan (1-4): nombre, descripcion, precio, ben_1..4 (hasta 8 × 4 planes = 32) | — | destacadoSlot (1) |
| `suscripcionPasos` | titulo (1) + por paso (fijos, 4): label, desc (8) | — | — |
| `suscripcionFaq` | titulo (1) + por ítem: question, answer (2) | — | — |

**El precio de un plan (`precio1..4`) ES texto libre de `SiteContent`** (a diferencia del precio de un
producto, que es del catálogo) — pero § 9.1 lo excluye igual: la decisión del owner fue "el precio NO se
edita desde el editor", sin distinguir precio-de-plan de precio-de-producto. Se mantiene afuera por
alcance (§ 5), no porque el mecanismo no pudiera.

Nav y pie, igual que en home (§ 1.1).

### 1.4 · Lo que NO sale de un campo editable desde el iframe hoy

| Texto visible | Fuente real | Por qué no es candidato de ESTE diseño |
| --- | --- | --- |
| Nombre/descripción/notas de cata/precio de cualquier producto en `/tienda`, `/tienda/[slug]`, el riel de Presentaciones, Spotlight | `Product` (Prisma, `/admin/productos`) | Catálogo — § 9.1 lo excluye explícitamente ("el precio sigue siendo dato del catálogo"), y por extensión cualquier otro campo del producto: no hay `SiteContent` que editar ahí. |
| Las 4 insignias de `trustBadges` | `BADGES` (array fijo, `TrustBadges.tsx`) | Estructura de código — ampliarlas a dato editable es, según su propio comentario, "una decisión aparte". |
| "Desliza" (hero-media) | Literal fijo (`HeroMediaMarquesina.tsx`) | Microcopy de UI, nunca se declaró como campo. |
| Los nombres de las PÁGINAS en el nav ("Tienda", "Suscripciones", "Nosotros") | `content.menu` | SÍ es `SiteContent`, pero se edita por `MenuSeccion.tsx`, fuera de `SECCIONES_TIENDA` — no alcanzable desde el iframe hoy (§ 6, riesgo de alcance). |
| El texto del pie (columnas, enlaces, tarjeta) | `content.footer` | Mismo caso: `FooterSeccion.tsx`, fuera de `SECCIONES_TIENDA`. |
| Nombre del negocio / tagline (wordmark del nav y del pie) | `SiteSetting.nombre`/`.tagline` | Otro modelo, otra pantalla (`Configuración`, § negocio≠tienda de `CLAUDE.md`) — nunca fue parte de `SiteContent`. |

---

## 2 · Mecanismo

### 2.1 · El principio que gobierna todo lo de abajo

**El nodo contentEditable (o el campo flotante) NUNCA es la fuente de verdad. Es un INPUT MÁS para el
mismo `form` que ya tiene la lista lateral.** Cada tecleo manda `{seccion, campo, valor}` al panel por
`postMessage`; el panel llama al MISMO setter (`cambiar(campo, valor)`) que ya usa el `onChange` del
input de la lista; el `useEffect` que YA existe (`TiendaSeccionEditor`, disparado sobre `form`,
§ 13.2 de `DISENO.md`) vuelve a mandar el contenido resuelto HACIA ABAJO, y `SiteContentProvider`
(stateful, ya construido) re-renderiza TODOS los consumidores desde el valor canónico — nunca se lee
`innerHTML`, nunca el DOM manda sobre el dato. Es el mismo contrato que pedía el punto 2 del encargo, y
es lo que YA construyó `EDITOR-TIENDA-POSTMESSAGE-1`: este diseño no inventa un segundo camino de
datos, extiende el que existe con un tercer mensaje.

### 2.2 · `contentEditable` directo vs. campo flotante — medido, no supuesto

`CLAUDE.md` § El editor VISUAL, FASE 2 ya evaluó y RECHAZÓ `contentEditable` directo, en el mecanismo
VIEJO (`VistaTiendaEnVivo`, el componente renderizado SIEMPRE a 1280px y escalado con `transform:
scale(paneW/1280)` — ratios ~0.30–0.44, un título de 30px cayendo a 9–13px). Ese rechazo **no se
hereda automáticamente** al mecanismo NUEVO, y hay que decirlo explícitamente para no repetir la
pregunta: el iframe de `EDITOR-TIENDA-DISPOSITIVOS-1` renderiza el documento a su ANCHO LITERAL
(1280/768/393px reales) y sólo aplica `transform: scale()` al **contenedor del `<iframe>`** cuando el
dispositivo elegido no entra en el canvas disponible (§ 12.2 de `DISENO.md`) — el documento DENTRO del
iframe nunca sabe que está siendo escalado desde afuera, y el navegador traduce clic/caret/selección
correctamente sobre una transformación CSS real de contenido real (es el mismo hecho que ya hace
funcionar "Ir a la sección"/el resalte en los tres modos, § 12.2, último párrafo). Así que la OBJECIÓN
original (texto ilegible por estar renderizado chico) no aplica en Escritorio sin escalar (el caso por
defecto), y aplica sólo PARCIALMENTE en Tablet/Teléfono escalados — y ahí la reducción es modesta (un
documento de 393px de ancho real escalado para caber en un canvas de admin, no un documento de 1280px
aplastado a una fracción). **Aun así, esto es una MEDICIÓN que falta hacer, no una garantía**: el slice
que construya esto debe medir legibilidad real en los tres anchos antes de fijar el mecanismo —
exactamente el tipo de verificación por ejecución que el resto de este plan ya exige (§ 6).

Independientemente de la legibilidad, hay CUATRO problemas de `contentEditable` DIRECTO que no dependen
de la escala y que SÍ son del diseño (no de la medición):

1. **Nodos duplicados.** `marquesina.texto` se renderiza en **dos** `<span>` distintos para el loop sin
   costura (`Marquesina.tsx:107-108` Y `HeroMediaMarquesina.tsx:717-718`, el mismo campo, dos
   composiciones distintas). Un `contentEditable` nativo editaría UNO de los dos; el otro quedaría
   desincronizado hasta el próximo re-render con el dato canónico.
2. **Nodos animados.** Los tres contadores de `origen` (`statNumero1..3`) NO muestran el valor del
   campo: muestran un número que una animación (`useContadorAnimado`, cuenta de 0 al valor final al
   entrar en vista, `once:true`) va CALCULANDO. Un clic ahí cae sobre un nodo cuyo texto en pantalla no
   es el dato — editable directo sería editar un número a medio contar.
3. **HTML/pegar.** `contentEditable` acumula `<span>`/`<div>`/`<br>` en el DOM real con cualquier pegado
   con formato; para mantener el campo como STRING plano (lo que el schema zod exige) hay que leer
   SIEMPRE `.textContent`, nunca `.innerHTML` — viable, pero una fuente más de "lo que se ve en pantalla
   un instante no es lo que se va a guardar".
4. **Deshacer inconsistente.** El historial de undo de `contentEditable` varía entre navegadores y no es
   el mecanismo confiable que ya tienen los `<input>`/`<textarea>` nativos.

**Variantes de composición multiplican el costo, en CUALQUIERA de los dos mecanismos.** 5 de las 15
secciones declaran `variantes` (`hero`: 4; `brandStory`: 2; `presentaciones`: 3; `subscriptionCTA`: 2) —
CADA variante es un componente DISTINTO que renderiza el mismo campo (`HeroCurtina`/`HeroFicha`/
`HeroMedia`/`HeroMediaMarquesina`, cada uno su propio JSX para `hero.titulo`). Marcar un campo como
editable en una variante y no en las demás deja la edición directa rota en silencio para el tenant que
use esa variante — CORTE (la rama activa) ya usa varias de las no-canónicas (`riel`, `sticky`,
`centrada`, `linea`), así que esto no es un caso de borde teórico.

**Recomendación: campo flotante, DENTRO del documento del iframe (no `contentEditable` sobre el nodo
real).** Es la variante del ítem ya evaluado en `CLAUDE.md` § El editor VISUAL, FASE 2 ("el campo
flotante para el TEXTO") — pero esa evaluación lo rechazaba por el costo de traducir coordenadas PANEL↔
documento-escalado; acá ese costo desaparece porque el overlay vive DENTRO del MISMO documento que el
nodo (mismo origen, mismo árbol — exactamente el argumento que § 4.1.1 de `DISENO.md` ya usa para pintar
el resalte adentro del iframe en vez de calcularlo desde afuera). Mecánica:

- Clic en un nodo marcado `[data-editor-campo]` (y Navegar apagado, mismo gate que hoy) →
  `EditorPuenteVivo` mide el nodo con `getBoundingClientRect()` (DENTRO del iframe, sin traducir nada) y
  monta, en su lugar, un `<input>` o `<textarea>` (según `textarea: true`/`false`, el mismo booleano que
  `CampoTexto` ya declara por campo) posicionado encima, con la MISMA tipografía/tamaño/color/alineación
  (leídos con `getComputedStyle` del nodo real) — visualmente indistinguible del texto que tapa.
- El nodo real se oculta (`visibility: hidden`, conserva su layout) mientras el overlay está activo —
  nunca texto duplicado en pantalla.
- Cada `input`/cambio manda `{seccion, campo, valor}` al panel (sin debounce propio: el puente ya mide
  2.4–5ms por mensaje, § 13.2 — más barato que cualquier debounce que agregue latencia percibida). El
  panel actualiza `form` y el ciclo normal hace el resto.
- `Enter` en un campo `textarea:false` (título, nombre, label) COMMITEA y cierra el overlay (no inserta
  salto de línea); en uno `textarea:true` inserta el salto, como cualquier `<textarea>`.
- `Escape`, clic afuera, o Tab cierran el overlay y restauran el nodo real (que para entonces ya
  refleja el valor nuevo, por el ciclo del puente).
- **Deshacer**: nativo del navegador DENTRO del campo (es un `<input>`/`<textarea>` real, no
  `contentEditable`) — sin mecanismo nuevo. El "Descartar" de la sección sigue siendo el undo de
  SECCIÓN completa, sin cambios.
- **Nodos duplicados** (`marquesina.texto`): sólo UNO de los dos `<span>` lleva `data-editor-campo`; el
  overlay escribe en el `form` como cualquier campo, y el OTRO `<span>` — que nunca tuvo overlay encima —
  se actualiza solo, porque renderiza del mismo `useSiteContent()` que el ciclo panel→iframe ya alimenta.
  Ningún caso especial: el campo flotante nunca tocó el DOM del segundo nodo.
- **Nodos animados** (contadores de `origen`): el overlay se posiciona sobre el nodo en su estado YA
  asentado (la animación corre una vez al entrar en vista, `once:true`); el campo sigue siendo el string
  del dato, nunca el número intermedio de la animación. Nuance a verificar por ejecución en el slice que
  lo construya: si el contador, al recibir un valor nuevo por el ciclo panel→iframe, vuelve a animar
  desde 0 o salta directo al nuevo número — ninguna de las dos es incorrecta, pero hay que decidir cuál
  se quiere y comprobarla contra el código real de `useContadorAnimado`, no asumirla.

### 2.3 · Marcar el nodo — el costo real de esta pieza

**Hoy NINGÚN componente de sección sabe que está en modo editor.** Medido contra el código (no
supuesto): `app/(storefront)/page.tsx` envuelve cada banda en `<div data-editor-seccion={id}>` DESDE
AFUERA (`bandaNodo()`, `page.tsx:119-127`) — el componente de adentro (`HeroSection`, `Origen`…) recibe
exactamente el mismo `style` que recibía antes del iframe, nada más. Para marcar un CAMPO (no la
sección entera) hace falta que el JSX que renderiza `hero.titulo` sepa, desde ADENTRO del componente,
que está en modo editor — eso no existe hoy y hay que construirlo.

- **La señal llega por un CONTEXT nuevo, sibling de `SiteContentProvider`, no por prop.** `layout.tsx`
  YA calcula `enModoEditor` (una sola vez, `modoEditorActivo()`, `layout.tsx:130`) y ya se lo pasa a
  `EditorPuenteVivo activo={enModoEditor}` — agregar un `<ModoEditorProvider value={enModoEditor}>`
  hermano ahí es gratis en cómputo. **No se agrega al `Ctx` de `SiteContentProvider`**: ese contexto
  expone `SiteContentData` DIRECTO (no un objeto `{content, …}`) y lo leen ~40 componentes
  destructurando campos (`const { trustBadges, navTratamiento } = useSiteContent();`) — cambiar su forma
  tocaría los 40. Un contexto nuevo y chico (`useModoEditorActivo(): boolean`) no toca ninguno.
- **El costo real está en el PER-CAMPO, no en la plomería.** 121 campos de texto libre + 7 plantillas de
  repeater (§ 1), repartidos en ~15 componentes de sección Y sus variantes (hasta 4 implementaciones del
  mismo campo, § 2.2) — cada JSX que hoy escribe `{hero.titulo}` pasa a escribir algo como
  `<CampoEditable campo="hero.titulo" multilinea={false}>{hero.titulo}</CampoEditable>`, un componente
  COMPARTIDO (storefront, nuevo) que: con `useModoEditorActivo()` en `false` devuelve `children` tal
  cual (cero bytes, cero atributos, byte-idéntico a hoy — mismo contrato que `data-editor-seccion`); con
  `true`, envuelve con `data-editor-campo="hero.titulo"` + `data-editor-linea={multilinea?'multiple':'unica'}`.
  **Esto toca `app/(storefront)/` y `components/storefront/` — Tier 1 por la lista YA vigente de
  `CLAUDE.md`, en cada uno de esos ~15+ archivos** (igual que `EDITOR-TIENDA-SELECCION-1` ya tocó
  `Contenido.tsx` por el mismo motivo). Es la razón concreta por la que § 6 recomienda un plan por
  slices ACOTADO por sección, no un slice único que toque las 15.
- **Suscripciones repite el obstáculo de `Contenido.tsx`.** `suscripciones/Contenido.tsx` ya no puede
  recibir el booleano por prop ni por `useSearchParams()` (§ 14.3 de `DISENO.md`, medido); el `Context`
  SÍ lo resuelve de raíz —a diferencia del marcador de sección, que tuvo que resolverse con DOM
  imperativo por ser "sólo un `<div>` envolvente"— porque `ModoEditorProvider` se monta en el layout del
  storefront, que SÍ es ancestro de `Contenido.tsx` vía el árbol de React normal (el problema de § 14.3
  era espec íficamente `useSearchParams()`/prop, no contextos). Esto es una mejora de paso sobre el
  mecanismo de selección, no una complicación nueva.

### 2.4 · Un solo campo abierto a la vez, y qué pasa con el resalte de selección

Con Navegar apagado, el listener de clic YA existente (`EditorPuenteVivo.tsx:136-149`) decide hoy "abrir
la sección en la lista" para CUALQUIER clic dentro de `[data-editor-seccion]`. Con el campo flotante
agregado, la regla se refina: si el clic cae dentro de un `[data-editor-campo]`, en vez de (o además de)
mandar `seccion-click`, se abre el overlay de ESE campo Y se manda `seccion-click` igual (para que la
lista también se abra y muestre el resto de los campos de esa sección, como hoy) — un clic en el hero
sigue abriendo "Portada" en la lista, y AHORA ADEMÁS deja escribir ahí mismo. Sólo un overlay puede
estar activo a la vez (clic en otro campo cierra el anterior, comiteando su valor).

---

## 3 · Guardado

**Reusa el borrador → publicar de hoy, sin un segundo mecanismo.** El campo flotante escribe en el MISMO
`form` que la lista; el autoguardado (debounce 1000ms, `lib/autoguardado.ts`) persiste exactamente igual
que si se hubiera tecleado en el input de la lista — "al salir del campo, con pausa" ya es su
comportamiento actual, y no cambia.

- **Cuándo se guarda:** el mismo ciclo de siempre — se escribe en memoria en cada tecla (vía el puente,
  2.4–5ms, sin red), y el PUT a `/api/site-content` sale 1000ms después de la ÚLTIMA tecla (el debounce
  del coordinador de autoguardado, no uno nuevo por campo).
- **Deshacer:** dos niveles, ninguno nuevo. Dentro del campo —undo nativo del navegador (es un
  `<input>`/`<textarea>` real, § 2.2—; de la sección completa —"Descartar", que revierte el borrador
  entero a lo publicado, como hoy—.
- **Sesión vencida (§ 4.6 de `DISENO.md`):** se reusa el MISMO mensaje (`MSG_SESION_VENCIDA`,
  `esSesionVencida`) para el 401 del PUT de autoguardado — sin cambio sobre lo ya diseñado ahí. **Lo que
  SÍ es nuevo:** mientras el dueño teclea DENTRO del iframe, su atención no está en el panel — el banner
  de sesión vencida que `DISENO.md` § 4.6 ya diseñó para el panel puede pasar inadvertido. Se recomienda
  que el overlay MISMO muestre un aviso inline corto (reusando el mismo texto) si su valor no pudo
  guardarse por 401 — la misma doctrina de `CLAUDE.md` § Toast = éxito, inline = error, aplicada donde
  está la atención real del operador, no donde el mecanismo viejo asumía que estaría.

---

## 4 · Imágenes

**Sí, un clic en una imagen marcada abre el selector de archivo — pero el selector sigue siendo el del
panel, no uno nuevo dentro del iframe.** La subida (`useSubidaImagen`, Blob directo, progreso, tope de
tamaño) vive ENTERA en `TiendaSeccionEditor`/la lista lateral; duplicarla dentro del iframe sería una
segunda implementación del mismo mecanismo — la clase de problema que todo este programa (§ 0 de
`DISENO.md`) existe para evitar.

- Un nodo `<img>`/fondo marcado `data-editor-campo="hero.imagen"` (mismo atributo que el texto, sin
  distinción de tipo en el marcador — el panel ya sabe por el REGISTRY si ese campo es imagen) intercepta
  el clic igual que un campo de texto, pero en vez de montar un `<input>` manda un mensaje nuevo
  (`TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`) al panel.
- El panel abre la SECCIÓN en la lista (igual que `seccion-click`) y dispara programáticamente el MISMO
  `<input type="file">` oculto que el control "Cambiar imagen" de esa sección ya monta — el dueño ve el
  selector de archivos del sistema operativo, exactamente como si hubiera clickeado el botón en la lista.
- La subida corre por el camino de SIEMPRE; cuando termina, la URL nueva llega al iframe por el MISMO
  ciclo panel→iframe que ya sincroniza texto — no hace falta nada nuevo del lado del iframe más allá del
  marcador y el mensaje de clic.
- **Mientras sube**, el nodo real de la imagen (dentro del iframe) no cambia hasta que el ciclo
  panel→iframe le entregue la URL nueva — el "Subiendo…"/progreso vive en la lista, como hoy; el iframe
  no necesita su propio indicador.

---

## 5 · Fuera de alcance explícito

- **El precio, de cualquier origen** (§ 9.1 del owner: "No agreguemos lo de poder cambiar el precio del
  producto desde el editor"). Se extiende, por consistencia, a `precio1..4` de `suscripcionPlanes`
  (§ 1.3): aunque técnicamente ES `SiteContent` (texto libre), la decisión del owner no distinguió
  precio-de-producto de precio-de-plan, y tratarlos distinto sin pedirlo sería inferir una excepción que
  nadie pidió.
- **El catálogo** (nombre/descripción/notas de cata de un `Product`): sigue siendo de `/admin/productos`,
  nunca de este editor — no hay campo de `SiteContent` que tocar ahí (§ 1.4).
- **Reordenar** (fila 6 de § 6 de `DISENO.md`, `EDITOR-TIENDA-ORDEN-1`): sigue siendo su propio slice,
  sin relación con edición de texto.
- **Nav y pie** (`content.menu`/`content.footer`): quedan FUERA de este diseño por alcance — no porque
  el mecanismo no aplicara (sí aplicaría, son `SiteContent` como cualquier otra sección), sino porque hoy
  viven fuera de `SECCIONES_TIENDA`/el iframe por completo (§ 1.4, § 1.1 de `DISENO.md`: "cromo
  transversal… sin vista previa en vivo"). Extender la selección en contexto Y la edición directa a esas
  dos secciones es una decisión aparte, con su propio costo (tocarían `StoreNav.tsx`/`StoreFooter.tsx`,
  que hoy tampoco saben que están en modo editor) — se nombra acá para que no se asuma incluido.
- **Las TRES insignias de `trustBadges`** y el texto "Desliza": sin campo que editar — ampliarlos a dato
  es, en sí, otra decisión de producto (§ 1.4), no una pieza de este mecanismo.
- **Campos selector/pointer** (categoría, destino de CTA, producto, plan destacado): siguen editándose
  SOLO por el combobox de la lista — un clic en esos nodos abre la sección en la lista (como hoy), nunca
  un overlay de texto.

---

## 6 · Riesgos, y plan por slices

### 6.1 · Nayoli y el tráfico público — byte-idéntico

Igual que todo lo de este programa: `useModoEditorActivo()` en `false` (el 99.99% del tráfico) hace que
`<CampoEditable>` devuelva `children` sin envoltorio — el mismo contrato que ya cumple
`data-editor-seccion` (§ 12.3/14.6 de `DISENO.md`: `verificar:nayoli:visual`/`guarda:color` en 0px salvo
el piso ya heredado). Cada slice de este plan se verifica con el MISMO arnés, sobre las rutas que toca.

### 6.2 · Seguridad del modo editor

**Sin cambios de superficie.** El gate sigue siendo el mismo (`modoEditorActivo()`, sesión OWNER/MANAGER
server-side, § 5.2/§ 11 de `DISENO.md`) — este diseño no agrega una puerta nueva, sólo más mensajes sobre
el MISMO canal `postMessage` mismo-origen ya gateado. El único riesgo nuevo y real: **un campo flotante
mal saneado podría ser el primer sitio del repo donde contenido tecleado por el dueño viaja de vuelta al
DOM sin pasar por un `<input>` controlado de React** — se cierra por diseño (§ 2.2: el overlay ES un
`<input>`/`<textarea>` real, nunca `contentEditable`, así que no hay HTML que sanear: el valor siempre
es `event.target.value`, un string plano).

### 6.3 · El modo de falla si una variante queda sin instrumentar

Medido en § 2.2: 5 secciones con variantes, hasta 4 implementaciones del mismo campo. Si un slice marca
`hero.titulo` sólo en `HeroCurtina` y CORTE usa `HeroMedia`, el síntoma es **silencioso** — el clic en ese
título simplemente no abre nada (cae al comportamiento de "clic fuera de cualquier marcador", § 14.1 de
`DISENO.md`: se frena, no pasa nada). No es un crash, es una capacidad que parece no estar — el
checklist de verificación de cada slice (§ 6.4) debe probar TODAS las variantes activas en el preset que
se esté verificando, no sólo la canónica.

### 6.4 · Plan por slices

Cada fila toca `app/(storefront)/` y/o `components/storefront/` — Tier 1, sesión OBSERVED primero, visto
bueno del owner, después el slice de escritura (igual que todo lo demás de `DISENO.md` § 6).

| # | Slice | Alcance | Criterio de verificación por ejecución |
| --- | --- | --- | --- |
| 1 | `EDITOR-TIENDA-CAMPO-EDITABLE-1` | La plomería: `ModoEditorProvider`/`useModoEditorActivo()`, el componente `CampoEditable` (sin overlay todavía — sólo marca el nodo), el TERCER mensaje del puente (`TIPO_MENSAJE_CAMPO_CAMBIO`) y su manejo en `EditorPuenteVivo`/`fusionarContenidoSeccion`. SIN aplicarlo a ninguna sección real todavía. | `npm run gate` verde; `verificar:nayoli:visual`/`guarda:color` sin un píxel nuevo (nada se instrumentó aún); un test de integración que simula el mensaje contra un documento de prueba. |
| 2 | `EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1` | Instrumenta **las 4 variantes** de `hero` (Curtina/Ficha/Media/MarquesinaSticky) — el caso con más multiplicidad, primero, para medir el costo real antes de comprometerse al resto. Incluye la MEDICIÓN de legibilidad pendiente (§ 2.2) en los tres anchos de dispositivo. | Verificado por ejecución, sesión real, preset CORTE (que usa variantes no-canónicas): clic en título/subtítulo/CTA en CADA una de las 4 variantes abre el overlay correcto; capturas en Escritorio/Tablet/Teléfono confirmando legibilidad; el campo duplicado de `marquesina`/`HeroMediaMarquesina` NO diverge tras tipear (ambas copias muestran el valor nuevo). |
| 3 | `EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1` | El mensaje/flujo de imagen (§ 4): clic en una imagen marcada abre el selector real del panel. | Clic en `hero.imagen` dentro del iframe abre el picker de archivos del sistema; la subida y el resultado se ven sin recargar, igual que hoy desde la lista. |
| 4 | `EDITOR-TIENDA-CAMPO-EDITABLE-RESTO-1..N` | El resto de home/nosotros/suscripciones, UNA o pocas secciones por slice (brandStory, origen, presentaciones×3 variantes, subscriptionCTA×2, testimonials+repeater, spotlight, nosotrosHistoria, nosotrosGaleria+repeater, nosotrosCierre, suscripcionPlanes, suscripcionPasos, suscripcionFaq+repeater) — el orden y el agrupado los decide quien planifique la implementación, no este documento. | Mismo patrón que el slice 2, por sección: todas sus variantes, todos sus campos de texto libre, `verificar:nayoli:visual` sin píxel nuevo. |
| 5 | `EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1` | El aviso inline de sesión vencida DENTRO del overlay (§ 3). | Reproducido por ejecución: sesión invalidada a mitad de edición → el overlay muestra el aviso, el panel sigue mostrando el suyo, ninguno de los dos pierde el valor ya tecleado. |

**Nav/pie (§ 5) y reordenar (fila 6 de `DISENO.md` § 6) quedan fuera de este plan**, con su propio
disparador si algún día se deciden.

---

## 7 · Preguntas para el owner

1. **¿El plan por slices de § 6.4 es el orden correcto, o preferís un alcance distinto para el primer
   slice de verdad (más allá de la plomería)?** Recomiendo empezar por `hero` (slice 2) porque es la
   sección con MÁS variantes (4) — mide el costo real de instrumentar una sección antes de comprometer
   el resto del plan, y es la sección que el dueño va a tocar primero en casi cualquier sesión de
   edición.
2. **¿Los campos selector/pointer (categoría, destino de CTA, producto, plan destacado) deben, al
   clickearse dentro del iframe, abrir la sección en la lista (como cualquier otro clic, comportamiento
   de hoy) o quedar completamente INERTES (ni siquiera abren la lista)?** Recomiendo que abran la
   sección en la lista — es el comportamiento que YA existe (§ 14 de `DISENO.md`) y no inventa una
   tercera categoría de clic; sólo los campos de TEXTO libre ganan el overlay encima.
3. **¿Nav y pie entran en el alcance de "editor inline" en algún momento, o se quedan permanentemente
   en su formulario aparte (`MenuSeccion`/`FooterSeccion`)?** No bloquea nada de § 6.4 (son
   independientes), pero cambia si vale la pena diseñar `CampoEditable` pensando en que algún día lo
   consuma `StoreNav.tsx`/`StoreFooter.tsx` también. Sin una respuesta, este diseño asume que NO, por
   ahora (§ 5).

---

**Línea agregada a § 9.1 de `DISENO.md`** (ver el diff de ese archivo): el párrafo "La edición de texto
DIRECTO sobre la página es diseño NUEVO, pendiente" ahora cierra con *"— diseñado en
`docs/editor-tienda/EDICION-INLINE.md` (`EDITOR-TIENDA-EDICION-INLINE-DISENO-1`); sigue sin construirse,
y sigue necesitando su propia aprobación de escritura."*
