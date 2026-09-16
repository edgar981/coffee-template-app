# Deuda de migración a plataforma

Abierto el 2026-09-15 junto con `NORTE-PLATAFORMA-ASIENTO-1` (ver `DECISIONS.md`). El norte de Duna
es **plataforma**: base compartida, aislamiento lógico por arquitectura, alta de cliente en minutos,
operación única. El modelo de hoy —un despliegue por cliente— es vigente y transitorio, no el destino.

**El propósito de este documento es hacer VISIBLE la factura de decisiones tomadas bajo supuestos
por-despliegue, para que la migración las revisite y para que NINGUNA decisión futura la engorde en
silencio.** No arregla ninguna fila. Cada fila es correcta HOY, bajo el modelo vigente; cada una deja
de serlo el día en que un proceso empiece a servir más de un tenant.

## Regla de mantenimiento

**Cada decisión futura por-despliegue tomada a sabiendas suma su fila acá en el mismo momento en que
se decide.** Este registro no se llena solo con una auditoría periódica — se llena en el instante de
la decisión, o deja de cumplir su propósito.

## El registro

| # | Qué es | Por qué fue correcta bajo despliegue-por-cliente | Qué tendrá que revisitar la migración |
| --- | --- | --- | --- |
| 1 | El toggle de pasarela por env var (`NEXT_PUBLIC_PASARELA_HABILITADA`). *(Nota: hoy vive en una rama sin mergear a `main` — la fila se abre igual, porque la decisión ya se tomó.)* | Un solo despliegue, una sola pasarela: prender/apagar por env es la forma más barata de togglear una capacidad de proceso entero. | En plataforma es dato de TENANT, no de proceso — dos tiendas en el mismo proceso pueden querer valores distintos. Pasa a una columna/config por tenant. |
| 2 | Las llaves de Wompi por despliegue (`WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` — `app/api/checkout/route.ts:171`, `app/api/webhooks/wompi/route.ts:277`, `instrumentation.ts:26`). | Cada despliegue es un cliente con su propia cuenta de Wompi; una env var por proceso es exactamente el alcance correcto. | Un proceso de plataforma sirve N tenants con N cuentas de Wompi y N juegos de llaves. Una env var de proceso no puede ser "la llave del tenant" — las llaves migran a una tabla, cifradas, con lookup por tenant. |
| 3 | `NOINDEX` como marcador de demo (`next.config.ts:8`). | Distingue la demo de Nayoli (env `production` en Vercel, pero no un cliente real) del resto — por PROCESO, que es la granularidad que existe hoy. | En plataforma "demo" o "no indexar" es un atributo de TENANT, no de proceso: un mismo proceso puede servir una tienda real (indexable) y una demo (no) a la vez. |
| 4 | La guarda de llaves-coherentes leyendo `process.env` al arranque (`instrumentation.ts`, `register()`). | `register()` corre una vez por proceso — exactamente una vez por despliegue, que es donde vive la configuración hoy. | En plataforma el chequeo "¿esta llave es coherente con el estado de este despliegue?" es por TENANT, no por arranque de proceso; correr una vez y para siempre deja de alcanzar. |
| 5 | El mark inlineado en build (`NEXT_PUBLIC_STOREFRONT_MARK`, `lib/config/storefront-marca.ts:21`). | `NEXT_PUBLIC_*` se inlinea en build-time; con un build por cliente, "fijo para ese build" es correcto por definición. | Un build de plataforma sirve N tenants: un valor fijado en build no puede variar por request. El mark migra a dato leído en runtime (`SiteSetting`, ya anotado como deuda declarada en el propio `lib/config/storefront-marca.ts`). |
| 6 | El cron por repo — un workflow de GitHub Actions, un `CRON_URL` (`.github/workflows/automations-cron.yml:44`). | Un repo, un despliegue, un dominio: un solo `CRON_URL` apuntando al cron de ESE despliegue es toda la superficie que existe. | En plataforma el cron debe iterar N tenants (o el disparo debe ser agnóstico de dominio y resolver el tenant server-side). Un solo `CRON_URL` de proceso deja de tener sentido. |
| 7 | Las constraints únicas tenant-sensibles: `user.email` (`packages/core/prisma/schema.prisma:46`), `Customer.email` (`:98`), `Product.slug` (`:114`), `Product.sku` (`:119`), `Order.numero_orden` (`:155`), `Order.idempotencyKey` (`:160`), la compuesta `AutomationRun` (`automationKey, targetId, periodo`, `:637`), `DashboardPreference.userId` (`:668`). | Con un tenant por base, único-global y único-por-tenant son el mismo constraint — no hay ambigüedad que resolver. | En una base compartida, único-global es demasiado fuerte: dos tenants distintos deben poder tener un cliente con el mismo email, un producto con el mismo slug, una orden con el mismo número. Cada una pasa a ser compuesta con la clave de tenant. |
| 8 | El `CHECK` de fila única de `SiteSetting` (`SiteSetting_singleton`, migración `20260824120000`) y `SiteContent` (`SiteContent_singleton`, migración `20260825120000`) — `id = 'default'`. | Un despliegue es un tenant: una sola fila de config por base es exactamente correcto. | En plataforma estos dos singletons son tablas MULTI-TENANT: el `CHECK` que hoy impide una segunda fila es el que en plataforma impediría tener un segundo cliente. Pasa a una clave de tenant + índice único por tenant, sin el `CHECK` de valor fijo. |
| 9 | El cron por **Vercel Pro (por Project)** — decidido 2026-09-15. Cada Project dispara su propio cron con su `CRON_SECRET`, dentro del proyecto de la tienda. | Es la salida correcta al problema de la fila #6 (el cron por repo) bajo el modelo vigente — con rama-por-Project el cron nace con la tienda, sin una lista manual de pares que mantener (la alternativa, un workflow con matriz en Hobby, reintroduce un punto único de falla que rama-por-Project vino a evitar). Cuesta ~USD 20/mes por miembro. | Bajo BASE COMPARTIDA (el norte) vuelve a ser UN cron — una plataforma con un cron que itera N tenants. El cron por-Project que se paga con Pro se colapsa a uno. Esta deuda y la del cron por repo (fila #6) se cierran juntas en la migración. |
