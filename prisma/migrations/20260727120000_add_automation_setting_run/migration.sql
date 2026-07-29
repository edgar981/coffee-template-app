-- Automatizaciones: settings (activo + overrides de config) y bitácora de runs.
--
-- ADITIVA PURA — dos tablas nuevas, un enum nuevo, y una copia one-time de datos.
-- No altera ni borra nada existente: un despliegue viejo (que aún lee la tabla
-- `Automation`) convive sin enterarse. El `DROP TABLE "Automation"` es la fase
-- CONTRACT y va en un deploy POSTERIOR, no aquí.

-- ── AutomationSetting ────────────────────────────────────────────────────────
-- `key` es la PK: constante del registry de código (constants/automations.ts).
CREATE TABLE "AutomationSetting" (
    "key"       TEXT NOT NULL,
    "activo"    BOOLEAN NOT NULL DEFAULT false,
    "config"    JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("key")
);

-- ── AutomationRun ────────────────────────────────────────────────────────────
CREATE TYPE "AutomationRunEstado" AS ENUM ('ENVIADO', 'PENDIENTE_CANAL', 'FALLIDO', 'OMITIDO');

CREATE TABLE "AutomationRun" (
    "id"            TEXT NOT NULL,
    "automationKey" TEXT NOT NULL,
    "targetType"    TEXT NOT NULL,
    "targetId"      TEXT NOT NULL,
    -- NOT NULL a propósito: dos NULL no colisionan en Postgres, así que un periodo
    -- nulo anularía el unique de abajo. Las automatizaciones por evento usan 'evt'.
    "periodo"       TEXT NOT NULL,
    "canal"         TEXT NOT NULL,
    "estado"        "AutomationRunEstado" NOT NULL,
    "payload"       JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- EL gate de idempotencia de los barridos: un INSERT que colisiona (P2002) es
-- "ya lo hicimos", no un error.
CREATE UNIQUE INDEX "AutomationRun_automationKey_targetId_periodo_key"
    ON "AutomationRun"("automationKey", "targetId", "periodo");

-- Alimenta el contador "últimas ejecuciones" de cada card (3 más recientes por key).
CREATE INDEX "AutomationRun_automationKey_createdAt_idx"
    ON "AutomationRun"("automationKey", "createdAt" DESC);

-- ── Copia one-time de los toggles ya existentes ──────────────────────────────
-- Para que el owner no pierda lo que ya tuviera encendido en la tabla vieja. Las
-- keys del registry nuevo reusan a propósito los `tipo` viejos, así que la copia es
-- directa. ON CONFLICT la hace re-ejecutable sin daño.
INSERT INTO "AutomationSetting" ("key", "activo", "config", "createdAt", "updatedAt")
SELECT "tipo", "activa", '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Automation"
ON CONFLICT ("key") DO NOTHING;
