// The project binder: sections of free text with attachments, the conversion strategy
// form inside the migration plan, and a table of contents for the whole project.
// SPEC 10.7. Routes: /binder (the contents) and /binder/:sectionId (one section).
// Nothing in the binder is checked, so this screen shows no marks and no problems panel.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components';
import { ListColumn, PageHeader, UndoRedo, WorkArea } from '../../frame';
import {
  BINDER_LAYOUTS,
  PHASES,
  all,
  binderSections,
  dataDefinitions,
  diagramsInOrder,
  feasibility,
  get,
  systemRequest,
  type BinderSection,
  type Model,
  type Phase,
} from '../../model';
import { dispatch, useModel, useViewModel } from '../../store';
import { PHASE_WORDS, SectionPage, filesText } from './Section';
import './binder.css';

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---- Adding a section ----

function AddSection({ phase, onDone }: { phase: Phase; onDone: () => void }) {
  const navigate = useNavigate();
  const [layoutKey, setLayoutKey] = useState('');
  const [name, setName] = useState('');
  const layouts = BINDER_LAYOUTS.filter((l) => l.phase === phase);
  const layout = layouts.find((l) => l.key === layoutKey);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = dispatch({ type: 'addBinderSection', name: name.trim(), phase, ...(layout ? { layout: layout.key } : {}) });
    if (!result.ok) return;
    onDone();
    navigate(`/binder/${result.created[0]}`);
  };

  return (
    <form
      className="binder-add"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone();
      }}
    >
      <label className="field">
        <span className="field-label">Start from</span>
        <select className="input" value={layoutKey} autoFocus onChange={(e) => setLayoutKey(e.target.value)}>
          <option value="">A blank section</option>
          {layouts.map((l) => (
            <option key={l.key} value={l.key}>
              Layout: {l.title}
            </option>
          ))}
        </select>
      </label>
      {layout && <div className="field-hint">{layout.body.trim() ? 'Starts with headings to fill in.' : 'This one has no set format, so it starts empty.'}</div>}
      <label className="field">
        <span className="field-label">Title</span>
        <input type="text" className="input" value={name} placeholder={layout ? layout.title : 'Untitled section'} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="hstack">
        <Button small variant="primary" type="submit">
          Add section
        </Button>
        <Button small onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- The list on the left ----

