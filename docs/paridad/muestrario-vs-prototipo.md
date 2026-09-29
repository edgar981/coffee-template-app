# Censo de paridad — muestrario desplegado (Café Onix, tema CORTE) vs. prototipo `docs/prototipos/cafeone/`

**Fecha:** 2026-09-29
**Rama medida:** `slice/corte-reescritura-prototipo-1`, commit `30e664ff2683a1bf92260077fc5daab614ca917b` (HEAD al momento del censo)
**Deploy medido:** `https://coffee-template-app-onix.vercel.app/` (tenant "Café Onix", catálogo real: 4 productos "Café La Ceiba" en grano/molido × 250g/500g)
**Commit del deploy:** UNKNOWN — no hay forma de leerlo desde fuera (no hay endpoint público de versión; `vercel` CLI no está instalado en esta sesión y no tengo credenciales). Se asume que el deploy sirve algo commiteado en o cerca de la rama medida, pero **no está verificado**.
**Ledger:** `CENSO-PARIDAD-MUESTRARIO-1`

Este documento **no cambia código**. Es un censo: mide, compara, clasifica. Las tres listas finales (§6) son la entrada para slices futuros, instrucciones al dueño, y preguntas de producto.

---

## 0 · Cómo se midió

- **Herramienta:** `npm run capturar:seccion -- --url https://coffee-template-app-onix.vercel.app …` (modo `--url`, § ARNES-CAPTURA-MUESTRARIO-REAL-1), invocado 8 veces (una por combinación ancho×estado de scroll). Cero Postgres efímero, cero build local — navega el deploy real.
- **Anchos:** 1440×900 (escritorio) y 390×844 (teléfono, viewport de un iPhone común).
- **Producto de la ficha:** `caf-la-ceiba--en-grano-500-g` (el primero que devuelve `/api/catalog`).
- **Selectores:** derivados leyendo el código fuente de cada componente (`Spotlight.tsx` → `#producto`, `BrandStoryCentrada.tsx` → `#nuestra-historia`, el resto por posición dentro de `<main>` vía `main > *:nth-child(N)`, medida y verificada contra el DOM real con un script de sólo lectura antes de fijar los índices — ver §0.2). Prototipo: clases/ids literales del HTML (`.site-header`, `.hero`, `.marquee`, `.spotlight`, `#presentaciones`, `#historia`, `#origen`, `.cta-strip`, `.site-footer`).

### 0.1 · Límite del método, medido — descartar antes de leer la tabla

El arnés asienta una animación **revisando la cadena de ANCESTROS del selector capturado**, nunca sus descendientes (documentado en su propio código, `esperarAsentamiento`). Tres secciones de la home (`presentaciones`/riel, `historia`, `origen`) animan su contenido con `motion.div` hijos independientes (`fadeUp`/`whileInView`) — el selector que las captura es la `<section>` que los contiene, no esos hijos. Resultado medido: las capturas "en reposo" de esas tres secciones muestran texto en `opacity` baja (visualmente atenuado/grisáceo), y el "mid-scroll" oficial del arnés sobre `header`/`main > *:first-child` (ambos re-centrados por su propio `scrollIntoView` antes de disparar) dio capturas **en blanco** o **idénticas a reposo** — dos archivos quedaron casi vacíos (`censo-home-1440-scroll-hero/app-0.png`, `censo-home-390-scroll-hero/app-0.png`, éste último de 341 bytes).

**Verificado que NO es un defecto real**: un script de sólo lectura (Playwright contra la misma URL, scroll incremental en pasos de ~100px con espera entre cada uno — imitando un scroll humano, sin tocar código del repo) mostró **opacity:1** en cabecera, collage, párrafos y tarjetas de las tres secciones una vez el scroll natural las alcanza. La cabecera sólida (`.is-solid`, tinta `#102407`) también se confirmó así — el header se OCULTA al bajar (`navTratamientoDireccion`, decisión ya tomada) y sólo reaparece sólido al subir, cosa que `scrollIntoView` no reproduce.

**Consecuencia para este censo:** las capturas primarias (`.capturas/censo-home-*-reposo/`) son la evidencia MANDATADA por el spec y se citan abajo, pero donde mostraban texto atenuado se usó además una captura de reposo natural (`.capturas/censo-natural-scroll/home-{1440,390}-fullpage.png`, página completa, scroll incremental real) para no confundir "texto que no asienta en ESTE método de captura" con "texto que falta". Ningún hallazgo de esta tabla depende de una captura con opacity < 1 sin haberla verificado contra la versión asentada.

