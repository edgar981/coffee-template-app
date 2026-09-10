-- Los métodos de pago del checkout dejan de ser 4 booleanos fijos + un número móvil
-- COMPARTIDO y pasan a una LISTA (§ PAGOS-METODOS-MODELO-1). Set cerrado de CINCO tipos
-- (nequi · daviplata · breb · transferencia · efectivo), un elemento por tipo,
-- `{ tipo, datos }`. Estar en la lista ES ofrecerlo — un solo eje, sin encendido/apagado
-- aparte de "está o no está".
--
-- NATURALEZA: ADITIVA + BACKFILL. Nada se dropea: las 9 columnas viejas (bancoNombre,
-- bancoTipoCuenta, bancoNumeroCuenta, bancoTitular, pagoNequiActivo, pagoDaviplataActivo,
-- pagoTransferenciaActivo, pagoEfectivoActivo, pagoMovilNumero) se QUEDAN, sin lectores desde
-- este código —son la marcha atrás barata si el backfill sale mal, y dropearlas en el MISMO
-- deploy que el código que deja de leerlas abriría la ventana del `migrate deploy` (un DROP no
-- es atómico con el código nuevo: el código llega DESPUÉS del drop, no con él). El DROP es su
-- propia tanda, code-first, cuando este código ya esté en línea en producción.
--
-- EL BACKFILL compone la lista desde las columnas de hoy, en el orden canónico
-- (nequi · daviplata · transferencia · efectivo — breb no tiene columna vieja, nadie lo tenía),
-- incluyendo un tipo SÓLO si su booleano está en TRUE:
--   pagoNequiActivo         -> {"tipo":"nequi","datos":{"numero": pagoMovilNumero}}
--   pagoDaviplataActivo     -> {"tipo":"daviplata","datos":{"numero": pagoMovilNumero}}
--   pagoTransferenciaActivo -> {"tipo":"transferencia","datos":{banco,tipoCuenta,numeroCuenta,titular}}
--   pagoEfectivoActivo      -> {"tipo":"efectivo","datos":{}}
--
-- `NULL` se copia como CADENA VACÍA, nunca como `null` de JSON — un método sin sus datos es un
-- método INCOMPLETO (estado legítimo y visible), y el parser de lectura (`parseMetodosPago`)
-- trabaja con cadenas. El número móvil se copia a los DOS (nequi y daviplata) si ambos estaban
-- encendidos: es exactamente el comportamiento de hoy (un número compartido); desde acá cada uno
-- es dueño del suyo. No es una migración de negocio: preserva lo vigente.
ALTER TABLE "SiteSetting" ADD COLUMN "metodosPago" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "SiteSetting" SET "metodosPago" = COALESCE((
  SELECT jsonb_agg(elem ORDER BY ord) FILTER (WHERE elem IS NOT NULL)
  FROM (
    VALUES
      (1, CASE WHEN "pagoNequiActivo" THEN jsonb_build_object(
            'tipo', 'nequi', 'datos', jsonb_build_object('numero', COALESCE("pagoMovilNumero", ''))
          ) END),
      (2, CASE WHEN "pagoDaviplataActivo" THEN jsonb_build_object(
            'tipo', 'daviplata', 'datos', jsonb_build_object('numero', COALESCE("pagoMovilNumero", ''))
          ) END),
      (3, CASE WHEN "pagoTransferenciaActivo" THEN jsonb_build_object(
            'tipo', 'transferencia', 'datos', jsonb_build_object(
              'banco',        COALESCE("bancoNombre", ''),
              'tipoCuenta',   COALESCE("bancoTipoCuenta", ''),
              'numeroCuenta', COALESCE("bancoNumeroCuenta", ''),
              'titular',      COALESCE("bancoTitular", '')
            )
          ) END),
      (4, CASE WHEN "pagoEfectivoActivo" THEN jsonb_build_object(
            'tipo', 'efectivo', 'datos', '{}'::jsonb
          ) END)
  ) AS t(ord, elem)
), '[]'::jsonb);
