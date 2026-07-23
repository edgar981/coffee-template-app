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
| WhatsApp | Twilio (automatizaciones **off** en demo) | Opcional |
| DNS | Cloudflare (`duna.solutions`) → CNAME a Vercel | El dominio sigue en Cloudflare |

**Por qué Vercel y no Cloudflare Workers:** el adapter `pg` (TCP) y el SDK de
Twilio corren tal cual en el runtime Node de Vercel — cero cambios de código.
La ruta Cloudflare exigiría cambiar el adapter Prisma a `@prisma/adapter-neon`,
validar Twilio sobre `workerd` y configurar `wrangler` + bindings. Se decidió
Vercel por mínima fricción; la infra definitiva llegará con el template.

---

## 2. Variables de entorno

Verificadas contra el código (no de memoria). Configúralas en **Vercel →
Project → Settings → Environment Variables** (scope: Production, y Preview si
quieres previews).

| Var | Requerida | Valor / fuente |
|---|---|---|
| `DATABASE_URL` | **Sí** | Neon **pooled** (`...-pooler.neon.tech`), `sslmode=require` |
| `BETTER_AUTH_SECRET` | **Sí** | Secreto nuevo: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **Sí** | `https://nayoli-demo.duna.solutions` |
| `RESEND_API_KEY` | **Sí** (email) | Dashboard de Resend (`re_...`) |
| `EMAIL_FROM` | **Sí** (email) | Remitente en dominio verificado, p. ej. `Café Nayoli <no-reply@duna.solutions>` |
| `ADMIN_EMAIL` | Recomendada | Correo del OWNER del seed (evita el default público) |
| `ADMIN_PASSWORD` | Recomendada | Password del OWNER del seed (evita `ChangeMe123!`) |
| `ADMIN_NAME` | Opcional | Nombre del OWNER (default `Administrador`) |
| `TWILIO_ACCOUNT_SID` | Opcional | Solo si activas automatizaciones WhatsApp |
| `TWILIO_AUTH_TOKEN` | Opcional | idem |
| `TWILIO_WHATSAPP_FROM` | Opcional | idem, `whatsapp:+14155238886` |

> Twilio es opcional: el cliente se construye de forma perezosa
> (`lib/whatsapp.ts`), así que sin estas vars nada revienta al importar; solo
> fallaría el envío si se dispara una automatización (vienen **inactivas**).

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

Se corren **una vez, en local**, apuntando a Neon. Prisma 7 lee `DATABASE_URL`
desde `.env` (vía `prisma.config.ts` → `dotenv/config`).

```bash
# 1) En .env (local), apunta a la conexión DIRECTA de Neon para migrar:
#    DATABASE_URL="postgresql://USER:PASS@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
#    BETTER_AUTH_SECRET="<el mismo que pondrás en Vercel>"
#    ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME

# 2) Aplica el esquema (25 migraciones):
npx prisma migrate deploy

# 3) Carga el demo completo (admin OWNER, catálogo Nayoli, órdenes,
#    pagos, envíos, inventario, automatizaciones inactivas):
npx prisma db seed
```

- **`migrate deploy`** usa la conexión **directa** (PgBouncer/pooled puede
  romper el advisory-lock de migraciones).
- El seed es **idempotente** (upserts). Excepción: `InventoryLog` no tiene clave
  única → re-seedear **duplica** los logs de inventario (ver §7).
- El seed crea el OWNER vía Better Auth: necesita `DATABASE_URL` **y**
  `BETTER_AUTH_SECRET` presentes al correrlo.

---

## 5. Deploy en Vercel

1. **Import** del repo en Vercel (framework detectado: Next.js).
2. **Build**: el cliente Prisma vive en `src/generated/prisma`, que está
   **gitignored** → debe generarse en cada build. `vercel.json` fija el build
   command a `prisma generate && next build` (el `postinstall` por sí solo no es
   fiable en Vercel). No sobreescribas el Build Command en el dashboard: déjalo
   heredar de `vercel.json`.
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

- **noindex**: `next.config.ts` emite `X-Robots-Tag: noindex, nofollow` en
  **toda** respuesta (`source: '/:path*'`). Cubre HTML, API y assets. Se quita al
  promover a producción real.
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
  | npx prisma db execute --stdin --schema prisma/schema.prisma

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
3. **Quitar el noindex**: eliminar el bloque `headers()` de `next.config.ts` (o
   condicionarlo por entorno) para permitir indexación.
4. **Dominio final**: apuntar el dominio de producción y actualizar
   `BETTER_AUTH_URL`.
5. **Twilio/Resend reales**: credenciales productivas y dominio de envío
   definitivo; activar automatizaciones si aplica.
6. **Datos reales**: no correr el seed de demo; cargar catálogo/usuarios reales.

---

## 9. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Build falla: `@/src/generated/prisma` no existe | `prisma generate` no corrió | Verifica el script `postinstall`; re-deploy limpiando caché |
| `migrate deploy` cuelga o falla con advisory lock | Usaste la conexión pooled | Usa la conexión **directa** de Neon para migrar |
| Login falla / CSRF / origin | `BETTER_AUTH_URL` no coincide con el dominio | Ponlo exactamente en `https://nayoli-demo.duna.solutions` |
| Invitación devuelve 500 | Falta `RESEND_API_KEY`/`EMAIL_FROM` o dominio no verificado | Configura Resend y verifica el dominio de `EMAIL_FROM` |
| El dominio no emite TLS | CNAME proxied (nube naranja) en Cloudflare | Cambia a **DNS only** (nube gris) |
