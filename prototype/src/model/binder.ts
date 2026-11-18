// The binder's starting layouts and the conversion strategy (SPEC 10.7). The wording is
// the tool's own.

import type { ConversionStrategy, Phase } from './types';

export interface BinderLayout {
  key: string;
  title: string;
  phase: Phase;
  /** The textbook chapter the deliverable belongs to. */
  chapter: number;
  /** The text a new section starts with. Empty when there is no set format. */
  body: string;
}

/** The key of the layout that carries the conversion strategy form. */
export const MIGRATION_PLAN = 'migration-plan';

const table = (...columns: string[]) => `| ${columns.join(' | ')} |\n| ${columns.map(() => ' ').join(' | ')} |`;

/** One starting layout for each deliverable that SPEC 10.7 lists. A student may also add a section with no layout. */
export const BINDER_LAYOUTS: readonly BinderLayout[] = [
  { key: 'work-plan', title: 'Work plan', phase: 'planning', chapter: 2, body: '' },
  {
    key: 'staffing-plan',
    title: 'Staffing plan',
    phase: 'planning',
    chapter: 2,
    body: `# Roles\n${table('Role', 'Description', 'Person assigned')}\n\n# Reporting structure\n\n# Special incentives\n`,
  },
  {
    key: 'project-charter',
    title: 'Project charter',
    phase: 'planning',
    chapter: 2,
    body: '# Project objective\n\n# Team rules\n1. \n2. \n3. \n',
  },
  {
    key: 'risk-assessment',
    title: 'Risk assessment',
    phase: 'planning',
    chapter: 2,
    body: '# Risk 1\n- Description: \n- Likelihood: \n- Potential impact: \n- Ways to address it: \n',
  },
  {
    key: 'standards-list',
    title: 'Standards list',
    phase: 'planning',
    chapter: 2,
    body: `${table('Type of standard', 'Examples')}\n`,
  },
  { key: 'executive-summary', title: 'Executive summary', phase: 'analysis', chapter: 3, body: '' },
  { key: 'architecture-design', title: 'Architecture design', phase: 'design', chapter: 7, body: '' },
  {
    key: 'hardware-software-specification',
    title: 'Hardware and software specification',
    phase: 'design',
    chapter: 7,
    body: `${table('', 'Client computer', 'Web server', 'Database server')}\n| Operating system |  |  |  |\n| Special software |  |  |  |\n| Hardware |  |  |  |\n| Network |  |  |  |\n`,
  },
  {
    key: 'personas-use-scenarios',
    title: 'Personas and use scenarios',
    phase: 'design',
    chapter: 8,
    body: '# Persona\n\n# Use scenario 1\n1. \n2. \n3. \n',
  },
  {
    key: 'interface-standards',
    title: 'Interface standards',
    phase: 'design',
    chapter: 8,
    body: '# Metaphor\n\n# Objects\n\n# Actions\n\n# Icons\n\n# Template\n',
  },
  {
    key: 'interface-prototypes',
    title: 'Interface prototypes',
    phase: 'design',
    chapter: 8,
    body: 'Attach the storyboards, wireframes and screen designs below.\n',
  },
  {
    key: 'data-storage-design',
    title: 'Data storage design',
    phase: 'design',
    chapter: 10,
    body: `# Storage formats\n${table('Kind of data', 'Type', 'Use', 'Suggested storage format')}\n\n# Making the storage faster\n${table('Target', 'Comments', 'Suggestions')}\n| Denormalizing |  |  |\n| Clustering |  |  |\n| Indexing |  |  |\n`,
  },
  { key: 'documentation', title: 'Documentation', phase: 'implementation', chapter: 11, body: '' },
  {
    key: MIGRATION_PLAN,
    title: 'Migration plan',
    phase: 'implementation',
    chapter: 12,
    body: '# Preparing the business\n\n# Preparing the technology\n\n# Preparing the people\n',
  },
];

export type Level = 'low' | 'medium' | 'high';

export interface ConversionEffect {
  /** Which of the three choices this is. */
  choice: 'style' | 'location' | 'modules';
  /** The option chosen, such as 'parallel'. */
  option: string;
  /** The option in words, such as "Parallel conversion". */
  title: string;
  /** What the option is, in one sentence. */
  meaning: string;
  risk: Level;
  cost: Level;
  /** 'low' means the conversion is over soonest. */
  time: Level;
  /** Why it has that risk, cost and time, in the tool's own words. */
  explanation: string;
}

type Options<K extends keyof ConversionStrategy> = Record<NonNullable<ConversionStrategy[K]> & string, Omit<ConversionEffect, 'choice' | 'option'>>;

const STYLE: Options<'style'> = {
  direct: {
    title: 'Direct conversion',
    meaning: 'The old system is switched off and the new one takes over at once.',
    risk: 'high',
    cost: 'low',
    time: 'low',
    explanation: 'There is only one system to run, so it is cheap and quick. If the new system fails there is nothing to fall back on.',
  },
  parallel: {
    title: 'Parallel conversion',
    meaning: 'The old and the new system run side by side until the new one is trusted.',
    risk: 'low',
    cost: 'high',
    time: 'high',
    explanation: 'The old system is still there if the new one fails. Every piece of work is done twice for as long as both run.',
  },
};

const LOCATION: Options<'location'> = {
  pilot: {
    title: 'Pilot conversion',
    meaning: 'One location converts first. The others follow once it works there.',
    risk: 'low',
    cost: 'medium',
    time: 'medium',
    explanation: 'Problems show up at one location and are fixed before the rest convert. The other locations wait in the meantime.',
  },
  phased: {
    title: 'Phased conversion',
    meaning: 'The locations convert in groups, one group after another.',
    risk: 'medium',
    cost: 'medium',
    time: 'high',
    explanation: 'Each group learns from the one before it. The conversion team is kept busy for the whole of a long changeover.',
  },
  simultaneous: {
    title: 'Simultaneous conversion',
    meaning: 'Every location converts at the same time.',
    risk: 'high',
    cost: 'high',
    time: 'low',
    explanation: 'It is over soonest and nobody runs two versions. A problem hits every location at once, and all of them need support on the same day.',
  },
};

const MODULES: Options<'modules'> = {
  'whole-system': {
    title: 'Whole-system conversion',
    meaning: 'The whole of the new system is installed in one step.',
    risk: 'high',
    cost: 'medium',
    time: 'low',
    explanation: 'There is one changeover and no bridges to build between old and new parts. Users must learn everything at once.',
  },
  modular: {
    title: 'Modular conversion',
    meaning: 'The new system is installed one module at a time.',
    risk: 'medium',
    cost: 'high',
    time: 'high',
    explanation: 'Users learn a little at a time. The modules must be built to work alone, and temporary links to the old system cost extra.',
  },
};

/** Every option of the three choices, for the form's lists. */
export const CONVERSION_OPTIONS = { style: STYLE, location: LOCATION, modules: MODULES } as const;

/** What each choice made so far means for risk, cost and time. Nothing here is marked right or wrong. */
export function conversionEffects(strategy: ConversionStrategy | null | undefined): ConversionEffect[] {
  if (!strategy) return [];
  const out: ConversionEffect[] = [];
  if (strategy.style) out.push({ choice: 'style', option: strategy.style, ...STYLE[strategy.style] });
  if (strategy.location) out.push({ choice: 'location', option: strategy.location, ...LOCATION[strategy.location] });
  if (strategy.modules) out.push({ choice: 'modules', option: strategy.modules, ...MODULES[strategy.modules] });
  return out;
}
