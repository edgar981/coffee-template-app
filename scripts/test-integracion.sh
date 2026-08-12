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
set -euo pipefail

# Puerto PROPIO: 5432 suele tener un Postgres de desarrollo escuchando, y
# apuntarle sin querer es exactamente lo que este carril evita.
PUERTO=55432
BASE=integracion
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Prerequisito, con el remedio en la misma línea ──────────────────────────
if ! command -v initdb >/dev/null 2>&1 || ! command -v pg_ctl >/dev/null 2>&1; then
  echo "✗ Falta Postgres. Instálalo con:  brew install postgresql@14  (y añade su bin al PATH)" >&2
  exit 1
fi

if (exec 3<>"/dev/tcp/127.0.0.1/${PUERTO}") 2>/dev/null; then
  exec 3<&- 2>/dev/null || true
  echo "✗ El puerto ${PUERTO} está ocupado — probablemente quedó un cluster de una corrida anterior." >&2
  echo "  Ciérralo con:  pg_ctl -D <su datadir> stop -m immediate" >&2
  exit 1
fi

DATADIR="$(mktemp -d)/pg"
LOG="${DATADIR}.log"

# ─── Teardown en TRAP ────────────────────────────────────────────────────────
# En `trap ... EXIT` y no al final del script a propósito: un test que revienta,
# un Ctrl-C o un `set -e` disparado dejarían el cluster corriendo y el puerto
# ocupado, y la corrida siguiente fallaría por una razón que no es la suya.
teardown() {
  local code=$?
  if [ -d "$DATADIR" ]; then
    pg_ctl -D "$DATADIR" stop -m immediate >/dev/null 2>&1 || true
  fi
  rm -rf "$(dirname "$DATADIR")" "$LOG"
  exit $code
}
trap teardown EXIT INT TERM

# ─── Cluster efímero ─────────────────────────────────────────────────────────
echo "▸ Levantando Postgres efímero en :${PUERTO}…"
initdb -D "$DATADIR" -U postgres --auth=trust >/dev/null

# `-k ''` DESACTIVA el socket unix y deja solo TCP. No es preferencia: el
# datadir vive bajo un temp cuyo path supera los 103 bytes que Postgres admite
# para un socket unix, y el arranque falla con "socket path is too long".
pg_ctl -D "$DATADIR" -o "-p ${PUERTO} -k '' -h 127.0.0.1" -l "$LOG" -w start >/dev/null

export DATABASE_URL="postgresql://postgres@127.0.0.1:${PUERTO}/${BASE}"
# El CLI de Prisma lee DIRECT_DATABASE_URL (ver prisma.config.ts). Acá son la
# misma: no hay pooler que esquivar.
export DIRECT_DATABASE_URL="$DATABASE_URL"

psql "postgresql://postgres@127.0.0.1:${PUERTO}/postgres" -q -c "CREATE DATABASE ${BASE};"

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
