import type { SeccionLegal } from '@/lib/legal/plantillas';
import { ADVERTENCIA_BORRADOR } from '@/lib/legal/plantillas';

// LA FORMA COMPARTIDA de las cuatro páginas legales (§ TIENDA-LEGAL-1): un título, el aviso de
// borrador (§ el spec, "los textos son borradores sin revisión de abogado — lo dice también el
// panel"), y las secciones ya resueltas por `lib/legal/plantillas.ts` — este componente NO decide
// texto, sólo lo compone. Server component puro (sin hooks): las cuatro páginas lo invocan con los
// datos que ya resolvieron server-side.
export default function PaginaLegal({ titulo, secciones }: { titulo: string; secciones: SeccionLegal[] }) {
  return (
    <article className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">{titulo}</h1>
      <p className="text-xs text-[var(--sf-texto-suave)] mb-10">{ADVERTENCIA_BORRADOR}</p>
      <div className="space-y-8">
        {secciones.map((s) => (
          <section key={s.id}>
            <h2 className="text-lg font-semibold text-[var(--sf-tinta)] mb-2">{s.titulo}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-[var(--sf-texto)]">
              {s.parrafos.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
