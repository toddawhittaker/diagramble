// What an export can hold: the parts of a project, each with its page layout, and the
// compiled documents of section 10.8 of the specification, each a list of parts in the
// specification's order.

import type { ReactNode } from 'react';
import {
  all,
  binderSections,
  dataDefinitions,
  diagramsInOrder,
  feasibility,
  isAboveProject,
  modelForMode,
  systemRequest,
  type Id,
  type Mode,
  type Model,
} from '../../model';
import { physicalDataModelStarted, physicalDfdStarted, storageStarted, type Finding } from '../../rules';
import {
  CrudPage,
  DiagramPage,
  DictionaryPage,
  ErdPage,
  EventResponsePage,
  FragmentsPage,
  UseCaseListPage,
  UseCasesPage,
} from './pages';
import {
  AcquisitionPage,
  BinderPage,
  ChartPage,
  FeasibilityPage,
  IsdPage,
  MatrixPage,
  NonfunctionalPage,
  PhysicalDataModelPage,
  RequirementsPage,
  SpecsPage,
  StoragePage,
  SystemRequestPage,
  TestPlanPage,
} from './pages2';
import { isPhysicalOnly } from './shared';

/** One thing that can be put in a document: a page, or a run of pages, with one line on the contents page. */
export interface Part {
  key: string;
  title: string;
  render: () => ReactNode;
  /** The findings that are about this part, for the list at the end of a compiled document. */
  covers?: (finding: Finding) => boolean;
  /** A diagram above the project's top diagram: left unticked when parts are picked by hand. */
  above?: boolean;
  /** A page of the physical model. */
  physical?: boolean;
}

/** A heading in the list of parts to pick by hand. */
export interface PartGroup {
  title: string;
  parts: Part[];
}

/** One line of a compiled document's outline. With no parts, it is listed as missing. */
export interface Slot {
  title: string;
  parts: Part[];
}

export interface CompiledDocument {
  key: string;
  title: string;
  /** One sentence for the list of documents. */
  about: string;
  /** The model the document shows, and the mode its findings are worked out in. */
  mode: Mode;
  slots: Slot[];
}

const titled = (heading: string, name: string, several: boolean) => (several ? `${heading}: ${name || 'no title'}` : heading);

