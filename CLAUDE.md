@AGENTS.md

## Imágenes en `public/`

Los archivos de imagen en `public/` son inmutables: nunca sobrescribir
contenido bajo el mismo nombre. Todo reemplazo de imagen usa un nombre
nuevo (sufijo `-v2`, `-v3` o timestamp) y se actualizan las referencias
(DB, seed, código). Motivo: la URL es la clave de caché del navegador y
del optimizador de Next — mismo nombre con contenido nuevo = cachés
sirviendo la versión vieja indefinidamente. Cuando exista upload de
imágenes en el admin, el nombre debe incluir hash o timestamp
automáticamente.

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

Tres ramas, tres roles. El hostname es el identificador; el NOMBRE de la rama
no lo es (ver la regla de abajo).

| Rama (Neon) | Endpoint | Rol |
| --- | --- | --- |
| `production` | `ep-ancient-frog-ac1v1hg5` | **PRODUCCIÓN.** La que sirve Vercel (pooled en `DATABASE_URL`, directo en `DIRECT_DATABASE_URL`). Preview hereda estas env vars salvo override, así que **preview escribe en producción**. |
| `development` | `ep-still-sound-acfmedf2` | Base de desarrollo. Es a la que apunta el `.env` local (pooled + directo). Ramificada de production, 33/33 migraciones. |
| `quarantine-prod-snapshot-jul24` | `ep-solitary-mouse-ac140cla` | Snapshot CONGELADO del 2026-07-24. **No tocar ni decomisar sin decisión explícita del owner.** No es producción ni desarrollo: no leerla para diagnosticar nada. |

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

## Migraciones y deploy

- Las migraciones de PRODUCCIÓN las aplica el build de Vercel
  automáticamente: `npm run build` corre `prisma migrate deploy` antes
  de `next build` **solo cuando `VERCEL_ENV === "production"`**. Si la
  migración falla, el build falla y el deploy queda bloqueado — jamás
  envolver ese paso en `|| true` (un deploy bloqueado con error claro es
  mejor que producción corriendo contra un schema sin migrar).
- Los PREVIEW deploys NO migran (variante condicionada, deliberada): una
  preview cuya rama trae una migración nueva fallará en runtime (P2022)
  hasta que `main` la aplique. Tradeoff aceptado frente al inverso —
  que una rama de feature migre la DB compartida antes de que `main`
  tenga el código.
- **Preview y producción comparten base** — la de `production`
  (`ep-ancient-frog`): preview hereda sus env vars salvo override. Por eso
  el `migrate deploy` condicionado a `VERCEL_ENV === "production"` es lo
  correcto: sin la condición, una rama de feature migraría producción
  antes de que `main` tenga el código. **Local ya NO comparte con nadie**
  (apunta a `development`, ver la tabla arriba), así que las pruebas
  locales dejaron de ser escrituras en vivo — situación vigente desde el
  2026-08-02, antes de esa fecha sí lo eran.
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
