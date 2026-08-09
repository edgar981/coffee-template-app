-- Acceso al panel por usuario. ADITIVA y compatible con el deploy anterior:
-- DEFAULT true deja a todos los usuarios existentes exactamente como estaban, y
-- el código viejo —que no conoce la columna— sigue funcionando porque nunca la
-- lee ni la escribe.
--
-- NOT NULL con default y no nullable: "sin dato" no es un estado de acceso
-- válido. Un usuario o entra o no entra.
ALTER TABLE "user" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
