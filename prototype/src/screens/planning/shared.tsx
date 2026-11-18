// Small pieces both planning screens use.

import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Button, TextField } from '../../components';
import { formatNumber } from '../../model';

/** Money as the tables show it: "18,000", or "82,372.50" when it has a fraction. */
export function money(n: number): string {
  return formatNumber(n, Number.isInteger(n) ? 0 : 2);
}

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface DraftTextProps {
  label: string;
  value: string;
  /** Called when the field loses focus, or on Enter in a one-line box, if the text changed. */
  onCommit: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

/** A text field that keeps its own draft, so that one edit is one undo step. The visible label is the heading above it. */
export function DraftText({ label, value, onCommit, rows, placeholder }: DraftTextProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      label={label}
      hideLabel
      value={draft}
      rows={rows}
      placeholder={placeholder}
      onChange={setDraft}
      onCommit={(text) => {
        if (text !== value) onCommit(text);
      }}
    />
  );
}

/** What an empty project shows: one line of help and a way to start. */
export function StartHere({ children, action, onStart }: { children: ReactNode; action: string; onStart: () => void }) {
  return (
    <div className="planning-start">
      <p>{children}</p>
      <Button variant="primary" onClick={onStart}>
        {action}
      </Button>
    </div>
  );
}

/**
 * The two screens link to each other's rows. A link carries `{ [key]: index }` as its
 * state, and the screen that opens scrolls to the element with the id `prefix + index`.
 */
export function useArrival(key: 'value' | 'benefit', prefix: string): void {
  const location = useLocation();
  useEffect(() => {
    const index = (location.state as Record<string, unknown> | null)?.[key];
    if (typeof index !== 'number') return;
    const target = document.getElementById(`${prefix}${index}`);
    target?.scrollIntoView({ block: 'center' });
    target?.focus();
  }, [location.key, key, prefix]);
}
