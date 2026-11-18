// One open binder section: its title and phase, its text, the conversion strategy form
// (on a migration plan only) and its attached files.

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, Missing, SelectField, Switch } from '../../components';
import {
  BINDER_LAYOUTS,
  CONVERSION_OPTIONS,
  MAX_ATTACHMENT_BYTES,
  PHASES,
  binderSections,
  conversionEffects,
  type Attachment,
  type BinderSection,
  type ConversionStrategy,
  type Phase,
} from '../../model';
import { clearError, dispatch, getModel, useModel } from '../../store';
import { BodyView, MarksKey } from './Body';

export const PHASE_WORDS: Record<Phase, string> = {
  planning: 'Planning',
  analysis: 'Analysis',
  design: 'Design',
  implementation: 'Implementation',
};

export function filesText(n: number): string {
  return n === 1 ? '1 file' : `${n} files`;
}

// ---- The title ----

function TitleField({ section }: { section: BinderSection }) {
  const [draft, setDraft] = useState(section.name);
  const id = useId();
  useEffect(() => setDraft(section.name), [section.name]);
  const commit = () => {
    const next = draft.trim();
    if (!next || next === section.name) {
      setDraft(section.name);
      return;
    }
    if (!dispatch({ type: 'rename', id: section.id, name: next }).ok) setDraft(section.name);
  };
  return (
    <div className="field binder-title-field">
      <label className="field-label" htmlFor={id}>
        Title
      </label>
      <input
        id={id}
        type="text"
        className="input binder-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(section.name);
        }}
      />
    </div>
  );
}

// ---- Phase, order and delete ----

function SectionTools({ section }: { section: BinderSection }) {
  const model = useModel();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const inPhase = binderSections(model, section.phase);
  const index = inPhase.findIndex((s) => s.id === section.id);

  const move = (delta: -1 | 1) => {
    const other = inPhase[index + delta];
    if (!other) return;
    const ids = binderSections(model).map((s) => s.id);
    const a = ids.indexOf(section.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    dispatch({ type: 'reorderBinderSections', ids });
  };

  const remove = () => {
    if (dispatch({ type: 'deleteElement', id: section.id }).ok) navigate('/binder');
  };

  return (
    <div className="binder-tools">
      <div className="binder-tools-row">
        <div className="binder-phase">
          <SelectField
            label="Phase"
            value={section.phase}
            options={PHASES.map((p) => ({ value: p, label: PHASE_WORDS[p] }))}
            onChange={(phase) => {
              if (phase !== section.phase) dispatch({ type: 'updateBinderSection', id: section.id, phase });
            }}
          />
        </div>
        <div className="binder-order">
          <span className="field-label">
            Place in {PHASE_WORDS[section.phase]}: {index + 1} of {inPhase.length}
          </span>
          <div className="hstack">
            <Button small disabled={index <= 0} onClick={() => move(-1)}>
              Move up
            </Button>
            <Button small disabled={index >= inPhase.length - 1} onClick={() => move(1)}>
              Move down
            </Button>
          </div>
        </div>
        <div className="binder-delete">
          <Button small disabled={confirming} onClick={() => setConfirming(true)}>
            Delete section
          </Button>
        </div>
      </div>
      {confirming && (
        <div className="binder-confirm" role="alertdialog" aria-label="Delete this section?">
          <span>
            Delete “{section.name}”? Its text
            {section.attachments.length > 0 && ` and ${filesText(section.attachments.length)}`} will go with it. Undo brings it back.
          </span>
          <div className="hstack">
            <Button small variant="primary" onClick={remove}>
              Delete
            </Button>
            <Button small autoFocus onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- The text ----

function BodyEditor({ section }: { section: BinderSection }) {
  const [mode, setMode] = useState<'read' | 'edit'>(section.body.trim() ? 'read' : 'edit');
  const [draft, setDraft] = useState(section.body);
  const id = useId();
  // Undo and redo change the text under the box.
  useEffect(() => setDraft(section.body), [section.body]);

  const save = (text: string) => {
    if (text !== section.body) dispatch({ type: 'updateBinderSection', id: section.id, body: text });
  };

  // Leaving the page by the keyboard never blurs the box, so save what is in it then.
  const latest = useRef({ draft, body: section.body });
  latest.current = { draft, body: section.body };
  useEffect(
    () => () => {
      const { draft: text, body } = latest.current;
      if (text !== body && getModel().elements[section.id]) dispatch({ type: 'updateBinderSection', id: section.id, body: text });
    },
    [section.id],
  );

  return (
    <section className="binder-part" aria-labelledby={`${id}-heading`}>
      <div className="binder-part-head">
        <h2 className="section-heading" id={`${id}-heading`}>
          Text
        </h2>
        <Switch
          small
          label="Edit or read the text"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'read', label: 'Read' },
          ]}
        />
      </div>
      {mode === 'read' ? (
        section.body.trim() ? (
          <BodyView body={section.body} />
        ) : (
          <p>
            <Missing>Nothing written yet</Missing>{' '}
            <Button variant="link" onClick={() => setMode('edit')}>
              Write something
            </Button>
          </p>
        )
      ) : (
        <div className="binder-edit">
          <div className="binder-edit-box">
            <label className="visually-hidden" htmlFor={`${id}-text`}>
              Text of this section
            </label>
            <textarea
              id={`${id}-text`}
              className="input binder-textarea"
              rows={18}
              value={draft}
              placeholder="Nothing written yet"
              spellCheck
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => save(draft)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setDraft(section.body);
              }}
            />
            <div className="field-hint">
              {draft === section.body ? 'Saved.' : 'Not saved yet.'} The text is saved when you leave the box. Press Escape to go back to the saved text.
            </div>
          </div>
          <MarksKey />
        </div>
      )}
    </section>
  );
}

