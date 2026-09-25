-- Las redes sociales del negocio dejan de ser DOS COLUMNAS FIJAS (instagram/whatsapp) y pasan a
-- una LISTA extensible (§ MUESTRARIO-REDES-ADICIONALES-1), MISMO patrón que
-- `20260910120000_site_setting_metodos_pago`: columna Json + BACKFILL en esta misma migración,
-- parseada SOFT por `parseRedesSociales` (lib/config/site.ts). Set cerrado de CINCO tipos —
-- instagram · whatsapp · facebook · x · pinterest —; hoy sólo instagram/whatsapp tienen columna
-- vieja que backfillear, así que son los dos únicos elementos que puede producir esta migración.
--
-- NATURALEZA: ADITIVA + BACKFILL. Nada se dropea: `instagram`/`whatsapp` se QUEDAN — son la
-- marcha atrás barata si el backfill sale mal, y dropearlas en el MISMO deploy que el código que
-- deja de leerlas abriría la ventana del `migrate deploy` (§ CLAUDE.md — LA VENTANA del `migrate
-- deploy`). El DROP es su propia tanda, code-first, cuando este código ya esté en línea. Además
-- `whatsapp` NO queda huérfana: sigue siendo la fuente para el checkout, `lib/config/telefono.ts`
-- y las automatizaciones — sólo `redes` deja de derivarse de ella para el riel/footer.
--
-- EL BACKFILL compone la lista en el orden [instagram, whatsapp] — el mismo orden en que
-- `RielSocial`/`StoreFooter` ya pintaban los dos botones hoy —, incluyendo un tipo SÓLO si su
-- columna vieja NO está vacía (un valor vacío no es una red configurada, es la ausencia de una):
--   instagram (no vacío) -> {"tipo":"instagram","valor": instagram}
--   whatsapp  (no vacío) -> {"tipo":"whatsapp","valor": whatsapp}
--
-- Con esto Nayoli (las dos columnas pobladas) backfillea a DOS elementos, en el MISMO orden que
-- el riel/footer ya usaban — byte-idéntico tras el cambio de fuente.
ALTER TABLE "SiteSetting" ADD COLUMN "redes" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "SiteSetting" SET "redes" = COALESCE((
  SELECT jsonb_agg(elem ORDER BY ord) FILTER (WHERE elem IS NOT NULL)
  FROM (
    VALUES
      (1, CASE WHEN "instagram" IS NOT NULL AND trim("instagram") <> '' THEN jsonb_build_object(
            'tipo', 'instagram', 'valor', "instagram"
          ) END),
      (2, CASE WHEN "whatsapp" IS NOT NULL AND trim("whatsapp") <> '' THEN jsonb_build_object(
            'tipo', 'whatsapp', 'valor', "whatsapp"
          ) END)
  ) AS t(ord, elem)
), '[]'::jsonb);
