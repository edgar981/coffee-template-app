@AGENTS.md

## PRECONDICIÓN — verificación local sobre dev server reiniciado EN FRÍO

Toda verificación manual en local se corre contra un dev server **reiniciado con
`.next` limpio**. No sobre el que quedó abierto de la sesión anterior.

```bash
rm -rf .next && npm run dev
```

**El motivo es que un artefacto rancio no se ve como un artefacto rancio: se ve
como un bug en el código nuevo.** Y el diagnóstico que provoca es caro, porque
todo lo demás está correcto — la fuente, el dato, la config— así que se busca el
error en el único sitio donde no está.

Incidente 2026-08-04 (segundo fantasma de HMR de la semana): la campana no
notificaba una orden del storefront. La fuente tenía el emisor
(`app/api/checkout/route.ts`), pero `.next/dev/server/app/api/checkout/route.js`
lo traía con **cero** apariciones, mientras el MISMO servidor había compilado
`inventory/adjust` dos minutos después **sí** con el código nuevo. Un módulo
nuevo importado por una ruta ya compilada es el caso que más lo dispara.

Cómo se confirma en 10 segundos, antes de abrir cualquier otra hipótesis —
grepear el ARTEFACTO, no la fuente:

```bash
grep -c "miFuncionNueva" .next/dev/server/app/api/<ruta>/route.js
```

Cero apariciones con la fuente correcta = artefacto rancio, no bug. La fuente
nunca es evidencia de lo que el servidor está ejecutando; ése es el mismo modo de
falla que la regla de las bases de datos (§ Bases de datos): **lo que está escrito
no prueba lo que está corriendo**.

Aplica también al `AutomationSetting` de las automatizaciones y a cualquier
toggle: antes de declarar que algo "no dispara", verificar que esté ENCENDIDO en
la base, no en la memoria de quien lo miró. Una fila existente siempre gana sobre
el `defaultActivo` del registry — por diseño.

### AGENDADO — decidir si el repo tendrá tests con base

**Decisión pendiente, con fecha: el cierre de la campana del operador.**

Hoy la suite es 100% pura (`node --test` sin `--env-file`), así que **ninguna
cadena que termine en un INSERT está cubierta** — ni
`resolveOrderLines`, ni evento→motor→canal→`Notification`. Los tests de esas
features cubren sus reglas puras y eso es todo lo que miden; un "todo verde" NO
es evidencia de que el pipeline escriba.

Caso de costo, para que la decisión no se tome en abstracto: el mismo 2026-08-04,
la suite reportaba 143/143 mientras la cadena de la campana no escribía una sola
fila. Lo que encontró el fallo fue un checklist manual del owner, dos rondas de
diagnóstico y este documento. Un test de cadena lo habría atrapado en segundos.

Lo que hay que decidir no es "¿tests?" sino contra QUÉ base corren y quién la
levanta: nunca `development` (la comparten previews y el `.env` local — ver
§ Bases de datos), así que la opción es una base efímera por corrida. Hasta que
se decida, **al reportar una suite verde hay que decir explícitamente qué queda
fuera**; omitirlo es lo que convirtió un dato correcto en una impresión falsa.

## Doble-submit — la guarda va en DOS mitades, y no son redundantes

Todo botón que dispare una mutación lleva las dos. El patrón de referencia es
`handleSave` de Nueva Orden (`app/(admin)/admin/ordenes/page.tsx`):

- **`xRef` (síncrono)** — `if (xRef.current) return;` y se marca ANTES del primer
  `await`. Es lo ÚNICO que cierra la ventana del mismo tick.
- **`x` (estado)** — `disabled={x}` + texto de estado intermedio ("Aplicando…",
  "Guardando…"). Cierra la ventana del re-click lento.

**Un `disabled` solo NO alcanza, y un ref solo tampoco.** `disabled` depende de un
re-render: dos clicks dentro del mismo tick leen ambos el estado en `false` y
pasan los dos. Y el ref, sin el texto visible, deja al operador sin señal — que es
lo que provoca el re-click en primer lugar: en el incidente del 2026-08-04 los dos
clicks llegaron con **2,5 s de diferencia**, no fue un doble-click, fue volver a
clickear porque el botón no decía nada.

Se bloquean también las otras dos salidas mientras la mutación viaja: Cancelar
`disabled`, y el Dialog sin cerrar por click-fuera ni Esc. Cerrar a mitad no
cancela nada en el server y deja al operador sin saber si se aplicó.

**Que el server sea idempotente no exime al botón.** El ajuste de inventario
`tipo: 'ajuste'` fija valor absoluto, así que el doble-submit no corrompió stock —
pero `entrada`/`devolucion`/`salida` son delta y ahí sí duplican. La guarda es del
botón, no del tipo de operación.

### AGENDADO — deuda de esta familia, en orden

1. **`stock_anterior` se lee FUERA de la transacción** en
   `/api/inventory/adjust`: dos peticiones concurrentes snapshotean el mismo
   valor y el kardex reporta dos movimientos donde hubo uno. Es la mitad SERVIDOR
   del mismo bug y con tipos delta produce movimiento doble real. **Va antes que
   los errores inline.** (Evidencia: dos filas `7→28` idénticas el 2026-08-04, a
   749 ms; se limpiaron de dev por DELETE registrado.)
2. **Una supresión por cooldown/idempotencia debe DEJAR RASTRO.** Hoy
   `ejecutarObjetivo` retorna `DUPLICADO` **antes** de `registrarRun`, así que no
   escribe nada: desde la base, "callé porque el cooldown lo pidió" y "callé
   porque estoy roto" **se ven idénticos — cero filas en los dos casos**. Costó el
   diagnóstico completo de la tarde del 2026-08-04, y solo se distinguió
   calculando a mano la ventana contra el run anterior.

   Misma filosofía que el borrado OMITIDO del blob (`isDeletable` en
   `lib/storage.ts`: no-op **pero con log**, porque no es rutina sino una señal) y
   que el `Objetivo.omitir` que ya existe acá: **una guarda que actúa en silencio
   absoluto no se puede auditar.**

   Dos apuntes que cambian el tamaño de la tarea:
   - `DUPLICADO` **ya existe** en `RunSummary` (el reporte del cron) pero **no en
     el enum `AutomationRunEstado`** de la base. El concepto está a medio hacer:
     hoy se puede reportar en la respuesta del cron y no se puede persistir.
   - Persistirlo (como `SUPRIMIDO` o reusando `DUPLICADO`) es **valor nuevo de
     enum → MIGRACIÓN**. Sería el **primer PR con migración** desde el 2026-08-04,
     así que de paso cierra la verificación diferida (2) del pipeline (§ Migraciones
     y deploy). Vale planearlo con esa doble intención.