Un segundo artefacto: el wrapper del hero (`main > *:first-child`, CORTE `hero:'sticky'`) mide 1485px de alto (1440×900) / 1393px (390×844) porque incluye todo el recorrido de scroll del efecto reveal, no sólo el viewport visible. Un screenshot de página completa (`fullPage:true`) no puede reproducir el `position:sticky` — Chromium expande el viewport a la altura del documento en una sola pasada, así que el video sólo "pinea" en los primeros ~900px y el resto del wrapper se ve como un bloque sólido del color de fondo (`--sf-tinta`). Es un artefacto del modo de captura de página completa, no algo que un visitante real vea.

Un tercer artefacto, específico del prototipo: sirviéndolo desde el server estático local del arnés, el `<video>` del hero (`assets/video/hero.mp4`) no llegó a pintar un frame dentro de la ventana de captura (~300ms) — la sección se ve con su color de fondo sólido en vez del metraje. No se investigó más a fondo (no es código nuestro); se nombra para que nadie lo lea como "el hero del prototipo es un rectángulo verde".

### 0.2 · Offsets medidos (para quien reproduzca este censo)

| banda | selector app | top (1440×900) | top (390×844) |
| --- | --- | --- | --- |
| hero | `main > *:first-child` | 0 | 0 |
| featured/spotlight | `#producto` | 1485 | 1393 |
| presentaciones | `main > *:nth-child(3)` | 2095 | 2496 |
| historia | `#nuestra-historia` | 2995 | 3336 |
| origen | `main > *:nth-child(5)` | 4495 | 5792 |
| subscriptionCTA | `main > *:nth-child(6)` | 5169 | 6680 |
| footer | `footer` | 5277 | 6852 |

`kind: measured` — script de sólo lectura, `getBoundingClientRect()+scrollY`, sin tocar código.

---

## 1 · La tabla, por sección

Columnas: **pieza** · **prototipo** (valor + archivo:línea) · **nuestro** (valor medido + componente) · **tipo** · **quién lo resuelve** · **tamaño**.

