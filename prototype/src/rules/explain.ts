import { diagramOfProcess, diagramTitle, elementLabel } from '../model/queries';
import type { Model } from '../model/types';
import { isBalanceFinding, type Finding } from './engine';

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The text for the "AI explanation" box on a problem card.
 * No AI model is called. The text is put together from the finding's own values,
 * to show where an AI explanation would sit and how it would be marked.
 */
export function explain(model: Model, finding: Finding): string {
  if (isBalanceFinding(finding)) {
    const v = finding.values;
    const parent = diagramOfProcess(model, v.processId);
    const parentTitle = parent ? diagramTitle(model, parent.id) : 'The parent diagram';
    const isIn = v.direction === 'in';
    const parts = v.parts.map((p) => p.name);
    const crossing = v.parts.filter((p) => p.crosses).map((p) => p.name);
    const first = `${parentTitle} says ${v.data} ${isIn ? 'enters' : 'leaves'} ${elementLabel(model, v.processId)}.`;
    const second =
      parts.length > 1 || parts[0] !== v.data
        ? ` Your dictionary says ${v.data} is made of ${joinNames(parts)}.`
        : '';
    const third =
      crossing.length > 0
        ? ` Only ${joinNames(crossing)} ${isIn ? (crossing.length > 1 ? 'arrive' : 'arrives') : crossing.length > 1 ? 'leave' : 'leaves'} on this diagram.`
        : ` None of it ${isIn ? 'arrives on' : 'leaves'} this diagram.`;
    return first + second + third;
  }
  if (finding.ruleId === 'BAL-03') {
    const v = finding.values as { data: string; process: string; direction: string };
    return `On this diagram, ${v.data} ${v.direction === 'in' ? 'comes in from outside' : 'goes out of'} ${v.process}. The parent diagram shows no flow ${v.direction === 'in' ? 'into' : 'out of'} ${v.process} that carries ${v.data} or anything made of it. Either the parent is missing a flow, or ${v.data} should be defined as part of data the parent already shows.`;
  }
  const names = finding.elementIds
    .slice(0, 1)
    .map((id) => elementLabel(model, id))
    .filter(Boolean);
  const about = names.length ? `This is about ${names[0]}. ` : '';
  return `${about}${finding.why} ${finding.fix}`;
}
