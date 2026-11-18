// The one place the app's state lives: the model, its findings, undo and redo,
// saving to localStorage, and the shared selection.

import { useMemo, useSyncExternalStore } from 'react';
import { apply } from '../model/apply';
import type { ApplyResult, Command } from '../model/commands';
import { asStarter, normalizeModel } from '../model/normalize';
import { modelForMode } from '../model/queries2';
import type { Id, Mode, Model } from '../model/types';
import { countFindings, runRules, type Counts, type Finding, type FindingArea } from '../rules/engine';
import { sampleModel } from '../sample/clinic';
import { starterById } from '../sample/starters';

const STORAGE_KEY = 'diagramble.prototype.project.v2';
const HISTORY_LIMIT = 200;

interface ProjectState {
  model: Model;
  /** Whether the model is being shown as the logical or the physical model (SPEC 11.1). Session state: it is not saved. */
  mode: Mode;
  /** Always worked out, for the current mode, whether or not they are shown. */
  findings: Finding[];
  /** False while the setting `showFindings` is 'onRequest' and the student has not asked since the last change. */
  findingsVisible: boolean;
  past: Model[];
  future: Model[];
  /** When the project was last saved, in milliseconds since 1970. null if saving failed. */
  savedAt: number | null;
  /** The reason the last command was refused, or null. */
  lastError: string | null;
}

export interface Selection {
  /** The selected elements. Flows and nodes are element ids, not occurrence ids. */
  elementIds: Id[];
  /** The selected finding's `id`, or null. */
  findingId: string | null;
}

