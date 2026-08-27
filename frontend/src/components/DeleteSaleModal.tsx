import React, { useState, useEffect, useRef } from 'react';
import { formatMoney } from '../utils/money';
import { deletePaidSale } from '../services/salesService';
import type { Sale } from '../types';

interface DeleteSaleModalProps {
  sale: Sale;
  onClose: () => void;
  onSuccess: (deletedSale: Sale) => void;
}

export function DeleteSaleModal({ sale, onClose, onSuccess }: DeleteSaleModalProps) {
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleting, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the authorization password.');
      inputRef.current?.focus();
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deletePaidSale(sale.id, password.trim());
      onSuccess(sale);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete order. Please verify the password.');
      setDeleting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !deleting && onClose()}>
      <div
        className="modal-card delete-order-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-header" style={{ borderBottomColor: 'var(--danger-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger)',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title" style={{ color: 'var(--danger)' }}>
                Delete Paid Order
              </h3>
              <span className="modal-subtitle">
                Order #{sale.orderNumber} ({sale.displayId})
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={deleting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body" style={{ gap: 14 }}>
            {error && (
              <div
                className="form-error"
                style={{
                  background: 'var(--danger-bg)',
                  borderColor: 'var(--danger-border)',
                  color: 'var(--danger-dark)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* Warning Banner */}
            <div
              style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                fontSize: 12.5,
                color: '#9f1239',
                lineHeight: 1.45,
              }}
            >
              <strong>⚠️ Permanent & Irreversible Action:</strong>
              <p style={{ marginTop: 4, margin: 0 }}>
                This will <strong>completely remove the record</strong> of this sale, delete any associated cash/card transactions, and restore inventory stock. No history of this order will be kept.
              </p>
            </div>

            {/* Sale summary details */}
            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  Order #{sale.orderNumber} · {sale.orderType === 'DINE_IN' ? '☕ Dine-In' : '🛍️ Takeaway'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {sale.customerName ? `👤 ${sale.customerName}` : `Server: ${sale.takenBy}`} · {sale.paymentMethod}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                {formatMoney(sale.total)}
              </div>
            </div>

            {/* Password input */}
            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: 13 }}>
                Enter Authorization Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter delete password..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={deleting}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--ink-soft)',
                    padding: 4,
                  }}
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-large"
              disabled={deleting || !password.trim()}
              style={{
                background: 'var(--danger)',
                borderColor: 'var(--danger-dark)',
                color: '#ffffff',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {deleting ? (
                'Deleting Record...'
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Permanently Delete</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
