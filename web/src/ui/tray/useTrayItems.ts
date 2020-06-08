import * as React from "react";
import { contentId, TokenContents } from "../../types";
import {
  DraggableType,
  TokenBlueprintDraggable,
} from "../../drag/DragStateTypes";
import { createRef, useMemo } from "react";
import { assert } from "../../util/invariants";
import assignRef from "../../util/assignRef";

interface TrayItem {
  blueprint: TokenContents;
  descriptor: TokenBlueprintDraggable;
  /**
   * Create a react ref that both assigns the draggable ref
   * and assigns the item ref so the draggable and the tray
   * can have a ref to the same component
   */
  makeRef: (dragRef: React.Ref<any>) => React.Ref<any>;
  ref: React.RefObject<any>;
}

/**
 * Given a droppable id and a set of blueprints, create the draggable descriptors
 * and refs needed to render a draggable item tray for them
 */
export default function useTrayItems(
  droppableId: string,
  blueprints: TokenContents[]
): TrayItem[] {
  const blueprintRefs = useMemo(() => {
    const refs = new Map<string, React.MutableRefObject<HTMLElement | null>>();
    for (const blueprint of blueprints) {
      refs.set(contentId(blueprint), createRef<HTMLElement>());
    }
    return refs;
  }, [blueprints]);

  return useMemo(
    () =>
      blueprints.map((blueprint) => {
        const blueprintId = contentId(blueprint);
        const ref = blueprintRefs.get(blueprintId);
        assert(
          ref,
          `Unable to find blueprint ref for blueprint id ${blueprintId}`
        );

        return {
          blueprint,
          descriptor: {
            type: DraggableType.TokenBlueprint,
            id: `${droppableId}-${blueprintId}`,
            contents: blueprint,
          } as TokenBlueprintDraggable,
          makeRef: (dragRef: React.Ref<HTMLElement> | undefined) => (
            el: HTMLElement
          ) => {
            assignRef(ref, el);
            assignRef(dragRef, el);
          },
          ref: ref,
        };
      }),
    [blueprints, blueprintRefs, droppableId]
  );
}