### 1.1 · Encabezado (sobre el hero, y sólido)

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Estado transparente sobre el hero | `background:transparent` (`css/app.css:172-191`), texto crema | Igual: `bg-transparent`, texto `--sf-sobre`. Capturas: `app-0.png` vs `prototipo-0.png` en `censo-home-1440-reposo/` | color | — | — (coincide) |
| Estado sólido al hacer scroll | `.is-solid` → `background:var(--surface-inverse)` (`#102407`) desde `scrollY>80` (`js/app.js`) | Igual, mismo umbral (`UMBRAL 80`, `lib/animation.ts:915`) y mismo color (`rgb(16,36,7)` = `#102407`), pero **se oculta al bajar y sólo aparece sólido al subir** (`navTratamientoDireccion`) — el prototipo lo muestra siempre que `scrollY>80`, sin ocultarse por dirección. Verificado con script de scroll natural (`.capturas/censo-natural-scroll/header-solido-1440-v2.png`) | movimiento | DECISIÓN — ya tomada (`CROMO-NAV-DIRECCION-SCROLL-1`, medida contra el tema real) | — (ya decidido, no reabrir) |
| Ítem "Nuestro café" del menú | `NUESTRO CAFÉ` (con acento, `index.html:29`) | `NUESTRO CAFE` — **sin el acento en la E**, visible en `app-0.png`/`app-1.png` de `censo-home-1440-reposo/` y en la captura de header sólido | contenido | CONTENIDO — corregir el texto del ítem de menú "tienda" a "Nuestro café" con tilde, en el panel (Configuración de menú / `MenuContent`) | chico |
| Ítems del menú | `NUESTRO CAFÉ · LA FINCA · HISTORIA · CONTACTO` (4 ítems, `index.html:26-36`) | `NUESTRO CAFE · SUSCRIPCIONES · NOSOTROS` (3 ítems) | estructura | DECISIÓN — nuestra IA de sitio es distinta (no hay páginas "La finca"/"Contacto" como anclas separadas; tenemos Suscripciones/Nosotros). Preguntar si el dueño quiere igualar la cantidad/orden de ítems o si el menú actual es el correcto | mediano |
| Selector de moneda/región | `Colombia (COP $)` con chevron (`index.html:40`) | Ausente | estructura | DECISIÓN — ¿la tienda necesita selector de moneda/región, o es innecesario para una tienda mono-moneda COP? | chico |
| Ícono de cuenta | Ícono de usuario junto al buscador (`index.html:47`) | Ausente (sólo buscar + carrito + Comprar) | estructura | DECISIÓN — ¿existe (o se planea) una cuenta de cliente navegable desde el header? Si no, el ícono del prototipo no aplica | chico |
| Botón "Comprar" | Sólido rojo, último elemento antes del buscador (`index.html:51`, dentro de `.header-actions`) | Presente, mismo lugar relativo (tras el nav, antes de buscar/carrito) — coincide en posición y color | estructura/color | — | — (coincide) |
| Cabecera en teléfono | Sin buscador (`.hide-sm`), sólo carrito + hamburguesa; subtítulo del wordmark ausente a este ancho | Sí trae buscador + carrito + hamburguesa (3 íconos) y conserva el subtítulo "SAN ADOLFO · HUILA" | estructura | DECISIÓN — ¿el buscador debe ocultarse en móvil como en el prototipo, o se prefiere mantenerlo? | chico |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-0.png`, `.capturas/censo-home-390-reposo/{app,prototipo}-0.png`, `.capturas/censo-natural-scroll/header-solido-1440-v2.png` (estado sólido real, reemplaza a `censo-home-1440-scroll-hero/app-0.png`, que salió en blanco — §0.1).

### 1.2 · Hero + marquee

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Estructura | DOS secciones separadas: `.hero` (`index.html:123-139`) y `.marquee` (`index.html:142-157`) debajo | UNA sola sección (`hero: 'sticky'`, `HeroMediaMarquesina.tsx`): el texto y el pin del marquee viven DENTRO del hero pineado | estructura | DECISIÓN — ya tomada y documentada (`CORTE-USA-HERO-STICKY-1`, themes.ts:929-937: "el owner reportó TRES veces que el marquee debe ir SOBRE el hero, no debajo") | — (ya decidido, no reabrir) |
| Frase del hero | `"Hay algo profundamente meditativo en preparar un café cultivado a 1.600 msnm."` (`index.html:134-136`) | Texto **idéntico**, mismo dato (`content.hero.subtitulo` o equivalente) | contenido | — | — (coincide) |
| Cue "Desliza" | `.scroll-cue` con línea + "Desliza" (`index.html:137`) | Presente, mismo texto y posición inferior-izquierda | estructura/contenido | — | — (coincide) |
| Ticker horizontal | Texto en loop continuo por TIEMPO (`js/app.js`, `.marquee-track`) | Igual mecanismo (`heroTickerVelocidad:'lenta'`); una captura estática lo agarra en cualquier punto de su recorrido — el texto "Calidad que se…" se ve cortado en ambos bordes del viewport en la captura, que es lo ESPERADO de un ticker en movimiento, no un overflow roto | movimiento | — (esperado, no es hallazgo) | — |
| Tarjeta flotante del marquee | `.marquee-card` con imagen de bolsa (`index.html:154-156`) | `marquesina.productoSlug` está VACÍO en el contenido actual → `productoMarquesina` devuelve `null` → la tarjeta no se muestra (hide-on-empty, `HERO-SIN-TARJETA-Y-PDP-IMAGEN-1`) | contenido | CONTENIDO — pinear un producto en `marquesina.productoSlug` desde `/admin/tienda` si se quiere la tarjeta flotante | mediano |
| Botones del hero | Ninguno (`.hero-media` sin `.btn`, `index.html:122-139`) | Ninguno (`heroCtasVisibles:false`) | estructura | — | — (coincide, ya decidido) |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-1.png` (hero) y `-2.png` (marquee, contra el mismo `app-2.png` del hero por la fusión estructural), y sus pares en `censo-home-390-reposo/`.

