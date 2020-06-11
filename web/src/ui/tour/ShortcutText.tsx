import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
  text: {
    background: "#f2f3f5",
    borderRadius: 3,
    padding: ".2em",
    margin: "-.2em 0",
    fontFamily: "monospace",
  },
});

const ShortcutText: React.FC = ({ children }) => {
  const classes = useStyles();
  return <span className={classes.text}>{children}</span>;
};

export default ShortcutText;
