import { useEffect, useState } from 'react';

interface NumericInputProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  onCommit: (next: number) => void;
  className?: string;
}

/**
 * Controlled numeric input that allows users to freely clear/type multi-digit numbers
 * without snapping back to min/fallback mid-keystroke. Clamps cleanly on blur or Enter.
 */
export function NumericInput({ id, value, min, max, fallback, onCommit, className = '' }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    const clamped = raw.trim() === '' || !Number.isFinite(parsed) ? fallback : Math.max(min, Math.min(max, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        setDraft(raw);
        if (raw !== '') {
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            onCommit(Math.round(parsed));
          }
        }
      }}
      onBlur={() => {
        setFocused(false);
        commit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(draft);
          e.currentTarget.blur();
        }
      }}
      className={className}
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
    />
  );
}
