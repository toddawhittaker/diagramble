// The small form at the top of the canvas that a tool opens: name a new module, choose a
// library module, describe a new couple, or confirm a removal. Each form ends in one
// dispatch, so each is one undo step.

import { useState } from 'react';
import { all, chartOfModule, couplesOf, get, moduleChildren, originalModule, type Couple, type Id, type Model, type Module } from '../../model';
import { clearSelection, dispatch, selectElements } from '../../store';
import { Button, Switch } from '../../components';
import { DataPicker, moduleLabel, type DataChoice } from './shared';

export type Box = null | 'module' | 'library' | 'couple' | 'remove';

export interface AddBoxProps {
  model: Model;
  box: Exclude<Box, null>;
  /** The selected module, or the lower module of the selected couple's line. */
  module: Module | undefined;
  /** The selected couple, if one is selected. */
  couple: Couple | undefined;
  onClose: () => void;
}

/** How many modules sit below a module, at every level. */
function countBelow(model: Model, moduleId: Id): number {
  return moduleChildren(model, moduleId).reduce((n, c) => n + 1 + countBelow(model, c.id), 0);
}

function NewModule({ model, parent, library, onClose }: { model: Model; parent: Module; library: boolean; onClose: () => void }) {
  const [how, setHow] = useState<'new' | 'again'>('new');
  const [name, setName] = useState('');
  const [repeatsId, setRepeatsId] = useState('');
  // A box can repeat any module that is not itself a repeat and not the top of a chart.
  const candidates = all(model, 'module')
    .filter((m) => !m.repeatsId && m.parentModuleId !== null && m.id !== parent.id)
    .sort((a, b) => Number(b.library) - Number(a.library));
  const again = library && how === 'again';
  const ready = again ? repeatsId !== '' : name.trim() !== '';

  const add = () => {
    if (!ready) return;
    const result = again
      ? dispatch({ type: 'addModule', parentModuleId: parent.id, name: get(model, repeatsId, 'module')?.name ?? '', repeatsId })
      : dispatch({ type: 'addModule', parentModuleId: parent.id, name: name.trim(), library });
    // The control module stays selected and the form stays open, so the next one can be typed at once.
    if (result.ok) {
      setName('');
      setRepeatsId('');
    }
  };

  return (
    <>
      <div className="structure-addbox-title">
        {library ? 'Add a library module' : 'Add a module'} below {moduleLabel(model, parent.id)}
      </div>
      {library && (
        <Switch
          small
          label="New or existing"
          value={how}
          onChange={setHow}
          options={[
            { value: 'new', label: 'A new library module' },
            { value: 'again', label: 'One already drawn' },
          ]}
        />
      )}
      {again ? (
        candidates.length === 0 ? (
          <div className="muted">There is no other module to draw again yet.</div>
        ) : (
          <select className="input" aria-label="The module to draw again" value={repeatsId} onChange={(e) => setRepeatsId(e.target.value)}>
            <option value="">Choose the module to draw again…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {chartOfModule(model, m.id)?.name ?? ''}: {moduleLabel(model, m.id)}
                {m.library ? ' (library)' : ''}
              </option>
            ))}
          </select>
        )
      ) : (
        <input
          className="input"
          aria-label="Name of the new module"
          placeholder="Module name, such as Calculate Total"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
            if (e.key === 'Escape') onClose();
          }}
        />
      )}
      {again && <div className="muted">The new box takes its name and its program specification from the module it repeats.</div>}
      <div className="hstack">
        <Button small variant="primary" disabled={!ready} onClick={add}>
          Add
        </Button>
        <Button small onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}

