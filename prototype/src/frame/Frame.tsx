// The frame every screen shares: docs/mockups/BRIEFS.md section 1.1.

import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Button, Switch } from '../components/controls';
import { ModeSwitch } from '../components/forms';
import { Count, FindingMarks, Mark } from '../components/Mark';
import { Wordmark } from '../components/Wordmark';
import { all, dataDefinitions, diagramPath, diagramsInOrder, diagramTitle, isAboveProject } from '../model/queries';
import { binderSections, feasibility, systemRequest } from '../model/queries2';
import type { Id } from '../model/types';
import type { Finding, FindingArea } from '../rules/engine';
import {
  checkNow,
  clearError,
  useCounts,
  useFindings,
  useFindingsVisible,
  useHistory,
  useLastError,
  useModel,
  useSavedAt,
  useViewModel,
} from '../store/store';
import { setTheme, useTheme } from '../theme/theme';

function savedText(savedAt: Date | null): string {
  if (!savedAt) return 'Not saved';
  const time = savedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `Saved ${time}`;
}

/** The bar across the top. It is the same on every screen. */
export function TopBar() {
  const model = useModel();
  const savedAt = useSavedAt();
  const { errors, warnings } = useCounts();
  const visible = useFindingsVisible();
  const theme = useTheme();
  return (
    <header className="topbar">
      <Link className="topbar-product" to="/">
        <Wordmark height={26} />
      </Link>
      <span className="topbar-project">{model.name}</span>
      <span className="grow" />
      <span className="topbar-saved">{savedText(savedAt)}</span>
      <ModeSwitch small />
      <Switch
        small
        label="Colour mode"
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      {visible ? (
        <Link className="topbar-counts" to="/problems" aria-label={`${errors} ${errors === 1 ? 'error' : 'errors'} and ${warnings} ${warnings === 1 ? 'warning' : 'warnings'} in this project`}>
          {errors === 0 && warnings === 0 ? (
            <Mark kind="ok" label="No problems" />
          ) : (
            <>
              <Mark kind="error" count={errors} />
              <Mark kind="warning" count={warnings} />
            </>
          )}
        </Link>
      ) : (
        <span className="topbar-counts">
          <span className="muted">Problems hidden</span>
          <Button small onClick={checkNow}>
            Check now
          </Button>
        </span>
      )}
      <Link className="btn btn-primary" to="/export">
        Export PDF
      </Link>
    </header>
  );
}

function navClass(extra: string) {
  return ({ isActive }: { isActive: boolean }) => `nav-row ${extra}${isActive ? ' is-selected' : ''}`;
}

const NAV_KEY = 'diagramble.prototype.nav.closed';