3. **Guarda `R` uniforme** en los 8 modales que hoy solo tienen `disabled`. No
   corren riesgo material —el server los cubre por idempotencia o por bloqueo de
   fila (el POST de pagos hace `SELECT … FOR UPDATE` + chequeo de estado)—, así
   que es consistencia, no incendio.
4. **Botones de fila de Entregas** (`updateEstado`, `handleDispatch`): sin guarda
   alguna. Los absorbe el server por bordes idempotentes (`justDelivered`,
   `stock_descontado_at`), pero la dimensión aplica igual.

## Imágenes en `public/`

Los archivos de imagen en `public/` son inmutables: nunca sobrescribir
contenido bajo el mismo nombre. Todo reemplazo de imagen usa un nombre
nuevo (sufijo `-v2`, `-v3` o timestamp) y se actualizan las referencias
(DB, seed, código). Motivo: la URL es la clave de caché del navegador y
del optimizador de Next — mismo nombre con contenido nuevo = cachés
sirviendo la versión vieja indefinidamente. Cuando exista upload de
imágenes en el admin, el nombre debe incluir hash o timestamp
automáticamente.

Esa última frase ya está CUMPLIDA para las imágenes subidas desde el admin
— ver la sección de abajo. Las estáticas de `public/` siguen exactamente
con esta regla: no se migran y se renombran a mano.

## Storage de imágenes de producto

Las imágenes que se suben desde el admin NO viven en `public/`: en Vercel
el filesystem es de solo lectura en runtime, así que escribir ahí es
imposible, no una opción descartada.

- **Proveedor v1 = Vercel Blob, y SOLO a través de `lib/storage.ts`.**
  Ningún otro archivo del repo importa `@vercel/blob` (verificable con un
  grep, y es la condición que hace barata la revisión de proveedor). El
  adaptador expone una interfaz propia y mínima: `storage.put(file, opts)
  → { url }` y `storage.delete(url)`. No devuelve ni acepta un solo tipo
  del SDK.
- **La decisión de proveedor es REVISABLE.** R2 es candidato al pasar a la
  arquitectura multitenant de Duna (misma cuenta de Cloudflare, egreso
  gratis). El costo de ese cambio debe mantenerse en "reimplementar
  `lib/storage.ts`" y nunca en tocar call sites; si alguna vez hace falta
  tocar un call site para cambiar de proveedor, la abstracción se rompió y
  eso es el bug.
- **El prefijo del pathname es el futuro SCOPE POR TIENDA.** Hoy default
  `productos/`, parámetro del adaptador (`PutOptions.prefix`), no una
  constante incrustada en cada llamada. El día del multitenant pasa a
  `<storeId>/productos/` sin tocar quien lo llama.
- **Aislamiento por entorno, porque el store es UNO SOLO.** Blob no tiene
  ramas como Neon. El adaptador antepone `dev/` a todo lo que no sea
  `VERCEL_ENV === 'production'`. Local y previews escriben en
  `dev/productos/`; producción en `productos/`. **Esta condición es AHORA
  la única de su tipo en el repo**: el build tenía la misma y se retiró el
  2026-08-04 (cada entorno migra su base). No "unificarlas" leyendo una
  versión vieja de este doc — Blob tiene UN store y por eso necesita el
  prefijo; Neon tiene una base por entorno y por eso no necesita la
  condición. Limpiar pruebas jamás puede tocar un blob real. El cálculo
  del prefijo está testeado (`lib/storage.test.ts`); es deliberadamente
  conservador: sin `VERCEL_ENV` se asume NO producción, de modo que el
  error posible es ensuciar `dev/`, nunca el prefijo real.
- **El nombre lo hace único el proveedor** (`addRandomSuffix: true`), que
  es como se cumple de fábrica la regla de hash automático de la sección
  anterior. La URL es entonces una clave de caché inmutable.
- **El store es PUBLIC — decisión deliberada.** Las URLs son legibles por
  cualquiera con el link, que es lo correcto para imágenes de catálogo (van
  a un storefront abierto) y lo que permite que `next/image` las optimice
  sin credenciales. **NO usar este adaptador para documentos, adjuntos ni
  datos de clientes** sin revisar antes esta decisión.
- **El borrado del blob viejo lo hace el SERVER**, en el `PATCH` y el
  `DELETE` de `/api/products/[id]`, comparando contra la imagen que ya
  tenía el producto. No se recibe del cliente a propósito: si el borrado se
  disparara con una URL enviada por el navegador, cualquier admin podría
  borrar cualquier blob del store mandando otra. Va siempre DESPUÉS de
  confirmar el cambio en DB y sin poder tumbarlo — un blob huérfano es
  basura barata; un producto apuntando a una imagen ya borrada, no.
- **`storage.delete` ignora lo que no administra** (`isManaged`): una URL
  relativa de `public/` o externa es un no-op. Los productos sembrados nacen
  apuntando a `/images/*.webp`, así que esta guarda es la que impide que
  editar uno de ellos intente borrar un estático — la regla de
  inmutabilidad de `public/` queda imposible de violar desde el admin.
- **Al reemplazar portadas del seed, revisar `imagenes[]` por estáticas
  residuales**: subir la portada nueva cambia `imagen` a un blob pero deja la
  ruta `/images/*.webp` sembrada dentro de `imagenes[]`, y como ya son URLs
  distintas la dedupe (correctamente) no las colapsa → el detalle muestra dos
  miniaturas. Es metadata, no storage: se limpia con `imagenes: []` y no borra
  nada del store. Los 4 de Nayoli se limpiaron así el 2026-08-03.
