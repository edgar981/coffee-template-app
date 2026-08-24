-- SiteSetting: datos EDITABLES del negocio (fase 1 multi-tenant). Sólo campos PLANOS.
--
-- ADITIVA PURA — una tabla nueva, nada se altera ni se borra: un deploy viejo (que
-- aún lee `siteConfig` de código) convive sin enterarse.
--
-- LA FILA VA EN LA MIGRACIÓN, no en el seed — y es lo que hace la tanda DEPLOYABLE.
-- El build de producción corre `migrate deploy` pero NO el seed, así que sin este
-- INSERT la tabla nacería VACÍA, el loader fallaría ruidoso (por diseño) y el
-- storefront caería. El INSERT hace que la fila exista en el mismo instante que la
-- tabla: cero ventana. Corre una sola vez (tracked en _prisma_migrations).
--
-- Los valores son los de `lib/config/site.ts` de hoy. `emailReplyTo`/`adminEmail`
-- quedan NULL: el reply-to no existe todavía y el destinatario de reportes se llena
-- al encender un reporte (las automatizaciones de correo nacen apagadas).

CREATE TABLE "SiteSetting" (
    "id"                TEXT NOT NULL DEFAULT 'default',
    "nombre"            TEXT NOT NULL,
    "tagline"           TEXT NOT NULL,
    "descripcionFooter" TEXT NOT NULL,
    "whatsapp"          TEXT NOT NULL,
    "instagram"         TEXT NOT NULL,
    "emailRemitente"    TEXT NOT NULL,
    "emailReplyTo"      TEXT,
    "adminEmail"        TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id"),
    -- SINGLETON, a nivel de base: una sola fila, la de `default`. No hay tenant_id
    -- (§ schema.prisma). Prisma no modela CHECK, así que este constraint no vive en
    -- el schema — es intencional; se retira cuando el `id` pase a ser la clave de
    -- tienda con el multi-schema.
    CONSTRAINT "SiteSetting_singleton" CHECK ("id" = 'default')
);

INSERT INTO "SiteSetting"
    ("id", "nombre", "tagline", "descripcionFooter", "whatsapp", "instagram", "emailRemitente", "updatedAt")
VALUES
    ('default',
     'Café Nayoli',
     'Supatá · Cundinamarca',
     'Café de especialidad colombiano. De nuestra finca en Supatá a tu taza.',
     '+573155766064',
     'cafenayoliorigen',
     'Café Nayoli <pedidos@mail.duna.solutions>',
     CURRENT_TIMESTAMP);
