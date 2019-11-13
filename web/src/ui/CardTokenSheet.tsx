import React from "react";
import CardToken from "./token/CardToken";
import { makeStyles, Paper } from "@material-ui/core";
import { Icon } from "./icons";
import { List } from "immutable";

const useStyles = makeStyles(theme => ({
  tokenSource: {
    margin: theme.spacing(1)
  },
  tokenSheet: {
    backgroundColor: "#cccccc",
    margin: theme.spacing(0.1),
    padding: theme.spacing(0.1)
  }
}));

interface Props {
  tokenTypes: List<Icon>;
  onTokenPlaced: (icon: Icon, x: number, y: number) => void;
}

const CardTokenSheet = (props: Props) => {
  const classes = useStyles();

  return (
    <Paper className={classes.tokenSheet}>
      {props.tokenTypes.map(type => (
        <div className={classes.tokenSource} key={type.img}>
          <CardToken
            icon={type}
            // Don't want these to actually move except when they're being
            // dragged, when the token is "Placed" a new one is created on the
            // map by the parent, so just jump this token right back to where
            // it was so you can place another one
            pos={{ x: 0, y: 0, z: 0 }}
            onDropped={(x, y) => props.onTokenPlaced(type, x, y)}
          />
        </div>
      ))}
    </Paper>
  );
};

export default CardTokenSheet;