- **Y un entorno NO-PRODUCTION solo puede borrar bajo su propio `dev/`**
  (`isDeletable`). Un blob del prefijo real se trata como si no fuera
  nuestro: no-op, pero CON log (no es rutina, es una señal). Producción
  borra sin restricción de prefijo — sus blobs son suyos.

  El motivo no es teórico: la base `development` se re-crea por **reset
  desde `production`**, así que después de cada reset las filas de dev
  apuntan a los blobs REALES que producción está sirviendo. Sin esta
  guarda, probar un reemplazo de imagen en local dispara el borrado del
  `PATCH` sobre esa URL heredada y tumba la imagen del catálogo en vivo.
  Ojo con el razonamiento fácil: el aislamiento de `put` NO cubre este caso
  — lo que se borra no es lo que subimos, es lo que vino en la copia de la
  base. El `dev/` que se permite borrar sale de `envPrefix`, el mismo que
  decide dónde se escribe, para que no puedan divergir. Testeado en
  `lib/storage.test.ts`.
- **Env vars:** el código depende SOLO de `BLOB_READ_WRITE_TOKEN` (el SDK
  lo lee por convención). El connect del store también creó `BLOB_STORE_ID`
  y `BLOB_WEBHOOK_PUBLIC_KEY` en Production y Preview; no se referencian en
  ningún lado.
- **El borrado es de consistencia eventual**: tras borrar, la URL puede
  seguir respondiendo 200 en el edge un par de segundos. No es un fallo del
  borrado — no escribir tests ni verificaciones que asuman un 404 inmediato.

## Galería de producto — `imagen` vs `imagenes[]`

Semántica (decisión del owner): **`Product.imagen` es LA portada** en todos sus
usos —cards del catálogo, cards del admin, hero del detalle— e
**`imagenes[]` son tomas ADICIONALES** que solo aparecen en la galería del
detalle del storefront. v1 **sin reordenamiento**: el orden es el de subida.

- **La composición y la dedupe viven en `lib/product-gallery.ts`**
  (`galeriaCompleta`), compartidas por el detalle y el admin. Si cada vista
  armara su propia lista, el orden y los duplicados divergirían entre lo que el
  operador edita y lo que el cliente ve.
- **Los seeds traen la portada DUPLICADA dentro de `imagenes[]`, y está así a
  propósito.** `prisma/seed-products.ts` trae `imagenes: ["<la misma URL que
  imagen>"]`, herencia de la semántica anterior, donde `imagenes[]` era "la
  galería completa, portada incluida" e `imagen` solo el fallback. **Ese dato NO se migró y no hace
  falta migrarlo**: `galeriaCompleta` dedupea al renderizar, así que un producto
  recién sembrado se ve exactamente como siempre (lista de 1 → sin fila de
  miniaturas).
  **Ojo: el duplicado deja de serlo cuando se reemplaza la portada.** En
  producción, al subir las portadas reales, `imagen` pasó a un blob y el
  `/images/*.webp` sembrado quedó como una toma DISTINTA dentro de `imagenes[]`
  — dos miniaturas por producto. El owner decidió limpiar (`imagenes: []` en los
  4, 2026-08-03; ver la sección de storage). Es solo metadata: no se borró ningún
  blob ni ningún estático. La limpieza no se deshace sola: en `prisma/seed.ts`
  `imagen`/`imagenes` van SOLO en el `create` del upsert, así que re-sembrar no
  vuelve a meter la estática.
- **NO "arreglar" el dato ni quitar la dedupe creyendo que sobra.** La dedupe es
  una **garantía defensiva** contra cualquier fuente futura —un import, un seed
  nuevo, una edición manual, un backfill— no un parche para esos 4 registros.
  Limpiar la base no la vuelve innecesaria; solo elimina la única evidencia de
  por qué existe. Testeada en `lib/product-gallery.test.ts`.
- **El dato se auto-normaliza al editar, sin backfill:** el formulario del admin
  carga la galería excluyendo la portada, así que guardar un producto sembrado
  deja su `imagenes[]` sin el duplicado. Es el efecto correcto de la semántica
  nueva y no cambia nada en pantalla (`galeriaCompleta` ya daba el mismo
  resultado). No es motivo para quitar la dedupe: los productos que nadie edite
  siguen con el duplicado, y las fuentes futuras también pueden traerlo.
- **El tope es `MAX_GALERIA_IMAGENES` (6) y cuenta ADICIONALES**, no la portada:
  un producto muestra como máximo 7 miniaturas. Se valida en el cliente (aviso
  temprano) y en el POST y el PATCH (la que manda).
- **El borrado de blobs de galería lo hace el SERVER por diff**: compara el
  array previo de la BASE contra el nuevo (`blobsRetirados`) y borra lo que
  salió. El cliente jamás manda "borra esta URL" — si lo hiciera, cualquier
  admin podría borrar cualquier blob del store enviando otra. Una toma promovida
  a portada se excluye del borrado: seguía en uso. El `DELETE` del producto
  borra portada + galería completa.
- Un producto puede tener portada estática de `public/` y galería en Blob: las
  guardas del adaptador (`isManaged`) hacen no-op las relativas, así que
  conviven sin migrar nada.

## Política de tema (dark mode)

El storefront es light-only (paleta de marca fija). El admin soporta
dark mode con toggle. La política de tema se define en el layout de
cada grupo de rutas, nunca global — storefront y admin son productos
distintos que comparten repo temporalmente.

Implementación: `app/(storefront)/layout.tsx` monta
`StorefrontThemeProvider` (`forcedTheme="light"`);
`app/(admin)/layout.tsx` monta `AdminThemeProvider`
(`defaultTheme="system"` + `enableSystem`, toggle en TopBar). El root
layout NO monta ThemeProvider. `color-scheme` sigue al tema vía CSS
(`html` claro por defecto, `.dark` oscuro — solo el admin aplica
`.dark`).

## Bases de datos (Neon) — qué es cada endpoint

Cuatro ramas, cuatro roles. El hostname es el identificador; el NOMBRE de la
rama no lo es (ver la regla de abajo).

