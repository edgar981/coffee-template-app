# Procedencia de los logos de redes de tarjeta

Este archivo existe por la misma razón que `public/images/PROCEDENCIA.md`, pero para una
clase de archivo distinta: estos son **logos de marcas registradas de terceros** (las
redes de tarjeta que `lib/checkout/tarjeta.ts` detecta), no fotos de stock. La condición
de origen la puso el owner (`CHECKOUT-LOGOS-REDES-1`, 2026-09-18, tercera vez que se
repite tras `CHECKOUT-DETECCION-EMISOR-BIN-1` y `CHECKOUT-ICONO-TARJETA-NEUTRO-1`): sólo
entran archivos bajados **directo del portal de marca OFICIAL de cada red**, nunca de un
buscador de íconos, un paquete de terceros ni un redibujo a mano. **Ninguna imagen de
este directorio se optimizó ni se convirtió de formato** — el archivo tal como lo entregó
el portal es el que está acá.

No es `public/brand/` (eso es la marca de Duna) ni `public/images/` (fotos de stock con
licencia Unsplash): las marcas de red de tarjeta son su propia categoría, con sus propias
reglas de uso, y merecen su propio registro de procedencia.

## Obtenidos (CHECKOUT-LOGOS-REDES-1, intento del 2026-09-18)

| archivo | red | fuente oficial | bajado | qué pidió el portal |
| --- | --- | --- | --- | --- |
| `mastercard-symbol-v1.svg` | Mastercard | `https://www.mastercard.com/content/dam/brandcenter/assets/downloads/mc_symbol_SVG.zip` (enlazado desde `https://www.mastercard.com/brandcenter/us/en/download-artwork.html`, el Mastercard Brand Center oficial) | 2026-09-18 | **Nada.** `GET` directo al `.zip` devuelve 200 sin sesión, sin login y sin ningún paso de aceptación interactivo — sólo el aviso pasivo de la propia página ("by downloading artwork from this page, you agree to the Mastercard Artwork Download Agreement"), que no bloquea la descarga. El zip trae `Mastercard Symbol - SVG/Artwork/ma_symbol.svg`; se copió tal cual, sin tocar un solo byte. Los tres colores del symbol (`#EB001B`, `#F79E1B`, `#FF5F00`) coinciden con los oficiales de la marca. |

## No obtenidos — con lo que bloqueó cada uno

| red | qué se intentó | qué devolvió el intento |
| --- | --- | --- |
| **Visa** | `https://brandcenter.visa.com/` (el Visa Brand Center, la fuente esperada) — DNS. Después `https://brand.visa.com/` — DNS resuelve pero la conexión falla. Después `https://partner.visa.com/` — sí carga, pero es el "Visa Partner" (programa fintech, `Visa Licensing Program`/`Visa Ready`), un portal DISTINTO del brand center, con `Sign In` obligatorio (`clientlib-loginStatusIDP.js`) y sin un solo enlace a marca/logo en su navegación. Se revisó además la portada de `visa.com`/`visa.com.co` buscando un enlace público a guías de marca: ninguno. | `brandcenter.visa.com` → `ENOTFOUND` (no resuelve). `brand.visa.com` → resuelve en DNS pero `fetch failed` al conectar. `partner.visa.com` → 200, pero es un portal de partners con login, no el brand center. **No se encontró ninguna vía pública al logo oficial de Visa desde este entorno.** |
| **American Express** | El único portal de marca localizable es `network.americanexpress.com` (American Express Global Network), enlazado desde el footer de `americanexpress.com` ("Global Network"). Se revisó también el newsroom (`/en-us/newsroom/`) y la página de comercios (`/us/merchant/accept-the-card.html`) buscando un press-kit o logo público. | `network.americanexpress.com/globalnetwork/v4` → 200, pero su navegación sólo ofrece `Login` (`https://www.americanexpress.com/en-us/account/enterprise/login?target=…/secure/`) — el contenido de marca vive DETRÁS de esa sesión de empresa. El newsroom y la página de comercios no traen logo descargable. **Requiere cuenta de socio/comercio (login), no accesible sin registrarse.** |
| **Diners Club** | `https://www.dinersclub.com/about-us/press/` (la página de prensa de Diners Club, dueño hoy Discover Global Network) enlaza `.../static/zip/about-us/press/2026_Media_Kit_Logos.zip`. Se bajó — sin login, sin gate. | 200, descarga directa, **175→2.545.316 bytes, contenido real**: `DCI_logo_color.eps`, `DCI_logo_black.eps` y los "Acceptance Mark" de Diners Club/Discover Network. **El bloqueo NO es de acceso — es de FORMATO**: el kit sólo trae `.eps`, que ningún navegador renderiza en un `<img>` ni un componente React puede mostrar sin CONVERTIRLO a SVG/PNG — y este slice tiene prohibido convertir formato (§0/§3 del spec). Se dejó fuera por esa razón, no por no poder llegar a la fuente. |
| **UnionPay** | `https://www.unionpayintl.com/en/mediaCenter/brandCenter/artworkDownloadCenter/identification.shtml` (el Artwork Download Center oficial de UnionPay International) sí ofrece "Brand logo (for general purpose and E-Commerce checkout)" y "The UnionPay primary English logo" en RGB. | El botón de descarga de esa página no es un enlace directo: dispara un modal JS (`content-en.js`, clase `agr-popup`) con el texto *"Download Artwork Agreement — Please review the statement below… To complete your download, you must agree to the above"* y dos botones, **"I agree" / "Cancel"** — un paso de aceptación de términos explícito e interactivo, no un aviso pasivo como el de Mastercard. Es exactamente el caso que el spec de este slice nombra para dejar afuera y reportar ("exige aceptar términos"), así que no se hizo click-through ni se buscó la URL final que ese botón dispara. |

## El desempate de dos spikes anteriores

Dos mediciones previas de este programa se contradecían: una decía *"Visa: descarga
directa · Mastercard: exige aceptación del lado del cliente"*; la otra, *"Visa: exige
registro · Mastercard: directa"*. **Esta corrida desmiente la primera y es consistente
con la segunda, al menos del lado de Mastercard**, que se pudo medir de forma
concluyente: la descarga del `.zip` oficial de Mastercard no exige NINGÚN paso de
aceptación del lado del cliente — es un `GET` plano que responde 200. Del lado de Visa,
esta corrida no llegó a confirmar específicamente "exige registro" (no se encontró
siquiera la página de descarga), pero sí descarta "descarga directa": no hay ningún URL
de Visa que haya devuelto un logo sin pasar por un portal con `Sign In` o que
simplemente no resolviera.

## Regla de mantenimiento

Igual que `public/images/PROCEDENCIA.md`: este archivo se actualiza al agregar,
reemplazar o (si el owner baja alguno de los que faltan) sumar cualquier logo de este
directorio.
