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
`/tienda/[slug]`) en un modo que lee el BORRADOR en vez de lo publicado (mecanismo nuevo, § 5.2).
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
  `generateMetadata` leyendo la cookie de sesión de edición (§ 5.2).
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
2. **El flag de activación viaja en una COOKIE, no en un query param público.** Un query param se
   copia y se comparte por accidente (un link pegado en un chat); una cookie de sesión de edición,
   con el mismo alcance/TTL que la sesión admin, no sale del navegador del dueño. Sin esa cookie, la
   ruta real se comporta EXACTAMENTE como hoy — lee lo publicado, nada cambia para un visitante.
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
| 1 | `EDITOR-TIENDA-IFRAME-GATE-1` | El gate de modo-borrador (§ 5.2): cookie de sesión de edición, chequeo de rol server-side, `no-store`+`noindex` condicional. SIN UI nueva todavía — sólo el mecanismo, verificable por curl/test de integración. | 1 (toca `app/(storefront)/layout.tsx`) | `verificar:nayoli` (bytes) da 0 diffs con la cookie AUSENTE — el tráfico público no cambia un byte |
| 2 | `EDITOR-TIENDA-IFRAME-VISTA-1` **— ENTREGADO, § 10** | El iframe reemplaza a `VistaTiendaEnVivo` dentro de `TiendaSeccionEditor`: navega a la ruta real en modo borrador, recarga tras cada guardado asentado (opción (b), § 2.b). Alcance AMPLIADO por encargo del owner: la composición lista↔iframe (no una vista por sección) y la mitad lista→iframe de la selección en contexto, § 10. | 1 (toca `app/(storefront)/page.tsx`/`nosotros/page.tsx`/`suscripciones/page.tsx`, en la lista Tier 1 — corregido otra vez, § 10) | Verificado por ejecución: `npm run gate` verde, `guarda:color` 0px (8 capturas), `verificar:nayoli`/`:visual` caracterizados contra el `main` stale (§ CIERRE-EDITOR-GATE-1) | VistaTiendaEnVivo/data-sf-tarjeta SIGUEN vivos — ver § 10, el retiro de la fila 7 queda más chico |
| 3 | `EDITOR-TIENDA-POSTMESSAGE-1` | Agrega `postMessage` para sincronizar cambios de TEXTO/imagen sin recargar el iframe — elimina el reload por tecla | 1 (el listener vive en el storefront, gateado a `useIsPreview()`) | Medido por ejecución: cero `navigation`/reload del iframe durante una sesión de tecleo, con el valor reflejado en <100ms |
| 4 | `EDITOR-TIENDA-SELECCION-1` | Selección en contexto (§ 4.1): `data-editor-seccion`, resalte, `postMessage` bidireccional panel↔iframe | 1 (el atributo nuevo vive en los componentes de `components/storefront/`, gateado a preview) | Verificado por ejecución (clic en iframe abre la sección correcta en la lista, y viceversa) |
| 5 | `EDITOR-TIENDA-DISPOSITIVOS-1` | Selector de ancho escritorio/tablet/teléfono (§ 4.3), ancho literal del iframe | 2 (sólo toca `components/admin/`) | Verificado por ejecución: clases `sm:`/`md:` activas en el DOM del iframe a 375px |
| 6 | `EDITOR-TIENDA-ORDEN-1` | Reordenar/ocultar bandas desde la lista lateral (§ 4.2): endpoint `orden` nuevo + UI de arrastre | 1 (el endpoint nuevo y `page.tsx` leen `content.orden`) | El orden que muestra el iframe tras arrastrar coincide con el que la home pública muestra tras publicar |
| 7 | `EDITOR-TIENDA-RETIRO-1` | Retira `VistaTiendaEnVivo`, `varsDeTienda`, `FragmentoTienda`/`PreviewTiendaReal`/`AmpliarOverlay`, el puente `data-sf-tarjeta`/`puente-tarjetas.ts` y `preview-colores.test.ts` (ya no hay dos pipelines que comparar) | 1 (retira código de `components/admin/` que monta `components/storefront/`) | `npm run gate` verde sin esos archivos; censo por grep confirmando cero importadores restantes |

Extender el modelo de secciones a `/tienda` y `/tienda/[slug]` (§ 4.4) **no está en este plan**: es
una decisión de producto aparte, con su propio disparador, no una consecuencia automática de tener
el iframe.

---

## 7 · Qué se retira, y cuándo

| Pieza | Se retira en | Por qué sobrevive hasta entonces |
| --- | --- | --- |
| `components/admin/VistaTiendaEnVivo.tsx` | Slice 7 | Sigue siendo la vista previa de CADA sección hasta que el iframe (slice 2) cubra las 15 |
| `lib/config/esquema-style.ts` → `varsDeTienda` | Slice 7 | Único consumidor es `VistaTiendaEnVivo`/`PaletaSeccion` — se retira junto con ambos. `esquemaStyle`/`esquemaStyleDeBanda`/`bandaEsOscura`/`tratamientoNav` (los exports que SÍ usa la página real) no se tocan |
| `components/admin/PaletaSeccion.tsx` → `FragmentoTienda`/`PreviewTiendaReal`/`AmpliarOverlay` | Slice 7 (la parte de PREVIEW); el resto del archivo (el formulario de paleta/tipografía/forma, `guardarTema`/`accionBorrador`/`resetFabrica`) se queda — sigue siendo el control que edita el tema, sólo cambia su vista previa por el iframe | El formulario no es parte del problema; sólo su vista previa sintética lo es |
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
  disparador — no se asume como parte implícita del slice 4 ni de ningún otro de los siete.
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
