// Search across the whole model, and the two tidy-up lists. Route: /search

import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Tabs, TextField } from '../../components';
import { PageHeader, WorkArea } from '../../frame';
import { search, type ElementKind, type SearchField, type SearchResult } from '../../model';
import { selectElements, useModel } from '../../store';
import './project.css';

type Only = 'all' | 'noDescription' | 'unused';

/** The kinds in the order their groups are shown, each with the heading of its group. */
const KINDS: { kind: ElementKind; title: string }[] = [
  { kind: 'diagram', title: 'Diagrams' },
  { kind: 'process', title: 'Processes' },
  { kind: 'externalEntity', title: 'External entities' },
  { kind: 'dataStore', title: 'Data stores' },
  { kind: 'dataFlow', title: 'Data flows' },
  { kind: 'controlFlow', title: 'Control flows' },
  { kind: 'dataStructure', title: 'Data structures' },
  { kind: 'dataElement', title: 'Data elements' },
  { kind: 'useCase', title: 'Use cases' },
  { kind: 'entity', title: 'Entities' },
  { kind: 'relationship', title: 'Relationships' },
];

const FIELD_WORDS: Record<SearchField, string> = {
  name: 'Name',
  alias: 'Alias',
  description: 'Description',
  notes: 'Notes',
};

/** The text with every place the words occur made bold. Long text is cut to the part round the first match. */
function Highlight({ text, words }: { text: string; words: string }) {
  const lower = text.toLowerCase();
  const first = lower.indexOf(words);
  if (first < 0) return <>{text}</>;
  const start = first > 50 ? first - 40 : 0;
  const end = Math.min(text.length, first + words.length + 80);
  const parts: ReactNode[] = [start > 0 ? '… ' : ''];
  let at = start;
  while (at < end) {
    const hit = lower.indexOf(words, at);
    if (hit < 0 || hit >= end) break;
    parts.push(text.slice(at, hit));
    parts.push(
      <strong key={hit} className="project-search-hit">
        {text.slice(hit, hit + words.length)}
      </strong>,
    );
    at = hit + words.length;
  }
  parts.push(text.slice(at, Math.max(at, end)), end < text.length ? ' …' : '');
  return <>{parts}</>;
}

/** The text of one field of an element in which the words were found. */
function matchedText(result: SearchResult, field: SearchField, words: string): string {
  const e = result.element;
  const has = (text: string) => text.toLowerCase().includes(words);
  switch (field) {
    case 'name':
      return e.name;
    case 'alias':
      return e.aliases.filter(has).join(', ');
    case 'description':
      // A process's longer description counts as a description.
      return has(e.description) || e.kind !== 'process' ? e.description : e.processDescription;
    case 'notes':
      return e.notes;
  }
}

function ResultRow({ result, words }: { result: SearchResult; words: string }) {
  return (
    <Link to={result.route} className="row project-search-row" onClick={() => selectElements([result.element.id])}>
      <span className="project-search-label">
        {result.label || <span className="missing">No name yet</span>}
        <span className="muted project-search-where">{result.where}</span>
      </span>
      {result.matchedIn.map((field) => (
        <span key={field} className="project-search-match">
          <span className="mono muted project-search-field">{FIELD_WORDS[field]}</span>
          <span>
            <Highlight text={matchedText(result, field, words)} words={words} />
          </span>
        </span>
      ))}
    </Link>
  );
}

export function SearchScreen() {
  const model = useModel();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<ElementKind | ''>('');
  const [only, setOnly] = useState<Only>('all');

  const words = text.trim().toLowerCase();
  // With nothing typed and nothing narrowed there is no question to answer yet.
  const asked = words !== '' || kind !== '' || only !== 'all';

  const results = useMemo(
    () => (asked ? search(model, { text, kind: kind || undefined, only: only === 'all' ? undefined : only }) : []),
    [model, asked, text, kind, only],
  );
  const counts = useMemo(
    () => ({
      noDescription: search(model, { text: '', only: 'noDescription' }).length,
      unused: search(model, { text: '', only: 'unused' }).length,
    }),
    [model],
  );

  const groups = KINDS.map((k) => ({ ...k, results: results.filter((r) => r.element.kind === k.kind) })).filter(
    (g) => g.results.length > 0,
  );

  let empty: string | null = null;
  if (!asked) empty = 'Type a word to find anything in the project by its name, aliases, description or notes.';
  else if (results.length === 0) {
    const kindWords = kind ? ` among the ${KINDS.find((k) => k.kind === kind)?.title.toLowerCase()}` : '';
    if (words) empty = `Nothing${kindWords} matches “${text.trim()}”.`;
    else if (only === 'noDescription') empty = `Nothing${kindWords} is missing a description.`;
    else if (only === 'unused') empty = `Nothing${kindWords} is left unused.`;
    else empty = `The project has nothing${kindWords}.`;
  }

  return (
    <WorkArea>
      <PageHeader breadcrumb={['Project']} title="Search" />
      <div className="work-body scroll pad">
        <div className="project-column">
          <div className="project-search-tools">
            <TextField
              label="Search the project"
              hideLabel
              autoFocus
              value={text}
              onChange={setText}
              placeholder="Search names, aliases, descriptions and notes"
            />
            <select
              className="input"
              aria-label="Kind of item"
              value={kind}
              onChange={(e) => setKind(e.target.value as ElementKind | '')}
            >
              <option value="">Every kind</option>
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.title}
                </option>
              ))}
            </select>
          </div>
          <div className="project-search-only">
            <Tabs
              label="Which items to look at"
              value={only}
              onChange={setOnly}
              tabs={[
                { id: 'all', label: 'Everything' },
                { id: 'noDescription', label: 'No description', count: counts.noDescription },
                { id: 'unused', label: 'Used nowhere', count: counts.unused },
              ]}
            />
          </div>
          {only !== 'all' && (
            <p className="muted">
              {only === 'noDescription'
                ? 'Items whose description is still empty. Open one to write it.'
                : 'Processes, external entities, data stores and data definitions that no flow, structure, entity or use case refers to. Open one to use it or delete it.'}
            </p>
          )}

          {empty && <p className={asked ? undefined : 'muted'}>{empty}</p>}

          {groups.map((group) => (
            <section key={group.kind} className="project-group">
              <h2 className="section-heading project-group-heading">
                {group.title} <span className="count">{group.results.length}</span>
              </h2>
              <div>
                {group.results.map((result) => (
                  <ResultRow key={result.element.id} result={result} words={words} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </WorkArea>
  );
}
