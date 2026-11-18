// The physical part of the right panel on the entity relationship diagram: the fields of
// a table, the copies kept for speed, and the placing of foreign keys.
// It follows docs/SPEC.md section 11.5.

import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { all, entityOfAttribute, fullIdentifier, get, parentEnd, tableFields, type DataElement, type Entity, type Id, type Model, type Relationship, type TableField } from '../../model';
import { dispatch, selectElements, useSelection } from '../../store';
import { Button, Missing, NumberField, SelectField } from '../../components';
import { DATA_TYPES, DraftField, tableLabel, typeAndLength } from './shared';

/** A one-line text box with suggestions. It saves when it loses focus or on Enter, if the text changed. */
function SuggestField({ label, value, options, placeholder, onSave }: { label: string; value: string; options: string[]; placeholder?: string; onSave: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        list={id + '-list'}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      <datalist id={id + '-list'}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

type NullChoice = '' | 'yes' | 'no';

/** The physical details of one field: every one is saved when its box loses focus. */
function FieldEditor({ element }: { element: DataElement }) {
  return (
    <div className="datamodel-field-editor vstack">
      <div className="field-hint">
        The field for the attribute <Link to={`/dictionary/${element.id}`}>{element.name}</Link>.
      </div>
      <DraftField
        label="Field name"
        value={element.fieldName}
        placeholder="No field name yet"
        onSave={(fieldName) => dispatch({ type: 'setPhysical', id: element.id, fieldName: fieldName.trim() })}
      />
      <div className="datamodel-pair">
        <SuggestField
          label="Data type"
          value={element.dataType}
          options={DATA_TYPES}
          placeholder="No type yet"
          onSave={(dataType) => dispatch({ type: 'setDataType', dataId: element.id, dataType })}
        />
        <NumberField label="Length" value={element.length} size={6} onCommit={(length) => dispatch({ type: 'setDataDetails', dataId: element.id, length })} />
      </div>
      <div className="datamodel-pair">
        <SelectField<NullChoice>
          label="Null"
          value={element.nullable === null ? '' : element.nullable ? 'yes' : 'no'}
          options={[
            { value: '', label: 'Not set' },
            { value: 'yes', label: 'Yes, may be empty' },
            { value: 'no', label: 'No, always filled' },
          ]}
          onChange={(v) => dispatch({ type: 'setDataDetails', dataId: element.id, nullable: v === '' ? null : v === 'yes' })}
        />
        <DraftField
          label="Default value"
          value={element.defaultValue}
          placeholder="No default"
          onSave={(defaultValue) => dispatch({ type: 'setPhysical', id: element.id, defaultValue })}
        />
      </div>
      <label className="datamodel-check">
        <input
          type="checkbox"
          checked={element.systemRelated}
          onChange={(e) => dispatch({ type: 'setPhysical', id: element.id, systemRelated: e.target.checked })}
        />
        System-related
      </label>
      <div className="field-hint">
        Tick this for a field that exists only for the way the system is built, such as a generated key or the date a row was last changed. It
        is then left out of the logical model. The allowed values are on the dictionary entry, and the average width is on the{' '}
        <Link to="/storage">storage size estimate</Link>.
      </div>
    </div>
  );
}

/** The fields of a table: its own, the foreign keys placed in it, and its copies. */
export function TableFields({ model, entity }: { model: Model; entity: Entity }) {
  const selection = useSelection();
  const copyId = useId();
  const fields = tableFields(model, entity.id);
  const [open, setOpen] = useState<Id | null>(null);
  const [copy, setCopy] = useState('');

  // A problem that names a field of this table opens that field.
  useEffect(() => {
    const named = entity.attributes.find((a) => selection.elementIds.includes(a.dataId));
    if (named) setOpen(named.dataId);
    // Only a new selection should open a field, not every change to the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.elementIds]);

  const shownIds = new Set(fields.map((f) => f.dataId));
  const canCopy = all(model, 'dataElement').filter((d) => {
    const owner = entityOfAttribute(model, d.id);
    return owner && owner.id !== entity.id && !shownIds.has(d.id);
  });
  const fromName = (f: TableField) => tableLabel(f.fromEntityId ? get(model, f.fromEntityId, 'entity') : undefined);

  return (
    <div className="vstack">
      <h3 className="panel-subheading">Fields of the table</h3>
      {fields.length === 0 ? (
        <div>
          <Missing>No fields yet</Missing>
        </div>
      ) : (
        <ul className="datamodel-attrs">
          {fields.map((f, index) => {
            const own = !f.fk && !f.copy;
            const isOpen = own && open === f.dataId;
            const tags = [f.pk && 'PK', f.fk && 'FK'].filter(Boolean).join(' ');
            const nullWord = f.element.nullable === null ? '' : f.element.nullable ? 'null' : 'not null';
            return (
              <li key={`${f.dataId}:${index}`} className="datamodel-prow">
                <div className="datamodel-prow-line">
                  <span className="datamodel-field-tags">{tags}</span>
                  <span className="datamodel-prow-name">
                    <span className="mono">{f.element.fieldName.trim() ? f.name : <Missing>{f.element.name}</Missing>}</span>
                    <span className="datamodel-prow-about">
                      {[typeAndLength(f.element) || 'no type', nullWord, f.element.defaultValue && `default ${f.element.defaultValue}`, f.element.systemRelated && 'system-related']
                        .filter(Boolean)
                        .join(', ')}
                      {f.fk && `. Foreign key from ${fromName(f)}`}
                      {f.copy && `. Copy from ${fromName(f)}`}
                    </span>
                  </span>
                  {own && (
                    <Button small aria-expanded={isOpen} aria-label={`${isOpen ? 'Close' : 'Edit'} the field ${f.name}`} onClick={() => setOpen(isOpen ? null : f.dataId)}>
                      {isOpen ? 'Close' : 'Edit'}
                    </Button>
                  )}
                  {f.copy && (
                    <Button
                      small
                      aria-label={`Remove the copy of ${f.name}`}
                      onClick={() => dispatch({ type: 'setPhysical', id: entity.id, copies: entity.copies.filter((id) => id !== f.dataId) })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {isOpen && <FieldEditor element={f.element} />}
              </li>
            );
          })}
        </ul>
      )}
      <div className="field-hint">
        PK marks a primary key field: an attribute ticked as part of the identifier above. FK marks a foreign key field. A foreign key is not
        typed here. Select the relationship and place it there. A field with no field name yet shows its attribute's name underlined.
      </div>

      <div className="field">
        <label className="field-label" htmlFor={copyId}>
          Add a copy kept for speed
        </label>
        <div className="hstack">
          <select id={copyId} className="input grow" value={copy} onChange={(e) => setCopy(e.target.value)}>
            <option value="">{canCopy.length > 0 ? 'Choose a field of another table' : 'No other table has fields'}</option>
            {canCopy.map((d) => (
              <option key={d.id} value={d.id}>
                {tableLabel(entityOfAttribute(model, d.id))}: {d.fieldName.trim() || d.name}
              </option>
            ))}
          </select>
          <Button
            disabled={!copy}
            onClick={() => {
              const result = dispatch({ type: 'setPhysical', id: entity.id, copies: [...entity.copies, copy] });
              if (result.ok) setCopy('');
            }}
          >
            Add
          </Button>
        </div>
        <div className="field-hint">
          A copy repeats a field of another table in this one, so that it can be read without joining the two tables. Nothing checks a copy:
          when to make one is a judgment.
        </div>
      </div>
    </div>
  );
}

/** What is known about the foreign key of one relationship. */
function keyFacts(model: Model, rel: Relationship) {
  const p = parentEnd(rel);
  if (p === null) return null;
  const parent = get(model, rel.ends[p].entityId, 'entity');
  const child = get(model, rel.ends[p === 0 ? 1 : 0].entityId, 'entity');
  const keys = parent ? fullIdentifier(model, parent.id).map((id) => get(model, id, 'dataElement')).filter((e): e is DataElement => !!e) : [];
  return { parent, child, keys, keyNames: keys.map((e) => e.fieldName.trim() || e.name).join(', ') };
}

/** Placing the foreign key of one relationship. The student does it: the tool never does it alone. */
export function ForeignKeyControl({ model, rel }: { model: Model; rel: Relationship }) {
  const facts = keyFacts(model, rel);
  const undecided = rel.ends.some((e) => e.max === null);
  if (!facts)
    return (
      <div className="vstack">
        <h3 className="panel-subheading">Foreign key</h3>
        <div className="muted">
          {undecided
            ? 'Not available yet. A foreign key goes in the child table, and the child is known only once "at most" is chosen in both directions.'
            : 'A many-to-many relationship cannot have a foreign key, because neither table is the child. Put a table between the two, with a relationship to each.'}
        </div>
      </div>
    );
  const parentName = tableLabel(facts.parent);
  const childName = tableLabel(facts.child);
  const several = facts.keys.length > 1;
  return (
    <div className="vstack">
      <h3 className="panel-subheading">Foreign key</h3>
      <div>
        <span className="mono">{childName}</span> is the child table, so the foreign key goes there. It is made of the primary key of{' '}
        <span className="mono">{parentName}</span>
        {facts.keys.length > 0 ? (
          <>
            : <span className="mono">{facts.keyNames}</span>.
          </>
        ) : (
          '.'
        )}
      </div>
      {rel.foreignKey ? (
        <>
          <div className="datamodel-fk-state">
            Placed. <span className="mono">{childName}</span> now shows {facts.keys.length === 0 ? 'no field for it yet' : <span className="mono">{facts.keyNames}</span>}
            {facts.keys.length > 0 && `, tagged ${rel.identifying ? 'PK and FK, because the relationship is identifying' : 'FK'}`}.
          </div>
          {facts.keys.length === 0 && (
            <div className="field-hint">
              {parentName} has no primary key yet. When it has one, its {several ? 'fields appear' : 'field appears'} in {childName}.
            </div>
          )}
          <div>
            <Button small onClick={() => dispatch({ type: 'setPhysical', id: rel.id, foreignKey: false })}>
              Take the foreign key out of {childName}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="datamodel-fk-state">
            <Missing>No foreign key placed yet</Missing>
          </div>
          <div>
            <Button variant="primary" disabled={facts.keys.length === 0} onClick={() => dispatch({ type: 'setPhysical', id: rel.id, foreignKey: true })}>
              Add {parentName}'s key {several ? 'fields' : 'field'} to {childName} as a foreign key
            </Button>
          </div>
          <div className="field-hint">
            {facts.keys.length === 0
              ? `${parentName} has no primary key yet, so there is nothing to add. Tick an attribute of ${facts.parent?.name || 'the parent'} as part of its identifier first.`
              : 'Placing the foreign key is your step. The tool does not add it on its own.'}
          </div>
        </>
      )}
    </div>
  );
}

/** Every relationship with the state of its foreign key, shown while nothing is selected. */
export function ForeignKeyOverview({ model }: { model: Model }) {
  const relationships = all(model, 'relationship');
  if (relationships.length === 0) return null;
  const waiting = relationships.filter((r) => parentEnd(r) !== null && !r.foreignKey).length;
  return (
    <div className="vstack">
      <h3 className="panel-subheading">Foreign keys</h3>
      <div>
        {waiting === 0
          ? 'No relationship is waiting for a foreign key.'
          : `${waiting} of ${relationships.length} ${relationships.length === 1 ? 'relationship' : 'relationships'} still ${waiting === 1 ? 'has' : 'have'} no foreign key.`}{' '}
        Select a relationship to place its key.
      </div>
      <div className="datamodel-fk-list">
        {relationships.map((rel) => {
          const facts = keyFacts(model, rel);
          const names = rel.ends.map((e) => tableLabel(get(model, e.entityId, 'entity')));
          return (
            <button key={rel.id} type="button" className="row datamodel-fk-row" onClick={() => selectElements([rel.id])}>
              <span className="mono">{facts ? `${tableLabel(facts.parent)} to ${tableLabel(facts.child)}` : `${names[0]} and ${names[1]}`}</span>
              <span className="datamodel-fk-status">
                {!facts ? (
                  rel.ends.some((e) => e.max === null) ? (
                    'Child not known yet'
                  ) : (
                    'Many-to-many: cannot have one'
                  )
                ) : rel.foreignKey ? (
                  `Placed in ${tableLabel(facts.child)}`
                ) : (
                  <Missing>No foreign key yet</Missing>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
