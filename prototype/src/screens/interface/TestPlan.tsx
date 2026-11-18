// The test plan: the list of tests by stage, the form of the open test, and beside it
// the problems and the functional requirements no test addresses yet. SPEC 10.5.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  TEST_STAGES,
  TEST_TYPES,
  all,
  elementLabel,
  get,
  requirementNumber,
  requirementsInOrder,
  requirementsOutline,
  testsInOrder,
  type Command,
  type Id,
  type Model,
  type Test,
  type TestCase,
  type TestStage,
} from '../../model';
import { findingsForHome, type Finding } from '../../rules';
import { dispatch, useAreaFindings, useModel } from '../../store';
import { ListColumn, PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { Button, CellText, EditableRows, FindingMarks, NumberField, ProblemList, SelectField, Tabs } from '../../components';
import { DeleteControl, DraftField, IdOrText, shorten, type ChoiceOption } from './shared';

type TestPatch = Extract<Command, { type: 'updateTest' }>['patch'];

const STAGE_WORDS: Record<TestStage, string> = {
  unit: 'Unit tests',
  integration: 'Integration tests',
  system: 'System tests',
  acceptance: 'Acceptance tests',
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ---- The list of tests ----

function TestList({ tests, openId, findings, onAdd }: { tests: Test[]; openId: Id | undefined; findings: Finding[]; onAdd: (stage: TestStage) => void }) {
  return (
    <ListColumn width={260} label="Tests">
      {TEST_STAGES.map((stage) => {
        const inStage = tests.filter((t) => t.stage === stage);
        return (
          <section key={stage} className="interface-stage">
            <div className="interface-stage-heading">
              <h2 className="panel-subheading grow">
                {STAGE_WORDS[stage]} <span className="count">{inStage.length}</span>
              </h2>
              <Button small variant="link" aria-label={`Add to the ${STAGE_WORDS[stage].toLowerCase()}`} onClick={() => onAdd(stage)}>
                Add
              </Button>
            </div>
            {inStage.length === 0 ? (
              <div className="interface-stage-none muted">None yet</div>
            ) : (
              inStage.map((t) => (
                <Link key={t.id} className={`row${t.id === openId ? ' is-selected' : ''}`} to={`/test-plan/${t.id}`} aria-current={t.id === openId ? 'page' : undefined}>
                  <span className="mono">T-{t.ordinal}</span>
                  <span className="grow interface-test-name">{t.name}</span>
                  {t.result && <span className="muted interface-test-result">{t.result}</span>}
                  <FindingMarks findings={findingsForHome(findings, t.id)} counts={false} />
                </Link>
              ))
            )}
          </section>
        );
      })}
    </ListColumn>
  );
}

// ---- The form of one test ----

function TestForm({ model, test }: { model: Model; test: Test }) {
  const navigate = useNavigate();
  // Remounts the ID box when a change is refused, so that it shows the real ID again.
  const [idKey, setIdKey] = useState(0);
  const update = (patch: TestPatch) => dispatch({ type: 'updateTest', id: test.id, patch }).ok;

  const programs: ChoiceOption[] = all(model, 'module')
    .filter((m) => !m.repeatsId)
    .map((m) => ({ value: m.id, label: elementLabel(model, m.id) }));
  const requirements: ChoiceOption[] = requirementsInOrder(model).map((r) => ({ value: r.id, label: shorten(`${requirementNumber(model, r.id)} ${r.name}`) }));
  const manyDiagrams = all(model, 'interfaceDiagram').length > 1;
  const interfaces: ChoiceOption[] = all(model, 'interface').map((i) => ({
    value: i.id,
    label: `${i.number} ${i.name}${manyDiagrams ? ` (${model.elements[i.diagramId]?.name ?? ''})` : ''}`,
  }));
  const types = [{ value: '', label: 'Not chosen' }, ...TEST_TYPES[test.stage].map((t) => ({ value: t, label: capital(t) }))];
  // A type kept from before the lists existed is still shown.
  if (test.testType && !TEST_TYPES[test.stage].includes(test.testType)) types.push({ value: test.testType, label: capital(test.testType) });

  return (
    <div className="interface-form">
      <div className="interface-form-row interface-form-row-wide-first">
        <DraftField label="Title" value={test.name} onSave={(name) => dispatch({ type: 'rename', id: test.id, name: name.trim() }).ok} />
        <NumberField
          key={idKey}
          label="Test ID"
          value={test.ordinal}
          size={5}
          onCommit={(ordinal) => {
            if (ordinal === null || !update({ ordinal })) setIdKey((k) => k + 1);
          }}
        />
      </div>

      <div className="interface-form-row">
        <SelectField<TestStage>
          label="Stage"
          value={test.stage}
          options={TEST_STAGES.map((s) => ({ value: s, label: capital(s) }))}
          onChange={(stage) => update({ stage, testType: TEST_TYPES[stage].includes(test.testType) ? test.testType : '' })}
        />
        <SelectField label="Type of test" value={test.testType} options={types} onChange={(testType) => update({ testType })} />
      </div>

      <DraftField label="Objective" value={test.objective} rows={2} placeholder="No objective yet" onSave={(objective) => update({ objective })} />

      <div className="interface-form-row interface-form-row-wide-first">
        <IdOrText
          label="Program under test"
          id={test.programId}
          text={test.programText}
          options={programs}
          placeholder="Name of the program"
          hint={
            test.programId ? (
              <Link to={`/programs/${test.programId}`}>Open its program specification</Link>
            ) : programs.length === 0 ? (
              'The project has no structure chart, so type the name of the program.'
            ) : undefined
          }
          onChange={(programId, programText) => update({ programId, programText })}
        />
        <DraftField label="Version" value={test.version} onSave={(version) => update({ version })} />
      </div>

      <IdOrText
        label="Requirement addressed"
        id={test.requirementId}
        text={test.requirementText}
        options={requirements}
        placeholder="The requirement, in words"
        hint={
          test.requirementId ? (
            <>
              {get(model, test.requirementId, 'requirement')?.name} <Link to="/requirements">Open the requirements definition</Link>
            </>
          ) : requirements.length === 0 ? (
            'The project has no requirements definition, so type the requirement.'
          ) : undefined
        }
        onChange={(requirementId, requirementText) => update({ requirementId, requirementText })}
      />

      <div className="interface-form-row interface-form-row-three">
        <DraftField label="Tester" value={test.tester} onSave={(tester) => update({ tester })} />
        <DraftField label="Date designed" value={test.dateDesigned} placeholder="Such as 2027-03-14" onSave={(dateDesigned) => update({ dateDesigned })} />
        <DraftField label="Date conducted" value={test.dateConducted} placeholder="Not conducted yet" onSave={(dateConducted) => update({ dateConducted })} />
      </div>

      <div>
        <div className="table-caption">Test cases</div>
        <EditableRows<TestCase>
          label="Test cases"
          rows={test.testCases}
          emptyText="No test cases yet"
          addLabel="Add a test case"
          newRow={() => ({ interfaceId: null, interfaceText: '', dataField: '', valueEntered: '' })}
          onChange={(testCases) => update({ testCases })}
          hideHeadings
          columns={[
            {
              key: 'case',
              heading: 'Test case',
              render: (row, index, set) => (
                <div className="interface-case">
                  <IdOrText
                    label="Interface"
                    id={row.interfaceId}
                    text={row.interfaceText}
                    options={interfaces}
                    placeholder="Name of the interface"
                    onChange={(interfaceId, interfaceText) => set({ ...row, interfaceId, interfaceText })}
                  />
                  <div className="field">
                    <span className="field-label">Data field</span>
                    <CellText label={`Data field of test case ${index + 1}`} value={row.dataField} onCommit={(dataField) => set({ ...row, dataField })} />
                  </div>
                  <div className="field interface-case-value">
                    <span className="field-label">Value entered</span>
                    <CellText label={`Value entered in test case ${index + 1}`} value={row.valueEntered} rows={2} onCommit={(valueEntered) => set({ ...row, valueEntered })} />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      <DraftField
        label="Script"
        value={test.script}
        rows={4}
        placeholder="No script yet"
        hint="The keys pressed and the mouse clicks, in order. A test needs test cases or a script."
        onSave={(script) => update({ script })}
      />
      <DraftField label="Expected results" value={test.expectedResults} rows={3} placeholder="No expected results yet" onSave={(expectedResults) => update({ expectedResults })} />
      <DraftField label="Actual results" value={test.actualResults} rows={3} placeholder="Not conducted yet" onSave={(actualResults) => update({ actualResults })} />
      <div className="interface-form-row">
        <SelectField<Test['result']>
          label="Result"
          value={test.result}
          options={[
            { value: '', label: 'Not conducted yet' },
            { value: 'passed', label: 'Passed' },
            { value: 'open items', label: 'Open items' },
          ]}
          onChange={(result) => update({ result })}
        />
      </div>

      <DeleteControl
        label="Delete this test"
        question={`Delete test T-${test.ordinal}, '${test.name}'?`}
        onDelete={() => {
          if (dispatch({ type: 'deleteElement', id: test.id }).ok) void navigate('/test-plan');
        }}
      />
    </div>
  );
}

// ---- The right panel ----

function Coverage({ model, tests, onAdd }: { model: Model; tests: Test[]; onAdd: (requirementId: Id, number: string) => void }) {
  const functional = requirementsOutline(model).functional.flatMap((g) => g.requirements);
  const open = functional.filter(({ requirement }) => !tests.some((t) => t.requirementId === requirement.id));
  return (
    <>
      <h2 className="panel-heading">Requirements with no test yet</h2>
      {functional.length === 0 ? (
        <div className="muted">The project has no functional requirements. A test can name its requirement in words.</div>
      ) : open.length === 0 ? (
        <div>
          A test addresses each of the <span className="count">{functional.length}</span> functional requirements.
        </div>
      ) : (
        <>
          <div className="muted">
            <span className="count">{open.length}</span> of <span className="count">{functional.length}</span> functional requirements. This is a list to work from, not a list of mistakes.
          </div>
          <table className="table interface-coverage">
            <thead>
              <tr>
                <th>No.</th>
                <th>Requirement</th>
                <th>
                  <span className="visually-hidden">Add a test</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {open.map(({ requirement, number }) => (
                <tr key={requirement.id}>
                  <td className="mono">{number}</td>
                  <td>{requirement.name}</td>
                  <td>
                    <Button small variant="link" aria-label={`Add a test for requirement ${number}`} onClick={() => onAdd(requirement.id, number)}>
                      Add a test
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/requirements">Open the requirements definition</Link>
        </>
      )}
    </>
  );
}

// ---- The screen ----

export function TestPlanScreen() {
  const model = useModel();
  const findings = useAreaFindings('testPlan');
  const { testId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'test' | 'plan'>('plan');

  const tests = testsInOrder(model);
  const test = testId ? get(model, testId, 'test') : tests[0];
  const own = test ? findingsForHome(findings, test.id) : [];

  const add = (patch: TestPatch & { name: string }) => {
    const result = dispatch({ type: 'addTest', ...patch });
    if (result.ok) void navigate(`/test-plan/${result.created[0]}`);
  };

  return (
    <>
      <TestList tests={tests} openId={test?.id} findings={findings} onAdd={(stage) => add({ name: 'New test', stage })} />
      <WorkArea>
        <PageHeader breadcrumb={test ? ['Implementation', { label: 'Test plan', to: '/test-plan' }, `T-${test.ordinal}`] : ['Implementation']} title={test ? test.name || 'Untitled test' : 'Test plan'}>
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          {test ? (
            <TestForm key={test.id} model={model} test={test} />
          ) : testId ? (
            <p className="placeholder">
              There is no test here. It may have been deleted. <Link to="/test-plan">Open the test plan</Link>
            </p>
          ) : (
            <div className="vstack interface-empty">
              <p className="placeholder">
                The test plan has no tests yet. A test says what is tested, the values entered or the steps followed, and the results expected. Tests are grouped by stage: unit, integration,
                system and acceptance.
              </p>
              <div>
                <Button variant="primary" onClick={() => add({ name: 'New test', stage: 'unit' })}>
                  Add the first test
                </Button>
              </div>
            </div>
          )}
        </div>
      </WorkArea>
      <RightPanel label="Problems, and requirements with no test">
        <h2 className="panel-heading">Problems</h2>
        {test && (
          <Tabs
            label="Which problems to show"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'plan', label: 'Whole plan', count: findings.length },
              { id: 'test', label: 'This test', count: own.length },
            ]}
          />
        )}
        {tests.length === 0 ? (
          <div className="muted">Nothing is checked until the plan has a test.</div>
        ) : (
          <ProblemList findings={test && tab === 'test' ? own : findings} emptyText={test && tab === 'test' ? 'No problems in this test.' : 'No problems in the test plan.'} />
        )}
        <hr className="interface-divider" />
        <Coverage model={model} tests={tests} onAdd={(requirementId, number) => add({ name: `Test of requirement ${number}`, requirementId })} />
      </RightPanel>
    </>
  );
}