### 1.3 · «Nuestro café» (Spotlight)

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Estructura/layout | Grid 3 columnas: título · imagen con flechas · compra (`index.html:160-223`) | Coincide (re-medido en `NUESTRO-CAFE-COMO-MUESTRARIO-1`, slice previo — no re-abierto acá) | estructura | — (ya cerrado) | — |
| Eyebrow "Nuestro café" | `NUESTRO CAFÉ` (`index.html:165`) | `content.spotlight.eyebrow` vacío → no se muestra | contenido | CONTENIDO — llenar `spotlight.eyebrow` en `/admin/tienda` | chico |
| Título | `"Un solo origen, cuidado de principio a fin."` (`index.html:166`) | `content.spotlight.titulo` vacío → no se muestra | contenido | CONTENIDO — llenar `spotlight.titulo` | mediano |
| Badge "Cosecha 2026" | Presente sobre la imagen (`index.html:171`) | `content.spotlight.badge` vacío → no se muestra | contenido | CONTENIDO — llenar `spotlight.badge` (o dejarlo vacío a propósito) | chico |
| Notas de cata | `Panela · Frutos rojos · Chocolate` (`index.html:190-192`) | El producto pineado (`Café La Ceiba — En grano 500 g`) no trae `notasCata` → los chips no se muestran | contenido | CONTENIDO — completar `notasCata` del producto en `/admin/productos` | chico |
| Precio, molienda, botón | `$38.000`, selector Molido/En grano, `AGREGAR AL CARRITO` rojo sólido (`index.html:211-218`) | `$ 35.000`, selector de molienda (una sola opción disponible: "Grano entero"), botón rojo sólido `Agregar al carrito` | color/contenido | — (coincide en tratamiento; precio distinto es dato real, no defecto) | — |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-3.png`, `.capturas/censo-home-390-reposo/{app,prototipo}-3.png`.

### 1.4 · «Elige tu presentación» (riel)

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Cantidad de tarjetas | 4 fijas (Molido 250/500, En grano 250/500) codificadas en el prototipo | 2 configuradas (`presentaciones.label1/2`, slots 3-4 vacíos = opcionales sin llenar) — el modelo soporta 2-4 (`tarjetasDePresentaciones`), no es un tope de código | contenido/estructura | CONTENIDO — si se quieren 4 tarjetas como el prototipo, completar `label3/copy3/imagen3/categoria3` y `label4/…4` en `/admin/tienda`; si 2 es la decisión, no hay nada que hacer | mediano |
| Imágenes de las tarjetas | Mockup de bolsa por tarjeta (`index.html:70-73`, vía `home.js`) | `imagen1`/`imagen2` están VACÍAS → placeholder (`--sf-linea`) en las 2 tarjetas configuradas | contenido | CONTENIDO — subir imagen para cada tarjeta de presentación en `/admin/tienda` | grande (visible de entrada, sin imagen la sección se ve rota) |
| Categoría de destino de cada tarjeta | Implícita en el link a `producto.html?p=…` | `categoria1="Clásico"`, `categoria2="Especial"` — **ninguna de las dos existe en el catálogo real** (las categorías reales son "Café en Grano"/"Café Molido", medido vía `/api/catalog`). Clic en cualquiera de las 2 tarjetas hoy filtra a una categoría vacía — el "aviso de destino rancio" del editor (`§ Destino rancio → AVISO en el editor`, CLAUDE.md) debería estar mostrando esto en `/admin/tienda` | contenido | CONTENIDO — cambiar `categoria1`/`categoria2` a `"Café en Grano"`/`"Café Molido"` (o crear productos en las categorías "Clásico"/"Especial" si esas son las reales) | grande (rompe el flujo de compra: la tarjeta no lleva a ningún producto) |
| Título/eyebrow | `"Nuestro café. 4 presentaciones."` / `"Más de una forma de disfrutarlo"` (`index.html:230-231`) | `"¿Cómo lo prefieres?"` / `"Elige tu presentación"` — contenido propio, coincide en TRATAMIENTO (tipografía, tamaño, posición) | contenido | — (dato de tenant, no defecto) | — |
| Movimiento (riel horizontal + reveal de tarjetas) | — | Se asienta correctamente con scroll real (§0.1); en la captura de reposo estándar (scroll instantáneo del arnés) el texto de la cabecera y de las tarjetas puede verse atenuado — NO es un defecto del sitio | movimiento | — (artefacto del método, no hallazgo) | — |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-4.png`, mid-scroll (cabecera ya asentada, tarjeta aún atenuada) en `.capturas/censo-home-1440-scroll-riel/app-0.png`, `.capturas/censo-home-390-reposo/{app,prototipo}-4.png`.

