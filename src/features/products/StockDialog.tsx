import { useEffect, useState } from 'react';
import { Button, Dialog, MessageStrip } from '@ui5/webcomponents-react';
import { TextField } from '../../components/Fields';
import { formatQty, parseNumber } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { UNIT_SHORT, type Product } from '../../lib/types';
import { adjustStock } from './api';

export type StockMode = 'entrada' | 'salida' | 'conteo';

const MODES: { key: StockMode; label: string }[] = [
  { key: 'entrada', label: 'Entrada' },
  { key: 'salida', label: 'Salida' },
  { key: 'conteo', label: 'Conteo' },
];

const HELP: Record<StockMode, string> = {
  entrada: 'Llegó mercadería (compra). Se suma al stock.',
  salida: 'Merma, pérdida, regalo o uso propio. Se resta del stock.',
  conteo: 'Contaste lo que hay y no coincide. Escribe la cantidad real.',
};

interface Props {
  product: Product;
  open: boolean;
  initialMode: StockMode;
  onClose: () => void;
  onDone: (newStock: number) => void;
}

export function StockDialog({ product, open, initialMode, onClose, onDone }: Props) {
  const [mode, setMode] = useState<StockMode>(initialMode);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setQty('');
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [open, initialMode]);

  const n = parseNumber(qty);
  const delta = n == null ? null : mode === 'entrada' ? n : mode === 'salida' ? -n : n - product.stock;
  const result = delta == null ? null : product.stock + delta;
  const unit = UNIT_SHORT[product.unit];

  const save = async () => {
    if (n == null || n < 0 || (mode !== 'conteo' && n === 0)) {
      setError('Escribe una cantidad válida.');
      return;
    }
    if (delta === 0) {
      setError('El stock ya es ese. No hay nada que cambiar.');
      return;
    }
    if (mode === 'salida' && reason.trim() === '') {
      setError('Escribe el motivo de la salida.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const newStock =
        mode === 'entrada'
          ? await adjustStock(product.id, 'purchase', delta!, reason.trim() || null)
          : await adjustStock(product.id, 'adjustment', delta!, reason.trim() || 'Conteo de inventario');
      onDone(newStock);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      headerText="Cambiar stock"
      onClose={onClose}
      footer={
        <div className="dialog-footer">
          <Button design="Transparent" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button design="Emphasized" onClick={() => void save()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div className="dialog-body">
        <div className="chips" role="group" aria-label="Tipo de cambio">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="chip"
              aria-pressed={mode === m.key}
              onClick={() => {
                setMode(m.key);
                setError(null);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="muted">{HELP[mode]}</p>

        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}

        <TextField
          label={mode === 'conteo' ? `Cantidad real (${unit})` : `Cantidad (${unit})`}
          type="Number"
          value={qty}
          onChange={setQty}
          placeholder="0"
          required
        />
        <TextField
          label={mode === 'salida' ? 'Motivo' : 'Nota (opcional)'}
          value={reason}
          onChange={setReason}
          placeholder={
            mode === 'entrada' ? 'Ej.: Compra en Mesa Redonda' : mode === 'salida' ? 'Ej.: Se mancharon' : 'Ej.: Inventario de fin de mes'
          }
          required={mode === 'salida'}
          maxlength={120}
        />

        <p aria-live="polite">
          Stock ahora: <strong>{formatQty(product.stock)}</strong>
          {result != null && delta !== 0 && (
            <>
              {' → '}
              <strong>{formatQty(result)}</strong> {unit}
            </>
          )}
        </p>
      </div>
    </Dialog>
  );
}
