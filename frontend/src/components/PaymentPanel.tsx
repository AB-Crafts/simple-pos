import { useMemo, useState } from 'react';
import type { PaymentMethod } from '../types';
import { formatMoney, toPaisa } from '../utils/money';

interface Props {
  total: number;
  disabled: boolean;
  onComplete: (method: PaymentMethod, amountReceived: number | null) => void;
}

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'CREDIT'];

export function PaymentPanel({ total, disabled, onComplete }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [receivedInput, setReceivedInput] = useState('');

  const amountReceived = useMemo(() => {
    const n = parseFloat(receivedInput);
    return Number.isFinite(n) && n >= 0 ? toPaisa(n) : null;
  }, [receivedInput]);

  const change = method === 'CASH' && amountReceived != null ? amountReceived - total : null;
  const canComplete =
    !disabled && total > 0 && (method !== 'CASH' || amountReceived === null || amountReceived >= total);

  function handleComplete() {
    onComplete(method, method === 'CASH' ? amountReceived : null);
    setReceivedInput('');
  }

  return (
    <div className="payment-panel">
      <div className="payment-methods">
        {METHODS.map((m) => (
          <button
            key={m}
            className={`payment-method ${method === m ? 'payment-method--active' : ''}`}
            onClick={() => setMethod(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {method === 'CASH' && (
        <div className="cash-row">
          <label htmlFor="amount-received">Amount received</label>
          <input
            id="amount-received"
            type="number"
            min={0}
            step="0.01"
            placeholder={formatMoney(total)}
            value={receivedInput}
            onChange={(e) => setReceivedInput(e.target.value)}
          />
          {change != null && (
            <div className={`change-row ${change < 0 ? 'change-row--short' : ''}`}>
              {change < 0 ? 'Short by' : 'Change'}: {formatMoney(Math.abs(change))}
            </div>
          )}
        </div>
      )}

      <button className="complete-sale-btn" disabled={!canComplete} onClick={handleComplete}>
        COMPLETE SALE
      </button>
    </div>
  );
}
