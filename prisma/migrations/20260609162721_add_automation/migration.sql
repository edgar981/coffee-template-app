-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "veces_ejecutada" INTEGER NOT NULL DEFAULT 0,
    "ultima_ejecucion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Automation_tipo_key" ON "Automation"("tipo");
