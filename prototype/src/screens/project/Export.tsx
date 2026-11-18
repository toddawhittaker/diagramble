// The export page: choose a document or pick parts by hand, see the pages, then print
// or save. Route: /export

import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button, Missing } from '../../components';
import { ListColumn, PageHeader, WorkArea } from '../../frame';
import { getOutline } from '../../model';
import { runRules, type Finding } from '../../rules';
import { useFindings, useFindingsVisible, useMode, useModel } from '../../store';
import { compiledDocuments, handParts, type Part } from './documents';
import { downloadModel } from './files';
import { ProblemsPage } from './pages';
import { plural } from './shared';
import './project.css';

// ---- The screen ----

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, and pages not served over a secure connection.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch {
      done = false;
    }
    area.remove();
    return done;
  }
}

/** The value of the document list that means "no compiled document: I pick the parts". */
const BY_HAND = 'hand';

export function ExportScreen() {
  const model = useModel();
  const mode = useMode();
  const findings = useFindings();
  const visible = useFindingsVisible();
  const [docKey, setDocKey] = useState(BY_HAND);
  // Holds only the boxes the user has changed. Any other box is ticked, unless it is a
  // diagram above the project's top diagram or a page of the physical model, so a part
  // added later starts as it should.
  const [changed, setChanged] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [note, setNote] = useState('');

  const documents = useMemo(() => compiledDocuments(model), [model]);
  const doc = documents.find((d) => d.key === docKey);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const modeWords = (m: string) => (m === 'physical' ? 'The rules ran on the physical model.' : 'The rules ran on the logical model.');

  // ---- Parts picked by hand ----
  const problemsPart: Part = {
    key: 'problems',
    title: 'Problems',
    render: () => <ProblemsPage model={model} findings={findings} visible={visible} note={modeWords(mode)} />,
  };
  const groups = [...handParts(model), { title: 'Problems', parts: [problemsPart] }];
  const choices = groups.flatMap((g) => g.parts);
  const included = (part: Part) => changed.get(part.key) ?? !(part.above || part.physical);
  const setIncluded = (key: string, on: boolean) => setChanged(new Map(changed).set(key, on));
  const setAll = (on: boolean) => setChanged(new Map(choices.map((c) => [c.key, on])));
  const chosen = choices.filter(included);

  // ---- A compiled document ----
  // Its findings are worked out in the document's own mode, so that the system
  // specification lists the physical findings whichever mode the app is showing.
  const docParts = doc ? doc.slots.flatMap((slot) => slot.parts) : [];
  const docFindings = useMemo<Finding[]>(() => {
    if (!doc || !visible) return [];
    const parts = doc.slots.flatMap((slot) => slot.parts);
    const every = doc.mode === mode ? findings : runRules(model, doc.mode);
    const own = every.filter((f) => parts.some((part) => part.covers?.(f)));
    return [...own.filter((f) => f.severity === 'error'), ...own.filter((f) => f.severity !== 'error')];
  }, [doc, visible, mode, findings, model]);

  const pages = doc ? docParts.length + (docParts.length ? 1 : 0) : chosen.length;
  const nothing = pages === 0;

  return (
    <>
      <ListColumn width={300} label="What to include, and what to do with it">
        <div className="project-export-controls">
          <h2 className="panel-subheading">Document</h2>
          <div className="project-choices" role="radiogroup" aria-label="Document to compile">
            <label className="project-choice project-doc-choice">
              <input type="radio" name="project-document" checked={!doc} onChange={() => setDocKey(BY_HAND)} />
              <span>
                <span className="project-choice-label">Parts chosen by hand</span>
                <span className="muted project-choice-about">Tick what to include.</span>
              </span>
            </label>
            {documents.map((d) => (
              <label key={d.key} className="project-choice project-doc-choice">
                <input type="radio" name="project-document" checked={doc?.key === d.key} onChange={() => setDocKey(d.key)} />
                <span>
                  <span className="project-choice-label">{d.title}</span>
                  <span className="muted project-choice-about">{d.about}</span>
                </span>
              </label>
            ))}
          </div>

          {doc ? (
            <>
              <h2 className="panel-subheading">In this document</h2>
              <ol className="project-outline-list">
                {doc.slots.map((slot) => (
                  <li key={slot.title}>
                    {slot.title}
                    {slot.parts.length === 0 && (
                      <>
                        {' '}
                        <Missing>not in the project yet</Missing>
                      </>
                    )}
                  </li>
                ))}
                {docParts.length > 0 && <li>Problems in this document</li>}
              </ol>
              <p className="field-hint">
                The parts and their order are fixed.{' '}
                {doc.mode === 'physical'
                  ? 'This document shows the physical model, with what is marked system-related.'
                  : 'This document shows the logical model, with nothing physical in it.'}
              </p>
            </>
          ) : (
            <>
              <h2 className="panel-subheading">Include</h2>
              <div className="project-ticks">
                {groups.map((group) => (
                  <Fragment key={group.title}>
                    <div className="project-tick-group muted">{group.title}</div>
                    {group.parts.map((part) => (
                      <label key={part.key} className="project-tick">
                        <input type="checkbox" checked={included(part)} onChange={(e) => setIncluded(part.key, e.target.checked)} />
                        <span>
                          {part.title}
                          {part.above && <span className="muted"> (above the project)</span>}
                        </span>
                      </label>
                    ))}
                  </Fragment>
                ))}
              </div>
              <div className="hstack">
                <Button small onClick={() => setAll(true)} disabled={chosen.length === choices.length}>
                  Tick all
                </Button>
                <Button small onClick={() => setAll(false)} disabled={chosen.length === 0}>
                  Clear all
                </Button>
              </div>
            </>
          )}

          <h2 className="panel-subheading">Save</h2>
          <Button variant="primary" onClick={() => window.print()} disabled={nothing}>
            Print or save as PDF
          </Button>
          <p className="field-hint">In the print window, choose &ldquo;Save as PDF&rdquo; as the printer to get a file.</p>
          <Button
            onClick={() => {
              setNote(`Saved ${downloadModel(model)} to your downloads.`);
            }}
          >
            Download project file
          </Button>
          <Button
            onClick={async () => {
              const done = await copyText(getOutline(model));
              setNote(done ? 'The outline is copied. Paste it wherever you need it.' : 'The browser would not copy the outline.');
            }}
          >
            Copy outline as text
          </Button>
          <p className="field-hint" role="status">
            {note}
          </p>

          <h2 className="panel-subheading">Start again</h2>
          <p className="field-hint">
            Starting a new project, opening a project file and starting again from the sample data are on the{' '}
            <Link to="/project">Project page</Link>.
          </p>
        </div>
      </ListColumn>
      <WorkArea>
        <PageHeader breadcrumb={['Project', 'Export']} title={doc ? doc.title : 'Export'}>
          <span className="muted">
            A title page and {plural(pages, 'section')}, shown as they will print
          </span>
        </PageHeader>
        <div className="work-body scroll project-preview-area">
          <div className="project-preview">
            <section className="project-page project-title-page">
              <h1 className="project-doc-title">{model.name || 'Project with no name'}</h1>
              {doc && <p className="title project-doc-kind">{doc.title}</p>}
              <p className="muted">{today}</p>
              {nothing ? (
                <p className="muted project-caption">
                  {doc
                    ? 'The project holds none of the parts of this document yet, so there is nothing to print.'
                    : 'Nothing is ticked, so there is nothing to print.'}
                </p>
              ) : (
                <div className="table-caption project-caption">Contents</div>
              )}
              {doc ? (
                <ol className="project-contents">
                  {doc.slots.map((slot) => (
                    <li key={slot.title}>
                      {slot.title}
                      {slot.parts.length === 0 && (
                        <>
                          {' '}
                          <Missing>Missing: not in the project yet</Missing>
                        </>
                      )}
                      {(slot.parts.length > 1 || (slot.parts.length === 1 && slot.parts[0].title !== slot.title)) && (
                        <ul className="project-plain-list">
                          {slot.parts.map((part) => (
                            <li key={part.key}>{part.title}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  {docParts.length > 0 && <li>Problems in this document</li>}
                </ol>
              ) : (
                !nothing && (
                  <ol className="project-contents">
                    {chosen.map((c) => (
                      <li key={c.key}>{c.title}</li>
                    ))}
                  </ol>
                )
              )}
            </section>
            {doc
              ? docParts.map((part) => <Fragment key={part.key}>{part.render()}</Fragment>)
              : chosen.map((part) => <Fragment key={part.key}>{part.render()}</Fragment>)}
            {doc && docParts.length > 0 && (
              <ProblemsPage
                model={model}
                findings={docFindings}
                visible={visible}
                title="Problems in this document"
                scope="what this document contains"
                note={modeWords(doc.mode)}
              />
            )}
          </div>
        </div>
      </WorkArea>
    </>
  );
}
