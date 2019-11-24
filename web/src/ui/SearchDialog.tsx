import {
  Dialog,
  DialogContent,
  DialogTitle,
  GridList,
  makeStyles,
  TextField
} from "@material-ui/core";
import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "./icons";
import { List } from "immutable";
import CardToken from "./token/CardToken";
import { GRID_SIZE_PX } from "../config";

const useStyles = makeStyles({
  tokenList: {
    width: GRID_SIZE_PX * 5,
    height: GRID_SIZE_PX * 5
  },
  search: {
    width: GRID_SIZE_PX * 5
  },
  icon: {
    color: "white"
  }
});

interface Props {
  open: boolean;
  onLostFocus: () => void;
  onTokenPlaced: (icon: Icon, x: number, y: number) => void;
  icons: List<Icon>;
}

interface DragState {
  icon: Icon;
  startPos: { x: number; y: number };
  startMousePos: { x: number; y: number };
}

const SearchDialog: React.FC<Props> = props => {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const [dragState, setDraggingState] = useState<DragState | null>(null);
  const onChange = useCallback(e => setSearch(e.target.value), [setSearch]);

  const icons = useMemo(() => {
    return search
      ? props.icons.filter(icon => icon.desc.indexOf(search) !== -1)
      : props.icons;
  }, [search, props.icons]);

  if (dragState) {
    return (
      <div
        style={{ position: "absolute", visibility: "visible", zIndex: 1000 }}
      >
        <CardToken
          icon={dragState.icon}
          pos={{ z: 1000, ...dragState.startPos }}
          startWithDragAt={{ z: 0, ...dragState.startMousePos }}
          onDropped={(x, y) => {
            props.onTokenPlaced(dragState.icon, x, y);
            setDraggingState(null);
          }}
        />
      </div>
    );
  } else {
    return (
      <Dialog
        open={props.open}
        onClose={props.onLostFocus}
      >
        <DialogTitle>
          <TextField
            autoFocus={true}
            className={classes.search}
            variant="filled"
            margin="normal"
            label="search"
            onChange={onChange}
            onFocus={e => e.target.select()}
            value={search}
          />
        </DialogTitle>
        <DialogContent>
          <GridList cols={5} cellHeight="auto" className={classes.tokenList}>
            {icons.map(icon => (
              <CardToken
                key={icon.id}
                icon={icon}
                pos={{ x: 0, y: 0, z: 0 }}
                onDragStart={e => {
                  const target = e.target as HTMLElement;
                  const rect = target.getBoundingClientRect();
                  setDraggingState({
                    icon: icon,
                    startPos: { x: rect.left, y: rect.top },
                    startMousePos: { x: e.clientX, y: e.clientY }
                  });
                }}
              />
            ))}
          </GridList>
        </DialogContent>
      </Dialog>
    );
  }
};

export default SearchDialog;
