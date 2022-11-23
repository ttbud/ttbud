import { CSSTransition } from "react-transition-group";
import React, { memo } from "react";
import makeStyles from "@mui/styles/makeStyles";
import { Theme } from "@mui/material";

interface Props {
  lengthMs: number;
  in?: boolean;
}

const useStyles = makeStyles<Theme, Props>({
  exit: { transform: "scale(1)" },
  exitActive: ({ lengthMs }) => ({
    transform: "scale(0)",
    transition: `transform ${lengthMs}ms cubic-bezier(0.2, 0, 0, 1)`,
  }),
});

const Shrink: React.FC<Props> = memo(
  ({ lengthMs, in: inProp = true, children }) => {
    const classes = useStyles({ lengthMs });

    return (
      <CSSTransition
        in={inProp}
        timeout={lengthMs}
        enter={false}
        unmountOnExit={true}
        classNames={{
          exit: classes.exit,
          exitActive: classes.exitActive,
        }}
      >
        {children}
      </CSSTransition>
    );
  }
);

export default Shrink;
