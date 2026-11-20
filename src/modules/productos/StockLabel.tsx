import type { StockStatus } from '../../domain/stock';
import { formatQty } from '../../lib/format';
import { UNIT_SHORT, type Unit } from '../../lib/types';

const TEXT: Record<StockStatus, string> = { ok: '', low: 'Stock bajo', out: 'Agotado' };

/** "Stock bajo · 3 und". El estado va en texto, no solo en color. */
export function StockLabel({ stock, status, unit }: { stock: number; status: StockStatus; unit: Unit }) {
  const qty = `${formatQty(stock)} ${UNIT_SHORT[unit]}`;
  return (
    <span className={`stock stock--${status}`}>
      {status === 'ok' ? qty : status === 'out' && stock === 0 ? TEXT.out : `${TEXT[status]} · ${qty}`}
    </span>
  );
}
