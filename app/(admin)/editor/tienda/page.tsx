import { Suspense } from 'react';
import EditorTiendaPantallaCompleta from '@/components/admin/EditorTiendaPantallaCompleta';

// `<Suspense>` porque `EditorTiendaPantallaCompleta` usa `useSearchParams` (el deep-link del aviso
// de config, § `TiendaPaginas` antiguo / CLAUDE.md § Backlog #65) — mismo requisito que Pedidos con
// `?pedido=` y que `/admin/tienda` tenía antes de este slice.
export default function EditorTienda() {
  return (
    <Suspense fallback={null}>
      <EditorTiendaPantallaCompleta />
    </Suspense>
  );
}
