import { makeStyles, Paper } from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import React, { createRef, memo, useCallback, useMemo, useRef } from "react";
import { CARD_SIZE } from "../../config";
import {
  DraggableDescriptor,
  DraggableType,
  TokenSourceDraggable,
} from "../../drag/DragStateTypes";
import { assert } from "../../util/invariants";
import { Bounds } from "../../util/shape-math";
import { DROPPABLE_IDS } from "../DroppableIds";
import { ICONS_BY_ID } from "../icons";
import SortableList, { Target, Targets } from "../sort/SortableList";
import { RootState } from "../../store/rootReducer";
import { removeIcon, setActiveFloor } from "./floor-tray-slice";
import { connect } from "react-redux";
import { contentId, ContentType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";

interface Props {
  sources: TokenContents[];
  activeFloor: TokenContents;
  onFloorSelected: (source: TokenContents) => void;
  onFloorRemoved: (source: TokenContents) => void;
}

const mapStateToProps = (state: RootState) => ({
  sources: state.floorTray.floorSources,
  activeFloor: state.floorTray.activeFloor,
});

const dispatchProps = {
  onFloorSelected: setActiveFloor,
  onFloorRemoved: removeIcon,
};

const useStyles = makeStyles({
  contents: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
});

const PureFloorTray: React.FC<Props> = memo(function FloorTray({
  sources,
  activeFloor,
  onFloorSelected,
  onFloorRemoved,
}) {
  const classes = useStyles();

  const containerRef = useRef<HTMLElement>();

  const sourceRefs = useMemo(() => {
    const refs = new Map<string, React.MutableRefObject<HTMLElement | null>>();
    for (const source of sources) {
      refs.set(contentId(source), createRef<HTMLElement>());
    }
    return refs;
  }, [sources]);

  const items = sources.map((source) => ({
    source,
    descriptor: {
      type: DraggableType.TokenSource,
      id: `${DROPPABLE_IDS.FLOOR_TRAY}-${contentId(source)}`,
      contents: source,
    } as TokenSourceDraggable,
  }));

  const getTargets = useCallback(
    (draggable: DraggableDescriptor, bounds: Bounds): Targets => {
      const existingElementsBounds = [];
      for (const itemRef of sourceRefs.values()) {
        assert(
          itemRef.current,
          "Floor tray item refs not set up correctly before drag"
        );
        existingElementsBounds.push(itemRef.current.getBoundingClientRect());
      }

      assert(
        containerRef.current,
        "Character tray container ref not set up correctly before drag"
      );
      const innerDragBounds: Target[] = [];
      for (let i = 0; i < existingElementsBounds.length; i++) {
        const current = existingElementsBounds[i];

        innerDragBounds.push({
          dropBounds: {
            top: current.top,
            left: current.left,
            bottom: current.bottom,
            right: current.right,
          },
          destination: {
            top: current.top,
            left: current.left,
            bottom: current.bottom,
            right: current.right,
          },
        });
      }

      const firstChildBounds = existingElementsBounds[0];
      assert(
        firstChildBounds,
        "Must always have at least one element in floor tray"
      );

      const childWidth = firstChildBounds.right - firstChildBounds.left;
      const childHeight = firstChildBounds.bottom - firstChildBounds.top;
      const widthDiff = childWidth - (bounds.right - bounds.left);
      const heightDiff = childHeight - (bounds.bottom - bounds.top);

      const outerDragBounds = innerDragBounds.map(
        ({ dropBounds, destination }) => ({
          dropBounds: {
            top: dropBounds.top,
            left: dropBounds.left + childWidth / 2,
            bottom: dropBounds.bottom,
            right: dropBounds.right + childWidth / 2,
          },
          destination: {
            top: destination.top + heightDiff / 2,
            left: destination.left + childWidth / 2 + widthDiff / 2,
            bottom: destination.bottom,
            right: destination.right + childWidth / 2,
          },
        })
      );

      const { dropBounds, destination } = outerDragBounds[0];

      outerDragBounds.unshift({
        dropBounds: {
          top: dropBounds.top,
          left: dropBounds.left - childWidth,
          bottom: dropBounds.bottom,
          right: dropBounds.right - childWidth,
        },
        destination: {
          top: destination.top,
          left: destination.left - childWidth,
          bottom: destination.bottom,
          right: destination.left,
        },
      });

      return {
        innerDrag: innerDragBounds,
        outerDrag: outerDragBounds,
      };
    },
    [sourceRefs]
  );

  const renderButtonContents = (contents: TokenContents) => {
    switch (contents.type) {
      case ContentType.Icon:
        const icon = ICONS_BY_ID.get(contents.iconId);
        assert(icon, `Icon id ${contents.iconId} is invalid`);
        return (
          <img
            src={icon.img}
            className={classes.contents}
            alt={icon.img}
            draggable={false}
          />
        );
      case ContentType.Text:
        return <div className={classes.contents}>{contents.text}</div>;
      default:
        throw new UnreachableCaseError(contents);
    }
  };

  return (
    <Paper ref={containerRef}>
      <SortableList
        id={DROPPABLE_IDS.FLOOR_TRAY}
        items={items}
        getTargets={getTargets}
        constrainDragsToContainer={true}
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        {(item, isDragging, attributes) => (
          <ToggleButton
            value={item.source}
            key={contentId(item.source)}
            selected={contentId(activeFloor) === contentId(item.source)}
            onChange={() => onFloorSelected(item.source)}
            onContextMenu={(e) => {
              if (sources.length > 2) {
                onFloorRemoved(item.source);
              }
              e.preventDefault();
            }}
            {...attributes}
            ref={(el: HTMLElement | null) => {
              sourceRefs.get(contentId(item.source))!.current = el;
              attributes.ref.current = el;
            }}
          >
            {renderButtonContents(item.source)}
          </ToggleButton>
        )}
      </SortableList>
    </Paper>
  );
});

const FloorTray = connect(mapStateToProps, dispatchProps)(PureFloorTray);

export default FloorTray;
export { PureFloorTray };
