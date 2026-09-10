-- Bre-B se suma al enum `MetodoPago` (§ PAGOS-METODOS-MODELO-1 §6): el checkout lo ofrece como
-- QUINTO tipo de la lista de métodos (SiteSetting.metodosPago), y un `Payment`/`Order` con
-- método Bre-B necesita su propio valor en el eje del COBRO, no caer en 'OTRO' — que dejaría al
-- desglose «Por método» del libro de Pagos y su PDF sumando a un total sin nombrarlo.
--
-- EN SU PROPIA MIGRACIÓN, sin usar el valor todavía: Postgres no permite usar un valor de enum
-- recién agregado en la MISMA transacción que lo agrega.
ALTER TYPE "MetodoPago" ADD VALUE 'BREB';
