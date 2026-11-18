// Screen 4 of docs/mockups/BRIEFS.md: the use case form. Routes: /use-cases and /use-cases/:id

import { useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button, Switch } from '../../components';
import { ListColumn, PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { all, elementLabel, get, processNumber, type Model, type UseCase } from '../../model';
import { dispatch, useModel } from '../../store';
import { UseCaseForm } from './Form';
import { LinksPanel } from './Links';
import { EventResponseView, PRIORITY_WORDS, UseCaseListView, VIEWS, type ViewId } from './Views';
import './usecases.css';

function secondLine(model: Model, uc: UseCase): string {
  const process = uc.processId ? `Process ${processNumber(model, uc.processId)}` : 'No process yet';
  return `${PRIORITY_WORDS[uc.priority]} · ${process}`;
}

export function UseCasesScreen() {
  const { id } = useParams();
  const model = useModel();
  const navigate = useNavigate();
  const location = useLocation();
  // The two views of the whole project are kept in the address as ?view=events or
  // ?view=list, because this screen has only the two routes. The use case that was
  // open stays in the path, so "Back" returns to it.
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: ViewId | null = viewParam === 'events' || viewParam === 'list' ? viewParam : null;

  const useCases = useMemo(() => all(model, 'useCase').sort((a, b) => a.ordinal - b.ordinal), [model]);
  const current = id ? get(model, id, 'useCase') : useCases[0];
  const isNew = (location.state as { newUseCase?: string } | null)?.newUseCase === current?.id;

  function addUseCase() {
    const result = dispatch({ type: 'addUseCase', name: 'New use case' });
    if (result.ok) navigate(`/use-cases/${result.created[0]}`, { state: { newUseCase: result.created[0] } });
  }

  const newButton = (
    <Button small onClick={addUseCase}>
      New use case
    </Button>
  );

  return (
    <>
      <ListColumn width={220} label="Use cases">
        <nav className="usecases-list-views" aria-label="Views of every use case">
          {VIEWS.map((v) => (
            <Link key={v.value} to={{ pathname: location.pathname, search: `?view=${v.value}` }} className={`row${view === v.value ? ' is-selected' : ''}`}>
              {v.label}
            </Link>
          ))}
        </nav>
        <div className="usecases-list-heading">Use cases</div>
        {useCases.map((uc) => (
          <Link key={uc.id} to={`/use-cases/${uc.id}`} className={`row usecases-list-row${!view && uc.id === current?.id ? ' is-selected' : ''}`}>
            <span className="usecases-list-name">
              <span className="muted mono">UC-{uc.ordinal}</span> {uc.name || <span className="missing">No name yet</span>}
            </span>
            <span className="muted usecases-list-second">{secondLine(model, uc)}</span>
          </Link>
        ))}
        <div className="usecases-list-foot">{newButton}</div>
      </ListColumn>

      {view ? (
        <WorkArea>
          <PageHeader breadcrumb={[{ label: 'Use cases', to: location.pathname }]} title={VIEWS.find((v) => v.value === view)!.label}>
            <Switch
              label="Which view of every use case"
              small
              options={VIEWS}
              value={view}
              onChange={(next) => navigate({ pathname: location.pathname, search: `?view=${next}` }, { replace: true })}
            />
            {current && (
              <Link className="btn btn-small" to={`/use-cases/${current.id}`}>
                Back to UC-{current.ordinal}
              </Link>
            )}
          </PageHeader>
          <div className="work-body scroll pad">{view === 'events' ? <EventResponseView model={model} /> : <UseCaseListView model={model} />}</div>
        </WorkArea>
      ) : (
        <>
          <WorkArea>
            <PageHeader breadcrumb={['Use cases']} title={current ? elementLabel(model, current.id) : 'Use cases'}>
              <UndoRedo />
            </PageHeader>
            {current ? (
              <div className="work-body scroll pad">
                <UseCaseForm key={current.id} useCase={current} isNew={isNew} />
              </div>
            ) : id ? (
              <div className="work-body pad">
                <p>There is no use case with the id '{id}'. It may have been deleted. Choose one from the list.</p>
              </div>
            ) : (
              <div className="work-body pad vstack">
                <p>This project has no use cases yet. A use case tells, step by step, one thing the system does for an actor.</p>
                <div>{newButton}</div>
              </div>
            )}
          </WorkArea>

          <RightPanel label="Links to the diagrams">
            {current ? <LinksPanel useCase={current} /> : <p className="muted">Open a use case to see how it links to the diagrams.</p>}
          </RightPanel>
        </>
      )}
    </>
  );
}
