import React, { memo, useCallback, useMemo, useState } from "react";
import { Icon, ICONS_BY_ID } from "../icons";
import Character from "../token/Character";
import { contentId, ContentType, TokenContents } from "../../types";
import Draggable from "../../drag/Draggable";
import { GRID_SIZE_PX } from "../../config";
import { makeStyles, Paper, TextField } from "@material-ui/core";
import {
  DraggableDescriptor,
  DraggableType,
  DragStateType,
  TokenBlueprintDraggable,
} from "../../drag/DragStateTypes";
import { useSelector } from "react-redux";
import { RootState } from "../../store/rootReducer";
import { assert } from "../../util/invariants";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    overflowY: "scroll",
    padding: theme.spacing(2),
  },
  searchInput: {
    marginBottom: theme.spacing(1),
  },
  tokenList: {
    display: "grid",
    gap: theme.spacing(2),
    gridTemplateColumns: `repeat(auto-fill, ${GRID_SIZE_PX}px)`,
    alignItems: "center",
    justifyContent: "center",
    justifyItems: "center",
  },
  icon: {
    color: "white",
  },
}));

interface Props {
  open: boolean;
  icons: Icon[];
  onClose: () => void;
}

const SearchTray: React.FC<Props> = memo(({ icons, open, onClose }) => {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const onChange = useCallback((e) => setSearch(e.target.value), []);

  const items: TokenBlueprintDraggable[] = useMemo(
    () =>
      icons.map((icon) => ({
        type: DraggableType.TokenBlueprint,
        contents: { type: ContentType.Icon, iconId: icon.id },
        id: `search-tray-${icon.id}`,
      })),
    [icons]
  );

  const activeDraggable = useSelector((state: RootState) => {
    if (
      !open ||
      state.drag.type === DragStateType.NotDragging ||
      state.drag.source.id !== undefined
    ) {
      return;
    }

    return state.drag.draggable;
  });

  const visibleIconItems = useMemo(() => {
    return search
      ? items.filter(
          (item) =>
            item.contents.type === ContentType.Icon &&
            ICONS_BY_ID.get(item.contents.iconId)!.desc.indexOf(search) !== -1
        )
      : items;
  }, [search, items]);

  const textContents: TokenContents | undefined =
    search.length > 0 && search.length <= 2
      ? { type: ContentType.Text, text: search }
      : undefined;

  const textItem: DraggableDescriptor | undefined = !textContents
    ? undefined
    : {
        type: DraggableType.TokenBlueprint,
        contents: textContents,
        id: `search-tray-${contentId(textContents)}`,
      };

  const renderDraggable = () => {
    assert(
      activeDraggable,
      "Cannot render draggable when there is no active draggable"
    );

    return (
      <Draggable
        key={`search-tray-${contentId(activeDraggable.contents)}`}
        descriptor={activeDraggable}
        usePortal={true}
      >
        {(isDragging, attributes) => (
          <Character
            dragAttributes={attributes}
            contents={activeDraggable.contents}
            isDragging={isDragging}
          />
        )}
      </Draggable>
    );
  };

  return (
    <>
      <Paper className={classes.root} elevation={5}>
        <TextField
          className={classes.searchInput}
          id="search"
          fullWidth
          variant="filled"
          margin="none"
          label="search"
          autoComplete="off"
          onChange={onChange}
          onFocus={(e) => e.target.select()}
          value={search}
        />
        <div className={classes.tokenList}>
          {textItem && (
            <Draggable key={textItem.id} descriptor={textItem}>
              {(isDragging, attributes) => (
                <Character
                  dragAttributes={attributes}
                  contents={textItem.contents}
                  isDragging={isDragging}
                />
              )}
            </Draggable>
          )}

          {visibleIconItems.map((item) => {
            let newItem: TokenBlueprintDraggable;
            if (item.id === activeDraggable?.id) {
              newItem = {
                type: item.type,
                id: "dragging-search-item",
                contents: item.contents,
              };
            } else {
              newItem = item;
            }
            return (
              <Draggable key={newItem.id} descriptor={newItem}>
                {(isDragging, attributes) => (
                  <Character
                    dragAttributes={attributes}
                    contents={newItem.contents}
                    isDragging={isDragging}
                  />
                )}
              </Draggable>
            );
          })}
        </div>
      </Paper>
      {activeDraggable && renderDraggable()}
    </>
  );
});

export default SearchTray;
