#!/usr/bin/env bash
#
# LIBRERÍA COMPARTIDA — Postgres efímero (§ ARNES-CAPTURA-SECCION-1). Extraída de
# `scripts/test-integracion.sh` para que el arnés de captura (`scripts/capturar-seccion.sh`)
# REUSE el mismo mecanismo en vez de reescribirlo — palabra del spec: "Reusá el bootstrap de la
# Postgres efímera del gate, no lo reescribas". Este archivo NO se corre solo: quien lo necesite
# hace `source` y llama a `pg_efimero_arriba <puerto> <base>`.
#
# CONTRATO de `pg_efimero_arriba <puerto> <base>`:
#   - deja DATABASE_URL y DIRECT_DATABASE_URL EXPORTADAS, apuntando a un cluster nuevo con la
#     base `<base>` ya creada (vacía, sin migrar — migrar sigue siendo trabajo del caller, como
#     ya lo era en test-integracion.sh);
#   - registra un `trap ... EXIT INT TERM` que para el cluster y borra su datadir cuando el
#     PROCESO QUE HIZO EL `source` termina (por la razón que sea: fin normal, Ctrl-C, o que algo
#     le mande TERM). El caller no gestiona el teardown a mano — es la misma garantía que ya daba
#     test-integracion.sh, ahora compartida.
#
# POR QUÉ UN CLUSTER PROPIO Y NO UNA BASE EXISTENTE, Y POR QUÉ BINARIO Y NO DOCKER: la razón
# original vive en `scripts/test-integracion.sh` (no se duplica acá — sigue siendo la única
# explicación, y esta librería la hereda por composición, no por copia).
set -euo pipefail

pg_efimero_arriba() {
  local puerto="$1"
  local base="$2"

  # ─── Prerequisito, con el remedio en la misma línea ────────────────────────
  if ! command -v initdb >/dev/null 2>&1 || ! command -v pg_ctl >/dev/null 2>&1; then
    echo "✗ Falta Postgres. Instálalo con:  brew install postgresql@14  (y añade su bin al PATH)" >&2
    exit 1
  fi

  if (exec 3<>"/dev/tcp/127.0.0.1/${puerto}") 2>/dev/null; then
    exec 3<&- 2>/dev/null || true
    echo "✗ El puerto ${puerto} está ocupado — probablemente quedó un cluster de una corrida anterior." >&2
    echo "  Ciérralo con:  pg_ctl -D <su datadir> stop -m immediate" >&2
    exit 1
  fi

  # Variables SIN `local`: el trap de abajo (y el propio teardown) las necesitan
  # vivas después de que esta función retorne — es la misma razón por la que
  # test-integracion.sh las declaraba a nivel de script, no dentro de una función.
  PG_EFIMERO_DATADIR="$(mktemp -d)/pg"
  PG_EFIMERO_LOG="${PG_EFIMERO_DATADIR}.log"

  # ─── Teardown en TRAP ──────────────────────────────────────────────────────
  # En `trap ... EXIT` y no al final de la llamada a propósito: un paso posterior
  # que revienta, un Ctrl-C o un `set -e` disparado dejarían el cluster corriendo
  # y el puerto ocupado, y la corrida siguiente fallaría por una razón que no es
  # la suya.
  pg_efimero_teardown() {
    local code=$?
    if [ -n "${PG_EFIMERO_DATADIR:-}" ] && [ -d "$PG_EFIMERO_DATADIR" ]; then
      pg_ctl -D "$PG_EFIMERO_DATADIR" stop -m immediate >/dev/null 2>&1 || true
    fi
    rm -rf "$(dirname "$PG_EFIMERO_DATADIR")" "$PG_EFIMERO_LOG" 2>/dev/null || true
    exit "$code"
  }
  trap pg_efimero_teardown EXIT INT TERM

  # ─── Cluster efímero ───────────────────────────────────────────────────────
  echo "▸ Levantando Postgres efímero en :${puerto}…"
  initdb -D "$PG_EFIMERO_DATADIR" -U postgres --auth=trust >/dev/null

  # `-k ''` DESACTIVA el socket unix y deja solo TCP. No es preferencia: el
  # datadir vive bajo un temp cuyo path supera los 103 bytes que Postgres admite
  # para un socket unix, y el arranque falla con "socket path is too long".
  pg_ctl -D "$PG_EFIMERO_DATADIR" -o "-p ${puerto} -k '' -h 127.0.0.1" -l "$PG_EFIMERO_LOG" -w start >/dev/null

  export DATABASE_URL="postgresql://postgres@127.0.0.1:${puerto}/${base}"
  # El CLI de Prisma lee DIRECT_DATABASE_URL (ver prisma.config.ts). Acá son la
  # misma: no hay pooler que esquivar.
  export DIRECT_DATABASE_URL="$DATABASE_URL"

  psql "postgresql://postgres@127.0.0.1:${puerto}/postgres" -q -c "CREATE DATABASE ${base};"
}
