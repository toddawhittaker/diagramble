// Fixed lists the forms of SPEC section 10 choose from.

import type { NonfunctionalType, TestStage } from './types';

/**
 * The sub-types of each type of nonfunctional requirement (SPEC 10.3). There are
 * fifteen. They are the usual headings of an architecture design.
 */
export const NONFUNCTIONAL_SUBTYPES: Record<NonfunctionalType, string[]> = {
  operational: ['technical environment', 'system integration', 'portability', 'maintainability'],
  performance: ['speed', 'capacity', 'availability and reliability'],
  security: ['system value', 'access control', 'encryption and authentication', 'virus control'],
  'cultural and political': ['multilingual', 'customization', 'unstated norms', 'legal'],
};

/** The types of test that belong to each stage (SPEC 10.5). */
export const TEST_TYPES: Record<TestStage, string[]> = {
  unit: ['black-box', 'white-box'],
  integration: ['user interface', 'use scenario', 'data flow', 'system interface'],
  system: ['requirements', 'usability', 'security', 'performance', 'documentation'],
  acceptance: ['alpha', 'beta'],
};

export const TEST_STAGES: TestStage[] = ['unit', 'integration', 'system', 'acceptance'];
