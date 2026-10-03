# El editor de `/admin/tienda` como editor de verdad — diseño de arquitectura

**Fecha:** 2026-09-30
**Rama:** `slice/corte-reescritura-prototipo-1`
**Ledger:** `EDITOR-TIENDA-DISENO-1`
**Autoriza:** gate del owner del 2026-09-30 (§ `PANEL-PREVIEW-COLORES-REALES-1`, `DECISIONS.md:36875-36878`)
**Este documento no cambia código.** Es un diseño para que el owner lo apruebe antes de que exista
un solo slice de implementación. Ninguna de las alternativas de abajo está construida.

---

## Resumen de una pantalla

Hoy `/admin/tienda` no muestra la tienda: muestra una RECONSTRUCCIÓN de cada sección, aislada,
armada por una segunda implementación del mismo cálculo de colores/tipografía/forma que ya usa la
página real. Esa segunda implementación acaba de divergir de la primera (`PANEL-PREVIEW-COLORES-REALES-1`,
recién cerrado) y es la vigésima vez que el owner pide algo más parecido a un editor de verdad.

La recomendación de este documento es **dejar de reconstruir la tienda dentro del panel y, en
cambio, mostrar la tienda REAL dentro de un `<iframe>` del mismo origen**, leyendo el borrador en
vez de lo publicado. Eso hace que la vista previa sea, por construcción, byte-idéntica a lo que se
publica — no hay una segunda lógica que pueda divergir, porque no hay una segunda lógica. El costo
que esto reintroduce (un iframe implica, en su forma más simple, un ciclo de guardar → recargar →
ver el cambio) se paga con `postMessage`: el panel empuja los cambios al documento del iframe sin
recargarlo, igual que hoy empuja los cambios al componente montado en el panel — sólo que el
documento que los recibe es la página real, con su nav, su pie, sus breakpoints reales y el orden
real de sus secciones, en vez de un componente suelto con paredes sintéticas alrededor.

Se propone un plan de **siete slices**, cada uno entregable y verificable por su cuenta, que
empieza por el que más fidelidad gana al menor costo (el iframe mismo, sin `postMessage`, con
recarga tras cada guardado — ya es mejor que hoy porque muestra la página COMPLETA) y termina
retirando la maquinaria vieja (`VistaTiendaEnVivo`, `varsDeTienda`, el puente `data-sf-tarjeta`)
una vez que el iframe la vuelve innecesaria. Cada slice que toque `app/(storefront)/` o
`components/storefront/` — la mayoría de ellos — es Tier 1 por la lista ya vigente de
`CLAUDE.md`, y por tanto corre primero en una sesión de sólo lectura (OBSERVED) antes de escribir
una sola línea, como cualquier otro cambio a esa superficie.

---

## 0 · El pedido, y por qué esta vez es distinto

> *"de nuevo mi intención de hacer /tienda algo más parecido a un editor que lo que estamos
> haciendo ahora y es como la 20ava vez que lo menciono"*
> — owner, gate del 2026-09-30 (`DECISIONS.md:36875-36878`, `PANEL-PREVIEW-COLORES-REALES-1`)

Las 19 veces anteriores el síntoma reportado fue puntual (un color que no coincide, una fuente que
no carga, una sección que se ve distinta de la real) y cada vez se arregló EL SÍNTOMA: se agregó una
octava variable que faltaba, se corrigió un eje de paleta, se sincronizó una función. El patrón de
esas correcciones es el dato importante: **cada una fue encontrar y cerrar una divergencia entre DOS
implementaciones del mismo cálculo** — la que usa la página real (`app/(storefront)/layout.tsx` +
`page.tsx`, vía `cssPaleta`/`cssFuentes`/`cssForma`/`esquemaStyle`) y la que usa el panel
(`varsDeTienda`, `lib/config/esquema-style.ts:147-162`, escrita para reproducir el mismo resultado
como objeto JS en vez de como `<style>` server-rendered).

El defecto que acaba de cerrarse (§ 1.3) es la MISMA clase de bug que ya se había cerrado antes en
el mismo archivo (`esquemaStyleDeBanda`, construida para evitar exactamente esta divergencia en el
esquema por banda) — y volvió a pasar, un nivel más arriba, con la paleta completa. Arreglar el
síntoma de hoy no evita que mañana aparezca un noveno eje, o un cambio en cómo se deriva la forma,
o una nueva familia de fuente, y que alguien tenga que acordarse de propagarlo a la segunda
implementación. **Mientras existan dos pipelines de render para la misma tienda, este bug tiene
una fecha de próxima aparición, no una probabilidad.** Por eso este documento no propone una
novena corrección puntual: propone dejar de tener una segunda implementación.

---

## 1 · Qué hay hoy — censo medido

### 1.1 · Las dos vistas previas, y lo que arman

`/admin/tienda` (`app/(admin)/admin/tienda/page.tsx:35-90`) monta seis piezas: cinco editores de
"cromo transversal" sin vista previa en vivo (`PaletaSeccion`, `MenuSeccion`, `EncabezadoSeccion`,
`DetallesSitioSeccion`, `FooterSeccion` — los tres últimos son resúmenes de TEXTO, declarado en su
propio docstring: montar `StoreNav`/`StoreFooter` reales "lanza fuera de su árbol de providers" y
"ese costo no está en el alcance" de esos slices, `tienda-secciones.ts:19-31`) y, dentro de un
`<Suspense>`, `TiendaPaginas` — el selector de página (`'home' | 'nosotros' | 'suscripciones'`,
`tienda-secciones.ts:65-76`) que monta un `TiendaSeccionEditor` por cada sección de la página activa.

Las DOS superficies que sí renderizan componentes reales del storefront, y las dos que este
documento reemplaza:

- **`VistaTiendaEnVivo.tsx`** — monta el componente storefront real de UNA sección (`hero→HeroSection`,
  `presentaciones→GrindChooser`, etc., el mapa completo en líneas 87-152) bajo un
  `SiteContentProvider` SINTÉTICO y local (`{...DEFAULTS, tema: temaReal, esquemas: esquemasReales,
  [seccion]: valorDelForm}`, línea 199-202), un `PreviewProvider` estático (sin animaciones de
  entrada) y un `CartProvider` local e inerte (204). Lo escala a 1280px y de vuelta con
  `EscalaDesktop` (`components/admin/EscalaDesktop.tsx`, dos `ResizeObserver`, líneas 41-42/52-73).
- **`PaletaSeccion.tsx` / `FragmentoTienda`** (171-204) — un fragmento inventado (Logo + TrustBadges
  + 3 `ProductCard` de muestra) para previsualizar paleta/tipografía/forma, con el mismo patrón de
  providers sintéticos.

Las dos llaman a la MISMA función, `varsDeTienda(tema, esquemas?, bandaId?)`
(`lib/config/esquema-style.ts:147-162`), que compone en un objeto JS las cuatro capas que la página
real reparte en TRES sitios distintos (el `<style>` de `:root` del layout — `cssPaleta`+
`cssFuentes`+`cssForma` — y el `style` inline por banda de `page.tsx` — `esquemaStyle`). El propio
docstring de `esquema-style.ts:116-146` lo dice: `varsDeTienda` es "una RECOMPOSICIÓN para devolver
el mismo resultado como objeto JS (no texto), pensada para el panel — nunca se usa en la tienda
real". Es, literalmente, una segunda implementación del primer párrafo de esta sección.

### 1.2 · Qué NO reproduce — medido, no supuesto

| Pieza de la tienda real | `VistaTiendaEnVivo` / `PaletaSeccion` | Por qué |
| --- | --- | --- |
| **Nav** (`StoreNav`) y **Footer** (`StoreFooter`) | Ausentes | Ambos exigen `useSiteSettings()`, un contexto que estas vistas no montan a propósito (`tienda-secciones.ts:19-31`) |
| **Chrome global** (`CartDrawer`, `BackToTop`, `RielSocial`, `ScrollInercia`, `ToasterTienda`) | Ausente | Sólo viven en `app/(storefront)/layout.tsx:149-171` |
| **Ancho real / breakpoints móviles** | Siempre 1280px, escalado con `transform: scale()` | `EscalaDesktop` renderiza SIEMPRE a `desktopW=1280` (`EscalaDesktop.tsx:84-88`); ninguna clase `sm:`/`md:` de Tailwind se activa nunca, porque el DOM real nunca mide menos de 1280px — sólo se ve MÁS CHICO, no distinto |
| **Orden real de las bandas** (`content.orden`) | Cada sección se ve aislada, sin las vecinas | `resolverOrden` (`site-content-defaults.ts:2973`) sólo lo consume `page.tsx:113`, no estas vistas |
| **Banda `featured`** (FeaturedProducts) | Sin entrada en el mapa de componentes | No tiene `SeccionVista` propia — no se puede previsualizar hoy |
| **Fuentes por `<link>` del par custom** | Sólo la inyecta `PaletaSeccion`, por separado | La página real la inyecta en el `<head>` del layout (`layout.tsx:138`); `VistaTiendaEnVivo` no la trae |
| **Fetch client-side de catálogo** (`GrindChooserRiel`, `FeaturedProducts`) | Corre en el navegador si se monta, pero en SSR queda vacío | Detectado por censo de contexto: ningún componente hace fetch SERVER-only (Prisma directo) — el obstáculo real es el árbol de providers, no el dato |

Ninguno de estos huecos es un detalle menor: son exactamente la clase de cosas que un dueño de
tienda necesita ver para confiar en lo que está por publicar (cómo se ve el header sólido al
scrollear, si el footer quedó bien con el nuevo pie de página, si el hero se ve bien en un
teléfono de verdad).

### 1.3 · El defecto recién cerrado, leído como síntoma

`PANEL-PREVIEW-COLORES-REALES-1` (mergeado en esta misma rama, pendiente de aprobación) midió que,
bajo el preset CORTE, **15 de 15 secciones** de `VistaTiendaEnVivo` pintaban de 44 a 46 variables
`--sf-*` DISTINTAS a las de la página real — toda la paleta, toda la tipografía, toda la forma. Bajo
Nayoli (el tenant de fábrica) el defecto no se veía, porque el fallback de `globals.css` YA
coincidía con los valores reales por casualidad, no por construcción. El arreglo fue exactamente lo
que el título de esta sección anticipa: una tercera función (`varsDeTienda`) que reimplementa, por
tercera vez, el mismo cálculo — ahora con un test (`preview-colores.test.ts`) que compara los DOS
pipelines valor por valor, para que la PRÓXIMA divergencia se note antes de llegar al gate del
owner.

Ese test es una red necesaria mientras existan dos pipelines. No resuelve la causa: sigue habiendo
dos pipelines, y un test que los compara sólo puede comparar lo que alguien se acordó de
enumerar — no habría atrapado, por ejemplo, un noveno eje de paleta que todavía no existe.

### 1.4 · La decisión "componentes reales, no un iframe" — revisada

`CLAUDE.md:2665-2672` documenta la decisión que retiró el iframe anterior (2026-08-25):

> *"Un iframe SIEMPRE tiene guardar → recargar → renderizar: el dueño teclea, espera el guardado,
> espera la recarga, y recién ve el cambio. Medido: el render de la home en PROD eran ~157ms, y el
> retraso percibido era casi todo ESPERA DELIBERADA (debounce + espera del reload), no el render —
> o sea el iframe nunca fue lento; el ciclo guardar-recargar era el problema, y no se arregla con un
> debounce más corto."*

Esta medición sigue siendo válida y este documento no la contradice: el render en sí es barato
(~157ms), lo caro era el CICLO. Pero la alternativa que esa decisión evaluó y descartó fue **una
sola**: un iframe que recarga completo después de cada guardado (exactamente la opción (b) de este
documento, § 2.b). No evaluó — porque en 2026-08-25 el mecanismo de "componentes reales en el
panel" con `SiteContentProvider` sintético y `postMessage` para sincronizar en vivo **todavía no
existía como patrón en este repo**; hoy sí existe, es exactamente lo que `VistaTiendaEnVivo` hace
DENTRO del panel (un objeto nuevo por render, sin red, § 1.1) — la variante que aquí se llama
opción (a) es aplicar ESE MISMO patrón (estado en memoria empujado sin red) pero dirigido a un
`<iframe>` de la página real en vez de a un componente aislado. El argumento medido de 2026-08-25
("el render es barato, el ciclo es el problema") es, de hecho, el argumento A FAVOR de (a): si el
render es barato y el problema es el ciclo de red, la solución es sacar el ciclo de red — no sacar
el iframe.

---

## 2 · Tres alternativas, medidas

### 2.a · Iframe + `postMessage` (vista en vivo, sin reload en cada tecla)

El iframe navega a la ruta REAL del storefront (`/`, `/nosotros`, `/suscripciones`, `/tienda`,
`/tienda/[slug]`) en un modo que lee el BORRADOR en vez de lo publicado (mecanismo nuevo, § 5.2 —
REVERTIDO y reemplazado por un parámetro de URL POR REQUEST, § 11).
Mientras el dueño edita, el panel NO recarga el iframe: le manda el cambio por `window.postMessage`
(mismo origen, sin restricción de CORS) y un listener del lado del storefront actualiza el
`SiteContentProvider` de ESE documento con el dato nuevo — el mismo mecanismo que hoy usa
`VistaTiendaEnVivo` (un objeto de contexto nuevo por cambio, sin red), aplicado al documento real
en vez de a un componente aislado. La ÚNICA recarga de red ocurre al abrir el editor, al cambiar de
página, o si el operador pide "Actualizar" — no en cada tecla.

- **Fidelidad:** total, por construcción. Es la página real, con su nav, su pie, su orden de
  bandas, sus breakpoints reales (el iframe se redimensiona al ancho del dispositivo elegido, no se
  escala con `transform`) y su banda `featured`. No hay una segunda lógica de color/tipografía/forma
  que mantener sincronizada — desaparece la CLASE de bug de § 1.3, no una instancia.
- **Latencia al escribir:** cero llamadas de red NUEVAS por tecla. El autoguardado YA hace un PUT
  debounceado a `/api/site-content` (`hooks/useAutoguardado.ts`, `lib/autoguardado.ts:25-88`, debounce
  1000ms); el `postMessage` viaja en el mismo evento, en memoria, sin esperar a ese PUT. El render
  del storefront ya se midió en ~157ms (§ 1.4) y esa cifra sólo se paga UNA vez por navegación, no
  por tecla.
- **Seguridad:** exige construir un gate nuevo — ver § 5.2. Es la parte no trivial de esta opción y
  la única que amerita una sesión Tier 1 de sólo lectura antes de escribir una línea.
- **SEO / noindex:** el modo borrador necesita su propio `noindex` (metadata por-request, no el
  header estático y por-deployment que ya existe en `next.config.ts:63-68`) — factible con
  `generateMetadata` leyendo la marca de modo editor (§ 5.2; hoy un header por-request, no una
  cookie — § 11).
- **Costo en Vercel:** un GET dinámico (`force-dynamic`, dos queries por fila) por CADA navegación
  dentro del editor (abrir la pantalla, cambiar de pestaña de página, pedir "Actualizar") — el mismo
  costo que visitar la tienda real una vez. Bajo a la escala actual (un solo operador, uso interno).
- **Reuso:** TODO el mecanismo de borrador/autoguardado/publicar/descartar
  (`lib/config/site-content-write.ts`, las rutas PUT/POST, `useAutoguardado`) se reusa TAL CUAL — lo
  único que cambia es CÓMO se muestra el resultado. El formulario lateral (campos, repeaters, subida
  de imágenes) también se reusa completo.

### 2.b · Iframe + recarga tras cada guardado (la variante ya retirada, revisada)

La misma navegación a la ruta real en modo borrador, pero SIN `postMessage`: el iframe se recarga
cada vez que el autoguardado asienta (cada ~1-2s mientras el dueño teclea, con un debounce). Es
literalmente lo que se retiró en 2026-08-25 (§ 1.4) — se incluye acá porque es el primer slice
posible de la opción (a): toda la fidelidad de (a), con el costo de UX ya medido y rechazado una
vez.

- **Fidelidad:** idéntica a (a) — misma ruta real.
- **Latencia al escribir:** un reload completo del iframe por cada asentamiento del autoguardado —
  el "ciclo guardar → recargar → renderizar" que `CLAUDE.md:2665` ya documentó como el problema
  real, no el render en sí.
- **Costo en Vercel:** un GET dinámico por CADA asentamiento de autoguardado — en una sesión de
  edición de varios minutos, podrían ser decenas de invocaciones. Sigue siendo barato en dólares (dos
  queries por fila); el costo que importa acá es de UX, no de infraestructura.
- **Reuso:** igual que (a).

### 2.c · Reparar in situ: componentes sueltos, pero con el layout/vars reales

Mantener el patrón actual (componentes montados sueltos dentro del panel) pero cerrar los huecos de
§ 1.2 uno por uno: construir un `SiteSettingsProvider` local para poder montar `StoreNav`/
`StoreFooter`, montar el chrome global, y armar el conjunto de bandas en el orden real
(`resolverOrden`) en vez de una sección aislada.

