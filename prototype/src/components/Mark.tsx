// The marks of docs/mockups/BRIEFS.md section 1.2. Each mark means one thing, and has a
// shape as well as a colour.

import type { ReactNode } from 'react';
import { countFindings, type Finding } from '../rules/engine';
import { useFindingsVisible } from '../store/store';

export type MarkKind = 'error' | 'warning' | 'ok' | 'ai';

const WORDS: Record<MarkKind, string> = { error: 'Error', warning: 'Warning', ok: 'OK', ai: 'AI' };

function Glyph({ kind, size }: { kind: MarkKind; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true } as const;
  switch (kind) {
    case 'error':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="8" fill="var(--error)" />
          <rect x="7" y="3.4" width="2" height="6" rx="0.6" fill="var(--on-error)" />
          <circle cx="8" cy="11.9" r="1.2" fill="var(--on-error)" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M8 0.8 15.8 15H0.2Z" fill="var(--warning)" stroke="var(--warning)" strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="7.1" y="5.4" width="1.8" height="5" rx="0.5" fill="var(--on-warning)" />
          <circle cx="8" cy="12.5" r="1.1" fill="var(--on-warning)" />
        </svg>
      );
    case 'ok':
      return (
        <svg {...common}>
          <path d="M2 8.6 6.2 13 14 3.4" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path d="M8 0.5C8.6 5 11 7.4 15.5 8 11 8.6 8.6 11 8 15.5 7.4 11 5 8.6 0.5 8 5 7.4 7.4 5 8 0.5Z" fill="var(--ai)" />
        </svg>
      );
  }
}

export interface MarkProps {
  kind: MarkKind;
  /** Show the word "Error" or "Warning" after the mark, as a problem card does. The AI mark always shows "AI". */
  word?: boolean;
  /** A mark followed by a number means that many findings. */
  count?: number;
  /** Pixel size of the glyph. Default 14, to fit inside a chip. */
  size?: number;
  /** Text for screen readers and the tooltip. Defaults to the kind and count. */
  label?: string;
  /** Draw the mark without its chip, as on the diagram canvas. Default false. */
  bare?: boolean;
}

/** One mark: error, warning, OK or AI. */
export function Mark({ kind, word, count, size = 14, label, bare = false }: MarkProps) {
  const text = label ?? (count === undefined ? WORDS[kind] : `${count} ${WORDS[kind].toLowerCase()}${count === 1 ? '' : 's'}`);
  return (
    <span className={`mark mark-${kind}${bare ? '' : ' chip'}`} role="img" aria-label={text} title={text}>
      <Glyph kind={kind} size={size} />
      {(word || kind === 'ai') && <span className="mark-word">{WORDS[kind]}</span>}
      {count !== undefined && <span className="count">{count}</span>}
    </span>
  );
}

export interface FindingMarksProps {
  findings: Finding[];
  /** Show the OK mark when there are no findings. Default false. Never shown while the findings are hidden. */
  showOk?: boolean;
  /** Show the number after each mark. Default true. */
  counts?: boolean;
}

/** An error mark and a warning mark with their counts, for a set of findings. */
export function FindingMarks({ findings, showOk = false, counts = true }: FindingMarksProps) {
  const visible = useFindingsVisible();
  const { errors, warnings } = countFindings(findings);
  if (errors === 0 && warnings === 0) return showOk && visible ? <Mark kind="ok" label="No problems" /> : null;
  return (
    <span className="marks">
      {errors > 0 && <Mark kind="error" count={counts ? errors : undefined} />}
      {warnings > 0 && <Mark kind="warning" count={counts ? warnings : undefined} />}
    </span>
  );
}

/** The "missing" mark: muted italic words over a dashed underline, such as "No description yet". */
export function Missing({ children }: { children: ReactNode }) {
  return <span className="missing">{children}</span>;
}

/** A number standing on its own, such as the count on a tab, in a chip. Inside a sentence, use a plain `<span className="count">`. */
export function Count({ n }: { n: number | string }) {
  return <span className="count chip">{n}</span>;
}
