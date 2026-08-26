// Helpers de RUTA del storage, PUROS y sin el SDK del proveedor —para que los use tanto el
// adaptador server (`lib/storage.ts`) como el CLIENTE de la subida directa (`subirDirecto`), que
// arma el pathname del lado del navegador y NO puede importar `@vercel/blob`. Separar esto es lo que
// permite que el cliente sanee el nombre EXACTAMENTE igual que el server valida (§ pathnameSubidaValido).

/** Deja el nombre en algo seguro para una ruta, conservando la extensión. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo';
  const limpio = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // sin tildes
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '');
  return limpio || 'archivo';
}
