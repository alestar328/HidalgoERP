import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { BusyIndicator, Button, MessageStrip } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { useToast } from '../../components/Toast';
import { stockStatus, worstStatus } from '../../domain/stock';
import { formatDateTime, formatMoney, formatQty } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { MOVEMENT_LABEL, UNIT_LABEL, UNIT_SHORT } from '../../lib/types';
import { useShop } from '../../features/auth/AuthProvider';
import { setProductActive, useCategories, useInvalidateProducts, useMovements, useProducts } from './api';
import { StockDialog, type StockMode } from './StockDialog';
import { StockLabel } from './StockLabel';
import { useModules } from '../ModulesProvider';

export function ProductDetailPage() {
  const { id } = useParams();
  const { isOwner } = useShop();
  const { isActive } = useModules();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateProducts();
  const products = useProducts();
  const categories = useCategories();

  const product = products.data?.find((p) => p.id === id);
  const parent = product?.parent_id ? products.data?.find((p) => p.id === product.parent_id) : undefined;
  const variants = useMemo(
    () => (products.data ?? []).filter((p) => p.parent_id === id),
    [products.data, id],
  );
  const hasVariants = variants.length > 0;
  const movements = useMovements(hasVariants ? undefined : id);

  const [dialog, setDialog] = useState<StockMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = parent ? `/productos/${parent.id}` : '/productos';

  if (products.isPending) {
    return (
      <div className="page">
        <PageHeader title="Producto" back="/productos" />
        <BusyIndicator active delay={200} style={{ margin: '2rem auto' }} />
      </div>
    );
  }
  if (products.isError) {
    return (
      <div className="page">
        <PageHeader title="Producto" back="/productos" />
        <div className="content">
          <MessageStrip design="Negative" hideCloseButton>
            {errorMessage(products.error)}
          </MessageStrip>
          <Button onClick={() => void products.refetch()}>Reintentar</Button>
        </div>
      </div>
    );
  }
  if (!product) return <Navigate to="/productos" replace />;

  const activeVariants = variants.filter((v) => v.active);
  const totalStock = hasVariants ? activeVariants.reduce((s, v) => s + v.stock, 0) : product.stock;
  const status = hasVariants
    ? worstStatus(activeVariants.map((v) => stockStatus(v.stock, v.min_stock)))
    : stockStatus(product.stock, product.min_stock);
  const category = categories.data?.find((c) => c.id === product.category_id)?.name;
  const title = product.variant_label ? `${product.name} · ${product.variant_label}` : product.name;

  const toggleActive = async () => {
    setBusy(true);
    setError(null);
    try {
      await setProductActive(product.id, !product.active);
      await invalidate();
      toast(product.active ? 'Producto archivado' : 'Producto activado otra vez');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={title}
        back={back}
        actions={
          isOwner && (
            <Button design="Transparent" icon="edit" onClick={() => navigate(`/productos/${product.id}/editar`)}>
              Editar
            </Button>
          )
        }
      />
      <div className="content">
        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}
        {!product.active && (
          <MessageStrip design="Critical" hideCloseButton>
            Producto archivado: no aparece para vender.
          </MessageStrip>
        )}

        <section className="card">
          <h2>{hasVariants ? 'Stock total' : 'Stock'}</h2>
          <div className="row">
            <div className="grow">
              <div className="big-number">
                {formatQty(totalStock)} <span className="muted">{UNIT_SHORT[product.unit]}</span>
              </div>
              {status !== 'ok' && <StockLabel stock={totalStock} status={status} unit={product.unit} />}
              {hasVariants && status !== 'ok' && <span className="muted"> en alguna variante</span>}
            </div>
          </div>
          {isOwner && !hasVariants && (
            <div className="two-col" style={{ marginTop: '1rem' }}>
              <Button design="Emphasized" icon="add" onClick={() => setDialog('entrada')}>
                Entrada
              </Button>
              <Button onClick={() => setDialog('conteo')}>Ajustar</Button>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Datos</h2>
          <dl>
            <div className="kv">
              <dt>Precio por menor</dt>
              <dd>{formatMoney(product.retail_price)}</dd>
            </div>
            {product.wholesale_price != null && (
              <div className="kv">
                <dt>Por mayor (desde {formatQty(product.wholesale_min_qty)})</dt>
                <dd>{formatMoney(product.wholesale_price)}</dd>
              </div>
            )}
            {isOwner && product.cost != null && (
              <div className="kv">
                <dt>Costo</dt>
                <dd>{formatMoney(product.cost)}</dd>
              </div>
            )}
            <div className="kv">
              <dt>Se vende por</dt>
              <dd>{UNIT_LABEL[product.unit]}</dd>
            </div>
            {category && (
              <div className="kv">
                <dt>Categoría</dt>
                <dd>{category}</dd>
              </div>
            )}
            {!hasVariants && product.min_stock > 0 && (
              <div className="kv">
                <dt>Stock mínimo</dt>
                <dd>{formatQty(product.min_stock)}</dd>
              </div>
            )}
            {product.sku && (
              <div className="kv">
                <dt>Código</dt>
                <dd>{product.sku}</dd>
              </div>
            )}
            {product.barcode && (
              <div className="kv">
                <dt>Código de barras</dt>
                <dd>{product.barcode}</dd>
              </div>
            )}
          </dl>
        </section>

        {!product.parent_id && (hasVariants || (isOwner && isActive('variantes'))) && (
          <section className="stack" style={{ gap: '0.5rem' }}>
            <p className="section-title">Variantes (talla, color)</p>
            {hasVariants && (
              <div className="card card--flush">
                <ul className="list">
                  {variants.map((v) => (
                    <li key={v.id}>
                      <Link className="list-item" to={`/productos/${v.id}`}>
                        <span className="list-item__main">
                          <span className="list-item__title" style={{ display: 'block' }}>
                            {v.variant_label || v.name}
                          </span>
                          {(v.sku || !v.active) && (
                            <span className="list-item__sub" style={{ display: 'block' }}>
                              {[!v.active ? 'Archivada' : null, v.sku].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                        <span className="list-item__end">
                          <span className="list-item__price">{formatMoney(v.retail_price)}</span>
                          <StockLabel stock={v.stock} status={stockStatus(v.stock, v.min_stock)} unit={v.unit} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isOwner &&
              isActive('variantes') &&
              (hasVariants || product.stock === 0 ? (
                <Button icon="add" className="btn-block" onClick={() => navigate(`/productos/${product.id}/variante`)}>
                  Agregar variante
                </Button>
              ) : (
                <p className="muted">
                  Para agregar tallas o colores, primero deja el stock de este producto en 0 con “Ajustar”.
                </p>
              ))}
          </section>
        )}

        {!hasVariants && (
          <section className="stack" style={{ gap: '0.5rem' }}>
            <p className="section-title">Últimos movimientos</p>
            {movements.isPending && <BusyIndicator active delay={200} />}
            {movements.isError && <p className="muted">{errorMessage(movements.error)}</p>}
            {movements.data?.length === 0 && <p className="muted">Todavía no hay movimientos.</p>}
            {movements.data && movements.data.length > 0 && (
              <div className="card card--flush">
                <ul className="list">
                  {movements.data.map((m) => (
                    <li key={m.id}>
                      <div className="list-item" style={{ cursor: 'default' }}>
                        <span className="list-item__main">
                          <span className="list-item__title" style={{ display: 'block' }}>
                            {MOVEMENT_LABEL[m.type]}
                          </span>
                          <span className="list-item__sub" style={{ display: 'block' }}>
                            {[formatDateTime(m.created_at), m.reason].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="list-item__end">
                          <span className={`list-item__price ${m.qty > 0 ? 'stock--ok' : 'stock--out'}`}>
                            {m.qty > 0 ? '+' : '−'}
                            {formatQty(Math.abs(m.qty))}
                          </span>
                          <span className="muted">Quedó {formatQty(m.stock_after)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {isOwner && (
          <Button design={product.active ? 'Negative' : 'Default'} className="btn-block" disabled={busy} onClick={() => void toggleActive()}>
            {product.active ? 'Archivar producto' : 'Volver a activar'}
          </Button>
        )}
      </div>

      {isOwner && !hasVariants && (
        <StockDialog
          product={product}
          open={dialog !== null}
          initialMode={dialog ?? 'entrada'}
          onClose={() => setDialog(null)}
          onDone={(newStock) => {
            setDialog(null);
            toast(`Stock actualizado: ${formatQty(newStock)}`);
            void invalidate();
          }}
        />
      )}
    </div>
  );
}
