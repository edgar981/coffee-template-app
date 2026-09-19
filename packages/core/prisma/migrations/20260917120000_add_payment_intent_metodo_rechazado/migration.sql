-- El TIPO DE MÉTODO que Wompi rechazó por no tenerlo habilitado en la cuenta (§ API-DIRECTA-
-- DESALINEO-DUENO-1) — ver el comentario de `PaymentIntent.metodo_rechazado` en schema.prisma
-- para el porqué completo. ADITIVA, NULLABLE, SIN DEFAULT: nace NULL para toda fila existente
-- y para toda fila nueva hasta que una creación falle por esa causa exacta.
ALTER TABLE "PaymentIntent" ADD COLUMN "metodo_rechazado" TEXT;

-- Índice COMPUESTO, no parcial: la sintaxis de Prisma (`@@index`) no puede declarar un índice
-- parcial (`WHERE metodo_rechazado IS NOT NULL`), así que la consulta del aviso del dueño
-- filtra por `IN (<tipos que el dueño ofrece hoy>)` — un IN acotado (2-5 valores, nunca crece
-- con la tabla) que este índice sirve por cada valor del IN, en vez de recorrer la tabla
-- entera buscando las pocas filas no-nulas.
CREATE INDEX "PaymentIntent_metodo_rechazado_updatedAt_idx" ON "PaymentIntent"("metodo_rechazado", "updatedAt" DESC);
