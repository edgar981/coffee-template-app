# Finca San Adolfo — tienda

Sitio estático de una finca cafetera de **San Adolfo, Huila, Colombia**.
Una sola página de inicio más una página de producto. HTML + CSS + JS sin
dependencias, sin paso de build.

```bash
python3 -m http.server 4321
```

Luego abre <http://localhost:4321>.

## Estructura

```
index.html            Inicio (hero, marquee, producto, presentaciones, historia, origen, CTA, footer)
producto.html         Ficha de producto (galería, perfil de sabor, variantes, barra fija)
assets/css/tokens.css Tokens del CAFEONE Design System (copiados literales) + añadidos del sitio
assets/css/app.css    Estilos del sitio
assets/js/app.js      Chrome compartido: header, mega menú, carrito, revelados, scrub, toast
assets/js/home.js     Comportamiento del inicio
assets/js/producto.js Comportamiento de la ficha de producto
assets/ds/            Copia de los tokens originales del design system (referencia)
assets/img/           Fotografía del design system (recortes de captura — solo maqueta)
```

## Modelo de producto

**Un solo café** con dos ejes de variante:

| Eje | Valores |
| --- | --- |
| Presentación | `Molido` · `En grano` |
| Tamaño | `250 g` · `500 g` |

El precio depende solo del tamaño (`$38.000` / `$68.000` COP). Los cuatro
enlaces de "presentaciones" abren `producto.html?p=Molido|Grano&t=250|500` con
la variante preseleccionada. No hay catálogo, ni mezclas, ni bebidas.

El carrito vive en memoria y se espeja en `localStorage` cuando el entorno lo
permite (`try/catch`; en `file://` o modo privado sigue funcionando en memoria).
`FINALIZAR COMPRA` muestra un toast: **Demo — checkout no conectado**.

## Design system

Todo el color, la tipografía, los radios, la elevación y la duración de las
transiciones salen de **CAFEONE Design System.zip**. `assets/css/tokens.css` es
una concatenación literal de `tokens/*.css`; no edites esos valores a mano,
vuelve a copiarlos desde el design system.

Reglas del DS que se respetan en todo el sitio:

- Botones y chrome de interfaz **cuadrados** (`--radius-button: 0`). Nunca se redondea un botón.
- La imagen sí se redondea: tiles 20 px, fotos de contenido 16 px, miniaturas 8 px.
- Una "card" es una foto redondeada con el texto debajo sobre el fondo de página: sin borde, sin sombra, sin contenedor.
- Una sola curva de easing, `cubic-bezier(.22,.61,.36,1)`, y las duraciones 120 / 220 / 360 / 420 ms.
- Hover = baja de opacidad, subrayado de 1 px o escala de imagen 1.03. Ningún color inventado.
- Iconos: geometría de Lucide 0.454 a `stroke-width: 1.6`, en línea (sin CDN).

### Diferencias respecto al brief

El brief describía la paleta y las fuentes de memoria; el design system las
trae muestreadas al píxel. Manda el design system:

| Brief | Design system (lo que se usó) |
| --- | --- |
| `--green-deep: #1E3222` | `--green-900: #102407` |
| `--burgundy: #8E1B2A` | `--action-primary: #a70004` |
| `--canvas: #F7F3EA` | `--surface-page: #fdfbf7` |
| Bitter / Inter | Roboto Serif / Hanken Grotesk |

Dos cosas del brief **no** están en el design system y se construyeron igual
porque son decisiones de estructura, no de marca:

1. **El marco redondeado sobre fondo negro.** El tema original va a sangre completa. Aquí el lienzo flota con `--frame-gap` y `--frame-radius`; el header, el cajón del carrito y la barra fija se alinean a ese marco.
2. **El movimiento ligado al scroll** (marquee, rotación del collage, parallax, inercia de scroll). El design system dice explícitamente que el tema original no tiene parallax ni scroll-jacking. Se implementó con la curva y las duraciones del DS, y se desactiva por completo con `prefers-reduced-motion`.

El riel lateral de redes solo aparece desde 1560 px, que es el primer ancho
donde el margen libre no pisa la columna de contenido.

## Accesibilidad

- HTML semántico, `alt` en toda la imagen, `aria-*` en cajón, modal, carrusel y galería.
- Foco visible con `--focus-ring` a 2 px / offset 2 px.
- El cajón del carrito atrapa el foco y cierra con `Esc`; la galería responde a flechas.
- `prefers-reduced-motion` elimina scrub, parallax, marquee y Ken Burns; deja fundidos simples.

## Assets reales pendientes

Todo lo que hay en `assets/img/` viene del design system y son **recortes de
captura de pantalla**: sirven para maqueta, no para producción. El packshot
además lleva la etiqueta de otra finca ("Finca Bella Vista") y un resto del
tipo display del hero detrás de la bolsa.

1. `assets/img/bag-molido-250.jpg`
2. `assets/img/bag-molido-500.jpg`
3. `assets/img/bag-grano-250.jpg`
4. `assets/img/bag-grano-500.jpg`
5. `assets/img/finca-paisaje.jpg` — collage
6. `assets/img/finca-manos.jpg` — collage
7. `assets/img/finca-secado.jpg` — collage
8. `assets/img/finca-pourover.jpg` — origen
9. `assets/img/finca-beneficio.jpg` — origen
10. `assets/img/barista-strip.jpg` — franja ancha pre-footer (~2400×1200)
11. `assets/img/mapa-san-adolfo.png` — mapa estático de San Adolfo, Huila

### Video del hero — entregado

`assets/video/hero.mp4` es metraje real (macro de cerezas maduras con rocío),
recodificado desde el original de 1920×1080 / 8 s / 6,9 MB a **2,1 MB**
(H.264 high, CRF 25, `maxrate` 3500k, sin pista de audio, `+faststart` para que
empiece a reproducir sin descargar el archivo completo). El póster
`assets/img/hero-poster.jpg` (91 KB) es el primer fotograma, así que no hay
salto visible entre el póster y el arranque del video.

El Ken Burns del hero quedó solo para el fallback en imagen: el metraje real ya
trae su propio movimiento y escalarlo únicamente ablandaría un macro de 1080p.

Mientras no lleguen los cuatro mockups de bolsa, las cuatro presentaciones
comparten el mismo packshot y se distinguen por la etiqueta y por un tinte del
tile (`--surface-tile` para molido, `--cream-100` para grano).

El favicon es tipográfico y provisional: el design system no incluye logo.

## Datos de marcador de posición

Nombre de la finca, precios, altitud, variedad, hectáreas, años de tradición,
correo, teléfono, dirección, coordenadas del mapa y el umbral de envío gratis
(`$120.000 COP`) son placeholders. El umbral vive en `FREE_SHIPPING`
(`assets/js/app.js`); los precios en `PRODUCT.price`.
