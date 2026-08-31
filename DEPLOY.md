# DEPLOY — Demo Café Nayoli

Guía de despliegue del **demo** en `nayoli-demo.duna.solutions`.
Infra de demo, intencionalmente de baja fricción; la promoción a
producción real está al final.

---

## 1. Stack y decisión de plataforma

| Pieza | Elección | Nota |
|---|---|---|
| Hosting | **Vercel** | Drop-in para Next 16; route handlers en runtime **Node** por defecto |
| DB | **Neon** (Postgres, free tier) | Soporta arrays/enums/JSON que usa el schema |
| ORM | Prisma 7 + `@prisma/adapter-pg` (`pg`/TCP) | Requiere runtime Node → no edge |
| Auth | Better Auth, storage en Postgres (vía Prisma) | Sesión en DB |
| Email | Resend | Invitaciones al panel |
| WhatsApp | Meta Cloud API — **sin conectar** (canal en stub) | Pendiente |
| Cron | GitHub Actions (`0 * * * *`) → `/api/cron/automations` | Vercel Hobby solo corre crons 1×/día |
| DNS | Cloudflare (`duna.solutions`) → CNAME a Vercel | El dominio sigue en Cloudflare |

**Por qué Vercel y no Cloudflare Workers:** el adapter `pg` (TCP) corre tal cual
en el runtime Node de Vercel — cero cambios de código. La ruta Cloudflare exigiría
cambiar el adapter Prisma a `@prisma/adapter-neon` y configurar `wrangler` +
bindings. Se decidió Vercel por mínima fricción; la infra definitiva llegará con
el template.

---

## 2. Variables de entorno

Verificadas contra el código (no de memoria). Configúralas en **Vercel →
Project → Settings → Environment Variables** (scope: Production, y Preview si
quieres previews).

> ⚠️ **Las dos vars de base de datos van por entorno, con valores DISTINTOS.**
> El build corre `prisma migrate deploy` sin condición: cada entorno migra la
> base a la que apunta. Si le das a Preview el mismo valor que a Production,
> una rama de feature migra PRODUCCIÓN antes de que `main` tenga el código.
> Preview debe apuntar a una base propia (acá: la rama `development` de Neon).

| Var | Requerida | Valor / fuente |
|---|---|---|
| `DATABASE_URL` | **Sí** | Neon **pooled** (`...-pooler.neon.tech`), `sslmode=require`. **Una entrada por entorno** (ver aviso arriba) |
| `DIRECT_DATABASE_URL` | **Sí** | Neon **directa** (SIN `-pooler`), misma base que su `DATABASE_URL`. La lee `prisma.config.ts` para `migrate deploy`; si falta cae a la pooled y PgBouncer rompe los advisory locks. **Una entrada por entorno** |
| `BETTER_AUTH_SECRET` | **Sí** | Secreto nuevo: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **Sí** | `https://nayoli-demo.duna.solutions` |
| `RESEND_API_KEY` | **Sí** (email) | Dashboard de Resend (`re_...`) |
| `EMAIL_FROM` | **Sí** (email) | Remitente en dominio verificado, p. ej. `Café Nayoli <no-reply@duna.solutions>` |
| `SEED_OWNER_EMAIL` | Local (seed) | Correo/login del OWNER que siembra el seed. SOLO local (`prisma db seed`), no va a Vercel. Evita el default público |
| `ADMIN_PASSWORD` | Local (seed) | Password del OWNER del seed (evita `ChangeMe123!`). SOLO local |
| `ADMIN_NAME` | Local (seed) | Nombre del OWNER (default `Administrador`). SOLO local |
| `CRON_SECRET` | **Sí** (automatizaciones) | `openssl rand -hex 32`. MISMO valor en Vercel y en GitHub → Settings → Secrets → Actions |
| `NOTIFICATIONS_REDIRECT_EMAIL` | Opcional | Solo dev/preview: desvía TODO correo a un buzón de pruebas. **Sin poner en Producción** |
| `NOINDEX` | Opcional (demos/pilotos) | `=1` en CUALQUIER despliegue que NO deba indexarse (demos, pilotos). **Ausente = indexable**, el default SEGURO para un cliente real (no nace invisible). La demo la pone; un cliente real NO |
| `CRON_URL` | **Obligatoria** (GitHub Actions, no Vercel) | Variable del repo (Settings → Secrets and variables → Actions → **Variables**), UNA por despliegue: la URL EXACTA del cron, `https://<dominio>/api/cron/automations` (path incluido). **SIN fallback**: si falta, el cron FALLA ruidoso en vez de pegarle a otro dominio |

> **Las DOS variables POR-DESPLIEGUE que un cliente nuevo necesita** (antes sin documentar):
> **`NOINDEX`** — ponla `=1` sólo en lo que NO debe indexarse (demos, pilotos); su ausencia
> es "indexable", el default seguro para un cliente real. Y **`CRON_URL`** — obligatoria,
> SIN fallback: si falta, el cron falla ruidoso en vez de pegarle a otro dominio.

