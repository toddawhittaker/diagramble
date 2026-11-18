// The top of the right panel on the entity relationship diagram: the details of the
// selected entity or relationship, all editable.

import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import {
  all,
  entityOfAttribute,
  fullIdentifier,
  get,
  parentEnd,
  storeLabel,
  type Attribute,
  type Entity,
  type Model,
  type Relationship,
  type RelationshipEnd,
} from '../../model';
import { clearSelection, dispatch, useModel, useSelection } from '../../store';
import { Button, EntryFields, Missing } from '../../components';
import { DraftField, plural } from './shared';

/** "Delete", then a question before anything is removed. */
function DeleteControl({ question, onDelete }: { question: string; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <div>
        <Button small onClick={() => setAsking(true)}>
          Delete
        </Button>
      </div>
    );
  return (
    <div className="datamodel-confirm vstack">
      <div>{question}</div>
      <div className="hstack">
        <Button small variant="primary" onClick={onDelete}>
          Delete
        </Button>
        <Button small onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---- An entity ----

function EntityDetails({ model, entity }: { model: Model; entity: Entity }) {
  const [newName, setNewName] = useState('');
  const listId = useId();
  const storeFieldId = useId();
  const stores = all(model, 'dataStore');
  const unowned = all(model, 'dataElement').filter((d) => !entityOfAttribute(model, d.id));
  const attributes = entity.attributes;
  const ownIds = attributes.map((a) => a.dataId);
  const inherited = fullIdentifier(model, entity.id).filter((dataId) => !ownIds.includes(dataId));
  const relationshipCount = all(model, 'relationship').filter((r) => r.ends.some((e) => e.entityId === entity.id)).length;

  const setAttributes = (next: Attribute[]) => dispatch({ type: 'setAttributes', entityId: entity.id, attributes: next });
  const move = (index: number, by: number) => {
    const next = [...attributes];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setAttributes(next);
  };
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    const result = dispatch({ type: 'addAttribute', entityId: entity.id, dataName: name });
    if (result.ok) setNewName('');
  };

  return (
    <>
      <div>
        <div className="datamodel-kind">Entity</div>
        <h2 className="panel-heading">{entity.name || <Missing>No name yet</Missing>}</h2>
      </div>
      <DraftField label="Name" value={entity.name} onSave={(name) => dispatch({ type: 'rename', id: entity.id, name: name.trim() })} />
      <DraftField
        label="Code"
        value={entity.code}
        placeholder="No code"
        hint="A short prefix for the attribute names, such as MEM. It may be left empty."
        onSave={(code) => dispatch({ type: 'updateEntity', id: entity.id, code: code.trim() })}
      />
      <DraftField
        label="Description"
        value={entity.description}
        rows={3}
        placeholder="No description yet"
        onSave={(description) => dispatch({ type: 'describe', id: entity.id, description })}
      />
      <div className="field">
        <label className="field-label" htmlFor={storeFieldId}>
          Held in data store
        </label>
        <select
          id={storeFieldId}
          className="input"
          value={entity.storeId ?? ''}
          onChange={(e) => dispatch({ type: 'updateEntity', id: entity.id, storeId: e.target.value || null })}
        >
          <option value="">None</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {storeLabel(model, s.id)} {s.name}
            </option>
          ))}
        </select>
      </div>

      <h3 className="panel-subheading">Attributes</h3>
      {attributes.length === 0 ? (
        <div>
          <Missing>No attributes yet</Missing>
        </div>
      ) : (
        <ul className="datamodel-attrs">
          {attributes.map((a, index) => {
            const name = model.elements[a.dataId]?.name ?? '';
            return (
              <li key={a.dataId} className="datamodel-attr">
                <label className="datamodel-check" title="Part of the identifier">
                  <input
                    type="checkbox"
                    checked={a.identifier}
                    aria-label={`${name} is part of the identifier`}
                    onChange={(e) => setAttributes(attributes.map((x) => (x.dataId === a.dataId ? { ...x, identifier: e.target.checked } : x)))}
                  />
                  <span className="mono">*</span>
                </label>
                <Link className="datamodel-attr-name" to={`/dictionary/${a.dataId}`}>
                  {name}
                </Link>
                <label className="datamodel-check datamodel-repeats" title="Can hold several values for one instance">
                  <input
                    type="checkbox"
                    checked={a.repeats}
                    aria-label={`${name} repeats`}
                    onChange={(e) => setAttributes(attributes.map((x) => (x.dataId === a.dataId ? { ...x, repeats: e.target.checked } : x)))}
                  />
                  Repeats
                </label>
                <Button small className="datamodel-icon-btn" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                  ↑
                </Button>
                <Button
                  small
                  className="datamodel-icon-btn"
                  aria-label={`Move ${name} down`}
                  disabled={index === attributes.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                <Button small aria-label={`Remove ${name}`} onClick={() => dispatch({ type: 'removeAttribute', entityId: entity.id, dataId: a.dataId })}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="field-hint">
        Tick the asterisk for the attributes that make up the identifier. They are drawn first, with an asterisk. Tick "Repeats" for an
        attribute that can hold several values for one {entity.name || 'entity'}. It is drawn in braces, such as {'{Phone}'}.
      </div>
      {inherited.length > 0 && (
        <div className="field-hint">
          Inherited from a parent, as part of the identifier:{' '}
          {inherited.map((dataId, i) => (
            <span key={dataId}>
              {i > 0 && ', '}
              <Link to={`/dictionary/${dataId}`}>{model.elements[dataId]?.name}</Link>
            </span>
          ))}
          .
        </div>
      )}
      <div className="field">
        <label className="field-label" htmlFor={listId + '-input'}>
          Add an attribute
        </label>
        <div className="hstack">
          <input
            id={listId + '-input'}
            className="input grow"
            list={listId}
            value={newName}
            placeholder="Attribute name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <Button onClick={add} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
        <datalist id={listId}>
          {unowned.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
        <div className="field-hint">
          Pick a data element that no entity owns yet, or type a new name. A new name is added to the data dictionary.
        </div>
      </div>

      {attributes.length > 0 && (
        <div>
          <div className="table-caption">Dictionary entry</div>
          <table className="table datamodel-dict">
            <thead>
              <tr>
                <th scope="col">Attribute</th>
                <th scope="col">Type</th>
                <th scope="col">Length</th>
                <th scope="col">Null</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((a) => {
                const element = get(model, a.dataId, 'dataElement');
                return (
                  <tr key={a.dataId}>
                    <td>
                      <Link to={`/dictionary/${a.dataId}`}>{element?.name ?? ''}</Link>
                    </td>
                    <td>{element?.dataType || <Missing>Not set</Missing>}</td>
                    <td>{element?.length ?? <Missing>Not set</Missing>}</td>
                    <td>{element?.nullable == null ? <Missing>Not set</Missing> : element.nullable ? 'Yes' : 'No'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="field-hint">
            "Null" says whether the attribute may be left empty. To change a type, a length or "null", open the attribute's entry in the data
            dictionary by its name.
          </div>
        </div>
      )}

      <EntryFields elementId={entity.id} compact />

      <DeleteControl
        question={
          relationshipCount > 0
            ? `Delete '${entity.name}'? Its ${relationshipCount === 1 ? 'relationship is' : `${relationshipCount} relationships are`} deleted too. Its attributes stay in the data dictionary.`
            : `Delete '${entity.name}'? Its attributes stay in the data dictionary.`
        }
        onDelete={() => {
          const result = dispatch({ type: 'deleteElement', id: entity.id });
          if (result.ok) clearSelection();
        }}
      />
    </>
  );
}

// ---- A relationship ----

/**
 * How many of an entity there can be, in words: what goes before the entity's name,
 * whether the name is then plural, and what is still not decided.
 */
function amount(end: RelationshipEnd): { words: string; many: boolean; undecided: string } {
  const { min, max } = end;
  if (min === null && max === null)
    return { words: 'an undecided number of', many: true, undecided: 'Neither the least nor the most is decided yet.' };
  if (max === null)
    return { words: min === 0 ? 'at least zero' : 'at least one', many: min === 0, undecided: 'The most (one or many) is not decided yet.' };
  if (min === null)
    return { words: max === 'many' ? 'many' : 'at most one', many: max === 'many', undecided: 'The least (zero or one) is not decided yet.' };
  if (max === 'many') return { words: min === 0 ? 'zero or many' : 'one or many', many: true, undecided: '' };
  return { words: min === 0 ? 'zero or one' : 'exactly one', many: false, undecided: '' };
}

/** One direction of a relationship: the sentence, and the three values that make it. */
function Direction({ model, rel, from }: { model: Model; rel: Relationship; from: 0 | 1 }) {
  const to = from === 0 ? 1 : 0;
  const fromEnd = rel.ends[from];
  const toEnd = rel.ends[to];
  const fromName = get(model, fromEnd.entityId, 'entity')?.name || 'entity';
  const toName = get(model, toEnd.entityId, 'entity')?.name || 'entity';
  const minId = useId();
  const maxId = useId();

  const change = (index: 0 | 1, patch: Partial<RelationshipEnd>) => {
    const ends: [RelationshipEnd, RelationshipEnd] = [{ ...rel.ends[0] }, { ...rel.ends[1] }];
    ends[index] = { ...ends[index], ...patch };
    // A relationship with no parent cannot be identifying, so a change that takes the
    // parent away turns "Identifying" off in the same step. Otherwise it would be refused.
    const losesParent = rel.identifying && parentEnd({ ...rel, ends }) === null;
    dispatch({ type: 'updateRelationship', id: rel.id, ends, ...(losesParent ? { identifying: false } : {}) });
  };
  const said = amount(toEnd);

  return (
    <div className="vstack">
      <h3 className="panel-subheading">
        From {fromName} to {toName}
      </h3>
      <div className="datamodel-sentence">
        One {fromName} {fromEnd.verbPhrase || <Missing>verb phrase</Missing>} {said.words} {said.many ? plural(toName) : toName}.
        {said.undecided && <div className="datamodel-sentence-open">{said.undecided}</div>}
      </div>
      <DraftField
        label={`Verb phrase, read from ${fromName}`}
        value={fromEnd.verbPhrase}
        placeholder="No verb phrase yet"
        onSave={(verbPhrase) => change(from, { verbPhrase: verbPhrase.trim() })}
      />
      <div className="datamodel-pair">
        <div className="field">
          <label className="field-label" htmlFor={minId}>
            {plural(toName)}, at least
          </label>
          <select
            id={minId}
            className="input"
            value={toEnd.min ?? ''}
            onChange={(e) => change(to, { min: e.target.value === '' ? null : e.target.value === '0' ? 0 : 1 })}
          >
            <option value="">Not decided yet</option>
            <option value={0}>Zero</option>
            <option value={1}>One</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={maxId}>
            {plural(toName)}, at most
          </label>
          <select
            id={maxId}
            className="input"
            value={toEnd.max ?? ''}
            onChange={(e) => change(to, { max: e.target.value === '' ? null : e.target.value === 'many' ? 'many' : 'one' })}
          >
            <option value="">Not decided yet</option>
            <option value="one">One</option>
            <option value="many">Many</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function RelationshipDetails({ model, rel }: { model: Model; rel: Relationship }) {
  const names = rel.ends.map((e) => get(model, e.entityId, 'entity')?.name || 'entity');
  const parent = parentEnd(rel);
  const maxOpen = rel.ends.some((e) => e.max === null);
  return (
    <>
      <div>
        <div className="datamodel-kind">Relationship</div>
        <h2 className="panel-heading">
          {names[0]} and {names[1]}
        </h2>
      </div>
      <Direction model={model} rel={rel} from={0} />
      <hr className="datamodel-divider" />
      <Direction model={model} rel={rel} from={1} />
      <hr className="datamodel-divider" />
      <div className="muted">
        {parent !== null
          ? `${names[parent]} is the parent and ${names[parent === 0 ? 1 : 0]} is the child.`
          : maxOpen
            ? 'The parent is not known yet. It is worked out once "at most" is chosen in both directions.'
            : 'Both ends are "many", so this relationship has no parent.'}
      </div>
      <label className={`datamodel-check${parent === null ? ' datamodel-check-off' : ''}`}>
        <input
          type="checkbox"
          checked={rel.identifying}
          disabled={parent === null}
          onChange={(e) => dispatch({ type: 'updateRelationship', id: rel.id, identifying: e.target.checked })}
        />
        Identifying
      </label>
      {parent === null && (
        <div className="field-hint">
          {maxOpen
            ? 'Not available yet. Choose "at most" in both directions first, so that the parent is known.'
            : 'Not available, because a relationship with no parent cannot be identifying.'}
        </div>
      )}
      <div className="field-hint">
        Tick this when the child cannot be identified without its parent. The parent's identifier then becomes part of the child's, and the
        child is drawn with a double border.
      </div>
      <hr className="datamodel-divider" />
      <EntryFields elementId={rel.id} compact />
      <DeleteControl
        question={`Delete the relationship between '${names[0]}' and '${names[1]}'?`}
        onDelete={() => {
          const result = dispatch({ type: 'deleteElement', id: rel.id });
          if (result.ok) clearSelection();
        }}
      />
    </>
  );
}

// ---- The panel ----

export function DetailsPanel() {
  const model = useModel();
  const selection = useSelection();
  const selected = selection.elementIds.map((id) => model.elements[id]).find((e) => e?.kind === 'entity' || e?.kind === 'relationship');

  // A selection of something that no longer exists, such as after an undo, is cleared.
  useEffect(() => {
    if (selection.elementIds.length > 0 && selection.elementIds.every((id) => !model.elements[id])) clearSelection();
  }, [model, selection.elementIds]);

  if (selected?.kind === 'entity') return <EntityDetails key={selected.id} model={model} entity={selected} />;
  if (selected?.kind === 'relationship') return <RelationshipDetails key={selected.id} model={model} rel={selected} />;
  return (
    <>
      <h2 className="panel-heading">Details</h2>
      <div className="muted">Select an entity or a relationship on the diagram to see and change its details.</div>
    </>
  );
}
