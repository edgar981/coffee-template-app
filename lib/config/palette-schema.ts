import { z } from 'zod';
import { CLAVES_FUENTES } from './fuentes';

// Validación del TEMA que manda el editor (§ Tanda C2): las 3 RAÍCES de paleta + el PAR tipográfico.
// UNA definición que corren el PUT (la que MANDA) y el editor (aviso temprano) — como
// `siteSettingsEditableSchema`. SIN `server-only`: el form cliente la importa.
//
// El editor manda STRINGS; esta es la puerta que impide que un valor basura llegue al
// motor de derivación. `"rojo"`, `"#f00"` (3 díg.), `"#f00000ff"` (8) o cualquier cosa
// que no sea un hex de 6 dígitos → falla acá (400), NUNCA llega a `derivarPaleta`.

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const raizColor = z
  .string()
  .trim()
  .regex(HEX6, 'Color inválido: usa un hex de 6 dígitos (p. ej. #8b4513)');

export const paletaEditableSchema = z
  .object({
    // Cada raíz es un hex de 6 dígitos, o `null` para "usar los defaults de código".
    paletaFondo:  raizColor.nullable(),
    paletaTinta:  raizColor.nullable(),
    paletaAcento: raizColor.nullable(),
    // El PAR tipográfico: una clave del set cerrado, o `null` (= Editorial, el default). `resolverTema`
    // normaliza 'editorial' → null (Editorial no se guarda). Independiente del all-or-nothing de las
    // raíces: elegir fuente no obliga a elegir colores, ni al revés.
    fuentePar: z.enum(CLAVES_FUENTES).nullable(),
  })
  // ALL-OR-NOTHING: el motor necesita las 3 raíces para derivar. Una paleta a medias
  // (fondo puesto, tinta null) no es derivable —quedaría ignorada en silencio—, así que
  // se rechaza: o las tres o ninguna.
  .refine(
    (v) => {
      const puestas = [v.paletaFondo, v.paletaTinta, v.paletaAcento].filter((x) => x != null).length;
      return puestas === 0 || puestas === 3;
    },
    { message: 'La paleta necesita las 3 raíces (fondo, tinta y acento) o ninguna' },
  );

export type PaletaEditable = z.infer<typeof paletaEditableSchema>;
