import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { BusyIndicator, Button, MessageStrip, Switch } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { SelectField, TextField } from '../../components/Fields';
import { useToast } from '../../components/Toast';
import { formatQty, parseNumber } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { UNITS, UNIT_LABEL, type Product, type Unit } from '../../lib/types';
import { useShop } from '../auth/AuthProvider';
import {
  createProduct,
  ensureCategory,
  syncVariants,
  updateProduct,
  useCategories,
  useInvalidateProducts,
  useProducts,
  type ProductInput,
} from './api';

const NEW_CATEGORY = '__nueva__';

interface FormState {
  name: string;
  variantLabel: string;
  sku: string;
  barcode: string;
  categoryId: string;
  newCategory: string;
  unit: Unit;
  retailPrice: string;
  hasWholesale: boolean;
  wholesalePrice: string;
  wholesaleMinQty: string;
  cost: string;
  minStock: string;
  initialStock: string;
}

const EMPTY: FormState = {
  name: '',
  variantLabel: '',
  sku: '',
  barcode: '',
  categoryId: '',
  newCategory: '',
  unit: 'unidad',
  retailPrice: '',
  hasWholesale: false,
  wholesalePrice: '',
  wholesaleMinQty: '',
  cost: '',
  minStock: '',
  initialStock: '',
};

const str = (n: number | null | undefined) => (n == null ? '' : String(n));

