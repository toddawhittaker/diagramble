// The body of a binder section is plain text with simple marks. This file reads the
// marks and draws them as real headings, lists and tables. The text is only ever put on
// the page as React text, never as HTML.

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'paragraph'; lines: string[] };

const HEADING = /^(#{1,3})\s*(.*)$/;
const BULLET = /^-(?:\s+(.*))?$/;
const NUMBERED = /^(\d+)\.(?:\s+(.*))?$/;
/** A ruled line under a table's headings, such as "| --- | --- |". It is drawn by the table itself. */
const RULE = /^\|[\s|:-]*-[\s|:-]*$/;

function cells(line: string): string[] {
  let inner = line.trim().slice(1);
  if (inner.endsWith('|')) inner = inner.slice(0, -1);
  return inner.split('|').map((c) => c.trim());
}

/** Turns the text of a section into blocks. A blank line ends a paragraph, a list or a table. */
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  // The block that the next line may add to. A blank line or a heading closes it.
  const state: { open: Block | null } = { open: null };
  const push = (block: Block) => {
    blocks.push(block);
    state.open = block;
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const last = state.open;
    if (line === '') {
      state.open = null;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      state.open = null;
      continue;
    }
    if (line.startsWith('|')) {
      if (RULE.test(line)) continue;
      if (last?.type === 'table') last.rows.push(cells(line));
      else push({ type: 'table', rows: [cells(line)] });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      const text = (bullet[1] ?? '').trim();
      if (last?.type === 'list' && !last.ordered) last.items.push(text);
      else push({ type: 'list', ordered: false, start: 1, items: [text] });
      continue;
    }
    const numbered = NUMBERED.exec(line);
    if (numbered) {
      const text = (numbered[2] ?? '').trim();
      if (last?.type === 'list' && last.ordered) last.items.push(text);
      else push({ type: 'list', ordered: true, start: Number(numbered[1]), items: [text] });
      continue;
    }
    if (last?.type === 'paragraph') last.lines.push(line);
    else push({ type: 'paragraph', lines: [line] });
  }
  return blocks;
}

function Table({ rows }: { rows: string[][] }) {
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (row: string[]) => [...row, ...Array<string>(width - row.length).fill('')];
  const [head, ...rest] = rows;
  return (
    <table className="table binder-body-table">
      <thead>
        <tr>
          {pad(head).map((c, i) => (
            <th key={i} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rest.map((row, r) => (
          <tr key={r}>
            {pad(row).map((c, i) => (
              <td key={i}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The text of a section with its marks drawn. */
export function BodyView({ body }: { body: string }) {
  const blocks = parseBody(body);
  return (
    <div className="binder-body">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
            return (
              <Tag key={i} className={`binder-body-h${block.level}`}>
                {block.text}
              </Tag>
            );
          }
          case 'list': {
            const items = block.items.map((item, n) => <li key={n}>{item}</li>);
            return block.ordered ? (
              <ol key={i} start={block.start}>
                {items}
              </ol>
            ) : (
              <ul key={i}>{items}</ul>
            );
          }
          case 'table':
            return <Table key={i} rows={block.rows} />;
          case 'paragraph':
            return (
              <p key={i}>
                {block.lines.map((line, n) => (
                  <span key={n}>
                    {n > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

/** The short key to the marks, shown beside the editor. */
export function MarksKey() {
  return (
    <aside className="binder-key" aria-label="Key to the marks">
      <div className="panel-subheading">Marks you can type</div>
      <dl>
        <dt className="mono"># Heading</dt>
        <dd>A line that starts with # is a heading. ## makes a smaller one.</dd>
        <dt className="mono">- Item</dt>
        <dd>A line that starts with - is an item in a list.</dd>
        <dt className="mono">1. Step</dt>
        <dd>A line that starts with a number and a full stop is an item in a numbered list.</dd>
        <dt className="mono">| Role | Person |</dt>
        <dd>A line that starts with | is a row of a table. The first row holds the column headings.</dd>
      </dl>
      <p className="muted">Leave a blank line to end a paragraph, a list or a table. Any other line is plain text.</p>
    </aside>
  );
}
