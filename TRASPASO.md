# TRASPASO.md — contexto vivo del rediseño Duna OS

**Actualizado:** 2026-08-24 (SiteSetting — los datos PLANOS del negocio, editables
en Configuración; fase 1 del multi-tenant SIN fijar la tenancy).

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
| `/admin/productos` | Completa | Igual, con clase condicional (cuadrícula sin selección queda en document-scroll) |
| `/admin/inventario` | Completa, encogida a auditoría | Alto fijo ≥960 (`.duna-sin-split`), scroller único |
| `/admin/pagos` | Completa (frase + curva) | Alto fijo ≥960 (`.duna-sin-split`), scroller único; **el gráfico va en la zona fija** |
| `/admin/analitica` | Completa (cuatro preguntas de dueño, titulares) | Document-scroll (estado final — § Los DOS modelos de scroll) |
| `/admin/automatizaciones` | Completa (rejilla, señal de vida, historial) | Document-scroll (estado final — § Los DOS modelos de scroll) |
| `/admin/dashboard` | Completa ("Hoy": hero + curva por hora + top-hoy + tarjetas) | Document-scroll |
| `/admin/configuracion` | Completa. "Configuración" con DOS secciones: Datos del negocio (editor lectura↔edición) + Equipo y usuarios | Document-scroll |
| `/admin/perfil` | Completa (cuenta limpia + cambiar contraseña real) | Document-scroll |

### Pendientes de rediseño
**Ninguna.** Todas las verticales del panel están en lenguaje Duna; no queda una
pantalla heredada del template.

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
**Todas en document-scroll** (el `min-h-screen` por defecto de `AdminChrome`).
No son convivencias — son pantallas que aún no se tocaron.

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

Vivos: **`#43`** (primero — antes del go-live: cinco internas apagadas en prod) ·
`#2` · `#3` · `#4` · `#5` · `#8` · `#10` · `#16` · `#18` · `#19` · `#20` ·
`#21` · `#23` · `#25` · `#26` · `#27` · `#32` · `#33` · `#34` · `#35` ·
`#36` · `#37` · `#38` · `#39` · `#41` · `#42`. (`#1` y `#22` cerrados; `#22` no por
hacerse sino por resolverse solo — la consolidación ya no aplica.)

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
Perfil). No queda una vertical heredada del template. Lo que queda es acabado, no
pantallas nuevas ni consolidación (`#22` cerró — los dos modelos de scroll son el
estado final, § 9):

1. **`#23`** (barras de scroll tokenizadas) como tanda de acabado con gate visual
   propio. Técnica estándar (`scrollbar-width` + `scrollbar-color`, canal transparente,
   sin `::-webkit-scrollbar`); el pulgar en `--duna-border-2`.
2. **`#42`** (el hilo de fondo bajo el alto fijo): opción 1 = pintar el canvas del
   root (`html.admin`) con `--duna-bg`, sin tocar la cadena de altura. Si el gate
   muestra que no cubre el hilo, se PARA — tocar la cadena por un píxel se decide con
   el gate fallido delante, no antes.
3. Backlog cuando sus disparadores se cumplan. Entre ellos el de la última tanda de
   pantallas: **#41** (qué pasa con un pago cuando la orden se cancela), y ahora
   `InviteUserModal` → `DunaDialog` con los diálogos que le faltan a H6.

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