| Rama (Neon) | Endpoint | Rol |
| --- | --- | --- |
| `production` | `ep-ancient-frog-ac1v1hg5` | **PRODUCCIÓN.** La que sirve Vercel **en el entorno Production únicamente** (pooled en `DATABASE_URL`, directo en `DIRECT_DATABASE_URL`). Desde el 2026-08-02 Preview YA NO hereda estas vars — ver la fila de abajo. |
| `development` | `ep-still-sound-acfmedf2` | Base de desarrollo. La usan el `.env` local (pooled + directo) **y los PREVIEW deploys**: desde el 2026-08-02 el entorno Preview de Vercel tiene entradas PROPIAS de `DATABASE_URL` y `DIRECT_DATABASE_URL` apuntando acá. Ramificada de production, 33/33 migraciones. |
| `quarantine-prod-snapshot-jul24` | `ep-solitary-mouse-ac140cla` | Snapshot CONGELADO del 2026-07-24. **No tocar ni decomisar sin decisión explícita del owner.** No es producción ni desarrollo: no leerla para diagnosticar nada. |
| `backup-pre-purge-ago03` | `ep-super-frost-acy9dryk` | Snapshot CONGELADO del 2026-08-03, child de production, tomado justo antes de la purga pre-lanzamiento (ver abajo). Es el ÚNICO respaldo de las 120 órdenes borradas. **No tocar ni decomisar** mientras la purga siga siendo reversible por decisión del owner. |

**REGLA DURA — verificar el ROL en la CONSOLA de Neon antes de cualquier
operación destructiva o de escritura masiva** (reset de rama, `migrate reset`,
borrado o reescritura en lote, seeds, restore, decomisar una rama).

