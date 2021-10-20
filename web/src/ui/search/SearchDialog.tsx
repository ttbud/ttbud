import { Paper, TextField } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { memo, useCallback, useMemo, useState } from "react";
import { Icon, ICONS_BY_ID } from "../icons";
import Draggable from "../../drag/Draggable";
import {
  DraggableDescriptor,
  DraggableType,
  DragStateType,
  TokenBlueprintDraggable,
} from "../../drag/DragStateTypes";
import { useSelector } from "react-redux";
import Character from "../token/Character";
import { assert } from "../../util/invariants";
import { RootState } from "../../store/rootReducer";
import { contentId, ContentType, TokenContents } from "../../types";
import { GRID_SIZE_PX } from "../../config";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    height: "100%",
    overflowY: "scroll",
    padding: theme.spacing(1),
  },
  tokenList: {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${GRID_SIZE_PX}px, 1fr))`,
    gridGap: theme.spacing(1),
    alignItems: "center",
    justifyContent: "center",
    justifyItems: "center",
  },
  token: {},
  search: {},
  icon: {
    color: "white",
  },
}));

interface Props {
  open: boolean;
  icons: Icon[];
  onClose: () => void;
}

const SearchDialog: React.FC<Props> = memo(({ icons, open, onClose }) => {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const onChange = useCallback((e) => setSearch(e.target.value), [setSearch]);

  const items: TokenBlueprintDraggable[] = useMemo(
    () =>
      icons.map((icon) => ({
        type: DraggableType.TokenBlueprint,
        contents: { type: ContentType.Icon, iconId: icon.id },
        id: `search-dialog-${icon.id}`,
      })),
    [icons]
  );

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
        id: `search-dialog-${contentId(textContents)}`,
      };

  const renderDialog = () => (
    <Paper className={classes.root} elevation={5}>
      <TextField
        id="search"
        autoComplete="off"
        fullWidth
        autoFocus
        className={classes.search}
        variant="filled"
        margin="normal"
        label="search"
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
                className={classes.token}
                contents={textItem.contents}
                isDragging={isDragging}
              />
            )}
          </Draggable>
        )}

        {visibleIconItems.map((item) => (
          <Draggable key={item.id} descriptor={item}>
            {(isDragging, attributes) => (
              <Character
                dragAttributes={attributes}
                className={classes.token}
                contents={item.contents}
                isDragging={isDragging}
              />
            )}
          </Draggable>
        ))}
      </div>
    </Paper>
  );

  return open ? renderDialog() : null;
});

export default SearchDialog;
