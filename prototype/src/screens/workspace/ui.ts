// What the canvas's nodes and edges need from the screen, passed down by context.

import { createContext, useContext } from 'react';
import type { Id } from '../../model';

export type Tool = 'select' | 'process' | 'dataStore' | 'externalEntity' | 'dataFlow' | 'controlFlow';

export interface CanvasUi {
  tool: Tool;
  /** The id of the node or control flow whose name is being edited in place, or null. */
  editing: string | null;
  setEditing: (id: string | null) => void;
  /** The flows dimmed by the fragment view. Their labels are dimmed with them. */
  dimmedFlows: ReadonlySet<Id>;
  /** Starts changing what a flow carries (a data flow) or its name (a control flow). */
  editFlow: (flowId: Id, clientX: number, clientY: number) => void;
  openDiagram: (diagramId: Id) => void;
}

export const CanvasUiContext = createContext<CanvasUi>({
  tool: 'select',
  editing: null,
  setEditing: () => {},
  dimmedFlows: new Set(),
  editFlow: () => {},
  openDiagram: () => {},
});

export function useCanvasUi(): CanvasUi {
  return useContext(CanvasUiContext);
}