// ---- The conversion strategy ----

type ChoiceKey = 'style' | 'location' | 'modules';
type Option = { title: string; meaning: string };

const CHOICES: { key: ChoiceKey; label: string; about: string }[] = [
  { key: 'style', label: 'Conversion style', about: 'How the new system takes over from the old one.' },
  { key: 'location', label: 'Conversion locations', about: 'Which parts of the organization convert, and when.' },
  { key: 'modules', label: 'Conversion modules', about: 'How much of the system is installed at a time.' },
];

const LEVEL_WORDS = { low: 'Low', medium: 'Medium', high: 'High' } as const;
const TIME_WORDS = { low: 'Short', medium: 'Medium', high: 'Long' } as const;

function ConversionForm({ section, conversion }: { section: BinderSection; conversion: ConversionStrategy }) {
  const id = useId();
  const [reasons, setReasons] = useState(conversion.reasons);
  useEffect(() => setReasons(conversion.reasons), [conversion.reasons]);
  const effects = conversionEffects(conversion);

  const choose = (key: ChoiceKey, value: string | null) => {
    if (conversion[key] === value) return;
    dispatch({ type: 'setConversion', sectionId: section.id, ...({ [key]: value } as Partial<ConversionStrategy>) });
  };

  return (
    <section className="binder-part" aria-labelledby={`${id}-heading`}>
      <h2 className="section-heading" id={`${id}-heading`}>
        Conversion strategy
      </h2>
      <p className="muted binder-note">
        Make the three choices, then say why. Nothing here is marked right or wrong, because the right strategy depends on the business.
      </p>
      <div className="binder-conversion">
        <div className="binder-choices">
          {CHOICES.map((choice) => {
            const options = Object.entries(CONVERSION_OPTIONS[choice.key] as Record<string, Option>);
            return (
              <fieldset key={choice.key} className="binder-choice">
                <legend>{choice.label}</legend>
                <div className="muted binder-choice-about">{choice.about}</div>
                {options.map(([value, option]) => (
                  <label key={value} className="binder-option">
                    <input
                      type="radio"
                      name={`${id}-${choice.key}`}
                      checked={conversion[choice.key] === value}
                      onChange={() => choose(choice.key, value)}
                    />
                    <span>
                      <span className="binder-option-title">{option.title}</span>
                      <span className="muted binder-option-meaning">{option.meaning}</span>
                    </span>
                  </label>
                ))}
                <label className="binder-option">
                  <input type="radio" name={`${id}-${choice.key}`} checked={conversion[choice.key] === null} onChange={() => choose(choice.key, null)} />
                  <span className="muted">Not chosen yet</span>
                </label>
              </fieldset>
            );
          })}
        </div>
        <div className="binder-effects">
          <div className="table-caption">What your choices mean</div>
          {effects.length === 0 ? (
            <p className="muted">Make a choice to see what it means for risk, cost and time.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Choice</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Cost</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {effects.map((effect) => (
                  <tr key={effect.choice}>
                    <td>
                      <div className="binder-effect-title">{effect.title}</div>
                      <div className="binder-effect-why">{effect.explanation}</div>
                    </td>
                    <td>{LEVEL_WORDS[effect.risk]}</td>
                    <td>{LEVEL_WORDS[effect.cost]}</td>
                    <td>{TIME_WORDS[effect.time]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {effects.length > 0 && effects.length < CHOICES.length && (
            <p className="muted">
              {CHOICES.length - effects.length === 1 ? 'One choice is' : `${CHOICES.length - effects.length} choices are`} not made yet.
            </p>
          )}
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-reasons`}>
          Your reasons
        </label>
        <textarea
          id={`${id}-reasons`}
          className="input"
          rows={5}
          value={reasons}
          placeholder="No reasons written yet"
          onChange={(e) => setReasons(e.target.value)}
          onBlur={() => {
            if (reasons !== conversion.reasons) dispatch({ type: 'setConversion', sectionId: section.id, reasons });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setReasons(conversion.reasons);
          }}
        />
      </div>
    </section>
  );
}

// ---- Attached files ----

function sizeText(bytes: number): string {
  if (bytes < 1024) return bytes === 1 ? '1 byte' : `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(a: Attachment): boolean {
  return a.mimeType.startsWith('image/');
}

/** A file is opened in a new tab only when the browser shows it without running anything in it. */
function opensInTab(a: Attachment): boolean {
  return a.mimeType === 'application/pdf' || a.mimeType === 'text/plain';
}

function kindWords(a: Attachment): string {
  const m = a.mimeType;
  if (m.startsWith('image/')) return 'Image';
  if (m === 'application/pdf') return 'PDF';
  if (m === 'text/html') return 'Web page';
  if (m === 'text/csv' || m.includes('spreadsheet') || m.includes('excel')) return 'Spreadsheet';
  if (m.includes('zip')) return 'Zipped folder';
  if (m.includes('word') || m.includes('document')) return 'Document';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'Slides';
  if (m.startsWith('text/')) return 'Text';
  return 'File';
}

function openInTab(a: Attachment): void {
  const comma = a.dataUrl.indexOf(',');
  const header = a.dataUrl.slice(0, comma);
  const data = a.dataUrl.slice(comma + 1);
  let blob: Blob;
  if (/;base64$/i.test(header)) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: a.mimeType });
  } else {
    blob = new Blob([decodeURIComponent(data)], { type: a.mimeType });
  }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Attachments({ section }: { section: BinderSection }) {
  const id = useId();
  const [refused, setRefused] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [large, setLarge] = useState<string | null>(null);

  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    const messages: string[] = [];
    for (const file of files) {
      try {
        const dataUrl = await readFile(file);
        const result = dispatch({ type: 'addAttachment', sectionId: section.id, name: file.name, mimeType: file.type || undefined, dataUrl });
        if (!result.ok) {
          messages.push(result.error);
          // The reason is shown beside the input, so it need not show in the strip as well.
          clearError();
        }
      } catch {
        messages.push(`'${file.name}' could not be read.`);
      }
    }
    input.value = '';
    setRefused(messages);
    setBusy(false);
  };

  return (
    <section className="binder-part" aria-labelledby={`${id}-heading`}>
      <h2 className="section-heading" id={`${id}-heading`}>
        Attached files <span className="count">{section.attachments.length}</span>
      </h2>
      {section.attachments.length === 0 ? (
        <p className="muted">No files attached yet.</p>
      ) : (
        <table className="table binder-files">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Preview</span>
              </th>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col" className="is-numeric">
                Size
              </th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {section.attachments.map((a) => (
              <tr key={a.id}>
                <td className="binder-thumb-cell">{isImage(a) && <img className="binder-thumb" src={a.dataUrl} alt={`Preview of ${a.name}`} />}</td>
                <td className="binder-file-name">
                  {a.name}
                  {large === a.id && isImage(a) && <img className="binder-large" src={a.dataUrl} alt={`${a.name}, full size`} />}
                </td>
                <td>
                  {kindWords(a)} <span className="muted mono binder-mime">{a.mimeType}</span>
                </td>
                <td className="is-numeric">{sizeText(a.size)}</td>
                <td>
                  <div className="binder-file-tools">
                    {isImage(a) && (
                      <Button small aria-expanded={large === a.id} onClick={() => setLarge(large === a.id ? null : a.id)}>
                        {large === a.id ? 'Close' : 'Open'}
                      </Button>
                    )}
                    {opensInTab(a) && (
                      <Button small onClick={() => openInTab(a)}>
                        Open
                      </Button>
                    )}
                    <a className="btn btn-small" href={a.dataUrl} download={a.name}>
                      Download
                    </a>
                    <Button
                      small
                      aria-label={`Remove ${a.name}`}
                      onClick={() => dispatch({ type: 'removeAttachment', sectionId: section.id, attachmentId: a.id })}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="binder-attach">
        <div className="field">
          <label className="field-label" htmlFor={`${id}-file`}>
            Attach a file
          </label>
          <input id={`${id}-file`} className="binder-file-input" type="file" multiple disabled={busy} onChange={add} />
          <div className="field-hint">
            Any type of file, up to {Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB each. Work made in other tools goes here: images, PDFs, spreadsheets, or a web
            page or zipped folder for an interface prototype.
          </div>
        </div>
        <div className="binder-refused" role="alert">
          {refused.map((message, i) => (
            <p key={i}>{message}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- The whole section ----

export function SectionPage({ section }: { section: BinderSection }) {
  const layout = section.layout ? BINDER_LAYOUTS.find((l) => l.key === section.layout) : undefined;
  return (
    <div className="binder-section">
      <TitleField section={section} />
      <SectionTools section={section} />
      <p className="muted binder-note">
        Binder sections are not checked.
        {layout && ` This one started from the layout “${layout.title}”.`}
      </p>
      <BodyEditor section={section} />
      {section.conversion && <ConversionForm section={section} conversion={section.conversion} />}
      <Attachments section={section} />
    </div>
  );
}
