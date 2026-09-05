# TRASPASO.md — contexto vivo del rediseño Duna OS

**Actualizado:** 2026-09-04 (**EDITOR VISUAL #46, FASE 1 CERRADA — el PUENTE vista→formulario.** Clic en una tarjeta
de la vista previa → scroll + resalte de su grupo "Tarjeta N" en el formulario, SÓLO Presentaciones. Ataca el dolor
LITERAL ("no se ve cuál campo es cuál") SIN la in-situ real —descartada por la ESCALA: a paneW/1280 (~0.30–0.44 a los
anchos comunes) un título de 30px se ve a 9–13px, ilegible, y no hay precedente de contentEditable—. **Mapeo por SLOT,
no por posición** (slot 4 lleno con el 3 vacío = 3ª tarjeta visible; `tarjetasDePresentaciones` PRESERVA el slot,
`grupoDeTarjeta` mapea desde el descriptor, capa 1 incluida la prueba de relleno fuera de orden). El marcador en
GrindChooser es un `data-sf-tarjeta` INERTE gated en `useIsPreview` → en la tienda del visitante NO existe
(**byte-idéntico, verificado por ejecución: 0 apariciones**). Convive con los enlaces inertes de EscalaDesktop por
ESTRUCTURA del DOM (captura en un ancestro `.puente-tarjetas` display:contents, SIN stopPropagation), no por timing.
**Colapso de grupos opcionales vacíos DERIVA de los datos** ("+ Agregar N tarjeta"; el componente no se desmonta al
cerrar la edición → reset explícito en abrir/cerrar; invariante puente↔colapso afirmado en capa 1). Los 3 defectos del
gate: "(opcional)" fuera de los títulos; resalte del grupo activo SIN artefacto —el "esto está puesto" asume una CAJA,
sobre un DIVISOR → wash-active + barra + borde transparente, sin radius—; y copy del CategoriaCombobox con UNA fuente
("Elige una categoría", antes divergía por override vs default). Pulido Duna: encabezados de grupo al patrón de
subsección del panel (`duna-field__label`); censo confirmó que el editor YA estaba sobre primitivas Duna. capa 1
**828/828** · tsc + next build verde · **storefront byte-idéntico**. Gate del owner PASADO, mergeada a `main`
`--no-ff` (`cc6c04e`), rama borrada. **Fase 2 (campo flotante para el TEXTO) al backlog #46**; placeholder de imagen
vacía al **#66** (entra cuando la Fase 2 toque la cáscara compartida). **NO quedan pasos manuales abiertos.**)

**ANTES — CHECKOUT: scroll al cambiar de paso + MÉTODOS DE PAGO config CERRADA.** (1) Los pasos
del checkout son estado en una página; al Continuar/Atrás la vista mantenía la posición del paso anterior → `useEffect`
sobre `[step]` → `window.scrollTo top:0`, `behavior` según prefers-reduced-motion. (2) Los 4 métodos (nequi, daviplata,
transferencia, efectivo) son DATO del tenant: 4 booleanos `pago*Activo` (default true) + `pagoMovilNumero`, en
SiteSetting. Un método se muestra con toggle ON *y* datos completos (`metodosDisponibles`, capa 1); mínimo uno ON
(refine del schema) + guarda defensiva en el checkout ("escríbenos para coordinar el pago"). **`pagoMovilNumero` es
campo PROPIO sin fallback a whatsapp** —el fallback perpetuaba la conflación contacto↔pago—; la migración lo
BACKFILLEA desde whatsapp una vez (Nayoli igual, datos separados desde el día 1). Un método ON sin datos se declara en
el editor ("Encendido — falta configurarlo"). Encender/apagar NO toca el eje de Pagos (derivarCondicionPago es
string-check de EFECTIVO, metodo_pago string libre); el enum MetodoPago del admin "Nuevo pedido" es otra superficie,
fuera de alcance. Migración ADITIVA + backfill. capa 1 **821/821** · tsc + next build verde. Gate del owner PASADO,
mergeada `--no-ff`. **NO quedan pasos manuales abiertos** (el dato de C3 en prod ya lo hizo el owner).

**ANTES — CUENTA BANCARIA config + RATING borrado.** Dos defectos reales que el censo de
avisos destapó, más urgentes que la tanda que los destapó. (1) El checkout mostraba una cuenta Bancolombia HARDCODEADA
falsa en la ruta del dinero → 4 campos editables en SiteSetting (`bancoNombre/TipoCuenta/NumeroCuenta/Titular`, todos
`String?`); `opcionTransferencia` (puro, capa 1) muestra el método SÓLO con banco+tipo+número (titular opcional),
vacío → no se muestra; el seed NO trae cuenta (NULL); migración ADITIVA. (2) El rating fabricado ("4.9 · 124 reseñas"
en detalle y card) se BORRÓ —prueba social falsa, familia #44, publicidad engañosa—, NO configurable; `Star` huérfano
retirado, sin hueco de layout. Doctrina: la cuenta es DATO del tenant + la PRÁCTICA del censo periódico de datos
falsos. Backlog **#64** (reseñas reales: modelo + verificación de compra + moderación) y **#65** (aviso de config del
Dashboard, Fase 1 = #1+#2 del censo + los defectos dormidos). capa 1 **814/814** · tsc + next build verde. Gate del
owner PASADO, mergeada a `main` `--no-ff`. **Sigue de inmediato la tanda del checkout: scroll al cambiar de paso +
métodos de pago encender/apagar — en su rama.**

**ANTES — PRESENTACIONES cardinalidad VARIABLE 2-4 CERRADA.** Tres ítems del gate anterior en
uso real. (1) Placeholder del campo categoría → "Elige una categoría". (2) El destino de cada tarjeta se rotula por
el TÍTULO en vivo de su tarjeta —«En grano» lleva a:—, no por posición ("Presentación 1", que el owner no sabía si
era izq o der); título vacío → fallback. (3) **CARDINALIDAD VARIABLE 2-4**: revierte el "exactamente 2" de C1 con dato
nuevo —2 era restricción de NAYOLI, no del producto (una pastelería quiere Tortas/Galletas/Postres)—. Forma: campos
PLANOS, **2 slots REQUERIDOS + 2 OPCIONALES**, NO repeater (un repeater no da defaults byte-idénticos sin perforar
#44). Qué tarjeta se muestra lo decide el COMPONENTE (`tarjetasDePresentaciones`, capa 1), no el resolver —criterio
**OR** (título O imagen): una tarjeta a medio llenar APARECE con el hueco visible, no desaparece sin explicación—.
Grid por lookup literal 2→cols-2 · 3→cols-3 · 4→**2×2** (medido a 800px: cols-4 daría ~170px ilegibles). Editor
agrupado por "Tarjeta N (opcional)", sin rediseño (el form largo es evidencia del #46). Nayoli (2) byte-idéntica. El
CTA "Ver café {label}" NO se tocó —café-shape, pero cambiarlo rompe el byte-idéntico— → **backlog #63** (censo de copy
café-shape del storefront, con C2). capa 1 **810/810** · tsc + next build verde. Gate del owner PASADO, mergeada a
`main` `--no-ff`.

**ANTES — MINI-TANDA post-C3 (combobox de categoría + destino de Presentaciones como DATO).** Dos ítems del gate de C3
en USO REAL. (1) El campo categoría era `input + datalist` (la lista
NO SE VE) → **CategoriaCombobox**: ensamblaje canónico shadcn `Popover` + `Command`/cmdk (NO primitiva nueva; ya en
uso en `DateField`/`CommandPalette`), portalea al puente como `DateField`, lista desplegable primaria + escribir una
nueva como escape; MISMO control en el form de producto y el import. (2) El destino de las tarjetas de Presentaciones
(`¿Cómo tomas tu café?`) apuntaba a `PRESENTACIONES_HREFS` FIJO — el owner escribió "Café grano" en un producto y el
link "Café en Grano" dejó de traer nada: **un link fijo hacia texto que el cliente escribe libremente se rompe solo**.
Pasa a DATO editable (`categoria1/2` planos de `content.presentaciones`, patrón C1, RESOLVER intacto; `hrefCategoria`
construye el link; `PRESENTACIONES_HREFS` retirado). Byte-idéntico por TEST (defaults + `hrefCategoria` = links de hoy).
REVIERTE la decisión de C1 "el path es estructura" con dato nuevo —C1 asumía un set CERRADO, C3 lo mató—. Destino
rancio → **AVISO en el editor (opción b)**, NO hide-on-empty (cardinalidad fija de 2, ocultar rompe el grid); no
bloquea (una categoría futura es legítima). `/admin/tienda` carga el catálogo (`getProducts` + `categoriasDelCatalogo`,
misma fuente que Productos, sin endpoint nuevo). capa 1 **803/803** · tsc + next build verde. Gate del owner PASADO,
mergeada a `main` `--no-ff`.

**ANTES — TANDA C3 CERRADA — la TAXONOMÍA se DERIVA del catálogo.** Segundo cliente confirmado
NO-café, así que el café-shape de la taxonomía tenía que salir. Las categorías se DERIVAN del catálogo
(`categoriasDelCatalogo`, alfabético es-CO estable), NO un set cerrado ni un editor —el import ya hace que el cliente
escriba sus categorías, un editor las pediría dos veces—. El label ES la categoría misma: `ProductCategory` (union) y
`CATEGORIA_LABELS` (archivo) BORRADOS, cero consumidores (censo por contenido); `Product.categoria` es `string` libre.
La Tostión se apaga sola (`catalogoTieneTostado`, hide-on-empty). `footerNav` perdió sus 2 atajos café. **EL TRIPWIRE
ATRAPÓ UN SPEC FALSO** ("6 pestañas byte-idéntico" — el seed tenía 2 categorías en claves de máquina, no 6 labels): el
diagnóstico lo verificó contra el seed antes de escribir el resolver. Seed a labels limpios + `PRESENTACIONES_HREFS`
re-apuntado. **CORRECCIÓN del gate: editar el seed NO arregla una base ya sembrada** —dev/preview Y producción se
corrigen IGUAL desde el panel; la afirmación "el seed arregla dev" era falsa (§ CLAUDE.md · Bases de datos). En PROD el
owner YA editó los 4 productos de Nayoli a "Café en Grano"/"Café Molido" (sin pendientes). Lo que SIGUE café-shape: la
FICHA del producto (#59) y footerNav editable (#60). capa 1 **801/801** · tsc + next build verde. Mergeada `--no-ff` (`268f3ea`).

**ANTES — TANDA C1** (presentaciones a SiteContent, `3588aee`, en producción): GrindChooser era la ÚNICA sección
hardcodeada de la home. Campos PLANOS (patrón brandStory), NO repeater —un repeater no da defaults byte-idénticos
(`resolverItems` devuelve `[]`, invariante #44 + hide-on-empty)—; cardinalidad FIJA (grid asume 2) → campos planos que
SÍ renderizan sus defaults, byte-idéntico por TEST. El `negocio` del alt llega por PROP (el hook `useSiteSettings`
lanza en el árbol del admin de la vista previa). **YA en main/producción, antes:** TANDA B import de catálogo
(`21f50b0`) y TANDA A "un cliente nuevo no nace siendo Nayoli" (`998b95e`).

**FIX de producción (2026-09-02, `53e5601`):** en la vista previa de `/admin/tienda`, un clic en un enlace del
storefront (p. ej. "Explorar café") sacaba al owner del panel — la previa monta componentes REALES cuyos `<Link>`
navegan de verdad (el iframe se retiró). Los `<a>` bajo `EscalaDesktop` (la frontera común de las previas) son ahora
INERTES por diseño; el storefront no se tocó. (§ CLAUDE.md · La VISTA PREVIA NO NAVEGA.) NO es C2/C3.

**EL CENSO DE TANDA C (de-Nayolificación de lo artesanal), partido en TRES por MECANISMO:**
- **C1 · Home a SiteContent (CERRADA):** GrindChooser → `presentaciones`. Era el único hardcode de la home.
- **C3 · Taxonomía (CERRADA):** las categorías se DERIVAN del catálogo (no un set cerrado); `ProductCategory` y
  `CATEGORIA_LABELS` borrados; Tostión hide-on-empty; `footerNav` sin sus 2 atajos café (BORRADOS — un selector de
  categorías editable en el footer es su propio ítem, #60). Lo que QUEDA café-shape: la FICHA del producto (#59).
- **C2 · Tema por cliente (PENDIENTE):** fuentes (`fontPair`, que **no existe** — hoy Inter+Playfair literales en
  `globals.css`) + `emailColors` + el mark inline del `Logo` + los 6 íconos de `public/`. Se **solapa con el Backlog
  #54** (motor de favicon). Es la "capa de tema por cliente" de Mejoras post-multitenant; la paleta ya se mudó, esto la
  completa. Con C3 cerrada y el segundo cliente confirmado no-café, C2 es lo único que queda de Tanda C (más la ficha
  del producto, #59, que es su propia tanda).

**NO se tocan en ninguna sub-tanda hasta que les toque:** `emailColors`, `legalNav` (vacío para todos, capacidad
futura, no un toque de Nayoli), íconos, mark, fuentes.

> **Este archivo se actualiza como paso final de cada tanda, junto con el push.**
> No es un historial: describe el estado de HOY y las decisiones que no se
> re-litigan. Lo que se completa se reescribe, no se acumula.

**Rol de la sesión de asesoría:** asesor del owner (Edgar), no ejecutor. Claude
Code ejecuta en otra sesión; la de asesoría decide, revisa reportes y aprueba.
El owner corre los gates visuales porque Code no puede autenticarse (`/admin/*`
responde 307).

**Preferencias del owner (vigentes):** desacuerdo primero si lo hay, sin halagos
de apertura, confianza etiquetada `[Certain]` / `[Likely]` / `[Guessing]`, la
verdad incómoda en la primera línea, sin párrafos de calentamiento. Si el owner
insiste sin datos nuevos, sostener la posición.

---

## 1. Qué es el proyecto

Rediseño completo del panel de administración de **Duna** (SaaS admin panel para
pymes; tenant único hoy: **Café Nayoli**, aún sin lanzar) desde shadcn/"Amber
Minimal" hacia un lenguaje propio: **Duna OS**.

**Repo:** `coffee-template-app` (Next.js + Prisma + Postgres/Neon, deploy en
Vercel, `main` = producción).

---

## 2. Estado actual

### Verticales terminadas

| Ruta | Estado | Modelo de scroll |
|---|---|---|
| `/admin/pedidos` | Completa. 9 carriles (con "Listas para despachar") | Alto fijo ≥1080 (`.duna-pantalla-fija`), split 2 columnas |
| `/admin/clientes` | Completa | Igual |
| `/admin/productos` | Completa. Con **import de catálogo** (pegar o subir CSV/TSV/TXT → grilla editable → crear; XLSX en backlog #57) | Igual, con clase condicional (cuadrícula sin selección queda en document-scroll) |
| `/admin/inventario` | Completa, encogida a auditoría | Alto fijo ≥960 (`.duna-sin-split`), scroller único |
| `/admin/pagos` | Completa (frase + curva) | Alto fijo ≥960 (`.duna-sin-split`), scroller único; **el gráfico va en la zona fija** |
| `/admin/analitica` | Completa (cuatro preguntas de dueño, titulares) | Document-scroll (estado final — § Los DOS modelos de scroll) |
| `/admin/automatizaciones` | Completa (rejilla, señal de vida, historial) | Document-scroll (estado final — § Los DOS modelos de scroll) |
| `/admin/dashboard` | Completa ("Hoy" a la duna-os: hero + curva por hora + **TRES indicadores en fila** + dos columnas **"Necesita tu atención"** (lista transversal pedidos+stock) \| "Lo que más vendió hoy". Órdenes recientes RETIRADA) | Document-scroll |
| `/admin/configuracion` | Completa. "Configuración" con DOS secciones: Datos del negocio (editor lectura↔edición) + Equipo y usuarios. Instant-save puro (identidad); los COLORES se mudaron a `/admin/tienda` | Document-scroll |
| `/admin/perfil` | Completa (cuenta limpia + cambiar contraseña real) | Document-scroll |
| `/admin/tienda` | Completa. **Colores de la tienda** (paleta del storefront, borrador/publicar) SOBRE el selector de página + Contenido del storefront (SiteContent), DOS páginas (selector Home/Nosotros): la home (hero · Historia · **Presentaciones** · Suscripción · Testimonios) y /nosotros (historia larga · GALERÍA masonry con fotos y VÍDEO, apagable). Lectura en TARJETAS, edición en vista grande. Rail: "Tienda" suelto tras Crecimiento | Document-scroll |

### Pendientes de rediseño
**Ninguna.** Todas las verticales del panel están en lenguaje Duna; no queda una
pantalla heredada del template.

### El STOREFRONT se viste del cliente — CONSTRUIDO y en PRODUCCIÓN (2026-08-28, `41d4e6a`)

La primera tanda del storefront-por-cliente: que un segundo cliente pueda verse como OTRO negocio
sin forkear código. La identidad textual (commit 1) y la PALETA (commit 4) salen de `SiteSetting`;
**Nayoli queda byte-idéntico** (raíces null → defaults de código, el motor no corre). 17 commits, gate
del owner pasado, mergeado `--no-ff` y desplegado (deploy verde, migración de columnas paleta aplicada).

- **El motor de color** (`lib/config/palette-derive.ts`, puro, capa 1): 3 RAÍCES (fondo·tinta·acento) →
  22 tintas derivadas en OKLCH (mezcla de 2 raíces con pesos por token) + PISO de contraste en los roles
  de texto + acento AUTO-VOLTEADO (`--sf-acento-txt` blanco o tinta según legibilidad). Se inyecta
  server-side como `:root{}` `<style>` (sin flash), memoizada por raíces.
- **Tokenización** (commit 3): 506 hex literales del storefront → 20 vars `--sf-*` semánticas, byte-idéntico
  (verificado en producción: Nayoli con raíces null → los 20 `--sf-*` = sus hex exactos).
- **El editor "Colores de la tienda"** (nació en Configuración; **luego mudado a `/admin/tienda` con flujo de
  borrador**, § la tanda de la paleta-borrador abajo): BASES curadas (NEUTRA primero — un rubro de
  primera pondría a Nayoli de punto de partida) para fondo+tinta + picker libre para el acento; **vista
  previa de COMPONENTES REALES** del storefront (Logo + TrustBadges + 3 ProductCard) escalada a 1280 con
  `EscalaDesktop` (render a ancho de DISEÑO + transform scale — no reflow a un ancho que ningún visitante
  usa); **ampliar en overlay** (Dialog de Radix, EscalaDesktop compacto, sólo en edición); **botón "Usar
  el tema por defecto"** (PATCH null → fábrica); avisos de contraste que dicen QUÉ pasa, no un ratio.
- **`EscalaDesktop`** (extraído de `VistaTiendaEnVivo`, su 2º consumidor): las dos ResizeObserver + el
  cálculo de escala, GENÉRICO (no sabe de SiteContent/secciones — verificado). /admin/tienda recableado.
- **Doctrina (§ CLAUDE.md):** el WORDMARK carga la identidad (nombre de SiteSetting, lo pasa el consumidor);
  el MARK (flor de Nayoli) es asset POR-DESPLIEGUE; el logo subido se RESPETA nunca se tiñe (precedente
  Shopify/Squarespace/Wix). Lección de método nueva: **un hook con nombre de store puede ser un CONTEXT con
  throw duro** — montar un componente del storefront (ProductCard→`useCartStore`) en otro árbol de providers
  no lo atrapa ni `tsc` ni `next build`, revienta en runtime (§ Las tres capas). Foco por-teclado
  (`:focus-visible`) en todo el panel, tab-testeado (el keyboard ring se conserva, el mouse no lo muestra).
- **Migración `20260828120000_add_site_setting_palette`**: `paletaFondo/Tinta/Acento` nullable, sin default,
  sin backfill → la fila de Nayoli queda en null. Aditiva; aplicada en prod con el deploy.
- Abrió **#55** (la paleta se comporta como CONTENIDO pero vivía en el modelo HARD de identidad) —**CERRADO por
  la tanda de la paleta-borrador**, ver abajo— y **#56** (el manifest del panel es del CLIENTE → el PWA del admin
  se instala como la tienda; gateado por assets: Duna sólo tiene SVG+ICO, un manifest quiere PNG — sigue vivo).

### La PALETA → SiteContent (borrador) — CONSTRUIDA, en PRODUCCIÓN (2026-08-30, `e5c1e55`)

Cierra **§ Backlog #55**. La paleta se mudó de `SiteSetting` (HARD, guardar=publicar al instante) a
`SiteContent.content.tema` para ganar borrador/publicar/descartar. **Decisión: opción B** (mover la paleta a
SiteContent), porque A (injertar borrador en SiteSetting) y C (frontera por campo) dejan Configuración BILINGÜE
—conocimiento que el operador carga por-campo—; con B la frontera es de **PANTALLA**. 6 commits, gateado,
mergeado y en producción (`e5c1e55`).

- **Modelo:** `content.tema` es la SEGUNDA clave no-sección de `SiteContentData` (tras `paginas`): `resolverTema`
  la resuelve aparte del loop, no está en el REGISTRY, `SeccionKey` la excluye. Nulls → defaults de código →
  Nayoli byte-idéntico. `content.paginas` ya había abierto ese camino, así que ensanchar SiteContent a "estado de
  presentación del storefront" es honesto, no forzado.
- **Write:** reusa las key-agnósticas `publicarSeccion('tema')`/`descartarSeccion('tema')` + `guardarTemaBorrador`
  (guardar propio: la paleta valida DURO —hex-6, todo-o-nada—). Route `/api/site-content/tema` (PUT guardar
  borrador · POST publicar/descartar). Carril: 5 casos de `tema` (guardar sin tocar publicado, publicar sin blobs,
  descartar, volver-a-fábrica sin arrastrar secciones).
- **El editor** (`PaletaSeccion`) se mudó a `/admin/tienda` SOBRE el selector de página, con el contrato de
  borrador de las secciones. DOS adaptaciones por la validación DURA: (1) autoguardado SÓLO en estados válidos —un
  acento a medio teclear muestra el error inline y NO guarda; guarda solo al volver a ser válido—; (2) "Usar el
  tema por defecto" = RESET DIRECTO que publica nulls (misma clase que el toggle de página: config), con
  confirmación. NULL, no los hexes: los hexes pasarían por el motor de derivación (aproximación); el null → sin
  `<style>` → los `--sf-*` exactos → byte-idéntico. Configuración volvió a instant-save puro.
- **DROP** de las 3 columnas de `SiteSetting` (migración `20260830120000`), MISMO deploy que el código que deja de
  leerlas. La razón va en la migración: la ventana del `migrate deploy` aplica aunque estén en null, y **la
  condición segura es UN SOLO usuario del panel** (SiteSetting la lee también el admin), no "sin tráfico" — con un
  equipo vuelve a dos deploys.
- **El CAVEAT que sobrevive:** descartar → publicado, fábrica → defaults; **"republicar un tema PASADO" sigue
  siendo HISTORIAL y sigue DESCARTADO** (sobre-ingeniería). El borrador no resuelve el historial.

### El DASHBOARD "Necesita tu atención" + el login — CONSTRUIDA, en la rama (2026-08-31, `feat/dashboard-atencion`)

Tres commits. **(1) Login:** el pie se separa de la duna anclando el contenido (padding-bottom `11vw` ~ el alto
de la cresta), NO capando el SVG —capar la letterboxea o clipa el sol circular—; el tagline pasó a "El sistema
operativo de tu negocio." (afirma la categoría, no cuenta piezas); el sol ~40 s fuera de ~220 s anotado como
diseñado. **(2) La sección "Necesita tu atención":** la ÚNICA lista que unifica pedidos-atención + stock-bajo
(hasta ahora sólo se unificaban en el punto del rail). Fuente única `itemsDeAtencion` (puro, capa 1, tests que
afirman el ORDEN); prioridad DECLARADA por costo (`por_cobrar` → … → stock), un ítem por orden con motivos
encadenados, NAVEGA no muta (cada ítem al detalle), cap 4 que EXPANDE en el sitio (los ítems son de dos
secciones, no hay una sola página que muestre ambas), vacío = "Todo al día". **El COLOR es la clase, el ORDEN es
el costo:** los pedidos van ámbar (`atencion`), el stock ROJO (`alerta`, antes ámbar por error) pero SIGUE al
final. El badge "N pendientes" va a la esquina DERECHA (space-between, como duna-os). `pedidos_por_atender` (→ el
badge) y `alertas_stock` (→ los ítems rojos) salieron del DEFAULT pero SIGUEN en el CATÁLOGO, elegibles —RETIRAR DEL
DEFAULT ≠ BORRAR DEL CATÁLOGO; el primer intento los borró del catálogo, overreach corregido—; `por_cobrar` está en
el default (muestra el monto). **(3) Estructura de duna-os:** hero +
curva + TRES indicadores en fila + dos columnas ("Necesita tu atención" 1.35fr \| "Lo que más vendió hoy"). La
tabla de **Órdenes recientes se RETIRA** (única tabla de una pantalla sin tablas; su contenido vive en Pedidos a
un clic) —con ella `OrdersLista`/`ORDENES_COLS`, los imports `StatusBadge`/`Order`, y el dato MUERTO `recentOrders`
(endpoint + `types/dashboard.ts`); `.duna-lista` SE QUEDA (4 consumidores: Pagos, kardex, Analítica, editor de
tienda). Los indicadores suben ENTRE la curva y las columnas; el DEFAULT de 2 a 3 (`promedio_por_orden` gana
`defaultVisible`; tira 4-col → 3-col); el CUSTOMIZER sobrevive ("tres" = arranque, no tope). **HALLAZGO — la
preferencia guardada gana sobre el default:** sólo una fila AUSENTE cae a `DEFAULT_WIDGET_KEYS`; con fila, manda lo
guardado. El owner tenía guardado el default VIEJO de 4, así que veía 2 (los dos borrados se podaban) y el default
nuevo no le llegaba — conducta correcta (su selección manda). Devolver los dos al catálogo deja de podarlos → su
fila resuelve a las 4 que eligió, sin tocarle la preferencia. capa 1 779/779 · tsc + next build verde. **El gate
visual del dashboard es del owner** (la ruta va tras sesión, § LÍMITE CONOCIDO). Lo NO construido de la maqueta:
asistente, "se agota mañana" (predicción), PSE, "Conversaciones activas" y "Duna sugiere" (su sitio en la maqueta lo
ocupa ahora la columna de atención).

### El MANIFEST del panel ya es de Duna — en PRODUCCIÓN (2026-08-30, `3f86792`)

Cierra **§ Backlog #56**. Instalar el panel como PWA lo anunciaba como el negocio del cliente (nombre + íconos)
y su `start_url:"/"` hacía que el ícono instalado **abriera la tienda, no el panel** — dos defectos, el segundo
más grave. Causa: UN solo manifest, la convención `app/manifest.ts` (dinámica del cliente), que se auto-inyecta
en toda la app y **GANA sobre `metadata.manifest`** (doc de Next verificada) — la MISMA trampa que movió los
íconos a `public/`.

- **Fix = playbook de los íconos:** se BORRÓ la convención y cada grupo declara su manifest. Storefront → route
  handler `app/api/manifest/route.ts` (dinámico, lee SiteSetting, `application/manifest+json`) + `metadata.manifest`
  en el layout del storefront. Admin → `public/duna.webmanifest` estático (name "Panel Duna", `start_url:"/admin"`,
  colores Duna) + `metadata.manifest` en el layout del admin.
- **iOS:** el admin ganó el `apple-touch-icon` que le faltaba — iOS IGNORA el manifest, así que sin él el panel se
  instalaba con una captura.
- **Íconos generados DESDE EL SVG con `sharp`** (marca crema `#F4F3EF` sobre tinta `#121212`, `flatten` → SIN
  canal alfa, porque iOS pinta negro donde hay alpha): `apple-icon-duna.png` (180, cuadrado a sangre, sin esquinas
  propias — iOS aplica su máscara) y `icon-duna-512-maskable.png` (marca dentro del 80% central). El ícono `any`
  del manifest de Duna es el `/brand/icon-duna.svg` que ya existía (Chrome lo renderiza) → no hicieron falta PNG
  192/512. Verificado por contenido: `hasAlpha:false`, 4 esquinas `#121212` opacas, sol `#f59e0b` y barra `#f4f3ef`
  en su sitio.
- **La verificación que decide, POR CONTENIDO en el `<head>` renderizado** (no el código — el modo de falla de los
  íconos): storefront `/` → 1 solo `<link rel=manifest>` → /api/manifest; admin `/login` → 1 solo → /duna.webmanifest;
  `/manifest.webmanifest` → 404 (sin residual). tsc + build verde.

### Rediseño del login (la PUERTA) — CONSTRUIDO (2026-08-27)

Las tres pantallas pre-auth (login · aceptar-invitación · recuperar-clave) comparten
`PreAuthShell`, así que el rediseño va en el shell y las toca a las tres. Dos piezas:

- **La duna con el sol** (`components/admin/DunaPie.tsx`) — identidad de la puerta, la
  marca contando su metáfora. Curva PROPIA fija dibujada a mano (no deriva de datos como las
  del panel); el sol la recorre con `<animateMotion>` + `<mpath>` sobre `<circle>` (SVG
  nativo, sin offset-path), 3 min, arranque aleatorio ACOTADO en `useEffect` (nunca en un
  borde, sin hydration mismatch), quieto con reduced-motion, `aria-hidden`. `width:100%` +
  `height:auto` → sol circular y visible a cualquier ancho. SIN pulso (no hay un "ahora").
  Es MARCA, no gráfico → a doctrina (§ CLAUDE.md, el ámbar según el sitio, caso primario).
- **El pie de marca** "Un negocio. Dos puertas. Un sistema operativo." — SIN versión (un
  literal envejece). "Dos puertas" = la metáfora (admin + storefront), no el conteo de
  pantallas.

La card auto-ajusta a los tres contenidos (login 2 campos · recuperar 1 · terminal sin
form) y las tres se ven bien —la terminal no queda rara—. El enlace de reset se QUEDA (el
flujo ya existe). **"Ingresar con WhatsApp" NO se dibujó** (enlace muerto en la puerta) →
backlog #52 con disparador. Gate visual del owner en el preview de la rama.

### Recuperación de contraseña — CONSTRUIDA (2026-08-27)

El flujo de reset **NO EXISTÍA** — no estaba a medias, no estaba. La única
recuperación era que otro OWNER re-invitara; con un solo dueño, eso es quedarse fuera
del propio negocio para siempre. Construido entero sobre Better Auth: `sendResetPassword`
+ correo con identidad de SiteSetting + `revokeSessionsOnPasswordReset` (mata TODAS las
sesiones al resetear — el caso "me robaron la clave"); dos pantallas (`/recuperar-clave`
+ `/recuperar-clave/nueva`) que **REUSAN** las piezas compartidas de aceptar-invitación
(`FormClaveNueva`, `EnlaceNoDisponible`); el enlace "¿Olvidaste tu contraseña?" en login.
Las TRES pantallas de la puerta comparten el mismo `PreAuthShell`. Gate end-to-end pasado
(correo → clic → 302 → pantalla → clave nueva → entrar); carril de la revocación de
sesiones, visto fallar sin el flag.

- **Timing anti-enumeración NO se iguala** (decisión escrita en `lib/auth.ts`): BA
  uniforma el CUERPO; la latencia difiere y no se cierra —panel de <10 usuarios, un
  retardo fijo miente al variar la red—. Disparador: muchos usuarios o registro abierto.
- **En Preview el enlace del correo apunta al preview** (`baseURL = https://VERCEL_URL`
  en preview, no `BETTER_AUTH_URL`), verificado.

**Hallazgo PREEXISTENTE que esta tanda destapó:** el gate del panel rebotaba a `/login`
**EN SILENCIO** a quien autenticaba con rol insuficiente (o cuenta desactivada) —
indistinguible de un cuelgue, porque el botón de login no baja su loading en éxito—.
Ahora el gate lleva un `?motivo=` y el login lo EXPLICA. Un acceso denegado se dice, no
se finge un cuelgue.

**Configuración/Equipo + Perfil CERRADO** (2026-08-23, § CLAUDE.md "Equipo y
usuarios, y Perfil") — las dos últimas pantallas. Cuatro commits:

1. **El hub de Configuración desapareció y VOLVIÓ con contenido real.** Fue "Equipo
   y usuarios" mientras SÓLO mostraba equipo (cinco de sus seis tarjetas eran
   "Próximamente"); con el editor del negocio (SiteSetting, tanda 2026-08-24)
   recuperó el nombre **"Configuración"** y DOS secciones (Datos del negocio + Equipo
   y usuarios). La pestaña y el UserMenu dicen "Configuración" (ícono Settings). SIN
   sub-rutas todavía (dos secciones caben en una página; el hub con sub-routes es la
   era multi-tenant). La subruta `/configuracion/usuarios` redirige
   (`lib/redirect-config`, el sexto redirect). `RoleBadge` en `.duna-badge--neutral`.
2. **#1 cerrado** — invitaciones pendientes visibles y cancelables. `GET` + `DELETE`
   OWNER-only; la consulta se extrajo a `lib/invitations.ts` para el carril
   (`invitaciones-pendientes.test.ts`, visto fallar quitando `usedAt: null`). Una
   pendiente es sin aceptar Y sin vencer; las vencidas no se listan (ya no bloquean).
3. **Perfil limpio + Duna** — fuera la contraseña "hace 30 días" (inventada) y su
   botón muerto, el botón de cámara, el banner. Organización de `siteConfig.brand`
   (corrigió un dato FALSO: decía "Bogotá" y Nayoli está en Supatá).
4. **Cambiar contraseña real** — `authClient.changePassword` con
   `revokeOtherSessions: true`. El caso "invitado sin contraseña" NO existe (la
   aceptación la exige; no hay proveedores sociales), así que aplica a toda cuenta.

**`InviteUserModal` → DunaSheet** (commit posterior, mismo hilo): tenía un defecto real
—no cerraba al clicar fuera—; migró a `DunaSheet anclaje="lado"` (la primitiva de los
otros cinco form-sheets) con guarda de descarte. `ConfirmDeleteDialog` de esa pantalla
NO se tocó: es compartido y migrarlo arrastraría Pedidos/Productos/Clientes/Inventario.
**DISPARADOR del hub:** cuando el multi-tenant traiga secciones reales, Configuración
vuelve como hub y el equipo baja a un sub-route con su nombre intacto.

### Datos sembrados en DEV (se conservan por decisión del owner)

`development` (ep-still-sound) tiene una siembra de DEMO del Dashboard "Hoy"
(2026-08-23): **9 órdenes** (CN-HOY001..008 con producto + CN-HOY009 sin producto,
la fila de texto plano del top-hoy), **6 pagos** y **2 notificaciones no leídas**
`orden_recibida`. El owner las conserva para ver el sistema con datos, no con la
base casi vacía. **NO borrar sin pedirlo.** El día que haya que limpiarla, el
manifiesto de ids exactos vive en **`scripts/seed-hoy-manifiesto.json`** — borrar
por id exacto (nunca por prefijo ni rango) es la única forma segura, y ese archivo
lleva la nota de cómo y contra qué verificar (§ la regla de las bases de datos).

**`/admin/entregas` RETIRADA** (2026-08-20). No se rediseñó: se retiró, porque su eje
—el fulfillment— ya vive en Pedidos (el estado por fila en la columna Entrega, y la cola
por-despachar como carril "Listas para despachar", que entró ANTES en su propio push para
no dejar hueco). Cinco commits del retiro, mismo procedimiento que `/admin/ordenes`:
- **Reapuntar los hrefs que escriben a futuro ANTES de borrar:** las dos automatizaciones
  (`envio_estancado`, `entrega_fallida`) → al PEDIDO que nombran (`hrefOrdenOLista`, con
  guarda al listado si falta el número); el widget `despachos_hoy` → NO-CLICKABLE (cuenta
  "salieron hoy", que Pedidos no tiene como conjunto — misma decisión que la gráfica de
  Pedidos del carrusel: sin destino exacto, no-clickable).
- **Redirect 307 por segmento** (`lib/redirect-entregas`, puro + tests) → `/admin/pedidos`
  pelado. Cubre las dos poblaciones congeladas (2 `Notification.href` en dev + los
  `admin:cmdk-recents`), que NO se backfillean. Sin bucle, afirmado contra la cadena.
- **Huérfanos retirados con censo:** `getShippings`, `GET /api/shippings`, `ZONA_COLORS`,
  `FILTER_ESTADOS`/`ESTADOS`. Las otras funciones de `lib/api/shippings` y los predicados
  compartidos (`isScheduledShipping`, `hasScheduleData`, `missingToDispatch`) SE QUEDAN —
  Pedidos los usa.
- **El hueco blando NO entró:** mensajero y zona por fila (la vista de flota) no se llevó a
  Pedidos. Es decisión de contenido; si se extraña tras usar el carril, entra CON esa
  evidencia, no por si acaso.

**Pagos CERRADO — tercer y último rediseño: LA FRASE + LA CURVA** (§ CLAUDE.md "Pagos —
la FRASE y la CURVA"). La pantalla abre diciendo la respuesta ("Este mes entraron
$ 315.000 en 11 pagos") y **el gráfico no scrollea**: vive en la zona fija con los
filtros, y la región queda con el libro y nada más (hijo único → sticky canónico,
medido). El strip de barras, el toggle "Por método" y la leyenda de exclusiones se
retiraron con censo por contenido.

- La frase es pura y testeada (`lib/pagos/frase.ts`, 12 tests de capa 1): concordancia
  del ALCANCE, el vacío como la misma frase, el método sufijado.
- La curva es Catmull-Rom→Bézier con área de tinta al 5% (`color-mix`, no el token de
  hover), tres marcadores en tinta y tooltip con la superficie del sistema.
- La escalera bajó de cinco peldaños a **tres** (día → semana → mes, tope 92 puntos):
  una curva admite muchos más puntos que una barra.
- **Capacidad perdida y aceptada:** ya no se puede excluir un canal de la vista de
  tiempo (era la leyenda del strip).
- **El presupuesto de alto, con su número:** la zona fija quedó en **281px**, o sea un
  **umbral de ~639px de viewport para 5 filas** de libro. Levers ejercidos: la tarjeta
  del gráfico retirada (−44), el alto de la curva 170→140→110 (−60) y el eyebrow del
  rango (ya se lee en el date picker).
  **El caso que esto resuelve, y que el owner NO ve:** trabaja en monitor externo, pero
  con la tarjeta puesta el umbral eran 713px y un portátil con resolución escalada
  (~620–660px útiles) mostraba **3 filas, no 5**. Con A+B ese mismo portátil pasa a 4–5
  (5 desde 639). No es un caso raro: es cualquiera con menos alto útil.
  **Si algún día hay que recuperar más**, quedan: el hint (22px), los gaps (8px) y H de
  110 a 100 —el piso de legibilidad—. El hint NO se tocó a propósito: es la única
  declaración de que la curva es clickeable.

- **El INFORME (PDF)** — la primera ACCIÓN de la pantalla, y no rompe el "libro de sólo
  lectura" (descargar no escribe). Botón secundario al final de los filtros. Se genera en
  el CLIENTE por fuente única (un endpoint sería una segunda lectura del mismo recorte),
  en tres capas (modelo puro y testeado ≠ layout ≠ bytes de jsPDF), con la librería en
  `import()` dinámico —verificado sobre el artefacto: no viaja en el bundle de Pagos—.
  Tope de **1.000 filas declarado EN el PDF**. Estructura: negocio + fecha de generación ·
  PAGOS + rango · RESUMEN · POR MÉTODO (del período completo aunque el select filtre,
  rotulado) · DETALLE · pie con paginación y "Generado con Duna".

  El informe pasó por tres correcciones antes de cerrar: (1) de tabla volcada a DOCUMENTO
  —un documento necesita MÁS contexto que la pantalla, no menos: negocio, fecha, paginación,
  y el desglose por método del período completo aunque el select filtre—; (2) el detalle
  salía vacío (el bucle de filas se perdió al editar el renderer) + marca Duna en el pie +
  filas en cero fuera; (3) columnas superpuestas, jerarquía tipográfica y banda cebra.

- **El fallo de carga de Pagos SE VE** (era un `.catch(() => {})`): al fallar, la frase
  DICE el error, el gráfico no dibuja, el libro lleva "Reintentar", y el dato viejo NO
  sobrevive bajo la etiqueta nueva. Sin toast (el error es persistente). El
  `aceptar-invitacion:53` —mismo patrón— quedó en backlog #33.

- **El date-range picker: cambiar de rango sin limpiar filtros.** ESTABA ROTO EN
  PRODUCCIÓN, en las TRES pantallas (Pedidos, Inventario, Pagos): react-day-picker, sobre
  un rango completo, deja `from` clavado y mueve sólo `to`, así que un clic no podía
  empezar un rango nuevo. Ahora el medio-rango vive DENTRO del picker (`avanzarSeleccion`,
  puro y testeado) y `onChange` emite SÓLO rangos completos —los padres quedan ajenos—.

Quedan de antes: stats podadas a solo "Total", loader = skeleton de filas del grid-list,
y el crossfade de 200ms al cambiar de eje.

**DOS COSAS QUE COSTARON CARO HOY (2026-08-19), para que no se pierdan:**

1. **El picker estaba roto EN PRODUCCIÓN desde antes de esta tanda** —no se podía cambiar
   de rango sin limpiar filtros, en las tres pantallas—. Lo TAPABAN los presets: quien
   navega por presets nunca clickea el calendario dos veces, así que nadie lo topó. Salió
   a la luz sólo cuando un PDF declaró un rango en su encabezado y trajo las filas de otro.
   Un defecto de interacción puede vivir meses detrás de un atajo que lo esquiva.

2. **Un documento hereda la verdad de la pantalla que lo genera.** El informe no tenía
   defecto propio: copió fielmente una pantalla que ya mentía (el rango equivocado del
   picker). Y la propagó CON MÁS AUTORIDAD —un PDF se lee lejos, sin el filtro a la vista y
   sin poder verificar nada—. Cuando algo se exporta, arreglar la fuente es arreglar el
   documento; blindar el documento sin mirar la fuente es tratar el síntoma.

**Tooltip Duna CERRADO** (§ CLAUDE.md "El tooltip del panel") — la primitiva
`DunaTooltip` es ADMIN-LEVEL (envuelve Radix; el paquete queda sin conducta) y la
superficie `.admin-tooltip` es un chip invertido (~17:1 en los dos temas). El censo real
—tras descartar props `title` que NO eran tooltips (encabezados de `OrderCard`, títulos de
diálogo)— dio **8 DATO** migrados, **9 ETIQUETA** por goteo y **2 redundantes** limpiados;
a `StatusBadge` (compartido con storefront) se le quitó el prop `title`. Backlog #29 se
borró al cerrar. Quedan anotados: mover la superficie al paquete como `.duna-tooltip` (con
sheet/scrim, § Duna OS en ANGOSTO). El hueco táctil del total del bucket (ex backlog #30)
se CERRÓ el 2026-08-20 sin código: el gate en teléfono real mostró que tocar un punto
acota y la frase muestra el total del bucket —el dato se alcanza, no dependía del hover—.

**Backlog #28 CERRADO** (§ CLAUDE.md "Listas tabulares del panel") — **queda UN SOLO
patrón de lista tabular en el panel: el grid-list `.duna-lista`, y `DunaTable` retirado.**
El kardex de Inventario migró de `DunaTable` a grid-list; con eso el grid-list llegó a su
SEGUNDO consumidor (Pagos + kardex) y se extrajo al DS como `.duna-lista`
(`primitives.css`); el loader de Inventario adoptó el skeleton de filas grises; y
`DunaTable` se retiró entero —componente, CSS, demo de referencia— por censo de contenido
(cero consumidores). De paso se corrigió la sección "Región de alto fijo" de
`reference.html`, que enseñaba una `<table>` cuando la app usa grid-list (backlog #4 otra
vez).

**Consistencia Pagos/Inventario (CERRADA)** — tanda corta sobre el grid-list y la
cabecera:
- **Backlog #31 CERRADO**: el reflujo <960 del grid-list ocultaba el encabezado y dejaba
  valores sin etiqueta; ahora cada celda con `data-label` trae su columna inline (caption
  muted, sólo móvil). Conducta compartida: una regla en `primitives.css`, dos pantallas.
- **`.duna-stat__d` muted** en la primitiva; Inventario adopta el `__d` en vez de un `<p>`
  suelto — un solo patrón para la línea bajo la cifra.
- **R-1 y R-2 quedaron SUPERSEDED** por el rediseño de la frase + curva, que reemplazó la
  cabecera fusionada y el strip achatado. Churn decidido y aceptado por el owner: los dos
  mergearon primero y se reemplazaron después. R-3 nunca se escribió — la zona fija que
  definió el spec absorbió lo que iba a hacer.

### Trabajo cerrado
- **El VÍDEO en la galería de /nosotros — tanda B del #48/#20** (2026-08-26, § CLAUDE.md "VÍDEO en la
  galería de /nosotros"). 18 commits. Cerró **#48**.
  - **Ítem MIXTO imagen|vídeo** en el repeater: `tipo` declarado, `poster` por vídeo, `w`/`h` para la
    celda. **Póster de un FRAME del vídeo** (PosterScrubber: `<video>` local + scrubber + `canvas.toBlob`,
    JPEG, dims del vídeo — el objectURL local NO contamina el canvas, medido) o una imagen a mano; el alta
    junta los dos y sube el póster PRIMERO (huérfano de 200 KB, no de 20 MB). "Cambiar vídeo" re-deriva su
    póster.
  - **Gate por CÓDEC, no por contenedor** (`lib/video-codec.ts`, parser propio ~110 líneas del box `stsd`,
    NO mp4box para leer 4 chars): AVC pasa, HEVC/ProRes se rechazan —un HEVC-en-mp4 pasa el contenedor y
    Firefox/Chrome no lo reproducen; el `<video>` muestra el póster quieto, medido—. El mensaje de HEVC NO
    promete una conversión que nadie logra: dice grabar en "Más compatible".
  - **El .mov se ACEPTA y se re-envasa a .mp4 en el navegador** (`lib/video-remux.ts`, mp4box **0.5.2** —el
    2.4.1 no emitía media, medido—): Firefox no reproduce el contenedor .mov, así que en vez de pedir una
    conversión (QuickTime/iMovie no funcionaron en la práctica) el navegador convierte solo. Video-only
    (audio dropeado, la galería es muted). MEDIDO sobre el .mov real de 180 MB: ~4 s, sale .mp4 que
    reproduce. Import dinámico (~31 KB gzip).
  - **Render**: `<video preload="none">` + IntersectionObserver play-on-view (MEDIDO: `autoplay` con
    `preload="none"` descarga igual); badge de play PERSISTENTE (tinta sobre fondo tenue — un vídeo que no
    arranca se ve como una foto); reduced-motion → póster + controls; póster a la proporción del vídeo.
  - **TOPE DE GALERÍA de 20 MB** (`MAX_VIDEO_GALERIA_BYTES`): un vídeo de 166 MB tarda MINUTOS en móvil. No
    es arbitrario —una galería de finca son loops CORTOS—, y comprimir no lo arregla (la DURACIÓN manda: 3
    min ≈ 87 MB comprimido, medido). El tope aplica post-remux (lo que se sube), con pre-chequeo generoso
    (1.5×) en el pick para no remuxear un archivo obviamente grande. El tope de remux de 250 MB + la lógica
    de `deviceMemory` se RETIRARON (con 20 MB, al remux nunca le llega nada grande). El **#20** queda para
    aceptar clips cortos de bitrate ALTO (WebCodecs, medido viable), no vídeos largos.
  - Label del ítem por TIPO ("¿Eliminar este vídeo?"), y los warnings benignos de mp4box silenciados
    (confirmado en su fuente). Abrió **#51** (lightbox de imágenes).
- **La SUBIDA DIRECTA a Blob — tanda A del #48/#20** (2026-08-26, § CLAUDE.md "La subida DIRECTA a
  Blob"). Las imágenes de contenido (portadas y galería de producto, hero, brandStory, galería de
  /nosotros) suben del navegador a Blob con `subirDirecto` + un endpoint de token, hasta **200 MB**,
  salteando el límite de 4.5 MB del serverless. **Migración TOTAL**: `uploadImagen` y `/api/upload`
  RETIRADOS —un solo camino—; los comprobantes NO migran (subsistema aparte, server-put, PDF, 4 MB
  propio). **Seguridad**: el gate del token es lo único que protege el Blob (el archivo no pasa por el
  server) — `onBeforeGenerateToken` valida sesión+rol y acota `allowedContentTypes` (sólo imágenes) +
  `maximumSizeInBytes` (200 MB) + el pathname (con aislamiento `dev/`) EN el token; probado sin sesión
  → 401. **Progreso pegado al botón** (no un sticky sobre tarjeta, que cortaba; ni la vista sticky en
  móvil, que tapaba el form — ambos arreglados). Cerró la mitad del #20 que dolía (el tope de 4 MB);
  **comprimir** queda como #20 con disparador corregido (el storefront LENTO, no el tope). El vídeo
  (#48) hereda esta infra: la tanda B amplía el allowlist del token a mp4/webm, no reescribe la subida.
- **La GALERÍA de /nosotros — tanda 2** (2026-08-26, § CLAUDE.md "La GALERÍA de /nosotros").
  La 2ª sección REPEATER (`nosotrosGaleria`, ítem `{ url, alt, w, h }`), sección PROPIA —se
  oculta sola, su vacío es legítimo—, que disuelve la colisión del #47. Estrena la PLATAFORMA:
  el **uploader extraído** (`useSubidaImagen`, compartido por la cáscara y el repeater — un
  `<input>`, un `subiendo`) y el **tipo `imagen`** en el `RepeaterEditor` (agrega subiendo
  primero, miniatura en el renglón, `max: 12` de curaduría). **MASONRY** (CSS columns) con la
  proporción NATURAL de cada foto —dims capturadas en la subida (`createImageBitmap`), sin
  recorte al cuadrado que decidiría por el dueño qué parte importa—; orden por columna (decisión
  escrita), móvil 1 columna = orden del array. **Alt** opcional con fallback contextual "Foto de
  la galería de {negocio}" (por PROP, no `useSiteSettings()`). **Borrar CONFIRMA** en la
  plataforma (RepeaterEditor, reusa ConfirmDescartarDialog; el artículo del copy sale de
  `RepeaterConfig.genero`). El borrado de blobs por ítem sale gratis de `imagenesDe`
  (`imagenes:['url']`); quitar una foto publicada es ESCALONADO (el blob se va al PUBLICAR).
  Verificado en modo producción con siembra reversible (proporciones mixtas). El vídeo (#48) se
  construyó en la tanda 3/B (arriba, "El VÍDEO en la galería").
- **La página /nosotros como CAPACIDAD — tanda 1: la historia** (2026-08-26, § CLAUDE.md
  "La PÁGINA /nosotros"). El storefront gana una 2ª página editable, apagable por cualquier
  cliente. **Páginas por CONFIG, no anidado en el dato**: las secciones de /nosotros son claves
  más del `content` JSON (`nosotrosHistoria`), la "página" es un tag `SeccionConfig.pagina` —así
  el resolver, el borrador y el write path NO cambian—. La meta `content.paginas` (`{ nosotros:
  { visible } }`) es aparte (`resolverPaginas`, fuera del REGISTRY). **Default ENCENDIDA** (copy
  real de Nayoli, no un claim fabricado → no repite #44). Apagada → **redirect 307** a la home
  (no 404: la página existe). **Nav DATA-DRIVEN**: header y footer leen el flag por
  `useSiteContent()` y ocultan el enlace apagada; re-apuntar el ancla `/#nuestra-historia` →
  `/nosotros` arregla de yapa el active-state muerto. Editor: **selector Home/Nosotros SIN gate**
  (siempre ≥2 páginas) + toggle encender/apagar (write DIRECTO). **#47 CANCELADO** (la galería
  variable vive en /nosotros, ya construida en la tanda 2; el collage de la home se queda en 4
  fijas). Los hints que restaban el hecho en los dos toggles de visibilidad se retiraron.
- **SiteContent — el storefront editable, LAS CUATRO SECCIONES** (2026-08-25, § CLAUDE.md
  "Config del contenido — SiteContent"). El contenido editorial de la home salió del JSX a la
  tabla `SiteContent` (singleton, born en `public`, **migración SIN INSERT**), editable en
  `/admin/tienda`. Loader **SOFT** (`findUnique` → defaults-como-fallback; el vacío es legítimo)
  — el contraste a propósito con SiteSetting (HARD, fail-loud). Requerido vacío → default;
  opcional vacío → SE OMITE. Imágenes por `/api/upload` prefix 'contenido' (whitelist), string
  estático-o-URL, tope 4 MB. El storefront es **`force-dynamic`** (era estático y horneaba el
  contenido al build: editar no se veía en producción — se midió en modo producción, dev engaña).
  - **BORRADOR/PUBLICADO + AUTOGUARDADO.** `content` (publicado) + `borrador Json?` (mapa PARCIAL
    por sección, para que publicar una no arrastre otra). Guardar dejó de publicar: el editor
    autoguarda (coordinador puro con debounce/encolado/reintento, probado con relojes falsos) y
    **Publicar es el único botón**. `beforeunload` sólo en 'error'.
  - **VISTA PREVIA EN VIVO, sin iframe:** los componentes REALES del storefront renderizados en el
    panel, alimentados por el form (provider local + `PreviewProvider` estático + escala a 1280).
    Se teclea y la vista cambia en el mismo render. El iframe se retiró con su censo.
  - **LECTURA = TARJETA, EDICIÓN = VISTA GRANDE.** Cada sección es una tarjeta compacta (miniatura
    = la misma vista a otra escala) y crece en su lugar al editar; el sticky vive sólo en edición.
    Con eso desapareció el scroller interno que atrapaba la página en lectura.
  - **UNA cáscara genérica** (`TiendaSeccionEditor`) parametrizada por config (campos, imágenes,
    toggle, componente de vista); autoguardado y publicación NO se duplican por sección.
  - **El REPEATER es plataforma** (Testimonios lo estrena; la galería de /nosotros lo reusa —
    construida en su tanda 2, con el tipo `imagen`): resolver de
    arrays + `RepeaterEditor` genérico (colapsables, flechas, rating). Destapó un defecto latente en
    `main` —el resolver ignoraba `items`, así que un repeater habría perdido toda edición en
    silencio—; visto fallar y arreglado.
  - **`#44` CERRADO:** los tres testimonios FABRICADOS salieron del código; Testimonios nace con
    `items: []` y hide-on-empty. El owner recarga los reales como DATO por el editor.
  - Abrió backlog **#46** (editor visual), **#47** (galería variable — CANCELADO: la galería vive
    en /nosotros, ya construida), **#48** (vídeo), **#49** (editar los planes de Suscripción) y
    **#50** (arrastrar para reordenar).
- **SiteSetting — los datos PLANOS del negocio, editables** (2026-08-24, § CLAUDE.md
  "Config del negocio — SiteSetting"). nombre, tagline, descripcionFooter, whatsapp,
  instagram, emailRemitente, emailReplyTo, adminEmail salieron de `siteConfig` (código)
  a la tabla `SiteSetting` (singleton `id='default'`, born en `public`, SIN `tenant_id`
  — no fija la tenancy). Editor lectura↔edición en Configuración. Dos loaders (RAW
  `readSiteSettings` para no-renders/carril; `getSiteSettings` cached/server-only para
  renders). `ADMIN_EMAIL` retirada → `SEED_OWNER_EMAIL` (seed) + `SiteSetting.adminEmail`
  (runtime), con guard en el PATCH de automatizaciones. Estructurados (`emailColors`,
  `footerNav`, `legalNav`) siguen en código. Abrió backlog **#43** (cinco internas
  apagadas en prod — antes del go-live).
- **Tandas 1 y 2** (drawers, detalle de Pedidos) + correctores C1–C5.
- **Tanda 3** (layout del split con scroll por columna) y sus tres prerequisitos.
- **Backlog #24** (alto fijo en Inventario), **#17**, **#9**, **#7**.
- **Tanda A**: carril "Por verificar" en Pedidos.
- **Decisión de cobro implementada** (§4).
- **Filtros de período compartidos**: `PresetsPeriodo` + `opcionesPreset` (Pagos e
  Inventario) y el fix de "un período en curso termina HOY" (no arrastra días futuros).
- **Pagos: el rango se filtra en SQL** — abre en el mes en curso, con presets.
- **Dos defectos del date-range picker**: flechas de nav a la esquina superior
  (`relative` + `top-1` + la clave `month_caption` que el rename v8→v10 perdió) y
  dropdowns de mes/año (`captionLayout`, con piso navegable en el año anterior). Abre
  backlog #26.
- **Pagos: región de alto fijo** (`.duna-sin-split`, gate 960) — cabecera fija, la
  tabla scrollea. Es LAYOUT, no el rediseño visual (el strip Duna va aparte). Con esto
  la nota Wompi salió de la pantalla → § Mejoras post-multitenant.
- **Botón de limpiar filtros unificado**: "Limpiar filtros" + `FilterX` sobre
  `duna-btn ghost sm`, en Inventario (era "Quitar filtros", sin ícono) y Pagos (era
  `Button` shadcn + `X`).
- **Pagos al lenguaje Duna** (re-skin, sin el strip): `DunaTable` (sticky), select
  nativo `.duna-select`, stats `.duna-stat` con "Promedio por pago", total **sin
  verde**, y la rama ámbar "Por verificar" **borrada** (imposible bajo el modelo de
  cobro). El Soporte pasó a clip neutro (sólo VERIFICADO). Backlog #27 abierto.
- **`--duna-serie-1…5`**: rol de color NUEVO —categórico: identifica, no califica—,
  su propio commit antes del strip. serie-4 movida a cyan (`#2496AB`/`#52C0D6`, el
  teal competía con `ok`); piso de la paleta contra estados ~22 ΔE2000 en ambos temas.
  Doctrina en CLAUDE.md (§ La serie categórica) + bloque en `reference.html`. Sin
  consumidores aún: existe para el strip.
- **El strip de Pagos**: barras sobre el tiempo (bucketeo puro con escalera de 31 +
  colapso <4 + semanas de lunes, capa 1), **ejes intercambiables** (tiempo ↔ método con
  la regla "el eje nunca se filtra a sí mismo"), **grid-list `.admin-lista`** (reemplaza
  a DunaTable en Pagos; el sticky en scroller compartido se MIDIÓ), **celdas navegables**
  (fecha/método), y el dropdown por cómo llega la plata. Doctrina en CLAUDE.md; backlog
  #28 (extraer `.admin-lista` al DS cuando el kardex migre).

### Infraestructura
- **Monorepo** npm workspaces: `packages/core` (schema Prisma, data-access) y
  `packages/design-system` (tokens `--duna-*`, primitivas `duna-*`,
  `reference.html` como prueba viva).
- Chrome del panel migrado al design-system. Panel funcional en móvil (bottom
  sheet, barra inferior). Diálogos Duna (H6) y controles de formulario completos.

---

## 3. El modelo de layout

### El umbral del split NO es un número elegido — se deriva

`--duna-panel-min: 320px` es el piso del panel de detalle:

```
rail 240 + padding 48 + lista 400 + gap 24 + panel 320 = 1032 → se redondea a 1080
```

A 960 el panel medía **248px**, ancho de teléfono para un detalle de 12
secciones. **Si cambia el rail, la lista o el padding, el umbral se recalcula.**

### Dos breakpoints, cada uno nombrado por su ROL

| Constante | Valor | Pregunta que responde | Gemelo CSS |
|---|---|---|---|
| `DUNA_BP_DETALLE_AL_LADO` | 1080 (`layout.ts:39-40`) | ¿caben dos columnas? | colapso de `.duna-split` |
| `DUNA_BP_SHEET_ABAJO` | 960 (`layout.ts:42-43`) | ¿es chrome de una mano? | rail, barra inferior |

Hooks: `useDetalleAlLado()` y `useSheetDesdeAbajo()`. **No nombrar por
breakpoint** — el nombre viejo `useEsMovil` decía "dispositivo" y decidía
"layout", y esa mentira costó una ronda entera. Cada gemelo CSS y su hook **se
mueven juntos**.

### Tres rangos, tres conductas

| Ancho | Chrome | Detalle |
|---|---|---|
| ≥1080 | rail | panel al lado, columna con scroll propio |
| 960–1080 | rail | `DunaSheet --lado`, modal (scrim/Escape/clic-fuera) |
| <960 | barra inferior | `DunaSheet --abajo`, document-scroll |

El componente de detalle se monta en los tres contenedores **sin una sola rama de
contenido**. Si alguna vez hace falta un `if` por rango dentro del detalle, el
diseño está mal.

### Selección ≠ visibilidad

`abierto = !detalleAlLado && !!elegido && sheetAbierto`. Al cruzar de panel a
sheet **la selección se conserva** pero el sheet **no se abre**: se abre por
acción. Un resize no es una intención. La X del sheet **sí** limpia la selección.
Un deep link `?pedido=` **sí** abre el sheet.

`useDetalleAlLado` reporta `true` en el snapshot de servidor, así que **todo lo
que dependa de él espera a la hidratación**.

### La cadena de altura (donde falla silencioso)

La altura la provee el **chrome**, opt-in por página. El page root **no puede
calcularla**: vive debajo del chrome y no sabe qué ocupa.

```
1  .admin-shell                         layout.tsx:98
2  .min-h-screen div                    AdminChrome.tsx:60
3  <main> :has(.duna-pantalla-fija)     → height:100dvh   AdminChrome.tsx:74
4  wrapper .p-6 > div                   → height:100%     AdminChrome.tsx:87
5  page root .duna-pantalla-fija        → height:100%; grid auto 1fr
6a .duna-cabecera (auto)                header, no scrollea
6b .duna-region (1fr)                   flex col; min-height:0
7  .duna-split                          flex:1 → columnas overflow-y:auto
```

**`calc()` está prohibido en esta cadena.** Se probó `calc(100dvh − topbar)` y
desborda por exactamente el alto del chrome; el header además es de alto variable.
**Un solo nivel sin `height:100%` o sin `min-height:0` colapsa toda la cadena**, y
el síntoma es indistinguible de "el cambio no se aplicó".

### La región: el general y su excepción

`.duna-region > *` es la regla **general** — el hijo único encoge y scrollea. El
**split es la excepción declarada** que además llena (`grow: 1`).

**Nunca nombrar el general como variante del especial.** El scroll lo da `shrink`
+ `min-height:0` + `overflow-y:auto`; **`grow` solo estira el contenido corto**, y
eso es un defecto (tarjeta vacía inflada a 600px). Contenido corto se sienta
arriba a su alto natural.

### El padding asimétrico de los scrollers de tarjetas — NO es arbitrario

Los scrollers que sostienen tarjetas —`.duna-split__list` (primitives.css) y
`.duna-cards` (duna.css)— llevan `padding: 4px 4px 16px` (arriba/lados/abajo), y la
asimetría **no se limpia**. El hover de la tarjeta la **levanta** (`translateY -1px`)
y proyecta `--duna-shadow-2`; con padding 0, el borde del PRIMER hijo y la sombra del
ÚLTIMO se recortan contra el borde del `overflow` —se lee como error de render, y solo
aparece desde que la columna es su propio scroller—.

- **Arriba 4px** (`--duna-space-1`): el mínimo token que cubre el borde de 1px del
  lift. Más arriba se lee como HUECO entre la cabecera y el primer card (se probaron
  20px y 16px simétricos; los dos sobraban).
- **Abajo 16px** (`--duna-space-4`): contiene la sombra del último card. Ahí el aire
  NO se percibe —no hay nada bajo la lista que lo delimite—.
- **Lados 4px** (`--duna-space-1`): mínimo; el recorte lateral es contra el borde de la
  columna (tolerable) y el ancho de lista (400px) es caro.

Depende de `box-sizing:border-box` (§ el reset de `.duna *`): el padding entra DENTRO
de la altura, así que no desborda la cadena de arriba. Mismos tokens en los dos
scrollers, con comentario cruzado para que no diverjan.

### Tokens vigentes

| Token / umbral | Valor | Dónde |
|---|---|---|
| `--duna-list-w` | 400px | `tokens.css:215` |
| `--duna-panel-min` | 320px | `tokens.css:224` |
| `--duna-topbar-h` | 52px (default DS) / 64px (admin) | `tokens.css:205` / `duna.css:93` |
| `DUNA_MQ_DETALLE_AL_LADO` | max-width 1079.98 | `layout.ts:40` |
| `DUNA_MQ_SHEET_ABAJO` | max-width 959.98 | `layout.ts:43` |
| Alto fijo de Inventario | min-width 960 | `duna.css:173` |

`thead` de `.duna-table` es sticky siempre-on (fondo `--duna-bg`, separador por
`box-shadow`). El `pt` del `<main>` deriva de `--duna-topbar-h`. `html.admin`
lleva `scroll-padding-top`.

---

## 4. El eje de cobro (implementado, `308f32b`)

Documento completo: **"Cuándo un pedido está pagado"** en `CLAUDE.md`.

**La regla:** el `Payment` nace del veredicto cuando hay comprobante de por medio;
nace directo cuando no lo hay.

| Camino | Qué pasa |
|---|---|
| Llega un comprobante | RECIBIDO. La orden **no** se paga. Entra al carril "Por verificar" |
| El operador **verifica** | **Crea el `Payment`** → la orden pasa a `pagado` |
| El operador **rechaza** | La orden sigue pendiente. No hay `Payment` que revertir |
| Efectivo / contraentrega | `Payment` directo, sin comprobante |
| `Registrar Pago` sin adjunto | `Payment` directo |

- **`registerOrderPaymentTx` es el único escritor de dinero.** Verificar es su
  tercer llamador, no un camino paralelo.
- **El comprobante adjuntado desde `Registrar Pago` nace VERIFICADO** (mismo actor
  y timestamp del pago). Si naciera RECIBIDO, le pediría al operador que juzgue
  una decisión que él mismo acaba de tomar.
- **`FOR UPDATE` sobre `Order` + re-lectura del estado dentro del lock** es lo
  único que impide dos `Payment` con dos comprobantes concurrentes. No hay unique
  en la base. Probado viéndolo fallar sin el lock.
- **`order.pagado` se dispara desde este camino también** (es el tercer llamador).
  Probado viéndolo fallar sin el disparo.
- **Monto = `order.total`, server-side.** El comprobante no lleva importe.
- **Fecha de negocio editable**: "Fecha en que entró el pago" · hint "La fecha del
  movimiento en tu cuenta". Default hoy, **sin futuro** (guarda en
  `registerOrderPaymentTx` + tope en el input), anclada al inicio del día en
  Bogotá (`dayKeyStart`).
- **EFECTIVO queda fuera del select en el flujo con comprobante** — no es un
  default malo, es un valor imposible. Guarda de servidor además del select.
- `Payment` + comprobante RECHAZADO es una **combinación imposible**.

### Divergencias con el modelo de Carlos (para el día del puente)

Hoy **no hay puente**: dos stacks separados, sin API compartida. Un pedido de
tienda es invisible para su lado (`duna-orders` es WhatsApp-only).

| | Carlos | Nosotros |
|---|---|---|
| Entidad del dinero | ninguna — el pago **es** el comprobante | `Payment` + `Comprobante` |
| "Pagado" se deriva de | existe un comprobante `verified` | existe un `Payment` |
| Efectivo | sin artefacto, pasa por ausencia de bloqueo | `Payment` con asiento |
| Canal | solo WhatsApp | whatsapp · directo · tienda |

**Vocabulario reservado, no adoptado:** `insufficient` y `superseded` son el
modelo de pago parcial de Carlos (`superseded` es automático, no un veredicto).
Adoptarlos sin el mecanismo crearía estados con cero escritores. El día que exista
pago parcial, esos son los nombres.

**Autoridad, cuando haya puente:** el panel no puede depender de que exista un
operador de WhatsApp. Un solo veredicto — si el operador verifica, el admin lo ve
verificado y no re-verifica. Ruling pendiente con Carlos.

---

## 5. Doctrina de diseño (no re-litigar)

1. **El color es información, no decoración.** Ámbar/sol = *esto necesita tu
   atención ahora*. Verde = confirmado/pagado. Rojo = problema. Sin rol azul.
2. **"En curso" no es un color, es una posición.** Impuesto por tipos.
3. **Colas sí, acumuladores no.** Pill con número solo si la cola se vacía.
4. **Mostrar menos antes que mentir.** Sin dato → se omite. Los cortes se declaran.
5. **Una acción sin su evidencia obliga a decidir a ciegas.**
6. **Fuente única**: un criterio, N consumidores.
7. **El sol pertenece a donde se RESUELVE el hecho, no a donde se lista.**
8. **Cifras de negocio → Analítica**, salvo en pantallas que SON de análisis.
9. **Un tinte `-soft` sobre imagen pierde su contrato de contraste.**
10. **Los tres roles del ámbar**: `--duna-sol`, `--duna-sol-soft`, `--duna-sol-ink`.
11. **Ningún color literal, nunca.** Ni hex, ni `rgb()`, ni utilidades shadcn. Si
    el token no existe, Code **para y pregunta**.
12. **Navegable no es lo mismo que coloreado.** Enlace en tinta; el ícono de
    enlace externo se reserva para destinos externos.
13. **Máximo un primario, no exactamente uno.** Una pantalla puede no tenerlo.
    Pero Inventario **sí**: "Ajustar stock" es su única escritura.
14. **Un botón deshabilitado dice qué falta**, pero no dice "no hay cambios que
    guardar" — eso es redundante con el botón apagado. La ranura vacía no reserva
    alto.
15. **Los pills de conteo van planos.** El sol marca dónde actuar (el badge de la
    fila); teñir también el conteo sería un segundo canal para el mismo hecho.

---

## 6. Doctrina de arquitectura

- **Opción C, sostenida seis veces**: la **forma** en el paquete, la **conducta**
  en el consumidor. `packages/design-system` no tiene una sola pieza con
  comportamiento.
- **El paquete es agnóstico** de dominio, idioma y tenant. **`packages/core` es
  agnóstico** de tenant, color y presentación.
- **Un solo embudo de salida.** Toda salida de un formulario sucio pasa por
  `intentarSalir` — cerrar, cambiar de registro, enlaces internos. Una puerta
  nueva **abre el agujero de nuevo** y se conecta en el mismo commit.
- **No persistir borradores.** Ni en localStorage, ni sobreviviendo al cambio de
  registro. **Sí** deben sobrevivir al remontaje por cambio de contenedor.
- **El estado que debe sobrevivir a un remontaje vive en el padre que no se
  remonta.** React reconcilia por posición.
- **Todo hueco se llena en el sistema, con su bloque en `reference.html`** — y el
  bloque ejercita el caso corto además del largo.
- **Nombrar por rol**, no por caso de uso ni por valor.
- **Fase B** (partir en `apps/admin` + `apps/storefront`) no está hecha.

---

## 7. Proceso de trabajo

- **Discovery antes de escribir, siempre.** Ha evitado errores caros 12+ veces.
- **Un commit por naturaleza de cambio.** Un refactor que solo renombra debe poder
  verificarse sin que nada cambie de aspecto.
- **Tres capas**: `tsc` · `npm test` (puras, con `tsx`, **NO es gate de tipos**) ·
  `test:integracion` (carril contra Postgres). La capa 3 (UI) es del owner.
- **Un test que afirma un mecanismo se corre SIN el mecanismo.** PERO: si el
  mecanismo no es observable desde las capas actuales, **no se inventa un test**
  — uno con modelo inventado pasa en verde contra el código defectuoso.
- **La herramienta de verificación también se verifica.** `grep -c` cuenta líneas
  no apariciones; un viewport 0×0 miente. Toda medición por tema lleva **aserción
  de cordura**.
- **Cuando un arreglo se aplica y el síntoma persiste, el diagnóstico estaba
  incompleto.**
- **Nada a `main` sin preview verde + gate del owner** (server frío, sesión, ambos
  temas, teléfono real). El preview EXISTE porque la rama se pushea antes del merge
  (§ El flujo permanente: rama → preview → gate → merge).
- **Estado de `main` con fetch fresco, verificado por CONTENIDO.**
- **"El gate es verde" es vocabulario prohibido para Code**: verdes están las capas
  1 y 2; la capa 3 es del owner.

### El tripwire
Cuando el owner prescribe una forma técnica, la instrucción lleva: *"si esto no
funciona por algo que no vemos, PARA y repórtalo — no lo resuelvas volviendo a
X"*. Ha funcionado dos veces (el `calc` del shell, el test sin harness).

### Sobre las maquetas y los repos de Carlos
Se leen **solo lectura**, nunca se copia código. Intención de forma → se adopta.
**NO** fuente de valores. **NO** fuente de alcance — han dibujado features sin
modelo seis veces. Un dato que nuestro schema no tiene **no existe**.

---

## 8. Backlog

**Fuente de verdad: `CLAUDE.md`.** No se duplica acá — dos copias divergen.

Reglas: va ordenada y **el orden es la decisión**; el número es identidad, no
posición. Cada entrada dice el **costo ya pagado**. Un ítem completado **se borra**.

Vivos, **en el orden de `CLAUDE.md`** (el orden es la decisión): **`#46`** (primero —
el editor visual) · `#3` · `#4` · `#18` · `#19` ·
`#20` · `#21` · `#25` · `#26` · `#27` · `#32` · `#34` · `#35` ·
`#37` · `#39` · `#41` · `#49` · `#51` · `#52` (Ingresar con WhatsApp — capacidad
que no existe; disparador: cuando el login por WhatsApp exista) · `#53` (swipe-to-dismiss
en los sheets) · `#54` (favicon derivado del wordmark — motor de ImageResponse, era del storefront).
**(#55 —la paleta al flujo de borrador— y #56 —el manifest del panel es del cliente— CERRADOS (ver
sus secciones arriba). Quedan 21 ítems; los que
describen un defecto concreto —#18,#19,#21,#25,#26,#27,#32,#34,#37,#39— se VERIFICARON contra el código.
`#5`, `#8` y `#10` eran la familia "campo que le falta su otra mitad"; los tres se
CERRARON el 2026-08-27, abajo.)**

**`#5` CERRADO con su FIX (owner, 2026-08-27) — el PATCH de cliente ahora es PARCIAL.**
El endpoint escribía los campos con fallbacks (`email || null`, `canal || 'directo'`);
mandar un campo suelto borraba el resto. Era técnico puro (no decisión de producto): se
copió el patrón probado `datosDelPatch` + `trae` a `packages/core/src/customer-update.ts`,
y el route lo usa. Test de carril (`patch-cliente-parcial.test.ts`) VISTO fallar contra el
código de hoy, pasa con el fix. Doctrina en § CLAUDE.md "El PATCH de producto es PARCIAL —
el gemelo de clientes".

**`#8` y `#10` CERRADOS con salida-B (owner, 2026-08-27) — DOS drops de columna, dos
migraciones separadas.** La decisión de producto era la misma para los dos: la columna es
inerte, se dropea. Verificado por censo (schema, seed, mocks, tipos, formularios, la fórmula
`disponible`) y por conteo: **producción está en los defaults (0 clientes con `activo=false`,
0 productos con `agotado=true`, consola de Neon)**, así que el drop no cambia nada visible.
- **`#10` `Product.agotado`** (`drop_product_agotado`): bandera manual sin escritores; su único
  aporte sobre `stock=0` era "no vendible CON stock", que ya cubre `activo:false`. Ahora
  `disponible = stock > 0`. Lo derivado de stock (carril "Agotados", etiqueta de la tarjeta) NO
  se toca.
- **`#8` `Customer.activo`** (`drop_customer_activo`): su único lector —el `where activo:true` de
  `reactivacion_cliente`— era DECORATIVO (medido: con y sin él, 7 = 7). El predicado queda correcto
  porque las órdenes pagadas ya excluyen a quien nunca compró.
- **Orden de deploy seguro:** en cada commit el código-que-deja-de-leer viaja CON el drop, nunca
  después. Pre-lanzamiento sin tráfico → la ventana de build (migrate corre mientras el deploy viejo
  sirve) no golpea a nadie. Verificación: tsc 0 · capa 1 751/751 · carril 178/178 · next build OK.

**PODA del backlog (owner, 2026-08-27):** verificado contra el código, no la doctrina.
- **LECCIÓN (van TRES): podar leyendo TÍTULOS no sirve — se verifica contra el CÓDIGO.** Un item
  resuelto de paso conserva su título de "pendiente" y parece deuda. Está escrito en las reglas del
  backlog (§ CLAUDE.md "Backlog técnico"). Los tres: #16, #36 y **#2**.
- **`#2` CERRADO con evidencia y borrado:** el actor de `InventoryLog` YA está —columnas
  `ajustado_por`/`ajustado_por_nombre` + `orden_id` (schema), ESCRITURA por las dos puertas manuales
  (`inventory.ts:133`, `product-update.ts:180/215`, con el usuario de sesión desde las rutas), el
  SISTEMA marcado con `orden_id` y actor null en despacho/devolución (`fulfillment.ts:182/251`),
  LECTURA en el kardex (`inventario/page.tsx:319`, `—` para viejos/sistema), y TEST de carril
  (`kardex-actor.test.ts`)—. Estaba hecho; el título "no registra QUIÉN" lo hacía parecer pendiente.
- **Borrados (obsoletos, resueltos de paso):** **`#16`** (la campana ya migró a `--duna-sol` en
  el rediseño del Dashboard — el "accent-amber" que quedaba era un COMENTARIO) y **`#36`** (Órdenes
  Recientes → `.duna-lista` y `components/ui/table.tsx` RETIRADO, ambos en ese mismo rediseño).
- **`#33` CERRADO con evidencia y borrado:** el flujo se verificó completo —el canje (`handleSubmit`)
  hace `setError` en `!res.ok` y en el `catch` de red, y ese error SE RENDERIZA (`AvisoError`, línea
  197)—, así que NO falla en silencio. La carga degrada al form a propósito. No había defecto.
- **`#38` CERRADO (decisión del owner): la columna `total_compras` NO se dropea.** Una columna que nadie
  lee no cuesta nada; dropearla tocaría schema + seed + mocks por un riesgo de CONFUSIÓN, no de datos, y
  la trampa del nombre ya quedó DOCUMENTADA (§ CLAUDE.md #38, con el censo, para no re-medirla). Si el
  schema de `Customer` se toca por otra razón, sale de paso.
- **Borrado (no es deuda):** **`#50`** (arrastrar para reordenar — feature UX sin costo; su decisión
  vive en la doctrina del `RepeaterEditor`).
- **Salieron del backlog de DEUDA a "cómo continuar" (§10):** **`#23`** (barras de scroll tokenizadas)
  y **`#42`** (la banda de fondo) — son código **APLICADO, pendiente sólo del gate**, no deuda de build.
- **Disparadores reescritos a un HECHO observable:** #34 (un quinto consumidor que olvide el `__body`) y
  el de `.duna-sheet`/`.duna-scrim` al paquete (§ Duna OS en ANGOSTO → un tercer consumidor fuera del admin).
- **`#20` reencuadrado a IMAGEN:** su disparador de vídeo (el asset de 180 MB) se volvió IMPOSIBLE con
  el tope de galería de 20 MB; queda sólo comprimir las portadas de producto (storefront lento observado).

Cerrados y borrados: `#1`, `#22` (no por hacerse sino por resolverse solo — la
consolidación ya no aplica), `#43` (**decisión del owner**: las cinco automatizaciones
internas apagadas en producción se DEJAN apagadas; si se encienden, es operación de
datos desde el panel, nunca un `UPDATE` en migración), `#44` (los testimonios
fabricados salieron del código con la tanda de Testimonios), `#45`, `#47`
(**CANCELADO**: la galería variable no va en la home —el collage se queda en 4 fijas, el
anzuelo—; vive en /nosotros, ya construida en la tanda 2, donde se estrenó el tipo 'imagen'
del RepeaterEditor con masonry por proporción) y **`#48`** (VÍDEO en la galería — CONSTRUIDO
en la tanda B; en `CLAUDE.md` queda como diseño enviado, no como deuda).

---

## 9. Decisiones estructurales que no se reabren

- **Dos modelos de scroll conviven a propósito — y es el estado FINAL, no deuda.**
  Listas (Pedidos, Clientes, Productos, Inventario, Pagos) → alto fijo; contenido y
  formularios (Dashboard, Analítica, Automatizaciones, Configuración, Perfil) →
  document-scroll. El opt-in por página (`.duna-pantalla-fija` / `.duna-sin-split`) es
  el diseño permanente; NO hay un "shell global" pendiente. Cerró `#22` (§ CLAUDE.md
  "Los DOS modelos de scroll conviven a propósito"). `#25` sigue vivo aparte.
- **El auto-select** re-evalúa al cambiar carril, rango o buscador. Si el
  seleccionado sigue presente **se conserva**; si no, se toma el primero; carril
  vacío → placeholder. El deep link gana en la carga inicial. Alcance: Pedidos y
  Clientes. **Productos se salta.**
- **Los carriles filtran, no clasifican.** Una orden puede estar en varios a la
  vez (p. ej. "Por verificar" y "Por cobrar"), sin precedencia.
- **Las dos puertas de escritura de stock se conservan.** Todo dato nuevo del
  asiento debe enhebrarse por las DOS.
- **La frontera Productos / Inventario**: Productos responde *"¿cómo está este
  producto?"*; Inventario, *"¿qué pasó con el stock?"*. La cola de reposición vive
  **solo** en Productos.
- **`OrderStatusTransition`** es append-only, actor como snapshot sin FK, orden
  `[occurred_at asc, id asc]`. Sin backfill.
- **El contrato con Carlos**: coexistencia, no unificación. El merge físico está
  gateado a que exista un piloto vivo; hoy hay cero.
- **`is-saving` NO reemplaza a `useAccionGuardada`** — la guarda real contra
  doble-submit es el ref síncrono. Vale doble ahora que verificar mueve dinero.
- **Una mutación jamás depende de que el diálogo que la disparó siga montado.**
- **No hay `AbortController`** en `lib/api/`: navegar a mitad de un guardado no
  aborta la escritura.
- **"Ingresos" = `Payment.monto`** (plata que entró, con envío). La base del
  margen en Analítica es **"Venta de mercancía"** (`OrderItem.subtotal`, sin
  envío). Dos bases, dos nombres.
- **Decidido NO hacer:** retirar el buscador de sección; persistir borradores;
  primitiva de disclosure en el DS; `picked_up_count` (somos delivery-only).

---

## 10. Cómo continuar

**TODAS las pantallas del panel están rediseñadas** (Pedidos, Clientes, Productos,
Inventario, Pagos, Analítica, Automatizaciones, Dashboard, Configuración/Equipo,
Perfil) **y el storefront ya es editable** (`/admin/tienda`, las cuatro secciones de la
home). No queda una vertical heredada del template. Lo que queda es acabado, no
pantallas nuevas ni consolidación (`#22` cerró — los dos modelos de scroll son el
estado final, § 9):

1. **`#23`** (barras de scroll tokenizadas) — **YA APLICADO, pendiente sólo del gate
   visual.** Regla HEREDADA en `html.admin` (`scrollbar-width: thin` + `scrollbar-color`),
   sin `::-webkit-scrollbar`, track transparente. **El pulgar es `--duna-muted`, NO
   `--duna-border-2`** —medido: border-2 daba 1.30:1 / 1.53:1, bajo el 3:1 de un
   componente UI; muted da 4.62 / 6.27—. Cierra cuando el gate confirme el pulgar
   visible sin banda, en ambos temas.
2. **`#42`** (la banda de fondo bajo el alto fijo) — **YA APLICADO, pendiente del gate.**
   **La causa NO era el canvas del root:** esa hipótesis se aplicó y se REVIRTIÓ por
   falsa. La banda son los **24px de `padding-bottom` del `p-6`** del wrapper de
   `<main>`, atrapados dentro del viewport cuando la cadena de alto fijo le pone
   `height:100%`. Fix: `padding-bottom: 0` en esos dos wrappers, scopeado por el
   `main:has(...)` que la cadena ya usa. En el gate hay que mirar además que la última
   fila de Inventario/Pagos no quede a ras.
3. Backlog cuando sus disparadores se cumplan. Entre ellos **#41** (qué pasa con un
   pago cuando la orden se cancela), **#46** (el editor visual — el primero de la lista),
   e `InviteUserModal` → `DunaDialog` con los diálogos que le faltan a H6.

**Y lo que sigue del storefront no es panel:** las secciones que faltan son las que la
home no tiene todavía (páginas legales, `legalNav` vacío) y la **capa de TEMA por
cliente** —colores/fuentes como configuración—, que está gateada al multi-tenant y al
SEGUNDO cliente (§ Mejoras post-multitenant en `CLAUDE.md`).

### El flujo permanente: rama → PREVIEW → gate → merge → borrar la rama remota

**La rama de trabajo se PUSHEA a origin ANTES del merge**, para que Vercel construya
su preview. El owner corre el gate sobre ESE preview —que apunta a **development** y por
tanto tiene datos— y recién después se mergea. La rama remota se borra tras el merge.

Es un cambio de flujo permanente, y la razón es que sin él la regla de abajo ("nada a
`main` sin preview verde") era **imposible de cumplir literalmente**: las ramas vivían
sólo en la máquina local y se borraban tras el merge, así que Vercel **nunca** les
generaba preview (el último era del 16 de ago). Se gateaba sobre nada, o sobre el deploy
de `main` —que tras la purga pre-lanzamiento **no tiene datos transaccionales**
(Payment/Order/Customer ≈ 0), así que no sirve para un gate visual con datos—.

- **El preview apunta a `development`, no a producción** (§ CLAUDE.md "Bases de datos":
  desde el 2026-08-02 Preview tiene env vars propias a `ep-still-sound`). Por eso tiene
  datos —dev: ~11 pagos, 15 órdenes, 4 productos, 15 clientes— y por eso pushear la rama
  es **cero riesgo para producción**: el preview no la toca.
- **CONFIRMAR UNA VEZ**, antes de apoyar todos los gates en esto: que las env vars de
  Preview en Vercel dicen `ep-still-sound`. La doctrina lo afirma, pero la doctrina no es
  evidencia del rol de una base —esta misma sección se contradijo entre el 02 y el 04 de
  agosto—; el hostname del `process.env` de un preview lo cierra.
- **La rama remota se borra tras el merge** —el flujo local no cambia salvo el push extra
  antes de mergear—.

### Gates que solo puede correr el owner
Code no tiene sesión: **toda la capa 3 es del owner** — aspecto, flujos, ambos
temas, teléfono real. Para probar en teléfono, el camino que funciona es **el
preview de Vercel** (§ El flujo permanente: rama → preview → gate → merge).

Para el layout, el gate mínimo son **cuatro anchos**: 1440 y 1280 (split), 1000
(sheet lateral modal, rail visible), 800 (sheet desde abajo, barra inferior) —
más los **cruces con contenido a medio escribir**, que es donde un cambio de
contenedor rompe.
