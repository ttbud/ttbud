import React from "react";
import { makeStyles, Paper } from "@material-ui/core";
import { Icon } from "./icons";
import { List } from "immutable";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import { CARD_SIZE } from "../config";

interface Props {
  icons: List<Icon>;
  activeFloor: Icon;
  onFloorSelected: (icon: Icon) => void;
}

const useStyles = makeStyles({
  icon: {
    width: CARD_SIZE,
    height: CARD_SIZE
  }
});

const FloorTokenSheet = (props: Props) => {
  const classes = useStyles();
  return (
    <Paper>
      <ToggleButtonGroup
        exclusive
        value={props.activeFloor}
        onChange={(e, newFloor) => props.onFloorSelected(newFloor)}
      >
        {props.icons.map(floorIcon => (
          <ToggleButton value={floorIcon} key={floorIcon.id}>
            <img
              src={floorIcon.img}
              className={classes.icon}
              alt={floorIcon.desc}
            />
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Paper>
  );
};

export default FloorTokenSheet;
