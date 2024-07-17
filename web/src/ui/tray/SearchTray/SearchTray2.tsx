import { IconButton, Paper, TextField, makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../../config";
import { Icon } from "../../icons";
import { FocusEventHandler, memo, useCallback, useMemo, useState } from "react";
import SearchIcon from "@material-ui/icons/Search";
import {
  DraggableDescriptor,
  DraggableType,
  LocationType,
  TokenBlueprintDraggable,
} from "../../../drag/DragStateTypes";
import { ContentType, TokenContents, contentId } from "../../../types";
import { ChevronLeft } from "@material-ui/icons";
import Draggable2, { TokenDescriptor } from "../../../drag/Draggable2";
import Character2 from "../../token/Character2/Character2";
import { SearchTrayState } from "./useSearchTrayState";
import { Blueprint } from "../CharacterTray/CharacterTray2";

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
    padding: `
      0
      ${theme.spacing(1)}px
      ${theme.spacing(1)}px
      ${theme.spacing(1)}px
    `,
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
  state: SearchTrayState;
  onSearchClicked: () => void;
  onSearchTextChanged: (text: string) => void;
}

interface SearchTokenProps {
  idx: number;
  blueprint: Blueprint;
}

const SearchToken: React.FC<SearchTokenProps> = ({ idx, blueprint }) => {
  return (
    <Draggable2
      id={blueprint.id}
      descriptor={{
        contents: blueprint.contents,
        origin: {
          containerId: "search-tray",
          location: { type: LocationType.List, idx },
        },
      }}
    >
      <Character2 contents={blueprint.contents}></Character2>
    </Draggable2>
  );
};

const onFocus: FocusEventHandler<HTMLInputElement> = (e) => e.target.select();

const SearchTray: React.FC<Props> = memo(
  ({ state, onSearchClicked, onSearchTextChanged }) => {
    const { open, searchText, blueprints } = state;
    console.log("Search Tray", { blueprints });
    const classes = useStyles();
    const onChange = useCallback(
      (e) => onSearchTextChanged(e.target.value),
      [onSearchTextChanged]
    );

    return (
      <>
        <div className={classes.searchButtonWrapper}>
          <div className={classes.searchButton}>
            <IconButton
              onClick={onSearchClicked}
              aria-label="open search tray"
              className={classes.searchButtonIcon}
            >
              {open ? <ChevronLeft /> : <SearchIcon />}
            </IconButton>
          </div>
        </div>
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
            onFocus={onFocus}
            value={searchText}
            size="small"
          />
          <div className={classes.tokenList}>
            {blueprints.map((bp, idx) => (
              <SearchToken key={bp.id} idx={idx} blueprint={bp} />
            ))}
          </div>
        </Paper>
      </>
    );
  }
);

export default SearchTray;