function loadClosed(): string[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(NAV_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface NavGroupProps {
  id: string;
  title: string;
  closed: string[];
  onToggle: (id: string) => void;
  /** The findings counted anywhere in the group. Their marks are shown on the heading while the group is closed. */
  findings: Finding[];
  children: ReactNode;
}

/** One group of the navigator, such as a phase. Its heading opens and closes it. */
function NavGroup({ id, title, closed, onToggle, findings, children }: NavGroupProps) {
  const open = !closed.includes(id);
  return (
    <div className="nav-section">
      <button type="button" className="nav-group nav-group-toggle" aria-expanded={open} onClick={() => onToggle(id)}>
        <span className="nav-group-arrow" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
        <span className="nav-label">{title}</span>
        {!open && <FindingMarks findings={findings} />}
      </button>
      {open && children}
    </div>
  );
}

/**
 * The sidebar on the left: the parts of the project under the textbook's four phases,
 * then the binder, then the rows for the whole project. The counts are live.
 */
export function Navigator() {
  const model = useModel();
  const view = useViewModel();
  const findings = useFindings();
  const visible = useFindingsVisible();
  const [closed, setClosed] = useState<string[]>(loadClosed);
  const toggle = (id: string) => {
    const next = closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id];
    setClosed(next);
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify(next));
    } catch {
      // The choice is then kept for this visit only.
    }
  };
  const diagrams = diagramsInOrder(view);
  const inArea = (...areas: FindingArea[]) => findings.filter((f) => areas.includes(f.area));
  const group = { closed, onToggle: toggle };
  const sections = binderSections(model);
  const interfaceDiagrams = all(model, 'interfaceDiagram');
  const charts = all(model, 'structureChart');
  const row = (to: string, label: string, marks: ReactNode = null, count: number | null = null, end = false) => (
    <NavLink className={navClass('nav-item')} to={to} end={end}>
      <span className="nav-label">{label}</span>
      {marks}
      {count !== null && <Count n={count} />}
    </NavLink>
  );
  return (
    <nav className="navigator" aria-label="Parts of the project">
      <NavGroup id="planning" title="Planning" findings={inArea('systemRequest', 'feasibility')} {...group}>
        {row('/system-request', 'System request', <FindingMarks findings={inArea('systemRequest')} showOk={!!systemRequest(model)} />)}
        {row('/feasibility', 'Feasibility analysis', <FindingMarks findings={inArea('feasibility')} showOk={!!feasibility(model)} />)}
      </NavGroup>

      <NavGroup id="analysis" title="Analysis" findings={inArea('requirements', 'diagram', 'dictionary', 'dataModel')} {...group}>
        {row('/requirements', 'Requirements definition', <FindingMarks findings={inArea('requirements')} />, all(model, 'requirement').length)}
        {row('/use-cases', 'Use cases', null, all(model, 'useCase').length)}
        <div className="nav-subgroup">Diagrams</div>
        {diagrams.map((d) => {
          const above = isAboveProject(view, d.diagram.id);
          return (
            <NavLink
              key={d.diagram.id}
              className={navClass(above ? 'nav-diagram nav-above' : 'nav-diagram')}
              to={`/diagram/${d.diagram.id}`}
              style={{ paddingLeft: 21 + d.depth * 10 }}
            >
              <span className="nav-label" title={d.title}>
                {d.title}
                {above && <span className="nav-above-note">above the project</span>}
              </span>
              {!above && <FindingMarks findings={findings.filter((f) => f.diagramId === d.diagram.id)} showOk />}
            </NavLink>
          );
        })}
        {row('/dictionary', 'Data dictionary', <FindingMarks findings={inArea('dictionary')} />, dataDefinitions(view).length)}
        {row('/data-model', 'Data model', <FindingMarks findings={inArea('dataModel')} showOk={all(view, 'entity').length > 0} />)}
        {row('/crud', 'CRUD matrix')}
      </NavGroup>

      <NavGroup id="design" title="Design" findings={inArea('alternatives', 'interface', 'structure', 'storage')} {...group}>
        {row('/alternatives', 'Alternative matrix', <FindingMarks findings={inArea('alternatives')} showOk={all(model, 'alternativeMatrix').length > 0} />)}
        {row('/interfaces', 'Interface structure', <FindingMarks findings={inArea('interface')} showOk={interfaceDiagrams.length > 0} />, null, interfaceDiagrams.length > 1)}
        {interfaceDiagrams.length > 1 &&
          interfaceDiagrams.map((d) => (
            <NavLink key={d.id} className={navClass('nav-diagram')} to={`/interfaces/${d.id}`} style={{ paddingLeft: 31 }}>
              <span className="nav-label" title={d.name}>
                {d.name || 'Untitled diagram'}
              </span>
              <FindingMarks findings={findings.filter((f) => f.homeId === d.id)} showOk />
            </NavLink>
          ))}
        {row('/structure', 'Structure charts', <FindingMarks findings={inArea('structure').filter((f) => f.ruleId !== 'PS-01')} showOk={charts.length > 0} />, null, charts.length > 1)}
        {charts.length > 1 &&
          charts.map((c) => (
            <NavLink key={c.id} className={navClass('nav-diagram')} to={`/structure/${c.id}`} style={{ paddingLeft: 31 }}>
              <span className="nav-label" title={c.name}>
                {c.name || 'Untitled chart'}
              </span>
              <FindingMarks findings={findings.filter((f) => f.homeId === c.id && f.ruleId !== 'PS-01')} showOk />
            </NavLink>
          ))}
        {row('/programs', 'Program specifications', <FindingMarks findings={findings.filter((f) => f.ruleId === 'PS-01')} />)}
        {row('/storage', 'Storage size estimate', <FindingMarks findings={inArea('storage')} />)}
      </NavGroup>

      <NavGroup id="implementation" title="Implementation" findings={inArea('testPlan')} {...group}>
        {row('/test-plan', 'Test plan', <FindingMarks findings={inArea('testPlan')} />, all(model, 'test').length)}
      </NavGroup>

      <NavGroup id="binder" title="Binder" findings={[]} {...group}>
        {row('/binder', 'Contents', null, sections.length, true)}
        {sections.map((s) => (
          <NavLink key={s.id} className={navClass('nav-diagram')} to={`/binder/${s.id}`} style={{ paddingLeft: 31 }}>
            <span className="nav-label" title={s.name}>
              {s.name}
            </span>
            {s.attachments.length > 0 && <span className="muted mono">{s.attachments.length === 1 ? '1 file' : `${s.attachments.length} files`}</span>}
          </NavLink>
        ))}
      </NavGroup>

      <NavLink className={navClass('nav-top')} to="/search">
        <span className="nav-label">Search</span>
      </NavLink>
      <NavLink className={navClass('nav-top')} to="/project">
        <span className="nav-label">Project</span>
      </NavLink>
      <NavLink className={navClass('nav-top')} to="/problems">
        <span className="nav-label">Problems</span>
        {visible ? <Count n={findings.length} /> : <span className="muted">hidden</span>}
      </NavLink>
      <div className="nav-spacer" />
      <NavLink className={navClass('nav-top')} to="/help">
        <span className="nav-label">Help: symbols and rules</span>
      </NavLink>
    </nav>
  );
}