function load(): { model: Model; savedAt: number | null } | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { model: unknown; savedAt: number };
    return { model: normalizeModel(parsed.model), savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function save(model: Model): number | null {
  try {
    const savedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

function initial(): ProjectState {
  const stored = load();
  const model = stored?.model ?? sampleModel();
  return {
    model,
    mode: 'logical',
    findings: runRules(model, 'logical'),
    findingsVisible: model.settings.showFindings === 'always',
    past: [],
    future: [],
    savedAt: stored?.savedAt ?? save(model),
    lastError: null,
  };
}

let project: ProjectState = initial();
let selection: Selection = { elementIds: [], findingId: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const NO_FINDINGS: Finding[] = [];

/** The findings the student may see now: all of them, or none while they are held back. */
function shown(state: ProjectState): Finding[] {
  return state.findingsVisible ? state.findings : NO_FINDINGS;
}

/** Any change to the model hides the findings again when they are shown only on request. */
function setModel(model: Model, past: Model[], future: Model[]): void {
  const mode = project.mode;
  const findings = runRules(model, mode);
  const findingsVisible = model.settings.showFindings === 'always';
  project = { model, mode, findings, findingsVisible, past, future, savedAt: save(model), lastError: null };
  // Drop a selection that no longer points at anything.
  const elementIds = selection.elementIds.filter((id) => model.elements[id]);
  const findingId = shown(project).some((f) => f.id === selection.findingId) ? selection.findingId : null;
  if (elementIds.length !== selection.elementIds.length || findingId !== selection.findingId)
    selection = { elementIds, findingId };
  emit();
}

// ---- Actions. They can be called from anywhere, inside or outside React. ----

/**
 * Applies a command to the model. On success the findings are recomputed, the project is
 * saved and the step can be undone. On refusal nothing changes and the reason is returned.
 */
export function dispatch(command: Command): ApplyResult {
  const result = apply(project.model, command);
  if (result.ok) {
    setModel(result.model, [...project.past, project.model].slice(-HISTORY_LIMIT), []);
  } else {
    project = { ...project, lastError: result.error };
    emit();
  }
  return result;
}

export function undo(): void {
  const previous = project.past[project.past.length - 1];
  if (!previous) return;
  setModel(previous, project.past.slice(0, -1), [project.model, ...project.future]);
}

export function redo(): void {
  const next = project.future[0];
  if (!next) return;
  setModel(next, [...project.past, project.model], project.future.slice(1));
}

/** Throws away the saved project and starts again from the sample data. This cannot be undone. */
export function resetToSample(): void {
  selection = { elementIds: [], findingId: null };
  setModel(sampleModel(), [], []);
}

/** Shows the findings when they are held back. They are hidden again by the next change to the model. */
export function checkNow(): void {
  if (project.findingsVisible) return;
  project = { ...project, findingsVisible: true };
  emit();
}

/**
 * Shows the model as the logical or the physical model. The findings are worked out again
 * for that mode. The findings stay shown or hidden as they were, because the model has not changed.
 */
export function setMode(mode: Mode): void {
  if (mode === project.mode) return;
  project = { ...project, mode, findings: runRules(project.model, mode) };
  if (!shown(project).some((f) => f.id === selection.findingId)) selection = { ...selection, findingId: null };
  emit();
}

/** The current mode, for code outside a component. Inside one use `useMode`. */
export function getMode(): Mode {
  return project.mode;
}

/** Replaces the project with a fresh copy of a starter case and clears the history. False if there is no such starter. */
export function loadStarter(id: string): boolean {
  const starter = starterById(id);
  if (!starter) return false;
  selection = { elementIds: [], findingId: null };
  setModel(starter.build(), [], []);
  return true;
}

/**
 * Replaces the project with the one in a downloaded project file and clears the history.
 * When the text is not a project file, nothing changes and `error` says why in plain words.
 */
export function loadProjectFile(text: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not a Diagramble project. It could not be read.' };
  }
  let model: Model;
  try {
    model = normalizeModel(parsed);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'This file is not a Diagramble project.' };
  }
  selection = { elementIds: [], findingId: null };
  setModel(model, [], []);
  return { ok: true };
}

/** The current project as the text of a project file, with every origin set to 'starter' (SPEC 3.8). */
export function projectAsStarterFile(): string {
  return JSON.stringify(asStarter(project.model), null, 2);
}

export function clearError(): void {
  if (project.lastError === null) return;
  project = { ...project, lastError: null };
  emit();
}

/** Selects elements. Also selects the first finding that names the first of them, if there is one. */
export function selectElements(elementIds: Id[]): void {
  const first = elementIds[0];
  const finding = first ? shown(project).find((f) => f.elementIds.includes(first)) : undefined;
  selection = { elementIds, findingId: finding?.id ?? null };
  emit();
}

/** Selects a finding, and with it the elements the finding names. Pass null to clear. */
export function selectFinding(findingId: string | null): void {
  const finding = shown(project).find((f) => f.id === findingId);
  selection = { elementIds: finding ? finding.elementIds : [], findingId: finding ? finding.id : null };
  emit();
}

export function clearSelection(): void {
  selection = { elementIds: [], findingId: null };
  emit();
}

/** The current model, for code outside React. Inside a component use `useModel`. */
export function getModel(): Model {
  return project.model;
}

/** Whether the findings are being shown, for code outside a component. Inside one use `useFindingsVisible`. */
export function getFindingsVisible(): boolean {
  return project.findingsVisible;
}

/** Every finding, worked out after each change, whether or not the findings are being shown. */
export function getFindings(): Finding[] {
  return project.findings;
}

// ---- Hooks ----

function useProject<T>(pick: (state: ProjectState) => T): T {
  return useSyncExternalStore(subscribe, () => pick(project));
}

export function useModel(): Model {
  return useProject((s) => s.model);
}

/** 'logical' or 'physical': how the model is being shown. Change it with `setMode`. */
export function useMode(): Mode {
  return useProject((s) => s.mode);
}

/**
 * The model as the current mode shows it. In physical mode it is the model. In logical
 * mode everything marked `systemRelated` is left out. Draw and list from this, and keep
 * `useModel` for anything that must see the whole model.
 */
export function useViewModel(): Model {
  return useProject((s) => modelForMode(s.model, s.mode));
}

/** Every finding in the project, recomputed after each change. Errors come first. Empty while the findings are hidden. */
export function useFindings(): Finding[] {
  return useProject(shown);
}

/** False while the findings are held back until the student asks (the setting `showFindings` is 'onRequest'). */
export function useFindingsVisible(): boolean {
  return useProject((s) => s.findingsVisible);
}

/** The findings that belong to one diagram. */
export function useDiagramFindings(diagramId: Id | undefined): Finding[] {
  const findings = useFindings();
  return useMemo(() => findings.filter((f) => f.diagramId === diagramId), [findings, diagramId]);
}

/** The findings counted in one area, such as 'feasibility' or 'testPlan'. */
export function useAreaFindings(area: FindingArea): Finding[] {
  const findings = useFindings();
  return useMemo(() => findings.filter((f) => f.area === area), [findings, area]);
}

/** The findings that belong to one matrix, interface structure diagram, structure chart or test. */
export function useHomeFindings(homeId: Id | undefined): Finding[] {
  const findings = useFindings();
  return useMemo(() => (homeId ? findings.filter((f) => f.homeId === homeId) : []), [findings, homeId]);
}

/** The findings that name one element. */
export function useElementFindings(elementId: Id | undefined): Finding[] {
  const findings = useFindings();
  return useMemo(() => (elementId ? findings.filter((f) => f.elementIds.includes(elementId)) : []), [findings, elementId]);
}

/** The number of errors and warnings in the whole project. */
export function useCounts(): Counts {
  const findings = useFindings();
  return useMemo(() => countFindings(findings), [findings]);
}

export function useHistory(): { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void } {
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  return { canUndo, canRedo, undo, redo };
}

/** When the project was last saved, or null if the browser would not save it. */
export function useSavedAt(): Date | null {
  const savedAt = useProject((s) => s.savedAt);
  return useMemo(() => (savedAt === null ? null : new Date(savedAt)), [savedAt]);
}

/** The reason the last command was refused, or null. Cleared by the next command that succeeds. */
export function useLastError(): string | null {
  return useProject((s) => s.lastError);
}

export function useSelection(): Selection {
  return useSyncExternalStore(subscribe, () => selection);
}

/** True if the element is selected. */
export function useIsSelected(elementId: Id): boolean {
  return useSyncExternalStore(subscribe, () => selection.elementIds.includes(elementId));
}
