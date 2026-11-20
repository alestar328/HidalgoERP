import { useMemo } from 'react';
import type { ModuleUI } from '../types';
import { lazyPage } from '../lazy';
import { useProducts } from './api';

const ProductsPage = lazyPage(() => import('./ProductsPage'), 'ProductsPage');
const ProductDetailPage = lazyPage(() => import('./ProductDetailPage'), 'ProductDetailPage');
const ProductFormPage = lazyPage(() => import('./ProductFormPage'), 'ProductFormPage');
const VariantFormPage = lazyPage(() => import('./VariantFormPage'), 'VariantFormPage');

/** Artículos vendibles: activos y sin variantes (cada variante cuenta por separado). */
function useSellableCount() {
  const products = useProducts();
  return useMemo(() => {
    if (!products.data) return null;
    const parents = new Set(products.data.filter((p) => p.parent_id).map((p) => p.parent_id));
    return products.data.filter((p) => p.active && !parents.has(p.id)).length;
  }, [products.data]);
}

export const productosModule: ModuleUI = {
  id: 'productos',
  tiles: [
    {
      id: 'productos',
      title: 'Productos y stock',
      subtitle: 'Buscar, editar, entradas',
      icon: 'product',
      to: '/productos',
      useKpi: () => {
        const n = useSellableCount();
        return n == null ? null : { value: String(n), unit: 'artículos' };
      },
    },
    {
      id: 'productos-nuevo',
      title: 'Nuevo producto',
      subtitle: 'Agregar al catálogo',
      icon: 'add',
      to: '/productos/nuevo',
      ownerOnly: true,
    },
  ],
  routes: [
    { path: 'productos', element: <ProductsPage /> },
    { path: 'productos/nuevo', element: <ProductFormPage /> },
    { path: 'productos/:id', element: <ProductDetailPage /> },
    { path: 'productos/:id/editar', element: <ProductFormPage /> },
    { path: 'productos/:id/variante', element: <VariantFormPage />, requires: ['variantes'] },
  ],
  nav: { to: '/productos', label: 'Productos', icon: 'product', order: 10 },
};
