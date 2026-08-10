-- La dirección de entrega vive SOLO en la orden (Order.direccion_entrega,
-- ciudad_entrega, direccion_detalle). El Shipping ya no guarda copia propia: la
-- entrega LEE la dirección de su orden vía la relación (board, modal y el guard
-- de "programar" ya migraron). Estas columnas snapshot quedaron sin uso —ni se
-- escriben ni se leen— así que se eliminan. No se pierde información: la orden
-- tiene la dirección autoritativa. costo_envio se conserva (snapshot legítimo).
ALTER TABLE "Shipping" DROP COLUMN "direccion";
ALTER TABLE "Shipping" DROP COLUMN "ciudad";