/** Every part of the project, built once for both ways of choosing. */
function buildParts(full: Model) {
  // The logical pages leave out everything marked system-related. The physical pages show the whole model.
  const logical = modelForMode(full, 'logical');

  const diagramRows = (model: Model) => diagramsInOrder(model);
  const diagrams: Part[] = diagramRows(logical).map((row) => {
    const id: Id = row.diagram.id;
    return {
      key: `diagram:${id}`,
      title: row.title,
      above: isAboveProject(logical, id),
      render: () => <DiagramPage model={logical} diagramId={id} title={row.title} />,
      covers: (f) => f.diagramId === id && !isPhysicalOnly(f),
    };
  });
  const physicalDiagrams: Part[] = diagramRows(full).map((row) => {
    const id: Id = row.diagram.id;
    const title = `Physical data flow diagram: ${row.title}`;
    return {
      key: `physicalDiagram:${id}`,
      title,
      above: isAboveProject(full, id),
      physical: true,
      render: () => <DiagramPage model={full} diagramId={id} title={title} physical />,
      covers: (f) => f.diagramId === id,
    };
  });

  const matrixList = all(full, 'alternativeMatrix');
  const matrices: Part[] = matrixList.map((m) => {
    const title = titled('Alternative matrix', m.name, true);
    return {
      key: `matrix:${m.id}`,
      title,
      render: () => <MatrixPage model={full} matrixId={m.id} title={title} />,
      covers: (f) => f.area === 'alternatives' && f.homeId === m.id,
    };
  });

  const isdList = all(full, 'interfaceDiagram');
  const interfaceDiagrams: Part[] = isdList.map((d) => {
    const title = titled('Interface structure diagram', d.name, true);
    return {
      key: `isd:${d.id}`,
      title,
      render: () => <IsdPage model={full} diagramId={d.id} title={title} />,
      // ISD-04 belongs to no one diagram, so it is listed with each.
      covers: (f) => f.area === 'interface' && (f.homeId === d.id || f.homeId === null),
    };
  });

  const chartList = all(full, 'structureChart');
  const charts: Part[] = chartList.map((c) => {
    const title = titled('Structure chart', c.name, true);
    return {
      key: `chart:${c.id}`,
      title,
      render: () => <ChartPage model={full} chartId={c.id} title={title} />,
      covers: (f) => f.area === 'structure' && f.ruleId !== 'PS-01' && (f.homeId === c.id || f.homeId === null),
    };
  });

  const sections = binderSections(full);
  const binderPart = (id: Id, name: string): Part => {
    const title = name || 'Section with no title';
    return { key: `binder:${id}`, title, render: () => <BinderPage model={full} sectionId={id} title={title} /> };
  };
  const binder: Part[] = sections.map((s) => binderPart(s.id, s.name));
  /** The binder sections that were started from one of the named layouts. */
  const byLayout = (...keys: string[]): Part[] =>
    keys.flatMap((key) => sections.filter((s) => s.layout === key).map((s) => binderPart(s.id, s.name)));
  /** Sections the student added without a layout, such as interview notes, in the given phases. */
  const extras = (...phases: string[]): Part[] =>
    sections.filter((s) => s.layout === null && phases.includes(s.phase)).map((s) => binderPart(s.id, s.name));

  const single = {
    systemRequest: {
      key: 'systemRequest',
      title: 'System request',
      render: () => <SystemRequestPage model={full} />,
      covers: (f) => f.area === 'systemRequest',
    },
    feasibility: {
      key: 'feasibility',
      title: 'Feasibility analysis',
      render: () => <FeasibilityPage model={full} />,
      covers: (f) => f.area === 'feasibility',
    },
    requirements: {
      key: 'requirements',
      title: 'Requirements definition',
      render: () => <RequirementsPage model={logical} />,
      covers: (f) => f.area === 'requirements',
    },
    nonfunctional: { key: 'nonfunctional', title: 'Nonfunctional requirements', render: () => <NonfunctionalPage model={full} /> },
    fragments: { key: 'fragments', title: 'DFD fragments', render: () => <FragmentsPage model={logical} /> },
    dictionary: {
      key: 'dictionary',
      title: 'Data dictionary',
      render: () => <DictionaryPage model={logical} />,
      covers: (f) => f.diagramId === null && f.area === 'dictionary',
    },
    useCaseList: { key: 'useCaseList', title: 'Use case list', render: () => <UseCaseListPage model={logical} /> },
    eventResponse: { key: 'eventResponse', title: 'Event-response list', render: () => <EventResponsePage model={logical} /> },
    useCases: { key: 'useCases', title: 'Use cases', render: () => <UseCasesPage model={logical} /> },
    erd: {
      key: 'erd',
      title: 'Entity relationship diagram',
      render: () => <ErdPage model={logical} />,
      covers: (f) => f.diagramId === null && f.area === 'dataModel' && !isPhysicalOnly(f),
    },
    crud: { key: 'crud', title: 'CRUD matrix', render: () => <CrudPage model={logical} /> },
    acquisition: { key: 'acquisition', title: 'Recommended acquisition strategy', render: () => <AcquisitionPage model={full} /> },
    specs: {
      key: 'specs',
      title: 'Program specifications',
      render: () => <SpecsPage model={full} />,
      covers: (f) => f.ruleId === 'PS-01',
    },
    physicalData: {
      key: 'physicalData',
      title: 'Physical data model',
      physical: true,
      render: () => <PhysicalDataModelPage model={full} />,
      covers: (f) => f.diagramId === null && f.area === 'dataModel',
    },
    storage: {
      key: 'storage',
      title: 'Storage size estimate',
      physical: true,
      render: () => <StoragePage model={full} />,
      covers: (f) => f.area === 'storage',
    },
    physicalCrud: {
      key: 'physicalCrud',
      title: 'CRUD matrix, with table and field names',
      physical: true,
      render: () => <CrudPage model={full} title="CRUD matrix" physical />,
    },
    repository: {
      key: 'repository',
      title: 'Repository entries: the data dictionary',
      physical: true,
      render: () => <DictionaryPage model={full} title="Repository entries: the data dictionary" physical />,
      covers: (f) => f.diagramId === null && f.area === 'dictionary',
    },
    testPlan: {
      key: 'testPlan',
      title: 'Test plan',
      render: () => <TestPlanPage model={full} />,
      covers: (f) => f.area === 'testPlan',
    },
  } satisfies Record<string, Part>;

  return { full, logical, diagrams, physicalDiagrams, matrices, interfaceDiagrams, charts, binder, byLayout, extras, single };
}

/** The parts to pick by hand, under the headings the navigator uses. */
export function handParts(full: Model): PartGroup[] {
  const p = buildParts(full);
  const s = p.single;
  return [
    { title: 'Planning', parts: [s.systemRequest, s.feasibility] },
    { title: 'Analysis: diagrams', parts: p.diagrams },
    { title: 'Analysis', parts: [s.requirements, s.fragments, s.dictionary, s.useCaseList, s.eventResponse, s.useCases, s.erd, s.crud] },
    { title: 'Design', parts: [...p.matrices, ...p.interfaceDiagrams, ...p.charts, s.specs] },
    { title: 'Design: physical model', parts: [...p.physicalDiagrams, s.physicalData, s.physicalCrud, s.storage] },
    { title: 'Implementation', parts: [s.testPlan] },
    { title: 'Binder', parts: p.binder },
  ].filter((group) => group.parts.length > 0);
}

/**
 * The compiled documents, in the order the specification lists them. A part that the
 * project does not hold yet is left out of its slot, and the slot is then listed as
 * missing on the contents page.
 */
