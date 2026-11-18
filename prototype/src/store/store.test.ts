// The store's session state for findings shown on request, and loading a project.

import { describe, expect, it } from 'vitest';
import { all } from '../model/queries';
import {
  checkNow,
  dispatch,
  getFindings,
  getFindingsVisible,
  getModel,
  loadProjectFile,
  loadStarter,
  projectAsStarterFile,
  resetToSample,
  undo,
} from './store';

describe('Findings on request', () => {
  it('are hidden until asked for, and hidden again by the next change', () => {
    expect(loadStarter('find-the-errors')).toBe(true);
    expect(getFindings()).toHaveLength(5);
    expect(getFindingsVisible()).toBe(false);
    checkNow();
    expect(getFindingsVisible()).toBe(true);
    // A refused command changes nothing.
    expect(dispatch({ type: 'rename', id: 'nothing', name: 'x' }).ok).toBe(false);
    expect(getFindingsVisible()).toBe(true);
    expect(dispatch({ type: 'describe', id: 's-tools', description: 'Every tool the library owns.' }).ok).toBe(true);
    expect(getFindingsVisible()).toBe(false);
    expect(getFindings()).toHaveLength(4);
  });

  it('are always shown when the setting says so', () => {
    dispatch({ type: 'setShowFindings', showFindings: 'always' });
    expect(getFindingsVisible()).toBe(true);
    resetToSample();
    expect(getFindingsVisible()).toBe(true);
  });
});

describe('Loading a project', () => {
  it('a starter replaces the project and clears the history', () => {
    resetToSample();
    dispatch({ type: 'rename', id: 'p1', name: 'Changed' });
    expect(loadStarter('no-such-starter')).toBe(false);
    expect(loadStarter('blank')).toBe(true);
    expect(getModel().name).toBe('Untitled project');
    undo();
    expect(getModel().name).toBe('Untitled project');
  });

  it('a project file is opened, and anything else is refused with a plain message', () => {
    resetToSample();
    dispatch({ type: 'addEntity', id: 'en-new', name: 'Invoice' });
    const text = projectAsStarterFile();
    expect(getModel().elements['en-new'].origin).toBe('student');
    loadStarter('blank');
    expect(loadProjectFile(text)).toEqual({ ok: true });
    expect(getModel().name).toBe('Clinic appointments');
    expect(all(getModel(), 'entity').every((e) => e.origin === 'starter')).toBe(true);
    expect(loadProjectFile('not json')).toEqual({ ok: false, error: 'This file is not a Diagramble project. It could not be read.' });
    expect(loadProjectFile('{"a":1}')).toEqual({ ok: false, error: 'This file is not a Diagramble project.' });
    expect(getModel().name).toBe('Clinic appointments');
  });
});
