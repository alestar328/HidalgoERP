import { useMemo } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { countAlerts } from '../../domain/stock';
import { useShop } from '../auth/AuthProvider';
import { useProducts } from '../products/api';

/** Inicio. En la fase (a) solo muestra lo que ya existe: productos y alertas de stock. */
export function HomePage() {
  const { organization, displayName } = useShop();
  const products = useProducts();

  const stats = useMemo(() => {
    const list = products.data ?? [];
    const parents = new Set(list.filter((p) => p.parent_id).map((p) => p.parent_id));
    const sellable = list.filter((p) => p.active && !parents.has(p.id)).length;
    return { sellable, ...countAlerts(list) };
  }, [products.data]);

  const value = (n: number) => (products.isSuccess ? n : '—');

  return (
    <div className="page">
      <PageHeader title={organization.name} />
      <div className="content">
        <p className="muted">{displayName ? `Hola, ${displayName}` : 'Hola'}</p>
        <div className="tiles">
          <Link className="tile" to="/productos">
            <span className="tile__label">Productos</span>
            <span className="tile__value">{value(stats.sellable)}</span>
          </Link>
          <Link className="tile" to="/productos?ver=bajo">
            <span className="tile__label">Stock bajo</span>
            <span className={`tile__value ${stats.low > 0 ? 'stock--low' : ''}`}>{value(stats.low)}</span>
          </Link>
          <Link className="tile" to="/productos?ver=agotado">
            <span className="tile__label">Agotados</span>
            <span className={`tile__value ${stats.out > 0 ? 'stock--out' : ''}`}>{value(stats.out)}</span>
          </Link>
          <div className="tile tile--muted">
            <span className="tile__label">Ventas de hoy</span>
            <span className="muted">Llega con el módulo de ventas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
