// Helpers the three project screens share.

import { diagramsInOrder, isData, type Id, type Model } from '../../model';
import type { Finding } from '../../rules';

export interface FindingGroup {
  key: string;
  title: string;
  /** The route of the place the group is counted on. */
  to: string;
  findings: Finding[];
}

/**
 * Sorts findings into the places they are counted: one group for each diagram that has
 * any, in reading order, then the data dictionary, then the data model. Anything left
 * over (which the rules should never produce) goes in a last group so it is not lost.
 */
export function groupFindings(model: Model, findings: Finding[]): FindingGroup[] {
  const groups: FindingGroup[] = [];
  const used = new Set<string>();
  const take = (key: string, title: string, to: string, test: (f: Finding) => boolean) => {
    const own = findings.filter((f) => !used.has(f.id) && test(f));
    for (const f of own) used.add(f.id);
    if (own.length) groups.push({ key, title, to, findings: own });
  };
  for (const row of diagramsInOrder(model)) {
    const id: Id = row.diagram.id;
    take(`diagram:${id}`, row.title, `/diagram/${id}`, (f) => f.diagramId === id);
  }
  take('dictionary', 'Data dictionary', '/dictionary', (f) => f.diagramId === null && f.area === 'dictionary');
  take('dataModel', 'Data model', '/data-model', (f) => f.diagramId === null && f.area === 'dataModel');
  take('other', 'Whole project', '/problems', () => true);
  return groups;
}

/** Where a finding's card should take the user, and the words for the button. */
export function placeOf(model: Model, finding: Finding): { to: string; text: string } {
  if (finding.diagramId && model.elements[finding.diagramId]) {
    return { to: `/diagram/${finding.diagramId}`, text: 'Show on diagram' };
  }
  if (finding.area === 'dataModel') return { to: '/data-model', text: 'Open data model' };
  const dataId = finding.elementIds.find((id) => isData(model.elements[id]));
  return { to: dataId ? `/dictionary/${dataId}` : '/dictionary', text: 'Open in dictionary' };
}

/** "1 error", "2 errors". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The family of a rule: the letters before the dash. */
export function familyOf(ruleId: string): string {
  return ruleId.split('-')[0];
}
