import { Paper } from "@mui/material";
import React, { memo, useRef, useMemo } from "react";
import { contentId, TokenContents } from "../../types";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import FloorButton from "./FloorButton";
import Sortable from "../drag/Sortable";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/rootReducer";
import { TokenBlueprint } from "./types";
import {
  addFloor,
  moveFloor,
  removeFloor,
  setActiveFloor,
} from "./floor-tray-slice";
import useDropMonitor from "../drag/useDropMonitor";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { assert } from "../../util/invariants";
import { useDroppable } from "@dnd-kit/core";

const FloorTray: React.FC = memo(() => {
  const { setNodeRef } = useDroppable({ id: "floor tray" });
  const { activeFloor, floorBlueprints: blueprints } = useSelector<
    RootState,
    { activeFloor: TokenContents; floorBlueprints: TokenBlueprint[] }
  >((state) => state.floorTray, shallowEqual);
  const dispatch = useDispatch();

  useDropMonitor("floor tray", (event) => {
    switch (event.type) {
      case "dropped into":
        dispatch(
          addFloor({
            idx: event.toIdx!,
            blueprint: {
              id: event.dragId,
              contents: event.descriptor.contents,
            },
          })
        );
        break;
      case "moved inside":
        dispatch(
          moveFloor({
            toIdx: event.toIdx!,
            fromIdx: event.fromIdx!,
          })
        );
        break;
      case "dragged from":
        assert(false, "AHHHHH");
        break;
      default:
        throw new UnreachableCaseError(event);
    }
  });

  const items = useMemo(() => {
    return blueprints.map((bp) => ({
      id: bp.id,
      descriptor: {
        type: "floor",
        contents: bp.contents,
        source: "floor tray",
      } as const,
    }));
  }, [blueprints]);

  const onDelete = (idx: number) => {
    if (blueprints.length > 2) {
      dispatch(removeFloor(idx));
    }
  };

  return (
    <Paper ref={setNodeRef} data-tour="floor-tray" aria-label="Floor Tray">
      <SortableContext
        id="floor tray"
        items={items}
        strategy={horizontalListSortingStrategy}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
          }}
        >
          {items.map((item, idx) => {
            return (
              <Sortable key={item.id} id={item.id} data={item.descriptor}>
                <FloorButton
                  selected={
                    contentId(activeFloor) ===
                    contentId(item.descriptor.contents)
                  }
                  content={item.descriptor.contents}
                  onFloorSelected={() =>
                    dispatch(setActiveFloor(item.descriptor.contents))
                  }
                  onDelete={() => onDelete(idx)}
                />
              </Sortable>
            );
          })}
        </div>
      </SortableContext>
    </Paper>
  );
});

export default FloorTray;
