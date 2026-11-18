// The frame every screen shares: docs/mockups/BRIEFS.md section 1.1.

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Button, Switch } from '../components/controls';
import { Count, FindingMarks, Mark } from '../components/Mark';
import { all, dataDefinitions, diagramPath, diagramsInOrder, diagramTitle, isAboveProject } from '../model/queries';
import type { Id } from '../model/types';
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
        Diagramble
      </Link>
      <span className="topbar-project">{model.name}</span>
      <span className="grow" />
      <span className="topbar-saved">{savedText(savedAt)}</span>
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

/** The sidebar on the left: the parts of the project in a fixed order, with live problem counts. */
export function Navigator() {
  const model = useModel();
  const findings = useFindings();
  const visible = useFindingsVisible();
  const diagrams = diagramsInOrder(model);
  const dictionary = findings.filter((f) => f.area === 'dictionary');
  const dataModel = findings.filter((f) => f.area === 'dataModel');
  return (
    <nav className="navigator" aria-label="Parts of the project">
      <NavLink className={navClass('nav-top')} to="/use-cases">
        <span className="nav-label">Use cases</span>
        <Count n={all(model, 'useCase').length} />
      </NavLink>
      <div className="nav-group">Diagrams</div>
      {diagrams.map((row) => {
        const above = isAboveProject(model, row.diagram.id);
        return (
          <NavLink
            key={row.diagram.id}
            className={navClass(above ? 'nav-diagram nav-above' : 'nav-diagram')}
            to={`/diagram/${row.diagram.id}`}
            style={{ paddingLeft: 21 + row.depth * 10 }}
          >
            <span className="nav-label" title={row.title}>
              {row.title}
              {above && <span className="nav-above-note">above the project</span>}
            </span>
            {!above && <FindingMarks findings={findings.filter((f) => f.diagramId === row.diagram.id)} showOk />}
          </NavLink>
        );
      })}
      <NavLink className={navClass('nav-top')} to="/dictionary" style={{ marginTop: 8 }}>
        <span className="nav-label">Data dictionary</span>
        <FindingMarks findings={dictionary} />
        <Count n={dataDefinitions(model).length} />
      </NavLink>
      <NavLink className={navClass('nav-top')} to="/data-model">
        <span className="nav-label">Data model</span>
        <FindingMarks findings={dataModel} showOk={all(model, 'entity').length > 0} />
      </NavLink>
      <NavLink className={navClass('nav-top')} to="/crud">
        <span className="nav-label">CRUD matrix</span>
      </NavLink>
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