function fromProduct(p: Product): FormState {
  return {
    ...EMPTY,
    name: p.name,
    variantLabel: p.variant_label ?? '',
    sku: p.sku ?? '',
    barcode: p.barcode ?? '',
    categoryId: p.category_id ?? '',
    unit: p.unit,
    retailPrice: str(p.retail_price),
    hasWholesale: p.wholesale_price != null,
    wholesalePrice: str(p.wholesale_price),
    wholesaleMinQty: str(p.wholesale_min_qty),
    cost: str(p.cost),
    minStock: p.min_stock ? str(p.min_stock) : '',
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

/** Crear / editar producto. Con ?variante-de=<id> crea una variante (talla, color) de ese producto. */
export function ProductFormPage({ variantOf }: { variantOf?: boolean }) {
  const { id } = useParams();
  const { orgId, isOwner } = useShop();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateProducts();
  const products = useProducts();
  const categories = useCategories();

  const editing = !variantOf && id ? products.data?.find((p) => p.id === id) : undefined;
  const parent = variantOf && id ? products.data?.find((p) => p.id === id) : undefined;
  const isVariant = Boolean(parent) || Boolean(editing?.parent_id);
  const hasVariants = useMemo(
    () => Boolean(editing && products.data?.some((p) => p.parent_id === editing.id)),
    [editing, products.data],
  );

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Carga el formulario una sola vez, cuando llegan los datos.
  useEffect(() => {
    const source = editing ?? parent;
    if (!source || loadedFor === source.id) return;
    setLoadedFor(source.id);
    setForm(editing ? fromProduct(editing) : { ...fromProduct(parent!), sku: '', barcode: '', variantLabel: '' });
  }, [editing, parent, loadedFor]);

  if (!isOwner) return <Navigate to="/productos" replace />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const backTo = id ? `/productos/${id}` : '/productos';
  const title = variantOf ? 'Nueva variante' : id ? 'Editar producto' : 'Nuevo producto';

  if (id && products.isPending) {
    return (
      <div className="page">
        <PageHeader title={title} back={backTo} />
        <BusyIndicator active delay={200} style={{ margin: '2rem auto' }} />
      </div>
    );
  }
  if (id && products.isSuccess && !editing && !parent) return <Navigate to="/productos" replace />;

  const validate = (): { input: ProductInput; initialStock: number; newCategory: string | null } | null => {
    const next: Errors = {};
    const name = form.name.trim().replace(/\s+/g, ' ');
    if (name === '') next.name = 'Escribe el nombre.';
    if (isVariant && form.variantLabel.trim() === '') next.variantLabel = 'Ej.: Talla 10, Azul.';

    const retail = parseNumber(form.retailPrice);
    if (retail == null || retail < 0) next.retailPrice = 'Escribe un precio válido.';

    let wholesale: number | null = null;
    let wholesaleMin: number | null = null;
    if (form.hasWholesale) {
      wholesale = parseNumber(form.wholesalePrice);
      wholesaleMin = parseNumber(form.wholesaleMinQty);
      if (wholesale == null || wholesale < 0) next.wholesalePrice = 'Escribe el precio por mayor.';
      else if (retail != null && wholesale > retail) next.wholesalePrice = 'Debe ser menor que el precio por menor.';
      if (wholesaleMin == null || wholesaleMin <= 0) next.wholesaleMinQty = 'Escribe desde cuántos.';
    }

    const cost = form.cost.trim() === '' ? null : parseNumber(form.cost);
    if (form.cost.trim() !== '' && (cost == null || cost < 0)) next.cost = 'Costo no válido.';

    const minStock = form.minStock.trim() === '' ? 0 : parseNumber(form.minStock);
    if (minStock == null || minStock < 0) next.minStock = 'Número no válido.';

    const initialStock = form.initialStock.trim() === '' ? 0 : parseNumber(form.initialStock);
    if (initialStock == null || initialStock < 0) next.initialStock = 'Número no válido.';

    const wantsNewCategory = form.categoryId === NEW_CATEGORY;
    if (wantsNewCategory && form.newCategory.trim() === '') next.newCategory = 'Escribe el nombre de la categoría.';

    setErrors(next);
    if (Object.values(next).some(Boolean)) return null;

    return {
      input: {
        name,
        variant_label: isVariant ? form.variantLabel.trim() : null,
        parent_id: parent?.id ?? editing?.parent_id ?? null,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category_id: wantsNewCategory ? null : form.categoryId || null,
        unit: form.unit,
        retail_price: retail!,
        wholesale_price: wholesale,
        wholesale_min_qty: wholesaleMin,
        min_stock: minStock!,
        active: editing?.active ?? true,
        cost,
      },
      initialStock: initialStock!,
      newCategory: wantsNewCategory ? form.newCategory : null,
    };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const valid = validate();
    if (!valid) {
      setSaveError('Revisa los campos marcados.');
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      if (valid.newCategory) {
        valid.input.category_id = await ensureCategory(orgId, valid.newCategory, categories.data ?? []);
      }
      let targetId: string;
      if (editing) {
        await updateProduct(orgId, editing.id, valid.input);
        if (hasVariants) {
          const { name, category_id, unit } = valid.input;
          await syncVariants(editing.id, { name, category_id, unit });
        }
        targetId = editing.id;
      } else {
        const newId = await createProduct(orgId, valid.input, valid.initialStock);
        targetId = parent ? parent.id : newId;
      }
      await invalidate();
      toast(editing ? 'Cambios guardados' : variantOf ? 'Variante agregada' : 'Producto creado');
      navigate(`/productos/${targetId}`, { replace: true });
    } catch (err) {
      // Si el producto se creó pero falló un paso posterior, la lista debe reflejarlo.
      await invalidate();
      setSaveError(errorMessage(err));
      setBusy(false);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Sin categoría' },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    { value: NEW_CATEGORY, label: '+ Nueva categoría' },
  ];

  return (
    <div className="page">
      <PageHeader title={title} back={backTo} />
      <form className="content" onSubmit={submit} noValidate>
        {parent && (
          <MessageStrip design="Information" hideCloseButton>
            Variante de <strong>{parent.name}</strong>. Cada variante lleva su propio stock.
          </MessageStrip>
        )}
        {saveError && (
          <MessageStrip design="Negative" hideCloseButton>
            {saveError}
          </MessageStrip>
        )}

        <section className="card stack">
          {isVariant ? (
            <TextField
              label="Variante (talla, color)"
              value={form.variantLabel}
              onChange={(v) => set('variantLabel', v)}
              placeholder="Ej.: Talla 10"
              error={errors.variantLabel}
              required
              maxlength={40}
            />
          ) : (
            <TextField
              label="Nombre"
              value={form.name}
              onChange={(v) => set('name', v)}
              placeholder="Ej.: Cuaderno cuadriculado A4"
              error={errors.name}
              required
              maxlength={120}
            />
          )}
          {!isVariant && (
            <>
              <SelectField
                label="Categoría"
                value={form.categoryId}
                onChange={(v) => set('categoryId', v)}
                options={categoryOptions}
              />
              {form.categoryId === NEW_CATEGORY && (
                <TextField
                  label="Nombre de la nueva categoría"
                  value={form.newCategory}
                  onChange={(v) => set('newCategory', v)}
                  error={errors.newCategory}
                  maxlength={40}
                />
              )}
              <SelectField
                label="Se vende por"
                value={form.unit}
                onChange={(v) => set('unit', v as Unit)}
                options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))}
              />
            </>
          )}
        </section>

        <section className="card stack">
          <h2>Precios</h2>
          <TextField
            label="Precio por menor (S/)"
            type="Number"
            value={form.retailPrice}
            onChange={(v) => set('retailPrice', v)}
            placeholder="0.00"
            error={errors.retailPrice}
            required
          />
          <div className="switch-row">
            <span id="lbl-mayor">Tiene precio por mayor</span>
            <Switch
              accessibleNameRef="lbl-mayor"
              checked={form.hasWholesale}
              onChange={(e) => set('hasWholesale', e.target.checked)}
            />
          </div>
          {form.hasWholesale && (
            <div className="two-col">
              <TextField
                label="Precio por mayor (S/)"
                type="Number"
                value={form.wholesalePrice}
                onChange={(v) => set('wholesalePrice', v)}
                placeholder="0.00"
                error={errors.wholesalePrice}
              />
              <TextField
                label="A partir de (cantidad)"
                type="Number"
                value={form.wholesaleMinQty}
                onChange={(v) => set('wholesaleMinQty', v)}
                placeholder="12"
                error={errors.wholesaleMinQty}
              />
            </div>
          )}
          <TextField
            label="Costo (S/)"
            type="Number"
            value={form.cost}
            onChange={(v) => set('cost', v)}
            placeholder="0.00"
            hint="Lo que te cuesta a ti. Solo lo ves tú, no tus vendedores."
            error={errors.cost}
          />
        </section>

        {!hasVariants && (
          <section className="card stack">
            <h2>Stock</h2>
            {editing ? (
              <p className="muted">
                Stock actual: <strong>{formatQty(editing.stock)}</strong>. Para cambiarlo usa “Entrada” o “Ajustar” en la
                ficha del producto.
              </p>
            ) : (
              <TextField
                label="Stock inicial"
                type="Number"
                value={form.initialStock}
                onChange={(v) => set('initialStock', v)}
                placeholder="0"
                hint={
                  isVariant
                    ? 'Cuántas tienes ahora de esta variante.'
                    : 'Cuántos tienes ahora. Si el producto tendrá tallas o colores, déjalo en 0 y agrégalos después.'
                }
                error={errors.initialStock}
              />
            )}
            <TextField
              label="Avisarme cuando queden"
              type="Number"
              value={form.minStock}
              onChange={(v) => set('minStock', v)}
              placeholder="0"
              hint="Stock mínimo. Con 0 no hay aviso de stock bajo."
              error={errors.minStock}
            />
          </section>
        )}

        <section className="card stack">
          <h2>Códigos (opcional)</h2>
          <TextField
            label="Código / SKU"
            value={form.sku}
            onChange={(v) => set('sku', v)}
            placeholder="Ej.: CUA-A4-100"
            error={errors.sku}
            maxlength={40}
          />
          <TextField
            label="Código de barras"
            value={form.barcode}
            onChange={(v) => set('barcode', v)}
            placeholder="Ej.: 7750123456789"
            maxlength={40}
          />
        </section>

        <Button design="Emphasized" className="btn-big" type="Submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  );
}