function SectionList({ sections, openId }: { sections: BinderSection[]; openId: string | undefined }) {
  const [adding, setAdding] = useState<Phase | null>(null);
  return (
    <nav aria-label="Binder sections">
      <Link className={`row binder-contents-row${openId ? '' : ' is-selected'}`} to="/binder" aria-current={openId ? undefined : 'page'}>
        Contents
      </Link>
      {PHASES.map((phase) => {
        const inPhase = sections.filter((s) => s.phase === phase);
        return (
          <div key={phase}>
            <div className="binder-group">
              <span>{PHASE_WORDS[phase]}</span>
              <span className="count">{inPhase.length}</span>
            </div>
            {inPhase.map((s) => (
              <Link key={s.id} className={`row${s.id === openId ? ' is-selected' : ''}`} to={`/binder/${s.id}`} aria-current={s.id === openId ? 'page' : undefined}>
                <span className="binder-row-name" title={s.name}>
                  {s.name}
                </span>
                {s.attachments.length > 0 && <span className="binder-row-files">{filesText(s.attachments.length)}</span>}
              </Link>
            ))}
            {inPhase.length === 0 && adding !== phase && <div className="binder-list-note">No sections yet.</div>}
            {adding === phase ? (
              <AddSection phase={phase} onDone={() => setAdding(null)} />
            ) : (
              <div className="binder-add-button">
                <Button small aria-label={`Add a section to ${PHASE_WORDS[phase]}`} onClick={() => setAdding(phase)}>
                  Add section
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ---- The table of contents ----

interface Entry {
  to: string;
  label: string;
  note: string;
  depth?: number;
}

/** The checked forms and models of each phase, as links to their own screens. */
function checkedWork(model: Model, view: Model): Record<Phase, Entry[]> {
  const started = (there: boolean) => (there ? 'Started' : 'Not started');
  const requirements = all(model, 'requirement').length;
  const useCases = all(model, 'useCase').length;
  const entities = all(view, 'entity').length;
  const matrices = all(model, 'alternativeMatrix');
  const interfaceDiagrams = all(model, 'interfaceDiagram');
  const charts = all(model, 'structureChart');
  const modules = all(model, 'module').filter((m) => !m.repeatsId).length;
  const tests = all(model, 'test').length;

  const design: Entry[] = [];
  if (matrices.length === 0) design.push({ to: '/alternatives', label: 'Alternative matrix', note: 'Not started' });
  for (const m of matrices)
    design.push({ to: `/alternatives/${m.id}`, label: `Alternative matrix: ${m.name}`, note: count(m.alternatives.length, 'alternative', 'alternatives') });
  if (interfaceDiagrams.length === 0) design.push({ to: '/interfaces', label: 'Interface structure diagram', note: 'Not started' });
  for (const d of interfaceDiagrams) {
    const interfaces = all(model, 'interface').filter((i) => i.diagramId === d.id).length;
    design.push({ to: `/interfaces/${d.id}`, label: `Interface structure diagram: ${d.name}`, note: count(interfaces, 'interface', 'interfaces') });
  }
  if (charts.length === 0) design.push({ to: '/structure', label: 'Structure chart', note: 'Not started' });
  for (const c of charts) design.push({ to: `/structure/${c.id}`, label: `Structure chart: ${c.name}`, note: '' });
  design.push({ to: '/programs', label: 'Program specifications', note: modules ? count(modules, 'module', 'modules') : 'Not started' });
  design.push({ to: '/storage', label: 'Storage size estimate', note: entities ? count(entities, 'table', 'tables') : 'Not started' });

  return {
    planning: [
      { to: '/system-request', label: 'System request', note: started(Boolean(systemRequest(model))) },
      { to: '/feasibility', label: 'Feasibility analysis', note: started(Boolean(feasibility(model))) },
    ],
    analysis: [
      { to: '/requirements', label: 'Requirements definition', note: requirements ? count(requirements, 'requirement', 'requirements') : 'Not started' },
      { to: '/use-cases', label: 'Use cases', note: useCases ? count(useCases, 'use case', 'use cases') : 'Not started' },
      ...diagramsInOrder(view).map(({ diagram, title, depth }) => ({ to: `/diagram/${diagram.id}`, label: `Data flow diagram: ${title}`, note: '', depth })),
      { to: '/dictionary', label: 'Data dictionary', note: count(dataDefinitions(view).length, 'definition', 'definitions') },
      { to: '/data-model', label: 'Data model', note: entities ? count(entities, 'entity', 'entities') : 'Not started' },
      { to: '/crud', label: 'CRUD matrix', note: '' },
    ],
    design,
    implementation: [{ to: '/test-plan', label: 'Test plan', note: tests ? count(tests, 'test', 'tests') : 'Not started' }],
  };
}

function Contents({ sections }: { sections: BinderSection[] }) {
  const model = useModel();
  const view = useViewModel();
  const work = checkedWork(model, view);
  return (
    <div className="binder-contents">
      <p className="binder-intro">
        Everything in “{model.name}”, by phase. The forms and models open on their own screens, where the tool checks them. The binder sections hold the rest of the
        project’s documents: text you write here and files made in other tools.
      </p>
      <p className="muted binder-note">Binder sections are not checked.</p>
      {PHASES.map((phase, p) => {
        const inPhase = sections.filter((s) => s.phase === phase);
        const entries = work[phase];
        return (
          <section key={phase} className="binder-toc-phase" aria-labelledby={`binder-toc-${phase}`}>
            <h2 className="binder-toc-heading" id={`binder-toc-${phase}`}>
              <span className="mono binder-toc-number">{p + 1}</span>
              {PHASE_WORDS[phase]}
            </h2>
            <div className="panel-subheading">Checked forms and models</div>
            <ol className="binder-toc-list">
              {entries.map((entry, i) => (
                <li key={entry.to}>
                  <span className="mono binder-toc-number">
                    {p + 1}.{i + 1}
                  </span>
                  <Link to={entry.to} style={{ marginLeft: (entry.depth ?? 0) * 16 }}>
                    {entry.label}
                  </Link>
                  <span className="binder-toc-note">{entry.note}</span>
                </li>
              ))}
            </ol>
            <div className="panel-subheading">Binder sections</div>
            {inPhase.length === 0 ? (
              <p className="muted binder-toc-empty">No sections in this phase yet. Add one from the list on the left.</p>
            ) : (
              <ol className="binder-toc-list">
                {inPhase.map((s, i) => (
                  <li key={s.id}>
                    <span className="mono binder-toc-number">
                      {p + 1}.{entries.length + i + 1}
                    </span>
                    <Link to={`/binder/${s.id}`}>{s.name}</Link>
                    <span className="binder-toc-note">
                      {[!s.body.trim() && 'No text yet', s.attachments.length > 0 && filesText(s.attachments.length)].filter(Boolean).join(', ')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---- The screen ----

export function BinderScreen() {
  const { sectionId } = useParams();
  const model = useModel();
  const sections = binderSections(model);
  const section = sectionId ? get(model, sectionId, 'binderSection') : undefined;

  return (
    <>
      <ListColumn width={300} label="Binder sections">
        <SectionList sections={sections} openId={section?.id} />
      </ListColumn>
      <WorkArea>
        <PageHeader
          breadcrumb={section ? [{ label: 'Binder', to: '/binder' }, PHASE_WORDS[section.phase]] : ['Binder']}
          title={section ? section.name : sectionId ? 'Section not found' : 'Contents'}
        >
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          {section ? (
            <SectionPage key={section.id} section={section} />
          ) : sectionId ? (
            <p>
              There is no binder section at this address. It may have been deleted. <Link to="/binder">Open the contents</Link>
            </p>
          ) : (
            <Contents sections={sections} />
          )}
        </div>
      </WorkArea>
    </>
  );
}