function NewCouple({ model, module, onClose }: { model: Model; module: Module; onClose: () => void }) {
  const [coupleKind, setCoupleKind] = useState<'data' | 'control'>('data');
  const [direction, setDirection] = useState<'down' | 'up'>('down');
  const [data, setData] = useState<DataChoice>(null);
  const [name, setName] = useState('');
  const parentName = originalModule(model, module.parentModuleId ?? '')?.name || 'the module above';
  const ownName = originalModule(model, module.id)?.name || 'this module';
  const ready = coupleKind === 'data' ? data !== null : name.trim() !== '';

  const add = () => {
    if (!ready) return;
    const result =
      coupleKind === 'data' && data
        ? dispatch({ type: 'addCouple', moduleId: module.id, direction, coupleKind: 'data', ...data })
        : dispatch({ type: 'addCouple', moduleId: module.id, direction, coupleKind: 'control', name: name.trim() });
    if (result.ok) {
      selectElements([result.created[0]]);
      onClose();
    }
  };

  return (
    <>
      <div className="structure-addbox-title">Add a couple to the line above {moduleLabel(model, module.id)}</div>
      <Switch
        small
        label="Kind of couple"
        value={coupleKind}
        onChange={setCoupleKind}
        options={[
          { value: 'data', label: 'Data couple' },
          { value: 'control', label: 'Control couple (flag)' },
        ]}
      />
      <Switch
        small
        label="Direction"
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'down', label: 'Passed down' },
          { value: 'up', label: 'Passed up' },
        ]}
      />
      <div className="muted">{direction === 'down' ? `From ${parentName} down to ${ownName}.` : `From ${ownName} up to ${parentName}.`}</div>
      {coupleKind === 'data' ? (
        <DataPicker model={model} value={data && 'dataId' in data ? data.dataId : null} onChoose={setData} live />
      ) : (
        <input
          className="input"
          aria-label="Name of the flag"
          placeholder="Name of the flag, such as End of file"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
      )}
      <div className="hstack">
        <Button small variant="primary" disabled={!ready} onClick={add}>
          Add
        </Button>
        <Button small onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function Remove({ model, module, couple, onClose }: { model: Model; module: Module | undefined; couple: Couple | undefined; onClose: () => void }) {
  const target = couple ?? module;
  if (!target) return null;
  let question: string;
  if (couple) {
    question = 'Remove this couple from the line?';
  } else if (module) {
    const below = countBelow(model, module.id);
    const repeats = all(model, 'module').filter((m) => m.repeatsId === module.id).length;
    const lines = couplesOf(model, module.id).length;
    const extras = [
      below > 0 ? `the ${below} ${below === 1 ? 'module' : 'modules'} below it` : '',
      repeats > 0 ? `the ${repeats} ${repeats === 1 ? 'box that repeats' : 'boxes that repeat'} it` : '',
      lines > 0 ? `the ${lines} ${lines === 1 ? 'couple' : 'couples'} on its line` : '',
    ].filter(Boolean);
    question = `Remove ${moduleLabel(model, module.id)}${extras.length ? `, with ${extras.join(' and ')}` : ''}?`;
  } else {
    return null;
  }
  const remove = () => {
    const back = couple ? couple.moduleId : (module?.parentModuleId ?? null);
    const result = dispatch({ type: 'deleteElement', id: target.id });
    if (result.ok) {
      if (back) selectElements([back]);
      else clearSelection();
    }
    onClose();
  };
  return (
    <>
      <div className="structure-addbox-title">{question}</div>
      <div className="muted">Undo brings it back.</div>
      <div className="hstack">
        <Button small variant="primary" onClick={remove}>
          Remove
        </Button>
        <Button small onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  );
}

export function AddBox({ model, box, module, couple, onClose }: AddBoxProps) {
  let content = null;
  if (box === 'remove') content = <Remove model={model} module={couple ? undefined : module} couple={couple} onClose={onClose} />;
  else if (!module) content = null;
  else if (box === 'couple') content = <NewCouple key={module.id} model={model} module={module} onClose={onClose} />;
  else content = <NewModule key={`${module.id}-${box}`} model={model} parent={module} library={box === 'library'} onClose={onClose} />;
  if (!content) return null;
  return (
    <div className="structure-addbox vstack" role="group" aria-label="Tool">
      {content}
    </div>
  );
}
