-- SiteContent: el CONTENIDO editable del storefront (la home). A diferencia de
-- SiteSetting (identidad del negocio, cadencia 2×/año), esto es contenido editorial:
-- cambia cada semana, y el vacío es un estado LEGÍTIMO del editor, no un error.
--
-- ADITIVA PURA — tabla nueva, nada se altera ni se borra.
--
-- SIN INSERT, y ÉSE es el contraste con SiteSetting. El loader de contenido es SOFT
-- (defaults-como-fallback): sin fila, el storefront renderiza los defaults del código
-- (los literales de hoy). Por eso NO hace falta sembrar la fila — aparece sólo cuando el
-- dueño edita. SiteSetting necesitó el INSERT porque su loader FALLA RUIDOSO; éste no.
--
-- CHECK singleton igual que SiteSetting: una sola fila 'default', sin tenant_id (se
-- reemplaza por el scope de tienda el día del multi-schema).

CREATE TABLE "SiteContent" (
    "id"        TEXT NOT NULL DEFAULT 'default',
    "content"   JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SiteContent_singleton" CHECK ("id" = 'default')
);
