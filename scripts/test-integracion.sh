#!/usr/bin/env bash
#
# Carril de tests de INTEGRACIÓN — levanta un Postgres efímero, migra, corre los
# tests de las cadenas del motor de automatizaciones y borra todo rastro.
#
# POR QUÉ UN CLUSTER PROPIO Y NO UNA BASE EXISTENTE: el criterio es que estos
# tests no puedan tocar nada. `development` la comparten el `.env` local y los
# previews (ver CLAUDE.md § Bases de datos), así que correr contra ella haría que
# un test con un `deleteMany` mal escrito borrara datos que alguien está mirando.
# Un cluster en un directorio temporal, en su propio puerto, no tiene forma de
# alcanzar ninguna base real — y ése es el punto, no la velocidad.
#
# POR QUÉ BINARIO Y NO DOCKER: `docker` puede estar instalado con el daemon
# apagado, y entonces `npm run test:integracion` falla pidiendo que abras Docker
# Desktop. El binario de Homebrew arranca en ~1 s sin depender de nada más.
#
# EL BOOTSTRAP DEL CLUSTER (prerequisito, puerto ocupado, datadir, trap de
# teardown, `initdb`/`pg_ctl`/`CREATE DATABASE`) SE MUDÓ A `postgres-efimero.sh`
# (§ ARNES-CAPTURA-SECCION-1): el arnés de captura de secciones necesita el MISMO
# mecanismo y el spec pidió reusarlo, no reescribirlo. Esta extracción no cambia
# el comportamiento de este script — mismo puerto, misma base, mismo trap.
#
set -euo pipefail

# Puerto PROPIO: 5432 suele tener un Postgres de desarrollo escuchando, y
# apuntarle sin querer es exactamente lo que este carril evita.
PUERTO=55432
BASE=integracion
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$RAIZ/scripts/postgres-efimero.sh"
pg_efimero_arriba "$PUERTO" "$BASE"

echo "▸ Aplicando migraciones…"
cd "$RAIZ"
# El schema vive en packages/core desde Fase A: se migra en el contexto de core
# (su prisma.config resuelve schema + migraciones). El DIRECT_DATABASE_URL efímero
# ya está exportado arriba y el dotenv de core (override:false) NO lo pisa, así que
# esto migra la base efímera, nunca `development`.
npm run --silent db:deploy -w @duna/core >/dev/null

# ─── Los tests ───────────────────────────────────────────────────────────────
# Glob PROPIO: el runner de siempre (`npm test`) barre `lib/**/*.test.ts` y no
# ve nada de acá. Son dos carriles, no una migración del runner.
#
# `--test-concurrency=1` NO es una precaución vaga: por defecto `node --test` corre los
# ARCHIVOS en paralelo, y acá todos comparten UNA base. Sin esto, el `limpiar()`
# de un archivo borra las filas que otro está afirmando y `soloActiva` choca
# contra el unique de `AutomationSetting` — fallos que no tienen nada que ver con
# el código bajo prueba. Los tests dentro de un archivo ya son secuenciales.
echo "▸ Corriendo tests de integración…"
node --import tsx --test --test-concurrency=1 "tests/integracion/**/*.test.ts"
