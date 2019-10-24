import React from "react";
import Token from "./Token";
import { makeStyles, Paper } from "@material-ui/core";

const useStyles = makeStyles(theme => ({
  tokenSource: {
    margin: theme.spacing(1)
  },
  tokenSheet: {
    backgroundColor: "#cccccc",
    margin: theme.spacing(.1)
  }
}));

export interface TokenType {
  id: string;
  icon: string;
}

interface Props {
  tokenTypes: TokenType[];
  onTokenPlaced: (type: TokenType, x: number, y: number) => void;
}

const TokenSheet = (props: Props) => {
  const classes = useStyles();

  return (
    <Paper className={classes.tokenSheet}>
      {props.tokenTypes.map(type => (
        <div className={classes.tokenSource} key={type.icon}>
          <Token
            icon={type.icon}
            // Don't want these to actually move except when they're being
            // dragged, when the token is "Placed" a new one is created on the
            // map by the parent, so just jump this token right back to where
            // it was so you can place another one
            pos={{ x: 0, y: 0 }}
            onDropped={(x, y) => props.onTokenPlaced(type, x, y)}
          />
        </div>
      ))}
    </Paper>
  );
};

export default TokenSheet;
