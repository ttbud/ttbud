import { CSSTransition } from "react-transition-group";
import React, { memo } from "react";
import makeStyles from "@mui/styles/makeStyles";
import { Theme } from "@mui/material";

interface Props {
  lengthMs: number;
  in?: boolean;
}

const useStyles = makeStyles<Theme, Props>({
  exit: { opacity: 1 },
  exitActive: ({ lengthMs }) => ({
    opacity: 0,
    transition: `opacity ${lengthMs}ms`,
  }),
});

const Fade: React.FC<Props> = memo(
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

export default Fade;