### 1.5 · Historia

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Composición | Eyebrow+título centrados, collage a lo ancho, párrafo debajo (`.historia`, `index.html:250-273`) | Igual (`brandStory:'centrada'`, `CORTE-BRANDSTORY-COLLAGE-1`) | estructura | — (ya decidido) | — |
| Cantidad de fotos del collage | **3** figuras (`index.html:257-261`) | **4** fotos (`imagen1..4` de `BrandStoryCentrada`) | estructura | DECISIÓN — nuestro modelo trae 4 slots fijos; ¿se prefiere igualar a 3 o dejar 4 como capacidad propia? | chico |
| Texto | Historia de la finca San Adolfo, propia del prototipo (`index.html:265-269`) | `"Empezamos con una idea simple…"` — copy propio del tenant, coincide en tratamiento tipográfico | contenido | — (dato de tenant) | — |
| CTA | `"Nuestra historia"` → `#origen` (`index.html:270`) | Presente, mismo tratamiento (botón `btn--primary`) | estructura | — (coincide) | — |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-5.png`; asentado completo (natural scroll) en `.capturas/censo-natural-scroll/home-1440-fullpage.png` (banda "Detrás de cada pedido") y `prototipo-1440-fullpage.png` (banda "Nacido de la tradición").

### 1.6 · Origen

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Estructura | 2 fotos + copy a la derecha + 4 pares dato (`dl.spec-list`) + 3 contadores animados (`index.html:276-310`) | **Misma estructura, capacidad completa**: `Origen.tsx` tiene `datosDeOrigen` (4 pares `datoNLabel/datoNValor`) y `statsDeOrigen` (3 `statNumeroN/statEtiquetaN`), ambos hide-on-empty | estructura | — (código ya soporta paridad total) | — |
| Fotos | 2 fotos de finca (`index.html:281-283`) | 2 fotos presentes, cargan bien (cerezas + manos con canasta) | contenido | — (coincide) | — |
| Título/párrafo | `"Cultivado a mano en las montañas de San Adolfo, Huila."` + lede | `"Detrás de cada producto hay un origen real"` + párrafo propio — coincide en tratamiento | contenido | — (dato de tenant) | — |
| Lista de datos (Altitud/Variedad/Proceso/Cosecha) | 4 pares presentes (`index.html:296-299`) | `dato1Label..dato4Valor` están VACÍOS → la lista entera no se muestra (hide-on-empty) | contenido | CONTENIDO — llenar los 4 pares en `/admin/tienda` (p. ej. Altitud/Variedad/Proceso/Cosecha, o los que apliquen al tenant) | grande (la sección se ve incompleta sin este bloque) |
| Contadores (msnm/hectáreas/años) | `1.600 / 12 / 52` con animación de conteo (`index.html:304-308`) | `statNumero1..statEtiqueta3` vacíos → los 3 contadores no se muestran | contenido | CONTENIDO — llenar los 3 pares número/etiqueta en `/admin/tienda` | grande (mismo motivo) |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-6.png`; confirmación por DOM (`innerText` del nodo) de que hoy sólo el eyebrow/título/párrafo rinden texto, sin stats — medido por script de sólo lectura, no por lectura de imagen.

### 1.7 · Franja de suscripción

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Composición | `.cta-strip`: foto a sangre completa + degradado + 2 botones (`"Únete al club"` / `"Explorar"`, `index.html:313-320`) | `subscriptionCTA:'linea'`: franja de una línea, sin foto — eyebrow + título + 1 botón (`"Ver los planes"`) | estructura | DECISIÓN — ya evaluada y decidida en `themes.ts` (`§ subscriptionCTA·linea`, "se consideró 'oscuro' por posición y se descartó… se prefiere la lectura conservadora"). No reabrir sin nuevo dato | — (ya decidido) |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-7.png`.

### 1.8 · Pie

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Watermark "FINCA SAN ADOLFO" | `.footer-mark`, texto gigante detrás del bloque superior (`index.html:325`) | Ausente — no hay elemento equivalente en `StoreFooter.tsx` | estructura | CÓDIGO — no se encontró doctrina que excluya esto a propósito; candidato a slice de footer si el dueño lo quiere | mediano |
| Newsletter (email + checkbox) | Presente (`index.html:331-343`) | Ausente — **ya decidido**: `page.tsx` trae el import comentado `"v1: Newsletter hidden — restore import when the newsletter feature ships"` | estructura | DECISIÓN — ya tomada (v1, feature diferida), no reabrir | — (ya decidido) |
| Tarjeta de mapa | SVG con pin "San Adolfo" + coordenadas (`index.html:348-362`) | Ausente | estructura | CÓDIGO/DECISIÓN — no hay doctrina que lo mencione; preguntar si vale la pena para el modelo de negocio (no hay tienda física visitable) antes de construirlo | mediano |
| Columnas | Tienda · Nosotros · Escríbenos (3 cols, con Instagram/Facebook/WhatsApp/Contacto en "Nosotros" y correo/teléfono/dirección en "Escríbenos") | Tienda · Ayuda · Empresa (3 cols: Todos los productos/Suscripciones · Rastrear Pedido · Nuestra Historia+WhatsApp) | estructura/contenido | — (nuestra IA de footer es la real del sitio, coincide en FORMA — 3 columnas, encabezados en mayúscula) | — |
| Color/tipografía | `--surface-inverse` de fondo, texto crema | Igual: `bg-[var(--sf-tinta)]`, texto `--sf-sobre` | color | — | — (coincide) |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-8.png`.