- **Fidelidad:** acotada por diseño. Cada hueco cerrado es una PIEZA MÁS del pipeline paralelo que
  ya causó § 1.3 — construir un `SiteSettingsProvider` sintético es, otra vez, reimplementar algo
  que el layout real ya resuelve, con el mismo riesgo de divergencia. El ancho real / breakpoints
  móviles NUNCA se resuelven con este enfoque: mientras la vista previa sea un componente renderizado
  a 1280px y escalado con `transform`, ningún breakpoint `sm:`/`md:` se activa jamás — es un límite
  estructural de `EscalaDesktop`, no un detalle que falte pulir.
- **Latencia al escribir:** cero llamadas de red nuevas (todo en memoria, como hoy).
- **Seguridad / SEO:** sin cambios — el borrador sigue sin salir del panel.
- **Costo en Vercel:** cero nuevo.
- **Reuso:** de todo lo actual, sin retirar nada — y SUMA superficie nueva (el `SiteSettingsProvider`
  sintético, el fetch de catálogo para `featured`) que es, otra vez, una tercera/cuarta
  reimplementación del mismo problema.

### 2.d · Tabla comparativa

| | (a) iframe + postMessage | (b) iframe + reload | (c) reparar in situ |
| --- | --- | --- | --- |
| Fidelidad (nav/pie/orden/breakpoints reales) | Total | Total | Nunca completa (breakpoints móviles imposibles) |
| Riesgo de la CLASE de bug de § 1.3 | Eliminado (una sola implementación) | Eliminado | Se mantiene y crece (más pipeline paralelo) |
| Latencia percibida al teclear | Ninguna (postMessage, sin red) | Alta (reload en cada guardado — ya rechazada una vez) | Ninguna |
| Requiere gate de sesión nuevo en el storefront | Sí | Sí | No |
| Costo Vercel adicional | Bajo (1 GET por navegación) | Medio (1 GET por guardado) | Cero |
| Trabajo de implementación | Alto (gate + postMessage + selección) | Medio (gate solamente) | Medio-alto (providers sintéticos + orden) |
| Qué se retira de lo actual | Todo lo de § 7 | Todo lo de § 7 | Nada — se suma |

---

## 3 · Recomendación

**Construir la opción (a), mediante la (b) como primer escalón.** El slice 1 (§ 6) entrega
exactamente la opción (b) — el iframe apuntando a la ruta real en modo borrador, con reload tras
cada guardado asentado — porque es la forma más barata de conseguir TODA la fidelidad (nav, pie,
orden, breakpoints reales) y de resolver el gate de seguridad una sola vez. Ya en ese primer
escalón la pantalla deja de mentir sobre nav/pie/orden/breakpoints, que es el 80% del reclamo del
owner. El slice 2 agrega `postMessage` para eliminar el reload en cada tecla, que es la parte que
ya se midió como el problema real de la versión retirada.

No se recomienda (c): repara síntomas de la MISMA familia que acaba de costar una tanda completa
(`PANEL-PREVIEW-COLORES-REALES-1`), nunca cierra el hueco de breakpoints móviles, y cada pieza que
agrega (un `SiteSettingsProvider` sintético, un fetch de catálogo para `featured`) es exactamente el
tipo de segunda-implementación que este documento identifica como la causa de fondo.

---

## 4 · El modelo de interacción

El cambio de layout es el central: hoy cada sección es una TARJETA en una lista vertical que, al
editar, crece a una vista grande + formulario partidos en dos columnas (`TiendaSeccionEditor`, el
patrón "LECTURA = TARJETA; EDICIÓN = VISTA GRANDE" de `CLAUDE.md` § La PANTALLA). Con el iframe, la
vista deja de vivir DENTRO de cada tarjeta: pasa a ser UNA SOLA superficie persistente (el iframe),
y la lista de secciones se vuelve una lista compacta al costado —igual que el editor de temas de
Shopify—, sin una vista previa propia por fila.

### 4.1 · Selección en contexto

Clic en una sección DENTRO del iframe → esa sección se resalta (un `outline`/sombra vía una clase
CSS, activada por un `data-editor-seccion="<seccionKey>"` que el storefront sólo emite bajo
`useIsPreview()` — el mismo contexto que hoy gatea `data-sf-tarjeta`, § 4.1.1) y manda
`postMessage({tipo:'seccion:click', seccion})` al panel, que expande esa sección en la lista lateral
(scroll + abrir sus campos). Es el MISMO puente que ya existe para Presentaciones
(`lib/tienda/puente-tarjetas.ts:31-34`, `data-sf-tarjeta` en `GrindChooserMosaico.tsx:78`) — se
generaliza de "una tarjeta de Presentaciones" a "cualquier banda", y de `scrollIntoView` dentro del
panel a `postMessage` entre documentos.

Clic en una sección en la LISTA lateral → hace la inversa: manda `postMessage({tipo:'resaltar',
seccion})` al iframe, que aplica el resalte y hace `scrollIntoView` DENTRO de su propio documento
(el iframe controla su propio scroll — no hace falta que el panel calcule coordenadas cruzadas).

**4.1.1 — por qué el resalte se dibuja DENTRO del iframe y no como overlay del panel:** calcular un
rectángulo de resalte desde afuera exige traducir `getBoundingClientRect()` del documento del
iframe al sistema de coordenadas del panel, sincronizado con el scroll interno del iframe — un
mecanismo frágil que reinventa lo que el propio CSS del iframe ya puede hacer con una clase. Dibujar
el resalte adentro (una clase que agrega un borde) es más simple y no puede desincronizarse del
scroll.

### 4.2 · Reordenar y ocultar

**Esto es capacidad NUEVA, no existe hoy.** `content.orden` (`BandaId[]`, `site-content-defaults.ts:1397-1399`)
ya es el dato que decide la secuencia de bandas y `resolverOrden` ya lo completa con cualquier banda
faltante (`site-content-defaults.ts:2973`), pero ningún control del panel lo lee ni lo escribe
(grep de `.orden` contra `components/admin` y `app/api/site-content`: cero resultados). Se propone:

- Una lista arrastrable en el panel (igual forma que `RepeaterEditor` ya resuelve para reordenar
  ítems de un repeater, pero sobre las CLAVES de banda en vez de sobre un array de contenido).
- Un endpoint nuevo `app/api/site-content/orden/route.ts`, MISMO patrón key-agnóstico que ya usan
  `tema`/`encabezado`/`detalles` (`guardarBorrador`/`publicarSeccion`/`descartarSeccion` sobre la
  clave `'orden'`, sin tocar esas funciones — son genéricas por diseño, `site-content-write.ts:37-107`).
- **Ocultar** ya existe por sección (`ocultable`, el toggle de cada `SeccionConfig`) — lo nuevo es
  sólo que la lista lateral se convierte en el lugar único donde se ve y se cambia el orden Y la
  visibilidad juntos, en vez de un toggle sepultado dentro de cada tarjeta expandida.

Este control toca `app/(storefront)/page.tsx` (lee `content.orden`) indirectamente sólo por el dato
que ya lee; el cambio de código en sí es nuevo API + UI del panel, no un cambio al storefront.

### 4.3 · Escritorio / tablet / teléfono

El iframe cambia de ANCHO literal (375px / 768px / 1280px, o los que el owner prefiera), NO de
escala con `transform`. Esto es una mejora real sobre el estado actual, no sólo paridad: hoy ningún
breakpoint móvil de Tailwind se activa nunca en el panel (§ 1.2, fila "ancho real"), porque
`EscalaDesktop` siempre renderiza a 1280px. Con el iframe a 375px de ancho VERDADERO, el propio CSS
responsive de la tienda hace el trabajo — sin escala, sin cálculo, sin el riesgo de que algo que se
ve bien "achicado" se vea distinto a "angosto de verdad" (el mismo tipo de sorpresa que ya costó una
tanda entera en Pedidos, `CLAUDE.md` § REGLA · un número de layout sólo vale si viene de la pantalla
donde se TRABAJA — acá el riesgo es análogo: una vista escalada no es la vista real).

### 4.4 · Páginas: tienda, ficha, nosotros, suscripciones

`PaginaKey` hoy sólo declara `'home' | 'nosotros' | 'suscripciones'` (`tienda-secciones.ts:65`) —
**`/tienda` (catálogo) y `/tienda/[slug]` (ficha de producto) no tienen secciones editables de
`SiteContent` hoy** (confirmado por censo: ninguna `SeccionConfig` declara esas páginas). Esto no es
un hueco de este diseño: es el estado real del modelo de contenido. Para esas dos páginas, el
selector de página del editor las muestra en el iframe (útil para verificar que un cambio de
paleta/tipografía/forma se ve bien en TODA la tienda, no sólo en la home) pero **sin lista de
secciones editables al costado** — sólo los controles que ya aplican globalmente (paleta, tipografía,
forma, nav, pie). Si el owner quiere que esas páginas ganen secciones editables (p. ej. un banner en
`/tienda`, o variantes de layout en la ficha), es una decisión de producto APARTE, con su propio
disparador — no se resuelve en este documento ni se asume como parte del plan de slices.

### 4.5 · Subida de medios

Sin cambios de mecanismo: `useSubidaImagen` y el flujo de "Subiendo imagen…"/"Convirtiendo el
video…" siguen funcionando igual, con el mismo tope de tamaño y las mismas etapas. Lo único que
cambia es DÓNDE vive el formulario que los dispara (la lista lateral compacta en vez de la vista
grande partida en dos columnas) — el mecanismo de subida en sí es independiente de cómo se
previsualiza el resultado.

### 4.6 · Errores — sesión vencida

