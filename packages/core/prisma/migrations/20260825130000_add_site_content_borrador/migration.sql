-- SiteContent.borrador: el modelo BORRADOR/PUBLICADO del contenido del storefront.
--
-- `content` es lo PUBLICADO (lo que lee la tienda en vivo); `borrador` es el TRABAJO
-- sin publicar (lo que lee la vista previa del panel). Guardar deja de publicar: escribe
-- el borrador. Publicar copia borrador→content; descartar limpia el borrador.
--
-- ADITIVA PURA — columna nueva, nada se altera ni se borra.
--
-- NULLABLE, SIN default: `NULL` = no hay cambios sin publicar (borrador ≡ publicado). Las
-- filas existentes quedan en NULL, que es el estado correcto (nada pendiente). Es un mapa
-- PARCIAL por sección (`{ [seccion]: draft }`): sólo las secciones borroneadas aparecen,
-- así publicar una no arrastra otra a medias.

ALTER TABLE "SiteContent" ADD COLUMN "borrador" JSONB;
