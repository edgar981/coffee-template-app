-- Actor del asiento de kardex. ADITIVA y compatible con el deploy anterior: las
-- dos columnas son NULLABLE, así que las filas existentes quedan en NULL (nadie
-- sabe quién las hizo — honesto) y el código viejo, que no conoce las columnas,
-- sigue funcionando porque nunca las lee ni las escribe.
--
-- Snapshot SIN FK, mismo patrón que Payment (registrado_por/_nombre) y
-- OrderStatusTransition (actor_id/actor_nombre): el historial de auditoría tiene
-- que sobrevivir a que el usuario se desactive o se borre.
--
-- El disparador del backlog #2 era "cuando algo consuma la auditoría"; la vertical
-- de Inventario, que muestra el kardex como vista de auditoría, es ese consumidor.
ALTER TABLE "InventoryLog" ADD COLUMN "ajustado_por" TEXT;
ALTER TABLE "InventoryLog" ADD COLUMN "ajustado_por_nombre" TEXT;
