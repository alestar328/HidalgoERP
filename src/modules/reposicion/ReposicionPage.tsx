import { useMemo } from 'react';
import { Link } from 'react-router';
import { BusyIndicator, Button, MessageStrip } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/Fields';
import { reorderList, reorderMessage, splitBySource, whatsappShareUrl, type ReorderItem } from '../../domain/reorder';
import { formatQty } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { UNIT_SHORT, type Product } from '../../lib/types';
import { useShop } from '../../features/auth/AuthProvider';
import { useModules } from '../ModulesProvider';
import { useProducts } from '../productos/api';
import { StockLabel } from '../productos/StockLabel';

interface GroupProps {
  title: string;
  hint: string;
  messageTitle: string;
  items: ReorderItem<Product>[];
}

function ReorderGroup({ title, hint, messageTitle, items }: GroupProps) {
  const { organization } = useShop();
  if (items.length === 0) return null;

  const share = () => {
    const text = reorderMessage(
      messageTitle,
      items.map((i) => ({ label: i.label, qty: i.suggested, unit: UNIT_SHORT[i.product.unit] })),
      organization.name,
    );
    window.open(whatsappShareUrl(text), '_blank', 'noopener');
  };

  return (
    <section className="stack" style={{ gap: '0.5rem' }}>
      <p className="section-title">
        {title} ({items.length})
      </p>
      <p className="muted">{hint}</p>
      <div className="card card--flush">
        <ul className="list">
          {items.map((i) => (
            <li key={i.product.id}>
              <Link className="list-item" to={`/productos/${i.product.id}`}>
                <span className="list-item__main">
                  <span className="list-item__title" style={{ display: 'block' }}>
                    {i.label}
                  </span>
                  <span className="list-item__sub" style={{ display: 'block' }}>
                    <StockLabel stock={i.product.stock} status={i.status} unit={i.product.unit} />
                    {i.product.min_stock > 0 && ` · mínimo ${formatQty(i.product.min_stock)}`}
                  </span>
                </span>
                <span className="list-item__end">
                  <span className="muted">Pedir</span>
                  <span className="list-item__price">
                    {i.suggested == null ? '—' : `${formatQty(i.suggested)} ${UNIT_SHORT[i.product.unit]}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Button icon="share-2" className="btn-block" onClick={share}>
        Enviar lista por WhatsApp
      </Button>
    </section>
  );
}

/** Stock mínimo y reposición: lo que hay que pedir, separado por origen (compra o producción). */
export function ReposicionPage() {
  const products = useProducts();
  const { isActive } = useModules();
  const production = isActive('produccion');

  const groups = useMemo(() => {
    const items = reorderList(products.data ?? []);
    return { items, ...splitBySource(items, production) };
  }, [products.data, production]);

  const out = groups.items.filter((i) => i.status === 'out').length;
  const low = groups.items.length - out;

  return (
    <div className="page">
      <PageHeader title="Reposición" back="/" />
      <div className="content">
        {products.isPending && <BusyIndicator active delay={200} style={{ margin: '2rem auto' }} />}
        {products.isError && (
          <MessageStrip design="Negative" hideCloseButton>
            No se pudieron cargar los productos. {errorMessage(products.error)}
          </MessageStrip>
        )}

        {products.isSuccess && groups.items.length === 0 && (
          <EmptyState title="Todo en orden" text="Ningún producto está agotado ni en su stock mínimo.">
            <Link to="/productos">Ver productos</Link>
          </EmptyState>
        )}

        {groups.items.length > 0 && (
          <>
            <p>
              <strong>{out}</strong> agotados · <strong>{low}</strong> en su stock mínimo
            </p>
            <ReorderGroup
              title="Para producir"
              hint="Productos de tu taller o confección."
              messageTitle="Orden de producción"
              items={groups.production}
            />
            <ReorderGroup
              title={production ? 'Para comprar' : 'Por reponer'}
              hint="Se piden a tus proveedores."
              messageTitle="Pedido de reposición"
              items={groups.purchase}
            />
            <p className="muted">
              Cantidad sugerida: lo que falta para llegar al doble del mínimo. Cuando llegue la mercadería, regístrala con
              “Entrada” en la ficha de cada producto.
              {(isActive('compras') || production) && ' Pronto podrás generar aquí las órdenes de compra y de producción.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
