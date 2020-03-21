import { CSSTransition } from "react-transition-group";
import React, { memo } from "react";
import { makeStyles } from "@material-ui/core/styles";

interface Props {
  lengthMs: number;
  in?: boolean;
}

const useStyles = makeStyles({
  exit: { opacity: 1 },
  exitActive: (lengthMs: number) => ({
    opacity: 0,
    transition: `opacity ${lengthMs}ms`,
  }),
});

const Fade: React.FC<Props> = memo(
  ({ lengthMs, in: inProp = true, children }) => {
    const classes = useStyles(lengthMs);

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