> El destinatario por defecto de los reportes al equipo (semanal y diario) YA NO es
> una env var: vive en la base como `SiteSetting.adminEmail`, editable en
> **Configuración**. Encender un reporte sin ese correo Y sin "Destinatarios" en su
> diálogo devuelve **400** (no se puede dejar encendido algo que omitiría en silencio).

> `CRON_SECRET` protege `POST /api/cron/automations`. Sin la env var el endpoint
> responde **503** (cerrado, no abierto); con un valor equivocado, **401**. El
> disparo horario lo hace `.github/workflows/automations-cron.yml`, y GitHub solo
> ejecuta `schedule` desde la RAMA POR DEFECTO — hasta que el workflow esté en
> `main`, el cron no corre.

> WhatsApp: **no hay credenciales que poner todavía**. El canal es un stub que
> registra el mensaje renderizado como `PENDIENTE_CANAL`; cuando llegue Meta hará
> falta `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`. Las `TWILIO_*` fueron
> retiradas: si siguen puestas en Vercel, bórralas.

> `DATABASE_URL` (runtime) usa el string **pooled**. Para **migraciones** usa el
> string **directo** (sin `-pooler`) — ver §4.

---

## 3. Requisitos previos (cuentas — las creas tú)

Claude no puede crear cuentas ni manejar secretos. Antes de continuar:

1. **Neon**: crea un proyecto Postgres. Copia **dos** connection strings:
   - Pooled: host `...-pooler.neon.tech` → irá a Vercel (`DATABASE_URL`).
   - Directo: host sin `-pooler` → para correr las migraciones.
2. **Resend**: verifica un dominio de envío (p. ej. `duna.solutions`) y crea una
   API key.
3. **Vercel**: cuenta con acceso a este repo de Git.
4. **Cloudflare**: acceso al DNS de `duna.solutions`.

---

## 4. Migraciones + seed (contra Neon)

**Las migraciones las corre el BUILD de Vercel, no tú a mano** (§ CLAUDE.md,
"Migraciones y deploy"): `npm run build` ejecuta `npm run db:deploy -w @duna/core`
(= `prisma migrate deploy`) contra `DIRECT_DATABASE_URL` **antes** de `next build`,
así que cada entorno migra su propia base solo. **El seed NO va en el build** — es
el único paso manual, y crea el primer OWNER (sin él nadie entra al panel; el
sign-up público está cerrado y las invitaciones exigen un OWNER previo).

Para correr migraciones/seed a mano en local (sembrar el owner + demo la primera
vez), apunta el `.env` de la raíz a la conexión **DIRECTA** de Neon y corre:

```bash
# .env (raíz): la conexión DIRECTA (sin -pooler) va en DIRECT_DATABASE_URL, más
#   DATABASE_URL, BETTER_AUTH_SECRET (el mismo de Vercel) y
#   SEED_OWNER_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.

# 1) Aplica el esquema (46 migraciones). El schema vive en packages/core:
npm run db:deploy -w @duna/core

# 2) Carga el demo (admin OWNER, catálogo Nayoli, órdenes, pagos, envíos,
#    inventario; las automatizaciones nacen inactivas). El seed es `tsx` SIN
#    cargador de `.env` propio, así que hay que pasárselo con --env-file:
npx tsx --env-file=.env prisma/seed.ts
```

- **`migrate deploy` usa la conexión DIRECTA** (PgBouncer/pooled rompe el
  advisory-lock de migraciones). La lee `packages/core/prisma.config.ts`
  (`DIRECT_DATABASE_URL ?? DATABASE_URL`).
- El seed es **idempotente** (upserts). Excepción: `InventoryLog` no tiene clave
  única → re-seedear **duplica** los logs de inventario (ver §7).
- El seed crea el OWNER vía Better Auth: necesita `DATABASE_URL` **y**
  `BETTER_AUTH_SECRET` presentes al correrlo (por eso el `--env-file`).

---

## 5. Deploy en Vercel

1. **Import** del repo en Vercel (framework detectado: Next.js).
2. **Build**: `vercel.json` fija el build command a `npm run build`, que es
   `npm run db:deploy -w @duna/core && next build` — o sea **migra la base
   (`migrate deploy`) y luego compila**. El cliente Prisma (gitignored, en
   `packages/core/src/generated/prisma`) lo genera el `postinstall`
   (`npm run generate -w @duna/core`) tras `npm install`. No sobreescribas el
   Build Command en el dashboard: déjalo heredar de `vercel.json`.
3. **Env vars**: carga todas las de §2 **antes del primer build** (`DATABASE_URL`
   = string **pooled**).
4. **Deploy**. Node 20/22 (default de Vercel; el proyecto pide Node ≥ 20.9).

### Dominio
1. Vercel → Project → Settings → Domains → añade `nayoli-demo.duna.solutions`.
2. Vercel dará un target CNAME (`cname.vercel-dns.com`).
3. Cloudflare DNS (`duna.solutions`) → añade registro:
   - Type `CNAME`, Name `nayoli-demo`, Target `cname.vercel-dns.com`,
     **Proxy status: DNS only** (nube gris) para que Vercel emita el TLS.
