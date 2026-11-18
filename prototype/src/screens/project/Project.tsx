// The project page: what the project holds, its two settings, and starting, opening
// and saving a project. Route: /project

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, TextField } from '../../components';
import { PageHeader, UndoRedo, WorkArea } from '../../frame';
import {
  all,
  binderSections,
  contextDiagram,
  dataDefinitions,
  diagramsInOrder,
  feasibility,
  systemRequest,
  topDiagram,
  type Id,
  type Model,
} from '../../model';
import { STARTERS } from '../../sample/starters';
import { dispatch, getModel, loadProjectFile, loadStarter, projectAsStarterFile, resetToSample, useModel } from '../../store';
import { downloadModel, downloadText, fileName } from './files';
import './project.css';

/** Something that would take the place of the current project, waiting for a yes or no. */
type Pending =
  | { kind: 'starter'; id: string; title: string }
  | { kind: 'file'; name: string; text: string }
  | { kind: 'sample' };

/** The counts of the second release: the forms, the design diagrams and the binder. */
function newCountsOf(model: Model): { word: string; n: number | string }[] {
  const sections = binderSections(model);
  const modules = all(model, 'module');
  return [
    { word: 'System request', n: systemRequest(model) ? 'Started' : 'Not started' },
    { word: 'Feasibility analysis', n: feasibility(model) ? 'Started' : 'Not started' },
    { word: 'Requirements', n: all(model, 'requirement').length },
    { word: 'Alternative matrices', n: all(model, 'alternativeMatrix').length },
    { word: 'Interface structure diagrams', n: all(model, 'interfaceDiagram').length },
    { word: 'Interfaces', n: all(model, 'interface').length },
    { word: 'Navigation links', n: all(model, 'navigationLink').length },
    { word: 'Structure charts', n: all(model, 'structureChart').length },
    { word: 'Modules', n: modules.filter((m) => !m.repeatsId).length },
    { word: 'Modules drawn again', n: modules.filter((m) => m.repeatsId).length },
    { word: 'Couples', n: all(model, 'couple').length },
    { word: 'Tests', n: all(model, 'test').length },
    { word: 'Binder sections', n: sections.length },
    { word: 'Attached files', n: sections.reduce((sum, s) => sum + s.attachments.length, 0) },
  ];
}

/** The project's name, changed with the shared command. An empty name is refused and the box goes back. */
function NameField({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  // A project opened from a file or a starter, an undo or a redo changes the name from outside.
  useEffect(() => setDraft(name), [name]);
  const commit = (value: string) => {
    const next = value.trim();
    if (next === name) {
      setDraft(name);
      return;
    }
    const result = dispatch({ type: 'renameProject', name: next });
    if (!result.ok) setDraft(name);
  };
  return (
    <div className="project-rename">
      <TextField
        label="Name"
        value={draft}
        onChange={setDraft}
        onCommit={commit}
        hint="Shown in the top bar and on the title page of an export. It is saved when you leave the box or press Enter."
      />
    </div>
  );
}

function countsOf(model: Model): { word: string; n: number }[] {
  return [
    { word: 'Diagrams', n: all(model, 'diagram').length },
    { word: 'Processes', n: all(model, 'process').length },
    { word: 'External entities', n: all(model, 'externalEntity').length },
    { word: 'Data stores', n: all(model, 'dataStore').length },
    { word: 'Data flows', n: all(model, 'dataFlow').length },
    { word: 'Control flows', n: all(model, 'controlFlow').length },
    { word: 'Data definitions', n: dataDefinitions(model).length },
    { word: 'Use cases', n: all(model, 'useCase').length },
    { word: 'Entities', n: all(model, 'entity').length },
    { word: 'Relationships', n: all(model, 'relationship').length },
  ];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="project-help-section">
      <h2 className="project-help-heading">{title}</h2>
      {children}
    </section>
  );
}

/** One choice of a setting: a radio button, its name, and a sentence about it. */
function Choice(props: { name: string; checked: boolean; onChoose: () => void; label: ReactNode; depth?: number; children?: ReactNode }) {
  return (
    <label className="project-choice" style={{ marginLeft: (props.depth ?? 0) * 20 }}>
      <input type="radio" name={props.name} checked={props.checked} onChange={props.onChoose} />
      <span>
        <span className="project-choice-label">{props.label}</span>
        {props.children && <span className="muted project-choice-about">{props.children}</span>}
      </span>
    </label>
  );
}

