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

-- VALORES NEUTROS, NO Café Nayoli. El loader es HARD (findUniqueOrThrow), así que la
-- fila DEBE existir para que el storefront no reviente — pero sus VALORES son de
-- placeholder, no de un negocio real: `nombre` se lee como "falta configurar" (aparece
-- en el wordmark, la pestaña y el manifest, tres sitios), y el resto va VACÍO (un
-- WhatsApp/Instagram placeholder sería un dato FALSO publicado, peor que un campo en
-- blanco; el storefront oculta esos enlaces cuando están vacíos). Un cliente nuevo
-- arranca diciendo "Configura tu tienda" y edita todo en Configuración. La DEMO de
-- Nayoli no cambia: su seed sigue haciendo el upsert de SiteSetting con los valores
-- reales de Nayoli sobre esta fila.
--
-- POR QUÉ SE EDITA ESTA MIGRACIÓN YA APLICADA, en vez de crear una NUEVA: una migración
-- nueva correría TAMBIÉN sobre la base de Nayoli y PISARÍA su config real — no puede
-- distinguir "fila fresca con el default" de "fila que el owner ya editó". Editar el
-- INSERT de aquí sólo afecta bases que AÚN NO aplicaron esta migración (los clientes
-- nuevos): `prisma migrate deploy` (el build) aplica sólo lo PENDIENTE y SALTA lo ya
-- aplicado, así que Nayoli y dev quedan intactos. (Local `migrate dev`/`migrate status`
-- notarán el checksum modificado — es cosmético; el pipeline usa `migrate deploy`.)
INSERT INTO "SiteSetting"
    ("id", "nombre", "tagline", "descripcionFooter", "whatsapp", "instagram", "emailRemitente", "updatedAt")
VALUES
    ('default',
     'Configura tu tienda',
     '',
     '',
     '',
     '',
     '',
     CURRENT_TIMESTAMP);