4. Espera la verificación del dominio y del certificado en Vercel.

---

## 6. Protecciones del demo

- **noindex**: `next.config.ts` emite `X-Robots-Tag: noindex, nofollow` en **toda**
  respuesta (HTML, API, assets) cuando el deploy NO es producción **o** cuando
  `NOINDEX=1`. La demo es env `production`, así que **setea `NOINDEX=1`** para quedar
  fuera de buscadores. La producción de un cliente real deja `NOINDEX` sin poner →
  indexable (un cliente real no puede nacer invisible).
- **Admin con login obligatorio**: `proxy.ts` (middleware) redirige a `/login`
  cualquier `/admin/*` sin cookie de sesión; además `app/(admin)/admin/layout.tsx`
  revalida sesión **y** rol (OWNER/MANAGER) en el server, y cada `/api` sensible
  re-chequea rol (defensa en profundidad).
- **Auth en el dominio real**: `BETTER_AUTH_URL=https://nayoli-demo.duna.solutions`.
  Better Auth deriva de ahí su origen de confianza; login y admin son mismo
  origen, así que no hace falta `trustedOrigins` extra.

---

## 7. Re-seedear el demo (sin romper usuarios)

Los pedidos demo se generan con **fechas relativas a `now`** (`buildDemoOrders` en
`prisma/seed.ts`): 6 pagadas el **mes anterior** → limpia el piso anti-ruido de las
tendencias (≥5, ver `lib/metrics/trend.ts`), y 8 el **mes actual** hasta hoy →
crecimiento. El seed es idempotente por `numero_orden` con `update: {}`, así que
**re-correrlo a secas NO refresca las fechas** de pedidos existentes. Para
refrescar el demo hay que **borrar primero la data transaccional demo** —
preservando SIEMPRE los usuarios.

> ⚠️ **NUNCA** uses `prisma migrate reset`: borra TODA la base, incluidos los
> usuarios admin (`admin@duna.solutions`) e invitados. Usa el reset selectivo.

Apunta `DATABASE_URL` a la conexión **directa** de Neon (sin `-pooler`) y corre:

```bash
# 1) Reset SELECTIVO de la data demo. Preserva user/account/session/Invitation,
#    Product y Automation. El FK de Order cascadea OrderItem/Payment/Shipping.
printf '%s\n' \
  'DELETE FROM "Order";' \
  'DELETE FROM "Customer";' \
  'DELETE FROM "InventoryLog";' \
  'DELETE FROM "Notification";' \
  | npx prisma db execute --stdin --schema packages/core/prisma/schema.prisma

# 2) Seed limpio: recrea clientes, pedidos (fechas relativas + items reales),
#    pagos y envíos; re-upserta productos y automatizaciones; conserva el admin.
npx prisma db seed
```

El admin se preserva: el seed hace `signUpEmail` (si ya existe lo omite) y reasigna
rol OWNER — la contraseña (`ADMIN_PASSWORD`) no cambia. **Verifica el login después**
(`admin@duna.solutions`). Re-seed idempotente sin refrescar fechas: `npx prisma db
seed` a secas — pero `InventoryLog` no es idempotente (duplica), por eso el reset lo
incluye.

---

## 8. Promoción a producción real

Cuando el template esté listo, migrar el demo a producción implica:

1. **DB nueva** (proyecto Neon/Postgres de producción) — no reutilizar la del
   demo. Nuevo `DATABASE_URL`.
2. **Secretos nuevos**: `BETTER_AUTH_SECRET` distinto; `ADMIN_PASSWORD` real;
   rotar API keys.
3. **Indexación**: la producción de un cliente real ya es indexable
   automáticamente (el noindex sólo se emite fuera de producción o con `NOINDEX=1`).
   No hay bloque que quitar: sólo **no** setear `NOINDEX` en el proyecto del cliente.
4. **Dominio final**: apuntar el dominio de producción y actualizar
   `BETTER_AUTH_URL`.
5. **Resend real**: credenciales productivas y dominio de envío definitivo.
   WhatsApp (Meta) es aparte: ver los prerequisitos de go-live en `CLAUDE.md`
   antes de activar las automatizaciones de ese canal.
6. **Datos reales**: no correr el seed de demo; cargar catálogo/usuarios reales.

---

## 9. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Build falla: `packages/core/src/generated/prisma` no existe | `prisma generate` (postinstall) no corrió | Verifica el `postinstall` (`npm run generate -w @duna/core`); re-deploy limpiando caché |
| `migrate deploy` cuelga o falla con advisory lock | Usaste la conexión pooled | Usa la conexión **directa** de Neon para migrar |
| Login falla / CSRF / origin | `BETTER_AUTH_URL` no coincide con el dominio | Ponlo exactamente en `https://nayoli-demo.duna.solutions` |
| Invitación devuelve 500 | Falta `RESEND_API_KEY`/`EMAIL_FROM` o dominio no verificado | Configura Resend y verifica el dominio de `EMAIL_FROM` |
| El dominio no emite TLS | CNAME proxied (nube naranja) en Cloudflare | Cambia a **DNS only** (nube gris) |
