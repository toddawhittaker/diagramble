// Helpers the project screens share.

import { all, diagramsInOrder, isData, type Id, type Model } from '../../model';
import { findingPlace, RULES, type Finding } from '../../rules';

export interface FindingGroup {
  key: string;
  title: string;
  /** The route of the place the group is counted on. */
  to: string;
  /** True when every finding in the group comes from a rule that runs in physical mode only. */
  physicalOnly: boolean;
  findings: Finding[];
}

/** Whether a finding comes from a rule that runs only on the physical model. */
export function isPhysicalOnly(finding: Finding): boolean {
  return RULES[finding.ruleId]?.physicalOnly === true;
}

/**
 * Sorts findings into groups, in the order the navigator lists the parts of a project:
 * the two planning forms, the requirements definition, one group for each diagram, the
 * data dictionary, the data model, each alternative matrix, each interface structure
 * diagram, each structure chart, the program specifications, the three kinds of physical
 * finding, and the test plan. Anything left over goes in a last group so it is not lost.
 */
export function groupFindings(model: Model, findings: Finding[]): FindingGroup[] {
  const groups: FindingGroup[] = [];
  const used = new Set<string>();
  const take = (key: string, title: string, to: string, test: (f: Finding) => boolean, physicalOnly = false) => {
    const own = findings.filter((f) => !used.has(f.id) && test(f));
    for (const f of own) used.add(f.id);
    if (own.length) groups.push({ key, title, to, physicalOnly, findings: own });
  };
  const titled = (heading: string, name: string, several: boolean) => (several ? `${heading}: ${name || 'no title'}` : heading);

  take('systemRequest', 'Planning: system request', '/system-request', (f) => f.area === 'systemRequest');
  take('feasibility', 'Planning: feasibility analysis', '/feasibility', (f) => f.area === 'feasibility');
  take('requirements', 'Requirements definition', '/requirements', (f) => f.area === 'requirements');

  // The physical findings of the diagrams and the data model are kept for their own groups below.
  for (const row of diagramsInOrder(model)) {
    const id: Id = row.diagram.id;
    take(`diagram:${id}`, row.title, `/diagram/${id}`, (f) => f.diagramId === id && !isPhysicalOnly(f));
  }
  take('dictionary', 'Data dictionary', '/dictionary', (f) => f.diagramId === null && f.area === 'dictionary');
  take('dataModel', 'Data model', '/data-model', (f) => f.diagramId === null && f.area === 'dataModel' && !isPhysicalOnly(f));

  const matrices = all(model, 'alternativeMatrix');
  for (const m of matrices) {
    take(`matrix:${m.id}`, titled('Alternative matrix', m.name, matrices.length > 1), `/alternatives/${m.id}`, (f) => f.area === 'alternatives' && f.homeId === m.id);
  }
  take('alternatives', 'Alternative matrix', '/alternatives', (f) => f.area === 'alternatives');

  const interfaceDiagrams = all(model, 'interfaceDiagram');
  for (const d of interfaceDiagrams) {
    take(`isd:${d.id}`, titled('Interface structure', d.name, interfaceDiagrams.length > 1), `/interfaces/${d.id}`, (f) => f.area === 'interface' && f.homeId === d.id);
  }
  take('interface', interfaceDiagrams.length > 1 ? 'Interface structure: every diagram' : 'Interface structure', '/interfaces', (f) => f.area === 'interface');

  const charts = all(model, 'structureChart');
  for (const c of charts) {
    take(`chart:${c.id}`, titled('Structure chart', c.name, charts.length > 1), `/structure/${c.id}`, (f) => f.area === 'structure' && f.ruleId !== 'PS-01' && f.homeId === c.id);
  }
  take('structure', charts.length > 1 ? 'Structure charts: every chart' : 'Structure chart', '/structure', (f) => f.area === 'structure' && f.ruleId !== 'PS-01');
  take('programs', 'Program specifications', '/programs', (f) => f.ruleId === 'PS-01');

  const firstPhysicalDiagram = findings.find((f) => f.diagramId && isPhysicalOnly(f))?.diagramId;
  take('physicalDfd', 'Physical model: data flow diagrams', firstPhysicalDiagram ? `/diagram/${firstPhysicalDiagram}` : '/', (f) => f.diagramId !== null && isPhysicalOnly(f), true);
  take('physicalData', 'Physical model: tables and fields', '/data-model', (f) => f.area === 'dataModel' && isPhysicalOnly(f), true);
  take('storage', 'Storage size estimate', '/storage', (f) => f.area === 'storage', true);

  take('testPlan', 'Test plan', '/test-plan', (f) => f.area === 'testPlan');
  take('other', 'Whole project', '/problems', () => true);
  return groups;
}

/** Where a finding's card should take the user, and the words for the button. */
export function placeOf(model: Model, finding: Finding): { to: string; text: string } {
  if (finding.diagramId && model.elements[finding.diagramId]) {
    return { to: `/diagram/${finding.diagramId}`, text: 'Show on diagram' };
  }
  if (finding.area === 'dictionary') {
    const dataId = finding.elementIds.find((id) => isData(model.elements[id]));
    return { to: dataId ? `/dictionary/${dataId}` : '/dictionary', text: 'Open in dictionary' };
  }
  // Every other finding is counted on a page of its own, which the rules name.
  return findingPlace(finding);
}

/** "1 error", "2 errors". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The family of a rule: the letters before the dash. */
export function familyOf(ruleId: string): string {
  return ruleId.split('-')[0];
}