### 1.9 · Ficha de producto completa

| pieza | prototipo | nuestro | tipo | quién | tamaño |
| --- | --- | --- | --- | --- | --- |
| Galería + buybox | Grid 2 columnas, galería con flechas + dots, buybox a la derecha (`index.html:126-214` de `producto.html`) | Coincide en forma (galería + miniaturas, buybox a la derecha) | estructura | — | — (coincide) |
| **Botones "Agregar al carrito" / "Comprar ahora" — color y jerarquía INVERTIDOS** | `AGREGAR AL CARRITO` = outline (fondo transparente, borde y texto rojo `--action-primary`); `COMPRAR AHORA` = sólido rojo (primario) | `Agregar al carrito` = sólido **verde tinta** (`#102407`, texto blanco); `Comprar ahora` = outline con borde **rojo** (`#a70004`) pero texto tinta — medido: `bg rgb(16,36,7)` vs `bg rgba(0,0,0,0) border 2px rgb(167,0,4)` | color | CÓDIGO — invertir la jerarquía visual: "Agregar al carrito" debería ser la acción secundaria (outline, acento) y "Comprar ahora" la primaria (sólida, acento) — o al menos alinear con el propio Spotlight de la home, que SÍ usa rojo sólido para "Agregar al carrito" (ver fila siguiente) | grande — visible en cada visita a un producto, y contradice el propio patrón de la home |
| **Inconsistencia interna**: mismo texto de botón, dos colores distintos en el mismo sitio | — | Spotlight (home) "Agregar al carrito" = rojo sólido (`rgb(167,0,4)`); PDP "Agregar al carrito" = verde tinta sólido (`rgb(16,36,7)`) — mismo label, dos tratamientos | color | CÓDIGO — unificar el color del botón "Agregar al carrito" entre Spotlight y la ficha de producto | grande |
| Perfil de sabor (barras Dulzura/Amargor/Acidez) | Presente, 3 barras con % (`index.html:157-171`) | **Ausente por completo** — no hay componente ni campo de datos para esto en la ficha (`grep` de "Dulzura/Amargor/flavour" en la página: cero resultados) | estructura | CÓDIGO — capacidad nueva, no existe hoy; es una decisión de alcance, no un bug (evaluar si se construye) | mediano-grande |
| Lista de especificación (Altitud/Variedad/Proceso) | Presente, `dl.spec-list` (`index.html:204-209`) | El código SÍ tiene chips condicionales (`Chip label="Proceso"`, `"Altitud"`, `"Variedad"`, `"Tostión"` — `page.tsx:266-274`), pero el producto capturado no trae esos campos → no se muestran | contenido | CONTENIDO — completar `proceso`/`variedad`/`altitudMin`/`altitudMax`/`tostado` del producto en `/admin/productos` | mediano |
| Notas de cata | Vía descripción/perfil, no como chips en `producto.html` | `notasCata` del producto → vacío, no se muestra ninguna nota | contenido | CONTENIDO — llenar `notasCata` en `/admin/productos` (mismo dato que Spotlight, § 1.3) | chico |
| Sección "Origen" tras el buybox | `.section.historia#origen` con 2 fotos + copy + 3 stats, ANTES del footer (`producto.html:216-244`) | Ausente — la ficha va directo de "También te puede gustar" al footer | estructura | DECISIÓN — ¿la ficha de producto debería repetir la banda de origen (como el prototipo), o es redundante con la home/`/nosotros`? | mediano |
| "También te puede gustar" (relacionados) | No existe en el prototipo | Presente (3 productos relacionados) | estructura | — (capacidad NUESTRA que el prototipo no tiene; no es una brecha, es un plus — informativo) | — |
| Envío/garantía/tostado (3 líneas con íconos) | No hay equivalente exacto en el prototipo | Presente: "Envío a todo Colombia · Gratis +$150.000", "Garantía de frescura de 30 días", "Tostado dentro de los 7 días previos al envío" | contenido | — (plus nuestro, sin contraparte que comparar) | — |
| Migas de pan | `Inicio · Nuestro café · [Producto]` (`producto.html:124`) | `Inicio / Tienda / [Producto]` — mismo patrón, wording distinto por IA propia | contenido | — (coincide en forma) | — |