Ya existe el patrón exacto para esto, cerrado hace unas horas en esta misma rama
(`PANEL-ERROR-SUBIDA-VISIBLE-1`, `DECISIONS.md:36243-36330`): `MSG_SESION_VENCIDA` ("Tu sesión
expiró. Vuelve a iniciar sesión y reintenta la subida.", `lib/api/upload.ts:22`) y
`esSesionVencida(msg)`, que distinguen un 401 por sesión vencida de cualquier otro rechazo. Se
propone reusar el MISMO mensaje (ajustado de "la subida" a lo que corresponda) en los DOS puntos
nuevos donde una sesión puede vencer a mitad de una edición:

- El endpoint de render en modo borrador (§ 5.2): si la sesión ya no es válida cuando el iframe pide
  el borrador, responde con el contenido PUBLICADO (nunca un error visible dentro del iframe — ver
  § 5.2) y manda una señal (header o `postMessage` al cargar) que el panel traduce al MISMO banner
  con el MISMO texto y el mismo enlace "Iniciar sesión" que ya usa el flujo de subida.
- El autoguardado (`lib/autoguardado.ts`), que hoy reintenta CUALQUIER error a los 5000ms sin
  distinguir sesión vencida de un fallo transitorio — un 401 ahí reintentaría para siempre sin
  éxito. Se propone el mismo chequeo de `status===401` que ya tiene `lib/api/upload.ts`, para que el
  indicador "No se pudo guardar" pase a decir lo mismo que ya dice el de subir imágenes, en vez de
  un "Reintentar" que nunca va a funcionar mientras la sesión siga vencida.

Esto es, a propósito, la MISMA lección que `PANEL-ERROR-SUBIDA-VISIBLE-1` ya escribió para la
subida: un "reintenta" genérico sobre un 401 es peor que inútil, porque promete que reintentar
arregla algo que no se arregla hasta volver a iniciar sesión.

---

## 5 · Riesgos

### 5.1 · Para Nayoli y los demás presets/tenants

El modelo de este repo hoy es **un despliegue por cliente** (`CLAUDE.md` § El código compartido no
NACE siendo Nayoli/demo), así que este editor viaja en el MISMO código que sirve a cada tenant real.
El riesgo no es "un preset se ve distinto" — el iframe renderiza la página real bajo CUALQUIER
preset/tenant sin código específico por preset, así que la clase de bug de § 1.3 (una implementación
paralela que sólo se prueba contra algunos presets) queda estructuralmente descartada. **El riesgo
real es que el gate nuevo del modo-borrador (§ 5.2) introduzca una rama de código en
`app/(storefront)/layout.tsx`/`page.tsx` que un bug pueda filtrar hacia el tráfico PÚBLICO** — es
decir, que un visitante real vea contenido sin publicar, o que el chequeo de sesión agregue una
query a CADA request público por error. La mitigación de diseño (§ 5.2) es que la rama nueva sea
estrictamente opt-in por una cookie ausente en el 99.99% del tráfico, y que el slice que la
introduce se verifique con el mismo arnés que ya existe para esto: `verificar:nayoli`
(`scripts/verificar-nayoli.ts`) confirmando BYTE A BYTE que la home de Nayoli sin la cookie de
editor es idéntica a la de antes del cambio.

### 5.2 · Seguridad — quién puede ver el borrador

Hoy no hay ningún mecanismo de "ver la tienda con el borrador aplicado" por URL (el anterior,
`?borrador=1`/`debeLeerBorrador`/`readSiteContentBorrador`, se retiró completo junto con el iframe
viejo — grep confirma cero resultados en todo el repo). Hay que construirlo de nuevo, con estas
reglas:

1. **El gate se resuelve SERVER-SIDE, en la misma request que arma la página** — el MISMO chequeo de
   sesión + rol (OWNER/MANAGER) que ya usa `app/(admin)/admin/layout.tsx:44-55` (consulta la fila
   real de `User`, no confía en el payload de la cookie), reusado o llamado desde el layout del
   storefront cuando el flag de editor está presente.
2. **REVERTIDO en `MODO-EDITOR-SOLO-EN-EL-IFRAME-1` (2026-10-01) — ver § 11.** Esta fila decía
   originalmente: *"El flag de activación viaja en una COOKIE, no en un query param público. Un
   query param se copia y se comparte por accidente (un link pegado en un chat); una cookie de
   sesión de edición, con el mismo alcance/TTL que la sesión admin, no sale del navegador del
   dueño."* El gate del owner tras construir `EDITOR-TIENDA-IFRAME-GATE-1` midió el defecto que este
   argumento no había anticipado: una cookie de sesión de 2h, puesta al ENTRAR a `/admin/tienda`, no
   se limpia de forma fiable al cerrar la pestaña (el cleanup es un `useEffect` de React, que no
   corre en un cierre abrupto de pestaña) — así que el borrador quedaba visible en CUALQUIER pestaña
   del navegador del dueño, no sólo en el iframe del editor. El riesgo que esta fila quería evitar
   (que alguien AJENO vea el borrador por un link compartido) nunca era el riesgo real: el parámetro
   nunca fue la credencial, la sesión server-side sí lo es, y compartir el link sólo le muestra el
   borrador a quien YA podía verlo. § 11 tiene el mecanismo nuevo completo.
3. **Nunca se cachea ni se indexa.** `Cache-Control: private, no-store` en la respuesta cuando el
   flag está activo, y `generateMetadata`/`robots:{index:false}` cuando lo detecta — control
   por-request, no el header estático y por-deployment que ya existe en `next.config.ts:63-68` (ese
   header sigue cubriendo el caso "todo el deployment es demo"; esto es un caso nuevo, "esta
   request puntual es de edición").
4. **Si la sesión no es válida, la respuesta cae al contenido PUBLICADO, nunca a un error ni a un
   vacío** — un iframe roto adentro del editor es peor que uno que, por un instante, muestra lo
   publicado (§ 4.6 ya define cómo se avisa igual).
5. **CSP/`frame-ancestors`:** hoy no existe NINGUNA política de este tipo en el repo (grep de
   `frame-ancestors`/`X-Frame-Options`: cero resultados en todo el código; la única CSP es
   `Content-Security-Policy-Report-Only`, sólo sobre `/checkout`, `next.config.ts:141-212`, y no
   declara `frame-ancestors`). El iframe mismo-origen funciona sin cambios. Se recomienda, como
   endurecimiento de esta misma tanda, agregar `frame-ancestors 'self'` explícito — hoy nada impide
   que un tercero embeba cualquier ruta del sitio, y eso no debería depender de que nadie lo haya
   intentado todavía.

No se necesita `draftMode()` nativo de Next (no está en uso hoy, grep cero) — el mecanismo de
cookie + chequeo de rol es más simple y reusa el gate que YA es la fuente de verdad del panel.

### 5.3 · Concurrencia — heredado, no nuevo

El borrador ya no tiene lock cross-operación (`CLAUDE.md` § La PANTALLA: "SIN lock cross-operación
... el fallo es visible en la preview y recuperable, no un libro corrompido"). El iframe no cambia
este riesgo: sigue siendo una sola fila `SiteContent`, sin tenant_id, editada por quien tenga sesión
admin. Si algún día hay editores concurrentes de verdad, ese lock se construye aparte — no es parte
de este documento.

---

## 6 · Plan por slices

Cada slice que toque `app/(storefront)/` o `components/storefront/` es Tier 1
(`CLAUDE.md` § Tier 1 — superficies protegidas) y corre primero en una sesión de sólo lectura
(OBSERVED) que mida el terreno exacto antes de escribir, seguida del visto bueno del owner, antes
del slice de escritura. Eso se anota en la columna "tier" de abajo — no se repite el protocolo en
cada fila.

| # | Slice | Alcance | Tier | Criterio "igual a la página" | Qué retira |
| --- | --- | --- | --- | --- | --- |
| 1 | `EDITOR-TIENDA-IFRAME-GATE-1` **— la cookie se retiró en `MODO-EDITOR-SOLO-EN-EL-IFRAME-1`, § 11** | El gate de modo-borrador (§ 5.2): cookie de sesión de edición, chequeo de rol server-side, `no-store`+`noindex` condicional. SIN UI nueva todavía — sólo el mecanismo, verificable por curl/test de integración. | 1 (toca `app/(storefront)/layout.tsx`) | `verificar:nayoli` (bytes) da 0 diffs con la cookie AUSENTE — el tráfico público no cambia un byte |
| 2 | `EDITOR-TIENDA-IFRAME-VISTA-1` **— ENTREGADO, § 10** | El iframe reemplaza a `VistaTiendaEnVivo` dentro de `TiendaSeccionEditor`: navega a la ruta real en modo borrador, recarga tras cada guardado asentado (opción (b), § 2.b). Alcance AMPLIADO por encargo del owner: la composición lista↔iframe (no una vista por sección) y la mitad lista→iframe de la selección en contexto, § 10. | 1 (toca `app/(storefront)/page.tsx`/`nosotros/page.tsx`/`suscripciones/page.tsx`, en la lista Tier 1 — corregido otra vez, § 10) | Verificado por ejecución: `npm run gate` verde, `guarda:color` 0px (8 capturas), `verificar:nayoli`/`:visual` caracterizados contra el `main` stale (§ CIERRE-EDITOR-GATE-1) | VistaTiendaEnVivo/data-sf-tarjeta SIGUEN vivos — ver § 10, el retiro de la fila 7 queda más chico |
| 3 | `EDITOR-TIENDA-POSTMESSAGE-1` **— ENTREGADO, § 13** | Agrega `postMessage` para sincronizar cambios de TEXTO/imagen sin recargar el iframe — elimina el reload por tecla. De paso, diagnostica y cierra el salto de scroll al recargar (§ 1 del spec de este slice) | 1 (el listener vive en el storefront — `EditorPuenteVivo.tsx`, gateado a `modoEditorActivo()`, NO a `useIsPreview()` como se planeaba acá: `useIsPreview` es del mecanismo viejo de `VistaTiendaEnVivo`/preview local, sin relación con el modo-borrador-por-request de este iframe) | Verificado por ejecución contra producción (`next build && next start`), preset CORTE, sesión real: cero navegaciones del frame principal, el valor reflejado en 5ms (frío) / 2.4ms (caliente); el salto de scroll medido y cerrado — ver § 13 |
| 4 | `EDITOR-TIENDA-SELECCION-1` **— ENTREGADO, § 14** | Selección en contexto (§ 4.1): `data-editor-seccion`, resalte, `postMessage` bidireccional panel↔iframe. Alcance AMPLIADO por el spec: el interruptor "Navegar" (decisión de esta tanda), y el cierre de la limitación de Suscripciones (§ 10/§ 9.1) | 1 (el marcador y el listener de clic viven en `components/storefront/EditorPuenteVivo.tsx`, gateados a `activo`/`modoEditorActivo()` — NO `useIsPreview()`, mismo criterio que `EDITOR-TIENDA-POSTMESSAGE-1`) | Verificado por ejecución — ver § 14 |
| 5 | `EDITOR-TIENDA-DISPOSITIVOS-1` **— alcance AMPLIADO por encargo del owner, § 12** | Selector de ancho escritorio/tablet/teléfono (§ 4.3), ancho literal del iframe, **más la vista propia a pantalla completa** (§ 12, fuera del plan original de esta fila) | 2 (no toca `app/(storefront)/` ni `components/storefront/` — el criterio de Tier de esta tabla; el dispatch que ejecutó este slice lo etiquetó Tier 1 por cautela propia del orquestador, no porque este slice cumpla el criterio de la lista de `CLAUDE.md`) | Verificado por ejecución: clases `sm:`/`md:` activas en el DOM del iframe a 393px (teléfono) y 768px (tablet); sin sesión, `/editor/tienda` rebota a `/login` |
| 6 | `EDITOR-TIENDA-ORDEN-1` **— ENTREGADO, § 15** | Reordenar/ocultar bandas desde la lista lateral (§ 4.2): endpoint `orden` nuevo + UI de arrastre | 1 (`app/(storefront)/page.tsx` ya en la lista; el "endpoint nuevo" se volvió una extensión chica del genérico `app/api/site-content/route.ts` — § 15, sin archivo nuevo) | El orden que muestra el iframe tras un reorder de teclado coincide con el que queda PERSISTIDO tras publicar — verificado por ejecución (sesión real, § 15.5) Y por carril (`tests/integracion/orden-secciones.test.ts`); el drag con MOUSE específicamente no se ejecutó (§ 15.6) |
| 7 | `EDITOR-TIENDA-RETIRO-1` | Retira `VistaTiendaEnVivo`, `varsDeTienda`, `FragmentoTienda`/`PreviewTiendaReal`/`AmpliarOverlay`, el puente `data-sf-tarjeta`/`puente-tarjetas.ts` y `preview-colores.test.ts` (ya no hay dos pipelines que comparar) | 1 (retira código de `components/admin/` que monta `components/storefront/`) | `npm run gate` verde sin esos archivos; censo por grep confirmando cero importadores restantes |

Extender el modelo de secciones a `/tienda` y `/tienda/[slug]` (§ 4.4) **no está en este plan**: es
una decisión de producto aparte, con su propio disparador, no una consecuencia automática de tener
el iframe.

**`EDITOR-TIENDA-TEMA-1` (§ 16) NO es la fila 7 — ES UN OCTAVO SLICE, fuera de la numeración
original.** Pedido del owner tras ver el editor (2026-10-03: "el editor abre…que ya se siente más
como el de Shopify… agregale ahora una pestaña de Tema"), no parte de los siete que este documento
planeó el 2026-09-30. Mueve la EDICIÓN de `PaletaSeccion` (paleta/tipografía/forma) de `/admin/
tienda` a una pestaña «Tema» dentro de `/editor/tienda` (§ 12.1), con la PÁGINA REAL del iframe
compartido como preview en vez del fragmento sintético (`FragmentoTienda`) — PERO el fragmento
sintético **NO se retiró**: sigue viviendo en `PaletaSeccion.tsx` para el modo standalone
(`enEditor` ausente/false), que el smoke test `admin-tienda-preset.test.ts` (fuera de `touches:`
de este slice) sigue ejercitando. La fila 7 (`EDITOR-TIENDA-RETIRO-1`, abajo) sigue siendo la que
retira esa mitad de una vez por todas — y GANA UN CUARTO ÍTEM con este slice: el prop `enEditor` (y
su rama de render completa dentro de `PaletaSeccion.tsx`) deja de tener un segundo consumidor real
el día que `/admin/tienda` ya no pueda montar el standalone (porque el archivo entero se retiró), y
en ese punto `enEditor` puede colapsarse a "siempre true" — simplificación que la fila 7 hereda,
no una decisión de este slice.

---

## 7 · Qué se retira, y cuándo

| Pieza | Se retira en | Por qué sobrevive hasta entonces |
| --- | --- | --- |
| `components/admin/VistaTiendaEnVivo.tsx` | Slice 7 | Sigue siendo la vista previa de CADA sección hasta que el iframe (slice 2) cubra las 15 |
| `lib/config/esquema-style.ts` → `varsDeTienda` | **VENCIDO por `EDITOR-TIENDA-TEMA-1` (§ 16) — YA NO se retira en el Slice 7.** Ganó un SEGUNDO consumidor que sobrevive a la fila 7: `varsDeTemaEnVivo` (misma archivo, § 16) lo llama para computar las vars que la pestaña «Tema» manda EN VIVO al iframe — ese camino NO depende de `VistaTiendaEnVivo.tsx` ni de la mitad de PREVIEW de `PaletaSeccion.tsx`, así que retirar esos dos (lo que sigue vigente) ya NO se lleva a `varsDeTienda` por delante. `esquemaStyle`/`esquemaStyleDeBanda`/`bandaEsOscura`/`tratamientoNav` sin cambio, como siempre | Fila escrita antes de que existiera el segundo consumidor; se corrige acá en vez de borrarse, para que quede el porqué |
| `components/admin/PaletaSeccion.tsx` → `FragmentoTienda`/`PreviewTiendaReal`/`AmpliarOverlay` | Slice 7 (la parte de PREVIEW); el resto del archivo (el formulario de paleta/tipografía/forma, `guardarTema`/`accionBorrador`/`resetFabrica`) se queda — sigue siendo el control que edita el tema, sólo cambia su vista previa por el iframe. **AMPLIADO por `EDITOR-TIENDA-TEMA-1` (§ 16): la fila 7 también retira el prop `enEditor` ENTERO** (y su rama de render paralela: `.tienda-tarjeta`/regleta-sin-pane) — con el standalone de `/admin/tienda` retirado, `enEditor` deja de tener un segundo valor real que distinguir y la rama `false` se vuelve código muerto | El formulario no es parte del problema; sólo su vista previa sintética lo es — y, desde § 16, el SELECTOR de cuál preview mostrar tampoco lo es mientras exista el standalone |
| `lib/tienda/puente-tarjetas.ts` + `data-sf-tarjeta` (`GrindChooserMosaico.tsx`/`GrindChooserIndice.tsx`) | Slice 7, reemplazado por el puente generalizado del slice 4 (`data-editor-seccion`) | El puente viejo sólo cubre Presentaciones; el nuevo cubre cualquier sección |
| `lib/config/preview-colores.test.ts` | Slice 7 | Ya no hay un segundo pipeline que comparar contra el real |
| `components/admin/EscalaDesktop.tsx` | **No se retira.** Lo usan `components/storefront/VistaRapidaProducto.tsx` y `components/storefront/suscripciones/SuscripcionPlanes.tsx`, ajenos a este editor | Es un componente compartido, no exclusivo de `/admin/tienda` |

---

## 8 · Lo que este documento NO decide

- **Si `/tienda` y `/tienda/[slug]` ganan secciones editables** (§ 4.4) — decisión de producto
  aparte, con su propio disparador.
- **El ancho exacto de los tres presets de dispositivo** (§ 4.3) — valor de producto, no de
  arquitectura; se fija al construir el slice 5.
- **Si se agrega `frame-ancestors 'self'`** (§ 5.2, punto 5) como parte de este trabajo o aparte —
  se recomienda, pero es una decisión de seguridad separable del resto del plan.

Estas tres son preguntas para el owner, no obstáculos para aprobar el resto del documento — ninguna
bloquea el slice 1.

---

## 9 · Decisiones del owner (2026-09-30) y correcciones del censo `EDITOR-TIENDA-OBSERVED-1`

El owner aprobó este plan ("Iniciemos", 2026-09-30) con tres decisiones de producto, y el censo
`EDITOR-TIENDA-OBSERVED-1` — la sesión read-only previa al slice 1 (`EDITOR-TIENDA-IFRAME-GATE-1`) —
midió dos correcciones sobre lo escrito arriba. Las cinco quedan asentadas acá porque ninguna cambia
el plan de siete slices de § 6 — cambian lo que ESE plan ASUME, y no asentarlas dejaría el documento
describiendo un terreno que ya no es el medido (la misma razón por la que `CLAUDE.md` exige fechar y
re-medir sus propias listas en vez de confiar en que sigan vigentes).

### 9.1 · Decisiones del owner

- **Página completa, nunca secciones aisladas.** El iframe siempre muestra la PÁGINA real completa
  (home, /nosotros, /suscripciones, /tienda, /tienda/[slug]) — nunca una sección sola renderizada
  fuera de su página. Confirma la recomendación de § 3 (iframe de ruta real, opción (a) vía (b)) y
  descarta cualquier variante que aislara una banda del resto de su página — ninguno de los siete
  slices de § 6 proponía eso, así que esta decisión no cambia el plan; lo cierra para que no se
  reabra como alternativa más barata en algún slice futuro.
- **La edición de texto DIRECTO sobre la página es diseño NUEVO, pendiente.** El owner pidió poder
  editar el texto de una sección haciendo clic en ella DENTRO del iframe (edición in-situ), no sólo
  seleccionarla y resaltarla. **El censo midió que este pedido NO TIENE LUGAR en los 7 slices de
  § 6**: el slice 4 (`EDITOR-TIENDA-SELECCION-1`) sólo RESALTA y abre la sección en la lista
  lateral — el formulario de edición sigue viviendo FUERA del iframe, sin cambio (§ 4.5 no lo toca).
  Editar DENTRO del iframe (un campo editable superpuesto al texto real, o `contentEditable` sobre
  el nodo, con su propio mecanismo de guardado y su propio riesgo de que el DOM editado diverja del
  dato) es una pieza de diseño que este documento no cubre y que no se improvisa dentro de un slice
  ya aprobado con otro alcance. Queda **pendiente de su propio documento de diseño**, con su propio
  disparador — no se asume como parte implícita del slice 4 ni de ningún otro de los siete —
  **diseñado en `docs/editor-tienda/EDICION-INLINE.md` (`EDITOR-TIENDA-EDICION-INLINE-DISENO-1`);
  sigue sin construirse, y sigue necesitando su propia aprobación de escritura.**
- **El precio NO se edita desde el editor.** Ninguna de las piezas de § 4 (selección, orden,
  edición de texto futura) alcanza el precio de un producto. El precio sigue siendo dato del
  catálogo (`/admin/productos`), ajeno a `SiteContent` y a este editor — confirmado explícitamente
  para que nadie lo infiera del alcance amplio de "editar sobre la página" cuando llegue el diseño
  de edición de texto del punto anterior.

### 9.2 · Correcciones medidas (censo `EDITOR-TIENDA-OBSERVED-1`)

- **`no-store` YA está cubierto — § 5.2 punto 3 sobrestima el trabajo del slice 1.** Todo
  `app/(storefront)/` ya es `force-dynamic` (`layout.tsx:35`), así que CADA request —con o sin
  cookie de modo editor— ya sale sin caché, por construcción; no hace falta declarar
  `Cache-Control: private, no-store` aparte para el modo editor. Lo único que el slice 1 agrega en
  este eje es el `noindex` **POR REQUEST** (`robots:{index:false,follow:false}` en
  `generateMetadata`, vía `metadataRobotsSegunModo`) cuando el modo editor está activo — el
  `X-Robots-Tag` de `next.config.ts` cubre el caso "todo el deployment es demo", no el caso "esta
  request puntual trae el borrador puesto", que es un eje distinto y nuevo.
- **Tier del slice 2 (`EDITOR-TIENDA-IFRAME-VISTA-1`): corregido de 1 a 2** (ya reflejado en la
  tabla de § 6). La tabla original lo marcaba Tier 1 con el argumento "el iframe apunta a rutas
  Tier 1". Medido contra el criterio real de `CLAUDE.md` § Tier 1 — un archivo entra por estar
  NOMBRADO en la lista o por vivir en uno de los subárboles que la ganan (`components/storefront/`,
  `lib/checkout/`, `packages/core/src/pagos/`), nunca por "consultar" o "navegar hacia" una ruta
  protegida —: el ÚNICO archivo que el slice 2 toca es `components/admin/TiendaSeccionEditor.tsx`,
  que no está en la lista ni en ningún subárbol ganado. Un `<iframe src="/...">` apuntando a una
  ruta Tier 1 no trae al archivo que lo contiene a Tier 1, por la misma distinción que la lista ya
  traza para `packages/core/src/timezone.ts` (alcance genérico, conexión indirecta con la puerta de
  dinero → queda AFUERA pese a alimentarla). El slice 2 corre como Tier 2 — investigación plegada en
  la implementación detrás de un gate bloqueante, no una sesión OBSERVED aparte.

Esta sección no cambia el plan de § 6 más allá de la columna Tier de la fila 2 (ya corregida ahí) —
ningún slice se agrega, se quita, ni cambia de alcance por lo escrito acá.

---

## 10 · Lo que `EDITOR-TIENDA-IFRAME-VISTA-1` entregó, contra lo que § 6 planeaba

El dispatch de este slice amplió el alcance de la fila 2 de § 6 por encargo explícito del owner
("la lista de secciones y sus campos a un costado, la pagina al centro" — nunca secciones aisladas,
§ 9.1). Lo entregado:

- **El iframe reemplaza las tres `VistaTiendaEnVivo`** que `TiendaSeccionEditor` montaba (tarjeta
  compacta en lectura, vista grande + puente de Presentaciones en edición) — tal como planeaba la
  fila 2.
- **La composición cambia de verdad** (eso NO estaba en la fila 2 original, que suponía sólo
  reemplazar la vista DENTRO de cada `TiendaSeccionEditor`): `TiendaPaginas` ahora monta UN solo
  `VistaTiendaIframe` compartido por página, con la lista de secciones a un costado — no una vista
  por sección. Esto absorbe, parcialmente y por anticipado, una porción de lo que la fila 4
  (`EDITOR-TIENDA-SELECCION-1`) tenía planeado: el marcador `data-editor-seccion` y el desplazamiento
  "ir a la sección" (abrir una sección → el iframe se desplaza y resalta) SE CONSTRUYERON acá, por
  manipulación directa del DOM (mismo origen, sin `postMessage` — eso sigue siendo
  `EDITOR-TIENDA-POSTMESSAGE-1`/`EDITOR-TIENDA-SELECCION-1`, slices 3 y 4). Lo que la fila 4 TODAVÍA
  debe agregar: la dirección INVERSA (clic DENTRO del iframe → abre la sección en la lista) y el
  `postMessage` bidireccional — esta tanda sólo resuelve lista→iframe, nunca iframe→lista.
- **Suscripciones es la excepción medida, no la regla**: sus tres secciones
  (`suscripcionPlanes`/`suscripcionPasos`/`suscripcionFaq`) viven dentro de
  `app/(storefront)/suscripciones/Contenido.tsx`, que quedó FUERA de `touches:` de este slice — así
  que comparten un marcador ÚNICO de página (`data-editor-seccion="suscripciones"`), y "ir a la
  sección" para esas tres sólo lleva al tope de /suscripciones, no al bloque exacto. Si
  `EDITOR-TIENDA-SELECCION-1` entra a `Contenido.tsx`, esta limitación se cierra ahí.
- **`EDITOR-TIENDA-RETIRO-1` (fila 7) queda MÁS CHICO de lo planeado**: `VistaTiendaEnVivo.tsx` y
  `lib/config/esquema-style.ts` (`varsDeTienda`) SIGUEN VIVOS — `PaletaSeccion`/`FragmentoTienda` es
  su único consumidor restante, sin tocar en esta tanda (fuera de `touches:`). El puente
  `data-sf-tarjeta`/`lib/tienda/puente-tarjetas.ts` también sigue vivo con el MISMO alcance de
  siempre (sólo Presentaciones) — nada de esto se retiró, porque nada de esto se usaba ya desde
  `TiendaSeccionEditor`: `onClicTarjeta` (el handler que lo disparaba desde la vista previa LOCAL) sí
  se retiró, por quedar sin disparador tras este slice.
- **El selector de ancho (fila 5) y el reordenar/ocultar (fila 6) siguen intactos, sin construir.**

No se tocó código de `components/storefront/` en este slice (el `data-editor-seccion` de las tres
páginas de `app/(storefront)/` no cuenta — Tier 1 por estar en la lista `app/(storefront)/`
nombrada, no por tocar el subárbol `components/storefront/`).

---

## 11 · `MODO-EDITOR-SOLO-EN-EL-IFRAME-1` — la cookie se retira, la marca pasa a ser POR REQUEST

Gate del owner (2026-10-01), textual: *"Los cambios que hice en el panel, sin dar click en
publicar, se veían en la página real, enseguida."* Medido por el orquestador ANTES de este slice:
la cookie de `EDITOR-TIENDA-IFRAME-GATE-1` (`modo_editor_tienda`, `MODO_EDITOR_MAX_AGE_S = 2h`)
sobrevivía a cerrar la pestaña del editor —el `DELETE` de limpieza de `ModoEditorActivo.tsx` es un
`useEffect` de React y no corre en un cierre abrupto de pestaña— y mientras vivía, CUALQUIER pestaña
del mismo navegador que visitara la tienda real veía el borrador como si estuviera publicado. Esto
invierte § 5.2 punto 2 (ver la nota ahí) — queda escrito el mecanismo completo que lo reemplaza.

### 11.1 · El mecanismo: `?editor=1` → header de request → el mismo gate de sesión de siempre

- **El iframe carga la página con `?editor=1`** (`urlDePaginaEnEditor`, `lib/admin/editor-iframe.ts`
  — gemela de `urlDePagina`, que sigue siendo la ruta "pelada" usada para COMPARAR, no para cargar).
- **`proxy.ts` lo traduce a un header de REQUEST** (`x-editor-modo: 1`), sólo para esa request. La
  razón de pasar por un header y no dejar que el storefront lea el `searchParams` directo: **en
  Next 16 un LAYOUT no recibe `searchParams`** (medido en la primera corrida de este slice, BLOCKED
  sin cambios — sólo `page.tsx` los recibe), y el gate real vive en `app/(storefront)/layout.tsx`
  porque tiene que cubrir la página ENTERA (incluida `generateMetadata`, el `<style>` de paleta/
  fuentes/forma), no sólo el cuerpo de `page.tsx`. Un header de request SÍ atraviesa `headers()` en
  cualquier Server Component de la misma request, layout incluido.
- **El proxy NUNCA confía en un header que el cliente ya traiga.** Antes de decidir, borra cualquier
  `x-editor-modo` que haya venido en la request entrante; lo vuelve a poner SÓLO si el parámetro de
  la URL lo pedía. Sin esto, cualquiera podría mandar el header a mano (sin pasar por el iframe) y
  llegar al gate con la marca puesta — el parámetro de la URL es la ÚNICA fuente.
- **`lib/config/modo-editor-gate.ts` no cambió de CRITERIO, sólo de FUENTE**: `decidirModoEditor`
  (sesión OWNER/MANAGER activa + la marca) es exactamente el mismo que antes; lo único nuevo es
  `marcaModoEditorDesdeHeaders(h)`, que reemplaza a `cookies().has(COOKIE_MODO_EDITOR)`. El gate
  sigue siendo el MÁS ESTRICTO de los dos que conviven en el repo (§ 5.2 punto 1, sin cambios).
- **El parámetro en la URL no es, por sí mismo, una credencial nueva.** Compartir un link con
  `?editor=1` no le muestra nada a quien no tuviera YA sesión OWNER/MANAGER activa — exactamente la
  misma garantía que la cookie daba, sin el problema de que la cookie sobreviviera a cerrar la
  pestaña. El `?editor=1` desaparece con la request; no hay nada que expire, nada que limpiar al
  salir.
- **`app/api/site-content/modo-editor/route.ts` pierde su `POST`** (ya no hay nada que "prender"
  entre requests) y conserva un `DELETE` sin chequeo de sesión, para limpiar la cookie vieja de un
  navegador real que haya visitado el preview antes de este cambio — higiene, no corrección de un
  bug activo (el gate nuevo ni siquiera lee esa cookie). `ModoEditorActivo.tsx` lo llama UNA vez al
  montar, nunca más al desmontar.

### 11.2 · Navegar DENTRO del iframe — el vigía de ruta, no `postMessage` todavía

La tienda real adentro del iframe es completamente interactiva: un clic en el nav, una tarjeta de
producto o el carrito navega a OTRA ruta (`/tienda`, `/tienda/[slug]`, `/checkout`…) que no lleva
`?editor=1`. Dos salidas posibles, y se eligió la segunda:

- **"Conservar el parámetro" en cada navegación** exigiría reescribir el destino de cada enlace del
  storefront ANTES de que navegue. Medido: la mayoría de esa navegación es client-side de Next
  (`<Link>`, `router.push`) — no dispara el evento `load` del iframe ni reusa el `href` del DOM al
  momento del clic (el handler de `Link` ya capturó el destino original), así que "conservarlo"
  habría exigido interceptar el clic en fase de captura y forzar una navegación COMPLETA en cada
  caso, tocando `components/storefront/` entero — fuera de `touches:` de este slice.
- **"El iframe vuelve a la página del editor"** (la opción construida) se resuelve ENTERO dentro de
  `VistaTiendaIframe.tsx`: un POLL de 400ms compara `contentWindow.location.pathname` contra la
  ruta de la pestaña activa, y si divergió —por CUALQUIER causa: clic, redirect de un submit,
  `router.push`— lo manda de vuelta con `location.replace(urlDePaginaEnEditor(pagina))`. Un POLL y
  no un `onLoad` porque la navegación client-side de Next cambia `contentWindow.location` vía
  `history.pushState` SIN disparar `load` — un chequeo "al cargar" nunca vería ese caso.
- **Costo aceptado**: un reload extra si el admin se desvía (clic accidental en el nav, por
  ejemplo). **`EDITOR-TIENDA-POSTMESSAGE-1` (§ 13) NO resolvió esto** — el canal `postMessage` que
  construyó es panel→iframe, para sincronizar CONTENIDO (texto/imagen), no iframe→panel para avisar
  una ruta. El storefront avisando su propia ruta por `postMessage` (lo que eliminaría este reload
  extra) sigue sin construirse; el POLL de arriba se queda como está.
- **Límite nombrado, no resuelto acá**: una navegación a un dominio EXTERNO (un link de red social
  en el pie, por ejemplo) dentro del iframe deja `contentWindow.location` verdaderamente
  cross-origin — el vigía lo detecta (la lectura de `pathname` lanza) y se queda quieto (no insiste
  en corregir algo que ya no puede leer). El botón "Actualizar" tampoco lo recupera en ese caso
  (lee `contentWindow.scrollY`, también cross-origin). Es un límite preexistente del diseño iframe
  —ya existía antes de este slice, para cualquier link externo del storefront— y no se resuelve acá.

### 11.3 · Qué queda igual

- **Quién puede verlo (§ 5.2 punto 1) no cambió**: sesión OWNER/MANAGER activa, `activo` en la fila
  de `User`, nunca el payload de la sesión.
- **El `noindex` por-request (§ 5.2 punto 3, § 9.2)** sigue viviendo en `metadataRobotsSegunModo`,
  sin tocar — consume el MISMO booleano que `modoEditorActivo()` siempre produjo.
- **CSP/`frame-ancestors` (§ 5.2 punto 5)** sigue sin resolverse, sin cambios por este slice.

---

## 12 · `EDITOR-TIENDA-DISPOSITIVOS-1` — la vista propia de pantalla completa, y el selector de
    dispositivo (§ 4.3) tal como se construyó

Gate del owner (2026-10-01), viendo el editor que `EDITOR-TIENDA-IFRAME-VISTA-1` dejó montado
DENTRO de `/admin/tienda`: *"Se ve bien sin embargo se ve como en la vista movil, aun no se siente
como un editor inline"* — y, sobre la forma: *"Escritorio por defecto, sino cabe en el panel, se
puede abrir una nueva vista, es lo que hace Shopify el editor abre en una nueva vista no sale nada
del panel de navegacion."* El ítem de § 6 (fila 5) sólo planeaba el selector de dispositivo; la
vista propia es alcance NUEVO, por encargo explícito, igual que § 10 amplió la fila 2.

### 12.1 · La vista propia — `app/(admin)/editor/`

Hermana de `app/(admin)/admin/`, DENTRO del mismo grupo de rutas `(admin)` (hereda tema Duna,
fuentes, `.admin-shell` de `app/(admin)/layout.tsx` sin tocar ese archivo) pero con su PROPIO
`layout.tsx` que NO monta `AdminChrome` — sin sidebar, sin topbar del panel. `EditorTiendaPantalla
Completa` (`components/admin/EditorTiendaPantallaCompleta.tsx`) es el único chrome de la ruta: una
barra superior fina (volver al panel · pestañas de página · selector de dispositivo) y el cuerpo
—`TiendaPaginas`— llenando el resto del viewport (`position: fixed; inset: 0`), sin scroll de
documento.

- **El gate de acceso se EXTRAJO, no se copió.** `lib/admin/acceso-admin.ts`
  (`requerirSesionAdmin` + la mitad pura `decidirAccesoAdmin`, testeada en
  `lib/admin/acceso-admin.test.ts`) es la ÚNICA definición de "sesión Better Auth válida + rol
  OWNER/MANAGER activo contra la fila de `User`", compartida por `app/(admin)/admin/layout.tsx`
  (que la llamaba inline desde 2026-08) y por `app/(admin)/editor/layout.tsx` (nuevo). Verificado
  por ejecución: sin cookie de sesión, `/editor/tienda` rebota a `/login` — igual que `/admin/*`.
- **`proxy.ts` gana `/editor(.*)` al matcher**, en el MISMO bloque que ya bota `/admin/*` sin
  cookie — el pre-chequeo barato antes de llegar al layout del servidor.
- **`TiendaPaginas` se volvió CONTROLADO.** Antes era dueño de su propio `pagina`/`resaltar`
  (leídos de `useSearchParams`) y dibujaba su propio `role="tablist"`. Ahora recibe `pagina`,
  `resaltar` y `dispositivo` por props — el tablist y el deep-link del aviso de config
  (`?seccion=&tarjeta=`) subieron a `EditorTiendaPantallaCompleta`. Su layout interno dejó el
  `sticky`/`--duna-topbar-h` (que asumía estar DENTRO del chrome del panel, con document-scroll) por
  un `display:flex;height:100%` que llena la región que la vista propia le da — ya no hay topbar del
  panel de la que calcular un offset.
- **`/admin/tienda` se queda como PORTADA**, no redirige entera: los cinco ejes "cromo transversal"
  (`PaletaSeccion`/`MenuSeccion`/`EncabezadoSeccion`/`DetallesSitioSeccion`/`FooterSeccion`) no
  están en `touches:` de este slice —no se pueden reubicar— y no tienen vista previa en vivo (su
  propio motivo, § 1.1). Se quedan en `/admin/tienda`, con una tarjeta "Secciones de la tienda" +
  botón primario "Abrir editor" al final que lleva a `/editor/tienda`.
- **El deep-link del aviso de config (`lib/config/avisos-configuracion.ts`, fuera de `touches:`)
  sigue apuntando a `/admin/tienda?seccion=…&tarjeta=…`.** En vez de dejarlo roto o editar ese
  archivo, `/admin/tienda/page.tsx` pasó a Server Component con `searchParams`: si trae `seccion`,
  REENVÍA el query completo a `/editor/tienda?…` con `redirect()` antes de renderizar la portada.
  El mecanismo vive en el propio `page.tsx`, no en `proxy.ts` (no hay una tabla de rutas que
  traducir — sólo reenviar el query tal cual, mismo principio que § Backlog/`lib/redirect-*` de
  CLAUDE.md pero sin esa plomería porque es un solo destino).

### 12.2 · El selector de dispositivo (§ 4.3), construido

`lib/admin/editor-iframe.ts` gana la parte PURA: `DispositivoKey`, `ANCHOS_DISPOSITIVO`
(escritorio 1280 · tablet 768 · teléfono 393 — medidos contra lo que el repo YA usa, no
inventados: `ANCHO_VIEWPORT` de `scripts/verificar-nayoli-visual.ts`, el breakpoint `md` de
Tailwind ya usado como corte responsive del storefront, y el viewport del dispositivo Playwright
"iPhone 15" ya nombrado en los comentarios de medición del repo), `DISPOSITIVO_DEFECTO` (escritorio),
`CLAVE_DISPOSITIVO_EDITOR` (la clave de `localStorage`) y `calcularEscalaDispositivo` — con test en
`lib/admin/editor-iframe.test.ts`.

- **El iframe toma el ANCHO LITERAL, nunca se reflowa a otro ancho.** `VistaTiendaIframe` mide su
  canvas (ancho Y alto, por `ResizeObserver`) y arma DOS cajas: una caja de recorte con el ancho
  VISIBLE (`anchoDispositivo × escala`, centrada por `justify-content: center` del canvas) y, adentro,
  una caja SIN escalar con el ancho LITERAL del dispositivo (`anchoDispositivo`) y un alto calculado
  para que, multiplicado por la escala, llene EXACTAMENTE el alto disponible — nunca hueco, nunca
  recorte, nunca scroll del canvas. El `<iframe>` vive dentro de esa segunda caja, así que su propio
  viewport interno es el ancho REAL del dispositivo (393px de verdad para teléfono) — las clases
  `sm:`/`md:` de Tailwind del storefront se activan de verdad, no por una ilusión de escala.
  `transform: scale()` sólo se aplica cuando el dispositivo no entra en el canvas disponible —
  verificado por ejecución: a 1280×900 de ventana del admin, Escritorio (1280) no escala (nav
  completo visible); Tablet (768) y Teléfono (393) sí, centrados, con letterbox a los lados.
- **Escritorio es el default**, recordado en `localStorage` (`admin:editor-tienda:dispositivo`, con
  `try/catch` — sin storage accesible, se queda en el default) — resuelve el síntoma textual del
  owner ("se ve como en la vista movil"): el editor viejo medía SIEMPRE el ancho del panel (una
  columna angosta dentro del grid), así que el iframe rendía SIEMPRE con los breakpoints móviles
  activos, sin que nadie lo hubiera elegido.
- **"Ir a la sección" y el resalte siguen funcionando en los tres modos** (verificado por
  ejecución): la escala es puramente VISUAL (CSS `transform` sobre un ancestro), así que
  `contentDocument`/`contentWindow` del iframe —de donde salen `querySelector`, `scrollIntoView` y
  el vigía de ruta— no cambian de comportamiento. El `onLoad`/scroll-preservado de `recargar()`
  tampoco: opera sobre `win.scrollY`, coordenadas del documento del iframe, ajenas al scale del
  contenedor.

### 12.3 · Verificación — tráfico público, gate, y el editor en vivo

- **`npm run gate`**: verde — `npm run typecheck` (0 errores), `npm test` (3022/3022), `npm run
  test:integracion` (283/283).
- **`npm run verificar:nayoli:visual` y `npm run guarda:color`**: las SEIS rutas públicas + los dos
  hovers de `ProductCard` dan **0px** salvo `ruta:home`/`ruta-home`, que DIFIERE con la MISMA cifra
  —al píxel— que el piso YA heredado de `SECCIONES-ENTRAN-VIVAS-1`/`SECCIONES-ENTRAN-UNA-VEZ-1`
  (355.138/4.608.000 px consciente de AA, caja [96,862]–[1183,3306], documentado en
  `DECISIONS.md`): este slice no toca `app/(storefront)/` ni `components/storefront/`, así que no
  agrega ni un píxel sobre ese piso ya conocido.
- **El editor en vivo**, con sesión real (seed efímero, `admin@sierranativa.co` / `ChangeMe123!`,
  nunca contra `development`/producción): capturado en los tres modos de dispositivo, con la
  ventana del navegador fija a 1280×900 (el tamaño de escritorio del arnés de
  `verificar-nayoli-visual.ts`) — Escritorio muestra el nav completo del storefront (Tienda ·
  Suscripciones · Nosotros), nunca el botón de menú de teléfono; Tablet y Teléfono muestran el nav
  colapsado (ícono de menú), que es el comportamiento RESPONSIVE real de la tienda, no una
  ilusión de escala. El botón "Abrir editor" de `/admin/tienda` y el cambio de página
  (Home → Nosotros) también se verificaron por ejecución.

---

## 13 · `EDITOR-TIENDA-POSTMESSAGE-1` — el contenido en vivo sin recargar, y el salto de scroll
    cerrado (no sólo el canal del plan)

Gate del owner (2026-10-01), el mismo que motivó § 12: *"tambien lo de cada vez que se hace un
cambio y refresca no siempre vuelve a donde se hizo el cambio sino a la mitad de la pagina que esta
renderizando"*. Dos mitades: el canal `postMessage` que la fila 3 de § 6 ya planeaba, y el
diagnóstico+cierre del salto de scroll (§ 1 del prompt de este slice) — que terminó siendo una
investigación más profunda que "el documento crece después de `onLoad`".

### 13.1 · El salto de scroll — la causa medida no era la que parecía

Medido con Playwright, timing FIEL al real (`addInitScript` registrando el handler de `'load'`, no
un `page.evaluate()` posterior — ese roundtrip de CDP es más lento y esconde la carrera), contra una
base efímera con el preset **CORTE** aplicado de verdad:

- A `'load'` el documento tiene layout pero NO su altura final (≈4486px contra ≈5930px finales —
  sigue creciendo por el catálogo/las imágenes).
- `win.scrollTo(0, y)` —la forma de DOS argumentos, que hereda `scroll-behavior:smooth` de
  `globals.css`— **ANIMA** en vez de saltar, y la animación queda atascada contra el límite VIEJO
  (≈3586px) mientras el documento sigue creciendo. El navegador no la retoma sola cuando el límite
  sube.
- Medido el efecto: la posición quedó pegada en 3586px —≈60% de una página de 5930px, "a mitad de
  la página"— durante más de un segundo antes de corregirse. Y esa corrección sólo existe porque
  CORTE tiene su propio `ScrollInercia` corriendo en paralelo; sin CORTE, el salto queda sin
  corregir para siempre.

El fix REUSA el autómata de `lib/storefront/scroll-inercia.ts` (las cuatro funciones puras de
estabilización de altura, ya usadas por `ScrollInercia` para el mismo problema) directo desde
`VistaTiendaIframe.tsx` — nunca reimplementado. Son genéricas sobre números, así que funcionan para
cualquier tenant, no sólo CORTE. `scroll-inercia.ts` no cambió de comportamiento: ganó un párrafo
documentando al segundo consumidor.

**Medido después del fix, mismo timing fiel**: cero posición visible incorrecta; el scroll se queda
en 0 hasta que la altura se confirma estable (~1.9s) y ahí salta una vez, exacto.

**Hallazgo lateral, NO arreglado — dev-mode, no el código** (anotado como `EDITOR-TIENDA-HMR-
IFRAME-SELF-1`, DECISIONS.md): contra `next dev`, el frame PRINCIPAL (el panel, no el iframe)
navegaba repetidas veces al clickear "Actualizar" — un dev server iframeando a sí mismo, el cliente
HMR probablemente apuntando a `window.top`. No se reprodujo contra producción (`next build && next
start`), que es donde se verificó el fix. Ningún código de este slice navega la pestaña padre.

### 13.2 · El puente `postMessage` — panel→iframe, para CONTENIDO

`lib/storefront/editor-puente.ts` (puro) + `components/storefront/EditorPuenteVivo.tsx` (la mitad
impura, con el `import()` dinámico del schema zod — nunca estático, para no pagar su peso en el
bundle de cada visitante público). `SiteContentProvider` pasó de dumb a STATEFUL (un segundo
context, SÓLO para este componente, expone el setter). `VistaTiendaIframe` gana
`enviarCambio(seccion, datos)`; `TiendaSeccionEditor` lo dispara con un `useEffect` sobre `form`
(cubre los ~10 call sites que lo tocan sin instrumentar cada uno) y PIERDE el reload-tras-
autoguardado-asentado — exactamente el "refresca con cada cambio" del reporte del owner.

**Censo: las ~40 componentes que leen `useSiteContent()` se actualizan SOLAS** — ninguna arma su
slice de `SiteContent` server-side y lo pasa por props, así que el contexto reactivo las cubre a
todas sin tocarlas una por una. Lo único que NO reacciona es lo que el layout inyecta como `<style>`
server-rendered (paleta/fuentes/forma) y las cinco secciones "cromo transversal" fuera del iframe
— ninguno de los dos está en `touches:` de este slice.

**Medido por ejecución, contra producción con sesión real**: el mensaje se refleja en 5ms (frío,
primer `import()`) / 2.4ms (caliente); cero navegaciones del frame principal durante el cambio
(confirmado también con una marca de `window` que sobrevive intacta — la prueba de que no hubo un
documento nuevo).

### 13.3 · Lo que NO se construyó acá, para que no se confunda con la fila 3 original

La fila 3 de § 6 decía "elimina el reload por tecla" en términos genéricos; lo construido cubre
EXACTAMENTE eso (texto/imagen de las secciones que pasan por `TiendaSeccionEditor`), pero NO
construyó el canal INVERSO (iframe→panel) que § 10 y § 11.2 ya habían anotado como pendiente para
esto mismo:

- **La selección en contexto** (clic DENTRO del iframe → abre la sección en la lista) sigue siendo
  `EDITOR-TIENDA-SELECCION-1` (fila 4), sin tocar.
- **El storefront avisando su propia ruta por `postMessage`** (lo que evitaría el reload extra del
  vigía de ruta cuando el admin se desvía de la página, § 11.2) tampoco se construyó — el POLL de
  400ms se queda como está.

**Cierra `EDITOR-TIENDA-POSTMESSAGE-1`.**

---

## 14 · `EDITOR-TIENDA-SELECCION-1` — selección en contexto, el interruptor Navegar, y Suscripciones
    deja de compartir un marcador único

Fila 4 de § 6, con dos ampliaciones que el spec pedía resolver (no quedar como diseño pendiente):
**"decidí cómo se vuelve a «usar» la tienda… y decilo"** (§ 4.1) y cerrar la limitación de
Suscripciones que § 10/§ 9.2 dejaron anotada (sus tres secciones compartían el marcador de página).

### 14.1 · El canal iframe→panel, y el gate correcto del clic

`EditorPuenteVivo.tsx` gana el SEGUNDO sentido del puente —hasta `EDITOR-TIENDA-POSTMESSAGE-1` sólo
recibía (panel→iframe, contenido); ahora también ENVÍA (iframe→panel, selección)—, con dos mensajes
nuevos en `lib/storefront/editor-puente.ts` (`TIPO_MENSAJE_SECCION_CLICK`,
`TIPO_MENSAJE_MODO_NAVEGAR`), la misma forma pura/impura de siempre.

**Un clic en CUALQUIER parte de la página, en modo editor, se intercepta en fase de CAPTURA sobre
`document`** —antes de que cualquier `<Link>`/`onClick` de React corra—: `preventDefault()` +
`stopPropagation()` siempre que el interruptor "Navegar" esté apagado (el DEFAULT), y si el clic cae
dentro de un `[data-editor-seccion]` además manda el marcador al panel por `postMessage`. Un clic
FUERA de cualquier marcador (el nav, el pie, el carrito — chrome global, fuera de `<main>`) sólo se
frena: no hay sección que abrir, y frenarlo es lo que cumple "enlaces, botones, carrito y ojo no se
disparan" (el pedido textual del spec), sin necesitar una lista de excepciones por componente.

El afordance de hover (outline punteado, el mismo ámbar del resalte del panel) lo pinta una clase
(`duna-editor-seleccion` en `<html>`) que este mismo componente pone/quita — nunca en `globals.css`,
nunca un listener por nodo.

### 14.2 · "Navegar" — la decisión de cómo se vuelve a usar la tienda

Un botón nuevo en la barra de `VistaTiendaIframe.tsx` (junto a "Actualizar"), apagado por defecto.
Manda `TIPO_MENSAJE_MODO_NAVEGAR` por `postMessage`; `EditorPuenteVivo` lo guarda en un REF (no en
estado — nada de lo que depende de su valor necesita un re-render del lado del iframe) y, mientras
esté encendido, el listener de clic de § 14.1 no hace nada: la tienda se usa como un visitante real.

**Se re-envía tras CADA carga del iframe** (primera carga, cambio de página, `recargar()`), con
reintentos cortos (150/600/1500ms): el documento nuevo arranca en su propio default y el listener del
lado del iframe se adjunta en un `useEffect`, DESPUÉS de hidratar — un envío único puede perderse si
`load` dispara antes de que ese efecto corra. Reenviar el mismo booleano es idempotente.

**HALLAZGO MEDIDO, no anticipado por el diseño: el vigía de ruta (§ 11.2, el POLL que devuelve el
iframe a la página editada si el admin se desvía) y "Navegar" compiten por la MISMA cosa —adónde
apunta el iframe— y hasta corregirlo el vigía GANABA SIEMPRE.** Con "Navegar" encendido y un clic
real navegando el iframe a otra ruta, el vigía (que corre cada 400ms, sin saber nada del interruptor)
detectaba la divergencia y lo mandaba DE VUELTA con `location.replace` — el interruptor habría parecido
roto: se prende, se clickea, y 400ms después se está de nuevo donde se empezó. Se cierra gateando el
vigía al MISMO ref (`if (navegandoRef.current) return;`, antes de cualquier otro chequeo del poll):
con "Navegar" encendido el vigía se apaga entero; al apagar "Navegar" vuelve a traer al iframe de
vuelta a la página que se edita, como siempre. **Verificado por ejecución** (§ 14.4): un clic real con
Navegar ON deja al iframe en `/tienda` más de 1.2s después (> el intervalo de 400ms del vigía) sin
que lo revierta.

### 14.3 · Suscripciones deja de compartir un marcador único — por qué fue imperativo, no JSX

`app/(storefront)/suscripciones/Contenido.tsx` (el único archivo de `components/storefront`-
adyacente en `touches:` de este slice) etiqueta sus TRES secciones (`suscripcionPlanes`/
`suscripcionPasos`/`suscripcionFaq`) por separado, cerrando la limitación de § 10/§ 9.2 ("ir a la
sección" sólo llevaba al TOPE de la página).

**El problema real, medido ANTES de escribir código:** este archivo no puede recibir `enModoEditor`
por prop (`app/(storefront)/suscripciones/page.tsx`, quien lo sabría, está FUERA de `touches:`), no
puede leerlo de un context (ninguno de los dos providers del storefront lo expone, y agregarle uno
exige tocar el layout, también fuera de `touches:`), y no puede usar `useSearchParams()` (exige un
`<Suspense>` que ningún ancestro de este árbol tiene — medido: `app/(admin)/editor/tienda/page.tsx`
SÍ envuelve en `<Suspense>` por esto mismo, pero el storefront no).

**La salida: el componente mira su propio DOM.** `page.tsx` (sin tocar) YA escribe
`<div data-editor-seccion="suscripciones">` ÚNICAMENTE cuando `modoEditorActivo()` —sesión real,
server-side— lo decidió. `Contenido.tsx` usa `closest()` sobre ESE marcador como ancla: si existe, es
el ÚNICO caso en que puede existir (borrador verificado por sesión real); si no (el tráfico público),
el efecto no hace NADA. Encontrado el ancla, el efecto ESCRIBE el atributo imperativamente
(`setAttribute`) sobre los nodos reales que YA existen —nunca una nueva `<div>` en el JSX, que sí
rompería el byte-a-byte de la sección "sin modo editor, cero atributos nuevos"—, ubicados por
POSICIÓN (`:scope > section` para los dos de Planes + el de Pasos —que puede estar AUSENTE,
`ocultable:true`—, `:scope > main` para la FAQ). Documentado en el código como la limitación
estructural que es: si alguno de los tres componentes cambia su número de raíces, esto falla
CALLADO —el clic en esa zona deja de resolver—, el mismo límite de hoy, no uno peor.

`marcadorDeSeccion`/`selectorDeSeccion` (`lib/admin/editor-iframe.ts`) se simplifican: las tres de
Suscripciones caen a la identidad (ya no comparten `'suscripciones'`). Nueva función inversa
`seccionDesdeMarcador` (identidad salvo `'featured'`→`'spotlight'`, la única ambigüedad real) resuelve
el marcador que llega del clic a una sección del panel; `TiendaPaginas.tsx` valida el resultado contra
el registro de la página activa antes de usarlo — un marcador que no resuelve a nada conocido se
ignora, nunca lanza.

### 14.4 · El bug que sólo la EJECUCIÓN encontró — `pedidoExterno` reabriendo una sección cerrada

`TiendaSeccionEditor` gana `TiendaSeccionEditorHandle.seleccionar()` (forwardRef), llamado por
`TiendaPaginas` cuando un clic DENTRO del iframe resuelve a esa sección. El PRIMER diseño (un
contador `pedidoExterno` + un efecto con deps `[pedidoExterno, editando]`) pasó `tsc`/`npm test` y
SE ROMPIÓ en la primera corrida con sesión real: cerrar una sección que alguna vez se abrió por
selección en contexto la REABRÍA sola, en el acto. Causa: el efecto corre con CUALQUIER cambio de
`editando`, no sólo con un `pedidoExterno` nuevo — y "Cerrar" (manual, del operador) también cambia
`editando`. Con `pedidoExterno` todavía distinto de cero, ese cambio se leía como "hay un pedido sin
atender: abrir". Se cierra con dos refs (`procesadoHastaRef`/`desplazarPendienteRef`, § el código,
el comentario completo) que distinguen "llegó un pedido NUEVO" de "`editando` cambió por otra razón".
**Es la razón de fondo de por qué este slice exigía verificación por EJECUCIÓN y no sólo gate**: el
bug sólo se manifiesta con una secuencia real de clics (abrir A → cerrarlo con el botón → abrir B), que
ningún test de capa 1/2 ejercita.

### 14.5 · Verificación por ejecución

Contra DB efímera propia (nunca `development`/producción), sin preset (Nayoli), `next build && next
start`, login real (`admin@sierranativa.co`/`ChangeMe123!`), sesión OWNER real — script ad-hoc en
`.scratch/` (no committed, por diseño: es arnés de verificación de ESTE slice, no una pieza del
producto). **14/14 verificaciones en verde**, entre ellas:

| verificación | resultado |
| --- | --- |
| home: clic en el hero DENTRO del iframe | abre "Portada" en la lista |
| home: "Editar" en la lista (lista→iframe, mecanismo heredado de `EDITOR-TIENDA-IFRAME-VISTA-1`) | resalta (outline) el nodo correcto DENTRO del iframe |
| nosotros: clic en "Historia" DENTRO del iframe | abre "Historia" en la lista |
| suscripciones: clic en `suscripcionPlanes`/`suscripcionPasos`/`suscripcionFaq` (tres clics, tres marcadores DISTINTOS, verificados por `count()`) | cada uno abre "Planes" / "Cómo funciona" / "Preguntas frecuentes" — nunca la misma de la vez anterior |
| Navegar OFF (default): clic en un `<a>` del nav | el iframe sigue en `/suscripciones` |
| Navegar ON: el MISMO clic | el iframe navega a `/tienda`, y sigue ahí 1.2s después (el vigía no lo revierte) |

### 14.6 · Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3042/3042** |
| `npm run test:integracion` | **283/283** — sin cambio sobre el piso (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run verificar:nayoli:visual` | `ruta:home` DIFIERE — **MISMA cifra, al píxel, que el piso heredado**: 355.138/4.608.000 px (consciente de AA), caja [96,862]–[1183,3306]; las otras 5 rutas + 2 hovers **IDÉNTICO (0px)** |
| `npm run guarda:color` | Misma cifra, misma caja; las otras 5 rutas + 2 hovers IDÉNTICO (0px) |

### `schema`/`cross-repo-contract`

Ninguno aplica: sin cambios a `packages/core/prisma/schema.prisma`, sin migración, sin contrato
cross-repo.

### CLAUDE.md — grep de los símbolos que este diff cambió

Grepeados: `VistaTiendaIframe` (0), `TiendaSeccionEditor` (6 — ninguna la vuelve falsa: describen el
contrato de borrador, el patrón de bloques/`bloquesRef`, el uploader extraído, `categoriasListas` —
ninguno de esos cuatro ejes cambió), `TiendaPaginas` (4 — ídem, el fetch 6→1 y el agrupado por página
no cambiaron), `EditorPuenteVivo`/`editor-puente`/`editor-iframe`/`data-editor-seccion`/
`marcadorDeSeccion`/`EDITOR-TIENDA-SELECCION-1`/`EDITOR-TIENDA-POSTMESSAGE-1`/
`EDITOR-TIENDA-IFRAME-VISTA-1` (0 cada uno). `Contenido.tsx` (1, línea 2968 — "page.tsx server +
Contenido.tsx cliente", sigue siendo exactamente ese reparto). `suscripcionPlanes`/`suscripcionPasos`/
`suscripcionFaq` (1 cada uno, describen que son secciones editables — sigue siendo cierto).

**DOS HALLAZGOS, pre-existentes a este slice, NO causados por este diff** (encontrados por el mismo
grep, reportados porque el mecanismo no distingue "lo encontré" de "lo causé"): la línea 2759 de
CLAUDE.md menciona `onClicTarjeta` como vivo en `TiendaSeccionEditor.tsx` —ese handler se RETIRÓ en
`EDITOR-TIENDA-IFRAME-VISTA-1` (§ 10 de este mismo documento ya lo dice: "`onClicTarjeta`… sí se
retiró, por quedar sin disparador")—, y la línea 2884 dice "`TiendaPaginas` agrupa… SIN GATE" como si
el selector de página siguiera viviendo ahí, cuando `EDITOR-TIENDA-DISPOSITIVOS-1` lo subió a
`EditorTiendaPantallaCompleta`. Ninguna de las dos está en `touches:` de este slice — quedan como
open follow-up, no corregidas acá.

### Verdict

**AWAITING_APPROVAL (`customer-bytes`)** — gate verde (typecheck + 3042 + 283), `verificar:nayoli:
visual`/`guarda:color` sin un píxel nuevo sobre el piso heredado, las dos direcciones del puente y el
interruptor Navegar verificados por ejecución contra producción con sesión real, un bug real
(`pedidoExterno` reabriendo una sección cerrada) encontrado y cerrado por esa misma ejecución.
Commiteado en `slice/corte-reescritura-prototipo-1`. `stopped_on: [customer-bytes]` — `schema` y
`cross-repo-contract` NO aplican. El dispatch instruyó explícitamente parar en `AWAITING_APPROVAL`
sin merge.

**Open follow-ups:**
- `CLAUDE-MD-ONCLICTARJETA-STALE-1` — CLAUDE.md:2759 describe `onClicTarjeta` como vivo en
  `TiendaSeccionEditor.tsx`; se retiró en `EDITOR-TIENDA-IFRAME-VISTA-1`. No corregido acá:
  `CLAUDE.md` no está en `touches:` para ese párrafo (sólo se agregó, no se corrigió, el asiento de
  este slice).
- `CLAUDE-MD-TIENDAPAGINAS-SELECTOR-STALE-1` — CLAUDE.md:2884 describe a `TiendaPaginas` agrupando
  con el selector de página "SIN GATE"; el selector subió a `EditorTiendaPantallaCompleta` en
  `EDITOR-TIENDA-DISPOSITIVOS-1`. Mismo motivo, no corregido acá.
- `EDITOR-TIENDA-ORDEN-1`/`EDITOR-TIENDA-RETIRO-1` (filas 6/7 del plan) — siguen pendientes, sin
  relación con este slice. **`EDITOR-TIENDA-ORDEN-1` ENTREGADO, § 15** — este bullet describe el
  estado al cerrar `EDITOR-TIENDA-SELECCION-1`, no el de hoy.

**Cierra `EDITOR-TIENDA-SELECCION-1`.**

---

## 15 · `EDITOR-TIENDA-ORDEN-1` — reordenar y ocultar desde la lista lateral (fila 6 de § 6)

Fila 6 de § 6: la lista lateral de la página Home gana una asa de arrastre por sección (mouse +
teclado) y un ojo por sección, al estilo del editor de temas de Shopify. El cambio va al borrador
como cualquier sección y se publica/descarta igual; el iframe refleja el nuevo orden/visibilidad al
instante, por el puente, sin recargar.

### 15.1 · El HERO SÍ se reordena — § 4.2 asumía un piso que la medición no confirmó

El spec de este slice pedía decir si el hero queda fijo arriba "si hoy es así por diseño". **Medido:
NO lo es.** `resolverOrden`/`BANDA_IDS` (`site-content-defaults.ts`) tratan a `'hero'` como una
`BandaId` más —ocupa la POSICIÓN 1ª por ser la primera entrada de `BANDA_IDS`, no por estar fijada—,
y `app/(storefront)/page.tsx` la monta dentro del MISMO `.map(resolverOrden(orden))` que las otras
8, sin excepción. La única pieza que en algún momento asumió "el hero es `orden[0]`" ya se corrigió
ANTES de este slice: `tratamientoNav` (`lib/config/esquema-style.ts:168-186`) decide si el nav flota
mirando la PRIMERA banda resuelta —sea cual sea—, no el hero por nombre; su propio docstring lo dice
("`orden[0]`… YA NO es necesariamente el hero"). Por eso el hero se implementó **reordenable como
cualquier otra banda**, sin pin especial: `HERO.ocultable` sigue en `false` (no gana ojo — una home
sin encabezado no es un caso de v1, intacto desde antes de este slice), pero su asa de arrastre
funciona igual que las de las otras 8.

### 15.2 · El "endpoint nuevo" de § 4.2 se volvió una extensión chica del genérico — sin archivo nuevo

§ 4.2 proponía `app/api/site-content/orden/route.ts`, mismo patrón que `/tema`/`/encabezado`. **No
se construyó** — `touches:` de este slice no lo nombraba (sólo el genérico `app/api/site-content/
route.ts`), y medido, no hacía falta uno nuevo:

- **El PUT ya aceptaba `orden` sin tocar nada**: `ordenEditableSchema` ya está declarado en
  `siteContentEditableSchema` (`lib/config/site-content-schema.ts:365-368`, desde ANTES de este
  slice — `§ el bug #65-B`) — `guardarBorrador({ orden: [...] })` ya fusionaba la clave, porque
  `guardarBorrador` es key-agnóstica sobre `Prisma.InputJsonValue`.
- **El POST (publicar/descartar) sólo necesitaba una condición más.** `publicarSeccion`/
  `descartarSeccion` (`site-content-write.ts`) YA son key-agnósticas —reciben cualquier `string`—;
  lo único que bloqueaba `seccion:'orden'` era la validación del route (`seccion in REGISTRY`, y
  `'orden'` está fuera del REGISTRY a propósito, como `tema`). Se agregó `seccion === 'orden' ||` a
  esa condición — una línea, documentada en el propio archivo.

### 15.3 · El canal en vivo REUSA el mensaje existente — `VistaTiendaIframe.tsx` quedó fuera de `touches:`

**Restricción real, no elegida:** `components/admin/VistaTiendaIframe.tsx` —dueño del `<iframe>` y
de `enviarCambio(seccion, datos)`, el ÚNICO camino panel→iframe— NO está en `touches:` de este
slice, así que no podía ganar un método `enviarOrden` propio. La salida: `enviarCambio` YA es
genérico en RUNTIME (manda `{tipo: TIPO_MENSAJE_CONTENIDO_SECCION, seccion, datos}` tal cual, sin
mirar el REGISTRY del lado del panel) — sólo está TIPADO a `SeccionVista`. `TiendaPaginas.tsx`
(`enviarOrdenIframe`) lo llama con la clave `'orden'` vía un cast documentado, y
`EditorPuenteVivo.tsx` —el lado RECEPTOR, SÍ en `touches:`— reconoce `seccion === 'orden'` ANTES de
`esSeccionDelRegistro`/`fusionarContenidoSeccion` (que sólo fusionan claves DEL REGISTRY) y toma una
rama distinta: en vez de fusionar contenido en el contexto (`actualizar`), **reordena el DOM real**
con `appendChild` sobre los nodos `[data-editor-seccion]` que `page.tsx` ya emite —mismo origen,
misma técnica que ya usa `VistaTiendaIframe.tsx` para "ir a la sección" (§ 4.1.1: manipulación
directa del DOM en vez de reinventar con CSS lo que el DOM ya hace—. `appendChild` sobre un nodo ya
en el árbol lo MUEVE; es seguro acá porque `Home` es un Server Component —su árbol no vuelve a
reconciliarse del lado del cliente—, así que React nunca intenta deshacer este reordenamiento
externo (verificado por ejecución, § 15.5: la marca de `window` sobrevive, cero navegaciones).

**Por qué NO se fusiona `orden` en el context:** ningún band lee `content.orden` reactivamente — la
secuencia la fija `page.tsx`, en el SERVIDOR, al momento del render. Patchear `orden` en el
`SiteContentProvider` sería estado muerto; el efecto real es el DOM.

`lib/storefront/editor-puente.ts` gana `datosDeOrden(datos)` — validación ESTRUCTURAL (¿hay un
array en `datos.valor`?) — y el contenido semántico (ids conocidos, sin repetir) lo resuelve
`resolverOrden` (SOFT, nunca lanza) en el llamador: `orden` es una permutación de un set YA
CONOCIDO, no texto libre que el dueño tipea, así que coercionar defensivamente es más apropiado que
rechazar con zod, a diferencia de los demás mensajes de este módulo.

### 15.4 · `sinPublicar.orden` — por el fetch a `/publicado`, no por tocar `site-content-read.ts`

`readSiteContentParaEditor` (`lib/config/site-content-read.ts`) calcula `sinPublicar[key]` por un
loop sobre `Object.keys(REGISTRY)` más dos excepciones a mano (`tema`, `encabezado`) — **fuera de
`touches:`** de este slice. En vez de sumar una tercera excepción ahí, `TiendaPaginas.tsx` siembra
`hayBorradorOrden` comparando el `orden` draft-merged (ya bajado por el GET genérico) contra
`GET /api/site-content/publicado` (endpoint YA existente, sin tocar) en el `useEffect` de siembra —
un fetch extra, UNA vez al montar la página Home, no recurrente. Después de la siembra, cada
reorder/drag local fuerza `hayBorradorOrden = true` directo (mismo patrón que `cambiar()` en
`TiendaSeccionEditor` — un dirty-flag local, no una comparación continua), y Publicar/Descartar lo
vuelven a `false`.

**Deuda declarada, no cerrada:** el camino IDIOMÁTICO sería que `readSiteContentParaEditor` ganara
`sinPublicar.orden = 'orden' in borrador` (una línea, mismo patrón que `tema`/`encabezado`) — se
dejó fuera porque `site-content-read.ts` no está en `touches:` de este slice. Ver open follow-up
`SITE-CONTENT-READ-SINPUBLICAR-ORDEN-1`.

### 15.5 · Verificado por EJECUCIÓN — sesión real, Postgres efímero propio, con capturas

Arnés ad-hoc (`.scratch/verificar-orden-sesion.ts`, no comiteado por diseño — mismo criterio que el
arnés de `EDITOR-TIENDA-SELECCION-1`, § 14.5): reusa el bootstrap de `verificar-nayoli-visual.ts`
(`levantarPostgres`/`migrarYSembrar`/`construir`/`arrancar`/`cargarPlaywright`, EXPORTADOS, sin
reescribirlos), puertos propios (55441/3497), seed CANÓNICO (`prisma/seed.ts`, crea
`admin@sierranativa.co`/`ChangeMe123!`), `next build && next start`, Chromium headless. Nunca contra
`development`/producción.

Secuencia, con capturas (`.scratch/verificar-orden-sesion/*.png`, no comiteadas):

1. Login OWNER real → `/editor/tienda` → el orden inicial del DOM del iframe (vía
   `[data-editor-seccion]`) es el canónico: `hero, marquesina, trustBadges, featured, brandStory,
   origen, presentaciones, subscriptionCTA, testimonials`.
2. Marca `window.__marcaOrden = 'viva'` en el `window` del iframe (mismo mecanismo que
   `EDITOR-TIENDA-POSTMESSAGE-1` ya usó, § 13.2, para probar "no hubo un documento nuevo").
3. Foco en el asa "Mover Marquesina…" (`getByRole('button', {name: /^Mover Marquesina/})`) +
   `ArrowDown` (el mecanismo de TECLADO, § el pedido — mouse no se ejercitó por esta vía, ver
   Unknowns). El DOM del iframe reordena EN EL ACTO: `hero, trustBadges, marquesina, featured, …` —
   Marquesina y Confianza (trustBadges) intercambiaron posición, como pide `moverBandaEnDireccion`.
   La marca de `window` SIGUE `'viva'` — cero navegación, confirmado.
4. El ojo de Marquesina (nace `visible:false`, § `DEFAULTS.marquesina`): "Mostrar Marquesina" → el
   wrapper `[data-editor-seccion="marquesina"]` pasa de vacío a con contenido, EN EL ACTO; "Ocultar
   Marquesina" → vuelve a vacío. Las DOS direcciones del self-gate (`seccionEsVisible`, construido
   ANTES de este slice) confirmadas en vivo, sin tocar ese mecanismo.
5. "Publicar" (la barra nueva de `TiendaPaginas.tsx`) → `200` → la barra desaparece.
6. **`psql` directo contra la base efímera** (no la UI): `SELECT content->'orden' FROM
   "SiteContent"` da `["hero","trustBadges","marquesina","featured","brandStory","origen",
   "presentaciones","subscriptionCTA","testimonials"]` — EXACTAMENTE el orden que el paso 3 produjo
   en el iframe. Es el mismo dato que `app/(storefront)/page.tsx` lee con `resolverOrden(orden)`
   para CUALQUIER visitante real (el mapeo no se tocó, § 15.1 confirma que no hay excepción para
   el hero) — así que el criterio de aceptación de la fila 6 de § 6 ("el orden que muestra el
   iframe tras arrastrar coincide con el que la home pública muestra tras publicar") se verificó
   por el DATO, no re-cargando la home pública en el mismo navegador (ver Unknowns).

Capturas: `1-antes.png` (lista + iframe, orden canónico, Marquesina/Destacado con el ojo tachado y
el badge "Oculta"), `2-tras-arrowdown.png` (la barra "Sin publicar — El orden de las secciones
cambió" + Confianza ya antes de Marquesina en la lista + el hero completo renderizado en el iframe),
`3-marquesina-mostrada.png` (el ojo abierto, "Guardando…"), `4-marquesina-ocultada-de-nuevo.png`,
`5-tras-publicar.png` (la barra de orden ya no está; Marquesina conserva su PROPIO "Sin publicar" —
el vaivén mostrar/ocultar del paso 4 deja un dirty-flag local en esa sección, aunque el valor neto
sea igual al default — un residuo ESPERADO de la secuencia de prueba, no un defecto; nunca se
publicó ese borrador).

### 15.6 · Lo que NO se verificó por ejecución — nombrado, no escondido

- **El DRAG CON MOUSE** (HTML5 nativo, `draggable`/`onDragStart`/`onDragEnter`/`onDragEnd`) no se
  ejercitó vía Playwright — el drag-and-drop nativo headless es frágil de scriptear de forma
  confiable, y el camino de TECLADO ejercita la MISMA tubería completa (estado→envío en
  vivo→autoguardado→publicar) salvo por qué función pura calcula el array siguiente
  (`moverBandaEnDireccion` para teclado, `moverBandaConDestino` para mouse) — la SEGUNDA está
  afirmada en capa 1 (`lib/admin/orden-secciones.test.ts`, 10/10), pero su disparo real desde
  `onDragEnter` (los tres handlers del asa) no se probó con un mouse de verdad.
- **La home PÚBLICA** (sin sesión, sin `?editor=1`) no se recargó en el mismo navegador tras
  publicar para confirmar visualmente el nuevo orden — se verificó por el DATO persistido (§ 15.5,
  paso 6), que es lo que esa ruta consume. `npm run verificar:nayoli:visual`/`guarda:color` SÍ
  corrieron contra la home pública real (§ Gate, abajo), pero con el orden CANÓNICO (sin reordenar)
  — confirman "sin publicar un orden distinto, cero bytes nuevos", no "con un orden distinto, se ve
  distinto" (eso último no tiene fixture contra el cual compararse — sería afirmar lo obvio).

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3319/3319** (era 3307/3307 según el asiento de `EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1`, DECISIONS.md:47897 — el slice inmediato anterior en esta rama; +12, `lib/admin/orden-secciones.test.ts` ×10 + `lib/storefront/editor-puente.test.ts` ×2, confirmado por `git diff --stat`/`grep -c "^+test("`) |
| `npm run test:integracion` | **313/313** (era 308/308, mismo asiento; +5, `tests/integracion/orden-secciones.test.ts`) |
| `npm run guarda:color` | RED — **MISMA cifra EXACTA, en las 6 rutas**, que el drift YA documentado por `PIE-HECHO-POR-DUNA-1` (ruta-home 165.052/4.608.000 px AA, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/… px AA cada una, caja `[445,Y]–[541,Y+10]`) — pre-existente a este slice, sin cambio. Fixture sin regenerar, a propósito (decisión del owner). |
| `npm run verificar:nayoli:visual` | MISMA cifra exacta que `guarda:color`, rama vs. `main` — consistente: este slice no agrega un solo píxel sobre el piso heredado. |

### Chequeo mecánico contra `CLAUDE.md`

Símbolos/rutas que este diff cambió, grepeados uno por uno: `moverBandaAIndice`/
`moverBandaEnDireccion`/`moverBandaConDestino`/`ordenarPorBanda`/`datosDeOrden`/`AsaOrdenProps`/
`orden-secciones`/`EDITOR-TIENDA-ORDEN-1` — **0 cada uno**, nada que falsificar. `TiendaPaginas` (4
coincidencias) y `TiendaSeccionEditor` (6) — los MISMOS conteos que `EDITOR-TIENDA-SELECCION-1` ya
midió (§ 14.6): ninguna de las 10 describe el mecanismo de orden/ojo que este slice agrega, y las
DOS ya marcadas stale (`CLAUDE-MD-ONCLICTARJETA-STALE-1`, `CLAUDE-MD-TIENDAPAGINAS-SELECTOR-STALE-1`)
siguen igual de stale, por una razón AJENA a este diff — no corregidas acá (mismo motivo: no están
en `touches:` para ese párrafo). `EditorPuenteVivo`/`editor-puente`/`content.orden`/`BANDA_IDS`/
`resolverOrden` — **0 cada uno**: CLAUDE.md no nombra ninguno de estos símbolos.

**UN HALLAZGO fuera de `touches:`, nombrado como open follow-up:**
`lib/config/site-content-schema.ts:357-358` (`ordenEditableSchema`, NO en `touches:` de este slice)
dice, textual: *"NO es una sección —tampoco pasa por el flujo borrador/publicar—"*. Este slice hace
que esa frase sea FALSA: `orden` SÍ pasa por el flujo borrador/publicar ahora (§ 15.2). No corregido
acá — ver `SITE-CONTENT-SCHEMA-ORDEN-COMMENT-STALE-1` en Open follow-ups.

### `customer_bytes`

**`changed: true`** — la rama entera (no sólo este commit) agrega, sobre `main`: el asa de arrastre
+ ojo + barra "Sin publicar"/Publicar/Descartar del orden en `/editor/tienda` (bytes que el DUEÑO
lee al editar), y la CAPACIDAD de que el orden de las bandas de la home pública cambie una vez que
el dueño reordene y publique (hoy, sin esa acción, byte-idéntico — verificado, § Gate). Como en los
asientos anteriores de esta rama, el merge que esto aterrizaría sobre `main` también carga los
bytes visibles de los slices previos sin mergear.

**`strings:`**
- (panel) `'Mover {título de la sección} — posición N de 9. Arrastra con el mouse o usa las flechas
  arriba/abajo.'` — aria-label del asa, por sección.
- (panel) `'Mostrar {título} en la tienda'` / `'Ocultar {título} en la tienda'` — aria-label del ojo.
- (panel) `'El orden de las secciones cambió.'`, `'Sin publicar'`, `'Descartar'`, `'Publicar'` —
  la barra nueva (los tres últimos textos YA existían en cada tarjeta de sección; acá se reusan,
  byte-idénticos).

### `schema`/`cross-repo-contract`

Ninguna aplica: `SiteContent.content`/`.borrador` son `Json` — `orden` ya era una clave válida
dentro de ese blob desde `site-content-defaults.ts` (eje 5, anterior a este slice); cero columna
nueva, cero migración. Sin contrato cross-repo.

### Open follow-ups

- `SITE-CONTENT-SCHEMA-ORDEN-COMMENT-STALE-1` — `lib/config/site-content-schema.ts:357-358`
  (`ordenEditableSchema`) describe `orden` como "NO pasa por el flujo borrador/publicar"; con este
  slice, SÍ pasa. No corregido: el archivo no está en `touches:`.
- `SITE-CONTENT-READ-SINPUBLICAR-ORDEN-1` — `readSiteContentParaEditor`
  (`lib/config/site-content-read.ts`) podría ganar `sinPublicar.orden = 'orden' in borrador` (una
  línea, mismo patrón que `tema`/`encabezado`) y ahorrarle a `TiendaPaginas.tsx` el fetch extra a
  `/api/site-content/publicado` en la siembra (§ 15.4). No construido: el archivo no está en
  `touches:` de este slice.
- **El drag con MOUSE no se verificó por ejecución** (§ 15.6) — si alguna vez se reporta un defecto
  ahí, el primer sospechoso es el trío `onDragStart`/`onDragEnter`/`onDragEnd` de
  `TiendaPaginas.tsx` (`asaDeSeccion`), nunca ejercitado contra un mouse real.
- `CLAUDE-MD-ONCLICTARJETA-STALE-1`/`CLAUDE-MD-TIENDAPAGINAS-SELECTOR-STALE-1` — siguen vivos, sin
  relación con este slice (§ 14.6, sin cambio).
- `EDITOR-TIENDA-RETIRO-1` (fila 7 del plan) — sigue pendiente, sin relación con este slice.

### Verdict

**AWAITING_APPROVAL (`customer-bytes`)** — gate verde (typecheck + 3319 + 313), `guarda:color`/
`verificar:nayoli:visual` con la MISMA cifra exacta que el drift heredado de `PIE-HECHO-POR-DUNA-1`
(cero píxeles nuevos), reorden por teclado + ojo + publicar verificados por ejecución contra una
sesión real con capturas (§ 15.5), el dato publicado confirmado por `psql` directo. Commiteado en
`slice/corte-reescritura-prototipo-1`. `stopped_on: [customer-bytes]` — `schema` y
`cross-repo-contract` NO aplican. El dispatch instruyó explícitamente parar en `AWAITING_APPROVAL`
sin merge.

**Cierra `EDITOR-TIENDA-ORDEN-1`.**

---

## 17 · `EDITOR-TIENDA-DESHACER-1` — deshacer/rehacer de verdad, y el estado agregado de la barra

**NACE EN 17, NO EN 16, Y ES DELIBERADO.** `EDITOR-TIENDA-TEMA-1` (§ 6/§ 7, arriba) se refiere a sí
mismo como "`§ 16`" en tres sitios (líneas 461/483/484) pero **nunca construyó un encabezado `## 16`
propio** — esos tres son referencias adelantadas a una sección que no llegó a existir. Numerar ESTE
slice como `## 16` habría hecho que esas tres referencias, escritas por TEMA-1 para describir SU
PROPIO mecanismo, apuntaran en silencio al mecanismo de ÉSTE —el error exacto que el chequeo
mecánico de este protocolo existe para atrapar (§ el pointer-check, "cerrar una sección es el caso
que muerde")—. Se numera `## 17` para no pisarlas; `§ 16` sigue siendo el hueco de TEMA-1, sin
contenido, tal como estaba antes de este diff.

Pedido del owner, FUERA de la numeración original de § 6 (mismo caso que `EDITOR-TIENDA-TEMA-1`,
§ el párrafo que lo marca "OCTAVO slice" en § 6 arriba — éste es el NOVENO). El editor gana
deshacer/rehacer REAL —Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z y botones en la barra— sobre lo editado en la
sesión (textos, imágenes, orden), un indicador agregado («Guardando…»/«Guardado» + «N cambios sin
publicar») y un «Publicar»/«Descartar» que actúan sobre TODAS las secciones pendientes de la página
abierta de una vez.

### 17.1 · El historial es un COMMAND STACK genérico, sin conocimiento de `SiteContent`

`lib/admin/historial-editor.ts` (`crearHistorialEditor`) es la MISMA forma que `lib/autoguardado.ts`
—un coordinador PURO, sin React— pero más simple: dos pilas (deshacer/rehacer) de `PasoHistorial =
{ deshacer: () => void; rehacer: () => void }`. El módulo nunca sabe QUÉ hay detrás de un paso —el
llamador (`TiendaSeccionEditor.tsx`/`TiendaPaginas.tsx`) construye el paso con SUS PROPIOS closures
(p. ej. "vuelve el form de esta sección al valor X"). `registrar` corta la pila de rehacer —el
comportamiento estándar de cualquier undo/redo: editar tras deshacer descarta la rama vieja—.
`sonIguales` (mismo archivo) es la igualdad ESTRUCTURAL que decide si un lote de ediciones es un
no-op (tipear y borrar lo mismo no debe empujar un paso vacío).

**EL PASO ES "UN LOTE", no una tecla — y el límite del lote es el MISMO debounce del autoguardado
que YA existía, no un concepto nuevo.** `TiendaSeccionEditor.tsx` consolidó los ~8 sitios que
mutaban el form (`cambiar`, cada video del hero, `ponerImagen`/`usarPorDefecto`/`vaciarImagen`) en
UN punto único, `aplicarCambioForm`, que: (a) si no hay un lote abierto, congela el valor ANTERIOR
en un ref (`loteAntesRef`); (b) deja que el autoguardado haga lo suyo (debounce de 1000ms o flush
inmediato, según la acción). Un efecto sobre `auto.estado` detecta la transición a `'guardado'`
—el lote se asentó— y empuja `{ deshacer: () => restaurarForm(antes), rehacer: () =>
restaurarForm(despues) }` al historial, vía `onPaso` (prop nueva). `TiendaPaginas.tsx` hace LO
MISMO para `'orden'` (que vive en ese componente, no en una sección), sobre `autoOrden.estado`. Una
RESTAURACIÓN (`restaurarForm`/`restaurarOrden`) marca un ref de supresión (`aplicandoHistorialRef`)
ANTES de aplicar el valor, para que el propio asentamiento de ESE guardado no se re-empuje a sí
mismo como un paso nuevo — sin esa guarda, cada deshacer generaría otro deshacer disponible, y la
pila nunca convergería.

**`TiendaPaginas` es el DUEÑO ÚNICO del historial** (una instancia por `pagina`/`modo` — se
`limpiar()` al cambiar cualquiera de los dos, § 17.4): las N secciones montadas empujan ahí sus
pasos vía la MISMA prop `onPaso`, y el orden (que vive en `TiendaPaginas` mismo) empuja directo.
Deshacer/rehacer siempre operan sobre el ÚLTIMO paso de CUALQUIER tipo, en el orden real en que se
asentaron — no hay una pila por sección.

### 17.2 · El estado agregado — por qué necesita DOS canales, no uno

La barra necesita mostrar algo que NINGÚN componente individual conoce por sí solo: cuántas
secciones de la página activa tienen borrador AHORA MISMO, y si CUALQUIERA está guardando/falló.
`TiendaSeccionEditor` reporta su propio `{ hayBorrador, estado }` en cada cambio real (prop nueva
`onEstado`); `TiendaPaginas` junta esos reportes en un `Map` + su propio `hayBorradorOrden`/
`autoOrden.estado` + `doc.sinPublicar.tema` (el único canal que SÍ venía ya calculado, § GET
genérico), y reporta el AGREGADO hacia `EditorTiendaPantallaCompleta` por un CALLBACK
(`onEstadoGlobal`), no por `ref` — un método imperativo no puede disparar un re-render del padre
por sí solo, y la barra necesita re-renderizarse cada vez que el agregado cambia. Las ACCIONES
(`deshacer`/`rehacer`/`publicarPendientes`/`descartarPendientes`), en cambio, SÍ van por `ref`
(`TiendaPaginasHandle`, `forwardRef`/`useImperativeHandle`) — son comandos, no estado.

**EL FILTRO DE DEDUPE QUE EVITA EL BUCLE INFINITO.** `secciones` (`SECCIONES_TIENDA.filter(...)`) NO
está memoizado en este archivo —nunca lo estuvo, y no es parte de `touches:` cambiar eso—, así que
el efecto de agregado correría en CADA render con una referencia nueva. Sin cuidado, eso dispara
`onEstadoGlobal` con un objeto nuevo en cada render → el padre hace `setState` → el padre re-renderiza
→ `TiendaPaginas` se re-renderiza → el efecto corre de nuevo → bucle. Se cierra comparando el
agregado CALCULADO contra el último reportado (`ultimoEstadoGlobalRef`) antes de llamar al
callback: el efecto puede correr de más, pero sólo NOTIFICA cuando algo cambió de verdad. Verificado
por ejecución (§ 17.5): la sesión completa (login, abrir el editor, tres ediciones, deshacer×4,
rehacer×3, publicar) no colgó el navegador ni mostró el síntoma de un loop (CPU al 100%, pestaña sin
responder).

### 17.3 · El "Publicar todo" es ATÓMICO — pero vive en el ROUTE, no en `site-content-write.ts`

**DESVIACIÓN MEDIDA contra `touches:`.** El spec pedía construir el publish-en-lote "sobre
`publicarSeccion` (atómica: o todas o ninguna)" — pero `publicarSeccion`/`descartarSeccion`
(`lib/config/site-content-write.ts`) cada una abre SU PROPIA `prisma.$transaction`; llamarla N
veces en un loop sería N transacciones separadas, atómicas por sección y NO atómicas como
CONJUNTO (un fallo a mitad de camino dejaría publicadas sólo las primeras). Para que "o todas o
ninguna" sea literal hacía falta UNA sola transacción sobre la lista completa — y
`lib/config/site-content-write.ts` **no está en `touches:` de este slice**.

La salida: `publicarVariasSecciones`/`descartarVariasSecciones`, dos funciones NUEVAS exportadas
DIRECTO desde `app/api/site-content/route.ts` (no desde `site-content-write.ts`), que repiten la
MISMA lógica de `publicarSeccion`/`descartarSeccion` (mover `borrador[s]`→`content[s]`, o
descartarlo) para TODA la lista dentro de UNA `prisma.$transaction`. Son key-agnósticas igual que
sus hermanas de una sección —`'orden'`/`'tema'` pasan por acá como cualquier clave del REGISTRY,
sin un `if` especial—, y se EXPORTAN (no quedan privadas al módulo) para que el carril
(`tests/integracion/publicar-pagina.test.ts`) las importe DIRECTO sin montar HTTP. **Medido, no
asumido, que importar un archivo de ruta de Next fuera de un request es seguro**: `next/headers`
sólo revienta si se LLAMA fuera de contexto (`headers()`), nunca por el mero `import` del módulo —
confirmado con un `import()` de una línea antes de escribir el test (sólo un warning de Better Auth
sobre `BETTER_AUTH_URL`, no un error).

El route (`POST`, acciones nuevas `'publicarVarias'`/`'descartarVarias'`, body `{ secciones:
string[] }`) valida la lista ENTERA antes de llamar a cualquiera de las dos: cada elemento debe ser
`'orden'`, `'tema'`, o una clave del REGISTRY — una lista con UN valor inválido se rechaza completa
(400), nunca se publica una parte y se ignora el resto en silencio.

### 17.4 · El TEMA queda FUERA del historial y del agregado en vivo — dos límites distintos, el mismo origen

**DESVIACIÓN MEDIDA, la más grande de este slice.** El spec nombra "el tema" entre lo que
deshacer/rehacer debe cubrir ("sobre todo lo editado en la sesión… imágenes, orden, tema"). Medido
contra el código: `PaletaSeccion.tsx` —el componente que posee el form del tema, su propio
`guardarTema`/`cargar`/`hayBorrador`— **no está en `touches:` de este slice**, y no expone NINGÚN
punto de control externo más que `enEditor`/`onCambioEnVivo` (ya existentes, de `EDITOR-TIENDA-
TEMA-1`). Sin un método imperativo o un prop controlado que diga "tu valor es X" o "reporta tu
estado acá", no hay forma de construir un `PasoHistorial` para el tema sin tocar ese archivo — y
tocarlo habría ampliado `touches:` sin autorización.

**Dos huecos DISTINTOS, con DOS soluciones distintas:**

1. **Deshacer/rehacer de un cambio de color: NO CONSTRUIDO.** Mientras el dueño está en la pestaña
   Tema, Ctrl+Z no revierte un cambio de paleta — sólo afecta a lo que haya editado en secciones/
   orden ANTES de entrar a esa pestaña (y el historial se `limpiar()` de todas formas al cambiar de
   `modo`, § abajo). Queda nombrado como open follow-up (`EDITOR-TIENDA-DESHACER-TEMA-1`): requiere
   que `PaletaSeccion.tsx` gane un método imperativo o un callback de "paso confirmado", en su propio
   slice, con su propio `touches:`.
2. **"Publicar/Descartar TODO" SÍ incluye al tema** — esto NO necesita tocar `PaletaSeccion.tsx`
   para nada, porque publicar/descartar en lote opera sobre la BASE (`publicarVariasSecciones`,
   arriba), nunca sobre el estado interno de ese componente. El ÚNICO problema es que, tras un
   publish/discard en lote, `PaletaSeccion` seguiría mostrando SU propio "Sin publicar" (no sabe
   que se publicó por otro lado). Se resuelve con el MISMO truco que `VistaTiendaIframe` ya usa
   (`key={pagina}`): `<PaletaSeccion key={temaReloadKey} .../>` — un contador que se incrementa
   tras un lote que incluyó `'tema'` fuerza un REMONTE completo, y el `useEffect` de carga de
   `PaletaSeccion` (ya existente, dispara al montar) vuelve a leer `/api/site-content` por su
   cuenta. Cero líneas tocadas en `PaletaSeccion.tsx`.

**EL CONTADOR DE PENDIENTES DEL TEMA, EN VIVO, TAMBIÉN QUEDA UN PASO ATRÁS — hueco DECLARADO, no
construido.** El `doc.sinPublicar.tema` que alimenta la cuenta de "N sin publicar" sólo se
refresca: al montar `TiendaPaginas`, y al ENTRAR a la pestaña Tema (`useEffect` nuevo sobre
`modo`). Mientras el dueño EDITA dentro de esa pestaña, sus guardados propios (los de
`PaletaSeccion`) no le avisan a `TiendaPaginas` — no hay canal para eso sin tocar ese archivo—, así
que la píldora puede mostrar un número desactualizado hasta el próximo refetch. No bloquea nada
(el publish/discard en lote sigue actuando sobre el ÚLTIMO valor conocido, que puede ser
correcto o no según cuándo se refrescó por última vez); es una limitación de FRESCURA, no de
corrección estructural.

### 17.5 · El KEYDOWN del iframe — tercera fuente obligada a desviarse de `touches:`

**DESVIACIÓN MEDIDA, la tercera de este slice.** El spec exige que Ctrl/Cmd+Z funcione también con
el foco DENTRO del iframe (salvo en un campo editable, donde manda el undo nativo). Eso requiere un
mensaje iframe→panel nuevo — y por el patrón establecido en TODO el resto del puente
(`TIPO_MENSAJE_SECCION_CLICK`, `TIPO_MENSAJE_CAMPO_CAMBIO`…), ese discriminador debería vivir en
`lib/storefront/editor-puente.ts`, el módulo compartido. **Ese archivo no está en `touches:` de
este slice.** La salida: `TIPO_MENSAJE_DESHACER`/`esMensajeDeshacer` se declaran DIRECTO en
`components/storefront/EditorPuenteVivo.tsx` (el componente, no el módulo puro) — el único archivo
del puente que SÍ está en `touches:` y que además es, por construcción, el ÚNICO emisor de este
mensaje. `TiendaPaginas.tsx` (el único receptor) los IMPORTA de ahí directo, en vez de un módulo
compartido. Es el mismo nombre/forma que cualquier otro mensaje del puente —roto sólo en DÓNDE
vive—, documentado en el propio código para que no se lea como un descuido.

El propio `EditorPuenteVivo.tsx` hace el chequeo de foco —`document.activeElement` es `INPUT`/
`TEXTAREA`/`isContentEditable` → no intercepta, deja el undo nativo del navegador— ANTES de
reenviar, así que `TiendaPaginas.tsx` (y el listener gemelo en `EditorTiendaPantallaCompleta.tsx`
para cuando el foco está en el PANEL, no en el iframe) no necesitan repetir esa lógica: cuando el
mensaje llega, ya se decidió que corresponde actuar.

### 17.6 · Verificado por ejecución — sesión real, Postgres efímero propio

Arnés `.scratch/verificar-deshacer.ts` (no comiteado, gitignored — mismo criterio que
`verificar-orden-sesion.ts`/`verificar-tema-sesion.ts`), contra una build de PRODUCCIÓN (`next
build` + `next start`, puertos propios 55443/3499) con sesión real (`admin@sierranativa.co`),
Postgres efímero con el seed canónico de Nayoli. **Secuencia completa, en verde tras un ajuste de
selector del propio arnés** (el primer intento chocó con que "Publicar" aparece TRES veces en
pantalla —el botón global de la barra y dos de sección que quedaron abiertas—, y el arnés
desambiguaba mal; corregido con `.first()`, apuntando al botón global por ser el primero en el DOM,
sin tocar nada del mecanismo):

| paso | medido |
| --- | --- |
| estado inicial | `Guardado`, 0 pendientes |
| editar `hero.eyebrow` (texto, vía el input de la lista) | asienta en `Guardado`, 1 pendiente |
| mover Marquesina con teclado (`ArrowDown` en el asa) | el DOM del iframe reordena; asienta en `Guardado`, 2 pendientes |
| ocultar "Nuestra Historia" (el ojo, `brandStory`) | el toggle cambia; asienta en `Guardado`, 3 pendientes |
| Deshacer ×1/×2/×3 | cada uno asienta en `Guardado` (nunca se queda colgado en `Guardando…`) |
| tras deshacer×3: `hero.eyebrow` | vuelve EXACTO al valor original (`Calidad en cada pedido`) |
| tras deshacer×3: el orden del DOM del iframe | vuelve EXACTO al array original (9 bandas, mismo orden) |
| tras deshacer×3: `aria-pressed` del ojo de Historia | vuelve EXACTO a `false` (no-oculta, el original) |
| un 4º deshacer (pila vacía) | no-op confirmado — no mueve el eyebrow ni revienta |
| Rehacer ×1/×2/×3 | cada uno asienta en `Guardado` |
| tras rehacer×3: los tres valores | EXACTOS a los de después de los 3 cambios originales (`EYEBROW-DESHACER-1`, el orden movido, el ojo oculto) |
| "Publicar" (el botón global) | pendientes → 0 |
| lo PUBLICADO, leído directo con `psql` | `content.hero.eyebrow = "EYEBROW-DESHACER-1"`; `content.orden` = el array reordenado; `content.brandStory.visible = false` — los TRES valores REHECHOS, no los originales ni algo intermedio |

**UN HALLAZGO DE MÉTODO, no un defecto:** el primer intento del arnés esperaba que "pendientes"
volviera a 0 después de deshacer×3 (vuelta exacta al VALOR inicial). **Midió 3, no 0, y eso es
correcto** — `hayBorrador` (§ `site-content-write.ts`, `guardarBorrador`) marca PRESENCIA en el
borrador, no diferencia de VALOR contra lo publicado; deshacer vuelve a escribir un borrador (con
el valor original) por el MISMO camino que cualquier edición, así que sigue "sin publicar" hasta
publicar/descartar — EXACTAMENTE lo que ya pasa hoy si alguien teclea algo y lo vuelve a escribir a
mano, con o sin esta pieza. Se corrigió la EXPECTATIVA del arnés, no el código; lo que debe volver
exacto (y volvió) es el VALOR, no el contador de pendientes.

**LO QUE NO SE VERIFICÓ POR EJECUCIÓN, nombrado:**

- `EDITOR-TIENDA-DESHACER-OVERLAY-TECLADO-1` — el atajo de teclado CON el foco DENTRO del overlay
  flotante de texto (§ EDITOR-TIENDA-CAMPO-EDITABLE-1) — este arnés editó por el INPUT DE LA LISTA,
  no por el campo flotante dentro del iframe, así que el camino de reenvío de
  `EditorPuenteVivo.tsx` (§ 17.5) corrió en producción pero no bajo un arnés automatizado.
- El cambio de color del tema tampoco se ejercitó (§ 17.4: no construido, no un hueco de
  verificación — no hay nada que verificar de algo que no existe).
- `EDITOR-TIENDA-DESHACER-BOTONES-1` — los BOTONES de Deshacer/Rehacer de la barra (en vez del
  atajo de teclado) no se clickearon en este arnés —se usó el teclado para las dos direcciones—,
  aunque llaman exactamente a los mismos dos métodos del handle (`TiendaPaginasHandle.deshacer`/
  `.rehacer`) que el atajo ya ejercitó.

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3334/3334** (era 3323/3323 al cierre de `EDITOR-TIENDA-TEMA-1`; +11, todos en `lib/admin/historial-editor.test.ts`, el módulo nuevo) |
| `npm run test:integracion` | **323/323** (era 313/313, mismo asiento; +10, `tests/integracion/publicar-pagina.test.ts`) |
| `npm run guarda:color` | RED — **MISMA cifra EXACTA** que el drift ya documentado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`/`PIE-HECHO-POR-DUNA-1`): `ruta-home` 165.052/4.608.000 px AA · 174.711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/… px AA cada una (361 crudo), caja `[445,Y]–[541,Y+10]`; los 2 hovers IDÉNTICOS (0 px). Cero píxeles nuevos |
| `npm run verificar:nayoli:visual` (rama vs. `main`) | MISMA cifra exacta que `guarda:color`, en las 8 claves |

**Por qué `guarda:color` SÍ corrió completo (no salió en el `exit 0` barato):** la RAMA —no sólo
este commit— ya toca 11 archivos del sistema de color derivado (`lib/config/esquema-style.ts`,
`palette-derive.ts`, `fuentes.ts`, `formas.ts`… heredados de `EDITOR-TIENDA-TEMA-1`), así que la
intersección contra `SISTEMA_DE_COLOR` no es vacía y el script corre el diff de píxeles completo —
tal como ya le pasó a `EDITOR-TIENDA-TEMA-1`. Este slice en particular no agrega ni quita ningún
archivo de esa lista.

**Cero píxeles de drift nuevo, por construcción:** `EditorPuenteVivo.tsx` gana un `useEffect` nuevo
y dos exports (`TIPO_MENSAJE_DESHACER`/`esMensajeDeshacer`) pero CERO JSX nuevo — el efecto de
teclado está gateado por `activo` igual que todos los demás de ese archivo, y fuera de modo editor
(el 99.99% del tráfico) ni siquiera se adjunta el listener. Los otros cuatro archivos tocados son
100% admin (`components/admin/*`, `app/api/*`) — nunca se sirven al visitante público.

### Chequeo mecánico contra `CLAUDE.md`

Símbolos/rutas que este diff cambió, grepeados uno por uno contra `CLAUDE.md`: `historial-editor`,
`crearHistorialEditor`, `PasoHistorial`, `publicarVariasSecciones`, `descartarVariasSecciones`,
`TIPO_MENSAJE_DESHACER`, `esMensajeDeshacer`, `TiendaPaginasHandle`, `EstadoGlobalEditor`,
`marcarPublicado`, `restaurarDesdePublicado`, `onPaso`, `onEstado` — **0 cada uno**, CLAUDE.md no
nombra ninguno. `EditorPuenteVivo`/`editor-puente` — **0** (CLAUDE.md no los nombra tampoco, mismo
resultado que ya midió `EDITOR-TIENDA-ORDEN-1` § 15.6 para otros símbolos del puente).
`TiendaSeccionEditor`/`TiendaPaginas` — los MISMOS ~10 hits que § 14.6/§ 15.6 ya midieron y
marcaron: ninguno describe el mecanismo de deshacer/agregado que este slice agrega (son sobre
bloques/catálogo/fetch-6→1), y las dos entradas YA marcadas stale
(`CLAUDE-MD-ONCLICTARJETA-STALE-1`/`CLAUDE-MD-TIENDAPAGINAS-SELECTOR-STALE-1`) siguen igual de
stale, por una razón ajena a este diff. `app/api/site-content/route.ts`, `site-content-write.ts`,
`publicarSeccion`/`descartarSeccion`, `lib/autoguardado.ts`/`useAutoguardado`,
`EditorTiendaPantallaCompleta` — **0 cada uno**: `CLAUDE.md` no describe el comportamiento interno
de ninguno (las pocas menciones de `publicarSeccion('tema')`/`autoguardado` que SÍ aparecen hablan
de OTRO mecanismo —§ El TEMA, § La PANTALLA— que este diff no toca ni contradice). **Nada que
falsificar.**

### `customer_bytes`

**`changed: true`** — la RAMA entera (no sólo este commit) agrega, sobre `main`: dos botones nuevos
(Deshacer/Rehacer) y un indicador de estado agregado + una píldora "N sin publicar" con
Publicar/Descartar en la barra de `/editor/tienda` — bytes que el DUEÑO lee al editar. Como en los
asientos anteriores de esta rama, el merge que esto aterrizaría sobre `main` también carga los
bytes visibles de los slices previos sin mergear.

**`strings:`**
- (panel) aria-label/title de los dos botones nuevos: `"Deshacer"` / `"Deshacer (Ctrl/Cmd+Z)"`,
  `"Rehacer"` / `"Rehacer (Ctrl/Cmd+Shift+Z)"`.
- (panel) el indicador agregado: `"Guardando…"` / `"Guardado"` / `"No se pudo guardar"` — MISMOS
  tres literales que cada tarjeta de sección ya usa (`estadoTexto`, `TiendaSeccionEditor.tsx`),
  reusados en la barra, no reescritos.
- (panel) la píldora: `"{N} sin publicar"` (nueva, en vez del `"Sin publicar"` sin número que cada
  tarjeta ya mostraba) + `"Descartar"`/`"Publicar"`/`"Publicando…"` — los TRES últimos byte-idénticos
  a los que cada tarjeta y la barra del orden (§ 15) ya usaban.
- Ningún texto nuevo llega al storefront público: `EditorPuenteVivo.tsx` no agrega JSX, sólo un
  `postMessage` sin interfaz visible.

### `schema`/`cross-repo-contract`

Ninguna aplica: cero migración, cero columna nueva (el nuevo endpoint opera sobre `SiteContent.
content`/`.borrador`, ya `Json`). Sin contrato cross-repo — el mensaje nuevo del puente
(`TIPO_MENSAJE_DESHACER`) es interno al mismo despliegue, mismo-origen, nunca cruza a otro sistema.

### Open follow-ups

- `EDITOR-TIENDA-DESHACER-TEMA-1` — deshacer/rehacer de un cambio de PALETA/tipografía/forma sigue
  sin construirse (§ 17.4): necesita que `PaletaSeccion.tsx` gane un método imperativo o un
  callback de paso confirmado, en su propio slice con su propio `touches:` (ese archivo no está en
  el de éste).
- `EDITOR-TIENDA-TEMA-PENDIENTES-EN-VIVO-1` — el contador de "sin publicar" del tema no sigue en
  vivo los guardados propios de `PaletaSeccion` mientras el dueño edita dentro de esa pestaña
  (§ 17.4); sólo se refresca al montar o al entrar a la pestaña. Mismo archivo fuera de `touches:`.
- `EDITOR-TIENDA-DESHACER-MENSAJE-COMPARTIDO-1` — `TIPO_MENSAJE_DESHACER`/`esMensajeDeshacer` viven
  en `EditorPuenteVivo.tsx` en vez de `lib/storefront/editor-puente.ts` (§ 17.5), rompiendo el
  patrón de TODOS los demás discriminadores del puente. Si `lib/storefront/editor-puente.ts` entra
  a `touches:` de un slice futuro, mover la definición ahí (sin cambiar la forma del mensaje) cierra
  esta deuda.
- `EDITOR-TIENDA-DESHACER-OVERLAY-TECLADO-1` — el atajo de teclado con foco DENTRO del overlay
  flotante (campo editable, § EDITOR-TIENDA-CAMPO-EDITABLE-1) no se verificó por ejecución
  (§ 17.6) — corre en producción por el mismo código ya verificado con el foco en el input de la
  lista, pero sin un arnés que lo haya ejercitado DENTRO del iframe.
- `EDITOR-TIENDA-DESHACER-BOTONES-1` — los botones Deshacer/Rehacer de la barra (clic, no atajo)
  no se clickearon en el arnés (§ 17.6) — llaman al mismo handle que el atajo ya ejercitó.
- `CLAUDE-MD-ONCLICTARJETA-STALE-1`/`CLAUDE-MD-TIENDAPAGINAS-SELECTOR-STALE-1` — siguen vivos, sin
  relación con este slice.
- `EDITOR-TIENDA-RETIRO-1` (fila 7 de § 6) — sigue pendiente, sin relación con este slice.

### Verdict

**AWAITING_APPROVAL (`customer-bytes`)** — gate verde (typecheck 0 + 3334 + 323), `guarda:color`/
`verificar:nayoli:visual` con la MISMA cifra exacta que el drift heredado (cero píxeles nuevos),
deshacer×3/rehacer×3/4º-deshacer-no-op/publicar-todo verificados por ejecución contra una sesión
real (§ 17.6), los tres valores publicados confirmados por `psql` directo. El tema queda FUERA del
historial (§ 17.4, deviación medida — `PaletaSeccion.tsx` no está en `touches:`), nombrado como open
follow-up, no como bloqueo. Commiteado en `slice/corte-reescritura-prototipo-1`. `stopped_on:
[customer-bytes]` — `schema` y `cross-repo-contract` NO aplican. El dispatch instruyó
explícitamente parar en `AWAITING_APPROVAL` sin merge.

**Cierra `EDITOR-TIENDA-DESHACER-1`.**