export function compiledDocuments(full: Model): CompiledDocument[] {
  const p = buildParts(full);
  const s = p.single;
  const { logical } = p;
  const when = (test: unknown, ...parts: Part[]): Part[] => (test ? parts : []);
  const inProject = (parts: Part[]) => parts.filter((part) => !part.above);

  const hasUseCases = all(logical, 'useCase').length > 0;
  const hasRequirements = all(full, 'requirement').length > 0 || full.project.noneExpected.length > 0;
  const hasNonfunctional = all(full, 'requirement').some((r) => r.requirementKind === 'nonfunctional') || full.project.noneExpected.length > 0;
  const hasEntities = all(logical, 'entity').length > 0;
  const hasModules = p.charts.length > 0;
  // The context diagram and process 0 are in every project, so a process model exists once it holds something more.
  const hasProcessModel = Object.keys(logical.views.occurrences).length > 1 || all(logical, 'dataFlow').length > 0;

  return [
    {
      key: 'request',
      title: 'System request and feasibility study',
      about: 'The two planning forms.',
      mode: 'logical',
      slots: [
        { title: 'System request', parts: when(systemRequest(full), s.systemRequest) },
        { title: 'Feasibility analysis', parts: when(feasibility(full), s.feasibility) },
      ],
    },
    {
      key: 'plan',
      title: 'Project plan',
      about: 'Five binder sections of the planning phase.',
      mode: 'logical',
      slots: [
        { title: 'Work plan', parts: p.byLayout('work-plan') },
        { title: 'Staffing plan', parts: p.byLayout('staffing-plan') },
        { title: 'Project charter', parts: p.byLayout('project-charter') },
        { title: 'Standards list', parts: p.byLayout('standards-list') },
        { title: 'Risk assessment', parts: p.byLayout('risk-assessment') },
      ],
    },
    {
      key: 'proposal',
      title: 'System proposal',
      about: 'The analysis: the request, the requirements, the use cases and the logical models.',
      mode: 'logical',
      slots: [
        { title: 'Executive summary', parts: p.byLayout('executive-summary') },
        { title: 'System request', parts: when(systemRequest(full), s.systemRequest) },
        { title: 'Work plan', parts: p.byLayout('work-plan') },
        { title: 'Feasibility analysis', parts: when(feasibility(full), s.feasibility) },
        { title: 'Requirements definition', parts: when(hasRequirements, s.requirements) },
        { title: 'Use cases', parts: when(hasUseCases, s.useCaseList, s.useCases) },
        { title: 'Process model', parts: when(hasProcessModel, ...inProject(p.diagrams)) },
        { title: 'Data model', parts: when(hasEntities, s.erd) },
        { title: 'Appendices', parts: p.extras('planning', 'analysis') },
      ],
    },
    {
      key: 'specification',
      title: 'System specification',
      about: 'The design, with the physical models.',
      mode: 'physical',
      slots: [
        { title: 'Recommended acquisition strategy', parts: when(p.matrices.length, s.acquisition) },
        { title: 'Alternative matrix', parts: p.matrices },
        { title: 'Architecture design', parts: [...p.byLayout('architecture-design'), ...when(hasNonfunctional, s.nonfunctional)] },
        { title: 'Hardware and software specification', parts: p.byLayout('hardware-software-specification') },
        {
          title: 'Interface design',
          parts: [...p.interfaceDiagrams, ...p.byLayout('interface-standards', 'personas-use-scenarios', 'interface-prototypes')],
        },
        { title: 'Physical process model', parts: when(physicalDfdStarted(full), ...inProject(p.physicalDiagrams)) },
        { title: 'Program design specifications', parts: [...p.charts, ...when(hasModules, s.specs)] },
        { title: 'Physical data model', parts: when(physicalDataModelStarted(full), s.physicalData) },
        { title: 'Data storage design', parts: [...p.byLayout('data-storage-design'), ...when(storageStarted(full), s.storage)] },
        { title: 'CRUD matrix', parts: when(all(full, 'entity').length > 0, s.physicalCrud) },
        { title: 'Repository entries', parts: when(dataDefinitions(full).length > 0, s.repository) },
      ],
    },
    {
      key: 'programs',
      title: 'Program design document',
      about: 'Every structure chart, then the program specifications.',
      mode: 'logical',
      slots: [
        { title: 'Structure charts', parts: p.charts },
        { title: 'Program specifications', parts: when(hasModules, s.specs) },
      ],
    },
    {
      key: 'implementation',
      title: 'Implementation documents',
      about: 'The test plan, the documentation and the migration plan.',
      mode: 'logical',
      slots: [
        { title: 'Test plan', parts: when(all(full, 'test').length > 0, s.testPlan) },
        { title: 'Documentation', parts: p.byLayout('documentation') },
        { title: 'Migration plan', parts: p.byLayout('migration-plan') },
      ],
    },
  ];
}
