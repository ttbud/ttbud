import React, { memo } from "react";
import { makeStyles, Paper } from "@material-ui/core";
import { Icon } from "../icons";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import { CARD_SIZE } from "../../config";

interface Props {
  icons: Icon[];
  activeFloor: Icon;
  onFloorSelected: (icon: Icon) => void;
}

const useStyles = makeStyles({
  icon: {
    width: CARD_SIZE,
    height: CARD_SIZE
  }
});

const FloorTray: React.FC<Props> = memo(function FloorTray({
  icons,
  activeFloor,
  onFloorSelected
}) {
  const classes = useStyles();
  return (
    <Paper>
      <ToggleButtonGroup
        exclusive
        value={activeFloor}
        onChange={(e, newFloor) => {
          if (newFloor !== null) {
            onFloorSelected(newFloor);
          }
        }}
      >
        {icons.map(icon => (
          <ToggleButton value={icon} key={icon.id}>
            <img src={icon.img} className={classes.icon} alt={icon.desc} />
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Paper>
  );
});

export default FloorTray;
