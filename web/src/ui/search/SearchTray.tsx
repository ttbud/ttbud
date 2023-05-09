import React, { memo, useCallback, useMemo, useState } from "react";
import { Icon, ICONS_BY_ID } from "../icons";
import Character from "../token/Character";
import { contentId, ContentType, TokenContents } from "../../types";
import Draggable from "../../drag/Draggable";
import { GRID_SIZE_PX } from "../../config";
import { IconButton, makeStyles, Paper, TextField } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import {
  DraggableDescriptor,
  DraggableType,
  DragStateType,
  TokenBlueprintDraggable,
} from "../../drag/DragStateTypes";
import { useSelector } from "react-redux";
import { RootState } from "../../store/rootReducer";
import { assert } from "../../util/invariants";
import { DROPPABLE_IDS } from "../DroppableIds";
import Droppable from "../../drag/Droppable";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  searchInput: {
    margin: `4px
    ${theme.spacing(2)}px
    ${theme.spacing(1)}px
    ${theme.spacing(2)}px`,
    position: "sticky",
    width: `calc(100% - ${theme.spacing(4)}px)`,
  },
  tokenList: {
    display: "grid",
    gap: theme.spacing(2),
    gridTemplateColumns: `repeat(auto-fill, ${GRID_SIZE_PX}px)`,
    alignItems: "center",
    justifyContent: "center",
    justifyItems: "center",
    overflowY: "scroll",
    padding: `0 ${theme.spacing(1)}px 0 ${theme.spacing(1)}px`,
  },
  icon: {
    color: "white",
  },
  searchButtonWrapper: {
    zIndex: -1,
    position: "absolute",
    top: 0,
    left: "100%",
    filter: "drop-shadow(0px 2px 5px #00000024)",
  },
  searchButton: {
    transform: "translate(-3px,0)",
    clipPath: "polygon(75% 0%, 100% 50%, 75% 100%, 0% 100%, 0 50%, 0% 0%)",
    backgroundColor: "white",
    // backgroundColor: theme.palette.primary.main,
  },
  searchButtonIcon: {
    transform: "translate(-3px, 0px)",
    // color: "white",
  },
}));

interface Props {
  open: boolean;
  icons: Icon[];
  onSearchClicked: () => void;
}

const SearchTray: React.FC<Props> = memo(({ icons, open, onSearchClicked }) => {
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
      <Droppable id={DROPPABLE_IDS.SEARCH_TRAY} getLocation={() => undefined}>
        {(attributes) => (
          <>
            <div className={classes.searchButtonWrapper}>
              <div className={classes.searchButton}>
                <IconButton
                  onClick={onSearchClicked}
                  aria-label="search"
                  className={classes.searchButtonIcon}
                >
                  {open ? <ChevronLeft /> : <SearchIcon />}
                </IconButton>
              </div>
            </div>
            <Paper {...attributes} className={classes.root} elevation={5}>
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
                size="small"
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
          </>
        )}
      </Droppable>
      {activeDraggable && renderDraggable()}
    </>
  );
});

export default SearchTray;
