import { Paper, TextField } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { memo, useCallback, useMemo, useState } from "react";
import { Icon, ICONS_BY_ID } from "../icons";
import Character from "../token/Character";
import { ContentType, TokenContents } from "../../types";
import Draggable from "../drag/Draggable";
import { v4 as uuid } from "uuid";
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
  const onChange = useCallback((e) => setSearch(e.target.value), []);

  const items = useMemo(() => {
    return icons.map(
      (icon) =>
        ({
          id: uuid(),
          type: "character",
          contents: { type: ContentType.Icon, iconId: icon.id },
          source: "search tray",
        } as const)
    );
  }, [icons]);

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

  const textItem = !textContents
    ? undefined
    : ({
        type: "character",
        contents: textContents,
        id: uuid(),
        source: "search tray",
      } as const);

  return (
    <Paper className={classes.root} elevation={5}>
      <TextField
        id="search"
        fullWidth
        autoFocus
        variant="filled"
        margin="normal"
        label="search"
        autoComplete="off"
        onChange={onChange}
        onFocus={(e) => e.target.select()}
        value={search}
      />
      <div className={classes.tokenList}>
        {textItem && (
          <Draggable id={textItem.id} key={textItem.id} descriptor={textItem}>
            <Character contents={textItem.contents} />
          </Draggable>
        )}

        {visibleIconItems.map((item) => (
          <Draggable id={item.id} key={item.id} descriptor={item}>
            <Character contents={item.contents} />
          </Draggable>
        ))}
      </div>
    </Paper>
  );
});

export default SearchDialog;