/** The whole app: top bar, navigator, and the open screen. */
export function AppLayout() {
  const error = useLastError();
  return (
    <div className="app">
      <TopBar />
      <Navigator />
      <main className="main">
        <Outlet />
      </main>
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <Button small onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Pieces a screen puts inside <main> ----

export interface WorkAreaProps {
  children: ReactNode;
}

/** The centre column of a screen. Put a `PageHeader` first, then a `<div className="work-body">`. */
export function WorkArea({ children }: WorkAreaProps) {
  return <section className="work">{children}</section>;
}

export interface Crumb {
  label: string;
  /** A route to link to. Leave out for plain text. */
  to?: string;
}

export interface PageHeaderProps {
  /** The small muted line above the title. Strings are plain text. */
  breadcrumb: (string | Crumb)[];
  title: string;
  /** The page's own controls, at the right end. Every editing screen puts `<UndoRedo />` here. */
  children?: ReactNode;
}

/** The strip across the top of the work area: breadcrumb, title and controls. */
export function PageHeader({ breadcrumb, title, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <div className="breadcrumb">
          {breadcrumb.map((c, i) => {
            const crumb = typeof c === 'string' ? { label: c } : c;
            return (
              <Fragment key={i}>
                {i > 0 && ' / '}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
              </Fragment>
            );
          })}
        </div>
        <h1 className="page-title">{title}</h1>
      </div>
      {children && <div className="page-header-controls">{children}</div>}
    </div>
  );
}

/** The "Undo" and "Redo" buttons, wired to the store. */
export function UndoRedo() {
  const { canUndo, canRedo, undo, redo } = useHistory();
  return (
    <>
      <Button disabled={!canUndo} onClick={undo}>
        Undo
      </Button>
      <Button disabled={!canRedo} onClick={redo}>
        Redo
      </Button>
    </>
  );
}

export interface DiagramHeaderProps {
  diagramId: Id;
  /** Which of the two views of the diagram is open. */
  view: 'canvas' | 'outline';
}

/**
 * The page header of both diagram screens: the breadcrumb down from the context diagram,
 * the diagram's title, the "Canvas" and "Outline" switch, and Undo and Redo.
 */
export function DiagramHeader({ diagramId, view }: DiagramHeaderProps) {
  const model = useModel();
  const navigate = useNavigate();
  const suffix = view === 'outline' ? '/outline' : '';
  const path = diagramPath(model, diagramId);
  return (
    <PageHeader
      title={diagramTitle(model, diagramId)}
      breadcrumb={path.map((d) => ({
        label: diagramTitle(model, d.id),
        to: d.id === diagramId ? undefined : `/diagram/${d.id}${suffix}`,
      }))}
    >
      <Switch
        label="View of this diagram"
        value={view}
        onChange={(v) => navigate(`/diagram/${diagramId}${v === 'outline' ? '/outline' : ''}`)}
        options={[
          { value: 'canvas', label: 'Canvas' },
          { value: 'outline', label: 'Outline' },
        ]}
      />
      <UndoRedo />
    </PageHeader>
  );
}

export interface RightPanelProps {
  /** What the panel shows, for screen readers, such as "Problems". */
  label: string;
  children: ReactNode;
}

/** The sidebar on the right, 390 wide. It scrolls by itself. */
export function RightPanel({ label, children }: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label={label}>
      {children}
    </aside>
  );
}

export interface ListColumnProps {
  /** Width in pixels, such as 300 for the dictionary's list. */
  width: number;
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}

/** A fixed-width column on the left of a screen, such as the list of definitions. It scrolls by itself. */
export function ListColumn({ width, label, children, style }: ListColumnProps) {
  return (
    <aside className="list-column" aria-label={label} style={{ width, ...style }}>
      {children}
    </aside>
  );
}