Capturas: `.capturas/censo-home-1440-reposo/{app,prototipo}-9.png`, `.capturas/censo-home-390-reposo/{app,prototipo}-9.png`.

---

## 2 · Lo que NO se pudo comparar / quedó fuera

- **Video del hero (prototipo):** no renderizó un frame en la ventana de captura del arnés contra el server local — no es código nuestro, no se investigó más.
- **`.cta-strip` con foto real:** el prototipo usa una imagen de stock que no cargó en la captura local (mismo servidor estático); no afecta la comparación estructural ya hecha en §1.7 (decisión ya tomada, no depende de la foto).
- **Espaciado pixel a pixel:** este censo midió estructura/tipografía/color/contenido/movimiento con precisión (selectores CSS, `getComputedStyle`); NO midió cada margen/padding en px por sección — el volumen habría sido desproporcionado para un censo de una sola pasada. Si algún hallazgo de espaciado importa, es candidato a un capturar-seccion puntual con `--estilo-elemento` sobre el nodo exacto.
- **Interacción real** (clic en flechas del riel, cambio de molienda, apertura del carrito, mega-menú desplegado): fuera de alcance — este censo es visual/estático, no un test de interacción.

---

## 3 · Deviations del spec

| prompt dijo | medido | qué se hizo |
| --- | --- | --- |
| "una en mitad del recorrido" para hero/historia/riel, vía `--scroll` del arnés | El propio arnés re-centra el selector capturado con `scrollIntoView(block:'center')` DESPUÉS de aplicar `--scroll`, así que la posición pedida se pierde para el selector que se está fotografiando (confirmado: la captura mid-scroll del hero salió indistinguible de la de reposo, y la del header salió en blanco) | Se usó un script de sólo lectura con scroll incremental real (mismo navegador Playwright ya instalado, sin tocar código) como evidencia SUPLEMENTARIA para las 3 secciones con movimiento, dejando también la captura oficial del arnés citada (con su limitación documentada en §0.1) |

---

## 4 · Gate

```
npm test
```
`2488/2488` verde, `0` fallos, `7.1s`. Corrido sobre el HEAD de la rama (`30e664f`), sin cambios de código en este slice — sólo se agregó este documento y el asiento en `DECISIONS.md`.

---

## 5 · Capturas — índice completo

Todas bajo `.capturas/` (gitignored, no se commitean):

| carpeta | qué contiene |
| --- | --- |
| `censo-home-1440-reposo/` | 10 pares (header, hero, marquee, spotlight, riel, historia, origen, suscripción, footer, PDP) a 1440×900, reposo |
| `censo-home-390-reposo/` | mismos 10 pares a 390×844 |
| `censo-home-1440-scroll-hero/` | header + hero a 1440×900, `--scroll 700` (header salió en blanco — ver §0.1) |
| `censo-home-390-scroll-hero/` | ídem a 390×844, `--scroll 600` (header salió casi vacío, 341 bytes — ver §0.1) |
| `censo-home-1440-scroll-riel/` | riel a 1440×900, `--scroll 1400` (cabecera asentada, tarjeta aún atenuada) |
| `censo-home-390-scroll-riel/` | ídem a 390×844, `--scroll 1850` |
| `censo-home-1440-scroll-historia/` | historia a 1440×900, `--scroll 2300` |
| `censo-home-390-scroll-historia/` | ídem a 390×844, `--scroll 2700` |
| `censo-natural-scroll/` | evidencia suplementaria de sólo lectura: `home-1440-fullpage.png`, `home-390-fullpage.png`, `prototipo-1440-fullpage.png` (scroll incremental real, todo asentado), `header-solido-1440-v2.png` |

---

## 6 · Las tres listas

### 6.1 · CÓDIGO (agrupado en slices propuestos, mayor a menor impacto visible)

1. **PDP-BOTONES-JERARQUIA-1** — invertir color/jerarquía de "Agregar al carrito" (→ outline/acento) y "Comprar ahora" (→ sólido/acento) en la ficha de producto, y unificar el color de "Agregar al carrito" con el que ya usa Spotlight en la home (rojo sólido). Dos botones, un componente (`app/(storefront)/tienda/[slug]/page.tsx`). **Impacto: grande** — se ve en cada visita a cada producto.
2. **PDP-PERFIL-SABOR-1** — evaluar si se construye la capacidad "Perfil de sabor" (barras Dulzura/Amargor/Acidez con %) que el prototipo tiene y la ficha hoy no. Es capacidad NUEVA (modelo de datos + UI), no un fix. **Impacto: mediano-grande.**
3. **FOOTER-WATERMARK-MAPA-1** — evaluar si se agrega el watermark tipográfico grande del footer y/o la tarjeta de mapa/ubicación. No se encontró doctrina que los excluya a propósito (a diferencia del newsletter, que SÍ está decidido). **Impacto: mediano.**