/** Asks before the current project is replaced, and offers to download it first. */
function Confirm({ pending, onYes, onNo }: { pending: Pending; onYes: () => void; onNo: () => void }) {
  const model = useModel();
  const [saved, setSaved] = useState('');
  const incoming =
    pending.kind === 'starter'
      ? `a fresh copy of “${pending.title}”`
      : pending.kind === 'file'
        ? `the project in the file “${pending.name}”`
        : 'the sample project, “Clinic appointments”';
  return (
    <div className="project-confirm" role="alertdialog" aria-label="Replace the current project?">
      <p>
        This replaces the current project, &ldquo;{model.name || 'Project with no name'}&rdquo;, with {incoming}. Everything
        in the current project is thrown away and it cannot be undone. To keep it, download it first.
      </p>
      <div className="hstack">
        <Button small onClick={() => setSaved(`Saved ${downloadModel(getModel())} to your downloads.`)}>
          Download this project first
        </Button>
        <Button small onClick={onYes}>
          Replace my project
        </Button>
        <Button small variant="primary" autoFocus onClick={onNo}>
          Keep my project
        </Button>
      </div>
      {saved && (
        <p className="field-hint" role="status">
          {saved}
        </p>
      )}
    </div>
  );
}

export function ProjectScreen() {
  const model = useModel();
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const top = topDiagram(model);
  const context = contextDiagram(model);
  const diagrams = diagramsInOrder(model);
  const showFindings = model.settings.showFindings;

  const chooseTop = (id: Id) => {
    if (id === top?.id) return;
    dispatch({ type: 'setTopDiagram', diagramId: id === context?.id ? null : id });
  };

  const ask = (next: Pending) => {
    setNote('');
    setSaved('');
    setFileError('');
    setPending(next);
  };

  const replace = () => {
    if (!pending) return;
    if (pending.kind === 'starter') {
      setNote(loadStarter(pending.id) ? `“${pending.title}” is open.` : `The starter case “${pending.title}” could not be found.`);
    } else if (pending.kind === 'sample') {
      resetToSample();
      setNote('The sample project is open.');
    } else {
      const result = loadProjectFile(pending.text);
      if (result.ok) setNote(`The project in “${pending.name}” is open.`);
      else setFileError(`${result.error} Nothing was changed.`);
    }
    setPending(null);
  };

  const readFile = async (file: File) => {
    try {
      ask({ kind: 'file', name: file.name, text: await file.text() });
    } catch {
      setPending(null);
      setFileError('The browser could not read that file. Nothing was changed.');
    }
  };

  const confirmFor = (test: (p: Pending) => boolean) =>
    pending && test(pending) ? <Confirm pending={pending} onYes={replace} onNo={() => setPending(null)} /> : null;

  return (
    <WorkArea>
      <PageHeader breadcrumb={['Project']} title="Project">
        <UndoRedo />
      </PageHeader>
      <div className="work-body scroll pad">
        <div className="project-column">
          <Section title="This project">
            <NameField name={model.name} />
            <p>A project holds one scenario: one business case and every diagram, definition, form and binder section that belongs to it.</p>
            <div className="project-count-tables">
              <table className="table project-counts">
                <thead>
                  <tr>
                    <th>Diagrams and data</th>
                    <th>How many</th>
                  </tr>
                </thead>
                <tbody>
                  {countsOf(model).map((row) => (
                    <tr key={row.word}>
                      <td>{row.word}</td>
                      <td className="count">{row.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="table project-counts">
                <thead>
                  <tr>
                    <th>Forms, design and binder</th>
                    <th>How many</th>
                  </tr>
                </thead>
                <tbody>
                  {newCountsOf(model).map((row) => (
                    <tr key={row.word}>
                      <td>{row.word}</td>
                      <td className={typeof row.n === 'number' ? 'count' : 'muted'}>{row.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Top diagram">
            <p>
              The top diagram is the highest diagram this project is expected to contain: the diagrams above it stay in the
              project, but the rules report nothing about them and an export leaves them out unless you tick them. Choose a
              lower diagram when an exercise asks for that diagram alone, such as a level 0 diagram with no context diagram.
            </p>
            <div className="project-choices" role="radiogroup" aria-label="Top diagram">
              {diagrams.map((row) => (
                <Choice
                  key={row.diagram.id}
                  name="project-top"
                  depth={row.depth}
                  checked={row.diagram.id === top?.id}
                  onChoose={() => chooseTop(row.diagram.id)}
                  label={row.title}
                >
                  {row.diagram.id === context?.id ? 'The usual choice. Every diagram is checked.' : undefined}
                </Choice>
              ))}
            </div>
          </Section>

          <Section title="Problems">
            <div className="project-choices" role="radiogroup" aria-label="When to show problems">
              <Choice
                name="project-findings"
                checked={showFindings === 'always'}
                onChoose={() => showFindings !== 'always' && dispatch({ type: 'setShowFindings', showFindings: 'always' })}
                label="Show problems as I work"
              >
                The counts and marks are always on screen and change with every edit.
              </Choice>
              <Choice
                name="project-findings"
                checked={showFindings === 'onRequest'}
                onChoose={() => showFindings !== 'onRequest' && dispatch({ type: 'setShowFindings', showFindings: 'onRequest' })}
                label="Show problems only when I ask"
              >
                Nothing is marked until you choose &ldquo;Check now&rdquo;, and the problems are hidden again at your next
                change. Use it to look for the mistakes yourself first.
              </Choice>
            </div>
          </Section>

          <Section title="Start a new project">
            <p>
              A starter case is a project to begin from. Opening one puts a fresh copy in place of the current project. The
              starter cases hold diagrams and data only, so their forms and binder start empty.{' '}
              <Link to="/help">Help</Link> says more about projects and starter cases.
            </p>
            <div className="project-starters">
              {STARTERS.map((starter) => (
                <div key={starter.id} className="project-starter">
                  <div>
                    <div className="project-starter-title">{starter.title}</div>
                    <div className="muted">{starter.summary}</div>
                  </div>
                  <Button small onClick={() => ask({ kind: 'starter', id: starter.id, title: starter.title })}>
                    Open
                  </Button>
                  {confirmFor((p) => p.kind === 'starter' && p.id === starter.id)}
                </div>
              ))}
              <div className="project-starter">
                <div>
                  <div className="project-starter-title">Clinic appointments</div>
                  <div className="muted">
                    The sample project this app first opens with: three diagrams, a data dictionary, use cases and a small
                    data model. It now also holds the forms and design work that come later in a project: a system request, a
                    feasibility analysis, requirements, an alternative matrix, an interface structure diagram, a structure chart
                    with program specifications, a test plan, four binder sections, and the physical names, tables and storage
                    figures that physical mode shows.
                  </div>
                </div>
                <Button small onClick={() => ask({ kind: 'sample' })}>
                  Start again from the sample data
                </Button>
                {confirmFor((p) => p.kind === 'sample')}
              </div>
            </div>
            {note && (
              <p role="status">
                {note} {top && <Link to={`/diagram/${top.id}`}>Open its top diagram</Link>}
              </p>
            )}

            <h3 className="project-help-subheading">Open a project file</h3>
            <p className="muted">Choose a file made with &ldquo;Download this project&rdquo;. It takes the place of the current project.</p>
            <input
              ref={fileInput}
              className="project-file"
              type="file"
              accept=".json,application/json"
              aria-label="Open a project file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Clearing the box lets the same file be chosen again.
                e.target.value = '';
                if (file) void readFile(file);
              }}
            />
            {confirmFor((p) => p.kind === 'file')}
            {fileError && (
              <p className="project-file-error" role="alert">
                {fileError}
              </p>
            )}

            <h3 className="project-help-subheading">Save this project</h3>
            <div className="project-save">
              <Button onClick={() => setSaved(`Saved ${downloadModel(model)} to your downloads.`)}>Download this project</Button>
              <span className="muted">A project file you can open again here, on this computer or another.</span>
              <Button
                onClick={() => {
                  const name = fileName(model.name, 'starter.diagramble.json');
                  downloadText(projectAsStarterFile(), name);
                  setSaved(`Saved ${name} to your downloads.`);
                }}
              >
                Save as a starter case
              </Button>
              <span className="muted">
                The same file with everything in it marked as given, so that whoever opens it can tell what they started with
                from what they add.
              </span>
            </div>
            <p className="field-hint" role="status">
              {saved}
            </p>
          </Section>
        </div>
      </div>
    </WorkArea>
  );
}
