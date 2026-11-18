// The symbols, the marks and the rules. Route: /help

import { Fragment, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Mark, Missing, Tabs, TextField } from '../../components';
import { PageHeader, WorkArea } from '../../frame';
import { RULE_LIST, type RuleInfo } from '../../rules';
import { useFindings, useFindingsVisible } from '../../store';
import {
  EndPicture,
  EntityPicture,
  ExternalPicture,
  FlowPicture,
  IdentifierPicture,
  ProcessPicture,
  RepeatingPicture,
  StorePicture,
} from './drawings';
import { familyOf, plural } from './shared';
import './project.css';

const FAMILY_TITLES: Record<string, string> = {
  DFD: 'Data flow diagram rules',
  DD: 'Data dictionary rules',
  BAL: 'Balancing rules',
  ERD: 'Entity relationship diagram rules',
  DM: 'Rules that compare the data model with the diagrams',
};

type Filter = 'all' | 'error' | 'warning';

/** Shows a message such as "'{name}' has no description." with each blank in italics. */
function Template({ text }: { text: string }) {
  return (
    <>
      {text.split(/\{(\w+)\}/).map((part, i) =>
        i % 2 ? (
          <em key={i} className="project-blank">
            {part}
          </em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Symbol({ picture, name, children }: { picture: ReactNode; name: string; children: ReactNode }) {
  return (
    <div className="project-symbol">
      {picture}
      <div>
        <div className="project-symbol-name">{name}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function RuleEntry({ rule, count }: { rule: RuleInfo; count: number | null }) {
  return (
    <div className="project-rule">
      <div className="project-rule-head">
        <span className="mono project-rule-code">{rule.id}</span>
        <Mark kind={rule.severity} word />
        {rule.provisional && <span className="muted">Provisional wording</span>}
        <span className="grow" />
        {count === null ? (
          <span className="muted">Problems hidden</span>
        ) : count > 0 ? (
          <Link to="/problems" className="project-rule-count">
            <span className="count">{count}</span> in this project
          </Link>
        ) : (
          <span className="muted">
            <span className="count">0</span> in this project
          </span>
        )}
      </div>
      <dl className="project-rule-body">
        <dt>When</dt>
        <dd>{rule.when}.</dd>
        <dt>Message</dt>
        <dd>
          <Template text={rule.message} />
        </dd>
        <dt>Why</dt>
        <dd>{rule.why}.</dd>
        <dt>How to fix</dt>
        <dd>{rule.fix}.</dd>
      </dl>
    </div>
  );
}

export function HelpScreen() {
  const findings = useFindings();
  const visible = useFindingsVisible();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const body = useRef<HTMLDivElement>(null);

  const jump = (id: string) => body.current?.querySelector(`#${id}`)?.scrollIntoView({ block: 'start' });

  // While the problems are held back, a count of 0 would give the answer away wrongly.
  const countOf = (ruleId: string) => (visible ? findings.filter((f) => f.ruleId === ruleId).length : null);

  const words = search.trim().toLowerCase();
  const matches = RULE_LIST.filter(
    (rule) =>
      (filter === 'all' || rule.severity === filter) &&
      (!words || [rule.id, rule.when, rule.message, rule.why, rule.fix].some((text) => text.toLowerCase().includes(words))),
  );
  const families: string[] = [];
  for (const rule of RULE_LIST) if (!families.includes(familyOf(rule.id))) families.push(familyOf(rule.id));

  return (
    <WorkArea>
      <PageHeader breadcrumb={['Help']} title="Symbols and rules">
        <Button small onClick={() => jump('project-help-symbols')}>
          Symbols
        </Button>
        <Button small onClick={() => jump('project-help-marks')}>
          Marks
        </Button>
        <Button small onClick={() => jump('project-help-rules')}>
          Rules
        </Button>
        <Button small onClick={() => jump('project-help-balancing')}>
          Balancing
        </Button>
        <Button small onClick={() => jump('project-help-projects')}>
          Projects
        </Button>
      </PageHeader>
      <div className="work-body scroll pad" ref={body}>
        <div className="project-column">
          <section id="project-help-symbols" className="project-help-section">
            <h2 className="project-help-heading">Symbols</h2>
            <h3 className="project-help-subheading">On a data flow diagram</h3>
            <div className="project-symbols">
              <Symbol picture={<ProcessPicture />} name="Process">
                Work the system does that turns data coming in into data going out. Its number sits in the band across the top.
              </Symbol>
              <Symbol picture={<StorePicture />} name="Data store">
                Data the system keeps so that a process can use it later. Its label, such as D1, sits in the box at its left end.
              </Symbol>
              <Symbol picture={<ExternalPicture />} name="External entity">
                A person, organisation or other system outside the system that sends it data or receives data from it.
              </Symbol>
              <Symbol picture={<FlowPicture />} name="Data flow">
                Data moving from one place to another, in the direction of the arrowhead. Its label is the name of the data it
                carries.
              </Symbol>
              <Symbol picture={<FlowPicture dotted />} name="Control flow">
                An event that starts a process without carrying any data, such as the end of the day. It is a dotted line into
                the process.
              </Symbol>
            </div>

            <h3 className="project-help-subheading">On an entity relationship diagram</h3>
            <div className="project-symbols">
              <Symbol picture={<EntityPicture />} name="Entity">
                A person, place, event or thing the system keeps data about. Its attributes, the pieces of data kept about it,
                are listed in the box. A double border means the entity cannot be identified without its parent.
              </Symbol>
              <Symbol picture={<IdentifierPicture />} name="Identifier">
                The attribute, or attributes, that tell one instance of the entity from another. Each is marked with an asterisk
                and listed first, above a dashed line.
              </Symbol>
              <Symbol picture={<EndPicture min={1} max="one" label="Exactly one: two bars" />} name="Exactly one">
                Two bars. One and only one of this entity goes with each of the other.
              </Symbol>
              <Symbol picture={<EndPicture min={0} max="one" label="Zero or one: a bar, then a circle" />} name="Zero or one">
                A bar, then a circle. At most one of this entity goes with each of the other, and there may be none.
              </Symbol>
              <Symbol picture={<EndPicture min={1} max="many" label="One or many: a crow's foot, then a bar" />} name="One or many">
                A crow&rsquo;s foot, then a bar. At least one of this entity goes with each of the other, and there may be many.
              </Symbol>
              <Symbol
                picture={<EndPicture min={0} max="many" label="Zero or many: a crow's foot, then a circle" />}
                name="Zero or many"
              >
                A crow&rsquo;s foot, then a circle. Any number of this entity goes with each of the other, including none.
              </Symbol>
              <Symbol picture={<EndPicture min={null} max={null} label="Not decided yet: a question mark" />} name="Not decided yet">
                A question mark. Nobody has said yet how many of this entity go with each of the other. When only the most
                or only the least is undecided, the question mark takes the place of that one symbol.
              </Symbol>
              <Symbol picture={<RepeatingPicture />} name="Repeating attribute">
                An attribute written in braces can hold several values for one instance of the entity, such as the
                instruments one student plays. It is a sign that the entity is not yet in normal form.
              </Symbol>
            </div>
            <p className="muted project-help-note">
              Read the symbols at an entity&rsquo;s end of the line as how many of that entity go with one of the entity at the
              other end. The symbol next to the box is the most, and the symbol beyond it is the least.
            </p>
          </section>

          <section id="project-help-marks" className="project-help-section">
            <h2 className="project-help-heading">Marks</h2>
            <p className="muted">Each mark means one thing, and appears only where it means that.</p>
            <table className="table project-marks">
              <thead>
                <tr>
                  <th>Mark</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Mark kind="error" word />
                  </td>
                  <td>A rule found something that breaks the method. A number after the mark says how many.</td>
                </tr>
                <tr>
                  <td>
                    <Mark kind="warning" word />
                  </td>
                  <td>A rule found something that is probably a mistake, but may be what you meant.</td>
                </tr>
                <tr>
                  <td>
                    <Mark kind="ok" />
                  </td>
                  <td>The rules ran and found nothing wrong with this item.</td>
                </tr>
                <tr>
                  <td>
                    <Missing>No description yet</Missing>
                  </td>
                  <td>Something the rules ask for has been left empty. The words say what is missing.</td>
                </tr>
                <tr>
                  <td>
                    <Mark kind="ai" />
                  </td>
                  <td>This text was written by an AI model. It always sits in a box with a dashed border.</td>
                </tr>
              </tbody>
            </table>
            <p className="muted project-help-note">
              A control that cannot be used right now fades to grey. Nothing in the app has a due date or a status of its own:
              the only status is whether the rules found problems.
            </p>
          </section>

          <section id="project-help-rules" className="project-help-section">
            <h2 className="project-help-heading">
              Rules <span className="count">{RULE_LIST.length}</span>
            </h2>
            <div className="project-rule-tools">
              <div className="project-rule-search">
                <TextField
                  label="Search the rules"
                  hideLabel
                  value={search}
                  onChange={setSearch}
                  placeholder="Search the rules, such as BAL or description"
                />
              </div>
              <div className="project-filter">
                <Tabs
                  label="Which rules to show"
                  value={filter}
                  onChange={setFilter}
                  tabs={[
                    { id: 'all', label: 'All', count: RULE_LIST.length },
                    { id: 'error', label: 'Errors', count: RULE_LIST.filter((r) => r.severity === 'error').length },
                    { id: 'warning', label: 'Warnings', count: RULE_LIST.filter((r) => r.severity === 'warning').length },
                  ]}
                />
              </div>
            </div>
            {matches.length === 0 && (
              <p className="muted">
                No rule matches{words ? ` “${search.trim()}”` : ''}. {plural(RULE_LIST.length, 'rule')} in all.
              </p>
            )}
            {families.map((family) => {
              const rules = matches.filter((rule) => familyOf(rule.id) === family).sort((a, b) => a.id.localeCompare(b.id));
              if (rules.length === 0) return null;
              return (
                <div key={family} className="project-family">
                  <h3 className="project-help-subheading">
                    <span className="mono">{family}</span> {FAMILY_TITLES[family] ?? 'Rules'} <span className="count">{rules.length}</span>
                  </h3>
                  {rules.map((rule) => (
                    <RuleEntry key={rule.id} rule={rule} count={countOf(rule.id)} />
                  ))}
                </div>
              );
            })}
          </section>

          <section id="project-help-balancing" className="project-help-section">
            <h2 className="project-help-heading">How balancing works</h2>
            <p>
              A child diagram is a closer look at one process, so the data that enters and leaves that process on the parent
              diagram must also cross the edge of the child diagram. Diagramble does not compare the names of the flows. It looks
              each flow up in the data dictionary and compares what the flows are made of, down to single data elements.
            </p>
            <p>
              This means a parent flow may be split into its parts on the child diagram and still balance. If the dictionary
              says &ldquo;Order&rdquo; is made of &ldquo;Customer Details&rdquo; and &ldquo;Order Lines&rdquo;, then one
              &ldquo;Order&rdquo; flow on the parent balances with those two flows on the child.
            </p>
            <p>
              Data on the parent that is missing from the child is an error (<span className="mono">BAL-01</span> and{' '}
              <span className="mono">BAL-02</span>). Data the child adds is only a warning (<span className="mono">BAL-03</span>),
              because a child diagram is allowed to show more detail than its parent.
            </p>
          </section>

          <section id="project-help-projects" className="project-help-section">
            <h2 className="project-help-heading">Projects and starter cases</h2>
            <p>
              A project holds one scenario: a single business case and all the diagrams, definitions and forms drawn for it.
              Start a new project for each exercise that has its own scenario, and stay in the same project for exercises
              that build on earlier work for the same business.
            </p>
            <p>
              A starter case is a project to begin from, such as a diagram to correct or a file to normalize. Opening one
              gives you your own copy, and you may change or delete anything in it.
            </p>
            <p>
              The top diagram is the highest diagram the project is expected to contain. When an exercise asks for a level 0
              diagram alone, the level 0 diagram is made the top, and the rules say nothing about the context diagram above
              it.
            </p>
            <p>
              A project can also hold its problems back until you choose &ldquo;Check now&rdquo;, which suits an exercise
              that asks you to find the mistakes yourself. Both settings, and the starter cases, are on the{' '}
              <Link to="/project">Project page</Link>.
            </p>
          </section>
        </div>
      </div>
    </WorkArea>
  );
}