### 6.2 · CONTENIDO (instrucciones para el dueño, en `/admin/tienda` y `/admin/productos` salvo que se diga otra cosa)

1. **Presentaciones (riel):** subir imagen para las tarjetas 1 y 2 (`imagen1`/`imagen2` vacías — hoy se ven como un rectángulo de color sin foto). **Prioridad alta.**
2. **Presentaciones (riel):** corregir `categoria1`/`categoria2` — hoy dicen `"Clásico"`/`"Especial"`, que no existen en el catálogo (las categorías reales son "Café en Grano"/"Café Molido"). Como están, las tarjetas no llevan a ningún producto al hacer clic. **Prioridad alta — rompe el flujo de compra.**
3. **Origen:** llenar los 4 pares de datos (`dato1Label/Valor` … `dato4Label/Valor`, p. ej. Altitud/Variedad/Proceso/Cosecha) y los 3 contadores (`statNumero1/Etiqueta1` … `statNumero3/Etiqueta3`, p. ej. msnm/hectáreas/años). Hoy la sección se ve incompleta — sólo el título y el párrafo rinden.
4. **Spotlight ("Nuestro café"):** llenar `eyebrow`, `titulo` y `badge` (hoy vacíos, la banda pierde tres piezas visibles).
5. **Producto(s):** completar `notasCata`, `proceso`, `variedad`, `altitudMin`/`altitudMax`, `tostado` en el catálogo — hoy ninguno de los chips de ficha se muestra porque el dato de origen del producto está vacío.
6. **Menú:** corregir el ítem "Nuestro café" — hoy renderiza sin la tilde ("NUESTRO CAFE").
7. **Hero (opcional):** si se quiere la tarjeta flotante del marquee, pinear un producto en `marquesina.productoSlug`.

### 6.3 · DECISIÓN (pregunta explícita, una por fila)

| # | pregunta | opciones medidas |
| --- | --- | --- |
| 1 | ¿El header debe mostrar selector de moneda/región ("Colombia (COP $)") como el prototipo? | (a) agregarlo — costo: nueva UI, sin necesidad funcional si la tienda es mono-moneda; (b) dejarlo fuera — ya es la situación actual, cero costo |
| 2 | ¿El header debe tener un ícono de cuenta de cliente navegable? | (a) agregarlo — requiere que exista una superficie de cuenta a la que apunte; (b) dejarlo fuera — es la situación actual |
| 3 | ¿Los ítems del menú principal deben igualar la cantidad/orden del prototipo (4 ítems: café/finca/historia/contacto)? | (a) sí, redefinir el menú; (b) no, el menú actual (café/suscripciones/nosotros) ya refleja la IA real del sitio |
| 4 | ¿El buscador debe ocultarse en móvil como en el prototipo? | (a) ocultarlo bajo cierto ancho; (b) mantenerlo siempre, como hoy |
| 5 | ¿El collage de Historia debe tener 3 fotos (como el prototipo) o mantener 4 (capacidad actual)? | (a) recortar a 3, tocando `BrandStoryCentrada`; (b) dejar 4 — es más capacidad, no menos |
| 6 | ¿La ficha de producto debe repetir la banda de Origen (2 fotos + copy + stats) antes del footer, como el prototipo? | (a) agregarla — duplica contenido que ya vive en la home/`/nosotros`; (b) no — la ficha se queda enfocada en el producto |

---

## 7 · Nota de método — comparación con el censo del slice previo

`NUESTRO-CAFE-COMO-MUESTRARIO-1` (observed-report de este slice) ya había re-medido `Spotlight.tsx` contra `.spotlight` del prototipo usando `--sembrar-spotlight` sobre una base efímera con dos productos sintéticos. Este censo **no repite esa medición de estructura/tipografía/color de Spotlight** (ya está cerrada, §1.3 sólo agrega lo que esa tanda no pudo ver: el contenido REAL del tenant, que resultó tener 4 campos vacíos que la base sintética de aquel slice no tenía cómo mostrar vacíos — sembraba su propio `content.spotlight` completo).
