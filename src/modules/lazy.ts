import { lazy, type ComponentType } from 'react';

/** Carga una pantalla recién cuando se abre (el celular descarga menos al inicio). */
export function lazyPage<M extends Record<string, unknown>>(
  load: () => Promise<M>,
  name: keyof M & string,
) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}
