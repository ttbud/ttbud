import {
  Dialog,
  DialogContent,
  DialogTitle,
  makeStyles,
  TextField
} from "@material-ui/core";
import React, { memo, useCallback, useMemo, useState } from "react";
import { List } from "immutable";
import { Icon } from "../icons";
import Draggable from "../drag/Draggable";
import {
  DraggableType,
  DragStateType,
  IconDraggable
} from "../drag/DragStateTypes";
import { useSelector } from "react-redux";
import Character from "../token/Character";
import { assert } from "../../util/invariant";
import { RootState } from "../../state/rootReducer";

const useStyles = makeStyles(theme => ({
  content: {
    width: "300px",
    height: "300px"
  },
  tokenList: {
    display: "flex",
    flexWrap: "wrap"
  },
  token: {
    margin: theme.spacing(1)
  },
  search: {},
  icon: {
    color: "white"
  }
}));

interface Props {
  open: boolean;
  icons: List<Icon>;
  onClose: () => void;
}

const SearchDialog: React.FC<Props> = memo(({ icons, open, onClose }) => {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const onChange = useCallback(e => setSearch(e.target.value), [setSearch]);

  const items: List<IconDraggable> = useMemo(
    () =>
      icons.map(icon => ({
        type: DraggableType.ICON,
        icon,
        id: `search-dialog-${icon.id}`
      })),
    [icons]
  );

  const activeDraggable = useSelector((state: RootState) => {
    if (!open || state.drag.type === DragStateType.NOT_DRAGGING) {
      return;
    }

    return state.drag.draggable;
  });

  const visibleItems = useMemo(() => {
    return search
      ? items.filter(item => item.icon.desc.indexOf(search) !== -1)
      : items;
  }, [search, items]);

  const renderDraggable = () => {
    assert(
      activeDraggable,
      "Cannot render draggable when there is no active draggable"
    );

    return (
      <Draggable
        key={`search-dialog-${activeDraggable.icon}`}
        descriptor={activeDraggable}
        usePortal={true}
      >
        {(isDragging, attributes) => (
          <Character
            {...attributes}
            className={classes.token}
            icon={activeDraggable.icon}
            isDragging={isDragging}
          />
        )}
      </Draggable>
    );
  };

  const renderDialog = () => (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <TextField
          fullWidth
          autoFocus
          className={classes.search}
          variant="filled"
          margin="normal"
          label="search"
          onChange={onChange}
          onFocus={e => e.target.select()}
          value={search}
        />
      </DialogTitle>
      <DialogContent className={classes.content}>
        <div className={classes.tokenList}>
          {visibleItems.map(item => (
            <Draggable key={item.id} descriptor={item}>
              {(isDragging, attributes) => (
                <Character
                  {...attributes}
                  className={classes.token}
                  icon={item.icon}
                  isDragging={isDragging}
                />
              )}
            </Draggable>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  return activeDraggable ? renderDraggable() : renderDialog();
});

export default SearchDialog;
