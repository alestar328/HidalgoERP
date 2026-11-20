import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { BusyIndicator, Button, Icon, Input, MessageStrip } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/Fields';
import { groupProducts } from '../../domain/stock';
import { formatMoney } from '../../lib/format';
import { matchesSearch } from '../../lib/normalize';
import { errorMessage } from '../../lib/errors';
import { useShop } from '../../features/auth/AuthProvider';
import { useCategories, useProducts } from './api';
import { StockLabel } from './StockLabel';

type Filter = 'todos' | 'bajo' | 'agotado' | 'archivados';
const FILTERS: { key: Filter; label: string; ownerOnly?: boolean }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'bajo', label: 'Stock bajo' },
  { key: 'agotado', label: 'Agotados' },
  { key: 'archivados', label: 'Archivados', ownerOnly: true },
];
const PAGE_SIZE = 60;

export function ProductsPage() {
  const { isOwner } = useShop();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('ver') as Filter | null) ?? 'todos';
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const products = useProducts();
  const categories = useCategories();

  const groups = useMemo(() => groupProducts(products.data ?? []), [products.data]);
  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  const visible = useMemo(
    () =>
      groups.filter((g) => {
        if (filter === 'archivados') {
          if (g.product.active) return false;
        } else {
          if (!g.product.active) return false;
          if (filter === 'bajo' && g.status !== 'low') return false;
          if (filter === 'agotado' && g.status !== 'out') return false;
        }
        const text = [g.product.name, g.product.sku, g.product.barcode, ...g.variants.flatMap((v) => [v.variant_label, v.sku, v.barcode])]
          .filter(Boolean)
          .join(' ');
        return matchesSearch(text, search);
      }),
    [groups, filter, search],
  );

  const setFilter = (next: Filter) => {
    setLimit(PAGE_SIZE);
    setParams(next === 'todos' ? {} : { ver: next }, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title="Productos"
        actions={
          isOwner && (
            <Button design="Emphasized" icon="add" onClick={() => navigate('/productos/nuevo')}>
              Nuevo
            </Button>
          )
        }
      />

      <div className="toolbar">
        <Input
          type="Search"
          placeholder="Buscar por nombre o código"
          accessibleName="Buscar producto"
          showClearIcon
          value={search}
          icon={<Icon name="search" />}
          onInput={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE_SIZE);
          }}
        />
        <div className="chips" role="group" aria-label="Filtrar productos">
          {FILTERS.filter((f) => !f.ownerOnly || isOwner).map((f) => (
            <button
              key={f.key}
              type="button"
              className="chip"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {products.isPending && <BusyIndicator active delay={200} style={{ margin: '2rem auto' }} />}

      {products.isError && (
        <div className="content">
          <MessageStrip design="Negative" hideCloseButton>
            {errorMessage(products.error)}
          </MessageStrip>
          <Button onClick={() => void products.refetch()}>Reintentar</Button>
        </div>
      )}

      {products.isSuccess && groups.length === 0 && (
        <EmptyState
          title="Aún no tienes productos"
          text={isOwner ? 'Agrega el primero. Luego podrás importar tu Excel completo.' : 'El dueño todavía no ha cargado productos.'}
        >
          {isOwner && (
            <Button design="Emphasized" icon="add" onClick={() => navigate('/productos/nuevo')}>
              Agregar producto
            </Button>
          )}
        </EmptyState>
      )}

      {products.isSuccess && groups.length > 0 && visible.length === 0 && (
        <EmptyState title="Sin resultados" text="Prueba con otra palabra o cambia el filtro." />
      )}

      {visible.length > 0 && (
        <div className="content" style={{ paddingTop: '0.25rem' }}>
          <div className="card card--flush">
            <ul className="list">
              {visible.slice(0, limit).map((g) => {
                const p = g.product;
                const cat = p.category_id ? categoryName.get(p.category_id) : null;
                const sub = [g.variants.length > 0 ? `${g.variants.length} variantes` : null, cat, p.sku]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={p.id}>
                    <Link className="list-item" to={`/productos/${p.id}`}>
                      <span className="list-item__main">
                        <span className="list-item__title" style={{ display: 'block' }}>
                          {p.name}
                        </span>
                        {sub && (
                          <span className="list-item__sub" style={{ display: 'block' }}>
                            {sub}
                          </span>
                        )}
                      </span>
                      <span className="list-item__end">
                        <span className="list-item__price">{formatMoney(p.retail_price)}</span>
                        <StockLabel stock={g.totalStock} status={g.status} unit={p.unit} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          {visible.length > limit && (
            <Button className="btn-block" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Ver más ({visible.length - limit})
            </Button>
          )}
          <p className="muted center">
            {visible.length} {visible.length === 1 ? 'producto' : 'productos'}
          </p>
        </div>
      )}
    </div>
  );
}