No sirve como evidencia del rol: el nombre de la rama, lo que diga `.env`, un
comentario en el código, ni lo que alguien recuerde. Los tres fallaron el
2026-08-02: `ep-ancient-frog` estaba etiquetado en sesión como "la rama de
desarrollo" y era producción; el diagnóstico se hizo contra
`ep-solitary-mouse` creyéndola producción y fabricó un incidente falso ("faltan
6 migraciones" con producción en 33/33); y por poco se ejecuta un "reset de la
rama de dev desde el parent" que habría **borrado producción**.

Para verificar el rol desde fuera de la consola, la única fuente válida es el
`process.env` DEL deployment (así se resolvió el 2026-08-02: un route handler
temporal, gateado a OWNER, que devolvía `new URL(...).hostname` — nunca la
cadena de conexión — y `VERCEL_ENV`).

### Purga pre-lanzamiento del 2026-08-03 — EXCEPCIÓN ÚNICA, no precedente

Se borró TODO lo transaccional de producción: 120 órdenes, 151 OrderItems, 89
Payments, 99 Shippings, 20 Customers, 8 InventoryLogs. Sobrevivieron intactos
productos, stock, usuarios/sesiones de Better Auth, `AutomationSetting` y
`DashboardPreference`. Motivo: la base traía únicamente data de demo (seed) y
pruebas manuales, y el cliente arranca con historial en cero.

**La regla de no-borrado SIGUE VIGENTE para operación normal.** Los paths de la
app cancelan, no borran, y eso es lo correcto: una orden es un registro
financiero. Esta purga fue una excepción de una sola vez, con respaldo previo y
aprobación explícita del owner. No es precedente para "limpiar" nada.

Lo que hizo segura la operación, por si alguna vez hay que repetirla:

- **Respaldo ANTES**, en una rama propia (`backup-pre-purge-ago03`), y una
  aserción en la transacción de que toda orden a borrar existía en él y que
  producción no tenía nada posterior al snapshot. Sin esa cobertura verificada,
  la purga aborta.
- **Cerrojos por hostname, no por confianza.** El primer intento de esta sesión
  llegó con la cadena de `backup-pre-purge-ago03` etiquetada como producción —
  el mismo modo de falla del 2026-08-02. Se detectó comparando el hostname
  contra la tabla de arriba y el contenido contra `development`. Un wipe con esa
  cadena habría destruido el respaldo dejando producción sucia.
- **Todo en UNA transacción**, con aserciones de que las tablas a conservar no
  cambiaron de conteo. Cualquier fallo → `ROLLBACK`.

**Los criterios "obvios" de data de prueba NO servían.** El seed genera órdenes
con prefijo `CN-9#####` (no solo `SN-`) e identidades realistas tomadas de
`MOCK_CUSTOMERS` (`valentina.torres@gmail.com`, teléfonos `+5731…` válidos): ni
"nombres QA" ni "@example.com" las tocan. Y como las órdenes reales se numeran
`CN-` + 6 dígitos aleatorios, ~1 de cada 9 reales empieza por `CN-9` — borrar
por prefijo habría destruido órdenes legítimas. Los marcadores que sí
discriminan son `Payment.registrado_por_nombre = 'Seed'` y la coincidencia de
identidad contra `MOCK_CUSTOMERS`. Si alguna vez hay que volver a clasificar
data de prueba, empezar por ahí y no por el número de orden.

Las identidades no-fixture que quedaban (Juan Henao, Luis / lUIS Cagua, Carlos,
`CN-299035`) las resolvió el owner el 2026-08-03: **todas del círculo de pruebas**
(él, su socio Carlos, el dueño de Nayoli). No había clientes reales.

**PENDIENTE — el stock NO se tocó y sus números son falsos.** Quedó en 42/28/42/28
(los valores del seed). No se puso en cero a propósito: cero apagaría el
storefront, y el número real exige **conteo físico del cliente**. Ajustar en la
sesión con el cliente, antes de abrir ventas. Hasta entonces, cualquier métrica
de inventario o alerta de stock bajo está leyendo datos inventados.

## Env vars en Vercel — SIN comillas

El dashboard de Vercel **no parsea** el valor: lo guarda literal. Las comillas
de un archivo `.env` son sintaxis que el parser de dotenv quita; pegar una línea
de `.env` en el dashboard deja **las comillas dentro del valor**.

Incidente 2026-08-03: `EMAIL_FROM` quedó como `"Café Nayoli
<no-reply@duna.solutions>"` con comillas literales. Resend rechazaba el
remitente y `/api/users/invite` devolvía un 500 sin nada en runtime logs (ese
catch venía sin binding — ya está instrumentado). Costó una tarde porque el
síntoma no apunta a la causa: se lee como problema de la API key o del dominio.

- **Regla: en el dashboard, el valor va crudo.** `Café Nayoli
  <no-reply@duna.solutions>`, no `"Café Nayoli <no-reply@duna.solutions>"`.
- Aplica a TODAS, no solo al correo. Una API key entre comillas da un 401 que
  se lee como "key inválida" en vez de "key mal pegada".
- `lib/email.ts` recorta comillas envolventes de `EMAIL_FROM` y
  `RESEND_API_KEY` y **avisa por log** cuando lo hace. La limpieza es una red,
  no un permiso: si aparece ese `[env]` en los logs, hay que arreglar el
  dashboard igual — aceptarlo en silencio dejaría la config mal para siempre.
- El formato de `EMAIL_FROM` se valida (`algo@dominio.com` o
  `Nombre <algo@dominio.com>`) y se loguea con `console.error` si no matchea,
  **sin lanzar**: el regex podría ser más estricto que Resend, y tumbar un envío
  que funcionaba es peor que uno que falla dejando rastro.

## Migraciones y deploy

- **CADA ENTORNO MIGRA SU PROPIA BASE.** `npm run build` corre `prisma
  migrate deploy` antes de `next build`, **sin condición** (desde el
  2026-08-04). Production migra `ep-ancient-frog`; Preview migra
  `ep-still-sound`; un `npm run build` local migra la base de tu `.env`
  (hoy también `ep-still-sound`). Lo que hace correcta a la política es
  que cada entorno tiene YA su propia base — no al revés. Si algún día
  Preview volviera a apuntar a producción, esta línea es una bomba: la
  condición se retiró PORQUE las cuatro filas de env vars existen.
- Si la migración falla, el build falla y el deploy queda bloqueado —
  jamás envolver ese paso en `|| true` (un deploy bloqueado con error
  claro es mejor que un entorno corriendo contra un schema sin migrar).
- **`DIRECT_DATABASE_URL` es ahora prerequisito en Preview, no solo en
  Production.** La lee `prisma.config.ts`, que cae a `DATABASE_URL` si
  falta — y esa es la POOLED: PgBouncer rompe los advisory locks de
  `migrate deploy`. Un Preview sin esa var no falla al configurarse, falla
  al migrar. Hoy existe (es una de las cuatro filas).
- **Tradeoff real: las migraciones de ramas en vuelo conviven en
  `development`.** Dos ramas abiertas con migraciones distintas las
  aplican las dos a la misma base, y una migración de una rama que nunca
  se mergea se queda ahí. Con UN dev el riesgo es bajo y el síntoma es
  local, no en producción. **La limpieza no es una tarea nueva: es el
  reset periódico de `development` desde `production` que ya existe** —
  ese reset devuelve dev al estado de migraciones de producción y con eso
  se lleva por delante las de ramas muertas. Ojo con el efecto conocido
  de ese reset: deja las filas de dev apuntando a blobs REALES de
  producción (ver la sección de storage y la guarda `isDeletable`).
  Una rama que siga viva simplemente re-aplica su migración en el
  siguiente preview deploy, porque `migrate deploy` corre en cada build.
- **Efecto secundario bueno: muere el P2022 crónico de las previews.**
  Antes, una preview cuya rama traía una migración nueva reventaba en
  runtime hasta que `main` la aplicara; ahora la aplica ella misma a
  `development` en su propio deploy. Ese era el costo aceptado de la
  condición y deja de pagarse.
- **VERIFICACIÓN DIFERIDA (pendiente al 2026-08-04).** Al retirar la
  condición no había ninguna migración en vuelo (`development` en 33/33),
  así que el cambio se mergea sin haber visto todavía el caso completo.
  Son dos comprobaciones distintas y conviene no confundirlas:
  1. **Cualquier preview deploy** ya prueba lo básico: en su log debe
     aparecer `prisma migrate deploy` corriendo contra
     `ep-still-sound` y reportando 0 pendientes. Eso confirma host
     correcto y que `DIRECT_DATABASE_URL` de Preview resuelve.
  2. **El primer PR que traiga una migración** prueba lo que falta: que
     la APLICA en el preview y que la preview levanta sin P2022.
  Hasta que (2) ocurra, esta política está verificada a medias y así hay
  que tratarla. Si (1) falla, el fix es de env vars, no del script.
- **La red gratis del 7.9.1:** el primer preview posterior a este cambio
  estrena el `migrate deploy` del CLI 7.9.1 contra `development` — es
  decir, contra una base desechable y ANTES de que producción lo corra.
  Esa cobertura no existía cuando se mergeó el upgrade (`2a0f1d4`), y es
  un argumento para no volver a condicionar el paso.
- **Preview YA NO comparte base con producción** — desde el 2026-08-02 el
  dashboard de Vercel tiene entradas SEPARADAS de `DATABASE_URL` y
  `DIRECT_DATABASE_URL` para Production (`ep-ancient-frog`) y para Preview
  (`ep-still-sound`). Preview y local escriben los dos en `development`,
  así que ni las previews ni las pruebas locales son ya escrituras en
  vivo; antes del 2026-08-02 ambas lo eran.

  **Esta sección afirmó lo contrario entre el 2026-08-02 y el 2026-08-04**
  ("preview hereda las env vars de producción", "preview escribe en
  producción"): el cambio se hizo en el dashboard de Vercel y la doc no se
  actualizó. Queda anotado porque el modo de falla es el de siempre acá —
  la doc, el nombre de la rama y la memoria NO son evidencia del rol de una
  base. Lo que cerró esto fue la evidencia primaria: las cuatro filas de env
  vars en Vercel.
- `vercel.json#buildCommand` ANULA el script `build` de package.json —
  incidente 2026-07-25: decía `prisma generate && next build` y el
  `migrate deploy` condicionado nunca corrió en Vercel. Debe quedarse en
  `"npm run build"` (o eliminarse): package.json es la única fuente del
  build; `prisma generate` ya corre en `postinstall`. Todo cambio al
  pipeline de build se verifica en los LOGS del deploy de Vercel, no
  solo en el repo.
- **Jamás `prisma migrate reset` contra Neon** — borra toda la base. Ni
  siquiera contra `development`: es una operación destructiva y cae bajo la
  regla de verificar el rol en la consola primero.
- Migraciones nuevas deben ser aditivas/compatibles con el código
  anterior (columnas nullable o con default, enums nuevos) mientras un
  deploy viejo conviva con el schema nuevo; si algún día hay que romper,
  usar expand → migrate → contract en deploys separados.
- La env var `DIRECT_DATABASE_URL` (conexión directa de Neon, sin
  `-pooler`) debe existir en los entornos de Vercel que migran (hoy:
  Production). La lee `prisma.config.ts` — que consume SOLO el CLI de
  Prisma; el runtime usa `DATABASE_URL` (pooled) vía lib/prisma.ts.
  Prisma 7 no tiene `directUrl` en el config: esta separación de env
  vars es el equivalente.

## Design system del admin — chips de stat cards

Los icon chips de stat cards usan pastel multicolor = decisión deliberada
del owner (confirmada 2026-07-27 tras evaluar la variante ámbar en
preview); rojo/destructive reservado a alertas reales; el resto de las
reglas de restricción cromática (un sólido por vista, hover de tinte,
badges muted/neutros, trends de texto) SÍ aplican y no dependen de esta
decisión. El mapa (paleta pastel + `alert`) vive en
`constants/stat-chip.ts` (`STAT_CHIP.<tono>`) y lo consumen el registry de
widgets y las stat cards de cada página; retunear/revertir es cambiar SOLO
ese mapa (y qué key usa cada tarjeta). No colapsar a ámbar por leer una
versión vieja de este doc.

## Dashboard personalizable — registry de widgets

Las stat cards del dashboard son un CATÁLOGO (`constants/dashboard-widgets.ts`,
`key` estable snake_case) con selección ordenada persistida por usuario
(`DashboardPreference.widgets` = array de keys; API `/api/dashboard/prefs`).
Toda entrada/salida pasa por `sanitizeWidgetKeys` (solo keys reales del registry,
sin duplicados, orden preservado) → una key retirada o un payload malicioso nunca
llega al grid. El binding key→dato vive en el dashboard (junto a los datos); el
registry es presentación pura + deep-links que reusan los helpers compartidos
(card=lista). SOLO las stat cards son personalizables: los gráficos y Órdenes
Recientes son fijos, fuera del sistema (v1).

- **Costura MULTITENANT (documentada, NO construida):** hoy no hay modelo de
  tienda/tenant. Cuando exista: (a) cada `WidgetDef` gana un filtro por vertical
  de negocio (el catálogo se scopea por vertical), (b) `DashboardPreference` gana
  la clave de tienda y su índice único pasa a compuesto (`userId + storeId`), y
  (c) `defaultVisible` se reemplaza por un set de default POR VERTICAL. La forma
  (registry + preferencia ordenada) ya es genérica del template "Comercio
  Digital"; el contenido (los widgets concretos) es de esta vertical.
- `DashboardPreference.userId` referencia `user.id` (Better Auth) pero SIN
  relación Prisma a propósito — una relación exigiría un campo inverso en el
  modelo `user` de Better Auth, que no se toca. Índice único; la app scopea por
  sesión.
- TODO (no implementado): el endpoint de stats calcula TODAS las métricas aunque
  el usuario muestre pocas tarjetas. Optimizar a cálculo selectivo por las keys
  visibles queda anotado, no hecho.

## Matching de clientes (teléfono no es único)

`Customer.telefono` NO tiene unique constraint — un teléfono puede ser compartido
por varias personas (decisión de producto; el duplicado consciente es legal). Por
eso el matching por teléfono puede devolver VARIOS. La ambigüedad se resuelve con
una regla DETERMINISTA, compartida por el endpoint de lookup (orden del banner) y
el auto-adjunte silencioso del server cuando NO llega decisión explícita (checkout
del storefront o clients viejos): **más órdenes primero; empate → actividad más
reciente (última orden, luego `updatedAt`)**. Vive en `rankPhoneMatches`
(`lib/orders.ts`). Arbitrario-pero-documentado > `findFirst` accidental.

La creación de órdenes (`createOrderWithCustomer`, path único) acepta la decisión
EXPLÍCITA del admin: `cliente_id` (adjunta a ese cliente, sin matching) o
`forzarClienteNuevo` (crea nuevo pese al match) — mutuamente excluyentes (zod 400).
Sin decisión, aplica la regla determinista. El teléfono se normaliza siempre en
todo write+lookup (`normalizeCustomerPhone` en `lib/whatsapp-link.ts`). NO fusionar
duplicados automáticamente — el merge es decisión humana (feature futura); las
órdenes ya apuntan por `cliente_id`.

## "Por cobrar" vs "Órdenes Pendientes" (dos tarjetas, un conjunto)

Se ven contradictorias ("Por cobrar $0" junto a "Órdenes Pendientes 20") y NO lo
son: son un conjunto y su recorte.

- `pendiente` = todas las órdenes sin pago registrado, **sin ventana temporal**.
- **Por cobrar** ⊂ pendiente: además CONTRAENTREGA y ya despachada
  (`en_ruta`/`entregado`) — la plata que el mensajero anda cobrando.
  `POR_COBRAR_WHERE` / `isPorCobrar`, misma definición en card y lista.
- **Órdenes Pendientes** = `pendiente` MENOS por-cobrar. Por construcción,
  `pendingOrders + porCobrar` = todo `pendiente`.
- Por tanto "$0 por cobrar" con 20 pendientes solo dice que ninguna pendiente es
  contraentrega despachada — con órdenes ANTICIPADO es el estado NORMAL, no un
  bug. (Verificado 2026-07-29 en dev: las 20 eran ANTICIPADO.)

Ninguna de las dos tiene scope de "hoy", aunque "Por cobrar" viva en la fila
*Hoy* del panel. Se les puso el sufijo "(acumulado)" y se les QUITÓ (owner,
2026-07-29): son métricas de **estado actual** — un saldo vigente y un conteo
vigente — y un saldo no lleva declaración de período; la etiqueta sugería una
ventana temporal inexistente. Lo que sostiene la coherencia del par es el
**cross-reference** del sub en vivo de Pendientes ("· N por cobrar aparte"), que
dice que ese recorte está descontado. Si alguna vez a una de las dos se le mete
ventana temporal de verdad, ahí sí corresponde declararla — el mecanismo existe y
está testeado (`WidgetDef.scopeSuffix` + `resolveStatLine`, hoy sin consumidores
a propósito). No re-agregar "(acumulado)" leyendo una versión vieja de este doc.

**Deuda conocida (NO arreglada a medias):** ninguno de los dos conteos excluye
las órdenes `SN-` de demo, así que hoy "Pendientes" cuenta 1 de más. Arreglarlo
solo en la tarjeta rompería el invariante card=lista (la lista de Órdenes tampoco
filtra `SN-`): el fix es de los dos lados a la vez, o de ninguno.

## Capa de insights de las stat cards (hechos, no consejos)

`WidgetDef.insight` es opcional y opt-in: la mayoría de tarjetas no lo declara y
se ve igual que siempre. Las reglas viven en `lib/metrics/insights.ts` — puras,
deterministas y con tests (`npm test`). Restricciones que son del diseño, no del
estilo:

- **Solo meses CERRADOS.** El mes en curso está incompleto; compararlo como si
  estuviera cerrado diría "a la baja" todos los días 1.
- **Guarda de muestra** `MIN_ORDENES_INSIGHT` (15, placeholder TODO(cliente)): por
  debajo de ese volumen un % es ruido, y un insight ruidoso entrena al operador a
  ignorar la línea entera.
- **Texto = hecho** ("3 meses consecutivos a la baja"), nunca instrucción ni causa
  inventada. Muted, sin icono ni color — el rojo es de Alertas de Stock.
- La serie mensual del insight usa la MISMA definición que el valor de su
  tarjeta. Un insight calculado sobre otro conjunto que el número que acompaña es
  peor que no tener insight.

## Sugerencia de zona de entrega (heurística de dirección)

`sugerirZona` (`lib/zona-config.ts`) propone la zona leyendo la nomenclatura de
la dirección — sin geocoding ni red. Es una SUGERENCIA: pre-selecciona el Select
del modal "Programar entrega" y nada más; `zona` siempre es lo que el operador
dejó en el Select. Aparece SOLO en ese modal, nunca mientras se escribe la
dirección en Nueva Orden (fuera de alcance por decisión del owner, 2026-07-29).
Misma forma que el resto del template: resolver genérico + `ZONA_CONFIG` de la
vertical (que el día del multitenant migra a DB scopeada por tienda).

- **Sin ciudad no hay sugerencia** (`null` explícito). Por eso Nueva Orden captura
  Ciudad y Departamento — **ambos OPCIONALES**: la orden manual tiene que poder
  crearse rápido sin ellos, y sin ciudad el modal simplemente no sugiere.
- **`departamento` se VALIDA pero NO se persiste**: `Order` no tiene columna. Es
  deliberado y confirmado por el owner (2026-07-29) — mismo criterio que
  `deliveryAddressSchema` (`lib/validation/address.ts`), donde el departamento
  solo deriva el tier de envío en checkout. **No agregar la columna** hasta que
  algo consuma el dato; un futuro "esto está a medias" NO es un bug.
- **Los umbrales de `ZONA_CONFIG` son placeholder del cliente.** El rango de
  calle 26–99 devuelve `null` A PROPÓSITO (no inventar cortes), y por el umbral
  `carreraOccidenteDesde: 68` una dirección tan común como "Ak 58" tampoco
  sugiere. `Shipping.zona_sugerida` existe justamente para calibrar esto: la
  corrección del operador se DERIVA de `zona_sugerida != zona` — no agregar un
  campo "corregida" que pueda desincronizarse de esa comparación.
- `null` = "no me consta". Preferir callar antes que sugerir mal: una sugerencia
  equivocada que el operador acepta sin mirar cuesta más que ninguna.

## Principio rector del admin — defaults inteligentes sobre opciones explícitas

Decisión del owner, y es de PRODUCTO, no de estilo: **el admin optimiza por
defaults inteligentes, no por opciones. Menos decisiones por operación, no más.**

Cuando el sistema puede inferir un valor con confianza razonable, lo pre-llena y
se calla. NO se agrega un chip que anuncie la inferencia, ni un ajuste de
configuración para desactivarla, ni un toggle de "recordar mi elección". Todo eso
convierte una decisión ahorrada en dos decisiones nuevas —usarla y configurarla—,
que es exactamente lo contrario de lo que se buscaba.

Las tres reglas que hacen que un default sea seguro:

- **Solo llena huecos.** Un default JAMÁS pisa un valor que ya existe. Si el
  campo trae algo, es porque alguien lo puso; una elección humana no se
  sobreescribe sola.
- **Es sugerencia, no decisión.** Lo que se guarda es siempre lo que quedó en el
  campo. El default no viaja al server como dato propio ni se persiste aparte.
- **Preferir callar a adivinar mal.** Sin base para inferir → se deja vacío. Un
  default equivocado que el operador acepta sin mirar cuesta más que ninguno
  (mismo criterio que el `null` de `sugerirZona`).

Ejemplos vivos, los dos en el modal de "Programar entrega": la zona sugerida por
la dirección (`sugerirZona`) y el **mensajero pre-llenado con el último usado**.

El mensajero sale del **último `Shipping` que tenga uno** — cero columnas nuevas,
cero tabla de preferencias, y el dato se mantiene solo porque ES el historial de
despachos. Se resuelve en `/api/orders/[id]/delivery-context` (la fetch que el
modal ya hacía) y no en el cliente, porque el modal se abre desde Órdenes y desde
Entregas y solo una de las dos tiene la lista de envíos cargada; en el server las
dos entradas ven lo mismo, sin endpoint nuevo. Una tienda usa uno o dos
mensajeros durante meses: teclear el mismo nombre en cada entrega es una decisión
que el admin no debería pedir.

**El gate `isScheduledShipping` no cambia.** Pre-llenar un campo no programa nada:
una entrega sigue estando "lista para despachar" solo con mensajero Y fecha, y la
fecha la sigue poniendo una persona.

## Principio rector del admin (Amber Minimal)

El color es información, no decoración. Reglas de sistema (se implementan en los
lugares compartidos, nunca ad-hoc por página; ref. tweakcn Amber Minimal, ~95%
neutro):

- **Un solo primario sólido por vista.** El ámbar sólido (`--primary`, variante
  `default` del Button) es LA acción principal de la página, máx. una (Nueva Orden,
  Nuevo Producto…). Toda acción de fila/tarjeta va `outline`/`ghost` neutra con
  hover de TINTE (`--accent`, ya suave — no rellena). Destructivas de fila:
  variante `destructiveGhost` (tinte rojo suave); el sólido `destructive` se
  reserva al confirm del `ConfirmDeleteDialog`.
- **Estados = semáforo muted** (mapa único en `components/ui/StatusBadge.tsx`):
  ámbar=espera, verde=ok, rojo=alerta, azul=en curso (el único tono informativo),
  gris=neutro. Categorías (zona, canal) van neutras (outline/gris), nunca color
  semántico.
- **Trends en texto** (flecha + % coloreado verde/rojo, sin pill/fondo); el "vs
  mes anterior" en muted. Un solo lugar: `TrendPill` en `StatCard`.
- **Una sola utilidad de fecha visible**: `formatFecha` (`lib/format-fecha.ts`,
  `14 may 2026`, es-CO/America-Bogota). No `toLocaleDateString` ad-hoc en vistas.
- **Icon chips en familia cálida** — ver la sección de chips arriba
  (`constants/stat-chip.ts`).

El `--accent` de admin-light era `#B45309` (marrón de marca) y volvía marrón todo
hover de outline/ghost/dropdown/select: ahora es un tinte cálido suave. El marrón
vive como `--primary` y en los charts, no como fondo de hover.

## Automatizaciones — arquitectura y prerequisitos de go-live

El CATÁLOGO vive en el código (`constants/automations.ts`): key estable
snake_case, canal, tipo (`evento` | `programada`), audiencia, disparador,
estrategia de idempotencia, `configSchema` (zod con defaults) y plantillas.
La DB guarda SOLO la decisión del owner: `AutomationSetting` (activo +
overrides de config) y `AutomationRun` (bitácora de toda ejecución, y el
gate de idempotencia). Mismo patrón que el registry de widgets: la FORMA
es del template "Comercio Digital", el CONTENIDO es de esta vertical.

- El motor (`lib/automations/engine.ts`) es fire-and-forget respecto al
  negocio: `runEventAutomations` se llama SIEMPRE post-commit y jamás
  lanza. Una automatización rota no puede tumbar una venta, un despacho
  ni un ajuste de inventario. Todo error se vuelve run `FALLIDO` + log.
- El orden es despachar → registrar, no al revés. Deja una ventana teórica
  de duplicado si el proceso muere en medio; se acepta porque el orden
  inverso cambia ese riesgo por uno peor (marcar como hecho algo que nadie
  recibió). **Perder un mensaje es peor que repetirlo.**
- Los disparadores de CONDICIÓN (stock bajo) se evalúan en el EVENTO que
  cambia el valor y disparan solo al CRUZAR el umbral, usando el helper
  compartido `isLowStock` — NO una comparación propia. Si el aviso usara un
  criterio distinto del que pinta la card de Alertas de Stock, la card y la
  lista dejarían de reconciliar.

### Prerequisitos de go-live del canal WhatsApp (Meta)

`lib/automations/channels/whatsapp.ts` es un stub deliberado: todo el
pipeline corre y el run queda `PENDIENTE_CANAL` con el mensaje renderizado
en `payload`. Antes de conectar el adaptador real:

- **`PENDIENTE_CANAL` es un LOG, nunca una cola.** Un run en ese estado
  registra lo que se habría enviado; no es un mensaje esperando turno. Al
  conectar Meta, el backlog acumulado se marca EXPIRADO — no se despacha.
  Solo los eventos NUEVOS usan el canal real. Enviar el backlog sería
  mandarle a un cliente la confirmación de una orden que ya recibió hace
  semanas, o recordarle un pago que ya hizo: ruido que quema la reputación
  del número y dispara reportes de spam en Meta. La migración de go-live es
  por tanto un `UPDATE` de estado, no un reproceso.
- **Política de reintentos de runs `FALLIDO` — PREREQUISITO, no opcional.**
  Hoy un `FALLIDO` cuenta como "ya corrió" y no se reintenta: para los
  `una_vez` (recordatorio de pago) eso quema esa orden para siempre. Con el
  canal en stub el costo es cero; con Meta conectado es plata perdida.
  Ojo con la interacción: la política de reintentos debe distinguir un
  `FALLIDO` reciente (reintentable) de uno viejo, o resucitará mensajes
  igual de rancios que el backlog `PENDIENTE_CANAL`. El mismo criterio de
  frescura que ya aplica `recordatorio_pago` con `maxEdadDias`.
- **`reactivacion_cliente` tiene DOBLE prerequisito** y no debe activarse
  hasta cumplir ambos: (a) canal Meta conectado, y (b) campo de
  consentimiento de marketing en `Customer`, capturado en el checkout. Es
  la única plantilla MARKETING (las otras son UTILITY): exige opt-in previo
  y tiene otro costo; categorizarla UTILITY para saltarse el opt-in es la
  causa #1 de suspensión de plantillas. Conecta con las páginas legales
  pendientes (Ley 1581) — ver `siteConfig.legalNav`, hoy vacío.

### El cron NO vive en vercel.json

El plan de Vercel es Hobby: los cron jobs se ejecutan una vez al día, así
que un `crons` horario en `vercel.json` NO haría lo que dice. El disparo
horario vive en **GitHub Actions**
(`.github/workflows/automations-cron.yml`, `schedule: '0 * * * *'`) que
hace POST a `/api/cron/automations` con `Authorization: Bearer
${CRON_SECRET}`. El bloque `crons` queda COMENTADO en `vercel.json` con la
nota de activarlo al pasar a Pro y retirar el workflow entonces.
`CRON_SECRET` debe existir con el MISMO valor en las env vars de Vercel y
en los Actions secrets del repo. (Esto no contradice la regla de
`vercel.json`: lo prohibido es `buildCommand`, no `crons`.)
